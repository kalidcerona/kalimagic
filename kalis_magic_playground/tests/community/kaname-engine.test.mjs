// KANAME Cue engine: ported from the Android CueEngineTest/AudioPolicyTest so both apps keep one behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as E from '../../KanameCue/engine.mjs';

class Clock {
  constructor() { this.time = 0; this.tasks = []; this.serial = 0; }
  now() { return this.time; }
  schedule(delay, action) {
    const task = { at: this.time + delay, order: this.serial++, action, cancelled: false };
    this.tasks.push(task);
    return { cancel: () => { task.cancelled = true; } };
  }
  advance(ms) {
    const end = this.time + ms;
    for (;;) {
      const next = this.tasks.filter(t => !t.cancelled && t.at <= end).sort((a, b) => a.at - b.at || a.order - b.order)[0];
      if (!next) break;
      this.tasks.splice(this.tasks.indexOf(next), 1);
      this.time = next.at; next.action();
    }
    this.time = end;
  }
}
class Audio {
  constructor() { this.played = []; this.done = new Map(); this.fades = []; this.fail = false; this.paused = 0; this.resumed = 0; }
  play(cue, finished, failed) { if (this.fail) { failed('missing file'); return; } this.played.push(cue.id); this.done.set(cue.id, finished); }
  finish(id) { const f = this.done.get(id); this.done.delete(id); f?.(); }
  fade(id, volume, ms, stop) { this.fades.push({ id, volume, ms, stop }); }
  pauseAll() { this.paused++; }
  resumeAll() { this.resumed++; }
}
function rig(show, saved) {
  const clock = new Clock(), audio = new Audio(), events = [], savedStates = [];
  const engine = new E.CueEngine(show, audio, clock, saved, s => savedStates.push(s), e => events.push(e));
  engine.setMode(E.MODE.RUN);
  return { clock, audio, events, savedStates, engine, go() { engine.go(); clock.advance(400); } };
}
const a = (id, trigger = 'MANUAL', delay = 0) => E.makeCue({ id, name: id, trigger, delayMs: delay, audioFileId: id });
const show = values => E.makeShow(values);
const errors = r => r.events.filter(e => e.type === 'Error');

test('GO order and pointer moves', () => {
  const r = rig(show({ cues: [a('a'), a('b')] }));
  r.go(); assert.deepEqual(r.audio.played, ['a']); assert.equal(r.engine.position.index, 1);
  r.go(); assert.deepEqual(r.audio.played, ['a', 'b']); assert.equal(r.engine.standby(), null);
});

test('trigger chains: WITH_PREVIOUS fires the chain with its own delays, AFTER_PREVIOUS waits for audio completion', () => {
  const r = rig(show({ cues: [a('a', 'MANUAL', 100), a('b', 'WITH_PREVIOUS', 50), a('c', 'WITH_PREVIOUS', 150), a('d')] }));
  r.engine.go(); assert.equal(r.engine.position.index, 3);
  r.clock.advance(50); assert.deepEqual(r.audio.played, ['b']);
  r.clock.advance(50); assert.deepEqual(r.audio.played, ['b', 'a']);
  r.clock.advance(50); assert.deepEqual(r.audio.played, ['b', 'a', 'c']);
  const after = rig(show({ cues: [a('a'), a('b', 'AFTER_PREVIOUS', 80), a('c')] }));
  after.go(); assert.deepEqual(after.audio.played, ['a']);
  after.audio.finish('a'); after.clock.advance(79); assert.deepEqual(after.audio.played, ['a']);
  after.clock.advance(1); assert.deepEqual(after.audio.played, ['a', 'b']); assert.equal(after.engine.position.index, 2);
  const stop = rig(show({ cues: [E.makeCue({ id: 'stop', type: 'STOP' }), a('follow', 'AFTER_PREVIOUS')] }));
  stop.go(); assert.deepEqual(stop.audio.played, ['follow']);
});

