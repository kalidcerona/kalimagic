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
 *   twoPhase: two phases. Only multiverse, name "의심 많은 나".
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
      crowdEmoji: "👩👧👦",
      name: "가족 거실",
      intro: "가족이 소파에 앉았다!",
      palette: { bg1: "#3e2b24", bg2: "#9f7954", accent: "#ffe65c" },
      successLine: "거실에서 첫 박수가 난다!",
      trophy: "거실 스타",
      headliner: {
        id: "h1",
        name: "할머니",
        emoji: "👵",
        flavor: "안경을 올리고 손끝을 본다.",
        pattern: "none",
        preLine: "손 바꿨으면 내가 안다.",
        defeatLine: "안 바꿨네. 박수다."
      },
      audiences: [
        { id: "a1", name: "여동생", emoji: "👧", portraitAsset: "aud-f-sister.png", flavor: "거실에서 마술을 본 동생.", extra: { type: "none", value: 0 } },
        { id: "a2", name: "남동생", emoji: "👦", portraitAsset: "aud-f-brother.png", flavor: "앞자리를 맡는 남동생.", extra: { type: "none", value: 0 } },
        { id: "a3", name: "엄마", emoji: "👩", portraitAsset: "aud-f-mom.png", flavor: "둘을 앉히고 박수 치는 엄마.", extra: { type: "none", value: 0 } }
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
      intro: "생일 파티에 불려 왔다!",
      palette: { bg1: "#3a1840", bg2: "#7a2d6b", accent: "#ff7ad9" },
      successLine: "파티 분위기가 터진다!",
      trophy: "파티의 주인공",
      headliner: {
        id: "h2",
        name: "생일 하준이",
        emoji: "🥳",
        flavor: "한 번 더를 청한 친구.",
        pattern: "none",
        preLine: "카드는 아무거나 고를게.",
        defeatLine: "내가 고른 그 이름이잖아."
      },
      audiences: [
        { id: "a4", name: "풍선 담당 지호", emoji: "🎈", flavor: "풍선 장식을 맡은 친구.", extra: { type: "finisher", value: 1 } },
        { id: "a5", name: "운동 친구 서윤", emoji: "🎧", flavor: "운동하며 만나 파티에 부른 친구.", extra: { type: "noDamage", value: 0 } },
        { id: "a6", name: "케이크 민재", emoji: "🎂", flavor: "초를 끄기 전에 손을 본다.", extra: { type: "timeLimit", value: 40 } }
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
      name: "학교 축제",
      intro: "교실 소문이 축제에 닿았다!",
      palette: { bg1: "#1c3a28", bg2: "#2f6b45", accent: "#ffe14a" },
      successLine: "운동장에서 박수가 난다!",
      trophy: "축제 무대의 박수",
      headliner: {
        id: "h3",
        name: "박 선생님",
        emoji: "👩‍🏫",
        flavor: "교실 소문을 듣고 무대를 연다.",
        pattern: "none",
        preLine: "교실에서 보던 그거지?",
        defeatLine: "축제에 세우길 잘했다."
      },
      audiences: [
        { id: "a7", name: "짝꿍 수빈", emoji: "✏️", flavor: "교실에서 먼저 본 짝꿍.", extra: { type: "combo", value: 8 } },
        { id: "a8", name: "반장 도윤", emoji: "📣", flavor: "축제 끝에 응원봉을 켠다.", extra: { type: "finisher", value: 1 } },
        { id: "a9", name: "깐깐 선배 정아", emoji: "🧑‍🎓", flavor: "축제 순서를 메모하는 선배.", extra: { type: "noDamage", value: 0 } },
        { id: "a46", name: "체육부 승민", emoji: "🏀", flavor: "운동장 앞줄을 맡는 선배.", extra: { type: "timeLimit", value: 65 } }
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
      intro: "모르는 손님 앞에 선다!",
      palette: { bg1: "#2a1a12", bg2: "#5c3a28", accent: "#e8a06a" },
      successLine: "손님이 정말 신기해한다!",
      trophy: "카페 단골 스타",
      headliner: {
        id: "h4",
        name: "카페 단골 현우",
        emoji: "☕",
        flavor: "TV와 다르다고 말한 손님.",
        pattern: "slow",
        preLine: "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        defeatLine: "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
      },
      audiences: [
        { id: "a10", name: "노트북 지안", emoji: "💻", flavor: "노트북을 덮고 보는 손님.", extra: { type: "timeLimit", value: 50 } },
        { id: "a11", name: "디저트 은서", emoji: "🍰", flavor: "디저트를 두고 보는 손님.", extra: { type: "combo", value: 10 } },
        { id: "a12", name: "창가 지민", emoji: "🪟", flavor: "창가에서 손을 보는 손님.", extra: { type: "finisher", value: 1 } },
        { id: "a50", name: "바리스타 소영", emoji: "👨‍🍳", flavor: "커피를 내리는 바리스타.", extra: { type: "combo", value: 14 } }
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
      intro: "소극장에 막이 오른다!",
      palette: { bg1: "#2a0c14", bg2: "#6b1d32", accent: "#ffd36a" },
      successLine: "다시 일어나 박수를 받는다!",
      trophy: "소극장 헤드라이너",
      headliner: {
        id: "h5",
        name: "강 마술사님",
        emoji: "🎭",
        flavor: "객석에서 손을 든 강 마술사님.",
        pattern: "sealBox",
        preLine: "저요, 저요, 저요.",
        defeatLine: "좋아. 나는 객석에 있을게."
      },
      audiences: [
        { id: "a13", name: "열성팬 보람", emoji: "👏", flavor: "앞줄에서 박수를 준비한다.", extra: { type: "noDamage", value: 0 } },
        { id: "a14", name: "앞줄 영숙 씨", emoji: "📖", flavor: "칼리가 부담 끝에 고른 관객.", extra: { type: "timeLimit", value: 60 } },
        { id: "a15", name: "지하철 하린", emoji: "🤫", flavor: "카드를 걷어 맞혀 보라 한 관객.", extra: { type: "combo", value: 12 } },
        { id: "a54", name: "대본 작가 서연", emoji: "✍️", flavor: "좋은 장면을 받아 적는 관객.", extra: { type: "finisher", value: 1 } },
        { id: "a55", name: "커튼콜 팬 유나", emoji: "👏", flavor: "커튼콜을 기다리는 관객.", extra: { type: "noDamage", value: 0 } }
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
      intro: "멀리서 보다 달려왔어요!",
      palette: { bg1: "#1a1040", bg2: "#3d2a8a", accent: "#7dffb3" },
      successLine: "축제가 더 밝아졌어요!",
      trophy: "축제의 전설",
      headliner: {
        id: "h6",
        name: "달려온 승우",
        emoji: "🎙️",
        flavor: "멀리서 보고 뛰어온 관객.",
        pattern: "stealCoins",
        preLine: "저희도 마술 보여주세요",
        defeatLine: "축제가 더 밝아졌어요!"
      },
      audiences: [
        { id: "a16", name: "칼리 열혈팬 1223호", emoji: "🚩", flavor: "친근하고 무뚝뚝한 카드 팬.", extra: { type: "finisher", value: 1 } },
        { id: "a17", name: "치킨 동혁", emoji: "🍗", flavor: "치킨 상자를 옆에 두고 본다.", extra: { type: "combo", value: 12 } },
        { id: "a18", name: "후배 지우", emoji: "🎤", flavor: "무대 밑에서 선배를 부른다.", extra: { type: "noDamage", value: 0 } },
        { id: "a59", name: "밴드 팬 서진", emoji: "🎸", flavor: "기타를 내려놓고 손끝을 본다.", extra: { type: "noDamage", value: 0 } },
        { id: "a60", name: "야광봉 팬 하은", emoji: "✨", flavor: "야광봉을 무대 쪽으로 기울인다.", extra: { type: "timeLimit", value: 80 } }
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
      intro: "다음 참가자입니다, 칼리!",
      palette: { bg1: "#101828", bg2: "#1e3a5f", accent: "#7ec8ff" },
      successLine: "3등입니다. 축하해요.",
      trophy: "오디션 3등",
      headliner: {
        id: "h7",
        name: "심사위원 윤 씨",
        emoji: "📺",
        flavor: "점수는 정직하게 매긴다.",
        pattern: "heal",
        preLine: "상황은 웃겨도, 무대는 볼게요.",
        defeatLine: "3등입니다. 축하해요."
      },
      audiences: [
        { id: "a19", name: "진행자 태훈", emoji: "📋", flavor: "구경 온 칼리를 즉석 호명한다.", extra: { type: "timeLimit", value: 70 } },
        { id: "a20", name: "카메라 석진", emoji: "🎥", flavor: "즉석 호명 뒤에 줌을 연다.", extra: { type: "noDamage", value: 0 } },
        { id: "a21", name: "라이벌 유찬", emoji: "😏", flavor: "대기석에서 피날레를 본다.", extra: { type: "finisher", value: 1 } },
        { id: "a64", name: "초대 작가 다인", emoji: "📝", flavor: "대본 대신 무대를 적는다.", extra: { type: "timeLimit", value: 85 } },
        { id: "a65", name: "본방 사수 민규", emoji: "🎤", flavor: "리허설 없이 본방을 본다.", extra: { type: "combo", value: 17 } },
        { id: "a66", name: "방청객 소희", emoji: "📺", flavor: "신호 전에 웃음부터 샌다.", extra: { type: "finisher", value: 1 } }
      ]
    },
    {
      id: 8, balanceRank: 7.5, hpFactor: 1.2, slug: "broadcast", name: "TV 방송", crowd: 75, crowdEmoji: "📺👏",
      venueAsset: "venue-tv-broadcast.png", crowdAsset: "crowd-tv.png",
      intro: "오늘은 유튜브 방송이에요.", successLine: "노련미, 예술 그 자체네요.", trophy: "생방송 스타",
      palette: { bg1: "#14283f", bg2: "#436887", accent: "#70e8ff" },
      headliner: { id: "h-broadcast", name: "오 패널님", emoji: "🎤", portraitAsset: "headliner-tv.png", flavor: "노련미를 말해 준 패널.", pattern: "slow", preLine: "말이 너무 빠르다, 그 말 기억나요?", defeatLine: "노련미, 예술 그 자체네요." },
      audiences: [
        { id: "a112", name: "방송 PD 승기", emoji: "📺", portraitAsset: "aud-tv1.png", flavor: "유튜브 방송을 여는 진행.", extra: { type: "timeLimit", value: 85 } },
        { id: "a113", name: "방송 작가 가은", emoji: "📺", portraitAsset: "aud-tv2.png", flavor: "빠른 템포를 큐에 받아 적는다.", extra: { type: "combo", value: 18 } },
        { id: "a114", name: "음향 감독 도현", emoji: "📺", portraitAsset: "aud-tv3.png", flavor: "빠른 말도 마이크에 담는다.", extra: { type: "noDamage", value: 0 } },
        { id: "a115", name: "응원단장 나리", emoji: "📺", portraitAsset: "aud-tv4.png", flavor: "빠른 박자에 박수를 얹는다.", extra: { type: "finisher", value: 1 } },
        { id: "a116", name: "열정 패널 규리", emoji: "📺", portraitAsset: "aud-tv5.png", flavor: "옆자리에서 말속도를 즐긴다.", extra: { type: "timeLimit", value: 90 } },
        { id: "a117", name: "조명 감독 태산", emoji: "📺", portraitAsset: "aud-tv6.png", flavor: "빠른 손끝에 빛을 맞춘다.", extra: { type: "combo", value: 20 } }
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
      intro: "이 무대, 꿈같네요.",
      palette: { bg1: "#241536", bg2: "#5d2344", accent: "#ffc667" },
      successLine: "제 방식으로 갈게요.",
      trophy: "베가스의 별",
      invitation: { keys: 1, name: "라스베가스 초대장" },
      headliner: {
        id: "h8",
        name: "데이비드 카퍼필",
        emoji: "🎰",
        flavor: "큰 무대의 마술사.",
        pattern: "invisible",
        preLine: "상상은 관객이 완성하지.",
        defeatLine: "네 표정이 보이는구나."
      },
      audiences: [
        { id: "a22", name: "펜 앤 텔로", emoji: "💎", flavor: "반전과 우주인 마술의 콤비.", extra: { type: "combo", value: 15 } },
        { id: "a23", name: "데릴", emoji: "💃", flavor: "카드의 롤모델.", extra: { type: "timeLimit", value: 80 } },
        { id: "a24", name: "경비 대니 씨", emoji: "💂", flavor: "팔짱을 풀고 무대를 본다.", extra: { type: "noDamage", value: 0 } },
        { id: "a70", name: "투숙객 에밀리", emoji: "🏨", flavor: "칩을 접고 의자를 당긴다.", extra: { type: "combo", value: 18 } },
        { id: "a71", name: "쇼 팬 소피아", emoji: "🌟", flavor: "프로그램 북을 덮고 본다.", extra: { type: "finisher", value: 1 } },
        { id: "a72", name: "관광객 마크", emoji: "🎲", flavor: "카메라를 내리고 손을 본다.", extra: { type: "noDamage", value: 0 } }
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
      intro: "선생님 공연, 정말 신기했어요.",
      palette: { bg1: "#1c1018", bg2: "#4a2030", accent: "#f0c36a" },
      successLine: "속말도 마술의 일부예요.",
      trophy: "브로드웨이 주연",
      invitation: { keys: 2, name: "브로드웨이 초대장" },
      headliner: {
        id: "h9",
        name: "객석 리사",
        emoji: "🌟",
        flavor: "신기해서 분이 샌 객석 리사.",
        pattern: "slow",
        preLine: "아, 너무 신기해서 분이 나!",
        defeatLine: "그 마음이 여기까지 와요."
      },
      audiences: [
        { id: "a25", name: "뮤지컬 팬 제인", emoji: "🎶", flavor: "노래 다음 숨을 마술에 맡긴다.", extra: { type: "finisher", value: 1 } },
        { id: "a26", name: "뉴욕 관광객 톰", emoji: "🎟️", flavor: "안내문을 접다 손이 멈춘다.", extra: { type: "combo", value: 15 } },
        { id: "a27", name: "평론가 한 씨", emoji: "🧐", flavor: "별점을 지우고 다시 적는다.", extra: { type: "timeLimit", value: 80 } },
        { id: "a76", name: "티켓 수집가 벤", emoji: "🎟️", flavor: "티켓을 주머니에 도로 넣는다.", extra: { type: "finisher", value: 1 } },
        { id: "a77", name: "발레 클로이", emoji: "🩰", flavor: "발끝 대신 손끝을 따라간다.", extra: { type: "noDamage", value: 0 } },
        { id: "a78", name: "오케스트라 헨리", emoji: "🎼", flavor: "박수를 곡의 마지막 박에 맞춘다.", extra: { type: "timeLimit", value: 95 } },
        { id: "a79", name: "디자이너 미아", emoji: "👗", flavor: "소매선만 보고 웃는다.", extra: { type: "combo", value: 19 } }
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
      intro: "돌계단에서 시작한 공연이에요.",
      palette: { bg1: "#101a33", bg2: "#636b7c", accent: "#d6e4f0" },
      successLine: "즉흥 대처, 오늘 가져가요.",
      trophy: "달의 마술사",
      invitation: { keys: 2, name: "달 초대장" },
      headliner: {
        id: "h10",
        name: "목욕탕 아저씨",
        emoji: "🌕",
        flavor: "도박에 안 당하는 법을 물은 손님.",
        pattern: "sealBox",
        preLine: "도박에 안 당하는 법은요?",
        defeatLine: "도박은 안 할게요."
      },
      audiences: [
        { id: "a28", name: "돌계단 수호", emoji: "🧑‍🚀", flavor: "해운대 돌계단에 모인 관객.", extra: { type: "noDamage", value: 0 } },
        { id: "a29", name: "무전 담당 보라", emoji: "🛰️", flavor: "돌계단 인원을 세고 있다.", extra: { type: "finisher", value: 1 } },
        { id: "a30", name: "탐사차 기사님", emoji: "🚙", flavor: "계단 아래 자리를 지킨다.", extra: { type: "combo", value: 18 } },
        { id: "a83", name: "윤 박사님", emoji: "🔭", flavor: "헬멧 대신 노트를 펼친다.", extra: { type: "noDamage", value: 0 } },
        { id: "a84", name: "수집가 로이", emoji: "🌟", flavor: "병 대신 박수를 모은다.", extra: { type: "timeLimit", value: 100 } },
        { id: "a85", name: "정비 담당 대철", emoji: "🧑‍🚀", flavor: "공구 대신 통로를 비운다.", extra: { type: "combo", value: 20 } },
        { id: "a86", name: "관광객 하나", emoji: "🚀", flavor: "야경 사진을 멈추고 본다.", extra: { type: "finisher", value: 1 } }
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
      intro: "태양이 눈부시네요.",
      palette: { bg1: "#3a1408", bg2: "#8a2e10", accent: "#ffb020" },
      successLine: "그늘로 가요.",
      trophy: "그늘의 박수",
      invitation: { keys: 3, name: "태양 초대장" },
      headliner: {
        id: "h11",
        name: "햇살 해나",
        emoji: "☀️",
        flavor: "강한 빛과 바람이 먼저 인사한다.",
        pattern: "stealCoins",
        preLine: "눈 감으면 바람이 먼저야.",
        defeatLine: "그늘에서 숨 돌리죠."
      },
      audiences: [
        { id: "a31", name: "서퍼 한울", emoji: "🔥", flavor: "빛 파도에 모자를 붙잡는다.", extra: { type: "timeLimit", value: 90 } },
        { id: "a32", name: "태양 가이드 솔", emoji: "🌞", flavor: "그늘 자리를 손으로 가리킨다.", extra: { type: "combo", value: 18 } },
        { id: "a33", name: "사진가 도하", emoji: "📷", flavor: "역광이라 셔터를 망설인다.", extra: { type: "finisher", value: 1 } },
        { id: "a90", name: "연구원 시우", emoji: "🧪", flavor: "선글라스 너머로 숫자를 적는다.", extra: { type: "timeLimit", value: 105 } },
        { id: "a91", name: "여행객 해리", emoji: "🕶️", flavor: "선글라스를 올렸다 내린다.", extra: { type: "combo", value: 21 } },
        { id: "a92", name: "관측자 이든", emoji: "🔭", flavor: "망원경을 접고 맨눈으로 본다.", extra: { type: "finisher", value: 1 } },
        { id: "a93", name: "파도 서퍼 하람", emoji: "🏄", flavor: "바람 결을 손바닥으로 잰다.", extra: { type: "noDamage", value: 0 } },
        { id: "a94", name: "사진작가 모아", emoji: "📷", flavor: "렌즈 캡이 바람에 들썩인다.", extra: { type: "timeLimit", value: 105 } }
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
      intro: "하나, 둘, 셋. 검정, 빨강.",
      palette: { bg1: "#0c0820", bg2: "#24145a", accent: "#c9a6ff" },
      successLine: "몸짓만으로 충분했죠.",
      trophy: "은하계 슈퍼스타",
      invitation: { keys: 3, name: "은하 초대장" },
      headliner: {
        id: "h12",
        name: "타코야키 가온",
        emoji: "👽",
        flavor: "일본 노점 줄의 손님.",
        pattern: "heal",
        preLine: "하나! 빨강!",
        defeatLine: "하나, 둘, 셋!"
      },
      audiences: [
        { id: "a34", name: "샵 손님 하늘", emoji: "👽", flavor: "중국 마술샵의 손님.", extra: { type: "combo", value: 20 } },
        { id: "a35", name: "파일럿 우진", emoji: "🛸", flavor: "기체를 기울여 손짓을 본다.", extra: { type: "noDamage", value: 0 } },
        { id: "a36", name: "별자리 선생님", emoji: "✨", flavor: "별 대신 손가락 수를 센다.", extra: { type: "timeLimit", value: 100 } },
        { id: "a98", name: "음악가 세영", emoji: "🎹", flavor: "건반 대신 구호에 박자를 맞춘다.", extra: { type: "combo", value: 22 } },
        { id: "a99", name: "사진가 지후", emoji: "📸", flavor: "셔터를 숫자 구호에 맞춘다.", extra: { type: "finisher", value: 1 } },
        { id: "a100", name: "안내원 다솜", emoji: "🌌", flavor: "줄의 방향을 손짓으로 안내한다.", extra: { type: "noDamage", value: 0 } },
        { id: "a101", name: "레이서 건우", emoji: "☄️", flavor: "빠른 구호에 속도를 줄인다.", extra: { type: "timeLimit", value: 110 } },
        { id: "a102", name: "여행자 수아", emoji: "✨", flavor: "소원 대신 색깔을 고른다.", extra: { type: "combo", value: 22 } }
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
      intro: "다른 칼리들이 한자리에 모였다!",
      palette: { bg1: "#080610", bg2: "#1a1030", accent: "#9af0ff" },
      successLine: "모습은 달라도 박수다!",
      trophy: "멀티버스의 왕관",
      invitation: { keys: 4, name: "멀티버스 초대장" },
      headliner: {
        id: "h13",
        name: "의심 많은 나",
        emoji: "🪞",
        flavor: "의심해도 자리는 지킨다.",
        pattern: "twoPhase",
        preLine: "난 의심이 많아도 끝까지 해 온 너다.",
        phase2Line: "그만두고 싶었던 적은 없어.",
        defeatLine: "모습은 달라도 좋다."
      },
      audiences: [
        { id: "a37", name: "농장 게임만 하는 칼리", emoji: "🪞", flavor: "농장 게임만 하는 다른 칼리.", extra: { type: "finisher", value: 1 } },
        { id: "a38", name: "연습실 앞의 나", emoji: "🚪", flavor: "문 앞에서 카드를 만지작거린다.", extra: { type: "timeLimit", value: 120 } },
        { id: "a39", name: "카드 접은 나", emoji: "🃏", flavor: "접어 둔 카드를 다시 꺼낸다.", extra: { type: "combo", value: 20 } },
        { id: "a106", name: "용기 낸 나", emoji: "💫", flavor: "한 걸음을 먼저 내디딘 나.", extra: { type: "finisher", value: 1 } },
        { id: "a107", name: "객석의 나", emoji: "👏", flavor: "객석에서 박수를 아끼던 나.", extra: { type: "noDamage", value: 0 } },
        { id: "a108", name: "잠시 쉰 나", emoji: "🪞", flavor: "거울 너머의 내가 웃는다.", extra: { type: "timeLimit", value: 115 } },
        { id: "a109", name: "막 시작한 나", emoji: "🪄", flavor: "카드를 막 펼친 날의 나.", extra: { type: "combo", value: 23 } },
        { id: "a110", name: "계속한 칼리", emoji: "🎩", flavor: "마술을 계속 건넨 칼리.", extra: { type: "finisher", value: 1 } },
        { id: "a111", name: "박수 보내는 나", emoji: "💫", flavor: "의심이 끝난 뒤에 박수친다.", extra: { type: "noDamage", value: 0 } }
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
        { id: "water-glass", name: "치킨 한 조각", emoji: "🍗", flavor: "닭다리 한 입이면 멘탈이 쑥! 칼리의 최애 간식이에요." },
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
        { id: "water-glass", name: "치킨 한 조각", emoji: "🍗", flavor: "닭다리 한 입이면 멘탈이 쑥! 칼리의 최애 간식이에요." },
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
    // v4 U45: owner order. 클래식 콜렉션 리마스터 1편 and 2편 (the beginner lectures) break the first two walls, 트레이스2 the last; ten wall products
    // in venue order (wall = audience id, productMultiplier = attack factor). 칼리 덱 is the venue 2 skill only; 틴 케이스 (an accessory) multiplies
    // case item effects. The id p-classic-collection-remastered stays 1편 so old saves keep it; 2편 is new (u31 flag: an older save without it loads as 0).
    {"id": "p-classic-collection-remastered", "name": "클래식 콜렉션 리마스터 1편", "short": "클래식 1편", "desc": "", "max": 1, "cost": [1500], "currency": "coins", "prereqs": ["p-kali-deck"], "x": 7, "y": 3, "reveal": "N", "venueSlug": "party", "branch": "collection", "icon": "item-classic-collection-remastered.png", "emoji": "✨", "pending": false, "productMultiplier": 6, "wall": "h2"},
    {"id": "p-kali-deck", "name": "칼리 덱", "desc": "", "max": 1, "cost": [1500], "currency": "coins", "prereqs": ["equip"], "x": 6, "y": 3, "reveal": "N", "venueSlug": "party", "branch": "collection", "icon": "item-kali-deck.png", "emoji": "✨", "pending": false},
    {"id": "p-classic-collection-remastered-2", "name": "클래식 콜렉션 리마스터 2편", "short": "클래식 2편", "desc": "", "max": 1, "cost": [2500], "currency": "coins", "prereqs": ["p-classic-collection-remastered"], "x": 8, "y": 3, "reveal": "N", "venueSlug": "school", "branch": "collection", "icon": "item-classic-collection-remastered-2.png", "emoji": "✨", "pending": false, "productMultiplier": 6, "wall": "a8", "u31": true},
    {"id": "p-trace", "name": "트레이스", "desc": "", "max": 1, "cost": [4500], "currency": "coins", "prereqs": ["p-classic-collection-remastered-2"], "x": 9, "y": 3, "reveal": "N", "venueSlug": "cafe", "branch": "collection", "icon": "item-trace.png", "emoji": "✨", "pending": false, "productMultiplier": 2.5, "wall": "a11"},
    {"id": "p-target", "name": "타겟", "desc": "", "max": 1, "cost": [30000], "currency": "coins", "prereqs": ["p-trace"], "x": 10, "y": 3, "reveal": "N", "venueSlug": "theater", "branch": "collection", "icon": "item-target.png", "emoji": "✨", "pending": false, "productMultiplier": 1.5, "wall": "h5"},
    {"id": "p-nao-card-tricks", "name": "Nao Card Tricks", "desc": "", "max": 1, "cost": [1000000], "currency": "coins", "prereqs": ["p-target"], "x": 11, "y": 3, "reveal": "N", "venueSlug": "audition", "branch": "collection", "icon": "item-nao-card-tricks.png", "emoji": "✨", "pending": false, "productMultiplier": 2, "wall": "a21"},
    {"id": "p-chameleon", "name": "카멜레온", "desc": "", "max": 1, "cost": [3000000], "currency": "coins", "prereqs": ["p-kali-deck"], "x": 6, "y": 4, "reveal": "N", "venueSlug": "broadcast", "branch": "collection", "icon": "item-chameleon.png", "emoji": "✨", "pending": false, "productMultiplier": 1.5, "wall": "a114"},
    {"id": "p-tin-case", "name": "틴 케이스", "desc": "", "max": 1, "cost": [3500000], "currency": "coins", "prereqs": ["p-chameleon"], "x": 7, "y": 4, "reveal": "N", "venueSlug": "vegas", "branch": "collection", "icon": "item-tin-case.png", "emoji": "✨", "pending": false, "caseItemMult": 2},
    {"id": "p-epiphany", "name": "에피파니 Vol.1 리마스터", "short": "에피파니 Vol.1", "desc": "", "max": 1, "cost": [5000000], "currency": "coins", "prereqs": ["p-tin-case"], "x": 8, "y": 4, "reveal": "N", "venueSlug": "moon", "branch": "collection", "icon": "item-epiphany.png", "emoji": "✨", "pending": false, "productMultiplier": 1.5, "wall": "a83"},
    {"id": "p-two-si-do", "name": "두 에스 아이 두", "desc": "", "max": 1, "cost": [5500000], "currency": "coins", "prereqs": ["p-epiphany"], "x": 9, "y": 4, "reveal": "N", "venueSlug": "sun", "branch": "collection", "icon": "item-two-si-do.png", "emoji": "✨", "pending": false, "productMultiplier": 1.5, "wall": "a90"},
    {"id": "p-slydini-silks", "name": "슬라이디니 실크", "desc": "", "max": 1, "cost": [8000000], "currency": "coins", "prereqs": ["p-two-si-do"], "x": 10, "y": 4, "reveal": "N", "venueSlug": "galaxy", "branch": "collection", "icon": "item-slydini-silks.png", "emoji": "✨", "pending": false, "productMultiplier": 1.5, "wall": "a98"},
    {"id": "p-trace2", "name": "트레이스2", "desc": "", "max": 1, "cost": [6000000], "currency": "coins", "prereqs": ["p-slydini-silks"], "x": 11, "y": 4, "reveal": "N", "venueSlug": "multiverse", "branch": "collection", "icon": "item-trace2.png", "emoji": "✨", "pending": false, "productMultiplier": 1.5, "wall": "a107"},
    {"id": "assistant", "name": "마술 어시스턴트", "desc": "1200ms마다 타격 ×0.80, 황금 케이스에는 ×1.20", "max": 1, "cost": [1], "currency": "keys", "prereqs": ["boxHelper"], "x": -3, "y": 3, "reveal": "N6", "branch": "pet", "icon": "node-assistant.png", "emoji": "🎩", "pending": false},
    {"id": "power", "name": "손기술", "desc": "지팡이 피해 ×1.1^L", "max": 10, "cost": {"c": 120, "g": 2.2}, "currency": "coins", "prereqs": ["root"], "x": -1, "y": 0, "reveal": "N", "branch": "hand", "icon": "node-hand-1.png", "emoji": "✋", "pending": false},
    {"id": "speed", "name": "빠른 손놀림", "desc": "초당 타격 +0.12L, 기본 최대 4.6회 유지", "max": 10, "cost": {"c": 60, "g": 2.2}, "currency": "coins", "prereqs": ["power"], "x": -2, "y": 0, "reveal": "N", "branch": "hand", "icon": "node-hand-2.png", "emoji": "⚡", "pending": false},
    {"id": "area", "name": "넓은 지팡이", "desc": "지팡이 범위를 2×1부터 5×5까지 확장해요", "max": 8, "cost": [90, 8000, 16000, 18000, 6000, 15000, 35000, 90000], "currency": "coins", "prereqs": ["power", "board"], "x": -3, "y": 0, "reveal": "N", "branch": "hand", "icon": "node-hand-1.png", "emoji": "🪄", "pending": false},
    {"id": "crit", "name": "타이밍", "desc": "수동 지팡이 타격 8% 확률로 피해 ×1.5", "max": 1, "cost": [180], "currency": "coins", "prereqs": ["speed"], "x": -2, "y": -1, "reveal": "N", "branch": "hand", "icon": "node-hand-2.png", "emoji": "✨", "pending": false},
    {"id": "critRate", "name": "타이밍 감각", "desc": "치명타 확률 +2L%p, 최종 최대 14%", "max": 3, "cost": {"c": 450, "g": 2.2}, "currency": "coins", "prereqs": ["crit"], "x": -3, "y": -1, "reveal": "N", "branch": "hand", "icon": "node-hand-1.png", "emoji": "🎯", "pending": false},
    {"id": "critPower", "name": "반전", "desc": "치명타 배율 +0.1L, 최종 최대 1.8", "max": 3, "cost": {"c": 700, "g": 2.2}, "currency": "coins", "prereqs": ["critRate"], "x": -4, "y": -1, "reveal": "N", "branch": "hand", "icon": "node-hand-2.png", "emoji": "✨", "pending": false},
    {"id": "comboHold", "name": "루틴 연결", "desc": "액트 유예 +250L ms, 최대 3000ms", "max": 4, "cost": {"c": 220, "g": 2.0}, "currency": "coins", "prereqs": ["area"], "x": -4, "y": 0, "reveal": "N", "branch": "hand", "icon": "node-hand-1.png", "emoji": "👏", "pending": false},
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
    {"id": "healValue", "name": "든든한 한 입", "desc": "회복 아이템 회복량 +5L%", "max": 4, "cost": {"c": 300, "g": 2.2}, "currency": "coins", "prereqs": ["attack"], "x": 1, "y": -2, "reveal": "N", "branch": "heart", "icon": "node-heart-1.png", "emoji": "🍗", "pending": false},
    {"id": "winHeal", "name": "마무리 포즈", "desc": "관객이 만족했을 때 회복 비율 0.20+0.02L", "max": 3, "cost": {"c": 650, "g": 2.2}, "currency": "coins", "prereqs": ["healValue"], "x": 1, "y": -3, "reveal": "N", "branch": "heart", "icon": "node-heart-2.png", "emoji": "👏", "pending": false},
    {"id": "levelHeal", "name": "연습의 보람", "desc": "레벨업 회복 비율 0.16+0.02L", "max": 3, "cost": {"c": 550, "g": 2.2}, "currency": "coins", "prereqs": ["attack"], "x": 0, "y": -3, "reveal": "N", "branch": "heart", "icon": "node-heart-1.png", "emoji": "💛", "pending": false},
    {"id": "openingShield", "name": "대본 준비", "desc": "새 run 시작 시 최대 멘탈의 5L% 자신감", "max": 3, "cost": {"c": 1000, "g": 2.2}, "currency": "coins", "prereqs": ["levelHeal"], "x": 0, "y": -4, "reveal": "N3", "branch": "heart", "icon": "node-heart-2.png", "emoji": "🛡️", "pending": false},
    {"id": "calm", "name": "포커페이스", "desc": "야유 피해 ×(1-0.02L)", "max": 3, "cost": {"c": 2000, "g": 2.2}, "currency": "coins", "prereqs": ["openingShield"], "x": 0, "y": -5, "reveal": "N5", "branch": "heart", "icon": "node-heart-1.png", "emoji": "💛", "pending": false},
    {"id": "coinLuck", "name": "모자 속 동전", "desc": "동전 추첨 가중치 +6L. 정규화 전 가중치이며 확률은 전체 가중치로 계산합니다.", "max": 10, "cost": {"c": 70, "g": 2.2}, "currency": "coins", "prereqs": ["root"], "x": 1, "y": 1, "reveal": "N", "branch": "luck", "icon": "node-luck-1.png", "emoji": "🪙", "pending": false},
    {"id": "forceRemove", "name": "포스", "desc": "카드 몬테 첫 판, 여왕을 0.6초씩 더 보여주고 첫 섞기가 조금 느려져요", "max": 2, "cost": [1, 1], "currency": "keys", "prereqs": ["coinLuck"], "x": 2, "y": 1, "reveal": "N5", "branch": "luck", "icon": "node-luck-2.png", "emoji": "🪄", "pending": false},
    {"id": "tip", "name": "감사의 팁", "desc": "관객 만족 동전 +5L%", "max": 4, "cost": {"c": 180, "g": 2.2}, "currency": "coins", "prereqs": ["coinLuck"], "x": 2, "y": 2, "reveal": "N", "branch": "luck", "icon": "node-luck-1.png", "emoji": "🪙", "pending": false},
    {"id": "dealerCoin", "name": "매니저의 선물", "desc": "컵앤볼과 카드 몬테의 동전 보상 +10%/레벨", "max": 3, "cost": {"c": 650, "g": 2.2}, "currency": "coins", "prereqs": ["forceRemove"], "x": 3, "y": 1, "reveal": "N5", "branch": "luck", "icon": "node-luck-2.png", "emoji": "🎁", "pending": false},
    {"id": "jackpot", "name": "행운의 박수", "desc": "카드 몬테에서 연속으로 맞출 때마다 동전 +15%/레벨", "max": 3, "cost": {"c": 1400, "g": 2.2}, "currency": "coins", "prereqs": ["dealerCoin"], "x": 4, "y": 1, "reveal": "N5", "branch": "luck", "icon": "node-luck-1.png", "emoji": "🍀", "pending": false},
    {"id": "gemFind", "name": "반짝이는 모자", "desc": "희귀 이상 드롭의 실크 확률 +1L%p", "max": 3, "cost": {"c": 900, "g": 2.2}, "currency": "coins", "prereqs": ["tip"], "x": 3, "y": 2, "reveal": "N3", "branch": "luck", "icon": "node-luck-2.png", "emoji": "💎", "pending": false},
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
    {"id": "startFinale", "name": "개막 피날레", "desc": "케이스 1개를 열 때마다 피날레가 1칸 차고, 기본 20칸(비법으로 줄어듦)이 차면 큰 한 방이 나가요. 기본 피해는 표시된 연출의 2.75배, 마지막 보스 3막 준비 후 첫 피날레는 2배\n타겟은 5칸 충전, 액트 보상도 충전해요\n피날레 힘 비법·무대 보상·피날레 계열 강화로 더 강해져요.\n공연 시작 때 피날레 게이지 충전", "max": 1, "cost": [1], "currency": "keys", "prereqs": ["root"], "x": 0, "y": 1, "reveal": "N", "branch": "finale", "icon": "node-finale-1.png", "emoji": "🌟", "pending": false},
    {"id": "finalePower", "name": "표현력", "desc": "케이스 1개를 열 때마다 피날레가 1칸 차고, 기본 20칸(비법으로 줄어듦)이 차면 큰 한 방이 나가요. 기본 피해는 표시된 연출의 2.75배, 마지막 보스 3막 준비 후 첫 피날레는 2배\n타겟은 5칸 충전, 액트 보상도 충전해요\n피날레 힘 비법·무대 보상·피날레 계열 강화로 더 강해져요.\n피날레 피해 22V×(1+0.08L)", "max": 4, "cost": {"c": 500, "g": 2.2}, "currency": "coins", "prereqs": ["startFinale"], "x": 0, "y": 2, "reveal": "N", "branch": "finale", "icon": "node-finale-2.png", "emoji": "🎆", "pending": false},
    {"id": "finaleNeed", "name": "짧은 예고", "desc": "케이스 1개를 열 때마다 피날레가 1칸 차고, 기본 20칸(비법으로 줄어듦)이 차면 큰 한 방이 나가요. 기본 피해는 표시된 연출의 2.75배, 마지막 보스 3막 준비 후 첫 피날레는 2배\n타겟은 5칸 충전, 액트 보상도 충전해요\n피날레 힘 비법·무대 보상·피날레 계열 강화로 더 강해져요.\n필요 게이지 20-L, 최소 18", "max": 2, "cost": {"c": 2500, "g": 3.0}, "currency": "coins", "prereqs": ["finalePower"], "x": 0, "y": 3, "reveal": "N4", "branch": "finale", "icon": "node-finale-1.png", "emoji": "⏳", "pending": false},
    {"id": "comboGift", "name": "이어지는 박수", "desc": "액트 10/25/50/100 보상 활성화", "max": 1, "cost": [900], "currency": "coins", "prereqs": ["finalePower"], "x": 1, "y": 3, "reveal": "N", "branch": "finale", "icon": "node-finale-2.png", "emoji": "👏", "pending": false},
    {"id": "comboValue", "name": "커지는 박수", "desc": "액트 milestone의 동전 보상 +20L%", "max": 3, "cost": {"c": 1200, "g": 2.2}, "currency": "coins", "prereqs": ["comboGift"], "x": 2, "y": 3, "reveal": "N", "branch": "finale", "icon": "node-finale-1.png", "emoji": "👏", "pending": false},
    {"id": "encore", "name": "앵콜", "desc": "전투 시간 300초마다 15초간 지팡이 피해 +20%", "max": 1, "cost": [1800], "currency": "coins", "prereqs": ["finaleNeed"], "x": 0, "y": 4, "reveal": "N4", "branch": "finale", "icon": "node-finale-2.png", "emoji": "🎤", "pending": false},
    {"id": "encorePower", "name": "쇼맨십", "desc": "앵콜 피해 보너스 +5L%p", "max": 2, "cost": {"c": 4000, "g": 2.5}, "currency": "coins", "prereqs": ["encore"], "x": -1, "y": 4, "reveal": "N", "branch": "finale", "icon": "node-finale-1.png", "emoji": "🎤", "pending": false},
    {"id": "encoreSpan", "name": "긴 앵콜", "desc": "앵콜 지속 +3L초", "max": 2, "cost": {"c": 3500, "g": 2.5}, "currency": "coins", "prereqs": ["encore"], "x": 1, "y": 4, "reveal": "N", "branch": "finale", "icon": "node-finale-2.png", "emoji": "⏱️", "pending": false},
    {"id": "challenge", "name": "도전 수첩", "desc": "추가 도전 3개와 각각 V +0.5% 보상 활성화", "max": 1, "cost": [2500], "currency": "coins", "prereqs": ["encore"], "x": 0, "y": 5, "reveal": "N5", "branch": "finale", "icon": "node-finale-1.png", "emoji": "🏅", "pending": false},
    {"id": "starTrick", "name": "비둘기 트릭", "desc": "연출 ×1.3^L, 지팡이 피해 ×1.14^L", "max": 30, "cost": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], "currency": "starlight", "prereqs": ["root"], "x": -2, "y": -6, "reveal": "E", "branch": "star", "icon": "node-star-1.png", "emoji": "🕊️", "pending": false, "starKey": "trick"},
    {"id": "starGuard", "name": "비둘기 망토", "desc": "최대 멘탈·자신감·회복 ×1.18^L", "max": 30, "cost": [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], "currency": "starlight", "prereqs": ["root"], "x": 0, "y": -6, "reveal": "E", "branch": "star", "icon": "node-star-2.png", "emoji": "🕊️", "pending": false, "starKey": "guard"},
    {"id": "starTempo", "name": "비둘기 손놀림", "desc": "초당 타격 ×1.06^L, 재생성 시간 ×0.92^L", "max": 30, "cost": [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], "currency": "starlight", "prereqs": ["root"], "x": 2, "y": -6, "reveal": "E", "branch": "star", "icon": "node-star-3.png", "emoji": "🕊️", "pending": false, "starKey": "tempo"},
    {"id": "starBounty", "name": "비둘기 모자", "desc": "동전 배율 ×1.12^L", "max": 30, "cost": [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], "currency": "starlight", "prereqs": ["root"], "x": 4, "y": -6, "reveal": "E", "branch": "star", "icon": "node-star-4.png", "emoji": "🕊️", "pending": false, "starKey": "bounty"}
  ],
  dealer: {
    name: "수상한 샵 매니저",
    cardVenue: 2,
    slotVenue: 5,
    introLines: [
      "모자를 깊게 눌러쓴 샵 매니저가 웃는다. 컵앤볼이냐, 카드 몬테냐. 골라 봐."
    ],
    cardRules: "컵앤볼이나 카드 몬테 중 하나를 고른다.",
    dudLine: "꽝! 남은 카드가 사라졌다.",
    cardPrizes: [
      { id: "coins-s", name: "동전 한 줌", emoji: "🪙", kind: "coins", value: 20 },
      { id: "coins-m", name: "모자 속 잔돈", emoji: "🎩", kind: "coins", value: 60 },
      // v4 U37: kind values are the base; the dealer pays them times CONST.dealerRewardMult (2.5): gems 1 -> 3, 3 -> 8, heal 20 -> 50 percent, buff 15 -> 37.
      { id: "gems-1", name: "실크 세 장", emoji: "💎", kind: "gems", value: 1 },
      { id: "gems-3", name: "실크 여덟 장", emoji: "💎", kind: "gems", value: 3 },
      { id: "heal", name: "치킨 한 조각", emoji: "🍗", kind: "heal", value: 20 },
      { id: "buff", name: "박수 부적", emoji: "✨", kind: "buff", value: 15 }
    ],
    slotRules: "",
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
    forceLine: ""
  },
  pools: {
    win: [
      "공연 성공!",
      "관객이 웃어요!",
      "기립박수!",
      "한 번 더요!",
      "오늘의 손끝!",
      "무대가 환해요!",
      "박수가 쏟아진다!",
      "마술이 통했어요!",
      "환호가 가득하다!",
      "객석이 들썩인다!",
      "눈이 안 떨어져요!",
      "여운이 남았어요!",
      "우와, 또 속았다!",
      "객석이 다 일어났다!",
      "객석이 파도친다!",
      "뒷자리도 웃어요!",
      "박수가 통로까지 번져요!",
      "관객이 함께 웃어요!"
    ],
    fail: [
      "한 박자만 다시 가죠",
      "카드가 먼저 인사했어요",
      "관객이 다음 장면을 기다려요",
      "토끼가 모자 속으로 돌아갔어요",
      "박수는 한 박자 뒤에 있죠",
      "모자가 잠깐 수줍어해요",
      "조명이 한 박자 먼저 왔어요",
      "비둘기가 날개를 접어 줬어요",
      "주문이 목에서 맴돌아요",
      "손보다 표정이 먼저 굳었어요",
      "다음 호흡에 기회가 있어요",
      "막이 박수를 기다리고 있어요",
      "지팡이가 한 번 더 부탁해요",
      "빈자리도 눈을 떼지 않아요"
    ],
    heckles: [
      "손만 더 보고 싶어요",
      "한 번만 더 천천히요",
      "아직 눈이 따라가요",
      "숨 고르고 다시요",
      "팔짱은 풀고 볼게요",
      "시계보다 손이 궁금해요",
      "작은 소리로 놀랐어요",
      "박수 전에 한 번 더요",
      "뒷자리도 목이 길어져요",
      "멀리서도 손이 보여요",
      "의심이 웃음으로 바뀌는 중",
      "옆 사람 눈이 반짝여요",
      "통로 쪽도 보고 있어요",
      "끝자리까지 웃음이 가요",
      "넓은 객석도 조용히 기대 중",
      "맨 뒤도 눈을 떼지 않아요",
      "박수는 장면 끝에 모을게요",
      "옆 사람이 먼저 웃어요"
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
        title: "네온도 박수에 물들었다",
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
        body: "달 먼지가 박수 모양으로 남았다. 은하 안내원이 통로를 비킨다. 비둘기 세 마리가 모자 속에 떨어졌다."
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
    dealerTitle: "수상한 샵 매니저",
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
    keyGrant: "책 1개",
    invitationNeed: "책 {keys}개",
    extras: {
      none: "3번 감탄",
      finisher: "피날레로 감탄",
      noDamage: "멘탈 손상 없이",
      timeLimit: "{value}초 안에",
      combo: "액트 {value} 이상"
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
      combo: "액트",
      finale: "피날레",
      level: "레벨",
      xp: "경험치",
      coins: "동전",
      gems: "실크",
      keys: "책",
      wandArea: "지팡이 범위",
      attack: "야유",
      heckleIn: "관객의 의심",
      starlight: "비둘기"
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
      "name": "재현 형",
      "flavor": "강의실 뒷줄에서 손을 쫓는다.",
      "heckles": [
        "셔플 다음이 궁금해요.",
        "카드 이야기는 오늘은 짧게요.",
        "손 놓는 순간만 볼게요.",
        "강의실 불빛이 딱 좋아요."
      ],
      "winLine": "이야기보다 손이 먼저네요."
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
      "name": "책가방 민호",
      "flavor": "먼 길 가방을 무릎에 둔다.",
      "encounterLine": "멀리서 왔는데, 손 좀 볼게요.",
      "heckles": [
        "바닷바람 말고 손을 보러 왔어요.",
        "초보는 눈부터죠?",
        "입문 순서는 나중에 물을게요.",
        "자리만 있으면 충분해요.",
        "멀리서 왔는데, 손 좀 볼게요."
      ],
      "winLine": "먼 길, 아깝지 않아요."
    },
    "a-meetup-cheonan": {
      "name": "진수 씨",
      "flavor": "간식 봉지를 강의실에 둔다.",
      "heckles": [
        "간식은 공연 뒤에 열어요.",
        "기차는 다음 걸로 바꿀게요.",
        "하나만 더, 진짜 마지막요.",
        "봉지는 접어 두고 볼게요."
      ],
      "winLine": "간식보다 손이 남네요."
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
      "flavor": "포장 줄과 재고를 같이 본다.",
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
      "flavor": "직원, 포장은 맡겨 주세요.",
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

// U12 copy is bundled verbatim; no runtime fetch.
GAME_DATA.onboarding = {
  "intro": [
  {
    "line": "칼리가 거실에서 마술을 시작했어요.",
    "art": "living"
  },
  {
    "line": "작은 카드 한 장에 엄마가 웃었어요.",
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
(function(D){const scale={school:1.3,cafe:1.2,meetup:1.5,theater:1.1,festival:1.1,audition:4.15,broadcast:5,vegas:9,broadway:13,moon:19,sun:120,galaxy:500,multiverse:840,lecturenote:120};D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor*=scale[v.slug];});D.venues.find(v=>v.slug==='lecturenote').bossHpFactor*=4.9;})(GAME_DATA);

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
(function(D){const scale={meetup:1.16,audition:3.8,broadcast:3,vegas:5,broadway:8,moon:24,sun:13,galaxy:2.4,multiverse:2.05,lecturenote:2};D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor*=scale[v.slug];});})(GAME_DATA);

/* U15 story content is bundled from the supplied, read-only source. */
// Batch D owner review table. Edit reveal, ending and IF dialogue here.
// Sources: fourth script (2026-10-17), ACT 3/4 IF draft, twist design (2026-10-18).
GAME_DATA.storyReview = {
 lecturenote: {
      "opening": [
        {
          "speaker": "칼리",
          "text": "첫날은 야간 알바였어요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "카운터에서 마술도 보여 드렸죠.",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-jung",
          "speaker": "정희수",
          "text": "판매 전에 마술 한 번, 반응 좋았음.",
          "mood": "happy"
        },
        {
          "id": "h-lecturenote-kim",
          "speaker": "김정명",
          "text": "매니저가 된 뒤에 말했지.",
          "mood": "serious"
        },
        {
          "id": "h-lecturenote-kim",
          "speaker": "김정명",
          "text": "사실 널 얻기 위해 다 계획했던 거다",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "그 말, 아직도 기억나요.",
          "mood": "serious"
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "수상한 샵 매니저",
          "text": "마지막 컵앤볼이에요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "그 손, 이제 알겠네요.",
          "mood": "serious"
        },
        {
          "speaker": "수상한 샵 매니저",
          "text": "모자를 벗을게요.",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "세로나예요. 샵 매니저도 저고요.",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "숨겨진 조력자로 있었어요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "저도 마술 샵 매니저가 됐네요.",
          "mood": "serious"
        },
        {
          "id": "h-lecturenote-kim",
          "speaker": "김정명",
          "text": "고개 돌렸더니 카드가 있더라.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "그 찰나였죠. ㅋㅋ",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "카드 몬테의 손도 제 거였어요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "이 편안함, 가져갈게요.",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "서재 테이블로 가요.",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-jung",
          "speaker": "정희수",
          "text": "카운터는 우리가 볼게.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「편안함」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "편안함"
        }
      ]
    },
 future: {
      "opening": [
        {
          "speaker": "칼리",
          "text": "어서 와요. 편히 앉으세요.",
          "mood": "serious"
        },
        {
          "speaker": "초보 관객",
          "text": "처음이라 손이 떨려요.",
          "mood": "sad"
        },
        {
          "speaker": "칼리",
          "text": "케이스 뒤를 봐 주세요.",
          "mood": "serious"
        },
        {
          "speaker": "초보 관객",
          "text": "제 카드가 여기 있어요!",
          "mood": "surprised"
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "칼리",
          "text": "이번엔 전화가 올 거예요.",
          "mood": "serious"
        },
        {
          "speaker": "초보 관객",
          "text": "고른 카드 이름으로요?",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "네. 같이 기다리면 돼요.",
          "mood": "serious"
        },
        {
          "speaker": "세로나",
          "text": "이제 칼리의 말을 들을 때예요.",
          "mood": "serious"
        },
        {
          "speaker": "초보 관객",
          "text": "마술이 이렇게 다정하네요.",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "speaker": "칼리",
          "text": "마술은 당신을 더 매력적으로 보여주는 취미입니다. 많은 사람에게 신선한 경험을 줄 수 있는 장르인 만큼, 그들이 문화적으로 즐길 수 있도록 도와주셨으면 좋겠습니다.",
          "mood": "happy"
        },
        {
          "speaker": "칼리",
          "text": "마술 톡방에서 또 만나요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "소개 페이지도 열어 두었어요.",
          "mood": "serious"
        },
        {
          "speaker": "세로나",
          "text": "버튼 두 개, 지금 켜졌어요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「나눔」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "나눔"
        }
      ]
    },
 ending: ['마술은 당신을 더 매력적으로 보여주는 취미입니다. 많은 사람에게 신선한 경험을 줄 수 있는 장르인 만큼, 그들이 문화적으로 즐길 수 있도록 도와주셨으면 좋겠습니다.','마술 톡방에서 또 만나요.','소개 페이지도 열어 두었어요.','마술이 이렇게 다정하네요.','이제 칼리의 말을 들을 때예요.'],
 ifRoute: {wired:true,youngKaliDuel:{
  cast:[{speaker:'어린 칼리',text:'마술을 막 시작하던 칼리.'},{speaker:'완벽한 칼리',text:'대결 끝에 나타나는 롤모델.'}],
  opening:[{speaker:'어린 칼리',text:'지나가려면 나를 봐.'},{speaker:'칼리',text:'좋아요. 그때의 저죠.'},{speaker:'어린 칼리',text:'첫 웃음, 기억나?'},{speaker:'칼리',text:'젓가락 그림에 웃어 줬죠.'}],
  beforeHeadliner:[{speaker:'어린 칼리',text:'그 웃음이 나를 만들었어.'},{speaker:'칼리',text:'그래서 여기까지 왔네요.'},{speaker:'어린 칼리',text:'한 판만 제대로 하자.'},{speaker:'칼리',text:'이길게요. 나를 깎진 않아요.'},{speaker:'세로나',text:'끝나면 거울이 열려요.'}],
  afterClear:[{speaker:'어린 칼리',text:'응. 미래의 나가 보여.'},{speaker:'완벽한 칼리',text:'잘 왔어. 거울 속으로.'},{speaker:'칼리',text:'따라갈게요. 천천히요.'},{speaker:'세로나',text:'히든 무대가 열렸어요.'}]
 },mirrorStage:{
  cast:[{speaker:'완벽한 칼리',text:'빨간 니트, 흰 면바지, 흰 가방.'}],
  opening:[{speaker:'완벽한 칼리',text:'누구든 먼저 말을 걸게.'},{speaker:'어린 칼리',text:'직장인도, 아이도?'},{speaker:'완벽한 칼리',text:'벽만 없으면 돼.'},{speaker:'칼리',text:'빨간 니트에 흰 가방이네요.'},{speaker:'완벽한 칼리',text:'흰 면바지도 내 옷이야.'}],
  beforeHeadliner:[{speaker:'어린 칼리',text:'모두에게 사랑받아야 해?'},{speaker:'완벽한 칼리',text:'아니. 한 사람씩이야.'},{speaker:'칼리',text:'직장인도 아이도, 같은 눈으로요.'},{speaker:'완벽한 칼리',text:'그 말이 벽을 내리네.'},{speaker:'세로나',text:'이기고 끝나는 무대가 아니에요.'},{speaker:'어린 칼리',text:'이 옷, 나도 입고 싶다.'}],
  afterClear:[{speaker:'완벽한 칼리',text:'벽이 없으니 충분해.'},{speaker:'칼리',text:'흰 가방의 여유, 배웠어요.'},{speaker:'어린 칼리',text:'미래의 나라서 다행이야.'},{speaker:'세로나',text:'숨은 결말은 여기예요.'}]
 }},
 twist: {
  intro:[{speaker:'칼리',text:'성장과 발견이 이어지는 이야기 전투예요. 실패해도 강화와 동전은 유지돼요.'}],
  hidden:[{speaker:'마술삼일',text:'아직 마지막 마술이 남았다.'}],
  failures:[
   [{speaker:'칼리',text:'보스에게 아직 보지 못한 마술이 있어요.'}],
   [{speaker:'칼리',text:'힘은 충분해졌어요. 마지막 마술을 이해해야 해요.'}],
   [{speaker:'칼리',text:'세 번째 단서가 모였어요.'}]
  ],
  gift:[{speaker:'정명이 형',text:'미래의 네가 쓴 책이야'},{speaker:'칼리',text:'트레이스. 흔들리지 않는 마음을 배웠어요.'}],
  counter:[{speaker:'칼리',text:'난 이제 트레이스를 봤기 때문에 이 정도로 내 멘탈을 무너트릴 수 없어!'}],
  oilWater:[{speaker:'칼리',text:'빨강과 검정, 섞어도 다시 나뉘어요.'},{speaker:'마술삼일',text:'다시 섞었는데도 나뉘다니! 정말 만족스러운 공연이야.'}],
  complete:[{speaker:'칼리',text:'마지막 마술까지 함께 즐겼어요.'}]
 }
};

GAME_DATA.storyV15 = {
  "tutorial": {
    "bio": "뿔테 안경의 튜토리얼 관문. 좋아하는 마술은 엠비셔스 라이저.",
    "intro": [
      {
        "speaker": "NDD",
        "text": "이거 나도 하겠는데용"
      },
      {
        "speaker": "NDD",
        "text": "손만 빠르면 되지 않용?"
      }
    ],
    "coaching": [
      {
        "speaker": "칼리",
        "text": "눈은 손보다 빠르거든요."
      },
      {
        "speaker": "NDD",
        "text": "손만 빠르면 되지 않용?"
      },
      {
        "speaker": "칼리",
        "text": "눈은 손보다 빠르거든요."
      },
      {
        "speaker": "NDD",
        "text": "손만 빠르면 되지 않용?"
      }
    ],
    "defeat": [
      {
        "speaker": "NDD",
        "text": "아니 이거 진짜에용"
      },
      {
        "speaker": "NDD",
        "text": "안경에 김이 서네용."
      },
      {
        "speaker": "칼리",
        "text": "첫 관객이라 더 떨렸어요."
      },
      {
        "speaker": "세로나",
        "text": "저는 옆에서 지켜볼게요."
      },
      {
        "speaker": "세로나",
        "text": "비법 「눈 맞추기」를 배웠어요.",
        "mood": "happy",
        "secretSkill": "눈 맞추기"
      }
    ],
    "winLine": "아니 이거 진짜에용",
    "schoolChain": {
      "girlIntro": [
        {
          "speaker": "세로나",
          "text": "첫 마술은 쉬운 걸로 가요."
        },
        {
          "speaker": "세로나",
          "text": "젓가락에 그림 하나면 충분해요."
        },
        {
          "speaker": "칼리",
          "text": "바퀴벌레가 늘었다 줄어요."
        },
        {
          "speaker": "같은 반 여학생",
          "text": "어, 마리 수가 변했어요!"
        }
      ],
      "girlDuring": [
        {
          "speaker": "세로나",
          "text": "눈은 맞추고, 손은 기억하게 두세요."
        }
      ],
      "girlClear": [
        {
          "speaker": "칼리",
          "text": "제 눈도 봐 주세요."
        }
      ],
      "teacherIntro": [
        {
          "speaker": "수학 선생님",
          "text": "줄어드니까 더 재미있네요."
        }
      ],
      "teacherDuring": [
        {
          "speaker": "수학 선생님",
          "text": "줄어드니까 더 재미있네요."
        }
      ],
      "upgrade": [
        {
          "speaker": "세로나",
          "text": "비법은 여기서 한 번만 올려요."
        },
        {
          "speaker": "세로나",
          "text": "눈 맞추기, 한 단계면 돼요."
        },
        {
          "speaker": "칼리",
          "text": "눈 맞추기, 업그레이드하죠."
        }
      ]
    }
  },
  "helper": {
    "bio": "지하철 실패 뒤 커진 흑화 도깨비. 소극장 중간 보스 클리어 뒤 꼬마 도우미가 된다. 좋아하는 마술은 앰비셔스 카드.",
    "coaching": [
      {
        "speaker": "세로나",
        "text": "눈은 맞추고, 손은 기억하게 두세요.",
        "mood": "serious"
      },
      {
        "speaker": "세로나",
        "text": "비법은 여기서 한 번만 올려요.",
        "mood": "serious"
      },
      {
        "speaker": "세로나",
        "text": "눈 맞추기, 한 단계면 돼요.",
        "mood": "serious"
      }
    ]
  },
  "venues": {
    "family": {
      "opening": [
        {
          "id": "a1",
          "speaker": "여동생",
          "text": "오빠, 나한테 먼저 보여 줘.",
          "mood": "serious"
        },
        {
          "id": "a2",
          "speaker": "남동생",
          "text": "나도 볼래. 앞자리!",
          "mood": "serious"
        },
        {
          "id": "a3",
          "speaker": "엄마",
          "text": "둘 다 앉았으니 시작해 보렴.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "가족 앞이라 더 떨리네요.",
          "mood": "sad"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "가까운 눈일수록 천천히요.",
          "mood": "serious"
        }
      ],
      "beforeHeadliner": [
        {
          "id": "a1",
          "speaker": "여동생",
          "text": "오빠, 나랑 눈 맞춰 봐.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "좋아요. 제 눈을 봐 주세요.",
          "mood": "happy"
        },
        {
          "id": "a1",
          "speaker": "여동생",
          "text": "신기해! 한 번 더!",
          "mood": "surprised"
        },
        {
          "id": "a3",
          "speaker": "엄마",
          "text": "집에서도 박수가 나오네.",
          "mood": "happy"
        },
        {
          "id": "a2",
          "speaker": "남동생",
          "text": "다음엔 내 친구도 보여 줘!",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "그 박수가 첫 박수예요.",
          "mood": "happy"
        }
      ],
      "afterClear": [
        {
          "id": "a1",
          "speaker": "여동생",
          "text": "오빠 최고. 또 해 줘.",
          "mood": "happy"
        },
        {
          "speaker": "칼리",
          "text": "마음 가는 것부터 하죠.",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "다음은 파티 무대예요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「첫 박수」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "첫 박수"
        }
      ]
    },
    "party": {
      "opening": [
        {
          "id": "a5",
          "speaker": "운동 친구 서윤",
          "text": "내 친구 생일이야. 마술 부탁해.",
          "mood": "serious"
        },
        {
          "id": "a4",
          "speaker": "풍선 담당 지호",
          "text": "풍선 다 불어 놨어!",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "좋아요. 신나게 가 볼게요.",
          "mood": "happy"
        },
        {
          "id": "h2",
          "speaker": "생일 하준이",
          "text": "우와, 분위기가 확 사네.",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "앙코르는 즐기면서 받아요.",
          "mood": "serious"
        },
        {
          "speaker": "파티 손님",
          "text": "한 번만 더 보여 줘!",
          "mood": "serious"
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "칼리",
          "text": "앙코르는 전화 마술이에요.",
          "mood": "serious"
        },
        {
          "id": "h2",
          "speaker": "생일 하준이",
          "text": "카드는 아무거나 고를게.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "고르셨으면 잠시만요.",
          "mood": "serious"
        },
        {
          "speaker": "파티 손님",
          "text": "전화 왔다! 발신자가 2 하트야!",
          "mood": "surprised"
        },
        {
          "id": "h2",
          "speaker": "생일 하준이",
          "text": "내가 고른 그 이름이잖아.",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "이름이 그대로 도착했네요.",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "id": "a4",
          "speaker": "풍선 담당 지호",
          "text": "풍선은 안 터졌는데 우리가 터졌다!",
          "mood": "happy"
        },
        {
          "id": "a5",
          "speaker": "운동 친구 서윤",
          "text": "오늘 분위기, 네가 가져갔어.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "앙코르까지 됐네요. ㅋㅋ",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "이번엔 모르는 분 앞이에요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「앙코르 받기」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "앙코르 받기"
        }
      ]
    },
    "school": {
      "opening": [
        {
          "speaker": "짝꿍 수빈",
          "text": "교실 마술, 소문이 다 났어.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "젓가락 그림이었는데요. ㅋㅋ",
          "mood": "serious"
        },
        {
          "speaker": "반장 도윤",
          "text": "학교가 축제 무대를 맡겼대.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "좋아요. 짧게 가 볼게요.",
          "mood": "happy"
        },
        {
          "speaker": "체육부 승민",
          "text": "운동장 앞줄은 내가 맡는다.",
          "mood": "serious"
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "박 선생님",
          "text": "교실에서 보던 그거지?",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "네. 이번엔 축제 무대예요.",
          "mood": "serious"
        },
        {
          "speaker": "박 선생님",
          "text": "소문대로면 박수가 크겠다.",
          "mood": "happy"
        }
      ],
      "afterClear": [
        {
          "speaker": "박 선생님",
          "text": "축제에 세우길 잘했네요.",
          "mood": "serious"
        },
        {
          "speaker": "깐깐 선배 정아",
          "text": "다음은 동네 카페라고 적자.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "모르는 분 앞도 해 보죠.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「눈 맞추기」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "눈 맞추기"
        }
      ]
    },
    "cafe": {
      "opening": [
        {
          "speaker": "칼리",
          "text": "마술 볼래요? 카드 한 장이요.",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "모르는 분께 먼저 보여요.",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "그게 시작이에요.",
          "mood": "serious"
        },
        {
          "id": "h4",
          "speaker": "카페 단골 현우",
          "text": "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
          "mood": "surprised"
        },
        {
          "speaker": "칼리",
          "text": "실제가 더 재밌죠. ㅋㅋ",
          "mood": "happy"
        },
        {
          "speaker": "카드1412",
          "text": "나도 봐도 되겠당?",
          "mood": "serious"
        },
        {
          "speaker": "카드1412",
          "text": "솔바람 마을에서 왔유.",
          "mood": "serious"
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "카드1412",
          "text": "보여 줘유. 나도 좀 한당.",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "숨은 실력은 아직 몰라요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "마음 편히 골라 주세요.",
          "mood": "serious"
        },
        {
          "speaker": "카드1412",
          "text": "이거 심상치 않넹.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "손만 빠른 게 아니에요.",
          "mood": "serious"
        },
        {
          "speaker": "카드1412",
          "text": "존경스럽당. 형 동생 하자유.",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "이제 모자를 벗을 때가 됐네요.",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "speaker": "카드1412",
          "text": "그래 너는 마술을 심심함을 해소하기 위한",
          "mood": "serious"
        },
        {
          "speaker": "카드1412",
          "text": "마술이 아니라 진심을 전하며",
          "mood": "serious"
        },
        {
          "speaker": "카드1412",
          "text": "재미를 찾는 마술사이니 내가 도와줄게!!",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「먼저 다가가기」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "먼저 다가가기"
        }
      ]
    },
    "meetup": {
      "opening": [
        {
          "id": "h-meetup-seoul",
          "speaker": "마술삼일",
          "text": "서울에서 왔다. 칼리야, 앉아.",
          "mood": "serious"
        },
        {
          "id": "a-meetup-changwon",
          "speaker": "빨간 모자",
          "text": "창원 빨간 모자야. 반갑다.",
          "mood": "happy"
        },
        {
          "id": "a-meetup-suwon",
          "speaker": "착한 천사",
          "text": "경북 구미 착한 천사야.",
          "mood": "serious"
        },
        {
          "id": "a-meetup-incheon",
          "speaker": "비타민",
          "text": "인천 비타민이다. 잘 부탁해.",
          "mood": "serious"
        },
        {
          "id": "a-meetup-busan",
          "speaker": "에지",
          "text": "부산 에지야. 편하게 해.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "형들이라니, 마음이 놓여요.",
          "mood": "serious"
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "칼리",
          "text": "이름 모를 분이 어둡다고 하셨죠.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "2 다이아가 7 다이아로 바뀌었어요.",
          "mood": "serious"
        },
        {
          "id": "a-meetup-changwon",
          "speaker": "빨간 모자",
          "text": "칼리야, 그래서 3만 원을 낸 거구나.",
          "mood": "serious"
        },
        {
          "id": "h-meetup-seoul",
          "speaker": "마술삼일",
          "text": "나 마술 3일밖에 안 했어, 네가 다 한 거잖아",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "관객이 해낸 것처럼요.",
          "mood": "serious"
        },
        {
          "speaker": "카드1412",
          "text": "능청은 이렇게 쓰는 거당.",
          "mood": "serious"
        },
        {
          "id": "a-meetup-busan",
          "speaker": "에지",
          "text": "강의는 같이 하는 거야, 칼리야.",
          "mood": "serious"
        },
        {
          "id": "a-meetup-incheon",
          "speaker": "비타민",
          "text": "날아가는 비둘기도 스냅 한 번에 돌아오게 하는 마술사 비타민입니다",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "id": "h-meetup-seoul",
          "speaker": "마술삼일",
          "text": "칼리야, 소극장도 한 번 서 봐.",
          "mood": "serious"
        },
        {
          "id": "a-meetup-suwon",
          "speaker": "착한 천사",
          "text": "끝나고 꼼장어집 가자, 칼리야.",
          "mood": "serious"
        },
        {
          "id": "a-meetup-busan",
          "speaker": "에지",
          "text": "심리랑 교육, 네 말로 해도 돼.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "형들 손, 아주 훌륭하구먼요.",
          "mood": "happy"
        },
        {
          "speaker": "칼리",
          "text": "비법 「관객이 해낸 듯한 연출」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "관객이 해낸 듯한 연출"
        }
      ]
    },
    "theater": {
      "opening": [
        {
          "speaker": "칼리",
          "text": "오늘 유명하신 분이 세 분이에요.",
          "mood": "serious"
        },
        {
          "speaker": "카드1412",
          "text": "부담되면 숨부터 쉬자유.",
          "mood": "serious"
        },
        {
          "id": "a13",
          "speaker": "열성팬 보람",
          "text": "앞줄, 박수 준비됐어요!",
          "mood": "happy"
        },
        {
          "speaker": "칼리",
          "text": "관객 한 분을 모시겠습니다.",
          "mood": "serious"
        },
        {
          "id": "h5",
          "speaker": "강 마술사님",
          "text": "저요, 저요, 저요.",
          "mood": "serious"
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "칼리",
          "text": "저분 앞은 부담되네요...",
          "mood": "serious"
        },
        {
          "speaker": "카드1412",
          "text": "그럼 앞줄로 가유.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "당신이 제 관객이 되었으면 좋겠어요.",
          "mood": "happy"
        },
        {
          "id": "a14",
          "speaker": "앞줄 영숙 씨",
          "text": "제가요? 좋아요.",
          "mood": "happy"
        },
        {
          "speaker": "카드1412",
          "text": "고르면 반은 성공이당.",
          "mood": "serious"
        },
        {
          "id": "h5",
          "speaker": "강 마술사님",
          "text": "좋아. 나는 객석에 있을게.",
          "mood": "happy"
        },
        {
          "id": "a14",
          "speaker": "앞줄 영숙 씨",
          "text": "골라 줘서 고마워요.",
          "mood": "happy"
        },
        {
          "speaker": "칼리",
          "text": "관객은 제가 모시는 거죠.",
          "mood": "serious"
        },
        {
          "speaker": "카드1412",
          "text": "멘탈 보호막은 남겨 둘게유.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "영어가 서툴러 망설였는데요.",
          "mood": "sad"
        },
        {
          "id": "a15",
          "speaker": "지하철 하린",
          "text": "한국어 돼요. 보여 주세요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "그럼 카드를 골라 주세요.",
          "mood": "serious"
        },
        {
          "id": "a15",
          "speaker": "지하철 하린",
          "text": "재밌네요. 한 번 더요.",
          "mood": "happy"
        },
        {
          "speaker": "카드1412",
          "text": "두 번째는 변수가 있당.",
          "mood": "serious"
        },
        {
          "id": "a15",
          "speaker": "지하철 하린",
          "text": "카드는 내가 가져갈게요.",
          "mood": "serious"
        },
        {
          "id": "a15",
          "speaker": "지하철 하린",
          "text": "이게 뭔지 맞혀 봐요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "어... 이번엔 모르겠어요.",
          "mood": "serious"
        },
        {
          "id": "a15",
          "speaker": "지하철 하린",
          "text": "더 연습하라",
          "mood": "serious"
        },
        {
          "speaker": "검은괭이",
          "text": "칼리야, 밥부터 먹자. 내가 산다.",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "인간... 실패... 크다!",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "밍기리님이 커졌어요...!",
          "mood": "surprised"
        },
        {
          "speaker": "카드1412",
          "text": "포커페이스만 유지해유.",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "speaker": "밍기리",
          "text": "인간...마술....재밌다",
          "mood": "happy"
        },
        {
          "speaker": "칼리",
          "text": "다시 일어설게요. 같이요.",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "아칸... 그 카드... 좋다.",
          "mood": "happy"
        },
        {
          "speaker": "검은괭이",
          "text": "밥 먹고 다시 서자, 칼리야.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「관객 고르기」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "관객 고르기"
        },
        {
          "speaker": "칼리",
          "text": "비법 「다시 일어서기」를 배웠어요.",
          "mood": "serious",
          "secretSkill": "다시 일어서기"
        }
      ]
    },
    "festival": {
      "opening": [
        {
          "id": "h6",
          "speaker": "달려온 승우",
          "text": "저희도 마술 보여주세요",
          "mood": "serious"
        },
        {
          "id": "h6",
          "speaker": "달려온 승우",
          "text": "멀리서 보다 달려왔어요!",
          "mood": "serious"
        },
        {
          "id": "a16",
          "speaker": "칼리 열혈팬 1223호",
          "text": "우와! 현실 CG인가..?",
          "mood": "surprised"
        },
        {
          "id": "a16",
          "speaker": "칼리 열혈팬 1223호",
          "text": "이정도면 마술이 아니고",
          "mood": "serious"
        },
        {
          "id": "a16",
          "speaker": "칼리 열혈팬 1223호",
          "text": "마법 아니냐구요!!..",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "가까이서 보면 더 신기하당.",
          "mood": "surprised"
        }
      ],
      "beforeHeadliner": [
        {
          "id": "a16",
          "speaker": "칼리 열혈팬 1223호",
          "text": "눈으로 쫓을 수가 없어요!..",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "사람... 많다. 밝다.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "그 에너지, 받을게요.",
          "mood": "serious"
        },
        {
          "id": "h6",
          "speaker": "달려온 승우",
          "text": "저희 쪽도 봐 주세요!",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "한 명... 씩. 눈... 맞춘다.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "소란해도 한 분씩이죠.",
          "mood": "serious"
        },
        {
          "speaker": "아는 동생",
          "text": "같은 음식은 일주일 못 먹어요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "저는 가능하다고 했어요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "그래서 내기를 했고요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "일주일 내내 그 동생과 치킨이었죠.",
          "mood": "serious"
        },
        {
          "id": "h6",
          "speaker": "달려온 승우",
          "text": "일주일 내내 치킨이요?!",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "목욕탕에서도 카드를 꺼냈죠.",
          "mood": "serious"
        },
        {
          "id": "h10",
          "speaker": "목욕탕 아저씨",
          "text": "도박에 안 당하는 법은요?",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "마술은 보여 드릴게요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "도박은 하지 마세요",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "id": "h6",
          "speaker": "달려온 승우",
          "text": "축제가 더 밝아졌어요!",
          "mood": "serious"
        },
        {
          "id": "a16",
          "speaker": "칼리 열혈팬 1223호",
          "text": "숨 차요. 그래도 최고예요.",
          "mood": "happy"
        },
        {
          "speaker": "밍기리",
          "text": "밝은 인간... 좋다.",
          "mood": "happy"
        },
        {
          "id": "h10",
          "speaker": "목욕탕 아저씨",
          "text": "도박은 안 할게요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「관객 에너지 받기」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "관객 에너지 받기"
        }
      ]
    },
    "audition": {
      "opening": [
        {
          "id": "a19",
          "speaker": "진행자 태훈",
          "text": "다음 참가자입니다, 칼리!",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "저 구경하러 온 건데요?",
          "mood": "serious"
        },
        {
          "id": "h7",
          "speaker": "심사위원 윤 씨",
          "text": "상황은 웃겨도, 무대는 볼게요.",
          "mood": "happy"
        },
        {
          "id": "a16",
          "speaker": "칼리 열혈팬 1223호",
          "text": "칼리님, 응원해요!",
          "mood": "serious"
        },
        {
          "speaker": "카드1412",
          "text": "즉흥도 실력이당.",
          "mood": "serious"
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "카드1412",
          "text": "첫 장면만 기억하면 돼유.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "관객이랑 같이 웃어 볼게요.",
          "mood": "happy"
        },
        {
          "id": "a19",
          "speaker": "진행자 태훈",
          "text": "다들 즉석인 거 알아요.",
          "mood": "serious"
        },
        {
          "id": "a16",
          "speaker": "칼리 열혈팬 1223호",
          "text": "평소 템포로 가 주세요!",
          "mood": "serious"
        },
        {
          "id": "h7",
          "speaker": "심사위원 윤 씨",
          "text": "마지막 장면만 남았습니다.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "준비는 없어도 마음은 있죠.",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "id": "h7",
          "speaker": "심사위원 윤 씨",
          "text": "3등입니다. 축하해요.",
          "mood": "happy"
        },
        {
          "id": "a16",
          "speaker": "칼리 열혈팬 1223호",
          "text": "우와.. 이정도면 어느 마술대회에 나가도 상을 싹쓸이 쓸어올 것만 같은데요? 최곱니다!!",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "갑자기라서 더 남네요.",
          "mood": "serious"
        },
        {
          "speaker": "카드1412",
          "text": "유리멘탈만 아니면 돼유.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「즉흥 무대」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "즉흥 무대"
        }
      ]
    },
    "broadcast": {
      "opening": [
        {
          "id": "a112",
          "speaker": "방송 PD 승기",
          "text": "오늘은 유튜브 방송이에요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "템포는 빠르게 갈게요.",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "카메라... 많다. 눈... 깜빡.",
          "mood": "serious"
        },
        {
          "id": "a112",
          "speaker": "방송 PD 승기",
          "text": "준비되면 고개만 끄덕여요.",
          "mood": "serious"
        }
      ],
      "beforeHeadliner": [
        {
          "id": "h-broadcast",
          "speaker": "오 패널님",
          "text": "말이 너무 빠르다, 그 말 기억나요?",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "네. 그래도 제 템포예요.",
          "mood": "serious"
        },
        {
          "id": "h-broadcast",
          "speaker": "오 패널님",
          "text": "역시 가르치는 사람은 뭔가 다르다",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "가르침... 마술... 같다.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "배운 걸 나누듯 보여 드릴게요.",
          "mood": "serious"
        },
        {
          "speaker": "응원단장 나리",
          "text": "저도 따라가며 보고 있어요.",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "id": "h-broadcast",
          "speaker": "오 패널님",
          "text": "노련미, 예술 그 자체네요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "그 말, 오래 갈 것 같아요.",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "인간... 칭찬... 좋다.",
          "mood": "happy"
        },
        {
          "speaker": "칼리",
          "text": "비법 「노련미」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "노련미"
        }
      ]
    },
    "vegas": {
      "opening": [
        {
          "speaker": "칼리",
          "text": "이 무대, 꿈같네요. ㄷㄷ",
          "mood": "serious"
        },
        {
          "id": "h8",
          "speaker": "데이비드 카퍼필",
          "text": "상상은 관객이 완성하지.",
          "mood": "serious"
        },
        {
          "id": "a22",
          "speaker": "펜 앤 텔로",
          "text": "알려 주는 척, 그리고 반전.",
          "mood": "serious"
        },
        {
          "id": "a23",
          "speaker": "데릴",
          "text": "앰비셔스는 다시 올라오는 법이지.",
          "mood": "serious"
        }
      ],
      "beforeHeadliner": [
        {
          "id": "a23",
          "speaker": "데릴",
          "text": "카드 리벨레이션도 떠올려 봐.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "유쾌하게 하고 싶었어요.",
          "mood": "serious"
        },
        {
          "speaker": "카드1412",
          "text": "네 색으로 하면 된당.",
          "mood": "serious"
        },
        {
          "id": "a22",
          "speaker": "펜 앤 텔로",
          "text": "우주인도 웃게 만들어 봐.",
          "mood": "happy"
        },
        {
          "id": "h8",
          "speaker": "데이비드 카퍼필",
          "text": "웃음이 쉴 틈도 남겨 둬.",
          "mood": "happy"
        },
        {
          "speaker": "칼리",
          "text": "동경은 빌리고, 손은 제 거예요.",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "id": "h8",
          "speaker": "데이비드 카퍼필",
          "text": "네 표정이 보이는구나.",
          "mood": "serious"
        },
        {
          "id": "a22",
          "speaker": "펜 앤 텔로",
          "text": "반전도 네 리듬이야.",
          "mood": "serious"
        },
        {
          "id": "a23",
          "speaker": "데릴",
          "text": "유쾌하면 충분해.",
          "mood": "happy"
        },
        {
          "speaker": "칼리",
          "text": "제 방식으로 갈게요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「유쾌한 연출」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "유쾌한 연출"
        }
      ]
    },
    "broadway": {
      "opening": [
        {
          "speaker": "칼리",
          "text": "선생님 공연, 정말 신기했어요.",
          "mood": "surprised"
        },
        {
          "id": "h9",
          "speaker": "객석 리사",
          "text": "아, 너무 신기해서 분이 나!",
          "mood": "surprised"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "그 마음, 나쁜 게 아니에요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "보길 잘했어요. 정말요.",
          "mood": "serious"
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "칼리",
          "text": "큰 감정이 객석에 가득해요.",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "놀라움 다음이 진짜예요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "속말로 그 여운을 이어 볼게요.",
          "mood": "serious"
        },
        {
          "id": "h9",
          "speaker": "객석 리사",
          "text": "욕 대신 박수가 나오네요.",
          "mood": "happy"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "마지막까지 관객을 봐요.",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "speaker": "칼리",
          "text": "이너 모놀로그를 배웠어요.",
          "mood": "serious"
        },
        {
          "id": "h9",
          "speaker": "객석 리사",
          "text": "그 마음이 여기까지 와요.",
          "mood": "serious"
        },
        {
          "id": "a-lecturenote-serona",
          "speaker": "세로나",
          "text": "속말도 마술의 일부예요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「이너 모놀로그」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "이너 모놀로그"
        }
      ]
    },
    "moon": {
      "opening": [
        {
          "speaker": "칼리",
          "text": "돌계단에서 시작한 공연이에요.",
          "mood": "serious"
        },
        {
          "id": "a28",
          "speaker": "돌계단 수호",
          "text": "사람이 이렇게 모이다니.",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "인간... 많다. 좋다.",
          "mood": "happy"
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "동료 마술사",
          "text": "이 카드, 내 건 줄 알았네.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "괜찮아요. 다른 걸로 이어요.",
          "mood": "serious"
        },
        {
          "id": "a28",
          "speaker": "돌계단 수호",
          "text": "제 와이파이 이름이 바뀌었어요!",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "소품... 없어도. 마술... 있다.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "즉흥도 준비가 되네요. ㅋㅋ",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "id": "a28",
          "speaker": "돌계단 수호",
          "text": "끝까지 재밌었어요.",
          "mood": "happy"
        },
        {
          "speaker": "칼리",
          "text": "즉흥 대처, 오늘 가져가요.",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "인간... 끝까지... 간다.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「즉흥 대처」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "즉흥 대처"
        }
      ]
    },
    "sun": {
      "opening": [
        {
          "speaker": "칼리",
          "text": "태양이 눈부시네요. 그늘로 가요.",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "빛... 강하다. 눈... 찡그린다.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "일본 줄과 중국 샵이에요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "하나, 둘, 셋. 검정, 빨강.",
          "mood": "serious"
        },
        {
          "id": "h12",
          "speaker": "타코야키 가온",
          "text": "하나! 빨강!",
          "mood": "serious"
        },
        {
          "id": "a34",
          "speaker": "샵 손님 하늘",
          "text": "둘, 셋, 검정!",
          "mood": "serious"
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "칼리",
          "text": "줄 서서 몸짓으로 보여 드릴게요.",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "말... 달라도. 웃음... 같다.",
          "mood": "happy"
        },
        {
          "id": "h12",
          "speaker": "타코야키 가온",
          "text": "하나! 둘! 빨강!",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "아는 말이 적어도 통해요.",
          "mood": "serious"
        },
        {
          "id": "a34",
          "speaker": "샵 손님 하늘",
          "text": "빨강! 검정! 아!",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "손... 보면. 안다.",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "id": "h12",
          "speaker": "타코야키 가온",
          "text": "하나, 둘, 셋!",
          "mood": "serious"
        },
        {
          "id": "a34",
          "speaker": "샵 손님 하늘",
          "text": "셋! 빨강!",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "몸짓만으로 충분했죠.",
          "mood": "happy"
        },
        {
          "speaker": "밍기리",
          "text": "인간... 마술... 통한다.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「몸짓으로 말하기」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "몸짓으로 말하기"
        }
      ]
    },
    "galaxy": {
      "opening": [
        {
          "speaker": "칼리",
          "text": "태양이 눈부시네요. 그늘로 가요.",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "빛... 강하다. 눈... 찡그린다.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "일본 줄과 중국 샵이에요.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "하나, 둘, 셋. 검정, 빨강.",
          "mood": "serious"
        },
        {
          "id": "h12",
          "speaker": "타코야키 가온",
          "text": "하나! 빨강!",
          "mood": "serious"
        },
        {
          "id": "a34",
          "speaker": "샵 손님 하늘",
          "text": "둘, 셋, 검정!",
          "mood": "serious"
        }
      ],
      "beforeHeadliner": [
        {
          "speaker": "칼리",
          "text": "줄 서서 몸짓으로 보여 드릴게요.",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "말... 달라도. 웃음... 같다.",
          "mood": "happy"
        },
        {
          "id": "h12",
          "speaker": "타코야키 가온",
          "text": "하나! 둘! 빨강!",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "아는 말이 적어도 통해요.",
          "mood": "serious"
        },
        {
          "id": "a34",
          "speaker": "샵 손님 하늘",
          "text": "빨강! 검정! 아!",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "손... 보면. 안다.",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "id": "h12",
          "speaker": "타코야키 가온",
          "text": "하나, 둘, 셋!",
          "mood": "serious"
        },
        {
          "id": "a34",
          "speaker": "샵 손님 하늘",
          "text": "셋! 빨강!",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "몸짓만으로 충분했죠.",
          "mood": "happy"
        },
        {
          "speaker": "밍기리",
          "text": "인간... 마술... 통한다.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「몸짓으로 말하기」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "몸짓으로 말하기"
        }
      ]
    },
    "multiverse": {
      "opening": [
        {
          "id": "a37",
          "speaker": "농장 게임만 하는 칼리",
          "text": "나는 농장 게임만 하는 칼리야.",
          "mood": "serious"
        },
        {
          "id": "a110",
          "speaker": "계속한 칼리",
          "text": "나는 마술을 계속 건넸어.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "군대에선 잠시 쉬었죠.",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "쉰 거... 포기... 아니야?",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "쉬고 싶던 건 아니에요.",
          "mood": "serious"
        }
      ],
      "beforeHeadliner": [
        {
          "id": "a110",
          "speaker": "계속한 칼리",
          "text": "그만두고 싶었던 적은 없어.",
          "mood": "serious"
        },
        {
          "id": "a37",
          "speaker": "농장 게임만 하는 칼리",
          "text": "다른 취미도 나야.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "게임도 저고, 마술도 저예요.",
          "mood": "serious"
        },
        {
          "speaker": "밍기리",
          "text": "여러 칼리... 다... 좋다.",
          "mood": "happy"
        },
        {
          "id": "a110",
          "speaker": "계속한 칼리",
          "text": "다시 건네고 싶은 마음.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "그 마음은 하나네요.",
          "mood": "serious"
        }
      ],
      "afterClear": [
        {
          "speaker": "칼리",
          "text": "모습은 달라도 좋아요.",
          "mood": "happy"
        },
        {
          "id": "a37",
          "speaker": "농장 게임만 하는 칼리",
          "text": "농장도 남겨 둬.",
          "mood": "serious"
        },
        {
          "id": "a110",
          "speaker": "계속한 칼리",
          "text": "이제 렉쳐노트로 가.",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "비법 「계속 건네는 마음」을 배웠어요.",
          "mood": "happy",
          "secretSkill": "계속 건네는 마음"
        }
      ],
      "choice": [
        {
          "speaker": "칼리",
          "text": "내가 될 수 있는 모습만 볼까?",
          "mood": "serious"
        },
        {
          "speaker": "칼리",
          "text": "아직 어린 나도 만나 볼까?",
          "mood": "serious"
        },
        {
          "speaker": "세로나",
          "text": "첫 선택은 렉쳐노트로 가는 길이에요.",
          "mood": "serious"
        },
        {
          "speaker": "세로나",
          "text": "둘째는 어린 칼리를 만나는 길이에요.",
          "mood": "serious"
        },
        {
          "speaker": "세로나",
          "text": "환생하면 처음부터 다시예요.",
          "mood": "serious"
        },
        {
          "speaker": "세로나",
          "text": "연출은 더 선명해져요.",
          "mood": "serious"
        },
        {
          "speaker": "세로나",
          "text": "흐름도가 갈림길을 기억해요.",
          "mood": "serious"
        },
        {
          "speaker": "카드1412",
          "text": "다음 생엔 다른 쪽도 갈 수 있당.",
          "mood": "serious"
        }
      ]
    },
    "lecturenote": GAME_DATA.storyReview.lecturenote,
    "future": GAME_DATA.storyReview.future
  },
  "bios": {
    "a1": "거실에서 마술을 본 동생.",
    "a2": "앞자리를 맡는 남동생.",
    "a3": "둘을 앉히고 박수 치는 엄마.",
    "h1": "거실 소파에서 돋보기를 올리고 손끝을 본다.",
    "a4": "풍선 장식을 맡은 친구.",
    "a5": "운동하며 만나 파티에 부른 친구.",
    "a6": "케이크 초를 미루고 보는 친구.",
    "h2": "한 번 더를 청한 생일 하준이.",
    "a7": "젓가락 그림을 맨 앞에서 본 짝꿍.",
    "a8": "반 친구 응원봉을 맡은 반장.",
    "a9": "점수 대신 순서를 적는 선배.",
    "a46": "공 대신 손끝을 보는 체육부 승민.",
    "h3": "젓가락 소문 뒤 축제를 맡긴 담임.",
    "a10": "노트북을 덮고 보는 손님.",
    "a11": "디저트를 두고 보는 손님.",
    "a12": "창가에서 손을 보는 손님.",
    "a50": "커피를 내리는 바리스타.",
    "h4": "TV와 다르다고 말한 손님.",
    "a-meetup-busan": "부산의 마술 매니아. 형.",
    "a-meetup-daegu": "보라 후드에 카드를 든 매니아.",
    "a-meetup-changwon": "창원의 마술 매니아. 형.",
    "a-meetup-incheon": "인천의 마술 매니아. 형.",
    "a-meetup-geoje": "책가방에 초록 카드를 든 매니아.",
    "a-meetup-cheonan": "베이지 코트에 카드 두 장을 든 매니아.",
    "a-meetup-suwon": "경북 구미의 마술 매니아. 형.",
    "h-meetup-seoul": "서울의 마술 매니아. 형.",
    "a13": "앞줄에서 박수를 준비하는 관객.",
    "a14": "칼리가 부담 끝에 고른 관객.",
    "a15": "카드를 걷어 맞혀 보라 한 관객.",
    "a54": "좋은 장면을 받아 적는 관객.",
    "a55": "커튼콜을 기다리는 관객.",
    "h5": "객석에서 손을 든 강 마술사님.",
    "a16": "친근하고 무뚝뚝한 카드 팬.",
    "a17": "치킨 상자를 옆에 둔 친구.",
    "a18": "축제 앞줄에서 선배를 부르는 후배 지우.",
    "a59": "다음 곡 전에 마술을 보는 밴드.",
    "a60": "달려온 승우 사이에서 불을 켜는 팬.",
    "h6": "멀리서 보고 뛰어온 관객.",
    "a19": "구경 온 칼리를 즉석 호명한 진행.",
    "a20": "구경 온 칼리를 화면에 담는 감독.",
    "a21": "같은 오디션을 기다리는 라이벌 유찬.",
    "a64": "즉석 무대를 받아 적는 작가.",
    "a65": "즉석 본방만 보게 된 관객.",
    "a66": "즉석 무대에 먼저 웃는 방청객 소희.",
    "h7": "점수는 정직하게 매기는 심사위원.",
    "a112": "유튜브 방송을 여는 진행.",
    "a113": "빠른 말을 메모하는 방송 작가 가은.",
    "a114": "말속도를 놓치지 않는 음향.",
    "a115": "유튜브 앞에 앉은 응원단.",
    "a116": "빠른 설명을 좋아하는 옆자리.",
    "a117": "말보다 손 위치에 빛을 둔다.",
    "h-broadcast": "노련미를 말해 준 오 패널님.",
    "a22": "반전과 우주인 마술의 콤비.",
    "a23": "카드의 롤모델.",
    "a24": "입구를 지키다 발걸음을 멈춘 경비.",
    "a70": "로비 쇼를 보러 앉은 투숙객 에밀리.",
    "a71": "동경 무대 앞줄의 쇼 팬 소피아.",
    "a72": "셔터보다 표정을 보는 관광객.",
    "h8": "큰 무대의 마술사.",
    "a25": "하이노트 뒤에 앉은 뮤지컬 팬 제인.",
    "a26": "표보다 무대를 보게 된 관광객.",
    "a27": "막간에 평을 고치는 비평가.",
    "a76": "티켓보다 여운을 모으는 수집가.",
    "a77": "동작의 여운을 보는 발레 클로이.",
    "a78": "여운을 박자로 받는 팬.",
    "a79": "옷보다 손의 여백을 보는 디자이너.",
    "h9": "신기해서 분이 샌 객석 리사.",
    "a28": "해운대 돌계단에 모인 관객.",
    "a29": "돌계단 인파를 세는 담당.",
    "a30": "돌계단 아래를 지키는 운전 담당.",
    "a83": "돌계단 인파를 노트에 적는 사람.",
    "a84": "밤바다 불빛보다 손을 모으는 사람.",
    "a85": "돌계단 통로를 비우는 스태프.",
    "a86": "야경보다 손을 보는 구경꾼.",
    "h10": "도박에 안 당하는 법을 물은 손님.",
    "a31": "강한 햇살 아래서 모자를 잡는 사람.",
    "a32": "눈 시린 쪽에 그늘을 안내한다.",
    "a33": "눈부신 역광을 찍는 사진가.",
    "a90": "빛 세기를 중얼거리는 연구원.",
    "a91": "바람을 맞으며 자리를 찾는 여행객.",
    "a92": "필터 없이 빛을 보는 관측자.",
    "a93": "빛바람의 결을 타는 서퍼.",
    "a94": "캡을 붙잡고 역광을 찍는 사람.",
    "h11": "눈을 찡그리게 하는 빛과 바람.",
    "a34": "중국 마술샵의 손님.",
    "a35": "말 없이 손만 쫓는 파일럿.",
    "a36": "하나 둘 셋을 읽는 선생님.",
    "a98": "숫자 구호에 박자를 얹는 음악가.",
    "a99": "빨강과 검정을 한 장에 담는다.",
    "a100": "말 대신 손 방향으로 줄을 안내한다.",
    "a101": "하나 둘 셋에 속도를 맞추는 레이서.",
    "a102": "빨강과 검정 중 소원을 고른다.",
    "h12": "일본 노점 줄의 손님.",
    "a37": "농장 게임만 하는 다른 칼리.",
    "a38": "문 앞에서도 카드를 만지는 나.",
    "a39": "접어 둔 카드를 다시 꺼낸 나.",
    "a106": "먼저 한 걸음을 내디딘 나.",
    "a107": "객석에 앉아 박수를 준비하는 나.",
    "a108": "군대에서 잠시 쉬던 칼리. 쉬고 싶던 건 아니었다.",
    "a109": "이제 막 카드를 펼친 나.",
    "a110": "마술을 계속 건넨 칼리.",
    "a111": "의심 뒤에 박수를 보내는 나.",
    "h13": "의심이 많아도 자리를 지키는 나.",
    "a-lecturenote-hecate": "부장. 재고와 손 위치를 짧게 확인한다.",
    "a-lecturenote-serona": "모자를 벗으면 세로나. 샵 매니저이자 숨겨진 조력자.",
    "a-lecturenote-jung": "카운터와 포장을 맡은 직원.",
    "h-lecturenote-kim": "렉쳐노트 사장님. 칼리를 얻기 위해 계획했다.",
    "h-future-kali": "테이블에 처음 앉은 사람 앞에서 마술을 건넨다."
  },
  "secretSkills": {
    "tutorial": "눈 맞추기",
    "family": "첫 박수",
    "party": "앙코르 받기",
    "school": "눈 맞추기",
    "cafe": "먼저 다가가기",
    "meetup": "관객이 해낸 듯한 연출",
    "theater": "관객 고르기",
    "festival": "관객 에너지 받기",
    "audition": "즉흥 무대",
    "broadcast": "노련미",
    "vegas": "유쾌한 연출",
    "broadway": "이너 모놀로그",
    "moon": "즉흥 대처",
    "galaxy": "몸짓으로 말하기",
    "multiverse": "계속 건네는 마음",
    "lecturenote": "편안함",
    "future": "나눔",
    "youngKaliDuel": "자기 수용",
    "mirrorStage": "자기 수용",
    "subway": "다시 일어서기"
  },
  "dealerActs": [
    [
      {
        "speaker": "수상한 샵 매니저",
        "text": "어서 와요. 컵앤볼이에요.",
        "mood": "serious"
      },
      {
        "speaker": "수상한 샵 매니저",
        "text": "공은 마지막 컵에 있어요.",
        "mood": "serious"
      },
      {
        "speaker": "칼리",
        "text": "목소리가 참 차분하네요.",
        "mood": "serious"
      },
      {
        "speaker": "수상한 샵 매니저",
        "text": "카드 몬테도 한 판 가요.",
        "mood": "serious"
      },
      {
        "speaker": "수상한 샵 매니저",
        "text": "정답은 늘 손이 알아요.",
        "mood": "serious"
      },
      {
        "speaker": "카드1412",
        "text": "이 손버릇, 어디서 본 것 같당.",
        "mood": "serious"
      }
    ],
    [
      {
        "speaker": "수상한 샵 매니저",
        "text": "컵앤볼, 그리고 카드 몬테예요.",
        "mood": "serious"
      },
      {
        "speaker": "수상한 샵 매니저",
        "text": "눈은 맞추고, 손은 기억하게 두세요.",
        "mood": "serious"
      },
      {
        "speaker": "칼리",
        "text": "세로나님이 한 말인데요.",
        "mood": "serious"
      },
      {
        "speaker": "수상한 샵 매니저",
        "text": "비슷한 말이 많아요.",
        "mood": "serious"
      },
      {
        "speaker": "밍기리",
        "text": "목소리... 세로나... 비슷.",
        "mood": "serious"
      },
      {
        "speaker": "수상한 샵 매니저",
        "text": "모자는 아직 제 몫이에요.",
        "mood": "serious"
      }
    ],
    [
      {
        "speaker": "수상한 샵 매니저",
        "text": "컵앤볼은 오늘이 마지막이에요.",
        "mood": "serious"
      },
      {
        "speaker": "칼리",
        "text": "호흡이 세로나님과 같아요.",
        "mood": "serious"
      },
      {
        "speaker": "수상한 샵 매니저",
        "text": "들키기 직전이네요.",
        "mood": "serious"
      },
      {
        "speaker": "카드1412",
        "text": "거의 확실하당. 모자는 아직유.",
        "mood": "serious"
      },
      {
        "speaker": "수상한 샵 매니저",
        "text": "카드 몬테 정답은 나중에요.",
        "mood": "serious"
      },
      {
        "speaker": "수상한 샵 매니저",
        "text": "렉쳐노트에서 봐요.",
        "mood": "serious"
      }
    ]
  ],
  "fights": {
    "a1": {
      "heckles": [
        "오빠, 나한테 먼저 보여 줘.",
        "오빠, 나랑 눈 맞춰 봐.",
        "신기해! 한 번 더!",
        "오빠 최고. 또 해 줘."
      ],
      "winLine": "오빠 최고. 또 해 줘."
    },
    "a2": {
      "heckles": [
        "나도 볼래. 앞자리!",
        "다음엔 내 친구도 보여 줘!",
        "나도 볼래. 앞자리!",
        "다음엔 내 친구도 보여 줘!"
      ],
      "winLine": "다음엔 내 친구도 보여 줘!"
    },
    "a3": {
      "heckles": [
        "둘 다 앉았으니 시작해 보렴.",
        "집에서도 박수가 나오네.",
        "둘 다 앉았으니 시작해 보렴.",
        "집에서도 박수가 나오네."
      ],
      "winLine": "집에서도 박수가 나오네."
    },
    "h1": {
      "heckles": [
        "오빠, 나한테 먼저 보여 줘.",
        "오빠, 나랑 눈 맞춰 봐.",
        "신기해! 한 번 더!",
        "오빠 최고. 또 해 줘."
      ],
      "winLine": "오빠 최고. 또 해 줘."
    },
    "a4": {
      "heckles": [
        "풍선 다 불어 놨어!",
        "풍선은 안 터졌는데 우리가 터졌다!",
        "풍선 다 불어 놨어!",
        "풍선은 안 터졌는데 우리가 터졌다!"
      ],
      "winLine": "풍선은 안 터졌는데 우리가 터졌다!"
    },
    "a5": {
      "heckles": [
        "내 친구 생일이야. 마술 부탁해.",
        "오늘 분위기, 네가 가져갔어.",
        "내 친구 생일이야. 마술 부탁해.",
        "오늘 분위기, 네가 가져갔어."
      ],
      "winLine": "오늘 분위기, 네가 가져갔어."
    },
    "a6": {
      "heckles": [
        "내 친구 생일이야. 마술 부탁해.",
        "풍선 다 불어 놨어!",
        "우와, 분위기가 확 사네.",
        "한 번만 더 보여 줘!"
      ],
      "winLine": "오늘 분위기, 네가 가져갔어."
    },
    "h2": {
      "heckles": [
        "우와, 분위기가 확 사네.",
        "카드는 아무거나 고를게.",
        "내가 고른 그 이름이잖아.",
        "우와, 분위기가 확 사네."
      ],
      "winLine": "내가 고른 그 이름이잖아."
    },
    "a7": {
      "heckles": [
        "교실 마술, 소문이 다 났어.",
        "교실 마술, 소문이 다 났어.",
        "교실 마술, 소문이 다 났어.",
        "교실 마술, 소문이 다 났어."
      ],
      "winLine": "교실 마술, 소문이 다 났어."
    },
    "a8": {
      "heckles": [
        "학교가 축제 무대를 맡겼대.",
        "학교가 축제 무대를 맡겼대.",
        "학교가 축제 무대를 맡겼대.",
        "학교가 축제 무대를 맡겼대."
      ],
      "winLine": "학교가 축제 무대를 맡겼대."
    },
    "a9": {
      "heckles": [
        "다음은 동네 카페라고 적자.",
        "다음은 동네 카페라고 적자.",
        "다음은 동네 카페라고 적자.",
        "다음은 동네 카페라고 적자."
      ],
      "winLine": "다음은 동네 카페라고 적자."
    },
    "a46": {
      "heckles": [
        "운동장 앞줄은 내가 맡는다.",
        "운동장 앞줄은 내가 맡는다.",
        "운동장 앞줄은 내가 맡는다.",
        "운동장 앞줄은 내가 맡는다."
      ],
      "winLine": "운동장 앞줄은 내가 맡는다."
    },
    "h3": {
      "heckles": [
        "교실에서 보던 그거지?",
        "소문대로면 박수가 크겠다.",
        "축제에 세우길 잘했네요.",
        "교실에서 보던 그거지?"
      ],
      "winLine": "축제에 세우길 잘했네요."
    },
    "a10": {
      "heckles": [
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
      ],
      "winLine": "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
    },
    "a11": {
      "heckles": [
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
      ],
      "winLine": "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
    },
    "a12": {
      "heckles": [
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
      ],
      "winLine": "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
    },
    "a50": {
      "heckles": [
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
      ],
      "winLine": "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
    },
    "h4": {
      "heckles": [
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요",
        "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
      ],
      "winLine": "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
    },
    "a-meetup-busan": {
      "heckles": [
        "부산 에지야. 편하게 해.",
        "강의는 같이 하는 거야, 칼리야.",
        "심리랑 교육, 네 말로 해도 돼.",
        "부산 에지야. 편하게 해."
      ],
      "winLine": "심리랑 교육, 네 말로 해도 돼."
    },
    "a-meetup-daegu": {
      "heckles": [
        "서울에서 왔다. 칼리야, 앉아.",
        "창원 빨간 모자야. 반갑다.",
        "경북 구미 착한 천사야.",
        "인천 비타민이다. 잘 부탁해."
      ],
      "winLine": "심리랑 교육, 네 말로 해도 돼."
    },
    "a-meetup-changwon": {
      "heckles": [
        "창원 빨간 모자야. 반갑다.",
        "칼리야, 그래서 3만 원을 낸 거구나.",
        "창원 빨간 모자야. 반갑다.",
        "칼리야, 그래서 3만 원을 낸 거구나."
      ],
      "winLine": "칼리야, 그래서 3만 원을 낸 거구나."
    },
    "a-meetup-incheon": {
      "heckles": [
        "인천 비타민이다. 잘 부탁해.",
        "날아가는 비둘기도 스냅 한 번에 돌아오게 하는 마술사 비타민입니다",
        "인천 비타민이다. 잘 부탁해.",
        "날아가는 비둘기도 스냅 한 번에 돌아오게 하는 마술사 비타민입니다"
      ],
      "winLine": "날아가는 비둘기도 스냅 한 번에 돌아오게 하는 마술사 비타민입니다"
    },
    "a-meetup-geoje": {
      "heckles": [
        "서울에서 왔다. 칼리야, 앉아.",
        "창원 빨간 모자야. 반갑다.",
        "경북 구미 착한 천사야.",
        "인천 비타민이다. 잘 부탁해."
      ],
      "winLine": "심리랑 교육, 네 말로 해도 돼."
    },
    "a-meetup-cheonan": {
      "heckles": [
        "서울에서 왔다. 칼리야, 앉아.",
        "창원 빨간 모자야. 반갑다.",
        "경북 구미 착한 천사야.",
        "인천 비타민이다. 잘 부탁해."
      ],
      "winLine": "심리랑 교육, 네 말로 해도 돼."
    },
    "a-meetup-suwon": {
      "heckles": [
        "경북 구미 착한 천사야.",
        "끝나고 꼼장어집 가자, 칼리야.",
        "경북 구미 착한 천사야.",
        "끝나고 꼼장어집 가자, 칼리야."
      ],
      "winLine": "끝나고 꼼장어집 가자, 칼리야."
    },
    "h-meetup-seoul": {
      "heckles": [
        "서울에서 왔다. 칼리야, 앉아.",
        "나 마술 3일밖에 안 했어, 네가 다 한 거잖아",
        "칼리야, 소극장도 한 번 서 봐.",
        "서울에서 왔다. 칼리야, 앉아."
      ],
      "winLine": "칼리야, 소극장도 한 번 서 봐."
    },
    "a13": {
      "heckles": [
        "앞줄, 박수 준비됐어요!",
        "앞줄, 박수 준비됐어요!",
        "앞줄, 박수 준비됐어요!",
        "앞줄, 박수 준비됐어요!"
      ],
      "winLine": "앞줄, 박수 준비됐어요!"
    },
    "a14": {
      "heckles": [
        "제가요? 좋아요.",
        "골라 줘서 고마워요.",
        "제가요? 좋아요.",
        "골라 줘서 고마워요."
      ],
      "winLine": "골라 줘서 고마워요."
    },
    "a15": {
      "heckles": [
        "한국어 돼요. 보여 주세요.",
        "재밌네요. 한 번 더요.",
        "카드는 내가 가져갈게요.",
        "이게 뭔지 맞혀 봐요."
      ],
      "winLine": "더 연습하라"
    },
    "a54": {
      "heckles": [
        "앞줄, 박수 준비됐어요!",
        "저요, 저요, 저요.",
        "제가요? 좋아요.",
        "좋아. 나는 객석에 있을게."
      ],
      "winLine": "밥 먹고 다시 서자, 칼리야."
    },
    "a55": {
      "heckles": [
        "앞줄, 박수 준비됐어요!",
        "저요, 저요, 저요.",
        "제가요? 좋아요.",
        "좋아. 나는 객석에 있을게."
      ],
      "winLine": "밥 먹고 다시 서자, 칼리야."
    },
    "h5": {
      "heckles": [
        "인간... 실패... 크다!",
        "인간... 실패... 크다!",
        "아칸... 그 카드... 좋다.",
        "인간... 실패... 크다!"
      ],
      "winLine": "인간...마술....재밌다"
    },
    "a16": {
      "heckles": [
        "우와! 현실 CG인가..?",
        "이정도면 마술이 아니고",
        "마법 아니냐구요!!..",
        "눈으로 쫓을 수가 없어요!.."
      ],
      "winLine": "우와.. 이정도면 어느 마술대회에 나가도 상을 싹쓸이 쓸어올 것만 같은데요? 최곱니다!!"
    },
    "a17": {
      "heckles": [
        "저희도 마술 보여주세요",
        "멀리서 보다 달려왔어요!",
        "우와! 현실 CG인가..?",
        "이정도면 마술이 아니고"
      ],
      "winLine": "도박은 안 할게요."
    },
    "a18": {
      "heckles": [
        "저희도 마술 보여주세요",
        "멀리서 보다 달려왔어요!",
        "우와! 현실 CG인가..?",
        "이정도면 마술이 아니고"
      ],
      "winLine": "도박은 안 할게요."
    },
    "a59": {
      "heckles": [
        "저희도 마술 보여주세요",
        "멀리서 보다 달려왔어요!",
        "우와! 현실 CG인가..?",
        "이정도면 마술이 아니고"
      ],
      "winLine": "도박은 안 할게요."
    },
    "a60": {
      "heckles": [
        "저희도 마술 보여주세요",
        "멀리서 보다 달려왔어요!",
        "우와! 현실 CG인가..?",
        "이정도면 마술이 아니고"
      ],
      "winLine": "도박은 안 할게요."
    },
    "h6": {
      "heckles": [
        "저희도 마술 보여주세요",
        "멀리서 보다 달려왔어요!",
        "저희 쪽도 봐 주세요!",
        "일주일 내내 치킨이요?!"
      ],
      "winLine": "축제가 더 밝아졌어요!"
    },
    "a19": {
      "heckles": [
        "다음 참가자입니다, 칼리!",
        "다들 즉석인 거 알아요.",
        "다음 참가자입니다, 칼리!",
        "다들 즉석인 거 알아요."
      ],
      "winLine": "다들 즉석인 거 알아요."
    },
    "a20": {
      "heckles": [
        "다음 참가자입니다, 칼리!",
        "상황은 웃겨도, 무대는 볼게요.",
        "칼리님, 응원해요!",
        "다들 즉석인 거 알아요."
      ],
      "winLine": "우와.. 이정도면 어느 마술대회에 나가도 상을 싹쓸이 쓸어올 것만 같은데요? 최곱니다!!"
    },
    "a21": {
      "heckles": [
        "다음 참가자입니다, 칼리!",
        "상황은 웃겨도, 무대는 볼게요.",
        "칼리님, 응원해요!",
        "다들 즉석인 거 알아요."
      ],
      "winLine": "우와.. 이정도면 어느 마술대회에 나가도 상을 싹쓸이 쓸어올 것만 같은데요? 최곱니다!!"
    },
    "a64": {
      "heckles": [
        "다음 참가자입니다, 칼리!",
        "상황은 웃겨도, 무대는 볼게요.",
        "칼리님, 응원해요!",
        "다들 즉석인 거 알아요."
      ],
      "winLine": "우와.. 이정도면 어느 마술대회에 나가도 상을 싹쓸이 쓸어올 것만 같은데요? 최곱니다!!"
    },
    "a65": {
      "heckles": [
        "다음 참가자입니다, 칼리!",
        "상황은 웃겨도, 무대는 볼게요.",
        "칼리님, 응원해요!",
        "다들 즉석인 거 알아요."
      ],
      "winLine": "우와.. 이정도면 어느 마술대회에 나가도 상을 싹쓸이 쓸어올 것만 같은데요? 최곱니다!!"
    },
    "a66": {
      "heckles": [
        "다음 참가자입니다, 칼리!",
        "상황은 웃겨도, 무대는 볼게요.",
        "칼리님, 응원해요!",
        "다들 즉석인 거 알아요."
      ],
      "winLine": "우와.. 이정도면 어느 마술대회에 나가도 상을 싹쓸이 쓸어올 것만 같은데요? 최곱니다!!"
    },
    "h7": {
      "heckles": [
        "상황은 웃겨도, 무대는 볼게요.",
        "마지막 장면만 남았습니다.",
        "3등입니다. 축하해요.",
        "상황은 웃겨도, 무대는 볼게요."
      ],
      "winLine": "3등입니다. 축하해요."
    },
    "a112": {
      "heckles": [
        "오늘은 유튜브 방송이에요.",
        "준비되면 고개만 끄덕여요.",
        "오늘은 유튜브 방송이에요.",
        "준비되면 고개만 끄덕여요."
      ],
      "winLine": "준비되면 고개만 끄덕여요."
    },
    "a113": {
      "heckles": [
        "오늘은 유튜브 방송이에요.",
        "준비되면 고개만 끄덕여요.",
        "말이 너무 빠르다, 그 말 기억나요?",
        "역시 가르치는 사람은 뭔가 다르다"
      ],
      "winLine": "노련미, 예술 그 자체네요."
    },
    "a114": {
      "heckles": [
        "오늘은 유튜브 방송이에요.",
        "준비되면 고개만 끄덕여요.",
        "말이 너무 빠르다, 그 말 기억나요?",
        "역시 가르치는 사람은 뭔가 다르다"
      ],
      "winLine": "노련미, 예술 그 자체네요."
    },
    "a115": {
      "heckles": [
        "저도 따라가며 보고 있어요.",
        "저도 따라가며 보고 있어요.",
        "저도 따라가며 보고 있어요.",
        "저도 따라가며 보고 있어요."
      ],
      "winLine": "저도 따라가며 보고 있어요."
    },
    "a116": {
      "heckles": [
        "오늘은 유튜브 방송이에요.",
        "준비되면 고개만 끄덕여요.",
        "말이 너무 빠르다, 그 말 기억나요?",
        "역시 가르치는 사람은 뭔가 다르다"
      ],
      "winLine": "노련미, 예술 그 자체네요."
    },
    "a117": {
      "heckles": [
        "오늘은 유튜브 방송이에요.",
        "준비되면 고개만 끄덕여요.",
        "말이 너무 빠르다, 그 말 기억나요?",
        "역시 가르치는 사람은 뭔가 다르다"
      ],
      "winLine": "노련미, 예술 그 자체네요."
    },
    "h-broadcast": {
      "heckles": [
        "말이 너무 빠르다, 그 말 기억나요?",
        "역시 가르치는 사람은 뭔가 다르다",
        "노련미, 예술 그 자체네요.",
        "말이 너무 빠르다, 그 말 기억나요?"
      ],
      "winLine": "노련미, 예술 그 자체네요."
    },
    "a22": {
      "heckles": [
        "알려 주는 척, 그리고 반전.",
        "우주인도 웃게 만들어 봐.",
        "반전도 네 리듬이야.",
        "알려 주는 척, 그리고 반전."
      ],
      "winLine": "반전도 네 리듬이야."
    },
    "a23": {
      "heckles": [
        "앰비셔스는 다시 올라오는 법이지.",
        "카드 리벨레이션도 떠올려 봐.",
        "유쾌하면 충분해.",
        "앰비셔스는 다시 올라오는 법이지."
      ],
      "winLine": "유쾌하면 충분해."
    },
    "a24": {
      "heckles": [
        "상상은 관객이 완성하지.",
        "알려 주는 척, 그리고 반전.",
        "앰비셔스는 다시 올라오는 법이지.",
        "카드 리벨레이션도 떠올려 봐."
      ],
      "winLine": "유쾌하면 충분해."
    },
    "a70": {
      "heckles": [
        "상상은 관객이 완성하지.",
        "알려 주는 척, 그리고 반전.",
        "앰비셔스는 다시 올라오는 법이지.",
        "카드 리벨레이션도 떠올려 봐."
      ],
      "winLine": "유쾌하면 충분해."
    },
    "a71": {
      "heckles": [
        "상상은 관객이 완성하지.",
        "알려 주는 척, 그리고 반전.",
        "앰비셔스는 다시 올라오는 법이지.",
        "카드 리벨레이션도 떠올려 봐."
      ],
      "winLine": "유쾌하면 충분해."
    },
    "a72": {
      "heckles": [
        "상상은 관객이 완성하지.",
        "알려 주는 척, 그리고 반전.",
        "앰비셔스는 다시 올라오는 법이지.",
        "카드 리벨레이션도 떠올려 봐."
      ],
      "winLine": "유쾌하면 충분해."
    },
    "h8": {
      "heckles": [
        "상상은 관객이 완성하지.",
        "웃음이 쉴 틈도 남겨 둬.",
        "네 표정이 보이는구나.",
        "상상은 관객이 완성하지."
      ],
      "winLine": "네 표정이 보이는구나."
    },
    "a25": {
      "heckles": [
        "아, 너무 신기해서 분이 나!",
        "욕 대신 박수가 나오네요.",
        "그 마음이 여기까지 와요.",
        "아, 너무 신기해서 분이 나!"
      ],
      "winLine": "그 마음이 여기까지 와요."
    },
    "a26": {
      "heckles": [
        "아, 너무 신기해서 분이 나!",
        "욕 대신 박수가 나오네요.",
        "그 마음이 여기까지 와요.",
        "아, 너무 신기해서 분이 나!"
      ],
      "winLine": "그 마음이 여기까지 와요."
    },
    "a27": {
      "heckles": [
        "아, 너무 신기해서 분이 나!",
        "욕 대신 박수가 나오네요.",
        "그 마음이 여기까지 와요.",
        "아, 너무 신기해서 분이 나!"
      ],
      "winLine": "그 마음이 여기까지 와요."
    },
    "a76": {
      "heckles": [
        "아, 너무 신기해서 분이 나!",
        "욕 대신 박수가 나오네요.",
        "그 마음이 여기까지 와요.",
        "아, 너무 신기해서 분이 나!"
      ],
      "winLine": "그 마음이 여기까지 와요."
    },
    "a77": {
      "heckles": [
        "아, 너무 신기해서 분이 나!",
        "욕 대신 박수가 나오네요.",
        "그 마음이 여기까지 와요.",
        "아, 너무 신기해서 분이 나!"
      ],
      "winLine": "그 마음이 여기까지 와요."
    },
    "a78": {
      "heckles": [
        "아, 너무 신기해서 분이 나!",
        "욕 대신 박수가 나오네요.",
        "그 마음이 여기까지 와요.",
        "아, 너무 신기해서 분이 나!"
      ],
      "winLine": "그 마음이 여기까지 와요."
    },
    "a79": {
      "heckles": [
        "아, 너무 신기해서 분이 나!",
        "욕 대신 박수가 나오네요.",
        "그 마음이 여기까지 와요.",
        "아, 너무 신기해서 분이 나!"
      ],
      "winLine": "그 마음이 여기까지 와요."
    },
    "h9": {
      "heckles": [
        "아, 너무 신기해서 분이 나!",
        "욕 대신 박수가 나오네요.",
        "그 마음이 여기까지 와요.",
        "아, 너무 신기해서 분이 나!"
      ],
      "winLine": "그 마음이 여기까지 와요."
    },
    "a28": {
      "heckles": [
        "사람이 이렇게 모이다니.",
        "제 와이파이 이름이 바뀌었어요!",
        "끝까지 재밌었어요.",
        "사람이 이렇게 모이다니."
      ],
      "winLine": "끝까지 재밌었어요."
    },
    "a29": {
      "heckles": [
        "사람이 이렇게 모이다니.",
        "이 카드, 내 건 줄 알았네.",
        "제 와이파이 이름이 바뀌었어요!",
        "끝까지 재밌었어요."
      ],
      "winLine": "끝까지 재밌었어요."
    },
    "a30": {
      "heckles": [
        "사람이 이렇게 모이다니.",
        "이 카드, 내 건 줄 알았네.",
        "제 와이파이 이름이 바뀌었어요!",
        "끝까지 재밌었어요."
      ],
      "winLine": "끝까지 재밌었어요."
    },
    "a83": {
      "heckles": [
        "사람이 이렇게 모이다니.",
        "이 카드, 내 건 줄 알았네.",
        "제 와이파이 이름이 바뀌었어요!",
        "끝까지 재밌었어요."
      ],
      "winLine": "끝까지 재밌었어요."
    },
    "a84": {
      "heckles": [
        "사람이 이렇게 모이다니.",
        "이 카드, 내 건 줄 알았네.",
        "제 와이파이 이름이 바뀌었어요!",
        "끝까지 재밌었어요."
      ],
      "winLine": "끝까지 재밌었어요."
    },
    "a85": {
      "heckles": [
        "사람이 이렇게 모이다니.",
        "이 카드, 내 건 줄 알았네.",
        "제 와이파이 이름이 바뀌었어요!",
        "끝까지 재밌었어요."
      ],
      "winLine": "끝까지 재밌었어요."
    },
    "a86": {
      "heckles": [
        "사람이 이렇게 모이다니.",
        "이 카드, 내 건 줄 알았네.",
        "제 와이파이 이름이 바뀌었어요!",
        "끝까지 재밌었어요."
      ],
      "winLine": "끝까지 재밌었어요."
    },
    "h10": {
      "heckles": [
        "사람이 이렇게 모이다니.",
        "이 카드, 내 건 줄 알았네.",
        "제 와이파이 이름이 바뀌었어요!",
        "끝까지 재밌었어요."
      ],
      "winLine": "끝까지 재밌었어요."
    },
    "a31": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a32": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a33": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a90": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a91": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a92": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a93": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a94": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "h11": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a34": {
      "heckles": [
        "둘, 셋, 검정!",
        "빨강! 검정! 아!",
        "셋! 빨강!",
        "둘, 셋, 검정!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a35": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a36": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a98": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a99": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a100": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a101": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "a102": {
      "heckles": [
        "하나! 빨강!",
        "둘, 셋, 검정!",
        "하나! 둘! 빨강!",
        "빨강! 검정! 아!"
      ],
      "winLine": "셋! 빨강!"
    },
    "h12": {
      "heckles": [
        "하나! 빨강!",
        "하나! 둘! 빨강!",
        "하나, 둘, 셋!",
        "하나! 빨강!"
      ],
      "winLine": "하나, 둘, 셋!"
    },
    "a37": {
      "heckles": [
        "나는 농장 게임만 하는 칼리야.",
        "다른 취미도 나야.",
        "농장도 남겨 둬.",
        "나는 농장 게임만 하는 칼리야."
      ],
      "winLine": "농장도 남겨 둬."
    },
    "a38": {
      "heckles": [
        "나는 농장 게임만 하는 칼리야.",
        "나는 마술을 계속 건넸어.",
        "그만두고 싶었던 적은 없어.",
        "다른 취미도 나야."
      ],
      "winLine": "이제 렉쳐노트로 가."
    },
    "a39": {
      "heckles": [
        "나는 농장 게임만 하는 칼리야.",
        "나는 마술을 계속 건넸어.",
        "그만두고 싶었던 적은 없어.",
        "다른 취미도 나야."
      ],
      "winLine": "이제 렉쳐노트로 가."
    },
    "a106": {
      "heckles": [
        "나는 농장 게임만 하는 칼리야.",
        "나는 마술을 계속 건넸어.",
        "그만두고 싶었던 적은 없어.",
        "다른 취미도 나야."
      ],
      "winLine": "이제 렉쳐노트로 가."
    },
    "a107": {
      "heckles": [
        "나는 농장 게임만 하는 칼리야.",
        "나는 마술을 계속 건넸어.",
        "그만두고 싶었던 적은 없어.",
        "다른 취미도 나야."
      ],
      "winLine": "이제 렉쳐노트로 가."
    },
    "a108": {
      "heckles": [
        "나는 농장 게임만 하는 칼리야.",
        "나는 마술을 계속 건넸어.",
        "그만두고 싶었던 적은 없어.",
        "다른 취미도 나야."
      ],
      "winLine": "이제 렉쳐노트로 가."
    },
    "a109": {
      "heckles": [
        "나는 농장 게임만 하는 칼리야.",
        "나는 마술을 계속 건넸어.",
        "그만두고 싶었던 적은 없어.",
        "다른 취미도 나야."
      ],
      "winLine": "이제 렉쳐노트로 가."
    },
    "a110": {
      "heckles": [
        "나는 마술을 계속 건넸어.",
        "그만두고 싶었던 적은 없어.",
        "다시 건네고 싶은 마음.",
        "이제 렉쳐노트로 가."
      ],
      "winLine": "이제 렉쳐노트로 가."
    },
    "a111": {
      "heckles": [
        "나는 농장 게임만 하는 칼리야.",
        "나는 마술을 계속 건넸어.",
        "그만두고 싶었던 적은 없어.",
        "다른 취미도 나야."
      ],
      "winLine": "이제 렉쳐노트로 가."
    },
    "h13": {
      "heckles": [
        "나는 농장 게임만 하는 칼리야.",
        "나는 마술을 계속 건넸어.",
        "그만두고 싶었던 적은 없어.",
        "다른 취미도 나야."
      ],
      "winLine": "이제 렉쳐노트로 가."
    },
    "a-lecturenote-hecate": {
      "heckles": [
        "판매 전에 마술 한 번, 반응 좋았음.",
        "매니저가 된 뒤에 말했지.",
        "사실 널 얻기 위해 다 계획했던 거다",
        "마지막 컵앤볼이에요."
      ],
      "winLine": "카운터는 우리가 볼게."
    },
    "a-lecturenote-serona": {
      "heckles": [
        "세로나예요. 샵 매니저도 저고요.",
        "숨겨진 조력자로 있었어요.",
        "카드 몬테의 손도 제 거였어요.",
        "서재 테이블로 가요."
      ],
      "winLine": "카드 몬테의 손도 제 거였어요."
    },
    "a-lecturenote-jung": {
      "heckles": [
        "판매 전에 마술 한 번, 반응 좋았음.",
        "카운터는 우리가 볼게.",
        "판매 전에 마술 한 번, 반응 좋았음.",
        "카운터는 우리가 볼게."
      ],
      "winLine": "카운터는 우리가 볼게."
    },
    "h-lecturenote-kim": {
      "heckles": [
        "매니저가 된 뒤에 말했지.",
        "사실 널 얻기 위해 다 계획했던 거다",
        "고개 돌렸더니 카드가 있더라.",
        "매니저가 된 뒤에 말했지."
      ],
      "winLine": "고개 돌렸더니 카드가 있더라."
    },
    "h-future-kali": {
      "heckles": [
        "처음이라 손이 떨려요.",
        "제 카드가 여기 있어요!",
        "고른 카드 이름으로요?",
        "마술이 이렇게 다정하네요."
      ],
      "winLine": "마술이 이렇게 다정하네요."
    }
  },
  "cheers": {
    "family": {
      "title": "가족 거실의 박수",
      "lines": [
        {
          "id": "a1",
          "text": "오빠 최고. 또 해 줘."
        },
        {
          "id": "a2",
          "text": "다음엔 내 친구도 보여 줘!"
        },
        {
          "id": "a3",
          "text": "집에서도 박수가 나오네."
        },
        {
          "id": "h1",
          "text": "오빠 최고. 또 해 줘."
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「첫 박수」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "첫 박수"
      }
    },
    "party": {
      "title": "친구 파티의 박수",
      "lines": [
        {
          "id": "a4",
          "text": "풍선은 안 터졌는데 우리가 터졌다!"
        },
        {
          "id": "a5",
          "text": "오늘 분위기, 네가 가져갔어."
        },
        {
          "id": "a6",
          "text": "오늘 분위기, 네가 가져갔어."
        },
        {
          "id": "h2",
          "text": "내가 고른 그 이름이잖아."
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「앙코르 받기」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "앙코르 받기"
      }
    },
    "school": {
      "title": "학교 축제의 박수",
      "lines": [
        {
          "id": "a7",
          "text": "교실 마술, 소문이 다 났어."
        },
        {
          "id": "a8",
          "text": "학교가 축제 무대를 맡겼대."
        },
        {
          "id": "a9",
          "text": "다음은 동네 카페라고 적자."
        },
        {
          "id": "a46",
          "text": "운동장 앞줄은 내가 맡는다."
        },
        {
          "id": "h3",
          "text": "축제에 세우길 잘했네요."
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「눈 맞추기」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "눈 맞추기"
      }
    },
    "cafe": {
      "title": "동네 카페의 박수",
      "lines": [
        {
          "id": "a10",
          "text": "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
        },
        {
          "id": "a11",
          "text": "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
        },
        {
          "id": "a12",
          "text": "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
        },
        {
          "id": "a50",
          "text": "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
        },
        {
          "id": "h4",
          "text": "TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요"
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「먼저 다가가기」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "먼저 다가가기"
      }
    },
    "meetup": {
      "title": "전국 마술 매니아의 박수",
      "lines": [
        {
          "id": "a-meetup-busan",
          "text": "심리랑 교육, 네 말로 해도 돼."
        },
        {
          "id": "a-meetup-daegu",
          "text": "심리랑 교육, 네 말로 해도 돼."
        },
        {
          "id": "a-meetup-changwon",
          "text": "칼리야, 그래서 3만 원을 낸 거구나."
        },
        {
          "id": "a-meetup-incheon",
          "text": "날아가는 비둘기도 스냅 한 번에 돌아오게 하는 마술사 비타민입니다"
        },
        {
          "id": "a-meetup-geoje",
          "text": "심리랑 교육, 네 말로 해도 돼."
        },
        {
          "id": "a-meetup-cheonan",
          "text": "심리랑 교육, 네 말로 해도 돼."
        },
        {
          "id": "a-meetup-suwon",
          "text": "끝나고 꼼장어집 가자, 칼리야."
        },
        {
          "id": "h-meetup-seoul",
          "text": "칼리야, 소극장도 한 번 서 봐."
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「관객이 해낸 듯한 연출」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "관객이 해낸 듯한 연출"
      }
    },
    "theater": {
      "title": "소극장의 박수",
      "lines": [
        {
          "id": "a13",
          "text": "앞줄, 박수 준비됐어요!"
        },
        {
          "id": "a14",
          "text": "골라 줘서 고마워요."
        },
        {
          "id": "a15",
          "text": "더 연습하라"
        },
        {
          "id": "a54",
          "text": "밥 먹고 다시 서자, 칼리야."
        },
        {
          "id": "a55",
          "text": "밥 먹고 다시 서자, 칼리야."
        },
        {
          "id": "h5",
          "text": "인간...마술....재밌다"
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「다시 일어서기」를 배웠어요.",
        "mood": "serious",
        "secretSkill": "다시 일어서기"
      }
    },
    "festival": {
      "title": "대학 축제의 박수",
      "lines": [
        {
          "id": "a16",
          "text": "우와.. 이정도면 어느 마술대회에 나가도 상을 싹쓸이 쓸어올 것만 같은데요? 최곱니다!!"
        },
        {
          "id": "a17",
          "text": "도박은 안 할게요."
        },
        {
          "id": "a18",
          "text": "도박은 안 할게요."
        },
        {
          "id": "a59",
          "text": "도박은 안 할게요."
        },
        {
          "id": "a60",
          "text": "도박은 안 할게요."
        },
        {
          "id": "h6",
          "text": "축제가 더 밝아졌어요!"
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「관객 에너지 받기」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "관객 에너지 받기"
      }
    },
    "audition": {
      "title": "TV 오디션의 박수",
      "lines": [
        {
          "id": "a19",
          "text": "다들 즉석인 거 알아요."
        },
        {
          "id": "a20",
          "text": "우와.. 이정도면 어느 마술대회에 나가도 상을 싹쓸이 쓸어올 것만 같은데요? 최곱니다!!"
        },
        {
          "id": "a21",
          "text": "우와.. 이정도면 어느 마술대회에 나가도 상을 싹쓸이 쓸어올 것만 같은데요? 최곱니다!!"
        },
        {
          "id": "a64",
          "text": "우와.. 이정도면 어느 마술대회에 나가도 상을 싹쓸이 쓸어올 것만 같은데요? 최곱니다!!"
        },
        {
          "id": "a65",
          "text": "우와.. 이정도면 어느 마술대회에 나가도 상을 싹쓸이 쓸어올 것만 같은데요? 최곱니다!!"
        },
        {
          "id": "a66",
          "text": "우와.. 이정도면 어느 마술대회에 나가도 상을 싹쓸이 쓸어올 것만 같은데요? 최곱니다!!"
        },
        {
          "id": "h7",
          "text": "3등입니다. 축하해요."
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「즉흥 무대」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "즉흥 무대"
      }
    },
    "broadcast": {
      "title": "TV 방송의 박수",
      "lines": [
        {
          "id": "a112",
          "text": "준비되면 고개만 끄덕여요."
        },
        {
          "id": "a113",
          "text": "노련미, 예술 그 자체네요."
        },
        {
          "id": "a114",
          "text": "노련미, 예술 그 자체네요."
        },
        {
          "id": "a115",
          "text": "저도 따라가며 보고 있어요."
        },
        {
          "id": "a116",
          "text": "노련미, 예술 그 자체네요."
        },
        {
          "id": "a117",
          "text": "노련미, 예술 그 자체네요."
        },
        {
          "id": "h-broadcast",
          "text": "노련미, 예술 그 자체네요."
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「노련미」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "노련미"
      }
    },
    "vegas": {
      "title": "라스베가스의 박수",
      "lines": [
        {
          "id": "a22",
          "text": "반전도 네 리듬이야."
        },
        {
          "id": "a23",
          "text": "유쾌하면 충분해."
        },
        {
          "id": "a24",
          "text": "유쾌하면 충분해."
        },
        {
          "id": "a70",
          "text": "유쾌하면 충분해."
        },
        {
          "id": "a71",
          "text": "유쾌하면 충분해."
        },
        {
          "id": "a72",
          "text": "유쾌하면 충분해."
        },
        {
          "id": "h8",
          "text": "네 표정이 보이는구나."
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「유쾌한 연출」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "유쾌한 연출"
      }
    },
    "broadway": {
      "title": "브로드웨이의 박수",
      "lines": [
        {
          "id": "a25",
          "text": "그 마음이 여기까지 와요."
        },
        {
          "id": "a26",
          "text": "그 마음이 여기까지 와요."
        },
        {
          "id": "a27",
          "text": "그 마음이 여기까지 와요."
        },
        {
          "id": "a76",
          "text": "그 마음이 여기까지 와요."
        },
        {
          "id": "a77",
          "text": "그 마음이 여기까지 와요."
        },
        {
          "id": "a78",
          "text": "그 마음이 여기까지 와요."
        },
        {
          "id": "a79",
          "text": "그 마음이 여기까지 와요."
        },
        {
          "id": "h9",
          "text": "그 마음이 여기까지 와요."
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「이너 모놀로그」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "이너 모놀로그"
      }
    },
    "moon": {
      "title": "달의 박수",
      "lines": [
        {
          "id": "a28",
          "text": "끝까지 재밌었어요."
        },
        {
          "id": "a29",
          "text": "끝까지 재밌었어요."
        },
        {
          "id": "a30",
          "text": "끝까지 재밌었어요."
        },
        {
          "id": "a83",
          "text": "끝까지 재밌었어요."
        },
        {
          "id": "a84",
          "text": "끝까지 재밌었어요."
        },
        {
          "id": "a85",
          "text": "끝까지 재밌었어요."
        },
        {
          "id": "a86",
          "text": "끝까지 재밌었어요."
        },
        {
          "id": "h10",
          "text": "끝까지 재밌었어요."
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「즉흥 대처」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "즉흥 대처"
      }
    },
    "sun": {
      "title": "태양의 박수",
      "lines": [
        {
          "id": "a31",
          "text": "셋! 빨강!"
        },
        {
          "id": "a32",
          "text": "셋! 빨강!"
        },
        {
          "id": "a33",
          "text": "셋! 빨강!"
        },
        {
          "id": "a90",
          "text": "셋! 빨강!"
        },
        {
          "id": "a91",
          "text": "셋! 빨강!"
        },
        {
          "id": "a92",
          "text": "셋! 빨강!"
        },
        {
          "id": "a93",
          "text": "셋! 빨강!"
        },
        {
          "id": "a94",
          "text": "셋! 빨강!"
        },
        {
          "id": "h11",
          "text": "셋! 빨강!"
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「몸짓으로 말하기」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "몸짓으로 말하기"
      }
    },
    "galaxy": {
      "title": "은하의 박수",
      "lines": [
        {
          "id": "a34",
          "text": "셋! 빨강!"
        },
        {
          "id": "a35",
          "text": "셋! 빨강!"
        },
        {
          "id": "a36",
          "text": "셋! 빨강!"
        },
        {
          "id": "a98",
          "text": "셋! 빨강!"
        },
        {
          "id": "a99",
          "text": "셋! 빨강!"
        },
        {
          "id": "a100",
          "text": "셋! 빨강!"
        },
        {
          "id": "a101",
          "text": "셋! 빨강!"
        },
        {
          "id": "a102",
          "text": "셋! 빨강!"
        },
        {
          "id": "h12",
          "text": "하나, 둘, 셋!"
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「몸짓으로 말하기」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "몸짓으로 말하기"
      }
    },
    "multiverse": {
      "title": "멀티버스의 박수",
      "lines": [
        {
          "id": "a37",
          "text": "농장도 남겨 둬."
        },
        {
          "id": "a38",
          "text": "이제 렉쳐노트로 가."
        },
        {
          "id": "a39",
          "text": "이제 렉쳐노트로 가."
        },
        {
          "id": "a106",
          "text": "이제 렉쳐노트로 가."
        },
        {
          "id": "a107",
          "text": "이제 렉쳐노트로 가."
        },
        {
          "id": "a108",
          "text": "이제 렉쳐노트로 가."
        },
        {
          "id": "a109",
          "text": "이제 렉쳐노트로 가."
        },
        {
          "id": "a110",
          "text": "이제 렉쳐노트로 가."
        },
        {
          "id": "a111",
          "text": "이제 렉쳐노트로 가."
        },
        {
          "id": "h13",
          "text": "이제 렉쳐노트로 가."
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「계속 건네는 마음」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "계속 건네는 마음"
      }
    },
    "lecturenote": {
      "title": "렉쳐노트의 박수",
      "lines": [
        {
          "id": "a-lecturenote-hecate",
          "text": "카운터는 우리가 볼게."
        },
        {
          "id": "a-lecturenote-serona",
          "text": "카드 몬테의 손도 제 거였어요."
        },
        {
          "id": "a-lecturenote-jung",
          "text": "카운터는 우리가 볼게."
        },
        {
          "id": "h-lecturenote-kim",
          "text": "고개 돌렸더니 카드가 있더라."
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「편안함」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "편안함"
      }
    },
    "future": {
      "title": "서재 앞 큰 테이블의 박수",
      "lines": [
        {
          "id": "h-future-kali",
          "text": "마술이 이렇게 다정하네요."
        }
      ],
      "closing": {
        "speaker": "칼리",
        "text": "비법 「나눔」을 배웠어요.",
        "mood": "happy",
        "secretSkill": "나눔"
      }
    }
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
  "spawn": "빈 자리에 새 케이스를 더 빨리 세팅해요\n준비 시간 7%씩 줄기",
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
  "starTrick": "케이스를 더 빨리 열고 관객을 더 빨리 감탄시켜요\n실력 1.14배 · 연출 1.3배씩",
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
  "crystal": "수정구가 야유를 막아줘요\n8초마다 멘탈의 3% 자신감",
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
 D.items.types.forEach(t=>t.ladder.forEach(p=>{const effect=p.effect||t.effect;const values={damage:'기본 힘 8 × 연출 · 좋은 소품은 최대 25배',shield:'기본 자신감 2.7 × 멘탈 · 최대 25배',heal:'기본 회복 1.8 × 멘탈 · 최대 25배',coins:'기본 동전 8개 · 좋은 소품은 최대 25배',xpBurst:'다음 레벨 경험치의 50%',finisher:'피날레 5칸 채우기',boxFill:'모든 케이스를 30% 더 열기'};p.desc=copy[effect]+'\n'+values[effect];}));
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
 {type:'noDamage',value:0,label:'하트 하나도 잃지 않고 관객 감탄시키기'},
 {type:'timeLimit',value:90,label:'90초 안에 관객 감탄시키기'},
 {type:'combo',value:25,label:'25액트를 만든 뒤 관객 감탄시키기'}
];
GAME_DATA.cosmetics={
 kali:[
  {id:'wave',name:'푸른 파도',cost:8,emoji:'🌊'},
  {id:'flame',name:'불꽃 고리',cost:12,emoji:'🔥'},
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
 const future={id:'h-future-kali',name:'미래의 칼리',emoji:'🪞',portraitAsset:'aud-future-kali.png',winLine:'마술이 이렇게 다정하네요.',flavor:'서재 앞 큰 테이블에서 처음 보는 사람에게 건넨다.',bio:'테이블에 처음 앉은 사람 앞에서 마술을 건넨다.',heckles:['처음이라 손이 떨려요.','제 카드가 여기 있어요!','고른 카드 이름으로요?','마술이 이렇게 다정하네요.'],pattern:'futureMirror',bossProfile:'future',preLine:'어서 와요. 편히 앉으세요.',defeatLine:'소개 페이지도 열어 두었어요.'};
 D.venues.push({id:17,slug:'future',balanceRank:13,hpFactor:1,name:'서재 앞 큰 테이블',crowd:1,crowdEmoji:'👏',venueAsset:'venue-17-library-table.png',crowdAsset:'',palette:{bg1:'#342334',bg2:'#72553b',accent:'#ffe4a0'},audiences:[],headliner:future,intro:'테이블에 처음 앉은 사람이 기다린다.',successLine:'마술이 이렇게 다정하네요.',trophy:'미래의 나'});
 D.ui.patterns.futureMirror='거울 · 내 도구로 나를 넘어서는 공연';
 D.futureEnding=D.storyReview.ending;
 // Lines only. Chat-room and intro buttons are not wired this round. Serona's button line stays here so it is not shown as already on.
 D.futureInvite={buttonsLater:true,lines:[{speaker:'칼리',text:'마술 톡방에서 또 만나요.'},{speaker:'칼리',text:'소개 페이지도 열어 두었어요.'},{speaker:'세로나',text:'버튼 두 개, 지금 켜졌어요.'}]};
 D.cosmetics.kali.push({id:'future',name:'미래의 나',cost:0,milestone:'future',hint:'큰 테이블의 공연 완료',emoji:'🪞'});
 const past=D.venues.find(v=>v.slug==='multiverse').audiences.find(a=>a.id==='a108');
 Object.assign(past,{name:'잠시 쉰 나',portraitAsset:'aud-past-kali.png',bio:'군대에서 잠시 쉬던 칼리. 쉬고 싶던 건 아니었다.',flavor:'쉰 것은 포기가 아니다.'});
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
GAME_DATA.venues.find(v=>v.slug==='galaxy').hpFactor*=1.41;
// U19b pacing: trade repeated-run time for shorter regular doubt bars.
(function(D){const scale={meetup:.30,audition:.60,broadcast:.52,moon:.70,sun:.60,galaxy:.30,multiverse:.44,lecturenote:.40};D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor*=scale[v.slug];});D.venues.find(v=>v.slug==='lecturenote').bossHpFactor*=3.25;})(GAME_DATA);

// U25: checked-in role and per-line mood data from lines-v19b.
GAME_DATA.lineFaces={"roles":{"a1":{"role":"family","name":"여동생","venue":"family"},"a2":{"role":"family","name":"남동생","venue":"family"},"a3":{"role":"family","name":"엄마","venue":"family"},"h1":{"role":"family","name":"할머니","venue":"family"},"a4":{"role":"supporter","name":"풍선 담당 지호","venue":"party"},"a5":{"role":"supporter","name":"운동 친구 서윤","venue":"party"},"a6":{"role":"supporter","name":"케이크 민재","venue":"party"},"h2":{"role":"skeptic","name":"생일 하준이","venue":"party"},"a7":{"role":"supporter","name":"짝꿍 수빈","venue":"school"},"a8":{"role":"supporter","name":"반장 도윤","venue":"school"},"a9":{"role":"critic","name":"깐깐 선배 정아","venue":"school"},"a46":{"role":"skeptic","name":"체육부 승민","venue":"school"},"h3":{"role":"critic","name":"박 선생님","venue":"school"},"a10":{"role":"skeptic","name":"노트북 지안","venue":"cafe"},"a11":{"role":"skeptic","name":"디저트 은서","venue":"cafe"},"a12":{"role":"critic","name":"창가 지민","venue":"cafe"},"a50":{"role":"supporter","name":"바리스타 소영","venue":"cafe"},"h4":{"role":"skeptic","name":"카페 단골 현우","venue":"cafe"},"a-meetup-busan":{"role":"supporter","name":"에지","venue":"meetup"},"a-meetup-daegu":{"role":"critic","name":"재현 형","venue":"meetup"},"a-meetup-changwon":{"role":"critic","name":"빨간 모자","venue":"meetup"},"a-meetup-incheon":{"role":"supporter","name":"비타민","venue":"meetup"},"a-meetup-geoje":{"role":"supporter","name":"책가방 민호","venue":"meetup"},"a-meetup-cheonan":{"role":"supporter","name":"진수 씨","venue":"meetup"},"a-meetup-suwon":{"role":"critic","name":"착한 천사","venue":"meetup"},"h-meetup-seoul":{"role":"supporter","name":"마술삼일","venue":"meetup"},"a13":{"role":"supporter","name":"열성팬 보람","venue":"theater"},"a14":{"role":"critic","name":"앞줄 영숙 씨","venue":"theater"},"a15":{"role":"skeptic","name":"지하철 하린","venue":"theater"},"a54":{"role":"critic","name":"대본 작가 서연","venue":"theater"},"a55":{"role":"supporter","name":"커튼콜 팬 유나","venue":"theater"},"h5":{"role":"critic","name":"강 마술사님","venue":"theater"},"a16":{"role":"supporter","name":"칼리 열혈팬 1223호","venue":"festival"},"a17":{"role":"family","name":"치킨 동혁","venue":"festival"},"a18":{"role":"supporter","name":"후배 지우","venue":"festival"},"a59":{"role":"skeptic","name":"밴드 팬 서진","venue":"festival"},"a60":{"role":"supporter","name":"야광봉 팬 하은","venue":"festival"},"h6":{"role":"skeptic","name":"달려온 승우","venue":"festival"},"a19":{"role":"helper","name":"진행자 태훈","venue":"audition"},"a20":{"role":"helper","name":"카메라 석진","venue":"audition"},"a21":{"role":"skeptic","name":"라이벌 유찬","venue":"audition"},"a64":{"role":"critic","name":"초대 작가 다인","venue":"audition"},"a65":{"role":"critic","name":"본방 사수 민규","venue":"audition"},"a66":{"role":"supporter","name":"방청객 소희","venue":"audition"},"h7":{"role":"critic","name":"심사위원 윤 씨","venue":"audition"},"a112":{"role":"helper","name":"방송 PD 승기","venue":"broadcast"},"a113":{"role":"helper","name":"방송 작가 가은","venue":"broadcast"},"a114":{"role":"helper","name":"음향 감독 도현","venue":"broadcast"},"a115":{"role":"supporter","name":"응원단장 나리","venue":"broadcast"},"a116":{"role":"supporter","name":"열정 패널 규리","venue":"broadcast"},"a117":{"role":"helper","name":"조명 감독 태산","venue":"broadcast"},"h-broadcast":{"role":"critic","name":"오 패널님","venue":"broadcast"},"a22":{"role":"skeptic","name":"펜 앤 텔로","venue":"vegas"},"a23":{"role":"skeptic","name":"데릴","venue":"vegas"},"a24":{"role":"critic","name":"경비 대니 씨","venue":"vegas"},"a70":{"role":"skeptic","name":"투숙객 에밀리","venue":"vegas"},"a71":{"role":"supporter","name":"쇼 팬 소피아","venue":"vegas"},"a72":{"role":"skeptic","name":"관광객 마크","venue":"vegas"},"h8":{"role":"critic","name":"데이비드 카퍼필","venue":"vegas"},"a25":{"role":"supporter","name":"뮤지컬 팬 제인","venue":"broadway"},"a26":{"role":"skeptic","name":"뉴욕 관광객 톰","venue":"broadway"},"a27":{"role":"critic","name":"평론가 한 씨","venue":"broadway"},"a76":{"role":"critic","name":"티켓 수집가 벤","venue":"broadway"},"a77":{"role":"critic","name":"발레 클로이","venue":"broadway"},"a78":{"role":"supporter","name":"오케스트라 헨리","venue":"broadway"},"a79":{"role":"critic","name":"디자이너 미아","venue":"broadway"},"h9":{"role":"skeptic","name":"객석 리사","venue":"broadway"},"a28":{"role":"skeptic","name":"돌계단 수호","venue":"moon"},"a29":{"role":"helper","name":"무전 담당 보라","venue":"moon"},"a30":{"role":"helper","name":"탐사차 기사님","venue":"moon"},"a83":{"role":"critic","name":"윤 박사님","venue":"moon"},"a84":{"role":"critic","name":"수집가 로이","venue":"moon"},"a85":{"role":"helper","name":"정비 담당 대철","venue":"moon"},"a86":{"role":"skeptic","name":"관광객 하나","venue":"moon"},"h10":{"role":"critic","name":"목욕탕 아저씨","venue":"moon"},"a31":{"role":"skeptic","name":"서퍼 한울","venue":"sun"},"a32":{"role":"helper","name":"태양 가이드 솔","venue":"sun"},"a33":{"role":"supporter","name":"사진가 도하","venue":"sun"},"a90":{"role":"critic","name":"연구원 시우","venue":"sun"},"a91":{"role":"skeptic","name":"여행객 해리","venue":"sun"},"a92":{"role":"critic","name":"관측자 이든","venue":"sun"},"a93":{"role":"skeptic","name":"파도 서퍼 하람","venue":"sun"},"a94":{"role":"skeptic","name":"사진작가 모아","venue":"sun"},"h11":{"role":"skeptic","name":"햇살 해나","venue":"sun"},"a34":{"role":"skeptic","name":"샵 손님 하늘","venue":"galaxy"},"a35":{"role":"skeptic","name":"파일럿 우진","venue":"galaxy"},"a36":{"role":"helper","name":"별자리 선생님","venue":"galaxy"},"a98":{"role":"critic","name":"음악가 세영","venue":"galaxy"},"a99":{"role":"critic","name":"사진가 지후","venue":"galaxy"},"a100":{"role":"helper","name":"안내원 다솜","venue":"galaxy"},"a101":{"role":"skeptic","name":"레이서 건우","venue":"galaxy"},"a102":{"role":"supporter","name":"여행자 수아","venue":"galaxy"},"h12":{"role":"skeptic","name":"타코야키 가온","venue":"galaxy"},"a37":{"role":"skeptic","name":"농장 게임만 하는 칼리","venue":"multiverse"},"a38":{"role":"skeptic","name":"연습실 앞의 나","venue":"multiverse"},"a39":{"role":"skeptic","name":"카드 접은 나","venue":"multiverse"},"a106":{"role":"supporter","name":"용기 낸 나","venue":"multiverse"},"a107":{"role":"supporter","name":"객석의 나","venue":"multiverse"},"a108":{"role":"skeptic","name":"잠시 쉰 나","venue":"multiverse"},"a109":{"role":"supporter","name":"막 시작한 나","venue":"multiverse"},"a110":{"role":"helper","name":"계속한 칼리","venue":"multiverse"},"a111":{"role":"supporter","name":"박수 보내는 나","venue":"multiverse"},"h13":{"role":"skeptic","name":"의심 많은 나","venue":"multiverse"},"a-lecturenote-hecate":{"role":"helper","name":"헤카테","venue":"lecturenote"},"a-lecturenote-serona":{"role":"helper","name":"세로나","venue":"lecturenote"},"a-lecturenote-jung":{"role":"helper","name":"정희수","venue":"lecturenote"},"h-lecturenote-kim":{"role":"family","name":"김정명","venue":"lecturenote"},"h-future-kali":{"role":"supporter","name":"미래의 칼리","venue":"future"}},"lines":{"a4":{"name":"풍선 담당 지호","role":"supporter","heckles":["풍선 다 불어 놨어!","풍선은 아직 안 터져.","한 번 더, 풍선은 두고!","우리가 더 크게 갈게!"],"winLine":"풍선은 안 터졌는데 우리가 터졌다!"},"a5":{"name":"운동 친구 서윤","role":"supporter","heckles":["내 친구 생일이야.","마술 부탁해, 칼리.","오늘 분위기 살려 줘.","운동하다 알게 된 사이야."],"winLine":"오늘 분위기, 네가 가져갔어."},"a6":{"name":"케이크 민재","role":"supporter","heckles":["초는 마술 끝나고 끄자.","2 하트, 케이크에 올릴까.","이름 맞히면 내가 자른다.","크림보다 이 손이 달다."],"winLine":"초보다 먼저 박수다!"},"a7":{"name":"짝꿍 수빈","role":"supporter","heckles":["교실 때보다 더 커 보여.","짝꿍 자리, 여기로 옮길게.","그림 마리 수, 또 변해?","축제라 심장이 먼저 뛴다."],"winLine":"교실 소문, 진짜였어!"},"a8":{"name":"반장 도윤","role":"supporter","heckles":["학교가 우리 반을 불렀대.","응원봉은 마지막에 켤게.","소문 낸 건 나 맞다.","운동장에서도 잘 보여."],"winLine":"응원봉, 지금 켠다!"},"a50":{"name":"바리스타 소영","role":"supporter","heckles":["커피는 식기 전에요.","손님들 시선이 모였어요.","손 잘 보이게 서요.","한 잔은 서비스예요."],"winLine":"오늘 손이 빛났네요."},"a-meetup-busan":{"name":"에지","role":"supporter","heckles":["부산 에지야. 편하게 해.","강의는 같이 하는 거야.","심리 마술, 네 말로 해.","칼리야, 긴장 풀어."],"winLine":"심리랑 교육, 네 말로 해도 돼."},"a-meetup-incheon":{"name":"비타민","role":"supporter","heckles":["인천 비타민이다.","잘 부탁해, 칼리야.","정갈하게 한 번에 가자.","소재는 다양하게 가자."],"winLine":"날아가는 비둘기도 스냅 한 번에 돌아오게 하는 마술사 비타민입니다"},"a-meetup-geoje":{"name":"책가방 민호","role":"supporter","heckles":["바닷바람 말고 손을 보러 왔어요.","초보는 눈부터죠?","입문 순서는 나중에 물을게요.","자리만 있으면 충분해요."],"winLine":"먼 길, 아깝지 않아요."},"a-meetup-cheonan":{"name":"진수 씨","role":"supporter","heckles":["간식은 공연 뒤에 열어요.","기차는 다음 걸로 바꿀게요.","하나만 더, 진짜 마지막요.","봉지는 접어 두고 볼게요."],"winLine":"간식보다 손이 남네요."},"h-meetup-seoul":{"name":"마술삼일","role":"supporter","heckles":["서울에서 왔다, 칼리야.","앉아. 편하게 해.","관객이 해낸 듯 가자.","마지막은 즐겁게 봐."],"winLine":"칼리야, 소극장도 한 번 서 봐."},"a13":{"name":"열성팬 보람","role":"supporter","heckles":["앞줄, 박수 준비됐어요!","실수해도 박수 칠게요!","더 크게 해도 돼요!","앞줄에서 다 보고 있어요!"],"winLine":"앞줄, 박수 준비됐어요!"},"a55":{"name":"커튼콜 팬 유나","role":"supporter","heckles":["커튼콜은 제가 기다려요.","박수는 아껴 두지 않을게요.","끝까지 보고 있어요.","한 번 더도 좋아요."],"winLine":"커튼콜, 부탁해요!"},"a16":{"name":"칼리 열혈팬 1223호","role":"supporter","heckles":["우와! 현실 CG인가..?","이정도면 마술이 아니고","마법 아니냐구요!!..","눈으로 쫓을 수가 없어요!.."],"winLine":"숨 차요. 그래도 최고예요."},"a18":{"name":"후배 지우","role":"supporter","heckles":["선배, 이쪽도 봐 주세요.","멀리서 뛰어온 사람 많아요.","우와, 손이 안 보여요.","소리 지를게요. 살짝만요."],"winLine":"선배, 축제 접었습니다!"},"a60":{"name":"야광봉 팬 하은","role":"supporter","heckles":["불빛은 손 따라 움직일게요.","멀리서도 이 색이 보여요.","야광봉, 박자에 맞출게요.","열혈팬 옆자리를 뺏겼어요."],"winLine":"불빛이 손을 쫓아요!"},"a19":{"name":"진행자 태훈","role":"helper","heckles":["다음 참가자입니다, 칼리!","다들 즉석인 거 알아요.","즉석인 거, 다들 알아요.","다음 참가자, 칼리!"],"winLine":"다음 참가자입니다, 칼리!"},"a20":{"name":"카메라 석진","role":"helper","heckles":["즉석이라 줌은 천천히요.","손만 프레임에 넣을게요.","웃음 나오면 바로 잡아요.","컷 전에 고개만 유지해요."],"winLine":"이 앵글, 남길게요."},"a66":{"name":"방청객 소희","role":"supporter","heckles":["웃어도 되는 장면이죠?","방청석이 먼저 반응해요.","박수는 장면 끝에 모을게요.","즉석인데 다들 편해 보여요."],"winLine":"웃음이 먼저 나갔어요."},"a112":{"name":"방송 PD 승기","role":"helper","heckles":["오늘은 유튜브 방송이에요.","준비되면 고개만 끄덕여요.","유튜브 방송이에요.","고개만 끄덕여 주세요."],"winLine":"오늘은 유튜브 방송이에요."},"a113":{"name":"방송 작가 가은","role":"helper","heckles":["빠른 말이 오히려 맞아요.","이 속도가 맛이에요.","이 템포, 큐에 남길게.","가르치는 말투가 살아요."],"winLine":"빠른 그대로가 좋아요."},"a114":{"name":"음향 감독 도현","role":"helper","heckles":["빨라도 발음은 살아요.","숨 고르는 틈만 주세요.","마이크는 템포를 따라가요.","작게 말해도 다 잡혀요."],"winLine":"속도까지 예쁘게 담겼어요."},"a115":{"name":"응원단장 나리","role":"supporter","heckles":["이 속도, 박수가 따라가요.","웃음 나오면 바로 칠게요.","화면 너머도 듣고 있어요.","노련한 말이 더 신나요."],"winLine":"박수도 그 템포예요!"},"a116":{"name":"열정 패널 규리","role":"supporter","heckles":["느리면 오히려 어색해요.","설명하는 손이 좋아요.","저도 따라 해 보고 싶네요.","이 속도가 칼리네요."],"winLine":"가르치는 맛이 나네요."},"a117":{"name":"조명 감독 태산","role":"helper","heckles":["손이 빠른 쪽에 빛을 둘게요.","그림자만 안 남으면 돼요.","설명하는 얼굴도 밝혀요.","피날레 때 한 칸 올릴게요."],"winLine":"빛이 손을 따라갔어요."},"a71":{"name":"쇼 팬 소피아","role":"supporter","heckles":["유쾌한 쪽이 더 좋아요.","앰비셔스, 다시 올라오나요?","팬이라 숨부터 골랐어요.","네 색이면 충분해요."],"winLine":"이 쇼, 내 기준으로 남아요."},"a25":{"name":"뮤지컬 팬 제인","role":"supporter","heckles":["신기해서 숨이 막혀요.","욕 대신 브라보가 나와요.","속말이 객석까지 와요.","이 여운, 노래랑 같아요."],"winLine":"브라보, 마음까지요."},"a78":{"name":"오케스트라 헨리","role":"supporter","heckles":["속말이 멜로디처럼 들려요.","큰 감정 뒤에 쉼표가 있네요.","박수는 마지막 음에 칠게요.","신기함이 화음이에요."],"winLine":"이 여운, 한 곡 같아요."},"a29":{"name":"무전 담당 보라","role":"helper","heckles":["돌계단 인원, 계속 늘어요.","바닷바람에도 손은 선명해요.","피날레 때 손 한번 드세요.","무전 대신 박수로 받을게요."],"winLine":"이 인원, 보고 끝났어요."},"a30":{"name":"탐사차 기사님","role":"helper","heckles":["계단 아래도 잘 보여요.","카드가 없어도 쇼는 이어지죠.","와이파이 이름, 방금 변했나요?","즉흥인데 길이 안 끊겨요."],"winLine":"이 코스, 다시 달릴게요."},"a85":{"name":"정비 담당 대철","role":"helper","heckles":["통로 비워 뒀어요. 보여요.","카드 없어도 다음 수가 있죠.","즉흥 도구, 제가 치울게요.","바람에도 손은 안 흔들려요."],"winLine":"현장 상태, 아주 좋아요."},"a32":{"name":"태양 가이드 솔","role":"helper","heckles":["그늘은 두 걸음 왼쪽이에요.","바람 등지고 서 주세요.","눈 감았다 떠도 돼요.","빛길만 제가 막을게요."],"winLine":"그늘 안내, 성공이에요."},"a33":{"name":"사진가 도하","role":"supporter","heckles":["역광이라 눈이 먼저 웃어요.","바람 털고 초점 맞출게요.","손만 실루엣으로 남아요.","그늘에서 한 장 더요."],"winLine":"이 역광, 건졌어요."},"a36":{"name":"별자리 선생님","role":"helper","heckles":["하나, 둘, 셋이면 충분해요.","검정과 빨강, 별 이름 같네요.","해설은 손짓 뒤에 할게요.","줄 서 있는 손도 보여요."],"winLine":"새 별은 이 손짓이에요."},"a100":{"name":"안내원 다솜","role":"helper","heckles":["줄은 손 가리키는 쪽이에요.","하나면 앞으로, 둘은 옆이요.","말이 달라도 안내는 통해요.","막히면 몸짓으로 돌려요."],"winLine":"안내가 웃음으로 끝났어요."},"a102":{"name":"여행자 수아","role":"supporter","heckles":["소원은 빨강으로 할게요.","검정도 나쁘지 않네요.","말이 안 통해도 고를 수 있어요.","손짓이면 여행이 열려요."],"winLine":"고른 색이 도착했어요."},"a106":{"name":"용기 낸 나","role":"supporter","heckles":["용기 낸 나도 나야.","한 걸음이 여기까지 왔어.","떨림은 남고, 발은 움직였어.","거울이 먼저 웃네."],"winLine":"그 한 걸음, 맞았어."},"a107":{"name":"객석의 나","role":"supporter","heckles":["객석의 나도 박수 준비야.","리모컨 대신 손을 봤어.","실수해도 나는 앉아 있어.","엔딩에 내가 일어날게."],"winLine":"객석에서 먼저 일어났어."},"a109":{"name":"막 시작한 나","role":"supporter","heckles":["연습 시작한 날의 나야.","카드가 아직 어색해.","그래도 손은 재미있어.","너 보니까 다시 펼쳤어."],"winLine":"오늘 연습, 여기까지야."},"a110":{"name":"계속한 칼리","role":"helper","heckles":["나는 마술을 계속 건넸어.","그만두고 싶었던 적은 없어.","다시 건네고 싶은 마음.","이제 렉쳐노트로 가."],"winLine":"이제 렉쳐노트로 가."},"a111":{"name":"박수 보내는 나","role":"supporter","heckles":["박수는 내가 아껴 둔 거야.","어느 나라든 손은 같아.","의심 끝난 뒤에 칠게.","계속한 나 옆자리야."],"winLine":"박수, 지금 보낸다."},"a-lecturenote-hecate":{"name":"헤카테","role":"helper","heckles":["재고 칸은 제가 볼게요.","포장 줄, 공연 뒤에 이을게요.","손 위치만 확인했어요.","문의 응대는 끝나고 할게요."],"winLine":"점검보다 손이 먼저네요."},"a-lecturenote-serona":{"name":"세로나","role":"helper","heckles":["마지막 컵앤볼이에요.","모자를 벗을게요.","세로나예요. 샵 매니저도 저고요.","숨겨진 조력자로 있었어요."],"winLine":"카드 몬테의 손도 제 거였어요."},"a-lecturenote-jung":{"name":"정희수","role":"helper","heckles":["판매 전에 마술 한 번, 반응 좋았음.","카운터는 우리가 볼게.","포장은 제가 볼게요.","선반은 정리해 둘게요."],"winLine":"카운터는 우리가 볼게."}},"moods":{"story:tutorial:intro:0":"doubt","story:tutorial:intro:1":"happy","story:tutorial:intro:2":"happy","story:tutorial:intro:3":"happy","story:tutorial:coaching:0":"doubt","story:tutorial:coaching:1":"doubt","story:tutorial:coaching:2":"surprised","story:tutorial:coaching:3":"doubt","story:tutorial:defeat:0":"surprised","story:tutorial:defeat:1":"happy","story:tutorial:defeat:2":"happy","story:tutorial:winLine":"happy","story:helper:coaching:0":"serious","story:helper:coaching:1":"serious","story:helper:coaching:2":"serious","story:helper:coaching:3":"serious","story:helper:coaching:4":"happy","story:family:opening:0":"smug","story:family:opening:1":"happy","story:family:opening:2":"happy","story:family:opening:3":"happy","story:family:opening:4":"smug","story:family:opening:5":"happy","story:family:beforeHeadliner:0":"doubt","story:family:beforeHeadliner:1":"serious","story:family:beforeHeadliner:2":"serious","story:family:afterClear:0":"happy","story:family:afterClear:1":"happy","story:party:opening:0":"happy","story:party:opening:1":"happy","story:party:opening:2":"serious","story:party:opening:3":"happy","story:party:beforeHeadliner:0":"smug","story:party:beforeHeadliner:1":"happy","story:party:beforeHeadliner:2":"happy","story:party:afterClear:0":"happy","story:party:afterClear:1":"happy","story:party:afterClear:2":"serious","story:school:opening:0":"happy","story:school:opening:1":"surprised","story:school:opening:2":"happy","story:school:opening:3":"happy","story:school:opening:4":"smug","story:school:beforeHeadliner:0":"doubt","story:school:beforeHeadliner:1":"happy","story:school:beforeHeadliner:2":"happy","story:school:afterClear:0":"happy","story:school:afterClear:1":"happy","story:cafe:opening:0":"happy","story:cafe:opening:1":"doubt","story:cafe:opening:2":"happy","story:cafe:opening:3":"serious","story:cafe:beforeHeadliner:0":"smug","story:cafe:beforeHeadliner:1":"happy","story:cafe:beforeHeadliner:2":"happy","story:cafe:afterClear:0":"happy","story:cafe:afterClear:1":"happy","story:meetup:opening:0":"happy","story:meetup:opening:1":"happy","story:meetup:opening:2":"happy","story:meetup:opening:3":"happy","story:meetup:opening:4":"happy","story:meetup:opening:5":"happy","story:meetup:opening:6":"happy","story:meetup:beforeHeadliner:0":"happy","story:meetup:beforeHeadliner:1":"happy","story:meetup:beforeHeadliner:2":"happy","story:meetup:afterClear:0":"happy","story:meetup:afterClear:1":"happy","story:meetup:afterClear:2":"happy","story:theater:opening:0":"happy","story:theater:opening:1":"doubt","story:theater:opening:2":"happy","story:theater:opening:3":"smug","story:theater:opening:4":"happy","story:theater:opening:5":"serious","story:theater:opening:6":"happy","story:theater:beforeHeadliner:0":"smug","story:theater:beforeHeadliner:1":"happy","story:theater:beforeHeadliner:2":"doubt","story:theater:afterClear:0":"happy","story:theater:afterClear:1":"happy","story:theater:afterClear:2":"happy","story:theater:afterClear:3":"happy","story:festival:opening:0":"happy","story:festival:opening:1":"happy","story:festival:opening:2":"happy","story:festival:opening:3":"happy","story:festival:beforeHeadliner:0":"smug","story:festival:beforeHeadliner:1":"happy","story:festival:beforeHeadliner:2":"happy","story:festival:afterClear:0":"happy","story:festival:afterClear:1":"happy","story:audition:opening:0":"happy","story:audition:opening:1":"smug","story:audition:opening:2":"happy","story:audition:opening:3":"serious","story:audition:beforeHeadliner:0":"smug","story:audition:beforeHeadliner:1":"happy","story:audition:beforeHeadliner:2":"happy","story:audition:afterClear:0":"happy","story:audition:afterClear:1":"smug","story:broadcast:opening:0":"serious","story:broadcast:opening:1":"serious","story:broadcast:opening:2":"surprised","story:broadcast:opening:3":"happy","story:broadcast:beforeHeadliner:0":"happy","story:broadcast:beforeHeadliner:1":"happy","story:broadcast:beforeHeadliner:2":"happy","story:broadcast:afterClear:0":"happy","story:broadcast:afterClear:1":"happy","story:vegas:opening:0":"smug","story:vegas:opening:1":"happy","story:vegas:opening:2":"happy","story:vegas:opening:3":"happy","story:vegas:beforeHeadliner:0":"smug","story:vegas:beforeHeadliner:1":"happy","story:vegas:beforeHeadliner:2":"happy","story:vegas:afterClear:0":"happy","story:vegas:afterClear:1":"happy","story:vegas:afterClear:2":"happy","story:broadway:opening:0":"happy","story:broadway:opening:1":"doubt","story:broadway:opening:2":"doubt","story:broadway:opening:3":"happy","story:broadway:beforeHeadliner:0":"smug","story:broadway:beforeHeadliner:1":"happy","story:broadway:beforeHeadliner:2":"happy","story:broadway:afterClear:0":"happy","story:broadway:afterClear:1":"happy","story:moon:opening:0":"happy","story:moon:opening:1":"happy","story:moon:opening:2":"happy","story:moon:opening:3":"happy","story:moon:beforeHeadliner:0":"smug","story:moon:beforeHeadliner:1":"happy","story:moon:beforeHeadliner:2":"smug","story:moon:afterClear:0":"happy","story:moon:afterClear:1":"happy","story:sun:opening:0":"happy","story:sun:opening:1":"happy","story:sun:opening:2":"happy","story:sun:opening:3":"happy","story:sun:beforeHeadliner:0":"smug","story:sun:beforeHeadliner:1":"happy","story:sun:beforeHeadliner:2":"happy","story:sun:afterClear:0":"happy","story:sun:afterClear:1":"happy","story:galaxy:opening:0":"happy","story:galaxy:opening:1":"happy","story:galaxy:opening:2":"happy","story:galaxy:opening:3":"happy","story:galaxy:opening:4":"happy","story:galaxy:opening:5":"happy","story:galaxy:beforeHeadliner:0":"smug","story:galaxy:beforeHeadliner:1":"happy","story:galaxy:beforeHeadliner:2":"serious","story:galaxy:afterClear:0":"serious","story:galaxy:afterClear:1":"happy","story:galaxy:afterClear:2":"serious","story:multiverse:opening:0":"happy","story:multiverse:opening:1":"happy","story:multiverse:opening:2":"happy","story:multiverse:opening:3":"happy","story:multiverse:beforeHeadliner:0":"serious","story:multiverse:beforeHeadliner:1":"happy","story:multiverse:beforeHeadliner:2":"happy","story:multiverse:afterClear:0":"happy","story:multiverse:afterClear:1":"happy","story:lecturenote:opening:0":"serious","story:lecturenote:opening:1":"happy","story:lecturenote:opening:2":"happy","story:lecturenote:opening:3":"happy","story:lecturenote:beforeHeadliner:0":"happy","story:lecturenote:beforeHeadliner:1":"serious","story:lecturenote:beforeHeadliner:2":"happy","story:lecturenote:beforeHeadliner:3":"happy","story:lecturenote:beforeHeadliner:4":"serious","story:lecturenote:beforeHeadliner:5":"happy","story:lecturenote:beforeHeadliner:6":"happy","story:lecturenote:afterClear:0":"happy","story:lecturenote:afterClear:1":"serious","story:lecturenote:afterClear:2":"serious","story:lecturenote:afterClear:3":"serious","story:lecturenote:afterClear:4":"happy","story:lecturenote:afterClear:5":"serious","story:lecturenote:afterClear:6":"happy","story:lecturenote:afterClear:7":"happy","story:lecturenote:afterClear:8":"happy","branch:c1_subway:c1_subway_past:0":"sad","branch:c1_subway:c1_subway_past:1":"serious","branch:c1_subway:c1_subway_past:2":"happy","branch:c1_subway:c1_subway_past:echo":"happy","branch:c1_subway:c1_subway_forward:0":"happy","branch:c1_subway:c1_subway_forward:1":"happy","branch:c1_subway:c1_subway_forward:2":"happy","branch:c1_subway:c1_subway_forward:echo":"happy","branch:c2_meetup:c2_friends_past:0":"happy","branch:c2_meetup:c2_friends_past:1":"happy","branch:c2_meetup:c2_friends_past:2":"serious","branch:c2_meetup:c2_friends_past:echo":"happy","branch:c2_meetup:c2_next_forward:0":"happy","branch:c2_meetup:c2_next_forward:1":"happy","branch:c2_meetup:c2_next_forward:2":"happy","branch:c2_meetup:c2_next_forward:echo":"happy","branch:c3_multi:c3_wave_past:0":"serious","branch:c3_multi:c3_wave_past:1":"happy","branch:c3_multi:c3_wave_past:2":"happy","branch:c3_multi:c3_wave_past:echo":"happy","branch:c3_multi:c3_walk_forward:0":"serious","branch:c3_multi:c3_walk_forward:1":"happy","branch:c3_multi:c3_walk_forward:2":"serious","branch:c3_multi:c3_walk_forward:echo":"happy","branch:c4_cards:c4_oldcards_past:0":"happy","branch:c4_cards:c4_oldcards_past:1":"happy","branch:c4_cards:c4_oldcards_past:2":"happy","branch:c4_cards:c4_oldcards_past:echo":"happy","branch:c4_cards:c4_newcards_forward:0":"happy","branch:c4_cards:c4_newcards_forward:1":"happy","branch:c4_cards:c4_newcards_forward:2":"happy","branch:c4_cards:c4_newcards_forward:echo":"happy","branch:ifRoute:teaser:0":"serious","branch:ifRoute:teaser:1":"happy","branch:ifRoute:intro:0":"surprised","branch:ifRoute:intro:1":"happy","branch:ifRoute:intro:2":"sad","branch:ifRoute:intro:3":"serious","branch:ifRoute:duel:0":"sad","branch:ifRoute:duel:1":"sad","branch:ifRoute:duel:2":"happy","branch:ifRoute:glitch:0":"surprised","branch:ifRoute:glitch:1":"surprised","branch:ifRoute:evolve:0":"serious","branch:ifRoute:evolve:1":"serious","branch:ifRoute:evolve:2":"serious","branch:ifRoute:evolve:3":"happy","branch:ifRoute:phaseLines:0":"serious","branch:ifRoute:phaseLines:1":"happy","branch:ifRoute:phaseLines:2":"serious","branch:ifRoute:win:0":"happy","branch:ifRoute:win:1":"surprised","branch:ifRoute:win:2":"serious","branch:ifRoute:win:3":"happy","branch:ifRoute:ending:0":"happy","branch:ifRoute:ending:1":"serious","branch:ifRoute:ending:2":"serious","branch:ifRoute:ending:3":"happy","branch:ifRoute:ending:4":"happy","branch:ifRoute:ending:5":"happy","fight:a1:heckles:0":"smug","fight:a1:heckles:1":"happy","fight:a1:heckles:2":"happy","fight:a1:heckles:3":"doubt","fight:a1:winLine":"happy","fight:a2:heckles:0":"happy","fight:a2:heckles:1":"doubt","fight:a2:heckles:2":"doubt","fight:a2:heckles:3":"doubt","fight:a2:winLine":"surprised","fight:a3:heckles:0":"happy","fight:a3:heckles:1":"happy","fight:a3:heckles:2":"happy","fight:a3:heckles:3":"doubt","fight:a3:winLine":"happy","fight:h1:heckles:0":"smug","fight:h1:heckles:1":"smug","fight:h1:heckles:2":"happy","fight:h1:heckles:3":"doubt","fight:h1:winLine":"surprised","fight:a4:heckles:0":"happy","fight:a4:heckles:1":"happy","fight:a4:heckles:2":"serious","fight:a4:heckles:3":"happy","fight:a4:winLine":"happy","fight:a5:heckles:0":"happy","fight:a5:heckles:1":"happy","fight:a5:heckles:2":"serious","fight:a5:heckles:3":"happy","fight:a5:winLine":"happy","fight:a6:heckles:0":"happy","fight:a6:heckles:1":"happy","fight:a6:heckles:2":"serious","fight:a6:heckles:3":"happy","fight:a6:winLine":"happy","fight:h2:heckles:0":"smug","fight:h2:heckles:1":"doubt","fight:h2:heckles:2":"doubt","fight:h2:heckles:3":"doubt","fight:h2:winLine":"happy","fight:a7:heckles:0":"happy","fight:a7:heckles:1":"happy","fight:a7:heckles:2":"serious","fight:a7:heckles:3":"happy","fight:a7:winLine":"happy","fight:a8:heckles:0":"happy","fight:a8:heckles:1":"happy","fight:a8:heckles:2":"serious","fight:a8:heckles:3":"happy","fight:a8:winLine":"happy","fight:a9:heckles:0":"doubt","fight:a9:heckles:1":"doubt","fight:a9:heckles:2":"doubt","fight:a9:heckles:3":"doubt","fight:a9:winLine":"happy","fight:a46:heckles:0":"smug","fight:a46:heckles:1":"doubt","fight:a46:heckles:2":"doubt","fight:a46:heckles:3":"doubt","fight:a46:winLine":"happy","fight:h3:heckles:0":"doubt","fight:h3:heckles:1":"smug","fight:h3:heckles:2":"doubt","fight:h3:heckles:3":"doubt","fight:h3:winLine":"happy","fight:a10:heckles:0":"doubt","fight:a10:heckles:1":"doubt","fight:a10:heckles:2":"doubt","fight:a10:heckles:3":"doubt","fight:a10:winLine":"happy","fight:a11:heckles:0":"doubt","fight:a11:heckles:1":"doubt","fight:a11:heckles:2":"doubt","fight:a11:heckles:3":"doubt","fight:a11:winLine":"happy","fight:a12:heckles:0":"doubt","fight:a12:heckles:1":"doubt","fight:a12:heckles:2":"doubt","fight:a12:heckles:3":"doubt","fight:a12:winLine":"happy","fight:a50:heckles:0":"happy","fight:a50:heckles:1":"happy","fight:a50:heckles:2":"happy","fight:a50:heckles:3":"serious","fight:a50:winLine":"happy","fight:h4:heckles:0":"doubt","fight:h4:heckles:1":"smug","fight:h4:heckles:2":"doubt","fight:h4:heckles:3":"doubt","fight:h4:winLine":"happy","fight:a-meetup-busan:heckles:0":"happy","fight:a-meetup-busan:heckles:1":"happy","fight:a-meetup-busan:heckles:2":"happy","fight:a-meetup-busan:heckles:3":"happy","fight:a-meetup-busan:winLine":"happy","fight:a-meetup-daegu:heckles:0":"doubt","fight:a-meetup-daegu:heckles:1":"doubt","fight:a-meetup-daegu:heckles:2":"doubt","fight:a-meetup-daegu:heckles:3":"doubt","fight:a-meetup-daegu:winLine":"happy","fight:a-meetup-changwon:heckles:0":"doubt","fight:a-meetup-changwon:heckles:1":"doubt","fight:a-meetup-changwon:heckles:2":"doubt","fight:a-meetup-changwon:heckles:3":"doubt","fight:a-meetup-changwon:winLine":"happy","fight:a-meetup-incheon:heckles:0":"happy","fight:a-meetup-incheon:heckles:1":"happy","fight:a-meetup-incheon:heckles:2":"happy","fight:a-meetup-incheon:heckles:3":"happy","fight:a-meetup-incheon:winLine":"happy","fight:a-meetup-geoje:heckles:0":"happy","fight:a-meetup-geoje:heckles:1":"happy","fight:a-meetup-geoje:heckles:2":"happy","fight:a-meetup-geoje:heckles:3":"happy","fight:a-meetup-geoje:winLine":"happy","fight:a-meetup-cheonan:heckles:0":"happy","fight:a-meetup-cheonan:heckles:1":"happy","fight:a-meetup-cheonan:heckles:2":"happy","fight:a-meetup-cheonan:heckles:3":"happy","fight:a-meetup-cheonan:winLine":"happy","fight:a-meetup-suwon:heckles:0":"doubt","fight:a-meetup-suwon:heckles:1":"doubt","fight:a-meetup-suwon:heckles:2":"doubt","fight:a-meetup-suwon:heckles:3":"doubt","fight:a-meetup-suwon:winLine":"happy","fight:h-meetup-seoul:heckles:0":"happy","fight:h-meetup-seoul:heckles:1":"happy","fight:h-meetup-seoul:heckles:2":"serious","fight:h-meetup-seoul:heckles:3":"happy","fight:h-meetup-seoul:winLine":"happy","fight:a13:heckles:0":"happy","fight:a13:heckles:1":"happy","fight:a13:heckles:2":"happy","fight:a13:heckles:3":"happy","fight:a13:winLine":"happy","fight:a14:heckles:0":"doubt","fight:a14:heckles:1":"doubt","fight:a14:heckles:2":"doubt","fight:a14:heckles:3":"doubt","fight:a14:winLine":"happy","fight:a15:heckles:0":"smug","fight:a15:heckles:1":"smug","fight:a15:heckles:2":"smug","fight:a15:heckles:3":"smug","fight:a15:winLine":"surprised","fight:a54:heckles:0":"smug","fight:a54:heckles:1":"doubt","fight:a54:heckles:2":"doubt","fight:a54:heckles:3":"doubt","fight:a54:winLine":"happy","fight:a55:heckles:0":"happy","fight:a55:heckles:1":"happy","fight:a55:heckles:2":"happy","fight:a55:heckles:3":"happy","fight:a55:winLine":"happy","fight:h5:heckles:0":"doubt","fight:h5:heckles:1":"doubt","fight:h5:heckles:2":"doubt","fight:h5:heckles:3":"doubt","fight:h5:winLine":"happy","fight:a16:heckles:0":"happy","fight:a16:heckles:1":"happy","fight:a16:heckles:2":"happy","fight:a16:heckles:3":"happy","fight:a16:winLine":"happy","fight:a17:heckles:0":"happy","fight:a17:heckles:1":"happy","fight:a17:heckles:2":"happy","fight:a17:heckles:3":"doubt","fight:a17:winLine":"happy","fight:a18:heckles:0":"happy","fight:a18:heckles:1":"happy","fight:a18:heckles:2":"happy","fight:a18:heckles:3":"happy","fight:a18:winLine":"happy","fight:a59:heckles:0":"smug","fight:a59:heckles:1":"doubt","fight:a59:heckles:2":"doubt","fight:a59:heckles:3":"doubt","fight:a59:winLine":"happy","fight:a60:heckles:0":"happy","fight:a60:heckles:1":"happy","fight:a60:heckles:2":"happy","fight:a60:heckles:3":"happy","fight:a60:winLine":"happy","fight:h6:heckles:0":"doubt","fight:h6:heckles:1":"doubt","fight:h6:heckles:2":"doubt","fight:h6:heckles:3":"doubt","fight:h6:winLine":"happy","fight:a19:heckles:0":"serious","fight:a19:heckles:1":"surprised","fight:a19:heckles:2":"happy","fight:a19:heckles:3":"serious","fight:a19:winLine":"happy","fight:a20:heckles:0":"serious","fight:a20:heckles:1":"serious","fight:a20:heckles:2":"serious","fight:a20:heckles:3":"serious","fight:a20:winLine":"happy","fight:a21:heckles:0":"smug","fight:a21:heckles:1":"smug","fight:a21:heckles:2":"doubt","fight:a21:heckles:3":"doubt","fight:a21:winLine":"happy","fight:a64:heckles:0":"doubt","fight:a64:heckles:1":"doubt","fight:a64:heckles:2":"doubt","fight:a64:heckles:3":"doubt","fight:a64:winLine":"happy","fight:a65:heckles:0":"doubt","fight:a65:heckles:1":"doubt","fight:a65:heckles:2":"doubt","fight:a65:heckles:3":"doubt","fight:a65:winLine":"happy","fight:a66:heckles:0":"happy","fight:a66:heckles:1":"happy","fight:a66:heckles:2":"happy","fight:a66:heckles:3":"happy","fight:a66:winLine":"happy","fight:h7:heckles:0":"smug","fight:h7:heckles:1":"doubt","fight:h7:heckles:2":"doubt","fight:h7:heckles:3":"doubt","fight:h7:winLine":"happy","fight:a112:heckles:0":"serious","fight:a112:heckles:1":"serious","fight:a112:heckles:2":"serious","fight:a112:heckles:3":"happy","fight:a112:winLine":"happy","fight:a113:heckles:0":"serious","fight:a113:heckles:1":"happy","fight:a113:heckles:2":"serious","fight:a113:heckles:3":"happy","fight:a113:winLine":"happy","fight:a114:heckles:0":"serious","fight:a114:heckles:1":"surprised","fight:a114:heckles:2":"happy","fight:a114:heckles:3":"serious","fight:a114:winLine":"happy","fight:a115:heckles:0":"happy","fight:a115:heckles:1":"happy","fight:a115:heckles:2":"happy","fight:a115:heckles:3":"happy","fight:a115:winLine":"happy","fight:a116:heckles:0":"happy","fight:a116:heckles:1":"happy","fight:a116:heckles:2":"happy","fight:a116:heckles:3":"happy","fight:a116:winLine":"happy","fight:a117:heckles:0":"happy","fight:a117:heckles:1":"serious","fight:a117:heckles:2":"serious","fight:a117:heckles:3":"happy","fight:a117:winLine":"happy","fight:h-broadcast:heckles:0":"doubt","fight:h-broadcast:heckles:1":"doubt","fight:h-broadcast:heckles:2":"doubt","fight:h-broadcast:heckles:3":"doubt","fight:h-broadcast:winLine":"happy","fight:a22:heckles:0":"doubt","fight:a22:heckles:1":"doubt","fight:a22:heckles:2":"doubt","fight:a22:heckles:3":"doubt","fight:a22:winLine":"happy","fight:a23:heckles:0":"doubt","fight:a23:heckles:1":"doubt","fight:a23:heckles:2":"doubt","fight:a23:heckles:3":"doubt","fight:a23:winLine":"happy","fight:a24:heckles:0":"doubt","fight:a24:heckles:1":"doubt","fight:a24:heckles:2":"doubt","fight:a24:heckles:3":"doubt","fight:a24:winLine":"happy","fight:a70:heckles:0":"smug","fight:a70:heckles:1":"doubt","fight:a70:heckles:2":"doubt","fight:a70:heckles:3":"doubt","fight:a70:winLine":"happy","fight:a71:heckles:0":"happy","fight:a71:heckles:1":"happy","fight:a71:heckles:2":"happy","fight:a71:heckles:3":"happy","fight:a71:winLine":"happy","fight:a72:heckles:0":"smug","fight:a72:heckles:1":"doubt","fight:a72:heckles:2":"doubt","fight:a72:heckles:3":"doubt","fight:a72:winLine":"happy","fight:h8:heckles:0":"smug","fight:h8:heckles:1":"smug","fight:h8:heckles:2":"smug","fight:h8:heckles:3":"doubt","fight:h8:winLine":"happy","fight:a25:heckles:0":"happy","fight:a25:heckles:1":"happy","fight:a25:heckles:2":"happy","fight:a25:heckles:3":"happy","fight:a25:winLine":"happy","fight:a26:heckles:0":"doubt","fight:a26:heckles:1":"doubt","fight:a26:heckles:2":"doubt","fight:a26:heckles:3":"doubt","fight:a26:winLine":"happy","fight:a27:heckles:0":"doubt","fight:a27:heckles:1":"doubt","fight:a27:heckles:2":"doubt","fight:a27:heckles:3":"doubt","fight:a27:winLine":"happy","fight:a76:heckles:0":"doubt","fight:a76:heckles:1":"doubt","fight:a76:heckles:2":"doubt","fight:a76:heckles:3":"smug","fight:a76:winLine":"happy","fight:a77:heckles:0":"doubt","fight:a77:heckles:1":"doubt","fight:a77:heckles:2":"doubt","fight:a77:heckles:3":"doubt","fight:a77:winLine":"happy","fight:a78:heckles:0":"happy","fight:a78:heckles:1":"happy","fight:a78:heckles:2":"happy","fight:a78:heckles:3":"happy","fight:a78:winLine":"happy","fight:a79:heckles:0":"doubt","fight:a79:heckles:1":"doubt","fight:a79:heckles:2":"doubt","fight:a79:heckles:3":"doubt","fight:a79:winLine":"happy","fight:h9:heckles:0":"smug","fight:h9:heckles:1":"smug","fight:h9:heckles:2":"smug","fight:h9:heckles:3":"smug","fight:h9:winLine":"happy","fight:a28:heckles:0":"doubt","fight:a28:heckles:1":"doubt","fight:a28:heckles:2":"smug","fight:a28:heckles:3":"doubt","fight:a28:winLine":"happy","fight:a29:heckles:0":"happy","fight:a29:heckles:1":"serious","fight:a29:heckles:2":"serious","fight:a29:heckles:3":"happy","fight:a29:winLine":"happy","fight:a30:heckles:0":"serious","fight:a30:heckles:1":"happy","fight:a30:heckles:2":"serious","fight:a30:heckles:3":"happy","fight:a30:winLine":"happy","fight:a83:heckles:0":"doubt","fight:a83:heckles:1":"doubt","fight:a83:heckles:2":"doubt","fight:a83:heckles:3":"doubt","fight:a83:winLine":"happy","fight:a84:heckles:0":"doubt","fight:a84:heckles:1":"doubt","fight:a84:heckles:2":"doubt","fight:a84:heckles:3":"doubt","fight:a84:winLine":"happy","fight:a85:heckles:0":"happy","fight:a85:heckles:1":"serious","fight:a85:heckles:2":"serious","fight:a85:heckles:3":"happy","fight:a85:winLine":"happy","fight:a86:heckles:0":"doubt","fight:a86:heckles:1":"doubt","fight:a86:heckles:2":"doubt","fight:a86:heckles:3":"smug","fight:a86:winLine":"happy","fight:h10:heckles:0":"doubt","fight:h10:heckles:1":"doubt","fight:h10:heckles:2":"doubt","fight:h10:heckles:3":"smug","fight:h10:winLine":"happy","fight:a31:heckles:0":"doubt","fight:a31:heckles:1":"doubt","fight:a31:heckles:2":"doubt","fight:a31:heckles:3":"doubt","fight:a31:winLine":"happy","fight:a32:heckles:0":"happy","fight:a32:heckles:1":"serious","fight:a32:heckles:2":"happy","fight:a32:heckles:3":"serious","fight:a32:winLine":"happy","fight:a33:heckles:0":"happy","fight:a33:heckles:1":"happy","fight:a33:heckles:2":"happy","fight:a33:heckles:3":"happy","fight:a33:winLine":"happy","fight:a90:heckles:0":"doubt","fight:a90:heckles:1":"doubt","fight:a90:heckles:2":"doubt","fight:a90:heckles:3":"doubt","fight:a90:winLine":"happy","fight:a91:heckles:0":"doubt","fight:a91:heckles:1":"doubt","fight:a91:heckles:2":"doubt","fight:a91:heckles:3":"doubt","fight:a91:winLine":"happy","fight:a92:heckles:0":"doubt","fight:a92:heckles:1":"doubt","fight:a92:heckles:2":"doubt","fight:a92:heckles:3":"doubt","fight:a92:winLine":"happy","fight:a93:heckles:0":"doubt","fight:a93:heckles:1":"doubt","fight:a93:heckles:2":"doubt","fight:a93:heckles:3":"doubt","fight:a93:winLine":"happy","fight:a94:heckles:0":"doubt","fight:a94:heckles:1":"doubt","fight:a94:heckles:2":"doubt","fight:a94:heckles:3":"doubt","fight:a94:winLine":"happy","fight:h11:heckles:0":"doubt","fight:h11:heckles:1":"doubt","fight:h11:heckles:2":"doubt","fight:h11:heckles:3":"doubt","fight:h11:winLine":"happy","fight:a34:heckles:0":"doubt","fight:a34:heckles:1":"doubt","fight:a34:heckles:2":"doubt","fight:a34:heckles:3":"doubt","fight:a34:winLine":"happy","fight:a35:heckles:0":"doubt","fight:a35:heckles:1":"doubt","fight:a35:heckles:2":"doubt","fight:a35:heckles:3":"doubt","fight:a35:winLine":"happy","fight:a36:heckles:0":"happy","fight:a36:heckles:1":"serious","fight:a36:heckles:2":"serious","fight:a36:heckles:3":"happy","fight:a36:winLine":"happy","fight:a98:heckles:0":"doubt","fight:a98:heckles:1":"doubt","fight:a98:heckles:2":"doubt","fight:a98:heckles:3":"doubt","fight:a98:winLine":"happy","fight:a99:heckles:0":"doubt","fight:a99:heckles:1":"doubt","fight:a99:heckles:2":"doubt","fight:a99:heckles:3":"doubt","fight:a99:winLine":"happy","fight:a100:heckles:0":"happy","fight:a100:heckles:1":"serious","fight:a100:heckles:2":"serious","fight:a100:heckles:3":"happy","fight:a100:winLine":"happy","fight:a101:heckles:0":"doubt","fight:a101:heckles:1":"doubt","fight:a101:heckles:2":"doubt","fight:a101:heckles:3":"doubt","fight:a101:winLine":"happy","fight:a102:heckles:0":"happy","fight:a102:heckles:1":"happy","fight:a102:heckles:2":"happy","fight:a102:heckles:3":"happy","fight:a102:winLine":"happy","fight:h12:heckles:0":"doubt","fight:h12:heckles:1":"smug","fight:h12:heckles:2":"smug","fight:h12:heckles:3":"doubt","fight:h12:winLine":"happy","fight:a37:heckles:0":"doubt","fight:a37:heckles:1":"doubt","fight:a37:heckles:2":"doubt","fight:a37:heckles:3":"doubt","fight:a37:winLine":"happy","fight:a38:heckles:0":"doubt","fight:a38:heckles:1":"doubt","fight:a38:heckles:2":"doubt","fight:a38:heckles:3":"doubt","fight:a38:winLine":"happy","fight:a39:heckles:0":"doubt","fight:a39:heckles:1":"doubt","fight:a39:heckles:2":"doubt","fight:a39:heckles:3":"doubt","fight:a39:winLine":"happy","fight:a106:heckles:0":"happy","fight:a106:heckles:1":"serious","fight:a106:heckles:2":"serious","fight:a106:heckles:3":"happy","fight:a106:winLine":"happy","fight:a107:heckles:0":"happy","fight:a107:heckles:1":"serious","fight:a107:heckles:2":"happy","fight:a107:heckles:3":"happy","fight:a107:winLine":"happy","fight:a108:heckles:0":"doubt","fight:a108:heckles:1":"doubt","fight:a108:heckles:2":"doubt","fight:a108:heckles:3":"doubt","fight:a108:winLine":"happy","fight:a109:heckles:0":"happy","fight:a109:heckles:1":"serious","fight:a109:heckles:2":"happy","fight:a109:heckles:3":"happy","fight:a109:winLine":"happy","fight:a110:heckles:0":"serious","fight:a110:heckles:1":"serious","fight:a110:heckles:2":"happy","fight:a110:heckles:3":"serious","fight:a110:winLine":"happy","fight:a111:heckles:0":"happy","fight:a111:heckles:1":"happy","fight:a111:heckles:2":"happy","fight:a111:heckles:3":"happy","fight:a111:winLine":"happy","fight:h13:heckles:0":"doubt","fight:h13:heckles:1":"doubt","fight:h13:heckles:2":"doubt","fight:h13:heckles:3":"doubt","fight:h13:winLine":"happy","fight:a-lecturenote-hecate:heckles:0":"serious","fight:a-lecturenote-hecate:heckles:1":"happy","fight:a-lecturenote-hecate:heckles:2":"happy","fight:a-lecturenote-hecate:heckles:3":"serious","fight:a-lecturenote-hecate:winLine":"happy","fight:a-lecturenote-serona:heckles:0":"happy","fight:a-lecturenote-serona:heckles:1":"happy","fight:a-lecturenote-serona:heckles:2":"serious","fight:a-lecturenote-serona:heckles:3":"serious","fight:a-lecturenote-serona:winLine":"happy","fight:a-lecturenote-jung:heckles:0":"happy","fight:a-lecturenote-jung:heckles:1":"happy","fight:a-lecturenote-jung:heckles:2":"happy","fight:a-lecturenote-jung:heckles:3":"serious","fight:a-lecturenote-jung:winLine":"happy","fight:h-lecturenote-kim:heckles:0":"happy","fight:h-lecturenote-kim:heckles:1":"happy","fight:h-lecturenote-kim:heckles:2":"happy","fight:h-lecturenote-kim:heckles:3":"happy","fight:h-lecturenote-kim:winLine":"happy","fight:h-future-kali:heckles:0":"serious","fight:h-future-kali:heckles:1":"serious","fight:h-future-kali:heckles:2":"happy","fight:h-future-kali:heckles:3":"happy","fight:h-future-kali:winLine":"happy"},"faceMap":{"spriteSuffixes":{"doubt":"aud-<id>.png (base)","happy":"aud-<id>-happy.png","serious":"aud-<id>-serious.png (optional, main cast)","surprised":"aud-<id>-surprised.png (optional, main cast)"},"resolution":{"happy":{"prefer":"-happy","fallback":"base doubt sprite + \"😊\" emote"},"doubt":{"prefer":"base (no suffix)","fallback":"base"},"smug":{"prefer":"base (no suffix)","fallback":"base + \"😏\" emote; if role is supporter/helper never use smug"},"serious":{"prefer":"-serious","fallback":"base doubt sprite + calm \"💭\" emote (do not use -happy)"},"surprised":{"prefer":"-surprised","fallback":"-happy sprite + \"❗\" emote, else base + \"❗\""},"sad":{"prefer":"-sad (not planned)","fallback":"base doubt sprite + \"💧\" emote"}},"roleDefaults":{"skeptic":"doubt","critic":"doubt","heckler":"smug","supporter":"happy","helper":"serious","family":"happy"},"rules":["Pick the sprite per line from moods[key], not per character.","A supporter/helper/family character must never show the doubt/smug base sprite without an emote when the mood is happy or serious: use the -happy sprite for happy; use serious fallback (base + \"💭\") only if no -serious sprite.","Skeptic/critic/heckler characters show the base sprite for doubt/smug and -happy only for happy lines (defeat, praise).","Fight lines without a moods entry fall back to roleDefaults."]}};
(function(D){
 D.venues.forEach(v=>v.audiences.concat([v.headliner]).forEach(a=>{
  const role=D.lineFaces.roles[a.id];if(role)a.role=role.role;
  const lines=D.lineFaces.lines[a.id];if(lines){a.heckles=lines.heckles.slice();a.winLine=lines.winLine;if(a.encounterLine&& !a.heckles.includes(a.encounterLine))a.heckles.push(a.encounterLine);}
 }));
 D.glove={id:'auto-glove',name:'칼리 덱 (자동 연습)',icon:'item-kali-deck.png',emoji:'🃏',duration:120000,desc:'누르면 120초 동안 모든 케이스를 자동으로 꾹 눌러요\n손을 떼도 연습해요. 가진 개수가 보여요'};
 const shop=D.gemShop.find(x=>x.id==='glove');shop.name='칼리 덱 (자동 연습)';shop.desc='120초 동안 모든 케이스를 자동으로 꾹 눌러요';
 // v4 U44: the key node deckMaster is gone. v4 U48 A: learning p-kali-deck (a product, reached at venue 2) unlocks the 칼리 덱 consumable
 // (sold here, dropped by cases). A2: the brick (a box of 12 decks) starts 30 minutes of auto practice at once.
 D.gemShop.splice(1,0,{id:'brick',name:'칼리 덱 한 브릭',desc:'덱 12개 한 묶음\n사면 바로 30분 자동 연습',cost:20});
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

// v4 U44: the 11 칼리 products are permanent attack factors (data rows above), so every venue after a product's wall carries that product's strength.
// Each venue's doubt (hpFactor) is scaled by the attack the player has when arriving there, so the timeline keeps its old pace; scales measured
// with sim.mjs --walls (seeds 1001 x60) against the per-venue stay of the old six-factor game (the walls themselves got shorter, so the later
// venues carry a little more than the plain product ratio). Final-boss and future profiles keep their own scaling in core.js.
(function(D){
 const scale={party:1.4,school:3.0,cafe:17,meetup:57,theater:110,festival:104,audition:141,broadcast:302,vegas:281,broadway:249,moon:325,sun:405,galaxy:385,multiverse:710,lecturenote:792};
 D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor*=scale[v.slug];});
})(GAME_DATA);

// v4 U48 C (owner: "익힐 수 있는 비법을 늘려줘. 레벨은 3,5,10 이런 숫자가 좋은거 같아."): no node in the book has more than 10 levels and every
// max is 1, 3, 5 or 10. A node whose max is anything else is shown as several nodes: the original node keeps its id, name and place as
// part I (n.max = the part size, n.levels = the old total, n.parts = the ids of all parts) and each later part (id "<id>-2", "-3", ...) gets
// its own name ("<name> II", ...), a short desc, a place next to the part before it and that part as its prerequisite. The save keeps the
// total level under the original key, so the effects, the costs (cost[total]) and the gates are the old ones (core.js "v4 U48 C").
(function(D){
 const plan={2:[1,1],4:[3,1],6:[5,1],8:[5,3],12:[10,1,1],15:[10,5],30:[10,10,10],45:[10,10,10,10,5]};
 const roman=['','I','II','III','IV','V'];
 const used=new Set(D.tree.map(n=>n.x+','+n.y));
 // The free grid point next to `from` (within 2 so the book draws the line), preferring the direction away from the book's centre.
 const place=(from,reach=2.1)=>{
  const out=Math.atan2(from.y,from.x||0.001);let best=null,bestKey=null;
  for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
   if(!dx&&!dy)continue;const x=from.x+dx,y=from.y+dy,d=Math.hypot(dx,dy);if(d>reach||used.has(x+','+y))continue;
   const turn=Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-out),Math.cos(Math.atan2(dy,dx)-out)));
   const key=[Math.round(d),turn];if(!bestKey||key[0]<bestKey[0]||key[0]===bestKey[0]&&key[1]<bestKey[1]){best={x,y};bestKey=key;}
  }
  return best;
 };
 // v4 U48 N4 (owner: "비법에서 내가 하는 마술(링, 로프, 썸타이 등)을 찍어야지 그 마술을 보여주는 걸로 해줘."): one 비법 per routine, max 1, next to the
 // routine's first related node (its prerequisite), costing 3 times that node's first level. Learning it shows the trick (cut-in) and adds
 // 3 percent to the routine's branch (core.js branchBonus); the cut-in plays only for learned routines.
 const list=[];
 for(const n of D.tree){
  list.push(n);const p=plan[n.max];if(!p)continue;
  n.levels=n.max;n.max=p[0];n.parts=[n.id];let prev=n,off=p[0];
  for(let k=1;k<p.length;k++){
   const at=place(prev);if(!at)throw new Error('v4 U48 C: no free book place next to '+prev.id);
   used.add(at.x+','+at.y);
   const part=Object.assign({},n,{id:n.id+'-'+(k+1),name:n.name+' '+roman[k+1],max:p[k],partOf:n.id,partOffset:off,prereqs:[prev.id],x:at.x,y:at.y,
    desc:(n.desc?n.desc.split('\n')[0]+'\n':'')+`'${n.name}' 다음 단계 · 전체 ${off+1}-${off+p[k]}단계`});
   delete part.levels;delete part.parts;if(n.short)part.short=n.short+' '+roman[k+1];
   n.parts.push(part.id);list.push(part);prev=part;off+=p[k];
  }
 }
 D.tree.splice(0,D.tree.length,...list);
 // What the routine's branch bonus raises (core.js branchBonus), in the words the game already uses (no node names, D3).
 const BR={hand:'지팡이 힘',collection:'마술 실력',luck:'얻는 동전',pet:'도우미 힘',finale:'피날레 힘',heart:'멘탈'};
 for(const r of D.routines){
  const rel=D.tree.find(n=>n.id===r.nodes[0]),at=place(rel)||place(rel,3.2);if(!at)throw new Error('v4 U48 N4: no free book place next to '+rel.id);used.add(at.x+','+at.y);
  const c0=Array.isArray(rel.cost)?rel.cost[0]:Math.ceil(rel.cost.c);
  D.tree.push({id:'routine-'+r.id,name:r.name+' 마술',desc:`${r.name} 루틴을 무대에서 보여 줘요\n${BR[r.branch]} +3%`,max:1,cost:[3*c0],currency:'coins',prereqs:[rel.id],x:at.x,y:at.y,reveal:'N',
   branch:rel.branch,routine:r.id,routineBranch:r.branch,icon:`icon-routine-${r.id}.png`,emoji:'🎩',pending:false});
 }
})(GAME_DATA);

// v4 U45: the owner's product order adds 클래식 2편 (x6 at venue 3) and moves 칼리 덱 / 틴 케이스 off the attack chain, so the later venues get stronger
// players; their doubt is scaled back so every TARGET of sim.mjs holds (measured with seeds 1001, see SPEC "v4 U45").
// v4 U48 (owner: about 3 hours, with 비법 learned only after a failure): the second factor of each product is the U48 change, chosen with
// 20-seed sim scouting (SPEC "v4 U48"). The early venues are paced by the case-coin income (core.js itemCoins 4 to 8); these factors take
// the long no-failure fights out of TV 오디션, TV 방송 and the late venues (달, 태양, 은하, 멀티버스) and bring 가족 거실 into 8-12 minutes.
// The final boss gets x1.12 so its battle stays 90-120 seconds against the stronger arrival build.
(function(D){
 const scale={family:0.78,meetup:0.85,audition:0.72*0.55,broadcast:0.7*0.6,vegas:0.95,moon:0.95*0.68,sun:0.94*0.68,galaxy:0.75,multiverse:0.93*0.66,lecturenote:0.93};
 D.venues.forEach(v=>{if(scale[v.slug])v.hpFactor*=scale[v.slug];});
 D.venues.find(v=>v.slug==='lecturenote').bossHpFactor*=1.12;
})(GAME_DATA);

// Achievement definitions also supply the save allowlist and UI presentation metadata.
(function(D){
  const old = new Set(['boxes','combo','slots','golden','helper','noDamage','finale','timed']);
  const rows = [
    ['boxes','상자 속 백 가지','케이스를 누적 100개 연다.','수집'],
    ['combo','박수 스물다섯','한 관객전에서 최고 액트 25를 달성한다.','손맛'],
    ['slots','아홉 칸 모자','케이스 자리를 9칸으로 늘린다.','수집'],
    ['golden','금빛 첫 인사','황금 케이스를 처음 연다.','수집'],
    ['helper','도우미의 손길','도우미가 케이스를 누적 25개 연다.','손맛'],
    ['noDamage','흔들림 없는 무대','도전 수첩을 배우고 멘탈 손상 없이 관객을 만족시킨다.','무대'],
    ['finale','피날레에 박수','도전 수첩을 배우고 피날레를 쓴 관객전에서 승리한다.','손맛'],
    ['timed','시간도 속였다','도전 수첩을 배우고 제한 시간 조건이 있는 관객을 시간 안에 만족시킨다.','무대'],
    ['reach-theater','막이 오른다','소극장에 도착한다.','무대','reach',6],
    ['reach-vegas','사막의 초대장','라스베가스에 도착한다.','무대','reach',10],
    ['reach-lecturenote','마지막 책장','렉쳐노트에 도착한다.','무대','reach',16],
    ['set1','첫 관객 앨범','도감 관객 세트를 1개 완성한다.','수집','sets',1],
    ['set4','네 무대의 얼굴','도감 관객 세트를 4개 완성한다.','수집','sets',4],
    ['set16','모두의 박수','도감 관객 세트를 16개 완성한다.','수집','sets',16],
    ['types2','양손의 비밀','마술용품을 2종류 수집한다.','수집','types',2],
    ['types4','소품 만물상','마술용품을 4종류 모두 수집한다.','수집','types',4],
    ['cosmetic1','새 옷 새 마술','의상 또는 케이스 꾸미기 1개를 소유한다.','수집','cosmetics',1],
    ['cosmetic5','마술사의 옷장','의상과 케이스 꾸미기를 합쳐 5개 소유한다.','수집','cosmetics',5],
    ['tap20','손끝 예열','빈 케이스·봉인을 두드리지 않고 유효 수동 탭을 20회 연속 한다. 관객전 변경 시 초기화된다.','손맛','tapStreakMax',20],
    ['tap100','백 번의 손짓','빈 케이스·봉인을 두드리지 않고 유효 수동 탭을 100회 연속 한다. 관객전 변경 시 초기화된다.','손맛','tapStreakMax',100],
    ['combo100','백 번의 박수','최고 액트 100을 달성한다.','손맛','comboMax',100],
    ['finale10','열 번의 커튼콜','피날레를 누적 10회 발사한다.','손맛','finales',10],
    ['finale100','끝나지 않는 앵콜','피날레를 누적 100회 발사한다.','손맛','finales',100],
    ['fever1','무대가 뜨거워','피버에 처음 진입한다.','손맛','fevers',1],
    ['fever10','열정의 마술사','피버에 누적 10회 진입한다.','손맛','fevers',10],
    ['crit100','정확한 백 발','결정타를 누적 100회 적중시킨다.','손맛','crits',100],
    ['cups1','컵 속의 정답','컵 게임에서 1회 정답을 맞힌다.','손맛','cupsWins',1],
    ['monte1','여왕을 찾아라','카드 몬테에서 1회 정답을 맞힌다.','손맛','monteWins',1],
    ['bossRetry3','아직 안 끝났어','같은 무대 보스에게 연속 3회 패배한다.','숨은 업적','bossLossStreak',3,true],
    ['run1000','모자 속 천 개','실패·재시작 없이 한 런에서 케이스를 1000개 연다.','숨은 업적','runBoxes',1000,true],
    ['mentalClutch','아슬아슬 커튼콜','남은 멘탈이 0 초과 10% 미만인 상태로 관객전에서 승리한다.','숨은 업적','mentalClutches',1,true],
    ['helper1000','나는 지휘자','도우미가 케이스를 누적 1000개 연다.','숨은 업적','helperBreaks',1000,true],
    ['golden10','금빛 토끼굴','황금 케이스를 누적 10개 연다.','숨은 업적','goldenOpened',10,true],
    ['montePerfect','여왕의 단골','카드 몬테 3라운드를 모두 맞히는 게임을 누적 3회 완주한다.','숨은 업적','montePerfects',3,true]
  ];
  const names=['거실의 기적','파티의 주인공','학교의 마술사','커피보다 마술','마니아도 깜짝','소극장 대성공','축제를 뒤집다','3등의 박수','전파 탄 마술','사막의 별','브로드웨이 커튼콜','달빛 손수건','그늘을 지나','몸짓의 박수','차원을 넘는 모자','책장을 덮으며'];
  D.venues.slice(0,16).forEach((v,i)=>rows.push(['clear-'+v.slug,names[i],v.name+' 보스를 처음 만족시킨다.','무대','clear',v.slug]));
  D.achievements=rows.map(([id,name,desc,group,metric,target,hidden=false])=>({id,name,desc,description:desc,group,hidden,metric,target,legacy:old.has(id)}));
})(GAME_DATA);

// Shared progress chart. Hidden IF nodes are revealed by saved unlock flags.
GAME_DATA.progressFork={
  after:'multiverse',
  main:['lecturenote','future'],
  mainChoice:'내가 될 수 있는 모습만 볼까?',
  ifChoice:'아직 어린 나도 만나 볼까?',
  ifRoute:[
    {id:'young-kali',name:'어린 칼리',dots:1},
    {id:'mirror-stage',name:'거울 속 무대',dots:3}
  ]
};

// Batch B: keep existing routine node ids for save compatibility; purchases use silk.
for (const id of ['eggbag','rubberband','coloringbook','cube','wand']) {
  const routine = GAME_DATA.routines.find(r => r.id === id);
  routine.shopCost = 10;
  const node = GAME_DATA.tree.find(n => n.id === 'routine-' + id);
  node.shopOnly = true;
  GAME_DATA.gemShop.push({id:'routine-' + id,name:routine.name,desc:'칼리가 공연하는 루틴에 추가해요',cost:routine.shopCost});
}

// Batch C: storyV15 is the editable source for stage, fight and curtain dialogue.
(function(D){
 const S=D.storyV15;
 const setMoods=value=>{if(!value||typeof value!=='object')return;if(value.speaker&&value.text&&!value.mood)value.mood=/진짜|변했|김이/.test(value.text)?'surprised':/좋|재미|박수/.test(value.text)?'happy':'serious';for(const child of Object.values(value))setMoods(child);};
 setMoods(S.tutorial);
 S.portraits={'강 마술사님':'assets/headliner-h5.png','수상한 샵 매니저':'assets/serona-hooded.png'};
 S.tutorial.overview=[S.tutorial.schoolChain.girlDuring[0],S.tutorial.schoolChain.upgrade[1],S.tutorial.defeat[3]];
 D.onboarding.intro=S.tutorial.schoolChain.girlIntro.map(l=>({line:l.text,art:'cards'}));
 for(const v of D.venues){
  const p=S.venues[v.slug];
  v.intro=p.opening[0].text;v.successLine=p.afterClear[0].text;
  for(const a of [...v.audiences,v.headliner]){
   const fight=S.fights[a.id];
   fight.heckles=[...new Set(fight.heckles)];
   if(fight.heckles.length===1&&!fight.heckles.includes(fight.winLine))fight.heckles.push(fight.winLine);
   Object.assign(a,fight);
   a.encounterLine=a.heckles[0];
   if(a===v.headliner){a.preLine=a.heckles[0];a.defeatLine=a.winLine;}
   a.heckles.forEach((text,i)=>D.lineFaces.moods['fight:'+a.id+':heckles:'+i]=/더 연습|실패|도박/.test(text)?'serious':/신기|CG|변했/.test(text)?'surprised':'serious');
   D.lineFaces.moods['fight:'+a.id+':winLine']='happy';
  }
 }
 D.lineFaces.roles.h1.name='여동생';D.lineFaces.roles.h5.name='밍기리';D.lineFaces.roles.h5.role='heckler';
 S.bios.h1='거실에서 마술을 본 여동생.';S.bios.h5=S.helper.bio;
 const family=D.venues.find(v=>v.slug==='family');
 Object.assign(family.headliner,{name:'여동생',portraitAsset:'aud-a1.png',bio:'거실에서 마술을 본 여동생.',flavor:'거실에서 마술을 본 여동생.'});
 const theater=D.venues.find(v=>v.slug==='theater');
 Object.assign(theater.headliner,{name:'밍기리',portraitAsset:'aud-mingiri-dark.png',role:'heckler',bio:S.helper.bio,flavor:S.helper.bio,storyScale:1.25});
 const sun=D.venues.find(v=>v.slug==='sun');sun.mergedInto='galaxy';sun.name='은하';sun.invitation.name='은하 초대장';
 D.tree.find(n=>n.id==='p-two-si-do').wall=D.tree.find(n=>n.id==='p-slydini-silks').wall;
 D.storyV15.venues.cafe.afterClear.push({speaker:'카드1412',text:'헤클러 앞에선 숨부터 쉬어유. 멘탈이 더 단단해진당.',mood:'serious'});
 D.dealer.introLines=S.dealerActs[0].filter(l=>l.speaker===D.dealer.name).map(l=>l.text);
 D.story.reveal=S.venues.multiverse.afterClear.filter(l=>!l.secretSkill).map(l=>l.text);
 for(const [key,p] of Object.entries(D.ifRouteScript)){if(!p||typeof p!=='object')continue;const name=S.secretSkills[key];if(name)p.afterClear.push({speaker:'칼리',text:'비법 「'+name+'」을 배웠어요.',mood:'happy',secretSkill:name});}
})(GAME_DATA);

// Batch D shared tuning. Only these two spectators interfere, one case at a time.
GAME_DATA.batchD = {
 interference:{durationMs:2500,intervalMs:12000,characters:{a9:'lock',a12:'hide'}},
 encore:{durationMs:15000,hpFactor:0.25,rewardFactor:0.5,damageFactor:1.15},
 rebirth:{permanentBonus:0.1},
 stages:{
  young:{name:'어린 칼리와의 대결',character:'어린 칼리',portrait:'assets/aud-past-kali.png',hpFactor:1.1,damageFactor:1.05,script:'youngKaliDuel'},
  mirror:{name:'거울 속 무대',character:'완벽한 칼리',portrait:'assets/aud-future-kali.png',hpFactor:1.5,damageFactor:1.2,script:'mirrorStage'}
 },
 twist:{venue:'meetup',products:['p-classic-collection-remastered','p-classic-collection-remastered-2'],threshold:0.1,hiddenMs:4000,failures:3,damageReduction:0.9,mentalCap:0.1,cutsceneMs:4200}
};
// Derive the legacy ending API from the reviewed stage lines.
GAME_DATA.venues.find(v=>v.slug==='lecturenote').headliner.endingLines=GAME_DATA.storyReview.lecturenote.afterClear.filter(l=>!l.secretSkill).map(l=>l.text);
