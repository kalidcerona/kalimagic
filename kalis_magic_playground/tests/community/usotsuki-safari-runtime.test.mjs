import test from 'node:test';
import assert from 'node:assert/strict';

test('personal and friend USOTSUKI commit focused scan input before Start without a change event', async () => {
  for (const route of ['zz7', 'distribution-snapshots/usotsuki']) {
    let now = 0;
    let timerId = 0;
    const timers = new Map();
    const stored = new Map([
      ['usotsuki.detector.settings-guide.v1', '1'],
      ['usotsuki.detector.sound.v1', '0'],
      ['usotsuki.distribution.detector.sound.v1', '0'],
    ]);
    const nodes = new Map();
    class ElementStub {
      constructor() {
        this.value = ''; this.hidden = false; this.checked = false; this.disabled = false;
        this.textContent = ''; this.listeners = new Map(); this.style = {};
        this.classList = { add() {}, remove() {} };
      }
      addEventListener(type, fn) { this.listeners.set(type, fn); }
      dispatch(type, extra = {}) {
        this.listeners.get(type)?.({target:this, pointerId:1, clientX:50, clientY:50, cancelable:true, preventDefault() {}, ...extra});
      }
      closest(selector) { return selector === '#detector-button' && this === get('#detector-button') ? this : null; }
      getBoundingClientRect() { return { left:0, top:0, width:100, height:100 }; }
      setPointerCapture() {} setAttribute() {} blur() {} focus() {}
    }
    function get(selector) { if (!nodes.has(selector)) nodes.set(selector, new ElementStub()); return nodes.get(selector); }
    globalThis.Element = ElementStub;
    globalThis.document = { body:new ElementStub(), hidden:false, querySelector:get, addEventListener() {} };
    globalThis.window = {
      localStorage:{getItem:key=>stored.get(key)??null, setItem:(key,value)=>stored.set(key,value)},
      setTimeout:fn=>{ timers.set(++timerId,fn); return timerId; }, clearTimeout:id=>timers.delete(id), addEventListener() {},
    };
    Object.defineProperty(globalThis, 'navigator', { configurable:true, value:{} });
    globalThis.performance = { now:()=>now };
    await import(`../../${route}/detector.js?scan-regression`);
    const stateKey = route === 'zz7' ? 'usotsuki.detector.v1' : 'usotsuki.distribution.detector.v1';
    const start = get('#start-performance');
    const input = get('#scan-duration');
    const screen = get('#performance-screen');
    const button = get('#detector-button');
    for (const seconds of [3, 7]) {
      input.value = String(seconds);
      start.dispatch('click');
      assert.equal(stored.get('usotsuki.detector.scan-duration.v1'), String(seconds), route);
      assert.equal(get('#vibration-level').disabled, true, route);
      assert.equal(get('#vibration-settings').hidden, true, route);
      assert.equal(get('#vibration-settings').style.display, 'none', route);
      screen.dispatch('pointerdown', { target:button });
      now += seconds * 1000 - 1;
      const earlyTimer = [...timers.values()][0]; timers.clear(); earlyTimer();
      assert.equal(JSON.parse(stored.get(stateKey)).attemptCount, 0, `${route} timer must not finish early`);
      now += 1;
      const completionTimer = [...timers.values()][0]; timers.clear(); completionTimer();
      assert.equal(JSON.parse(stored.get(stateKey)).attemptCount, 1, `${route} completes at chosen boundary`);
      screen.dispatch('pointerup', { target:button });
      assert.equal(JSON.parse(stored.get(stateKey)).attemptCount, 1, `${route} no double count`);
    }
    input.value = ''; input.dispatch('input');
    assert.equal(input.value, '', `${route} preserve an intermediate edit`);
    input.value = '3.5'; input.dispatch('input');
    assert.equal(input.value, '3.5', `${route} preserve the typed decimal`);
    start.dispatch('click');
    assert.equal(stored.get('usotsuki.detector.scan-duration.v1'), '3.5', route);
  }
});
