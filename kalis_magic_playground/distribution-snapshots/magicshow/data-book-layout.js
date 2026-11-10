// Book map: four arms from root (0,0). Coordinates only; costs, prereqs, reveal and gates stay as earlier files set them.
// UP (y < 0, |y| > |x|) attack. LEFT HP. DOWN active skills and helpers. RIGHT passive buffs.
// g2d (comb layout): each node sits in its arm's sector, never closer to the root than a parent, one node per cell.
// ui-book.js draws root children through an arm plate and a bus, any parent with more than 3 children as a comb,
// other edges as straight lines up to 2.1 cells. Solver, checker and preview: .runs-v5/g2/g2d, .runs-v5/g2/check-layout.cjs.
// Shop-only routines are never drawn; each still sits within 3.2 of its related node. autoLearn is retired and parked.
(function (D) {
  const at = {
    "root": [0, 0],
    "p-classic-collection-remastered": [8, -10],
    "p-kali-deck": [8, -9],
    "p-classic-collection-remastered-2": [7, -11],
    "p-trace": [8, -11],
    "p-target": [9, -11],
    "p-nao-card-tricks": [10, -11],
    "p-chameleon": [7, -10],
    "p-tin-case": [6, -11],
    "p-epiphany": [5, -12],
    "p-two-si-do": [6, -12],
    "p-slydini-silks": [7, -12],
    "p-trace2": [8, -12],
    "assistant": [7, 4],
    "power": [0, -5],
    "speed": [1, -5],
    "area": [0, -6],
    "area-2": [0, -7],
    "crit": [2, -5],
    "critRate": [3, -5],
    "critPower": [2, -6],
    "comboHold": [1, -7],
    "comboHold-2": [2, -8],
    "sweepFocus": [2, -7],
    "precision": [3, -6],
    "board": [4, 1],
    "board-2": [5, 0],
    "board-3": [6, 0],
    "spawn": [7, 1],
    "golden": [8, 0],
    "goldPity": [8, -1],
    "goldCoins": [9, -1],
    "prepared": [8, 1],
    "prepared-2": [9, 1],
    "boxXP": [8, 2],
    "boxShield": [-8, 2],
    "boxShield-2": [-9, 2],
    "boxHeal": [-8, 3],
    "boxHeal-2": [-8, 4],
    "mental": [-3, -2],
    "mental-2": [-4, -2],
    "attack": [-3, -4],
    "shieldCap": [-4, -1],
    "shieldCap-2": [-5, 0],
    "shieldValue": [-4, 1],
    "shieldValue-2": [-4, 2],
    "healValue": [-5, -4],
    "healValue-2": [-6, -4],
    "winHeal": [-6, -3],
    "levelHeal": [-4, -3],
    "openingShield": [-5, -2],
    "calm": [-5, -3],
    "coinLuck": [6, -5],
    "forceRemove": [7, -4],
    "forceRemove-2": [8, -3],
    "tip": [7, -6],
    "tip-2": [8, -6],
    "dealerCoin": [8, -4],
    "jackpot": [8, -5],
    "gemFind": [8, -7],
    "equip": [9, -8],
    "slotPlus": [10, -8],
    "slotPlus-2": [11, -8],
    "lessonBias": [10, -7],
    "lessonBias-2": [11, -6],
    "dove": [-6, 7],
    "rabbit": [-6, 8],
    "flash": [-7, 8],
    "doveTempo": [-5, 8],
    "dovePower": [-4, 9],
    "rabbitTempo": [-5, 9],
    "rabbitPurse": [-6, 9],
    "boxHelper": [6, 2],
    "helperTempo": [7, 3],
    "startFinale": [-1, -3],
    "finalePower": [-1, -5],
    "finalePower-2": [-1, -6],
    "finaleNeed": [-2, -6],
    "finaleNeed-2": [-3, -6],
    "comboGift": [-2, -5],
    "comboValue": [-3, -5],
    "encore": [-2, -7],
    "encorePower": [-3, -7],
    "encorePower-2": [-4, -7],
    "encoreSpan": [-2, -8],
    "encoreSpan-2": [-2, -9],
    "challenge": [-1, -8],
    "starTrick": [2, -3],
    "starTrick-2": [3, -4],
    "starTrick-3": [4, -5],
    "starGuard": [-3, 0],
    "starGuard-2": [-3, 1],
    "starGuard-3": [-3, 2],
    "starTempo": [1, -3],
    "starTempo-2": [1, -4],
    "starTempo-3": [2, -4],
    "starBounty": [3, 0],
    "starBounty-2": [3, -1],
    "starBounty-3": [3, -2],
    "caseMax": [5, -1],
    "caseMax-2": [5, -2],
    "caseMax-3": [5, -3],
    "caseMax-4": [5, -4],
    "caseMax-5": [6, -4],
    "caseStart": [6, -1],
    "caseXp": [6, -2],
    "chain4": [6, -3],
    "chain8": [7, -3],
    "chainPower": [7, -2],
    "hidden-hand": [4, -6],
    "hidden-box": [8, -2],
    "hidden-heart": [-6, -2],
    "hidden-luck": [11, -7],
    "hidden-pet": [8, 3],
    "sponge": [5, 7],
    "spongeCount": [5, 8],
    "spongeCount-2": [5, 9],
    "spongeSpeed": [7, 8],
    "spongePower": [6, 8],
    "cardthrow": [3, 5],
    "cardthrowCount": [-1, 6],
    "cardthrowSpeed": [1, 6],
    "cardthrowPower": [0, 6],
    "tipbox": [-1, 3],
    "tipboxSpeed": [-2, 3],
    "tipboxPower": [-1, 4],
    "tipboxPower-2": [-1, 5],
    "flashpaper": [4, 5],
    "flashpaperChance": [4, 6],
    "flashpaperChance-2": [4, 7],
    "flashpaperPower": [3, 6],
    "flashpaperPower-2": [2, 7],
    "crystal": [-3, 4],
    "crystalSpeed": [-2, 5],
    "crystalPower": [-3, 5],
    "crystalPower-2": [-3, 6],
    "water": [-4, 6],
    "waterSpeed": [-4, 7],
    "waterPower": [-3, 7],
    "waterPower-2": [-2, 8],
    "spotlight": [0, 4],
    "spotlightCount": [1, 4],
    "spotlightSpeed": [1, 5],
    "spotlightPower": [0, 5],
    "fanPower": [7, 6],
    "nightShow": [8, 7],
    "nightShow-2": [9, 6],
    "manager": [7, 2],
    "autoPractice": [2, 3],
    "autoPractice-2": [2, 4],
    "showtimeCooldown": [6, 7],
    "cardrainCooldown": [-5, 6],
    "cheerCooldown": [1, 3],
    "colleague": [7, 5],
    "colleagueMore": [8, 5],
    "colleaguePower": [8, 6],
    "colleagueTempo": [8, 4],
    "colleagueTempo-2": [9, 3],
    "routine-rings": [5, -6],
    "routine-rope": [-1, -7],
    "routine-thumbtie": [1, -6],
    "routine-cards": [2, 6],
    "routine-coins": [7, -5],
    "routine-cupsballs": [4, 8],
    "routine-bottles": [-5, 7],
    "routine-silk": [-5, -1],
    "autoLearn": [80, 80],
    "routine-eggbag": [7, -7],
    "routine-rubberband": [1, -8],
    "routine-coloringbook": [9, -7],
    "routine-cube": [3, -7],
    "routine-wand": [0, -4]
  };
  for (const n of D.tree) {
    const p = at[n.id];
    if (!p) throw new Error('book layout: no cell for ' + n.id);
    n.x = p[0]; n.y = p[1];
  }
})(GAME_DATA);

