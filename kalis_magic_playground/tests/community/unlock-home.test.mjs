import { assertPinnedSnapshot } from './public-snapshot-pins.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as logic from '../../distribution-snapshots/unlock/logic.js';

test('personal reveal selects configured attempt and formats valid birthday separately', () => {
  const attempts = [[1, 2, 3, 4, 5, 6], [0, 8, 0, 2, 2, 9], [9, 9, 9, 9, 9, 9]];
  assert.equal(typeof logic.selectedAttemptReveal, 'function');
  assert.deepEqual(logic.selectedAttemptReveal(attempts, 2, new Date(2026, 8, 24)), {
    pin: '080229', days: 6782, zodiac: '물고기자리', animal: '쥐띠',
  });
});

test('personal reveal stays empty until the configured attempt exists', () => {
  assert.equal(typeof logic.selectedAttemptReveal, 'function');
  assert.equal(logic.selectedAttemptReveal([[1, 2, 3, 4]], 2, new Date(2026, 8, 24)), null);
});

test('upward peek finds a valid birthday regardless of its attempt number', () => {
  const birthday = [0, 8, 0, 2, 2, 9];
  const other = [1, 2, 3, 4, 5, 6];
  for (const index of [0, 1, 2]) {
    const attempts = [other, other, other];
    attempts[index] = birthday;
    assert.deepEqual(logic.latestBirthdateAttempt(attempts, new Date(2026, 8, 24)), {
      attemptNumber: index + 1, pin: '080229', days: 6782, zodiac: '물고기자리', animal: '쥐띠',
    });
  }
});

test('personal and shared unlock use different persistent storage identities', () => {
  assert.equal(typeof logic.storageIdentityForPath, 'function');
  assert.notDeepEqual(logic.storageIdentityForPath('/distribution-snapshots/unlock/'), logic.storageIdentityForPath('/tools/unlock/'));
  assert.equal(logic.storageIdentityForPath('/distribution-snapshots/unlock/').personal, true);
  assert.equal(logic.storageIdentityForPath('/tools/unlock/').personal, false);
});

test('personal and shared RELEASE always enable the same rewind entry', () => {
  assert.equal(logic.normalizeSettings({ performance: 'pin' }).performance, 'time-machine');
  assert.equal(logic.normalizeSettings({ performance: 'time-machine' }).performance, 'time-machine');
});

test('iPhone PIN prompt stays concise while Galaxy keeps its native wording', () => {
  assert.equal(logic.lockScreenCopy('ios').prompt, '암호 입력');
  assert.equal(logic.lockScreenCopy('galaxy').prompt, 'PIN을 입력하세요');
});

test('reveal attempt setting is clamped to an available positive slot', () => {
  assert.equal(logic.normalizeSettings({ revealAttempt: 4 }).revealAttempt, 4);
  assert.equal(logic.normalizeSettings({ revealAttempt: 0 }).revealAttempt, 1);
  assert.equal(logic.normalizeSettings({ revealAttempt: 999 }).revealAttempt, 99);
});

test('personal home stays on the second screenshot when its reveal card opens', () => {
  assert.equal(typeof logic.homeSwipeTarget, 'function');
  assert.deepEqual(logic.homeSwipeTarget('home1', -180, 0, true), { page: 'home2', revealVisible: false, peek: false });
  assert.deepEqual(logic.homeSwipeTarget('home2', -24, 0, true, false, 390), { page: 'home2', revealVisible: true, peek: false });
  assert.deepEqual(logic.homeSwipeTarget('home2', -18, 0, true, false, 390), { page: 'home2', revealVisible: true, peek: false });
  assert.deepEqual(logic.homeSwipeTarget('home2', -17, 0, true, false, 390), { page: 'home2', revealVisible: false, peek: false });
  assert.deepEqual(logic.homeSwipeTarget('home2', 180, 0, true, true), { page: 'home2', revealVisible: false, peek: false });
  assert.deepEqual(logic.homeSwipeTarget('home2', 180, 0, true), { page: 'home1', revealVisible: false, peek: false });
  assert.deepEqual(logic.homeSwipeTarget('home1', -180, 0, false), { page: 'home1', revealVisible: false, peek: false });
  assert.deepEqual(logic.homeSwipeTarget('home1', 0, -180, true), { page: 'home1', revealVisible: false, peek: true });
  assert.deepEqual(logic.homeSwipeTarget('home2', 0, -180, true, true), { page: 'home2', revealVisible: false, peek: true });
  assert.deepEqual(logic.homeSwipeTarget('home1', -20, 0, true), { page: 'home1', revealVisible: false, peek: false });
});

