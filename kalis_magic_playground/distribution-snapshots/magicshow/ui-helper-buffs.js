'use strict';
  // Coordinates are stage-local so pixel scale stays integral at every viewport.
  const helperBuffViews=new Map(), helperBuffSheets=new Map();
  function helperBuffSheet(kind,part) {
    const key=kind+'-'+part;
    if(!helperBuffSheets.has(key))helperBuffSheets.set(key,PixelFxSheet.load('assets/fx/buff-'+key).catch(()=>null));
    return helperBuffSheets.get(key);
  }
  function helperBuffEvents(list) {
    for(const e of list){
      if(e.type==='helperBuffEnd')endHelperBuffView(e.kind);
      if(e.type==='helperBuffStart')startHelperBuff(e);
    }
  }
  function helperBuffHold() {
    return typeof paused==='function'&&paused();
  }
  function buffClass(node,name,on) {
    if(!node||!node.classList)return;
    node.classList.toggle(name,!!on);
  }
  function syncBuffMarks() {
    const kali=$('magicianMini');if(!kali)return;
    const kinds=[...helperBuffViews.values()].filter(v=>v.icon&&!v.ending).map(v=>v.kind);
    if(kinds.length){kali.dataset.buff=kinds.join(' ');delete kali.dataset.buffFade;buffClass(kali,'helper-buff-ending',false);} 
  }
  function fadeBuffOutline(kali,kinds) {
    delete kali.dataset.buff;
    if(!kinds.length||!kali.classList||typeof setTimeout!=='function'){delete kali.dataset.buffFade;buffClass(kali,'helper-buff-ending',false);return;}
    kali.dataset.buffFade=kinds.join(' ');
    kali.classList.add('helper-buff-ending');
    const token={};kali._buffFadeToken=token;
    setTimeout(()=>{if(kali._buffFadeToken!==token)return;kali.classList.remove('helper-buff-ending');delete kali.dataset.buffFade;},300);
  }
  function endHelperBuffView(kind) {
    const v=helperBuffViews.get(kind);if(!v||v.ending)return;
    v.ending=true;
    if(v.raf&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(v.raf);
    v.raf=0;
    v.nodes.forEach(n=>n.remove());helperBuffViews.delete(kind);
    const kali=$('magicianMini');if(!kali)return;
    const q=C.helperBuffs(state);
    const still=[...helperBuffViews.values()].filter(x=>x.icon&&!x.ending&&q[x.kind]);
    if(still.length){kali.dataset.buff=still.map(x=>x.kind).join(' ');buffClass(kali,'helper-buff-ending',false);return;}
    const ended=[kind];
    for(const other of [...helperBuffViews.values()]){
      if(other.ending)continue;
      other.ending=true;if(other.raf&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(other.raf);other.nodes.forEach(n=>n.remove());helperBuffViews.delete(other.kind);ended.push(other.kind);
    }
    fadeBuffOutline(kali,v.icon?ended:[]);
  }
  function buffStagePoint(node) {
    const stage=$('stage'),r=stage.getBoundingClientRect(),n=node.getBoundingClientRect();
    const sx=r.width/stage.offsetWidth,sy=r.height/stage.offsetHeight;
    return {x:(n.left+n.width*.5-r.left)/sx,y:(n.top+n.height*.45-r.top)/sy,h:n.height/sy};
  }
  function buffPosition(node,x,y,w,h) {
    const stage=$('stage'),band=$('showBand');
    x=Math.max(w/2,Math.min(stage.offsetWidth-w/2,x));
    y=Math.max(h/2,Math.min(stage.offsetHeight-h/2,y));
    if(band&&!band.hidden){
      const s=stage.getBoundingClientRect(),b=band.getBoundingClientRect(),scale=s.height/stage.offsetHeight;
      const top=(b.top-s.top)/scale,bottom=(b.bottom-s.top)/scale;
      if(y+h/2>top&&y-h/2<bottom){
        const above=top-h/2-3;
        y=above>=h/2?above:Math.min(stage.offsetHeight-h/2,bottom+h/2+3);
      }
    }
    node.style.left=(x-w/2)+'px';node.style.top=(y-h/2)+'px';
  }
  function ensureBuffIcon(v) {
    if(v.icon)return;
    const icon=document.createElement('img');icon.className='helper-buff-icon';icon.src='assets/kit/icon-buff-'+v.kind+'.webp';icon.alt=v.kind==='dmg'?'딜 업':'동전 업';
    $('stage').append(icon);v.nodes.push(icon);v.icon=icon;
    syncBuffMarks();
  }
  function startHelperBuff(e) {
    endHelperBuffView(e.kind);
    const helper=document.querySelector('#colleagues .colleague[data-index="'+e.index+'"]');
    if(!helper)return;
    const v={kind:e.kind,owner:state,at:C.helperBuffs(state).elapsed,helper,nodes:[],landed:false,sheets:null,raf:0};
    helperBuffViews.set(e.kind,v);
    Promise.all(['bless','missile','burst'].map(p=>helperBuffSheet(e.kind,p))).then(s=>{v.sheets=s;});
    const canvas=document.createElement('canvas');canvas.className='helper-buff-fx';canvas.dataset.kind=e.kind;
    canvas.width=64;canvas.height=64;canvas.setAttribute('aria-hidden','true');$('stage').append(canvas);v.nodes.push(canvas);v.canvas=canvas;
    const endpoint=canvas.cloneNode();endpoint.hidden=true;$('stage').append(endpoint);v.nodes.push(endpoint);v.endpoint=endpoint;
    ensureBuffIcon(v);
    if(!helperBuffHold())v.raf=requestAnimationFrame(()=>drawHelperBuff(v));
  }
  function drawHelperBuff(v) {
    if(helperBuffViews.get(v.kind)!==v)return;
    v.raf=0;
    if(helperBuffHold())return;
    const q=C.helperBuffs(state);
    if(state!==v.owner||!q[v.kind]||state.mode!=='fight'||state.resolved){endHelperBuffView(v.kind);return;}
    const t=(q.elapsed-v.at)/1000,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from=buffStagePoint(v.helper),to=buffStagePoint($('magicianMini'));
    const arrival=reduced?.6:1.6;
    ensureBuffIcon(v);
    const slot=v.kind==='dmg'?0:1;
    buffPosition(v.icon,to.x-16+slot*32,to.y+28,24,24);
    if(t>=arrival&&!v.landed){
      v.landed=true;
      const badge=element('span',v.kind==='dmg'?'딜 업':'동전 업','helper-buff-badge');badge.dataset.kind=v.kind;
      $('stage').append(badge);v.nodes.push(badge);v.badge=badge;
      const kali=$('magicianMini');
      if(!reduced&&kali.classList&&typeof setTimeout==='function'){kali.classList.add('helper-buff-arrive');setTimeout(()=>kali.classList.remove('helper-buff-arrive'),400);}
    }
    if(v.badge)buffPosition(v.badge,to.x-30+slot*60,to.y-to.h*.45-12,56,20);
    const canvas=v.canvas,ctx=canvas.getContext('2d');ctx.clearRect(0,0,64,64);
    let part,age,x=from.x,y=from.y;
    if(reduced){
      part=t<.3?0:t<.6?1:2;age=0;if(t>=.6){x=to.x;y=to.y;}
      canvas.style.opacity=String(Math.max(0,Math.sin(Math.min(1,(t% .3)/.3)*Math.PI)));
      canvas.hidden=t>=.9;
    }else{
      part=t<1?0:t<1.8?1:2;age=part===0?t:part===1?t-1:t-arrival;
      if(part===1){const u=Math.min(1,(t-1)/.6);x=from.x+(to.x-from.x)*u;y=from.y+(to.y-from.y)*u;}
      if(t>=arrival){part=2;age=t-arrival;x=to.x;y=to.y;}
      canvas.style.opacity=String(part===0?Math.min(1,t/.2,(1-t)/.3):1);
      canvas.hidden=t>=arrival+16/12;
    }
    if(v.sheets&&v.sheets[part]&&!canvas.hidden){
      const sheet=v.sheets[part],instance=sheet.new(32,32);
      if(reduced)instance.frame=sheet.meta.reducedFrame;else instance.update(Math.max(0,age));
      ctx.save();if(part===1&&to.x<from.x){ctx.translate(64,0);ctx.scale(-1,1);}instance.draw(ctx,2);ctx.restore();
    }
    const endpoint=v.endpoint,tail=!reduced&&t>=arrival&&t<1.8;
    endpoint.hidden=!(tail||reduced&&t>=.3&&t<.6);
    if(!endpoint.hidden){
      const ec=endpoint.getContext('2d');ec.clearRect(0,0,64,64);
      if(tail&&v.sheets&&v.sheets[1]){
        const trail=v.sheets[1].new(32,32);trail.update(t-1);ec.save();
        if(to.x<from.x){ec.translate(64,0);ec.scale(-1,1);}trail.draw(ec,2);ec.restore();
        endpoint.style.opacity=String(Math.max(0,(1.8-t)/.2));
      }else{ec.drawImage(canvas,0,0);endpoint.style.opacity=canvas.style.opacity;}
      buffPosition(endpoint,to.x,to.y,64,64);
    }
    buffPosition(canvas,x,y,64,64);
    v.raf=requestAnimationFrame(()=>drawHelperBuff(v));
  }
  function syncHelperBuffPresentation() {
    if(typeof state==='undefined'||!state||typeof C==='undefined'||!C.helperBuffs)return;
    const q=C.helperBuffs(state),hold=helperBuffHold();
    for(const kind of ['dmg','coin']){
      const on=!!(q[kind]&&state.mode==='fight'&&!state.resolved);
      const v=helperBuffViews.get(kind);
      if(!on){if(v)endHelperBuffView(kind);continue;}
      if(v&&v.owner!==state){endHelperBuffView(kind);continue;}
      if(!v){const index=kind==='dmg'?4:5;startHelperBuff({type:'helperBuffStart',kind,index});continue;}
      if(hold){if(v.raf&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(v.raf);v.raf=0;continue;}
      if(!v.raf)v.raf=requestAnimationFrame(()=>drawHelperBuff(v));
    }
  }
