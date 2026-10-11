-- Allow separate friend distribution entitlements for Magic Show Buster.
begin;
alter table public.friend_app_access
  drop constraint if exists friend_app_access_tool_check;
alter table public.friend_app_access
  add constraint friend_app_access_tool_check
  check (tool in ('unlock', 'stopwatch-uni', 'aletheia', 'usotsuki', 'tobira', 'spinner', 'arosaegida', 'pimax', 'choice', 'magicshow'));
commit;
