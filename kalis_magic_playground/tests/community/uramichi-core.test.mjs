// URAMICHI web core (zz15/core.mjs): a port of the Android preset model, checked against the Android tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as C from '../../zz15/core.mjs';

const fixturePath = new URL('./uramichi-android-presets.fixture.json', import.meta.url);
const PERSONAL = '/Users/sumpie/Desktop/URAMICHI-개인-프리셋.json';
const url = (r) => { assert.equal(r.ok, true, r.reason); return r.url; };
const bad = (r) => assert.equal(r.ok, false);
const { entry: E, category: Cat } = C;

const fixed = Cat('f', '목록', 'NONE', [E('a', 'A', ' https://a.com/x ')]);
const number = Cat('n', '번호', 'NUMBER', [E('n1', '하나', 'https://n.com/1', '1'), E('n25', '스물다섯', 'https://n.com/25', '25'), E('n111', '메뉴', 'https://n.com/m?c={number}', '111')]);
const numberTemplate = { ...number, entries: [...number.entries, E('any', '그 밖', 'https://g.com/?q={number}')] };
const card = Cat('c', '카드', 'CARD', [E('qh', '하트 퀸', 'https://c.com/qh', 'QH'), E('ac', '클로버 에이스', 'https://c.com/ac', '11')]);
const cardTemplate = { ...card, entries: [...card.entries, E('any', '카드', 'https://g.com/?q=card+{card}')] };
const text = Cat('t', '검색어', 'TEXT', [E('g', '구글', 'https://www.google.com/search?q={text}')]);
const date = Cat('d', '날짜', 'DATE', [E('o', '날짜', 'https://d.com/{yyyy}/{mmmm}/{d}?m={M}&mm={MM}&dd={dd}&n={MMMM}')]);
const seq = Cat('s', '순서', 'SEQUENCE', [E('1', '일', 'https://s.com/1'), E('2', '이', 'https://s.com/2'), E('3', '삼', 'https://s.com/3')]);
const once = C.armed('f', 'a', 'A', 'https://a.com', 'ONCE');

test('URL validation accepts http and https with a host only', () => {
  for (const u of ['https://example.com/a?b=1', '  http://example.com  ', 'HTTPS://Example.com', 'https://n.com/m?c=1#top', 'https://192.168.0.1:8080/x', 'https://ko.wikipedia.org/wiki/%EB%A7%88', 'https://a.com/\x7euser']) assert.equal(C.isValidWebUrl(u), true, u);
  for (const u of [null, undefined, '', 'ftp://example.com', 'javascript:alert(1)', 'example.com', 'https://', 'https:///path', 'https://exa mple.com', '8801234567890', 'https://g.com/?q={text}', 'https://a_b.com', 'data:text/html,x', 'https://example.123', 'https://a.com/%zz']) assert.equal(C.isValidWebUrl(u), false, String(u));
});

test('NONE entries trim and validate', () => {
  assert.equal(url(C.resolve(fixed, fixed.entries[0], null)), 'https://a.com/x');
  bad(C.resolve(fixed, null, null));
  bad(C.resolve(fixed, E('b', 'B', 'javascript:alert(1)'), null));
  bad(C.resolve(fixed, E('b', 'B', 'ftp://x.com'), null));
  bad(C.resolve(Cat('x', 'x', 'NONE', [E('e', 'e', 'https://g.com/?q={text}')]), E('e', 'e', 'https://g.com/?q={text}'), null));
});

test('NUMBER picks by code, accepts leading zeros, falls back to a {number} template', () => {
  assert.equal(url(C.resolve(number, null, '25')), 'https://n.com/25');
  assert.equal(url(C.resolve(number, null, '01')), 'https://n.com/1');
  assert.equal(url(C.resolve(number, null, '111')), 'https://n.com/m?c=111');
  assert.equal(url(C.resolve(number, number.entries[1], null)), 'https://n.com/25');
  bad(C.resolve(number, null, '7'));
  assert.equal(C.resolve(number, null, '').reason, '번호를 입력하세요');
  assert.equal(C.resolve(numberTemplate, null, 'abc').reason, '숫자만 입력하세요');
  assert.equal(url(C.resolve(numberTemplate, null, '7')), 'https://g.com/?q=7');
});

