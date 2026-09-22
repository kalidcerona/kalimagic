-- Grant unlock and integrated stopwatch together without including legacy tools.
alter table public.tool_access
  drop constraint if exists tool_access_tool_check;

alter table public.tool_access
  add constraint tool_access_tool_check
  check (tool in ('stopwatch', 'calc', 'friend-apps', 'all'));
