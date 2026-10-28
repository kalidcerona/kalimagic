GAME_DATA.venues = [
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
        // bench keeps id a1 for saves and the collection book, but she is not a regular fight. The sister appears once, as boss h1.
        { id: "a1", name: "여동생", emoji: "👧", portraitAsset: "aud-f-sister.png", flavor: "거실에서 마술을 본 동생.", bench: true, extra: { type: "none", value: 0 } },
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
        name: "생일 주인공",
        emoji: "🥳",
        flavor: "한 번 더를 외치는 생일 주인공.",
        pattern: "none",
        preLine: "카드는 아무거나 고를게.",
        defeatLine: "내가 고른 그 이름이잖아."
      },
      audiences: [
        { id: "a4", name: "지호", emoji: "🎈", flavor: "풍선 장식을 맡은 친구.", extra: { type: "finisher", value: 1 } },
        { id: "a5", name: "운동 친구", emoji: "🎧", flavor: "운동하다 만나 파티에 온 친구.", extra: { type: "noDamage", value: 0 } },
        { id: "a6", name: "민재", emoji: "🎂", flavor: "촛불을 미루는 친구.", extra: { type: "timeLimit", value: 40 } }
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
        { id: "a7", name: "수빈", emoji: "✏️", flavor: "교실에서 먼저 본 짝꿍.", extra: { type: "combo", value: 8 } },
        { id: "a8", name: "반장", emoji: "📣", flavor: "축제 무대를 연 반장.", extra: { type: "finisher", value: 1 } },
        { id: "a9", name: "정아 선배", emoji: "🧑‍🎓", flavor: "순서를 깐깐히 보는 선배.", extra: { type: "noDamage", value: 0 } },
        { id: "a46", name: "승민 선배", emoji: "🏀", flavor: "운동장 앞줄을 맡는 선배.", extra: { type: "timeLimit", value: 65 } }
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
      // s5a (owner 10-23): 카드1412 is the cafe headliner. id h4 and pattern stay, so saves at this fight still load.
      // He fights hooded (headliner-card1412 stages) and talks with the hood down after the clear (ui.js speakerPortrait).
      headliner: {
        id: "h4",
        name: "카드1412",
        emoji: "🃏",
        portraitAsset: "headliner-card1412.png",
        flavor: "솔바람 마을에서 온 원정 마술사.",
        pattern: "slow",
        preLine: "보여 줘유. 나도 좀 한당.",
        defeatLine: "존경스럽당. 형 동생 하자유."
      },
      // s5a: the former headliner 단골 손님 stays in the cafe as a regular of the crowd: story speaker and curtain call cast with
      // his fixed line. Not a fight slot (a new audience id would need a save-schema change), so core never reads this list.
      regulars: [
        { id: "cafe-regular", name: "단골 손님", emoji: "☕", portraitAsset: "headliner-h4.png", flavor: "TV와 다르다고 말한 단골." }
      ],
      audiences: [
        { id: "a10", name: "노트북 손님", emoji: "💻", flavor: "노트북을 덮고 보는 손님.", extra: { type: "timeLimit", value: 50 } },
        { id: "a11", name: "디저트 손님", emoji: "🍰", flavor: "포크를 내려놓은 손님.", extra: { type: "combo", value: 10 } },
        { id: "a12", name: "창가 손님", emoji: "🪟", flavor: "창가 자리를 맡은 손님.", extra: { type: "finisher", value: 1 } },
        { id: "a50", name: "바리스타님", emoji: "👨‍🍳", flavor: "잔을 내려놓고 보는 바리스타.", extra: { type: "combo", value: 14 } }
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
        name: "유명 마술사",
        emoji: "🎭",
        flavor: "객석에서 손을 든 유명 마술사.",
        pattern: "sealBox",
        preLine: "저요, 저요, 저요.",
        defeatLine: "좋아. 나는 객석에 있을게."
      },
      audiences: [
        { id: "a13", name: "앞줄 열성팬", emoji: "👏", flavor: "앞줄에서 박수를 준비하는 팬.", extra: { type: "noDamage", value: 0 } },
        { id: "a14", name: "앞줄 관객", emoji: "📖", flavor: "부담 끝에 고른 앞줄 관객.", extra: { type: "timeLimit", value: 60 } },
        { id: "a15", name: "지하철 손님", emoji: "🤫", flavor: "카드를 걷어 맞혀 보라던 손님.", extra: { type: "combo", value: 12 } },
        { id: "a54", name: "메모하는 관객", emoji: "✍️", flavor: "장면마다 노트에 적는 관객.", extra: { type: "finisher", value: 1 } },
        { id: "a55", name: "커튼콜 팬", emoji: "👏", flavor: "막을 내린 뒤에도 남는 팬.", extra: { type: "noDamage", value: 0 } }
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
        name: "달려온 대학생",
        emoji: "🎙️",
        flavor: "멀리서 뛰어온 대학생.",
        pattern: "stealCoins",
        preLine: "저희도 마술 보여주세요",
        defeatLine: "축제가 더 밝아졌어요!"
      },
      audiences: [
        { id: "a16", name: "칼리 열혈팬 1223호", emoji: "🚩", flavor: "친근하고 무뚝뚝한 카드 팬.", extra: { type: "finisher", value: 1 } },
        { id: "a17", name: "아는 동생", emoji: "🍗", flavor: "치킨 내기를 한 동생.", extra: { type: "combo", value: 12 } },
        { id: "a18", name: "과 후배", emoji: "🎤", flavor: "같은 과에서 응원 온 후배.", extra: { type: "noDamage", value: 0 } },
        { id: "a59", name: "밴드 동아리", emoji: "🎸", flavor: "공연 전에 음을 맞추는 동아리.", extra: { type: "noDamage", value: 0 } },
        { id: "a60", name: "응원단", emoji: "✨", flavor: "야광봉을 든 응원단.", extra: { type: "timeLimit", value: 80 } }
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
        name: "심사위원장",
        emoji: "📺",
        flavor: "마지막 장면을 보는 심사위원장.",
        pattern: "heal",
        preLine: "상황은 웃겨도, 무대는 볼게요.",
        defeatLine: "3등입니다. 축하해요."
      },
      audiences: [
        { id: "a19", name: "진행자 친구", emoji: "📋", flavor: "참가자를 부르는 진행자 친구.", extra: { type: "timeLimit", value: 70 } },
        { id: "a20", name: "카메라 감독님", emoji: "🎥", flavor: "클로즈업을 맡는 감독.", extra: { type: "noDamage", value: 0 } },
        { id: "a21", name: "일본 참가자", emoji: "😏", flavor: "호텔 행사에서 온 참가자.", extra: { type: "finisher", value: 1 } },
        { id: "a64", name: "호텔 직원", emoji: "📝", flavor: "행사 방을 안내하는 직원.", extra: { type: "timeLimit", value: 85 } },
        { id: "a65", name: "구경 온 손님", emoji: "🎤", flavor: "통로에 서서 보는 손님.", extra: { type: "combo", value: 17 } },
        { id: "a66", name: "웃음 많은 관객", emoji: "📺", flavor: "장면마다 먼저 웃는 관객.", extra: { type: "finisher", value: 1 } }
      ]
    },
    {
      id: 8, balanceRank: 7.5, hpFactor: 1.2, slug: "broadcast", name: "TV 방송", crowd: 75, crowdEmoji: "📺👏",
      venueAsset: "venue-tv-broadcast.png", crowdAsset: "crowd-tv.png",
      intro: "오늘은 유튜브 방송이에요.", successLine: "노련미, 예술 그 자체네요.", trophy: "생방송 스타",
      palette: { bg1: "#14283f", bg2: "#436887", accent: "#70e8ff" },
      headliner: { id: "h-broadcast", name: "패널님", emoji: "🎤", portraitAsset: "headliner-tv.png", flavor: "노련미를 말해 준 패널.", pattern: "slow", preLine: "말이 너무 빠르다, 그 말 기억나요?", defeatLine: "노련미, 예술 그 자체네요." },
      audiences: [
        { id: "a112", name: "PD님", emoji: "📺", portraitAsset: "aud-tv1.png", flavor: "TV 방송 본선을 여는 PD.", extra: { type: "timeLimit", value: 85 } },
        { id: "a113", name: "작가님", emoji: "📺", portraitAsset: "aud-tv2.png", flavor: "큐를 적는 방송 작가.", extra: { type: "combo", value: 18 } },
        { id: "a114", name: "음향 감독님", emoji: "📺", portraitAsset: "aud-tv3.png", flavor: "마이크 거리를 맞추는 감독.", extra: { type: "noDamage", value: 0 } },
        { id: "a115", name: "방청객", emoji: "📺", portraitAsset: "aud-tv4.png", flavor: "빠른 진행에도 즐겁게 보는 사람.", extra: { type: "finisher", value: 1 } },
        { id: "a116", name: "옆자리 패널", emoji: "📺", portraitAsset: "aud-tv5.png", flavor: "같은 테이블의 패널.", extra: { type: "timeLimit", value: 90 } },
        { id: "a117", name: "조명 감독님", emoji: "📺", portraitAsset: "aud-tv6.png", flavor: "피날레에 조명을 밝히는 감독.", extra: { type: "combo", value: 20 } }
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
        { id: "a24", name: "대니", emoji: "💂", flavor: "복도를 도는 경비.", extra: { type: "noDamage", value: 0 } },
        { id: "a70", name: "에밀리", emoji: "🏨", flavor: "로비에서 멈춘 투숙객.", extra: { type: "combo", value: 18 } },
        { id: "a71", name: "소피아", emoji: "🌟", flavor: "쇼를 보러 온 팬.", extra: { type: "finisher", value: 1 } },
        { id: "a72", name: "마크", emoji: "🎲", flavor: "지도를 접은 관광객.", extra: { type: "noDamage", value: 0 } }
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
        name: "리사",
        emoji: "🌟",
        flavor: "신기해서 분이 난 관객.",
        pattern: "slow",
        preLine: "아, 너무 신기해서 분이 나!",
        defeatLine: "그 마음이 여기까지 와요."
      },
      audiences: [
        { id: "a25", name: "제인", emoji: "🎶", flavor: "뮤지컬을 보러 온 관객.", extra: { type: "finisher", value: 1 } },
        { id: "a26", name: "톰", emoji: "🎟️", flavor: "뉴욕에 처음 온 관광객.", extra: { type: "combo", value: 15 } },
        { id: "a27", name: "평론가", emoji: "🧐", flavor: "막간에 한 줄 적는 사람.", extra: { type: "timeLimit", value: 80 } },
        { id: "a76", name: "벤", emoji: "🎟️", flavor: "티켓 조각을 모으는 사람.", extra: { type: "finisher", value: 1 } },
        { id: "a77", name: "클로이", emoji: "🩰", flavor: "동작을 끝까지 보는 관객.", extra: { type: "noDamage", value: 0 } },
        { id: "a78", name: "헨리", emoji: "🎼", flavor: "마지막 음에 박수를 넣는 사람.", extra: { type: "timeLimit", value: 95 } },
        { id: "a79", name: "미아", emoji: "👗", flavor: "무대 의상을 보는 사람.", extra: { type: "combo", value: 19 } }
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
        { id: "a28", name: "돌계단 관객", emoji: "🧑‍🚀", flavor: "해운대 돌계단에 모인 관객.", extra: { type: "noDamage", value: 0 } },
        { id: "a29", name: "동료 마술사", emoji: "🛰️", flavor: "카드를 집어 간 동료.", extra: { type: "finisher", value: 1 } },
        { id: "a30", name: "탐사차 기사님", emoji: "🚙", flavor: "달 표면을 도는 운전 담당.", extra: { type: "combo", value: 18 } },
        { id: "a83", name: "달 박사님", emoji: "🔭", flavor: "인원을 노트에 적는 박사.", extra: { type: "noDamage", value: 0 } },
        { id: "a84", name: "별가루 수집가", emoji: "🌟", flavor: "별가루를 통에 담는 사람.", extra: { type: "timeLimit", value: 100 } },
        { id: "a85", name: "정비 대원", emoji: "🧑‍🚀", flavor: "통로 장비를 치우는 대원.", extra: { type: "combo", value: 20 } },
        { id: "a86", name: "달 관광객", emoji: "🚀", flavor: "야경 대신 무대를 보는 손님.", extra: { type: "finisher", value: 1 } }
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
        name: "햇살 안내자",
        emoji: "☀️",
        flavor: "눈부신 쪽을 안내하는 사람.",
        pattern: "stealCoins",
        preLine: "눈 감으면 바람이 먼저야.",
        defeatLine: "그늘에서 숨 돌리죠."
      },
      audiences: [
        { id: "a31", name: "빛바람 서퍼", emoji: "🔥", flavor: "빛을 등지고 서는 서퍼.", extra: { type: "timeLimit", value: 90 } },
        { id: "a32", name: "그늘 안내원", emoji: "🌞", flavor: "눈 시린 쪽에 그늘을 안내한다.", extra: { type: "combo", value: 18 } },
        { id: "a33", name: "역광 사진사", emoji: "📷", flavor: "눈부신 역광을 찍는 사람.", extra: { type: "finisher", value: 1 } },
        { id: "a90", name: "빛 연구원", emoji: "🧪", flavor: "빛 세기를 중얼거리는 사람.", extra: { type: "timeLimit", value: 105 } },
        { id: "a91", name: "햇빛 여행자", emoji: "🕶️", flavor: "그늘 자리를 찾는 여행자.", extra: { type: "combo", value: 21 } },
        { id: "a92", name: "빛 관측원", emoji: "🔭", flavor: "필터 없이 빛을 보는 사람.", extra: { type: "finisher", value: 1 } },
        { id: "a93", name: "파도 서퍼", emoji: "🏄", flavor: "빛바람의 결을 타는 서퍼.", extra: { type: "noDamage", value: 0 } },
        { id: "a94", name: "모자 사진사", emoji: "📷", flavor: "모자를 붙잡고 찍는 사람.", extra: { type: "timeLimit", value: 105 } }
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
        name: "타코야키 줄 손님",
        emoji: "👽",
        flavor: "일본 노점 줄의 손님.",
        pattern: "heal",
        preLine: "하나! 빨강!",
        defeatLine: "하나, 둘, 셋!"
      },
      audiences: [
        { id: "a34", name: "마술샵 손님", emoji: "👽", flavor: "중국 마술샵 줄의 손님.", extra: { type: "combo", value: 20 } },
        { id: "a35", name: "UFO 조종사", emoji: "🛸", flavor: "말없이 속도를 맞추는 조종사.", extra: { type: "noDamage", value: 0 } },
        { id: "a36", name: "별자리 선생님", emoji: "✨", flavor: "하나 둘 셋을 읽는 선생님.", extra: { type: "timeLimit", value: 100 } },
        { id: "a98", name: "우주 악사", emoji: "🎹", flavor: "구호에 박자를 얹는 악사.", extra: { type: "combo", value: 22 } },
        { id: "a99", name: "별 사진사", emoji: "📸", flavor: "빨강과 검정을 한 장에 담는다.", extra: { type: "finisher", value: 1 } },
        { id: "a100", name: "은하 안내원", emoji: "🌌", flavor: "손짓으로 줄을 안내하는 사람.", extra: { type: "noDamage", value: 0 } },
        { id: "a101", name: "혜성 레이서", emoji: "☄️", flavor: "구호에 속도를 맞추는 레이서.", extra: { type: "timeLimit", value: 110 } },
        { id: "a102", name: "소원 여행자", emoji: "✨", flavor: "빨강과 검정 중 하나를 고르는 사람.", extra: { type: "combo", value: 22 } }
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
        flavor: "의심이 많아도 자리를 지키는 나.",
        pattern: "twoPhase",
        preLine: "난 의심이 많아도 끝까지 해 온 너다.",
        phase2Line: "그만두고 싶었던 적은 없어.",
        defeatLine: "모습은 달라도 좋다."
      },
      audiences: [
        { id: "a37", name: "농장 게임만 하는 칼리", emoji: "🪞", flavor: "농장 게임만 하는 다른 칼리.", extra: { type: "finisher", value: 1 } },
        { id: "a38", name: "연습실 앞의 나", emoji: "🚪", flavor: "문 앞에서도 카드를 만지는 나.", extra: { type: "timeLimit", value: 120 } },
        { id: "a39", name: "마술 쉰 나", emoji: "🃏", flavor: "쉬다가 다시 마술하는 나.", extra: { type: "combo", value: 20 } },
        { id: "a106", name: "용기 낸 나", emoji: "💫", flavor: "먼저 한 걸음을 내디딘 나.", extra: { type: "finisher", value: 1 } },
        { id: "a107", name: "객석의 나", emoji: "👏", flavor: "객석에 앉아 박수를 준비하는 나.", extra: { type: "noDamage", value: 0 } },
        { id: "a108", name: "잠시 쉰 나", emoji: "🪞", flavor: "거울 너머의 내가 웃는다.", extra: { type: "timeLimit", value: 115 } },
        { id: "a109", name: "막 시작한 나", emoji: "🪄", flavor: "이제 막 카드를 펼친 나.", extra: { type: "combo", value: 23 } },
        { id: "a110", name: "계속한 칼리", emoji: "🎩", flavor: "마술을 계속 보여 준 칼리.", extra: { type: "finisher", value: 1 } },
        { id: "a111", name: "박수 보내는 나", emoji: "💫", flavor: "의심 뒤에 박수를 보내는 나.", extra: { type: "noDamage", value: 0 } }
      ]
    }
  ];

