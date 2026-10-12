/* GAME_DATA keys (content and tree metadata; effect formulas live in core):
 * title: string.
 * venues[16]: {id: display order, slug: stable identity, balanceRank, name, intro, palette:{bg1,bg2,accent},
 *   successLine, trophy,
 *   headliner:{id, name, emoji, flavor, pattern, bossProfile?, preLine, defeatLine, phase2Line?},
 *   audiences[]:{id, name, emoji, flavor, extra:{type, value}},
 *   invitation?: {keys, name}}.
 * extra.type: none | finisher | noDamage | timeLimit | combo.
 *   none: no extra beyond three wins ("3번 감탄"). value 0.
 *   finisher: a finisher fired and the fight was won. value 1.
 *   noDamage: won without losing mental. value 0.
 *   timeLimit: won within value seconds.
 *   combo: combo reached value during the fight, then won.
 *   Venue 1 is all none. From venue 2 each regular has one extra.
 * headliner.pattern: none | slow | sealBox | stealCoins | heal | invisible | twoPhase | friendlyReview | homecoming.
 *   none: no pattern (venues 1..3). slow: time slow. sealBox: seal one box.
 *   stealCoins: steal coins. heal: restore doubt. invisible: missable beats.
 *   twoPhase: two phases. Only multiverse, name "가장 의심 많은 나".
 *   phase2Line is the second-phase entrance, only on twoPhase.
 * invitation is attached to its venue slug; no numeric progression gates.
 * items.types[]: {id, name, emoji, effect: damage|shield|heal|coins}.
 * items.rarities[]: {id, name, color}.
 * tree[]: {id, name, desc, emoji, max, cost, currency, prereqs, x, y, reveal, branch, icon, pending, starKey?}.
 *   cost is a per-level list or {c,g}; starKey maps to the existing state.stars ledger.
 * dealer: {name, cardVenue, slotVenue, introLines[], cardRules, dudLine,
 *   cardPrizes[{id, name, emoji, kind, value}], slotRules,
 *   slotSymbols[{id, name, emoji, good}], forceLine}.
 *   kind: coins | gems | heal | buff.
 *   coins/gems value = amount. heal value = percent of max mental.
 *   buff value = percent trick-power bonus until the next audience.
 *   cardVenue party, slotVenue theater: stable slugs for dealer unlocks.
 * pools: {win[], fail[], heckles[], failReason}. failReason uses {pct}.
 * dimensions[5]: {d, name, hue, ending:{title, body}}. hue is degrees.
 * genericEnding: {title, body} with a {d} placeholder. For D>5.
 * story.reveal[]: short lines on the first multiverse clear.
 * ui: menu labels, rotate, restart, retreat, rebirth, stat labels,
 *   bestiary condition templates (timeLimit/combo use {value}).
 * Copy: banners <= 14 chars, other lines <= 34. No em dash, no tilde.
 */
