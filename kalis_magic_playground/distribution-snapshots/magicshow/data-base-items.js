GAME_DATA.items = {
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
  };