// Release 21 P0: declarative contract for later packets, not purchase or combat logic.
// Keep the legacy coordinates above until the book UI packet consumes these stable slots.
(function (D) {
  const slots = [
    {"slot":1,"name":"첫 주문","tab":"시작","branch":"root","ids":["root"],"bases":["root"]},
    {"slot":2,"name":"클래식 콜렉션 리마스터 1편","tab":"컬렉션","branch":"collection","ids":["p-classic-collection-remastered"],"bases":["p-classic-collection-remastered"]},
    {"slot":3,"name":"칼리 덱","tab":"컬렉션","branch":"collection","ids":["p-kali-deck"],"bases":["p-kali-deck"]},
    {"slot":4,"name":"클래식 콜렉션 리마스터 2편","tab":"컬렉션","branch":"collection","ids":["p-classic-collection-remastered-2"],"bases":["p-classic-collection-remastered-2"]},
    {"slot":5,"name":"트레이스","tab":"컬렉션","branch":"collection","ids":["p-trace"],"bases":["p-trace"]},
    {"slot":6,"name":"타겟","tab":"컬렉션","branch":"collection","ids":["p-target"],"bases":["p-target"]},
    {"slot":7,"name":"Nao Card Tricks","tab":"컬렉션","branch":"collection","ids":["p-nao-card-tricks"],"bases":["p-nao-card-tricks"]},
    {"slot":8,"name":"카멜레온","tab":"컬렉션","branch":"collection","ids":["p-chameleon"],"bases":["p-chameleon"]},
    {"slot":9,"name":"틴 케이스","tab":"컬렉션","branch":"collection","ids":["p-tin-case"],"bases":["p-tin-case"]},
    {"slot":10,"name":"에피파니 Vol.1 리마스터","tab":"컬렉션","branch":"collection","ids":["p-epiphany"],"bases":["p-epiphany"]},
    {"slot":11,"name":"두 에스 아이 두","tab":"컬렉션","branch":"collection","ids":["p-two-si-do"],"bases":["p-two-si-do"]},
    {"slot":12,"name":"슬라이디니 실크","tab":"컬렉션","branch":"collection","ids":["p-slydini-silks"],"bases":["p-slydini-silks"]},
    {"slot":13,"name":"트레이스2","tab":"컬렉션","branch":"collection","ids":["p-trace2"],"bases":["p-trace2"]},
    {"slot":14,"name":"도우미 상점 오픈","tab":"도우미","branch":"pet","ids":["autoLearn"],"bases":["autoLearn"],"displayNames":{"autoLearn":"도우미 상점 오픈"}},
    {"slot":15,"name":"손기술","tab":"표현력","branch":"hand","ids":["power"],"bases":["power"]},
    {"slot":16,"name":"빠른 손놀림","tab":"표현력","branch":"hand","ids":["speed"],"bases":["speed"]},
    {"slot":17,"name":"넓은 지팡이","tab":"표현력","branch":"hand","ids":["area","area-2"],"bases":["area"]},
    {"slot":18,"name":"타이밍","tab":"표현력","branch":"hand","ids":["crit","critRate","critPower","precision"],"bases":["crit","critRate","critPower","precision"],"entryRules":{"critPower":{"previous":"critRate","minLevel":1}}},
    {"slot":19,"name":"루틴 연결","tab":"표현력","branch":"hand","ids":["comboHold","comboHold-2","sweepFocus"],"bases":["comboHold","sweepFocus"]},
    {"slot":20,"name":"케이스 자리","tab":"케이스","branch":"box","ids":["board","board-2","board-3"],"bases":["board"]},
    {"slot":21,"name":"소품 세팅","tab":"케이스","branch":"box","ids":["spawn"],"bases":["spawn"]},
    {"slot":22,"name":"황금 초대","tab":"케이스","branch":"box","ids":["golden","goldPity","goldCoins"],"bases":["golden","goldPity","goldCoins"],"displayNames":{"goldCoins":"황금의 축복"}},
    {"slot":23,"name":"미리 푼 매듭","tab":"케이스","branch":"box","ids":["prepared","prepared-2"],"bases":["prepared"]},
    {"slot":24,"name":"케이스 연구","tab":"케이스","branch":"box","ids":["boxXP","lessonBias","lessonBias-2"],"bases":["boxXP","lessonBias"]},
    {"slot":25,"name":"실크 포장","tab":"케이스","branch":"box","ids":["boxShield","boxShield-2","boxHeal","boxHeal-2"],"bases":["boxShield","boxHeal"]},
    {"slot":26,"name":"무대 배짱","tab":"마음가짐","branch":"heart","ids":["mental","mental-2"],"bases":["mental"]},
    {"slot":27,"name":"연출력","tab":"표현력","branch":"heart","ids":["attack"],"bases":["attack"]},
    {"slot":28,"name":"담력","tab":"마음가짐","branch":"heart","ids":["shieldCap","shieldCap-2","shieldValue","shieldValue-2"],"bases":["shieldCap","shieldValue"]},
    {"slot":29,"name":"든든한 한 입","tab":"마음가짐","branch":"heart","ids":["healValue","healValue-2","winHeal"],"bases":["healValue","winHeal"],"entryRules":{"winHeal":{"previous":"healValue","minLevel":1}}},
    {"slot":30,"name":"연습의 보람","tab":"마음가짐","branch":"heart","ids":["levelHeal","openingShield","calm"],"bases":["levelHeal","openingShield","calm"]},
    {"slot":31,"name":"모자 속 동전","tab":"동전","branch":"luck","ids":["coinLuck"],"bases":["coinLuck"]},
    {"slot":32,"name":"포스","tab":"동전","branch":"luck","ids":["forceRemove","forceRemove-2","dealerCoin","jackpot"],"bases":["forceRemove","dealerCoin","jackpot"]},
    {"slot":33,"name":"감사의 팁","tab":"동전","branch":"luck","ids":["tip","tip-2","gemFind"],"bases":["tip","gemFind"]},
    {"slot":34,"name":"마술용품","tab":"동전","branch":"luck","ids":["equip"],"bases":["equip"]},
    {"slot":35,"name":"마술용품 자리","tab":"동전","branch":"luck","ids":["slotPlus","slotPlus-2"],"bases":["slotPlus"]},
    {"slot":36,"name":"비둘기 조수","tab":"도우미","branch":"pet","ids":["dove","doveTempo","dovePower"],"bases":["dove","doveTempo","dovePower"]},
    {"slot":37,"name":"마술 토끼","tab":"도우미","branch":"pet","ids":["rabbit","rabbitTempo","rabbitPurse"],"bases":["rabbit","rabbitTempo","rabbitPurse"]},
    {"slot":38,"name":"플래시 페이퍼 연출","tab":"도우미","branch":"pet","ids":["flash"],"bases":["flash"],"displayNames":{"flash":"플래시 페이퍼 연출"}},
    {"slot":39,"name":"팬의 손놀림","tab":"도우미","branch":"pet","ids":["helperTempo","fanPower"],"bases":["helperTempo","fanPower"],"visibleAfterHire":"boxHelper"},
    {"slot":40,"name":"개막 피날레","tab":"피날레","branch":"finale","ids":["startFinale"],"bases":["startFinale"]},
    {"slot":41,"name":"표현력","tab":"피날레","branch":"finale","ids":["finalePower","finalePower-2","finaleNeed","finaleNeed-2"],"bases":["finalePower","finaleNeed"]},
    {"slot":42,"name":"이어지는 박수","tab":"피날레","branch":"finale","ids":["comboGift"],"bases":["comboGift"]},
    {"slot":43,"name":"커지는 박수","tab":"피날레","branch":"finale","ids":["comboValue"],"bases":["comboValue"]},
    {"slot":44,"name":"앵콜","tab":"피날레","branch":"finale","ids":["encore"],"bases":["encore"]},
    {"slot":45,"name":"쇼맨십","tab":"피날레","branch":"finale","ids":["encorePower","encorePower-2","encoreSpan","encoreSpan-2"],"bases":["encorePower","encoreSpan"]},
    {"slot":46,"name":"도전 수첩","tab":"피날레","branch":"finale","ids":["challenge"],"bases":["challenge"]},
    {"slot":47,"name":"비둘기 트릭","tab":"귀환 성장","branch":"star","ids":["starTrick","starTrick-2","starTrick-3"],"bases":["starTrick"]},
    {"slot":48,"name":"비둘기 망토","tab":"귀환 성장","branch":"star","ids":["starGuard","starGuard-2","starGuard-3"],"bases":["starGuard"]},
    {"slot":49,"name":"비둘기 손놀림","tab":"귀환 성장","branch":"star","ids":["starTempo","starTempo-2","starTempo-3"],"bases":["starTempo"]},
    {"slot":50,"name":"비둘기 모자","tab":"귀환 성장","branch":"star","ids":["starBounty","starBounty-2","starBounty-3"],"bases":["starBounty"]},
    {"slot":51,"name":"케이스 한계","tab":"케이스","branch":"box","ids":["caseMax","caseMax-2","caseMax-3","caseMax-4","caseMax-5"],"bases":["caseMax"]},
    {"slot":52,"name":"숙련된 케이스","tab":"케이스","branch":"box","ids":["caseStart"],"bases":["caseStart"]},
    {"slot":53,"name":"케이스 연습","tab":"케이스","branch":"box","ids":["caseXp"],"bases":["caseXp"]},
    {"slot":54,"name":"케이스 연쇄","tab":"케이스","branch":"box","ids":["chain4"],"bases":["chain4"],"entryRules":{"chain4":{"previous":"caseXp","previousMax":true}}},
    {"slot":55,"name":"팔방 연쇄","tab":"케이스","branch":"box","ids":["chain8"],"bases":["chain8"]},
    {"slot":56,"name":"번개의 힘","tab":"케이스","branch":"box","ids":["chainPower"],"bases":["chainPower"]},
    {"slot":57,"name":"숨은 손끝","tab":"표현력","branch":"hand","ids":["hidden-hand"],"bases":["hidden-hand"]},
    {"slot":58,"name":"숨은 케이스","tab":"케이스","branch":"box","ids":["hidden-box"],"bases":["hidden-box"]},
    {"slot":59,"name":"숨은 배짱","tab":"마음가짐","branch":"heart","ids":["hidden-heart"],"bases":["hidden-heart"]},
    {"slot":60,"name":"숨은 행운","tab":"동전","branch":"luck","ids":["hidden-luck"],"bases":["hidden-luck"]},
    {"slot":61,"name":"숨은 조수","tab":"도우미","branch":"pet","ids":["hidden-pet"],"bases":["hidden-pet"]},
    {"slot":62,"name":"스펀지볼","tab":"도우미","branch":"pet","ids":["sponge","spongeSpeed","spongePower"],"bases":["sponge","spongeSpeed","spongePower"],"entryRules":{"spongePower":{"previous":"spongeSpeed","minLevel":1}}},
    {"slot":63,"name":"스펀지볼 수","tab":"도우미","branch":"pet","ids":["spongeCount","spongeCount-2"],"bases":["spongeCount"]},
    {"slot":64,"name":"카드 던지기","tab":"도우미","branch":"pet","ids":["cardthrow","cardthrowSpeed","cardthrowPower"],"bases":["cardthrow","cardthrowSpeed","cardthrowPower"],"entryRules":{"cardthrowPower":{"previous":"cardthrowSpeed","minLevel":1}}},
    {"slot":65,"name":"카드 던지기 수","tab":"도우미","branch":"pet","ids":["cardthrowCount"],"bases":["cardthrowCount"]},
    {"slot":66,"name":"팁 박스","tab":"도우미","branch":"pet","ids":["tipbox","tipboxSpeed","tipboxPower","tipboxPower-2"],"bases":["tipbox","tipboxSpeed","tipboxPower"]},
    {"slot":67,"name":"플래시 페이퍼","tab":"도우미","branch":"pet","ids":["flashpaper","flashpaperChance","flashpaperChance-2","flashpaperPower","flashpaperPower-2"],"bases":["flashpaper","flashpaperChance","flashpaperPower"]},
    {"slot":68,"name":"수정구","tab":"도우미","branch":"pet","ids":["crystal","crystalSpeed","crystalPower","crystalPower-2"],"bases":["crystal","crystalSpeed","crystalPower"]},
    {"slot":69,"name":"치킨 한 조각","tab":"도우미","branch":"pet","ids":["water","waterSpeed","waterPower","waterPower-2"],"bases":["water","waterSpeed","waterPower"]},
    {"slot":70,"name":"스포트라이트","tab":"도우미","branch":"pet","ids":["spotlight"],"bases":["spotlight"]},
    {"slot":71,"name":"스포트라이트 행 수","tab":"도우미","branch":"pet","ids":["spotlightCount"],"bases":["spotlightCount"]},
    {"slot":72,"name":"스포트라이트 속도","tab":"도우미","branch":"pet","ids":["spotlightSpeed","spotlightPower"],"bases":["spotlightSpeed","spotlightPower"]},
    {"slot":73,"name":"야간 공연","tab":"도우미","branch":"pet","ids":["nightShow","nightShow-2","manager"],"bases":["nightShow","manager"]},
    {"slot":74,"name":"자동 연습 속도","tab":"도우미","branch":"pet","ids":["autoPractice","autoPractice-2"],"bases":["autoPractice"]},
    {"slot":75,"name":"쇼타임 준비","tab":"도우미","branch":"pet","ids":["showtimeCooldown","cardrainCooldown","cheerCooldown"],"bases":["showtimeCooldown","cardrainCooldown","cheerCooldown"]},
    {"slot":76,"name":"동료의 템포","tab":"도우미","branch":"pet","ids":["colleagueTempo","colleagueTempo-2","colleaguePower"],"bases":["colleagueTempo","colleaguePower"],"entryRules":{"colleaguePower":{"previous":"colleagueTempo","minLevel":1}},"visibleAfterHire":"colleague"},
  ];
  // P1 bridge until P3b replaces the legacy case card with caseGrade.
  D.tree.find(n => n.id === 'chain4').gate = null;
  // P1: cheaper earlier stages; keep later prices and all effect formulas.
  const stageCosts = {
    "goldPity": [
      833,
      1833,
      4034
    ],
    "boxXP": [
      238,
      476,
      952
    ],
    "boxShield": [
      533,
      1333
    ],
    "shieldCap": [
      167,
      369,
      812,
      1787
    ],
    "doveTempo": [
      472,
      1039,
      2285
    ],
    "rabbitTempo": [
      555,
      1222,
      2688
    ],
    "finalePower": [
      130,
      286,
      631,
      1388
    ],
    "encorePower": [
      777,
      1944
    ],
    "tipboxSpeed": [
      1666,
      23333,
      326666
    ],
    "flashpaperChance": [
      160,
      2242,
      31398,
      439583
    ],
    "crystalSpeed": [
      2500,
      35000,
      490000
    ],
    "waterSpeed": [
      2500,
      35000,
      490000
    ],
    "nightShow": [
      729,
      1458,
      2916,
      5833
    ],
    "showtimeCooldown": [
      1111,
      2222,
      4444
    ],
    "cardrainCooldown": [
      2000,
      4000,
      8000
    ]
  };
  for (const node of D.tree) {
    const costs=stageCosts[node.partOf||node.id];
    if(costs)node.cost=costs.slice();
  }
  D.showSequence = {gapMs:8000,showMs:3000};
  const routineAbilities = [
    {"id":"rings","nodeId":"routine-rings","name":"피날레 힘","formula":"branchBonus","key":"finale","multiplier":1.5,"silk":10,"description":"이어진 링으로 마무리 공연을 더 힘 있게 해요."},
    {"id":"rope","nodeId":"routine-rope","name":"자신감 획득량","formula":"nodeEffects","key":"shieldValue","multiplier":1.5,"silk":10,"description":"끊어진 줄을 이으며 자신감을 더 얻어요."},
    {"id":"thumbtie","nodeId":"routine-thumbtie","name":"탭 힘","formula":"branchBonus","key":"hand","multiplier":1.5,"silk":10,"description":"묶인 손을 풀어 지팡이를 힘 있게 써요."},
    {"id":"cards","nodeId":"routine-cards","name":"연출력","formula":"branchBonus","key":"collection","multiplier":1.5,"silk":10,"description":"카드의 반전으로 관객의 의심을 더 줄여요."},
    {"id":"coins","nodeId":"routine-coins","name":"얻는 동전","formula":"branchBonus","key":"luck","multiplier":1.5,"silk":10,"description":"사라진 동전이 더 넉넉한 수입으로 돌아와요."},
    {"id":"cupsballs","nodeId":"routine-cupsballs","name":"도우미 힘","formula":"branchBonus","key":"pet","multiplier":1.5,"silk":10,"description":"공을 주고받듯 도우미와 힘을 맞춰요."},
    {"id":"bottles","nodeId":"routine-bottles","name":"회복 아이템 효과","formula":"nodeEffects","key":"healValue","multiplier":1.5,"silk":10,"description":"늘어나는 병처럼 회복도 조금 더 받아요."},
    {"id":"silk","nodeId":"routine-silk","name":"최대 멘탈","formula":"branchBonus","key":"heart","multiplier":1.5,"silk":10,"description":"부드러운 실크로 무대의 긴장을 다스려요."},
    {"id":"eggbag","nodeId":"routine-eggbag","name":"대박률","formula":"nodeEffects","key":"critRate","multiplier":1.5,"silk":10,"description":"공연 중 3초 동안 대박률 ×1.5\n타이밍 비법을 배워야 효과가 있어요.","cap":1},
    {"id":"rubberband","nodeId":"routine-rubberband","name":"연속 동작 유지 시간","formula":"nodeEffects","key":"comboMs","multiplier":1.5,"silk":10,"description":"고무줄처럼 동작 사이의 여유가 늘어요."},
    {"id":"coloringbook","nodeId":"routine-coloringbook","name":"마술사 개봉 경험치","formula":"nodeEffects","key":"boxXP","multiplier":1.5,"silk":10,"description":"빈 책을 채우며 케이스에서 더 배워요."},
    {"id":"cube","nodeId":"routine-cube","name":"한곳 집중 효과","formula":"nodeEffects","key":"sweep","multiplier":1.5,"silk":10,"description":"흩어진 색을 맞추듯 한곳에 힘을 모아요."},
    {"id":"wand","nodeId":"routine-wand","name":"누르기 속도","formula":"recompute","key":"_rate","multiplier":1.5,"silk":10,"description":"지팡이를 누르고 있을 때 더 빠르게 움직여요."},
  ];
  for (const ability of routineAbilities) {
    const node = D.tree.find(n => n.id === ability.nodeId);
    const item = D.gemShop.find(n => n.id === ability.nodeId);
    node.desc = `${ability.description}\n공연 중 3초 동안 ${ability.name} ×${ability.multiplier}`;
    item.desc = `공연 중 3초 동안 ${ability.name} ×${ability.multiplier}`;
  }
  const nameChanges = [
    {kind:'node',id:'shieldCap',from:'넉넉한 실크',to:'담력'},
    {kind:'node',id:'goldCoins',from:'금빛 사례',to:'황금의 축복'},
    {kind:'node',id:'flash',from:'불꽃 종이',to:'플래시 페이퍼 연출'},
    {kind:'node',id:'autoLearn',from:'자동 배우기',to:'도우미 상점 오픈'},
    {kind:'skill',id:'cheer',from:'비둘기',to:'관객 호응'},
    {kind:'skill',id:'showtime',from:'마술 모자',to:'쇼타임'}
  ];
  for (const change of nameChanges) {
    const target = (change.kind === 'node' ? D.tree : D.skills).find(n => n.id === change.id);
    target.name = change.to;
  }
  const hireKeys = ['assistant','boxHelper','colleague','colleagueMore'];
  D.bookLayout = {
    release:21,
    implementation:'P0 contract only',
    slots,
    stagePolicy:{defaultEntry:'previousMax',preserveExternalPrerequisites:true,
      preserveVenueAndBoardGates:true,allowReturnToEarlierStage:true},    bookIds:slots.flatMap(s => s.ids),
    shopKeys:hireKeys.concat(routineAbilities.map(r => r.nodeId)),
    tabs:['시작','표현력','케이스','마음가짐','동전','도우미','피날레','귀환 성장','컬렉션'],
    shopTabs:['준비물','마술','도우미','꾸미기'],
    cosmeticTabs:['패드','의상','케이스'],
    nameChanges,
    routineAbilities,
    routinePolicy:{applyOnce:true,replaceLegacyBranchBonus:true,keepPrerequisites:true,
      ownershipSources:['tree','u19.routines'],restoreUnion:true,freeReplay:true,resetOnRebirth:true},
    helperShop:{
      slot:14,
      description:"책 2권으로 도우미 상점을 열고, 어시스턴트를 무료로 맞이해요",
      nextGoodsNote:"다음은 팬 · 동네 카페 도착 · 실크 10개",
      action:'atomicOpenAndFreeAssistant',
      hireKeys,
      opening:{"books":2,"gate":"school","prereq":"board >= 1","freeHire":"assistant","atomic":true,"legacyMissingAssistantSilk":10,"tab":"도우미"},
      line:[{"name":"어시스턴트","id":"assistant","level":1,"gate":"school","silk":0},{"name":"팬","id":"boxHelper","level":1,"gate":"cafe","silk":10},{"name":"동료 1","id":"colleague","level":1,"gate":"theater","silk":15},{"name":"동료 2","id":"colleagueMore","level":1,"gate":"festival","silk":20},{"name":"동료 3","id":"colleagueMore","level":2,"gate":"hotel","silk":30},{"name":"동료 4","id":"colleagueMore","level":3,"gate":"audition","silk":40},{"name":"동료 5","id":"colleagueMore","level":4,"gate":"broadcast","silk":50},{"name":"동료 6","id":"colleagueMore","level":5,"gate":"vegas","silk":60}],
      openedWhen:'any hire key >= 1',
      nextWhen:'first missing stage',
      legacyAutoLearnIsOpeningEvidence:false,
      preserveLegacyAutoLearn:true,
      preserveExistingHires:true,
      chargeOpeningBooksForExistingHires:false,
      grantFreeHireForExistingHires:false,
      skipVenueGatesInDimension2:true,
      keepBoardBooksOrderPricesInDimension2:true,
      oneHirePerPurchase:true,
      allowBookPurchaseBypass:false,
      saveBeforeOpeningTab:true,
      lockWhileSaving:true
    },
    padUpgrade:{"levels":10,"currency":"gems","costs":[2,2,3,3,4,4,5,5,6,30],"sharedLevel":"u18.pads.upgrades","transferBetweenPads":true,"floorUpgradeable":false,"kali":{"level1to9PercentagePoints":5,"level10PercentagePoints":30,"totalPercentagePoints":75},"lecturenote":{"level1to9PercentagePoints":4.5,"level10PercentagePoints":27,"totalPercentagePoints":67.5},"personal":{"level1to9PercentagePoints":4,"level10PercentagePoints":24,"totalPercentagePoints":60},"legacyAbove10":"preserve old level and exact effect, disable both upgrade APIs"},
    economy:{
      personalPerColor:30,lecturePrice:60,kaliPerColor:20,
      priceBasis:'book-plan/p7/choice7.json',
      pricesFinal:true,
      caseSilk:7,firstClearSilk:10,
      allPaidStageGatesRemovedExceptHelper:true,
      latestPurchaseTarget:'galaxy',
      upgradeVenueGate:null,
      keepPreviousPadOwnership:true,
      keepFirstPracticePurchaseLock:true,
      freeMilestoneCosmetics:['hanbok','reader','future'],
      saleGates:{"kaliPad":null,"silkUpgrades":null,"camera":null,"guitar":null,"brush":null,"redtee":null,"study":null,"lecturenotePad":null},
      timeTarget:{medianMinutes:[180,240],p90Minutes:[180,240],minimumRequired:false}
    },
    ui:{
      bookColumns:{portrait:2,landscape:5},shopColumns:{portrait:1,landscape:2},
      stableOrder:true,autoSortAfterPurchase:false,
      sessionOnly:['tabScroll','selectedStage','expandedDetails','etaSamples'],
      fixed:['title','balance','tabs','close'],
      scrollBodyOnly:true,showOverflowTabs:true,buttonPx:48,bodyTextPx:14,textZoomPercent:200,
      settingsTwoFingerGesture:false,
      saveBeforeRoutinePlayback:true,preservePendingPlayback:true,restoreShopPosition:true
    },
    rebirth:{
      halfFloor:['gems','coins','keys'],
      keep:['padsOwned','padUpgrades','padEquipped','cosmetics','cases'],
      reset:['hires','routines','tree','deckStock','deckRemainingTime'],
      pigeonGrowthSeparate:true,requireOpeningAgain:true
    },
    save:{
      newFields:true,
      validatorSha256:'a980917d81f7cbb5c00bf0d67f9a8581aa0b1eaa95839d085ca5bc252a336a23',
      deferredValidatorChange:null
    }
  };
  D.tree.find(n => n.id === 'autoLearn').desc = '책 2권으로 도우미 상점을 열어요\n어시스턴트 무료 합류';
  // Keep existing identifiers and save keys for hiring and sales.
  for (const id of hireKeys) D.tree.find(n => n.id === id).shopOnly = true;
  Object.assign(D.padPrices, {personal:30, lecturenote:60, kali:20});
  for (const pad of D.pads) {
    if (pad.id === 'floor') continue;
    pad.cost = D.padPrices[pad.id];
    delete pad.venue;
    delete pad.hidden;
    if (pad.id === 'kali') pad.requires = 'lecturenote';
  }
})(GAME_DATA);
