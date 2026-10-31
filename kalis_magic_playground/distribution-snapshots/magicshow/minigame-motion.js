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
  const fade = el => el.animate?.([{opacity:.35},{opacity:1}],{duration:120,easing:'linear'});
  async function tween(el, frames, ms, reduced) {
    if (isReduced(reduced) || !el.animate) return;
    const a = el.animate(frames, {duration:ms,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
    await a.finished.catch(() => {});
    a.cancel();
  }
  // Nine samples describe opposite arcs. The lower path always draws in front, independent of the queen.
  function arc(dx, front, height) {
    return Array.from({length:9},(_,i) => i/8).map(t => ({
      transform:`translate(${dx*t}px,${Math.sin(Math.PI*t)*height*(front?1:-1)}px) rotate(${Math.sin(Math.PI*t)*(front?3:-3)}deg)`,
      offset:t
    }));
  }
  async function flip(cards, changeFace, reduced) {
    if (isReduced(reduced)) { changeFace(); cards.forEach(fade); return; }
    // The contact shadow stays on the mat while only the card surface turns.
    const surfaces = cards.map(card => {
      const surface = document.createElement('span'); surface.className = 'motion-surface';
      [...card.children].filter(el => !el.classList.contains('prop-shadow')).forEach(el => surface.append(el));
      card.append(surface); card.classList.add('motion-flipping'); shadow(card);
      return surface;
    });
    const shades = cards.map(shadow);
    try {
      await Promise.all([
        ...surfaces.map(el => tween(el,[
          {transform:'translateY(0) scale(1,1)'},
          {transform:'translateY(-2px) scale(1.02,.96)',offset:.25},
          {transform:'translateY(-7px) scale(.015,1)'}
        ],120,reduced)),
        ...shades.map(el => tween(el,[{opacity:.3,transform:'scaleX(1)'},
          {opacity:.14,transform:'scaleX(.65)'}],120,reduced))
      ]);
      // Persist the edge pose across cancellation/face replacement: no one-frame flat flash.
      surfaces.forEach(el => { el.style.transform = 'translateY(-7px) scale(.015,1)'; });
      changeFace();
      await Promise.all([
        ...surfaces.map(el => tween(el,[
          {transform:'translateY(-7px) scale(.015,1)'},
          {transform:'translateY(1px) scale(1.02,.97)',offset:.82},
          {transform:'translateY(0) scale(1,1)'}
        ],120,reduced)),
        ...shades.map(el => tween(el,[{opacity:.14,transform:'scaleX(.65)'},
          {opacity:.3,transform:'scaleX(1)'}],120,reduced))
      ]);
    } finally {
      surfaces.forEach((surface,i) => {
        [...surface.children].forEach(el => cards[i].append(el)); surface.remove();
        cards[i].classList.remove('motion-flipping');
      });
    }
  }
  function shadow(cup) {
    let el = cup.querySelector('.prop-shadow');
    if (!el) { el = document.createElement('span'); el.className = 'prop-shadow'; cup.prepend(el); }
    return el;
  }
  async function lift(cup, up, reduced) {
    const img = cup.querySelector('.cup-prop'), shade = shadow(cup);
    const frames = up ? [
      {transform:'translateY(0) scale(1,1)'},
      {transform:'translateY(2px) scale(1.02,.98)',offset:.15},
      {transform:'translateY(-42%) scale(1,1)',offset:.9},
      {transform:'translateY(-42%) scale(1,1)'}
    ] : [
      {transform:'translateY(-42%) scale(1,1)'},
      {transform:'translateY(0) scale(1,1)',offset:.74},
      {transform:'translateY(2px) scale(1.03,.97)',offset:.86},
      {transform:'translateY(0) scale(1,1)'}
    ];
    await Promise.all([
      tween(img,frames,up?260:180,reduced),
      tween(shade,[{opacity:up?.3:.14,transform:`scaleX(${up?1:.62})`},
        {opacity:up?.14:.3,transform:`scaleX(${up?.62:1})`}],up?260:180,reduced)
    ]);
    img.style.transform = up ? 'translateY(-42%)' : 'translateY(0)';
    shade.style.opacity = up ? '.14' : '.3'; shade.style.transform = up ? 'scaleX(.62)' : 'scaleX(1)';
    if (isReduced(reduced)) fade(img);
  }
  // CSS cuts the flat corner away and grows a patterned underside along the same diagonal.
  // No optional frame loads: the fold remains registered through face changes and slow networks.
  function bend(card, mark, animated, reduced) {
    card.classList.add('has-drawn-fold');
    mark.classList.remove('drawn-fold');
    if (!animated || isReduced(reduced)) mark.classList.remove('bend-in');
    if (isReduced(reduced)) fade(mark);
  }
  function refreshBend(card, reduced) {
    const mark = card.querySelector('.bent-corner');
    if (mark) bend(card,mark,false,reduced);
  }
  globalThis.MinigameMotion = {art,arc,flip,lift,shadow,bend,refreshBend};
})();
