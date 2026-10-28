GAME_DATA.glove = {id:'auto-glove',name:'칼리 덱 (자동 연습)',icon:'item-kali-deck.png',emoji:'🃏',duration:120000,desc:'손을 떼도 모든 케이스가 열려요\n120초 동안 자동으로 꾹 누르기'};
GAME_DATA.statMeanings = {power:'케이스를 열어 아이템을 얻는 힘',damage:'관객의 의심을 줄이는 힘',mental:'야유를 버티는 힘'};
(function(D){
 D.venues.forEach(v=>v.audiences.concat([v.headliner]).forEach(a=>{a.bio=D.storyV15.bios[a.id]||a.flavor;}));
 D.skills[0].hint='20초 3배';D.skills[0].desc='20초 동안 마술 실력이 3배가 돼요\n케이스를 누르는 힘이 3배라서 케이스가 훨씬 빨리 열려요.\n한 번 쓰면 90초를 기다려야 다시 쓸 수 있어요. 비법 「쇼타임 준비」 1레벨마다 기다리는 시간이 10%씩 줄어요.';
 D.skills[1].hint='한번 3배';D.skills[1].desc='판 위의 모든 케이스를 한 번에 두드려요\n누른 순간 한 번, 지금 마술 실력의 3배 힘으로 모든 케이스를 열어요.\n한 번 쓰면 60초를 기다려야 다시 쓸 수 있어요. 비법 「카드 비 준비」 1레벨마다 기다리는 시간이 10%씩 줄어요.';
 D.skills[2].hint='야유 막기';D.skills[2].desc='다음 야유 한 번을 막고 멘탈을 회복해요\n누른 뒤 처음 오는 야유 한 번을 통째로 막아요. 막을 때까지 효과가 남아 있어요.\n누른 순간 멘탈이 최대치의 10%만큼 차요.\n한 번 쓰면 75초를 기다려야 다시 쓸 수 있어요. 비법 「관객 호응 준비」 1레벨마다 기다리는 시간이 10%씩 줄어요.';
})(GAME_DATA);

