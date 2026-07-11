import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEventBatch,
  validateTrackEvent
} from '../../netlify/functions/_lib/validators.mjs';
import { insertTrackedEvents } from '../../netlify/functions/track.mjs';

const NOW = new Date('2026-07-10T12:00:00.000Z');
const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

function event(overrides = {}) {
  return {
    eventId: EVENT_ID,
    sessionId: SESSION_ID,
    eventType: 'cta_click',
    eventName: 'video',
    page: '/home?ref=email&utm_source=newsletter',
    occurredAt: '2026-07-10T11:59:00.000Z',
    meta: { placement: 'hero' },
    ...overrides
  };
}

test('validateTrackEvent accepts a valid event and removes the page query string', () => {
  assert.deepEqual(validateTrackEvent(event(), { now: NOW }), {
    eventId: EVENT_ID,
    sessionId: SESSION_ID,
    eventType: 'cta_click',
    eventName: 'video',
    page: '/home',
    occurredAt: '2026-07-10T11:59:00.000Z',
    meta: { placement: 'hero' }
  });
});

test('validateEventBatch accepts up to 20 events and rejects larger or empty batches', () => {
  const events = Array.from({ length: 20 }, (_, index) => event({
    eventId: `${String(index + 1).padStart(8, '0')}-1111-4111-8111-111111111111`
  }));
  assert.equal(validateEventBatch({ events }, { now: NOW }).length, 20);
  assert.throws(() => validateEventBatch({ events: [] }, { now: NOW }), /batch size/);
  assert.throws(() => validateEventBatch({ events: [...events, event()] }, { now: NOW }), /batch size/);
});

test('tracking validation rejects invalid ids, types, lengths, and server-controlled user ids', () => {
  assert.throws(() => validateTrackEvent(event({ eventId: 'not-a-uuid' }), { now: NOW }), /event id/);
  assert.throws(() => validateTrackEvent(event({ eventType: 'purchase' }), { now: NOW }), /event type/);
  assert.throws(() => validateTrackEvent(event({ eventName: 'x'.repeat(81) }), { now: NOW }), /event name/);
  assert.throws(() => validateTrackEvent(event({ page: `/${'x'.repeat(300)}` }), { now: NOW }), /page/);
  assert.throws(() => validateTrackEvent(event({ userId: EVENT_ID }), { now: NOW }), /server controlled/);
  assert.throws(() => validateEventBatch({ events: [event()], user_id: EVENT_ID }, { now: NOW }), /server controlled/);
});

test('tracking validation limits meta shape, key count, and serialized size', () => {
  assert.throws(() => validateTrackEvent(event({ meta: [] }), { now: NOW }), /event meta/);
  assert.throws(() => validateTrackEvent(event({
    meta: Object.fromEntries(Array.from({ length: 31 }, (_, index) => [`key${index}`, index]))
  }), { now: NOW }), /meta keys/);
  assert.throws(() => validateTrackEvent(event({ meta: { note: '가'.repeat(800) } }), { now: NOW }), /too large/);
});

test('tracking validation enforces ISO timestamps and the seven-day/five-minute skew window', () => {
  assert.throws(() => validateTrackEvent(event({ occurredAt: '2026-07-10 11:59:00' }), { now: NOW }), /occurred at/);
  assert.throws(() => validateTrackEvent(event({ occurredAt: '2026-02-30T11:59:00.000Z' }), { now: NOW }), /occurred at/);
  assert.throws(() => validateTrackEvent(event({ occurredAt: '2026-07-10T12:05:00.001Z' }), { now: NOW }), /accepted window/);
  assert.throws(() => validateTrackEvent(event({ occurredAt: '2026-07-03T11:59:59.999Z' }), { now: NOW }), /accepted window/);
  assert.doesNotThrow(() => validateTrackEvent(event({ occurredAt: '2026-07-10T12:05:00.000Z' }), { now: NOW }));
  assert.doesNotThrow(() => validateTrackEvent(event({ occurredAt: '2026-07-03T12:00:00.000Z' }), { now: NOW }));
});

test('validateEventBatch rejects a serialized payload above roughly 32KB', () => {
  const events = Array.from({ length: 20 }, (_, index) => event({
    eventId: `${String(index + 1).padStart(8, '0')}-1111-4111-8111-111111111111`,
    meta: { note: 'x'.repeat(1700) }
  }));
  assert.throws(() => validateEventBatch({ events }, { now: NOW }), /payload is too large/);
});

test('insertTrackedEvents ignores duplicate ids and continues inserting the batch', async () => {
  const inserted = [];
  const supabase = {
    from(table) {
      assert.equal(table, 'events');
      return {
        async insert(row) {
          inserted.push(row);
          return row.id === EVENT_ID ? { error: { code: '23505' } } : { error: null };
        }
      };
    }
  };
  const validated = validateEventBatch({
    events: [
      event(),
      event({ eventId: '33333333-3333-4333-8333-333333333333' })
    ]
  }, { now: NOW });

  await insertTrackedEvents(supabase, validated, null);

  assert.equal(inserted.length, 2);
  assert.equal(inserted[0].id, EVENT_ID);
  assert.equal(inserted[0].user_id, null);
  assert.equal(inserted[0].page, '/home');
});
