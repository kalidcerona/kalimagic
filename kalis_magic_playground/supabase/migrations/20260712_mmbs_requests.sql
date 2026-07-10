alter table public.profiles
  add column if not exists mmbs_request_status text null;

alter table public.profiles
  add column if not exists mmbs_requested_at timestamptz null;

alter table public.profiles
  drop constraint if exists profiles_mmbs_request_status_check;

alter table public.profiles
  add constraint profiles_mmbs_request_status_check
  check (mmbs_request_status is null or mmbs_request_status in ('requested', 'done'));