/* Easy result-first copy; formulas remain in Core. */
GAME_DATA.easyNodes = {
  "root": "첫 마술을 시작할 수 있어요\n처음부터 배운 비법",
  "assistant": "조수가 케이스를 함께 열어요\n1.2초마다 실력의 80%",
  "power": "손기술이 좋아져 케이스를 더 빨리 열어요\n실력 1.1배씩",
  "speed": "케이스를 더 자주 두드려요\n1초에 0.12회씩 추가",
  "area": "여러 케이스를 함께 두드려요\n지금 범위와 다음 범위를 확인해요",
  "crit": "딱 맞는 순간에 케이스를 세게 두드려요\n8% 확률로 힘 1.5배",
  "critRate": "세게 두드릴 기회가 늘어요\n기회 2%씩 추가 · 최대 14%",
  "critPower": "세게 두드릴 때 더 크게 놀라게 해요\n힘 0.1배씩 추가 · 최대 1.8배",
  "comboHold": "개봉을 조금 쉬어도 이어져요\n기다리는 시간 0.25초씩 추가",
  "sweepFocus": "한 케이스에 힘을 모아요\n한 칸만 두드리면 힘 5%씩 추가",
  "precision": "관객의 눈을 돌려 숨은 관객도 놀라게 해요\n빗나갈 기회 2%씩 줄기",
  "board": "케이스를 하나 더 놓아요\n자리 1칸 추가",
  "spawn": "빈 자리에 새 케이스를 더 빨리 세팅해요\n준비 시간 7%씩 줄기",
  "golden": "동전이 많은 케이스가 나와요\n첫 30초 · 다음부터 180초",
  "goldPity": "황금 케이스를 더 자주 만나요\n기다리는 시간 20초씩 줄기",
  "goldCoins": "황금 케이스에서 동전을 더 얻어요\n동전 20%씩 추가",
  "prepared": "새 케이스를 조금 열린 채 받아요\n열린 양 5%씩 추가",
  "boxXP": "케이스가 더 빨리 자라요\n케이스 경험치 10%씩 추가",
  "boxShield": "개봉할 때 야유를 막을 힘을 얻어요\n자신감 0.02씩 · 멘탈의 힘 적용",
  "boxHeal": "개봉할 때 마음이 회복돼요\n회복 0.05씩 · 멘탈의 힘 적용",
  "mental": "야유를 더 오래 버텨요\n최대 멘탈 1.18배씩",
  "attack": "마술을 멋지게 보여 의심이 더 빨리 줄어요\n연출 1.05배씩",
  "shieldCap": "야유를 막을 힘을 더 모아요\n최대 멘탈의 3%씩 추가",
  "shieldValue": "실크가 야유를 더 많이 막아요\n자신감 5%씩 추가",
  "healValue": "회복 아이템으로 더 힘을 얻어요\n회복 5%씩 추가",
  "winHeal": "멋진 포즈로 끝내면 마음이 더 회복돼요\n회복 2%씩 추가",
  "levelHeal": "레벨이 오를 때 더 회복돼요\n회복 2%씩 추가",
  "openingShield": "대본을 미리 외워 새 공연을 든든하게 시작해요\n최대 멘탈의 1%씩 자신감",
  "calm": "야유를 들어도 표정이 흔들리지 않아요\n야유 힘 2%씩 줄기",
  "coinLuck": "케이스에서 동전이 더 잘 나와요\n동전 뽑기 표 6장씩 추가",
  "forceRemove": "카드 몬테 첫 판, 여왕을 더 오래 보여줘요\n0.6초씩 더 보여주고 첫 섞기가 조금 느려져요",
  "tip": "관객이 만족하면 동전을 더 얻어요\n만족 동전 5%씩 추가",
  "dealerCoin": "컵앤볼과 카드 몬테의 동전이 늘어요\n동전 10%씩 추가",
  "jackpot": "카드 몬테를 연속으로 맞출수록 동전이 늘어요\n맞출 때마다 15%씩 추가",
  "gemFind": "좋은 소품에서 실크도 얻어요\n실크 나올 기회 1%씩 추가",
  "equip": "좋아하는 소품이 더 잘 나와요\n소품 자리 3칸 열기",
  "slotPlus": "좋아하는 소품을 더 놓아요\n소품 자리 1칸 추가 · 최대 9칸",
  "lessonBias": "케이스가 더 빨리 자라요\n경험치 10%씩 추가 · 최대 20%",
  "dove": "비둘기가 관객을 놀라게 해요\n3초마다 연출의 4배",
  "rabbit": "토끼가 동전을 가져다줘요\n5초마다 동전 받기",
  "flash": "개봉을 모아 관객을 놀라게 해요\n25개 열면 연출의 8배",
  "doveTempo": "비둘기가 더 자주 날아요\n기다리는 시간 0.25초씩 줄기",
  "dovePower": "비둘기가 더 크게 놀라게 해요\n힘 10%씩 추가",
  "rabbitTempo": "토끼가 동전을 더 자주 가져와요\n기다리는 시간 0.4초씩 줄기",
  "rabbitPurse": "토끼가 동전을 더 가져와요\n동전 1개씩 추가",
  "boxHelper": "팬이 케이스를 함께 열어요\n2초마다 실력의 35%",
  "helperTempo": "팬이 케이스를 더 자주 두드려요\n기다리는 시간 0.2초씩 줄기",
  "startFinale": "케이스 1개를 열 때마다 피날레가 1칸 차요\n기본 20칸(비법으로 줄어듦)이 차면 큰 한 방이 나가요\n기본 피해는 표시된 연출의 2.75배, 마지막 보스 3막 준비 후 첫 피날레는 2배\n타겟은 5칸 충전, 액트 보상도 충전해요\n피날레 힘 비법·무대 보상·피날레 계열 강화로 더 강해져요\n공연 시작 때 피날레 충전",
  "finalePower": "케이스 1개를 열 때마다 피날레가 1칸 차요\n기본 20칸(비법으로 줄어듦)이 차면 큰 한 방이 나가요\n기본 피해는 표시된 연출의 2.75배, 마지막 보스 3막 준비 후 첫 피날레는 2배\n타겟은 5칸 충전, 액트 보상도 충전해요\n피날레 힘 비법·무대 보상·피날레 계열 강화로 더 강해져요\n표시된 연출의 2.75배 · 힘 8%씩 추가",
  "finaleNeed": "케이스 1개를 열 때마다 피날레가 1칸 차요\n기본 20칸(비법으로 줄어듦)이 차면 큰 한 방이 나가요\n기본 피해는 표시된 연출의 2.75배, 마지막 보스 3막 준비 후 첫 피날레는 2배\n타겟은 5칸 충전, 액트 보상도 충전해요\n피날레 힘 비법·무대 보상·피날레 계열 강화로 더 강해져요\n필요한 개봉 1개씩 줄기 · 최소 18개",
  "comboGift": "개봉을 이어 동전과 힘을 얻어요\n10 · 25 · 50 · 100개마다 선물",
  "comboValue": "개봉을 이어 동전을 더 얻어요\n이어 열기 선물 동전 20%씩 추가",
  "encore": "가끔 손끝에 더 힘이 생겨요\n300초마다 15초 · 실력 20% 추가",
  "encorePower": "피버 타임에 관객을 더 신나게 해요\n실력 5%씩 추가",
  "encoreSpan": "앵콜의 힘이 더 오래 가요\n지속 시간 3초씩 추가",
  "challenge": "도전하며 관객을 더 잘 놀라게 해요\n도전 3개 · 성공마다 연출 0.5% 추가",
  "starTrick": "케이스를 더 빨리 열고 관객을 더 빨리 감탄시켜요\n실력 1.14배 · 연출 1.4배씩",
  "starGuard": "야유를 버티고 더 잘 회복해요\n멘탈 · 자신감 · 회복 1.18배씩",
  "starTempo": "더 자주 두드리고 빨리 채워져요\n두드리기 1.06배 · 준비 시간 8% 줄기",
  "starBounty": "동전을 더 많이 얻어요\n동전 1.12배씩",
  "caseMax": "케이스가 더 높은 레벨로 자라요\n최대 레벨 1씩 추가 · 최대 50",
  "caseStart": "새 케이스도 잘 자란 채 받아요\n시작 레벨 1씩 추가",
  "caseXp": "케이스가 더 빨리 자라요\n경험치 15%씩 추가",
  "chain4": "열 때 옆 케이스도 두드려요\n옆 4방향 · 실력의 30%",
  "chain8": "대각선 케이스도 함께 두드려요\n주변 8방향",
  "chainPower": "옆 케이스를 더 세게 두드려요\n실력의 10%씩 추가",
  "sponge": "공이 튀며 케이스를 열어요\n닿으면 실력의 25%",
  "cardthrow": "카드가 날아가 케이스를 열어요\n1.5초마다 실력의 40%",
  "tipbox": "팁 박스가 동전을 모아줘요\n6초마다 동전 받기",
  "flashpaper": "종이를 누르면 모든 칸을 두드려요\n개봉 때 3% · 실력의 150%",
  "flashpaperChance": "플래시 페이퍼를 더 자주 얻어요\n기회 1%씩 추가 · 최대 7%",
  "crystal": "수정구가 야유를 막아줘요\n8초마다 멘탈의 0.6% 자신감",
  "water": "치킨 한 조각으로 기운이 나요\n9초마다 멘탈의 3% 회복 · 칼리의 최애 간식",
  "spotlight": "조명이 케이스 한 줄을 두드려요\n4초마다 실력의 60%",
  "fanPower": "팬과 조수가 더 세게 두드려요\n힘 15%씩 추가",
  "autoLearn": "동전으로 비법을 알아서 배워요\n켜 두면 3초마다 배우기",
  "nightShow": "자리를 비워도 보상을 더 모아요\n보상 시간 1시간씩 추가 · 기본 8시간",
  "manager": "자리를 비운 동안 동전을 더 모아요\n보상 10%씩 추가 · 기본 70%",
  "autoPractice": "손을 떼도 케이스가 빨리 열려요\n손으로 누를 때의 10%씩 추가 · 기본 40%",
  "spongeSpeed": "스펀지볼이 더 빨리 튀어요\n이동 12%씩 추가",
  "spongePower": "스펀지볼이 더 세게 두드려요\n힘 15%씩 추가",
  "cardthrowSpeed": "카드를 더 자주 던져요\n기다리는 시간 10%씩 줄기",
  "cardthrowPower": "카드가 더 세게 두드려요\n힘 15%씩 추가",
  "tipboxSpeed": "팁 박스가 더 자주 모아줘요\n기다리는 시간 10%씩 줄기",
  "tipboxPower": "팁 박스에 동전이 더 모여요\n동전 25%씩 추가",
  "crystalSpeed": "수정구가 더 자주 막아줘요\n기다리는 시간 10%씩 줄기",
  "crystalPower": "수정구가 더 많이 막아줘요\n자신감 20%씩 추가",
  "waterSpeed": "치킨을 더 자주 먹어요\n기다리는 시간 10%씩 줄기",
  "waterPower": "치킨 한 조각이 더 많이 회복해요\n회복 20%씩 추가",
  "spotlightSpeed": "조명이 더 자주 비춰요\n기다리는 시간 10%씩 줄기",
  "spotlightPower": "조명이 더 세게 두드려요\n힘 15%씩 추가",
  "spongeCount": "스펀지볼이 하나 더 튀어요\n1개씩 추가 · 최대 3개",
  "cardthrowCount": "카드가 한 장 더 날아가요\n1장씩 추가 · 최대 4장",
  "spotlightCount": "조명이 한 줄 더 비춰요\n1줄씩 추가 · 최대 2줄",
  "showtimeCooldown": "쇼타임을 더 빨리 다시 써요\n쇼타임을 쓴 뒤 기다리는 시간이 1레벨마다 10%씩 줄어요. 기본 90초, 최대 3레벨.\n쇼타임: 20초 동안 마술 실력이 3배가 돼요.",
  "cardrainCooldown": "카드 비를 더 빨리 다시 써요\n카드 비를 쓴 뒤 기다리는 시간이 1레벨마다 10%씩 줄어요. 기본 60초, 최대 3레벨.\n카드 비: 모든 케이스를 마술 실력의 3배 힘으로 한 번에 두드려요.",
  "cheerCooldown": "관객 호응을 더 빨리 다시 써요\n관객 호응을 쓴 뒤 기다리는 시간이 1레벨마다 10%씩 줄어요. 기본 75초, 최대 3레벨.\n관객 호응: 다음 야유 한 번을 막고 멘탈을 최대치의 10%만큼 채워요."
};

