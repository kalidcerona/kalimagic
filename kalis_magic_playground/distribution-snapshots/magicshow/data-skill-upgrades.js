// Optional tree keys reuse the established u31 compatibility mechanism.
(function (D) {
  const upgrades = [
    {id:'skillOilWater',base:'cheer',name:'오일 앤 워터',cost:40,fee:2,factor:1.5,slot:77,x:2,y:5,
      desc:'관객 호응보다 더 강력해진 대신, 사용할 때 실크 2개를 써요. 다음 야유를 한 번 막고 멘탈을 최대치의 10%만큼 회복해요. 동시에 모든 케이스를 현재 마술 실력의 1.5배 힘으로 한 번 두드려요. 실크가 부족하면 기존 관객 호응으로 사용해요.'},
    {id:'skillLinkingRings',base:'cardrain',name:'링킹 링',cost:60,fee:3,factor:4.5,slot:78,x:-5,y:5,
      desc:'카드 스프링보다 더 강력해진 대신, 사용할 때 실크 3개를 써요. 모든 케이스를 현재 마술 실력의 4.5배 힘으로 한 번 두드려요. 기존 카드 스프링보다 두드리는 힘이 50% 강해요. 실크가 부족하면 기존 카드 스프링으로 사용해요.'}
  ];
  upgrades.forEach(function(u) {
    const name='미래의 힘 · '+u.name;
    D.tree.push({id:u.id,name:name,desc:D.skills.find(k=>k.id===u.base).name+' 강화 · 사용 시 실크 '+u.fee+'개\n'+u.desc+' 배우면 이후 사용 시 실크를 자동으로 써요.',
      branch:'pet',icon:'node-pet-2.png',emoji:'🃏',max:1,currency:'gems',cost:[u.cost],prereqs:[u.base+'Cooldown'],
      reveal:'N',venueSlug:'galaxy',pending:false,u31:true,x:u.x,y:u.y,skillUpgrade:u});
    D.bookLayout.bookIds.push(u.id);
    D.bookLayout.slots.push({slot:u.slot,name:name,tab:'도우미',branch:'pet',ids:[u.id],bases:[u.id]});
  });
})(GAME_DATA);
