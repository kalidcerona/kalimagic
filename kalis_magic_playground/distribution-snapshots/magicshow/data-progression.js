// U4a progression extensions. Infinity is persisted as levels, never as a JSON number.
(function (D) {
  function add(id, name, branch, pre, x, y, max, c, icon, extra) {
    D.tree.push(Object.assign({ id: id, name: name, desc: name, branch: branch, prereqs: [pre], x: x, y: y, max: max, cost: {c:c,g:1.5}, currency:'coins', reveal:'N', icon:icon+'.png', emoji:icon==='node-chain'?'⚡':icon==='node-caselevel'?'📦':'∞', pending:false, u4a:true }, extra || {}));
  }
  add('caseMax','케이스 한계','box','board',6,0,10,240,'node-caselevel',{desc:'케이스 최대 LV +1, 기본 5',gates:[null,null,null,{type:'venue',target:5},{type:'venue',target:5},{type:'venue',target:5},{type:'venue',target:8},{type:'venue',target:8},{type:'venue',target:11},{type:'venue',target:11}]});
  add('caseStart','숙련된 케이스','box','caseMax',7,0,3,900,'node-caselevel',{desc:'새 케이스 시작 LV +1'});
  add('caseXp','케이스 연습','box','caseMax',6,-1,3,500,'node-caselevel',{desc:'케이스 경험치 +15%씩'});
  add('chain4','케이스 연쇄','box','caseXp',7,-1,1,1800,'node-chain',{desc:'개봉하면 인접 4방향에 마술 실력의 30%',gate:{type:'goldenOpened',target:1}});
  add('chain8','팔방 연쇄','box','chain4',8,-1,1,4500,'node-chain',{desc:'대각선까지 8방향 연쇄',gate:{type:'comboMax',target:100}});
  add('chainPower','번개의 힘','box','chain4',8,0,3,2500,'node-chain',{desc:'연쇄 피해 +10%p씩',gate:{type:'venue',target:6}});
  const gates={area:[null,null,{type:'casesAtLv',lv:4,target:3}],precision:{type:'venue',target:9},boxHeal:{type:'casesAtLv',lv:4,target:3},calm:{type:'venue',target:5},jackpot:{type:'dealerFlips',target:3},lessonBias:{type:'coinsEarned',target:5000},encorePower:{type:'comboMax',target:50},challenge:{type:'coinsEarned',target:10000},goldCoins:{type:'goldenOpened',target:3},caseStart:{type:'casesAtLv',lv:5,target:3}};
  Object.keys(gates).forEach(id=>{const n=D.tree.find(n=>n.id===id);if(n){if(Array.isArray(gates[id]))n.gates=gates[id];else n.gate=gates[id];}});
  const branches=['hand','box','heart','luck','pet','finale','collection','star'];
  const ends={hand:[-6,-1,-7,-1],box:[9,0,10,0],heart:[1,-5,2,-5],luck:[5,3,5,4],pet:[-6,3,-7,3],finale:[0,6,0,6],collection:[11,4,11,4],star:[5,-6,5,-6]};
  branches.forEach((b,i)=>{
    const visible=D.tree.filter(n=>n.branch===b);
    const last=visible[visible.length-1];
    if(i<5) add('hidden-'+b,'숨은 '+({hand:'손끝',box:'케이스',heart:'배짱',luck:'행운',pet:'조수'})[b],b,last.id,ends[b][0],ends[b][1],1,12000,'node-infinite',{hidden:true,emoji:'✨',branchMax:[last.id],desc:'이 가지의 주 능력 +2%',statBranch:b});
    // v4 U38: the endless "infinite-<branch>" nodes were removed; saves refund their levels on load (core.js infiniteRefund).
  });
})(GAME_DATA);


