/* Classic script: const sheet = await PixelFxSheet.load(baseUrl); sheet.new(x, y). */
(function (global) {
  'use strict';
  const cache = new Map();
  class Instance {
    constructor(sheet, x = 0, y = 0) {
      this.sheet = sheet; this.x = x; this.y = y; this.time = 0; this.frame = 0;
    }
    update(dt) {
      if (!Number.isFinite(dt) || dt < 0) throw new Error('Invalid dt');
      this.time += dt;
      const m = this.sheet.meta, index = Math.floor(this.time * m.fps);
      this.frame = m.loop ? index % m.frames : Math.min(index, m.frames - 1);
    }
    done() {
      const m = this.sheet.meta;
      return !m.loop && this.time >= m.frames / m.fps;
    }
    draw(ctx, scale = 1) {
      if (this.done()) return;
      const m = this.sheet.meta, [w, h] = m.frameSize;
      ctx.save();
      try {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.sheet.image, (this.frame % m.columns) * w,
          Math.floor(this.frame / m.columns) * h, w, h,
          this.x - m.pivot[0] * scale, this.y - m.pivot[1] * scale, w * scale, h * scale);
      } finally { ctx.restore(); }
    }
  }
  global.PixelFxSheet = {
    async load(baseUrl) {
      const base = new URL(baseUrl, document.baseURI).href;
      if (!cache.has(base)) {
        const pending = (async () => {
          const response = await fetch(base + '.json');
          if (!response.ok) throw new Error(`Sheet metadata HTTP ${response.status}`);
          const metadata = await response.json(), m = metadata.meta.pixelfx;
          if (!(m.fps > 0 && m.frames > 0 && m.columns > 0)) throw new Error('Invalid sheet metadata');
          const image = new Image();
          await new Promise((resolve, reject) => {
            image.onload = resolve; image.onerror = () => reject(new Error('Sheet image failed'));
            image.src = base + '.png';
          });
          return { image, meta: m, new(x, y) { return new Instance(this, x, y); } };
        })();
        cache.set(base, pending);
        pending.catch(() => cache.delete(base));
      }
      return cache.get(base);
    }
  };
})(window);
