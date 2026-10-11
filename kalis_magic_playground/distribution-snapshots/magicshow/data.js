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
        { id: "a1", name: "리모컨 아빠", emoji: "👨", flavor: "채널권은 아직 내 손이다.", extra: { type: "none", value: 0 } },
        { id: "a2", name: "간식 동생", emoji: "🧒", flavor: "팝콘보다 마술이 궁금하다.", extra: { type: "none", value: 0 } },
        { id: "a3", name: "앞치마 엄마", emoji: "👩", flavor: "설거지는 잠깐 멈춘다.", extra: { type: "none", value: 0 } }
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
        { id: "a5", name: "플레이리스트 친구", emoji: "🎧", flavor: "다음 곡 고르기를 멈춘다.", extra: { type: "noDamage", value: 0 } },
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
        { id: "a9", name: "채점표 선배", emoji: "🧑‍🎓", flavor: "점수는 연필 끝에 있다.", extra: { type: "noDamage", value: 0 } },
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
        { id: "a10", name: "노트북 단골", emoji: "💻", flavor: "배터리가 의심보다 적다.", extra: { type: "timeLimit", value: 50 } },
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
        { id: "a13", name: "앞줄 열성팬", emoji: "👏", flavor: "손바닥이 이미 빨갛다.", extra: { type: "noDamage", value: 0 } },
        { id: "a14", name: "프로그램 관객", emoji: "📖", flavor: "막간에 페이지를 넘긴다.", extra: { type: "timeLimit", value: 60 } },
        { id: "a15", name: "뒷자리 속삭임", emoji: "🤫", flavor: "귓속말이 박자보다 빠르다.", extra: { type: "combo", value: 12 } },
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
        { id: "a17", name: "치킨 동기", emoji: "🍗", flavor: "양념 묻은 손으로 박수!", extra: { type: "combo", value: 12 } },
        { id: "a18", name: "무대 밑 후배", emoji: "🎤", flavor: "우와, 아껴 뒀다.", extra: { type: "noDamage", value: 0 } },
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
        { id: "a19", name: "점수판 보조", emoji: "📋", flavor: "점수가 실시간으로 오른다.", extra: { type: "timeLimit", value: 70 } },
        { id: "a20", name: "카메라 감독", emoji: "🎥", flavor: "줌인은 아직 허락 안 했다.", extra: { type: "noDamage", value: 0 } },
        { id: "a21", name: "대기실 라이벌", emoji: "😏", flavor: "네 피날레만 노려본다.", extra: { type: "finisher", value: 1 } },
        { id: "a64", name: "작가석 손님", emoji: "📝", flavor: "카메라보다 무대를 본다.", extra: { type: "timeLimit", value: 85 } },
        { id: "a65", name: "리허설 관객", emoji: "🎤", flavor: "카메라보다 무대를 본다.", extra: { type: "combo", value: 17 } },
        { id: "a66", name: "현장 방청객", emoji: "📺", flavor: "카메라보다 무대를 본다.", extra: { type: "finisher", value: 1 } }
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
        { id: "a113", name: "큐시트 작가", emoji: "📺", portraitAsset: "aud-tv2.png", flavor: "생방송의 순간을 지켜본다.", extra: { type: "combo", value: 18 } },
        { id: "a114", name: "붐 마이크 기사", emoji: "📺", portraitAsset: "aud-tv3.png", flavor: "생방송의 순간을 지켜본다.", extra: { type: "noDamage", value: 0 } },
        { id: "a115", name: "방청 응원단", emoji: "📺", portraitAsset: "aud-tv4.png", flavor: "생방송의 순간을 지켜본다.", extra: { type: "finisher", value: 1 } },
        { id: "a116", name: "시청자 반응 담당", emoji: "📺", portraitAsset: "aud-tv5.png", flavor: "생방송의 순간을 지켜본다.", extra: { type: "timeLimit", value: 90 } },
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
        { id: "a22", name: "하이롤러", emoji: "💎", flavor: "칩을 쌓다 손을 멈춘다.", extra: { type: "combo", value: 15 } },
        { id: "a23", name: "쇼걸 관객", emoji: "💃", flavor: "깃털 사이로 무대를 본다.", extra: { type: "timeLimit", value: 80 } },
        { id: "a24", name: "카지노 경비", emoji: "💂", flavor: "팔짱이 제복보다 단단하다.", extra: { type: "noDamage", value: 0 } },
        { id: "a70", name: "호텔 관객", emoji: "🏨", flavor: "칩을 내려놓고 눈을 크게 뜬다.", extra: { type: "combo", value: 18 } },
        { id: "a71", name: "쇼 타임 팬", emoji: "🌟", flavor: "칩을 내려놓고 눈을 크게 뜬다.", extra: { type: "finisher", value: 1 } },
        { id: "a72", name: "카지노 관광객", emoji: "🎲", flavor: "칩을 내려놓고 눈을 크게 뜬다.", extra: { type: "noDamage", value: 0 } }
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
        { id: "a25", name: "1열 뮤지컬 팬", emoji: "🎶", flavor: "하이노트에 피날레를 건다.", extra: { type: "finisher", value: 1 } },
        { id: "a26", name: "티켓 관광객", emoji: "🎟️", flavor: "브로슈어를 접다 멈춘다.", extra: { type: "combo", value: 15 } },
        { id: "a27", name: "막간 비평가", emoji: "🧐", flavor: "막간에 평을 이미 적는다.", extra: { type: "timeLimit", value: 80 } },
        { id: "a76", name: "티켓 수집가", emoji: "🎟️", flavor: "커튼콜을 먼저 외친다.", extra: { type: "finisher", value: 1 } },
        { id: "a77", name: "발레 관객", emoji: "🩰", flavor: "커튼콜을 먼저 외친다.", extra: { type: "noDamage", value: 0 } },
        { id: "a78", name: "오케스트라 팬", emoji: "🎼", flavor: "커튼콜을 먼저 외친다.", extra: { type: "timeLimit", value: 95 } },
        { id: "a79", name: "무대 의상가", emoji: "👗", flavor: "커튼콜을 먼저 외친다.", extra: { type: "combo", value: 19 } }
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
        { id: "a29", name: "달기지 관제사", emoji: "🛰️", flavor: "피날레에 무전을 연다.", extra: { type: "finisher", value: 1 } },
        { id: "a30", name: "월면차 운전병", emoji: "🚙", flavor: "바퀴 자국 위에 선다.", extra: { type: "combo", value: 18 } },
        { id: "a83", name: "월면 과학자", emoji: "🔭", flavor: "헬멧 너머로 박수를 보낸다.", extra: { type: "noDamage", value: 0 } },
        { id: "a84", name: "별빛 수집가", emoji: "🌟", flavor: "헬멧 너머로 박수를 보낸다.", extra: { type: "timeLimit", value: 100 } },
        { id: "a85", name: "달 기지 정비사", emoji: "🧑‍🚀", flavor: "헬멧 너머로 박수를 보낸다.", extra: { type: "combo", value: 20 } },
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
        flavor: "왕관이 플레어처럼 튄다.",
        pattern: "stealCoins",
        preLine: "동전은 코로나에 녹인다.",
        defeatLine: "녹은 동전, 빛으로 돌려준다."
      },
      audiences: [
        { id: "a31", name: "플레어 서퍼", emoji: "🔥", flavor: "불꽃보다 빨리 끝나길 빈다.", extra: { type: "timeLimit", value: 90 } },
        { id: "a32", name: "코로나 가이드", emoji: "🌞", flavor: "흑점 투어를 잠시 멈춘다.", extra: { type: "combo", value: 18 } },
        { id: "a33", name: "홍염 사진가", emoji: "📷", flavor: "피날레에 셔터를 누른다.", extra: { type: "finisher", value: 1 } },
        { id: "a90", name: "빛 연구원", emoji: "🧪", flavor: "선글라스 너머 눈이 동그래진다.", extra: { type: "timeLimit", value: 105 } },
        { id: "a91", name: "코로나 여행객", emoji: "🕶️", flavor: "선글라스 너머 눈이 동그래진다.", extra: { type: "combo", value: 21 } },
        { id: "a92", name: "태양 관측자", emoji: "🔭", flavor: "선글라스 너머 눈이 동그래진다.", extra: { type: "finisher", value: 1 } },
        { id: "a93", name: "플레어 서퍼", emoji: "🏄", flavor: "선글라스 너머 눈이 동그래진다.", extra: { type: "noDamage", value: 0 } },
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
        { id: "a34", name: "관광 외계인", emoji: "👽", flavor: "번역기가 박수를 모른다.", extra: { type: "combo", value: 20 } },
        { id: "a35", name: "UFO 파일럿", emoji: "🛸", flavor: "기체를 기울여 구경한다.", extra: { type: "noDamage", value: 0 } },
        { id: "a36", name: "별자리 해설가", emoji: "✨", flavor: "별이 지기 전에 보여 줘.", extra: { type: "timeLimit", value: 100 } },
        { id: "a98", name: "우주 음악가", emoji: "🎹", flavor: "항로를 멈추고 박자를 탄다.", extra: { type: "combo", value: 22 } },
        { id: "a99", name: "은하 사진가", emoji: "📸", flavor: "항로를 멈추고 박자를 탄다.", extra: { type: "finisher", value: 1 } },
        { id: "a100", name: "성운 안내원", emoji: "🌌", flavor: "항로를 멈추고 박자를 탄다.", extra: { type: "noDamage", value: 0 } },
        { id: "a101", name: "혜성 라이더", emoji: "☄️", flavor: "항로를 멈추고 박자를 탄다.", extra: { type: "timeLimit", value: 110 } },
        { id: "a102", name: "별자리 여행자", emoji: "✨", flavor: "항로를 멈추고 박자를 탄다.", extra: { type: "combo", value: 22 } }
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
        { id: "a107", name: "박수치는 나", emoji: "👏", flavor: "거울 너머의 내가 웃는다.", extra: { type: "noDamage", value: 0 } },
        { id: "a108", name: "다른 차원의 나", emoji: "🪞", flavor: "거울 너머의 내가 웃는다.", extra: { type: "timeLimit", value: 115 } },
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
      { id: "silk", name: "멘탈 보호막", effect: "shield", share: 0.19, ladder: [
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
      { id: "silk", name: "멘탈 보호막", effect: "shield", share: 0.2, rarityMap: [0, 0, 1, 1, 1], ladder: [
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
    {"id": "power", "name": "힘 있는 손끝", "desc": "지팡이 피해 ×1.1^L", "max": 10, "cost": {"c": 120, "g": 2.2}, "currency": "coins", "prereqs": ["root"], "x": -1, "y": 0, "reveal": "N", "branch": "hand", "icon": "node-hand-1.png", "emoji": "✋", "pending": false},
    {"id": "speed", "name": "빠른 손끝", "desc": "초당 타격 +0.12L, 기본 최대 4.6회 유지", "max": 10, "cost": {"c": 60, "g": 2.2}, "currency": "coins", "prereqs": ["power"], "x": -2, "y": 0, "reveal": "N", "branch": "hand", "icon": "node-hand-2.png", "emoji": "⚡", "pending": false},
    {"id": "area", "name": "넓은 지팡이", "desc": "지팡이 범위를 2×1부터 5×5까지 확장해요", "max": 8, "cost": [90, 8000, 16000, 18000, 6000, 15000, 35000, 90000], "currency": "coins", "prereqs": ["power", "board"], "x": -3, "y": 0, "reveal": "N", "branch": "hand", "icon": "node-hand-1.png", "emoji": "🪄", "pending": false},
    {"id": "crit", "name": "번뜩임", "desc": "수동 지팡이 타격 8% 확률로 피해 ×1.5", "max": 1, "cost": [180], "currency": "coins", "prereqs": ["speed"], "x": -2, "y": -1, "reveal": "N", "branch": "hand", "icon": "node-hand-2.png", "emoji": "✨", "pending": false},
    {"id": "critRate", "name": "예리한 손끝", "desc": "치명타 확률 +2L%p, 최종 최대 14%", "max": 3, "cost": {"c": 450, "g": 2.2}, "currency": "coins", "prereqs": ["crit"], "x": -3, "y": -1, "reveal": "N", "branch": "hand", "icon": "node-hand-1.png", "emoji": "🎯", "pending": false},
    {"id": "critPower", "name": "눈부신 트릭", "desc": "치명타 배율 +0.1L, 최종 최대 1.8", "max": 3, "cost": {"c": 700, "g": 2.2}, "currency": "coins", "prereqs": ["critRate"], "x": -4, "y": -1, "reveal": "N", "branch": "hand", "icon": "node-hand-2.png", "emoji": "✨", "pending": false},
    {"id": "comboHold", "name": "이어지는 손끝", "desc": "콤보 유예 +250L ms, 최대 3000ms", "max": 4, "cost": {"c": 220, "g": 2.0}, "currency": "coins", "prereqs": ["area"], "x": -4, "y": 0, "reveal": "N", "branch": "hand", "icon": "node-hand-1.png", "emoji": "👏", "pending": false},
    {"id": "sweepFocus", "name": "한곳 집중", "desc": "타격 대상의 살아 있는 케이스가 정확히 1개면 피해 +5L%", "max": 3, "cost": {"c": 600, "g": 2.0}, "currency": "coins", "prereqs": ["comboHold"], "x": -5, "y": 0, "reveal": "N", "branch": "hand", "icon": "node-hand-2.png", "emoji": "🎯", "pending": false},
    {"id": "precision", "name": "정확한 손끝", "desc": "투명 패턴의 빗나갈 확률에서 2L%p 차감, 최소 0", "max": 3, "cost": {"c": 1800, "g": 2.0}, "currency": "coins", "prereqs": ["critPower"], "x": -5, "y": -1, "reveal": "N9", "branch": "hand", "icon": "node-hand-1.png", "emoji": "🎯", "pending": false},
    {"id": "board", "name": "케이스 자리", "desc": "구매마다 보유 칸 +1", "max": 12, "cost": [40, 120, 300, 700, 1600, 3500, 7500, 15000, 30000, 55000, 90000, 140000], "currency": "coins", "prereqs": ["root"], "x": 1, "y": 0, "reveal": "N", "branch": "box", "icon": "node-box-1.png", "emoji": "📦", "pending": false},
    {"id": "spawn", "name": "빠른 준비", "desc": "재생성 시간 ÷1.08^L", "max": 10, "cost": {"c": 35, "g": 2.2}, "currency": "coins", "prereqs": ["board"], "x": 2, "y": 0, "reveal": "N", "branch": "box", "icon": "node-box-2.png", "emoji": "⏱️", "pending": false},
    {"id": "golden", "name": "황금 초대", "desc": "황금 케이스 해금, 첫 30초·이후 180초 규칙", "max": 1, "cost": [320], "currency": "coins", "prereqs": ["spawn"], "x": 3, "y": 0, "reveal": "N2", "branch": "box", "icon": "node-box-1.png", "emoji": "🎁", "pending": false},
    {"id": "goldPity", "name": "황금 약속", "desc": "황금 케이스 간격 -20L초, 최소 120초", "max": 3, "cost": {"c": 1000, "g": 2.2}, "currency": "coins", "prereqs": ["golden"], "x": 4, "y": 0, "reveal": "N", "branch": "box", "icon": "node-box-2.png", "emoji": "⏳", "pending": false},
    {"id": "goldCoins", "name": "금빛 사례", "desc": "황금 케이스 추가 동전 +20L%", "max": 3, "cost": {"c": 1500, "g": 2.2}, "currency": "coins", "prereqs": ["goldPity"], "x": 5, "y": 0, "reveal": "N", "branch": "box", "icon": "node-box-1.png", "emoji": "🪙", "pending": false},
    {"id": "prepared", "name": "미리 푼 매듭", "desc": "재생성 케이스가 파괴 진행률 5L%로 등장", "max": 2, "cost": {"c": 800, "g": 3.0}, "currency": "coins", "prereqs": ["spawn"], "x": 2, "y": -1, "reveal": "N3", "branch": "box", "icon": "node-box-2.png", "emoji": "🪢", "pending": false},
    {"id": "boxXP", "name": "케이스 연구", "desc": "케이스 XP +10L%, 강의 XP에는 미적용", "max": 3, "cost": {"c": 900, "g": 2.0}, "currency": "coins", "prereqs": ["prepared"], "x": 3, "y": -1, "reveal": "N", "branch": "box", "icon": "node-box-1.png", "emoji": "📚", "pending": false},
    {"id": "boxShield", "name": "실크 포장", "desc": "파괴마다 멘탈 보호막 +0.1LU, cap 적용", "max": 2, "cost": {"c": 1800, "g": 2.5}, "currency": "coins", "prereqs": ["boxXP"], "x": 4, "y": -1, "reveal": "N4", "branch": "box", "icon": "node-box-2.png", "emoji": "🧣", "pending": false},
    {"id": "boxHeal", "name": "숨 고르기", "desc": "파괴마다 멘탈 +0.05LU, 최대치 적용", "max": 2, "cost": {"c": 2400, "g": 2.5}, "currency": "coins", "prereqs": ["boxShield"], "x": 5, "y": -1, "reveal": "N5", "branch": "box", "icon": "node-box-1.png", "emoji": "💧", "pending": false},
    {"id": "mental", "name": "무대 배짱", "desc": "최대 멘탈 ×1.18^L", "max": 10, "cost": {"c": 30, "g": 2.2}, "currency": "coins", "prereqs": ["root"], "x": 0, "y": -1, "reveal": "N", "branch": "heart", "icon": "node-heart-1.png", "emoji": "💛", "pending": false},
    {"id": "attack", "name": "감탄 유도", "desc": "V ×1.05^L", "max": 10, "cost": {"c": 45, "g": 2.2}, "currency": "coins", "prereqs": ["mental"], "x": 0, "y": -2, "reveal": "N", "branch": "heart", "icon": "node-heart-2.png", "emoji": "👏", "pending": false},
    {"id": "shieldCap", "name": "넉넉한 실크", "desc": "멘탈 보호막 cap 비율 0.48+0.03L", "max": 4, "cost": {"c": 250, "g": 2.2}, "currency": "coins", "prereqs": ["mental"], "x": -1, "y": -2, "reveal": "N", "branch": "heart", "icon": "node-heart-1.png", "emoji": "🧣", "pending": false},
    {"id": "shieldValue", "name": "부드러운 실크", "desc": "실크 아이템 멘탈 보호막 +5L%", "max": 4, "cost": {"c": 400, "g": 2.2}, "currency": "coins", "prereqs": ["shieldCap"], "x": -1, "y": -3, "reveal": "N", "branch": "heart", "icon": "node-heart-2.png", "emoji": "🧣", "pending": false},
    {"id": "healValue", "name": "시원한 한 모금", "desc": "회복 아이템 회복량 +5L%", "max": 4, "cost": {"c": 300, "g": 2.2}, "currency": "coins", "prereqs": ["attack"], "x": 1, "y": -2, "reveal": "N", "branch": "heart", "icon": "node-heart-1.png", "emoji": "💧", "pending": false},
    {"id": "winHeal", "name": "박수로 회복", "desc": "승리 회복 비율 0.20+0.02L", "max": 3, "cost": {"c": 650, "g": 2.2}, "currency": "coins", "prereqs": ["healValue"], "x": 1, "y": -3, "reveal": "N", "branch": "heart", "icon": "node-heart-2.png", "emoji": "👏", "pending": false},
    {"id": "levelHeal", "name": "연습의 보람", "desc": "레벨업 회복 비율 0.16+0.02L", "max": 3, "cost": {"c": 550, "g": 2.2}, "currency": "coins", "prereqs": ["attack"], "x": 0, "y": -3, "reveal": "N", "branch": "heart", "icon": "node-heart-1.png", "emoji": "💛", "pending": false},
    {"id": "openingShield", "name": "준비된 무대", "desc": "새 run 시작 시 최대 멘탈의 5L% 멘탈 보호막", "max": 3, "cost": {"c": 1000, "g": 2.2}, "currency": "coins", "prereqs": ["levelHeal"], "x": 0, "y": -4, "reveal": "N3", "branch": "heart", "icon": "node-heart-2.png", "emoji": "🛡️", "pending": false},
    {"id": "calm", "name": "흔들리지 않기", "desc": "야유 피해 ×(1-0.02L)", "max": 3, "cost": {"c": 2000, "g": 2.2}, "currency": "coins", "prereqs": ["openingShield"], "x": 0, "y": -5, "reveal": "N5", "branch": "heart", "icon": "node-heart-1.png", "emoji": "💛", "pending": false},
    {"id": "coinLuck", "name": "모자 속 동전", "desc": "동전 추첨 가중치 +6L. 정규화 전 가중치이며 확률은 전체 가중치로 계산합니다.", "max": 10, "cost": {"c": 70, "g": 2.2}, "currency": "coins", "prereqs": ["root"], "x": 1, "y": 1, "reveal": "N", "branch": "luck", "icon": "node-luck-1.png", "emoji": "🪙", "pending": false},
    {"id": "forceRemove", "name": "포스", "desc": "나쁜 슬롯 문양 제거, 보석 비용 max(1,3-L)", "max": 2, "cost": [1, 1], "currency": "keys", "prereqs": ["coinLuck"], "x": 2, "y": 1, "reveal": "N5", "branch": "luck", "icon": "node-luck-2.png", "emoji": "🪄", "pending": false},
    {"id": "tip", "name": "감사의 팁", "desc": "관객 승리 동전 +5L%", "max": 4, "cost": {"c": 180, "g": 2.2}, "currency": "coins", "prereqs": ["coinLuck"], "x": 2, "y": 2, "reveal": "N", "branch": "luck", "icon": "node-luck-1.png", "emoji": "🪙", "pending": false},
    {"id": "dealerCoin", "name": "딜러의 선물", "desc": "딜러 카드의 동전 보상 +10L%", "max": 3, "cost": {"c": 650, "g": 2.2}, "currency": "coins", "prereqs": ["forceRemove"], "x": 3, "y": 1, "reveal": "N5", "branch": "luck", "icon": "node-luck-2.png", "emoji": "🎁", "pending": false},
    {"id": "jackpot", "name": "행운의 박수", "desc": "슬롯 당첨 동전 +15L%, 당첨 확률 유지", "max": 3, "cost": {"c": 1400, "g": 2.2}, "currency": "coins", "prereqs": ["dealerCoin"], "x": 4, "y": 1, "reveal": "N5", "branch": "luck", "icon": "node-luck-1.png", "emoji": "🍀", "pending": false},
    {"id": "gemFind", "name": "반짝이는 모자", "desc": "희귀 이상 드롭의 보석 확률 +1L%p", "max": 3, "cost": {"c": 900, "g": 2.2}, "currency": "coins", "prereqs": ["tip"], "x": 3, "y": 2, "reveal": "N3", "branch": "luck", "icon": "node-luck-2.png", "emoji": "💎", "pending": false},
    {"id": "equip", "name": "소품 진열대", "desc": "3×3 장착판, 처음 3칸 해금", "max": 1, "cost": [700], "currency": "coins", "prereqs": ["gemFind"], "x": 4, "y": 2, "reveal": "N3", "branch": "luck", "icon": "node-luck-1.png", "emoji": "🎩", "pending": false},
    {"id": "slotPlus", "name": "진열대 확장", "desc": "장착칸 +1, 총 9칸까지", "max": 6, "cost": [600, 1200, 2400, 4800, 9600, 19200], "currency": "coins", "prereqs": ["equip"], "x": 5, "y": 2, "reveal": "N", "branch": "luck", "icon": "node-luck-2.png", "emoji": "🎩", "pending": false},
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
    {"id": "finalePower", "name": "큰 피날레", "desc": "피날레 피해 22V×(1+0.08L)", "max": 4, "cost": {"c": 500, "g": 2.2}, "currency": "coins", "prereqs": ["startFinale"], "x": 0, "y": 2, "reveal": "N", "branch": "finale", "icon": "node-finale-2.png", "emoji": "🎆", "pending": false},
    {"id": "finaleNeed", "name": "짧은 예고", "desc": "필요 게이지 20-L, 최소 18", "max": 2, "cost": {"c": 2500, "g": 3.0}, "currency": "coins", "prereqs": ["finalePower"], "x": 0, "y": 3, "reveal": "N4", "branch": "finale", "icon": "node-finale-1.png", "emoji": "⏳", "pending": false},
    {"id": "comboGift", "name": "이어지는 박수", "desc": "콤보 10/25/50/100 보상 활성화", "max": 1, "cost": [900], "currency": "coins", "prereqs": ["finalePower"], "x": 1, "y": 3, "reveal": "N", "branch": "finale", "icon": "node-finale-2.png", "emoji": "👏", "pending": false},
    {"id": "comboValue", "name": "커지는 박수", "desc": "콤보 milestone의 동전 보상 +20L%", "max": 3, "cost": {"c": 1200, "g": 2.2}, "currency": "coins", "prereqs": ["comboGift"], "x": 2, "y": 3, "reveal": "N", "branch": "finale", "icon": "node-finale-1.png", "emoji": "👏", "pending": false},
    {"id": "encore", "name": "앵콜", "desc": "전투 시간 300초마다 15초간 지팡이 피해 +20%", "max": 1, "cost": [1800], "currency": "coins", "prereqs": ["finaleNeed"], "x": 0, "y": 4, "reveal": "N4", "branch": "finale", "icon": "node-finale-2.png", "emoji": "🎤", "pending": false},
    {"id": "encorePower", "name": "뜨거운 앵콜", "desc": "앵콜 피해 보너스 +5L%p", "max": 2, "cost": {"c": 4000, "g": 2.5}, "currency": "coins", "prereqs": ["encore"], "x": -1, "y": 4, "reveal": "N", "branch": "finale", "icon": "node-finale-1.png", "emoji": "🎤", "pending": false},
    {"id": "encoreSpan", "name": "긴 앵콜", "desc": "앵콜 지속 +3L초", "max": 2, "cost": {"c": 3500, "g": 2.5}, "currency": "coins", "prereqs": ["encore"], "x": 1, "y": 4, "reveal": "N", "branch": "finale", "icon": "node-finale-2.png", "emoji": "⏱️", "pending": false},
    {"id": "challenge", "name": "도전 수첩", "desc": "추가 도전 3개와 각각 V +0.5% 보상 활성화", "max": 1, "cost": [2500], "currency": "coins", "prereqs": ["encore"], "x": 0, "y": 5, "reveal": "N5", "branch": "finale", "icon": "node-finale-1.png", "emoji": "🏅", "pending": false},
    {"id": "starTrick", "name": "별빛 트릭", "desc": "연출 ×1.3^L, 지팡이 피해 ×1.14^L", "max": 30, "cost": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], "currency": "starlight", "prereqs": ["root"], "x": -2, "y": -6, "reveal": "E", "branch": "star", "icon": "node-star-1.png", "emoji": "✦", "pending": false, "starKey": "trick"},
    {"id": "starGuard", "name": "별빛 실크", "desc": "최대 멘탈·멘탈 보호막·회복 ×1.18^L", "max": 30, "cost": [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], "currency": "starlight", "prereqs": ["root"], "x": 0, "y": -6, "reveal": "E", "branch": "star", "icon": "node-star-2.png", "emoji": "✦", "pending": false, "starKey": "guard"},
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
      { id: "gems-1", name: "보석 한 알", emoji: "💎", kind: "gems", value: 1 },
      { id: "gems-3", name: "보석 세 알", emoji: "💎", kind: "gems", value: 3 },
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
        body: "카지노 칩이 박자처럼 쌓였다. 쇼걸이 깃털을 한쪽으로 젖힌다. 이 차원의 불빛은 앵콜을 기억한다."
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
    restart: "연습실로",
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
      shield: "멘탈 보호막",
      combo: "콤보",
      finale: "피날레",
      level: "레벨",
      xp: "경험치",
      coins: "동전",
      gems: "보석",
      keys: "열쇠",
      wandArea: "지팡이 범위",
      attack: "야유",
      heckleIn: "다음 야유",
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
    const members=D.tree.filter(n=>n.branch===b);
    add('infinite-'+b,'끝없는 비법 ∞',b,members[members.length-1].id,ends[b][2],ends[b][3],Number.MAX_SAFE_INTEGER,20000,'node-infinite',{infinite:true,branchMax:members.map(n=>n.id),statBranch:b,desc:'레벨마다 이 가지의 주 능력 +2%, 비용 ×1.5'});
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
  const infinity=D.tree.find(n=>n.id==='infinite-star'); infinity.x=2;infinity.y=-7;
  D.stageRewards = ['콤보 유지 +500 ms','마술 실력 ×1.2','모든 도우미 속도 +10%','새 케이스 시작 LV +1','연쇄 피해 +15%','피날레 피해 +30%'].map((effect,i)=>({id:i+1,venue:(i+1)*2,effect,quote:['박수 사이에도 마술은 이어져요.','손끝을 믿어 주세요.','함께하면 더 빠르죠.','새 케이스도 경험을 기억해요.','놀라움은 옆자리로 번져요.','마지막까지 당신의 확신을 보여 주세요.'][i]}));
})(GAME_DATA);

// U4b pace compensation for stage abilities and the expanded helper ensemble.
GAME_DATA.venues.forEach(v=>{const factors={party:2.08,school:2.08,cafe:2.08,theater:3.25,festival:3.25,audition:3.25,broadcast:2.1,vegas:3.575,broadway:3.575,moon:3.575,sun:3.575,galaxy:3.025,multiverse:2.65};if(factors[v.slug])v.hpFactor=factors[v.slug];});

GAME_DATA.tree.filter(n=>n.u4b).forEach(n=>{
 const base={sponge:'보드에서 튕기며 접촉마다 마술 실력의 25%, 같은 칸은 400ms 간격',cardthrow:'1500ms마다 카드 1장, 마술 실력의 40%',tipbox:'6000ms마다 무대별 동전 획득',flashpaper:'개봉 시 3% 확률, 최대 2개. 누르면 모든 케이스에 마술 실력의 150%',crystal:'8000ms마다 최대 멘탈의 3% 멘탈 보호막, 상한 적용',water:'9000ms마다 최대 멘탈의 3% 회복',spotlight:'4000ms마다 보유 1행에 마술 실력의 60%'};
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
    "name": "리모컨 아빠",
    "heckles": [
      "아빠 때는 더 했어.",
      "채널 돌리지 마라.",
      "리모컨 어디 갔냐.",
      "아들, 그게 다냐?"
    ],
    "winLine": "우리 아들 천재네!"
  },
  "a2": {
    "name": "간식 동생",
    "heckles": [
      "형, 나도 할 수 있어!",
      "간식 더 없어?",
      "뻔한 거 아냐?",
      "형, 이거 쉬워 보여."
    ],
    "winLine": "헐, 형 대박이다!"
  },
  "a3": {
    "name": "앞치마 엄마",
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
    "name": "플레이리스트 친구",
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
    "name": "채점표 선배",
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
    "name": "노트북 단골",
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
    "name": "앞줄 열성팬",
    "heckles": [
      "박수 준비 완료!",
      "더 크게 해 봐요!",
      "팬이라 걱정돼요.",
      "실수하면 어쩌죠?"
    ],
    "winLine": "역시 최고예요!"
  },
  "a14": {
    "name": "프로그램 관객",
    "heckles": [
      "프로그램에 없는데?",
      "다음 장 넘겨요.",
      "순서 틀렸어요.",
      "페이지가 남았네."
    ],
    "winLine": "프로그램 밖이다!"
  },
  "a15": {
    "name": "뒷자리 속삭임",
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
    "name": "치킨 동기",
    "heckles": [
      "치킨 식는다, 야.",
      "양념이 더 낫네.",
      "동기라서 본다.",
      "그게 다냐?"
    ],
    "winLine": "치킨보다 맛있다!"
  },
  "a18": {
    "name": "무대 밑 후배",
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
    "name": "점수판 보조",
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
    "name": "대기실 라이벌",
    "heckles": [
      "내가 더 잘해.",
      "피날레는 내 거야.",
      "긴장 좀 하지?",
      "어디 한번 봐."
    ],
    "winLine": "크, 인정한다!"
  },
  "a64": {
    "name": "작가석 손님",
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
    "name": "현장 방청객",
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
    "name": "큐시트 작가",
    "heckles": [
      "큐시트에 없는데?",
      "순서가 꼬였어요.",
      "수정본 보세요.",
      "대본이 안 맞아요."
    ],
    "winLine": "큐시트 다시 쓴다!"
  },
  "a114": {
    "name": "붐 마이크 기사",
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
    "name": "시청자 반응 담당",
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
    "name": "하이롤러",
    "heckles": [
      "칩을 걸어 볼까.",
      "올인할 값어치?",
      "배팅이 아깝네.",
      "판돈이 아깝다."
    ],
    "winLine": "전 재산 걸겠소!"
  },
  "a23": {
    "name": "쇼걸 관객",
    "heckles": [
      "깃털보다 가볍네요.",
      "화려함이 부족해.",
      "조명이 더 빛나.",
      "볼거리가 약해요."
    ],
    "winLine": "눈이 반짝반짝해요!"
  },
  "a24": {
    "name": "카지노 경비",
    "heckles": [
      "수상한 손놀림이다.",
      "소매 좀 봅시다.",
      "신분증 보여 줘.",
      "카메라가 보고 있다."
    ],
    "winLine": "이건 반칙 아닙니다!"
  },
  "a70": {
    "name": "호텔 관객",
    "heckles": [
      "룸서비스가 낫겠네.",
      "호텔 쇼보다 밋밋해.",
      "체크아웃할까.",
      "로비가 더 화려해."
    ],
    "winLine": "객실에서 자랑해야지!"
  },
  "a71": {
    "name": "쇼 타임 팬",
    "heckles": [
      "쇼 시간 끝났나?",
      "다음 쇼가 낫겠다.",
      "팬이라 봐줄게.",
      "박수는 아직!"
    ],
    "winLine": "쇼 타임, 최고다!"
  },
  "a72": {
    "name": "카지노 관광객",
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
    "name": "1열 뮤지컬 팬",
    "heckles": [
      "하이노트가 없네.",
      "노래 한 곡 낫겠다.",
      "뮤지컬이 더 짜릿.",
      "합창이 그립다."
    ],
    "winLine": "브라보! 기립이다!"
  },
  "a26": {
    "name": "티켓 관광객",
    "heckles": [
      "브로슈어엔 없던데?",
      "표값 아깝지 않나.",
      "관광객도 눈은 높아.",
      "사진부터 찍을까."
    ],
    "winLine": "여행 선물 받았다!"
  },
  "a27": {
    "name": "막간 비평가",
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
    "name": "무대 의상가",
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
    "name": "달기지 관제사",
    "heckles": [
      "관제실 응답 없음.",
      "신호 지연 중이다.",
      "교신 상태 불량.",
      "수신 감도 낮음."
    ],
    "winLine": "관제센터에 보고한다!"
  },
  "a30": {
    "name": "월면차 운전병",
    "heckles": [
      "이 길에선 못 해.",
      "바퀴 자국만 남아.",
      "운전이 더 짜릿.",
      "기름값이 더 든다."
    ],
    "winLine": "월면차에 태우고 싶다!"
  },
  "a83": {
    "name": "월면 과학자",
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
    "name": "달 기지 정비사",
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
    "name": "플레어 서퍼",
    "heckles": [
      "파도가 더 큰데?",
      "서핑 중 뭘 봐.",
      "불꽃보다 느리네.",
      "빨리 끝내 줘."
    ],
    "winLine": "플레어보다 짜릿!"
  },
  "a32": {
    "name": "코로나 가이드",
    "heckles": [
      "투어는 계속돼.",
      "흑점이 더 신기해.",
      "코로나가 더 뜨겁다.",
      "가이드가 한 수 위."
    ],
    "winLine": "가이드북에 싣겠다!"
  },
  "a33": {
    "name": "홍염 사진가",
    "heckles": [
      "셔터가 안 눌려.",
      "찍을 게 없네.",
      "초점이 안 맞아.",
      "홍염이 더 멋져."
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
    "name": "코로나 여행객",
    "heckles": [
      "여기까지 왔는데.",
      "코로나 투어 갈까.",
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
    "name": "플레어 서퍼",
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
    "name": "관광 외계인",
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
    "name": "별자리 해설가",
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
    "name": "성운 안내원",
    "heckles": [
      "성운 쪽으로 오세요.",
      "길 잃으셨죠?",
      "안내판 읽어요.",
      "성운 속은 어둡죠."
    ],
    "winLine": "성운이 반짝였어요!"
  },
  "a101": {
    "name": "혜성 라이더",
    "heckles": [
      "혜성이 더 빨라요.",
      "꼬리도 안 보이네.",
      "속도가 느린데요.",
      "따라올 수 있어?"
    ],
    "winLine": "혜성처럼 빠르네!"
  },
  "a102": {
    "name": "별자리 여행자",
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
    "name": "박수치는 나",
    "heckles": [
      "일단 지켜볼게.",
      "박수는 아직이야.",
      "실수해도 괜찮아.",
      "끝까지 해 봐."
    ],
    "winLine": "박수 쳐 줄게!"
  },
  "a108": {
    "name": "다른 차원의 나",
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
      "heckles": [
        "어디서 배우셨어요?",
        "초보는 뭐부터 해요?",
        "입문 책 추천해 주세요.",
        "저 멀리서 왔어요."
      ],
      "winLine": "저도 꼭 배울래요!"
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
      "line": "칼리가 거실에서 카드를 펼쳤어요.",
      "art": "living"
    },
    {
      "line": "아빠는 리모컨만 꼭 쥐고 있네요.",
      "art": "living"
    },
    {
      "line": "카드 케이스를 열어 마술을 키워요.",
      "art": "cards"
    },
    {
      "line": "다음 무대는 TV, 우주, 그리고 그 너머!",
      "art": "cosmos"
    },
    {
      "line": "자, 렉쳐노트까지 박수 받으러 가요!",
      "art": "shop"
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
      "body": "야유에 멘탈이 깎이면 보호막을 올려요."
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
