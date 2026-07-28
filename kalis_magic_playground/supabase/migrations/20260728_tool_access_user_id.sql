-- 회원 관리 화면에서 auth 사용자의 user_id로 도구 권한을 매칭하고 부여할 수 있게 한다.
-- 기존 이메일 기반 권한은 그대로 유지하며, 연결 가능한 행만 user_id를 선택적으로 기록한다.
alter table public.tool_access add column if not exists user_id uuid;

create unique index if not exists tool_access_user_id_idx
  on public.tool_access (user_id) where user_id is not null;
