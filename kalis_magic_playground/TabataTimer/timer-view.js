(() => {
  const TYPES = Object.fromEntries(Object.entries({prep:'준비',work:'운동',rest:'휴식',setrest:'사이클 휴식',cool:'쿨다운'}).map(([key,label]) => [key,{label,voice:label,color:`var(--${key})`}]));
  const fmt = s => { s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
  const displayTime = s => s < 60 ? ':'+String(s).padStart(2,'0') : fmt(s);
  function build(c,skipLast = true) {
    const segs=[];
    if(c.prep>0) segs.push({type:'prep',dur:c.prep,round:0,cycle:1});
    for(let cy=1;cy<=c.cycles;cy++) {
      for(let r=1;r<=c.rounds;r++) {
        segs.push({type:'work',dur:c.work,round:r,cycle:cy});
        if(c.rest>0 && !(r===c.rounds && skipLast)) segs.push({type:'rest',dur:c.rest,round:r,cycle:cy});
      }
      if(cy<c.cycles && c.setrest>0) segs.push({type:'setrest',dur:c.setrest,round:c.rounds,cycle:cy});
    }
    if(c.cool>0) segs.push({type:'cool',dur:c.cool,round:c.rounds,cycle:c.cycles});
    let t=0; segs.forEach(s=>{s.start=t;t+=s.dur;}); return segs;
  }
  const totalOf = segs => segs.reduce((a,s)=>a+s.dur,0);
  function applyColors(timer) { for(const [key,color] of Object.entries(timer.colors)) document.documentElement.style.setProperty('--'+key,color); }
  function paintStrip(el,segs) {
    el.replaceChildren(...segs.map(s=>{const span=document.createElement('span');span.style.flex=String(s.dur/(totalOf(segs)||1));span.style.background=TYPES[s.type].color;return span;}));
  }
  function button(label,action,className='btn2') {
    const b=document.createElement('button'); b.type='button'; b.className=className;b.textContent=label;b.addEventListener('click',action); return b;
  }
  globalThis.TabataView = { TYPES, fmt, displayTime, build, totalOf, applyColors, paintStrip, button };
})();
