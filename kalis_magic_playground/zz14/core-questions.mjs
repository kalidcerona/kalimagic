import {
  STACK_LETTERS,
  DIGIT_OF,
  LETTER_OF,
  LETTER_NAME,
  LINES,
  FIRST_PAGE_PI,
  MODES,
  ODD_PAGES,
  STACK_DIGITS,
  lineDigits,
  lineCompact,
  pageLocus,
  pad2,
  birthdayAddress,
  allMonthDays,
} from "./core-stack.mjs";
import {
  lieCandidates,
  givenWindow,
  continuationsForGiven,
} from "./core-windows.mjs";

export {
  phraseQuestion,
  mapQuestion,
  rowQuestion,
  oddQuestion,
  nextQuestion,
  birthdayQuestion,
};

function mapHint(answer) {
  if (answer.kind === "digit") {
    return Number(answer.prompt) < 5
      ? "대응 글자는 앞쪽 다섯 글자 안에 있습니다."
      : "대응 글자는 뒤쪽 다섯 글자 안에 있습니다.";
  }
  return Number(answer.digit) < 5
    ? "대응 숫자는 앞쪽 다섯 숫자 안에 있습니다."
    : "대응 숫자는 뒤쪽 다섯 숫자 안에 있습니다.";
}

function rowHint(answer) {
  if (answer.kind === "sequence") return "첫 줄의 첫 글자는 O입니다. 다섯 줄을 빈칸 없이 이어 써도 됩니다.";
  if (answer.kind === "english" || answer.kind === "next-english") {
    return `첫 글자는 ${answer.letters[0]}입니다.`;
  }
  return `앞 두 숫자는 ${answer.digits.slice(0, 2)}입니다. 앞의 0도 씁니다.`;
}

function oddHint(answer) {
  if (answer.special === "pi") return "52자리 순환 공식을 쓰지 않습니다. 실제 원주율의 시작 세 자리입니다.";
  return `${answer.page}쪽은 암기 줄 ${answer.row}, ${answer.column}번째 글자에서 세 글자입니다.`;
}

function nextHint(answer) {
  const prefixes = [...new Set(answer.nexts.map((next) => next.slice(0, 2)))];
  if (prefixes.length === 1) return `다음 두 자리는 ${prefixes[0]}입니다. 앞의 0도 씁니다.`;
  return "같은 다섯 자리가 순환 안에 둘 이상입니다. 맞는 다음 열 자리면 됩니다.";
}

function birthdayHint(answer) {
  return answer.order === "MMDD"
    ? "쪽은 일+50, 줄은 월×2, 시작은 월+3입니다."
    : "쪽은 일+50, 줄은 월×2, 시작은 월+1입니다.";
}

function lieHint() {
  return "실제 구간과 정확히 한 자리만 다릅니다. 위치는 1부터이고, 맞는 후보면 모두 정답입니다.";
}

function withMeta(question) {
  return {
    hintUsed: false,
    usedReveal: false,
    showHint: false,
    graded: null,
    draft: "",
    ...question,
  };
}

function phraseQuestion(row, word) {
  const line = LINES[row];
  if (!line) throw new Error("row out of range");
  const digits = lineDigits(row);
  const answer = {
    type: "phrase",
    row,
    phrase: line.phrase,
    letters: lineCompact(row),
    digits,
  };
  return withMeta({
    mode: "phrase",
    key: `phrase:${row}`,
    public: {
      kicker: "문장 대응",
      big: word === 0 || word === 1 ? line.phrase.split(" ")[word] : line.phrase,
      bigClass: "phrase-prompt",
      note: "영어 문장 전체의 숫자열입니다. 앞의 0도 포함합니다.",
      placeholder: "",
      phonetic: "",
    },
    hint: "",
    answer,
    ...(word === 0 || word === 1 ? { word } : {}),
  });
}

export function phraseNextQuestion(row, length = 5, word) {
  if (!LINES[row] || ![5, 10].includes(length)) throw new Error("bad phrase sequence");
  const prompt = phraseQuestion(row, word);
  const rows = Array.from({ length }, (_, i) => (row + i + 1) % LINES.length);
  return withMeta({
    mode: "phrase-next",
    key: `phrase-next:${row}:${length}`,
    public: { ...prompt.public, kicker: "이어서 문장", note: `이 문장 다음부터 ${length}개 문장과 숫자열을 순서대로 떠올립니다.` },
    hint: "마지막 문장 다음은 첫 문장으로 돌아갑니다.",
    answer: { type: "phrase-next", row, length, rows },
    ...(word === 0 || word === 1 ? { word } : {}),
  });
}

