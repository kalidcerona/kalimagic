-- Maintenance only: stop every tool-access writer before running, and keep them
-- stopped until the chosen deployment is active. Any exception aborts everything.
-- Keep the nullable column for forward compatibility; clear JSON only losslessly.
begin;
lock table public.tool_access in access exclusive mode;
do $$
declare
  column_info record;
  row_count bigint;
  split_count bigint;
  blocked_count bigint;
  changed_count bigint;
  blocked_ids uuid[];
begin
  select atttypid, attnotnull, atthasdef, attgenerated into column_info
    from pg_attribute where attrelid = 'public.tool_access'::regclass
      and attname = 'per_app_access' and not attisdropped;
  if not found then
    raise exception 'per_app_access missing; inspect schema before rollback';
  end if;
  if column_info.atttypid <> 'jsonb'::regtype or column_info.attnotnull
      or column_info.atthasdef or column_info.attgenerated <> '' then
    raise exception 'per_app_access schema mismatch; rollback aborted';
  end if;
  select count(*), count(*) filter (where per_app_access is not null)
    into row_count, split_count from public.tool_access;

  -- CASE prevents jsonb_each on scalar/array JSON. Strict key sets also reject
  -- future metadata that the old representation would silently discard.
  with blocked as (select id from public.tool_access
    where per_app_access is not null and not (
      case when jsonb_typeof(per_app_access) = 'object' then
        (select count(*) between 1 and 2 from jsonb_each(per_app_access))
        and not exists (
          select 1 from jsonb_each(per_app_access) app
          where app.key not in ('calc', 'stopwatch') or
            case when jsonb_typeof(app.value) = 'object' then not (
              (select count(*) = 2 from jsonb_each(app.value))
              and app.value ? 'status' and app.value ? 'lifetime'
              and coalesce(app.value->>'status' in ('pending', 'approved'), false)
              and coalesce(jsonb_typeof(app.value->'status') = 'string', false)
              and coalesce(jsonb_typeof(app.value->'lifetime') = 'boolean', false)
            ) else true end
        )
        and (select count(distinct app.value->'status') = 1 from jsonb_each(per_app_access) app)
        and (select count(distinct app.value->'lifetime') = 1 from jsonb_each(per_app_access) app)
      else false end
    )) select (select count(*) from blocked),
      array(select id from blocked order by id limit 20) into blocked_count, blocked_ids;
  raise notice 'rollback preflight: rows=%, JSON rows=%, blocked rows=%', row_count, split_count, blocked_count;
  raise notice 'rollback blocked sample IDs (maximum 20)=%', blocked_ids;
  if blocked_count <> 0 then
    raise exception 'Non-lossless rollback: % rows have mixed state/duration or unexpected JSON; keep per-app readers deployed', blocked_count;
  end if;

  -- Every JSON row has now been proved exactly representable by the old columns.
  update public.tool_access t set
    tool = case when t.per_app_access ? 'calc' and t.per_app_access ? 'stopwatch' then 'all'
      when t.per_app_access ? 'calc' then 'calc' else 'stopwatch' end,
    status = coalesce(t.per_app_access->'calc', t.per_app_access->'stopwatch')->>'status',
    lifetime = (coalesce(t.per_app_access->'calc', t.per_app_access->'stopwatch')->>'lifetime')::boolean,
    per_app_access = null
    where t.per_app_access is not null;
  get diagnostics changed_count = row_count;
  if changed_count <> split_count or (select count(*) from public.tool_access) <> row_count then
    raise exception 'Rollback row count mismatch';
  end if;
  raise notice 'rollback complete: projected rows=%, total rows=%; nullable column retained', changed_count, row_count;
end $$;
commit;