// U31 colleague magicians (Plan.B): a small pet-branch group that performs tricks with Kali and cuts the audience's doubt.
GAME_DATA.colleagueNames=['Waker','Level1','선휘재','전도현','박준현','조시훈'];
(function(D){
 const mk=(id,name,max,cost,currency,pre,x,y,desc,easy)=>{D.tree.push({id,name,max,cost,currency,prereqs:[pre],x,y,desc,branch:'pet',reveal:'N',icon:'node-assistant.png',emoji:'🎭',pending:false,u31:true});D.easyNodes[id]=easy;};
 mk('colleague','동료 마술사 합류',1,[2],'keys','boxHelper',-4,4,'동료 마술사 1명이 무대에 올라 몇 초마다 마술 피해','동료 마술사가 무대에 올라와요\n몇 초마다 함께 마술을 보여줘요');
 mk('colleagueMore','동료 한 명 더',5,{c:2500,g:3.2},'coins','colleague',-3,5,'동료 마술사 +1명, 최대 6명','동료가 한 명 더 올라와요\n최대 6명까지');
 mk('colleaguePower','동료의 합',5,{c:3000,g:3.4},'coins','colleague',-4,5,'동료 마술 피해 +20%씩','동료의 마술이 더 커져요\n힘 20%씩 추가');
 mk('colleagueTempo','동료의 템포',4,{c:3500,g:3.6},'coins','colleague',-5,5,'동료 마술 주기 5000-500L ms','동료가 마술을 더 자주 보여줘요\n기다리는 시간 0.5초씩 줄기');
})(GAME_DATA);
GAME_DATA.easyNodes.flashpaperPower="플래시 페이퍼가 더 세게 두드려요\n힘 20%씩 추가";
(function(D){
 D.tree.forEach(n=>{
  // v4 U45: 칼리 덱 is the skill only, 틴 케이스 strengthens the cases, the first wall product is the beginner lecture.
  if(n.id==='p-kali-deck')n.desc='실크 상점에서 칼리 덱을 살 수 있고\n공연 중 케이스에서도 나와요'; // v4 U48 A: the node unlocks the consumable
  else if(n.caseItemMult)n.desc='케이스가 크게 강해져요\n케이스 아이템 효과 ×'+n.caseItemMult;
  else if(n.productMultiplier)n.desc=(n.id==='p-classic-collection-remastered'?'입문자 강의 1편, 기본기를 다져요\n':n.id==='p-classic-collection-remastered-2'?'입문자 강의 2편, 기본기를 넓혀요\n':'이 무대를 넘을 힘이 생겨요\n')+'연출 ×'+n.productMultiplier;
  else if(n.id.startsWith('hidden-')){const results={hand:'케이스를 더 빨리 열어요',box:'케이스 아이템의 힘이 커져요',heart:'야유를 더 오래 버텨요',luck:'동전을 더 많이 얻어요',pet:'도우미가 더 힘껏 도와줘요',finale:'케이스 1개를 열 때마다 피날레가 1칸 차고, 기본 20칸(비법으로 줄어듦)이 차면 큰 한 방이 나가요. 기본 피해는 표시된 연출의 2.75배, 마지막 보스 3막 준비 후 첫 피날레는 2배\n타겟은 5칸 충전, 액트 보상도 충전해요\n피날레 힘 비법·무대 보상·피날레 계열 강화로 더 강해져요',collection:'관객을 더 크게 놀라게 해요',star:'비둘기의 힘이 더 세져요'};n.desc=results[n.id.split('-').slice(1).join('-')]+'\n힘 2%씩 추가';}
  else n.desc=D.easyNodes[n.id];
  if(!n.desc)throw new Error('Missing easy description: '+n.id);
 });
 const copy={damage:'관객의 의심이 줄어요',shield:'야유를 막을 힘을 얻어요',heal:'마음이 회복돼요',coins:'비법을 배울 동전을 얻어요',xpBurst:'레벨이 더 빨리 올라요',finisher:'피날레를 더 빨리 준비해요',boxFill:'케이스가 더 빨리 열려요'};
 D.items.types.forEach(t=>t.ladder.forEach(p=>{const effect=p.effect||t.effect;const values={damage:'기본 힘 8 × 연출 · 좋은 소품은 최대 25배',shield:'기본 자신감 0.54 × 멘탈 · 최대 25배',heal:'기본 회복 1.8 × 멘탈 · 최대 25배',coins:'기본 동전 8개 · 좋은 소품은 최대 25배',xpBurst:'다음 레벨 경험치의 50%',finisher:'피날레 5칸 채우기',boxFill:'모든 케이스를 30% 더 열기'};p.desc=copy[effect]+'\n'+values[effect];}));
 D.missions.forEach(m=>{m.desc='오늘의 목표를 이루면 실크를 받아요\n'+m.name+' · 실크 '+m.gems+'개';});
 D.easyExtras={events:'움직이는 친구를 누르면 선물을 받아요\n8초 안에 누르기 · 힘, 동전, 책 중 하나',set:'무대의 모두를 감탄시키면 힘이 늘어요\n실력 3% 추가 · 컬렉션 모두 모으면 연출 1.1배',milestone:'레벨이 쌓이면 힘이 크게 늘어요\n10 · 25레벨마다 2배 · 케이스는 50도 2배'};
})(GAME_DATA);