function mapQuestion(kind, symbol) {
  const digit = kind === "digit" ? String(symbol) : DIGIT_OF[symbol];
  const letter = kind === "digit" ? LETTER_OF[Number(symbol)] : symbol;
  const answer = { type: "map", kind, prompt: String(symbol), digit, letter };
  return withMeta({
    mode: "map",
    key: `map:${kind}:${symbol}`,
    public: {
      kicker: kind === "digit" ? "숫자 → 글자" : "글자 → 숫자",
      big: String(symbol),
      bigClass: kind === "digit" ? "glyph-digit" : "glyph-letter",
      note: kind === "digit" ? "대응 글자 하나를 입력합니다." : "대응 숫자 하나를 입력합니다.",
      placeholder: kind === "digit" ? "글자" : "숫자",
      phonetic: kind === "letter" ? LETTER_NAME[letter] : "",
    },
    hint: mapHint(answer),
    answer,
  });
}

function rowQuestion(kind, row) {
  const from = kind.startsWith("next-") ? row : null;
  const target = kind.startsWith("next-") ? (row + 1) % 5 : row;
  const line = LINES[target];
  let publicBig = `줄 ${target}`;
  let note = kind.includes("english") ? "영어 철자를 입력합니다." : "숫자열을 입력합니다. 앞의 0도 포함합니다.";
  if (kind === "sequence") {
    publicBig = "다섯 줄";
    note = "영어 암기어를 첫 줄부터 순서대로 입력합니다.";
  } else if (kind.startsWith("next-")) {
    publicBig = `줄 ${row} 다음`;
    note = kind === "next-english"
      ? "다음 암기 줄의 영어 철자입니다. 마지막 다음은 첫 줄입니다."
      : "다음 암기 줄의 숫자열입니다. 마지막 다음은 첫 줄입니다.";
  }
  const answer = {
    type: "row",
    kind,
    row: target,
    from,
    letters: kind === "sequence" ? STACK_LETTERS : lineCompact(target),
    digits: kind === "sequence" ? STACK_DIGITS : lineDigits(target),
    phrase: kind === "sequence" ? LINES.map((item) => item.phrase).join(" ") : line.phrase,
  };
  return withMeta({
    mode: "row",
    key: `row:${kind}:${kind.startsWith("next-") ? row : target}`,
    public: {
      kicker: "다섯 줄",
      big: publicBig,
      bigClass: "locus-title",
      note,
      placeholder: note.includes("숫자") ? "숫자열" : "영어 철자",
      phonetic: "",
    },
    hint: rowHint(answer),
    answer,
  });
}

function oddQuestion(page) {
  if (page === 1) {
    const answer = { type: "odd", special: "pi", digits: FIRST_PAGE_PI, letters: "" };
    return withMeta({
      mode: "odd",
      key: "odd:pi",
      public: {
        kicker: "1쪽 예외",
        big: "1쪽",
        bigClass: "locus-title",
        note: "첫 세 숫자. 52자리 순환이 아닙니다.",
        placeholder: "세 숫자",
        phonetic: "",
      },
      hint: oddHint(answer),
      answer,
    });
  }
  const locus = pageLocus(page);
  if (!locus.ok) throw new Error(`bad odd page ${page}`);
  const answer = {
    type: "odd",
    special: "",
    page,
    row: locus.row,
    column: locus.column,
    letters: locus.letters,
    digits: locus.digits,
  };
  return withMeta({
    mode: "odd",
    key: `odd:${page}`,
    public: {
      kicker: "페이지 2",
      big: `${page}쪽`,
      bigClass: "locus-title",
      note: "첫 세 숫자 또는 대응 글자 세 개를 입력합니다.",
      placeholder: "세 숫자 또는 세 글자",
      phonetic: "",
    },
    hint: oddHint(answer),
    answer,
  });
}

