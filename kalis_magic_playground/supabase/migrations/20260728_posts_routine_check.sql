-- UI와 서버 validator는 마술 보관소(routine)를 지원하지만,
-- DB의 posts CHECK 제약만 routine을 허용하지 않아 글 작성이 실패하던 문제를 해결한다.
-- 기존 허용값은 모두 새 허용집합의 부분집합이므로 CHECK 교체 시 기존 행 재검증은 안전하며,
-- 데이터 UPDATE/DELETE 없이 제약만 교체한다.
do $$
declare
  constraint_name text;
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.posts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%post_type%'
      and pg_get_constraintdef(oid) like '%routine%'
  ) then
    for constraint_name in
      select conname
      from pg_constraint
      where conrelid = 'public.posts'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) like '%post_type%'
    loop
      execute format(
        'alter table public.posts drop constraint %I',
        constraint_name
      );
    end loop;

    alter table public.posts
      add constraint posts_post_type_check
      check (post_type in ('question', 'event_review', 'review_comment', 'free', 'routine', 'magazine'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.posts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%category%'
      and pg_get_constraintdef(oid) like '%routine%'
  ) then
    for constraint_name in
      select conname
      from pg_constraint
      where conrelid = 'public.posts'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) like '%category%'
    loop
      execute format(
        'alter table public.posts drop constraint %I',
        constraint_name
      );
    end loop;

    alter table public.posts
      add constraint posts_category_check
      check (category in ('question', 'event_review', 'review', 'free', 'routine', 'magazine'));
  end if;
end $$;
