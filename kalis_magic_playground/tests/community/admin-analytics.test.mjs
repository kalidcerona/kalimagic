import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateAnalyticsEvents,
  fetchAnalyticsEvents,
  handler,
  loadAdminAnalytics,
  parseAnalyticsRange
} from '../../netlify/functions/admin-analytics.mjs';

test('parseAnalyticsRange defaults to 30 days and canonicalizes explicit ISO bounds', () => {
  const now = new Date('2026-07-10T12:00:00.000Z');
  assert.deepEqual(parseAnalyticsRange({}, now), {
    from: '2026-06-10T12:00:00.000Z',
    to: '2026-07-10T12:00:00.000Z'
  });
  assert.deepEqual(parseAnalyticsRange({
    from: '2026-07-01T09:00:00+09:00',
    to: '2026-07-10T09:00:00+09:00'
  }, now), {
    from: '2026-07-01T00:00:00.000Z',
    to: '2026-07-10T00:00:00.000Z'
  });
});

test('parseAnalyticsRange rejects malformed, reversed, and over-90-day ranges', () => {
  const now = new Date('2026-07-10T12:00:00.000Z');
  assert.throws(() => parseAnalyticsRange({ from: 'not-a-date' }, now), /invalid analytics range/);
  assert.throws(() => parseAnalyticsRange({ from: '2026-02-30T00:00:00.000Z' }, now), /invalid analytics range/);
  assert.throws(() => parseAnalyticsRange({
    from: '2026-07-10T00:00:00.000Z',
    to: '2026-07-10T00:00:00.000Z'
  }, now), /invalid analytics range/);
  assert.throws(() => parseAnalyticsRange({
    from: '2026-04-01T00:00:00.000Z',
    to: '2026-07-10T00:00:00.000Z'
  }, now), /invalid analytics range/);
});

test('aggregateAnalyticsEvents builds totals, session funnel, CTA groups, and page groups', () => {
  const events = [
    { session_id: 's1', user_id: 'u1', event_type: 'pageview', event_name: 'home', page: '/' },
    { session_id: 's1', user_id: 'u1', event_type: 'pageview', event_name: 'intro', page: '/intro.html' },
    { session_id: 's1', user_id: 'u1', event_type: 'cta_click', event_name: 'video', page: '/' },
    { session_id: 's1', user_id: 'u1', event_type: 'cta_click', event_name: 'video', page: '/intro.html' },
    { session_id: 's1', user_id: 'u1', event_type: 'lead_submit', event_name: 'newsletter', page: '/' },
    { session_id: 's2', user_id: null, event_type: 'pageview', event_name: 'home', page: '/' },
    { session_id: 's2', user_id: null, event_type: 'cta_click', event_name: 'lesson', page: '/' },
    { session_id: 's3', user_id: 'u2', event_type: 'share_click', event_name: 'kakao', page: '/works.html' }
  ];

  assert.deepEqual(aggregateAnalyticsEvents(events), {
    totals: {
      events: 8,
      pageviews: 3,
      sessions: 3,
      members: 2,
      ctaClicks: 3,
      leadSubmits: 1
    },
    funnel: [
      { step: 'pageview', sessions: 2, rate: 100 },
      { step: 'cta_click', sessions: 2, rate: 100 },
      { step: 'lead_submit', sessions: 1, rate: 50 }
    ],
    byCta: [
      { eventName: 'video', clicks: 2, sessions: 1 },
      { eventName: 'lesson', clicks: 1, sessions: 1 }
    ],
    byPage: [
      { page: '/', pageviews: 2, sessions: 2 },
      { page: '/intro.html', pageviews: 1, sessions: 1 }
    ]
  });
});

test('aggregateAnalyticsEvents returns zero rates for an empty range', () => {
  assert.deepEqual(aggregateAnalyticsEvents([]).funnel, [
    { step: 'pageview', sessions: 0, rate: 0 },
    { step: 'cta_click', sessions: 0, rate: 0 },
    { step: 'lead_submit', sessions: 0, rate: 0 }
  ]);
});

test('fetchAnalyticsEvents paginates past the Supabase 1000-row response cap', async () => {
  const ranges = [];
  const firstPage = Array.from({ length: 1000 }, (_, index) => ({ id: `event-${index}` }));
  const pages = [firstPage, [{ id: 'event-1000' }]];
  const supabase = {
    from(table) {
      assert.equal(table, 'events');
      const query = {
        select() { return this; },
        gte() { return this; },
        lt() { return this; },
        order() { return this; },
        range(from, to) {
          ranges.push([from, to]);
          return Promise.resolve({ data: pages[ranges.length - 1], error: null });
        }
      };
      return query;
    }
  };

  const events = await fetchAnalyticsEvents(supabase, {
    from: '2026-07-01T00:00:00.000Z',
    to: '2026-07-10T00:00:00.000Z'
  });

  assert.equal(events.length, 1001);
  assert.deepEqual(ranges, [[0, 999], [1000, 1999]]);
});

