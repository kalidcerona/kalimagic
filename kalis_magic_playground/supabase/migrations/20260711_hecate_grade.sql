-- 마술의 신 등급(role=god) + 헤카테 배지 2종
insert into public.badges (code, label, description)
values
  ('hecate', '마술의 신', '마술의 신 — 헤카테의 열쇠 문양'),
  ('hecate_2', '마술의 신', '마술의 신 — 삼월 문양')
on conflict (code) do update set label = excluded.label, description = excluded.description;

-- profiles.role CHECK 제약에 'god' 추가 (기존 제약명이 환경마다 다를 수 있어 동적으로 찾아 교체)
do $$
declare c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%';
  if c is not null then execute format('alter table public.profiles drop constraint %I', c); end if;
end $$;
alter table public.profiles
  add constraint profiles_role_check check (role in ('member','expert','admin','kali','god'));
