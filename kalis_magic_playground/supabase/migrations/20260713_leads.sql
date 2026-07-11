create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  contact_type text not null check (contact_type in ('kakao','phone','email')),
  contact text not null check (char_length(contact) between 2 and 200),
  source text not null check (char_length(source) between 1 and 80),
  session_id uuid not null,
  user_id uuid null references auth.users(id) on delete set null,
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists leads_source_created_at_idx on public.leads (source, created_at desc);
create index if not exists leads_session_created_at_idx on public.leads (session_id, created_at desc);
alter table public.leads enable row level security;
-- 정책 없음: service client만.
