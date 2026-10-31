GAME_DATA.dealer = {
    name: "수상한 샵 매니저",
    cardVenue: 2,
    slotVenue: 5,
    introLines: [
      "모자를 깊게 눌러쓴 샵 매니저가 웃는다. 컵앤볼이냐, 카드 몬테냐. 골라 봐."
    ],
    firstMeeting: [
      {speaker: "칼리", text: "왜 손이 3개인가요?", mood: "surprised"},
      {speaker: "수상한 샵 매니저", text: "수상하니까요.", mood: "serious"},
      {speaker: "칼리", text: "아, 납득했슴돠. ㅋㅋ", mood: "happy"},
      {speaker: "수상한 샵 매니저", text: "컵앤볼도, 카드 몬테도 있어요.", mood: "serious"},
      {speaker: "수상한 샵 매니저", text: "한 판 해 볼래요? 손은 잘 보고요.", mood: "happy"}
    ],
    // g1: spoken once, when the player buys the 렉노 패드. She does not say who she is.
    padMention: [
      {speaker: "수상한 샵 매니저", text: "후후. 그 패드가 전부인 줄 알았어요?", mood: "happy"},
      {speaker: "수상한 샵 매니저", text: "안 파는 패드가 하나 더 있어요.", mood: "serious"},
      {speaker: "수상한 샵 매니저", text: "컵앤볼이랑 카드 몬테, 저한테 다섯 번 연속으로 이기면 가져가요.", mood: "happy"},
      {speaker: "수상한 샵 매니저", text: "손은 잘 보고요.", mood: "serious"}
    ],
    padReward: [
      {speaker: "수상한 샵 매니저", text: "다섯 번이나. 제가 졌네요.", mood: "serious"},
      {speaker: "수상한 샵 매니저", text: "특별한 패드, 가져가요. 옷장에서 깔아 봐요.", mood: "happy"}
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
  };

