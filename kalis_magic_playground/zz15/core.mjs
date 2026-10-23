// URAMICHI web core: a pure port of the Android app's preset model (Presets.kt, PresetJson.kt,
// UrlValidator.kt, ScanText.kt, OnceGate.kt). No DOM, no storage; node tests cover it.

export const InputKind = Object.freeze({ NONE: 'NONE', NUMBER: 'NUMBER', CARD: 'CARD', TEXT: 'TEXT', DATE: 'DATE', SEQUENCE: 'SEQUENCE' });
export const INPUT_KINDS = Object.freeze(['NONE', 'NUMBER', 'CARD', 'TEXT', 'DATE', 'SEQUENCE']);
export const ArmMode = Object.freeze({ ONCE: 'ONCE', ALWAYS: 'ALWAYS', SEQUENCE: 'SEQUENCE' });
const ARM_MODES = ['ONCE', 'ALWAYS', 'SEQUENCE'];

export const KIND_NAME = Object.freeze({ NONE: '목록', NUMBER: '번호', CARD: '카드', TEXT: '검색어', DATE: '날짜', SEQUENCE: '순서대로' });
export const KIND_HELP = Object.freeze({
  NONE: '항목을 누르면 그 주소가 준비됩니다',
  NUMBER: '번호를 누르면 그 번호의 항목이 준비됩니다. 주소에 {number}를 넣으면 누른 번호로 바뀝니다',
  CARD: '카드를 고르면 그 카드의 항목이 준비됩니다. 번호는 QH, 10S 또는 121 같은 숫자로 적습니다. 주소에 {card}를 넣으면 고른 카드로 바뀝니다',
  TEXT: '주소에 {text}를 넣으면 입력한 글자로 바뀝니다',
  DATE: '주소에 {yyyy} {M} {MM} {d} {dd} {MMMM} {mmmm}를 넣으면 고른 날짜로 바뀝니다',
  SEQUENCE: '찍을 때마다 다음 항목이 열리고, 마지막 항목 뒤에는 해제됩니다'
});

export const entry = (id, label, url, code = '') => ({ id, label, url, code });
export const category = (id, name, inputKind, entries) => ({ id, name, inputKind, entries });
export const armed = (categoryId, entryId, label, url, mode, seqIndex = 0) => ({ categoryId, entryId, label, url, mode, seqIndex });
export const recent = (categoryId, entryId, label, url, kind) => ({ categoryId, entryId, label, url, kind });

const replaceAll = (s, token, value) => s.split(token).join(value);
export function sameArmed(a, b) {
  if (!a || !b) return a === b;
  return a.categoryId === b.categoryId && a.entryId === b.entryId && a.label === b.label && a.url === b.url && a.mode === b.mode && a.seqIndex === b.seqIndex;
}

// ---------- UrlValidator (java.net.URI rules: http/https with a server host) ----------

const ALNUM = 'A-Za-z0-9';
const UNRESERVED = ALNUM + "\\-_.!\\x7e*'()"; // \x7e is the tilde
const PCHAR = UNRESERVED + ':@&=+$,';
// Path: pchar plus ;/ . Query and fragment: reserved (incl. []) plus unreserved.
const PATH_RE = new RegExp(`^(?:[${PCHAR};/]|%[0-9A-Fa-f]{2}|[^\\x00-\\x80\\s\\u0080-\\u009f])*$`);
const URIC_RE = new RegExp(`^(?:[${UNRESERVED};/?:@&=+$,\\[\\]]|%[0-9A-Fa-f]{2}|[^\\x00-\\x80\\s\\u0080-\\u009f])*$`);
const USERINFO_RE = new RegExp(`^(?:[${UNRESERVED};:&=+$,]|%[0-9A-Fa-f]{2}|[^\\x00-\\x80\\s\\u0080-\\u009f])*$`);
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function validHostname(host) {
  if (!host) return false;
  const t = host.endsWith('.') ? host.slice(0, -1) : host;
  const labels = t.split('.');
  if (labels.some((l) => !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(l))) return false;
  // A dotted hostname's rightmost label must start with a letter (java.net.URI).
  return labels.length === 1 || /^[A-Za-z]/.test(labels[labels.length - 1]);
}