// U4b helper branches and dimension-local stage abilities.
(function (D) {
  const defs = [
    ['sponge','스펀지볼',2,[['Count','수',2],['Speed','속도',3],['Power','파워',5]]],
    ['cardthrow','카드 던지기',3,[['Count','수',3],['Speed','속도',3],['Power','파워',5]]],
    ['tipbox','팁 박스',4,[['Speed','속도',3],['Power','금액',4]]],
    ['flashpaper','플래시 페이퍼',5,[['Chance','확률',4],['Power','파워',4]]],
    ['crystal','수정구',6,[['Speed','속도',3],['Power','파워',4]]],
    ['water','치킨 한 조각',6,[['Speed','속도',3],['Power','파워',4]]],
    ['spotlight','스포트라이트',7,[['Count','행 수',1],['Speed','속도',3],['Power','파워',5]]]
  ];
  defs.forEach(([id,name,venue,up],i) => {
    const make=(key,label,max,pre,x,c,desc)=>D.tree.push({id:key,name:label,desc,branch:'pet',prereqs:[pre],x,y:8+i,max,cost:{c,g:1.5},currency:'coins',reveal:'N',icon:'node-'+(id==='water'?'chicken':id)+'.png',emoji:'✨',pending:false,u4b:true,gate:{type:'venue',target:venue}});
    make(id,name,1,'root',0,180*venue,name+' 자동 도우미');
    up.forEach(([suffix,label,max],j)=>make(id+suffix,name+' '+label,max,id,j+1,250*venue,label+' 강화'));
  });
  D.tree.push({id:'fanPower',name:'팬과 어시스턴트 파워',desc:'작업 피해 +15%씩',branch:'pet',prereqs:['boxHelper'],x:-5,y:4,max:5,cost:{c:1200,g:1.5},currency:'coins',reveal:'N',icon:'node-fan.png',emoji:'👏',pending:false,u4b:true});
  const stars=D.tree.filter(n=>n.starKey);
  stars.forEach((n,i)=>{n.x=-2+i;n.y=-7;});
  D.stageRewards = ['액트 유지 +500 ms','마술 실력 ×1.2','모든 도우미 속도 +10%','새 케이스 시작 LV +1','연쇄 피해 +15%','피날레 피해 +30%'].map((effect,i)=>({id:i+1,venue:(i+1)*2,effect,quote:['박수 사이에도 마술은 이어져요.','손끝을 믿어 주세요.','함께하면 더 빠르죠.','새 케이스도 경험을 기억해요.','놀라움은 옆자리로 번져요.','마지막까지 당신의 확신을 보여 주세요.'][i]}));
})(GAME_DATA);

// U4b pace compensation for stage abilities and the expanded helper ensemble.
// 12-107 S6: hp scale folded into HP_FINAL (end of file). Was: GAME_DATA.venues.forEach(v=>{const factors={party:2.08,school:2.08,cafe:2.08,theater:3.25,festival:3.25,audition:3.25,broadcast:2.1,vegas:3.575,broadway:3.575,moon:3.575,sun:3.575,galaxy:3.025,multiverse:2.65};if(factors[v.slug])v.hpFactor=factors[v.slug];});

GAME_DATA.tree.filter(n=>n.u4b).forEach(n=>{
 const base={sponge:'보드에서 튕기며 접촉마다 마술 실력의 25%, 같은 칸은 400ms 간격',cardthrow:'1500ms마다 카드 1장, 마술 실력의 40%',tipbox:'6000ms마다 무대별 동전 획득',flashpaper:'개봉 시 3% 확률, 최대 2개. 누르면 모든 케이스에 마술 실력의 150%',crystal:'8000ms마다 최대 멘탈의 0.6% 자신감, 상한 적용',water:'9000ms마다 최대 멘탈의 3% 회복',spotlight:'4000ms마다 보유 1행에 마술 실력의 60%'};
 if(base[n.id])n.desc=base[n.id];
 else if(n.id.endsWith('Count'))n.desc='도우미 수 +1, 최대 '+({spongeCount:3,cardthrowCount:4,spotlightCount:2})[n.id];
 else if(n.id.endsWith('Speed'))n.desc=n.id==='spongeSpeed'?'이동 속도 +12%씩':'주기 -10%씩';
 else if(n.id==='flashpaperChance')n.desc='드롭 확률 +1%p씩, 최대 7%';
 else if(n.id.endsWith('Power')&&n.id!=='fanPower')n.desc='효과 +'+(n.id==='tipboxPower'?25:['crystalPower','waterPower','flashpaperPower'].includes(n.id)?20:15)+'%씩';
});

// U5 character dialogue is bundled, with no runtime JSON request.
// Fight dialogue is applied from storyV15 below.


