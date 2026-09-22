-- Store one Google approval per person and app, independent of legacy tool_access.
create table if not exists public.friend_app_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  email text not null check (email = lower(email)),
  tool text not null check (tool in ('unlock', 'stopwatch-uni')),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  lifetime boolean not null default false,
  display_name text null,
  nickname text null,
  note text null,
  requested_at timestamptz not null default now(),
  approved_at timestamptz null,
  approved_by uuid null,
  created_at timestamptz not null default now(),
  created_by uuid null
);

create unique index if not exists friend_app_access_email_tool_idx
  on public.friend_app_access (lower(email), tool);

create unique index if not exists friend_app_access_user_tool_idx
  on public.friend_app_access (user_id, tool)
  where user_id is not null;

alter table public.friend_app_access enable row level security;
