-- Additive and idempotent. NULL retains the historical tool/lifetime meaning.
-- Existing `all` rows are expanded lazily on their first administrator change.
-- Apply before deploying the per-app administrator and authorization readers.
alter table public.tool_access
  add column if not exists per_app_access jsonb;

comment on column public.tool_access.per_app_access is
  'Per-app calc/stopwatch status and lifetime. NULL uses legacy tool/status/lifetime; non-NULL is authoritative.';
