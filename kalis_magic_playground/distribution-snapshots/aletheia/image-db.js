import { DB_NAME, DB_STORE } from './dom.js';

let dbPromise = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DB_STORE)) database.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        dbPromise = null;
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error('idb'));
    request.onblocked = () => reject(new Error('blocked'));
  });
}

function database() {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

function finishTransaction(transaction) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error || new Error('idb'));
    };
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    transaction.onabort = () => fail(transaction.error);
    transaction.onerror = () => fail(transaction.error);
  });
}

async function putImage(id, blob) {
  const db = await database();
  const transaction = db.transaction(DB_STORE, 'readwrite');
  transaction.objectStore(DB_STORE).put({ blob, savedAt: Date.now() }, id);
  await finishTransaction(transaction);
}

async function getImage(id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, 'readonly');
    const request = transaction.objectStore(DB_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('idb'));
  });
}

async function deleteImage(id) {
  const db = await database();
  const transaction = db.transaction(DB_STORE, 'readwrite');
  transaction.objectStore(DB_STORE).delete(id);
  await finishTransaction(transaction);
}

async function clearImages() {
  const db = await database();
  const transaction = db.transaction(DB_STORE, 'readwrite');
  transaction.objectStore(DB_STORE).clear();
  await finishTransaction(transaction);
}

export { database, putImage, getImage, deleteImage, clearImages };
