// Presentation only: no RNG, rewards, or persisted state. Optional art falls back on load failure.
(() => {
  const base = 'assets/ui/minigames/';
  const loaded = new Map();
  const load = name => {
    if (!loaded.has(name)) loaded.set(name, new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0 ? img.src : null);
      img.onerror = () => resolve(null);
      img.src = base + name + '.webp';
    }));
    return loaded.get(name);
  };
  const propNames = new Set(['cb-mat','cb-wand','cb-ball','cb-lemon','cb-orange','monte-hand-cover',
    'monte-back','monte-queen','monte-jack','monte-king','fx-cup-lift-01']);
  function art(img, name) {
    if (!propNames.has(name)) return;
    const old = img.src;
    load(name).then(src => { if (src && img.src === old) img.src = src; });
  }
  const isReduced = value => typeof value === 'function' ? value() : value;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function tween(el, frames, ms, reduced) {
    if (isReduced(reduced) || !el.animate) return;
    const a = el.animate(frames, {duration:ms,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
    await a.finished.catch(() => {});
    a.cancel();
  }
  // Five samples approximate opposite arcs. The lower path always draws in front, independent of the queen.
  function arc(dx, front, height) {
    return [0,.25,.5,.75,1].map(t => ({
      transform:`translate(${dx*t}px,${Math.sin(Math.PI*t)*height*(front?1:-1)}px) rotate(${Math.sin(Math.PI*t)*(front?3:-3)}deg)`,
      offset:t
    }));
  }
  async function flip(cards, changeFace, reduced) {
    const targets = cards;
    cards.forEach(c => c.classList.add('motion-flipping'));
    try {
      await Promise.all(targets.map(el => tween(el,[
        {transform:'translateY(0) scale(1,1)'},
        {transform:'translateY(-3px) scale(1.04,.94)',offset:.3},
        {transform:'translateY(-7px) scale(.025,1.04)'}
      ],120,reduced)));
      changeFace(); // Replace the face at the narrowest point, never at the end of the turn.
      await Promise.all(targets.map(el => tween(el,[
        {transform:'translateY(-7px) scale(.025,1.04)'},
        {transform:'translateY(-2px) scale(1.03,.97)',offset:.75},
        {transform:'translateY(0) scale(1,1)'}
      ],120,reduced)));
    } finally { cards.forEach(c => c.classList.remove('motion-flipping')); }
  }
  function shadow(cup) {
    let el = cup.querySelector('.prop-shadow');
    if (!el) { el = document.createElement('span'); el.className = 'prop-shadow'; cup.prepend(el); }
    return el;
  }
  async function lift(cup, up, reduced) {
    const img = cup.querySelector('.cup-prop'), shade = shadow(cup);
    const from = up ? '0px' : '-42%', to = up ? '-42%' : '0px';
    await Promise.all([
      tween(img,[{transform:`translateY(${from})`},
        {transform:`translateY(${up?2:2}px) scale(1.04,.95)`,offset:up?.15:.86},
        {transform:`translateY(${to}) scale(1,1)`}],up?260:180,reduced),
      tween(shade,[{opacity:up?.3:.14,transform:`scaleX(${up?1:1.25})`},
        {opacity:up?.14:.3,transform:`scaleX(${up?1.25:1})`}],up?260:180,reduced)
    ]);
    img.style.transform = `translateY(${to})`;
    shade.style.opacity = up ? '.14' : '.3'; shade.style.transform = up ? 'scaleX(1.25)' : 'scaleX(1)';
  }
  // Each face has four FULL card frames with a transparent folded-away corner, registered to the flat card.
  // Only a complete decoded sequence may replace the legacy corner. Late loads never restart the fold.
  function bend(card, mark, animated, reduced) {
    const face = card.querySelector('.card-art').src.split('/').pop().replace(/\.(?:png|webp)$/,'');
    const token = {}; mark._foldToken = token;
    const started = Date.now();
    Promise.all([1,2,3,4].map(i => load(`${face}-fold-${i}`))).then(async frames => {
      if (frames.some(src => !src) || !mark.isConnected || mark._foldToken !== token) return;
      mark.classList.add('drawn-fold'); card.classList.add('has-drawn-fold');
      mark.classList.remove('bend-in');
      const apply = i => { mark.style.backgroundImage = `url("${frames[i]}")`; };
      if (animated && !isReduced(reduced) && Date.now()-started < 80) {
        for (let i=0;i<4;i++) {
          if (!mark.isConnected || mark._foldToken !== token) return;
          if (isReduced(reduced)) { apply(3); return; }
          apply(i); await sleep([90,100,110,120][i]);
        }
      } else apply(3);
    });
  }
  function refreshBend(card, reduced) {
    const mark = card.querySelector('.bent-corner');
    if (!mark) return;
    card.classList.remove('has-drawn-fold'); mark.classList.remove('drawn-fold');
    mark.style.backgroundImage = ''; bend(card,mark,false,reduced);
  }
  globalThis.MinigameMotion = {art,arc,flip,lift,shadow,bend,refreshBend};
})();