GAME_DATA.stageRewards.forEach((r,i)=>{r.desc=[
 '개봉을 잠깐 쉬어도 이어져요\n이어 열기 기다리는 시간 0.5초 추가',
 '케이스를 더 빨리 열어요\n실력 1.2배',
 '도우미가 더 빨리 도와줘요\n도우미 속도 10% 추가',
 '새 케이스도 잘 자란 채 받아요\n시작 레벨 1 추가',
 '옆 케이스도 더 세게 두드려요\n옆 칸에 주는 힘 15% 추가',
 '피날레가 더 크게 놀라게 해요\n피날레의 힘 30% 추가'][i];r.effect=r.desc;});
GAME_DATA.missions.find(m=>m.id==='skills').name='스킬 5번 쓰기';GAME_DATA.missions.find(m=>m.id==='skills').desc='오늘의 목표를 이루면 실크를 받아요\n스킬 5번 쓰기 · 실크 3개';
// U15 pacing compensates for full-board practice without slowing the item itself.
// 12-107 S6: hp scale folded into HP_FINAL (end of file). Was: (function(D){const scale={family:2,party:1.3,school:5,cafe:4,meetup:4.4,theater:4,festival:15,audition:24,broadcast:65,vegas:5,moon:1.6,sun:1.1,galaxy:1.25,multiverse:1.08,lecturenote:8};D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor=(v.hpFactor||1)*scale[v.slug];});D.venues.find(v=>v.slug==='lecturenote').bossHpFactor/=8;})(GAME_DATA);

