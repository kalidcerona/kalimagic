-- Aggregates the admin analytics tab in one call.
-- The window is the last p_days of exact 86400-second days ending at
-- transaction now(), matching admin-analytics.mjs (gte from, lt to).
-- JS does not bucket by calendar day, so occurred_at stays timestamptz
-- and is not converted to Asia/Seoul.
begin;

create or replace function public.admin_analytics_summary(p_days integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      case
        when p_days between 1 and 90
          then now() - (p_days::bigint * 86400) * interval '1 second'
        else null
      end as from_at,
      now() as to_at
  ),
  filtered as (
    select e.session_id, e.user_id, e.event_type, e.event_name, e.page
    from public.events e
    cross join bounds b
    where b.from_at is not null
      and e.occurred_at >= b.from_at
      and e.occurred_at < b.to_at
  ),
  totals as (
    select
      count(*)::int as events,
      count(*) filter (where event_type = 'pageview')::int as pageviews,
      count(distinct session_id)::int as sessions,
      count(distinct user_id) filter (where user_id is not null)::int as members,
      count(*) filter (where event_type = 'cta_click')::int as cta_clicks,
      count(*) filter (where event_type = 'lead_submit')::int as lead_submits,
      count(distinct session_id) filter (where event_type = 'pageview')::int as pageview_sessions,
      count(distinct session_id) filter (where event_type = 'cta_click')::int as cta_sessions,
      count(distinct session_id) filter (where event_type = 'lead_submit')::int as lead_sessions
    from filtered
  ),
  cta_rows as (
    select
      coalesce(event_name, '') as event_name,
      count(*)::int as clicks,
      count(distinct session_id)::int as sessions
    from filtered
    where event_type = 'cta_click'
    group by coalesce(event_name, '')
  ),
  page_rows as (
    select
      coalesce(page, '') as page,
      count(*)::int as pageviews,
      count(distinct session_id)::int as sessions
    from filtered
    where event_type = 'pageview'
    group by coalesce(page, '')
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'events', coalesce(t.events, 0),
      'pageviews', coalesce(t.pageviews, 0),
      'sessions', coalesce(t.sessions, 0),
      'members', coalesce(t.members, 0),
      'ctaClicks', coalesce(t.cta_clicks, 0),
      'leadSubmits', coalesce(t.lead_submits, 0)
    ),
    'funnel', jsonb_build_array(
      jsonb_build_object(
        'step', 'pageview',
        'sessions', coalesce(t.pageview_sessions, 0),
        'rate', case when coalesce(t.pageview_sessions, 0) = 0 then 0 else 100 end
      ),
      jsonb_build_object(
        'step', 'cta_click',
        'sessions', coalesce(t.cta_sessions, 0),
        'rate', case
          when coalesce(t.pageview_sessions, 0) = 0 then 0
          else round((t.cta_sessions::numeric * 100) / t.pageview_sessions, 1)
        end
      ),
      jsonb_build_object(
        'step', 'lead_submit',
        'sessions', coalesce(t.lead_sessions, 0),
        'rate', case
          when coalesce(t.pageview_sessions, 0) = 0 then 0
          else round((t.lead_sessions::numeric * 100) / t.pageview_sessions, 1)
        end
      )
    ),
    'byCta', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'eventName', c.event_name,
          'clicks', c.clicks,
          'sessions', c.sessions
        )
        order by c.clicks desc, c.event_name collate "C" asc
      )
      from cta_rows c
    ), '[]'::jsonb),
    'byPage', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'page', p.page,
          'pageviews', p.pageviews,
          'sessions', p.sessions
        )
        order by p.pageviews desc, p.page collate "C" asc
      )
      from page_rows p
    ), '[]'::jsonb)
  )
  from totals t;
$$;

revoke all on function public.admin_analytics_summary(integer) from public, anon, authenticated;
grant execute on function public.admin_analytics_summary(integer) to service_role;

commit;
