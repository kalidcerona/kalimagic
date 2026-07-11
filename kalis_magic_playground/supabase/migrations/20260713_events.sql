create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid null references auth.users(id) on delete set null,
  event_type text not null check (
    event_type in ('pageview','cta_click','share_click','invite_click','lead_submit')
  ),
  event_name text not null check (char_length(event_name) between 1 and 80),
  page text not null check (char_length(page) between 1 and 300),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists events_occurred_at_idx on public.events (occurred_at desc);
create index if not exists events_type_occurred_at_idx on public.events (event_type, occurred_at desc);
create index if not exists events_session_occurred_at_idx on public.events (session_id, occurred_at desc);
create index if not exists events_user_occurred_at_idx on public.events (user_id, occurred_at desc) where user_id is not null;
alter table public.events enable row level security;
-- 의도적으로 policy 없음: anon/authenticated deny-all, service client만 접근.
