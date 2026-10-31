'use strict';
  function events(list) {
    for(const e of list.filter(e=>e.type==='batchD')){
      if(e.kind==='interference'||e.kind==='lock'||e.kind==='hide')toast(e.kind==='hide'?'🙈 케이스 내용이 잠시 가려져요':'🔒 케이스 하나가 잠시 잠겨요. 다른 케이스를 열어 주세요');
      if(e.kind==='encoreEnd')toast(e.success?'앙코르 성공! 추가 동전을 받았어요':'앙코르 종료. 기본 보상은 그대로예요');
      if(e.kind==='sideWin'){const def=D.batchD.stages[e.side],script=D.storyReview.ifRoute[def.script];showBatchDLines(def.name,[...(script.winLine?[{speaker:def.character,text:script.winLine,mood:'happy'}]:[]),...script.afterClear],()=>{if(e.side==='young')startBatchDSide('mirror');});} // v6 script: the opponent's win line first
      if(e.kind==='sideLoss'){const def=D.batchD.stages[e.side],miss=def&&D.storyReview.ifRoute[def.script].missLine;if(miss)toast(def.character+' · '+miss);toast('다시 준비해도 괜찮아요. 무대 지도에서 재도전해요');}
      save();
    }
    for (const [id,,message] of Guidance.firstEffects(state,list)) {
      state.guidance.seen.push(id); toast(message);
      sceneLight(.04);
      save();
    }
    const recentBadges = events.recentBadges || (events.recentBadges = new Map());
    const opens = new Map();
    list.filter(e => e.type === 'boxBreak').forEach(e => {
      const key = e.openId == null ? e.cell : e.openId;
      if (!opens.has(key)) opens.set(key, []);
      opens.get(key).push(e);
    });
    for (const items of opens.values()) {
      const stack = U5.badgeStack(items), p = cellCenter(items[0].cell);
      const incoming = stack.badges.map(b => {
        const recent = recentBadges.get(b.cell);
        // Retain merge history briefly after the 350ms pill has flown away.
        if (!badges.some(old => old.cell === b.cell) && recent && recent.effect === b.effect && clock - recent.at < 400) {
          b = U5.effectBadge({ ...b, value: recent.value + b.value });
        }
        return { ...b, x: p.x, y: p.y, width: U5.badgeWidth(104), start: clock,
          image: assetImage(`assets/item-${b.itemId==='water-glass'?'chicken':b.itemId}.png`) };
      });
      badges = U5.capBadges(badges, incoming);
      for (const b of incoming) {
        const shown = badges.find(old => old.cell === b.cell);
        recentBadges.set(b.cell, { effect: b.effect, value: shown.value, at: clock });
      }
    }
    let levelShown=false;
    const hitMaxDoubt=state.audHpMax;
    // s4e2 F: when this batch clears a stage (a reward card follows), its achievements and set completions go on that card as one line.
    const lastReward=list.filter(e=>e.type==='stageReward').at(-1),rewardNotes=lastReward?[]:null;
    let hitSource=list.find(e=>e.type==='skill')?.id || (list.some(e=>e.type==='dove')?'dove':'card');
    for (const e of list) {
      if(e.type==='colleague')colleagueTrick(e);
      if(e.type==='itemLand')hitSource=particleSource(e);
      if(e.type==='dove')hitSource='dove';
      if(e.type==='skill') {hitSource=e.id;const r=rectOf($('audience')),stage=rectOf($('stage'));const p={x:(r.left+r.width/2-stage.left)/scale,y:(r.top+r.height*.65-stage.top)/scale};hitParticles(p.x,p.y,e.id,'#eac568',2);if(e.id==='showtime')sceneLight(.04);}
      if (typeof tutorialSignal === 'function') {
        const signal={boxBreak:'badge',audHit:'doubt',heckle:'heckle',win:'win'}[e.type];
        if (signal) tutorialSignal(signal);
      }
      if(e.type==='tutorialLessonFail'){failure=0;failureAudience=null;failureVenue=null;clearDecorations();showFailure();save();}
      if(e.type==='caseLevelUp')haptic(15);
      if(e.type==='skill'||e.type==='visitorCatch')haptic(40);
      if(e.type==='homecomingAct'||e.type==='phase2'||e.type==='theaterPhase2'||(e.type==='win'&&C.isHeadliner(D.venues[e.venue-1],e.j)))haptic([30,40,30]);
      if(e.type==='outfit'){renderOutfit();banner('새 무대 의상!',['','거실 티셔츠','무대 정장','우주 망토'][e.tier]);sound('milestone');const p=target('mental');burst(p.x,p.y,'#ffe65c');$('magicianMini').classList.add('outfit-sparkle');setTimeout(()=>$('magicianMini').classList.remove('outfit-sparkle'),650);save();}
      if(e.type==='trueFanReveal'){banner('숨은 도전 발견! 열렬한 찐팬','도감에서 새로운 도전을 확인해 보세요',false,true);sound('milestone');save();}
      if(e.type==='travelResult'){save();toast(e.success?`도전 성공!${e.gems?' 실크 +'+e.gems+(state.u18.paid.length*1<=C.CHALLENGE_CAP*100?' · 마술 실력 +1%':''):''}`:'도전 종료 · 다시 도전할 수 있어요');openStageMap();}
      if(e.type==='routine')showRoutine(e.id);
      if(e.type==='futurePhase'){sound('finisher');endRoutine();if(e.phase===3)animate($('audience'),[{opacity:0},{opacity:1}],650);}
      if(e.type==='futureWin'){banner('미래의 나','다음 한 장은 네 몫이야');sound('ending');if(state.mental<state.mentalMax*CLOSE_WIN)closeWinMoment();}
      if(e.type==='setBonus'&&rewardNotes){rewardNotes.push(e.slug==='collection'?'칼리 컬렉션 세트 완성':`${C.venueBySlug(e.slug).name} 세트 완성`);save();}
      else if(e.type==='setBonus'){banner(e.slug==='collection'?'칼리 컬렉션 세트 완성!':'관객 세트 완성!',e.slug==='collection'?'연출 +10%':`${C.venueBySlug(e.slug).name} · 마술 실력 +3%`);sound('milestone');save();}
      if(e.type==='visitorCatch'){const r=$('eventVisitor').getBoundingClientRect(),stage=$('stage').getBoundingClientRect(),p={x:(r.left+r.width/2-stage.left)/scale,y:(r.top+r.height/2-stage.top)/scale};burst(p.x,p.y,'#ffe65c');toast(e.reward==='power'?'30초 마술 실력 ×2':e.reward==='coins'?`동전 +${C.formatNumber(e.amount)}`:'책 +1');sound('event');save();}
      if (e.type === 'stageReward') {
        showStageReward(e.reward,e.gems,e===lastReward?rewardNotes:null);
      }
      if (e.type === 'magicHit') {
        const p=cellCenter(e.cell); squash(e.cell);
        if(e.helper==='sponge')spongeImpact(e,p);
        if(e.helper==='cardthrow')impactSprite(p,'🃏','card-impact','assets/proj-card.png');
      }
      if(e.type === 'magicCoins'){const p=cellCenter(e.cell);coinStream(p.x,p.y,e.coins);}
      if(e.type === 'spotlight'){
        const beam=element('div','','spotlight-beam');beam.style.top=`${160+8+e.row*120}px`;$('stage').append(beam);setTimeout(()=>beam.remove(),600);
      }
      if(e.type === 'paperFlash'){sceneLight(.05);sound('finisher');}
      if(e.type === 'bossMirror')toast('의심의 거울 · 연쇄와 도우미가 열어 줘요');
      window.dispatchEvent(new CustomEvent('magicshow:event', { detail: e }));
      if (e.type === 'heckleTelegraph') heckleWarn = upcomingHeckleBig();
      const sounds = { crit: 'crit', golden: 'golden', goldenBreak: 'golden', comboMilestone: 'milestone', encore: 'encore', boxBreak: 'box', combo: 'combo', audHit: 'hit', finisher: 'finisher', heckleTelegraph: 'heckle', fail: 'failure' }; // s4e2 F: a win claps in clearMoment instead of the coin sound
      if (sounds[e.type] && !(e.type === 'audHit' && e.blocked) && !(e.type === 'heckleTelegraph' && !heckleWarn)) sound(sounds[e.type], { combo: e.n, auto: !pointer.held && ['boxBreak','combo','audHit'].includes(e.type) });
      if (e.type === 'heckle' && e.dmg > e.shieldDmg) sound('mental', { gain: heckleLandsBig(e) ? 1 : .32 });
      if (e.type === 'itemLand' && e.effect === 'coins') sound('coin');
      if (e.type === 'crit') audSurprisedUntil = clock + 500;
      if (e.type === 'boxHit') squash(e.cell);
      if (e.type === 'boxBreak') {
        if (e.source === 'manual') kaliPose(1,400);
        squash(e.cell);
        const p = cellCenter(e.cell);
        const rarity = D.items.rarities.find(r => r.id === e.rarity);
        const color = rarity ? rarity.color : '#ffe35b';
        hitParticles(p.x,p.y,particleSource(e),color); sound('whoosh', { auto: !pointer.held });
        if (typeof breakMoment === 'function') breakMoment(p.x, p.y, color); // tests run this block in a vm without the effect helpers

        coinStream(p.x, p.y, 1);
        if (e.gem) fly(p.x, p.y, target('gems'), '🧣');
      } else if (e.type === 'unlockReveal') {
        const labels = { slot: ['새 케이스 자리!', '옆자리에서도 마술을 시작해요'], area: ['지팡이가 넓어졌어요!', '여러 케이스를 한 번에 두드려요'], dove: ['마술 비둘기 등장!', '관객에게 날아가 감탄을 더해요'], rabbit: ['마술 토끼 등장!', '주머니에서 동전을 꺼내줘요'], boxHelper: ['팬들이 일을 도와요!', '케이스를 돌아가며 두드려요'], assistant: ['마술 어시스턴트 등장!', '황금 케이스 작업도 맡겨요'], equip: ['마술용품 해금!', '소품 3개 놓기 · 같은 종류가 더 잘 나와요'] };
        banner(...(labels[e.id] || ['숨은 비법 발견!', D.tree.find(n => 'hidden:' + n.id === e.id)?.name || '새 비법을 확인하세요']), true, true); save();
      } else if (e.type === 'comboMilestone') {
        toast(`액트 ${e.threshold}! 피날레 +${e.gauge} · 동전 +${rounded(e.coins)}`);
      } else if (e.type === 'golden') {
        const p = cellCenter(e.cell); burst(p.x, p.y, '#ffe65c'); toast('황금 케이스! 희귀 이상 소품과 추가 동전');
      } else if (e.type === 'goldenBreak') {
        toast(`금빛 사례 +${C.formatNumber(e.coins)}`);
      } else if (e.type === 'achievement' && rewardNotes) {
        const info = C.achievementInfo(state, e.id); rewardNotes.push('🏅 ' + (info ? info.name : e.id));
      } else if (e.type === 'achievement') {
        const info = C.achievementInfo(state, e.id);
        const pct = Math.round(((info && info.bonus) || 0) * 1000) / 10;
        toast(`🏅 ${info ? info.name : e.id} · 마술 실력 +${pct}%${e.gems?` · 실크 +${e.gems}`:''}`);
      } else if (e.type === 'encore') {
        banner('피버 타임!',`${e.duration / 1000}초 · 마술 실력 ×${(2 * (state.tree.encore ? 1 + C.nodeEffects(state).encorePower : 1)).toFixed(1)} · 자동 개봉 속도 +25%`);
      } else if (e.type === 'worker' && e.phase === 'work') {
        squash(e.cell); const host=workerActors[e.workerId];if(host)animate(host.querySelector('.asset-sprite')||host,[{transform:'translateY(0)'},{transform:'translateY(2px)'},{transform:'translateY(0)'}],140);sound('worker', { auto: true });const p=cellCenter(e.cell);float('+'+rounded(e.dmg),p.x-20,p.y,'#89d8c1',11);
      } else if (e.type === 'crit') {
        const p = cellCenter(e.cell);
        if(numbers.length>=caps.numbers)numbers.shift();float('결정타',p.x,p.y-12,'#eac568',14,2);numbers[numbers.length-1].critical=true;hitParticles(p.x,p.y,'critical','#E8BF68',2);sceneLight(.06);
      } else if (e.type === 'dove') {
        helperMotion('dove', target('damage'));
        sound('whoosh', { auto: true });
      } else if (e.type === 'rabbit') {
        fly(1174, 660, target('coins'), '🐰', '토끼', '#ffe35b');
        coinStream(1174, 660, e.coins); sound('coin');
        statFloat('coins', e.coins);
      } else if (e.type === 'flash') {
        const p = cellCenter(e.cell);
        burst(p.x, p.y, '#ffbd73');
        const phoneDrop = typeof document !== 'undefined' && !!(document.body && document.body.classList.contains('phone'));
        fly(p.x, p.y, (portraitLayout() || phoneDrop) ? portraitDropTarget('damage') : target('damage'), '🔥', '플래시 페이퍼', '#ffbd73');
        sceneLight(.05); sound('whoosh');
      } else if (e.type === 'audHit') {
        if (!e.blocked && e.dmg > 0) trailDoubt(events.finaleHit && e.source !== 'colleague' && $('finaleFx')?._impact ? FINALE_LAND : 0);
        if (events.finaleHit && e.source !== 'colleague') { events.finaleHit = false; if (typeof showFinaleNumber === 'function') showFinaleNumber(e.dmg); }
        else if(e.source==='colleague'){if(!e.blocked)colleagueHitFx(e);}
        else hitFeedback(e,hitSource,e.presentationMaxDoubt||hitMaxDoubt);
      } else if (e.type === 'itemLand') {
        statFloat(e.effect, e.value);if(e.effect!=='damage'){const p=target(e.effect);hitParticles(p.x,p.y,hitSource,'#eac568');}
      } else if (e.type === 'finisher') {
        if (typeof firstUseHint === 'function') firstUseHint('finale'); // s5t: the first finale
        events.finaleHit = true; events.finaleDmg = e.dmg; if (typeof playFinale === 'function') playFinale();
        if (!$('finaleFx')?._impact) audSurprisedUntil = clock + 600; // s4e2 E: a full finale surprises the audience when the cards land (finaleImpact)
      } else if (e.type === 'heckleTelegraph') {
        const v = D.venues[state.venue - 1], a = typeof fightAudience === 'function' ? fightAudience(v, state.j) : C.audienceAt(v, state.j);
        const ifSide = D.batchD.stages[state.batchD.side], ifLines = ifSide && D.storyReview.ifRoute[ifSide.script].fightLines; // v6 script: IF fights heckle with their own lines
        const own = ifLines && ifLines.length ? ifLines : typeof tutorialSpeakerLines === 'function' ? tutorialSpeakerLines() : null, hk = own ? 'tutorial:' + own[0] : a.id; // s5t (read-through bug 4)
        const line = own ? U5.selectHeckle({ heckles: own }, own, lastHeckles.get(hk)) : U5.selectHeckle(a, venueHeckles(state.venue), lastHeckles.get(a.id));
        if(line){lastHeckles.set(hk,line);queueAudienceLine(line,'heckle:'+state.fightMs,false,false,true);} $('heckle').textContent = line;
        audHeckleMood = D.lineFaces.moods['fight:'+a.id+':heckles:'+(a.heckles||[]).indexOf(line)]||D.lineFaces.faceMap.roleDefaults[a.role]||'doubt';
        moodSprite($('audience'),stageAudienceAsset(v,a),audHeckleMood);
      } else if (e.type === 'heckle') {
        const big = heckleLandsBig(e);
        if (e.shieldDmg > 0 && typeof popChip === 'function') { popChip($('statShield'), '막음', 'block', 200); trailMeter('statShield', 400); }
        if (e.dmg > e.shieldDmg && typeof popChip === 'function') {
          popChip($('statMental'), '-' + C.formatNumber(e.dmg - e.shieldDmg), 'hurt', 450);
          trailMeter('statMental', 450); if (big) { shakeMental(); kaliFlinch(); }
        }
        if (state.pattern === 'stealCoins') {
          for (let i = 0; i < 5; i++) fly(1230, 90, { x: 426 + i * 25, y: 320 }, '🪙', '', '#ffbd73', i * 25);
          patternPulse('동전을 가져갔어요');
        }
        if (big) animate($('audienceCard'),[{transform:'translateX(0)'},{transform:'translateX(2px)'},{transform:'translateX(-2px)'},{transform:'translateX(0)'}],120);
        heckleWarn = false;
      } else if (e.type === 'milestone') {
        const p=cellCenter(e.cell);milestonePop('새 경지 · 케이스 힘 ×2!',p);sound('milestone');
      } else if(e.type==='gloveDrop'){toast('🃏 칼리 덱 (자동 연습)을 얻었어요');sound('skill');

      } else if (e.type === 'autoPractice') { squash(e.cell);
      } else if (e.type === 'caseLevelUp') {
        const p = cellCenter(e.cell);
        float('LV UP!', p.x, p.y - 35, '#fff18a', e.tierChanged ? 56 : 32);
        sound(e.tierChanged ? 'caseTier' : 'caseLevel');
        if (e.tierChanged) { burst(p.x, p.y, '#fff18a'); squash(e.cell); }
      } else if (e.type === 'chain') {
        const a = cellCenter(e.from), b = cellCenter(e.to);
        // U36: at most 6 lightning lines at once (late game chains fire hundreds per second).
        if (document.querySelectorAll('.case-lightning').length < 6) {
          const line = element('div', '', 'case-lightning');
          Object.assign(line.style, {left: `${a.x}px`, top: `${a.y}px`, width: `${Math.hypot(b.x-a.x,b.y-a.y)}px`, transform: `rotate(${Math.atan2(b.y-a.y,b.x-a.x)}rad)`});
          $('stage').append(line); setTimeout(() => line.remove(), 180);
        }
      } else if (e.type === 'levelUp') {
        toast(`레벨 ${e.level}! 멘탈 회복`);
        if (!levelShown) { levelShown = true; levelUpMoment(); } // s4e2 G: once per batch (core can raise several levels at once)
      } else if (e.type === 'win') {
        if (absorbChainWin()) { sound('applause'); break; }
        prefetchWinSeen = true;
        if (typeof hitStop === 'function') hitStop(); // s4e2 F: the 120 ms hit stop belongs to the clearing hit
        const v = D.venues[e.venue - 1], a = C.audienceAt(v, e.j);
        const context = { ...U5.encounter(D.venues, state), venueSlug: v.slug, audId: a.id,
          encounterId: `${state.dimension}:${state.wins}:${state.fails}:${a.id}` };
        audience.restored=true;wonMoment = { v, a, context, pending:true,until:Infinity };
        // s4e2 F: a stage clear opens its curtain call right at 2500 ms (gapAfter 0), so the whole sequence keeps its old length.
        presentation.push({stageTransition:true,winner:true,minimum:2500,priority:100,gapAfter:e.trophy?0:undefined,start:item=>{wonMoment.pending=false;wonMoment.until=clock+2500;C.holdWinTransition(state,2500);
          const cheer=()=>{if(!wonMoment||wonMoment.v!==v)return;stageAudienceFace($('audience'),stageAudienceAsset(v,a),6);$('audienceLine').textContent=a.winLine;$('audienceLine').hidden=false;};kaliPose(2,2500);
          sceneLight(.06);
          const head=C.isHeadliner(v,e.j),progress=`관객 ${e.j}/${v.audiences.length+1}`;
          bannerActive={...context};$('banner').replaceChildren(document.createTextNode(winLine()));$('banner').append(element('small',progress+' · '+(head?v.headliner.defeatLine:'동전 +'+C.formatNumber(e.coins))+(e.gems?' · 실크 +'+e.gems:'')));$('banner').classList.add('win-banner');$('banner').hidden=false;
          const moment=clearMoment(head,e.coins,e.gems,cheer);
          item.end=()=>{moment.stop();dismissBanner();wonMoment=null;};
        }});
        if (e.trophy) {toast(`🏆 ${v.trophy} 획득!`, 'trophy');presentation.push({stageTransition:true,minimum:0,hold:true,priority:60,start:item=>{if(!openCurtainCall(v.slug))item.hold=false;else item.end=()=>{};}});}
        if (e.keys) toast('📕 관객 도감 완성! 책 1개');
        save();
      } else if (e.type === 'venueUnlocked') {
        if (e.name) banner(`${e.name} 도착!`, D.venues[e.venue - 1].arrivalLine || D.venues[e.venue - 1].intro, true, false, bannerContext(), true); save(); // hotel stage: the short arrival line (owner 10-26 answer 7)
      } else if (e.type === 'audience' && e.arrived && e.venue > 1 && !D.venues[e.venue - 1].invitation && !state.u18.anchor) {
        // hotel stage (owner 10-26 answer 7): every venue without an invitation gets its arrival banner too, with its own short line
        banner(`${D.venues[e.venue - 1].name} 도착!`, D.venues[e.venue - 1].arrivalLine || '', true, false, bannerContext(), true);
      } else if (e.type === 'fail') {
        if (absorbChainFail()) break;
        failure = e.reasonPct; failureCause = e.cause === 'damage' || e.cause === 'gate' || e.cause === 'stall' || e.cause === 'lastHeckle' ? e.cause : 'mental'; lastAudience = ''; release();
        showBoo(e); save();
      } else if (e.type === 'phase2') {
        phaseTransition();
      } else if (e.type === 'theaterPhase2') {
        // s5b: phase 1 is won. 앞줄 관객 smiles and says its own win line for a short beat (the show waits, paused()); then the subway memory
        // starts (renderU15, once per dimension) or, when it was seen, 밍기리 grows straight away (audience()).
        const face = D.venues[state.venue - 1].audiences.find(x => x.id === D.theaterPhases.face);
        state._theaterBeat = { until: clock + 1600, text: face?.winLine || '' };
        sound('applause'); kaliPose(2, 1600); sceneLight(.05); save();
      } else if (e.type === 'selfReconciliation') {
        openPanel('bossPhase', '나에게 보내는 박수');
        e.lines.forEach((line, i) => { const who = (D.story.revealSpeakers || [])[i]; $('panelBody').append(element('p', who ? who + ' · ' + line : line)); }); // s5t (read-through bug 6)
        const next=action('공연 이어가기', () => { menu=''; $('panel').hidden=true; previous=0; save(); });
        $('panelBody').append(next); next.focus();
      } else if (e.type === 'homecomingAct') {
        queueAudienceLine(e.line,'homecoming:'+e.act); patternPulse(e.line);
      } else if (['reviewApplause','jointApplause','heckleCancelled','curtainFinale'].includes(e.type)) {
        if (e.type === 'heckleCancelled') heckleWarn = false;
        const message={reviewApplause:'좋은 한 수였어요',jointApplause:'함께 만든 박수',heckleCancelled:'질문 대신 박수',curtainFinale:'마지막 인사'}[e.type];
        patternPulse(message); toast(`👏 ${message}`); sound('milestone');
      } else if (e.type === 'ending') {
        revealEnding = state.endings.length === 1; endingStep = 0; save();
      }
    }
    if (events.finaleHit) { if (typeof showFinaleNumber === 'function') showFinaleNumber(events.finaleDmg); events.finaleHit = false; }
  }