(typeof window!=='undefined'?window:globalThis).GAME_DATA = {
  title: "칼리 마술 성장기",
  venues: [
    {
      id: 1,
      balanceRank: 1,
      venueAsset: "venue-01-family.png",
      crowdAsset: "crowd-01.png",
      slug: "family",
      crowd: 3,
      crowdEmoji: "👨👩🧒",
      name: "가족 거실",
      intro: "가족들이 리모컨을 내려놓았다!",
      palette: { bg1: "#3e2b24", bg2: "#9f7954", accent: "#ffe65c" },
      successLine: "거실이 박수로 들썩인다!",
      trophy: "거실 스타",
      headliner: {
        id: "h1",
        name: "까다로운 할머니",
        emoji: "👵",
        flavor: "안경 너머로 손을 쫓는다.",
        pattern: "none",
        preLine: "그거, 손 안 바꾼 거지?",
        defeatLine: "손 안 바꿨네. 박수다."
      },
      audiences: [
        { id: "a1", name: "아빠", emoji: "👨", flavor: "채널권은 아직 내 손이다.", extra: { type: "none", value: 0 } },
        { id: "a2", name: "동생", emoji: "🧒", flavor: "팝콘보다 마술이 궁금하다.", extra: { type: "none", value: 0 } },
        { id: "a3", name: "엄마", emoji: "👩", flavor: "설거지는 잠깐 멈춘다.", extra: { type: "none", value: 0 } }
      ]
    },
    {
      id: 2,
      balanceRank: 2,
      hpFactor: 1.6,
      venueAsset: "venue-02-party.png",
      crowdAsset: "crowd-02.png",
      slug: "party",
      crowd: 6,
      crowdEmoji: "🎈🎧🎂🕺",
      name: "친구 파티",
      intro: "친구들이 폰을 잠시 내려놨다!",
      palette: { bg1: "#3a1840", bg2: "#7a2d6b", accent: "#ff7ad9" },
      successLine: "파티 분위기가 터진다!",
      trophy: "파티의 주인공",
      headliner: {
        id: "h2",
        name: "파티 주최자",
        emoji: "🥳",
        flavor: "왕관을 쓰고 팔짱을 낀다.",
        pattern: "none",
        preLine: "오늘 주인공은 나였는데.",
        defeatLine: "됐어, 마이크는 네 거야."
      },
      audiences: [
        { id: "a4", name: "풍선 친구", emoji: "🎈", flavor: "풍선이 박수보다 먼저 터진다.", extra: { type: "finisher", value: 1 } },
        { id: "a5", name: "음악 친구", emoji: "🎧", flavor: "다음 곡 고르기를 멈춘다.", extra: { type: "noDamage", value: 0 } },
        { id: "a6", name: "케이크 친구", emoji: "🎂", flavor: "초가 꺼지기 전에 본다.", extra: { type: "timeLimit", value: 40 } }
      ]
    },
    {
      id: 3,
      balanceRank: 3,
      hpFactor: 1.6,
      venueAsset: "venue-03-school.png",
      crowdAsset: "crowd-03.png",
      slug: "school",
      crowd: 12,
      crowdEmoji: "✏️📣🧑‍🎓🎒",
      name: "학교 장기자랑",
      intro: "쉬는 시간 종이 울렸다!",
      palette: { bg1: "#1c3a28", bg2: "#2f6b45", accent: "#ffe14a" },
      successLine: "급식 줄에서도 박수!",
      trophy: "장기자랑 우승",
      headliner: {
        id: "h3",
        name: "심사 담임",
        emoji: "👩‍🏫",
        flavor: "호루라기를 손에 쥐고 있다.",
        pattern: "none",
        preLine: "시간 되면 바로 끊을게.",
        defeatLine: "자, 이건 만점이다."
      },
      audiences: [
        { id: "a7", name: "앞자리 짝꿍", emoji: "✏️", flavor: "연필로 박자까지 친다.", extra: { type: "combo", value: 8 } },
        { id: "a8", name: "응원봉 반장", emoji: "📣", flavor: "응원봉은 피날레에 켠다.", extra: { type: "finisher", value: 1 } },
        { id: "a9", name: "깐깐한 선배의 채점", emoji: "🧑‍🎓", flavor: "점수는 연필 끝에 있다.", extra: { type: "noDamage", value: 0 } },
        { id: "a46", name: "체육부 선배", emoji: "🏀", flavor: "쉬는 시간도 잊고 바라본다.", extra: { type: "timeLimit", value: 65 } }
      ]
    },
    {
      id: 4,
      balanceRank: 4,
      hpFactor: 1.6,
      venueAsset: "venue-04-cafe.png",
      crowdAsset: "crowd-04.png",
      slug: "cafe",
      crowd: 20,
      crowdEmoji: "☕💻🍰🪟",
      name: "동네 카페",
      intro: "커피 향 사이로 시선이 모인다!",
      palette: { bg1: "#2a1a12", bg2: "#5c3a28", accent: "#e8a06a" },
      successLine: "컵 소리가 딱 멎었다!",
      trophy: "카페 단골 스타",
      headliner: {
        id: "h4",
        name: "라떼 바리스타",
        emoji: "☕",
        flavor: "스팀으로 박자를 늦춘다.",
        pattern: "slow",
        preLine: "샷은 내가 느리게 내릴게.",
        defeatLine: "이 라떼, 공짜로 간다."
      },
      audiences: [
        { id: "a10", name: "노트북 손님", emoji: "💻", flavor: "배터리가 의심보다 적다.", extra: { type: "timeLimit", value: 50 } },
        { id: "a11", name: "디저트 손님", emoji: "🍰", flavor: "포크를 든 채 기다린다.", extra: { type: "combo", value: 10 } },
        { id: "a12", name: "창가 손님", emoji: "🪟", flavor: "김 서린 창에 하트를 그린다.", extra: { type: "finisher", value: 1 } },
        { id: "a50", name: "바리스타 친구", emoji: "👨‍🍳", flavor: "커피 향 사이로 감탄이 샌다.", extra: { type: "combo", value: 14 } }
      ]
    },
    {
      id: 5,
      balanceRank: 5,
      hpFactor: 2.5,
      venueAsset: "venue-05-theater.png",
      crowdAsset: "crowd-05.png",
      slug: "theater",
      crowd: 30,
      crowdEmoji: "👏📖🤫🎟️",
      name: "소극장",
      intro: "막이 오르고 조명이 켜진다!",
      palette: { bg1: "#2a0c14", bg2: "#6b1d32", accent: "#ffd36a" },
      successLine: "커튼콜이 안 끝난다!",
      trophy: "소극장 헤드라이너",
      headliner: {
        id: "h5",
        name: "까칠한 평론가",
        emoji: "🎭",
        flavor: "만년필로 별점을 준비한다.",
        pattern: "sealBox",
        preLine: "그 케이스, 내가 잠시 잠근다.",
        defeatLine: "잠금은 풀렸다. 박수."
      },
      audiences: [
        { id: "a13", name: "열성팬", emoji: "👏", flavor: "손바닥이 이미 빨갛다.", extra: { type: "noDamage", value: 0 } },
        { id: "a14", name: "일반 관객", emoji: "📖", flavor: "막간에 페이지를 넘긴다.", extra: { type: "timeLimit", value: 60 } },
        { id: "a15", name: "헤클러", emoji: "🤫", flavor: "귓속말이 박자보다 빠르다.", extra: { type: "combo", value: 12 } },
        { id: "a54", name: "대본 작가", emoji: "✍️", flavor: "대사 대신 우와를 삼킨다.", extra: { type: "finisher", value: 1 } },
        { id: "a55", name: "커튼콜 팬", emoji: "👏", flavor: "대사 대신 우와를 삼킨다.", extra: { type: "noDamage", value: 0 } }
      ]
    },
    {
      id: 6,
      balanceRank: 6,
      hpFactor: 2.5,
      venueAsset: "venue-06-festival.png",
      crowdAsset: "crowd-06.png",
      slug: "festival",
      crowd: 40,
      crowdEmoji: "🚩🍗🎤🎉",
      name: "대학 축제",
      intro: "축제 무대 앞이 꽉 찼다!",
      palette: { bg1: "#1a1040", bg2: "#3d2a8a", accent: "#7dffb3" },
      successLine: "앵콜이 축제장을 채운다!",
      trophy: "축제의 전설",
      headliner: {
        id: "h6",
        name: "축제 사회자",
        emoji: "🎙️",
        flavor: "마이크를 동전처럼 돌린다.",
        pattern: "stealCoins",
        preLine: "동전은 내가 잠깐 빌릴게.",
        defeatLine: "빌린 동전, 이자로 박수!"
      },
      audiences: [
        { id: "a16", name: "깃발 응원단", emoji: "🚩", flavor: "깃발은 피날레에 흔든다.", extra: { type: "finisher", value: 1 } },
        { id: "a17", name: "술친구", emoji: "🍗", flavor: "양념 묻은 손으로 박수!", extra: { type: "combo", value: 12 } },
        { id: "a18", name: "후배", emoji: "🎤", flavor: "우와, 아껴 뒀다.", extra: { type: "noDamage", value: 0 } },
        { id: "a59", name: "밴드 관객", emoji: "🎸", flavor: "앵콜 전에 손부터 흔든다.", extra: { type: "noDamage", value: 0 } },
        { id: "a60", name: "야광봉 팬", emoji: "✨", flavor: "앵콜 전에 손부터 흔든다.", extra: { type: "timeLimit", value: 80 } }
      ]
    },
    {
      id: 7,
      balanceRank: 7,
      hpFactor: 2.5,
      venueAsset: "venue-07-audition.png",
      crowdAsset: "crowd-07.png",
      slug: "audition",
      crowd: 60,
      crowdEmoji: "📋🎥😏🎙️",
      name: "TV 오디션",
      intro: "심사위원의 펜이 움직인다!",
      palette: { bg1: "#101828", bg2: "#1e3a5f", accent: "#7ec8ff" },
      successLine: "심사석 엄지가 올라간다!",
      trophy: "올패스 마술사",
      headliner: {
        id: "h7",
        name: "메인 심사위원",
        emoji: "📺",
        flavor: "패들 뒤에 미소를 숨긴다.",
        pattern: "heal",
        preLine: "의심은 내가 다시 채운다.",
        defeatLine: "올패스. 다음 라운드다."
      },
      audiences: [
        { id: "a19", name: "점수판 도우미", emoji: "📋", flavor: "점수가 실시간으로 오른다.", extra: { type: "timeLimit", value: 70 } },
        { id: "a20", name: "카메라 감독", emoji: "🎥", flavor: "줌인은 아직 허락 안 했다.", extra: { type: "noDamage", value: 0 } },
        { id: "a21", name: "라이벌", emoji: "😏", flavor: "네 피날레만 노려본다.", extra: { type: "finisher", value: 1 } },
        { id: "a64", name: "초대 작가", emoji: "📝", flavor: "카메라보다 무대를 본다.", extra: { type: "timeLimit", value: 85 } },
        { id: "a65", name: "리허설 관객", emoji: "🎤", flavor: "카메라보다 무대를 본다.", extra: { type: "combo", value: 17 } },
        { id: "a66", name: "방청객", emoji: "📺", flavor: "카메라보다 무대를 본다.", extra: { type: "finisher", value: 1 } }
      ]
    },
    {
      id: 8, balanceRank: 7.5, hpFactor: 1.2, slug: "broadcast", name: "TV 방송", crowd: 75, crowdEmoji: "📺👏",
      venueAsset: "venue-tv-broadcast.png", crowdAsset: "crowd-tv.png",
      intro: "생방송 시작! 손끝에 시선이 모인다", successLine: "전국에서 박수가 쏟아진다!", trophy: "생방송 스타",
      palette: { bg1: "#14283f", bg2: "#436887", accent: "#70e8ff" },
      headliner: { id: "h-broadcast", name: "국민 MC", emoji: "🎤", portraitAsset: "headliner-tv.png", flavor: "카메라가 손끝을 따라간다.", pattern: "slow", preLine: "카메라 보고, 천천히 갑시다.", defeatLine: "전국에서 박수가 쏟아진다!" },
      audiences: [
        { id: "a112", name: "생방송 PD", emoji: "📺", portraitAsset: "aud-tv1.png", flavor: "생방송의 순간을 지켜본다.", extra: { type: "timeLimit", value: 85 } },
        { id: "a113", name: "방송 작가", emoji: "📺", portraitAsset: "aud-tv2.png", flavor: "생방송의 순간을 지켜본다.", extra: { type: "combo", value: 18 } },
        { id: "a114", name: "음향 감독", emoji: "📺", portraitAsset: "aud-tv3.png", flavor: "생방송의 순간을 지켜본다.", extra: { type: "noDamage", value: 0 } },
        { id: "a115", name: "방청 응원단", emoji: "📺", portraitAsset: "aud-tv4.png", flavor: "생방송의 순간을 지켜본다.", extra: { type: "finisher", value: 1 } },
        { id: "a116", name: "열성적인 패널", emoji: "📺", portraitAsset: "aud-tv5.png", flavor: "생방송의 순간을 지켜본다.", extra: { type: "timeLimit", value: 90 } },
        { id: "a117", name: "조명 감독", emoji: "📺", portraitAsset: "aud-tv6.png", flavor: "생방송의 순간을 지켜본다.", extra: { type: "combo", value: 20 } }
      ]
    },
    {
      id: 9,
      balanceRank: 8,
      hpFactor: 1.3,
      venueAsset: "venue-08-vegas.png",
      crowdAsset: "crowd-08.png",
      slug: "vegas",
      crowd: 90,
      crowdEmoji: "💎💃💂🎰",
      name: "라스베가스",
      intro: "네온 불빛이 무대를 비춘다!",
      palette: { bg1: "#241536", bg2: "#5d2344", accent: "#ffc667" },
      successLine: "네온보다 환한 박수다!",
      trophy: "베가스의 별",
      invitation: { keys: 1, name: "라스베가스 초대장" },
      headliner: {
        id: "h8",
        name: "전설의 딜러",
        emoji: "🎰",
        flavor: "카드가 손끝에서 사라진다.",
        pattern: "invisible",
        preLine: "눈이 따라오면 이미 진 거야.",
        defeatLine: "칩은 네 쪽으로 민다."
      },
      audiences: [
        { id: "a22", name: "큰손 손님", emoji: "💎", flavor: "칩을 쌓다 손을 멈춘다.", extra: { type: "combo", value: 15 } },
        { id: "a23", name: "화려한 관객", emoji: "💃", flavor: "깃털 사이로 무대를 본다.", extra: { type: "timeLimit", value: 80 } },
        { id: "a24", name: "경비 아저씨", emoji: "💂", flavor: "팔짱이 제복보다 단단하다.", extra: { type: "noDamage", value: 0 } },
        { id: "a70", name: "호텔 손님", emoji: "🏨", flavor: "칩을 내려놓고 눈을 크게 뜬다.", extra: { type: "combo", value: 18 } },
        { id: "a71", name: "쇼 팬", emoji: "🌟", flavor: "칩을 내려놓고 눈을 크게 뜬다.", extra: { type: "finisher", value: 1 } },
        { id: "a72", name: "사진 관광객", emoji: "🎲", flavor: "칩을 내려놓고 눈을 크게 뜬다.", extra: { type: "noDamage", value: 0 } }
      ]
    },
    {
      id: 10,
      balanceRank: 9,
      hpFactor: 1.3,
      venueAsset: "venue-09-broadway.png",
      crowdAsset: "crowd-09.png",
      slug: "broadway",
      crowd: 120,
      crowdEmoji: "🎶🎟️🧐🎭",
      name: "브로드웨이",
      intro: "브로드웨이 무대에 선다!",
      palette: { bg1: "#1c1018", bg2: "#4a2030", accent: "#f0c36a" },
      successLine: "막이 내려도 박수다!",
      trophy: "브로드웨이 주연",
      invitation: { keys: 2, name: "브로드웨이 초대장" },
      headliner: {
        id: "h9",
        name: "브로드웨이 스타",
        emoji: "🌟",
        flavor: "조명을 혼자 끌어안는다.",
        pattern: "slow",
        preLine: "이 템포, 내가 늦춘다.",
        defeatLine: "커튼콜은 네 자리다."
      },
      audiences: [
        { id: "a25", name: "뮤지컬 팬", emoji: "🎶", flavor: "하이노트에 피날레를 건다.", extra: { type: "finisher", value: 1 } },
        { id: "a26", name: "뉴욕 관광객", emoji: "🎟️", flavor: "브로슈어를 접다 멈춘다.", extra: { type: "combo", value: 15 } },
        { id: "a27", name: "깐깐 비평가", emoji: "🧐", flavor: "막간에 평을 이미 적는다.", extra: { type: "timeLimit", value: 80 } },
        { id: "a76", name: "티켓 수집가", emoji: "🎟️", flavor: "커튼콜을 먼저 외친다.", extra: { type: "finisher", value: 1 } },
        { id: "a77", name: "발레 관객", emoji: "🩰", flavor: "커튼콜을 먼저 외친다.", extra: { type: "noDamage", value: 0 } },
        { id: "a78", name: "오케스트라 팬", emoji: "🎼", flavor: "커튼콜을 먼저 외친다.", extra: { type: "timeLimit", value: 95 } },
        { id: "a79", name: "의상 디자이너", emoji: "👗", flavor: "커튼콜을 먼저 외친다.", extra: { type: "combo", value: 19 } }
      ]
    },
    {
      id: 11,
      balanceRank: 10,
      hpFactor: 1.3,
      venueAsset: "venue-10-moon.png",
      crowdAsset: "crowd-10.png",
      slug: "moon",
      crowd: 150,
      crowdEmoji: "🧑‍🚀🛰️🚙🌕",
      name: "달",
      intro: "달 먼지 위에 무대가 펼쳐진다!",
      palette: { bg1: "#101a33", bg2: "#636b7c", accent: "#d6e4f0" },
      successLine: "무중력 박수가 쏟아진다!",
      trophy: "달의 마술사",
      invitation: { keys: 2, name: "달 초대장" },
      headliner: {
        id: "h10",
        name: "달 기지 대장",
        emoji: "🌕",
        flavor: "부츠로 먼지 박자를 낸다.",
        pattern: "sealBox",
        preLine: "그 케이스, 달 먼지로 봉인.",
        defeatLine: "봉인 해제. 무중력 박수."
      },
      audiences: [
        { id: "a28", name: "우주비행사", emoji: "🧑‍🚀", flavor: "헬멧 안에 박수를 아낀다.", extra: { type: "noDamage", value: 0 } },
        { id: "a29", name: "무전 담당", emoji: "🛰️", flavor: "피날레에 무전을 연다.", extra: { type: "finisher", value: 1 } },
        { id: "a30", name: "탐사차 기사", emoji: "🚙", flavor: "바퀴 자국 위에 선다.", extra: { type: "combo", value: 18 } },
        { id: "a83", name: "달 과학자", emoji: "🔭", flavor: "헬멧 너머로 박수를 보낸다.", extra: { type: "noDamage", value: 0 } },
        { id: "a84", name: "별빛 수집가", emoji: "🌟", flavor: "헬멧 너머로 박수를 보낸다.", extra: { type: "timeLimit", value: 100 } },
        { id: "a85", name: "기지 정비사", emoji: "🧑‍🚀", flavor: "헬멧 너머로 박수를 보낸다.", extra: { type: "combo", value: 20 } },
        { id: "a86", name: "우주 관광객", emoji: "🚀", flavor: "헬멧 너머로 박수를 보낸다.", extra: { type: "finisher", value: 1 } }
      ]
    },
    {
      id: 12,
      balanceRank: 11,
      hpFactor: 1.3,
      venueAsset: "venue-11-sun.png",
      crowdAsset: "crowd-11.png",
      slug: "sun",
      crowd: 200,
      crowdEmoji: "🔥🌞📷☀️",
      name: "태양",
      intro: "불꽃 관객들이 모여든다!",
      palette: { bg1: "#3a1408", bg2: "#8a2e10", accent: "#ffb020" },
      successLine: "태양이 박수로 탄다!",
      trophy: "태양의 스포트라이트",
      invitation: { keys: 3, name: "태양 초대장" },
      headliner: {
        id: "h11",
        name: "태양의 불꽃왕",
        emoji: "☀️",
        flavor: "왕관이 불꽃처럼 튄다.",
        pattern: "stealCoins",
        preLine: "동전은 태양 불꽃에 녹인다.",
        defeatLine: "녹은 동전, 빛으로 돌려준다."
      },
      audiences: [
        { id: "a31", name: "불꽃 서퍼", emoji: "🔥", flavor: "불꽃보다 빨리 끝나길 빈다.", extra: { type: "timeLimit", value: 90 } },
        { id: "a32", name: "태양 가이드", emoji: "🌞", flavor: "흑점 투어를 잠시 멈춘다.", extra: { type: "combo", value: 18 } },
        { id: "a33", name: "불꽃 사진가", emoji: "📷", flavor: "피날레에 셔터를 누른다.", extra: { type: "finisher", value: 1 } },
        { id: "a90", name: "빛 연구원", emoji: "🧪", flavor: "선글라스 너머 눈이 동그래진다.", extra: { type: "timeLimit", value: 105 } },
        { id: "a91", name: "태양 여행객", emoji: "🕶️", flavor: "선글라스 너머 눈이 동그래진다.", extra: { type: "combo", value: 21 } },
        { id: "a92", name: "태양 관측자", emoji: "🔭", flavor: "선글라스 너머 눈이 동그래진다.", extra: { type: "finisher", value: 1 } },
        { id: "a93", name: "파도 서퍼", emoji: "🏄", flavor: "선글라스 너머 눈이 동그래진다.", extra: { type: "noDamage", value: 0 } },
        { id: "a94", name: "우주 사진가", emoji: "📷", flavor: "선글라스 너머 눈이 동그래진다.", extra: { type: "timeLimit", value: 105 } }
      ]
    },
    {
      id: 13,
      balanceRank: 12,
      hpFactor: 1.1,
      venueAsset: "venue-12-galaxy.png",
      crowdAsset: "crowd-12.png",
      slug: "galaxy",
      crowd: 260,
      crowdEmoji: "👽🛸✨🌠",
      name: "은하",
      intro: "은하 곳곳에서 관객이 왔다!",
      palette: { bg1: "#0c0820", bg2: "#24145a", accent: "#c9a6ff" },
      successLine: "별들이 앵콜을 외친다!",
      trophy: "은하계 슈퍼스타",
      invitation: { keys: 3, name: "은하 초대장" },
      headliner: {
        id: "h12",
        name: "은하 황제",
        emoji: "👽",
        flavor: "별자리를 왕홀처럼 든다.",
        pattern: "heal",
        preLine: "의심은 별빛으로 다시 찬다.",
        defeatLine: "항로를 네 무대로 튼다."
      },
      audiences: [
        { id: "a34", name: "외계인 손님", emoji: "👽", flavor: "번역기가 박수를 모른다.", extra: { type: "combo", value: 20 } },
        { id: "a35", name: "UFO 파일럿", emoji: "🛸", flavor: "기체를 기울여 구경한다.", extra: { type: "noDamage", value: 0 } },
        { id: "a36", name: "별자리 선생님", emoji: "✨", flavor: "별이 지기 전에 보여 줘.", extra: { type: "timeLimit", value: 100 } },
        { id: "a98", name: "우주 음악가", emoji: "🎹", flavor: "항로를 멈추고 박자를 탄다.", extra: { type: "combo", value: 22 } },
        { id: "a99", name: "은하 사진가", emoji: "📸", flavor: "항로를 멈추고 박자를 탄다.", extra: { type: "finisher", value: 1 } },
        { id: "a100", name: "은하수 안내원", emoji: "🌌", flavor: "항로를 멈추고 박자를 탄다.", extra: { type: "noDamage", value: 0 } },
        { id: "a101", name: "혜성 레이서", emoji: "☄️", flavor: "항로를 멈추고 박자를 탄다.", extra: { type: "timeLimit", value: 110 } },
        { id: "a102", name: "소원 여행자", emoji: "✨", flavor: "항로를 멈추고 박자를 탄다.", extra: { type: "combo", value: 22 } }
      ]
    },
    {
      id: 14,
      balanceRank: 13,
      hpFactor: 1.1,
      venueAsset: "venue-13-multiverse.png",
      crowdAsset: "crowd-13.png",
      slug: "multiverse",
      crowd: 330,
      crowdEmoji: "🪞🚪🃏🌌",
      name: "멀티버스",
      intro: "모든 차원의 내가 지켜본다!",
      palette: { bg1: "#080610", bg2: "#1a1030", accent: "#9af0ff" },
      successLine: "차원마다 박수가 울린다!",
      trophy: "멀티버스의 왕관",
      invitation: { keys: 4, name: "멀티버스 초대장" },
      headliner: {
        id: "h13",
        name: "가장 의심 많은 나",
        emoji: "🪞",
        flavor: "거울 속에서 팔짱을 낀다.",
        pattern: "twoPhase",
        preLine: "난 시작도 안 한 너다.",
        phase2Line: "이제 거울이 같이 친다.",
        defeatLine: "그래서, 기립박수다."
      },
      audiences: [
        { id: "a37", name: "지팡이 없는 나", emoji: "🪞", flavor: "마술 대신 리모컨을 쥐었다.", extra: { type: "finisher", value: 1 } },
        { id: "a38", name: "연습실 못 간 나", emoji: "🚪", flavor: "연습실 문 앞에서 멈췄다.", extra: { type: "timeLimit", value: 120 } },
        { id: "a39", name: "첫 카드를 접은 나", emoji: "🃏", flavor: "카드를 가방에 도로 넣었다.", extra: { type: "combo", value: 20 } },
        { id: "a106", name: "용기 낸 나", emoji: "💫", flavor: "거울 너머의 내가 웃는다.", extra: { type: "finisher", value: 1 } },
        { id: "a107", name: "객석의 나", emoji: "👏", flavor: "거울 너머의 내가 웃는다.", extra: { type: "noDamage", value: 0 } },
        { id: "a108", name: "다른 세계의 나", emoji: "🪞", flavor: "거울 너머의 내가 웃는다.", extra: { type: "timeLimit", value: 115 } },
        { id: "a109", name: "연습을 시작한 나", emoji: "🪄", flavor: "거울 너머의 내가 웃는다.", extra: { type: "combo", value: 23 } },
        { id: "a110", name: "무대에 선 나", emoji: "🎩", flavor: "거울 너머의 내가 웃는다.", extra: { type: "finisher", value: 1 } },
        { id: "a111", name: "박수 보내는 나", emoji: "💫", flavor: "거울 너머의 내가 웃는다.", extra: { type: "noDamage", value: 0 } }
      ]
    }
  ],
  items: {
    legacyTypes: [
      { id: "card", name: "감탄", effect: "damage", share: 0.52, ladder: [
        { id: "playing-card", name: "트럼프 카드", emoji: "🃏", flavor: "한 장 뽑으면 눈빛도 바뀐다." },
        { id: "jumbo-card", name: "점보 카드", emoji: "🎴", flavor: "커진 건 카드뿐일까?" },
        { id: "nao-card-tricks", name: "Nao Card Tricks", emoji: "🃏", flavor: "손끝에서 장면이 튄다." },
        { id: "chameleon", name: "카멜레온", emoji: "🦎", flavor: "색이 바뀌면 시선도 따라간다." },
        { id: "kali-deck", name: "칼리 덱", emoji: "✨", flavor: "마지막 장까지 반짝인다." }
      ] },
      { id: "silk", name: "자신감", effect: "shield", share: 0.19, ladder: [
        { id: "silk-handkerchief", name: "실크 손수건", emoji: "🧣", flavor: "살랑 한 번, 숨도 한 번." },
        { id: "linking-rings", name: "링", emoji: "⭕", flavor: "고리가 이어지면 마음도 편안." },
        { id: "slydini-silks", name: "슬라이디니 실크", emoji: "🪄", flavor: "천천히 흔들수록 차분해진다." },
        { id: "two-si-do", name: "두 에스 아이 두", emoji: "🔗", flavor: "이름을 읊으면 호흡이 고른다." },
        { id: "tin-case", name: "틴 케이스", emoji: "🧰", flavor: "작은 케이스에 여유 한 칸." }
      ] },
      { id: "water", name: "멘탈 회복", effect: "heal", share: 0.14, ladder: [
        { id: "water-glass", name: "물 한 잔", emoji: "🥤", flavor: "한 모금 쉬고 다시 무대 앞으로." },
        { id: "sponge-balls", name: "스펀지 볼", emoji: "🔴", flavor: "쥐었다 펴면 기분도 말랑." },
        { id: "cups-and-balls", name: "컵과 공", emoji: "🏆", flavor: "컵을 열면 웃음이 쏙." },
        { id: "trace", name: "트레이스", emoji: "📘", flavor: "페이지를 넘기며 잠깐 숨 고르기." },
        { id: "classic-collection-remastered", name: "클래식 콜렉션 리마스터", emoji: "📚", flavor: "익숙한 이름이 마음을 다독인다." }
      ] },
      { id: "coin", name: "동전", effect: "coins", share: 0.09, ladder: [
        { id: "coin", name: "동전", emoji: "🪙", flavor: "짤랑, 무대에 박자가 더해진다." },
        { id: "top-hat", name: "실크햇", emoji: "🎩", flavor: "모자 속에서 잔돈이 인사한다." },
        { id: "dove", name: "비둘기", emoji: "🕊️", flavor: "날갯짓마다 동전 소리 하나." },
        { id: "rabbit", name: "토끼", emoji: "🐇", flavor: "귀를 쫑긋, 동전을 톡." },
        { id: "wand", name: "지팡이", emoji: "🪄", flavor: "가볍게 흔들면 짤랑 한 번." }
      ] },
      { id: "lecture", name: "강의 영상", effect: "lecture", share: 0.06, minRarity: 2, ladder: [
        { id: "trace2", name: "트레이스2", emoji: "🎞️", flavor: "짧은 한 장면에 경험치가 쏙.", effect: "xpBurst" },
        { id: "target", name: "타겟", emoji: "🎯", flavor: "과녁을 맞히면 피날레가 가까워진다.", effect: "finisher" },
        { id: "epiphany", name: "에피파니 Vol.1 리마스터", emoji: "💡", flavor: "번뜩임 하나가 케이스를 채운다.", effect: "boxFill" }
      ] }
    ],
    types: [
      { id: "card", name: "감탄", effect: "damage", share: 0.56, rarityMap: [0, 0, 1, 1, 1], ladder: [
        { id: "playing-card", name: "트럼프 카드", emoji: "🃏", flavor: "한 장 뽑으면 눈빛도 바뀐다." },
        { id: "jumbo-card", name: "점보 카드", emoji: "🎴", flavor: "커진 건 카드뿐일까?" }
      ] },
      { id: "silk", name: "자신감", effect: "shield", share: 0.2, rarityMap: [0, 0, 1, 1, 1], ladder: [
        { id: "silk-handkerchief", name: "실크 손수건", emoji: "🧣", flavor: "살랑 한 번, 숨도 한 번." },
        { id: "linking-rings", name: "링", emoji: "⭕", flavor: "고리가 이어지면 마음도 편안." }
      ] },
      { id: "water", name: "멘탈 회복", effect: "heal", share: 0.15, rarityMap: [0, 1, 1, 2, 2], ladder: [
        { id: "water-glass", name: "물 한 잔", emoji: "🥤", flavor: "한 모금 쉬고 다시 무대 앞으로." },
        { id: "sponge-balls", name: "스펀지 볼", emoji: "🔴", flavor: "쥐었다 펴면 기분도 말랑." },
        { id: "cups-and-balls", name: "컵과 공", emoji: "🏆", flavor: "컵을 열면 웃음이 쏙." }
      ] },
      { id: "coin", name: "동전", effect: "coins", share: 0.09, rarityMap: [0, 1, 2, 3, 4], ladder: [
        { id: "coin", name: "동전", emoji: "🪙", flavor: "짤랑, 무대에 박자가 더해진다." },
        { id: "top-hat", name: "실크햇", emoji: "🎩", flavor: "모자 속에서 잔돈이 인사한다." },
        { id: "dove", name: "비둘기", emoji: "🕊️", flavor: "날갯짓마다 동전 소리 하나." },
        { id: "rabbit", name: "토끼", emoji: "🐇", flavor: "귀를 쫑긋, 동전을 톡." },
        { id: "wand", name: "지팡이", emoji: "🪄", flavor: "가볍게 흔들면 짤랑 한 번." }
      ] },
    ],
    rarities: [
      { id: "common", name: "일반", color: "#c7d0d9" },
      { id: "rare", name: "희귀", color: "#55b9ff" },
      { id: "hero", name: "영웅", color: "#c084fc" },
      { id: "legend", name: "전설", color: "#ffb84d" },
      { id: "myth", name: "신화", color: "#ff6b9d" }
    ]
  },
  tree: [
    {"id": "root", "name": "첫 주문", "desc": "모든 비법의 시작. 이미 배웠다.", "max": 1, "cost": [0], "currency": "coins", "prereqs": [], "x": 0, "y": 0, "reveal": "N", "branch": "root", "icon": "node-root.png", "emoji": "🪄", "pending": false},
    {"id": "p-nao-card-tricks", "name": "Nao Card Tricks", "desc": "연출 ×1.25", "max": 1, "cost": [500], "currency": "coins", "prereqs": ["equip"], "x": 6, "y": 3, "reveal": "N3", "branch": "collection", "icon": "item-nao-card-tricks.png", "emoji": "✨", "pending": false, "productMultiplier": 1.25},
    {"id": "p-chameleon", "name": "카멜레온", "desc": "연출 ×1.25", "max": 1, "cost": [700], "currency": "coins", "prereqs": ["p-nao-card-tricks"], "x": 7, "y": 3, "reveal": "N4", "branch": "collection", "icon": "item-chameleon.png", "emoji": "✨", "pending": false, "productMultiplier": 1.25},
    {"id": "p-kali-deck", "name": "칼리 덱", "desc": "연출 ×1.12", "max": 1, "cost": [900], "currency": "coins", "prereqs": ["p-chameleon"], "x": 8, "y": 3, "reveal": "N5", "branch": "collection", "icon": "item-kali-deck.png", "emoji": "✨", "pending": false, "productMultiplier": 1.12},
    {"id": "p-slydini-silks", "name": "슬라이디니 실크", "desc": "연출 ×1.12", "max": 1, "cost": [1200], "currency": "coins", "prereqs": ["p-kali-deck"], "x": 9, "y": 3, "reveal": "N6", "branch": "collection", "icon": "item-slydini-silks.png", "emoji": "✨", "pending": false, "productMultiplier": 1.12},
    {"id": "p-two-si-do", "name": "두 에스 아이 두", "desc": "연출 ×1.12", "max": 1, "cost": [1500], "currency": "coins", "prereqs": ["p-slydini-silks"], "x": 10, "y": 3, "reveal": "N7", "branch": "collection", "icon": "item-two-si-do.png", "emoji": "✨", "pending": false, "productMultiplier": 1.12},
    {"id": "p-tin-case", "name": "틴 케이스", "desc": "연출 ×1.12", "max": 1, "cost": [1800], "currency": "coins", "prereqs": ["p-two-si-do"], "x": 11, "y": 3, "reveal": "N8", "branch": "collection", "icon": "item-tin-case.png", "emoji": "✨", "pending": false, "productMultiplier": 1.12},
    {"id": "p-trace", "name": "트레이스", "desc": "연출 ×1.25", "max": 1, "cost": [2400], "currency": "coins", "prereqs": ["p-nao-card-tricks"], "x": 6, "y": 4, "reveal": "N9", "branch": "collection", "icon": "item-trace.png", "emoji": "✨", "pending": false, "productMultiplier": 1.25},
    {"id": "p-classic-collection-remastered", "name": "클래식 콜렉션 리마스터", "desc": "연출 ×1.12", "max": 1, "cost": [3000], "currency": "coins", "prereqs": ["p-trace"], "x": 7, "y": 4, "reveal": "N10", "branch": "collection", "icon": "item-classic-collection-remastered.png", "emoji": "✨", "pending": false, "productMultiplier": 1.12},
    {"id": "p-trace2", "name": "트레이스2", "desc": "연출 ×1.25", "max": 1, "cost": [4000], "currency": "coins", "prereqs": ["p-classic-collection-remastered"], "x": 8, "y": 4, "reveal": "N11", "branch": "collection", "icon": "item-trace2.png", "emoji": "✨", "pending": false, "productMultiplier": 1.25},
    {"id": "p-target", "name": "타겟", "desc": "연출 ×1.25", "max": 1, "cost": [5000], "currency": "coins", "prereqs": ["p-trace2"], "x": 9, "y": 4, "reveal": "N12", "branch": "collection", "icon": "item-target.png", "emoji": "✨", "pending": false, "productMultiplier": 1.25},
    {"id": "p-epiphany", "name": "에피파니 Vol.1 리마스터", "desc": "연출 ×1.12", "max": 1, "cost": [6000], "currency": "coins", "prereqs": ["p-target"], "x": 10, "y": 4, "reveal": "N13", "branch": "collection", "icon": "item-epiphany.png", "emoji": "✨", "pending": false, "productMultiplier": 1.12},
    {"id": "assistant", "name": "마술 어시스턴트", "desc": "1200ms마다 타격 ×0.80, 황금 케이스에는 ×1.20", "max": 1, "cost": [1], "currency": "keys", "prereqs": ["boxHelper"], "x": -3, "y": 3, "reveal": "N6", "branch": "pet", "icon": "node-assistant.png", "emoji": "🎩", "pending": false},
    {"id": "power", "name": "손기술", "desc": "지팡이 피해 ×1.1^L", "max": 10, "cost": {"c": 120, "g": 2.2}, "currency": "coins", "prereqs": ["root"], "x": -1, "y": 0, "reveal": "N", "branch": "hand", "icon": "node-hand-1.png", "emoji": "✋", "pending": false},
    {"id": "speed", "name": "빠른 손놀림", "desc": "초당 타격 +0.12L, 기본 최대 4.6회 유지", "max": 10, "cost": {"c": 60, "g": 2.2}, "currency": "coins", "prereqs": ["power"], "x": -2, "y": 0, "reveal": "N", "branch": "hand", "icon": "node-hand-2.png", "emoji": "⚡", "pending": false},
    {"id": "area", "name": "넓은 지팡이", "desc": "지팡이 범위를 2×1부터 5×5까지 확장해요", "max": 8, "cost": [90, 8000, 16000, 18000, 6000, 15000, 35000, 90000], "currency": "coins", "prereqs": ["power", "board"], "x": -3, "y": 0, "reveal": "N", "branch": "hand", "icon": "node-hand-1.png", "emoji": "🪄", "pending": false},
    {"id": "crit", "name": "타이밍", "desc": "수동 지팡이 타격 8% 확률로 피해 ×1.5", "max": 1, "cost": [180], "currency": "coins", "prereqs": ["speed"], "x": -2, "y": -1, "reveal": "N", "branch": "hand", "icon": "node-hand-2.png", "emoji": "✨", "pending": false},
    {"id": "critRate", "name": "타이밍 감각", "desc": "치명타 확률 +2L%p, 최종 최대 14%", "max": 3, "cost": {"c": 450, "g": 2.2}, "currency": "coins", "prereqs": ["crit"], "x": -3, "y": -1, "reveal": "N", "branch": "hand", "icon": "node-hand-1.png", "emoji": "🎯", "pending": false},
    {"id": "critPower", "name": "반전", "desc": "치명타 배율 +0.1L, 최종 최대 1.8", "max": 3, "cost": {"c": 700, "g": 2.2}, "currency": "coins", "prereqs": ["critRate"], "x": -4, "y": -1, "reveal": "N", "branch": "hand", "icon": "node-hand-2.png", "emoji": "✨", "pending": false},
    {"id": "comboHold", "name": "루틴 연결", "desc": "콤보 유예 +250L ms, 최대 3000ms", "max": 4, "cost": {"c": 220, "g": 2.0}, "currency": "coins", "prereqs": ["area"], "x": -4, "y": 0, "reveal": "N", "branch": "hand", "icon": "node-hand-1.png", "emoji": "👏", "pending": false},
    {"id": "sweepFocus", "name": "한곳 집중", "desc": "타격 대상의 살아 있는 케이스가 정확히 1개면 피해 +5L%", "max": 3, "cost": {"c": 600, "g": 2.0}, "currency": "coins", "prereqs": ["comboHold"], "x": -5, "y": 0, "reveal": "N", "branch": "hand", "icon": "node-hand-2.png", "emoji": "🎯", "pending": false},
    {"id": "precision", "name": "미스디렉션", "desc": "투명 패턴의 빗나갈 확률에서 2L%p 차감, 최소 0", "max": 3, "cost": {"c": 1800, "g": 2.0}, "currency": "coins", "prereqs": ["critPower"], "x": -5, "y": -1, "reveal": "N9", "branch": "hand", "icon": "node-hand-1.png", "emoji": "🎯", "pending": false},
    {"id": "board", "name": "케이스 자리", "desc": "구매마다 보유 칸 +1", "max": 12, "cost": [40, 120, 300, 700, 1600, 3500, 7500, 15000, 30000, 55000, 90000, 140000], "currency": "coins", "prereqs": ["root"], "x": 1, "y": 0, "reveal": "N", "branch": "box", "icon": "node-box-1.png", "emoji": "📦", "pending": false},
    {"id": "spawn", "name": "소품 세팅", "desc": "재생성 시간 ÷1.08^L", "max": 10, "cost": {"c": 35, "g": 2.2}, "currency": "coins", "prereqs": ["board"], "x": 2, "y": 0, "reveal": "N", "branch": "box", "icon": "node-box-2.png", "emoji": "⏱️", "pending": false},
    {"id": "golden", "name": "황금 초대", "desc": "황금 케이스 해금, 첫 30초·이후 180초 규칙", "max": 1, "cost": [320], "currency": "coins", "prereqs": ["spawn"], "x": 3, "y": 0, "reveal": "N2", "branch": "box", "icon": "node-box-1.png", "emoji": "🎁", "pending": false},
    {"id": "goldPity", "name": "황금 약속", "desc": "황금 케이스 간격 -20L초, 최소 120초", "max": 3, "cost": {"c": 1000, "g": 2.2}, "currency": "coins", "prereqs": ["golden"], "x": 4, "y": 0, "reveal": "N", "branch": "box", "icon": "node-box-2.png", "emoji": "⏳", "pending": false},
    {"id": "goldCoins", "name": "금빛 사례", "desc": "황금 케이스 추가 동전 +20L%", "max": 3, "cost": {"c": 1500, "g": 2.2}, "currency": "coins", "prereqs": ["goldPity"], "x": 5, "y": 0, "reveal": "N", "branch": "box", "icon": "node-box-1.png", "emoji": "🪙", "pending": false},
    {"id": "prepared", "name": "미리 푼 매듭", "desc": "재생성 케이스가 파괴 진행률 5L%로 등장", "max": 2, "cost": {"c": 800, "g": 3.0}, "currency": "coins", "prereqs": ["spawn"], "x": 2, "y": -1, "reveal": "N3", "branch": "box", "icon": "node-box-2.png", "emoji": "🪢", "pending": false},
    {"id": "boxXP", "name": "케이스 연구", "desc": "케이스 XP +10L%, 강의 XP에는 미적용", "max": 3, "cost": {"c": 900, "g": 2.0}, "currency": "coins", "prereqs": ["prepared"], "x": 3, "y": -1, "reveal": "N", "branch": "box", "icon": "node-box-1.png", "emoji": "📚", "pending": false},
    {"id": "boxShield", "name": "실크 포장", "desc": "파괴마다 자신감 +0.1LU, cap 적용", "max": 2, "cost": {"c": 1800, "g": 2.5}, "currency": "coins", "prereqs": ["boxXP"], "x": 4, "y": -1, "reveal": "N4", "branch": "box", "icon": "node-box-2.png", "emoji": "🧣", "pending": false},
    {"id": "boxHeal", "name": "숨 고르기", "desc": "파괴마다 멘탈 +0.05LU, 최대치 적용", "max": 2, "cost": {"c": 2400, "g": 2.5}, "currency": "coins", "prereqs": ["boxShield"], "x": 5, "y": -1, "reveal": "N5", "branch": "box", "icon": "node-box-1.png", "emoji": "💧", "pending": false},
    {"id": "mental", "name": "무대 배짱", "desc": "최대 멘탈 ×1.18^L", "max": 10, "cost": {"c": 30, "g": 2.2}, "currency": "coins", "prereqs": ["root"], "x": 0, "y": -1, "reveal": "N", "branch": "heart", "icon": "node-heart-1.png", "emoji": "💛", "pending": false},
    {"id": "attack", "name": "연출력", "desc": "V ×1.05^L", "max": 10, "cost": {"c": 45, "g": 2.2}, "currency": "coins", "prereqs": ["mental"], "x": 0, "y": -2, "reveal": "N", "branch": "heart", "icon": "node-heart-2.png", "emoji": "👏", "pending": false},
    {"id": "shieldCap", "name": "넉넉한 실크", "desc": "자신감 cap 비율 0.48+0.03L", "max": 4, "cost": {"c": 250, "g": 2.2}, "currency": "coins", "prereqs": ["mental"], "x": -1, "y": -2, "reveal": "N", "branch": "heart", "icon": "node-heart-1.png", "emoji": "🧣", "pending": false},
    {"id": "shieldValue", "name": "부드러운 실크", "desc": "실크 아이템 자신감 +5L%", "max": 4, "cost": {"c": 400, "g": 2.2}, "currency": "coins", "prereqs": ["shieldCap"], "x": -1, "y": -3, "reveal": "N", "branch": "heart", "icon": "node-heart-2.png", "emoji": "🧣", "pending": false},
    {"id": "healValue", "name": "시원한 한 모금", "desc": "회복 아이템 회복량 +5L%", "max": 4, "cost": {"c": 300, "g": 2.2}, "currency": "coins", "prereqs": ["attack"], "x": 1, "y": -2, "reveal": "N", "branch": "heart", "icon": "node-heart-1.png", "emoji": "💧", "pending": false},
    {"id": "winHeal", "name": "마무리 포즈", "desc": "승리 회복 비율 0.20+0.02L", "max": 3, "cost": {"c": 650, "g": 2.2}, "currency": "coins", "prereqs": ["healValue"], "x": 1, "y": -3, "reveal": "N", "branch": "heart", "icon": "node-heart-2.png", "emoji": "👏", "pending": false},
    {"id": "levelHeal", "name": "연습의 보람", "desc": "레벨업 회복 비율 0.16+0.02L", "max": 3, "cost": {"c": 550, "g": 2.2}, "currency": "coins", "prereqs": ["attack"], "x": 0, "y": -3, "reveal": "N", "branch": "heart", "icon": "node-heart-1.png", "emoji": "💛", "pending": false},
    {"id": "openingShield", "name": "대본 준비", "desc": "새 run 시작 시 최대 멘탈의 5L% 자신감", "max": 3, "cost": {"c": 1000, "g": 2.2}, "currency": "coins", "prereqs": ["levelHeal"], "x": 0, "y": -4, "reveal": "N3", "branch": "heart", "icon": "node-heart-2.png", "emoji": "🛡️", "pending": false},
    {"id": "calm", "name": "포커페이스", "desc": "야유 피해 ×(1-0.02L)", "max": 3, "cost": {"c": 2000, "g": 2.2}, "currency": "coins", "prereqs": ["openingShield"], "x": 0, "y": -5, "reveal": "N5", "branch": "heart", "icon": "node-heart-1.png", "emoji": "💛", "pending": false},
    {"id": "coinLuck", "name": "모자 속 동전", "desc": "동전 추첨 가중치 +6L. 정규화 전 가중치이며 확률은 전체 가중치로 계산합니다.", "max": 10, "cost": {"c": 70, "g": 2.2}, "currency": "coins", "prereqs": ["root"], "x": 1, "y": 1, "reveal": "N", "branch": "luck", "icon": "node-luck-1.png", "emoji": "🪙", "pending": false},
    {"id": "forceRemove", "name": "포스", "desc": "나쁜 슬롯 문양 제거, 보석 비용 max(1,3-L)", "max": 2, "cost": [1, 1], "currency": "keys", "prereqs": ["coinLuck"], "x": 2, "y": 1, "reveal": "N5", "branch": "luck", "icon": "node-luck-2.png", "emoji": "🪄", "pending": false},
    {"id": "tip", "name": "감사의 팁", "desc": "관객 승리 동전 +5L%", "max": 4, "cost": {"c": 180, "g": 2.2}, "currency": "coins", "prereqs": ["coinLuck"], "x": 2, "y": 2, "reveal": "N", "branch": "luck", "icon": "node-luck-1.png", "emoji": "🪙", "pending": false},
    {"id": "dealerCoin", "name": "딜러의 선물", "desc": "딜러 카드의 동전 보상 +10L%", "max": 3, "cost": {"c": 650, "g": 2.2}, "currency": "coins", "prereqs": ["forceRemove"], "x": 3, "y": 1, "reveal": "N5", "branch": "luck", "icon": "node-luck-2.png", "emoji": "🎁", "pending": false},
    {"id": "jackpot", "name": "행운의 박수", "desc": "슬롯 당첨 동전 +15L%, 당첨 확률 유지", "max": 3, "cost": {"c": 1400, "g": 2.2}, "currency": "coins", "prereqs": ["dealerCoin"], "x": 4, "y": 1, "reveal": "N5", "branch": "luck", "icon": "node-luck-1.png", "emoji": "🍀", "pending": false},
    {"id": "gemFind", "name": "반짝이는 모자", "desc": "희귀 이상 드롭의 보석 확률 +1L%p", "max": 3, "cost": {"c": 900, "g": 2.2}, "currency": "coins", "prereqs": ["tip"], "x": 3, "y": 2, "reveal": "N3", "branch": "luck", "icon": "node-luck-2.png", "emoji": "💎", "pending": false},
    {"id": "equip", "name": "마술용품", "desc": "3×3 장착판, 처음 3칸 해금", "max": 1, "cost": [700], "currency": "coins", "prereqs": ["gemFind"], "x": 4, "y": 2, "reveal": "N3", "branch": "luck", "icon": "node-luck-1.png", "emoji": "🎩", "pending": false},
    {"id": "slotPlus", "name": "마술용품 자리", "desc": "장착칸 +1, 총 9칸까지", "max": 6, "cost": [600, 1200, 2400, 4800, 9600, 19200], "currency": "coins", "prereqs": ["equip"], "x": 5, "y": 2, "reveal": "N", "branch": "luck", "icon": "node-luck-2.png", "emoji": "🎩", "pending": false},
    {"id": "lessonBias", "name": "연습 노트", "desc": "케이스 XP +10%/레벨, 최대 +20%", "max": 2, "cost": {"c": 3000, "g": 3.0}, "currency": "coins", "prereqs": ["equip"], "x": 4, "y": 3, "reveal": "N5", "branch": "luck", "icon": "node-luck-1.png", "emoji": "📖", "pending": false},
    {"id": "dove", "name": "비둘기 조수", "desc": "3000ms마다 관객에게 4V 피해", "max": 1, "cost": [2], "currency": "keys", "prereqs": ["root"], "x": -1, "y": 1, "reveal": "N", "branch": "pet", "icon": "node-pet-1.png", "emoji": "🕊️", "pending": false},
    {"id": "rabbit", "name": "마술 토끼", "desc": "5000ms마다 무대별 동전 획득", "max": 1, "cost": [2], "currency": "keys", "prereqs": ["dove"], "x": -2, "y": 1, "reveal": "N", "branch": "pet", "icon": "node-pet-2.png", "emoji": "🐇", "pending": false},
    {"id": "flash", "name": "불꽃 종이", "desc": "케이스 25개 파괴마다 8V 피해", "max": 1, "cost": [2], "currency": "keys", "prereqs": ["rabbit"], "x": -3, "y": 1, "reveal": "N", "branch": "pet", "icon": "node-finale-2.png", "emoji": "🔥", "pending": false},
    {"id": "doveTempo", "name": "재빠른 날갯짓", "desc": "비둘기 주기 3000-250L ms", "max": 3, "cost": {"c": 700, "g": 2.2}, "currency": "coins", "prereqs": ["dove"], "x": -2, "y": 2, "reveal": "N", "branch": "pet", "icon": "node-pet-1.png", "emoji": "🕊️", "pending": false},
    {"id": "dovePower", "name": "힘찬 날갯짓", "desc": "비둘기 피해 +10L%", "max": 3, "cost": {"c": 850, "g": 2.2}, "currency": "coins", "prereqs": ["doveTempo"], "x": -3, "y": 2, "reveal": "N", "branch": "pet", "icon": "node-pet-1.png", "emoji": "🕊️", "pending": false},
    {"id": "rabbitTempo", "name": "바쁜 발걸음", "desc": "토끼 주기 5000-400L ms", "max": 3, "cost": {"c": 900, "g": 2.2}, "currency": "coins", "prereqs": ["rabbit"], "x": -4, "y": 2, "reveal": "N", "branch": "pet", "icon": "node-pet-2.png", "emoji": "🐇", "pending": false},
    {"id": "rabbitPurse", "name": "토끼 주머니", "desc": "토끼 지급량 +L 동전", "max": 3, "cost": {"c": 1000, "g": 2.2}, "currency": "coins", "prereqs": ["rabbitTempo"], "x": -5, "y": 2, "reveal": "N", "branch": "pet", "icon": "node-pet-2.png", "emoji": "🐇", "pending": false},
    {"id": "boxHelper", "name": "팬의 도움", "desc": "팬이 2000ms마다 마술 실력의 35%로 케이스를 두드려요", "max": 1, "cost": [2], "currency": "keys", "prereqs": ["board"], "x": -4, "y": 3, "reveal": "N3", "branch": "pet", "icon": "node-fan.png", "emoji": "👏", "pending": false},
    {"id": "helperTempo", "name": "팬의 손놀림", "desc": "팬 작업 주기 2000-200L ms", "max": 3, "cost": {"c": 2000, "g": 2.2}, "currency": "coins", "prereqs": ["boxHelper"], "x": -5, "y": 3, "reveal": "N", "branch": "pet", "icon": "node-fan.png", "emoji": "👏", "pending": false},
    {"id": "startFinale", "name": "개막 피날레", "desc": "새 run 시작 시 피날레 게이지 충전", "max": 1, "cost": [1], "currency": "keys", "prereqs": ["root"], "x": 0, "y": 1, "reveal": "N", "branch": "finale", "icon": "node-finale-1.png", "emoji": "🌟", "pending": false},
    {"id": "finalePower", "name": "표현력", "desc": "피날레 피해 22V×(1+0.08L)", "max": 4, "cost": {"c": 500, "g": 2.2}, "currency": "coins", "prereqs": ["startFinale"], "x": 0, "y": 2, "reveal": "N", "branch": "finale", "icon": "node-finale-2.png", "emoji": "🎆", "pending": false},
    {"id": "finaleNeed", "name": "짧은 예고", "desc": "필요 게이지 20-L, 최소 18", "max": 2, "cost": {"c": 2500, "g": 3.0}, "currency": "coins", "prereqs": ["finalePower"], "x": 0, "y": 3, "reveal": "N4", "branch": "finale", "icon": "node-finale-1.png", "emoji": "⏳", "pending": false},
    {"id": "comboGift", "name": "이어지는 박수", "desc": "콤보 10/25/50/100 보상 활성화", "max": 1, "cost": [900], "currency": "coins", "prereqs": ["finalePower"], "x": 1, "y": 3, "reveal": "N", "branch": "finale", "icon": "node-finale-2.png", "emoji": "👏", "pending": false},
    {"id": "comboValue", "name": "커지는 박수", "desc": "콤보 milestone의 동전 보상 +20L%", "max": 3, "cost": {"c": 1200, "g": 2.2}, "currency": "coins", "prereqs": ["comboGift"], "x": 2, "y": 3, "reveal": "N", "branch": "finale", "icon": "node-finale-1.png", "emoji": "👏", "pending": false},
    {"id": "encore", "name": "앵콜", "desc": "전투 시간 300초마다 15초간 지팡이 피해 +20%", "max": 1, "cost": [1800], "currency": "coins", "prereqs": ["finaleNeed"], "x": 0, "y": 4, "reveal": "N4", "branch": "finale", "icon": "node-finale-2.png", "emoji": "🎤", "pending": false},
    {"id": "encorePower", "name": "쇼맨십", "desc": "앵콜 피해 보너스 +5L%p", "max": 2, "cost": {"c": 4000, "g": 2.5}, "currency": "coins", "prereqs": ["encore"], "x": -1, "y": 4, "reveal": "N", "branch": "finale", "icon": "node-finale-1.png", "emoji": "🎤", "pending": false},
    {"id": "encoreSpan", "name": "긴 앵콜", "desc": "앵콜 지속 +3L초", "max": 2, "cost": {"c": 3500, "g": 2.5}, "currency": "coins", "prereqs": ["encore"], "x": 1, "y": 4, "reveal": "N", "branch": "finale", "icon": "node-finale-2.png", "emoji": "⏱️", "pending": false},
    {"id": "challenge", "name": "도전 수첩", "desc": "추가 도전 3개와 각각 V +0.5% 보상 활성화", "max": 1, "cost": [2500], "currency": "coins", "prereqs": ["encore"], "x": 0, "y": 5, "reveal": "N5", "branch": "finale", "icon": "node-finale-1.png", "emoji": "🏅", "pending": false},
    {"id": "starTrick", "name": "별빛 트릭", "desc": "연출 ×1.3^L, 지팡이 피해 ×1.14^L", "max": 30, "cost": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], "currency": "starlight", "prereqs": ["root"], "x": -2, "y": -6, "reveal": "E", "branch": "star", "icon": "node-star-1.png", "emoji": "✦", "pending": false, "starKey": "trick"},
    {"id": "starGuard", "name": "별빛 실크", "desc": "최대 멘탈·자신감·회복 ×1.18^L", "max": 30, "cost": [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], "currency": "starlight", "prereqs": ["root"], "x": 0, "y": -6, "reveal": "E", "branch": "star", "icon": "node-star-2.png", "emoji": "✦", "pending": false, "starKey": "guard"},
    {"id": "starTempo", "name": "별빛 손끝", "desc": "초당 타격 ×1.06^L, 재생성 시간 ×0.92^L", "max": 30, "cost": [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], "currency": "starlight", "prereqs": ["root"], "x": 2, "y": -6, "reveal": "E", "branch": "star", "icon": "node-star-3.png", "emoji": "✦", "pending": false, "starKey": "tempo"},
    {"id": "starBounty", "name": "별빛 모자", "desc": "동전 배율 ×1.12^L", "max": 30, "cost": [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], "currency": "starlight", "prereqs": ["root"], "x": 4, "y": -6, "reveal": "E", "branch": "star", "icon": "node-star-4.png", "emoji": "✦", "pending": false, "starKey": "bounty"}
  ],
  dealer: {
    name: "모자 속 토끼 딜러",
    cardVenue: 2,
    slotVenue: 5,
    introLines: [
      "모자 속에서 튀어나왔다.",
      "카드 한 장, 아니면 슬롯.",
      "규칙은 먼저 읽어 줘."
    ],
    cardRules: "한 장씩 고른다. 꽝이면 남은 카드는 사라진다.",
    dudLine: "꽝! 남은 카드가 사라졌다.",
    cardPrizes: [
      { id: "coins-s", name: "동전 한 줌", emoji: "🪙", kind: "coins", value: 20 },
      { id: "coins-m", name: "모자 속 잔돈", emoji: "🎩", kind: "coins", value: 60 },
      // v4 U37: kind values are the base; the dealer pays them times CONST.dealerRewardMult (2.5): gems 1 -> 3, 3 -> 8, heal 20 -> 50 percent, buff 15 -> 37.
      { id: "gems-1", name: "보석 세 알", emoji: "💎", kind: "gems", value: 1 },
      { id: "gems-3", name: "보석 여덟 알", emoji: "💎", kind: "gems", value: 3 },
      { id: "heal", name: "물 한 잔", emoji: "🥤", kind: "heal", value: 20 },
      { id: "buff", name: "박수 부적", emoji: "✨", kind: "buff", value: 15 }
    ],
    slotRules: "같은 문양 세 칸이면 보상이 나온다.",
    slotSymbols: [
      { id: "star", name: "별", emoji: "⭐", good: true },
      { id: "hat", name: "모자", emoji: "🎩", good: true },
      { id: "dove", name: "비둘기", emoji: "🕊️", good: true },
      { id: "coin", name: "동전", emoji: "🪙", good: true },
      { id: "heart", name: "하트", emoji: "💛", good: true },
      { id: "yawn", name: "하품", emoji: "🥱", good: false },
      { id: "phone", name: "휴대폰", emoji: "📱", good: false },
      { id: "boo", name: "야유", emoji: "👎", good: false },
      { id: "cough", name: "기침", emoji: "😷", good: false },
      { id: "miss", name: "빗나감", emoji: "💨", good: false }
    ],
    forceLine: "보석을 쓰면 나쁜 문양을 지운다."
  },
  pools: {
    win: [
      "공연 성공!",
      "관객 대만족!",
      "기립박수!",
      "앵콜이 터졌다!",
      "오늘의 주인공!",
      "무대 장악 완료!",
      "박수가 쏟아진다!",
      "마술 완벽 성공!",
      "환호가 가득하다!",
      "객석이 들썩인다!",
      "전석 매료 완료!",
      "커튼콜 시작!",
      "우와, 또 속았다!",
      "객석이 다 일어났다!",
      "객석이 파도친다!",
      "멀리 앉은 관객도 환호!",
      "박수가 무대 끝까지 번진다!",
      "관객석 전체가 앵콜!"
    ],
    fail: [
      "연습 부족...",
      "카드가 손에서 미끄러졌다",
      "관객이 하품을 한다",
      "토끼가 먼저 퇴근했다",
      "박수 타이밍이 어긋났다",
      "모자 속이 너무 조용하다",
      "조명이 더 주목받았다",
      "비둘기가 관객석에 착륙!",
      "마지막 주문이 안 난다",
      "케이스보다 표정이 굳었다",
      "앵콜 대신 기침 한 번",
      "커튼이 먼저 내려왔다",
      "지팡이가 먼저 절했다",
      "박수 자리가 비었다"
    ],
    heckles: [
      "그거 다 아는 거야!",
      "더 대단한 건 없어?",
      "무중력이라 그런 거지?",
      "하품이 먼저 나왔다",
      "휴대폰부터 켠다",
      "팔짱이 더 바쁘다",
      "시계를 두 번 본다",
      "야유 한 스푼!",
      "박수 대신 기침",
      "슬쩍 일어나 본다",
      "속삭임이 더 크다",
      "리모컨이 그립다",
      "뒷자리도 아직 조용한데?",
      "저 끝자리까지 들렸을까?",
      "객석이 넓으니 야유도 메아리!",
      "맨 뒤에서 하품이 번진다",
      "박수 소리가 아직 작아!",
      "옆 사람 눈치만 보는 중!"
    ],
    failReason: "의심이 {pct}% 남았어요"
  },
  dimensions: [
    {
      d: 1,
      name: "따뜻한 거실",
      hue: 28,
      ending: {
        title: "거실에서 시작된 박수",
        body: "첫 차원의 관객이 소파에서 일어났다. 리모컨은 테이블 위에 그대로다. 다음 차원도 표를 끊은 모양이다."
      }
    },
    {
      d: 2,
      name: "네온 불빛",
      hue: 320,
      ending: {
        title: "네온도 박수에 졌다",
        body: "카지노 칩이 박자처럼 쌓였다. 화려한 관객이 깃털을 한쪽으로 젖힌다. 이 차원의 불빛은 앵콜을 기억한다."
      }
    },
    {
      d: 3,
      name: "스포트라이트",
      hue: 210,
      ending: {
        title: "커튼이 먼저 박수를 친다",
        body: "막이 내려도 객석이 남았다. 비평가는 별점을 지우고 다시 적는다. 브로드웨이 표가 주머니에서 빛난다."
      }
    },
    {
      d: 4,
      name: "별먼지 연습실",
      hue: 265,
      ending: {
        title: "별들이 자리를 양보한다",
        body: "달 먼지가 박수 모양으로 남았다. 은하 안내원이 통로를 비킨다. 별빛 세 개가 모자 속에 떨어졌다."
      }
    },
    {
      d: 5,
      name: "기립박수",
      hue: 46,
      ending: {
        title: "모든 차원의 내가 기립박수를 친다",
        body: "마술을 시작하지 않은 나들이 일어섰다. 리모컨, 티켓, 헬멧이 한꺼번에 내려앉는다. 거울 속 내가 가장 크게 박수친다. 이 박수는 다섯 번째 차원의 앵콜이다."
      }
    }
  ],
  genericEnding: {
    title: "차원 {d}의 앵콜",
    body: "차원 {d}의 객석도 결국 일어섰다. 숫자는 늘었지만 박수 소리는 같다. 다음 나도 이미 표를 쥐고 있다."
  },
  story: {
    reveal: [
      "객석이 전부 낯익다.",
      "마술을 시작하지 않은 나다.",
      "지팡이 대신 리모컨을 들었다.",
      "그래도 방금, 박수를 쳤다.",
      "가장 의심 많던 나도 일어섰다."
    ]
  },
  ui: {
    menu: {
      book: "비법서",
      bestiary: "도감",
      sound: "소리"
    },
    bookTitle: "마술 비법서",
    bestiaryTitle: "관객 도감",
    dealerTitle: "토끼 딜러",
    rotate: "가로로 돌려 주세요",
    restart: "비법 노트로",
    practiceTitle: "연습실 비법 노트",
    practiceFallback: "스테이지로 가기",
    retreat: "퇴장",
    rebirthOther: "다른 차원으로 환생하기",
    rebirthStay: "이 차원에서 계속하기",
    soundOn: "소리 켜짐",
    soundOff: "소리 꺼짐",
    bestiaryBase: "3번 감탄",
    keyGrant: "열쇠 1개",
    invitationNeed: "열쇠 {keys}개",
    extras: {
      none: "3번 감탄",
      finisher: "피날레로 감탄",
      noDamage: "멘탈 손상 없이",
      timeLimit: "{value}초 안에",
      combo: "콤보 {value} 이상"
    },
    patterns: {
      none: "패턴 없음",
      slow: "시간 감속",
      sealBox: "케이스 봉인",
      stealCoins: "동전 훔치기",
      heal: "의심 회복",
      invisible: "투명",
      twoPhase: "두 단계"
    },
    stats: {
      stage: "무대",
      doubt: "의심",
      mental: "멘탈",
      shield: "자신감",
      combo: "콤보",
      finale: "피날레",
      level: "레벨",
      xp: "경험치",
      coins: "동전",
      gems: "보석",
      keys: "열쇠",
      wandArea: "지팡이 범위",
      attack: "야유",
      heckleIn: "관객의 의심",
      starlight: "별빛"
    }
  }
};

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
    ['water','물 한 잔',6,[['Speed','속도',3],['Power','파워',4]]],
    ['spotlight','스포트라이트',7,[['Count','행 수',1],['Speed','속도',3],['Power','파워',5]]]
  ];
  defs.forEach(([id,name,venue,up],i) => {
    const make=(key,label,max,pre,x,c,desc)=>D.tree.push({id:key,name:label,desc,branch:'pet',prereqs:[pre],x,y:8+i,max,cost:{c,g:1.5},currency:'coins',reveal:'N',icon:'node-'+id+'.png',emoji:'✨',pending:false,u4b:true,gate:{type:'venue',target:venue}});
    make(id,name,1,'root',0,180*venue,name+' 자동 도우미');
    up.forEach(([suffix,label,max],j)=>make(id+suffix,name+' '+label,max,id,j+1,250*venue,label+' 강화'));
  });
  D.tree.push({id:'fanPower',name:'팬과 어시스턴트 파워',desc:'작업 피해 +15%씩',branch:'pet',prereqs:['boxHelper'],x:-5,y:4,max:5,cost:{c:1200,g:1.5},currency:'coins',reveal:'N',icon:'node-fan.png',emoji:'👏',pending:false,u4b:true});
  const stars=D.tree.filter(n=>n.starKey);
  stars.forEach((n,i)=>{n.x=-2+i;n.y=-7;});
  D.stageRewards = ['콤보 유지 +500 ms','마술 실력 ×1.2','모든 도우미 속도 +10%','새 케이스 시작 LV +1','연쇄 피해 +15%','피날레 피해 +30%'].map((effect,i)=>({id:i+1,venue:(i+1)*2,effect,quote:['박수 사이에도 마술은 이어져요.','손끝을 믿어 주세요.','함께하면 더 빠르죠.','새 케이스도 경험을 기억해요.','놀라움은 옆자리로 번져요.','마지막까지 당신의 확신을 보여 주세요.'][i]}));
})(GAME_DATA);

