-- Extend only the known tool allowlist, under the same lock as the preflight.
begin;
lock table public.friend_app_access in share row exclusive mode;

do $migration$
declare
  expected constant text[] := array['unlock', 'stopwatch-uni', 'aletheia', 'usotsuki', 'tobira', 'spinner', 'arosaegida', 'pimax', 'choice', 'magicshow', 'gwayubulgeup', 'memdeck', 'bell', 'slot'];
  additions constant text[] := array['asrai', 'alter', 'uramichi'];
  definition text;
  row_counts jsonb;
  allowed text[];
  entries text;
begin
  select pg_get_constraintdef(oid) into definition
  from pg_constraint
  where conrelid = 'public.friend_app_access'::regclass
    and conname = 'friend_app_access_tool_check' and contype = 'c';

  select coalesce(jsonb_object_agg(tool, n), '{}'::jsonb) into row_counts
  from (select tool, count(*) as n from public.friend_app_access group by tool) as counts;
  raise notice 'Current tool constraint: %, rows per tool: %', definition, row_counts;

  -- PostgreSQL deparses the historical text IN list as = ANY (ARRAY[...]).
  -- Reconstruct the entire predicate: literals inside an unrelated expression
  -- must never qualify it for either the no-op or the replacement.
  select array_agg(m[1] order by pos),
         string_agg(format('%L::text', m[1]), ', ' order by pos)
    into allowed, entries
  from regexp_matches(definition, '''([a-z0-9-]+)''::text', 'g')
       with ordinality as matches(m, pos);

  if allowed is null or definition is distinct from
      format('CHECK ((tool = ANY (ARRAY[%s])))', entries) then
    raise exception 'Missing or unrecognized friend_app_access_tool_check: %', definition;
  end if;
  if allowed @> additions then
    return;
  end if;
  if not (allowed @> expected and allowed <@ expected) then
    raise exception 'Unexpected friend app tool allowlist: %', allowed;
  end if;

  select string_agg(quote_literal(tool_key), ', ' order by pos) into entries
  from unnest(allowed || additions) with ordinality as keys(tool_key, pos);
  alter table public.friend_app_access drop constraint friend_app_access_tool_check;
  execute format('alter table public.friend_app_access add constraint friend_app_access_tool_check check (tool in (%s))', entries);
end;
$migration$;
commit;
