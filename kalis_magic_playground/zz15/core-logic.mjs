import { category, entry, armed, recent } from './core-model.mjs';
import { isValidWebUrl } from './core-url.mjs';
import { labelFor } from './core-resolve.mjs';

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
