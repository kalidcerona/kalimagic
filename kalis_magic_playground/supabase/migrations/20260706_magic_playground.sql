create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24),
  role text not null default 'member' check (role in ('member', 'expert', 'admin', 'kali')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  post_type text not null check (post_type in ('question', 'event_review', 'review_comment', 'free', 'magazine')),
  category text not null check (category in ('question', 'event_review', 'review', 'free', 'magazine')),
  title text not null check (char_length(title) between 2 and 120),
  body text not null check (char_length(body) between 1 and 5000),
  author_user_id uuid not null references public.profiles(user_id) on delete cascade,
  display_mode text not null default 'nickname' check (display_mode in ('nickname', 'anonymous')),
  visibility text not null default 'public' check (visibility in ('public', 'kali_only', 'expert_only')),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  youtube_video_id text null check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  post_id uuid primary key references public.posts(id) on delete cascade,
  answer_status text not null default 'waiting' check (answer_status in ('waiting', 'answered', 'closed')),
  magazine_candidate boolean not null default false
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_post_id uuid not null references public.posts(id) on delete cascade,
  author_user_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  visibility text not null default 'public' check (visibility in ('public', 'author_only')),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  is_pinned boolean not null default false,
  youtube_video_id text null check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_code text not null,
  image_src text not null,
  alt_text text not null,
  sort_order integer not null default 0,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.event_reviews (
  post_id uuid primary key references public.posts(id) on delete cascade,
  event_code text not null,
  good_moment text not null,
  impressive_scene text not null,
  next_program text not null,
  message_to_first_timer text not null
);

create table if not exists public.event_review_photos (
  post_id uuid not null references public.posts(id) on delete cascade,
  photo_id uuid not null references public.event_photos(id) on delete restrict,
  sort_order integer not null,
  primary key (post_id, photo_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_comment_id uuid null references public.comments(id) on delete cascade,
  author_user_id uuid not null references public.profiles(user_id) on delete cascade,
  display_mode text not null default 'nickname' check (display_mode in ('nickname', 'anonymous')),
  body text not null check (char_length(body) between 1 and 1200),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_table text not null,
  target_id uuid not null,
  action text not null check (action in ('hide', 'restore', 'delete', 'answer', 'edit_answer', 'mark_magazine_candidate', 'change_visibility')),
  reason text null,
  before_status text null,
  after_status text null,
  created_at timestamptz not null default now()
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null,
  description text null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  user_id uuid references auth.users(id) on delete cascade,
  badge_id uuid references public.badges(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.support_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  support_level text not null check (support_level in ('3000', '10000', '50000')),
  source text null,
  created_at timestamptz not null default now()
);

create index if not exists posts_public_list_idx on public.posts (status, visibility, category, created_at desc);
create index if not exists posts_author_idx on public.posts (author_user_id, created_at desc);
create index if not exists comments_post_idx on public.comments (post_id, created_at asc);
create index if not exists answers_question_idx on public.answers (question_post_id, created_at asc);

-- RLS 정책 0개는 의도적인 deny-all 설계다.
-- 모든 DB 접근은 Netlify Functions에서 service key로만 수행한다.
-- anon/authenticated 클라이언트의 직접 테이블 접근은 차단된다.
-- 정책을 추가하기 전 이 전제를 깨는지 먼저 확인한다.
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.event_photos enable row level security;
alter table public.event_reviews enable row level security;
alter table public.event_review_photos enable row level security;
alter table public.comments enable row level security;
alter table public.moderation_events enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.support_records enable row level security;

insert into public.badges (code, label, description)
values
  ('user', '이용자', '마술 놀이터 이용자'),
  ('supporter_3000', '3천원 후원자', '운영비를 응원한 사람'),
  ('supporter_10000', '1만원 후원자', '운영비를 응원한 사람'),
  ('supporter_50000', '5만원 후원자', '운영비를 크게 응원한 사람'),
  ('expert', '전문가', '칼리형이 승인한 답변자'),
  ('kali', '칼리', '칼리형')
on conflict (code) do nothing;
