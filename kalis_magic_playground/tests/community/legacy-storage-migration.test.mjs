import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { migrateTrustedLegacyStorage, guidanceForReusedRoute } from '../../scripts/legacy-storage-migration.mjs';
import { TRUSTED_START_SESSION_KEY } from '../../scripts/legacy-shared-contract.mjs';

function memory(initial = {}, options = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) {
      if (options.throwOn && options.throwOn(key)) {
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      }
      data.set(key, String(value));
    },
    removeItem(key) { data.delete(key); },
    dump() { return Object.fromEntries(data); },
  };
}

function migrate(storage, session, extra) {
  return migrateTrustedLegacyStorage({ storage, session, search: '', ...extra });
}

test('sequence slot payloads and preset names reject invalid content without touching raw originals', () => {
  for (const field of ['seq_slots', 'named_presets_v1']) {
    for (const item of [
      { kind: 'seq', value: 'NOT A NUMBER' },
      { kind: 'seq', value: '100' },
      { kind: 'seq', value: '05,07\n' },
      { kind: 'text', value: 'bad\u0000value' },
      { kind: 'text', value: 'bad\u007fvalue' },
      ...(field === 'named_presets_v1' ? [{ kind: 'text', value: 'ok', name: 'bad\nname' }] : []),
    ]) {
      const raw = JSON.stringify([item]);
      const sourceKey = 'stopwatch_' + field;
      const storage = memory({ [sourceKey]: raw });
      migrate(storage, memory({ [TRUSTED_START_SESSION_KEY]: 'stopwatch-uni' }), { target: 'kairos', pathname: '/tools/kairos/' });
      assert.equal(storage.getItem('friend-kairos_' + field), null, raw);
      assert.equal(storage.getItem(sourceKey), raw);
    }
  }
});

test('empty text slots and valid sequences keep their exact stored representation', () => {
  const slots = JSON.stringify([{ kind: 'text', value: '' }, { kind: 'seq', value: '05,07' }]);
  const named = JSON.stringify([{ kind: 'text', value: '', name: '', forceAfter: 0 }, { kind: 'seq', value: '5,07', name: '생일', forceAfter: 3 }]);
  const storage = memory({ stopwatch_seq_slots: slots, stopwatch_named_presets_v1: named });
  const result = migrate(storage, memory({ [TRUSTED_START_SESSION_KEY]: 'stopwatch-uni' }), { target: 'kairos', pathname: '/tools/kairos/' });
  assert.equal(result.ok, true);
  assert.equal(storage.getItem('friend-kairos_seq_slots'), slots);
  assert.equal(storage.getItem('friend-kairos_named_presets_v1'), named);
  assert.equal(storage.getItem('stopwatch_seq_slots'), slots);
  assert.equal(storage.getItem('stopwatch_named_presets_v1'), named);
});

test('trusted uni start copies typed raw values into empty friend keys only', () => {
  const storage = memory({
    stopwatch_preset_cs: '1187',
    stopwatch_preset_at: '1700000000001',
    stopwatch_custom_text: 'KALI',
    stopwatch_text_at: '1700000000002',
    stopwatch_ui_mode: 'portrait',
    stopwatch_seq: '06,28',
    stopwatch_seq_slots: JSON.stringify([{ kind: 'text', value: 'KALI' }]),
    stopwatch_named_presets_v1: JSON.stringify([{ kind: 'seq', value: '05,07', name: '생일', forceAfter: 3 }]),
    stopwatch_trick3: '1',
    stopwatch_portrait_digit_guide_v1: '0',
    stopwatch_uni_install_nudge_done: '1',
    'stopwatch-settings-entry-tutorial-v1': '1',
    stopwatch_secret_personal: 'do-not-copy',
    stopwatch_preset_cs_extra: '9',
    'magic-calc-date-delay': '20',
    'magic-calc-hour-cycle': '12',
    'magic-calc-skin': 'iphone',
    'zz6-sentinel': 'stay',
    'friend-kairos_ui_mode': 'landscape',
  });
  const session = memory({ [TRUSTED_START_SESSION_KEY]: 'stopwatch-uni' });
  const result = migrate(storage, session, { target: 'kairos', pathname: '/tools/kairos/index.html', search: '?stopwatch_preset_cs=99999' });
  assert.equal(result.ok, true);
  const saved = storage.dump();
  assert.equal(saved['friend-kairos_preset_cs'], '1187');
  assert.equal(saved['friend-kairos_preset_at'], '1700000000001');
  assert.equal(saved['friend-kairos_custom_text'], 'KALI');
  assert.equal(saved.stopwatch_preset_cs, '1187');
  assert.equal(saved.stopwatch_preset_at, '1700000000001');
  assert.equal(saved.stopwatch_secret_personal, 'do-not-copy');
  assert.equal(saved['friend-kairos_ui_mode'], 'landscape');
  assert.equal(saved['friend-kairos-settings-entry-tutorial-v1'], '1');
  assert.equal(saved['stopwatch-settings-entry-tutorial-v1'], '1');
  assert.equal(saved['magic-calc-skin'], 'iphone');
  assert.equal(saved['magic-calc-date-delay'], '20');
  assert.equal(saved['zz6-sentinel'], 'stay');
  assert.equal(saved['friend-kairos_legacy_shared_migrated_v1'], '1');
  assert.equal(session.getItem(TRUSTED_START_SESSION_KEY), null);
  assert.equal(Object.keys(saved).some((key) => key.includes('99999')), false);
});

