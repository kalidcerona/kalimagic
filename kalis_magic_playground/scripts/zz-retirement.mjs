// Pinned personal shell identities from the retirement baseline. Unknown caches stay intact.
export const ZZ_RETIREMENT_SPECS = [
  {
    "id": "zz1",
    "prefix": "stopwatch-uni-shell-",
    "version": "v20261004-first-guide-1-manual-install-1-perf-1-coherent-1-compat-1-local-preview-1-modules-1-local-preview-module-1-update-prompt-3-persist-1",
    "scopeEncoding": "encoded",
    "destination": "/tools/kairos/"
  },
  {
    "id": "zz2",
    "prefix": "unlock-shell-",
    "version": "v20261009-rewind-fullscreen-5-manual-install-1-perf-1-coherent-1-compat-1-wake-1-oneui9-6-modules-2-update-prompt-3-persist-1-photo-notice-1-r5-b3-1",
    "scopeEncoding": "encoded",
    "destination": "/tools/release/"
  },
  {
    "id": "zz3",
    "prefix": "calculator-v2-shell-",
    "version": "v20261004-first-guide-1-manual-install-1-perf-1-coherent-1-compat-1-local-preview-1-modules-1-update-prompt-3-persist-1",
    "scopeEncoding": "encoded",
    "destination": "/tools/hitsuzen/"
  },
  {
    "id": "zz4",
    "prefix": "choice-shell-",
    "version": "v20261010-choice-perf-1-coherent-1-compat-1-wake-1-ready-1-nostatus-1-local-preview-1-modules-1-order-1-split-1-css-1-local-preview-module-1-artwork-1-update-prompt-3-images-1-persist-1-photo-notice-1-perf-log-1-r5-b3-1",
    "scopeEncoding": "encoded",
    "destination": "/tools/choice/"
  },
  {
    "id": "zz5",
    "prefix": "aletheia-shell-",
    "version": "v20261004-first-guide-1-manual-install-1-perf-1-coherent-1-img-2-compat-1-gesture-1-wake-1-local-preview-1-modules-1-split-1-css-1-local-preview-module-1-update-prompt-3-persist-1-launch-check-1-photo-notice-1-r5-1",
    "scopeEncoding": "encoded",
    "destination": "/tools/aletheia/"
  },
  {
    "id": "zz6",
    "prefix": "tobira-shell-",
    "version": "v20261004-first-guide-1-manual-install-1-perf-1-coherent-1-img-2-compat-1-wake-1-local-preview-1-modules-1-order-1-local-preview-module-1-perf-split-1-css-1-update-prompt-3-persist-1-launch-check-1-photo-notice-1-r5-1",
    "scopeEncoding": "encoded",
    "destination": "/tools/tobira/"
  },
  {
    "id": "zz7",
    "prefix": "usotsuki-shell-",
    "version": "v20261009-continuous-paper-20-haptic-dip-manual-install-1-perf-1-coherent-1-compat-1-gesture-1-wake-1-modules-1-split-1-trim-1-css-1-clean-1-lieflash-2-local-preview-module-1-update-prompt-3-hold-range-76-1-persist-1-launch-check-1-perf-log-1-r5-b3-1",
    "scopeEncoding": "encoded",
    "destination": "/tools/usotsuki/"
  },
  {
    "id": "zz8",
    "prefix": "asrai-shell-",
    "version": "v20261004-first-guide-1-manual-install-1-perf-1-coherent-1-gesture-1-compat-1-wake-1-local-preview-2-modules-1-local-preview-module-1-update-prompt-3-persist-1-r5-b3-1",
    "scopeEncoding": "encoded",
    "destination": "/tools/asrai/"
  },
  {
    "id": "zz10",
    "prefix": "alter-shell-",
    "version": "v20261009-alter-grip-1-manual-install-1-perf-1-coherent-1-gesture-1-compat-1-wake-1-local-preview-1-modules-1-split-1-local-preview-module-1-update-prompt-3-persist-1-r5-b3-1",
    "scopeEncoding": "encoded",
    "destination": "/tools/alter/"
  },
  {
    "id": "zz11",
    "prefix": "spinner-shell-",
    "version": "v20261004-design-choice-1-manual-install-1-perf-1-coherent-1-gesture-1-compat-1-wake-1-local-preview-1-install-once-3-trim-1-css-1-local-preview-module-1-update-prompt-6-persist-1-r5-1",
    "scopeEncoding": "encoded",
    "destination": "/tools/tyche/"
  },
  {
    "id": "zz12",
    "prefix": "magic-memdeck-",
    "version": "v20261024-wake-3-v20261021-wake-1-v20261004-first-guide-1-coherent-1-compat-1-brand5-local-preview-module-1-update-prompt-3-persist-1-r5-d2-1",
    "scopeEncoding": "raw",
    "destination": "/tools/memdeck/"
  },
  {
    "id": "zz13",
    "prefix": "magic-qr-",
    "version": "v20261004-first-guide-1-coherent-1-gesture-1-compat-1-wake-1-defer-1-local-preview-1-relaunch-restore-4-local-preview-module-1-update-prompt-3-persist-1-r5-1",
    "scopeEncoding": "encoded",
    "destination": "/tools/arosaegida/"
  },
  {
    "id": "zz14",
    "prefix": "pimax-practice-",
    "version": "v20261024-wake-3-v20261021-wake-1-v20261016-sheet-1-modes-1-coherent-1-v2-brand5-modules-1-css-1-update-prompt-3-persist-1-name-1-r5-1-r5-2",
    "scopeEncoding": "none",
    "destination": "/tools/pimax/"
  },
  {
    "id": "zz15",
    "prefix": "uramichi-web-",
    "version": "v20261024-web-5-modules-2-coherent-1-update-prompt-3-r5-c1",
    "scopeEncoding": "encoded",
    "destination": "/tools/uramichi/"
  }
];

export function retirementWorkerSource(spec) {
  return `/* Retire only this exact personal registration. */
const spec = ${JSON.stringify(spec)};
const expected = new URL('/' + spec.id + '/', self.location.origin).href;
function exactScope() { return self.registration.scope === expected && self.location.href === expected + 'sw.js'; }
self.addEventListener('install', event => {
  if (!exactScope()) throw new Error('Unexpected retirement scope');
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  if (!exactScope()) return;
  event.waitUntil((async () => {
    const scopePart = spec.scopeEncoding === 'none' ? '' : (spec.scopeEncoding === 'raw' ? expected : encodeURIComponent(expected)) + '-';
    const ownedName = spec.prefix + scopePart + spec.version;
    try {
      if (!ownedName.includes('-distribution') && (await caches.keys()).includes(ownedName)) {
        const cache = await caches.open(ownedName);
        const entries = await cache.keys();
        if (entries.length && entries.every(request => {
          const url = new URL(request.url);
          return url.origin === self.location.origin && url.pathname.startsWith('/' + spec.id + '/');
        })) await caches.delete(ownedName);
      }
    } finally {
      await self.registration.unregister();
    }
  })());
});
// No fetch handler: subsequent navigation uses the network. Never move live clients.
`;
}