function validHost(host) {
  if (/^\[[0-9A-Fa-f:.]+\]$/.test(host)) return host.includes(':');
  const v4 = IPV4_RE.exec(host);
  if (v4) return v4.slice(1).every((n) => Number(n) <= 255);
  return validHostname(host);
}

export function isValidWebUrl(input) {
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text || /\s/.test(text)) return false;
  const m = /^([A-Za-z][A-Za-z0-9+.-]*):(.*)$/s.exec(text);
  if (!m) return false;
  const scheme = m[1].toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') return false;
  let rest = m[2];
  let fragment = null;
  const hash = rest.indexOf('#');
  if (hash >= 0) { fragment = rest.slice(hash + 1); rest = rest.slice(0, hash); }
  if (fragment !== null && !URIC_RE.test(fragment)) return false;
  if (!rest.startsWith('//')) return false;
  rest = rest.slice(2);
  const end = rest.search(/[/?]/);
  const authority = end < 0 ? rest : rest.slice(0, end);
  let tail = end < 0 ? '' : rest.slice(end);
  if (!authority) return false;
  let query = null;
  const q = tail.indexOf('?');
  if (q >= 0) { query = tail.slice(q + 1); tail = tail.slice(0, q); }
  if (!PATH_RE.test(tail)) return false;
  if (query !== null && !URIC_RE.test(query)) return false;
  let hostPort = authority;
  const at = authority.lastIndexOf('@');
  if (at >= 0) {
    if (!USERINFO_RE.test(authority.slice(0, at))) return false;
    hostPort = authority.slice(at + 1);
  }
  let host = hostPort;
  const pm = /^(.*?)(?::(\d*))?$/.exec(hostPort);
  if (!hostPort.startsWith('[')) host = pm[1];
  else {
    const close = hostPort.indexOf(']');
    if (close < 0) return false;
    host = hostPort.slice(0, close + 1);
    const after = hostPort.slice(close + 1);
    if (after && !/^:\d*$/.test(after)) return false;
  }
  return validHost(host);
}

// ---------- URLEncoder.encode(s, "UTF-8") with %20 for spaces ----------