test('conflicting portrait and landscape values stay raw and do not overwrite', () => {
  const storage = memory({
    stopwatch_preset_cs: '1111',
    stopwatch_preset_at: '1000',
    stopwatch2_preset_cs: '2222',
    stopwatch2_preset_at: '2000',
    stopwatch2_custom_text: 'PORT',
    stopwatch_custom_text: 'LAND',
  });
  const uniSession = memory({ [TRUSTED_START_SESSION_KEY]: 'stopwatch-uni' });
  assert.equal(migrate(storage, uniSession, { target: 'kairos', pathname: '/tools/kairos/' }).ok, true);
  assert.equal(storage.getItem('friend-kairos_preset_cs'), '1111');
  assert.equal(storage.getItem('friend-kairos_preset_at'), '1000');
  assert.equal(storage.getItem('friend-kairos_custom_text'), 'LAND');
  assert.equal(storage.getItem('stopwatch2_custom_text'), 'PORT');
  assert.equal(storage.getItem('stopwatch2_preset_cs'), '2222');

  const classic = memory({
    stopwatch_preset_cs: '1111',
    stopwatch2_preset_cs: '2222',
    stopwatch2_preset_at: '2000',
  });
  const classicSession = memory({ [TRUSTED_START_SESSION_KEY]: 'stopwatch' });
  assert.equal(migrate(classic, classicSession, { target: 'kairos-classic', pathname: '/tools/kairos-classic/' }).ok, true);
  assert.equal(classic.getItem('friend-kairos-classic_preset_cs'), '1111');
  assert.equal(classic.getItem('friend-kairos-classic_preset_at'), null);
  assert.equal(classic.getItem('stopwatch2_preset_cs'), '2222');
});

test('integrated start uses a valid portrait value only when the landscape value is absent', () => {
  const storage = memory({ stopwatch2_preset_cs: '0222', stopwatch_preset_cs: 'bad' });
  const session = memory({ [TRUSTED_START_SESSION_KEY]: 'stopwatch-uni' });
  assert.equal(migrate(storage, session, { target: 'kairos', pathname: '/tools/kairos/' }).ok, true);
  assert.equal(storage.getItem('friend-kairos_preset_cs'), '0222');
  assert.equal(storage.getItem('stopwatch2_preset_cs'), '0222');
  assert.equal(storage.getItem('stopwatch_preset_cs'), 'bad');
});

test('unrelated canonical visits and mismatched targets do not import raw personal values', () => {
  const initial = {
    stopwatch_preset_cs: '1187',
    stopwatch2_preset_cs: '2222',
    'magic-calc-skin': 'iphone',
  };
  const direct = memory(initial);
  const directResult = migrate(direct, memory({}), { target: 'kairos', pathname: '/tools/kairos/', search: '?legacy=stopwatch-uni' });
  assert.equal(directResult.ok, false);
  assert.deepEqual(direct.dump(), initial);

  const wrong = memory(initial);
  const wrongSession = memory({ [TRUSTED_START_SESSION_KEY]: 'stopwatch' });
  assert.equal(migrate(wrong, wrongSession, { target: 'kairos', pathname: '/tools/kairos/' }).ok, false);
  assert.deepEqual(wrong.dump(), initial);

  for (const pathname of ['/zz3/', '/zz4/index.html', '/zz6/']) {
    const reused = memory(initial);
    const session = memory({ [TRUSTED_START_SESSION_KEY]: 'stopwatch' });
    const result = migrate(reused, session, { target: 'kairos-classic', pathname });
    assert.equal(result.reason, 'reused-route');
    assert.deepEqual(reused.dump(), initial);
    assert.equal(session.getItem(TRUSTED_START_SESSION_KEY), 'stopwatch');
  }
});

