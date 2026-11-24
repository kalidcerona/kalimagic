'use strict';
  // Read-only models. Evidence expires on reload and cannot imply a free upgrade.
  globalThis.FailureNextStep = (() => {
    const samples=new WeakMap(),receipts=new WeakMap();
    function observe(s,C) {
      if(s.mode!=='fight'||s.u15.tutorial.active)return;
      const pressure=C.gatePressure(s),g=s.u19b.gates[s.audId];
      if(!g||pressure<=0){samples.delete(s);return;}
      const signature=JSON.stringify([s.dimension,s.audId,s.fails,g,s.tree,s.level]);
      if(samples.get(s)?.signature===signature)return;
      samples.set(s,{signature,pressure,snapshot:JSON.parse(JSON.stringify(s))});
    }
    function failed(s,e,C) {
      receipts.delete(s);
      const sample=samples.get(s);samples.delete(s);
      if(!sample)return;
      const old=sample.snapshot,g=s.u19b.gates[e.audId],before=old.u19b.gates[e.audId];
      if(old.dimension!==s.dimension||old.audId!==e.audId||old.venue!==e.venue||old.fails+1!==s.fails||!g||!before)return;
      if((g.fails||0)!==(before.fails||0)+1||['prepared','need','studied','cleared'].some(k=>g[k]!==before[k]))return;
      // Compare the same actual pre-failure encounter, changing only the observed fail count.
      before.fails=g.fails;
      const after=C.gatePressure(old);
      if(sample.pressure>after)receipts.set(s,{before:sample.pressure,after,fails:s.fails,dimension:s.dimension});
    }
    function effect(preview) {
      if(!preview?.count)return '';
      const c=preview.changes||{};
      if(c.mentalMax?.delta>0)return '야유를 더 버틸 수 있어요';
      if(c.wandDamage?.delta>0||c.performance?.delta>0)return '관객의 의심을 더 빨리 줄여요';
      if(c.wandRate?.delta>0)return '케이스를 더 자주 두드릴 수 있어요';
      const labels={coinMultiplier:'동전 획득 배수',boardCapacity:'케이스 수',helperSpeed:'도우미 속도',areaCols:'타격 가로 범위',areaRows:'타격 세로 범위'};
      for(const [key,label] of Object.entries(labels))if(c[key]?.delta>0)return `${label}이 ${preview.after[key]}로 늘어요`;
      // Formula descriptions come from the real preview, never an invented benefit.
      if(preview.skillUpgrade)return preview.skillUpgrade.description.replace(/\n/g,' ');
      return '';
    }
    function model(s,D,C,cause) {
      const advice=Guidance.failure(s,D,C,cause),receipt=receipts.get(s);
      if(receipt&&receipt.fails===s.fails&&receipt.dimension===s.dimension)return {kind:'retry',text:'이번 실패로 관객의 압박이 줄었어요.',label:'바로 다시 도전',advice};
      const candidates=C.failureLessons(s,cause);
      for(const node of candidates){
        if(node.id.startsWith('gate:')){
          const info=C.failureLessonInfo(s,node.id),g=s.u19b.gates[node.id.slice(5)];
          if(g&&!g.studied&&!g.cleared&&s.coins>=info.cost)return {kind:'gate',node,text:`${node.name}을 배우면 이 관객의 압박을 줄여요.`,label:`${node.name} 배우러 가기`,advice};
          continue;
        }
        const info=C.nodeInfo(s,node.id);
        if(!info.purchasable)continue;
        const benefit=effect(C.treePreview(s,node.id,1));
        if(benefit)return {kind:'learn',node,text:`${node.name}을 배우면 ${benefit}.`,label:`${node.name} 배우러 가기`,advice};
      }
      const blocked=C.failureLessons(s,cause,true);
      for(const node of blocked){
        const info=node.id.startsWith('gate:')?C.failureLessonInfo(s,node.id):C.nodeInfo(s,node.id);
        const missing=Math.max(0,Math.ceil(info.cost-s[info.currency]));
        const walletOnly=node.id.startsWith('gate:')||/부족$/.test(info.blockedReason||'');
        if(missing>0&&Number.isFinite(missing)&&walletOnly){
          const currency={coins:'동전',keys:'책',gems:'실크',starlight:'비둘기'}[info.currency];
          if(currency)return {kind:'save',node,text:`${currency} ${C.formatNumber(missing)}을 더 모으면 ${node.name}을 배울 수 있어요.`,label:'다시 도전해 모으기',advice};
        }
      }
      return {kind:'retry',text:'배운 비법은 그대로예요. 다시 도전해 보세요.',label:'바로 다시 도전',advice};
    }
    return {observe,failed,model,effect};
  })();
