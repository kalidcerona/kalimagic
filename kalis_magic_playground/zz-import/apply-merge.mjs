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
    if (key === 'friend-uramichi.web.presets') {
      return mergeUramichiPresets(existing, incoming, salt, new Map());
    }
    const left = JSON.parse(existing), right = JSON.parse(incoming);
    return JSON.stringify(mergeCollections(left, right, salt).value);
  } catch {
    return existing;
  }
}
function categoryFingerprint(category) {
  const { id, ...content } = category;
  if (Array.isArray(content.entries)) {
    content.entries = content.entries.map(({ id, ...entry }) => entry);
  }
  return canonical(content);
}
function mergeUramichiPresets(existing, incoming, salt, remap) {
  if (existing === null || incoming === null || existing === incoming) return existing ?? incoming;
  const left = JSON.parse(existing), right = JSON.parse(incoming);
  const oldCategories = Array.isArray(left) ? left : left.categories;
  const newCategories = Array.isArray(right) ? right : right.categories;
  const categories = [...oldCategories];
  const byId = new Map(categories.map((category) => [category.id, category]));
  const byContent = new Map();
  for (const category of categories) {
    const signature = categoryFingerprint(category);
    if (!byContent.has(signature)) byContent.set(signature, category);
  }
  const reserved = new Set([...byId.keys(), ...newCategories.map((category) => category.id)]);
  let sequence = 0;
  for (const category of newCategories) {
    const signature = categoryFingerprint(category), sameId = byId.get(category.id);
    let result = sameId && categoryFingerprint(sameId) === signature ? sameId : byContent.get(signature);
    if (!result) {
      let id = category.id;
      if (sameId) {
        do {
          id = `zz_${salt.slice(0, 8)}_${++sequence}`;
        } while (reserved.has(id));
        reserved.add(id);
      }
      result = { ...category, id };
      categories.push(result);
      byContent.set(signature, result);
    }
    // Entry IDs are local to the category. Equivalent categories keep their entry order.
    remap.set(category.id, {
      categoryId: result.id,
      entryIds: new Map((category.entries ?? []).map((entry, index) => [entry.id, result.entries[index].id])),
    });
  }
  if (categories.length === oldCategories.length) return existing;
  return JSON.stringify(Array.isArray(left) ? categories : { ...left, categories });
}
function remapUramichiReference(reference, remap) {
  const match = remap.get(reference.categoryId);
  if (!match) return reference;
  const entryId = match.entryIds.get(reference.entryId) ?? reference.entryId;
  if (match.categoryId === reference.categoryId && entryId === reference.entryId) return reference;
  return { ...reference, categoryId: match.categoryId, entryId };
}
const uramichiRecentKey = ({ categoryId, entryId, url }) => JSON.stringify([categoryId, entryId, url]);

export function mergeUramichiEntries(existingEntries, incomingEntries, salt) {
  const existing = new Map(existingEntries), incoming = new Map(incomingEntries);
  const prefix = 'friend-uramichi.web.', presetsKey = prefix + 'presets';
  let presets = existing.get(presetsKey);
  const remap = new Map();
  try {
    presets = mergeUramichiPresets(presets, incoming.get(presetsKey), salt, remap);
  } catch {
    remap.clear();
    // Keep the existing data for the merged profile's normal validation.
  }
  return incomingEntries.map(([key, raw]) => {
    const current = existing.get(key);
    if (key === presetsKey) return [key, presets];
    if (raw === null) return [key, current];
    if (key === prefix + 'armed' && current === null && remap.size) {
      const armed = JSON.parse(raw), mapped = remapUramichiReference(armed, remap);
      return [key, mapped === armed ? raw : JSON.stringify(mapped)];
    }
    if (key === prefix + 'recent' && (current !== null || remap.size)) {
      try {
        const publicRecents = current === null ? [] : JSON.parse(current);
        const recents = JSON.parse(raw);
        const seen = new Set(publicRecents.map(uramichiRecentKey)), combined = [...publicRecents];
        for (const item of recents) {
          const mapped = remapUramichiReference(item, remap), id = uramichiRecentKey(mapped);
          if (seen.has(id)) continue;
          seen.add(id);
          combined.push(mapped);
        }
        if (current !== null && combined.length === publicRecents.length) return [key, current];
        if (
          current === null && combined.length === recents.length &&
          combined.every((item, index) => item === recents[index])
        ) return [key, raw];
        return [key, JSON.stringify(combined)];
      } catch {
        return [key, current ?? raw];
      }
    }
    return [key, current ?? raw];
  });
}