test('migration is idempotent and a quota failure does not write the marker', () => {
  const storage = memory({ stopwatch_preset_cs: '1187', stopwatch_text_at: '10' });
  const session = memory({ [TRUSTED_START_SESSION_KEY]: 'stopwatch' });
  const first = migrate(storage, session, { target: 'kairos-classic', pathname: '/tools/kairos-classic/' });
  assert.equal(first.ok, true);
  storage.setItem('friend-kairos-classic_preset_cs', '3333');
  const second = migrate(storage, memory({ [TRUSTED_START_SESSION_KEY]: 'stopwatch' }), { target: 'kairos-classic', pathname: '/tools/kairos-classic/' });
  assert.equal(second.reason, 'already');
  assert.equal(storage.getItem('friend-kairos-classic_preset_cs'), '3333');
  assert.equal(storage.getItem('stopwatch_preset_cs'), '1187');

  const partial = memory({ stopwatch_preset_cs: '1187', stopwatch_preset_at: '10' }, {
    throwOn(key) { return key === 'friend-kairos_preset_at'; },
  });
  const partialSession = memory({ [TRUSTED_START_SESSION_KEY]: 'stopwatch-uni' });
  const failed = migrate(partial, partialSession, { target: 'kairos', pathname: '/tools/kairos/' });
  assert.equal(failed.reason, 'partial');
  assert.equal(partial.getItem('friend-kairos_preset_cs'), '1187');
  assert.equal(partial.getItem('friend-kairos_legacy_shared_migrated_v1'), null);
  assert.equal(partial.getItem('stopwatch_preset_cs'), '1187');
  assert.equal(partialSession.getItem(TRUSTED_START_SESSION_KEY), 'stopwatch-uni');
  const retryStorage = memory(partial.dump());
  const retry = migrate(retryStorage, partialSession, { target: 'kairos', pathname: '/tools/kairos/' });
  assert.equal(retry.ok, true);
  assert.equal(retryStorage.getItem('friend-kairos_preset_cs'), '1187');
  assert.equal(retryStorage.getItem('friend-kairos_preset_at'), '10');
  assert.equal(retryStorage.getItem('friend-kairos_legacy_shared_migrated_v1'), '1');
});

test('calculator alias keeps existing HITSUZEN keys and writes no stopwatch copy', () => {
  const storage = memory({
    'magic-calc-date-delay': '15',
    'magic-calc-hour-cycle': '24',
    'magic-calc-skin': 'default',
    stopwatch_preset_cs: '1187',
  });
  const before = storage.dump();
  const session = memory({ [TRUSTED_START_SESSION_KEY]: 'calc' });
  const result = migrate(storage, session, { target: 'hitsuzen', pathname: '/tools/hitsuzen/' });
  assert.deepEqual(result, { ok: true, reason: 'calculator-keys-unchanged', wrote: [] });
  assert.deepEqual(storage.dump(), before);
  assert.equal(session.getItem(TRUSTED_START_SESSION_KEY), null);
});

test('reused routes get guidance only when manifest and worker evidence agree', () => {
  const manifest = JSON.parse(readFileSync(new URL('../fixtures/legacy/portrait.webmanifest', import.meta.url), 'utf8'));
  const workerScript = readFileSync(new URL('../fixtures/legacy/portrait-sw.js', import.meta.url), 'utf8');
  const guidance = guidanceForReusedRoute({
    pathname: '/zz4/',
    cachedManifest: manifest,
    workerScript,
    workerScriptUrl: 'https://fixture.invalid/zz4/sw.js',
  });
  assert.equal(guidance.autoRedirect, false);
  assert.equal(guidance.autoCopy, false);
  assert.deepEqual(guidance.choices.map((choice) => choice.href), ['/tools/kairos-classic/', '/tools/kairos/']);
  assert.equal(guidanceForReusedRoute({ pathname: '/zz3/', cachedManifest: manifest }), null);
  assert.equal(guidanceForReusedRoute({
    pathname: '/zz3/',
    cachedManifest: { name: '계산기', short_name: 'HITSUZEN' },
    workerScript,
    workerScriptUrl: 'https://fixture.invalid/zz3/sw.js',
  }), null);
  assert.equal(guidanceForReusedRoute({
    pathname: '/tools/stopwatch/',
    cachedManifest: manifest,
    workerScript,
    workerScriptUrl: 'https://fixture.invalid/zz3/sw.js',
  }), null);
});
