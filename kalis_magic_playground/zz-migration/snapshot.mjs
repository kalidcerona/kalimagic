const pause = () => new Promise(resolve => setTimeout(resolve, 0));

export async function readEntries(keys, fallback) {
  const entries = {};
  let since = performance.now();
  for (const key of keys) {
    if (key === fallback?.legacy) continue;
    let value = localStorage.getItem(key);
    if (key === 'zz11-spinner-state-v2' && window.zzBackupTycheState) {
      value = window.zzBackupTycheState(value);
    }
    if (value !== null) entries[key] = value;
    if (performance.now() - since >= 4) {
      await pause();
      since = performance.now();
    }
  }
  if (fallback) {
    // RELEASE tests the truthiness of the parsed personal value before trying its older key.
    let primary;
    try { primary = JSON.parse(entries[fallback.primary]); } catch {}
    if (!primary) {
      const raw = localStorage.getItem(fallback.legacy);
      let legacy;
      try { legacy = JSON.parse(raw); } catch {}
      if (legacy && typeof legacy === 'object') entries[fallback.legacy] = raw;
    }
  }
  return entries;
}

function observeWrites(config, changed, mediaChanged) {
  const watched = new Set(config.keys);
  if (config.appId === 'zz11') watched.add('zz-migration:tyche:launch-reset');
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('zz-migration:' + config.appId) : null;
  if (channel) channel.onmessage = mediaChanged;
  addEventListener('storage', event => {
    if (event.storageArea === localStorage && (event.key === null || watched.has(event.key))) changed();
  });
  for (const method of ['setItem', 'removeItem', 'clear']) {
    const original = Storage.prototype[method];
    Storage.prototype[method] = function (...args) {
      const relevant = this === localStorage && (method === 'clear' || watched.has(args[0]));
      const previous = relevant && method !== 'clear' ? this.getItem(args[0]) : null;
      const result = original.apply(this, args);
      if (relevant && (method === 'clear' || previous !== this.getItem(args[0]))) changed();
      return result;
    };
  }
  if (!config.media) return;
  const seen = new WeakSet();
  for (const method of ['put', 'add', 'delete', 'clear']) {
    const original = IDBObjectStore.prototype[method];
    IDBObjectStore.prototype[method] = function (...args) {
      const request = original.apply(this, args);
      const tx = this.transaction;
      if (tx.db.name === config.media.db && this.name === config.media.store && !seen.has(tx)) {
        seen.add(tx);
        tx.addEventListener('complete', () => {
          mediaChanged();
          channel?.postMessage(true);
        }, {once:true});
      }
      return request;
    };
  }
}

export function start(config) {
  let generation = 0, mediaRevision = 0, timer, idle, running = false, pending = false;
  let lastEntries, lastMediaRevision;
  const keys = [...new Set(config.keys)].sort();
  const status = document.createElement('small');
  status.setAttribute('role', 'status');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '백업 파일 저장';
  const controls = document.createElement('div');
  controls.dataset.zzBackup = config.appId;
  controls.append(button, status);
  const dynamicRoot = config.appId === 'zz12' ? document.getElementById('main') :
    config.appId === 'zz14' ? document.getElementById('app') : null;
  function mount() {
    if (controls.isConnected) return;
    const panel = document.querySelector(config.settingsSelector);
    observer.disconnect();
    if (panel) panel.append(controls);
    for (let ancestor = panel || dynamicRoot; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, {childList:true});
    }
  }
  const observer = new MutationObserver(mount);
  mount();

  async function capture(exporting) {
    const revision = generation;
    const rawEntries = await readEntries(keys, config.settingsFallback);
    const capturedMediaRevision = mediaRevision;
    if (!exporting && lastEntries && lastMediaRevision === capturedMediaRevision &&
        keys.every(key => lastEntries[key] === rawEntries[key])) return {saved:true};
    const worker = new Worker(new URL('./media-worker.mjs', import.meta.url), {type:'module'});
    try {
      return await new Promise((resolve, reject) => {
        worker.onerror = event => reject(new Error(event.message));
        worker.onmessageerror = () => reject(new Error('백업 작업 결과를 읽을 수 없습니다.'));
        worker.onmessage = async ({data}) => {
          if (data.verify) {
            try {
              const current = await readEntries(keys, config.settingsFallback);
              worker.postMessage({confirm: revision === generation && keys.every(key => current[key] === rawEntries[key])});
            } catch (error) { reject(error); }
          } else if (data.error) {
            reject(Object.assign(new Error(data.error), {name:data.name}));
          } else {
            if (data.saved) {
              lastEntries = rawEntries;
              lastMediaRevision = capturedMediaRevision;
            } else if (data.empty) lastEntries = null;
            resolve(data);
          }
        };
        worker.postMessage({config, rawEntries, exporting, sourceOrigin:location.origin, sourcePath:location.pathname});
      });
    } finally { worker.terminate(); }
  }

  const locked = operation => navigator.locks.request('zz-migration:' + config.appId, operation);
  async function save() {
    if (running) { pending = true; return; }
    running = true;
    try {
      const result = await locked(() => capture(false));
      status.textContent = result.saved ? ' 이 기기에 백업했습니다.' : ' 백업할 원본이 없습니다.';
    } catch (error) {
      if (error.message === 'source-changed') pending = true;
      else if (error.name === 'MissingPhotoError') status.textContent = ' 사진 누락으로 백업을 완료하지 못했습니다.';
      else if (error.name === 'QuotaExceededError') {
        const storage = await navigator.storage?.estimate?.().catch(() => null);
        const free = storage ? Math.max(0, Math.floor((storage.quota - storage.usage) / 1048576)) : null;
        status.textContent = ' 저장 공간이 부족합니다.' + (free === null ? '' : ' 예상 여유 공간 ' + free + ' MB.') + ' 파일로 저장해 주세요.';
      } else status.textContent = ' 기기 백업 실패. 파일로 저장할 수 있습니다.';
    } finally {
      running = false;
      if (pending) { pending = false; schedule(); }
    }
  }
  function schedule() {
    generation++;
    clearTimeout(timer);
    if (idle !== undefined) window.cancelIdleCallback(idle);
    timer = setTimeout(() => {
      if (window.requestIdleCallback) idle = window.requestIdleCallback(() => { idle = undefined; save(); }, {timeout:1500});
      else save();
    }, 250);
  }
  function mediaChanged() {
    mediaRevision++;
    schedule();
  }
  observeWrites(config, schedule, mediaChanged);
  addEventListener('pageshow', mediaChanged);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) mediaChanged(); });
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const persist = navigator.storage?.persist?.().catch(() => false);
      const {file} = await locked(() => capture(true));
      if (!file) { status.textContent = ' 백업할 원본이 없습니다.'; return; }
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = config.appId + '-backup.' + (config.media ? 'zip' : 'json');
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = (await persist) === false ? ' 파일 저장을 요청했습니다. 브라우저 영구 저장은 허용되지 않았습니다.' : ' 파일 저장을 요청했습니다.';
    } catch (error) {
      status.textContent = error.name === 'MissingPhotoError' ? ' 사진 누락으로 파일을 만들 수 없습니다.' : ' 파일을 만들지 못했습니다. 다시 시도해 주세요.';
    }
    finally { button.disabled = false; }
  });
  schedule();
}
