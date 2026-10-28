GAME_DATA.dealer = {
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
  };