test('card codes map rank*10+suit with 1 clubs, 2 hearts, 3 spades, 4 diamonds', () => {
  const want = { 11: 'AC', 12: 'AH', 13: 'AS', 14: 'AD', 133: 'KS', 134: 'KD', 104: '10D', 101: '10C', 112: 'JH' };
  for (const [code, canonical] of Object.entries(want)) assert.equal(C.normalizeCard(code), canonical, code);
  assert.equal(C.cardDisplay(C.normalizeCard('11')), 'A♣');
  assert.equal(C.cardDisplay(C.normalizeCard('12')), 'A♥');
  assert.equal(C.cardDisplay(C.normalizeCard('13')), 'A♠');
  assert.equal(C.cardDisplay(C.normalizeCard('14')), 'A♦');
  assert.equal(C.cardDisplay(C.normalizeCard('133')), 'K♠');
  assert.equal(C.cardDisplay(C.normalizeCard('134')), 'K♦');
  assert.equal(C.normalizeCard('TH'), '10H');
  assert.equal(C.normalizeCard('1s'), 'AS');
  assert.equal(C.normalizeCard('q ♥'), 'QH');
  for (const x of ['10', '135', '05', '', null, 'ZZ', '1X']) assert.equal(C.normalizeCard(x), null, String(x));
  const all = [];
  for (let r = 1; r <= 13; r++) for (let s = 1; s <= 4; s++) all.push(C.normalizeCard(String(r * 10 + s)));
  assert.equal(new Set(all).size, 52);
});

test('CARD resolves from grid code, symbol or macro number, and a {card} template catches the rest', () => {
  assert.equal(url(C.resolve(card, null, 'QH')), 'https://c.com/qh');
  assert.equal(url(C.resolve(card, null, 'q♥')), 'https://c.com/qh');
  assert.equal(url(C.resolve(card, null, '122')), 'https://c.com/qh');
  assert.equal(url(C.resolve(card, null, 'AC')), 'https://c.com/ac');
  bad(C.resolve(card, null, 'KD'));
  bad(C.resolve(card, null, '141'));
  assert.equal(C.resolve(card, null, 'ZZ').reason, '카드를 알아볼 수 없습니다. QH, 10S 또는 121처럼 입력하세요');
  assert.equal(url(C.resolve(cardTemplate, null, '134')), 'https://g.com/?q=card+KD');
});

test('TEXT is URL-encoded like URLEncoder with %20 for spaces', () => {
  assert.equal(url(C.resolve(text, text.entries[0], ' hello & bye ')), 'https://www.google.com/search?q=hello%20%26%20bye');
  assert.equal(url(C.resolve(text, text.entries[0], '마술')), 'https://www.google.com/search?q=%EB%A7%88%EC%88%A0');
  assert.equal(C.encodeValue("a+b/c?d=e!'()~*._-"), 'a%2Bb%2Fc%3Fd%3De%21%27%28%29%7E*._-');
  assert.equal(C.resolve(text, text.entries[0], '  ').reason, '글자를 입력하세요');
  bad(C.resolve(text, null, 'x'));
});

test('DATE tokens and date parsing', () => {
  assert.equal(url(C.resolve(date, date.entries[0], '2026-10-03')), 'https://d.com/2026/october/3?m=10&mm=10&dd=03&n=October');
  assert.deepEqual(C.parseDate('2026/1/5'), { year: 2026, month: 1, day: 5 });
  assert.deepEqual(C.parseDate('20260105'), { year: 2026, month: 1, day: 5 });
  assert.deepEqual(C.parseDate('2024.2.29'), { year: 2024, month: 2, day: 29 });
  for (const x of ['2026-02-30', '2025-02-29', 'tomorrow', '', null]) assert.equal(C.parseDate(x), null, String(x));
  bad(C.resolve(date, date.entries[0], ''));
});

