// Only named collection fields are additive. Fixed slots/sessions remain complete profiles.
const COLLECTIONS = new Set([
  'presets',
  'sets',
  'dummyNotes',
  'categories',
  'entries',
  'items',
  'history',
  'records',
  'recent',
]);
const canonical = (value) =>
  JSON.stringify(
    value,
    (_key, item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
        : item,
  );
function fingerprint(value) {
  const copy = { ...value };
  delete copy.id;
  return canonical(copy);
}
export function mergeCollections(existing, incoming, salt = 'zz') {
  const left = structuredClone(existing), right = structuredClone(incoming), remap = new Map();
  let sequence = 0;
  function prepare(a, b, field) {
    if (Array.isArray(a) && Array.isArray(b) && COLLECTIONS.has(field)) {
      const taken = new Set(a.map((item) => item?.id));
      for (const item of b) {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string') continue;
        const same = a.find((old) => old && fingerprint(old) === fingerprint(item));
        if (same) {
          remap.set(item.id, same.id);
          continue;
        }
        if (taken.has(item.id)) {
          let id;
          do {
            id = `zz_${salt.slice(0, 8)}_${++sequence}`;
          } while (taken.has(id));
          remap.set(item.id, id);
          taken.add(id);
        } else taken.add(item.id);
      }
    }
    if (a && b && !Array.isArray(a) && !Array.isArray(b) && typeof a === 'object' && typeof b === 'object') {
      for (const key of Object.keys(b)) prepare(a[key], b[key], key);
    }
  }
  prepare(left, right, '');
  function rewrite(value, field = '') {
    if (typeof value === 'string') return /(?:id|ids)$/i.test(field) ? (remap.get(value) ?? value) : value;
    if (Array.isArray(value)) return value.map((child) => rewrite(child, field));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewrite(child, key)]));
    }
    return value;
  }
  function merge(a, b, field) {
    if (a === undefined) return b;
    if (Array.isArray(a) && Array.isArray(b) && COLLECTIONS.has(field)) {
      const out = [...a];
      for (const item of b) {
        if (
          !out.some((old) =>
            canonical(old) === canonical(item) ||
            (old && item && typeof old === 'object' && fingerprint(old) === fingerprint(item))
          )
        ) out.push(item);
      }
      return out;
    }
    if (a && b && !Array.isArray(a) && !Array.isArray(b) && typeof a === 'object' && typeof b === 'object') {
      return Object.fromEntries(
        [...new Set([...Object.keys(a), ...Object.keys(b)])].map((key) => [key, merge(a[key], b[key], key)]),
      );
    }
    return a;
  }
  return { value: merge(left, rewrite(right), ''), remap: Object.fromEntries(remap) };
}
export function mergeValue(key, existing, incoming, salt) {
  if (existing === null || existing === incoming) return incoming;
  // Other apps' fixed arrays, card stacks and slots must never be concatenated.
  if (!/^magic-choice-dist\.v1\.store(?:\.backup)?$/.test(key) && key !== 'friend-uramichi.web.presets') {
    return existing;
  }
  try {
    const left = JSON.parse(existing), right = JSON.parse(incoming);
    if (key === 'friend-uramichi.web.presets') {
      const oldCategories = Array.isArray(left) ? left : left.categories;
      const newCategories = Array.isArray(right) ? right : right.categories;
      const merged =
        mergeCollections({ categories: oldCategories }, { categories: newCategories }, salt).value.categories;
      return JSON.stringify(Array.isArray(left) ? merged : { ...left, categories: merged });
    }
    return JSON.stringify(mergeCollections(left, right, salt).value);
  } catch {
    return existing;
  }
}
export function countValues(entries, media = []) {
  const counts = {
    settings: entries.filter(([, raw]) => raw !== null).length,
    lists: 0,
    groups: 0,
    records: 0,
    photos: media.filter((item) => item.value !== undefined).length,
    items: 0,
    slots: 0,
  };
  for (const [key, raw] of entries) {
    if (raw === null || key.endsWith('.store.backup') || key.endsWith('-preserved-raw')) continue;
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object') continue;
      if (key === 'friend-uramichi.web.presets') {
        const categories = Array.isArray(value) ? value : value.categories || [];
        counts.groups += categories.length;
        counts.items += categories.reduce((n, c) => n + (c.entries?.length || 0), 0);
        continue;
      }
      if (Array.isArray(value)) {
        if (/_named_presets_v1$|_seq_slots$/.test(key)) counts.slots += value.length;
        else if (/recent|performance-log/.test(key)) counts.records += value.length;
        continue;
      }
      counts.lists += Array.isArray(value.presets) ? value.presets.length : 0;
      counts.items += Array.isArray(value.presets)
        ? value.presets.reduce((n, p) => n + (p.items?.length || 0), 0)
        : 0;
      counts.groups += Array.isArray(value.sets) ? value.sets.length : 0;
      if (key.endsWith('photoSets.v2')) {
        counts.slots += value.sets?.reduce((n, set) => n + set.length, 0) || 0;
      }
      if (Array.isArray(value.names)) counts.items += value.names.length;
      counts.records += ['history', 'records', 'dummyNotes', 'recent'].reduce(
        (n, field) => n + (Array.isArray(value[field]) ? value[field].length : 0),
        0,
      );
      if (key === 'friend-memdeck-v1') {
        counts.groups += Object.keys(value.stacks || {}).length;
        counts.items += Object.values(value.stacks || {}).reduce((n, stack) => n + stack.length, 0);
        counts.records += Object.values(value.progress || {}).reduce(
          (n, progress) => n + (progress.history?.length || 0) + (progress.rankHistory?.length || 0),
          0,
        );
      }
    } catch { /* Exact malformed strings remain in the durable recovery record. */ }
  }
  return counts;
}