function nextQuestion(start) {
  const given = givenWindow(start, 5);
  const nexts = [...new Set(continuationsForGiven(given).map((hit) => hit.next))];
  const answer = { type: "next", start, given, nexts };
  return withMeta({
    mode: "next",
    key: `next:${start}`,
    public: {
      kicker: "다음 열 자리",
      big: given,
      bigClass: "glyph-digit long",
      note: "보이는 다섯 자리 다음부터 숫자 열 개를 떠올립니다.",
      placeholder: "열 숫자",
      phonetic: "",
    },
    hint: nextHint(answer),
    answer,
  });
}

function birthdayQuestion(month, day, order) {
  const address = birthdayAddress(month, day, order);
  if (!address.ok) throw new Error("bad birthday");
  const answer = { type: "birthday", ...address };
  const shown = order === "MMDD" ? `${pad2(month)} ${pad2(day)}` : `${pad2(day)} ${pad2(month)}`;
  return withMeta({
    mode: "birthday",
    key: `birthday:${order}:${address.dateStr}`,
    public: {
      kicker: order === "MMDD" ? "생일 · 월일 MMDD" : "생일 · 일월 DDMM",
      big: shown,
      bigClass: "glyph-digit long",
      note: order === "MMDD"
        ? "순서는 월, 일입니다. 쪽, 줄, 시작 자리를 입력합니다."
        : "순서는 일, 월입니다. 쪽, 줄, 시작 자리를 입력합니다.",
      placeholder: "쪽 줄 자리",
      phonetic: "",
    },
    hint: birthdayHint(answer),
    answer,
  });
}

