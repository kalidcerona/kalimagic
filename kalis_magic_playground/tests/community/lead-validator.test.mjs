import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLeadPayload } from '../../netlify/functions/_lib/validators.mjs';

const VALID_LEAD = {
  contactType: 'kakao',
  contact: 'kali_magic',
  source: 'playground_hero',
  sessionId: '22222222-2222-4222-8222-222222222222',
  consent: true,
  page: 'https://example.com/playground?utm_source=test'
};

test('validateLeadPayload rejects a payload without consent', () => {
  assert.throws(
    () => validateLeadPayload({ ...VALID_LEAD, consent: false }),
    /consent/
  );
});

test('validateLeadPayload rejects invalid contact, and source formats', () => {
  assert.throws(
    () => validateLeadPayload({ ...VALID_LEAD, contactType: 'sms' }),
    /contact type/
  );
  assert.throws(
    () => validateLeadPayload({ ...VALID_LEAD, contact: 'x' }),
    /contact/
  );
  assert.throws(
    () => validateLeadPayload({ ...VALID_LEAD, source: '' }),
    /source/
  );
  assert.deepEqual(validateLeadPayload({ ...VALID_LEAD, sessionId: undefined }), validateLeadPayload(VALID_LEAD));
});

test('validateLeadPayload accepts and normalizes a valid payload', () => {
  assert.deepEqual(validateLeadPayload(VALID_LEAD), {
    contactType: 'kakao',
    contact: 'kali_magic',
    source: 'playground_hero',
    page: '/playground'
  });
});

test('lead and conversion rows share no identifiers or exact receipt time', async () => {
  const {handleLead} = await import('../../netlify/functions/lead.mjs');
  const rows = {};
  const store = {from(table) {return {insert(row) {
    rows[table] = row;
    return {select: () => ({single: async () => ({data: {id: 'local-lead'}})})};
  }};}};
  const result = await handleLead({httpMethod:'POST', body: JSON.stringify(VALID_LEAD)}, () => store);
  assert.equal(result.statusCode, 201);
  const {leads, events} = rows;
  assert.ok(leads.session_id && events.session_id);
  assert.notEqual(leads.session_id, events.session_id);
  assert.ok(![events.session_id, leads.session_id].includes(VALID_LEAD.sessionId));
  assert.equal(events.user_id, null);
  assert.equal(events.occurred_at, leads.consent_at.slice(0, 13) + ':00:00.000Z');
  assert.equal(events.page, '/');
  assert.deepEqual(events.meta, {});
});