// U4b pace compensation for stage abilities and the expanded helper ensemble.
GAME_DATA.venues.forEach(v=>{const factors={party:2.08,school:2.08,cafe:2.08,theater:3.25,festival:3.25,audition:3.25,broadcast:2.1,vegas:3.575,broadway:3.575,moon:3.575,sun:3.575,galaxy:3.025,multiverse:2.65};if(factors[v.slug])v.hpFactor=factors[v.slug];});

GAME_DATA.tree.filter(n=>n.u4b).forEach(n=>{
 const base={sponge:'보드에서 튕기며 접촉마다 마술 실력의 25%, 같은 칸은 400ms 간격',cardthrow:'1500ms마다 카드 1장, 마술 실력의 40%',tipbox:'6000ms마다 무대별 동전 획득',flashpaper:'개봉 시 3% 확률, 최대 2개. 누르면 모든 케이스에 마술 실력의 150%',crystal:'8000ms마다 최대 멘탈의 3% 자신감, 상한 적용',water:'9000ms마다 최대 멘탈의 3% 회복',spotlight:'4000ms마다 보유 1행에 마술 실력의 60%'};
 if(base[n.id])n.desc=base[n.id];
 else if(n.id.endsWith('Count'))n.desc='도우미 수 +1, 최대 '+({spongeCount:3,cardthrowCount:4,spotlightCount:2})[n.id];
 else if(n.id.endsWith('Speed'))n.desc=n.id==='spongeSpeed'?'이동 속도 +12%씩':'주기 -10%씩';
 else if(n.id==='flashpaperChance')n.desc='드롭 확률 +1%p씩, 최대 7%';
 else if(n.id.endsWith('Power')&&n.id!=='fanPower')n.desc='효과 +'+(n.id==='tipboxPower'?25:['crystalPower','waterPower','flashpaperPower'].includes(n.id)?20:15)+'%씩';
});

