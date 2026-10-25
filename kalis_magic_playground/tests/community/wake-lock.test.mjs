import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { tobiraAppScript } from './tobira-app-script.mjs';
import { aletheiaAppScript } from './aletheia-app-script.mjs';
import { usotsukiAppScript } from './usotsuki-app-script.mjs';
import { choiceAppScript, choiceModuleScript } from './choice-app-script.mjs';

// Apps that hold a screen wake lock during performance and drop it on the settings path.
const APPS = [
  {
    file: 'zz2/rewind.js',
    settings: /function showScreen\(next, animate = false\) \{[\s\S]*?next === 'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return session\.screen !== "settings"/,
  },
  {
    file: 'zz4/app.js',
    modules: 'choice',
    settings: /function closeFakeHome\(\) \{[\s\S]*?fakeHomeSession = null;[\s\S]*?dataset\.view = 'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /function performanceWakeWanted\(\) \{\s*return rehearsalSurfaceOpen\(\);\s*\}/,
  },
  {
    file: 'zz5/app.js',
    modules: 'aletheia',
    settings: /function stopPerformance\(\) \{[\s\S]*?(?:view = |setView\()'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return view === 'performance'/,
  },
  {
    file: 'zz6/app.js',
    modules: true,
    settings: /function showSettings\(\) \{[\s\S]*?state\.mode = 'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return state\.mode === 'performance'/,
  },
  {
    file: 'zz7/detector.js',
    modules: 'usotsuki',
    settings: /function showSettings\(\) \{[\s\S]*?settingsScreen\.hidden = false[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return !performanceScreen\.hidden && !settingsVisible\(\)/,
  },
  {
    file: 'zz8/contacts-screen.js',
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
    file: 'distribution-snapshots/unlock/rewind.js',
    settings: /function showScreen\(next, animate = false\) \{[\s\S]*?next === 'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return session\.screen !== "settings"/,
  },
  {
    file: 'distribution-snapshots/aletheia/app.js',
    modules: 'aletheia',
    settings: /function stopPerformance\(\) \{[\s\S]*?(?:view = |setView\()'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return view === 'performance'/,
  },
  {
    file: 'distribution-snapshots/tobira/app.js',
    modules: true,
    settings: /function showSettings\(\) \{[\s\S]*?state\.mode = 'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /return state\.mode === 'performance'/,
  },
  {
    file: 'distribution-snapshots/usotsuki/detector.js',
    modules: 'usotsuki',
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
    const source = app.modules === 'usotsuki' ? usotsukiAppScript(fileURLToPath(new URL(`../../${app.file.replace(/detector\.js$/, '')}`, import.meta.url)))
      : app.modules === 'choice' ? choiceAppScript(fileURLToPath(new URL('../../zz4/', import.meta.url)))
      : app.modules === 'aletheia' ? aletheiaAppScript(fileURLToPath(new URL(`../../${app.file.replace(/app\.js$/, '')}`, import.meta.url)))
      : app.modules ? tobiraAppScript(fileURLToPath(new URL(`../../${app.file.replace(/app\.js$/, '')}`, import.meta.url))) : sourceOf(app.file);
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
  // zz4 runs app.js with local feature modules. The lock code that sat right above openFakeHome
  // now lives in wake-lock.js, so the same code is read as that module plus openFakeHome and closeFakeHome.
  const dir = fileURLToPath(new URL('../../zz4/', import.meta.url));
  const app = choiceAppScript(dir);
  const source = [
    cut(app, 'function rehearsalSurfaceOpen()', 'function leaveRehearsalSurface()'),
    choiceModuleScript(dir, 'wake-lock.js'),
    cut(app, 'function openFakeHome(', 'function resetForNextSpectator()'),
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

function awakeSlice(source) {
  const start = source.indexOf('function keepVisibleScreenAwake()');
  const end = source.indexOf('keepVisibleScreenAwake();', start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end + 'keepVisibleScreenAwake();'.length);
}

function tabataAwakeSlice(source) {
  const start = source.indexOf('  let wakePending = false, shortLived = 0;');
  const end = source.indexOf('  function start()', start);
  assert.ok(start >= 0 && end > start);
  return `let wake = null;\n${source.slice(start, end)}\nkeepAwake();\n`;
}

// Drive the shipped release listener with a fake lock and a manual clock.
async function driveShortLivedBudget(code) {
  let now = 0;
  const timers = [];
  const requests = [];
  let visibility = 'visible';
  const onVisibility = [];
  const document = {
    get visibilityState() { return visibility; },
    addEventListener(type, handler) { if (type === 'visibilitychange') onVisibility.push(handler); },
  };
  const navigator = {
    wakeLock: {
      request(type) {
        const entry = { type, onRelease: null };
        requests.push(entry);
        return Promise.resolve({
          release() {
            entry.onRelease?.();
            return Promise.resolve();
          },
          addEventListener(type, handler) { if (type === 'release') entry.onRelease = handler; },
        });
      },
    },
  };
  vm.runInNewContext(code, {
    document,
    navigator,
    setTimeout(fn, delay) { timers.push({ fn, at: now + delay, done: false }); return timers.length; },
    Date: { now: () => now },
    tick() {},
  });
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const elapse = async (ms) => {
    now += ms;
    for (const timer of timers.filter((timer) => !timer.done && timer.at <= now)) {
      timer.done = true;
      timer.fn();
      await flush();
    }
  };
  const release = () => requests.at(-1).onRelease();
  await flush();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].type, 'screen');
  release();
  await elapse(999);
  assert.equal(requests.length, 1, 'first retry waits about 1s');
  await elapse(1);
  assert.equal(requests.length, 2);
  release();
  await elapse(1000);
  assert.equal(requests.length, 3);
  release();
  await elapse(1000);
  await elapse(60000);
  assert.equal(requests.length, 3, 'auto-retry stops after three short-lived locks');
  visibility = 'hidden';
  for (const handler of onVisibility) handler();
  visibility = 'visible';
  for (const handler of onVisibility) handler();
  await flush();
  assert.equal(requests.length, 4, 'a return to visible requests again');
  await elapse(10000);
  release();
  await elapse(1000);
  assert.equal(requests.length, 5, 'a lock held 10s restores the retry budget');
}

test('visible wake lock stops retrying after three short releases and resumes when shown again', async () => {
  const shared = awakeSlice(sourceOf('zz14/app.mjs'));
  assert.equal(awakeSlice(sourceOf('zz12/app.mjs')), shared);
  assert.equal(awakeSlice(sourceOf('distribution-snapshots/pimax/app.mjs')), shared);
  await driveShortLivedBudget(shared);
  await driveShortLivedBudget(tabataAwakeSlice(sourceOf('TabataTimer/app.js')));
});
