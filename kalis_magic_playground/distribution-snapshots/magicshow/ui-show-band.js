'use strict';
  // A compact show-only overlay finds an empty part of the scene, preferring
  // the floor. Only this band moves; actors, dialogue and meters retain their boxes.
  // Use conservative image bounds (including transparent margins) for clearance.
  function placeShowBand(band) {
    const scene=$('audienceCard'),stage=$('stage');
    if(!scene||!stage)return;
    const sr=stage.getBoundingClientRect(),area=scene.getBoundingClientRect();
    const sx=sr.width/stage.offsetWidth,sy=sr.height/stage.offsetHeight;
    const obstacles=[...document.querySelectorAll('#audienceLine,#audienceTail,.audience-name,.audience-nameplate,#audienceName,#stageStats,.act-tier-line,.doubt,.doubt-plate,#heckleMeter,.heckle-plate,#audience > img.asset-sprite,#magicianMini,#colleagues,#phoneTop,.topbar,#boardCard,#board,#activeSkills,.helper-buff-fx,.helper-buff-badge,.helper-buff-icon')]
      .filter(e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();return !e.hidden&&c.display!=='none'&&c.visibility!=='hidden'&&r.width>0&&r.height>0;})
      .map(e=>e.getBoundingClientRect());
    const copy=band.querySelector('.show-band-copy'),gap=2;
    // Try every obstacle edge across the whole scene, including the top strip.
    // Smaller forms are measured afresh; no other element's geometry is changed.
    for(const form of ['full','compact','icon-only']) {
      copy.textContent=form==='full'?band.dataset.full:band.dataset.bonus;
      copy.style.display=form==='icon-only'?'none':'';
      band.dataset.form=form;
      const r=band.getBoundingClientRect(),w=r.width,h=r.height;
      const xs=[area.left+gap,area.right-w-gap],ys=[area.bottom-h-gap,area.top+gap];
      for(const o of obstacles){xs.push(o.right+gap,o.left-w-gap);ys.push(o.top-h-gap,o.bottom+gap);}
      ys.sort((a,b)=>b-a);
      for(const y of ys)for(const x of xs){
        if(x<area.left+gap||x+w>area.right-gap||y<area.top+gap||y+h>area.bottom-gap)continue;
        if(obstacles.some(o=>x<=o.right+1&&x+w>=o.left-1&&y<=o.bottom+1&&y+h>=o.top-1))continue;
        band.dataset.placement='clear';
        band.style.left=(x-sr.left)/sx+'px';band.style.top=(y-sr.top)/sy+'px';
        return;
      }
    }
    // The gameplay bonus remains active even when there is no safe visual space.
    band.dataset.placement='unresolved';band.dataset.form='hidden';band.hidden=true;
  }
  function renderShowBand() {
    let band=$('showBand');
    if(!band) {
      band=element('div','','show-band');band.id='showBand';band.hidden=true;
      band.setAttribute('role','status');band.setAttribute('aria-live','polite');band.setAttribute('aria-atomic','true');
      $('stage').append(band);
    }
    const q=C.showSequence(state);
    const visible=q.phase==='show'&&!menu&&!state.u15.scene&&state.mode==='fight';
    if(visible && (band.dataset.routine!==q.id || band.dataset.revision!==String(q.revision))) {
      const routine=D.routines.find(r=>r.id===q.id),ability=D.bookLayout.routineAbilities.find(a=>a.id===q.id);
      const icon=element('span','','show-band-icon');icon.setAttribute('aria-hidden','true');alignRoutineIcon(icon,q.id);
      const copy=element('span',`${routine.name} · ${ability.name} ×${ability.multiplier}`,'show-band-copy');
      band.dataset.full=copy.textContent;band.dataset.bonus=`×${ability.multiplier}`;
      band.setAttribute('aria-label',copy.textContent);band.title=copy.textContent;
      band.replaceChildren(icon,copy);band.dataset.routine=q.id;band.dataset.revision=String(q.revision);
      // One short fade, including reduced motion. No slide, flash or looping art.
      if(typeof band.animate==='function')band.animate([{opacity:0},{opacity:1}],{duration:120});
    }
    band.hidden=!visible;
    if(visible)placeShowBand(band);
    if(!visible){delete band.dataset.routine;delete band.dataset.revision;}
  }
