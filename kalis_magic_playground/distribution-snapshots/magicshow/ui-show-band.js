'use strict';
  // A compact show-only overlay finds an empty part of the scene, preferring
  // the floor. Only this band moves; actors, dialogue and meters retain their boxes.
  // Use conservative image bounds (including transparent margins) for clearance.
  function showBandObstacles(includeSpeech=true) {
    return [...document.querySelectorAll(`${includeSpeech?'#audienceLine,#audienceTail,':''}.audience-name,.audience-nameplate,#audienceName,#stageStats,.act-tier-line,.doubt,.doubt-plate,#heckleMeter,.heckle-plate,#audience > img.asset-sprite,#magicianMini,#colleagues,#phoneTop,.topbar,#boardCard,#board,#activeSkills,.helper-buff-fx,.helper-buff-badge,.helper-buff-icon`)]
      .filter(e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();return !e.hidden&&c.display!=='none'&&c.visibility!=='hidden'&&r.width>0&&r.height>0;})
      .map(e=>e.getBoundingClientRect());
  }
  function placeShowBand(band) {
    const scene=$('audienceCard'),stage=$('stage');
    if(!scene||!stage)return;
    const sr=stage.getBoundingClientRect(),area=scene.getBoundingClientRect();
    const sx=sr.width/stage.offsetWidth,sy=sr.height/stage.offsetHeight;
    const obstacles=showBandObstacles();
    const copy=band.querySelector('.show-band-copy'),gap=2;
    // Try every obstacle edge across the whole scene, including the top strip.
    // Smaller forms are measured afresh; no other element's geometry is changed.
    for(const form of ['full','name-only']) {
      copy.replaceChildren(element('span',band.dataset.name,'show-band-name'));
      if(form==='full')copy.append(element('small',band.dataset.bonus,'show-band-bonus'));
      copy.style.display='';
      band.querySelector('.show-band-icon').hidden=form==='name-only';
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
    FailureNextStep.observe(state,C);
    let band=$('showBand');
    if(!band) {
      band=element('div','','show-band');band.id='showBand';band.hidden=true;
      band.setAttribute('role','status');band.setAttribute('aria-live','polite');band.setAttribute('aria-atomic','true');
      $('stage').append(band);
    }
    const q=C.showSequence(state);
    const visible=q.phase==='show'&&!menu&&!state.u15.scene&&state.mode==='fight'&&!paused()&&$('storyDialog').hidden;
    if(visible && (band.dataset.routine!==q.id || band.dataset.revision!==String(q.revision))) {
      const routine=D.routines.find(r=>r.id===q.id),ability=D.bookLayout.routineAbilities.find(a=>a.id===q.id);
      const icon=element('span','','show-band-icon');icon.setAttribute('aria-hidden','true');alignRoutineIcon(icon,q.id);
      const copy=element('span','','show-band-copy');
      band.dataset.name=`지금 마술 · ${routine.name}`;
      band.dataset.bonus=`${ability.name} ×${ability.multiplier}`;
      band.dataset.full=band.dataset.name+' · '+band.dataset.bonus;
      copy.textContent=band.dataset.full;
      band.setAttribute('aria-label',copy.textContent);band.title=copy.textContent;
      band.replaceChildren(icon,copy);band.dataset.routine=q.id;band.dataset.revision=String(q.revision);
      // Opacity follows the simulation clock, so pause and resume preserve the reading budget.
    }
    band.hidden=!visible;
    clearShowNameFallback();
    if(visible){
      const duration=D.showSequence.showMs,age=Math.max(0,duration-q.left);
      band.style.opacity=String(reduced?1:Math.max(0,Math.min(1,age/150,q.left/300)));
      placeShowBand(band);
      if(band.hidden)showNameFallback(band);
    }
    if(!visible){delete band.dataset.routine;delete band.dataset.revision;}
  }

  function clearShowNameFallback() {
    const line=$('audienceLine');
    if(line?.dataset.showName){
      if(line.textContent===line.dataset.showName){line.textContent='';line.hidden=true;}
      line.style.opacity=line.dataset.showOpacity||'';
      delete line.dataset.showOpacity;delete line.dataset.showName;
    }
  }
  function showNameFallback(band) {
    const line=$('audienceLine'),scene=$('audienceCard');
    if(!line||!scene||!line.hidden||line.textContent.trim()||
      (typeof bioCurrent!=='undefined'&&bioCurrent)||(typeof bioQueue!=='undefined'&&bioQueue.length))return;
    line.textContent=band.dataset.name;line.hidden=false;
    const r=line.getBoundingClientRect(),area=scene.getBoundingClientRect();
    const collides=showBandObstacles(false).some(o=>r.left<o.right&&r.right>o.left&&r.top<o.bottom&&r.bottom>o.top);
    if(!r.width||!r.height||r.left<area.left||r.right>area.right||r.top<area.top||r.bottom>area.bottom||collides){line.textContent='';line.hidden=true;return;}
    line.dataset.showName=band.dataset.name;
    line.dataset.showOpacity=line.style.opacity||'';line.style.opacity=band.style.opacity;
  }
