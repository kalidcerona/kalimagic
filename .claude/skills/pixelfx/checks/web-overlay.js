(async () => {
  const script = document.createElement('script');
  script.src = '/pixelfx-sheet.js';
  await new Promise((resolve, reject) => {
    script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
  });
  const name = new URL(location.href).searchParams.get('pixelfxCheck') || 'magic-circle-cast';
  const sheet = await PixelFxSheet.load('/assets/fx/' + encodeURIComponent(name));
  const canvas = document.createElement('canvas');
  canvas.width = innerWidth; canvas.height = innerHeight;
  canvas.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const fx = sheet.new(canvas.width / 2, canvas.height / 2);
  let changes = 0, prior = fx.frame, nonempty = false, frames = 0;
  const start = performance.now(); let last = start;
  await new Promise(resolve => {
    function tick(now) {
      fx.update((now - last) / 1000); last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      fx.draw(ctx, 2); frames++;
      if (fx.frame !== prior) { changes++; prior = fx.frame; }
      if (!nonempty) {
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) { nonempty = true; break; }
      }
      if (now - start < 3000) requestAnimationFrame(tick); else resolve();
    }
    requestAnimationFrame(tick);
  });
  const result = { pass: changes > 1 && nonempty, frames, changes, nonempty };
  window.__pixelfxCheck = result;
  if (!result.pass) throw new Error('pixelfx check failed: ' + JSON.stringify(result));
  return result;
})()
