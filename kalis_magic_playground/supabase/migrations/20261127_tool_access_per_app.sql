-- Apply before deploying per-app readers. No existing row is rewritten.
begin;

-- Serialize schema inspection/counts/DDL against application writers.
lock table public.tool_access in access exclusive mode;
do $$
declare
  row_count bigint;
  split_count bigint := 0;
  distribution jsonb;
  column_info record;
  blocked_count bigint;
  blocked_ids uuid[];
begin
  -- Validate native columns before attempting DDL on an unexpected table.
  if (select count(*) from pg_attribute
      where attrelid = 'public.tool_access'::regclass and not attisdropped
        and ((attname = 'id' and atttypid = 'uuid'::regtype and attnotnull)
          or (attname = 'email' and atttypid = 'text'::regtype and attnotnull)
          or (attname = 'tool' and atttypid = 'text'::regtype and not attnotnull)
          or (attname = 'status' and atttypid = 'text'::regtype and attnotnull)
          or (attname = 'lifetime' and atttypid = 'boolean'::regtype and attnotnull))) <> 5 then
    raise exception 'tool_access native schema mismatch; no DDL performed';
  end if;

  select count(*) into row_count from public.tool_access;
  select coalesce(jsonb_agg(to_jsonb(counts) order by tool, status, lifetime), '[]'::jsonb)
    into distribution from (
      select tool, status, lifetime, count(*) as rows
        from public.tool_access group by tool, status, lifetime
    ) counts;
  raise notice 'tool_access before DDL: rows=%, distribution=%', row_count, distribution;

  select atttypid, attnotnull, atthasdef, attgenerated into column_info
    from pg_attribute where attrelid = 'public.tool_access'::regclass
      and attname = 'per_app_access' and not attisdropped;
  if found then
    if column_info.atttypid <> 'jsonb'::regtype or column_info.attnotnull
        or column_info.atthasdef or column_info.attgenerated <> '' then
      raise exception 'per_app_access must be nullable jsonb without default/generated expression; no DDL performed';
    end if;
    execute 'select count(*) from public.tool_access where per_app_access is not null' into split_count;
    -- A previous per-app deployment may have persisted unsafe legacy summaries.
    -- Reject malformed authoritative JSON before considering any projection.
    with invalid as (
      select id from public.tool_access where per_app_access is not null and not (
        case when jsonb_typeof(per_app_access) = 'object' then
          (select count(*) between 1 and 2 from jsonb_each(per_app_access))
          and not exists (select 1 from jsonb_each(per_app_access) app
            where app.key not in ('calc', 'stopwatch') or
              case when jsonb_typeof(app.value) = 'object' then not (
                (select count(*) = 2 from jsonb_each(app.value))
                and app.value ? 'status' and app.value ? 'lifetime'
                and coalesce(app.value->>'status' in ('pending', 'approved'), false)
                and coalesce(jsonb_typeof(app.value->'status') = 'string', false)
                and coalesce(jsonb_typeof(app.value->'lifetime') = 'boolean', false)
              ) else true end)
        else false end)
    ) select (select count(*) from invalid),
        array(select id from invalid order by id limit 20) into blocked_count, blocked_ids;
    raise notice 'existing JSON validation: invalid rows=%, sample IDs=%', blocked_count, blocked_ids;
    if blocked_count > 0 then
      raise exception 'Unexpected authoritative JSON; no DDL performed; retain per-app readers';
    end if;

    with summaries as (
      select t.id, count(*) as apps,
        count(*) filter (where app.value->>'status' = 'approved') as approved,
        max(app.key) as only_app,
        max(app.key) filter (where app.value->>'status' = 'approved') as approved_app,
        bool_and((app.value->>'lifetime')::boolean) as all_lifetime,
        bool_and((app.value->>'lifetime')::boolean) filter (where app.value->>'status' = 'approved') as approved_lifetime
      from public.tool_access t cross join lateral jsonb_each(t.per_app_access) app
      where t.per_app_access is not null group by t.id
    ), mismatches as (
      select t.id from public.tool_access t join summaries s using (id)
      where t.tool is distinct from (case when s.approved = 2 then 'all'
          when s.approved = 1 then s.approved_app when s.apps = 2 then 'all' else s.only_app end)
        or t.status is distinct from (case when s.approved > 0 then 'approved' else 'pending' end)
        or t.lifetime is distinct from (case when s.approved > 0 then s.approved_lifetime else s.all_lifetime end)
    ) select (select count(*) from mismatches),
        array(select id from mismatches order by id limit 20) into blocked_count, blocked_ids;
    raise notice 'existing JSON projection check: mismatched rows=%, sample IDs=%', blocked_count, blocked_ids;
    if blocked_count > 0 then
      raise exception 'Existing legacy projections need reviewed roll-forward repair; no DDL performed; do not deploy old readers';
    end if;
    raise notice 'per_app_access already matches; authoritative JSON rows=%; no ADD COLUMN', split_count;
  else
    raise notice 'per_app_access absent; adding nullable jsonb; existing rows=%', row_count;
    alter table public.tool_access add column per_app_access jsonb;
  end if;
  if (select count(*) from public.tool_access) <> row_count then
    raise exception 'tool_access row count changed during migration';
  end if;
end $$;

comment on column public.tool_access.per_app_access is
  'Authoritative calc/stopwatch state and duration; NULL uses legacy columns. Old deployment rollback requires the guarded rollback script.';
commit;
