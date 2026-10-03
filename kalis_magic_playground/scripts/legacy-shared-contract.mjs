// Confirmed same-origin shared aliases only. /zz3, /zz4, and /zz6 are reused
// by other apps and are intentionally absent. /tools/stopwatch2 is not confirmed.

export const TRUSTED_START_SESSION_KEY = 'magic-legacy-trusted-start-v1';

export const REUSED_PERSONAL_ROUTES = Object.freeze(['/zz3', '/zz4', '/zz6']);

export const LEGACY_SHARED_WORKERS = Object.freeze([
  Object.freeze({
    tool: 'stopwatch',
    legacyWorkerPath: '/tools/stopwatch/sw.js',
    legacyScopePath: '/tools/stopwatch/',
    canonicalPath: '/tools/kairos-classic/',
    target: 'kairos-classic',
    storagePrefix: 'friend-kairos-classic_',
    tutorialSourceKey: 'stopwatch-settings-entry-tutorial-v1',
    tutorialDestKey: 'friend-kairos-classic-settings-entry-tutorial-v1',
    sourceKind: 'landscape',
    bridgeFile: 'legacy-bridges/stopwatch/sw.js',
  }),
  Object.freeze({
    tool: 'stopwatch-uni',
    legacyWorkerPath: '/tools/stopwatch-uni/sw.js',
    legacyScopePath: '/tools/stopwatch-uni/',
    canonicalPath: '/tools/kairos/',
    target: 'kairos',
    storagePrefix: 'friend-kairos_',
    tutorialSourceKey: 'stopwatch-settings-entry-tutorial-v1',
    tutorialDestKey: 'friend-kairos-settings-entry-tutorial-v1',
    sourceKind: 'integrated',
    bridgeFile: 'legacy-bridges/stopwatch-uni/sw.js',
  }),
  Object.freeze({
    tool: 'calc',
    legacyWorkerPath: '/tools/calc/sw.js',
    legacyScopePath: '/tools/calc/',
    canonicalPath: '/tools/hitsuzen/',
    target: 'hitsuzen',
    storagePrefix: null,
    tutorialSourceKey: null,
    tutorialDestKey: null,
    sourceKind: 'calculator',
    bridgeFile: 'legacy-bridges/calc/sw.js',
  }),
]);

const WORKER_BY_PATH = new Map(LEGACY_SHARED_WORKERS.map((spec) => [spec.legacyWorkerPath, spec]));

export function legacyWorkerSpecByPath(pathname) {
  if (typeof pathname !== 'string') return null;
  return WORKER_BY_PATH.get(pathname) || null;
}

export function legacyWorkerSpecByTool(tool) {
  return LEGACY_SHARED_WORKERS.find((spec) => spec.tool === tool) || null;
}

export function legacyWorkerSpecByTarget(target) {
  return LEGACY_SHARED_WORKERS.find((spec) => spec.target === target) || null;
}

export function isReusedPersonalRoute(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return false;
  return REUSED_PERSONAL_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