// U5 character dialogue is bundled, with no runtime JSON request.
(function (D) {
  const lines = {
  "h1": {
    "name": "까다로운 할머니",
    "heckles": [
      "그 손 다 보인단다.",
      "옛날 마술은 달랐어.",
      "안경 닦고 볼게.",
      "에그, 눈이 침침해."
    ],
    "winLine": "어머나, 신통하구나!"
  },
  "a1": {
    "name": "아빠",
    "heckles": [
      "아빠 때는 더 했어.",
      "채널 돌리지 마라.",
      "리모컨 어디 갔냐.",
      "아들, 그게 다냐?"
    ],
    "winLine": "우리 아들 천재네!"
  },
  "a2": {
    "name": "동생",
    "heckles": [
      "형, 나도 할 수 있어!",
      "간식 더 없어?",
      "뻔한 거 아냐?",
      "형, 이거 쉬워 보여."
    ],
    "winLine": "헐, 형 대박이다!"
  },
  "a3": {
    "name": "엄마",
    "heckles": [
      "밥 먹고 해라.",
      "설거지 남았는데.",
      "엄마 바쁘다니까.",
      "또 장난이니?"
    ],
    "winLine": "어머, 우리 아들!"
  },
  "h2": {
    "name": "파티 주최자",
    "heckles": [
      "파티는 내가 제일 알지.",
      "더 신나는 건?",
      "분위기 띄워 봐.",
      "이게 최선이야?"
    ],
    "winLine": "오늘 파티 주인공!"
  },
  "a4": {
    "name": "풍선 친구",
    "heckles": [
      "빵 터질 줄 알았지?",
      "풍선이 더 놀랍다.",
      "터뜨리는 건 나야.",
      "에이, 시시해."
    ],
    "winLine": "풍선보다 더 터졌다!"
  },
  "a5": {
    "name": "음악 친구",
    "heckles": [
      "이 노래가 더 신나.",
      "박자 놓쳤어.",
      "다음 곡 틀까?",
      "음악이 더 낫다."
    ],
    "winLine": "이건 신곡급이다!"
  },
  "a6": {
    "name": "케이크 친구",
    "heckles": [
      "초 꺼진다, 빨리!",
      "케이크가 더 달아.",
      "그게 끝이야?",
      "크림만 못한데."
    ],
    "winLine": "케이크보다 달콤해!"
  },
  "h3": {
    "name": "심사 담임",
    "heckles": [
      "호루라기 분다?",
      "규정 위반 아니니?",
      "차렷, 제대로 해.",
      "감점이다."
    ],
    "winLine": "합격이다, 만점!"
  },
  "a7": {
    "name": "앞자리 짝꿍",
    "heckles": [
      "야, 박자 틀렸어.",
      "연필 부러졌다.",
      "나도 하겠다.",
      "짝꿍, 긴장했지?"
    ],
    "winLine": "짝꿍, 너 진짜 대박!"
  },
  "a8": {
    "name": "응원봉 반장",
    "heckles": [
      "응원은 아직이야.",
      "아직 응원봉 안 켜!",
      "반장이 지켜본다.",
      "더 보여 줘 봐."
    ],
    "winLine": "응원봉 켠다, 최고!"
  },
  "a9": {
    "name": "깐깐한 선배의 채점",
    "heckles": [
      "점수 깎는다.",
      "선배가 본다.",
      "난이도가 낮네.",
      "채점 시작한다."
    ],
    "winLine": "만점 줘야겠네!"
  },
  "a46": {
    "name": "체육부 선배",
    "heckles": [
      "공 던지는 게 낫다.",
      "체력은 약해 보여.",
      "한 판 뛸래?",
      "운동장이 더 좋다."
    ],
    "winLine": "야, 너 대단하다!"
  },
  "h4": {
    "name": "라떼 바리스타",
    "heckles": [
      "커피 식겠다.",
      "라떼아트가 낫네.",
      "거품만 가득이다.",
      "주문이나 하세요."
    ],
    "winLine": "한 잔 쏠게요!"
  },
  "a10": {
    "name": "노트북 손님",
    "heckles": [
      "배터리 없는데.",
      "와이파이 끊겼다.",
      "마감 중인데요.",
      "일이나 하자."
    ],
    "winLine": "일을 잊었네요!"
  },
  "a11": {
    "name": "디저트 손님",
    "heckles": [
      "케이크 녹겠어요.",
      "포크 내려놔?",
      "달콤하진 않네요.",
      "빨리 끝내요."
    ],
    "winLine": "디저트보다 달콤!"
  },
  "a12": {
    "name": "창가 손님",
    "heckles": [
      "창밖 비 오네요.",
      "김이 서렸네요.",
      "하트나 그릴래.",
      "흔한 거 아녜요?"
    ],
    "winLine": "창가에서 소름!"
  },
  "a50": {
    "name": "바리스타 친구",
    "heckles": [
      "야, 나도 그 정도는.",
      "커피 식는다.",
      "친구라 봐준다.",
      "진짜 괜찮겠어?"
    ],
    "winLine": "친구야, 미쳤다!"
  },
  "h5": {
    "name": "까칠한 평론가",
    "heckles": [
      "별점 깎는다.",
      "구성이 진부해.",
      "평론은 냉정하다.",
      "다음 대사는?"
    ],
    "winLine": "별 다섯, 인정!"
  },
  "a13": {
    "name": "열성팬",
    "heckles": [
      "박수 준비 완료!",
      "더 크게 해 봐요!",
      "팬이라 걱정돼요.",
      "실수하면 어쩌죠?"
    ],
    "winLine": "역시 최고예요!"
  },
  "a14": {
    "name": "일반 관객",
    "heckles": [
      "프로그램에 없는데?",
      "다음 장 넘겨요.",
      "순서 틀렸어요.",
      "페이지가 남았네."
    ],
    "winLine": "프로그램 밖이다!"
  },
  "a15": {
    "name": "헤클러",
    "heckles": [
      "쉿, 속닥속닥.",
      "저거 눈속임이래.",
      "들켰대, 쉿.",
      "옆에서 알려 줄까?"
    ],
    "winLine": "헉, 소곤댈 틈 없다!"
  },
  "a54": {
    "name": "대본 작가",
    "heckles": [
      "대본이 더 낫네.",
      "대사가 약해요.",
      "결말이 뻔하죠.",
      "복선이 없잖아요."
    ],
    "winLine": "이 반전은 못 썼다!"
  },
  "a55": {
    "name": "커튼콜 팬",
    "heckles": [
      "커튼콜은 아직!",
      "앙코르는 이르죠.",
      "박수는 아껴요.",
      "팬은 냉정해요."
    ],
    "winLine": "앙코르, 앙코르!"
  },
  "h6": {
    "name": "축제 사회자",
    "heckles": [
      "마이크 넘긴다.",
      "분위기 식었다.",
      "환호가 없네요?",
      "본방은 한 번뿐이죠."
    ],
    "winLine": "축제 최고 무대다!"
  },
  "a16": {
    "name": "깃발 응원단",
    "heckles": [
      "깃발 아직 접어 둬!",
      "응원단은 냉정해.",
      "더 크게 외쳐!",
      "힘이 안 나네."
    ],
    "winLine": "깃발 흔든다, 와!"
  },
  "a17": {
    "name": "술친구",
    "heckles": [
      "치킨 식는다, 야.",
      "양념이 더 낫네.",
      "동기라서 본다.",
      "그게 다냐?"
    ],
    "winLine": "치킨보다 맛있다!"
  },
  "a18": {
    "name": "후배",
    "heckles": [
      "선배, 괜찮아요?",
      "살짝 아쉬운데.",
      "후배도 긴장돼요.",
      "믿어도 되죠?"
    ],
    "winLine": "선배 짱이에요!"
  },
  "a59": {
    "name": "밴드 관객",
    "heckles": [
      "기타 소리가 낫다.",
      "박자 놓쳤어요.",
      "밴드 부를까요?",
      "앵콜은 멀었네."
    ],
    "winLine": "앵콜 외칩니다!"
  },
  "a60": {
    "name": "야광봉 팬",
    "heckles": [
      "야광봉 안 켜져.",
      "불빛이 아깝다.",
      "조명이 더 밝다.",
      "야광봉 접는다."
    ],
    "winLine": "야광봉 번쩍!"
  },
  "h7": {
    "name": "메인 심사위원",
    "heckles": [
      "패들은 아직 내려요.",
      "오디션은 냉정해요.",
      "감동이 부족해요.",
      "한 번 더요."
    ],
    "winLine": "합격 패들 올립니다!"
  },
  "a19": {
    "name": "점수판 도우미",
    "heckles": [
      "점수 안 올라요.",
      "아직 일 점이에요.",
      "실시간 감점!",
      "올라가려나요."
    ],
    "winLine": "점수판 폭발했어요!"
  },
  "a20": {
    "name": "카메라 감독",
    "heckles": [
      "줌인 보류.",
      "각이 안 나와요.",
      "카메라 돌려요.",
      "컷, 다시 가요."
    ],
    "winLine": "줌인 들어갑니다!"
  },
  "a21": {
    "name": "라이벌",
    "heckles": [
      "내가 더 잘해.",
      "피날레는 내 거야.",
      "긴장 좀 하지?",
      "어디 한번 봐."
    ],
    "winLine": "크, 인정한다!"
  },
  "a64": {
    "name": "초대 작가",
    "heckles": [
      "대본에 없던데요.",
      "작가가 쓸 법해.",
      "반전이 약해요.",
      "섭외는 누가?"
    ],
    "winLine": "이건 대본 밖이네!"
  },
  "a65": {
    "name": "리허설 관객",
    "heckles": [
      "리허설 때 달랐죠?",
      "본방은 다르죠.",
      "큐 사인 놓쳤네.",
      "본방은 한 번뿐이죠."
    ],
    "winLine": "리허설과 천지차!"
  },
  "a66": {
    "name": "방청객",
    "heckles": [
      "박수 칠 타이밍?",
      "아직 못 쳐요.",
      "방청도 냉정해요.",
      "녹화 중이잖아요."
    ],
    "winLine": "박수가 절로 나와요!"
  },
  "h-broadcast": {
    "name": "국민 MC",
    "heckles": [
      "생방송이라 봐줘.",
      "국민이 보고 있다.",
      "실수는 못 해요.",
      "시청률 어쩌려고?"
    ],
    "winLine": "국민이 박수 칩니다!"
  },
  "a112": {
    "name": "생방송 PD",
    "heckles": [
      "큐 사인 갑니다.",
      "방송 사고 나요.",
      "시간이 없어요.",
      "컷 들어갈까요?"
    ],
    "winLine": "방송이 살았네요!"
  },
  "a113": {
    "name": "방송 작가",
    "heckles": [
      "방송 순서에 없는데?",
      "순서가 꼬였어요.",
      "수정본 보세요.",
      "대본이 안 맞아요."
    ],
    "winLine": "방송 순서 다시 쓴다!"
  },
  "a114": {
    "name": "음향 감독",
    "heckles": [
      "마이크에 걸려요.",
      "붐대 내려갑니다.",
      "소리가 안 잡혀.",
      "조심하세요, 붐!"
    ],
    "winLine": "소리 하나 안 샜다!"
  },
  "a115": {
    "name": "방청 응원단",
    "heckles": [
      "박수 칠까 말까?",
      "표정이 굳었는데?",
      "응원 소리 낮출게.",
      "환호 신호 기다려."
    ],
    "winLine": "와아, 함성 갑니다!"
  },
  "a116": {
    "name": "열성적인 패널",
    "heckles": [
      "반응이 시큰둥해요.",
      "댓글 차갑네요.",
      "실검엔 안 뜨죠.",
      "좋아요 안 올라요."
    ],
    "winLine": "실시간 반응 폭발!"
  },
  "a117": {
    "name": "조명 감독",
    "heckles": [
      "조명 놓쳤어요.",
      "그림자가 먼저네.",
      "빛이 아깝네요.",
      "각도가 어색해요."
    ],
    "winLine": "조명이 춤추네요!"
  },
  "h8": {
    "name": "전설의 딜러",
    "heckles": [
      "카드는 내 손이 낫지.",
      "이 판은 내가 이겨.",
      "패를 읽었다.",
      "허세 아니고?"
    ],
    "winLine": "인정하지, 올인이다!"
  },
  "a22": {
    "name": "큰손 손님",
    "heckles": [
      "칩을 걸어 볼까.",
      "올인할 값어치?",
      "배팅이 아깝네.",
      "판돈이 아깝다."
    ],
    "winLine": "전 재산 걸겠소!"
  },
  "a23": {
    "name": "화려한 관객",
    "heckles": [
      "깃털보다 가볍네요.",
      "화려함이 부족해.",
      "조명이 더 빛나.",
      "볼거리가 약해요."
    ],
    "winLine": "눈이 반짝반짝해요!"
  },
  "a24": {
    "name": "경비 아저씨",
    "heckles": [
      "수상한 손놀림이다.",
      "소매 좀 봅시다.",
      "신분증 보여 줘.",
      "카메라가 보고 있다."
    ],
    "winLine": "이건 반칙 아닙니다!"
  },
  "a70": {
    "name": "호텔 손님",
    "heckles": [
      "룸서비스가 낫겠네.",
      "호텔 쇼보다 밋밋해.",
      "체크아웃할까.",
      "로비가 더 화려해."
    ],
    "winLine": "객실에서 자랑해야지!"
  },
  "a71": {
    "name": "쇼 팬",
    "heckles": [
      "쇼 시간 끝났나?",
      "다음 쇼가 낫겠다.",
      "팬이라 봐줄게.",
      "박수는 아직!"
    ],
    "winLine": "쇼 타임, 최고다!"
  },
  "a72": {
    "name": "사진 관광객",
    "heckles": [
      "기념품이 더 낫네.",
      "사진은 찍어 줄게.",
      "이거 유명한 거지?",
      "여행 첫날부터 졸려."
    ],
    "winLine": "여행 중 제일 좋다!"
  },
  "h9": {
    "name": "브로드웨이 스타",
    "heckles": [
      "스포트라이트는 내 거.",
      "조연은 비켜 있어.",
      "박수는 내가 먼저.",
      "무대는 하나뿐이야."
    ],
    "winLine": "브라보, 앙코르다!"
  },
  "a25": {
    "name": "뮤지컬 팬",
    "heckles": [
      "하이노트가 없네.",
      "노래 한 곡 낫겠다.",
      "뮤지컬이 더 짜릿.",
      "합창이 그립다."
    ],
    "winLine": "브라보! 기립이다!"
  },
  "a26": {
    "name": "뉴욕 관광객",
    "heckles": [
      "브로슈어엔 없던데?",
      "표값 아깝지 않나.",
      "관광객도 눈은 높아.",
      "사진부터 찍을까."
    ],
    "winLine": "여행 선물 받았다!"
  },
  "a27": {
    "name": "깐깐 비평가",
    "heckles": [
      "막간에 이미 썼다.",
      "평이 박하겠는데.",
      "리뷰는 냉정하다.",
      "전개가 늘어지네."
    ],
    "winLine": "리뷰를 고쳐 쓴다!"
  },
  "a76": {
    "name": "티켓 수집가",
    "heckles": [
      "수집품 중 별로네.",
      "티켓 값 못 하네.",
      "콜렉션엔 없는 거.",
      "아직 모으긴 일러."
    ],
    "winLine": "소장하고 싶다!"
  },
  "a77": {
    "name": "발레 관객",
    "heckles": [
      "발레만큼 우아해?",
      "발끝이 아쉽네.",
      "동작이 투박하다.",
      "음악이 더 곱다."
    ],
    "winLine": "우아하다, 감동이다!"
  },
  "a78": {
    "name": "오케스트라 팬",
    "heckles": [
      "박자가 어긋나요.",
      "지휘자가 필요해.",
      "현악이 더 낫지.",
      "화음이 없어요."
    ],
    "winLine": "교향곡 같은 마술!"
  },
  "a79": {
    "name": "의상 디자이너",
    "heckles": [
      "의상이 평범하군.",
      "소품이 아쉽다.",
      "실밥이 튀겠다.",
      "반짝임이 부족해."
    ],
    "winLine": "의상도 반하겠다!"
  },
  "h10": {
    "name": "달 기지 대장",
    "heckles": [
      "우주에선 어림없다.",
      "중력 없이 되겠어?",
      "달 먼지만 날려.",
      "기지 규정 위반!"
    ],
    "winLine": "기지 최고 대원이다!"
  },
  "a28": {
    "name": "우주비행사",
    "heckles": [
      "산소 아깝다.",
      "헬멧 속 하품이야.",
      "우주선 안이 낫다.",
      "이 정도로 놀라?"
    ],
    "winLine": "교신 불가, 감탄!"
  },
  "a29": {
    "name": "무전 담당",
    "heckles": [
      "관제실 응답 없음.",
      "신호 지연 중이다.",
      "교신 상태 불량.",
      "수신 감도 낮음."
    ],
    "winLine": "관제센터에 보고한다!"
  },
  "a30": {
    "name": "탐사차 기사",
    "heckles": [
      "이 길에선 못 해.",
      "바퀴 자국만 남아.",
      "운전이 더 짜릿.",
      "기름값이 더 든다."
    ],
    "winLine": "월면차에 태우고 싶다!"
  },
  "a83": {
    "name": "달 과학자",
    "heckles": [
      "실험 결과가 없네.",
      "데이터가 부족해.",
      "재현이 되겠나.",
      "가설이 약해요."
    ],
    "winLine": "논문 쓰고 싶다!"
  },
  "a84": {
    "name": "별빛 수집가",
    "heckles": [
      "별빛이 더 곱지.",
      "별 하나만 못하네.",
      "이 빛은 약해.",
      "수집품엔 안 넣어."
    ],
    "winLine": "별 하나 더 얻었다!"
  },
  "a85": {
    "name": "기지 정비사",
    "heckles": [
      "나사 풀렸을걸.",
      "점검이 필요하군.",
      "고장 날 것 같아.",
      "부품 어딨어?"
    ],
    "winLine": "완벽 정비 상태!"
  },
  "a86": {
    "name": "우주 관광객",
    "heckles": [
      "지구가 더 예뻐.",
      "우주 여행 값은 하나?",
      "사진부터 찍자.",
      "멀미가 먼저 난다."
    ],
    "winLine": "우주 여행 최고다!"
  },
  "h11": {
    "name": "태양의 불꽃왕",
    "heckles": [
      "내 불꽃보다 뜨겁냐?",
      "타오르게 해 봐.",
      "재만 남을 걸.",
      "열기가 부족하다."
    ],
    "winLine": "활활 불타올랐다!"
  },
  "a31": {
    "name": "불꽃 서퍼",
    "heckles": [
      "파도가 더 큰데?",
      "서핑 중 뭘 봐.",
      "불꽃보다 느리네.",
      "빨리 끝내 줘."
    ],
    "winLine": "불꽃보다 짜릿!"
  },
  "a32": {
    "name": "태양 가이드",
    "heckles": [
      "투어는 계속돼.",
      "흑점이 더 신기해.",
      "태양 불꽃가 더 뜨겁다.",
      "가이드가 한 수 위."
    ],
    "winLine": "가이드북에 싣겠다!"
  },
  "a33": {
    "name": "불꽃 사진가",
    "heckles": [
      "셔터가 안 눌려.",
      "찍을 게 없네.",
      "초점이 안 맞아.",
      "불꽃이 더 멋져."
    ],
    "winLine": "찰칵, 인생 사진!"
  },
  "a90": {
    "name": "빛 연구원",
    "heckles": [
      "빛이 약한데.",
      "렌즈가 필요한가.",
      "관측값이 낮네.",
      "빛 스펙트럼 달라."
    ],
    "winLine": "새 연구 주제다!"
  },
  "a91": {
    "name": "태양 여행객",
    "heckles": [
      "여기까지 왔는데.",
      "태양 불꽃 투어 갈까.",
      "뜨겁지가 않네.",
      "기대가 컸나."
    ],
    "winLine": "여행 최고 순간!"
  },
  "a92": {
    "name": "태양 관측자",
    "heckles": [
      "관측 기록에 없네.",
      "오차 범위일걸.",
      "망원경이 더 정확.",
      "변광성이냐."
    ],
    "winLine": "관측 기록 갱신!"
  },
  "a93": {
    "name": "파도 서퍼",
    "heckles": [
      "서핑할 시간인데.",
      "파도 놓쳤잖아.",
      "파고가 낮아졌다.",
      "보드 접을까."
    ],
    "winLine": "파도 탈 맛 난다!"
  },
  "a94": {
    "name": "우주 사진가",
    "heckles": [
      "사진에 안 담겨.",
      "빛이 너무 약해.",
      "셔터 아깝다.",
      "노출이 부족해."
    ],
    "winLine": "찍어도 모자라!"
  },
  "h12": {
    "name": "은하 황제",
    "heckles": [
      "은하에서 통할까.",
      "내 별자리 앞에서.",
      "황제 앞에 무릎!",
      "별 몇 개 줄까."
    ],
    "winLine": "별 하나 하사한다!"
  },
  "a34": {
    "name": "외계인 손님",
    "heckles": [
      "이게 뭐라는 건가.",
      "지구인 신기해?",
      "번역이 안 된다.",
      "박수가 뭐지?"
    ],
    "winLine": "지구인, 놀랍구나!"
  },
  "a35": {
    "name": "UFO 파일럿",
    "heckles": [
      "기체 흔들린다.",
      "기름값이 더 든다.",
      "궤도 이탈할까.",
      "구경 끝났나?"
    ],
    "winLine": "기체가 춤춘다!"
  },
  "a36": {
    "name": "별자리 선생님",
    "heckles": [
      "별이 지기 전에!",
      "별자리엔 없는데.",
      "해설 시작한다.",
      "별 이야기가 낫다."
    ],
    "winLine": "새 별자리 탄생!"
  },
  "a98": {
    "name": "우주 음악가",
    "heckles": [
      "음정이 틀려요.",
      "박자 아쉬워요.",
      "악보가 없네요.",
      "화음이 필요해요."
    ],
    "winLine": "곡이 떠오르네요!"
  },
  "a99": {
    "name": "은하 사진가",
    "heckles": [
      "은하 사진엔 없네.",
      "노출이 부족하군.",
      "구도가 어색하다.",
      "셔터가 놀겠다."
    ],
    "winLine": "앨범에 실을게요!"
  },
  "a100": {
    "name": "은하수 안내원",
    "heckles": [
      "성운 쪽으로 오세요.",
      "길 잃으셨죠?",
      "안내판 읽어요.",
      "성운 속은 어둡죠."
    ],
    "winLine": "성운이 반짝였어요!"
  },
  "a101": {
    "name": "혜성 레이서",
    "heckles": [
      "혜성이 더 빨라요.",
      "꼬리도 안 보이네.",
      "속도가 느린데요.",
      "따라올 수 있어?"
    ],
    "winLine": "혜성처럼 빠르네!"
  },
  "a102": {
    "name": "소원 여행자",
    "heckles": [
      "별자리가 안 맞네.",
      "여행 계획 틀어져.",
      "별빛이 약한걸.",
      "나침반이 헛돈다."
    ],
    "winLine": "별 여행 최고예요!"
  },
  "h13": {
    "name": "가장 의심 많은 나",
    "heckles": [
      "넌 안 될 거야.",
      "늘 하던 실수잖아.",
      "솔직히 불안하지?",
      "거울 앞에서 떨지."
    ],
    "winLine": "내가 졌다, 훌륭해!"
  },
  "a37": {
    "name": "지팡이 없는 나",
    "heckles": [
      "리모컨이 편해.",
      "마술은 접자.",
      "소파가 더 좋아.",
      "뭘 또 하려고."
    ],
    "winLine": "리모컨 내려놓는다!"
  },
  "a38": {
    "name": "연습실 못 간 나",
    "heckles": [
      "연습실 문 닫혔어.",
      "오늘은 쉴까.",
      "내일부터 하자.",
      "어차피 안 될걸."
    ],
    "winLine": "문 열어 볼래!"
  },
  "a39": {
    "name": "첫 카드를 접은 나",
    "heckles": [
      "카드 다시 넣자.",
      "접은 건 접은 거.",
      "남들 눈이 무서워.",
      "내가 뭘 한다고."
    ],
    "winLine": "다시 꺼내 볼게!"
  },
  "a106": {
    "name": "용기 낸 나",
    "heckles": [
      "나도 해냈는걸.",
      "끝까지 가 봐.",
      "떨려도 올라가.",
      "무서워도 한다."
    ],
    "winLine": "그래, 바로 이거야!"
  },
  "a107": {
    "name": "객석의 나",
    "heckles": [
      "일단 지켜볼게.",
      "박수는 아직이야.",
      "실수해도 괜찮아.",
      "끝까지 해 봐."
    ],
    "winLine": "박수 쳐 줄게!"
  },
  "a108": {
    "name": "다른 세계의 나",
    "heckles": [
      "다른 차원도 비슷해.",
      "여기선 어려운데.",
      "차원이 안 맞네.",
      "나는 못 했거든."
    ],
    "winLine": "여기선 성공이네!"
  },
  "a109": {
    "name": "연습을 시작한 나",
    "heckles": [
      "이제 막 시작했어.",
      "연습이 더 필요해.",
      "아직 서툴러 보여.",
      "나도 처음엔 그랬지."
    ],
    "winLine": "계속 연습할게!"
  },
  "a110": {
    "name": "무대에 선 나",
    "heckles": [
      "무대는 쉽지 않아.",
      "조명이 뜨겁지?",
      "떨림은 숨겨.",
      "나도 떨었어."
    ],
    "winLine": "무대가 부럽네!"
  },
  "a111": {
    "name": "박수 보내는 나",
    "heckles": [
      "박수 칠 준비 끝.",
      "응원은 하지만.",
      "보여 주기만 해.",
      "끝까지 믿어."
    ],
    "winLine": "박수 보낸다, 나야!"
  }
};
  D.venues.forEach(v => [...v.audiences, v.headliner].forEach(a => {
    a.heckles = lines[a.id].heckles; a.winLine = lines[a.id].winLine;
  }));
})(GAME_DATA);

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
      "intro": "주말 강의실에 마니아가 모였다!",
      "successLine": "강의실이 박수로 들썩인다!",
      "trophy": "전국 순회 마술사"
    },
    "lecturenote": {
      "intro": "렉쳐노트 문이 활짝 열렸다!",
      "successLine": "렉쳐노트에 박수가 가득하다!",
      "trophy": "렉쳐노트 식구"
    }
  },
  "chars": {
    "a-meetup-busan": {
      "name": "부산의 마술 매니아",
      "flavor": "커스텀 덱을 자랑한다.",
      "heckles": [
        "이 덱 한정판이에요!",
        "내 덱 좀 봐 봐요!",
        "카드 질감이 달라요.",
        "이거 직접 디자인했죠."
      ],
      "winLine": "덱까지 홀렸어요!"
    },
    "a-meetup-daegu": {
      "name": "대구의 마술 매니아",
      "flavor": "한 손 플러리시가 화려하다.",
      "heckles": [
        "셔플은 봤어요.",
        "이제 마술 보여줘요.",
        "한 손 컷은 저도 해요.",
        "플러리시만 있나요?"
      ],
      "winLine": "플러리시보다 마술이네!"
    },
    "a-meetup-changwon": {
      "name": "창원의 마술 매니아",
      "flavor": "루틴 노트를 펼친다.",
      "heckles": [
        "잠깐, 메모할게요.",
        "그 대사 다시 한번요.",
        "각도는 어디서 잡죠?",
        "구성이 궁금하네요."
      ],
      "winLine": "이 루틴 적어 둘게요!"
    },
    "a-meetup-incheon": {
      "name": "인천의 마술 매니아",
      "flavor": "촬영 허락부터 구한다.",
      "heckles": [
        "찍어도 될까요?",
        "녹화 켰어요, 괜찮죠?",
        "한 번 더 찍을게요.",
        "느리게 봐도 돼요?"
      ],
      "winLine": "찍길 잘했어요, 진짜!"
    },
    "a-meetup-geoje": {
      "name": "거제의 마술 매니아",
      "flavor": "먼 길을 달려왔다.",
      "encounterLine": "거제 야호! 한번 속여 보시겠어요?",
      "heckles": [
        "거제 야호! 한번 속여 보시겠어요?",
        "어디서 배우셨어요?",
        "초보는 뭐부터 해요?",
        "입문 책 추천해 주세요.",
        "저 멀리서 왔어요."
      ],
      "winLine": "거제 야호! 오늘 최고였어요!"
    },
    "a-meetup-cheonan": {
      "name": "천안의 마술 매니아",
      "flavor": "기차 시간이 빠듯하다.",
      "heckles": [
        "기차 시간 다 됐는데.",
        "딱 하나만 더요!",
        "열차 놓쳐도 볼래요.",
        "마지막으로 한 번만!"
      ],
      "winLine": "기차는 다음 거 타죠!"
    },
    "a-meetup-suwon": {
      "name": "수원의 마술 매니아",
      "flavor": "자원해서 관객이 된다.",
      "heckles": [
        "제가 카드 골라 볼게요.",
        "이 카드 맞죠?",
        "섞는 건 제가 할게요.",
        "진짜 자유 선택이죠?"
      ],
      "winLine": "시험 통과, 인정합니다!"
    },
    "h-meetup-seoul": {
      "name": "서울의 마술 매니아",
      "flavor": "첫 모임을 기억하는 선배.",
      "heckles": [
        "첫 모임 기억나지?",
        "그때보다 손이 빠르네.",
        "비밀은 아직 안 알려줘.",
        "한 번 더 보여줘 봐."
      ],
      "winLine": "정말 많이 늘었네!",
      "preLine": "첫 모임 때가 생각나네.",
      "defeatLine": "많이 늘었네. 자랑스럽다."
    },
    "a-lecturenote-hecate": {
      "name": "헤카테",
      "flavor": "부장 마술사, 꼼꼼 점검.",
      "heckles": [
            "동선은 확인했나요?",
            "손놀림이 궁금하네요.",
            "큐 시트는 챙겼죠?",
            "부장 눈은 못 속입니다."
      ],
      "winLine": "점검 통과입니다, 칼리!",
      "title": "부장",
      "gender": "male"
},
    "a-lecturenote-serona": {
      "name": "세로나",
      "flavor": "히든 직원, 서프라이즈 담당.",
      "heckles": [
            "저 히든 직원이에요.",
            "뭔가 숨겨 뒀답니다.",
            "눈치채셨나요?",
            "반전은 제 몫이죠."
      ],
      "winLine": "히든 직원도 반했어요!",
      "title": "히든 직원",
      "gender": "female"
},
    "a-lecturenote-jung": {
      "name": "정희수",
      "flavor": "직원, 포장은 맡겨 주세요.",
      "heckles": [
            "주문 상자 포장 중!",
            "선반 정리 끝났어요.",
            "택배 왔어요, 칼리!",
            "테이프 어디 갔지?"
      ],
      "winLine": "박수 소리가 택배급!",
      "title": "직원"
},
    "h-lecturenote-kim": {
      "name": "김정명",
      "flavor": "렉쳐노트를 세운 베테랑.",
      "heckles": [
        "멀리 다녀왔구나.",
        "그 한 수, 기대하마.",
        "무대는 여전하지?",
        "손은 안 녹슬었나?"
      ],
      "winLine": "잘 돌아왔다, 칼리!",
      "preLine": "우주까지 다녀왔다며? 보자.",
      "defeatLine": "잘했다. 정말 잘 돌아왔다.",
      "act1Line": "준비한 한 수, 어디 보자.",
      "act2Line": "이번엔 함께 만들어 보자.",
      "act3Line": "마지막 인사, 잘 받으마.",
      "endingLines": [
        "우주 끝까지 다녀왔다.",
        "돌아오니 불이 켜져 있었다.",
        "렉쳐노트는 늘 그 자리였다.",
        "멀리 다녀와도, 같이 마술할 곳이 있다."
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

// U12 copy is bundled verbatim; no runtime fetch.
GAME_DATA.onboarding = {
  "intro": [
  {
    "line": "칼리가 거실에서 마술을 시작했어요.",
    "art": "living"
  },
  {
    "line": "작은 카드 한 장에 아빠가 웃었어요.",
    "art": "living"
  },
  {
    "line": "칼리는 더 큰 무대를 꿈꿔요.",
    "art": "cards"
  },
  {
    "line": "마술은 우주 너머 어디까지 갈 수 있을까요?",
    "art": "cosmos"
  },
  {
    "line": "케이스를 열고 함께 떠나 봐요!",
    "art": "cosmos"
  }
],
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
      "title": "모두 배우기",
      "body": "버튼 한 번에 살 수 있는 비법을 다 배워요."
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
GAME_DATA.tree.push({id:"autoLearn",name:"자동 배우기",desc:"켜 두면 공연 중 3초마다 살 수 있는 비법을 모두 배워요.",branch:"luck",prereqs:["coinLuck"],x:5,y:6,max:1,cost:[100],currency:"coins",reveal:"N",icon:"node-assistant.png",emoji:"📖",venueSlug:"school",pending:false,u12:true});

// U12 bulk-learning economy: optional helper upgrades remain a late investment.
GAME_DATA.tree.filter(n=>n.u4b && n.max>1 || n.id==='chainPower').forEach(n=>{n.cost={c:n.cost.c*3,g:14};});

GAME_DATA.tree.find(n=>n.id==='attack').cost=Array.from({length:10},(_,i)=>i<8?Math.ceil(45*1.65**i):i===8?100000:200000);
GAME_DATA.tree.find(n=>n.id==='power').cost.g=2.0;

GAME_DATA.tree.filter(n=>n.productMultiplier).forEach(n=>{n.cost=n.cost.map(c=>Math.ceil(c*0.6));});

// U13 idle progression, stat milestones and fight-time skills.
GAME_DATA.skills = [
  {id:'showtime',name:'쇼타임',clear:'party',duration:20000,cooldown:90000,icon:'skill-showtime.png',emoji:'🎩'},
  {id:'cardrain',name:'카드 비',clear:'cafe',duration:0,cooldown:60000,icon:'skill-cardrain.png',emoji:'🃏'},
  {id:'cheer',name:'관객 호응',clear:'theater',duration:0,cooldown:75000,icon:'skill-cheer.png',emoji:'👏'}
];
(function(D){
  const add=(id,name,max,c,x,y,desc,pre='boxHelper')=>D.tree.push({id,name,max,cost:{c,g:2},x,y,desc,prereqs:[pre],branch:'pet',currency:'coins',reveal:'N',icon:'node-assistant.png',emoji:'🌙',pending:false,u13:true});
  add('nightShow','야간 공연',4,800,-8,3,'자리 비운 보상 상한 +1시간씩 · 기본 8시간');
  add('manager','매니저 계약',3,1500,-7,4,'자리 비운 보상 효율 +10%p씩 · 기본 50%');
  add('autoPractice','자동 연습 속도',4,500,-7,5,'손을 뗐을 때 수동 타격 속도의 +10%씩 · 기본 40%', 'root');
  D.skills.forEach((s,i)=>add(s.id+'Cooldown',s.name+' 준비',3,1200*(i+1),-7,6+i,'재사용 시간 -10%씩', 'root'));
  D.tree.find(n=>n.id==='caseMax').max=45;
  D.tree.find(n=>n.id==='caseMax').cost=Array.from({length:45},(_,i)=>i<10?Math.ceil(240*1.5**i):Math.ceil(1e9*1.15**(i-10)));
  D.tree.find(n=>n.id==='caseMax').desc='케이스 최대 LV +1 · 기본 5, 최대 50';
  D.tree.forEach(n=>{if(['power','attack','mental','spawn','speed','coinLuck'].includes(n.id)||n.starKey)n.statMilestone=true;});
})(GAME_DATA);

// U13 pace tuning keeps active skill and milestone effects intact.
(function(D){const scale={school:1.3,cafe:1.2,meetup:1.5,theater:1.1,festival:1.1,audition:4.15,broadcast:5,vegas:9,broadway:13,moon:19,sun:120,galaxy:500,multiverse:840,lecturenote:120};D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor*=scale[v.slug];});D.venues.find(v=>v.slug==='lecturenote').bossHpFactor*=4.9;})(GAME_DATA);

/* U14 daily selection uses a date hash, independent of combat randomness. */
GAME_DATA.missions = [
 {id:'boxes',name:'케이스 200개 열기',target:200,gems:3},
 {id:'combo',name:'콤보 50 달성',target:50,gems:3},
 {id:'dealer',name:'토끼 딜러 1회',target:1,gems:2},
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
(function(D){const scale={meetup:1.16,audition:3.8,broadcast:3,vegas:5,broadway:8,moon:24,sun:13,galaxy:2.4,multiverse:2.05,lecturenote:2};D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor*=scale[v.slug];});})(GAME_DATA);

/* U15 story content is bundled from the supplied, read-only source. */
GAME_DATA.storyV15 = {
  "tutorial": {
    "bio": "모든 마술을 의심하는 첫 관객. 팔짱이 단단하다.",
    "intro": [
      {
        "speaker": "김도겸",
        "text": "마술이라고? 나는 아무것도 안 믿어."
      },
      {
        "speaker": "칼리",
        "text": "그럼 믿게 만들어 드릴게요."
      },
      {
        "speaker": "김도겸",
        "text": "의심 게이지가 바닥나면 인정하지."
      },
      {
        "speaker": "칼리",
        "text": "좋아요. 연습 상대로 딱이네요."
      }
    ],
    "coaching": [
      {
        "speaker": "김도겸",
        "text": "손 빠른 척만 하는 거 아냐?"
      },
      {
        "speaker": "김도겸",
        "text": "그 정도론 내 의심이 안 줄어."
      },
      {
        "speaker": "김도겸",
        "text": "어, 게이지가 좀 깎이는데?"
      },
      {
        "speaker": "김도겸",
        "text": "야유 한 번 더 간다. 멘탈 괜찮아?"
      }
    ],
    "defeat": [
      {
        "speaker": "김도겸",
        "text": "으윽, 의심이 바닥났다. 믿는다, 믿어."
      },
      {
        "speaker": "칼리",
        "text": "이제 거실로 가 볼까요?"
      },
      {
        "speaker": "김도겸",
        "text": "좋아. 나도 첫 관객으로 박수 칠게."
      }
    ],
    "winLine": "좋아, 인정! 이제 진짜 무대로 가 봐!"
  },
  "helper": {
    "bio": "칼리 곁을 맴도는 장난꾸러기 꼬마 마술 도깨비.",
    "coaching": [
      {
        "speaker": "밍기리",
        "text": "칼리, 오른쪽 케이스를 꾹 누르고 있어!"
      },
      {
        "speaker": "밍기리",
        "text": "열리면 아이템이 튀어나와. 줍기만 해!"
      },
      {
        "speaker": "밍기리",
        "text": "아이템이 능력치를 올려. 의심이 줄지?"
      },
      {
        "speaker": "밍기리",
        "text": "의심 게이지를 깎아야 해. 멘탈 먼저 닳지 마!"
      },
      {
        "speaker": "밍기리",
        "text": "아래 스킬 바도 눌러 봐. 숨은 한 수야!"
      }
    ]
  },
  "venues": {
    "family": {
      "opening": [
        {
          "speaker": "아빠",
          "text": "채널권은 내 손에 있다. 마술은 짧게."
        },
        {
          "speaker": "동생",
          "text": "형, 팝콘 먹으면서 봐도 돼?"
        },
        {
          "speaker": "엄마",
          "text": "설거지 끝내고 왔다. 시작해 봐, 칼리."
        },
        {
          "speaker": "칼리",
          "text": "중학생 때 추석 개그쇼를 보고 배운 마술이에요."
        },
        {
          "speaker": "아빠",
          "text": "그때 TV 앞에서 혼자 따라 하던 게 이거냐?"
        },
        {
          "speaker": "칼리",
          "text": "맞아요. 그 마술로 거실이 첫 무대예요."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "까다로운 할머니",
          "text": "칼리야, 손 안 바꾼 거지? 안경 썼다."
        },
        {
          "speaker": "칼리",
          "text": "할머니 앞에선 손이 더 떨려요."
        },
        {
          "speaker": "까다로운 할머니",
          "text": "떨어도 좋아. 대신 똑바로 해 봐라."
        }
      ],
      "afterClear": [
        {
          "speaker": "까다로운 할머니",
          "text": "손 안 바꿨네. 친구들한테도 보여 줘라."
        },
        {
          "speaker": "아빠",
          "text": "리모컨 내려놓은 건 비밀이다."
        }
      ]
    },
    "party": {
      "opening": [
        {
          "speaker": "풍선 친구",
          "text": "할머니 소문 들었어! 우리 파티에서 해 줘!"
        },
        {
          "speaker": "음악 친구",
          "text": "노래 끌게. 대신 분위기 살려야 해."
        },
        {
          "speaker": "칼리",
          "text": "거실이랑은 또 다르네. 긴장된다."
        },
        {
          "speaker": "케이크 친구",
          "text": "초 꺼지기 전에 보여 줘!"
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "파티 주최자",
          "text": "오늘 주인공은 나였는데 말이야."
        },
        {
          "speaker": "칼리",
          "text": "그럼 주인공도 놀라게 해 드릴게요."
        },
        {
          "speaker": "파티 주최자",
          "text": "좋아. 놀라면 내가 박수 쳐 줄게."
        }
      ],
      "afterClear": [
        {
          "speaker": "파티 주최자",
          "text": "졌다. 학교 장기자랑에 나가 봐."
        },
        {
          "speaker": "동생",
          "text": "형, 거기도 따라가도 돼?"
        },
        {
          "speaker": "밍기리",
          "text": "난 가방에 숨어서 다 봤어. 잘했어!"
        }
      ]
    },
    "school": {
      "opening": [
        {
          "speaker": "앞자리 짝꿍",
          "text": "장기자랑 신청서 냈어. 네 이름으로!"
        },
        {
          "speaker": "칼리",
          "text": "뭐? 내 허락은 안 받았잖아."
        },
        {
          "speaker": "응원봉 반장",
          "text": "네 마술 보고 우리 반이 다 좋아했잖아!"
        },
        {
          "speaker": "칼리",
          "text": "서점에서 산 마술 책, 닳도록 연습했거든."
        },
        {
          "speaker": "체육부 선배",
          "text": "쉬는 시간 끝나기 전에 끝내라."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "심사 담임",
          "text": "시간 되면 바로 끊을게. 알았지?"
        },
        {
          "speaker": "칼리",
          "text": "종 치기 전에 놀라게 해 드릴게요."
        },
        {
          "speaker": "심사 담임",
          "text": "칭찬은 안 해. 점수는 줄지도."
        }
      ],
      "afterClear": [
        {
          "speaker": "심사 담임",
          "text": "종 치기 전에 끝냈네. 합격이다."
        },
        {
          "speaker": "깐깐한 선배의 채점",
          "text": "카페에서 공연할 사람 찾는대."
        }
      ]
    },
    "cafe": {
      "opening": [
        {
          "speaker": "바리스타 친구",
          "text": "저녁 공연 자리 비워 놨어. 커피는 서비스."
        },
        {
          "speaker": "노트북 손님",
          "text": "조용히 볼게요. 배터리도 아끼고요."
        },
        {
          "speaker": "밍기리",
          "text": "커피 향 좋다. 난 우유 거품이 좋아!"
        },
        {
          "speaker": "칼리",
          "text": "카페 무대는 가까워서 더 떨려."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "라떼 바리스타",
          "text": "샷은 내가 느리게 내릴게."
        },
        {
          "speaker": "칼리",
          "text": "느릴수록 제 손은 바빠지는데요."
        },
        {
          "speaker": "라떼 바리스타",
          "text": "하하. 한 잔 식기 전에 끝내 봐."
        }
      ],
      "afterClear": [
        {
          "speaker": "라떼 바리스타",
          "text": "벽에 붙은 전단 봤어? 마술 모임이래."
        },
        {
          "speaker": "창가 손님",
          "text": "전국에서 모인다던데, 가 봐요!"
        }
      ]
    },
    "meetup": {
      "opening": [
        {
          "speaker": "부산의 마술 매니아",
          "text": "왔네! 부산에서 첫차 타고 왔어."
        },
        {
          "speaker": "대구의 마술 매니아",
          "text": "대구도 왔다. 카드 얘기만 세 시간 해도 돼."
        },
        {
          "speaker": "창원의 마술 매니아",
          "text": "창원 '빨간 모자'예요. 오늘도 모자 쓰고 왔죠!"
        },
        {
          "speaker": "인천의 마술 매니아",
          "text": "인천 '비타민'이에요. 기운 충전하러 왔어요!"
        },
        {
          "speaker": "수원의 마술 매니아",
          "text": "수원 '까만 팔찌'예요. 손목은 잘 보세요!"
        },
        {
          "speaker": "구미에서 온 착한 천사",
          "text": "구미에서 올라온 '착한 천사'예요. 반가워요!"
        },
        {
          "speaker": "칼리",
          "text": "별명이 다 재밌어요. 마술 얘기만 해서 신기해요."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "서울의 마술 매니아",
          "text": "나는 서울 '마술 3일'. 별명이 좀 특이하지?"
        },
        {
          "speaker": "칼리",
          "text": "별명 부자 모임이네요. 여기 오니 마술이 더 좋아졌어요."
        },
        {
          "speaker": "서울의 마술 매니아",
          "text": "그럼 마지막 한 수는 즐겁게 보여 줘."
        }
      ],
      "afterClear": [
        {
          "speaker": "서울의 마술 매니아",
          "text": "소극장에서 공연 한번 해 볼래?"
        },
        {
          "speaker": "인천의 마술 매니아",
          "text": "무대 올라가면 '비타민'들이 맨 앞줄이야."
        },
        {
          "speaker": "창원의 마술 매니아",
          "text": "'빨간 모자' 흔들면서 응원할게요!"
        }
      ]
    },
    "theater": {
      "opening": [
        {
          "speaker": "열성팬",
          "text": "저 앞줄 맡았어요. 박수 준비 완료!"
        },
        {
          "speaker": "일반 관객",
          "text": "막간에 프로그램 좀 볼게요."
        },
        {
          "speaker": "대본 작가",
          "text": "좋은 장면이면 대본에 넣을게요."
        },
        {
          "speaker": "헤클러",
          "text": "그 카드 내가 섞어 볼까? 한번 찾아 봐요."
        },
        {
          "speaker": "칼리",
          "text": "지하철에서 낯선 사람이 그랬어요. 정말 놀랐죠."
        },
        {
          "speaker": "칼리",
          "text": "그날 배웠어요. 방해에도 웃으며 이어 가기!"
        },
        {
          "speaker": "칼리",
          "text": "조명이 진짜 무대 같네요."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "까칠한 평론가",
          "text": "그 케이스, 내가 잠시 잠근다."
        },
        {
          "speaker": "칼리",
          "text": "잠그시면 제가 다른 열쇠를 찾겠죠."
        },
        {
          "speaker": "까칠한 평론가",
          "text": "흠. 말은 잘하네. 손도 그런가 볼까."
        }
      ],
      "afterClear": [
        {
          "speaker": "까칠한 평론가",
          "text": "별 네 개 반. 이 이상은 나도 못 준다."
        },
        {
          "speaker": "헤클러",
          "text": "아까는 장난이었어요. 진짜 멋졌어요!"
        },
        {
          "speaker": "커튼콜 팬",
          "text": "대학 축제에서 불러서 갈 수밖에 없죠!"
        },
        {
          "speaker": "밍기리",
          "text": "평론가도 웃었어! 내가 봤다니까!"
        }
      ]
    },
    "festival": {
      "opening": [
        {
          "speaker": "깃발 응원단",
          "text": "과 깃발 들고 왔어요! 흔들게요!"
        },
        {
          "speaker": "술친구",
          "text": "치킨 먹으면서 본다. 박수는 손등으로."
        },
        {
          "speaker": "후배",
          "text": "선배, 저 맨 앞에서 소리 지를게요!"
        },
        {
          "speaker": "칼리",
          "text": "축제는 시끄러워서 더 신나."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "축제 사회자",
          "text": "동전은 내가 잠깐 빌릴게."
        },
        {
          "speaker": "칼리",
          "text": "사회자님, 갚을 때 이자 붙어요."
        },
        {
          "speaker": "축제 사회자",
          "text": "하하! 그럼 큰 박수로 갚아 줄게."
        }
      ],
      "afterClear": [
        {
          "speaker": "축제 사회자",
          "text": "방금 영상, 누가 TV 오디션에 보냈대."
        },
        {
          "speaker": "야광봉 팬",
          "text": "우리 선배가 TV에 나간다!"
        }
      ]
    },
    "audition": {
      "opening": [
        {
          "speaker": "점수판 도우미",
          "text": "점수판 켰어요. 긴장하지 마세요."
        },
        {
          "speaker": "라이벌",
          "text": "네 피날레, 내가 더 크게 할 거야."
        },
        {
          "speaker": "밍기리",
          "text": "카메라 앞이야. 칼리, 웃어, 웃어!"
        },
        {
          "speaker": "카메라 감독",
          "text": "줌인은 아직이에요. 기다려요."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "메인 심사위원",
          "text": "의심은 내가 다시 채운다."
        },
        {
          "speaker": "칼리",
          "text": "의심이 차면 저는 더 열심히 하죠."
        },
        {
          "speaker": "메인 심사위원",
          "text": "그 눈빛 좋아. 마지막 화면 기대할게."
        }
      ],
      "afterClear": [
        {
          "speaker": "메인 심사위원",
          "text": "합격이다. 다음은 생방송이야."
        },
        {
          "speaker": "라이벌",
          "text": "다음엔 내가 먼저 합격할 거야."
        }
      ]
    },
    "broadcast": {
      "opening": [
        {
          "speaker": "생방송 PD",
          "text": "생방송 30초 전입니다. 숨 쉬세요."
        },
        {
          "speaker": "방송 작가",
          "text": "큐시트대로만 하세요. 아마도요."
        },
        {
          "speaker": "칼리",
          "text": "카메라가 이렇게 많은 줄 몰랐어요."
        },
        {
          "speaker": "조명 감독",
          "text": "제일 반짝이는 순간에 불 켤게요."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "국민 MC",
          "text": "카메라 보고, 천천히 갑시다."
        },
        {
          "speaker": "칼리",
          "text": "천천히요. 아빠도 이거 보고 계시겠죠?"
        },
        {
          "speaker": "국민 MC",
          "text": "그럼요. 리모컨도 못 만지실걸요."
        }
      ],
      "afterClear": [
        {
          "speaker": "국민 MC",
          "text": "방송 나가자마자 초대장이 왔어요."
        },
        {
          "speaker": "열성적인 패널",
          "text": "라스베가스에서 온 초대장이에요!"
        }
      ]
    },
    "vegas": {
      "opening": [
        {
          "speaker": "큰손 손님",
          "text": "칩을 걸게. 네 마술에 올인이야."
        },
        {
          "speaker": "화려한 관객",
          "text": "깃털 사이로 잘 보이게 앉았어요."
        },
        {
          "speaker": "경비 아저씨",
          "text": "소매 속은 안 볼게요. 약속해요."
        },
        {
          "speaker": "칼리",
          "text": "화려하다. 아빠한테 사진 보내야지."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "전설의 딜러",
          "text": "눈이 따라오면 이미 진 거야."
        },
        {
          "speaker": "칼리",
          "text": "그럼 저는 눈을 피해서 하겠습니다."
        },
        {
          "speaker": "전설의 딜러",
          "text": "오, 말이 통하네. 카드를 섞어 봐."
        }
      ],
      "afterClear": [
        {
          "speaker": "전설의 딜러",
          "text": "판돈 대신 초대장 하나 주지."
        },
        {
          "speaker": "호텔 손님",
          "text": "브로드웨이가 널 찾고 있어요."
        },
        {
          "speaker": "밍기리",
          "text": "칩은 내가 지킬게. 한 개만 먹고."
        }
      ]
    },
    "broadway": {
      "opening": [
        {
          "speaker": "뮤지컬 팬",
          "text": "하이노트 뒤에 피날레예요. 기억해요."
        },
        {
          "speaker": "뉴욕 관광객",
          "text": "여기까지 온 보람이 있어야 해요."
        },
        {
          "speaker": "깐깐 비평가",
          "text": "이미 한 줄 썼어요. 고칠 수도 있어요."
        },
        {
          "speaker": "칼리",
          "text": "조명이 뜨거워. 근데 기분 좋아."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "브로드웨이 스타",
          "text": "이 템포, 내가 늦춘다."
        },
        {
          "speaker": "칼리",
          "text": "느려지면 박수가 더 길어지겠네요."
        },
        {
          "speaker": "브로드웨이 스타",
          "text": "좋은 대답이야. 무대로 올라와."
        }
      ],
      "afterClear": [
        {
          "speaker": "브로드웨이 스타",
          "text": "이제 지구가 좁다. 달에서 연락 왔어."
        },
        {
          "speaker": "오케스트라 팬",
          "text": "달에서도 박수 소리가 들릴까요?"
        }
      ]
    },
    "moon": {
      "opening": [
        {
          "speaker": "우주비행사",
          "text": "헬멧 안에서 박수 치는 중입니다."
        },
        {
          "speaker": "무전 담당",
          "text": "교신 양호. 피날레 때 무전 열게요."
        },
        {
          "speaker": "밍기리",
          "text": "여기 먼지 폭신해! 나 발자국 남길래!"
        },
        {
          "speaker": "탐사차 기사",
          "text": "바퀴 자국 위가 객석입니다."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "달 기지 대장",
          "text": "그 케이스, 달 먼지로 봉인."
        },
        {
          "speaker": "칼리",
          "text": "먼지 털면 다시 열리겠죠?"
        },
        {
          "speaker": "달 기지 대장",
          "text": "허허. 털 수 있으면 털어 봐."
        }
      ],
      "afterClear": [
        {
          "speaker": "달 기지 대장",
          "text": "달 먼지 털었네. 태양이 보고 싶대."
        },
        {
          "speaker": "우주 관광객",
          "text": "선글라스부터 챙기세요."
        }
      ]
    },
    "sun": {
      "opening": [
        {
          "speaker": "불꽃 서퍼",
          "text": "불꽃 파도가 오기 전에 시작해요!"
        },
        {
          "speaker": "태양 가이드",
          "text": "흑점 투어는 잠시 멈췄어요."
        },
        {
          "speaker": "칼리",
          "text": "뜨겁지만 박수는 더 뜨겁네요."
        },
        {
          "speaker": "불꽃 사진가",
          "text": "피날레 때 셔터 누를게요."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "태양의 불꽃왕",
          "text": "동전은 코로나에 녹인다."
        },
        {
          "speaker": "칼리",
          "text": "녹는 건 동전뿐이면 좋겠네요."
        },
        {
          "speaker": "태양의 불꽃왕",
          "text": "크하하! 배짱은 활활 타는군."
        }
      ],
      "afterClear": [
        {
          "speaker": "태양의 불꽃왕",
          "text": "좋다. 은하에서도 널 기다린다."
        },
        {
          "speaker": "태양 관측자",
          "text": "선글라스 벗고 보니 더 밝네요."
        }
      ]
    },
    "galaxy": {
      "opening": [
        {
          "speaker": "외계인 손님",
          "text": "번역기가 박수를 모르네. 흉내만 낼게."
        },
        {
          "speaker": "UFO 파일럿",
          "text": "기체 기울여서 구경하겠습니다."
        },
        {
          "speaker": "칼리",
          "text": "별이 객석처럼 깔려 있어."
        },
        {
          "speaker": "밍기리",
          "text": "칼리, 칼리라는 이름은 어디서 왔어?"
        },
        {
          "speaker": "칼리",
          "text": "어릴 때 게임 친구가 가문에 불러 지어 줬어요."
        },
        {
          "speaker": "별자리 선생님",
          "text": "별처럼 멋진 선물이네요. 별이 지기 전에 보여 줘요."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "은하 황제",
          "text": "의심은 별빛으로 다시 찬다."
        },
        {
          "speaker": "칼리",
          "text": "의심이 차는 건 이제 익숙해요."
        },
        {
          "speaker": "은하 황제",
          "text": "그럼 마지막 시험이다. 거울을 봐라."
        }
      ],
      "afterClear": [
        {
          "speaker": "은하 황제",
          "text": "문이 열렸다. 거울 너머를 마주해라."
        },
        {
          "speaker": "혜성 레이서",
          "text": "혜성 타고 가요. 길이 좀 빨라요."
        },
        {
          "speaker": "밍기리",
          "text": "무서워도 난 소매 속에 있을게."
        }
      ]
    },
    "multiverse": {
      "opening": [
        {
          "speaker": "다른 세계의 나",
          "text": "나는 한 번도 안 멈추고 계속 한 너야!"
        },
        {
          "speaker": "무대에 선 나",
          "text": "우린 다 마술을 놓지 않은 칼리들이야."
        },
        {
          "speaker": "밍기리",
          "text": "저 거울 속 의심쟁이, 딱 내 취향이네!"
        },
        {
          "speaker": "박수 보내는 나",
          "text": "어느 세계에서든 네게 박수를 보낼게."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "가장 의심 많은 나",
          "text": "난 의심이 많아도 끝까지 해 온 너다."
        },
        {
          "speaker": "칼리",
          "text": "나도 알아. 멈추지 않은 나를 믿어."
        },
        {
          "speaker": "가장 의심 많은 나",
          "text": "좋아. 그럼 한 번 더 보여 줘."
        }
      ],
      "afterClear": [
        {
          "speaker": "가장 의심 많은 나",
          "text": "멈추지 않길 잘했다. 의심은 쉬어도 되겠다."
        },
        {
          "speaker": "용기 낸 나",
          "text": "돌아가자. 불이 켜진 곳으로."
        }
      ]
    },
    "lecturenote": {
      "opening": [
        {
          "speaker": "헤카테",
          "text": "부장 점검입니다. 동선부터 확인해요."
        },
        {
          "speaker": "세로나",
          "text": "저 히든 직원이에요. 숨은 선물 있어요."
        },
        {
          "speaker": "정희수",
          "text": "포장은 제가 맡을게요. 테이프 어디 갔지?"
        },
        {
          "speaker": "칼리",
          "text": "다들 그대로네요. 집에 온 것 같아요."
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "김정명",
          "text": "우주까지 다녀왔다며? 보자."
        },
        {
          "speaker": "칼리",
          "text": "사장님, 멀리 돌아 이제 왔습니다."
        },
        {
          "speaker": "김정명",
          "text": "밤 알바로 처음 왔을 때가 어제 같은데."
        },
        {
          "speaker": "김정명",
          "text": "낮 알바, 직원, 이젠 매니저까지 했지."
        },
        {
          "speaker": "칼리",
          "text": "사장님이 믿고 맡겨 주신 덕분이에요."
        },
        {
          "speaker": "김정명",
          "text": "네가 일을 너무 잘한 탓이야. 좀 얄밉다."
        },
        {
          "speaker": "김정명",
          "text": "그래. 이번엔 함께 만들어 보자."
        }
      ],
      "afterClear": [
        {
          "speaker": "김정명",
          "text": "잘 돌아왔다, 칼리."
        },
        {
          "speaker": "칼리",
          "text": "다녀왔습니다. 여기가 제 무대예요."
        },
        {
          "speaker": "칼리",
          "text": "한국에서 마술 즐기는 사람, 100명에 1명도 안 돼요."
        },
        {
          "speaker": "칼리",
          "text": "공연도 하고 인터넷에서도 알려서 2명으로 늘릴래요."
        },
        {
          "speaker": "칼리",
          "text": "마술 친구, 동생들이랑 좋은 시간도 보내고요."
        },
        {
          "speaker": "칼리",
          "text": "나중엔 서재 앞 큰 테이블에서 초보자들에게요."
        },
        {
          "speaker": "칼리",
          "text": "마술도 보여 주고 열정과 꿈도 전해 줄게요."
        },
        {
          "speaker": "김정명",
          "text": "좋다. 그 자리, 내가 미리 맡아 두마."
        },
        {
          "speaker": "정희수",
          "text": "박수 소리가 택배급이에요!"
        }
      ]
    }
  },
  "bios": {
    "a1": "채널권을 쥔 가장. 마술엔 짧게 반응하는 아빠.",
    "a2": "팝콘이 우선인 장난꾸러기 동생.",
    "a3": "설거지 틈틈이 보러 오는 다정한 엄마.",
    "h1": "안경 너머로 손을 쫓는 까다로운 심사관 할머니.",
    "a4": "풍선부터 터뜨리는 파티의 분위기 메이커.",
    "a5": "파티의 음악 담당. 다음 곡이 늘 고민이다.",
    "a6": "초가 꺼지기 전에 구경하는 케이크 담당.",
    "h2": "주인공 자리를 지키려는 파티 주최자.",
    "a7": "연필로 박자를 두드리는 앞자리 짝꿍.",
    "a8": "응원봉을 피날레에 켜는 반장.",
    "a9": "점수에 진심인 채점표 든 선배.",
    "a46": "쉬는 시간도 잊고 보는 체육부 선배.",
    "h3": "시간에 엄격한 장기자랑 심사 담임.",
    "a10": "배터리보다 의심이 많은 카페 단골.",
    "a11": "포크를 든 채 기다리는 디저트 손님.",
    "a12": "김 서린 창에 하트 그리는 창가 손님.",
    "a50": "칼리를 카페로 부른 바리스타 친구.",
    "h4": "샷을 느리게 내리는 여유로운 카페 바리스타.",
    "a-meetup-busan": "첫차로 달려온 부산의 마술 매니아.",
    "a-meetup-daegu": "카드 이야기를 세 시간 하는 대구 매니아.",
    "a-meetup-changwon": "창원 모임의 '빨간 모자'. 연습 영상을 들고 오는 매니아.",
    "a-meetup-incheon": "인천 모임의 '비타민'. 맨 앞줄에 앉는 활력 담당.",
    "a-meetup-geoje": "바다 이야기와 마술을 섞는 거제 매니아.",
    "a-meetup-cheonan": "모임 간식을 챙겨 오는 천안 매니아.",
    "a-meetup-suwon": "수원 모임의 '까만 팔찌'. 새 기술을 제일 먼저 외운다.",
    "h-meetup-seoul": "서울 모임의 '마술 3일'. 맏형 같은 대표.",
    "a13": "손바닥이 이미 빨간 앞줄 열성팬.",
    "a14": "막간마다 프로그램을 넘기는 꼼꼼한 관객.",
    "a15": "귓속말이 박자보다 빠른 뒷자리 관객.",
    "a54": "좋은 장면을 대본에 옮기는 작가.",
    "a55": "커튼콜만 기다리는 열정 팬.",
    "h5": "말투는 까칠해도 속은 따뜻한 평론가.",
    "a16": "깃발을 피날레에 흔드는 응원단.",
    "a17": "양념 묻은 손으로 박수 치는 치킨 동기.",
    "a18": "칼리를 선배라 부르는 무대 밑 후배.",
    "a59": "앵콜 전에 손부터 흔드는 밴드 관객.",
    "a60": "야광봉으로 무대를 물들이는 팬.",
    "h6": "동전 장난을 좋아하는 능청스러운 사회자.",
    "a19": "점수를 실시간으로 올리는 점수판 보조.",
    "a20": "줌인 타이밍을 아끼는 카메라 감독.",
    "a21": "칼리의 피날레만 노려보는 라이벌.",
    "a64": "카메라보다 무대를 보는 작가석 손님.",
    "a65": "리허설부터 눈을 못 떼는 관객.",
    "a66": "신호에 맞춰 환호하는 현장 방청객.",
    "h7": "의심을 채우는 냉정한 메인 심사위원.",
    "a112": "생방송 시간을 초 단위로 외치는 PD.",
    "a113": "큐시트에 늘 밑줄을 긋는 작가.",
    "a114": "마이크를 든 채 숨죽이는 붐 마이크 기사.",
    "a115": "신호에 맞춰 박수 치는 방청 응원단.",
    "a116": "실시간 반응 숫자를 외치는 담당자.",
    "a117": "가장 반짝이는 순간을 찾는 조명 감독.",
    "h-broadcast": "천천히를 좋아하는 부드러운 국민 MC.",
    "a22": "칩을 쌓다 손을 멈추는 큰손 손님.",
    "a23": "깃털 너머로 무대를 보는 쇼걸 관객.",
    "a24": "팔짱이 단단하지만 마음은 약한 경비.",
    "a70": "칩을 내려놓고 눈이 커지는 호텔 손님.",
    "a71": "쇼 시간만 기다린 열혈 팬.",
    "a72": "사진 찍다 박수 치는 카지노 관광객.",
    "h8": "눈을 읽는 베테랑, 카드판의 전설 딜러.",
    "a25": "하이노트에 피날레를 거는 뮤지컬 팬.",
    "a26": "브로슈어를 접다 멈추는 관광객.",
    "a27": "막간에 평을 미리 쓰는 비평가.",
    "a76": "티켓을 모으다 커튼콜을 외치는 수집가.",
    "a77": "발끝으로 박자를 타는 발레 관객.",
    "a78": "박수도 악보대로 치는 오케스트라 팬.",
    "a79": "무대 의상 솔기까지 보는 의상가.",
    "h9": "템포를 쥐고 노는 브로드웨이의 스타.",
    "a28": "헬멧 안에서 박수를 아끼는 우주비행사.",
    "a29": "피날레에 무전을 여는 달기지 관제사.",
    "a30": "바퀴 자국 위에 서는 월면차 운전병.",
    "a83": "헬멧 너머로 관찰하는 월면 과학자.",
    "a84": "별빛을 모아 병에 담는 수집가.",
    "a85": "무중력에도 공구를 놓치는 정비사.",
    "a86": "사진 찍기에 바쁜 우주 관광객.",
    "h10": "달 먼지로 케이스를 잠그는 달 기지 대장.",
    "a31": "불꽃 파도를 타는 플레어 서퍼.",
    "a32": "흑점 투어를 안내하는 코로나 가이드.",
    "a33": "피날레에 셔터를 누르는 홍염 사진가.",
    "a90": "빛의 색을 분석하는 빛 연구원.",
    "a91": "선글라스를 쓰고 구경하는 여행객.",
    "a92": "태양 표면을 매일 보는 관측자.",
    "a93": "불꽃 파도를 타는 또 다른 서퍼.",
    "a94": "태양 빛을 사진에 담는 우주 사진가.",
    "h11": "동전을 코로나에 녹이는 호탕한 불꽃왕.",
    "a34": "번역기가 박수를 모르는 관광 외계인.",
    "a35": "기체를 기울여 구경하는 UFO 파일럿.",
    "a36": "별이 지기 전에 보자는 해설가.",
    "a98": "박자에 맞춰 건반을 누르는 우주 음악가.",
    "a99": "은하를 한 장에 담는 사진가.",
    "a100": "성운 길을 안내하는 느긋한 안내원.",
    "a101": "혜성을 타고 다니는 빠른 라이더.",
    "a102": "별자리마다 소원을 비는 여행자.",
    "h12": "별빛으로 의심을 채우는 위엄 있는 황제.",
    "a37": "지팡이가 없어도 맨손으로 계속한 칼리.",
    "a38": "연습실에 못 가는 날도 집에서 연습한 칼리.",
    "a39": "첫 카드를 접고 접어 손에 익힌 칼리.",
    "a106": "한 걸음 내디딘 용기 있는 칼리.",
    "a107": "객석에서 박수 치는 칼리.",
    "a108": "다른 차원에서 온 칼리.",
    "a109": "이제 막 연습을 시작한 칼리.",
    "a110": "이미 무대에 선 칼리.",
    "a111": "박수를 보내 주는 따뜻한 칼리.",
    "h13": "의심은 많아도 끝까지 해 온 칼리.",
    "a-lecturenote-hecate": "꼼꼼히 점검하는 부장. 말투가 정중한 남자.",
    "a-lecturenote-serona": "서프라이즈를 숨겨 두는 히든 직원 여자.",
    "a-lecturenote-jung": "포장과 정리를 맡은 부지런한 직원.",
    "h-lecturenote-kim": "렉쳐노트의 푸근한 사장님. 칼리를 밤 알바에서 매니저로 키웠다."
  }
};

GAME_DATA.glove = {id:'auto-glove',name:'칼리 덱 (자동 연습)',icon:'item-kali-deck.png',emoji:'🃏',duration:120000,desc:'손을 떼도 모든 케이스가 열려요\n120초 동안 자동으로 꾹 누르기'};
GAME_DATA.statMeanings = {power:'케이스를 열어 아이템을 얻는 힘',damage:'관객의 의심을 줄이는 힘',mental:'야유를 버티는 힘'};
(function(D){
 D.venues.forEach(v=>v.audiences.concat([v.headliner]).forEach(a=>{a.bio=D.storyV15.bios[a.id]||a.flavor;}));
 D.skills[0].hint='20초 3배';D.skills[0].desc='케이스를 더 빨리 열어요\n20초 동안 실력 3배 · 다시 쓰려면 90초';
 D.skills[1].hint='한번 3배';D.skills[1].desc='모든 케이스를 한 번에 두드려요\n실력 3배로 한 번 · 다시 쓰려면 60초';
 D.skills[2].hint='야유 막기';D.skills[2].desc='야유를 막고 마음을 회복해요\n야유 1회 막기 · 멘탈 10% · 다시 쓰려면 75초';
})(GAME_DATA);

/* Easy result-first copy; formulas remain in Core. */
GAME_DATA.easyNodes = {
  "root": "첫 마술을 시작할 수 있어요\n처음부터 배운 비법",
  "assistant": "조수가 케이스를 함께 열어요\n1.2초마다 실력의 80%",
  "power": "손기술이 좋아져 케이스를 더 빨리 열어요\n실력 1.1배씩",
  "speed": "케이스를 더 자주 두드려요\n1초에 0.12회씩 추가",
  "area": "여러 케이스를 함께 두드려요\n최대 5칸 × 5칸",
  "crit": "딱 맞는 순간에 케이스를 세게 두드려요\n8% 확률로 힘 1.5배",
  "critRate": "세게 두드릴 기회가 늘어요\n기회 2%씩 추가 · 최대 14%",
  "critPower": "세게 두드릴 때 더 크게 놀라게 해요\n힘 0.1배씩 추가 · 최대 1.8배",
  "comboHold": "개봉을 조금 쉬어도 이어져요\n기다리는 시간 0.25초씩 추가",
  "sweepFocus": "한 케이스에 힘을 모아요\n한 칸만 두드리면 힘 5%씩 추가",
  "precision": "관객의 눈을 돌려 숨은 관객도 놀라게 해요\n빗나갈 기회 2%씩 줄기",
  "board": "케이스를 하나 더 놓아요\n자리 1칸 추가",
  "spawn": "빈 자리에 새 케이스를 더 빨리 세팅해요\n준비 시간 1.08로 나누기",
  "golden": "동전이 많은 케이스가 나와요\n첫 30초 · 다음부터 180초",
  "goldPity": "황금 케이스를 더 자주 만나요\n기다리는 시간 20초씩 줄기",
  "goldCoins": "황금 케이스에서 동전을 더 얻어요\n동전 20%씩 추가",
  "prepared": "새 케이스를 조금 열린 채 받아요\n열린 양 5%씩 추가",
  "boxXP": "케이스가 더 빨리 자라요\n케이스 경험치 10%씩 추가",
  "boxShield": "개봉할 때 야유를 막을 힘을 얻어요\n자신감 0.1씩 · 멘탈의 힘 적용",
  "boxHeal": "개봉할 때 마음이 회복돼요\n회복 0.05씩 · 멘탈의 힘 적용",
  "mental": "야유를 더 오래 버텨요\n최대 멘탈 1.18배씩",
  "attack": "마술을 멋지게 보여 의심이 더 빨리 줄어요\n연출 1.05배씩",
  "shieldCap": "야유를 막을 힘을 더 모아요\n최대 멘탈의 3%씩 추가",
  "shieldValue": "실크가 야유를 더 많이 막아요\n자신감 5%씩 추가",
  "healValue": "회복 아이템으로 더 힘을 얻어요\n회복 5%씩 추가",
  "winHeal": "멋진 포즈로 끝내면 마음이 더 회복돼요\n회복 2%씩 추가",
  "levelHeal": "레벨이 오를 때 더 회복돼요\n회복 2%씩 추가",
  "openingShield": "대본을 미리 외워 새 공연을 든든하게 시작해요\n최대 멘탈의 5%씩 자신감",
  "calm": "야유를 들어도 표정이 흔들리지 않아요\n야유 힘 2%씩 줄기",
  "coinLuck": "케이스에서 동전이 더 잘 나와요\n동전 뽑기 표 6장씩 추가",
  "forceRemove": "딜러의 나쁜 그림을 지워요\n쓰는 보석 1개씩 줄기 · 최소 1개",
  "tip": "관객을 이기면 동전을 더 얻어요\n승리 동전 5%씩 추가",
  "dealerCoin": "딜러 카드에서 동전을 더 얻어요\n동전 10%씩 추가",
  "jackpot": "슬롯 당첨 때 동전을 더 얻어요\n당첨 동전 15%씩 추가",
  "gemFind": "좋은 소품에서 보석도 얻어요\n보석 나올 기회 1%씩 추가",
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
  "startFinale": "첫 피날레를 더 빨리 보여줘요\n공연 시작 때 피날레 충전",
  "finalePower": "표정과 몸짓을 살려 피날레가 더 커져요\n연출의 22배 · 힘 8%씩 추가",
  "finaleNeed": "피날레를 더 빨리 준비해요\n필요한 개봉 1개씩 줄기 · 최소 18개",
  "comboGift": "개봉을 이어 동전과 힘을 얻어요\n10 · 25 · 50 · 100개마다 선물",
  "comboValue": "개봉을 이어 동전을 더 얻어요\n이어 열기 선물 동전 20%씩 추가",
  "encore": "가끔 손끝에 더 힘이 생겨요\n300초마다 15초 · 실력 20% 추가",
  "encorePower": "피버 타임에 관객을 더 신나게 해요\n실력 5%씩 추가",
  "encoreSpan": "앵콜의 힘이 더 오래 가요\n지속 시간 3초씩 추가",
  "challenge": "도전하며 관객을 더 잘 놀라게 해요\n도전 3개 · 성공마다 연출 0.5% 추가",
  "starTrick": "케이스와 관객을 더 빨리 이겨요\n실력 1.14배 · 연출 1.3배씩",
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
  "flashpaperChance": "불꽃 종이를 더 자주 얻어요\n기회 1%씩 추가 · 최대 7%",
  "crystal": "수정구가 야유를 막아줘요\n8초마다 멘탈의 3% 자신감",
  "water": "물 한 잔으로 마음이 회복돼요\n9초마다 멘탈의 3% 회복",
  "spotlight": "조명이 케이스 한 줄을 두드려요\n4초마다 실력의 60%",
  "fanPower": "팬과 조수가 더 세게 두드려요\n힘 15%씩 추가",
  "autoLearn": "동전으로 비법을 알아서 배워요\n켜 두면 3초마다 배우기",
  "nightShow": "자리를 비워도 보상을 더 모아요\n보상 시간 1시간씩 추가 · 기본 8시간",
  "manager": "자리를 비운 동안 동전을 더 모아요\n보상 10%씩 추가 · 기본 50%",
  "autoPractice": "손을 떼도 케이스가 빨리 열려요\n손으로 누를 때의 10%씩 추가 · 기본 40%",
  "spongeSpeed": "도우미가 더 빨리 도와줘요\n이동 12%씩 추가",
  "spongePower": "도우미가 더 힘껏 도와줘요\n힘 15%씩 추가",
  "cardthrowSpeed": "도우미가 더 빨리 도와줘요\n기다리는 시간 10%씩 줄기",
  "cardthrowPower": "도우미가 더 힘껏 도와줘요\n힘 15%씩 추가",
  "tipboxSpeed": "도우미가 더 빨리 도와줘요\n기다리는 시간 10%씩 줄기",
  "tipboxPower": "도우미가 더 힘껏 도와줘요\n힘 25%씩 추가",
  "crystalSpeed": "도우미가 더 빨리 도와줘요\n기다리는 시간 10%씩 줄기",
  "crystalPower": "도우미가 더 힘껏 도와줘요\n힘 20%씩 추가",
  "waterSpeed": "도우미가 더 빨리 도와줘요\n기다리는 시간 10%씩 줄기",
  "waterPower": "도우미가 더 힘껏 도와줘요\n힘 20%씩 추가",
  "spotlightSpeed": "도우미가 더 빨리 도와줘요\n기다리는 시간 10%씩 줄기",
  "spotlightPower": "도우미가 더 힘껏 도와줘요\n힘 15%씩 추가",
  "spongeCount": "도우미가 한 명 더 도와줘요\n1명씩 추가 · 최대 3명",
  "cardthrowCount": "도우미가 한 명 더 도와줘요\n1명씩 추가 · 최대 4명",
  "spotlightCount": "도우미가 한 명 더 도와줘요\n1명씩 추가 · 최대 2명",
  "showtimeCooldown": "스킬을 더 빨리 다시 써요\n기다리는 시간 10%씩 줄기",
  "cardrainCooldown": "스킬을 더 빨리 다시 써요\n기다리는 시간 10%씩 줄기",
  "cheerCooldown": "스킬을 더 빨리 다시 써요\n기다리는 시간 10%씩 줄기"
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
GAME_DATA.easyNodes.flashpaperPower="불꽃 종이가 더 세게 두드려요\n힘 20%씩 추가";
(function(D){
 D.tree.forEach(n=>{
  if(n.productMultiplier)n.desc='관객을 더 크게 놀라게 해요\n연출 '+n.productMultiplier+'배';
  else if(n.id.startsWith('hidden-')){const results={hand:'케이스를 더 빨리 열어요',box:'케이스 아이템의 힘이 커져요',heart:'야유를 더 오래 버텨요',luck:'동전을 더 많이 얻어요',pet:'도우미가 더 힘껏 도와줘요',finale:'피날레가 더 크게 놀라게 해요',collection:'관객을 더 크게 놀라게 해요',star:'별빛의 힘이 더 세져요'};n.desc=results[n.id.split('-').slice(1).join('-')]+'\n힘 2%씩 추가';}
  else n.desc=D.easyNodes[n.id];
  if(!n.desc)throw new Error('Missing easy description: '+n.id);
 });
 const copy={damage:'관객의 의심이 줄어요',shield:'야유를 막을 힘을 얻어요',heal:'마음이 회복돼요',coins:'비법을 배울 동전을 얻어요',xpBurst:'레벨이 더 빨리 올라요',finisher:'피날레를 더 빨리 준비해요',boxFill:'케이스가 더 빨리 열려요'};
 D.items.types.forEach(t=>t.ladder.forEach(p=>{const effect=p.effect||t.effect;const values={damage:'기본 힘 8 × 연출 · 좋은 소품은 최대 25배',shield:'기본 자신감 2.7 × 멘탈 · 최대 25배',heal:'기본 회복 1.8 × 멘탈 · 최대 25배',coins:'기본 동전 4개 · 좋은 소품은 최대 25배',xpBurst:'다음 레벨 경험치의 50%',finisher:'피날레 5칸 채우기',boxFill:'모든 케이스를 30% 더 열기'};p.desc=copy[effect]+'\n'+values[effect];}));
 D.missions.forEach(m=>{m.desc='오늘의 목표를 이루면 보석을 받아요\n'+m.name+' · 보석 '+m.gems+'개';});
 D.easyExtras={events:'움직이는 친구를 누르면 선물을 받아요\n8초 안에 누르기 · 힘, 동전, 열쇠 중 하나',set:'무대의 모두를 감탄시키면 힘이 늘어요\n실력 3% 추가 · 컬렉션 모두 모으면 연출 1.1배',milestone:'레벨이 쌓이면 힘이 크게 늘어요\n10 · 25레벨마다 2배 · 케이스는 50도 2배'};
})(GAME_DATA);

GAME_DATA.stageRewards.forEach((r,i)=>{r.desc=[
 '개봉을 잠깐 쉬어도 이어져요\n이어 열기 기다리는 시간 0.5초 추가',
 '케이스를 더 빨리 열어요\n실력 1.2배',
 '도우미가 더 빨리 도와줘요\n도우미 속도 10% 추가',
 '새 케이스도 잘 자란 채 받아요\n시작 레벨 1 추가',
 '옆 케이스도 더 세게 두드려요\n옆 칸에 주는 힘 15% 추가',
 '피날레가 더 크게 놀라게 해요\n피날레의 힘 30% 추가'][i];r.effect=r.desc;});
GAME_DATA.missions.find(m=>m.id==='skills').name='스킬 5번 쓰기';GAME_DATA.missions.find(m=>m.id==='skills').desc='오늘의 목표를 이루면 보석을 받아요\n스킬 5번 쓰기 · 보석 3개';
// U15 pacing compensates for full-board practice without slowing the item itself.
(function(D){const scale={family:2,party:1.3,school:5,cafe:4,meetup:4.4,theater:4,festival:15,audition:24,broadcast:65,vegas:5,moon:1.6,sun:1.1,galaxy:1.25,multiverse:1.08,lecturenote:8};D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor=(v.hpFactor||1)*scale[v.slug];});D.venues.find(v=>v.slug==='lecturenote').bossHpFactor/=8;})(GAME_DATA);