test('completing the reveal swipe keeps home two as the active page', () => {
  assert.equal(typeof logic.completeHomeSwipe, 'function');
  assert.deepEqual(logic.completeHomeSwipe('home2', -24, 0, true, 390), {
    page: 'home2', revealVisible: false, peek: false,
  });
});

test('small foldable viewports retain an early reveal threshold without revealing on arrival', () => {
  assert.deepEqual(logic.homeSwipeTarget('home1', -40, 0, true, false, 320), {
    page: 'home1', revealVisible: false, peek: false,
  });
  assert.deepEqual(logic.homeSwipeTarget('home2', -24, 0, true, false, 320), {
    page: 'home2', revealVisible: true, peek: false,
  });
});

test('personal home requires both uploaded home screenshots before starting', () => {
  assert.equal(logic.personalHomeReady(new Set(['lock', 'unlock'])), false);
  assert.equal(logic.personalHomeReady(new Set(['lock', 'unlock', 'home2'])), true);
});


test('personal and friend RELEASE reveal home2 immediately and clear gestures the same way', () => {
  const modules = ['session.js', 'pin.js', 'gestures.js', 'images.js', 'rewind.js', 'settings.js', 'app.js'];
  for (const dir of ['distribution-snapshots/unlock']) {
    const html = readFileSync(new URL(`../../${dir}/index.html`, import.meta.url), 'utf8');
    const script = modules.map((file) => readFileSync(new URL(`../../${dir}/${file}`, import.meta.url), 'utf8')).join('\n');
    assert.match(html, /class="file-picker"/);
    assert.match(script, /function setFilePickerState\(key, registered\)/);
    assert.match(script, /registered \? '다시 선택' : '이미지 선택'/);
    assert.doesNotMatch(html, /id="home2-field"[^>]*\bhidden/);
    assert.doesNotMatch(html, /id="home2-preview-item"[^>]*\bhidden/);
    assert.doesNotMatch(html, /id="reveal-attempt-field"[^>]*\bhidden/);
    assert.match(script, /const imageKeys = \['lock', 'unlock', 'home2'\];/);
    assert.doesNotMatch(script, /STORAGE\.personal/);
    const paging = script.slice(script.indexOf("if (swipe.axis === 'x')"), script.indexOf("const index = homePage === 'home2'"));
    assert.match(paging, /const reveal = homeSwipeTarget\(homePage, dx, dy, true, false, \$\('app'\)\.clientWidth\)\.revealVisible;\s*if \(reveal\) setRevealVisible\(true\);\s*else cancelReveal\(\);/);
    assert.match(script, /if \(releaseTarget\.revealVisible\) setRevealVisible\(true\)/);
    assert.match(script, /keepBriefReveal = releaseTarget\.revealVisible && homePage === 'home2';[\s\S]*returnSwipe\(keepBriefReveal\);/);
    assert.match(script, /revealShownAt = performance\.now\(\);/);
    assert.match(script, /const remaining = Math\.max\(0, 500 - \(performance\.now\(\) - revealShownAt\)\);\s*revealHideTimer = setTimeout\(cancelReveal, remaining\);/);
    assert.match(script, /document\.addEventListener\('visibilitychange', \(\) => \{\s*if \(document\.visibilityState === 'hidden'\) \{ tapCandidate = null; returnSwipe\(\); \}\s*\}\);/);
    assert.match(script, /function returnSwipe\(keepBriefReveal = false\)[\s\S]*?\} else cancelReveal\(\);/);
    assert.match(script, /function cancelReveal\(\) \{\s*clearTimeout\(revealHideTimer\);\s*revealHideTimer = null;\s*setRevealVisible\(false\);\s*\}/);
  }
});

test('RELEASE runtime remains pinned with its public identity and cache family', () => {
  const dir = new URL('../../distribution-snapshots/unlock/', import.meta.url);
  for (const file of readdirSync(dir)) assertPinnedSnapshot('distribution-snapshots/unlock', file);
  assert.equal(JSON.parse(readFileSync(new URL('manifest.webmanifest', dir))).id, './');
  assert.match(readFileSync(new URL('sw.js', dir), 'utf8'), /const CACHE_PREFIX = 'friend-unlock-shell-' \+/);
});