test('labels and editor validation messages', () => {
  assert.equal(C.labelFor(text.entries[0], 'cat'), '구글 (cat)');
  assert.equal(C.labelFor(number.entries[0], '1'), '하나');
  assert.equal(C.validateEntry('TEXT', text.entries[0]), null);
  assert.equal(C.validateEntry('TEXT', E('e', 'e', 'https://g.com')), '주소에 {text} 자리를 넣으세요');
  assert.equal(C.validateEntry('NONE', E('e', 'e', 'g.com')), 'http 또는 https 주소만 됩니다');
  assert.equal(C.validateEntry('NONE', E('e', ' ', 'https://g.com')), '이름을 입력하세요');
  assert.equal(C.validateEntry('NUMBER', E('e', 'e', 'https://g.com', 'x1')), '번호는 숫자만 됩니다');
  assert.equal(C.validateEntry('CARD', card.entries[1]), null);
  assert.notEqual(C.validateEntry('CARD', E('e', 'e', 'https://g.com', 'ZZ')), null);
  assert.equal(C.validateEntry('DATE', date.entries[0]), null);
  for (const c of C.shells()) for (const e of c.entries) assert.equal(C.validateEntry(c.inputKind, e), null, e.label);
  assert.deepEqual(new Set(C.shells().map((c) => c.inputKind)), new Set(C.INPUT_KINDS));
});

test('arm modes: ONCE disarms, ALWAYS stays, SEQUENCE advances and stops at the end', () => {
  assert.equal(C.target(once, [seq]), 'https://a.com');
  assert.equal(C.afterOpen(once, [seq]), null);
  const always = { ...once, mode: 'ALWAYS' };
  assert.deepEqual(C.afterOpen(always, [seq]), always);
  let a = C.armSequence(seq);
  const opened = [];
  while (a) { opened.push(C.target(a, [seq])); a = C.afterOpen(a, [seq]); }
  assert.deepEqual(opened, ['https://s.com/1', 'https://s.com/2', 'https://s.com/3']);
  assert.equal(C.target(C.armSequence(seq, 2), [seq]), 'https://s.com/3');
  assert.equal(C.armSequence(seq, 3), null);
  assert.equal(C.armSequence({ ...seq, entries: [] }), null);
  const holes = { ...seq, entries: ['bad', 'https://s.com/b', '', 'https://s.com/d', 'junk'].map((u, i) => E('e' + i, 'L' + i, u)) };
  a = C.armSequence(holes); opened.length = 0;
  while (a) { opened.push(C.target(a, [holes])); a = C.afterOpen(a, [holes]); }
  assert.deepEqual(opened, ['https://s.com/b', 'https://s.com/d']);
  assert.equal(C.normalizeArmed(C.armSequence(seq), []), null);
  assert.equal(C.normalizeArmed({ ...once, url: 'javascript:x' }, [seq]), null);
  assert.equal(C.describe(once, [seq]), 'A, 다음 한 번만');
  assert.equal(C.describe(C.armSequence(seq, 1), [seq]), '순서 순서대로, 2/3 차례 (이)');
  assert.equal(C.describe(null, [seq]), '준비된 프리셋 없음. 찍은 링크가 그대로 열립니다');
  assert.equal(C.shownMode(C.armSequence(seq), 'ALWAYS'), 'ALWAYS');
  assert.equal(C.shownMode(always, 'ONCE'), 'ALWAYS');
  assert.equal(C.shownMode(null, 'SEQUENCE'), 'ONCE');
});

