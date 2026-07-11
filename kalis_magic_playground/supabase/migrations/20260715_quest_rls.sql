-- 퀘스트 배지 3테이블 RLS 마감(전면 차단, service client 전용 = 기존 모델 정합) + FK 보강
alter table public.quest_badges enable row level security;
alter table public.user_quest_badges enable row level security;
alter table public.answer_helpful_votes enable row level security;

alter table public.user_quest_badges
  add constraint user_quest_badges_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.user_quest_badges
  add constraint user_quest_badges_awarded_by_fkey
  foreign key (awarded_by) references auth.users(id) on delete set null;
alter table public.answer_helpful_votes
  add constraint answer_helpful_votes_answer_id_fkey
  foreign key (answer_id) references public.answers(id) on delete cascade;
alter table public.answer_helpful_votes
  add constraint answer_helpful_votes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
