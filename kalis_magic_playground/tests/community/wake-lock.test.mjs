import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Apps that hold a screen wake lock during performance and drop it on the settings path.
const APPS = [
  {
    file: 'zz2/index.html',
    settings: /function showScreen\(next, animate = false\) \{[\s\S]*?next === 'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return screen !== "settings"/,
  },
  {
    file: 'zz4/app.js',
    settings: /function closeFakeHome\(\) \{[\s\S]*?fakeHomeSession = null;[\s\S]*?dataset\.view = 'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /function performanceWakeWanted\(\) \{\s*return rehearsalSurfaceOpen\(\);\s*\}/,
  },
  {
    file: 'zz5/app.js',
    settings: /function stopPerformance\(\) \{[\s\S]*?view = 'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return view === 'performance'/,
  },
  {
    file: 'zz6/app.js',
    settings: /function showSettings\(\) \{[\s\S]*?state\.mode = 'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return state\.mode === 'performance'/,
  },
  {
    file: 'zz7/detector.js',
    settings: /function showSettings\(\) \{[\s\S]*?settingsScreen\.hidden = false[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return !performanceScreen\.hidden && !settingsVisible\(\)/,
  },
  {
    file: 'zz8/contacts.js',
    settings: /function showScreen\(screen\) \{\s*settingsScreen\.hidden = screen !== "settings";[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /function performanceOpen\(\) \{\s*return settingsScreen\.hidden;\s*\}/,
  },
  {
    file: 'zz10/app.js',
    settings: /function openSettings\(\) \{[\s\S]*?settings\.hidden = false;[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return Boolean\(stream\) && settings\.hidden/,
  },
  {
    file: 'zz11/app.js',
    settings: /function showSettings\(\) \{[\s\S]*?settings\.hidden = false;[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return settings\.hidden/,
  },
  {
    file: 'zz13/app.mjs',
    settings: /function open\(\)\{[\s\S]*?\$\('settings'\)\.showModal\(\);syncPerformanceWakeLock\(\)/,
    wanted: /return \$\('settings'\)\.open !== true/,
  },
  {
    file: 'distribution-snapshots/unlock/index.html',
    settings: /function showScreen\(next, animate = false\) \{[\s\S]*?next === 'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return screen !== "settings"/,
  },
  {
    file: 'distribution-snapshots/aletheia/app.js',
    settings: /function stopPerformance\(\) \{[\s\S]*?view = 'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return view === 'performance'/,
  },
  {
    file: 'distribution-snapshots/tobira/app.js',
    settings: /function showSettings\(\) \{[\s\S]*?state\.mode = 'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return state\.mode === 'performance'/,
  },
  {
    file: 'distribution-snapshots/usotsuki/detector.js',
    settings: /function showSettings\(\) \{[\s\S]*?settingsScreen\.hidden = false[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return !performanceScreen\.hidden && !settingsVisible\(\)/,
  },
  {
    file: 'distribution-snapshots/spinner/app.js',
    settings: /function showSettings\(\) \{[\s\S]*?settings\.hidden = false;[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return settings\.hidden/,
  },
  {
    file: 'distribution-snapshots/qr/app.mjs',
    settings: /function open\(\)\{[\s\S]*?\$\('settings'\)\.showModal\(\);syncPerformanceWakeLock\(\)/,
    wanted: /return \$\('settings'\)\.open !== true/,
  },
];

function sourceOf(file) {
  return readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
}

for (const app of APPS) {
  test(`${app.file} requests a screen wake lock, releases it on the settings path, and feature-detects`, () => {
    const source = sourceOf(app.file);
    assert.match(source, /navigator\.wakeLock\.request\(\s*"screen"\s*\)/);
    assert.match(source, /!\(\s*"wakeLock" in navigator\s*\)/);
    assert.match(source, /else releaseWakeLock\(\)/);
    assert.match(source, app.wanted);
    assert.match(source, app.settings);
  });
}

function cut(source, start, end) {
  const at = source.indexOf(start);
  const to = source.indexOf(end, at + start.length);
  assert.ok(at >= 0 && to > at, start);
  return source.slice(at, to);
}

function element() {
  return {
    hidden: true,
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    focus() {},
    style: {},
    setAttribute() {},
    removeAttribute() {},
    querySelectorAll() { return []; },
  };
}

test('zz4 performance requests the screen lock once and settings releases it', async () => {
  const app = sourceOf('zz4/app.js');
  const source = [
    cut(app, 'function rehearsalSurfaceOpen()', 'function leaveRehearsalSurface()'),
    cut(app, 'let wakeLock = null;', 'function resetForNextSpectator()'),
  ].join('\n');
  const requests = [];
  const releases = [];
  const sandbox = {
    fakeHomeSession: null,
    fakeHomeGesture: null,
    resetTaps: null,
    readoutCleared: false,
    statusClock: 0,
    store: { options: {} },
    fakeHomeEl: element(),
    fakeNotesEl: element(),
    settingsEl: element(),
    document: {
      visibilityState: 'visible',
      title: '',
      body: { dataset: {} },
      getElementById() { return null; },
    },
    history: { replaceState() {} },
    navigator: {
      wakeLock: {
        request(type) {
          requests.push(type);
          return Promise.resolve({
            release() {
              releases.push(type);
              return Promise.resolve();
            },
            addEventListener() {},
          });
        },
      },
    },
    syncUserIconsFromStorage() {},
    ensureFakeHomeIcons() {},
    clearFakeNotesView() {},
    createFakeHomeEntry() { return {}; },
    normalizeOptions(options) { return options; },
    applyHomeStyle() {},
    updateStatusTime() {},
    setInterval() { return 1; },
    clearInterval() {},
    syncFakeHomeSurface() {},
    applyWallpaper() {},
    maybeShowGestureGuide() {},
    hideGestureGuide() {},
    dismissInputGuide() {},
    releaseWallpaper() {},
    endPeek() {},
    showView() {},
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'zz4/app.js' });

  sandbox.openFakeHome([]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(requests, ['screen']);
  assert.deepEqual(releases, []);
  assert.equal(sandbox.document.body.dataset.view, 'fake-home');

  sandbox.closeFakeHome();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(requests, ['screen']);
  assert.deepEqual(releases, ['screen']);
  assert.equal(sandbox.document.body.dataset.view, 'settings');
  assert.equal(sandbox.settingsEl.hidden, false);
});
