import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = (file) => readFileSync(new URL(`../../zz6/${file}`, import.meta.url), 'utf8');

test('home renders twelve Korean labels and a four-app dock without input handlers', () => {
  const home = {};
  const source = read('home-screen.js').replace(/export \{[^}]+\};/, '');
  vm.runInNewContext(`${source}\nrenderHomeScreen();`, { document: { querySelector: () => home } });
  assert.equal((home.innerHTML.match(/class="home-app"/g) || []).length, 12);
  assert.equal((home.innerHTML.split('class="home-dock"')[1].match(/class="home-app"/g) || []).length, 4);
  for (const label of ['전화', '메시지', '카메라', '갤러리', '설정', '시계', '캘린더', '메모', '날씨', '계산기', '음악', '지도']) assert.ok(home.innerHTML.includes(`>${label}</span>`));
  assert.doesNotMatch(source, /addEventListener|onclick/);
  assert.match(read('style-stage.css'), /\.stage\.has-wallpaper \.home \{ display: none; \}/);
});

test('offline shell contains home module and both credits; launch release matches exactly', () => {
  const sw = read('sw.js');
  for (const file of ['home-screen.js', 'COIN_CREDITS.md', 'CARD_CREDITS.md']) assert.ok(sw.includes(`"./${file}"`));
  const release = sw.match(/CACHE_NAME = CACHE_PREFIX \+ '([^']+)'/)[1];
  assert.ok(read('launch-check.js').includes(`-${release}'`));
});

test('wake lock tolerates rejection and retries when visibility returns', async () => {
  let calls = 0;
  const handlers = {};
  const document = { visibilityState: 'visible', addEventListener: (type, fn) => { handlers[type] = fn; } };
  vm.runInNewContext(read('wake-lock.js').replace(/export \{[^}]+\};/, '') + '\nsyncPerformanceWakeLock();', {
    document, navigator: { wakeLock: { request: async () => { calls++; throw new Error('denied'); } } },
  });
  await new Promise(setImmediate);
  assert.equal(calls, 1);
  document.visibilityState = 'hidden'; handlers.visibilitychange();
  document.visibilityState = 'visible'; handlers.visibilitychange();
  await new Promise(setImmediate);
  assert.equal(calls, 2);
});