GAME_DATA.statNames={power:'마술 실력',damage:'연출',mental:'멘탈'};

// U17 gem uses and child-friendly descriptions.
GAME_DATA.gemShop=[{id:'glove',name:'칼리 덱 (자동 연습)',desc:'120초 동안 모든 케이스를 두드려요',cost:2},{id:'refill',name:'스킬 바로 충전',desc:'기다리는 스킬을 바로 쓸 수 있어요',cost:2},{id:'potion',name:'멘탈 회복 물약',desc:'마음을 30% 회복해요',cost:3}];
GAME_DATA.tree.filter(n=>['encore','encorePower','encoreSpan'].includes(n.id)).forEach(n=>{n.desc=n.id==='encoreSpan'?'피버 타임이 더 오래 이어져요\n레벨마다 3초 추가':n.id==='encorePower'?'피버 타임에 관객을 더 신나게 해요\n레벨마다 힘 5% 추가':'피버 타임에 마술이 더 강해져요\n피버 실력 20% 추가';});
// U17 pacing: preserve rewards and fever strength; tune audience durability.
// 12-107 S6: hp scale folded into HP_FINAL (end of file). Was: (function(D){const scale={party:1.6,school:1.6,cafe:2,meetup:1.8,theater:4,festival:2.5,audition:3.35,broadcast:1.16,moon:1.8,galaxy:1.12,multiverse:1.07};D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor*=scale[v.slug];});})(GAME_DATA);

