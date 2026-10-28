'use strict';
  function element(tag, text, className = '') {
    const el = document.createElement(tag); el.textContent = text; el.className = className; return el;
  }
  // v4 U46 A5: emoji and non-pixel symbols that show as UI icons are drawn as 16x16 pixel icons (assets/ui/ic-*.webp, img27) at integer scales.
  // 💎, 🔑 and the rabbit dealer entry keep their glyphs (owner: they become prop currencies later).
  // v4 U47 12: the heal item 'water-glass' keeps its code id; its picture is item-chicken (see the two item art paths above)
  // Alpha > 16 bounds of the second frame in assets/routine-*.webp (512 x 256).
  // Drawing a local image is allowed even when file:// forbids canvas reads/exports.
  const routineIconBounds = {
    bottles:[28,50,228,254], cards:[27,50,229,254], coins:[45,50,211,254],
    coloringbook:[58,50,197,254], cube:[43,50,192,254], cupsballs:[29,50,226,254],
    eggbag:[35,50,223,254], rings:[52,50,204,254], rope:[34,50,222,254],
    rubberband:[45,50,210,254], silk:[29,50,226,254], thumbtie:[55,50,212,254],
    wand:[52,50,205,254]
  };
  function alignRoutineIcon(icon, id) {
    const image = assetImage(`assets/routine-${id}.png`);
    const apply = () => {
      const bounds = routineIconBounds[id];
      if (!bounds || !image.naturalWidth) return;
      const [left,top,right,bottom] = bounds, width = right-left, height = bottom-top;
      const scale = Math.min(112/width,112/height);
      const canvas = document.createElement('canvas'); canvas.width=128; canvas.height=128;
      canvas.style.cssText='display:block;width:100%;height:100%;image-rendering:pixelated';
      canvas.setAttribute('aria-hidden','true');
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled=false;
      context.drawImage(image,256+left,top,width,height,(128-width*scale)/2,120-height*scale,width*scale,height*scale);
      icon.style.backgroundImage='none';
      icon.replaceChildren(canvas);
    };
    if (image.complete && image.naturalWidth) apply();
    else image.addEventListener('load',apply,{once:true});
  }
  const PX_ICONS = { '🧣': 'silk', '📕': 'magicbook', '🪙': 'coin', '🪄': 'wand', '🃏': 'card', '🛡': 'shield', '🥤': 'cup', '⚔': 'attack', '📣': 'megaphone', '⚡': 'bolt', '🎩': 'tophat', '☕': 'coffee', '📖': 'book', '📚': 'stats',
    '🔒': 'lock', '✓': 'check', '🏆': 'trophy', '🏅': 'medal', '❤': 'heart', '🕊': 'dove', '🐇': 'rabbit', '👏': 'clap', '🔴': 'sponge', '🔥': 'fire', '🔦': 'spotlight', '🔮': 'crystal', '✨': 'sparkle', '✦': 'star', '🌸': 'petal', '🪞': 'mirror', '🐰': 'rabbit' };
  // fixP 7: no assets/ui/ic-*.webp ships for these two (the flying icon fell back to the glyph after a 404; it still does, without the request).
  const PX_UI_UNSHIPPED = new Set(['silk','magicbook']);
  const PX_KIT_ART = {coin:'currency-coin',silk:'currency-silk',magicbook:'currency-book',book:'currency-book',dove:'currency-dove',lock:'icon-lock',check:'icon-checkmark',megaphone:'icon-boo',sparkle:'icon-sparkle',star:'icon-spark'};
  const PX_RE = new RegExp(`(${Object.keys(PX_ICONS).join('|')})\\uFE0F?`, 'u');
  function pxIcon(glyph) { const img = document.createElement('img'); img.className = 'px-icon'; img.src = PX_KIT_ART[PX_ICONS[glyph]] ? `assets/kit/${PX_KIT_ART[PX_ICONS[glyph]]}.webp` : `assets/ui/ic-${PX_ICONS[glyph]}.webp`; img.alt = ''; img.draggable = false; img.dataset.glyph = glyph; return img; }
  // Replaces the known glyphs in the text nodes under root (one pass; text without a glyph is left alone).
  function pxIcons(root) {
    if (!root || !PX_RE.test(root.textContent)) return root;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
    for (let n; (n = walk.nextNode());) if (PX_RE.test(n.nodeValue) && !n.parentElement?.closest('.sprite-fallback,.art-loaded,.entry-emoji,.cosmetic-icon,.constellation-icon,.asset-ready,.dealer-card')) list.push(n);
    for (const n of list) {
      const parts = n.nodeValue.split(new RegExp(PX_RE.source, 'gu')), frag = document.createDocumentFragment();
      // split with one capture group: even indexes are text, odd indexes are the glyph (an optional FE0F is dropped by the pattern)
      parts.forEach((part, i) => { if (i % 2) frag.append(pxIcon(part)); else if (part) frag.append(part); });
      n.replaceWith(frag);
    }
    return root;
  }
  // Sets an element's text with icons, touching the DOM only when the text changed.
  function pxText(el, text) { if (!el || el.dataset.pxText === text) return; el.dataset.pxText = text; el.textContent = text; pxIcons(el); }
  function action(text, handler, disabled = false) {
    const button = element('button', text); button.disabled = disabled; button.addEventListener('click', handler); return button;
  }