test('long WITH_PREVIOUS chain fires every cue without errors', () => {
  const cues = Array.from({ length: 1000 }, (_, i) => a('cue' + i, i === 0 ? 'MANUAL' : 'WITH_PREVIOUS'));
  const r = rig(show({ cues }));
  r.go();
  assert.deepEqual(r.audio.played, cues.map(c => c.id));
  assert.deepEqual(r.engine.position, E.position('main', 1000));
  assert.equal(errors(r).length, 0);
});

test('goto: pointer only, run now, cycle guard, long acyclic chain, HIT goto stays in the HIT list', () => {
  const only = rig(show({ cues: [E.makeCue({ type: 'GOTO', target: 'c' }), a('b'), a('c')] }));
  only.go(); assert.equal(only.engine.position.index, 2); assert.deepEqual(only.audio.played, []);
  const now = rig(show({ cues: [E.makeCue({ type: 'GOTO', target: 'b', runNow: true }), a('b'), a('c')] }));
  now.go(); assert.equal(now.engine.position.index, 2); assert.deepEqual(now.audio.played, ['b']);
  const cycle = rig(show({ cues: [E.makeCue({ id: 'loop', type: 'GOTO', target: 'loop', runNow: true })] }));
  cycle.go(); assert.ok(errors(cycle).length > 0);
  const chain = Array.from({ length: 140 }, (_, i) => E.makeCue({ id: 'goto' + i, type: 'GOTO', target: i === 139 ? 'end' : 'goto' + (i + 1), runNow: true }));
  const long = rig(show({ cues: [...chain, a('end')] }));
  long.go(); assert.deepEqual(long.audio.played, ['end']); assert.equal(errors(long).length, 0);
  const hit = rig(show({ cues: [a('main')], hits: [E.makeCue({ id: 'jump', type: 'GOTO', target: 'hit', runNow: true }), a('hit')] }));
  const before = hit.engine.snapshot(); hit.engine.hit(0);
  assert.deepEqual(hit.engine.snapshot(), before); assert.deepEqual(hit.audio.played, ['hit']);
});

test('back moves one manual cue without firing; debounce rejects without moving the pointer', () => {
  const r = rig(show({ cues: [a('a'), a('b', 'WITH_PREVIOUS'), a('c')] }));
  r.go(); r.engine.back(); assert.equal(r.engine.position.index, 0); assert.deepEqual(r.audio.played, ['a', 'b']);
  const d = rig(show({ cues: [a('a'), a('b')] }));
  assert.equal(d.engine.go(), true); assert.equal(d.engine.go(), false); assert.equal(d.engine.position.index, 1);
  d.clock.advance(399); assert.equal(d.engine.go(), false); d.clock.advance(1); assert.equal(d.engine.go(), true);
  assert.equal(d.events.filter(e => e.type === 'Rejected').length, 2);
});

test('PANIC clears pending cues, blocks AFTER_PREVIOUS follow-ups and keeps the pointer', () => {
  const r = rig(show({ cues: [a('a'), a('b', 'AFTER_PREVIOUS'), a('c', 'WITH_PREVIOUS', 1000), a('d')] }));
  r.engine.go(); r.audio.finish('a');
  assert.deepEqual(r.audio.played, ['a', 'b']); assert.equal(r.engine.pendingCount, 1);
  const pos = r.engine.position;
  r.engine.panic(); r.audio.finish('b'); r.clock.advance(2000);
  assert.deepEqual(r.audio.played, ['a', 'b']); assert.deepEqual(r.engine.position, pos); assert.equal(r.engine.pendingCount, 0);
  assert.equal(r.audio.fades.length, 1); assert.equal(r.audio.fades[0].ms, 300); assert.equal(r.audio.fades[0].stop, true);
  const p = rig(show({ cues: [a('a'), a('b', 'AFTER_PREVIOUS')] }));
  p.engine.go(); p.engine.panic(); p.audio.finish('a'); p.clock.advance(2000);
  assert.deepEqual(p.audio.played, ['a']); assert.equal(p.engine.pendingCount, 0);
  const delayed = rig(show({ cues: [a('a', 'MANUAL', 500), a('b')] }));
  delayed.engine.go(); delayed.engine.panic(); delayed.clock.advance(1000);
  assert.deepEqual(delayed.audio.played, []); assert.equal(delayed.engine.position.index, 1);
});

