'use strict';
  const D = window.GAME_DATA, C = window.Core;
  // U29: write-only-on-change guard. render() runs every frame and re-assigns the same text, attributes,
  // hidden flags and custom properties hundreds of times per second; skipping identical writes leaves the
  // resulting DOM unchanged but stops needless style invalidation. Each guard compares first and then delegates.
  (function installWriteGuards() {
    if (typeof Element === 'undefined' || Element.prototype.__u29) return;
    const define = (proto, name, make) => { const d = Object.getOwnPropertyDescriptor(proto, name); if (d && d.set) Object.defineProperty(proto, name, { ...d, set: make(d.set, d.get) }); };
    if (typeof Node === 'undefined' || typeof HTMLElement === 'undefined' || typeof CSSStyleDeclaration === 'undefined') return;
    define(Node.prototype, 'textContent', (set, get) => function (v) {
      if (this.nodeType === 1) {
        const text = v == null ? '' : String(v), first = this.firstChild;
        if (text === '' ? !first : first && first === this.lastChild && first.nodeType === 3 && first.data === text) return;
      }
      set.call(this, v);
    });
    define(HTMLElement.prototype, 'hidden', set => function (v) { if (this.hidden !== !!v) set.call(this, v); });
    // U35: the same guard for the other per-frame writers. classList.add/remove of a token that is already in (or absent from)
    // the list still re-writes the class attribute, which restyles the whole subtree (#audienceCard every frame at idle).
    if (typeof DOMTokenList !== 'undefined') {
      const add = DOMTokenList.prototype.add, remove = DOMTokenList.prototype.remove;
      DOMTokenList.prototype.add = function (...tokens) { if (tokens.every(t => this.contains(t))) return; return add.apply(this, tokens); };
      DOMTokenList.prototype.remove = function (...tokens) { if (!tokens.some(t => this.contains(t))) return; return remove.apply(this, tokens); };
    }
    define(Element.prototype, 'className', (set, get) => function (v) { if (typeof this.className === 'string' && this.className === String(v)) return; set.call(this, v); });
    define(HTMLElement.prototype, 'title', set => function (v) { if (this.title !== String(v)) set.call(this, v); });
    define(HTMLElement.prototype, 'tabIndex', set => function (v) { if (this.tabIndex !== Number(v)) set.call(this, v); });
    {
      // dataset.x = same value re-writes the data-x attribute (cells, goal strip, etc. every frame): one cached proxy per element.
      const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'dataset'), proxies = new WeakMap();
      if (d && d.get && typeof Proxy === 'function') Object.defineProperty(HTMLElement.prototype, 'dataset', { ...d, get() {
        let proxy = proxies.get(this);
        if (!proxy) { proxy = new Proxy(d.get.call(this), { set(target, key, value) { if (typeof key !== 'string' || target[key] !== String(value)) target[key] = value; return true; } }); proxies.set(this, proxy); }
        return proxy;
      } });
    }
    if (typeof HTMLButtonElement !== 'undefined') define(HTMLButtonElement.prototype, 'disabled', set => function (v) { if (this.disabled !== !!v) set.call(this, v); });
    const setAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if (!/^(src|srcset|href|xlink:href)$/i.test(name) && this.getAttribute(name) === String(value)) return;
      return setAttribute.call(this, name, value);
    };
    const setProperty = CSSStyleDeclaration.prototype.setProperty;
    CSSStyleDeclaration.prototype.setProperty = function (name, value, priority) {
      if (!priority && value != null && this.getPropertyValue(name) === String(value) && !this.getPropertyPriority(name)) return;
      return setProperty.call(this, name, value, priority);
    };
    Element.prototype.__u29 = true;
  })();
  // U35: shipped art is WebP (tools/webp-assets.py). Code and data keep the .png names; this one mapping swaps the
  // extension where a URL reaches the browser: img.src below and CSS url() written from JS (style.css names .webp directly).
  // PNG_KEEP lists art that stayed PNG because no WebP passed the quality floor (none at the moment).
  const PNG_KEEP = new Set([]);
  const assetUrl = value => {
    const text = String(value), match = /^(assets\/(?:ui\/)?[A-Za-z0-9_-]+)\.png$/.exec(text);
    return match && !PNG_KEEP.has(match[1]) ? `${match[1]}.webp` : text;
  };
  (function installWebpMapping() {
    if (typeof HTMLImageElement === 'undefined') return;
    const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (d && d.set && d.get) Object.defineProperty(HTMLImageElement.prototype, 'src', { ...d, set(value) { d.set.call(this, assetUrl(value)); } });
  })();
  const sound = (name, options) => window.Sfx && window.Sfx.play(name, options);
  // U36: layout reads (getBoundingClientRect, clientWidth) are cached for one frame. A late-game fight emits dozens of hit events per
  // frame and each one used to read the stage, board and audience rects right after DOM writes, forcing a style recalculation and layout
  // every time (about 1400 recalculations per second, 80 percent of the main thread). The loop clears the cache at the start of each frame.
  const geo = new Map();
  let wandOffset = null, geoAge = 0; // v4 U40: see updateWand; geoAge counts frames since the last geometry read (loop)
  const rectOf = el => { let r = geo.get(el); if (!r) { r = el.getBoundingClientRect(); geo.set(el, r); } return r; };
  const boardWidth = () => { let w = geo.get('board-cw'); if (w === undefined) { w = $('board').clientWidth; geo.set('board-cw', w); } return w; };
  let bestiaryTab = 'audiences', endingStep = 0, revealEnding = false;
  const assetCache = new Map();
  function assetImage(path) {
    if (!assetCache.has(path)) {
      const img = new Image(); img.addEventListener('error', () => { if (assetCache.get(path) === img) assetCache.delete(path); }, { once: true }); img.src = path; assetCache.set(path, img);
    }
    return assetCache.get(path);
  }
  // U29: low-priority idle prefetch of the next venue's images (background, crowd, headliner, audiences + happy faces).
  const prefetchQueue = [], prefetchDone = new Set(); let prefetchActive = 0, prefetchedFor = '';
  const prefetchPortraits = new Set(), prefetchScans = new Set();
  function prefetchPortraitScan(img, path) {
    if (!prefetchPortraits.has(path) || prefetchScans.has(path)) return;
    prefetchScans.add(path);
    const scan = () => {
      if (!img.naturalWidth || opaqueSprites.has(path)) return;
      const run = () => { try { opaqueSprite(img, path); } catch (_) { /* Keep the normal display fallback. */ } };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(run); else setTimeout(run, 0);
    };
    if (img.complete) scan(); else img.addEventListener('load', scan, { once: true });
  }
  function pumpPrefetch() {
    while (prefetchActive < 4 && prefetchQueue.length) {
      const path = prefetchQueue.shift();
      if (assetCache.has(path)) { prefetchPortraitScan(assetCache.get(path), path); continue; }
      const img = new Image(); img.fetchPriority = 'low'; img.decoding = 'async'; prefetchActive++;
      const done = () => { prefetchActive--; pumpPrefetch(); };
      img.addEventListener('load', done, { once: true }); img.addEventListener('error', () => { assetCache.delete(path); prefetchDone.delete(path); done(); }, { once: true });
      assetCache.set(path, img); img.src = path; prefetchPortraitScan(img, path);
    }
  }
  let prefetchWinSeen = false; const prefetchLoadAt = performance.now();
  function prefetchNextVenue(venueNumber) {
    const next = D.venues[venueNumber]; if (!next || prefetchedFor === next.slug) return;
    prefetchedFor = next.slug;
    const paths = [`assets/${next.venueAsset}`, next.crowdAsset && `assets/${next.crowdAsset}`];
    for (const a of [next.headliner, ...next.audiences]) {
      const base = audienceAsset(next, a), happy = base.replace(/\.png$/, '-happy.png'); paths.push(base, happy); prefetchPortraits.add(base); prefetchPortraits.add(happy);
    }
    for (const path of paths) if (path && !prefetchDone.has(path)) { prefetchDone.add(path); prefetchQueue.push(path); }
    const start = () => pumpPrefetch();
    if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 4000 }); else setTimeout(start, 1500);
  }
  // Crop transparent margins once per URL; face crops share the same alpha scan.
  const opaqueSprites = new Map();
  function opaqueSprite(source, path, face = false) {
    if (!opaqueSprites.has(path)) {
      opaqueSprites.set(path,{failed:true,full:path,face:path});
      const h=source.naturalHeight,w=source.naturalWidth===h*3?h:source.naturalWidth,scan=document.createElement('canvas');
      scan.width=w;scan.height=h;
      const context=scan.getContext('2d');context.drawImage(source,0,0,w,h,0,0,w,h);
      let pixels;try{pixels=context.getImageData(0,0,w,h).data;}catch(error){opaqueSprites.set(path,{failed:true,full:path,face:path});return path;}
      let left=w,top=h,right=-1,bottom=-1;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      if(right<left){left=top=0;right=w-1;bottom=h-1;}
      const bounds={left,top,width:right-left+1,height:bottom-top+1};
      const crop=(height)=>{const c=document.createElement('canvas');c.width=bounds.width;c.height=height;c.getContext('2d').drawImage(source,left,top,bounds.width,height,0,0,bounds.width,height);return c.toDataURL();};
      const facePart=/mingiri/.test(path)?.70:figureSize(path)==='small'?.52:.36;
      const faceHeight=Math.max(1,Math.round(bounds.height*facePart));let faceLeft=right,faceRight=left;
      for(let y=top;y<top+faceHeight;y++)for(let x=left;x<=right;x++)if(pixels[(y*w+x)*4+3]>16){faceLeft=Math.min(faceLeft,x);faceRight=Math.max(faceRight,x);}
      const face=document.createElement('canvas');face.width=Math.max(1,faceRight-faceLeft+1);face.height=faceHeight;
      face.getContext('2d').drawImage(source,faceLeft,top,face.width,faceHeight,0,0,face.width,faceHeight);
      opaqueSprites.set(path,{bounds,full:crop(bounds.height),face:face.toDataURL()});
    }
    return opaqueSprites.get(path)[face?'face':'full'];
  }
  // Base alpha size and the union envelope of all installed faces. Never fit an expression independently.
  const STAGE_AUDIENCE_METRICS = {
    "assets/case-closed.png":[128,180,128,200],
    "assets/aud-a1.png":[124,196,124,196],
    "assets/aud-a10.png":[164,210,164,210],
    "assets/aud-a100.png":[138,198,140,198],
    "assets/aud-a101.png":[153,198,162,198],
    "assets/aud-a102.png":[138,198,141,198],
    "assets/aud-a106.png":[176,233,176,233],
    "assets/aud-a107.png":[137,218,139,218],
    "assets/aud-a108.png":[174,203,181,203],
    "assets/aud-a109.png":[170,212,181,212],
    "assets/aud-a11.png":[124,204,138,204],
    "assets/aud-a110.png":[172,250,176,250],
    "assets/aud-a111.png":[147,216,149,216],
    "assets/aud-a12.png":[141,222,141,222],
    "assets/aud-a13.png":[153,232,153,232],
    "assets/aud-a14.png":[102,201,106,201],
    "assets/aud-a15.png":[138,232,139,232],
    "assets/aud-a16.png":[124,204,124,204],
    "assets/aud-a17.png":[106,207,107,208],
    "assets/aud-a18.png":[112,213,112,213],
    "assets/aud-a19.png":[131,211,132,212],
    "assets/aud-a2.png":[122,204,127,204],
    "assets/aud-a20.png":[110,228,116,228],
    "assets/aud-a21.png":[110,198,110,198],
    "assets/aud-a22.png":[121,232,121,232],
    "assets/aud-a23.png":[131,232,132,232],
    "assets/aud-a24.png":[119,232,120,232],
    "assets/aud-a25.png":[102,232,102,232],
    "assets/aud-a26.png":[138,232,138,232],
    "assets/aud-a27.png":[124,232,124,232],
    "assets/aud-a28.png":[143,207,144,208],
    "assets/aud-a29.png":[138,231,139,232],
    "assets/aud-a3.png":[123,216,123,216],
    "assets/aud-a30.png":[145,231,145,232],
    "assets/aud-a31.png":[114,232,114,232],
    "assets/aud-a32.png":[111,232,112,232],
    "assets/aud-a33.png":[105,232,105,232],
    "assets/aud-a34.png":[168,232,168,232],
    "assets/aud-a35.png":[161,221,163,221],
    "assets/aud-a36.png":[167,223,168,224],
    "assets/aud-a37.png":[156,208,172,208],
    "assets/aud-a38.png":[146,220,146,220],
    "assets/aud-a39.png":[172,221,188,221],
    "assets/aud-a4.png":[143,216,144,216],
    "assets/aud-a46.png":[120,198,129,198],
    "assets/aud-a5.png":[127,222,151,222],
    "assets/aud-a50.png":[144,198,177,198],
    "assets/aud-a54.png":[120,198,156,198],
    "assets/aud-a55.png":[126,198,141,198],
    "assets/aud-a59.png":[117,198,159,198],
    "assets/aud-a6.png":[134,216,136,216],
    "assets/aud-a60.png":[114,198,129,198],
    "assets/aud-a64.png":[114,198,147,198],
    "assets/aud-a65.png":[117,198,135,198],
    "assets/aud-a66.png":[135,198,144,198],
    "assets/aud-a7.png":[131,214,132,214],
    "assets/aud-a70.png":[111,198,138,198],
    "assets/aud-a71.png":[129,198,150,198],
    "assets/aud-a72.png":[129,198,168,198],
    "assets/aud-a76.png":[114,198,159,198],
    "assets/aud-a77.png":[123,198,153,198],
    "assets/aud-a78.png":[105,198,147,198],
    "assets/aud-a79.png":[120,198,165,198],
    "assets/aud-a8.png":[133,213,133,213],
    "assets/aud-a83.png":[126,198,162,198],
    "assets/aud-a84.png":[138,198,180,198],
    "assets/aud-a85.png":[126,198,180,198],
    "assets/aud-a86.png":[126,198,171,198],
    "assets/aud-a9.png":[163,232,164,232],
    "assets/aud-a90.png":[123,198,141,198],
    "assets/aud-a91.png":[129,198,162,198],
    "assets/aud-a92.png":[120,198,135,198],
    "assets/aud-a93.png":[123,198,150,198],
    "assets/aud-a94.png":[111,198,138,198],
    "assets/aud-a98.png":[141,198,146,198],
    "assets/aud-a99.png":[139,198,140,198],
    "assets/aud-blackcat.png":[142,190,142,190],
    "assets/aud-f-brother.png":[125,170,131,170],
    "assets/aud-f-mom.png":[133,184,136,184],
    "assets/aud-f-sister.png":[202,181,207,181],
    "assets/aud-future-kali.png":[175,216,186,216],
    "assets/aud-lecturenote-hecate.png":[161,196,162,198],
    "assets/aud-lecturenote-jung.png":[139,197,169,198],
    "assets/aud-lecturenote-serona.png":[168,198,183,198],
    "assets/aud-meetup-busan.png":[139,189,156,190],
    "assets/aud-meetup-changwon.png":[154,190,155,190],
    "assets/aud-meetup-cheonan.png":[146,198,150,198],
    "assets/aud-meetup-daegu.png":[154,197,156,198],
    "assets/aud-meetup-geoje.png":[150,197,151,198],
    "assets/aud-meetup-incheon.png":[136,189,158,190],
    "assets/aud-meetup-suwon.png":[137,189,138,190],
    "assets/aud-mingiri-dark.png":[248,232,248,248],
    "assets/aud-past-kali.png":[127,171,156,171],
    "assets/aud-perfect-kali.png":[217,212,221,213],
    "assets/aud-s1-classmate.png":[146,185,151,186],
    "assets/aud-s1-teacher.png":[149,194,150,194],
    "assets/aud-tutorial-ndd.png":[132,198,144,198],
    "assets/aud-tutorial-mingiri.png":[145,171,145,171],
    "assets/aud-tv1.png":[189,198,191,198],
    "assets/aud-tv2.png":[146,197,167,197],
    "assets/aud-tv3.png":[231,197,234,198],
    "assets/aud-tv4.png":[191,197,202,198],
    "assets/aud-tv5.png":[203,197,211,198],
    "assets/aud-tv6.png":[207,198,210,198],
    "assets/aud-young-kali.png":[209,216,212,216],
    "assets/headliner-card1412.png":[134,210,134,210],
    "assets/headliner-card1412-talk.png":[134,210,134,210],
    "assets/headliner-h1.png":[148,210,148,210],
    "assets/headliner-h10.png":[134,220,143,220],
    "assets/headliner-h11.png":[149,232,149,232],
    "assets/headliner-h12.png":[125,232,134,232],
    "assets/headliner-h13.png":[145,232,154,232],
    "assets/headliner-h2.png":[160,226,169,226],
    "assets/headliner-h3.png":[130,202,167,202],
    "assets/headliner-h4.png":[131,222,135,222],
    "assets/headliner-h5.png":[163,212,164,212],
    "assets/headliner-h6.png":[128,214,131,214],
    "assets/headliner-h7.png":[164,220,175,220],
    "assets/headliner-h8.png":[158,228,158,228],
    "assets/headliner-h9.png":[144,230,149,230],
    "assets/headliner-lecturenote-kim.png":[182,216,207,216],
    "assets/headliner-meetup-seoul.png":[151,190,177,190],
    "assets/headliner-tv.png":[134,216,173,216],
  };
