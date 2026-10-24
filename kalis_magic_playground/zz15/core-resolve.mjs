import { replaceAll } from './core-model.mjs';
import { isValidWebUrl } from './core-url.mjs';
import { encodeValue } from './core-encode.mjs';
import { normalizeCard } from './core-card.mjs';

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
