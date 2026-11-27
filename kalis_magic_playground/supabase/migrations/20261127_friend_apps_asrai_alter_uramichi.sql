-- Allow separate friend distribution entitlements for ASRAI, ALTER, and URAMICHI.
begin;
alter table public.friend_app_access
  drop constraint if exists friend_app_access_tool_check;
alter table public.friend_app_access
  add constraint friend_app_access_tool_check
  check (tool in ('unlock', 'stopwatch-uni', 'aletheia', 'usotsuki', 'tobira', 'spinner', 'arosaegida', 'pimax', 'choice', 'magicshow', 'gwayubulgeup', 'memdeck', 'bell', 'slot', 'asrai', 'alter', 'uramichi'));
commit;
