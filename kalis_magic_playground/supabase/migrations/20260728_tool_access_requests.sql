-- 도구 접근 요청(신청→승인) 흐름 추가.
-- 기존 tool_access 테이블은 이미 프로덕션에 있으므로 멱등 ALTER만 사용한다.

-- status: 신청 대기(pending) / 승인 완료(approved)
alter table public.tool_access add column if not exists status text not null default 'pending';
-- display_name: 구글 로그인 이름(user_metadata.full_name), 누가 신청했는지 알아보기 위한 참고값
alter table public.tool_access add column if not exists display_name text;
-- nickname: 사이트 프로필 닉네임(profiles.nickname), 커뮤니티 활동과 대조용
alter table public.tool_access add column if not exists nickname text;
-- requested_at: 신청 시각(대기 목록 정렬 기준)
alter table public.tool_access add column if not exists requested_at timestamptz default now();
-- approved_at: 승인 시각
alter table public.tool_access add column if not exists approved_at timestamptz;
-- approved_by: 승인한 관리자 user_id
alter table public.tool_access add column if not exists approved_by uuid;

-- status 값 제한. 제약 이름 중복 시 재생성하지 않는다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tool_access_status_check'
  ) then
    alter table public.tool_access
      add constraint tool_access_status_check check (status in ('pending', 'approved'));
  end if;
end $$;

-- 신청 단계에서는 tool이 아직 정해지지 않으므로 not null 해제.
alter table public.tool_access alter column tool drop not null;

-- 단, 승인된 행은 반드시 tool이 있어야 한다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tool_access_approved_tool_check'
  ) then
    alter table public.tool_access
      add constraint tool_access_approved_tool_check check (status <> 'approved' or tool is not null);
  end if;
end $$;

-- 이제 한 사람당 한 행이므로 (email, tool) 복합 유니크를 email 단독으로 교체한다.
drop index if exists tool_access_email_tool_idx;
create unique index if not exists tool_access_email_idx on public.tool_access (lower(email));

-- 기존 데이터(칼리형 등)는 이미 허용된 사람들이므로 승인 상태로 승격한다.
update public.tool_access
set status = 'approved',
    approved_at = coalesce(approved_at, now())
-- tool이 있는 행만 승격한다. 재실행 시 진짜 신청 대기 행(tool is null)을 승인으로 뒤집지 않기 위함(멱등성).
where status is distinct from 'approved' and tool is not null;

comment on column public.tool_access.status is
  'pending=승인 대기 중인 신청, approved=접근 허용됨';
comment on column public.tool_access.requested_at is
  '구글 로그인 후 자동 신청이 접수된 시각';
