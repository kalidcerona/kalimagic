create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post','comment')),
  target_id uuid not null,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 300),
  created_at timestamptz not null default now(),
  unique (reporter_user_id, target_type, target_id)
);

create index if not exists post_reports_target_idx on public.post_reports (target_type, target_id);

alter table public.post_reports enable row level security;
-- 정책 없음: service client만.