test('stop ramp rule: STOP and PANIC with fade 0 still ramp 20 ms; STOP honours the cue fade out; FADE keeps its time', () => {
  assert.equal(E.MIN_STOP_RAMP_MS, 20);
  assert.equal(E.stopRampMs(0), 20); assert.equal(E.stopRampMs(5), 20); assert.equal(E.stopRampMs(20), 20); assert.equal(E.stopRampMs(300), 300);
  const zero = rig(show({ cues: [a('a'), E.makeCue({ type: 'STOP', fadeMs: 0 })] }));
  zero.go(); zero.go(); assert.deepEqual(zero.audio.fades, [{ id: 'a', volume: 0, ms: 20, stop: true }]);
  const panic = rig(show({ cues: [a('a')], settings: E.makeSettings({ panicFadeMs: 0 }) }));
  panic.go(); panic.engine.panic(); assert.deepEqual(panic.audio.fades, [{ id: 'a', volume: 0, ms: 20, stop: true }]);
  const r = rig(show({ cues: [{ ...a('a'), fadeOutMs: 700 }, a('b', 'WITH_PREVIOUS'), E.makeCue({ type: 'STOP', target: 'a', fadeMs: 100 }), E.makeCue({ type: 'STOP', fadeMs: 200 })] }));
  r.go(); r.go(); assert.deepEqual(r.audio.fades, [{ id: 'a', volume: 0, ms: 700, stop: true }]);
  r.go(); assert.deepEqual(r.audio.fades.slice(1), [{ id: 'a', volume: 0, ms: 700, stop: true }, { id: 'b', volume: 0, ms: 200, stop: true }]);
  const f = rig(show({ cues: [a('a'), a('b', 'WITH_PREVIOUS'), E.makeCue({ type: 'FADE', target: 'a', targetVolume: 0.4, durationMs: 500 }), E.makeCue({ type: 'FADE', target: 'ALL', targetVolume: 0.1, stopAtEnd: true, durationMs: 0 })] }));
  f.go(); f.go(); assert.deepEqual(f.audio.fades, [{ id: 'a', volume: 0.4, ms: 500, stop: false }]);
  f.go(); assert.deepEqual(f.audio.fades.slice(1).map(x => [x.id, x.ms, x.stop]), [['a', 20, true], ['b', 20, true]]);
});

test('inserts return to the saved position, including nested and delayed tails, and PANIC returns from cancelled tails', () => {
  const x = E.makeSideList({ id: 'x', name: 'x', cues: [a('x1'), a('x2')] });
  const y = E.makeSideList({ id: 'y', name: 'y', cues: [a('y1')] });
  const r = rig(show({ cues: [a('a'), a('b')], inserts: [x, y] }));
  r.go(); r.engine.insert('x'); r.go(); r.engine.insert('y'); r.go();
  assert.deepEqual(r.engine.position, E.position('x', 1)); r.go(); assert.deepEqual(r.engine.position, E.position('main', 1));
  const side = E.makeSideList({ id: 'side', name: 'side', cues: [a('s'), a('last', 'AFTER_PREVIOUS', 100)] });
  const w = rig(show({ cues: [a('main')], inserts: [side] }));
  w.engine.insert('side'); w.go(); assert.deepEqual(w.engine.position, E.position('side', 2));
  w.audio.finish('s'); w.clock.advance(99); assert.equal(w.engine.position.listId, 'side');
  w.clock.advance(1); assert.deepEqual(w.engine.position, E.position());
  const tail = E.makeSideList({ id: 'side', name: '삽입', cues: [a('tail', 'MANUAL', 1000)] });
  const p = rig(show({ cues: [a('first'), a('next')], inserts: [tail] }));
  p.go(); p.engine.insert('side'); p.engine.go();
  assert.deepEqual(p.engine.position, E.position('side', 1));
  p.engine.panic();
  assert.deepEqual(p.engine.position, E.position('main', 1)); assert.deepEqual(p.engine.insertStack, []);
  assert.deepEqual(p.savedStates.at(-1), p.engine.snapshot());
  p.clock.advance(1000); assert.equal(p.engine.go(), true); assert.deepEqual(p.audio.played, ['first', 'next']);
});

