create table if not exists public.tool_access (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  tool text not null check (tool in ('stopwatch', 'calc', 'all')),
  note text null,
  lifetime boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid null
);

create unique index if not exists tool_access_email_tool_idx
  on public.tool_access (lower(email), tool);

alter table public.tool_access enable row level security;

comment on column public.tool_access.lifetime is
  'true면 로그인 없이 90일 쿠키를 자동 갱신하는 평생 권한';

-- 정책 없음: service key만 접근한다.
-- anon/authenticated 클라이언트의 직접 접근은 전면 차단된다.
