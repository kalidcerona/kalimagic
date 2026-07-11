import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateAnalyticsEvents,
  fetchAnalyticsEvents,
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
