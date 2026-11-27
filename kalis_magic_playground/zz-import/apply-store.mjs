// Durable write-ahead journal; the source snapshot database is never modified.
const DB = 'zz-import-state-v1';
function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function openState(create = true) {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => {
    if (create) req.result.createObjectStore('state');
    else req.transaction.abort();
  };
  try {
    return await request(req);
  } catch (error) {
    if (!create && error?.name === 'AbortError') return null;
    throw error;
  }
}
export async function stateGet(key) {
  const db = await openState(false);
  if (!db) return undefined;
  try {
    return await request(db.transaction('state').objectStore('state').get(key));
  } finally {
    db.close();
  }
}
export async function statePut(key, value) {
  if (key.startsWith('receipt:')) await mirrorReceipt(value);
  const db = await openState();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error('journal aborted'));
      tx.onerror = () => {};
      tx.objectStore('state').put(value, key);
    });
  } finally {
    db.close();
  }
}
async function mediaDatabase(name, store, create) {
  const req = indexedDB.open(name);
  req.onupgradeneeded = () => {
    if (create) req.result.createObjectStore(store);
    else req.transaction.abort();
  };
  try {
    return await request(req);
  } catch (error) {
    if (!create && error?.name === 'AbortError') return null;
    throw error;
  }
}
export async function readMedia(item) {
  const db = await mediaDatabase(item.targetDb, item.targetStore, false);
  if (!db) return undefined;
  try {
    return await request(db.transaction(item.targetStore).objectStore(item.targetStore).get(item.ref.key));
  } finally {
    db.close();
  }
}
export async function writeMedia(item) {
  const db = await mediaDatabase(item.targetDb, item.targetStore, true);
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(item.targetStore, 'readwrite');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error('media aborted'));
      tx.onerror = () => {};
      const store = tx.objectStore(item.targetStore);
      if (item.value === undefined) store.delete(item.ref.key);
      else if (store.keyPath) store.put(item.value);
      else store.put(item.value, item.ref.key);
    });
  } finally {
    db.close();
  }
}
export const browserStore = {
  stateGet,
  statePut,
  readMedia,
  writeMedia,
  get: (key) => localStorage.getItem(key),
  set: (key, value) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value),
};
export async function readAllMedia(config) {
  const db = await mediaDatabase(config.targetDb, config.targetStore, false);
  if (!db) return [];
  try {
    return await new Promise((resolve, reject) => {
      const rows = [], req = db.transaction(config.targetStore).objectStore(config.targetStore).openCursor();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(rows);
        rows.push({
          targetDb: config.targetDb,
          targetStore: config.targetStore,
          ref: { key: cursor.key },
          value: cursor.value,
        });
        cursor.continue();
      };
    });
  } finally {
    db.close();
  }
}
browserStore.readAllMedia = readAllMedia;

async function mirrorReceipt(receipt) {
  const req = indexedDB.open('zz-migration-v1', 1);
  req.onupgradeneeded = () => {
    for (const name of ['snapshots', 'media', 'heads', 'receipts']) req.result.createObjectStore(name);
  };
  const db = await request(req);
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('receipts', 'readwrite');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error('receipt aborted'));
      tx.onerror = () => {};
      tx.objectStore('receipts').put(receipt, [receipt.target, receipt.contentHash]);
    });
  } finally {
    db.close();
  }
}
