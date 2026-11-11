import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';

const apps = [
  ['aletheia', '../../zz5/'], ['unlock', '../../zz2/'], ['choice', '../../zz4/'],
  ['tobira', '../../zz6/'], ['false-memory', '../../../../magic-false-memory/'],
];
const text = '저장 공간이 부족해 사진을 저장하지 못했어요';
const read = (base, file) => readFileSync(new URL(file, base), 'utf8');
function storage(map = new Map(), rejectKey) {
  return { map, getItem: key => map.get(key) ?? null, removeItem: key => map.delete(key),
    setItem(key, value) { if (rejectKey?.(key)) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); map.set(key, value); } };
}
function fixture(base, local = storage(), session = storage()) {
  const line = { hidden: true, textContent: '' };
  const performance = Object.freeze({ innerHTML: '<canvas></canvas>', hidden: false });
  const document = { getElementById(id) { assert.equal(id, 'photo-save-notice'); return line; } };
  const context = vm.createContext({ document, localStorage: local, sessionStorage: session,
    Date: class extends Date { static now() { return 1794000000123; } }, performance, console });
  vm.runInContext(read(base, 'photo-save-notice.js').replace(/^export \{.*\};$/m, ''), context);
  return { context, line, local, session, performance, run: code => vm.runInContext(code, context) };
}
function functions(base, file, names) {
  const source = read(base, file);
  return parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.flatMap(node => {
    const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
    return declaration?.type === 'FunctionDeclaration' && names.includes(declaration.id.name)
      ? [source.slice(declaration.start, declaration.end)] : [];
  }).join('\n');
}
// A request may succeed before the enclosing IndexedDB transaction aborts.
function database(outcome) {
  return { transaction() {
    const tx = { error: new Error('transaction failed'), objectStore() { return { put() {
      const request = { result: 'saved', error: tx.error };
      queueMicrotask(() => {
        request.onsuccess?.();
        if (outcome === 'complete') tx.oncomplete?.();
        else if (outcome === 'abort') tx.onabort?.();
        else tx.onerror?.();
      });
      return request;
    } }; } };
    return tx;
  } };
}
for (const [app, relative] of apps) {
  const base = new URL(relative, import.meta.url);
  const available = existsSync(new URL('photo-save-notice.js', base));
  test(`${app}: quota rejection persists a timestamp, renders settings only, and success clears it`, { skip: !available }, async () => {
    const f = fixture(base);
    const before = JSON.stringify(f.performance);
    const quota = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    f.context.failure = quota;
    await assert.rejects(f.run('trackPhotoSave(() => Promise.reject(failure))'), error => error === quota);
    const key = f.run('PHOTO_SAVE_NOTICE_KEY');
    assert.equal(f.local.getItem(key), '1794000000123');
    assert.equal(f.line.hidden, false);
    assert.equal(f.line.textContent, text);
    const reloaded = fixture(base, f.local, f.session);
    assert.equal(reloaded.line.textContent, text);
    assert.equal(await f.run('trackPhotoSave(() => Promise.resolve(42))'), 42);
    assert.equal(f.local.getItem(key), null);
    assert.equal(f.session.getItem(key), null);
    assert.equal(f.line.hidden, true);
    assert.equal(f.line.textContent, '');
    assert.equal(JSON.stringify(f.performance), before);
  });
  test(`${app}: fully exhausted localStorage falls back to session storage without masking errors`, { skip: !available }, async () => {
    const f = fixture(base, storage(new Map(), () => true));
    await assert.rejects(f.run('trackPhotoSave(() => { throw new Error("write"); })'), /write/);
    const key = f.run('PHOTO_SAVE_NOTICE_KEY');
    assert.equal(f.session.getItem(key), '1794000000123');
    assert.equal(fixture(base, f.local, f.session).line.textContent, text);
    await f.run('trackPhotoSave(() => 1)');
    assert.equal(f.line.hidden, true);
    const blocked = fixture(base, storage(new Map(), () => true), storage(new Map(), () => true));
    await assert.rejects(blocked.run('trackPhotoSave(() => Promise.reject(new Error("blocked")))'), /blocked/);
    assert.equal(blocked.line.textContent, text);
    assert.equal(await blocked.run('trackPhotoSave(() => 2)'), 2);
    assert.equal(blocked.line.hidden, true);
  });
  test(`${app}: actual image save path reports transaction failure and subsequent success`, { skip: !available }, async () => {
    const f = fixture(base);
    if (app === 'choice') {
      Object.assign(f.context, { USER_ICON_KEY: 'icons', normalizeUserIcons: value => value, MSG: { storageWrite: 'failed' } });
      vm.runInContext(functions(base, 'logic-user-icons.js', ['saveUserIcons']), f.context);
      let fail = true;
      f.context.iconStorage = storage(new Map(), key => fail && key === 'icons');
      assert.equal(f.run('saveUserIcons(iconStorage, [{dataUrl:"data:image/png;base64,AA=="}]).ok'), false);
      assert.equal(f.line.textContent, text);
      fail = false;
      assert.equal(f.run('saveUserIcons(iconStorage, []).ok'), true);
      assert.equal(f.line.hidden, true);
      f.run('recordPhotoSave(false); saveUserIcons(iconStorage, [], {photoSave: false})');
      assert.equal(f.line.textContent, text, 'removing an icon is not a successful photo save');
      return;
    }
    let outcome = 'abort';
    const db = () => database(outcome);
    let invoke;
    if (app === 'aletheia') {
      Object.assign(f.context, { database: async () => db(), DB_STORE: 'images' });
      vm.runInContext(functions(base, 'image-db.js', ['finishTransaction', 'putImage']), f.context);
      invoke = () => f.run('putImage("one", {})');
    } else if (app === 'unlock') {
      f.context.session = { get db() { return db(); } };
      vm.runInContext(functions(base, 'images.js', ['saveImage']), f.context);
      invoke = () => f.run('saveImage("lock", {})');
    } else if (app === 'tobira') {
      f.context.openImageDb = async () => db();
      vm.runInContext(functions(base, 'images.js', ['imageRecord']), f.context);
      invoke = () => f.run('imageRecord("wallpaper", "put", {})');
    } else {
      Object.assign(f.context, { openDatabase: async () => db(), STORE: 'photos', uploadGeneration: { wrong: 0 },
        elements: { 'wrong-status': {} }, preparePhoto: async () => ({}), replaceSlot() {}, storageFailed() {} });
      vm.runInContext(functions(base, 'photo.js', ['storeValue', 'loadFile']), f.context);
      invoke = () => f.run('loadFile("wrong", {type:"image/png", name:"photo"})');
    }
    for (const failure of ['abort', 'error']) {
      outcome = failure;
      // TOBIRA preserves its original request result while separately observing late aborts.
      if (app === 'tobira' || app === 'false-memory') await invoke();
      else await assert.rejects(invoke(), /transaction failed/);
      assert.equal(f.line.textContent, text);
      assert.equal(f.line.hidden, false);
      outcome = 'complete';
      await invoke();
      assert.equal(f.line.hidden, true);
    }
  });
  test(`${app}: notice is inside settings and shell caches its feature module`, { skip: !available }, () => {
    const html = read(base, 'index.html');
    assert.equal((html.match(/id="photo-save-notice"/g) || []).length, 1);
    const settingsId = ['unlock', 'false-memory'].includes(app) ? 'settings-screen' : 'settings';
    assert.ok(html.indexOf(`id="${settingsId}"`) < html.indexOf('id="photo-save-notice"'));
    assert.match(read(base, 'sw.js'), /["']\.\/photo-save-notice\.js["']/);
    assert.match(read(base, 'sw.js'), /-photo-notice-1(?:-perf-log-1)?(?:-r5-(?:[a-z]\d+-)?\d+)*["']/);
  });
}

test('Choice wallpaper catches both blob writes and metadata failures, and only clears on committed success', async () => {
  const base = new URL('../../zz4/', import.meta.url);
  const f = fixture(base);
  const message = {};
  let failure = 'blob';
  Object.assign(f.context, { wp: {}, WP_OUT: { width: 1, height: 1 }, WP_VIEW: { width: 1 },
    normalizeOptions: value => value, store: { options: {} }, controlOptions: value => value,
    drawWallpaperCrop() {}, canvasBlob: async () => ({}),
    writeWallpaper: async () => { if (failure === 'blob') throw new Error('full'); },
    persist: () => failure !== 'metadata', clearWallpaper: async () => {}, closeWallpaperEditor() {}, renderWallpaperState() {} });
  f.context.document = { getElementById: id => id === 'photo-save-notice' ? f.line : message, createElement: () => ({}) };
  vm.runInContext(functions(base, 'wallpaper.js', ['onWallpaperApply']), f.context);
  for (const kind of ['blob', 'metadata']) {
    failure = kind;
    await f.run('onWallpaperApply()');
    assert.equal(f.line.textContent, text);
  }
  failure = null;
  await f.run('onWallpaperApply()');
  assert.equal(f.line.hidden, true);
});


test('TOBIRA: a late successful transaction cannot erase a newer metadata failure', () => {
  const f = fixture(new URL('../../zz6/', import.meta.url));
  f.context.transaction = {};
  f.run('observePhotoTransaction(transaction); recordPhotoSave(false); transaction.oncomplete()');
  assert.equal(f.line.textContent, text);
  f.run('observePhotoTransaction(transaction); transaction.oncomplete()');
  assert.equal(f.line.hidden, true);
});
