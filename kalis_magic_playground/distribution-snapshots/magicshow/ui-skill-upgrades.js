'use strict';
  function skillGuideText(k,info=C.skillInfo(state,k.id)) {
    const wait=`현재 대기 시간 ${Number((info.cooldown/1000).toFixed(2))}초. 준비 비법과 장비에 따라 줄어들어요.`;
    if(!info.owned)return k.desc+'\n'+wait;
    return `${info.baseName} → ${info.upgradeName}\n${info.desc}\n배운 뒤에는 실크가 충분하면 자동으로 사용해요. 케이스가 열려야 아이템이 나와 관객에게 피해를 줄 수 있어요.\n${k.id==='cheer'?'회복량은 회복 장비의 영향을 받아요.\n':''}${wait}`;
  }
  function renderSkillButton(k) {
    const el=$('skill-'+k.id),info=C.skillInfo(state,k.id),left=state.skills.cooldowns[k.id],ready=left<=0;
    const available=C.skillUnlocked(state,k.id),portrait=portraitLayout();
    el.hidden=!available&&!portrait;
    el.setAttribute('aria-disabled',String(!available||!ready||paused()||state.mode!=='fight'));
    const label=info.name+(info.fallback?' · 기본':'');
    const faceLabel=!info.owned&&portrait&&k.id==='cheer'?label.replace(' ','\n'):label;
    const face=portrait?{cardrain:'icon-card-rain',showtime:'icon-magic-hat',cheer:'icon-dove-summon'}[k.id]:{cardrain:'icon-card-rain',showtime:'icon-showtime',cheer:'icon-cheer'}[k.id];
    el.querySelector(':scope > span:not(.skill-art)').textContent=faceLabel;
    const art=el.querySelector('.skill-art');
    if(art.dataset.skillFace!==face){sprite(art,'assets/kit/'+face+'.webp');art.dataset.skillFace=face;}
    if(available&&ready&&state.mode==='fight'&&typeof firstUseHint==='function')firstUseHint('skill',info.name);
    el.classList.toggle('ready',ready);el.classList.toggle('skill-locked',!available&&portrait);
    el.classList.toggle('skill-upgraded',info.owned);el.classList.toggle('skill-fallback',info.fallback);
    el.classList.toggle('in-use',k.id==='showtime'&&state.skills.showtimeLeft>0);
    el.style.setProperty('--cooldown',`${Math.round(left/info.cooldown*360)}deg`);
    const status=!available&&portrait?'무대 해금':!ready?`${Math.ceil(left/1000)}초`:k.id==='showtime'&&state.skills.showtimeLeft>0?`${Math.ceil(state.skills.showtimeLeft/1000)}초`:'';
    const fee=info.fallback?'실크 부족 · 기본 사용':info.paid?`실크 ${info.fee}`:'';
    const guard=k.id==='cheer'&&state.skills.cheerGuard?'방어 준비':'';
    const small=el.querySelector('small');
    small.textContent=[fee,status].filter(Boolean).join('\n');
    if(!info.owned&&guard)small.textContent=guard;
    el.setAttribute('aria-label',[label,fee,status,guard].filter(Boolean).join(' · '));
    easyTooltip(el,skillGuideText(k,info)+(info.fallback?`\n${info.upgradeName}에 필요한 실크 ${info.usageFee}개가 부족해 기본 스킬을 써요.`:'')+(guard?'\n다음 야유 방어 준비':''));
  }
  // Cosmetic queue item: deliberately no skillNotice/hold, so gameplay never pauses.
  function skillUpgradeEffect(e) {
    if(!e.variant||!e.fee)return;
    const node=D.tree.find(n=>n.id===e.variant);
    if(!node?.skillUpgrade)return;
    const owner=state;
    presentation.push({minimum:600,gapAfter:0,priority:15,start:item=>{
      if(state!==owner)return;
      const host=element('div',node.name,'skill-upgrade-fx');host.setAttribute('role','status');
      if(!reduced){
        host.classList.add(e.id==='cheer'?'skill-oil-fx':'skill-rings-fx');
        const marks=element('i','','skill-upgrade-marks');marks.setAttribute('aria-hidden','true');
        marks.append(element('i'),element('i'));host.append(marks);
      }
      const links=[];
      if(!reduced&&e.id==='cardrain'&&typeof cellCenter==='function'){
        for(let i=1;i<Math.min(state.board.length,4);i++){
          const a=cellCenter(i-1),b=cellCenter(i),line=element('i','','skill-case-link');
          line.style.left=a.x+'px';line.style.top=a.y+'px';line.style.width=Math.hypot(b.x-a.x,b.y-a.y)+'px';
          line.style.transform='rotate('+Math.atan2(b.y-a.y,b.x-a.x)+'rad)';line.setAttribute('aria-hidden','true');
          $('stage').append(line);links.push(line);
        }
      }
      $('toasts').append(host);item.end=()=>{host.remove();links.forEach(line=>line.remove());};
    }});
  }
