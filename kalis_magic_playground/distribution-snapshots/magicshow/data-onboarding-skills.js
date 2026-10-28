// U12 copy is bundled verbatim; no runtime fetch.
GAME_DATA.onboarding = {
  // 12-117: the new-game intro, shown once to a new game only (state.onboarding.intro stays the flag; onboarding.panel = the line index).
  // Approved 10-23. Edit only here: beats [{art, lines:[{speaker,text}]}].
  "intro": [
    {"art": "living", "lines": [{"speaker": "칼리", "text": "추석 특집 개그쇼, 기억나요?"}, {"speaker": "칼리", "text": "웃기던 개그맨이 마술을 가르쳐 줬어요."}]},
    {"art": "dream", "lines": [{"speaker": "어린 칼리", "text": "나도 저렇게 웃기고 신기한 거 하고 싶다!"}, {"speaker": "칼리", "text": "그날부터 카드를 손에서 안 놨죠. ㅋㅋ"}]},
    {"art": "stages", "lines": [{"speaker": "칼리", "text": "극장도, 방송도, 언젠가 달 위 무대도."}, {"speaker": "칼리", "text": "근데 첫 관객은 누가 될까요?"}]},
    {"art": "school", "lines": [{"speaker": "세로나", "text": "안녕하세요, 세로나예요. 옆에서 도울게요."}, {"speaker": "세로나", "text": "첫 무대는 교실이에요. 가 볼까요?"}]}
  ],
  // One illustration per beat (768x512, key content in the central 512x512). The game never requests a file that is not there: it shows "file" only
  // when "ready" is true, else "fallback". When the drawn file lands, set its "ready" to true (data only, no code change).
  "introArt": {
    "living": {"file": "assets/story/intro-1-living.webp", "ready": true, "fallback": "assets/venue-01-family.webp"},
    "dream": {"file": "assets/story/intro-2-dream.webp", "ready": true, "fallback": "assets/venue-05-theater.webp"},
    "stages": {"file": "assets/story/intro-3-stages.webp", "ready": true, "fallback": "assets/venue-13-multiverse.webp"},
    "school": {"file": "assets/story/intro-4-school.webp", "ready": true, "fallback": "assets/venue-03-school.webp"}
  },
  "introPortraits": {"어린 칼리": "assets/aud-young-kali.webp", "세로나": "assets/serona.webp"},
  "tutorial": [
    {
      "id": "hold",
      "title": "케이스 열기",
      "body": "오른쪽 카드 케이스를 꾹 누르고 있어요."
    },
    {
      "id": "badge",
      "title": "마술 아이템",
      "body": "나온 아이템이 능력치를 올려 줘요."
    },
    {
      "id": "doubt",
      "title": "의심 게이지",
      "body": "능력치가 오르면 의심 게이지가 줄어요."
    },
    {
      "id": "heckle",
      "title": "야유 조심",
      "body": "야유에 멘탈이 깎이면 자신감을 올려요."
    },
    {
      "id": "learn",
      "title": "비법 배우기",
      "body": "비법서에서 동전으로 비법을 배워요."
    },
    {
      "id": "buyAll",
      "title": "비법 고르기",
      "body": "공연이 끝나면 비법 노트에서 배울 비법을 직접 골라요."
    },
    {
      "id": "goal",
      "title": "다음 목표",
      "body": "위쪽 띠를 보고 할 일을 따라가요."
    },
    {
      "id": "win",
      "title": "무대 클리어",
      "body": "마지막 관객을 감탄시키면 다음 무대로 가요."
    }
  ],
  "skip": "건너뛰기",
  "replay": "튜토리얼 다시 보기",
  "start": "마술 시작하기"
};
// s5t (owner 10-25): first-use hints after the tutorial. The toasts carry the speaker name 세로나; skill and finale are new triggers.
// {skill} is the display name of the skill that became ready (D.skills name). goal keeps the tutorial body text. The first failed show opens
// a 세로나 dialogue (the story dialogue box with 다음) with the two firstFail lines instead of the old one-line buyAll toast.
GAME_DATA.onboarding.seronaHints = {
  speaker: "세로나",
  skill: "{skill} 준비됐어요. 지금 눌러 봐요.",
  learn: "동전이 모였네요. 비법서에서 하나 배워 봐요.",
  finale: "피날레가 꽉 찼어요. 지금 터뜨려요!",
  heckle: "야유에 흔들리면 자신감을 올려 봐요.",
  badge: "케이스에서 나온 아이템이 실력을 올려 줘요.",
  win: "마지막 관객까지 감탄하면 다음 무대예요.",
  firstFail: [
    { speaker: "세로나", text: "비법 노트에서 더 많은 마술 기법을 배울 수 있어요." },
    { speaker: "세로나", text: "들어가서 배우시면 실력이 더 좋아질 거예요." }
  ]
};
GAME_DATA.tree.push({id:"autoLearn",name:"자동 배우기",desc:"켜 두면 공연 중 3초마다 살 수 있는 비법을 모두 배워요.",branch:"luck",prereqs:["coinLuck"],x:5,y:6,max:1,cost:[100],currency:"coins",reveal:"N",icon:"node-assistant.png",emoji:"📖",venueSlug:"school",pending:false,u12:true});

