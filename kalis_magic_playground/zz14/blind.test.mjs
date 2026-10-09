import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as core from '/Users/sumpie/Desktop/AI/Projects/magic-pimax/core.mjs';

function load(initial={}) {
  const values=new Map(Object.entries(initial)),writes=[];
  const app={innerHTML:'',setAttribute(){},removeAttribute(){}}, notice={textContent:''};
  const document={body:{dataset:{},addEventListener(){}},querySelector:selector=>selector==='#app'?app:selector==='#notice'?notice:null,querySelectorAll:()=>[]};
  const context=vm.createContext({__core:core,document,localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>{writes.push([key,value]);values.set(key,value);}},Date,Math,JSON,HTMLFormElement:class{},HTMLInputElement:class{}});
  const source=readFileSync('/Users/sumpie/Desktop/AI/Projects/magic-pimax/app.mjs','utf8').replace(/^import\s+\{([\s\S]*?)\}\s+from "\.\/core\.mjs";/,'const {$1}=globalThis.__core;');
  vm.runInContext(source+'\nglobalThis.review={state,current,checkCurrent,useHint,useReveal,goNext,startSession,startWeakReview,postSession,saveSession,render,onClick,toggleWeak};',context);
  return {...context.review,app,notice,values,writes};
}

function click(env, action, extra) {
 env.onClick({target:{closest:()=>({disabled:false,dataset:{action, ...extra}})}});
}
test('all six modes use repeat-tap reveal and advance without direct credit',()=>{
 for (const mode of core.MODES) {
  const env=load(); env.startSession(mode,{force:true});
  assert(!env.app.innerHTML.includes('입력 연습'),mode);
  assert(!env.app.innerHTML.includes('단서'),mode);
  assert(!env.app.innerHTML.includes('id="answer"'),mode);
  assert(env.app.innerHTML.includes('탭해서 답 확인'),mode);
  const answer=core.canonicalAnswerText(env.current()).replaceAll('|',' / ');
  click(env,'tap');
  assert(env.app.innerHTML.includes(answer),mode);
  const button=env.app.innerHTML.match(/data-action="tap"[^>]*>/)?.[0]||'';
  assert(!button.includes('disabled'),mode);
  click(env,'tap');env.postSession(env.state.session);
  assert.equal(env.state.stats.totals.direct,0,mode);
  assert.equal(env.state.stats.totals.revealed,1,mode);
 }
});
test('weak marking toggles before reveal and survives reload for every question type',()=>{
 for (const mode of core.MODES) {
 const env=load();env.startSession(mode,{force:true});
 if (mode === 'lie' || mode === 'birthday' || mode === 'odd') click(env,'tap');
 click(env,'weak-toggle');env.saveSession();
 const restored=load(Object.fromEntries(env.values));
 assert.equal(restored.state.stats.weak.length,1,mode);
 assert.match(restored.app.innerHTML, /data-action="weak-toggle"[^>]*aria-pressed="true"[^>]*>약점</, mode);
 assert.equal(restored.app.innerHTML.includes('약점 표시됨'), false, mode);
 restored.startWeakReview();
 assert.equal(restored.state.session.mode,'review',mode);
 assert.equal(restored.current().key,env.current().key,mode);
 }
});
test('revealing without a weak mark never creates a weak record or direct grade',()=>{
 const env=load();env.startSession('birthday',{force:true});click(env,'tap');click(env,'tap');
 env.postSession(env.state.session);
 assert.equal(env.state.stats.weak.length,0);
 assert.equal(env.state.stats.totals.direct,0);
 assert.equal(env.state.stats.totals.revealed,1);
});
test('second tap on the final question finishes the session',()=>{
 const env=load();env.startSession('map',{force:true});
 env.state.session.questions=env.state.session.questions.slice(0,1);
 env.state.session.count=1;
 click(env,'tap');
 const enabledAnswer=env.app.innerHTML.match(/<button[^>]*data-action="tap"[^>]*>/)?.[0]||'';
 assert(!enabledAnswer.includes('disabled'));
 click(env,'tap');
 assert.equal(env.state.session.finished,true);
 assert.equal(env.state.stats.totals.direct,0);
 assert.equal(env.state.stats.totals.revealed,1);
});
test('legacy input setting migrates to tap and corrupt settings are not rewritten',()=>{
 assert(core.validateSettings({version:1,count:10,phonetic:true,mapPool:'all'}));
 assert(!core.validateSettings({...core.defaultSettings(),practiceStyle:'unknown'}));
 const old={version:1,count:10,phonetic:true,mapPool:'all',practiceStyle:'input'};
 const env=load({'pimax-practice-settings':JSON.stringify(old)});
 assert.equal(env.state.settings.practiceStyle,'tap');
 const bad=load({'pimax-practice-settings':'broken'});
 assert.equal(bad.writes.some(([key])=>key==='pimax-practice-settings'),false);
 assert.equal(bad.values.get('pimax-practice-settings'),'broken');
});
test('single weak selector keeps the current quiz stable and persists repeated taps', () => {
 const index = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
 assert.equal(index.includes('data-tab="record"'), false);
 assert.match(index, /data-tab="learn"/);
 assert.match(index, /data-tab="practice"/);
 assert.match(index, /data-tab="settings"/);

 const env = load();
 env.startSession('row', { force: true });
 const session = env.state.session;
 const live = env.current();
 const hidden = core.canonicalAnswerText(live);
 assert.equal(env.app.innerHTML.includes(hidden), false);
 assert.match(env.app.innerHTML, /data-action="tap"[^>]*>\?<\/button>/);
 assert.equal((env.app.innerHTML.match(/data-action="map-pool"/g) || []).length, 2);
 assert.equal((env.app.innerHTML.match(/약한 것/g) || []).length, 1);
 assert.equal(env.app.innerHTML.includes('약한 대응'), false);
 assert.equal(env.app.innerHTML.includes('약한 것만'), false);
 assert.equal(env.app.innerHTML.includes('data-action="weak-review"'), false);
 assert.match(env.app.innerHTML, /data-action="weak-toggle"[^>]*aria-pressed="false"[^>]*>약점</);
 for (const label of ['대응', '줄 회상', '홀수 쪽', '다음 10', '생일', '거짓말']) {
  assert.equal(env.app.innerHTML.includes(label), true, label);
 }

 click(env, 'map-pool', { pool: 'weak' });
 assert.equal(env.state.session, session);
 assert.equal(env.current(), live);
 assert.equal(env.state.settings.mapPool, 'weak');
 assert.equal(env.notice.textContent, '약한 것이 없습니다.');

 click(env, 'weak-toggle');
 assert.equal(env.current(), live);
 assert.equal(env.state.stats.weak.length, 1);
 assert.notEqual(env.state.stats.weak[0].question, live);
 assert.notEqual(env.state.stats.weak[0].question.answer, live.answer);
 const restored = load(Object.fromEntries(env.values));
 assert.equal(restored.state.settings.mapPool, 'weak');
 assert.equal(restored.state.stats.weak.length, 1);
 assert.match(restored.app.innerHTML, /data-action="weak-toggle"[^>]*aria-pressed="true"[^>]*>약점</);

 click(restored, 'map-pool', { pool: 'weak' });
 assert.equal(restored.state.session.mode, 'review');
 assert.equal(restored.current().key, live.key);
 const snap = restored.current();
 const snapAnswer = snap.answer;
 const snapJson = JSON.stringify(snap);
 click(restored, 'weak-toggle');
 assert.equal(restored.current(), snap);
 assert.equal(snap.answer, snapAnswer);
 assert.equal(JSON.stringify(snap), snapJson);
 assert.equal(restored.state.session.questions[0], snap);
 assert.equal(restored.state.stats.weak.length, 0);
 click(restored, 'new-session');
 assert.equal(restored.state.session.questions[0], snap);

 const again = load();
 again.startSession('map', { force: true });
 const first = again.current();
 const face = again.app.innerHTML.match(/data-action="tap"[^>]*>([^<]*)</);
 assert.equal(face?.[1], '?');
 assert.equal(face[1].includes(core.canonicalAnswerText(first)), false);
 click(again, 'tap');
 assert.equal(again.current(), first);
 assert.equal(first.usedReveal, true);
 assert.match(again.app.innerHTML, /data-action="weak-toggle"[^>]*>약점</);
 click(again, 'tap');
 assert.notEqual(again.current(), first);
 assert.equal(again.current().usedReveal, false);

 again.state.tab = 'settings';
 again.render();
 assert.equal((again.app.innerHTML.match(/data-action="map-pool"/g) || []).length, 0);
 assert.equal(again.app.innerHTML.includes('약한 대응'), false);
 assert.equal(again.app.innerHTML.includes('기록 탭'), false);
 assert.equal(again.app.innerHTML.includes('기록으로'), false);
 assert.match(again.app.innerHTML, /발음/);
 assert.match(again.app.innerHTML, /기록 지우기/);
 const kept = again.current().key;
 again.state.stats.totals.sessions = 4;
 click(again, 'reset-ask');
 assert.equal(again.state.confirmReset, true);
 assert.equal(again.state.stats.totals.sessions, 4);
 assert.equal(again.state.tab, 'settings');
 click(again, 'reset-no');
 assert.equal(again.state.confirmReset, false);
 assert.equal(again.state.stats.totals.sessions, 4);
 click(again, 'reset-ask');
 click(again, 'reset-yes');
 assert.equal(again.state.stats.totals.sessions, 0);
 assert.equal(again.current().key, kept);

 again.state.tab = 'learn';
 again.render();
 assert.equal(again.app.innerHTML.includes('data-action="mode"'), false);
 assert.match(again.app.innerHTML, /홀수 쪽/);
 assert.match(again.app.innerHTML, /생일 주소/);
});
