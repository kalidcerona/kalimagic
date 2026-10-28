'use strict';
  function renderMagic() {
    let layer=$('magicLayer');
    if(!layer){layer=element('div','','magic-layer');layer.id='magicLayer';$('stage').append(layer);}
    layer.hidden=paused();
    const actors=renderMagic.actors || (renderMagic.actors={balls:[],papers:[]});
    // U36: hidden flags are written once per frame (they used to be set true for every actor and then false again, two attribute writes each).
    for(let i=state.features.magic.balls.length;i<actors.balls.length;i++)actors.balls[i].hidden=true;
    for(let i=state.features.magic.papers.length;i<actors.papers.length;i++)actors.papers[i].hidden=true;
    state.features.magic.balls.forEach((b,i)=>{const ball=actors.balls[i] || (actors.balls[i]=element('img','','sponge-projectile'));ball.hidden=!portraitLayout()&&((renderMagic.bounces||{})[i]||0)>clock;if(!ball.__art){ball.src='assets/proj-sponge.png';ball.alt='스펀지볼';ball.__art=true;}const point=typeof phone !== 'undefined' && phone ? boardPoint(b.x,b.y) : {x:870+b.x,y:160+b.y};const half=portraitLayout()?14:16;ball.style.left=`${point.x-half}px`;ball.style.top=`${point.y-half}px`;if(!ball.dataset.mounted){layer.append(ball);ball.dataset.mounted="1";}});
    state.features.magic.papers.forEach((p,i)=>{const at=cellCenter(p.cell);let button=actors.papers[i];if(!button){button=action('플래시 페이퍼',()=>{events(C.tapPaper(state,Number(button.dataset.cell)));save();render();});button.addEventListener('pointerdown',e=>e.stopPropagation());button.addEventListener('pointerup',e=>e.stopPropagation());actors.papers[i]=button;}button.hidden=false;button.dataset.cell=p.cell;button.className='paper-drop';button.style.left=`${at.x-25}px`;button.style.top=`${at.y-25}px`;if(button.dataset.asset!=='assets/drop-flashpaper.png')sprite(button,'assets/drop-flashpaper.png');if(!button.dataset.mounted){layer.append(button);button.dataset.mounted="1";}});
    let parade=$('curtainCall');
    if(state.features.climax.left>0){
      if(!parade){parade=action('',()=>{C.skipCurtainCall(state);pendingIntro=null;save();render();});parade.id='curtainCall';parade.className='curtain-call';$('stage').append(parade);}
      const paradeVenues=D.venues.filter(v=>!v.mergedInto&&!['homecoming','future'].includes(v.headliner.bossProfile));
      const index=Math.min(paradeVenues.length-1,Math.floor((30000-state.features.climax.left)/(30000/paradeVenues.length)));
      const v=paradeVenues[index],h=v.headliner;
      if(parade.dataset.headliner!==h.id){parade.dataset.headliner=h.id;parade.replaceChildren();const art=element('img');art.src=audienceAsset(v,h);art.alt=h.name;
      parade.append(element('h2','커튼콜'),art,element('strong',h.name),element('p','모든 무대의 박수가 다시 모입니다. · 탭하여 마지막 공연 시작'));}
    }else if(parade)parade.remove();
  }
  function renderFeatures() {
    let hud = $('featureHud');
    if (!hud) {
      hud = element('div', '', 'feature-hud'); hud.id = 'featureHud';
      const goal = element('small'); goal.id = 'comboGoal'; $('statAct').append(goal);
      const encore = element('span'); encore.id = 'encoreStatus'; hud.append(encore);
      ($('helperControls') || $('stage')).append(hud);
    }
    const goal = C.nextComboGoal(state);
    $('comboGoal').textContent = goal ? `다음 ${goal.threshold} · 피날레 +${goal.gauge} · 동전 +${rounded(goal.coins)}` : state.tree.comboGift ? '이번 관객 액트 보상 완료' : '';
    const active = state.features.encoreLeft > 0;
    $('stage').classList.toggle('encore-active', !!active);
    const seconds = Math.ceil((active ? state.features.encoreLeft : state.features.encoreMs) / 1000);
    $('encoreStatus').textContent = active ? `피버 ${Math.ceil(state.features.encoreLeft/1000)}초` : `피버 ${Math.floor(state.u17.feverGauge)}%`;
    for (const id of ['dove', 'rabbit']) {
      const owned = state.tree[id];
      const host = helperActor(id); host.hidden = !owned;
      if (Number(host.dataset.busyUntil || 0) <= clock && host.dataset.asset !== `assets/helper-${id}-idle.png`) sprite(host, `assets/helper-${id}-idle.png`);
    }
    // U36: hide only the actors that are no longer in the list (they used to be hidden and shown again every frame).
    const liveActors = new Set(state.features.workers.actors.map(a => a.id));
    for (const id in workerActors) if (!liveActors.has(id)) workerActors[id].hidden = true;
    for (const actor of state.features.workers.actors) {
      const host = workerActor(actor.id, actor.role);
      host.hidden = false;
      const n = actor.role === 'fan' ? Number(actor.id.split('-')[1]) : 5;
      const origin = { x: 932 + n * 104, y: 826 };
      const dest = actor.cell >= 0 ? cellCenter(actor.cell) : origin;
      // Feet stay below and beside the percentage; a small sprite keeps it readable.
      const targetX = actor.phase === 'idle' ? origin.x : dest.x - 34;
      const targetY = actor.phase === 'idle' ? origin.y : dest.y + 28;
      host.style.left = `${origin.x - 20}px`; host.style.top = `${origin.y - 32}px`;
      const retarget=actor.phase==='move'&&(host.dataset.visualCell!==String(actor.cell)||host.dataset.lastPhase==='idle')||actor.phase==='idle'&&host.dataset.lastPhase&&host.dataset.lastPhase!=='idle';
      if(retarget){host.dataset.visualCell=String(actor.cell);host.dataset.visualAt=String(clock);host.dataset.fromX=host.dataset.offsetX||'0';host.dataset.fromY=host.dataset.offsetY||'0';host.dataset.visualX=String(targetX-origin.x);host.dataset.visualY=String(targetY-origin.y);}
      const progress=Math.max(0,Math.min(1,(clock-Number(host.dataset.visualAt||0))/750));
      const fromX=Number(host.dataset.fromX||0),fromY=Number(host.dataset.fromY||0);
      const x=fromX+(Number(host.dataset.visualX||0)-fromX)*progress,y=fromY+(Number(host.dataset.visualY||0)-fromY)*progress;
      host.dataset.offsetX=String(x);host.dataset.offsetY=String(y);host.style.transitionDuration='0ms';host.style.transform=`translate(${x}px,${y}px)`;
      host.classList.toggle('worker-travel',progress<1);host.dataset.action=actor.phase==='work'?'두드리는 중':'';
      if(host.dataset.arrived!=='1'&&progress===1){host.dataset.arrived='1';animate(host,[{marginTop:'0px'},{marginTop:'-3px'},{marginTop:'0px'}],180);}if(progress<1)host.dataset.arrived='0';
      host.classList.toggle('worker-work', actor.phase === 'work');
      host.classList.toggle('paused', state.features.workers[actor.role + 'Paused']);
      if (actor.phase === 'idle' && host.dataset.lastPhase && host.dataset.lastPhase !== 'idle') host.dataset.returnUntil = clock + 750;
      host.dataset.lastPhase = actor.phase;
      const phase = actor.phase === 'idle' && Number(host.dataset.returnUntil || 0) > clock ? 'move' : actor.phase;
      const path = `assets/helper-${actor.role}-${phase}.png`;
      if (host.dataset.asset !== path) sprite(host, path);
    }

  }
  function audienceBenefit(venue, a) {
    if (a !== venue.headliner) return `공략하면: 도감 완성 시 책 1개 · 연출 +${C.CONST.bestiaryDmg * 100}% · 멘탈 배율 +${C.CONST.bestiaryU * 100}%`;
    const reward = D.stageRewards.find(r => r.venueSlug === venue.slug);
    return `공략하면: 🏆 ${venue.trophy}${reward ? ' · ' + reward.effect.replace(/\n/g, ' · ') : ''}`;
  }
  function bestiary() {
    if (['boo','fail','dealer','headliner','ending','rebirth','bossPhase','curtain'].includes(menu)) return;
    openPanel('bestiary', bestiaryTab === 'equip' ? '마술용품' : D.ui.bestiaryTitle);
    panelTabs([['audiences','관객 도감'],['endings','엔딩 도감'],['achievements','업적'],['memories','추억'],['equip','마술용품'],['wardrobe','옷장']], bestiaryTab, tab => { bestiaryTab = tab; bestiary(); });
    if (bestiaryTab === 'wardrobe') { wardrobeBody(); return; }
    if(bestiaryTab==='memories'){for(const v of D.venues.filter(v=>uiSave.memories[v.slug]))$('panelBody').append(action(uiSave.memories[v.slug].title,()=>openCurtainCall(v.slug,true)));return;}
    if (bestiaryTab === 'endings') { drawArchive(); return; }
    if (bestiaryTab === 'equip') { equipPanel(); return; }
    if (bestiaryTab === 'achievements') { achievementPanel(); return; }
    const outfit=element('div','','outfit-collection');outfit.append(element('strong',`칼리 의상 · ${state.u18.equipped.kali?D.cosmetics.kali.find(x=>x.id===state.u18.equipped.kali).name:['','거실 티셔츠','무대 정장','우주 망토'][state.u14.outfit]}`));const strip=element('div','','outfit-preview'+(state.u18.equipped.kali==='future'?' future-suit':''));strip.style.backgroundImage=`url('${assetUrl(kaliArtPath())}')`;strip.append(element('span','🎩','sprite-glyph'));const image=assetImage(kaliArtPath()),art=nextArt(strip);const ready=()=>{if(strip._artGen!==art)return;strip.classList.remove('asset-pending');if(image.naturalWidth===768&&image.naturalHeight===256)strip.classList.add('art-loaded');else{strip.style.backgroundImage='none';strip.classList.add('asset-failed');}};if(image.complete)ready();else {strip.classList.add('asset-pending');image.addEventListener('load',ready,{once:true});image.addEventListener('error',ready,{once:true});}outfit.append(strip);$('panelBody').append(outfit);
    const routines=element('div','','routine-collection');routines.append(element('strong','나의 마술'));const learned=new Set(state.u19.routines);for(const r of D.routines){const known=learned.has(r.id);const item=element('span','',known?'routine-item':'routine-item routine-locked');item.title=known?r.name:'???';item.setAttribute('role','img');item.setAttribute('aria-label',known?r.name:'???');const icon=element('span','','routine-icon routine-frame');icon.style.backgroundImage=`url('${assetUrl(`assets/routine-${r.id}.png`)}')`;alignRoutineIcon(icon,r.id);item.append(icon,element('small',known?r.name:'???','routine-name'));routines.append(item);}$('panelBody').append(routines);
    // s4d (owner 10-24): the main-screen skill buttons show only icon and name, so each skill's full effect (what, how strong, how long, wait) lives here.
    const skillGuide=element('section','','skill-guide');skillGuide.append(element('strong','공연 스킬'));
    for(const k of D.skills){const open=C.skillUnlocked(state,k.id),row=element('article','','skill-guide-entry'+(open?'':' locked')),art=element('span','','skill-art');sprite(art,'assets/kit/'+{cardrain:'icon-card-rain',showtime:'icon-showtime',cheer:'icon-cheer'}[k.id]+'.webp');const copy=element('div','','skill-guide-copy');copy.append(element('b',open?k.name:`${k.name} · ${C.venueBySlug(k.clear).name} 무대를 마치면 열려요`));for(const line of k.desc.split('\n'))copy.append(element('p',line));row.append(art,copy);skillGuide.append(row);}
    $('panelBody').append(skillGuide);if(state.u19.cleared||state.u18.owned.kali.includes('future'))$('panelBody').append(element('p','🏅 미래의 나 · 다음 한 장을 건네받았다.'));
    const products=D.tree.filter(n=>n.branch==='collection'),owned=products.filter(n=>state.tree[n.id]>0).length,collection=element('p',`칼리 컬렉션 ${owned}/${products.length}${state.u14.collection?' · 연출 +10%':''}`);if(state.u14.collection)collection.prepend(artFallback('assets/icon-set-bonus.png','🎀','set-ribbon u14-art'));$('panelBody').append(collection,element('p',D.easyExtras.set,'easy-description'));
    const guides=element('section','','bestiary-guides');
    for(const [name,key,path] of [['NDD','tutorial','aud-tutorial-ndd-happy.png'],['밍기리','helper','aud-mingiri-dark-happy.png']]){if(key==='helper'&&!state.trophies.theater)continue;const card=element('article','','bestiary-guide');const art=element('span','','entry-emoji');art.append(element('span',key==='helper'?'👹':'🙎','sprite-fallback'));sprite(art,'assets/'+path);card.append(art,element('h3',name),element('p',D.storyV15[key].bio));guides.append(card);}
    const badges=element('div','','reward-badges');
    for(const r of D.stageRewards){const badge=element('figure','','reward-badge');const art=element('img');art.src=`assets/reward-${r.id}.png`;art.alt=r.effect;badge.classList.toggle('earned',state.features.rewards.includes(r.id));badge.append(art,element('figcaption',`${C.venueBySlug(r.venueSlug).name} · ${r.effect}`));badges.append(badge);} $('panelBody').append(badges);
    const list = element('div', '', 'bestiary-list');
    for (const venue of D.venues.filter(v=>!v.mergedInto&&(v.slug!=='future'||state.visited.includes('future')))) {
      const reached = state.visited.includes(venue.slug);
      const section = element('section', '', 'bestiary-venue');
      const set=C.venueSetProgress(state,venue.slug),setLine=element('p',`관객 세트 ${set.current}/${set.total}${set.complete?' · 마술 실력 +3%':''}`,'set-progress');if(set.complete)setLine.prepend(artFallback('assets/icon-set-bonus.png','🎀','set-ribbon u14-art'));
      const trophy = !!state.trophies[venue.slug];
      section.append(element('h2', reached ? `${venue.id}. ${venue.name} · 관객 ${venue.crowd}명` : `${venue.id}. 아직 도착하지 않은 무대`));
      section.append(setLine);
      if(state.u18.revealed){const p=C.trueFanProgress(state,venue.slug);section.append(element('p',`찐팬 ${p.current}/${p.total}${p.complete?' · 🎀 마술 실력 +5%':''}`,p.complete?'truefan-ribbon':'truefan-progress'));}
      if(reached)section.append(action('무대 지도',()=>openStageMap(venue.slug),!state.u18.map&&!C.travelAllowed(state)));
      if (!reached) {
        const silhouettes = element('div', '', 'bestiary-silhouettes');
        for (const a of [...venue.audiences.filter(a => !a.bench), venue.headliner]) {
          const known=state.knownAudiences.includes(a.id);
          const silhouette = element('span', known ? a.name : a.emoji);
          if(known) silhouette.title=a===venue.headliner ? D.ui.patterns[a.pattern] : a.flavor;
          else silhouette.setAttribute('aria-hidden', 'true');
          if(state.u18.revealed){const slot=element('small','🔒 찐팬','truefan-slot');slot.setAttribute('aria-label','잠긴 찐팬 · '+C.trueFanRule(venue.slug).label);silhouette.append(slot);}
          silhouettes.append(silhouette);
        }
        section.append(silhouettes, element('p', '앞 무대를 통과하면 공개돼요'));
      } else {
        if(venue.slug==='meetup'&&trophy){const memory=element('div','함께 마술하던 주말','meetup-memory');sprite(memory,'assets/memory-meetup.png');section.append(memory);}
        section.append(element('p', `🏆 ${venue.trophy} · ${trophy ? '획득' : '아직 도전 중'}`, trophy ? 'trophy earned' : 'trophy'));
        const grid = element('div', '', 'bestiary-grid');
        for (const a of [...venue.audiences.filter(a => !a.bench), venue.headliner]) {
          const head = a === venue.headliner;
          const rec = state.bestiary[a.id] || { wins: 0, extra: false, removed: false };
          const card = element('article', '', `bestiary-entry${rec.removed ? ' completed' : ''}`);
          const art = element('span', '', 'entry-emoji'); art.append(element('span', a.emoji, 'sprite-fallback')); if (rec.wins > 0 || (head && trophy)) happySprite(art, audienceAsset(venue, a)); else sprite(art, audienceAsset(venue, a));
          const portrait = element('div', '', 'entry-portrait'); portrait.append(art);
          card.append(portrait, element('h3', a.name), element('p', a.bio || a.flavor, 'entry-flavor'));
          if (head) {
            card.append(element('strong', '헤드라이너'), element('p', `박수 ${trophy ? '1 / 1' : '0 / 1'}`), element('p', `패턴: ${D.ui.patterns[a.pattern]}`), element('small', `보상: 🏆 ${venue.trophy}`));
          } else {
            const need = a.extra && a.extra.type !== 'none';
            const condition = need ? D.ui.extras[a.extra.type].replace('{value}', String(a.extra.value)) : '추가 조건 없음';
            card.append(element('strong', `감탄 ${Math.min(3, rec.wins)} / 3`), element('p', condition), element('small', need ? (rec.extra ? '✓ 추가 조건 달성' : '추가 조건 미달성') : '✓ 관객이 3번 감탄하면 완성'), element('small', `보상: 📕 책 1개 · ${rec.removed ? '획득' : '완성하면 획득'}`));
            if (rec.removed) portrait.append(element('span', '완전히 팬이 됨', 'fan-stamp'));
          }
          card.append(element('p', audienceBenefit(venue, a), 'audience-benefit'));
          if(head&&trophy)portrait.append(element('span','완전히 팬이 됨','fan-stamp'));
          if(state.u18.revealed){const done=state.u18.fans.includes(a.id),slot=element('div','',done?'truefan-slot earned':'truefan-slot');slot.append(element('strong',done?'🏅 열렬한 찐팬':'🔒 찐팬'),element('p',C.trueFanRule(venue.slug).label),element('small',state.u18.paid.includes(a.id)?'마술 실력 +1% 받음':'첫 성공 마술 실력 +1%','truefan-bonus'));slot.append(action('찐팬 도전',()=>startMapFight(venue.slug,a.id,'trueFan'),!C.beatenOnce(state,venue,a)||(!state.u18.map&&!C.travelAllowed(state))));card.append(slot);}
          grid.append(card);
        }
        section.append(grid);
      }
      list.append(section);
    }
    $('panelBody').append(list,element('h2','도우미 친구들','bestiary-guides-title'),guides);
  }
