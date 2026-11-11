'use strict';
  // Wall-clock, presentation-only audience feedback. No state writes or combat clock.
  const audienceImpact = (() => {
    let owner = null, key = '', highest = 1, pending = null, suppressed = false;
    let lastVisual = -Infinity, lastFreeze = -Infinity, starts = [];
    let animation = null, host = null, outline = null, spark = null;
    let outlineUntil = 0, sparkUntil = 0, cleanup = 0, outlineTimer = 0, sparkTimer = 0;
    const tier = (applied, max) => {
      const ratio = Number.isFinite(applied) && max > 0 ? applied / max : 0;
      return ratio < .005 ? 0 : ratio < .02 ? 0 : ratio < .05 ? 40 : ratio < .12 ? 60 : 80;
    };
    const identity = () => patternAudKey() + ':' + state.venue + ':' + (state.u19?.phase || 0) + ':' + (state.review?.act || 0);
    function blocked() {
      return document.hidden || state.mode !== 'fight' || state.resolved || blockingSheetOpen() ||
        lineOpen() || paused() || !!wonMoment || finalePending !== null ||
        !!state.features.climax.left || !!events.finaleHit || !!$('finaleFx')?._impact ||
        !!($('finaleFx') && !$('finaleFx').hidden);
    }
    function clearVisual() {
      clearTimeout(cleanup); clearTimeout(outlineTimer); clearTimeout(sparkTimer);
      cleanup = outlineTimer = sparkTimer = 0;
      if (animation) animation.cancel();
      if (outline && !outline.hidden) outline.hidden = true;
      if (spark && !spark.hidden) spark.hidden = true;
      outlineUntil = sparkUntil = 0;
    }
    function cancel() { pending = null; clearVisual(); }
    function sync() {
      const next = identity();
      if (owner !== state || key !== next) {
        if (owner !== null) suppressed = true;
        cancel(); owner = state; key = next; highest = 1;
        // Cooldowns survive audience/phase/magic changes: transitions cannot evade caps.
      }
    }
    function merge(candidate) {
      if (!pending || candidate.freeze > pending.freeze ||
          (candidate.freeze === pending.freeze && candidate.ratio > pending.ratio)) pending = candidate;
    }
    function batch(list) {
      sync();
      if (list.some(e => ['audience','win','fail','phase2','theaterPhase2','futurePhase','homecomingAct','finisher'].includes(e.type))) {
        suppressed = true; cancel(); return;
      }
      if (blocked() || suppressed) { cancel(); return; }
      for (const e of list) {
        if (e.type !== 'audHit' || e.blocked || !(e.applied > 0)) continue;
        const max = e.presentationMaxDoubt;
        if (!(max > 0)) continue;
        merge({freeze:e.source === 'colleague' ? 0 : tier(e.applied,max),ratio:e.applied/max});
      }
    }
    function stage(stage) {
      sync();
      if (stage <= highest) return;
      highest = stage;
      // A first amazement crossing is visual feedback; without damage its freeze is zero.
      if (!blocked() && !suppressed) merge({freeze:0,ratio:0});
    }
    function mount() {
      if (outline) return;
      outline = element('div', '', 'audience-impact-outline');
      spark = element('div', '', 'audience-impact-spark');
      for (const el of [outline,spark]) { el.hidden = true; el.setAttribute('aria-hidden','true'); $('stage').append(el); }
    }
    function show(candidate, now) {
      if (now - lastVisual < 200) return;
      const target = $('audience');
      // rectOf is the shared U36 cache; no per-frame geometry reads here.
      const r = rectOf(target), s = rectOf($('stage'));
      if (!(r.width > 0 && r.height > 0)) return;
      mount(); clearVisual(); lastVisual = now;
      const x = (r.left-s.left)/scale, y = (r.top-s.top)/scale, w = r.width/scale, h = r.height/scale;
      Object.assign(outline.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
      outline.classList.toggle('is-reduced',reduced); outline.hidden = false;
      outlineUntil = now + (reduced ? 120 : 100);
      outlineTimer = setTimeout(() => { if (!outline.hidden) outline.hidden = true; },reduced ? 120 : 100);
      let freeze = 0;
      starts = starts.filter(entry => now-entry.at < 1000);
      if (!reduced && candidate.freeze && now-lastFreeze >= 350 && starts.length < 2 &&
          starts.reduce((total,entry) => total+entry.ms,0)+candidate.freeze <= 120) {
        freeze = candidate.freeze; lastFreeze = now; starts.push({at:now,ms:freeze});
      }
      if (!reduced) {
        // One retained WAAPI handle; only this reaction holds, once, for the allowed tier.
        const held = {scale:'1.025 0.975',translate:'-2px 0',transformOrigin:'50% 100%'};
        const frames = [{...held,offset:0,easing:'linear'},{...held,offset:freeze/(freeze+140),easing:'ease-out'},
          {scale:'1 1',translate:'0px 0px',transformOrigin:'50% 100%',offset:1}];
        if (host !== target && animation) { animation.cancel(); animation = null; }
        host = target;
        if (!animation) animation = target.animate(frames,{duration:freeze+140,easing:'linear'});
        else { animation.effect.setKeyframes(frames); animation.effect.updateTiming({duration:freeze+140}); animation.play(); }
        Object.assign(spark.style,{left:(x+w*.5-16)+'px',top:(y+h*.65-16)+'px',backgroundPosition:'0px 0px'});
        spark.hidden = false; sparkUntil = now+180;
        sparkTimer = setTimeout(() => { if (!spark.hidden) spark.hidden = true; },180);
      }
      // Expire even when RAF is delayed; never reschedule or extend an active reaction.
      cleanup = setTimeout(clearVisual,Math.max(reduced?120:180,freeze+140));
    }
    function frame() {
      sync();
      if (blocked() || suppressed) { cancel(); suppressed = false; return; }
      const now = performance.now();
      if (outline && !outline.hidden && now >= outlineUntil) outline.hidden = true;
      if (spark && !spark.hidden) {
        if (now >= sparkUntil) spark.hidden = true;
        else spark.style.backgroundPosition = (-32*Math.min(3,Math.floor((180-sparkUntil+now)/45)))+'px 0px';
      }
      const candidate = pending; pending = null;
      if (candidate) show(candidate,now);
    }
    // Attribute changes cancel before the next paint, including panels opened between frames.
    function watch() {
      if (typeof MutationObserver !== 'function') return;
      const observer = new MutationObserver(() => { if (blocked()) cancel(); });
      for (const id of ['panel','phoneMore','moreButton','storyDialog','sceneCard','leaveConfirm','offlineCard','finaleFx']) {
        const el = $(id); if (el) observer.observe(el,{attributes:true,attributeFilter:['hidden','class','aria-expanded']});
      }
    }
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange',cancel);
    if (typeof window !== 'undefined' && window.addEventListener) {
      for (const name of ['presentationmotionchange','resize','orientationchange','pagehide']) window.addEventListener(name,cancel);
    }
    return {batch,stage,frame,cancel,watch,tier};
  })();
