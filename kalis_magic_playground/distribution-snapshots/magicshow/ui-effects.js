'use strict';
  function cacheEffectZones(){
    const stageRect = $('stage').getBoundingClientRect?.();
    if (stageRect) {
      const reserved = [...document.querySelectorAll('.stat-label, .hud, .menu, #goalStrip')];
      if (phone) reserved.push(...document.querySelectorAll('#phoneTop, #toasts, .doubt, .mental, .shield, .xp-row'));
      const zones = U5.noDrawZones;
      reserved.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const x = (r.left - stageRect.left) / scale - 3, y = (r.top - stageRect.top) / scale - 3,
          w = r.width / scale + 6, h = r.height / scale + 6;
        const zone = zones[i];
        if (!zone || zone.x !== x || zone.y !== y || zone.w !== w || zone.h !== h) zones[i] = { x, y, w, h };
      });
      zones.length = reserved.length;
    }
  }
  let effectsDrawn = true;
  function drawEffects() {
    const busy = particles.length || flights.length || numbers.length || badges.length;
    if (!busy && !effectsDrawn) return;
    effectsDrawn = !!busy;
    ctx.clearRect(0, 0, layoutWidth, layoutHeight);
    ctx.save();
    // Intersect individual exclusions so overlapping reserved regions stay clear.
    for (const z of U5.noDrawZones) {
      ctx.beginPath(); ctx.rect(0, 0, layoutWidth, layoutHeight);
      ctx.rect(z.x, z.y, z.w, z.h); ctx.clip('evenodd');
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i], t = (clock - p.start) / p.life;
      if (t >= 1) { particles.splice(i, 1); continue; }
      if (t < 0) continue;
      const x = p.x + p.dx * t, y = p.y + p.dy * t + (p.finale ? 10 : 28) * t * t;
      ctx.globalAlpha = 1 - t; ctx.fillStyle = p.color;
      if (p.finale) {
        // s4e2 E: the finale cards and coins use the pixel sheets (fx-card-shards, fx-coin-spark), not emoji glyphs. Half the particles draw a sheet.
        const sheet = assetImage('assets/ui/fx-' + (p.shape === 'card' ? 'card-shards' : 'coin-spark') + '.png');
        ctx.globalAlpha = Math.min(1, (1 - t) * 5); // solid until they reach the audience, then a quick fade
        if (sheet?.complete && sheet.naturalWidth) { if (p.sheetLead) { ctx.imageSmoothingEnabled = false; ctx.drawImage(sheet, Math.min(3, Math.floor(t * 4)) * 32, 0, 32, 32, Math.round(x) - 16, Math.round(y) - 16, 32, 32); } }
        else ctx.fillRect(Math.round(x) - 3, Math.round(y) - 4, 6, 8);
        continue;
      }
      const sheets={card:'card-shards',cardrain:'card-shards',coin:'coin-spark',ring:'ring-flash',silk:'ribbon',sponge:'puff',dove:'feathers',cheer:'heart-pop',showtime:'shockwave',critical:'critical'};
      const sheet=p.shape && p.shape !== 'critical' && assetImage('assets/ui/fx-'+sheets[p.shape]+'.png');
      if(sheet?.complete&&sheet.naturalWidth){if(!p.sheetLead)continue;ctx.imageSmoothingEnabled=false;ctx.drawImage(sheet,Math.min(3,Math.floor(t*4))*32,0,32,32,Math.round(x)-16,Math.round(y)-16,32,32);
      } else if(p.shape==='showtime'){
        ctx.beginPath();ctx.moveTo(x,y-12);ctx.lineTo(x-8,y+8);ctx.lineTo(x+8,y+8);ctx.closePath();ctx.globalAlpha*=.3;ctx.fill();
      } else if(p.shape){
        ctx.font=`${p.size*2+4}px Galmuri11`;
        const shapes={card:'▱',coin:'·',ring:'○',silk:'∿',sponge:'●',dove:'⌁',cardrain:'▱',cheer:'♥',showtime:'△'};
        ctx.fillText(shapes[p.shape]||'·',Math.round(x),Math.round(y));
      } else if (p.line) {
        ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + p.dx * .35, y + p.dy * .35); ctx.stroke();
      } else if (p.square) { const s = p.size * 2; ctx.fillRect(Math.round(x) - p.size, Math.round(y) - p.size, s, s); }
      else star(x, y, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    for (let i = badges.length - 1; i >= 0; i--) {
      const b = badges[i];
      // The case is the origin. Common drops are icon-only in every layout.
      const named = ['rare', 'hero', 'legend', 'myth'].includes(b.rarity);
      const color = D.items.rarities.find(r => r.id === b.rarity)?.color || '#ffe35b';
      fly(b.x, b.y, portraitLayout() ? portraitDropTarget(b.effect) : target(b.effect), b.emoji || b.icon, named ? String(b.name || '').slice(0, 12) : '', color, 0, b.image);
      badges.splice(i, 1);
    }
    const paintFlight = f => {
      const t = (clock - f.start) / f.life;
      const arc = f.arc === 'up'
        ? p => {
          const dx = f.tx - f.x, dy = f.ty - f.y, len = Math.hypot(dx, dy) || 1, s = Math.sin(Math.PI * p);
          return { x: f.x + dx * p + (-dy / len) * 12 * s, y: f.y + dy * p - 24 * s };
        }
        : p => ({ x: f.x + (f.tx - f.x) * p, y: f.y + (f.ty - f.y) * p - 24 * Math.sin(Math.PI * p) });
      ctx.fillStyle = f.color;
      for (let p = Math.max(0, t - .04); p < t; p += .06) {
        const a = arc(p); ctx.fillRect(Math.round(a.x) - 1, Math.round(a.y) - 1, 2, 2);
      }
      const a = arc(t); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.imageSmoothingEnabled = false;
      const pop = f.arc === 'up' && t > 0.86 ? 1 + 0.28 * Math.sin((1 - t) / 0.14 * Math.PI) : 1;
      const size = 48 * pop;
      ctx.font = '42px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; if (f.image && f.image.complete && f.image.naturalWidth) ctx.drawImage(f.image, a.x - size / 2, a.y - size / 2, size, size);
      else ctx.fillText(f.emoji, a.x, a.y);
      if (f.label) {
        ctx.font = '700 11px Galmuri11'; ctx.lineWidth = 5; ctx.strokeStyle = '#000';
        ctx.strokeText(f.label, a.x, a.y + 34); ctx.fillText(f.label, a.x, a.y + 34);
      }
    };
    const rising = [];
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i], t = (clock - f.start) / f.life;
      if (t >= 1) { if (f.pop) landPop(f.pop); flights.splice(i, 1); continue; }
      if (t < 0) continue;
      // Portrait throws cross the stats band. Draw them after the HUD clip so the icon stays visible the whole way up.
      if (f.arc === 'up' && portraitLayout()) { rising.push(f); continue; }
      paintFlight(f);
    }
    for (let i = numbers.length - 1; i >= 0; i--) {
      const n = numbers[i], t = (clock - n.start) / n.life;
      if (t >= 1) { numbers.splice(i, 1); continue; }
      ctx.globalAlpha = t < .6 ? 1 : (1 - t) / .4;
      ctx.font = `700 ${n.size||14}px Galmuri11`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.fillStyle = n.color;
      const progress=n.tier===4?(t<.24?t*.4:.096+(t-.24)*(.904/.76)):t;
      const y = Math.round(n.y - (reduced || n.fixed ? 0 : progress*(14+(n.tier||0))));
      const nx=Math.round(n.x+(!reduced&&n.tier===1?Math.sin(t*Math.PI)*8:0));
      const width=Math.max(ctx.measureText(n.text).width+6,n.critical?ctx.measureText(n.text).width+14:0), radius=!reduced&&n.tier>=3?8+t*16:0;
      if(!U5.clearOfZones({x:nx-Math.max(width/2,radius),y:y-Math.max(n.size/2+3,radius),w:Math.max(width,radius*2),h:Math.max(n.size+6,radius*2)}))continue;
      if(radius){ctx.strokeStyle=n.color;ctx.lineWidth=1;ctx.beginPath();ctx.arc(nx,y,radius,0,Math.PI*2);ctx.stroke();}
      if(n.critical){const bw=Math.max(44,Math.ceil(width));ctx.fillStyle='#261b2b';ctx.fillRect(nx-bw/2,y-10,bw,20);ctx.strokeStyle='#eac568';ctx.lineWidth=1;ctx.strokeRect(nx-bw/2,y-10,bw,20);ctx.fillStyle=n.color;}
      ctx.save();ctx.translate(nx,y);if(!reduced&&n.tier===2){const punch=1+.12*Math.max(0,1-t*4);ctx.scale(punch,punch);}ctx.strokeStyle=n.tier===4?'#c99e4d':'#17121d';ctx.lineWidth=n.tier===4?3:2;ctx.strokeText(n.text,0,0);ctx.fillText(n.text,0,0);ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.restore();
    if (rising.length) { ctx.save(); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false; for (const f of rising) paintFlight(f); ctx.restore(); }
  }

