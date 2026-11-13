'use strict';
  // Pure presentation/affordability query; legality is still checked by useSkill.
  function skillInfo(state,id) {
    var base=DATA.skills.find(function(k){return k.id===id;});
    if(!base)return null;
    var node=DATA.tree.find(function(n){return n.skillUpgrade&&n.skillUpgrade.base===id;});
    var upgrade=node&&node.skillUpgrade,owned=!!(node&&state.tree[node.id]>0);
    var paid=owned&&state.gems>=upgrade.fee;
    return {id:id,baseName:base.name,name:paid?upgrade.name:base.name,
      desc:owned?upgrade.desc:base.desc,upgradeName:upgrade?upgrade.name:null,
      nodeId:node?node.id:null,owned:owned,paid:paid,fallback:owned&&!paid,
      fee:paid?upgrade.fee:0,usageFee:owned?upgrade.fee:0,
      variant:paid?node.id:null,factor:paid?upgrade.factor:0,cooldown:skillCooldown(state,id)};
  }
  function paidSkillSweep(state,factor,ev) {
    var power=wandDamage(state)*factor,length=state.board.length,audience=state.audId,board=state.board;
    state._skillBatch=true;
    try {
      for(var i=0;i<length;i++) {
        if(state.audId!==audience||state.board!==board||state.resolved||state.mode!=='fight')break;
        damageCell(state,i,power,ev,'active');
      }
    } finally {state._skillBatch=false;}
    if(state.audId===audience&&state.audHp<=0&&!state.resolved)onWin(state,ev);
  }