GAME_DATA.statNames={power:'마술 실력',damage:'연출',mental:'멘탈'};

// U17 gem uses and child-friendly descriptions.
GAME_DATA.gemShop=[{id:'glove',name:'칼리 덱 (자동 연습)',desc:'120초 동안 모든 케이스를 두드려요',cost:2},{id:'refill',name:'스킬 바로 충전',desc:'기다리는 스킬을 바로 쓸 수 있어요',cost:2},{id:'potion',name:'멘탈 회복 물약',desc:'마음을 30% 회복해요',cost:3}];
GAME_DATA.tree.filter(n=>['encore','encorePower','encoreSpan'].includes(n.id)).forEach(n=>{n.desc=n.id==='encoreSpan'?'피버 타임이 더 오래 이어져요\n레벨마다 3초 추가':n.id==='encorePower'?'피버 타임에 관객을 더 신나게 해요\n레벨마다 힘 5% 추가':'피버 타임에 마술이 더 강해져요\n피버 실력 20% 추가';});
// U17 pacing: preserve rewards and fever strength; tune audience durability.
(function(D){const scale={party:1.6,school:1.6,cafe:2,meetup:1.8,theater:4,festival:2.5,audition:3.35,broadcast:1.16,moon:1.8,galaxy:1.12,multiverse:1.07};D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor*=scale[v.slug];});})(GAME_DATA);