const utf8 = new TextEncoder();
export function encodeValue(s) {
  let out = '';
  for (const byte of utf8.encode(String(s))) {
    const c = String.fromCharCode(byte);
    if (/[A-Za-z0-9.\-*_]/.test(c)) out += c;
    else if (byte === 0x20) out += '%20';
    else out += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

// ---------- ScanText ----------

export function chipLabel(raw, maxChars = 26) {
  const text = String(raw ?? '').trim();
  if (isValidWebUrl(text)) {
    try {
      const host = new URL(text).hostname;
      if (host) return host.toLowerCase();
    } catch { /* fall through to raw text */ }
  }
  const oneLine = text.replace(/\s+/g, ' ');
  return oneLine.length <= maxChars ? oneLine : oneLine.slice(0, maxChars - 1) + '…';
}

/** Both fingers travel at least [threshold] downward and mostly vertically (the house settings gesture). */
export function classifyTwoFingerSwipe(dxA, dyA, dxB, dyB, threshold) {
  const vA = Math.abs(dyA) > Math.abs(dxA), vB = Math.abs(dyB) > Math.abs(dxB);
  return dyA >= threshold && dyB >= threshold && vA && vB ? 'SETTINGS' : 'NONE';
}

export const ZOOM_LABELS = Object.freeze(['.6', '1', '2', '3', '5', '10', '100']);
const ZOOM_VALUES = [0.6, 1, 2, 3, 5, 10, 100];
export function zoomRatioFor(index, min, max) {
  const wanted = index === 0 ? min : ZOOM_VALUES[index];
  return Math.min(max, Math.max(min, wanted));
}
export function zoomSelectedIndex(ratio) {
  const r = Math.log(Math.max(ratio, 0.01));
  let best = 0;
  ZOOM_VALUES.forEach((v, i) => { if (Math.abs(Math.log(v) - r) < Math.abs(Math.log(ZOOM_VALUES[best]) - r)) best = i; });
  return best;
}

// ---------- OnceGate ----------

export class OnceGate {
  constructor(windowMs = 3000, clock = () => Date.now()) { this.windowMs = windowMs; this.clock = clock; this.lastFired = null; }
  tryFire() {
    const now = this.clock();
    if (this.lastFired !== null && now - this.lastFired < this.windowMs) return false;
    this.lastFired = now;
    return true;
  }
  reset() { this.lastFired = null; }
}

// ---------- CardCode ----------

export const RANKS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
export const SUITS = Object.freeze(['S', 'H', 'D', 'C']);
/** Macro numeric code rank*10 + suit: 1 clubs, 2 hearts, 3 spades, 4 diamonds. */
export const MACRO_SUITS = Object.freeze(['C', 'H', 'S', 'D']);
const SYMBOLS = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const suitSymbol = (suit) => SYMBOLS[suit] || '';
export const cardDisplay = (code) => code.slice(0, -1) + suitSymbol(code.slice(-1));

/** Accepts QH, qh, Q♥, 10S, TS, 1S (ace) or the macro number (121). Returns the canonical code or null. */
export function normalizeCard(input) {
  if (input === null || input === undefined) return null;
  let t = String(input).trim().toUpperCase();
  for (const [letter, sym] of Object.entries(SYMBOLS)) t = replaceAll(t, sym, letter);
  t = replaceAll(t, ' ', '');
  if (!t) return null;
  if (/^[0-9]+$/.test(t)) {
    const n = Number(t);
    const rank = Math.floor(n / 10), suit = n % 10;
    if (rank < 1 || rank > 13 || suit < 1 || suit > 4) return null;
    return RANKS[rank - 1] + MACRO_SUITS[suit - 1];
  }
  const suit = t.slice(-1);
  if (!SUITS.includes(suit)) return null;
  const r = t.slice(0, -1);
  const rank = { 1: 'A', T: '10', 11: 'J', 12: 'Q', 13: 'K' }[r] || r;
  return RANKS.includes(rank) ? rank + suit : null;
}

// ---------- PresetResolver ----------

const BAD_URL = '주소가 올바르지 않습니다. http 또는 https 주소만 됩니다';
const invalid = (reason) => ({ ok: false, reason });
function checked(url, e) {
  const u = url.trim();
  return isValidWebUrl(u) ? { ok: true, url: u, entry: e } : invalid(BAD_URL);
}
const isDigits = (s) => /^\p{Nd}+$/u.test(s);
const isBlank = (s) => !s || !String(s).trim();

function toLong(s) {
  if (!/^[+-]?[0-9]+$/.test(s)) return null;
  const v = BigInt(s);
  return v > 9223372036854775807n || v < -9223372036854775808n ? null : v;
}
function sameNumber(a, b) {
  const x = a.trim();
  if (x === b) return true;
  const xi = toLong(x);
  return xi !== null && xi === toLong(b);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const daysIn = (y, m) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

/** Accepts 2026-10-23, 2026/10/23, 2026.10.23, 2026 10 23 or 20261023. Returns {year, month, day} or null. */
export function parseDate(input) {
  const s = String(input ?? '');
  const m = /^[ \t\n\x0B\f\r]*(\d{4})\D+(\d{1,2})\D+(\d{1,2})[ \t\n\x0B\f\r]*$/.exec(s) || /^[ \t\n\x0B\f\r]*(\d{4})(\d{2})(\d{2})[ \t\n\x0B\f\r]*$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return null;
  return { year, month, day };
}
const pad2 = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${String(d.year).padStart(4, '0')}-${pad2(d.month)}-${pad2(d.day)}`;

export function fillDate(template, d) {
  const month = MONTHS[d.month - 1];
  let t = template;
  t = replaceAll(t, '{yyyy}', String(d.year));
  t = replaceAll(t, '{MMMM}', month);
  t = replaceAll(t, '{mmmm}', month.toLowerCase());
  t = replaceAll(t, '{MM}', pad2(d.month));
  t = replaceAll(t, '{M}', String(d.month));
  t = replaceAll(t, '{dd}', pad2(d.day));
  t = replaceAll(t, '{d}', String(d.day));
  return t;
}

/**
 * NONE, SEQUENCE, TEXT and DATE need [e]. NUMBER and CARD pick the entry by its code from [input]
 * (or use [e] when a row was tapped); an entry with an empty code and a {number} or {card} token
 * catches every value that has no own entry. Returns {ok:true,url,entry} or {ok:false,reason}.
 */
export function resolve(cat, e, input) {
  switch (cat.inputKind) {
    case 'NONE':
    case 'SEQUENCE':
      return e ? checked(e.url, e) : invalid('항목을 고르세요');
    case 'TEXT': {
      const text = (input ?? '').trim();
      if (!e) return invalid('항목을 고르세요');
      if (!text) return invalid('글자를 입력하세요');
      return checked(replaceAll(e.url, '{text}', encodeValue(text)), e);
    }
    case 'DATE': {
      const date = parseDate(input);
      if (!e) return invalid('항목을 고르세요');
      if (!date) return invalid('날짜를 2026-10-23처럼 입력하세요');
      return checked(fillDate(e.url, date), e);
    }
    case 'NUMBER': {
      const n = (input ?? '').trim();
      const tapped = e && !isBlank(e.code) ? e : null;
      const match = tapped || cat.entries.find((x) => !isBlank(x.code) && sameNumber(x.code, n));
      const template = cat.entries.find((x) => isBlank(x.code) && x.url.includes('{number}'));
      if (match) return checked(replaceAll(match.url, '{number}', encodeValue(match.code.trim())), match);
      if (!n) return invalid('번호를 입력하세요');
      if (!isDigits(n)) return invalid('숫자만 입력하세요');
      if (template) return checked(replaceAll(template.url, '{number}', encodeValue(n)), template);
      return invalid('그 번호의 항목이 없습니다');
    }
    case 'CARD': {
      const tapped = e && !isBlank(e.code) ? e : null;
      const card = tapped ? normalizeCard(tapped.code) : normalizeCard(input);
      const match = tapped || (card ? cat.entries.find((x) => normalizeCard(x.code) === card) : undefined);
      const template = cat.entries.find((x) => isBlank(x.code) && x.url.includes('{card}'));
      if (card === null) return invalid('카드를 알아볼 수 없습니다. QH, 10S 또는 121처럼 입력하세요');
      if (match) return checked(replaceAll(match.url, '{card}', encodeValue(card)), match);
      if (template) return checked(replaceAll(template.url, '{card}', encodeValue(card)), template);
      return invalid('그 카드의 항목이 없습니다');
    }
    default:
      return invalid('항목을 고르세요');
  }
}

/** Label shown for an armed preset: the entry name, plus the typed value for template entries. */
export function labelFor(e, input) {
  const v = (input ?? '').trim();
  return !v || !isBlank(e.code) ? e.label : `${e.label} (${v})`;
}

// ---------- PresetValidator ----------

const DATE_TOKENS = ['{yyyy}', '{MMMM}', '{mmmm}', '{MM}', '{M}', '{dd}', '{d}'];
/** Editor check in plain Korean. Null means the entry is fine. */
export function validateEntry(kind, e) {
  const url = e.url.trim();
  if (isBlank(e.label)) return '이름을 입력하세요';
  if (!url) return '주소를 입력하세요';
  let sample;
  switch (kind) {
    case 'TEXT':
      if (!url.includes('{text}')) return '주소에 {text} 자리를 넣으세요';
      sample = replaceAll(url, '{text}', 'a'); break;
    case 'DATE':
      if (!DATE_TOKENS.some((t) => url.includes(t))) return '주소에 {yyyy} {M} {d} 같은 날짜 자리를 넣으세요';
      sample = fillDate(url, { year: 2026, month: 1, day: 1 }); break;
    case 'NUMBER':
      if (isBlank(e.code) && !url.includes('{number}')) return '번호를 적거나 주소에 {number} 자리를 넣으세요';
      if (!isBlank(e.code) && !isDigits(e.code.trim())) return '번호는 숫자만 됩니다';
      sample = replaceAll(url, '{number}', '1'); break;
    case 'CARD':
      if (isBlank(e.code) && !url.includes('{card}')) return '카드를 적거나 주소에 {card} 자리를 넣으세요';
      if (!isBlank(e.code) && normalizeCard(e.code) === null) return '카드를 알아볼 수 없습니다. QH, 10S 또는 121처럼 적으세요';
      sample = replaceAll(url, '{card}', 'QH'); break;
    default:
      sample = url;
  }
  return isValidWebUrl(sample) ? null : 'http 또는 https 주소만 됩니다';
}

// ---------- PresetLogic ----------

export const RECENT_MAX = 5;
const findCat = (cats, id) => cats.find((c) => c.id === id);

/** The armed state as actually used: sequences skip unusable entries; anything unusable becomes null. */
export function normalizeArmed(a, cats) {
  if (!a) return null;
  if (a.mode !== 'SEQUENCE') return isValidWebUrl(a.url) ? a : null;
  const entries = findCat(cats, a.categoryId)?.entries;
  if (!entries) return null;
  for (let i = Math.max(a.seqIndex, 0); i < entries.length; i++) {
    if (isValidWebUrl(entries[i].url)) return i === a.seqIndex ? a : { ...a, seqIndex: i };
  }
  return null;
}

/** The URL the next scan should open, or null when nothing usable is armed. */
export function target(a, cats) {
  const n = normalizeArmed(a, cats);
  if (!n) return null;
  if (n.mode !== 'SEQUENCE') return n.url.trim();
  return findCat(cats, n.categoryId).entries[n.seqIndex].url.trim();
}

/** After one successful open: ONCE disarms, ALWAYS stays, SEQUENCE moves on or disarms at the end. */
export function afterOpen(a, cats) {
  const n = normalizeArmed(a, cats);
  if (!n) return null;
  if (n.mode === 'ONCE') return null;
  if (n.mode === 'ALWAYS') return n;
  return normalizeArmed({ ...n, seqIndex: n.seqIndex + 1 }, cats);
}

/** The mode chip shown as selected: the armed preset's own mode wins over the saved preference. */
export function shownMode(a, pref) {
  if (a && a.mode !== 'SEQUENCE') return a.mode;
  return pref && pref !== 'SEQUENCE' ? pref : 'ONCE';
}

export function armSequence(cat, start = 0) {
  if (start < 0 || start >= cat.entries.length) return null;
  return armed(cat.id, '', cat.name, '', 'SEQUENCE', start);
}

export function armResolved(cat, r, input, mode) {
  const label = labelFor(r.entry, input);
  const m = mode === 'SEQUENCE' ? 'ONCE' : mode;
  return [armed(cat.id, r.entry.id, label, r.url, m), recent(cat.id, r.entry.id, label, r.url, cat.inputKind)];
}

export const recentOfSequence = (cat) => recent(cat.id, '', cat.name, '', 'SEQUENCE');

/** Re-arms a recent preset. Sequences restart at the first entry. */
export function armFromRecent(r, cats, mode) {
  if (r.kind === 'SEQUENCE') {
    const cat = findCat(cats, r.categoryId);
    return cat ? armSequence(cat) : null;
  }
  if (!isValidWebUrl(r.url)) return null;
  return armed(r.categoryId, r.entryId, r.label, r.url.trim(), mode === 'SEQUENCE' ? 'ONCE' : mode);
}

export function pushRecent(list, item) {
  return [item, ...list.filter((x) => !(x.categoryId === item.categoryId && x.entryId === item.entryId && x.url === item.url))].slice(0, RECENT_MAX);
}

/** After an edit or import: drop recents that are gone; fixed recents take the entry's current label and URL. */
export function pruneRecents(recents, cats) {
  const out = [];
  for (const r of recents) {
    const cat = findCat(cats, r.categoryId);
    if (!cat) continue;
    if (r.kind === 'SEQUENCE') {
      if (cat.inputKind === 'SEQUENCE') out.push({ ...r, label: cat.name });
      continue;
    }
    const e = cat.entries.find((x) => x.id === r.entryId);
    if (!e) continue;
    if (r.kind !== 'NONE') { if (cat.inputKind === r.kind) out.push(r); continue; }
    if (cat.inputKind !== 'NONE' || !isValidWebUrl(e.url)) continue;
    out.push({ ...r, label: e.label, url: e.url.trim() });
  }
  return out;
}

/** One line for the top of the preset section. */
export function describe(a, cats) {
  if (!a) return '준비된 프리셋 없음. 찍은 링크가 그대로 열립니다';
  const n = normalizeArmed(a, cats);
  if (!n) return `${a.label}: 열 수 있는 주소가 없어 다음 스캔 때 해제됩니다`;
  if (n.mode === 'ONCE') return `${a.label}, 다음 한 번만`;
  if (n.mode === 'ALWAYS') return `${a.label}, 계속 유지`;
  const entries = findCat(cats, n.categoryId).entries;
  return `${n.label} 순서대로, ${n.seqIndex + 1}/${entries.length} 차례 (${entries[n.seqIndex].label})`;
}

/**
 * What a tap on the scan chip does (web version of MainActivity.onChipTap).
 * Returns {open: url|null, next: armedState|null, changed: boolean}.
 * Armed but unusable: disarm and stay silent. Armed: open the target and apply the arm mode.
 * Nothing armed: open the scanned value only when it is an http/https link; otherwise stay silent.
 */
export function scanAction(raw, a, cats) {
  if (a) {
    const t = target(a, cats);
    if (t === null) return { open: null, next: null, changed: true };
    return { open: t, next: afterOpen(a, cats), changed: true };
  }
  const text = String(raw ?? '').trim();
  return { open: isValidWebUrl(text) ? text : null, next: null, changed: false };
}

/** Neutral example shells, one per input kind (same as PresetSeed.shells on Android). */
export function shells() {
  return [
    category('fixed', '목록', 'NONE', [entry('fixed-1', '예시 1', 'https://www.google.com'), entry('fixed-2', '예시 2', 'https://www.wikipedia.org')]),
    category('number', '번호', 'NUMBER', [
      entry('number-1', '예시 1번', 'https://example.com/?n=1', '1'),
      entry('number-2', '예시 2번', 'https://example.com/?n=2', '2'),
      entry('number-any', '그 밖의 번호', 'https://www.google.com/search?q={number}')
    ]),
    category('card', '카드', 'CARD', [entry('card-any', '카드 검색', 'https://www.google.com/search?q=playing+card+{card}')]),
    category('text', '검색어', 'TEXT', [entry('text-google', '구글 검색', 'https://www.google.com/search?q={text}')]),
    category('date', '날짜', 'DATE', [entry('date-wiki', '위키백과 날짜', 'https://en.wikipedia.org/wiki/{MMMM}_{d}')]),
    category('sequence', '순서대로', 'SEQUENCE', [
      entry('sequence-1', '첫 번째', 'https://example.com/?step=1'),
      entry('sequence-2', '두 번째', 'https://example.com/?step=2'),
      entry('sequence-3', '세 번째', 'https://example.com/?step=3')
    ])
  ];
}

// ---------- PresetJson (byte-compatible with Android org.json toString(2)) ----------

export const JSON_VERSION = 1;

export function newId() {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** org.json JSONStringer string quoting: escapes " \ / and control characters. */
function quote(value) {
  let out = '"';
  for (const c of String(value)) {
    const code = c.charCodeAt(0);
    if (c === '"' || c === '\\' || c === '/') out += '\\' + c;
    else if (c === '\t') out += '\\t';
    else if (c === '\b') out += '\\b';
    else if (c === '\n') out += '\\n';
    else if (c === '\r') out += '\\r';
    else if (c === '\f') out += '\\f';
    else if (code <= 0x1f) out += '\\u' + code.toString(16).padStart(4, '0');
    else out += c;
  }
  return out + '"';
}

function pretty(value, depth) {
  const pad = '  '.repeat(depth + 1), close = '  '.repeat(depth);
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return '[\n' + value.map((v) => pad + pretty(v, depth + 1)).join(',\n') + '\n' + close + ']';
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length) return '{}';
    return '{\n' + keys.map((k) => pad + quote(k) + ': ' + pretty(value[k], depth + 1)).join(',\n') + '\n' + close + '}';
  }
  if (typeof value === 'number') return String(value);
  return quote(value);
}

function compact(value) {
  if (Array.isArray(value)) return '[' + value.map(compact).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).map((k) => quote(k) + ':' + compact(value[k])).join(',') + '}';
  if (typeof value === 'number') return String(value);
  return quote(value);
}

export function encodeCategories(cats) {
  return pretty({
    app: 'URAMICHI',
    version: JSON_VERSION,
    categories: cats.map((c) => ({
      id: c.id, name: c.name, inputKind: c.inputKind,
      entries: c.entries.map((e) => ({ id: e.id, label: e.label, url: e.url, code: e.code }))
    }))
  }, 0);
}

/** org.json optString: missing or undefined gives "", other values are stringified. */
function optString(o, key) {
  if (!o || typeof o !== 'object' || !(key in o)) return '';
  const v = o[key];
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const kindOf = (s) => (INPUT_KINDS.includes(s) ? s : 'NONE');
const modeOf = (s) => (ARM_MODES.includes(s) ? s : 'ONCE');

function rawCategories(text) {
  const t = (text ?? '').trim();
  if (!t) return null;
  try {
    if (t.startsWith('[')) { const a = JSON.parse(t); return Array.isArray(a) ? a : null; }
    const o = JSON.parse(t);
    return isObject(o) && Array.isArray(o.categories) ? o.categories : null;
  } catch {
    return null;
  }
}

/** Accepts the export object or a bare array of categories. Null when the text is not a preset file. */
export function decodeCategories(text) {
  const arr = rawCategories(text);
  if (!arr) return null;
  if (!arr.every(isObject)) return null;
  const out = [];
  for (const c of arr) {
    const entries = Array.isArray(c.entries) ? c.entries : [];
    if (!entries.every(isObject)) return null;
    out.push(category(
      optString(c, 'id').trim() ? optString(c, 'id') : newId(),
      optString(c, 'name'),
      kindOf(optString(c, 'inputKind')),
      entries.map((e) => entry(optString(e, 'id').trim() ? optString(e, 'id') : newId(), optString(e, 'label'), optString(e, 'url'), optString(e, 'code')))
    ));
  }
  return out;
}

export function encodeArmed(a) {
  return compact({ categoryId: a.categoryId, entryId: a.entryId, label: a.label, url: a.url, mode: a.mode, seqIndex: a.seqIndex });
}

export function decodeArmed(text) {
  if (!text || !String(text).trim()) return null;
  try {
    const o = JSON.parse(text);
    if (!isObject(o)) return null;
    const seq = Number.isInteger(o.seqIndex) ? o.seqIndex : 0;
    return armed(optString(o, 'categoryId'), optString(o, 'entryId'), optString(o, 'label'), optString(o, 'url'), modeOf(optString(o, 'mode')), seq);
  } catch {
    return null;
  }
}

export function encodeRecents(list) {
  return compact(list.map((r) => ({ categoryId: r.categoryId, entryId: r.entryId, label: r.label, url: r.url, kind: r.kind })));
}

export function decodeRecents(text) {
  if (!text || !String(text).trim()) return [];
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr) || !arr.every(isObject)) return [];
    return arr.map((o) => recent(optString(o, 'categoryId'), optString(o, 'entryId'), optString(o, 'label'), optString(o, 'url'), kindOf(optString(o, 'kind'))));
  } catch {
    return [];
  }
}

/** Strict reading of a user-picked file: unknown input kinds and empty files are refused. */
export function parseImport(text) {
  const list = decodeCategories(text);
  if (!list) return { ok: false, message: '프리셋 파일을 읽을 수 없습니다' };
  const raw = rawCategories(text);
  for (const c of raw) {
    const kind = optString(c, 'inputKind');
    if (!INPUT_KINDS.includes(kind)) return { ok: false, message: `알 수 없는 입력 방식이 있어 가져오지 않았습니다: ${kind.trim() ? kind : '(비어 있음)'}` };
  }
  if (!list.length) return { ok: false, message: '가져온 파일에 묶음이 없어 아무것도 바꾸지 않았습니다' };
  return { ok: true, categories: list };
}

/** Merge import: same-id entries are replaced in place, new entries and new categories are appended. */
export function mergeCategories(existing, imported) {
  const result = existing.slice();
  for (const inc of imported) {
    const i = result.findIndex((c) => c.id === inc.id);
    if (i < 0) { result.push(inc); continue; }
    const incoming = new Map(inc.entries.map((e) => [e.id, e]));
    const have = new Set(result[i].entries.map((e) => e.id));
    const updated = result[i].entries.map((e) => incoming.get(e.id) || e);
    result[i] = { ...result[i], entries: [...updated, ...inc.entries.filter((e) => !have.has(e.id))] };
  }
  return result;
}