// 12-107 S6: hp scale folded into HP_FINAL (end of file). Was: GAME_DATA.venues.find(v=>v.slug==='lecturenote').bossHpFactor*=1.07;

// U18 challenges and case skins persist. Equipped outfits and pads now affect progression (owner 2026-10-18).
GAME_DATA.trueFanRules=[
 {type:'noDamage',value:0,label:'하트 하나도 잃지 않고 관객 감탄시키기'},
 {type:'timeLimit',value:90,label:'90초 안에 관객 감탄시키기'},
 {type:'combo',value:25,label:'25액트를 만든 뒤 관객 감탄시키기'}
];
GAME_DATA.cosmetics={
 kali:[
  {id:'wave',name:'푸른 파도',cost:8,emoji:'🌊'},
  {id:'flame',name:'불꽃 고리',cost:6,emoji:'🔥'},
  {id:'hanbok',name:'한복 마술사',cost:0,milestone:'meetup',hint:'전국 마술 매니아 무대 완료',emoji:'🎎'},
  {id:'denim',name:'거리 마술사',cost:10,emoji:'👖'},
  {id:'brownknit',name:'갈색 니트',cost:10,emoji:'🧶'},
  {id:'camera',name:'사진가',cost:14,emoji:'📷'},
  {id:'guitar',name:'음악가',cost:16,emoji:'🎸'},
  {id:'reader',name:'서재의 강연자',cost:0,milestone:'lecturenote',hint:'렉쳐노트 귀환 완료',emoji:'📚'},
  {id:'redtee',name:'무규칙',cost:20,emoji:'👕'}
 ],
 cases:[
  {id:'wave',name:'푸른 파도',cost:6,emoji:'🌊'},
  {id:'flame',name:'불꽃',cost:8,emoji:'🔥'},
  {id:'hwatu',name:'화투',cost:9,emoji:'🎴'},
  {id:'sakura',name:'벚꽃',cost:10,emoji:'🌸'},
  {id:'denim',name:'데님',cost:8,emoji:'👖'},
  {id:'wood',name:'나무',cost:12,emoji:'🪵'},
  {id:'brush',name:'붓',cost:14,emoji:'🖌️'},
  {id:'study',name:'서재',cost:15,emoji:'📚'}
 ]
};