GAME_DATA.venues.find(v=>v.slug==='lecturenote').bossHpFactor*=1.07;

// U18 optional challenges and persistent cosmetics do not change timeline balance.
GAME_DATA.trueFanRules=[
 {type:'noDamage',value:0,label:'하트 하나도 잃지 않고 이기기'},
 {type:'timeLimit',value:90,label:'90초 안에 이기기'},
 {type:'combo',value:25,label:'25콤보를 만든 뒤 이기기'}
];
GAME_DATA.cosmetics={
 kali:[
  {id:'wave',name:'푸른 파도',cost:8,emoji:'🌊'},
  {id:'flame',name:'불꽃 고리',cost:12,emoji:'🔥'},
  {id:'hanbok',name:'한복 마술사',cost:0,milestone:'meetup',hint:'전국 마술 매니아 무대 완료',emoji:'🎎'},
  {id:'denim',name:'거리 마술사',cost:10,emoji:'👖'},
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
 const future={id:'h-future-kali',name:'미래의 칼리',emoji:'🪞',portraitAsset:'aud-future-kali.png',winLine:'잘했어. 다음 한 장은 네 몫이야.',flavor:'멈추지 않고 빈틈을 채워 온 나.',bio:'빈틈을 채우고 장점을 키운 미래의 나.',heckles:['네 박자를 믿어 봐.','천천히 해도 괜찮아.','다음 한 수를 보여 줘.','멈추지만 않으면 돼.'],pattern:'futureMirror',bossProfile:'future',preLine:'나는 멈추지 않고 빈틈을 채운 너야.',defeatLine:'잘했어. 다음 무대는 내가 되는 거야.'};
 D.venues.push({id:17,slug:'future',balanceRank:13,hpFactor:1,name:'서재 앞 큰 테이블',crowd:1,crowdEmoji:'👏',venueAsset:'venue-17-library-table.png',crowdAsset:'',palette:{bg1:'#342334',bg2:'#72553b',accent:'#ffe4a0'},audiences:[],headliner:future,intro:'테이블에서 누군가 기다리고 있다.',successLine:'미래의 내가 박수를 보낸다.',trophy:'미래의 나'});
 D.ui.patterns.futureMirror='거울 · 내 도구로 나를 넘어서는 공연';
 D.storyV15.venues.future={opening:[{speaker:'김정명',text:'서재 앞 큰 테이블을 봐. 누가 기다리네.'},{speaker:'미래의 칼리',text:'나는 멈추지 않은 너야.'},{speaker:'미래의 칼리',text:'빈틈은 채우고, 잘하는 건 끝까지 키웠지.'}],beforeHeadliner:[{speaker:'미래의 칼리',text:'네가 익힌 도구로, 나를 넘어 봐.'}],afterClear:[{speaker:'미래의 칼리',text:'잘했어. 다음 무대는 내가 되는 거야.'},{speaker:'미래의 칼리',text:'이 카드는 네 몫이야. 다음 사람에게 보여 줘.'}]};
 D.futureEnding=['나이 든 칼리는 큰 테이블에 앉았다.','처음 마술을 보는 사람들이 손을 내밀었다.','친구들이 둘러앉아 함께 웃었다.','마술을 아는 1 %가 2 %가 되는 날까지.','내가 꿈꾸던 미래는, 다음 한 장에서 시작됐다.'];
 D.cosmetics.kali.push({id:'future',name:'미래의 나',cost:0,milestone:'future',hint:'큰 테이블의 공연 완료',emoji:'🪞'});
 const past=D.venues.find(v=>v.slug==='multiverse').audiences.find(a=>a.id==='a108');
 Object.assign(past,{name:'과거의 나',portraitAsset:'aud-past-kali.png',bio:'쉬어 가던 나도 다시 카드를 들었다.',flavor:'멈추지 않은 나를 보며 다시 일어난다.'});
 D.storyV15.venues.multiverse.opening.unshift({speaker:'과거의 나',text:'잠깐 쉬던 나도 여기 있어. 다시 시작했지.'},{speaker:'칼리',text:'그때의 내가 있었기에, 멈추지 않을 수 있었다.'});
 D.storyV15.bios[future.id]=future.bio;D.storyV15.bios[past.id]=past.bio;
 D.routines=[
  {id:'rings',name:'링',nodes:['chain4','chain8','chainPower'],branch:'hand',items:['linking-rings']},
  {id:'rope',name:'로프',nodes:['area','sweepFocus'],branch:'hand',items:['silk-handkerchief']},
  {id:'thumbtie',name:'썸타이',nodes:['power','prepared'],branch:'hand',items:['silk-handkerchief','linking-rings']},
  {id:'cards',name:'카드',nodes:['cardthrow','cardthrowPower','cardrainCooldown'],branch:'collection',items:['playing-card','jumbo-card'],skill:'cardrain'},
  {id:'coins',name:'동전',nodes:['coinLuck','tip'],branch:'luck',items:['coin']},
  {id:'cupsballs',name:'컵앤볼',nodes:['sponge','spongePower'],branch:'pet',items:['sponge-balls','cups-and-balls']},
  {id:'bottles',name:'멀티플레잉 보틀',nodes:['water','waterPower','showtimeCooldown'],branch:'finale',items:['water-glass','cups-and-balls'],skill:'showtime'},
  {id:'silk',name:'실크',nodes:['shieldCap','mental','cheerCooldown','p-slydini-silks'],branch:'heart',items:['silk-handkerchief','linking-rings'],skill:'cheer'}
 ];
})(GAME_DATA);
// U19 pacing: extend the late galaxy rehearsal without stretching the mirror venue.
GAME_DATA.venues.find(v=>v.slug==='galaxy').hpFactor*=1.41;
// U19b pacing: trade repeated-run time for shorter regular doubt bars.
(function(D){const scale={meetup:.30,audition:.60,broadcast:.52,moon:.70,sun:.60,galaxy:.30,multiverse:.44,lecturenote:.40};D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor*=scale[v.slug];});D.venues.find(v=>v.slug==='lecturenote').bossHpFactor*=3.25;})(GAME_DATA);

