import { requireAdmin } from './_lib/auth.mjs';
import { json, requireMethod } from './_lib/http.mjs';
import { getSupabaseAdmin } from './_lib/supabase.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_MS = 30 * DAY_MS;
const MAX_RANGE_MS = 90 * DAY_MS;
const PAGE_SIZE = 1000;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function parseIso(value) {
  if (typeof value !== 'string') return null;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!parts || !ISO_DATE_TIME.test(value)) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;

  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const isValid = calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day &&
    hour <= 23 && minute <= 59 && second <= 59;
  return isValid ? timestamp : null;
}

export function parseAnalyticsRange(query = {}, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(nowMs)) throw new Error('invalid analytics clock');

  const hasFrom = query.from !== undefined && query.from !== '';
  const hasTo = query.to !== undefined && query.to !== '';
  const toMs = hasTo ? parseIso(query.to) : nowMs;
  if (toMs === null) throw new Error('invalid analytics range');
  const fromMs = hasFrom ? parseIso(query.from) : toMs - DEFAULT_RANGE_MS;
  if (fromMs === null || fromMs >= toMs || toMs - fromMs > MAX_RANGE_MS) {
    throw new Error('invalid analytics range');
  }

  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString()
  };
}

function rate(sessions, baseline) {
  if (!baseline) return 0;
  return Number(((sessions / baseline) * 100).toFixed(1));
}

function groupedRows(groups, valueName) {
  return [...groups.entries()]
    .map(([name, group]) => ({
      name,
      [valueName]: group.count,
      sessions: group.sessions.size
    }))
    .sort((a, b) => b[valueName] - a[valueName] || a.name.localeCompare(b.name));
}

export function aggregateAnalyticsEvents(events) {
  const allSessions = new Set();
  const members = new Set();
  const funnelSessions = {
    pageview: new Set(),
    cta_click: new Set(),
    lead_submit: new Set()
  };
  const ctas = new Map();
  const pages = new Map();
  let pageviews = 0;
  let ctaClicks = 0;
  let leadSubmits = 0;

  for (const event of events) {
    const sessionId = event.session_id;
    if (sessionId) allSessions.add(sessionId);
    if (event.user_id) members.add(event.user_id);
    if (funnelSessions[event.event_type] && sessionId) funnelSessions[event.event_type].add(sessionId);

    if (event.event_type === 'pageview') {
      pageviews += 1;
      const page = String(event.page || '');
      const group = pages.get(page) || { count: 0, sessions: new Set() };
      group.count += 1;
      if (sessionId) group.sessions.add(sessionId);
      pages.set(page, group);
    }

    if (event.event_type === 'cta_click') {
      ctaClicks += 1;
      const eventName = String(event.event_name || '');
      const group = ctas.get(eventName) || { count: 0, sessions: new Set() };
      group.count += 1;
      if (sessionId) group.sessions.add(sessionId);
      ctas.set(eventName, group);
    }

    if (event.event_type === 'lead_submit') leadSubmits += 1;
  }

  const pageviewSessions = funnelSessions.pageview.size;
  return {
    totals: {
      events: events.length,
      pageviews,
      sessions: allSessions.size,
      members: members.size,
      ctaClicks,
      leadSubmits
    },
    funnel: [
      { step: 'pageview', sessions: pageviewSessions, rate: rate(pageviewSessions, pageviewSessions) },
      { step: 'cta_click', sessions: funnelSessions.cta_click.size, rate: rate(funnelSessions.cta_click.size, pageviewSessions) },
      { step: 'lead_submit', sessions: funnelSessions.lead_submit.size, rate: rate(funnelSessions.lead_submit.size, pageviewSessions) }
    ],
    byCta: groupedRows(ctas, 'clicks').map(({ name, ...row }) => ({ eventName: name, ...row })),
    byPage: groupedRows(pages, 'pageviews').map(({ name, ...row }) => ({ page: name, ...row }))
  };
}

export async function fetchAnalyticsEvents(supabase, range) {
  const events = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('events')
      .select('id,session_id,user_id,event_type,event_name,page,occurred_at')
      .gte('occurred_at', range.from)
      .lt('occurred_at', range.to)
      .order('occurred_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    events.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return events;
}

export async function handler(event) {
  try {
    requireMethod(event, ['GET']);
  } catch {
    return json(405, { error: 'method_not_allowed' });
  }

  try {
    await requireAdmin(event);
  } catch {
    return json(403, { error: 'admin_required' });
  }

  let range;
  try {
    range = parseAnalyticsRange(event.queryStringParameters || {});
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const events = await fetchAnalyticsEvents(supabase, range);
    return json(200, { range, ...aggregateAnalyticsEvents(events) });
  } catch {
    return json(500, { error: 'db_error' });
  }
}
