    const MNEMONICA = [
      "4C","2H","7D","3C","4H","6D","AS","5H","9S","2S",
      "QH","3D","QC","8H","6S","5S","9H","KC","2D","JH",
      "3S","8S","6H","10C","5D","KD","2C","3H","8D","5C",
      "KS","JD","8C","10S","KH","JC","7S","10H","AD","4S",
      "7H","4D","AC","9C","JS","QD","7C","QS","10D","6C",
      "AH","9D"
    ];

    const CARD_SUIT_LETTERS = { 1: "S", 2: "H", 3: "C", 4: "D" };
    const CARD_SUIT_SYMBOLS = { S: "♠", H: "♥", C: "♣", D: "♦" };
    const CARD_VALUE_LABELS = { 1: "A", 11: "J", 12: "Q", 13: "K" };
    const TWO_DIGIT_CARD_CODE = /^([1-4])([1-9])$/;
    const THREE_DIGIT_CARD_CODE = /^([1-4])(1[0-3])$/;
    const STACK_CARD_CODE = /^(10|[2-9]|[AJQK])([SHCD])$/;

    function parseCardCode(str) {
      const source = String(str ?? "");
      const code = TWO_DIGIT_CARD_CODE.exec(source) ??
        THREE_DIGIT_CARD_CODE.exec(source);
      return code === null
        ? null
        : { suit: code[1], value: Number(code[2]) };
    }

    function cardToStackCode({ suit, value }) {
      return `${CARD_VALUE_LABELS[value] ?? value}${CARD_SUIT_LETTERS[suit]}`;
    }

    function formatStackCard(stackCode) {
      const card = STACK_CARD_CODE.exec(stackCode);
      return `${CARD_SUIT_SYMBOLS[card[2]]}${card[1]}`;
    }

    function mnemonicaLookup(text) {
      const source = String(text ?? "");
      if (!/^\d+$/.test(source)) return { position: null, card: null };

      const cardCode = parseCardCode(source);
      let position = null;
      let card = null;

      if (cardCode !== null) {
        const stackCode = cardToStackCode(cardCode);
        const index = MNEMONICA.indexOf(stackCode);
        position = index === -1 ? null : index + 1;
      }

      const stackPosition = Number(source);
      if (Number.isInteger(stackPosition) && stackPosition >= 1 && stackPosition <= 52) {
        card = formatStackCard(MNEMONICA[stackPosition - 1]);
      }

      return { position, card };
    }

    function mnemonicaCutLookup(text) {
      const source = String(text ?? "");
      if (!/^\d{4,5}$/.test(source)) return null;

      const cardCode = source.slice(0, -2);
      const target = Number(source.slice(-2));
      const card = parseCardCode(cardCode);
      if (card === null || target < 1 || target > 52) return null;

      const stackCode = cardToStackCode(card);
      const position = MNEMONICA.indexOf(stackCode) + 1;
      const cut = (position - target + 52) % 52;
      const bottomCode = MNEMONICA[cut === 0 ? 51 : cut - 1];

      return { cut, bottom: formatStackCard(bottomCode) };
    }

    function undoSetupLookup(text) {
      const source = String(text ?? "");
      if (!/^\d{3,4}$/.test(source)) return null;

      const hour = Number(source.slice(0, -2));
      const minute = Number(source.slice(-2));
      const r1 = Math.min(hour, minute);
      const r2 = Math.max(hour, minute);
      if (r1 < 1 || r1 >= r2 || r2 > 52) return null;

      return {
        upper: 53 - r2,
        lower: r1 + 54 - r2
      };
    }

