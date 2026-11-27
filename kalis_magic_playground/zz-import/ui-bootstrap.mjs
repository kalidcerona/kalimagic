import { acknowledgeResume, readResume, recoverImport } from './apply.mjs';
const bootstrap = document.querySelector('[data-zz-bootstrap]');
const target = bootstrap.dataset.zzBootstrap;
let releaseLive;
let liveRequest;
let registration;
async function importWorker() {
  if (!navigator.serviceWorker) throw new Error('다른 창 확인을 위해 최신 Chrome에서 다시 열어 주세요.');
  registration ||= await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url));
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) throw new Error('앱 업데이트를 완료한 뒤 다시 시도해 주세요.');
  if (worker.state === 'installing') {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('앱 업데이트가 아직 진행 중입니다. 잠시 후 다시 시도해 주세요.')),
        10000,
      );
      worker.addEventListener('statechange', () => {
        if (worker.state !== 'installing') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
  }
  return worker;
}
async function assertNoOtherClients() {
  const worker = await importWorker();
  const urls = await new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(new Error('앱을 다시 열어 업데이트한 뒤 가져오기를 시도해 주세요.'));
    }, 2500);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data.clients);
    };
    worker.postMessage({ type: 'zz-import-clients-v1' }, [channel.port2]);
  });
  const legacy = { kairos: 'stopwatch-uni', 'kairos-classic': 'stopwatch', hitsuzen: 'calc' };
  const routes = [`/tools/${target}/`, ...(legacy[target] ? [`/tools/${legacy[target]}/`] : [])];
  if (urls.some((url) => routes.some((route) => new URL(url).pathname.startsWith(route)))) {
    throw new Error('이 앱의 다른 탭과 설치 창을 닫고 다시 시도해 주세요.');
  }
}
async function holdLive() {
  if (!navigator.locks) return;
  await new Promise((resolve, reject) => {
    liveRequest = navigator.locks.request(`zz-app-live:${target}`, { mode: 'shared' }, async () => {
      resolve();
      await new Promise((done) => {
        releaseLive = done;
      });
    });
    liveRequest.catch(reject);
  });
}
export async function exclusiveWrite(callback) {
  if (!navigator.locks) throw new Error('안전한 가져오기를 지원하는 최신 Chrome에서 다시 열어 주세요.');
  releaseLive?.();
  await liveRequest;
  try {
    return await navigator.locks.request(`zz-app-live:${target}`, { ifAvailable: true }, async (lock) => {
      if (!lock) throw new Error('이 앱의 다른 탭과 설치 창을 닫고 다시 시도해 주세요.');
      await assertNoOtherClients();
      document.body.inert = true;
      try {
        return await callback();
      } finally {
        document.body.inert = false;
      }
    });
  } finally {
    await holdLive();
  }
}
async function start() {
  await globalThis.zzImportAccess;
  // Wait for any writer to finish (or crash), then inspect its durable journal.
  // Skipping recovery when a lock is busy could expose a partially written profile.
  await holdLive();
  await recoverImport(target, { beforeRecover: assertNoOtherClients });
  const resume = target === 'tyche' ? await readResume(target) : null;
  if (resume) globalThis.zzImportResume = { tyche: resume.token };
  const originals = [...document.querySelectorAll('script[type="application/x-zz-deferred"]')];
  // Parser-blocking scripts first, then deferred/module scripts in document order.
  const scripts = [
    ...originals.filter((s) => !s.defer && s.dataset.zzType !== 'module'),
    ...originals.filter((s) => s.defer || s.dataset.zzType === 'module'),
  ];
  for (const old of scripts) {
    const script = document.createElement('script');
    for (const attr of old.attributes) {
      if (!['type', 'data-zz-type', 'defer', 'async'].includes(attr.name)) {
        script.setAttribute(attr.name, attr.value);
      }
    }
    if (old.dataset.zzType) script.type = old.dataset.zzType;
    script.textContent = old.textContent;
    const loaded = script.src || script.type === 'module'
      ? new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () => reject(new Error('앱 파일을 불러오지 못했습니다.'));
      })
      : Promise.resolve();
    old.replaceWith(script);
    await loaded;
  }
  if (resume) {
    try {
      await acknowledgeResume(target, resume.token);
    } catch (error) {
      console.warn('ZZ resume acknowledgement deferred', error);
    }
    delete globalThis.zzImportResume;
  }
  // The delayed scripts use readyState guards; never replay global lifecycle events.
  if (location.hash !== '#selftest') importWorker().catch(() => {});
  bootstrap.dataset.zzReady = 'true';
}
start().then(() => {
  // Settings can load after the app has registered its input handlers.
  return import('./ui.mjs')
    .then(({ mountImportSettings }) => mountImportSettings(target, exclusiveWrite))
    .catch((error) => console.warn('ZZ import settings unavailable', error));
}, (error) => {
  releaseLive?.();
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = `이전 데이터 복구를 완료하지 못해 앱 시작을 멈췄습니다. ${error.message}`;
  document.body.append(message);
});