export function lieQuestion(heard) {
  const candidates = lieCandidates(heard);
  if (!candidates.length) return null;
  const answer = {
    type: "lie",
    heard: String(heard),
    candidates: candidates.map((candidate) => ({ ...candidate })),
  };
  return withMeta({
    mode: "lie",
    key: `lie:${heard}`,
    public: {
      kicker: heard.length === 7 ? "거짓말 · 7자리" : "거짓말 · 5자리",
      big: String(heard),
      bigClass: "glyph-digit long",
      note: "한 자리만 바뀌었습니다. 위치와 원래 숫자를 입력합니다.",
      placeholder: "위치 원래숫자",
      phonetic: "",
    },
    hint: lieHint(),
    answer,
  });
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function rand() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(rand, items) {
  const bag = items.slice();
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function takeCycle(rand, items, count) {
  const out = [];
  while (out.length < count) {
    out.push(...shuffle(rand, items));
  }
  return out.slice(0, count);
}

export function buildQuestions(mode, count, seed, options = {}) {
  if (!MODES.includes(mode)) throw new Error(`unknown mode ${mode}`);
  const total = clampCount(count);
  const rand = mulberry32(seed >>> 0);
  const mapPool = Array.isArray(options.mapSymbols) && options.mapSymbols.length
    ? options.mapSymbols
    : LETTER_OF.map((letter, index) => ({ kind: "digit", symbol: String(index) }))
      .concat(LETTER_OF.map((letter) => ({ kind: "letter", symbol: letter })));
  const questions = [];

  if (mode === "map") {
    const both = [
      ...LETTER_OF.map((_, index) => ({ kind: "digit", symbol: String(index) })),
      ...LETTER_OF.map((letter) => ({ kind: "letter", symbol: letter })),
    ];
    const symbols = mapPool.length ? mapPool : both;
    const picked = takeCycle(rand, symbols, total);
    const hasDigit = symbols.some((item) => item.kind === "digit");
    const hasLetter = symbols.some((item) => item.kind === "letter");
    if (total >= 2 && hasDigit && hasLetter) {
      if (!picked.some((item) => item.kind === "digit")) {
        picked[0] = symbols.find((item) => item.kind === "digit");
      }
      if (!picked.some((item) => item.kind === "letter")) {
        picked[1] = symbols.find((item) => item.kind === "letter");
      }
    }
    for (const item of picked) questions.push(mapQuestion(item.kind, item.symbol));
    return questions;
  }

  if (mode === "phrase") {
    const picked = takeCycle(rand, [0, 1, 2, 3, 4], total);
    for (const row of picked) {
      const word = options.phraseDisplay === "half" ? Math.floor(rand() * 2) : undefined;
      questions.push(phraseQuestion(row, word));
    }
    return questions;
  }

  if (mode === "row") {
    const kinds = ["english", "digits", "next-english", "next-digits"];
    const slots = [];
    for (const kind of kinds) for (let row = 0; row < 5; row += 1) slots.push({ kind, row });
    const picked = takeCycle(rand, slots, total);
    const sequenceAt = total >= 5 ? Math.floor(rand() * total) : (rand() < 0.2 ? 0 : -1);
    if (total >= 2 && !picked.some((item) => item.kind === "english")) picked[0] = { kind: "english", row: 0 };
    if (total >= 2 && !picked.some((item) => item.kind === "digits")) picked[Math.min(1, total - 1)] = { kind: "digits", row: 1 };
    if (total >= 3 && !picked.some((item) => String(item.kind).startsWith("next-"))) {
      picked[Math.min(2, total - 1)] = { kind: "next-digits", row: 4 };
    }
    picked.forEach((item, index) => {
      if (index === sequenceAt) questions.push(rowQuestion("sequence", 0));
      else questions.push(rowQuestion(item.kind, item.row));
    });
    const currentKinds = () => questions.map((question) => question.answer.kind);
    if (total >= 3 && !currentKinds().some((kind) => kind.startsWith("next-"))) {
      questions[total - 1] = rowQuestion("next-digits", 4);
    }
    if (total >= 2 && !currentKinds().some((kind) => kind === "digits" || kind === "next-digits")) {
      questions[0] = rowQuestion("digits", 0);
    }
    if (total >= 2 && !currentKinds().some((kind) => kind === "english" || kind === "sequence")) {
      questions[Math.min(1, total - 1)] = rowQuestion("english", 2);
    }
    return questions;
  }

  if (mode === "odd") {
    const piSlot = total === 1 ? (rand() < 0.5 ? 0 : -1) : Math.floor(rand() * total);
    const pages = takeCycle(rand, ODD_PAGES.slice(), total);
    pages.forEach((page, index) => {
      questions.push(oddQuestion(index === piSlot ? 1 : page));
    });
    return questions;
  }

  if (mode === "next") {
    const starts = takeCycle(rand, Array.from({ length: 52 }, (_, index) => index), total);
    for (const start of starts) questions.push(nextQuestion(start));
    return questions;
  }

  if (mode === "birthday") {
    const slots = [];
    for (const date of allMonthDays()) {
      slots.push({ ...date, order: "MMDD" });
      slots.push({ ...date, order: "DDMM" });
    }
    const picked = takeCycle(rand, slots, total);
    if (total >= 2 && !picked.some((item) => item.order === "MMDD")) {
      picked[0] = { month: 4, day: 12, order: "MMDD" };
    }
    if (total >= 2 && !picked.some((item) => item.order === "DDMM")) {
      picked[1] = { month: 4, day: 12, order: "DDMM" };
    }
    for (const item of picked) questions.push(birthdayQuestion(item.month, item.day, item.order));
    return questions;
  }

  throw new Error(`unknown mode ${mode}`);
}

export function clampCount(count) {
  const number = Number(count);
  if (!Number.isInteger(number)) return 10;
  return Math.min(30, Math.max(1, number));
}

export function buildSession({ mode = "map", count = 10, seed = 1, lieLength = 5, mapSymbols = null, phraseDisplay = "full", phraseLength = 5 } = {}) {
  const questions = buildQuestions(mode, count, seed, { lieLength, mapSymbols, phraseDisplay, phraseLength });
  return {
    version: 1,
    id: `s${(seed >>> 0).toString(36)}`,
    mode,
    count: questions.length,
    seed: seed >>> 0,
    phraseLength: phraseLength === 10 ? 10 : 5,
    lieLength: lieLength === 7 ? 7 : 5,
    index: 0,
    finished: false,
    statsPosted: false,
    accumulatedMs: 0,
    questions,
  };
}

export function freshQuestion(question) {
  return {
    ...question,
    public: { ...question.public },
    answer: JSON.parse(JSON.stringify(question.answer)),
    hintUsed: false,
    usedReveal: false,
    showHint: false,
    graded: null,
    draft: "",
  };
}
