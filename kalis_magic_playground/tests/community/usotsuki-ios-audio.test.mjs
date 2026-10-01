import test from 'node:test';
import assert from 'node:assert/strict';

async function mount(route, sound = true) {
  let now = 0;
  const contexts = [];
  const timers = new Map();
  const nodes = new Map();
  const documentListeners = new Map();
  const stored = new Map([
    ['usotsuki.detector.settings-guide.v1', '1'],
    ['usotsuki.detector.sound.v1', sound ? '1' : '0'],
    ['usotsuki.distribution.detector.sound.v1', sound ? '1' : '0'],
  ]);
  class ElementStub {
    constructor() {
      this.hidden = false; this.checked = false; this.value = ''; this.style = {}; this.dataset = {};
      this.classList = { add() {}, remove() {} }; this.listeners = new Map();
    }
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    dispatch(type, extras = {}) { this.listeners.get(type)?.({ target:this, pointerId:1, clientX:50, clientY:50, cancelable:true, preventDefault() {}, ...extras }); }
    closest(selector) { return selector === '#detector-button' && this === get(selector) ? this : null; }
    getBoundingClientRect() { return { left:0, top:0, width:100, height:100 }; }
    setPointerCapture() {} setAttribute() {} blur() {} focus() {}
  }
  const param = () => ({ value:0.0001, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} });
  class AudioStub {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; this.resumes = 0; this.tones = []; contexts.push(this); }
    resume() { this.resumes++; return new Promise(resolve => { this.finishResume = () => { this.state = 'running'; resolve(); }; }); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createGain() { return { gain:param(), connect() {}, disconnect() {} }; }
    createOscillator() {
      const node = { frequency:param(), connect() {}, disconnect() {}, start:() => this.tones.push(node), stop() {} };
      return node;
    }
    createBuffer() { return {}; }
    createBufferSource() { return { connect() {}, disconnect() {}, start() {}, stop() {} }; }
  }
  function get(selector) { if (!nodes.has(selector)) nodes.set(selector,new ElementStub()); return nodes.get(selector); }
  globalThis.Element = ElementStub;
  globalThis.document = { body:new ElementStub(), hidden:false, querySelector:get, addEventListener:(type,fn)=>documentListeners.set(type,fn) };
  globalThis.window = {
    AudioContext:AudioStub,
    localStorage:{ getItem:key=>stored.get(key)??null, setItem:(key,value)=>stored.set(key,value) },
    setTimeout:fn=>{ const id = Symbol(); timers.set(id,fn); return id; }, clearTimeout:id=>timers.delete(id), addEventListener() {},
  };
  Object.defineProperty(globalThis,'navigator',{ configurable:true,value:{} });
  globalThis.performance = { now:()=>now };
  await import(`../../${route}/detector.js?ios-audio=${sound}`);
  const flush = async () => { for (let i=0;i<8;i++) await Promise.resolve(); };
  const screen = get('#performance-screen');
  const button = get('#detector-button');
  return { contexts, get, flush, timers, down:()=>screen.dispatch('pointerdown',{target:button}), up:()=>screen.dispatch('pointerup',{target:button}), advance:ms=>{now+=ms;}, hidden:()=>{document.hidden=true;documentListeners.get('visibilitychange')?.();}, visible:()=>{document.hidden=false;documentListeners.get('visibilitychange')?.();} };
}

test('personal and friend audio recover from iOS interruption and background, without delayed cancelled scans', async () => {
  for (const route of ['zz7','distribution-snapshots/usotsuki']) {
    const app = await mount(route);
    app.get('#start-performance').dispatch('click');
    const ctx = app.contexts[0];
    assert.ok(ctx,route);
    ctx.finishResume(); await app.flush();
    ctx.state = 'interrupted';
    const beforeResume = ctx.resumes;
    app.down();
    assert.ok(ctx.resumes > beforeResume,`${route} interrupted context must resume`);
    app.advance(10); app.up();
    const beforeTones = ctx.tones.length;
    ctx.finishResume(); await app.flush();
    assert.equal(ctx.tones.length,beforeTones,`${route} cancelled hold must not sound after resume`);
    app.hidden(); app.visible(); app.down();
    assert.equal(app.contexts.length,2,`${route} next gesture rebuilds audio after background`);
    const restored = app.contexts[1];
    restored.finishResume(); await app.flush();
    assert.ok(restored.tones.length>0,`${route} active scan sounds after recovery`);
    app.advance(2000);
    for (const fn of [...app.timers.values()]) fn();
    await app.flush();
    assert.ok(restored.tones.length>1,`${route} verdict sound remains available`);
    app.up();
    restored.state = 'closed';
    app.down();
    assert.equal(app.contexts.length,3,`${route} closed context must be replaced`);
    app.up();
    app.contexts[2].finishResume(); await app.flush();
  }
});

test('saved sound off creates no audio context on either route', async () => {
  for (const route of ['zz7','distribution-snapshots/usotsuki']) {
    const app = await mount(route,false);
    app.get('#start-performance').dispatch('click'); app.down(); await app.flush();
    assert.equal(app.contexts.length,0,route);
    app.up();
  }
});
