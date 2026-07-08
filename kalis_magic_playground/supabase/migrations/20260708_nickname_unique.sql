-- 기존 중복 닉네임 정리: 같은 lower(nickname) 그룹에서 created_at 빠른 1명만 유지, 나머지는 suffix 부여한다.
with ranked_profiles as (
  select
    user_id,
    nickname,
    row_number() over (
      partition by lower(nickname)
      order by created_at asc, user_id asc
    ) as rn
  from public.profiles
)
update public.profiles as profiles
set
  nickname = left(
    ranked_profiles.nickname,
    24 - char_length('-' || ranked_profiles.rn::text || '-' || left(ranked_profiles.user_id::text, 4))
  ) || '-' || ranked_profiles.rn::text || '-' || left(ranked_profiles.user_id::text, 4),
  updated_at = now()
from ranked_profiles
where profiles.user_id = ranked_profiles.user_id
  and ranked_profiles.rn > 1;

alter table public.profiles
  add column if not exists nickname_set boolean not null default false;

create unique index if not exists profiles_nickname_lower_uidx
  on public.profiles (lower(nickname));

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
    'unpin_notice',
    'change_member_role'
  ));
