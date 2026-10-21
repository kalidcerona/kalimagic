// Saved timer data stays independent of the UI and timing clock.
(() => {
  const COLORS = ['#e36a63', '#e8631f', '#e5ab50', '#7fae8f', '#7d9cc0', '#a990c9'];
  const DEFAULT_COLORS = { prep: COLORS[2], work: COLORS[1], rest: COLORS[3], setrest: COLORS[4], cool: COLORS[5] };
  const BUILTIN = [
    { name: '타바타 20/10',  v: { prep: 10, work: 20, rest: 10, rounds: 8,  cycles: 1, setrest: 60, cool: 0 } },
    { name: '타바타 4세트',  v: { prep: 10, work: 20, rest: 10, rounds: 8,  cycles: 4, setrest: 60, cool: 120 } },
    { name: 'HIIT 40/20',    v: { prep: 10, work: 40, rest: 20, rounds: 10, cycles: 1, setrest: 60, cool: 60 } },
    { name: '서킷 45/15',    v: { prep: 15, work: 45, rest: 15, rounds: 6,  cycles: 3, setrest: 90, cool: 120 } },
    { name: '매분 1분',      v: { prep: 10, work: 60, rest: 0,  rounds: 10, cycles: 1, setrest: 60, cool: 0 } },
  ];
  const limits = { prep: [0,3600], work: [1,3600], rest: [0,3600], rounds: [1,99], cycles: [1,20], setrest: [0,3600], cool: [0,3600] };
  function clamp(key, value) {
    const [min,max] = limits[key];
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? Math.round(number) : min));
  }
  let serial = 0;
  const id = () => 'timer-' + Date.now().toString(36) + '-' + (++serial).toString(36);
  function timer(input = {}) {
    if (!input || typeof input !== 'object') input = {};
    const source = { ...BUILTIN[0].v, ...input.v };
    const v = Object.fromEntries(Object.keys(limits).map(key => [key,clamp(key,source[key])]));
    return { id: input.id || id(), name: String(input.name || '타바타').slice(0,80), v,
      skipLast: input.skipLast !== false,
      optional: { cycles: v.cycles > 1, cool: v.cool > 0, ...input.optional },
      colors: Object.fromEntries(Object.entries(DEFAULT_COLORS).map(([key,color]) => [key, COLORS.includes(input.colors?.[key]) ? input.colors[key] : color])) };
  }
  function load(storage) {
    const read = (key, fallback) => { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } };
    const existing = read('tt.timers.v2', null);
    if (Array.isArray(existing)) return existing.map(timer);
    const opts = read('tt.opts', {});
    const timers = [timer({ name:'타바타', skipLast:opts.skipLast })];
    const cfg = read('tt.cfg', null);
    if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
      const legacy = timer({name:'이전 타이머',v:cfg,skipLast:opts.skipLast});
      if (Object.keys(limits).some(key => legacy.v[key] !== timers[0].v[key])) timers.push(legacy);
    }
    const mine = read('tt.mine', []);
    if (Array.isArray(mine)) for (const saved of mine) if (saved && typeof saved === 'object') timers.push(timer({...saved, skipLast:saved.skipLast ?? opts.skipLast}));
    // Never remove legacy keys, including when browser storage is full or unavailable.
    try { storage.setItem('tt.timers.v2', JSON.stringify(timers)); } catch {}
    return timers;
  }
  function save(timers, draft) {
    const next = timer(draft), index = timers.findIndex(item => item.id === next.id);
    return index < 0 ? [...timers,next] : timers.map((item,i) => i === index ? next : item);
  }
  function duplicate(timers, key) {
    const original = timers.find(item => item.id === key);
    return original ? [...timers,timer({...original,id:id(),name:original.name+' 복사'})] : timers;
  }
  const remove = (timers,key) => timers.filter(item => item.id !== key);
  function optional(draft,key,enabled) {
    const next = timer(draft);
    next.optional[key] = enabled;
    if (key === 'cycles') { next.v.cycles = enabled ? Math.max(2,next.v.cycles) : 1; next.v.setrest = enabled ? (next.v.setrest || 60) : 0; }
    if (key === 'cool') next.v.cool = enabled ? (next.v.cool || 60) : 0;
    return next;
  }
  window.TabataData = { COLORS, DEFAULT_COLORS, BUILTIN, clamp, timer, load, save, duplicate, remove, optional };
})();