// U25: checked-in role and per-line mood data from lines-v19b.
GAME_DATA.lineFaces={"roles":{"a1":{"role":"family","name":"아빠","venue":"family"},"a2":{"role":"family","name":"동생","venue":"family"},"a3":{"role":"family","name":"엄마","venue":"family"},"h1":{"role":"family","name":"까다로운 할머니","venue":"family"},"a4":{"role":"supporter","name":"풍선 친구","venue":"party"},"a5":{"role":"supporter","name":"음악 친구","venue":"party"},"a6":{"role":"supporter","name":"케이크 친구","venue":"party"},"h2":{"role":"skeptic","name":"파티 주최자","venue":"party"},"a7":{"role":"supporter","name":"앞자리 짝꿍","venue":"school"},"a8":{"role":"supporter","name":"응원봉 반장","venue":"school"},"a9":{"role":"critic","name":"깐깐한 선배의 채점","venue":"school"},"a46":{"role":"skeptic","name":"체육부 선배","venue":"school"},"h3":{"role":"critic","name":"심사 담임","venue":"school"},"a10":{"role":"skeptic","name":"노트북 손님","venue":"cafe"},"a11":{"role":"skeptic","name":"디저트 손님","venue":"cafe"},"a12":{"role":"critic","name":"창가 손님","venue":"cafe"},"a50":{"role":"supporter","name":"바리스타 친구","venue":"cafe"},"h4":{"role":"skeptic","name":"라떼 바리스타","venue":"cafe"},"a-meetup-busan":{"role":"supporter","name":"부산의 마술 매니아","venue":"meetup"},"a-meetup-daegu":{"role":"critic","name":"대구의 마술 매니아","venue":"meetup"},"a-meetup-changwon":{"role":"critic","name":"창원의 마술 매니아","venue":"meetup"},"a-meetup-incheon":{"role":"supporter","name":"인천의 마술 매니아","venue":"meetup"},"a-meetup-geoje":{"role":"supporter","name":"거제의 마술 매니아","venue":"meetup"},"a-meetup-cheonan":{"role":"supporter","name":"천안의 마술 매니아","venue":"meetup"},"a-meetup-suwon":{"role":"critic","name":"수원의 마술 매니아","venue":"meetup"},"h-meetup-seoul":{"role":"supporter","name":"서울의 마술 매니아","venue":"meetup"},"a13":{"role":"supporter","name":"열성팬","venue":"theater"},"a14":{"role":"critic","name":"일반 관객","venue":"theater"},"a15":{"role":"heckler","name":"헤클러","venue":"theater"},"a54":{"role":"critic","name":"대본 작가","venue":"theater"},"a55":{"role":"supporter","name":"커튼콜 팬","venue":"theater"},"h5":{"role":"critic","name":"까칠한 평론가","venue":"theater"},"a16":{"role":"supporter","name":"깃발 응원단","venue":"festival"},"a17":{"role":"family","name":"술친구","venue":"festival"},"a18":{"role":"supporter","name":"후배","venue":"festival"},"a59":{"role":"skeptic","name":"밴드 관객","venue":"festival"},"a60":{"role":"supporter","name":"야광봉 팬","venue":"festival"},"h6":{"role":"skeptic","name":"축제 사회자","venue":"festival"},"a19":{"role":"helper","name":"점수판 도우미","venue":"audition"},"a20":{"role":"helper","name":"카메라 감독","venue":"audition"},"a21":{"role":"skeptic","name":"라이벌","venue":"audition"},"a64":{"role":"critic","name":"초대 작가","venue":"audition"},"a65":{"role":"critic","name":"리허설 관객","venue":"audition"},"a66":{"role":"supporter","name":"방청객","venue":"audition"},"h7":{"role":"critic","name":"메인 심사위원","venue":"audition"},"a112":{"role":"helper","name":"생방송 PD","venue":"broadcast"},"a113":{"role":"helper","name":"방송 작가","venue":"broadcast"},"a114":{"role":"helper","name":"음향 감독","venue":"broadcast"},"a115":{"role":"supporter","name":"방청 응원단","venue":"broadcast"},"a116":{"role":"supporter","name":"열성적인 패널","venue":"broadcast"},"a117":{"role":"helper","name":"조명 감독","venue":"broadcast"},"h-broadcast":{"role":"critic","name":"국민 MC","venue":"broadcast"},"a22":{"role":"skeptic","name":"큰손 손님","venue":"vegas"},"a23":{"role":"skeptic","name":"화려한 관객","venue":"vegas"},"a24":{"role":"critic","name":"경비 아저씨","venue":"vegas"},"a70":{"role":"skeptic","name":"호텔 손님","venue":"vegas"},"a71":{"role":"supporter","name":"쇼 팬","venue":"vegas"},"a72":{"role":"skeptic","name":"사진 관광객","venue":"vegas"},"h8":{"role":"critic","name":"전설의 딜러","venue":"vegas"},"a25":{"role":"supporter","name":"뮤지컬 팬","venue":"broadway"},"a26":{"role":"skeptic","name":"뉴욕 관광객","venue":"broadway"},"a27":{"role":"critic","name":"깐깐 비평가","venue":"broadway"},"a76":{"role":"critic","name":"티켓 수집가","venue":"broadway"},"a77":{"role":"critic","name":"발레 관객","venue":"broadway"},"a78":{"role":"supporter","name":"오케스트라 팬","venue":"broadway"},"a79":{"role":"critic","name":"의상 디자이너","venue":"broadway"},"h9":{"role":"skeptic","name":"브로드웨이 스타","venue":"broadway"},"a28":{"role":"skeptic","name":"우주비행사","venue":"moon"},"a29":{"role":"helper","name":"무전 담당","venue":"moon"},"a30":{"role":"helper","name":"탐사차 기사","venue":"moon"},"a83":{"role":"critic","name":"달 과학자","venue":"moon"},"a84":{"role":"critic","name":"별빛 수집가","venue":"moon"},"a85":{"role":"helper","name":"기지 정비사","venue":"moon"},"a86":{"role":"skeptic","name":"우주 관광객","venue":"moon"},"h10":{"role":"critic","name":"달 기지 대장","venue":"moon"},"a31":{"role":"skeptic","name":"불꽃 서퍼","venue":"sun"},"a32":{"role":"helper","name":"태양 가이드","venue":"sun"},"a33":{"role":"supporter","name":"불꽃 사진가","venue":"sun"},"a90":{"role":"critic","name":"빛 연구원","venue":"sun"},"a91":{"role":"skeptic","name":"태양 여행객","venue":"sun"},"a92":{"role":"critic","name":"태양 관측자","venue":"sun"},"a93":{"role":"skeptic","name":"파도 서퍼","venue":"sun"},"a94":{"role":"skeptic","name":"우주 사진가","venue":"sun"},"h11":{"role":"skeptic","name":"태양의 불꽃왕","venue":"sun"},"a34":{"role":"skeptic","name":"외계인 손님","venue":"galaxy"},"a35":{"role":"skeptic","name":"UFO 파일럿","venue":"galaxy"},"a36":{"role":"helper","name":"별자리 선생님","venue":"galaxy"},"a98":{"role":"critic","name":"우주 음악가","venue":"galaxy"},"a99":{"role":"critic","name":"은하 사진가","venue":"galaxy"},"a100":{"role":"helper","name":"은하수 안내원","venue":"galaxy"},"a101":{"role":"skeptic","name":"혜성 레이서","venue":"galaxy"},"a102":{"role":"supporter","name":"소원 여행자","venue":"galaxy"},"h12":{"role":"skeptic","name":"은하 황제","venue":"galaxy"},"a37":{"role":"skeptic","name":"지팡이 없는 나","venue":"multiverse"},"a38":{"role":"skeptic","name":"연습실 못 간 나","venue":"multiverse"},"a39":{"role":"skeptic","name":"첫 카드를 접은 나","venue":"multiverse"},"a106":{"role":"supporter","name":"용기 낸 나","venue":"multiverse"},"a107":{"role":"supporter","name":"객석의 나","venue":"multiverse"},"a108":{"role":"skeptic","name":"과거의 나","venue":"multiverse"},"a109":{"role":"supporter","name":"연습을 시작한 나","venue":"multiverse"},"a110":{"role":"helper","name":"무대에 선 나","venue":"multiverse"},"a111":{"role":"supporter","name":"박수 보내는 나","venue":"multiverse"},"h13":{"role":"skeptic","name":"가장 의심 많은 나","venue":"multiverse"},"a-lecturenote-hecate":{"role":"helper","name":"헤카테","venue":"lecturenote"},"a-lecturenote-serona":{"role":"helper","name":"세로나","venue":"lecturenote"},"a-lecturenote-jung":{"role":"helper","name":"정희수","venue":"lecturenote"},"h-lecturenote-kim":{"role":"family","name":"김정명","venue":"lecturenote"},"h-future-kali":{"role":"supporter","name":"미래의 칼리","venue":"future"}},"lines":{"a4":{"name":"풍선 친구","role":"supporter","heckles":["풍선 터지기 전에 보여 줘!","칼리, 분위기는 내가 띄울게!","긴장 풀고 손만 보여 줘!","풍선보다 크게 터뜨려 봐!"],"winLine":"풍선보다 더 터졌다!"},"a5":{"name":"음악 친구","role":"supporter","heckles":["박자 맞춰 줄게, 가자!","다음 곡은 칼리 테마송!","호흡 길게, 천천히 해!","음악 끌게. 마술이 주인공!"],"winLine":"이건 신곡급이다!"},"a6":{"name":"케이크 친구","role":"supporter","heckles":["초 꺼지기 전에 힘내!","케이크 아껴 놨어, 파이팅!","손끝만 믿어, 칼리!","크림보다 달콤한 한 방!"],"winLine":"케이크보다 달콤해!"},"a7":{"name":"앞자리 짝꿍","role":"supporter","heckles":["신청서 낸 값 해야지!","연필로 박자 맞춰 줄게!","긴장했지? 숨 크게 쉬어!","짝꿍이 제일 앞에서 본다!"],"winLine":"짝꿍, 너 진짜 대박!"},"a8":{"name":"응원봉 반장","role":"supporter","heckles":["우리 반이 다 응원한다!","응원봉은 피날레에 켠다!","반장이 지켜본다, 힘내!","끝까지 가면 다 켜 줄게!"],"winLine":"응원봉 켠다, 최고!"},"a50":{"name":"바리스타 친구","role":"supporter","heckles":["자리 비워 놨어, 편하게 해!","커피 식기 전에 보여 줘!","친구라서 믿는다, 칼리!","떨리면 커피 한 모금 해!"],"winLine":"친구야, 미쳤다!"},"a-meetup-busan":{"name":"부산의 마술 매니아","role":"supporter","heckles":["이 덱 한정판이에요, 써 봐요!","카드 질감 좋죠? 믿고 가요!","첫차 타고 온 보람 있겠죠?","칼리가 쓰면 더 빛나요!"],"winLine":"덱까지 홀렸어요!"},"a-meetup-incheon":{"name":"인천의 마술 매니아","role":"supporter","heckles":["찍고 있어요, 자신 있게!","느린 화면에도 완벽할 거예요!","맨 앞줄 비타민 충전 중!","한 번 더 찍게 해 줘요!"],"winLine":"찍길 잘했어요, 진짜!"},"a-meetup-geoje":{"name":"거제의 마술 매니아","role":"supporter","heckles":["거제 야호! 힘내요, 칼리!","어디서 배웠는지 궁금해요!","이 마술, 입문 책에 실어요!","멀리서 왔어요. 응원합니다!"],"winLine":"거제 야호! 오늘 최고였어요!"},"a-meetup-cheonan":{"name":"천안의 마술 매니아","role":"supporter","heckles":["기차 시간 잊고 보고 있어요!","딱 하나만 더 보여 줘요!","간식 챙겨 왔어요, 힘내요!","열차 놓쳐도 괜찮아요!"],"winLine":"기차는 다음 거 타죠!"},"h-meetup-seoul":{"name":"서울의 마술 매니아","role":"supporter","heckles":["첫 모임 기억나지? 잘하고 있어.","그때보다 손이 빠르네.","긴장 풀고 즐겁게 보여 줘.","비밀은 지켜 줄게. 해 봐!"],"winLine":"정말 많이 늘었네!"},"a13":{"name":"열성팬","role":"supporter","heckles":["박수 준비 완료! 가요!","실수해도 제가 박수 쳐요!","더 크게 해 봐요, 칼리!","앞줄에서 다 보고 있어요!"],"winLine":"역시 최고예요!"},"a55":{"name":"커튼콜 팬","role":"supporter","heckles":["커튼콜은 제가 책임져요!","앙코르 준비 중이에요!","박수는 아껴 둘게요. 크게요!","끝까지 봐요, 칼리!"],"winLine":"앙코르, 앙코르!"},"a16":{"name":"깃발 응원단","role":"supporter","heckles":["깃발 흔들 준비 끝!","더 크게 외쳐 줄게요!","피날레까지 힘내요!","과 깃발이 응원 중이에요!"],"winLine":"깃발 흔든다, 와!"},"a18":{"name":"후배","role":"supporter","heckles":["선배, 힘내요! 믿어요!","맨 앞에서 소리 지를게요!","긴장되지만 응원해요!","선배라면 할 수 있어요!"],"winLine":"선배 짱이에요!"},"a60":{"name":"야광봉 팬","role":"supporter","heckles":["야광봉 켰어요, 칼리!","무대를 물들여 줄게요!","불빛 따라 힘내요!","우리 선배가 최고예요!"],"winLine":"야광봉 번쩍!"},"a19":{"name":"점수판 도우미","role":"helper","heckles":["들켜요, 패널들 표정 보세요.","카메라 2번이 클로즈업 들어가요!","점수 올라가요, 이 흐름 유지!","긴장 풀고 숨 한 번 쉬세요."],"winLine":"점수판 폭발했어요!"},"a20":{"name":"카메라 감독","role":"helper","heckles":["줌인 곧 들어가요, 손 올려요!","각 좋아요, 조금 오른쪽으로!","카메라 보고 천천히 가요.","컷 사인 전에 마무리해요!"],"winLine":"줌인 들어갑니다!"},"a66":{"name":"방청객","role":"supporter","heckles":["박수 신호 기다리고 있어요!","녹화 중이니 자신 있게요!","환호는 제가 책임져요!","카메라 보고 웃어요!"],"winLine":"박수가 절로 나와요!"},"a112":{"name":"생방송 PD","role":"helper","heckles":["30초 전입니다. 숨 쉬세요.","큐 사인 갑니다, 침착하게!","시간 넉넉해요, 서두르지 마요.","카메라 보고 웃으며 가요!"],"winLine":"방송이 살았네요!"},"a113":{"name":"방송 작가","role":"helper","heckles":["큐시트 순서 확인했어요, 가요!","대사 막히면 제가 받을게요.","순서 꼬여도 이어 가면 돼요.","수정본 외웠죠? 믿어요!"],"winLine":"이 장면은 큐시트 최고예요!"},"a114":{"name":"음향 감독","role":"helper","heckles":["마이크 걸리지 않게 조심!","붐대 내려갑니다, 비켜요!","소리 잘 잡혀요, 계속!","작게 말해도 다 들려요."],"winLine":"소리 하나 안 샜다!"},"a115":{"name":"방청 응원단","role":"supporter","heckles":["박수 신호 받았어요, 가요!","표정 풀고 웃어 줘요!","응원 소리 높일게요!","환호할 준비 끝났어요!"],"winLine":"와아, 함성 갑니다!"},"a116":{"name":"열성적인 패널","role":"supporter","heckles":["반응 올라가고 있어요!","좋아요 숫자가 오르는 중!","실검 도전해 봐요, 칼리!","패널도 박수 칠 준비 끝!"],"winLine":"실시간 반응 폭발!"},"a117":{"name":"조명 감독","role":"helper","heckles":["제일 반짝일 때 불 켤게요!","그림자 피해서 서 주세요!","각도 맞췄어요, 서 보세요!","조명은 칼리 편이에요!"],"winLine":"조명이 춤추네요!"},"a71":{"name":"쇼 팬","role":"supporter","heckles":["쇼 시간만 기다렸어요!","팬이니까 박수부터 칠게요!","다음 장면도 기대돼요!","끝까지 응원해요, 칼리!"],"winLine":"쇼 타임, 최고다!"},"a25":{"name":"뮤지컬 팬","role":"supporter","heckles":["하이노트 뒤에 피날레 가요!","합창 같은 박수 드릴게요!","노래 한 곡보다 짜릿해요!","브라보 준비 완료!"],"winLine":"브라보! 기립이다!"},"a78":{"name":"오케스트라 팬","role":"supporter","heckles":["박자 딱 맞아요, 지휘 같아요!","박수도 악보대로 칠게요!","화음처럼 이어 가요!","현악 못지않게 멋져요!"],"winLine":"교향곡 같은 마술!"},"a29":{"name":"무전 담당","role":"helper","heckles":["신호 잡혔습니다, 계속하세요!","교신 양호, 피날레 준비!","지연 있으니 천천히 가요.","본부에 보고할 준비 끝!"],"winLine":"관제센터에 보고한다!"},"a30":{"name":"탐사차 기사","role":"helper","heckles":["바퀴 자국 밟고 서세요!","월면차 출발 준비 됐습니다!","먼지 날리니 눈 조심!","이 길은 안전해요, 가요!"],"winLine":"월면차에 태우고 싶다!"},"a85":{"name":"기지 정비사","role":"helper","heckles":["나사 조여 놨어요, 안심해요!","점검 끝났어요, 가도 돼요!","공구 놓치지 말고 천천히!","케이스 고장 없어요, 계속!"],"winLine":"완벽 정비 상태!"},"a32":{"name":"태양 가이드","role":"helper","heckles":["흑점 투어 잠시 멈췄어요!","코로나 뜨거우니 조심해요.","따라오세요, 길 알려 줄게요!","열기 오를 때 피날레 가요!"],"winLine":"가이드북에 싣겠다!"},"a33":{"name":"불꽃 사진가","role":"supporter","heckles":["셔터 누를 준비 됐어요!","피날레를 기다리고 있어요!","초점 딱 맞았어요, 계속요!","불꽃보다 멋진 컷 부탁해요!"],"winLine":"찰칵, 인생 사진!"},"a36":{"name":"별자리 선생님","role":"helper","heckles":["별이 지기 전에 보여 줘요!","별자리는 천천히 읽어요.","손끝을 별처럼 이어 봐요!","해설은 제가, 마술은 칼리!"],"winLine":"새 별자리 탄생!"},"a100":{"name":"은하수 안내원","role":"helper","heckles":["성운 쪽으로 오세요, 이쪽!","길은 제가 안내할게요.","어두워도 천천히 걸어요.","안내판 따라가면 돼요!"],"winLine":"성운이 반짝였어요!"},"a102":{"name":"소원 여행자","role":"supporter","heckles":["별자리마다 소원 빌었어요!","칼리가 성공하게 해 달라고요!","나침반이 칼리를 가리켜요!","별빛이 응원하고 있어요!"],"winLine":"별 여행 최고예요!"},"a106":{"name":"용기 낸 나","role":"supporter","heckles":["나도 해냈어. 너도 할 수 있어!","떨려도 올라가, 괜찮아!","한 걸음만 더 내디뎌 봐!","무서워도 넌 해낼 거야!"],"winLine":"그래, 바로 이거야!"},"a107":{"name":"객석의 나","role":"supporter","heckles":["객석에서 다 보고 있어!","실수해도 괜찮아, 끝까지 해!","박수 칠 준비 끝났어!","나는 네 편이야!"],"winLine":"박수 쳐 줄게!"},"a109":{"name":"연습을 시작한 나","role":"supporter","heckles":["이제 막 시작했지만 응원해!","연습한 만큼 보일 거야!","계속 연습하면 돼. 파이팅!","너를 보며 배우고 있어!"],"winLine":"계속 연습할게!"},"a110":{"name":"무대에 선 나","role":"helper","heckles":["조명 뜨거워, 숨부터 쉬어!","떨림은 나도 숨겼어, 괜찮아.","무대는 쉽지 않지만 즐겨!","관객 눈을 보면 편해져."],"winLine":"무대가 부럽네!"},"a111":{"name":"박수 보내는 나","role":"supporter","heckles":["박수 칠 준비 끝, 가자!","끝까지 믿고 있어!","네 손끝을 응원해!","어느 세계에서든 네 편이야!"],"winLine":"박수 보낸다, 나야!"},"a-lecturenote-hecate":{"name":"헤카테","role":"helper","heckles":["동선부터 확인해요, 천천히.","큐 시트는 제가 챙겼습니다.","손놀림 좋습니다, 계속하세요.","부장이 뒤에서 지켜봅니다."],"winLine":"점검 통과입니다, 칼리!"},"a-lecturenote-serona":{"name":"세로나","role":"helper","heckles":["숨은 선물 있어요, 힘내요!","반전은 제가 도울게요.","눈치채지 못하게 가요!","서프라이즈 타이밍 알려 줄게요."],"winLine":"히든 직원도 반했어요!"},"a-lecturenote-jung":{"name":"정희수","role":"helper","heckles":["상자 포장 중이에요, 힘내요!","선반 정리 끝났어요, 가요!","응원 택배 왔어요, 칼리!","테이프 붙여 줄게요, 걱정 마요."],"winLine":"박수 소리가 택배급!"}},"moods":{"story:tutorial:intro:0":"doubt","story:tutorial:intro:1":"happy","story:tutorial:intro:2":"happy","story:tutorial:intro:3":"happy","story:tutorial:coaching:0":"doubt","story:tutorial:coaching:1":"doubt","story:tutorial:coaching:2":"surprised","story:tutorial:coaching:3":"doubt","story:tutorial:defeat:0":"surprised","story:tutorial:defeat:1":"happy","story:tutorial:defeat:2":"happy","story:tutorial:winLine":"happy","story:helper:coaching:0":"serious","story:helper:coaching:1":"serious","story:helper:coaching:2":"serious","story:helper:coaching:3":"serious","story:helper:coaching:4":"happy","story:family:opening:0":"smug","story:family:opening:1":"happy","story:family:opening:2":"happy","story:family:opening:3":"happy","story:family:opening:4":"smug","story:family:opening:5":"happy","story:family:beforeHeadliner:0":"doubt","story:family:beforeHeadliner:1":"serious","story:family:beforeHeadliner:2":"serious","story:family:afterClear:0":"happy","story:family:afterClear:1":"happy","story:party:opening:0":"happy","story:party:opening:1":"happy","story:party:opening:2":"serious","story:party:opening:3":"happy","story:party:beforeHeadliner:0":"smug","story:party:beforeHeadliner:1":"happy","story:party:beforeHeadliner:2":"happy","story:party:afterClear:0":"happy","story:party:afterClear:1":"happy","story:party:afterClear:2":"serious","story:school:opening:0":"happy","story:school:opening:1":"surprised","story:school:opening:2":"happy","story:school:opening:3":"happy","story:school:opening:4":"smug","story:school:beforeHeadliner:0":"doubt","story:school:beforeHeadliner:1":"happy","story:school:beforeHeadliner:2":"happy","story:school:afterClear:0":"happy","story:school:afterClear:1":"happy","story:cafe:opening:0":"happy","story:cafe:opening:1":"doubt","story:cafe:opening:2":"happy","story:cafe:opening:3":"serious","story:cafe:beforeHeadliner:0":"smug","story:cafe:beforeHeadliner:1":"happy","story:cafe:beforeHeadliner:2":"happy","story:cafe:afterClear:0":"happy","story:cafe:afterClear:1":"happy","story:meetup:opening:0":"happy","story:meetup:opening:1":"happy","story:meetup:opening:2":"happy","story:meetup:opening:3":"happy","story:meetup:opening:4":"happy","story:meetup:opening:5":"happy","story:meetup:opening:6":"happy","story:meetup:beforeHeadliner:0":"happy","story:meetup:beforeHeadliner:1":"happy","story:meetup:beforeHeadliner:2":"happy","story:meetup:afterClear:0":"happy","story:meetup:afterClear:1":"happy","story:meetup:afterClear:2":"happy","story:theater:opening:0":"happy","story:theater:opening:1":"doubt","story:theater:opening:2":"happy","story:theater:opening:3":"smug","story:theater:opening:4":"happy","story:theater:opening:5":"serious","story:theater:opening:6":"happy","story:theater:beforeHeadliner:0":"smug","story:theater:beforeHeadliner:1":"happy","story:theater:beforeHeadliner:2":"doubt","story:theater:afterClear:0":"happy","story:theater:afterClear:1":"happy","story:theater:afterClear:2":"happy","story:theater:afterClear:3":"happy","story:festival:opening:0":"happy","story:festival:opening:1":"happy","story:festival:opening:2":"happy","story:festival:opening:3":"happy","story:festival:beforeHeadliner:0":"smug","story:festival:beforeHeadliner:1":"happy","story:festival:beforeHeadliner:2":"happy","story:festival:afterClear:0":"happy","story:festival:afterClear:1":"happy","story:audition:opening:0":"happy","story:audition:opening:1":"smug","story:audition:opening:2":"happy","story:audition:opening:3":"serious","story:audition:beforeHeadliner:0":"smug","story:audition:beforeHeadliner:1":"happy","story:audition:beforeHeadliner:2":"happy","story:audition:afterClear:0":"happy","story:audition:afterClear:1":"smug","story:broadcast:opening:0":"serious","story:broadcast:opening:1":"serious","story:broadcast:opening:2":"surprised","story:broadcast:opening:3":"happy","story:broadcast:beforeHeadliner:0":"happy","story:broadcast:beforeHeadliner:1":"happy","story:broadcast:beforeHeadliner:2":"happy","story:broadcast:afterClear:0":"happy","story:broadcast:afterClear:1":"happy","story:vegas:opening:0":"smug","story:vegas:opening:1":"happy","story:vegas:opening:2":"happy","story:vegas:opening:3":"happy","story:vegas:beforeHeadliner:0":"smug","story:vegas:beforeHeadliner:1":"happy","story:vegas:beforeHeadliner:2":"happy","story:vegas:afterClear:0":"happy","story:vegas:afterClear:1":"happy","story:vegas:afterClear:2":"happy","story:broadway:opening:0":"happy","story:broadway:opening:1":"doubt","story:broadway:opening:2":"doubt","story:broadway:opening:3":"happy","story:broadway:beforeHeadliner:0":"smug","story:broadway:beforeHeadliner:1":"happy","story:broadway:beforeHeadliner:2":"happy","story:broadway:afterClear:0":"happy","story:broadway:afterClear:1":"happy","story:moon:opening:0":"happy","story:moon:opening:1":"happy","story:moon:opening:2":"happy","story:moon:opening:3":"happy","story:moon:beforeHeadliner:0":"smug","story:moon:beforeHeadliner:1":"happy","story:moon:beforeHeadliner:2":"smug","story:moon:afterClear:0":"happy","story:moon:afterClear:1":"happy","story:sun:opening:0":"happy","story:sun:opening:1":"happy","story:sun:opening:2":"happy","story:sun:opening:3":"happy","story:sun:beforeHeadliner:0":"smug","story:sun:beforeHeadliner:1":"happy","story:sun:beforeHeadliner:2":"happy","story:sun:afterClear:0":"happy","story:sun:afterClear:1":"happy","story:galaxy:opening:0":"happy","story:galaxy:opening:1":"happy","story:galaxy:opening:2":"happy","story:galaxy:opening:3":"happy","story:galaxy:opening:4":"happy","story:galaxy:opening:5":"happy","story:galaxy:beforeHeadliner:0":"smug","story:galaxy:beforeHeadliner:1":"happy","story:galaxy:beforeHeadliner:2":"serious","story:galaxy:afterClear:0":"serious","story:galaxy:afterClear:1":"happy","story:galaxy:afterClear:2":"serious","story:multiverse:opening:0":"happy","story:multiverse:opening:1":"happy","story:multiverse:opening:2":"happy","story:multiverse:opening:3":"happy","story:multiverse:beforeHeadliner:0":"serious","story:multiverse:beforeHeadliner:1":"happy","story:multiverse:beforeHeadliner:2":"happy","story:multiverse:afterClear:0":"happy","story:multiverse:afterClear:1":"happy","story:lecturenote:opening:0":"serious","story:lecturenote:opening:1":"happy","story:lecturenote:opening:2":"happy","story:lecturenote:opening:3":"happy","story:lecturenote:beforeHeadliner:0":"happy","story:lecturenote:beforeHeadliner:1":"serious","story:lecturenote:beforeHeadliner:2":"happy","story:lecturenote:beforeHeadliner:3":"happy","story:lecturenote:beforeHeadliner:4":"serious","story:lecturenote:beforeHeadliner:5":"happy","story:lecturenote:beforeHeadliner:6":"happy","story:lecturenote:afterClear:0":"happy","story:lecturenote:afterClear:1":"serious","story:lecturenote:afterClear:2":"serious","story:lecturenote:afterClear:3":"serious","story:lecturenote:afterClear:4":"happy","story:lecturenote:afterClear:5":"serious","story:lecturenote:afterClear:6":"happy","story:lecturenote:afterClear:7":"happy","story:lecturenote:afterClear:8":"happy","branch:c1_subway:c1_subway_past:0":"sad","branch:c1_subway:c1_subway_past:1":"serious","branch:c1_subway:c1_subway_past:2":"happy","branch:c1_subway:c1_subway_past:echo":"happy","branch:c1_subway:c1_subway_forward:0":"happy","branch:c1_subway:c1_subway_forward:1":"happy","branch:c1_subway:c1_subway_forward:2":"happy","branch:c1_subway:c1_subway_forward:echo":"happy","branch:c2_meetup:c2_friends_past:0":"happy","branch:c2_meetup:c2_friends_past:1":"happy","branch:c2_meetup:c2_friends_past:2":"serious","branch:c2_meetup:c2_friends_past:echo":"happy","branch:c2_meetup:c2_next_forward:0":"happy","branch:c2_meetup:c2_next_forward:1":"happy","branch:c2_meetup:c2_next_forward:2":"happy","branch:c2_meetup:c2_next_forward:echo":"happy","branch:c3_multi:c3_wave_past:0":"serious","branch:c3_multi:c3_wave_past:1":"happy","branch:c3_multi:c3_wave_past:2":"happy","branch:c3_multi:c3_wave_past:echo":"happy","branch:c3_multi:c3_walk_forward:0":"serious","branch:c3_multi:c3_walk_forward:1":"happy","branch:c3_multi:c3_walk_forward:2":"serious","branch:c3_multi:c3_walk_forward:echo":"happy","branch:c4_cards:c4_oldcards_past:0":"happy","branch:c4_cards:c4_oldcards_past:1":"happy","branch:c4_cards:c4_oldcards_past:2":"happy","branch:c4_cards:c4_oldcards_past:echo":"happy","branch:c4_cards:c4_newcards_forward:0":"happy","branch:c4_cards:c4_newcards_forward:1":"happy","branch:c4_cards:c4_newcards_forward:2":"happy","branch:c4_cards:c4_newcards_forward:echo":"happy","branch:ifRoute:teaser:0":"serious","branch:ifRoute:teaser:1":"happy","branch:ifRoute:intro:0":"surprised","branch:ifRoute:intro:1":"happy","branch:ifRoute:intro:2":"sad","branch:ifRoute:intro:3":"serious","branch:ifRoute:duel:0":"sad","branch:ifRoute:duel:1":"sad","branch:ifRoute:duel:2":"happy","branch:ifRoute:glitch:0":"surprised","branch:ifRoute:glitch:1":"surprised","branch:ifRoute:evolve:0":"serious","branch:ifRoute:evolve:1":"serious","branch:ifRoute:evolve:2":"serious","branch:ifRoute:evolve:3":"happy","branch:ifRoute:phaseLines:0":"serious","branch:ifRoute:phaseLines:1":"happy","branch:ifRoute:phaseLines:2":"serious","branch:ifRoute:win:0":"happy","branch:ifRoute:win:1":"surprised","branch:ifRoute:win:2":"serious","branch:ifRoute:win:3":"happy","branch:ifRoute:ending:0":"happy","branch:ifRoute:ending:1":"serious","branch:ifRoute:ending:2":"serious","branch:ifRoute:ending:3":"happy","branch:ifRoute:ending:4":"happy","branch:ifRoute:ending:5":"happy","fight:a1:heckles:0":"smug","fight:a1:heckles:1":"happy","fight:a1:heckles:2":"happy","fight:a1:heckles:3":"doubt","fight:a1:winLine":"happy","fight:a2:heckles:0":"happy","fight:a2:heckles:1":"doubt","fight:a2:heckles:2":"doubt","fight:a2:heckles:3":"doubt","fight:a2:winLine":"surprised","fight:a3:heckles:0":"happy","fight:a3:heckles:1":"happy","fight:a3:heckles:2":"happy","fight:a3:heckles:3":"doubt","fight:a3:winLine":"happy","fight:h1:heckles:0":"smug","fight:h1:heckles:1":"smug","fight:h1:heckles:2":"happy","fight:h1:heckles:3":"doubt","fight:h1:winLine":"surprised","fight:a4:heckles:0":"happy","fight:a4:heckles:1":"happy","fight:a4:heckles:2":"serious","fight:a4:heckles:3":"happy","fight:a4:winLine":"happy","fight:a5:heckles:0":"happy","fight:a5:heckles:1":"happy","fight:a5:heckles:2":"serious","fight:a5:heckles:3":"happy","fight:a5:winLine":"happy","fight:a6:heckles:0":"happy","fight:a6:heckles:1":"happy","fight:a6:heckles:2":"serious","fight:a6:heckles:3":"happy","fight:a6:winLine":"happy","fight:h2:heckles:0":"smug","fight:h2:heckles:1":"doubt","fight:h2:heckles:2":"doubt","fight:h2:heckles:3":"doubt","fight:h2:winLine":"happy","fight:a7:heckles:0":"happy","fight:a7:heckles:1":"happy","fight:a7:heckles:2":"serious","fight:a7:heckles:3":"happy","fight:a7:winLine":"happy","fight:a8:heckles:0":"happy","fight:a8:heckles:1":"happy","fight:a8:heckles:2":"serious","fight:a8:heckles:3":"happy","fight:a8:winLine":"happy","fight:a9:heckles:0":"doubt","fight:a9:heckles:1":"doubt","fight:a9:heckles:2":"doubt","fight:a9:heckles:3":"doubt","fight:a9:winLine":"happy","fight:a46:heckles:0":"smug","fight:a46:heckles:1":"doubt","fight:a46:heckles:2":"doubt","fight:a46:heckles:3":"doubt","fight:a46:winLine":"happy","fight:h3:heckles:0":"doubt","fight:h3:heckles:1":"smug","fight:h3:heckles:2":"doubt","fight:h3:heckles:3":"doubt","fight:h3:winLine":"happy","fight:a10:heckles:0":"doubt","fight:a10:heckles:1":"doubt","fight:a10:heckles:2":"doubt","fight:a10:heckles:3":"doubt","fight:a10:winLine":"happy","fight:a11:heckles:0":"doubt","fight:a11:heckles:1":"doubt","fight:a11:heckles:2":"doubt","fight:a11:heckles:3":"doubt","fight:a11:winLine":"happy","fight:a12:heckles:0":"doubt","fight:a12:heckles:1":"doubt","fight:a12:heckles:2":"doubt","fight:a12:heckles:3":"doubt","fight:a12:winLine":"happy","fight:a50:heckles:0":"happy","fight:a50:heckles:1":"happy","fight:a50:heckles:2":"happy","fight:a50:heckles:3":"serious","fight:a50:winLine":"happy","fight:h4:heckles:0":"doubt","fight:h4:heckles:1":"smug","fight:h4:heckles:2":"doubt","fight:h4:heckles:3":"doubt","fight:h4:winLine":"happy","fight:a-meetup-busan:heckles:0":"happy","fight:a-meetup-busan:heckles:1":"happy","fight:a-meetup-busan:heckles:2":"happy","fight:a-meetup-busan:heckles:3":"happy","fight:a-meetup-busan:winLine":"happy","fight:a-meetup-daegu:heckles:0":"doubt","fight:a-meetup-daegu:heckles:1":"doubt","fight:a-meetup-daegu:heckles:2":"doubt","fight:a-meetup-daegu:heckles:3":"doubt","fight:a-meetup-daegu:winLine":"happy","fight:a-meetup-changwon:heckles:0":"doubt","fight:a-meetup-changwon:heckles:1":"doubt","fight:a-meetup-changwon:heckles:2":"doubt","fight:a-meetup-changwon:heckles:3":"doubt","fight:a-meetup-changwon:winLine":"happy","fight:a-meetup-incheon:heckles:0":"happy","fight:a-meetup-incheon:heckles:1":"happy","fight:a-meetup-incheon:heckles:2":"happy","fight:a-meetup-incheon:heckles:3":"happy","fight:a-meetup-incheon:winLine":"happy","fight:a-meetup-geoje:heckles:0":"happy","fight:a-meetup-geoje:heckles:1":"happy","fight:a-meetup-geoje:heckles:2":"happy","fight:a-meetup-geoje:heckles:3":"happy","fight:a-meetup-geoje:winLine":"happy","fight:a-meetup-cheonan:heckles:0":"happy","fight:a-meetup-cheonan:heckles:1":"happy","fight:a-meetup-cheonan:heckles:2":"happy","fight:a-meetup-cheonan:heckles:3":"happy","fight:a-meetup-cheonan:winLine":"happy","fight:a-meetup-suwon:heckles:0":"doubt","fight:a-meetup-suwon:heckles:1":"doubt","fight:a-meetup-suwon:heckles:2":"doubt","fight:a-meetup-suwon:heckles:3":"doubt","fight:a-meetup-suwon:winLine":"happy","fight:h-meetup-seoul:heckles:0":"happy","fight:h-meetup-seoul:heckles:1":"happy","fight:h-meetup-seoul:heckles:2":"serious","fight:h-meetup-seoul:heckles:3":"happy","fight:h-meetup-seoul:winLine":"happy","fight:a13:heckles:0":"happy","fight:a13:heckles:1":"happy","fight:a13:heckles:2":"happy","fight:a13:heckles:3":"happy","fight:a13:winLine":"happy","fight:a14:heckles:0":"doubt","fight:a14:heckles:1":"doubt","fight:a14:heckles:2":"doubt","fight:a14:heckles:3":"doubt","fight:a14:winLine":"happy","fight:a15:heckles:0":"smug","fight:a15:heckles:1":"smug","fight:a15:heckles:2":"smug","fight:a15:heckles:3":"smug","fight:a15:winLine":"surprised","fight:a54:heckles:0":"smug","fight:a54:heckles:1":"doubt","fight:a54:heckles:2":"doubt","fight:a54:heckles:3":"doubt","fight:a54:winLine":"happy","fight:a55:heckles:0":"happy","fight:a55:heckles:1":"happy","fight:a55:heckles:2":"happy","fight:a55:heckles:3":"happy","fight:a55:winLine":"happy","fight:h5:heckles:0":"doubt","fight:h5:heckles:1":"doubt","fight:h5:heckles:2":"doubt","fight:h5:heckles:3":"doubt","fight:h5:winLine":"happy","fight:a16:heckles:0":"happy","fight:a16:heckles:1":"happy","fight:a16:heckles:2":"happy","fight:a16:heckles:3":"happy","fight:a16:winLine":"happy","fight:a17:heckles:0":"happy","fight:a17:heckles:1":"happy","fight:a17:heckles:2":"happy","fight:a17:heckles:3":"doubt","fight:a17:winLine":"happy","fight:a18:heckles:0":"happy","fight:a18:heckles:1":"happy","fight:a18:heckles:2":"happy","fight:a18:heckles:3":"happy","fight:a18:winLine":"happy","fight:a59:heckles:0":"smug","fight:a59:heckles:1":"doubt","fight:a59:heckles:2":"doubt","fight:a59:heckles:3":"doubt","fight:a59:winLine":"happy","fight:a60:heckles:0":"happy","fight:a60:heckles:1":"happy","fight:a60:heckles:2":"happy","fight:a60:heckles:3":"happy","fight:a60:winLine":"happy","fight:h6:heckles:0":"doubt","fight:h6:heckles:1":"doubt","fight:h6:heckles:2":"doubt","fight:h6:heckles:3":"doubt","fight:h6:winLine":"happy","fight:a19:heckles:0":"serious","fight:a19:heckles:1":"surprised","fight:a19:heckles:2":"happy","fight:a19:heckles:3":"serious","fight:a19:winLine":"happy","fight:a20:heckles:0":"serious","fight:a20:heckles:1":"serious","fight:a20:heckles:2":"serious","fight:a20:heckles:3":"serious","fight:a20:winLine":"happy","fight:a21:heckles:0":"smug","fight:a21:heckles:1":"smug","fight:a21:heckles:2":"doubt","fight:a21:heckles:3":"doubt","fight:a21:winLine":"happy","fight:a64:heckles:0":"doubt","fight:a64:heckles:1":"doubt","fight:a64:heckles:2":"doubt","fight:a64:heckles:3":"doubt","fight:a64:winLine":"happy","fight:a65:heckles:0":"doubt","fight:a65:heckles:1":"doubt","fight:a65:heckles:2":"doubt","fight:a65:heckles:3":"doubt","fight:a65:winLine":"happy","fight:a66:heckles:0":"happy","fight:a66:heckles:1":"happy","fight:a66:heckles:2":"happy","fight:a66:heckles:3":"happy","fight:a66:winLine":"happy","fight:h7:heckles:0":"smug","fight:h7:heckles:1":"doubt","fight:h7:heckles:2":"doubt","fight:h7:heckles:3":"doubt","fight:h7:winLine":"happy","fight:a112:heckles:0":"serious","fight:a112:heckles:1":"serious","fight:a112:heckles:2":"serious","fight:a112:heckles:3":"happy","fight:a112:winLine":"happy","fight:a113:heckles:0":"serious","fight:a113:heckles:1":"happy","fight:a113:heckles:2":"serious","fight:a113:heckles:3":"happy","fight:a113:winLine":"happy","fight:a114:heckles:0":"serious","fight:a114:heckles:1":"surprised","fight:a114:heckles:2":"happy","fight:a114:heckles:3":"serious","fight:a114:winLine":"happy","fight:a115:heckles:0":"happy","fight:a115:heckles:1":"happy","fight:a115:heckles:2":"happy","fight:a115:heckles:3":"happy","fight:a115:winLine":"happy","fight:a116:heckles:0":"happy","fight:a116:heckles:1":"happy","fight:a116:heckles:2":"happy","fight:a116:heckles:3":"happy","fight:a116:winLine":"happy","fight:a117:heckles:0":"happy","fight:a117:heckles:1":"serious","fight:a117:heckles:2":"serious","fight:a117:heckles:3":"happy","fight:a117:winLine":"happy","fight:h-broadcast:heckles:0":"doubt","fight:h-broadcast:heckles:1":"doubt","fight:h-broadcast:heckles:2":"doubt","fight:h-broadcast:heckles:3":"doubt","fight:h-broadcast:winLine":"happy","fight:a22:heckles:0":"doubt","fight:a22:heckles:1":"doubt","fight:a22:heckles:2":"doubt","fight:a22:heckles:3":"doubt","fight:a22:winLine":"happy","fight:a23:heckles:0":"doubt","fight:a23:heckles:1":"doubt","fight:a23:heckles:2":"doubt","fight:a23:heckles:3":"doubt","fight:a23:winLine":"happy","fight:a24:heckles:0":"doubt","fight:a24:heckles:1":"doubt","fight:a24:heckles:2":"doubt","fight:a24:heckles:3":"doubt","fight:a24:winLine":"happy","fight:a70:heckles:0":"smug","fight:a70:heckles:1":"doubt","fight:a70:heckles:2":"doubt","fight:a70:heckles:3":"doubt","fight:a70:winLine":"happy","fight:a71:heckles:0":"happy","fight:a71:heckles:1":"happy","fight:a71:heckles:2":"happy","fight:a71:heckles:3":"happy","fight:a71:winLine":"happy","fight:a72:heckles:0":"smug","fight:a72:heckles:1":"doubt","fight:a72:heckles:2":"doubt","fight:a72:heckles:3":"doubt","fight:a72:winLine":"happy","fight:h8:heckles:0":"smug","fight:h8:heckles:1":"smug","fight:h8:heckles:2":"smug","fight:h8:heckles:3":"doubt","fight:h8:winLine":"happy","fight:a25:heckles:0":"happy","fight:a25:heckles:1":"happy","fight:a25:heckles:2":"happy","fight:a25:heckles:3":"happy","fight:a25:winLine":"happy","fight:a26:heckles:0":"doubt","fight:a26:heckles:1":"doubt","fight:a26:heckles:2":"doubt","fight:a26:heckles:3":"doubt","fight:a26:winLine":"happy","fight:a27:heckles:0":"doubt","fight:a27:heckles:1":"doubt","fight:a27:heckles:2":"doubt","fight:a27:heckles:3":"doubt","fight:a27:winLine":"happy","fight:a76:heckles:0":"doubt","fight:a76:heckles:1":"doubt","fight:a76:heckles:2":"doubt","fight:a76:heckles:3":"smug","fight:a76:winLine":"happy","fight:a77:heckles:0":"doubt","fight:a77:heckles:1":"doubt","fight:a77:heckles:2":"doubt","fight:a77:heckles:3":"doubt","fight:a77:winLine":"happy","fight:a78:heckles:0":"happy","fight:a78:heckles:1":"happy","fight:a78:heckles:2":"happy","fight:a78:heckles:3":"happy","fight:a78:winLine":"happy","fight:a79:heckles:0":"doubt","fight:a79:heckles:1":"doubt","fight:a79:heckles:2":"doubt","fight:a79:heckles:3":"doubt","fight:a79:winLine":"happy","fight:h9:heckles:0":"smug","fight:h9:heckles:1":"smug","fight:h9:heckles:2":"smug","fight:h9:heckles:3":"smug","fight:h9:winLine":"happy","fight:a28:heckles:0":"doubt","fight:a28:heckles:1":"doubt","fight:a28:heckles:2":"smug","fight:a28:heckles:3":"doubt","fight:a28:winLine":"happy","fight:a29:heckles:0":"happy","fight:a29:heckles:1":"serious","fight:a29:heckles:2":"serious","fight:a29:heckles:3":"happy","fight:a29:winLine":"happy","fight:a30:heckles:0":"serious","fight:a30:heckles:1":"happy","fight:a30:heckles:2":"serious","fight:a30:heckles:3":"happy","fight:a30:winLine":"happy","fight:a83:heckles:0":"doubt","fight:a83:heckles:1":"doubt","fight:a83:heckles:2":"doubt","fight:a83:heckles:3":"doubt","fight:a83:winLine":"happy","fight:a84:heckles:0":"doubt","fight:a84:heckles:1":"doubt","fight:a84:heckles:2":"doubt","fight:a84:heckles:3":"doubt","fight:a84:winLine":"happy","fight:a85:heckles:0":"happy","fight:a85:heckles:1":"serious","fight:a85:heckles:2":"serious","fight:a85:heckles:3":"happy","fight:a85:winLine":"happy","fight:a86:heckles:0":"doubt","fight:a86:heckles:1":"doubt","fight:a86:heckles:2":"doubt","fight:a86:heckles:3":"smug","fight:a86:winLine":"happy","fight:h10:heckles:0":"doubt","fight:h10:heckles:1":"doubt","fight:h10:heckles:2":"doubt","fight:h10:heckles:3":"smug","fight:h10:winLine":"happy","fight:a31:heckles:0":"doubt","fight:a31:heckles:1":"doubt","fight:a31:heckles:2":"doubt","fight:a31:heckles:3":"doubt","fight:a31:winLine":"happy","fight:a32:heckles:0":"happy","fight:a32:heckles:1":"serious","fight:a32:heckles:2":"happy","fight:a32:heckles:3":"serious","fight:a32:winLine":"happy","fight:a33:heckles:0":"happy","fight:a33:heckles:1":"happy","fight:a33:heckles:2":"happy","fight:a33:heckles:3":"happy","fight:a33:winLine":"happy","fight:a90:heckles:0":"doubt","fight:a90:heckles:1":"doubt","fight:a90:heckles:2":"doubt","fight:a90:heckles:3":"doubt","fight:a90:winLine":"happy","fight:a91:heckles:0":"doubt","fight:a91:heckles:1":"doubt","fight:a91:heckles:2":"doubt","fight:a91:heckles:3":"doubt","fight:a91:winLine":"happy","fight:a92:heckles:0":"doubt","fight:a92:heckles:1":"doubt","fight:a92:heckles:2":"doubt","fight:a92:heckles:3":"doubt","fight:a92:winLine":"happy","fight:a93:heckles:0":"doubt","fight:a93:heckles:1":"doubt","fight:a93:heckles:2":"doubt","fight:a93:heckles:3":"doubt","fight:a93:winLine":"happy","fight:a94:heckles:0":"doubt","fight:a94:heckles:1":"doubt","fight:a94:heckles:2":"doubt","fight:a94:heckles:3":"doubt","fight:a94:winLine":"happy","fight:h11:heckles:0":"doubt","fight:h11:heckles:1":"doubt","fight:h11:heckles:2":"doubt","fight:h11:heckles:3":"doubt","fight:h11:winLine":"happy","fight:a34:heckles:0":"doubt","fight:a34:heckles:1":"doubt","fight:a34:heckles:2":"doubt","fight:a34:heckles:3":"doubt","fight:a34:winLine":"happy","fight:a35:heckles:0":"doubt","fight:a35:heckles:1":"doubt","fight:a35:heckles:2":"doubt","fight:a35:heckles:3":"doubt","fight:a35:winLine":"happy","fight:a36:heckles:0":"happy","fight:a36:heckles:1":"serious","fight:a36:heckles:2":"serious","fight:a36:heckles:3":"happy","fight:a36:winLine":"happy","fight:a98:heckles:0":"doubt","fight:a98:heckles:1":"doubt","fight:a98:heckles:2":"doubt","fight:a98:heckles:3":"doubt","fight:a98:winLine":"happy","fight:a99:heckles:0":"doubt","fight:a99:heckles:1":"doubt","fight:a99:heckles:2":"doubt","fight:a99:heckles:3":"doubt","fight:a99:winLine":"happy","fight:a100:heckles:0":"happy","fight:a100:heckles:1":"serious","fight:a100:heckles:2":"serious","fight:a100:heckles:3":"happy","fight:a100:winLine":"happy","fight:a101:heckles:0":"doubt","fight:a101:heckles:1":"doubt","fight:a101:heckles:2":"doubt","fight:a101:heckles:3":"doubt","fight:a101:winLine":"happy","fight:a102:heckles:0":"happy","fight:a102:heckles:1":"happy","fight:a102:heckles:2":"happy","fight:a102:heckles:3":"happy","fight:a102:winLine":"happy","fight:h12:heckles:0":"doubt","fight:h12:heckles:1":"smug","fight:h12:heckles:2":"smug","fight:h12:heckles:3":"doubt","fight:h12:winLine":"happy","fight:a37:heckles:0":"doubt","fight:a37:heckles:1":"doubt","fight:a37:heckles:2":"doubt","fight:a37:heckles:3":"doubt","fight:a37:winLine":"happy","fight:a38:heckles:0":"doubt","fight:a38:heckles:1":"doubt","fight:a38:heckles:2":"doubt","fight:a38:heckles:3":"doubt","fight:a38:winLine":"happy","fight:a39:heckles:0":"doubt","fight:a39:heckles:1":"doubt","fight:a39:heckles:2":"doubt","fight:a39:heckles:3":"doubt","fight:a39:winLine":"happy","fight:a106:heckles:0":"happy","fight:a106:heckles:1":"serious","fight:a106:heckles:2":"serious","fight:a106:heckles:3":"happy","fight:a106:winLine":"happy","fight:a107:heckles:0":"happy","fight:a107:heckles:1":"serious","fight:a107:heckles:2":"happy","fight:a107:heckles:3":"happy","fight:a107:winLine":"happy","fight:a108:heckles:0":"doubt","fight:a108:heckles:1":"doubt","fight:a108:heckles:2":"doubt","fight:a108:heckles:3":"doubt","fight:a108:winLine":"happy","fight:a109:heckles:0":"happy","fight:a109:heckles:1":"serious","fight:a109:heckles:2":"happy","fight:a109:heckles:3":"happy","fight:a109:winLine":"happy","fight:a110:heckles:0":"serious","fight:a110:heckles:1":"serious","fight:a110:heckles:2":"happy","fight:a110:heckles:3":"serious","fight:a110:winLine":"happy","fight:a111:heckles:0":"happy","fight:a111:heckles:1":"happy","fight:a111:heckles:2":"happy","fight:a111:heckles:3":"happy","fight:a111:winLine":"happy","fight:h13:heckles:0":"doubt","fight:h13:heckles:1":"doubt","fight:h13:heckles:2":"doubt","fight:h13:heckles:3":"doubt","fight:h13:winLine":"happy","fight:a-lecturenote-hecate:heckles:0":"serious","fight:a-lecturenote-hecate:heckles:1":"happy","fight:a-lecturenote-hecate:heckles:2":"happy","fight:a-lecturenote-hecate:heckles:3":"serious","fight:a-lecturenote-hecate:winLine":"happy","fight:a-lecturenote-serona:heckles:0":"happy","fight:a-lecturenote-serona:heckles:1":"happy","fight:a-lecturenote-serona:heckles:2":"serious","fight:a-lecturenote-serona:heckles:3":"serious","fight:a-lecturenote-serona:winLine":"happy","fight:a-lecturenote-jung:heckles:0":"happy","fight:a-lecturenote-jung:heckles:1":"happy","fight:a-lecturenote-jung:heckles:2":"happy","fight:a-lecturenote-jung:heckles:3":"serious","fight:a-lecturenote-jung:winLine":"happy","fight:h-lecturenote-kim:heckles:0":"happy","fight:h-lecturenote-kim:heckles:1":"happy","fight:h-lecturenote-kim:heckles:2":"happy","fight:h-lecturenote-kim:heckles:3":"happy","fight:h-lecturenote-kim:winLine":"happy","fight:h-future-kali:heckles:0":"serious","fight:h-future-kali:heckles:1":"serious","fight:h-future-kali:heckles:2":"happy","fight:h-future-kali:heckles:3":"happy","fight:h-future-kali:winLine":"happy"},"faceMap":{"spriteSuffixes":{"doubt":"aud-<id>.png (base)","happy":"aud-<id>-happy.png","serious":"aud-<id>-serious.png (optional, main cast)","surprised":"aud-<id>-surprised.png (optional, main cast)"},"resolution":{"happy":{"prefer":"-happy","fallback":"base doubt sprite + \"😊\" emote"},"doubt":{"prefer":"base (no suffix)","fallback":"base"},"smug":{"prefer":"base (no suffix)","fallback":"base + \"😏\" emote; if role is supporter/helper never use smug"},"serious":{"prefer":"-serious","fallback":"base doubt sprite + calm \"💭\" emote (do not use -happy)"},"surprised":{"prefer":"-surprised","fallback":"-happy sprite + \"❗\" emote, else base + \"❗\""},"sad":{"prefer":"-sad (not planned)","fallback":"base doubt sprite + \"💧\" emote"}},"roleDefaults":{"skeptic":"doubt","critic":"doubt","heckler":"smug","supporter":"happy","helper":"serious","family":"happy"},"rules":["Pick the sprite per line from moods[key], not per character.","A supporter/helper/family character must never show the doubt/smug base sprite without an emote when the mood is happy or serious: use the -happy sprite for happy; use serious fallback (base + \"💭\") only if no -serious sprite.","Skeptic/critic/heckler characters show the base sprite for doubt/smug and -happy only for happy lines (defeat, praise).","Fight lines without a moods entry fall back to roleDefaults."]}};
(function(D){
 D.venues.forEach(v=>v.audiences.concat([v.headliner]).forEach(a=>{
  const role=D.lineFaces.roles[a.id];if(role)a.role=role.role;
  const lines=D.lineFaces.lines[a.id];if(lines){a.heckles=lines.heckles.slice();a.winLine=lines.winLine;if(a.encounterLine&& !a.heckles.includes(a.encounterLine))a.heckles.push(a.encounterLine);}
 }));
 D.glove={id:'auto-glove',name:'칼리 덱 (자동 연습)',icon:'item-kali-deck.png',emoji:'🃏',duration:120000,desc:'모든 케이스를 자동으로 꾹 눌러요\n120초 동안 손을 떼도 연습해요'};
 const shop=D.gemShop.find(x=>x.id==='glove');shop.name='칼리 덱 (자동 연습)';shop.desc='120초 동안 모든 케이스를 자동으로 꾹 눌러요';
 D.tree.push({id:'deckMaster',name:'칼리 덱 마스터',desc:'자동 연습을 켜고 끌 수 있어요\n열쇠 30개 · 켜면 시간 제한 없이 연습해요',max:1,cost:[30],currency:'keys',prereqs:['p-epiphany'],x:18,y:3,reveal:'N14',branch:'collection',icon:'item-kali-deck.png',emoji:'🃏',pending:false});
})(GAME_DATA);

// U25: pace tuning with fair, readable gate fights.
(function(D){const scale={family:1.04,meetup:2.3,galaxy:.95,multiverse:.98};D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor*=scale[v.slug];});D.venues.find(v=>v.slug==='lecturenote').bossHpFactor*=1.15;})(GAME_DATA);

// v4 U38: a finite tail for 무대 배짱 (mental). The ten old levels keep their price; levels 11 to 15 each add x1.18 mental (x2.29 in all) and cost more
// coins than any wallet holds before the final boss (the richest wallet seen before it is under 1e8 in the simulator), so only a player who has
// learned every 비법 owns them. The final boss's last heckle (core.js CONST.finalHeckle) sits between the mental of a build without the tail and with it.
(function(D){
 const n=D.tree.find(n=>n.id==='mental');
 n.max=15;
 n.cost=Array.from({length:15},(_,i)=>i<10?Math.ceil(30*Math.pow(2.2,i)):5e8*Math.pow(2,i-10));
})(GAME_DATA);
