import { INPUT_KINDS, category, entry, armed, recent, ARM_MODES } from './core-model.mjs';

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
