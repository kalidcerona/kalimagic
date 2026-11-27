import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { tobiraAppScript } from './tobira-app-script.mjs';
import { aletheiaAppScript } from './aletheia-app-script.mjs';
import { usotsukiAppScript } from './usotsuki-app-script.mjs';
import { choiceAppScript, choiceModuleScript } from './choice-app-script.mjs';

// Personal apps stay awake in settings; pinned friend snapshots retain their previous policy.
const APPS = [
  {
    file: 'distribution-snapshots/choice/app.js',
    modules: 'choice',
    settings: /function closeFakeHome\(\) \{[\s\S]*?fakeHomeSession = null;[\s\S]*?dataset\.view = 'settings'[\s\S]*?syncPerformanceWakeLock\(\)/,
    wanted: /function performanceWakeWanted\(\) \{\s*return rehearsalSurfaceOpen\(\);\s*\}/,
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
  test(`${app.file} requests a screen wake lock with its personal or pinned settings policy and feature-detects`, () => {
    const source = app.modules === 'usotsuki' ? usotsukiAppScript(fileURLToPath(new URL(`../../${app.file.replace(/detector\.js$/, '')}`, import.meta.url)))
      : app.modules === 'choice' ? choiceAppScript(fileURLToPath(new URL('../../distribution-snapshots/choice/', import.meta.url)))
      : app.modules === 'aletheia' ? aletheiaAppScript(fileURLToPath(new URL(`../../${app.file.replace(/app\.js$/, '')}`, import.meta.url)))
      : app.modules ? tobiraAppScript(fileURLToPath(new URL(`../../${app.file.replace(/app\.js$/, '')}`, import.meta.url))) : app.sources ? app.sources.map(sourceOf).join('\n') : sourceOf(app.file);
    assert.match(source, /navigator\.wakeLock\.request\(\s*"screen"\s*\)/);
    assert.match(source, /!\(\s*"wakeLock" in navigator\s*\)/);
    assert.match(source, /else releaseWakeLock\(\)/);
    const personal = app.file.startsWith('zz');
    assert.match(source, personal && app.file !== 'zz8/contacts-screen.js' ? /return document\.visibilityState === ["']visible["']/ : app.wanted);
    assert.match(source, app.file === 'distribution-snapshots/spinner/app.js' ? /function showSettings\(\) \{[\s\S]*?settings\.hidden = false;/ : app.file === 'distribution-snapshots/qr/app.mjs' ? /showModal\(\);syncPerformanceWakeLock\(\)/ : app.settings);
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


function awakeSlice(source) {
  const start = source.indexOf('function keepVisibleScreenAwake()');
  const end = source.indexOf('keepVisibleScreenAwake();', start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end + 'keepVisibleScreenAwake();'.length);
}

function tabataAwakeSlice(source) {
  return source + '\nglobalThis.TabataWakeLock(() => {}).keepAwake();';
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
  const shared = awakeSlice(sourceOf('distribution-snapshots/pimax/app.mjs'));
  await driveShortLivedBudget(awakeSlice(sourceOf('distribution-snapshots/memdeck/app.mjs')));
  assert.equal(awakeSlice(sourceOf('distribution-snapshots/pimax/app.mjs')), shared);
  await driveShortLivedBudget(shared);
  await driveShortLivedBudget(tabataAwakeSlice(sourceOf('TabataTimer/wake-lock.js')));
});