// U19: the table is revealed only after the homecoming.
(function(D){
 const future={id:'h-future-kali',name:'미래의 칼리',emoji:'🪞',portraitAsset:'aud-future-kali.png',winLine:'여기까지 온 손, 충분해요.',flavor:'몇 년 뒤의 칼리. 옆에서 짧게 응원한다.',bio:'테이블에 처음 앉은 사람 앞에서 마술을 건넨다.',heckles:['오늘은 네 속도에 맞춰 볼게요.','좋아요, 그 손 기억해 둬요.','한 단계만 더 올라와 봐요.','서두르지 마요. 손이 보여요.'],pattern:'futureMirror',bossProfile:'future',preLine:'오늘은 네 속도에 맞춰 볼게요.',defeatLine:'여기까지 온 손, 충분해요.'};
 D.venues.push({id:17,slug:'future',balanceRank:13,hpFactor:1,name:'서재 앞 큰 테이블',crowd:1,crowdEmoji:'👏',venueAsset:'venue-17-library-table.png',crowdAsset:'',palette:{bg1:'#342334',bg2:'#72553b',accent:'#ffe4a0'},audiences:[],headliner:future,intro:'테이블에 처음 앉은 사람이 기다린다.',successLine:'마술이 이렇게 다정하네요.',trophy:'미래의 나'});
 D.ui.patterns.futureMirror='거울 · 내 도구로 나를 넘어서는 공연';
 D.futureEnding=D.storyReview.ending;
 // Lines only. Chat-room and intro buttons are not wired this round. Serona's button line stays here so it is not shown as already on.
 D.futureInvite={buttonsLater:true,lines:[{speaker:'칼리',text:'마술 톡방에서 또 만나요.'},{speaker:'칼리',text:'소개 페이지도 열어 두었어요.'},{speaker:'세로나',text:'버튼 두 개, 지금 켜졌어요.'}]};
 D.cosmetics.kali.push({id:'future',name:'미래의 나',cost:0,milestone:'future',hint:'큰 테이블의 공연 완료',emoji:'🪞'});
 const past=D.venues.find(v=>v.slug==='multiverse').audiences.find(a=>a.id==='a108');
 Object.assign(past,{name:'잠시 쉰 나',portraitAsset:'aud-past-kali.png',bio:'군대에서 잠시 쉬던 칼리. 쉬고 싶던 건 아니었다.',flavor:'쉬고 싶던 건 아니었다.'});
 D.storyV15.bios[future.id]=future.bio;D.storyV15.bios[past.id]=past.bio;
 // The reviewed IF dialogue is shared by live scenes and replay.
 D.ifRouteScript=D.storyReview.ifRoute;

 D.routines=[
  {id:'rings',name:'링',nodes:['chain4','chain8','chainPower'],branch:'hand',items:['linking-rings']},
  {id:'rope',name:'로프',nodes:['area','sweepFocus'],branch:'hand',items:['silk-handkerchief']},
  {id:'thumbtie',name:'썸타이',nodes:['power','prepared'],branch:'hand',items:['silk-handkerchief','linking-rings']},
  {id:'cards',name:'카드',nodes:['cardthrow','cardthrowPower','cardrainCooldown'],branch:'collection',items:['playing-card','jumbo-card'],skill:'cardrain'},
  {id:'coins',name:'동전',nodes:['coinLuck','tip'],branch:'luck',items:['coin']},
  {id:'cupsballs',name:'컵앤볼',nodes:['sponge','spongePower'],branch:'pet',items:['sponge-balls','cups-and-balls']},
  {id:'bottles',name:'멀티플레잉 보틀',nodes:['water','waterPower','showtimeCooldown'],branch:'finale',items:['water-glass','cups-and-balls'],skill:'showtime'},
  {id:'silk',name:'실크',nodes:['shieldCap','mental','cheerCooldown','p-slydini-silks'],branch:'heart',items:['silk-handkerchief','linking-rings'],skill:'cheer'},
  // Round 14: existing item ids and book nodes only (no new products). A shared item still takes turns in core.js routineItem.
  // eggbag: 실크햇 top-hat (모자에서 물건을 꺼내는 소품), 반짝이는 모자. rubberband: 링 linking-rings (고리), 루틴 연결.
  // coloringbook: 점보 카드 jumbo-card (큰 종이), 연습 노트. cube: 스펀지 볼 sponge-balls (손에 쥐는 소품), 한곳 집중.
  // wand: 지팡이 wand, 빠른 손놀림. (모자 속 동전 has no free book cell left.)
  {id:'eggbag',name:'에그백',nodes:['gemFind'],branch:'luck',items:['top-hat']},
  {id:'rubberband',name:'고무줄',nodes:['comboHold'],branch:'hand',items:['linking-rings']},
  {id:'coloringbook',name:'컬러링북',nodes:['lessonBias'],branch:'collection',items:['jumbo-card']},
  {id:'cube',name:'큐브',nodes:['sweepFocus'],branch:'hand',items:['sponge-balls']},
  {id:'wand',name:'완드',nodes:['speed'],branch:'hand',items:['wand']}
 ];
})(GAME_DATA);
// U19 pacing: extend the late galaxy rehearsal without stretching the mirror venue.
// 12-107 S6: hp scale folded into HP_FINAL (end of file). Was: GAME_DATA.venues.find(v=>v.slug==='galaxy').hpFactor*=1.41;
// U19b pacing: trade repeated-run time for shorter regular doubt bars.
// 12-107 S6: hp scale folded into HP_FINAL (end of file). Was: (function(D){const scale={meetup:.30,audition:.60,broadcast:.52,moon:.70,sun:.60,galaxy:.30,multiverse:.44,lecturenote:.40};D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor*=scale[v.slug];});D.venues.find(v=>v.slug==='lecturenote').bossHpFactor*=3.25;})(GAME_DATA);

// U25: checked-in role and per-line mood data from lines-v19b.
