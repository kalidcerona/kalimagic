import { MODE, position, positionKey } from './engine-model.mjs';
import { stopRampMs } from './engine-output.mjs';

// ---------- cue engine (CueEngine.kt) ----------
/** All calls, scheduler actions and audio callbacks run on the page's single thread. */
export class CueEngine {
  constructor(show, audio, clock, saved = { standby: position(), stack: [] }, persist = () => {}, event = () => {}, changed = () => {}) {
    this.show = show; this.audio = audio; this.clock = clock;
    this.persist = persist; this.event = event; this.changed = changed;
    this.mode = MODE.EDIT;
    this.position = { ...(saved.standby || position()) };
    this.stack = (saved.stack || []).map(p => ({ ...p }));
    this.active = new Map();
    this.pending = new Map();
    this.serial = 0; this.generation = 0; this.lastGo = null;
    this.instances = new Map(); this.runSerial = 0;
    this.paused = false; this.droppedOnLoss = 0;
    this.normalize(); this.save();
  }
  get pendingCount() { return this.pending.size; }
  get insertStack() { return this.stack.map(p => ({ ...p })); }
  list(id = this.position.listId) {
    if (id === 'main') return this.show.cues;
    if (id === 'hits') return this.show.hits.slice(0, 9);
    return this.show.inserts.find(s => s.id === id)?.cues ?? [];
  }
  standby() { return this.list()[this.position.index] ?? null; }
  next() { return this.list().slice(this.position.index + 1).find(c => c.trigger === 'MANUAL') ?? null; }
  snapshot() { return { standby: { ...this.position }, stack: this.insertStack }; }
  setMode(value) { this.mode = value; if (value === MODE.EDIT) this.panic(); this.changed(); }
  normalize() {
    if (this.position.listId !== 'main' && !this.show.inserts.some(s => s.id === this.position.listId)) this.position = position();
    this.position = { ...this.position, index: Math.min(Math.max(this.position.index, 0), this.list().length) };
  }
  save() {
    this.normalize();
    try { this.persist(this.snapshot()); } catch (e) { this.error(e?.message || '위치 저장 실패'); }
    this.changed();
  }
  go() {
    if (this.mode === MODE.EDIT) return false;
    if (this.paused) return this.resume();
    const now = this.clock.now();
    if (this.lastGo !== null && now - this.lastGo < this.show.settings.debounceMs) { this.event({ type: 'Rejected' }); return false; }
    const cue = this.standby();
    if (!cue) return false;
    this.lastGo = now;
    const origin = { ...this.position };
    this.advance(origin);
    this.event({ type: 'Accepted' });
    this.launch(origin, cue, new Set());
    this.save();
    return true;
  }
  advance(origin) {
    const cues = this.list(origin.listId);
    let next = origin.index + 1;
    while (next < cues.length && cues[next].trigger !== 'MANUAL') next++;
    this.position = { ...origin, index: next };
  }
  later(delay, action) {
    if (delay <= 0) { action(); return; }
    const id = ++this.serial;
    this.pending.set(id, this.clock.schedule(delay, () => { this.pending.delete(id); action(); this.changed(); }));
    this.changed();
  }
  launch(origin, cue, gotoPath) {
    let current = origin;
    let next = cue;
    while (next) {
      const scheduledOrigin = current, scheduledCue = next, epoch = this.generation;
      this.later(Math.max(scheduledCue.delayMs, 0), () => {
        if (epoch === this.generation) this.execute(scheduledOrigin, scheduledCue, gotoPath, epoch);
      });
      current = { ...current, index: current.index + 1 };
      const candidate = this.list(origin.listId)[current.index];
      next = candidate && candidate.trigger === 'WITH_PREVIOUS' ? candidate : null;
    }
  }
  execute(origin, cue, gotoPath, epoch) {
    if (cue.type === 'GOTO' && gotoPath.has(positionKey(origin))) { this.error('GOTO 반복 한도 초과'); return; }
    const token = ++this.runSerial;
    let completed = false;
    const complete = () => {
      if (epoch !== this.generation) { this.changed(); return; } // PANIC already dropped the cue from `active`; refresh the screen
      if (completed) return;
      completed = true;
      if (origin.listId === 'hits') return;
      const next = this.list(origin.listId)[origin.index + 1];
      if (next?.trigger === 'AFTER_PREVIOUS') this.launch({ ...origin, index: origin.index + 1 }, next, gotoPath);
      this.changed();
    };
    const release = () => { if (this.instances.get(cue.id) === token) { this.active.delete(cue.id); this.instances.delete(cue.id); } };
    try {
      if (cue.type === 'AUDIO') {
        this.active.set(cue.id, cue); this.instances.set(cue.id, token);
        this.audio.play(cue, () => { release(); complete(); }, message => { release(); this.error(message); complete(); });
      } else if (cue.type === 'FADE' || cue.type === 'STOP') {
        const targets = cue.target === 'ALL' ? [...this.active.keys()] : [cue.target].filter(id => this.active.has(id));
        if (targets.length === 0) this.error('재생 중인 대상이 없습니다: ' + this.describeTarget(cue.target));
        for (const id of targets) {
          const stop = cue.type === 'STOP' || cue.stopAtEnd;
          const duration = Math.max(cue.type === 'STOP' ? Math.max(cue.fadeMs, this.active.get(id)?.fadeOutMs ?? 0) : cue.durationMs, 0);
          const volume = cue.type === 'STOP' ? 0 : Math.min(Math.max(cue.targetVolume, 0), 1);
          // One failing fade must not leave the other targets playing.
          try { this.audio.fade(id, volume, stop ? stopRampMs(duration) : duration, stop); } catch (e) { this.error(e?.message || '페이드 오류'); }
        }
        complete();
      } else if (cue.type === 'GOTO') {
        const index = this.list(origin.listId).findIndex(c => c.id === cue.target);
        if (index < 0) this.error('이동할 큐가 없습니다: ' + cue.target);
        else if (origin.listId === 'hits') {
          if (cue.runNow) {
            const target = this.list('hits')[index];
            const path = new Set(gotoPath); path.add(positionKey(origin));
            this.later(Math.max(target.delayMs, 0), () => { if (epoch === this.generation) this.execute(position('hits', index), target, path, epoch); });
          }
        } else {
          this.position = position(origin.listId, index);
          if (cue.runNow) {
            const path = new Set(gotoPath); path.add(positionKey(origin));
            this.advance(this.position);
            this.launch(position(origin.listId, index), this.list(origin.listId)[index], path);
          }
          this.save();
        }
        complete();
      }
    } catch (e) { this.active.delete(cue.id); this.error(e?.message || '큐 실행 오류'); complete(); }
    if (origin.listId !== 'main' && origin.listId !== 'hits' && origin.index === this.list(origin.listId).length - 1) {
      // A nested insert may own standby while this insert's delayed final cue fires.
      if (origin.listId === this.position.listId && this.position.index >= this.list().length && this.stack.length > 0) {
        this.position = this.stack.pop();
        this.save();
      } else {
        let saved = -1;
        for (let i = this.stack.length - 1; i >= 0; i--) {
          if (this.stack[i].listId === origin.listId && this.stack[i].index >= this.list(origin.listId).length) { saved = i; break; }
        }
        if (saved >= 0) { this.stack.splice(saved, 1); this.save(); }
      }
    }
    this.changed();
  }
  back() {
    if (this.mode === MODE.EDIT) return;
    const cues = this.list();
    let index = -1;
    for (let i = Math.min(this.position.index, cues.length) - 1; i >= 0; i--) if (cues[i].trigger === 'MANUAL') { index = i; break; }
    if (index < 0) return;
    this.position = { ...this.position, index }; this.save();
  }
  hit(index) {
    if (this.mode === MODE.EDIT) return;
    if (this.paused) { this.event({ type: 'Rejected' }); return; }
    const cue = this.show.hits.slice(0, 9)[index];
    if (cue) this.execute(position('hits', index), cue, new Set(), this.generation);
  }
  insert(id) {
    if (this.mode === MODE.EDIT || !this.show.inserts.some(s => s.id === id && s.cues.length > 0)) return;
    this.stack.push({ ...this.position }); this.position = position(id, 0); this.save();
  }
  panic() {
    this.generation++;
    for (const handle of this.pending.values()) handle.cancel();
    this.pending.clear();
    this.paused = false;
    for (const id of [...this.active.keys()]) {
      try { this.audio.fade(id, 0, stopRampMs(Math.max(this.show.settings.panicFadeMs, 0)), true); } catch (e) { this.error(e?.message || '정지 오류'); }
    }
    // Cancelled insert tails cannot execute their normal return path.
    this.stack = this.stack.filter(p => !(p.listId !== 'main' && p.index >= this.list(p.listId).length));
    while (this.position.listId !== 'main' && this.position.index >= this.list().length && this.stack.length > 0) this.position = this.stack.pop();
    this.save();
  }
  /**
   * Output device removed. Active cues are paused and stay resumable; delayed (not yet started) cues are dropped
   * because they would otherwise start on the phone speaker. Returns false when nothing was playing or scheduled.
   */
  outputLost() {
    if (this.mode === MODE.EDIT || this.paused || (this.active.size === 0 && this.pending.size === 0)) return false;
    this.droppedOnLoss = this.pending.size;
    for (const handle of this.pending.values()) handle.cancel();
    this.pending.clear();
    this.paused = true; this.audio.pauseAll?.(); this.changed();
    return true;
  }
  resume() {
    if (!this.paused) return false;
    this.paused = false; this.audio.resumeAll?.(); this.event({ type: 'Accepted' }); this.changed();
    return true;
  }
  describeTarget(id) {
    if (id === 'ALL') return '전체 재생';
    const cue = [...this.show.cues, ...this.show.hits, ...this.show.inserts.flatMap(s => s.cues)].find(c => c.id === id);
    return cue ? `${cue.number} ${cue.name}` : '없는 큐';
  }
  error(message) { this.event({ type: 'Error', message }); this.changed(); }
}
