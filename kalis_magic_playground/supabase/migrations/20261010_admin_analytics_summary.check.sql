-- Read-only checks. anon execute must be false.
-- Runs admin_analytics_summary once with p_days = 30 and returns the jsonb size.

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  l.lanname as language,
  p.provolatile,
  p.prosecdef as security_definer,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.proname = 'admin_analytics_summary';

select has_function_privilege('anon', 'public.admin_analytics_summary(integer)', 'execute') as anon_can_execute;

select has_function_privilege('authenticated', 'public.admin_analytics_summary(integer)', 'execute') as authenticated_can_execute;

select has_function_privilege('service_role', 'public.admin_analytics_summary(integer)', 'execute') as service_role_can_execute;

select octet_length(public.admin_analytics_summary(30)::text) as jsonb_size;