test('HIT does not move the pointer or the insert stack; missing targets and audio errors do not desync', () => {
  const side = E.makeSideList({ id: 'side', name: 'side', cues: [a('s')] });
  const r = rig(show({ cues: [a('a')], hits: [a('hit')], inserts: [side] }));
  r.engine.insert('side'); const before = r.engine.snapshot(); r.engine.hit(0);
  assert.deepEqual(r.engine.snapshot(), before); assert.deepEqual(r.audio.played, ['hit']);
  const m = rig(show({ cues: [E.makeCue({ type: 'STOP', target: 'missing' }), E.makeCue({ type: 'FADE', target: 'missing' }), E.makeCue({ type: 'GOTO', target: 'missing' }), a('bad')] }));
  m.go(); m.go(); m.go(); m.audio.fail = true; m.go();
  assert.equal(errors(m).length, 4); assert.equal(m.engine.position.index, 4); assert.equal(m.engine.active.size, 0);
});

test('output-loss state machine: pause active cues, drop delayed ones, GO resumes without advancing, PANIC clears the pause', () => {
  const r = rig(show({ cues: [a('a'), a('b', 'WITH_PREVIOUS', 5000), a('c')] }));
  assert.equal(r.engine.outputLost(), false, 'nothing playing yet');
  r.engine.go();
  assert.equal(r.engine.pendingCount, 1);
  assert.equal(r.engine.outputLost(), true);
  assert.equal(r.engine.paused, true); assert.equal(r.engine.droppedOnLoss, 1); assert.equal(r.engine.pendingCount, 0); assert.equal(r.audio.paused, 1);
  assert.equal(r.engine.outputLost(), false, 'already paused');
  r.clock.advance(6000); assert.deepEqual(r.audio.played, ['a'], 'dropped cue never plays on the fallback speaker');
  const pos = r.engine.position;
  r.engine.hit(0); assert.equal(r.events.at(-1).type, 'Rejected', 'HIT is refused while paused');
  assert.equal(r.engine.go(), true); assert.equal(r.engine.paused, false); assert.equal(r.audio.resumed, 1);
  assert.deepEqual(r.engine.position, pos, 'GO resumed instead of advancing');
  r.clock.advance(400); r.engine.go(); assert.deepEqual(r.audio.played, ['a', 'c']);
  const p = rig(show({ cues: [a('a')] }));
  p.go(); p.engine.outputLost(); p.engine.panic(); assert.equal(p.engine.paused, false); assert.equal(p.audio.fades.at(-1).stop, true);
  const edit = rig(show({ cues: [a('a')] })); edit.go(); edit.engine.setMode(E.MODE.EDIT); assert.equal(edit.engine.outputLost(), false);
});

test('output detection, loss gate and context decisions translate the Android policy to the web', () => {
  const out = (id, group = 'g' + id) => ({ kind: 'audiooutput', deviceId: id, groupId: group });
  const mic = { kind: 'audioinput', deviceId: 'mic', groupId: 'm' };
  assert.equal(E.outputsLost([out('default'), out('bt')], [out('default')]), true, 'removed output');
  assert.equal(E.outputsLost([out('default')], [out('default'), out('bt')]), false, 'added output');
  assert.equal(E.outputsLost([out('default'), out('bt')], [out('default'), out('bt'), mic]), false, 'input change only');
  assert.equal(E.outputsLost([out('default'), out('bt')], [out('default'), out('usb')]), true, 'swapped output');
  assert.equal(E.outputsLost([out('')], [out('')]), true, 'hidden ids: treat any change as a possible loss');
  let now = 0;
  const gate = new E.OutputLossGate(() => now);
  assert.equal(gate.accept(), true); now = 1000; assert.equal(gate.accept(), false); now = 1500; assert.equal(gate.accept(), true);
  assert.equal(E.contextDecision('interrupted', false), 'LOST');
  assert.equal(E.contextDecision('suspended', false), 'LOST');
  assert.equal(E.contextDecision('suspended', true), 'IGNORE');
  assert.equal(E.contextDecision('running', false), 'RUNNING');
  assert.equal(E.visibilityDecision(), 'IGNORE');
});

