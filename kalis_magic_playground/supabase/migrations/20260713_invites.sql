create table if not exists public.invites (
  code text primary key check (code ~ '^[A-Za-z0-9_-]{12}$'),
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (inviter_user_id)
);

create table if not exists public.invite_redemptions (
  new_user_id uuid primary key references auth.users(id) on delete cascade,
  invite_code text not null references public.invites(code) on delete restrict,
  redeemed_at timestamptz not null default now()
);

create index if not exists invite_redemptions_code_idx
  on public.invite_redemptions (invite_code, redeemed_at desc);

alter table public.invites enable row level security;
alter table public.invite_redemptions enable row level security;

-- 정책 없음: service client만 접근.

insert into public.quest_badges (
  code,
  track,
  level,
  name,
  material,
  symbol,
  rarity,
  threshold,
  is_secret,
  manual_only,
  public_description,
  secret_hint,
  sort_order
) values (
  'invite_first',
  'invites',
  1,
  '구전의 시작',
  '흑철',
  '전언 두루마리',
  'common',
  1,
  false,
  false,
  '초대 성공 1회 달성',
  null,
  751
)
on conflict (code) do update set
  track = excluded.track,
  level = excluded.level,
  name = excluded.name,
  material = excluded.material,
  symbol = excluded.symbol,
  rarity = excluded.rarity,
  threshold = excluded.threshold,
  is_secret = excluded.is_secret,
  manual_only = excluded.manual_only,
  public_description = excluded.public_description,
  secret_hint = excluded.secret_hint,
  sort_order = excluded.sort_order;
