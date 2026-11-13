// Release 22: grade tables. Golden cases use their separate legacy reward path.
(function (D) {
  const items = [2, 3, 3, 4, 5, 6, 7];
  const low = [70, 22, 6, 2, 0, 0, 0], high = [2, 3, 5, 10, 45, 20, 15];
  const coin = [.8, .95, 1.1, 1.3, 1.6, 2, 2.6];
  const damage = [.85, 1, 1.1, 1.25, 1.45, 1.7, 2.1];
  function probabilities(fraction) {
    const f = Math.max(0, Math.min(1, Number(fraction) || 0));
    return low.map(function (p, i) { return p + (high[i] - p) * f; });
  }
  const reference = probabilities(.5);
  const hp = [1, 1.5, 2, 3, 4, 6, 9];
  const goldenHp = Math.pow(1.12, 14);
  const hpScale = goldenHp / reference.reduce(function (s, p, i) { return s + p / 100 * hp[i]; }, 0);
  const baseline = Math.pow(1.1, 14) * 2;
  // P9 retunes these constants: E[items * multiplier] = old LV15's 5 * 1.1^14 * 2.
  const coinScale = 5 * baseline / reference.reduce(function (s, p, i) { return s + p / 100 * items[i] * coin[i]; }, 0);
  const damageScale = 5 * baseline / reference.reduce(function (s, p, i) { return s + p / 100 * items[i] * damage[i]; }, 0);
  // The flat opening reward was level-independent: preserve its reference mean of one.
  const openingScale = 1 / reference.reduce(function (s, p, i) { return s + p / 100 * coin[i]; }, 0);
  D.caseGrades = {
    names: ['blue', 'violet', 'red', 'black', 'silver', 'rainbow', 'galaxy'],
    items: items, low: low, high: high, probabilities: probabilities,
    hp: hp.map(function (m) { return m * hpScale; }), hpScale: hpScale, goldenHp: goldenHp,
    coinScale: coinScale, damageScale: damageScale, openingScale: openingScale,
    coin: coin.map(function (m) { return m * coinScale; }),
    damage: damage.map(function (m) { return m * damageScale; }),
    opening: coin.map(function (m) { return m * openingScale; }),
    goldenItems: 5, goldenMultiplier: baseline
  };
})(GAME_DATA);

// P3b: replace the retired case nodes after all legacy prices and book patches.
(function (D) {
  const removed = ['caseMax', 'caseXp', 'caseStart', 'boxXP'];
  // Validation and the v23 refund still read these frozen prices, never the shop.
  D.legacyCaseNodes = D.tree.filter(n => removed.includes(n.id)).map(n => Object.assign({}, n, {retired:true, u31:true}));
  D.tree = D.tree.filter(n => !removed.includes(n.partOf || n.id));
  const gradeCosts = [40, 60, 80, 1000, 30000, 200000, 500000, 1000000, 2000000];
  const make = (id, name, max, cost, pre, x, y, desc) => ({id,name,max,cost,prereqs:[pre],x,y,desc,
    branch:'box',currency:'coins',reveal:'N',icon:'node-caselevel.png',emoji:'📦',pending:false,u31:true});
  const grade = make('caseGrade','행운의 카드',3,gradeCosts,'board',5,-1,'배울수록 좋은 등급의 케이스가\n나올 확률이 높아져요.');
  grade.levels = 9;
  grade.parts = ['caseGrade','caseGrade-2','caseGrade-3'];
  D.tree.push(grade);
  for (let i=1;i<3;i++) D.tree.push(Object.assign({},grade,{
    id:grade.parts[i],name:'행운의 카드 '+['II','III'][i-1],partOf:grade.id,partOffset:i*3,
    prereqs:[grade.parts[i-1]],x:5,y:-1-i,levels:undefined,parts:undefined
  }));
  D.tree.push(make('caseCoinBoost','황금 손길',3,[60,100,140],'prepared',8,2,'은색 이상 케이스에서 얻는 동전의 배수가 레벨마다\n2%씩 늘어요.'));
  D.tree.push(make('caseDmgBoost','무대 장악',3,[120,180,240],'caseCoinBoost',9,2,'은색 이상 케이스에서 나온 소품이 관객의 의심을\n줄이는 배수가 레벨마다 2.5%씩 늘어요.'));
  const chain = D.tree.find(n=>n.id==='chain4');
  Object.assign(chain,{prereqs:['caseGrade-3'],gate:null,cost:{c:6300000,g:1.5},x:6,y:-3});
  // Preserve slot numbers and the remaining lesson investment. Two slots disappear.
  D.bookLayout.slots = D.bookLayout.slots.filter(s=>s.slot!==53&&s.slot!==54);
  const slots = [
    [24,'황금 손길',['caseCoinBoost','caseDmgBoost'],['caseCoinBoost','caseDmgBoost']],
    [51,'행운의 카드',[...grade.parts,'chain4'],['caseGrade','chain4']],
    [52,'연습 노트',['lessonBias','lessonBias-2'],['lessonBias']]
  ];
  for (const [slot,name,ids,bases] of slots) Object.assign(D.bookLayout.slots.find(s=>s.slot===slot),{name,ids,bases});
  D.bookLayout.bookIds = D.bookLayout.slots.flatMap(s => s.ids);
  D.tree.find(n=>n.id==='lessonBias').prereqs = ['prepared'];
  D.tree.find(n=>n.id==='boxShield').prereqs = ['prepared'];
  // Named P3b effects are provisional; P9 owns numerical retuning.
  D.caseGrades.goodGrade = 5;
  D.caseGrades.coinBoostPerLevel = .02;
  D.caseGrades.damageBoostPerLevel = .025;
})(GAME_DATA);