test('timing log measures handler to source.start and keeps a bounded history', () => {
  let now = 100;
  const t = new E.GoTimer(() => now, 3);
  t.start('GO', 4); now = 101.5;
  const entry = t.started('a', { outputLatency: 0.025, baseLatency: 0.005 });
  assert.deepEqual(entry, { label: 'GO', cue: 'a', handlerMs: 1.5, eventAgeMs: 4, outputLatencyMs: 25, baseLatencyMs: 5 });
  assert.equal(t.started('chain'), null, 'only the first start after GO is timed');
  assert.match(E.describeTiming(entry), /^GO 5\.5ms \(출력 25ms, 기본 5ms\)$/);
  for (let i = 0; i < 5; i++) { t.start('HIT'); t.started('x'); }
  assert.equal(t.history.length, 3);
});

test('fade curves start and end exactly; equal power stays above linear in the middle of a fade out', () => {
  const lin = E.fadeCurve(1, 0, 5), eq = E.fadeCurve(1, 0, 5, 'equal');
  assert.equal(lin[0], 1); assert.equal(lin[4], 0); assert.equal(eq[0], 1); assert.equal(eq[4], 0);
  assert.ok(eq[2] > lin[2]);
  assert.ok(Math.abs(eq[2] - Math.SQRT1_2) < 1e-6);
});

test('keys: Android key codes stay in the JSON, web keys map to them, defaults match the Android app plus Esc', () => {
  const code = (c, key = '') => E.androidKeyCode({ code: c, key });
  assert.equal(code('PageDown'), 93); assert.equal(code('PageUp'), 92); assert.equal(code('Space'), 62); assert.equal(code('Enter'), 66);
  assert.equal(code('ArrowRight'), 22); assert.equal(code('ArrowLeft'), 21); assert.equal(code('KeyB'), 30); assert.equal(code('Digit0'), 7);
  assert.equal(code('', 'PageDown'), 93, 'clickers that send only key');
  assert.equal(code('Unidentified'), null);
  for (const c of ['Space', 'Enter', 'PageDown', 'ArrowRight']) assert.equal(E.defaultAction(code(c)), 'GO', c);
  for (const c of ['PageUp', 'ArrowLeft']) assert.equal(E.defaultAction(code(c)), 'BACK', c);
  assert.equal(E.defaultAction(code('Escape')), 'PANIC');
  const s = show({ keyMap: { 30: 'GO', 93: 'BACK' } });
  assert.equal(E.keyAction(s, 30), 'GO'); assert.equal(E.keyAction(s, 93), 'BACK', 'learned key overrides the default');
  assert.equal(E.keyAction(s, 66), 'GO'); assert.equal(E.keyAction(s, null), null);
  assert.deepEqual(E.VOLUME_KEYS, [24, 25, 164]);
  assert.equal(code('AudioVolumeUp'), 24);
});

