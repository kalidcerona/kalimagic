'use strict';
  // Notebook entry rules are shared by UI, purchases, automation and failure advice.
  // Read levels directly: calling nodeInfo here would recurse into this predicate.
  var BOOK_ENTRY_BY_ID=Object.create(null);
  if(DATA.bookLayout)DATA.bookLayout.slots.forEach(function(slot){
    slot.ids.forEach(function(id,index){BOOK_ENTRY_BY_ID[id]={slot:slot,index:index};});
  });
  function bookOrder(state, id) {
    var node = NODE_BY_ID[id], layout = DATA.bookLayout;
    if (!node || !state || !state.tree) return {allowed:false,reason:'알 수 없는 비법'};
    if (!layout || nodeLevel(state,node)>0) return {allowed:true,reason:''};
    var entry=BOOK_ENTRY_BY_ID[id];
    if (!entry) return {allowed:true,reason:''};
    var slot=entry.slot,index=entry.index,rule=slot.entryRules&&slot.entryRules[id];
    if (!rule && (index<=0 || layout.stagePolicy.defaultEntry!=='previousMax')) return {allowed:true,reason:''};
    var previous=rule&&rule.previous||slot.ids[index-1],prior=NODE_BY_ID[previous];
    if (!prior) return {allowed:false,reason:'선행 비법 정보 없음'};
    var minimum=rule&&rule.minLevel,met=minimum!=null?storedLevel(state,prior)>=minimum:nodeLevel(state,prior)>=prior.max;
    return {allowed:met,reason:met?'':prior.name+' '+(minimum!=null?minimum+'레벨':'MAX')+' 필요'};
  }
