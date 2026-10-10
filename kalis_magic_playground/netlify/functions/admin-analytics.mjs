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

const SUMMARY_TOTAL_KEYS = ['events', 'pageviews', 'sessions', 'members', 'ctaClicks', 'leadSubmits'];
const SUMMARY_FUNNEL_STEPS = ['pageview', 'cta_click', 'lead_submit'];

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function finiteRate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(1));
}

export function analyticsSummaryDays(query = {}, range, now = Date.now()) {
  const hasTo = query.to !== undefined && query.to !== '';
  const toMs = Date.parse(range.to);
  const fromMs = Date.parse(range.from);
  if (!Number.isFinite(toMs) || !Number.isFinite(fromMs)) return null;
  const span = toMs - fromMs;
  if (span <= 0 || span % DAY_MS !== 0) return null;
  const days = span / DAY_MS;
  if (!Number.isInteger(days) || days < 1 || days > 90) return null;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  // admin_analytics_summary only knows "the last p_days ending now".
  // A pinned historical window stays on the paging path so its bounds do not move.
  if (hasTo && Number.isFinite(nowMs) && Math.abs(toMs - nowMs) > 5000) return null;
  return days;
}

function summaryRows(rows, nameKey, countKey) {
  if (!Array.isArray(rows)) return null;
  const normalized = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || typeof row[nameKey] !== 'string') return null;
    if (!Number.isFinite(Number(row[countKey])) || !Number.isFinite(Number(row.sessions))) return null;
    normalized.push({
      [nameKey]: row[nameKey],
      [countKey]: finiteNumber(row[countKey]),
      sessions: finiteNumber(row.sessions)
    });
  }
  return normalized;
}

export function summaryFromRpc(data) {
  let value = data;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!value.totals || typeof value.totals !== 'object') return null;
  if (!SUMMARY_TOTAL_KEYS.every((key) => Object.prototype.hasOwnProperty.call(value.totals, key))) return null;
  if (!Array.isArray(value.funnel) || value.funnel.length !== SUMMARY_FUNNEL_STEPS.length) return null;
  const funnel = [];
  for (let index = 0; index < SUMMARY_FUNNEL_STEPS.length; index += 1) {
    const step = value.funnel[index];
    if (!step || step.step !== SUMMARY_FUNNEL_STEPS[index]) return null;
    if (!Number.isFinite(Number(step.sessions)) || !Number.isFinite(Number(step.rate))) return null;
    funnel.push({
      step: step.step,
      sessions: finiteNumber(step.sessions),
      rate: finiteRate(step.rate)
    });
  }
  const byCta = summaryRows(value.byCta, 'eventName', 'clicks');
  const byPage = summaryRows(value.byPage, 'page', 'pageviews');
  if (!byCta || !byPage) return null;
  return {
    totals: {
      events: finiteNumber(value.totals.events),
      pageviews: finiteNumber(value.totals.pageviews),
      sessions: finiteNumber(value.totals.sessions),
      members: finiteNumber(value.totals.members),
      ctaClicks: finiteNumber(value.totals.ctaClicks),
      leadSubmits: finiteNumber(value.totals.leadSubmits)
    },
    funnel,
    byCta,
    byPage
  };
}

export async function loadAdminAnalytics(supabase, range, query = {}, now = Date.now()) {
  const pDays = analyticsSummaryDays(query, range, now);
  if (pDays != null) {
    try {
      const { data, error } = await supabase.rpc('admin_analytics_summary', { p_days: pDays });
      const summary = !error ? summaryFromRpc(data) : null;
      if (summary) return { range, ...summary };
    } catch {
      // Missing function or a client without rpc keeps the paging path.
    }
  }
  const events = await fetchAnalyticsEvents(supabase, range);
  return { range, ...aggregateAnalyticsEvents(events) };
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

  const query = event.queryStringParameters || {};
  let range;
  try {
    range = parseAnalyticsRange(query);
  } catch {
    return json(400, { error: 'invalid_payload' });
  }

  try {
    const supabase = getSupabaseAdmin();
    return json(200, await loadAdminAnalytics(supabase, range, query));
  } catch {
    return json(500, { error: 'db_error' });
  }
}
