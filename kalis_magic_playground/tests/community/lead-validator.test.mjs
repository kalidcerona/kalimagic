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

test('validateLeadPayload rejects invalid contact, source, and session formats', () => {
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
  assert.throws(
    () => validateLeadPayload({ ...VALID_LEAD, sessionId: 'not-a-uuid' }),
    /session id/
  );
});

test('validateLeadPayload accepts and normalizes a valid payload', () => {
  assert.deepEqual(validateLeadPayload(VALID_LEAD), {
    contactType: 'kakao',
    contact: 'kali_magic',
    source: 'playground_hero',
    sessionId: '22222222-2222-4222-8222-222222222222',
    page: '/playground'
  });
});
