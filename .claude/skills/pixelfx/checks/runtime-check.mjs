import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code = fs.readFileSync(new URL('../runtimes/web/pixelfx-sheet.js', import.meta.url), 'utf8');
for (const loop of [true, false]) {
  let loads = 0, restored = 0, call;
  const meta = { fps: 10, frames: 6, columns: 3, frameSize: [8, 9], pivot: [2, 7], loop };
  const sandbox = { window: {}, document: { baseURI: 'http://localhost/' }, URL,
    fetch: async () => ({ ok: true, json: async () => ({ meta: { pixelfx: meta } }) }),
    Image: class { set src(value) { loads++; queueMicrotask(() => this.onload()); } } };
  vm.runInNewContext(code, sandbox);
  const api = sandbox.window.PixelFxSheet;
  const sheet = await api.load('assets/fx/test');
  assert.equal(await api.load('assets/fx/test'), sheet);
  assert.equal(loads, 1);
  const fx = sheet.new(20, 30);
  fx.update(0.4);
  assert.equal(fx.frame, 4);
  const ctx = { imageSmoothingEnabled: true,
    save() { this.previous = this.imageSmoothingEnabled; },
    restore() { restored++; this.imageSmoothingEnabled = this.previous; },
    drawImage(...args) { assert.equal(this.imageSmoothingEnabled, false); call = args.slice(1); } };
  fx.draw(ctx, 2);
  assert.deepEqual(call, [8, 9, 8, 9, 16, 16, 16, 18]);
  assert.equal(ctx.imageSmoothingEnabled, true);
  assert.equal(restored, 1);
  fx.update(0.4);
  assert.equal(fx.done(), !loop);
  assert.equal(fx.frame, loop ? 2 : 5);
  assert.throws(() => fx.update(-1));
}
console.log('PASS web cache, frame timing, loop/one-shot, columns, pivot, scale, context restoration');
