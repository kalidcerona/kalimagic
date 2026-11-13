'use strict';
  function supplyBagCard(card, item) {
    const field=item.id==='potion'?'potionCount':'refillCount',selector=`[data-shop-item="${item.id}"]`;
    const count=element('p',`가진 것 ${state[field]}개`,'shop-supply-count');count.dataset.supplyCount=item.id;card.append(count);
    const info=C.gemShopInfo(state,item.id);
    const buy=action('',()=>silkPurchase(buy,()=>C.gemShopInfo(state,item.id),()=>C.gemShopBuy(state,item.id),gemShop,selector),!info.available);
    buy.dataset.supplyBuy=item.id;buy.setAttribute('aria-label',`사기 · 실크 ${info.cost}`);
    buy.append(element('span','사기'),element('span',String(info.cost),'kit-price kit-price-silk'));card.append(buy);
    if(info.reason)card.append(element('small',info.reason,'shop-supply-buy-reason'));
    const skills=item.id==='refill'?D.skills:[null];
    for(const skill of skills){
      const id=skill&&skill.id,useInfo=C.gemShopUseInfo(state,item.id,id),label=skill?skill.name+' 충전':'쓰기';
      const use=action(label,()=>{
        const scroll=$('panelBody').scrollTop,now=C.gemShopUseInfo(state,item.id,id);
        if(!now.available){panelStatus(now.reason);return;}
        if(C.gemShopUse(state,item.id,id)){save();render();gemShop(scroll);}
      },!useInfo.available);
      use.dataset.supplyUse=item.id;use.dataset.skill=id||'';use.title=useInfo.reason;
      use.setAttribute('aria-label',label+(useInfo.reason?' · '+useInfo.reason:''));card.append(use);
      if(useInfo.reason)use.append(element('small',useInfo.reason,'shop-supply-reason'));
    }
  }
