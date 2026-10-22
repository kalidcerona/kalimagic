// IndexedDB storage: shows, saved standby positions and imported audio files, all on this device only.
// If IndexedDB is unavailable (private mode, blocked site data), everything stays in memory for this visit.
const DB_NAME = 'kaname-cue';
const STORES = ['shows', 'positions', 'audio'];

function request(req) {
  return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}

export async function openStore() {
  const memory = Object.fromEntries(STORES.map(name => [name, new Map()]));
  let db = null;
  try {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => { for (const name of STORES) if (!open.result.objectStoreNames.contains(name)) open.result.createObjectStore(name); };
    db = await request(open);
  } catch { db = null; }
  const tx = async (name, mode, work) => {
    if (!db) return work(null, memory[name]);
    const t = db.transaction(name, mode);
    const done = new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); });
    const result = await work(t.objectStore(name), null);
    await done;
    return result;
  };
  const get = (name, key) => tx(name, 'readonly', (s, m) => s ? request(s.get(key)) : m.get(key));
  const put = (name, key, value) => tx(name, 'readwrite', (s, m) => s ? request(s.put(value, key)) : m.set(key, value));
  const del = (name, key) => tx(name, 'readwrite', (s, m) => s ? request(s.delete(key)) : m.delete(key));
  const all = name => tx(name, 'readonly', (s, m) => s ? request(s.getAll()) : [...m.values()]);
  const keys = name => tx(name, 'readonly', (s, m) => s ? request(s.getAllKeys()) : [...m.keys()]);
  return {
    persistent: Boolean(db),
    shows: async () => (await all('shows')).sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    saveShow: show => put('shows', show.id, show),
    deleteShow: async id => { await del('shows', id); await del('positions', id); },
    position: id => get('positions', id),
    savePosition: (id, value) => put('positions', id, value),
    audio: id => get('audio', id),
    saveAudio: (id, blob, name) => put('audio', id, { blob, name }),
    audioIds: async () => new Set(await keys('audio'))
  };
}