// U7: stable economy identities; array position is presentation order only.
(function (D) {
  D.legacyVenueSlugs = ['family','party','school','cafe','theater','festival','audition','broadcast','vegas','broadway','moon','sun','galaxy','multiverse'];
  const oldSlug = n => D.legacyVenueSlugs[n - 1];
  D.slotRewardSlugs = D.legacyVenueSlugs.slice(1);
  D.fanVenueSlugs = ['school','theater','broadcast','moon','multiverse'];
  D.areaVenueSlugs = ['family','party','school','cafe','festival','vegas','moon','galaxy'];
  D.tree.forEach(n => {
    if (/^N\d+$/.test(n.reveal)) { n.venueSlug = oldSlug(Number(n.reveal.slice(1))); n.reveal = 'N'; }
    for (const g of [n.gate, ...(n.gates || [])]) if (g && g.type === 'venue') { g.slug = oldSlug(g.target); delete g.target; }
  });
  D.stageRewards.forEach(r => { r.venueSlug = oldSlug(r.venue); delete r.venue; });
  D.dealer.cardVenue = 'party'; D.dealer.slotVenue = 'theater';
  D.venues.find(v => v.slug === 'multiverse').headliner.bossProfile = 'mirror';
  const content = {
  "venues": {
    "meetup": {
      "intro": "형들이 강의실에 모였다!",
      "successLine": "형들이 박수를 보낸다!",
      "trophy": "전국 순회 마술사"
    },
    "lecturenote": {
      "intro": "야간 알바였던 가게로 돌아왔다!",
      "successLine": "서재 테이블로 갈 시간이다!",
      "trophy": "렉쳐노트 식구"
    }
  },
  "chars": {
    "a-meetup-busan": {
      "name": "에지",
      "flavor": "부산의 마술 매니아. 형.",
      "heckles": [
        "부산 에지야. 편하게 해.",
        "강의는 같이 하는 거야.",
        "심리 마술, 네 말로 해.",
        "칼리야, 긴장 풀어."
      ],
      "winLine": "심리랑 교육, 네 말로 해도 돼."
    },
    "a-meetup-daegu": {
      "name": "총무 형",
      "flavor": "출석과 회비를 적는 형.",
      "heckles": [
        "뒷줄에서 손 보고 있다.",
        "셔플 다음이 궁금하다.",
        "손 놓는 순간만 본다."
      ],
      "winLine": "이야기보다 손이 먼저네."
    },
    "a-meetup-changwon": {
      "name": "빨간 모자",
      "flavor": "창원의 마술 매니아. 형.",
      "heckles": [
        "창원 빨간 모자야.",
        "반갑다, 칼리야.",
        "모자 쓰고 손 본다.",
        "손 놓치지 않는다, 칼리야."
      ],
      "winLine": "칼리야, 그래서 3만 원을 낸 거구나."
    },
    "a-meetup-incheon": {
      "name": "비타민",
      "flavor": "인천의 마술 매니아. 형.",
      "heckles": [
        "인천 비타민이다.",
        "잘 부탁해, 칼리야.",
        "정갈하게 한 번에 가자.",
        "소재는 다양하게 가자."
      ],
      "winLine": "날아가는 비둘기도 스냅 한 번에 돌아오게 하는 마술사 비타민입니다"
    },
    "a-meetup-geoje": {
      "name": "막내 회원",
      "flavor": "가방을 무릎에 둔 막내.",
      "encounterLine": "멀리서 왔는데, 손 좀 보자.",
      "heckles": [
        "멀리서 왔는데, 손 좀 보자.",
        "자리만 있으면 충분하다.",
        "초보는 눈부터지."
      ],
      "winLine": "먼 길, 아깝지 않다."
    },
    "a-meetup-cheonan": {
      "name": "간식 형",
      "flavor": "공연 뒤에 봉지를 여는 형.",
      "heckles": [
        "간식은 공연 뒤에 열자.",
        "하나만 더, 진짜 마지막.",
        "봉지는 접어 두고 본다."
      ],
      "winLine": "간식보다 손이 남네."
    },
    "a-meetup-suwon": {
      "name": "착한 천사",
      "flavor": "경북 구미의 마술 매니아. 형.",
      "heckles": [
        "경북 구미에서 왔다.",
        "칼리야, 손 좀 보자.",
        "가르침은 천천히 하자.",
        "끝나고 꼼장어집이다."
      ],
      "winLine": "끝나고 꼼장어집 가자, 칼리야."
    },
    "h-meetup-seoul": {
      "name": "마술삼일",
      "flavor": "서울의 마술 매니아. 형.",
      "heckles": [
        "서울에서 왔다, 칼리야.",
        "앉아. 편하게 해.",
        "관객이 해낸 듯 가자.",
        "마지막은 즐겁게 봐."
      ],
      "winLine": "칼리야, 소극장도 한 번 서 봐.",
      "preLine": "서울에서 왔다. 칼리야, 앉아.",
      "defeatLine": "칼리야, 소극장도 한 번 서 봐."
    },
    "a-lecturenote-hecate": {
      "name": "헤카테",
      "flavor": "포장할 것과 재고를 보는 직원.",
      "heckles": [
            "재고 칸은 제가 볼게요.",
            "포장 줄, 공연 뒤에 이을게요.",
            "손 위치만 확인했어요.",
            "문의 응대는 끝나고 할게요."
      ],
      "winLine": "점검보다 손이 먼저네요.",
      "title": "부장",
      "gender": "male"
},
    "a-lecturenote-serona": {
      "name": "세로나",
      "flavor": "모자를 벗으면 세로나. 숨겨진 조력자.",
      "heckles": [
            "마지막 컵앤볼이에요.",
            "모자를 벗을게요.",
            "세로나예요. 샵 매니저도 저고요.",
            "숨겨진 조력자로 있었어요."
      ],
      "winLine": "카드 몬테의 손도 제 거였어요.",
      "title": "히든 직원",
      "gender": "female"
},
    "a-lecturenote-jung": {
      "name": "정희수",
      "flavor": "포장과 카운터를 맡는 직원.",
      "heckles": [
            "판매 전에 마술 한 번, 반응 좋았음.",
            "카운터는 우리가 볼게.",
            "포장은 제가 볼게요.",
            "선반은 정리해 둘게요."
      ],
      "winLine": "카운터는 우리가 볼게.",
      "title": "직원"
},
    "h-lecturenote-kim": {
      "name": "김정명",
      "flavor": "렉쳐노트 사장님. 칼리를 얻기 위해 계획했다.",
      "heckles": [
        "매니저가 된 뒤에 말했지.",
        "사실 널 얻기 위해 다 계획했던 거다",
        "고개 돌렸더니 카드가 있더라.",
        "첫날은 야간 알바였지."
      ],
      "winLine": "고개 돌렸더니 카드가 있더라.",
      "preLine": "사실 널 얻기 위해 다 계획했던 거다",
      "defeatLine": "고개 돌렸더니 카드가 있더라.",
      "act1Line": "매니저가 된 뒤에 말했지.",
      "act2Line": "사실 널 얻기 위해 다 계획했던 거다",
      "act3Line": "고개 돌렸더니 카드가 있더라.",
      "endingLines": [
        "카드 몬테의 손도 제 거였어요.",
        "이 편안함, 가져갈게요.",
        "서재 테이블로 가요.",
        "카운터는 우리가 볼게."
      ]
    }
  }
};
  const character = (id, portrait, extra) => Object.assign({id, emoji:'✨', portraitAsset:portrait, extra:extra || {type:'none',value:0}}, content.chars[id]);
  const meetup = Object.assign({slug:'meetup', balanceRank:4, hpFactor:2.0, name:'전국 마술 매니아', crowd:8, crowdEmoji:'🃏👏',
    venueAsset:'venue-05-meetup.png', crowdAsset:'crowd-05-meetup.png', palette:{bg1:'#242d34',bg2:'#766446',accent:'#f7cc70'},
    audiences:['busan','daegu','changwon','incheon','geoje','cheonan','suwon'].map((city,i) => character('a-meetup-'+city,'aud-meetup-'+city+'.png', [{type:'combo',value:16},{type:'combo',value:18},{type:'finisher',value:1},{type:'timeLimit',value:60},{type:'none',value:0},{type:'timeLimit',value:60},{type:'noDamage',value:0}][i])),
    headliner:Object.assign(character('h-meetup-seoul','headliner-meetup-seoul.png'),{pattern:'friendlyReview'})},content.venues.meetup);
  const home = Object.assign({slug:'lecturenote', balanceRank:13, hpFactor:1.2, bossHpFactor:0.9, name:'렉쳐노트', crowd:4, crowdEmoji:'👏✨',
    venueAsset:'venue-16-lecturenote.png', crowdAsset:'crowd-16-lecturenote.png', palette:{bg1:'#392b26',bg2:'#8f6844',accent:'#ffdc99'},
    audiences:[character('a-lecturenote-hecate','aud-lecturenote-hecate.png',{type:'finisher',value:1}),character('a-lecturenote-serona','aud-lecturenote-serona.png'),character('a-lecturenote-jung','aud-lecturenote-jung.png')],
    headliner:Object.assign(character('h-lecturenote-kim','headliner-lecturenote-kim.png'),{pattern:'homecoming',bossProfile:'homecoming'})},content.venues.lecturenote);
  D.venues.splice(4,0,meetup); D.venues.push(home);
  D.venues.forEach((v,i) => { v.id = i + 1; });
  D.ui.patterns.friendlyReview='별표 케이스 · 놓쳐도 괜찮아요'; D.ui.patterns.homecoming='함께 만드는 세 막';
  D.ui.rebirthStay = '가게에 남기'; D.ui.rebirthOther = '다음 차원의 공연';
})(GAME_DATA);