test('scan action: armed opens the preset and applies the mode, unarmed opens only web links', () => {
  assert.deepEqual(C.scanAction('8801234567890', once, [seq]), { open: 'https://a.com', next: null, changed: true });
  const s0 = C.armSequence(seq);
  assert.deepEqual(C.scanAction('https://orig.com', s0, [seq]), { open: 'https://s.com/1', next: { ...s0, seqIndex: 1 }, changed: true });
  assert.deepEqual(C.scanAction('https://orig.com', s0, []), { open: null, next: null, changed: true });
  assert.deepEqual(C.scanAction(' https://orig.com/a ', null, [seq]), { open: 'https://orig.com/a', next: null, changed: false });
  assert.deepEqual(C.scanAction('8801234567890', null, [seq]), { open: null, next: null, changed: false });
  assert.deepEqual(C.scanAction('WIFI:S:x;;', null, [seq]), { open: null, next: null, changed: false });
});

test('recent list keeps five, dedupes, re-arms and prunes after edits', () => {
  let list = [];
  for (let i = 1; i <= 7; i++) list = C.pushRecent(list, C.recent('c', String(i), 'L' + i, 'https://x.com/' + i, 'NONE'));
  assert.deepEqual(list.map((r) => r.entryId), ['7', '6', '5', '4', '3']);
  list = C.pushRecent(list, list[3]);
  assert.deepEqual(list.map((r) => r.entryId), ['4', '7', '6', '5', '3']);
  const r = C.recent('f', 'a', 'A', 'https://a.com', 'NONE');
  assert.deepEqual(C.armFromRecent(r, [seq], 'ALWAYS'), C.armed('f', 'a', 'A', 'https://a.com', 'ALWAYS'));
  assert.equal(C.armFromRecent({ ...r, url: 'bad' }, [seq], 'ONCE'), null);
  assert.equal(C.armFromRecent(C.recentOfSequence(seq), [seq], 'ONCE').mode, 'SEQUENCE');
  const f2 = Cat('f', '목록', 'NONE', [E('a', 'A', 'https://a.com'), E('b', 'B', 'broken')]);
  const pruned = C.pruneRecents([
    C.recent('f', 'a', 'old', 'https://old.com', 'NONE'), C.recent('f', 'b', 'B', 'https://b.com', 'NONE'),
    C.recent('f', 'gone', 'G', 'https://g.com', 'NONE'), C.recent('x', 'a', 'X', 'https://x.com', 'NONE'),
    C.recent('s', '', 'old name', '', 'SEQUENCE')
  ], [f2, seq]);
  assert.deepEqual(pruned, [C.recent('f', 'a', 'A', 'https://a.com', 'NONE'), C.recent('s', '', '순서', '', 'SEQUENCE')]);
});

test('once gate ignores a repeat inside the window', () => {
  let now = 1000;
  const gate = new C.OnceGate(3000, () => now);
  assert.equal(gate.tryFire(), true);
  now = 3999; assert.equal(gate.tryFire(), false);
  now = 4000; assert.equal(gate.tryFire(), true);
  gate.reset(); assert.equal(gate.tryFire(), true);
});

test('scan chip label and the two-finger settings gesture', () => {
  assert.equal(C.chipLabel('HTTPS://Example.com/path?q=1#x'), 'example.com');
  assert.equal(C.chipLabel('8801234567890'), '8801234567890');
  assert.equal(C.chipLabel('WIFI:S:home;T:WPA;P:secret123;;'), 'WIFI:S:home;T:WPA;P:secre…');
  assert.equal(C.chipLabel('a\n  b'), 'a b');
  assert.equal(C.classifyTwoFingerSwipe(5, 100, -3, 110, 96), 'SETTINGS');
  assert.equal(C.classifyTwoFingerSwipe(5, -100, -3, 110, 96), 'NONE');
  assert.equal(C.classifyTwoFingerSwipe(150, 100, 0, 110, 96), 'NONE');
  assert.equal(C.zoomSelectedIndex(1), 1);
  assert.equal(C.zoomRatioFor(0, 0.5, 8), 0.5);
  assert.equal(C.zoomRatioFor(6, 1, 8), 8);
});

