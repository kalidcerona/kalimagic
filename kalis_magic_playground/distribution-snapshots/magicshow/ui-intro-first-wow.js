'use strict';
  // Opt-in only at newGame. Checkpoints reuse the validated bios string list.
  function firstWowEnabled() {
    return !state.u15.tutorial.done && state.u15.bios.includes('intro:v26') && !state.u15.bios.includes('intro:v26:complete') && !firstWowReplayActive();
  }
  function firstWowMemory() {
    return firstWowEnabled() && ['memory-living','memory-stages'].includes(chainMark()?.step);
  }
  function firstWowMemoryEnd() { return chainMark()?.step==='memory-living'?1:3; }
  function firstWowReplayActive() { return state.u15.bios.includes('intro:v26:replay'); }
  function firstWowStart(replay) {
    if(replay && firstWowEnabled()){
      const mark=chainMark();
      state.u15.bios.push(`intro:v26:return:${mark?.step||'-'}:${state.onboarding.panel}:${state.onboarding.step}:${mark?.line||0}`);
      state.u15.bios.push('intro:v26:facts:'+state.onboarding.facts.join(','),'intro:v26:replay');
    }
    if(replay || !firstWowEnabled()) return false;
    if(firstWowMemory()) return false;
    if(!state.onboarding.intro && !chainMark() && !state.u15.tutorial.active) {
      state.onboarding.intro=true;
      setChain('girl-fight',0);
      save(); render();
    }
    $('introStory').hidden=true;
    return true;
  }
  function startFirstWowMemory(step) {
    setChain(step,0);
    state.onboarding.panel=step==='memory-living'?0:2;
    introLine=0;introLineBeat=-1;
    save();
  }
  function firstWowAfterClear(step) {
    if(!firstWowEnabled() || step!=='girl-clear') return false;
    startFirstWowMemory('memory-living');
    return true;
  }
  function firstWowBeforeNdd() {
    if(!firstWowEnabled() || state.u15.bios.includes('intro:v26:stages')) return false;
    startFirstWowMemory('memory-stages');
    return true;
  }
  function finishFirstWowMemory() {
    if(!firstWowMemory()) return false;
    const living=chainMark().step==='memory-living';
    const key=living?'intro:v26:living':'intro:v26:stages';
    if(!state.u15.bios.includes(key))state.u15.bios.push(key);
    state.onboarding.intro=true;
    if(living)setChain('teacher-intro',0);
    else beginNdd();
    save(); render();
    return true;
  }
  function renderFirstWowChain(mark) {
    if(!firstWowEnabled())return false;
    if(firstWowMemory()){if($('introStory').hidden)startIntro(false);return true;}
    if(mark.step!=='girl-wow')return false;
    // Commit the next dialogue when the visible beat starts; reload cannot replay it.
    if(!tutorialMoment)tutorialWinMoment();
    if(tutorialMomentActive())return true;
    setChain('girl-clear',0);save();
    return true;
  }

  function firstWowIntroBeats() {
    if(!firstWowMemory())return D.onboarding.intro;
    return D.onboarding.intro.map((beat,index)=>{
      if(index!==firstWowMemoryEnd())return beat;
      const text=index===1?'그렇게 마술을 시작했어요.':'이제 다음 관객에게 보여 줄까요?';
      return {...beat,lines:[...beat.lines,{speaker:'칼리',text}]};
    });
  }

  function finishFirstWowReplay() {
    if(!firstWowReplayActive())return false;
    const saved=state.u15.bios.find(k=>k.startsWith('intro:v26:return:'))?.split(':')||[];
    const facts=state.u15.bios.find(k=>k.startsWith('intro:v26:facts:'))?.slice('intro:v26:facts:'.length)||'';
    state.u15.bios=state.u15.bios.filter(k=>k!=='intro:v26:replay'&&!k.startsWith('intro:v26:return:')&&!k.startsWith('intro:v26:facts:'));
    state.onboarding={intro:true,panel:Number(saved[4])||0,step:Number(saved[5])||0,facts:facts?facts.split(','):[]};
    setChain(saved[3]&&saved[3]!=='-'?saved[3]:'girl-fight',Number(saved[6])||0);
    save();render();
    return true;
  }