test('show JSON round-trip and validation match the Android rules', () => {
  const s = show({
    cues: [{ ...a('a'), endMs: 3000, loop: 'COUNT', loopCount: 3 }],
    hits: [a('hit')], inserts: [E.makeSideList({ name: '삽입', cues: [E.makeCue({ type: 'FADE', targetVolume: 0.3, stopAtEnd: true })] })],
    keyMap: { 93: 'GO' }, audioFiles: [E.makeAudioFile({ id: 'a', displayName: '음악.mp3' }), E.makeAudioFile({ id: 'hit', displayName: 'hit.wav' })]
  });
  assert.deepEqual(E.importShowBackup(E.exportShowBackup(s)), s);
  assert.match(E.exportShowBackup(s), /^\{\n {4}"id"/, 'four-space pretty print like kotlinx');
  assert.throws(() => E.validateShow(show({ cues: [{ ...a('a'), volume: 2 }], audioFiles: [E.makeAudioFile({ id: 'a' })] })), /잘못된 음량/);
  assert.throws(() => E.validateShow(show({ cues: [a('a'), a('a')] })), /중복된 큐 ID/);
  const file = E.makeAudioFile({ id: 'audio', displayName: '음악.mp3' });
  assert.throws(() => E.validateShow(show({ audioFiles: [file, file] })), /중복된 오디오 ID/);
  for (const id of ['', ' ', 'unknown']) assert.throws(() => E.validateShow(show({ cues: [{ ...a('cue'), audioFileId: id }], audioFiles: [file] })), /오디오 참조/);
  for (const type of ['GOTO', 'FADE', 'STOP']) for (const target of ['', 'missing']) {
    const message = type === 'GOTO' ? /이동할 큐/ : /오디오 대상 큐/;
    const cue = E.makeCue({ id: 'invalid', type, target });
    assert.throws(() => E.validateShow(show({ cues: [cue] })), message);
    assert.throws(() => E.validateShow(show({ hits: [cue] })), message);
    assert.throws(() => E.validateShow(show({ inserts: [E.makeSideList({ cues: [cue] })] })), message);
  }
  const side = E.makeSideList({ id: 'side', cues: [E.makeCue({ type: 'STOP' })] });
  const base = show({ hits: [E.makeCue({ type: 'STOP' })], inserts: [side] });
  for (const action of ['', 'UNKNOWN', 'HIT:-1', 'HIT:9', 'HIT:1', 'HIT:abc', 'INSERT:', 'INSERT:missing']) {
    assert.throws(() => E.validateShow({ ...base, keyMap: { 93: action } }), /사용할 수 없는 키 동작/, action);
  }
  for (const key of [0, -1, 24, 25, 164]) assert.throws(() => E.validateShow({ ...base, keyMap: { [key]: 'GO' } }), /사용할 수 없는 키 동작/);
  const exportError = (() => { try { E.exportShowBackup(show({ cues: [E.makeCue({ type: 'GOTO' })] })); } catch (e) { return e.message; } })();
  assert.match(exportError, /이동할 큐가 없습니다/);
  assert.throws(() => E.importShowBackup('{bad'), /JSON을 읽을 수 없습니다/);
});

test('editing repairs dependent controls and remaps HIT keys like the Android app', () => {
  const audio = a('audio');
  const stop = E.makeCue({ id: 'stop', type: 'STOP', target: 'audio' });
  const jump = E.makeCue({ id: 'jump', type: 'GOTO', target: 'stop' });
  const s = show({ cues: [audio, stop, jump], hits: [E.makeCue({ id: 'fade', type: 'FADE', target: 'audio' })],
    inserts: [E.makeSideList({ id: 'side', name: '삽입', cues: [{ ...stop, id: 'sideStop' }] })], keyMap: { 93: 'HIT:0', 92: 'INSERT:side' },
    audioFiles: [E.makeAudioFile({ id: 'audio', displayName: '음악' })] });
  const repaired = E.repairShowReferences(s, { ...s, cues: [stop, jump] });
  assert.deepEqual(repaired.cues, []); assert.deepEqual(repaired.hits, []); assert.deepEqual(repaired.inserts[0].cues, []); assert.deepEqual(repaired.keyMap, {});
  assert.deepEqual(E.importShowBackup(E.exportShowBackup(repaired)), repaired);
  const first = a('first'), second = E.makeCue({ id: 'second', type: 'STOP' });
  const h = show({ cues: [E.makeCue({ id: 'stop', type: 'STOP', target: 'first' })], hits: [first, second], keyMap: { 93: 'HIT:0', 92: 'HIT:1' }, audioFiles: [E.makeAudioFile({ id: 'first' })] });
  const changed = E.repairShowReferences(h, { ...h, hits: [second, { ...first, type: 'STOP' }] });
  assert.deepEqual(changed.cues, []); assert.deepEqual(changed.keyMap, { 93: 'HIT:1', 92: 'HIT:0' });
  assert.ok(E.repairReport(h, { ...h, hits: [second, { ...first, type: 'STOP' }] }, changed).some(line => line.startsWith('삭제: 메인')));
  const typed = E.changeCueType(E.makeCue({ id: 'x', target: 'first' }), 'FADE', h, h.cues);
  assert.equal(typed.target, 'first');
  assert.equal(E.changeCueType(E.makeCue({ id: 'x', target: 'nowhere' }), 'GOTO', h, h.cues).target, '');
});

test('an Android export imports unchanged, runs in the web engine, and exports back to the same data', async () => {
  const text = await readFile(new URL('./kaname-android-show.fixture.json', import.meta.url), 'utf8');
  const imported = E.importShowBackup(text);
  assert.equal(imported.name, '봄 공연');
  assert.equal(imported.cues[0].volume, 1); assert.equal(imported.cues[1].targetVolume, 0.35); assert.equal(imported.cues[0].endMs, null);
  assert.deepEqual(imported.keyMap, { 93: 'GO', 92: 'BACK', 66: 'PANIC', 62: 'HIT:0', 22: 'INSERT:side-1' });
  assert.deepEqual(JSON.parse(E.exportShowBackup(imported)), JSON.parse(text), 'same data both ways');
  const r = rig(imported);
  r.engine.go();
  assert.deepEqual(r.audio.played, ['cue-open']);
  r.clock.advance(4000); assert.deepEqual(r.audio.fades, [{ id: 'cue-open', volume: 0.35, ms: 1200, stop: false }]);
  r.clock.advance(400); r.engine.go(); assert.deepEqual(r.audio.played, ['cue-open', 'cue-bed']);
  r.clock.advance(400); r.engine.go();
  assert.deepEqual(r.audio.fades.slice(1).map(f => [f.id, f.ms, f.stop]), [['cue-open', 800, true], ['cue-bed', 20, true]], 'fade 0 STOP uses the 20 ms ramp');
  assert.equal(r.engine.position.index, 2, 'AFTER_PREVIOUS GOTO moved the standby back to the bed');
  assert.equal(E.keyAction(imported, E.androidKeyCode({ code: 'PageDown' })), 'GO');
  assert.equal(E.keyAction(imported, E.androidKeyCode({ code: 'Space' })), 'HIT:0');
  // Older or hand-written files with missing fields still load with Android defaults; unknown keys are ignored.
  const sparse = E.importShowBackup(JSON.stringify({ name: '짧은 공연', cues: [{ id: 'c', type: 'STOP', future: 1 }], extra: true }));
  assert.equal(sparse.cues[0].fadeMs, 300); assert.equal(sparse.settings.debounceMs, 400); assert.equal('extra' in sparse, false);
});

test('picked audio files match by audioFileId or file name, and unknown files are added', () => {
  const s = show({ audioFiles: [E.makeAudioFile({ id: 'id-1', displayName: 'opening.mp3' }), E.makeAudioFile({ id: 'id-2', displayName: 'bell.m4a' })] });
  const { show: updated, assignments } = E.matchAudioFiles(s, [{ name: 'opening.mp3' }, { name: 'id-2' }, { name: 'new.wav' }]);
  assert.deepEqual(assignments.map(x => [x.id, x.matched]).slice(0, 2), [['id-1', true], ['id-2', true]]);
  assert.equal(assignments[2].matched, false);
  assert.equal(updated.audioFiles.length, 3); assert.equal(updated.audioFiles[2].displayName, 'new.wav');
  assert.match(updated.audioFiles[2].id, /^[A-Za-z0-9_-]+$/);
});

test('GO timing modes: a hold never produces GO followed by PANIC', () => {
  for (const mode of ['release', 'press']) {
    const clock = new Clock(), fired = [];
    const gate = new E.PressGate(clock, action => fired.push(action), 1200);
    // Quick tap: exactly one GO in both modes.
    gate.down(93, 'GO', mode); clock.advance(80); gate.up(93);
    assert.deepEqual(fired, ['GO'], mode + ' tap');
    // Long hold.
    fired.length = 0;
    gate.down(93, 'GO', mode); clock.advance(2000); gate.up(93);
    assert.deepEqual(fired, mode === 'release' ? ['PANIC'] : ['GO'], mode + ' hold');
    assert.ok(!(fired.includes('GO') && fired.includes('PANIC')), mode);
    // A second key while one is held is ignored; focus loss cancels without firing.
    fired.length = 0;
    gate.down(93, 'GO', mode); gate.down(92, 'BACK', mode); gate.up(92); gate.reset(); clock.advance(2000); gate.up(93);
    assert.deepEqual(fired, mode === 'release' ? [] : ['GO'], mode + ' reset');
  }
  // In release mode GO waits for the key to come up; other actions too (Android fires on ACTION_UP).
  const clock = new Clock(), fired = [];
  const gate = new E.PressGate(clock, action => fired.push(action));
  gate.down(93, 'GO', 'release'); assert.deepEqual(fired, []); gate.up(93); assert.deepEqual(fired, ['GO']);
  gate.down(111, 'PANIC', 'release'); clock.advance(3000); gate.up(111); assert.deepEqual(fired, ['GO', 'PANIC']);
});

test('one throwing fade cannot leave other cues playing during PANIC or STOP ALL', () => {
  class Throwing extends Audio { fade(id, volume, ms, stop) { if (id === 'a') throw new Error('boom'); super.fade(id, volume, ms, stop); } }
  for (const via of ['panic', 'stop']) {
    const clock = new Clock(), audio = new Throwing(), events = [];
    const s = show({ cues: [a('a'), a('b', 'WITH_PREVIOUS'), a('c', 'WITH_PREVIOUS'), E.makeCue({ type: 'STOP', fadeMs: 0 })] });
    const engine = new E.CueEngine(s, audio, clock, undefined, () => {}, e => events.push(e));
    engine.setMode(E.MODE.RUN); engine.go(); clock.advance(400);
    if (via === 'panic') engine.panic(); else engine.go();
    assert.deepEqual(audio.fades.map(f => f.id), ['b', 'c'], via);
    assert.ok(events.some(e => e.type === 'Error' && e.message === 'boom'), via);
  }
});

test('output changes: LOST, ADDED, SAME and UNKNOWN are told apart; errors name targets in Korean', () => {
  const out = id => ({ kind: 'audiooutput', deviceId: id, groupId: 'g' + id });
  assert.equal(E.classifyOutputs([out('d'), out('bt')], [out('d')]), 'LOST');
  assert.equal(E.classifyOutputs([out('d')], [out('d'), out('bt')]), 'ADDED');
  assert.equal(E.classifyOutputs([out('d')], [out('d'), { kind: 'audioinput', deviceId: 'm' }]), 'SAME');
  assert.equal(E.classifyOutputs([out('')], [out('')]), 'UNKNOWN');
  assert.equal(E.classifyOutputs([], []), 'UNKNOWN');
  const r = rig(show({ cues: [E.makeCue({ type: 'STOP', target: 'ALL' })] }));
  r.go();
  assert.equal(errors(r)[0].message, '재생 중인 대상이 없습니다: 전체 재생');
});

test('re-importing a file with the same name replaces its audio instead of adding an orphan', () => {
  const s = show({ audioFiles: [E.makeAudioFile({ id: 'id-1', displayName: 'opening.mp3' })] });
  const first = E.matchAudioFiles(s, [{ name: 'opening.mp3' }]);
  const again = E.matchAudioFiles(first.show, [{ name: 'opening.mp3' }]);
  assert.equal(again.show.audioFiles.length, 1);
  assert.deepEqual(again.assignments.map(x => [x.id, x.matched]), [['id-1', true]]);
});