test('preset JSON is byte-compatible with the Android org.json export', () => {
  const fixture = readFileSync(fixturePath, 'utf8');
  const cats = C.decodeCategories(fixture);
  assert.equal(cats.length, 4);
  assert.equal(cats[0].entries[0].url, 'https://old.com/?a=1&b="x"');
  assert.deepEqual(cats[3].entries, []);
  assert.equal(C.encodeCategories(cats), fixture, 'encoding matches Android byte for byte');
  assert.ok(fixture.includes('https:\\/\\/www.google.com'));
  assert.deepEqual(C.decodeCategories(C.encodeCategories(C.shells())), C.shells());
  const ok = C.parseImport(C.encodeCategories(C.shells()));
  assert.equal(ok.ok, true); assert.deepEqual(ok.categories, C.shells());
});

test('preset JSON decoding is lenient like org.json and imports are strict', () => {
  const list = C.decodeCategories('[{"name":"N","inputKind":"WHAT","entries":[{"label":"L","url":"https://a.com"}]}]');
  assert.equal(list[0].inputKind, 'NONE');
  assert.ok(list[0].id.trim());
  assert.equal(list[0].entries[0].code, '');
  for (const x of ['not json', '{"other":1}', '', null, '[1]']) assert.equal(C.decodeCategories(x), null, String(x));
  assert.equal(C.parseImport('{"categories":[]}').ok, false);
  assert.equal(C.parseImport('[]').ok, false);
  assert.equal(C.parseImport('[{"name":"N","inputKind":"COLOR","entries":[]}]').message, '알 수 없는 입력 방식이 있어 가져오지 않았습니다: COLOR');
  assert.equal(C.parseImport('[{"name":"N","entries":[]}]').message, '알 수 없는 입력 방식이 있어 가져오지 않았습니다: (비어 있음)');
  assert.equal(C.parseImport('nope').message, '프리셋 파일을 읽을 수 없습니다');
  const a = C.armed('s', '', '순서', '', 'SEQUENCE', 2);
  assert.deepEqual(C.decodeArmed(C.encodeArmed(a)), a);
  assert.equal(C.encodeArmed(C.armed('c', 'e', 'L', 'https://x.com/a', 'ONCE')), '{"categoryId":"c","entryId":"e","label":"L","url":"https:\\/\\/x.com\\/a","mode":"ONCE","seqIndex":0}');
  assert.equal(C.decodeArmed(null), null);
  assert.equal(C.decodeArmed('{broken'), null);
  const r = [C.recent('c', 'e', 'L', 'https://x.com', 'CARD')];
  assert.deepEqual(C.decodeRecents(C.encodeRecents(r)), r);
  assert.deepEqual(C.decodeRecents('[oops'), []);
  const A = Cat('a', 'A', 'NONE', [E('1', 'one', 'https://1.com')]);
  const A2 = { ...A, entries: [E('1', 'changed', 'https://x.com'), E('2', 'two', 'https://2.com')] };
  const merged = C.mergeCategories([A], [A2, Cat('b', 'B', 'TEXT', [])]);
  assert.deepEqual(merged.map((c) => c.id), ['a', 'b']);
  assert.deepEqual(merged[0].entries.map((e) => e.label), ['changed', 'two']);
});

test('the personal preset file imports and every entry resolves', { skip: !existsSync(PERSONAL) && 'personal preset file not on this machine' }, () => {
  const textData = readFileSync(PERSONAL, 'utf8');
  const result = C.parseImport(textData);
  assert.equal(result.ok, true, result.message);
  const cats = result.categories;
  assert.ok(cats.length > 0);
  assert.deepEqual(C.decodeCategories(C.encodeCategories(cats)), cats, 'round trip keeps every field');
  let problems = 0;
  for (const c of cats) for (const e of c.entries) if (C.validateEntry(c.inputKind, e) !== null) problems++;
  assert.equal(problems, 0, 'every imported entry passes the editor check');
  for (const c of cats.filter((x) => x.inputKind === 'CARD')) {
    for (const e of c.entries.filter((x) => x.code.trim())) assert.equal(C.resolve(c, null, e.code).ok, true, c.id + ' ' + e.code);
  }
});
