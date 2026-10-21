import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, stat, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { PUBLIC_DIRS, TABATA_FILES, MIRROR_PAIRS, preparePimaxRuntime } from '../../scripts/build-public.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = file => readFile(path.join(root, 'TabataTimer', file), 'utf8');
const shell = ['index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'brand-logo.png', 'icon.svg', 'icon-192.png', 'icon-512.png', 'data.js', 'install-ui.js', 'icon-maskable-192.png', 'icon-maskable-512.png'];

function worker(scope, caches) {
  const listeners = {};
  const context = vm.createContext({ URL, Request, Response, Set, caches, fetch: async () => { throw new Error('offline'); },
    self: { registration: { scope }, clients: { claim() {} }, skipWaiting() {}, addEventListener(type, handler) { listeners[type] = handler; } } });
  return { context, listeners };
}

test('TabataTimer publishes only its explicit shell at the exact case-sensitive path in an isolated CI build', async () => {
  assert.ok(PUBLIC_DIRS.includes('TabataTimer'));
  assert.deepEqual([...TABATA_FILES].sort(), [...shell, 'sw.js'].sort());
  const temp = await mkdtemp(path.join(tmpdir(), 'tabata-deploy-'));
  try {
    const site = path.join(temp, 'site');
    await cp(root, site, { recursive: true, filter: source => !['node_modules', 'dist', '.git'].includes(path.relative(root, source).split(path.sep)[0]) });
    // Seed non-runtime content in the temporary copy to test the publication boundary.
    await writeFile(path.join(site, 'TabataTimer', 'draft.txt'), 'private fixture');
    await mkdir(path.join(site, 'TabataTimer', 'notes'));
    await writeFile(path.join(site, 'TabataTimer', 'notes', 'index.html'), 'private fixture');
    const result = spawnSync(process.execPath, ['scripts/build-public.mjs'], { cwd: site, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const published = path.join(site, 'dist', 'TabataTimer');
    assert.deepEqual((await readdir(published)).sort(), [...shell, 'sw.js'].sort());
    assert.equal((await readdir(path.join(site, 'dist'))).includes('tabatatimer'), false);
    for (const file of [...shell, 'sw.js']) {
      assert.ok((await stat(path.join(published, file))).isFile(), file);
      assert.deepEqual(await readFile(path.join(published, file)), await readFile(path.join(root, 'TabataTimer', file)), file);
    }
    const html = await readFile(path.join(published, 'index.html'), 'utf8');
    for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) {
      assert.ok((await stat(path.join(published, match[1]))).isFile(), match[1]);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('TabataTimer has distinct standalone identity, complete metadata, icons and Netlify headers', async () => {
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  assert.equal(manifest.id, './');
  for (const route of ['TabataTimer','tabatatimer']) {
    const base = `https://example.com/${route}/manifest.webmanifest`;
    assert.equal(new URL(manifest.id,base).href,new URL('./',base).href);
    assert.equal(new URL(manifest.start_url,base).href,new URL(manifest.scope,base).href);
  }
  for (const key of ['name', 'short_name']) assert.equal(manifest[key], 'Tabata Timer');
  for (const key of ['start_url', 'scope']) assert.equal(manifest[key], './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.display_override, undefined);
  for (const key of ['background_color', 'theme_color']) assert.equal(manifest[key], '#1a1512');
  for (const route of PUBLIC_DIRS.filter(route => /^zz\d+$/.test(route))) {
    const other = JSON.parse(await readFile(path.join(root, route, 'manifest.webmanifest'), 'utf8'));
    assert.notEqual(new URL(other.id || other.start_url, `https://example.com/${route}/`).pathname, new URL(manifest.id, 'https://example.com/TabataTimer/').pathname);
  }
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512', '192x192', '512x512']);
  assert.deepEqual(manifest.icons.slice(2).map(icon=>icon.purpose),['maskable','maskable']);
  for (const [index, size] of [192, 512, 192, 512].entries()) {
    const icon = manifest.icons[index];
    assert.equal(icon.type, 'image/png');
    const bytes = await readFile(path.join(root, 'TabataTimer', icon.src));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
  const html = await read('index.html');
  for (const pattern of [/^<!DOCTYPE html>/, /<html lang="ko">/, /viewport-fit=cover/, /name="theme-color" content="#1a1512"/, /name="color-scheme" content="dark"/, /rel="manifest" href="\.\/manifest.webmanifest"/, /rel="apple-touch-icon" href="\.\/icon-192.png"/, /<title>Tabata Timer<\/title>/]) assert.match(html, pattern);
  const headers = await readFile(path.join(root, 'netlify.toml'), 'utf8');
  for (const route of ['TabataTimer', 'tabatatimer']) {
    for (const [file,type] of [['data.js','application/javascript; charset=utf-8'],['install-ui.js','application/javascript; charset=utf-8'],['icon-maskable-192.png','image/png'],['icon-maskable-512.png','image/png']]) {
      const block = headers.split('[[headers]]').find(block => block.includes(`for = "/${route}/${file}"`));
      assert.ok(block?.includes(`Content-Type = "${type}"`), `${route}/${file} MIME`);
    }
  }
  assert.match(headers, /for = "\/TabataTimer\/manifest\.webmanifest"\s+\[headers.values\]\s+Content-Type = "application\/manifest\+json"/);
  assert.match(headers, /for = "\/tabatatimer\/manifest\.webmanifest"\s+\[headers.values\]\s+Content-Type = "application\/manifest\+json"/);
  assert.match(headers, /for = "\/tabatatimer\/sw\.js"\s+\[headers.values\]\s+Content-Type = "application\/javascript; charset=utf-8"\s+Cache-Control = "no-store, no-cache"/);
  assert.match(headers, /for = "\/TabataTimer\/sw\.js"\s+\[headers.values\]\s+Content-Type = "application\/javascript; charset=utf-8"\s+Cache-Control = "no-store, no-cache"/);
});

test('TabataTimer worker precaches the complete shell, serves offline and isolates caches by registration scope', async () => {
  const source = await read('sw.js');
  const names = [];
  for (const scope of ['https://example.com/TabataTimer/', 'https://example.com/tabatatimer/']) {
    const cached = new Map(), deleted = [];
    const cache = {
      async addAll(requests) { for (const request of requests) cached.set(request.url, new Response(request.url)); },
      async match(url) { return cached.get(url)?.clone(); }
    };
    const caches = { async open(name) { names.push(name); return cache; }, async keys() { return [names.at(-1), names.at(-1).replace(/v20261021-3$/, 'old'), 'pimax-practice-old', 'tabata-timer-unrelated-old']; }, async delete(name) { deleted.push(name); } };
    const { context, listeners } = worker(scope, caches);
    vm.runInContext(source, context);
    let pending;
    listeners.install({ waitUntil(value) { pending = value; } });
    await pending;
    const cacheName = names.at(-1);
    assert.equal(cacheName.startsWith('tabata-timer-'), true);
    assert.match(cacheName, /v20261021-3$/);
    assert.deepEqual([...cached.keys()].sort(), shell.map(file => new URL(file === 'index.html' ? './' : file, scope).href).sort());
    listeners.activate({ waitUntil(value) { pending = value; } });
    await pending;
    assert.deepEqual(deleted, [cacheName.replace(/v20261021-3$/, 'old')]);
    for (const file of ['', ...shell]) {
      listeners.fetch({ request: new Request(new URL(file, scope)), respondWith(value) { pending = value; } });
      const response = await pending;
      assert.equal(response.status, 200, file);
      assert.equal(await response.text(), new URL(file === '' || file === 'index.html' ? './' : file, scope).href);
    }
    for (const url of ['https://example.com/zz14/', 'https://example.com/TabataTimerSibling/', new URL('notes.txt', scope).href, 'https://other.example/TabataTimer/index.html']) {
      let intercepted = false;
      listeners.fetch({ request: new Request(url), respondWith() { intercepted = true; } });
      assert.equal(intercepted, false, url);
    }
  }
  assert.notEqual(names[0], names.at(-1));
});

test('TabataTimer preserves Korean copy and zz13 contact footer without fullscreen calls or forbidden punctuation', async () => {
  const html = await read('index.html');
  const original = await readFile(path.join(root, 'zz13', 'index.html'), 'utf8');
  const footer = original.match(/<div class="magic-settings-footer">[\s\S]*?<\/div><\/form>/)[0].replace('</form>', '');
  assert.ok(html.includes(footer));
  for (const text of ['개요', 'Android Chrome: ⋮', '앱 설치', 'iPhone Safari: 공유', '홈 화면에 추가', '준비', '운동', '일시정지', '사이클', '종료']) {
    assert.ok((html + await read('app.js')).includes(text), text);
  }
  for (const file of ['index.html', 'app.js', 'style.css', 'manifest.webmanifest', 'sw.js', 'data.js', 'install-ui.js']) {
    const source = await read(file);
    assert.doesNotMatch(source, /\b(?:requestFullscreen|webkitRequestFullscreen|webkitRequestFullScreen|mozRequestFullScreen|msRequestFullscreen)\b/, file);
    assert.doesNotMatch(source, /[\u2014~\uFF5E\u301C]/, file);
  }
  assert.match(await read('style.css'), /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});

// Run the shipped event handlers with deterministic time and platform API fakes.
class Element {
  constructor() {
    this.events={};this.attributes={};this.style={setProperty(){}};this.dataset={};this.value='';this.hidden=false;this.innerHTML='';this.textContent='';this.children=[];this.open=false;this.scrollTop=0;
    const classes=new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){if(on)classes.add(c);else classes.delete(c);}};
  }
  addEventListener(type,handler) {this.events[type]=handler;}
  replaceChildren(...children) {this.children=children;}
  append(...children) {this.children.push(...children);}
  setAttribute(key,value) {this.attributes[key]=String(value);}
  querySelector() {return this.children[0];}
  focus() {}
  showModal() {this.open=true;}
  close() {this.open=false;this.events.close?.();}
  scrollTo({top}) {this.scrollTop=top;this.events.scroll?.();}
}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const click=async el=>{await el.events.click();await settle();};
function memoryStorage(seed={}) {
  const values=new Map(Object.entries(seed).map(([key,value])=>[key,typeof value==='string'?value:JSON.stringify(value)]));
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),values};
}
async function dataLayer() {
  const context=vm.createContext({window:{}});vm.runInContext(await read('data.js'),context);return context.window.TabataData;
}
async function timerHarness({delayedWake=false,rejectWake=false,storage=memoryStorage(),blockedStorage=false}={}) {
  const nodes=new Map(),documentEvents={},locks=[],utterances=[];
  let clock=0,wakeRequests=0,unlocked=0,resolveWake;
  for(const match of (await read('index.html')).matchAll(/\bid="([^"]+)"/g))nodes.set(match[1],new Element());
  for(const id of ['run','editor','picker'])nodes.get(id).hidden=true;
  const document={visibilityState:'visible',documentElement:new Element(),getElementById:id=>nodes.get(id),createElement:()=>new Element(),addEventListener(type,handler){documentEvents[type]=handler;}};
  class AudioContext {
    constructor(){this.state='running';this.currentTime=0;this.sampleRate=44100;}
    createBuffer(){return {};}
    createBufferSource(){return {connect(){},start(){unlocked++;}};}
  }
  const navigator={wakeLock:{request:async type=>{
    assert.equal(type,'screen');wakeRequests++;
    if(delayedWake)await new Promise(resolve=>{resolveWake=resolve;});
    if(rejectWake)throw new Error('denied');
    const lock={released:false,async release(){this.released=true;},addEventListener(){}};locks.push(lock);return lock;
  }}};
  const speechSynthesis={cancel(){},speak(utterance){utterances.push(utterance);}};
  const context=vm.createContext({document,navigator,window:{AudioContext,speechSynthesis,matchMedia:()=>({matches:false})},speechSynthesis,
    SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},localStorage:storage,
    performance:{now:()=>clock},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){}});
  // Disable beeps without disabling audio unlock or speech.
  storage.setItem('tt.opts',JSON.stringify({beep:false,voice:true,vibe:false}));
  if(blockedStorage)Object.defineProperty(context,'localStorage',{get(){throw new Error('blocked site data');}});
  vm.runInContext(await read('data.js'),context);vm.runInContext(await read('app.js'),context);await settle();
  return {nodes,document,locks,utterances,storage,get wakeRequests(){return wakeRequests;},get unlocked(){return unlocked;},
    click:async id=>click(nodes.get(id)),start:async()=>click(nodes.get('timers').children[0].children[0]),
    async visibility(state){document.visibilityState=state;documentEvents.visibilitychange();await settle();},
    async advance(ms){clock+=ms;documentEvents.visibilitychange();await settle();},
    async resolveWake(){resolveWake();await settle();}
  };
}

test('TabataTimer migrates cfg and every mine entry once without removing originals, and preserves an empty saved list',async()=>{
  const D=await dataLayer();
  const cfg={prep:7,work:90,rest:30,rounds:3,cycles:2,setrest:20,cool:45};
  const mine=[{name:'아침',v:cfg},{name:'아침',v:{...cfg,work:12}}];
  const storage=memoryStorage({'tt.cfg':cfg,'tt.mine':mine,'tt.opts':{skipLast:false}});
  const timers=D.load(storage);
  assert.deepEqual(Array.from(timers,t=>t.name),['타바타','이전 타이머','아침','아침']);
  assert.equal(new Set(timers.map(t=>t.id)).size,4);
  assert.equal(timers[1].v.work,90);assert.equal(timers[1].skipLast,false);
  assert.equal(timers[1].optional.cycles,true);assert.equal(timers[1].optional.cool,true);
  assert.equal(storage.getItem('tt.cfg'),JSON.stringify(cfg));assert.equal(storage.getItem('tt.mine'),JSON.stringify(mine));
  assert.equal(JSON.stringify(D.load(storage)),JSON.stringify(timers));
  storage.setItem('tt.timers.v2','[]');assert.equal(D.load(storage).length,0);
  assert.equal(D.load(memoryStorage({'tt.cfg':'{bad','tt.mine':'broken'})).length,1);
  assert.equal(D.load(memoryStorage({'tt.cfg':{work:3600}}))[1].v.work,3600);
});

test('TabataTimer data creates, edits, duplicates and deletes independently with colour and skip-last retained',async()=>{
  const D=await dataLayer();let timers=[];
  const original=D.timer({name:'저녁',colors:{work:D.COLORS[4]},skipLast:false});
  timers=D.save(timers,original);assert.equal(timers.length,1);
  const edited=D.timer({...original,name:'저녁 운동',v:{...original.v,work:99}});
  timers=D.save(timers,edited);assert.equal(timers.length,1);assert.equal(timers[0].v.work,99);
  timers=D.duplicate(timers,original.id);assert.equal(timers.length,2);assert.notEqual(timers[0].id,timers[1].id);
  assert.equal(timers[1].colors.work,D.COLORS[4]);assert.equal(timers[1].skipLast,false);
  timers[1].v.work=3;assert.equal(timers[0].v.work,99);
  timers=D.remove(timers,original.id);assert.equal(timers.length,1);assert.equal(timers[0].name,'저녁 운동 복사');
});

test('TabataTimer skips legacy config equivalent to the default without changing legacy keys',async()=>{
  const D=await dataLayer();
  for(const cfg of [D.BUILTIN[0].v,{work:'20'},{work:20,unused:42}]){
    const storage=memoryStorage({'tt.cfg':cfg,'tt.opts':{skipLast:false},'tt.mine':[]});
    const originals=Array.from(storage.values);
    const timers=D.load(storage);
    assert.equal(timers.length,1);assert.equal(timers[0].skipLast,false);
    for(const [key,value] of originals)assert.equal(storage.getItem(key),value,key);
    assert.equal(D.load(storage).length,1);
  }
});

test('TabataTimer wheels clamp time and count boundaries; optional phases add and remove cleanly',async()=>{
  const D=await dataLayer();
  for(const [key,min,max] of [['prep',0,3600],['work',1,3600],['rest',0,3600],['setrest',0,3600],['cool',0,3600],['rounds',1,99],['cycles',1,20]]){
    assert.equal(D.clamp(key,-12),min);assert.equal(D.clamp(key,99999),max);assert.equal(D.clamp(key,NaN),min);
  }
  let draft=D.timer();assert.equal(draft.optional.cycles,false);assert.equal(draft.optional.cool,false);
  draft=D.optional(draft,'cycles',true);assert.equal(draft.v.cycles,2);assert.ok(draft.v.setrest>0);
  draft=D.optional(draft,'cool',true);assert.equal(draft.v.cool,60);
  draft=D.optional(draft,'cycles',false);assert.equal(draft.v.cycles,1);assert.equal(draft.v.setrest,0);
  draft=D.optional(draft,'cool',false);assert.equal(draft.v.cool,0);
});

test('TabataTimer wheels preserve migrated 60:00 and visibly snap to phase limits',async()=>{
  const app=await timerHarness({storage:memoryStorage({'tt.cfg':{work:3600}})}),n=app.nodes;
  await click(n.get('timers').children[1].children[1]);await click(n.get('menuActions').children[0]);
  await click(n.get('rows').children[1]);
  let [min,sec]=n.get('wheels').children.map(column=>column.children[1]);
  assert.equal(min.attributes['aria-valuemax'],'60');assert.equal(min.attributes['aria-valuenow'],'60');assert.equal(sec.attributes['aria-valuenow'],'0');
  await app.click('savePicker');await app.click('saveTimer');
  assert.equal(JSON.parse(app.storage.getItem('tt.timers.v2'))[1].v.work,3600);
  await click(n.get('timers').children[1].children[1]);await click(n.get('menuActions').children[0]);
  await click(n.get('rows').children[1]);
  [min,sec]=n.get('wheels').children.map(column=>column.children[1]);
  sec.events.keydown({key:'End',preventDefault(){}});
  assert.equal(sec.attributes['aria-valuenow'],'0');assert.equal(sec.scrollTop,0);
  min.events.keydown({key:'Home',preventDefault(){}});
  assert.equal(min.attributes['aria-valuenow'],'0');assert.equal(sec.attributes['aria-valuenow'],'1');assert.equal(sec.scrollTop,64);
  sec.scrollTop=0;sec.events.scroll();
  assert.equal(sec.attributes['aria-valuenow'],'1');assert.equal(sec.scrollTop,64);
  await app.click('savePicker');await app.click('saveTimer');
  assert.equal(JSON.parse(app.storage.getItem('tt.timers.v2'))[1].v.work,1);
});

test('TabataTimer starts and saves in memory when localStorage access or writes throw',async()=>{
  for(const blockedStorage of [true,false]){
    const storage=memoryStorage();
    const app=await timerHarness({storage,blockedStorage}),n=app.nodes;
    storage.setItem=()=>{throw new Error('storage full');};
    assert.equal(n.get('timers').children.length,1);
    await app.click('newTimer');await click(n.get('templateChoices').children[0]);
    n.get('timerName').value='메모리 타이머';await app.click('saveTimer');
    assert.equal(n.get('timers').children.length,2);assert.ok(n.get('storageNote').textContent);
    await click(n.get('timers').children[1].children[1]);await click(n.get('menuActions').children[1]);
    assert.equal(n.get('timers').children.length,3);
  }
});

test('TabataTimer shipped UI creates, cancels drafts, edits wheels, duplicates and confirms one deletion in-page',async()=>{
  const app=await timerHarness(),n=app.nodes;
  assert.equal(n.get('timers').children.length,1);
  await app.click('newTimer');await click(n.get('templateChoices').children[0]);
  n.get('timerName').value='취소할 이름';await app.click('cancelEditor');assert.equal(n.get('timers').children.length,1);
  await app.click('newTimer');await click(n.get('templateChoices').children[0]);
  n.get('timerName').value='아침';
  await click(n.get('rows').children[1]);
  const sec=n.get('wheels').children[1].children[1];
  sec.events.keydown({key:'End',preventDefault(){}});assert.equal(sec.attributes['aria-valuenow'],'59');
  await click(n.get('phaseColors').children[4]);await app.click('savePicker');await app.click('saveTimer');
  assert.equal(n.get('timers').children.length,2);
  let saved=JSON.parse(app.storage.getItem('tt.timers.v2'));assert.equal(saved[1].v.work,59);assert.equal(saved[1].colors.work,'#7d9cc0');
  const menu=async()=>click(n.get('timers').children[1].children[1]);
  await menu();await click(n.get('menuActions').children[0]);n.get('timerName').value='새 이름';await app.click('saveTimer');
  await menu();await click(n.get('menuActions').children[1]);assert.equal(n.get('timers').children.length,3);
  await menu();await click(n.get('menuActions').children[2]);assert.equal(n.get('timers').children.length,3);
  await click(n.get('menuActions').children[0]);assert.equal(n.get('timers').children.length,3);
  await menu();await click(n.get('menuActions').children[2]);await click(n.get('menuActions').children[1]);assert.equal(n.get('timers').children.length,2);
  saved=JSON.parse(app.storage.getItem('tt.timers.v2'));assert.equal(saved[1].name,'새 이름 복사');
});

test('TabataTimer idle, pause, completion and stop keep visible screen awake while monotonic timing, Korean speech and audio unlock remain intact',async()=>{
  const app=await timerHarness();assert.equal(app.wakeRequests,1);
  await app.start();assert.equal(app.unlocked,1);assert.equal(app.nodes.get('setup').hidden,true);
  assert.equal(app.utterances[0].lang,'ko-KR');assert.equal(app.utterances[0].text,'준비');
  await app.advance(10000);assert.equal(app.nodes.get('rCount').textContent,'20');
  await app.click('pauseBtn');assert.equal(app.locks[0].released,false);
  await app.advance(5000);assert.equal(app.nodes.get('rCount').textContent,'20');
  await app.click('pauseBtn');assert.equal(app.wakeRequests,1);
  await app.visibility('hidden');assert.equal(app.locks[0].released,true);
  await app.visibility('visible');assert.equal(app.wakeRequests,2);
  await app.advance(225000);assert.equal(app.nodes.get('rCount').textContent,'5');
  await app.advance(5000);assert.equal(app.nodes.get('pauseBtn').textContent,'다시 시작');assert.equal(app.locks[1].released,false);
  assert.equal(app.utterances.at(-1).text,'완료');await app.click('stopBtn');assert.equal(app.locks[1].released,false);
});

test('TabataTimer releases late hidden wake locks, requests again when visible and tolerates rejection',async()=>{
  const app=await timerHarness({delayedWake:true});await app.visibility('hidden');await app.resolveWake();assert.equal(app.locks[0].released,true);
  await app.visibility('visible');assert.equal(app.wakeRequests,2);await app.resolveWake();assert.equal(app.locks[1].released,false);
  const rejected=await timerHarness({rejectWake:true});assert.equal(rejected.wakeRequests,1);await rejected.start();assert.equal(rejected.nodes.get('run').hidden,false);
});

async function installHarness({storage=memoryStorage(),standalone=false,ios=false}={}){
  const nodes=new Map(),events={};
  for(const id of ['installSheet','installHelp','openInstall','settings','installApp','installLater'])nodes.set(id,new Element());
  const mode={matches:standalone,addEventListener(type,handler){events.mode=handler;}};
  const context=vm.createContext({document:{getElementById:id=>nodes.get(id)},window:{matchMedia:()=>mode,addEventListener(type,handler){events[type]=handler;}},navigator:{userAgent:ios?'iPhone':'Android'},localStorage:storage});
  vm.runInContext(await read('install-ui.js'),context);return {nodes,events,mode};
}

test('TabataTimer install sheet appears once, remembers dismissal, offers iPhone steps and stays closed standalone',async()=>{
  const storage=memoryStorage(),first=await installHarness({storage,ios:true});
  assert.equal(first.nodes.get('installSheet').open,true);assert.match(first.nodes.get('installHelp').textContent,/Safari.*공유 → 홈 화면에 추가/);
  await click(first.nodes.get('installLater'));assert.equal(storage.getItem('tt.install.dismissed'),'1');
  const again=await installHarness({storage});assert.equal(again.nodes.get('installSheet').open,false);
  await click(again.nodes.get('openInstall'));assert.equal(again.nodes.get('installSheet').open,true);
  const installed=await installHarness({standalone:true});assert.equal(installed.nodes.get('installSheet').open,false);assert.equal(installed.nodes.get('openInstall').hidden,true);
});

test('TabataTimer installation invokes captured native prompt only on click and responds to standalone changes',async()=>{
  const app=await installHarness();let prompts=0,prevented=0;
  app.events.beforeinstallprompt({preventDefault(){prevented++;},async prompt(){prompts++;},userChoice:Promise.resolve({outcome:'accepted'})});
  assert.equal(prevented,1);assert.equal(prompts,0);await click(app.nodes.get('installApp'));assert.equal(prompts,1);assert.equal(app.nodes.get('installSheet').open,false);
  app.events.appinstalled();assert.equal(app.nodes.get('openInstall').hidden,true);
  const changed=await installHarness();changed.mode.matches=true;changed.events.mode();assert.equal(changed.nodes.get('installSheet').open,false);
});

for(const route of ['zz12','zz14'])test(`${route} visible wake lock requests idle, releases hidden, retries visible, handles pending and rejected requests`,async()=>{
  const source=await readFile(path.join(root,route,'app.mjs'),'utf8');
  const start=source.indexOf('function keepVisibleScreenAwake()');
  const code=source.slice(start,source.indexOf('keepVisibleScreenAwake();',start)+'keepVisibleScreenAwake();'.length);
  assert.ok(start>=0);
  const events={},locks=[];let requests=0,resolveRequest,reject=false;
  const document={visibilityState:'visible',addEventListener(type,handler){events[type]=handler;}};
  const navigator={wakeLock:{request:async()=>{
    requests++;if(reject)throw new Error('denied');
    await new Promise(resolve=>{resolveRequest=resolve;});
    const lock={released:false,async release(){this.released=true;},addEventListener(){}};locks.push(lock);return lock;
  }}};
  vm.runInNewContext(code,{document,navigator});assert.equal(requests,1);
  document.visibilityState='hidden';events.visibilitychange();resolveRequest();await settle();assert.equal(locks[0].released,true);
  document.visibilityState='visible';events.visibilitychange();assert.equal(requests,2);resolveRequest();await settle();assert.equal(locks[1].released,false);
  document.visibilityState='hidden';events.visibilitychange();assert.equal(locks[1].released,true);
  reject=true;document.visibilityState='visible';events.visibilitychange();await settle();assert.equal(requests,3);
  vm.runInNewContext(code,{});
});

test('zz12 and zz14 runtime and service-worker mirrors match their sibling sources including cache bumps',async()=>{
  for(const [source,mirror] of MIRROR_PAIRS.filter(([,mirror])=>/^zz(?:12|14)\/(?:app.mjs|sw.js)$/.test(mirror))){
    const original=await readFile(path.join(root,source),'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
    if(original===null)continue;
    const copy=await readFile(path.join(root,mirror),'utf8');
    assert.equal(mirror==='zz14/app.mjs'?preparePimaxRuntime(copy):copy,mirror==='zz14/app.mjs'?preparePimaxRuntime(original):original,mirror);
    if(mirror.endsWith('sw.js'))assert.match(copy,/v20261021-wake-1/);
  }
});
