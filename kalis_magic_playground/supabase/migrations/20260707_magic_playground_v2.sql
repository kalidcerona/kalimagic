alter table public.posts
  add column if not exists view_count integer not null default 0 check (view_count >= 0);

alter table public.posts
  add column if not exists is_notice boolean not null default false;

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_idx
  on public.post_likes (user_id, created_at desc);

create index if not exists posts_v2_public_list_idx
  on public.posts (status, is_notice desc, created_at desc);

create index if not exists posts_v2_category_list_idx
  on public.posts (status, category, is_notice desc, created_at desc);

alter table public.moderation_events
  drop constraint if exists moderation_events_action_check;

alter table public.moderation_events
  add constraint moderation_events_action_check
  check (action in (
    'hide',
    'restore',
    'delete',
    'answer',
    'edit_answer',
    'mark_magazine_candidate',
    'change_visibility',
    'pin_notice',
    'unpin_notice'
  ));

alter table public.post_likes enable row level security;