// U12 bulk-learning economy: optional helper upgrades remain a late investment.
GAME_DATA.tree.filter(n=>n.u4b && n.max>1 || n.id==='chainPower').forEach(n=>{n.cost={c:n.cost.c*3,g:14};});

GAME_DATA.tree.find(n=>n.id==='attack').cost=Array.from({length:10},(_,i)=>i<8?Math.ceil(45*1.65**i):i===8?100000:200000);
GAME_DATA.tree.find(n=>n.id==='power').cost.g=2.0;

// v4 U44: the product prices in the tree rows are final (they were scaled by 0.6 here before).

// U13 idle progression, stat milestones and fight-time skills.
GAME_DATA.skills = [
  {id:'showtime',name:'쇼타임',clear:'party',duration:20000,cooldown:90000,icon:'skill-showtime.png',emoji:'🎩'},
  {id:'cardrain',name:'카드 비',clear:'cafe',duration:0,cooldown:60000,icon:'skill-cardrain.png',emoji:'🃏'},
  {id:'cheer',name:'관객 호응',clear:'theater',duration:0,cooldown:75000,icon:'skill-cheer.png',emoji:'👏'}
];
(function(D){
  const add=(id,name,max,c,x,y,desc,pre='boxHelper')=>D.tree.push({id,name,max,cost:{c,g:2},x,y,desc,prereqs:[pre],branch:'pet',currency:'coins',reveal:'N',icon:'node-assistant.png',emoji:'🌙',pending:false,u13:true});
  add('nightShow','야간 공연',4,800,-8,3,'자리 비운 보상 상한 +1시간씩 · 기본 8시간');
  add('manager','매니저 계약',3,1500,-7,4,'자리 비운 보상 효율 +10%p씩 · 기본 70%');
  add('autoPractice','자동 연습 속도',4,500,-7,5,'손을 뗐을 때 수동 타격 속도의 +10%씩 · 기본 40%', 'root');
  D.skills.forEach((s,i)=>add(s.id+'Cooldown',s.name+' 준비',3,1200*(i+1),-7,6+i,'재사용 시간 -10%씩', 'root'));
  D.tree.find(n=>n.id==='caseMax').max=45;
  D.tree.find(n=>n.id==='caseMax').cost=Array.from({length:45},(_,i)=>i<10?Math.ceil(240*1.5**i):Math.ceil(1e9*1.15**(i-10)));
  D.tree.find(n=>n.id==='caseMax').desc='케이스 최대 LV +1 · 기본 5, 최대 50';
  D.tree.forEach(n=>{if(['power','attack','mental','spawn','speed','coinLuck'].includes(n.id)||n.starKey)n.statMilestone=true;});
})(GAME_DATA);

// U13 pace tuning keeps active skill and milestone effects intact.
// 12-107 S6: hp scale folded into HP_FINAL (end of file). Was: (function(D){const scale={school:1.3,cafe:1.2,meetup:1.5,theater:1.1,festival:1.1,audition:4.15,broadcast:5,vegas:9,broadway:13,moon:19,sun:120,galaxy:500,multiverse:840,lecturenote:120};D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor*=scale[v.slug];});D.venues.find(v=>v.slug==='lecturenote').bossHpFactor*=4.9;})(GAME_DATA);

/* U14 daily selection uses a date hash, independent of combat randomness. */
GAME_DATA.missions = [
 {id:'boxes',name:'케이스 200개 열기',target:200,gems:3},
 {id:'combo',name:'액트 50 달성',target:50,gems:3},
 {id:'dealer',name:'수상한 샵 매니저 1회',target:1,gems:2},
 {id:'learn',name:'비법 5개 배우기',target:5,gems:2},
 {id:'events',name:'이벤트 관객 2명 잡기',target:2,gems:4},
 {id:'skills',name:'액티브 스킬 5회',target:5,gems:3},
 {id:'wins',name:'관객 3명 감탄',target:3,gems:2},
 {id:'golden',name:'황금 케이스 1개 열기',target:1,gems:3},
 {id:'offline',name:'자리 비운 동안 보상 받기',target:1,gems:2},
 {id:'clear',name:'무대 클리어 1회',target:1,gems:4}
];
GAME_DATA.streakGems = [2,3,4,5,6,7,10];

// U14 pace tuning includes visitors and dimension sets; daily rewards stay outside simulations.
// 12-107 S6: hp scale folded into HP_FINAL (end of file). Was: (function(D){const scale={meetup:1.16,audition:3.8,broadcast:3,vegas:5,broadway:8,moon:24,sun:13,galaxy:2.4,multiverse:2.05,lecturenote:2};D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor*=scale[v.slug];});})(GAME_DATA);

/* U15 story content is bundled from the supplied, read-only source. */
// Batch D owner review table. Edit reveal, ending and IF dialogue here.
// Sources: fourth script (2026-10-17), ACT 3/4 IF draft, twist design (2026-10-18).