const ANALYTICS_FIXTURE = [
  { session_id: 's1', user_id: 'u1', event_type: 'pageview', event_name: 'home', page: '/' },
  { session_id: 's1', user_id: 'u1', event_type: 'pageview', event_name: 'intro', page: '/intro.html' },
  { session_id: 's1', user_id: 'u1', event_type: 'cta_click', event_name: 'video', page: '/' },
  { session_id: 's1', user_id: 'u1', event_type: 'cta_click', event_name: 'video', page: '/intro.html' },
  { session_id: 's1', user_id: 'u1', event_type: 'lead_submit', event_name: 'newsletter', page: '/' },
  { session_id: 's2', user_id: null, event_type: 'pageview', event_name: 'home', page: '/' },
  { session_id: 's2', user_id: null, event_type: 'cta_click', event_name: 'lesson', page: '/' },
  { session_id: 's3', user_id: 'u2', event_type: 'share_click', event_name: 'kakao', page: '/works.html' }
];

const ANALYTICS_RANGE = {
  from: '2026-06-10T12:00:00.000Z',
  to: '2026-07-10T12:00:00.000Z'
};

function analyticsClient(events, rpc) {
  const calls = [];
  return {
    calls,
    async rpc(name, args) {
      calls.push(['rpc', name, args]);
      return rpc(name, args);
    },
    from(table) {
      calls.push(['from', table]);
      const query = {
        select() { return query; },
        gte() { return query; },
        lt() { return query; },
        order() { return query; },
        range() {
          calls.push(['range']);
          return Promise.resolve({ data: events, error: null });
        }
      };
      return query;
    }
  };
}

test('rpc analytics summary matches the paging fallback on the same fixture', async () => {
  const expected = { range: ANALYTICS_RANGE, ...aggregateAnalyticsEvents(ANALYTICS_FIXTURE) };
  const viaRpc = analyticsClient(ANALYTICS_FIXTURE, () => ({
    data: aggregateAnalyticsEvents(ANALYTICS_FIXTURE),
    error: null
  }));
  const rpcBody = await loadAdminAnalytics(viaRpc, ANALYTICS_RANGE, {});
  assert.deepEqual(viaRpc.calls.filter((call) => call[0] === 'rpc'), [
    ['rpc', 'admin_analytics_summary', { p_days: 30 }]
  ]);
  assert.equal(viaRpc.calls.some((call) => call[0] === 'from'), false);
  assert.deepEqual(rpcBody, expected);

  const viaError = analyticsClient(ANALYTICS_FIXTURE, () => ({
    data: null,
    error: { message: 'PGRST202' }
  }));
  const errorBody = await loadAdminAnalytics(viaError, ANALYTICS_RANGE, {});
  assert.equal(viaError.calls.some((call) => call[0] === 'range'), true);
  assert.deepEqual(errorBody, rpcBody);

  const viaThrow = analyticsClient(ANALYTICS_FIXTURE, () => {
    throw new Error('admin_analytics_summary does not exist');
  });
  const throwBody = await loadAdminAnalytics(viaThrow, ANALYTICS_RANGE, {});
  assert.equal(viaThrow.calls.some((call) => call[0] === 'range'), true);
  assert.deepEqual(throwBody, rpcBody);
});

test('a pinned historical analytics window stays on the paging path', async () => {
  const range = {
    from: '2026-06-01T00:00:00.000Z',
    to: '2026-07-01T00:00:00.000Z'
  };
  const supabase = analyticsClient(ANALYTICS_FIXTURE, () => {
    throw new Error('historical windows must not call the summary rpc');
  });
  const body = await loadAdminAnalytics(
    supabase,
    range,
    { from: range.from, to: range.to },
    Date.parse('2026-10-10T00:00:00.000Z')
  );
  assert.equal(supabase.calls.some((call) => call[0] === 'rpc'), false);
  assert.deepEqual(body, { range, ...aggregateAnalyticsEvents(ANALYTICS_FIXTURE) });
});

test('unauthenticated and non-admin analytics requests are rejected', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('analytics auth must not use the network');
  };
  try {
    const anon = await handler({ httpMethod: 'GET', headers: {} });
    assert.equal(anon.statusCode, 403);
    assert.equal(anon.headers['cache-control'], 'no-store');
    assert.deepEqual(JSON.parse(anon.body), { error: 'admin_required' });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SECRET_KEY;
  const originalJwt = process.env.SUPABASE_JWT_SECRET;
  delete process.env.SUPABASE_JWT_SECRET;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-service-key';
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({
        id: '00000000-0000-4000-8000-000000000002',
        email: 'member@example.com'
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/rest/v1/profiles')) {
      return new Response(JSON.stringify({
        user_id: '00000000-0000-4000-8000-000000000002',
        nickname: 'member',
        role: 'member'
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`unexpected ${url}`);
  };
  try {
    const response = await handler({
      httpMethod: 'GET',
      headers: { authorization: 'Bearer member-token' }
    });
    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), { error: 'admin_required' });
    assert.equal(calls.some((url) => url.includes('/auth/v1/user')), true);
    assert.equal(calls.some((url) => url.includes('/rest/v1/events') || url.includes('admin_analytics_summary')), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = originalKey;
    if (originalJwt === undefined) delete process.env.SUPABASE_JWT_SECRET;
    else process.env.SUPABASE_JWT_SECRET = originalJwt;
  }
});
