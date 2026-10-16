/**
 * Pi Max practice rules. Answers are derived from the 52-letter cycle.
 * Page 1 pi (314) is never produced by this cycle.
 */

export const STACK_LETTERS = "OBESEGOATSINEPTBEINGNOISEAGAINEATENONIONAGINGPIANIST";

export const DIGIT_OF = Object.freeze({
  O: "0",
  I: "1",
  N: "2",
  E: "3",
  A: "4",
  S: "5",
  G: "6",
  T: "7",
  B: "8",
  P: "9",
});

export const LETTER_OF = Object.freeze(["O", "I", "N", "E", "A", "S", "G", "T", "B", "P"]);

/** Korean names of the Latin letters. Not word pronunciations and not digit values. */
export const LETTER_NAME = Object.freeze({
  O: "오",
  I: "아이",
  N: "엔",
  E: "이",
  A: "에이",
  S: "에스",
  G: "지",
  T: "티",
  B: "비",
  P: "피",
});

export const LINES = Object.freeze([
  Object.freeze({ row: 0, phrase: "OBESE GOATS", spoken: "오비스 고츠", start: 0, length: 10 }),
  Object.freeze({ row: 1, phrase: "INEPT BEING", spoken: "이넵트 비잉", start: 10, length: 10 }),
  Object.freeze({ row: 2, phrase: "NOISE AGAIN", spoken: "노이즈 어겐", start: 20, length: 10 }),
  Object.freeze({ row: 3, phrase: "EATEN ONION", spoken: "이튼 어니언", start: 30, length: 10 }),
  Object.freeze({ row: 4, phrase: "AGING PIANIST", spoken: "에이징 피애니스트", start: 40, length: 12 }),
]);

/** Genuine pi opening used only for the page-1 exception. Not a stack window. */
export const FIRST_PAGE_PI = "314";

/** Leap-year lengths so 29 February is accepted and 30 February is not. */
export const MONTH_DAYS = Object.freeze([0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);

export const MODES = Object.freeze(["map", "phrase", "row", "odd", "next", "birthday"]);

/** Modes removed from practice. Saved sessions and stats may still name them. */
const RETIRED_MODES = new Set(["phrase-next", "lie"]);

export const ODD_PAGES = Object.freeze(
  Array.from({ length: 24 }, (_, i) => 3 + i * 2),
);

const ROW_START = Object.freeze([0, 10, 20, 30, 40]);

export function lettersToDigits(letters) {
  let out = "";
  for (const ch of String(letters)) {
    const digit = DIGIT_OF[ch];
    if (digit == null) throw new Error(`Not a stack letter: ${ch}`);
    out += digit;
  }
  return out;
}

export const STACK_DIGITS = lettersToDigits(STACK_LETTERS);

export function lineDigits(row) {
  const line = LINES[row];
  if (!line) throw new Error("row out of range");
  return STACK_DIGITS.slice(line.start, line.start + line.length);
}

export function lineCompact(row) {
  const line = LINES[row];
  return line.phrase.replace(/ /g, "");
}

export function circularSlice(source, start, length) {
  const text = String(source);
  const size = text.length;
  if (!size || length < 0) return "";
  let out = "";
  for (let i = 0; i < length; i += 1) out += text[modulo(start + i, size)];
  return out;
}

function modulo(value, size) {
  return ((value % size) + size) % size;
}

/**
 * Odd-page locus. Page 1 is refused so callers cannot confuse it with the cycle.
 * Column is 1-based; a ones digit of 0 means the 10th letter.
 */
export function pageLocus(page) {
  if (!Number.isInteger(page)) return { ok: false, reason: "page" };
  if (page === 1) return { ok: false, reason: "pi-exception", pi: FIRST_PAGE_PI };
  if (page < 0 || page > 49) return { ok: false, reason: "range" };
  const row = Math.floor(page / 10);
  const ones = page % 10;
  const column = ones === 0 ? 10 : ones;
  const start = ROW_START[row];
  if (start == null || column < 1 || column > 12) return { ok: false, reason: "column" };
  const index = start + column - 1;
  if (index < 0 || index >= STACK_LETTERS.length) return { ok: false, reason: "index" };
  const letters = circularSlice(STACK_LETTERS, index, 3);
  return {
    ok: true,
    page,
    row,
    column,
    index,
    letters,
    digits: lettersToDigits(letters),
  };
}

export function isQuizOddPage(page) {
  return ODD_PAGES.includes(page);
}

export function isValidMonthDay(month, day) {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > MONTH_DAYS[month]) return false;
  return true;
}

export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function birthdayAddress(month, day, order) {
  if (!isValidMonthDay(month, day)) return { ok: false, reason: "date" };
  if (order !== "MMDD" && order !== "DDMM") return { ok: false, reason: "order" };
  const dateStr = order === "MMDD" ? pad2(month) + pad2(day) : pad2(day) + pad2(month);
  return {
    ok: true,
    month,
    day,
    order,
    dateStr,
    page: day + 50,
    line: month * 2,
    column: order === "MMDD" ? month + 3 : month + 1,
  };
}

export function allMonthDays() {
  const dates = [];
  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= MONTH_DAYS[month]; day += 1) dates.push({ month, day });
  }
  return dates;
}

export function hamming(left, right) {
  if (left.length !== right.length) return null;
  let distance = 0;
  for (let i = 0; i < left.length; i += 1) if (left[i] !== right[i]) distance += 1;
  return distance;
}

/** Every circular window whose Hamming distance to `heard` is exactly 1. */
export function lieCandidates(heard) {
  const probe = String(heard);
  if (!/^[0-9]+$/.test(probe)) return [];
  const found = [];
  for (let start = 0; start < STACK_DIGITS.length; start += 1) {
    const actual = circularSlice(STACK_DIGITS, start, probe.length);
    const diffs = [];
    for (let i = 0; i < probe.length; i += 1) if (actual[i] !== probe[i]) diffs.push(i);
    if (diffs.length !== 1) continue;
    const at = diffs[0];
    found.push({
      start,
      position: at + 1,
      original: actual[at],
      heardDigit: probe[at],
      actual,
    });
  }
  return found;
}

export function gradeLie(heard, position, original) {
  const pos = Number(position);
  const orig = String(original);
  if (!Number.isInteger(pos) || pos < 1) return false;
  if (!/^[0-9]$/.test(orig)) return false;
  return lieCandidates(heard).some((candidate) => candidate.position === pos && candidate.original === orig);
}

export function mutateWindow(actual, index, altDigit) {
  const alt = String(altDigit);
  if (!/^[0-9]+$/.test(actual) || !/^[0-9]$/.test(alt)) throw new Error("digits required");
  if (!Number.isInteger(index) || index < 0 || index >= actual.length) throw new Error("index");
  if (actual[index] === alt) throw new Error("mutation must change the digit");
  return actual.slice(0, index) + alt + actual.slice(index + 1);
}

export function givenWindow(start, length = 5) {
  return circularSlice(STACK_DIGITS, start, length);
}

export function continuationAt(start, skip = 5, take = 10) {
  return circularSlice(STACK_DIGITS, start + skip, take);
}

export function continuationsForGiven(given) {
  const probe = String(given);
  const hits = [];
  for (let start = 0; start < STACK_DIGITS.length; start += 1) {
    if (givenWindow(start, probe.length) !== probe) continue;
    hits.push({ start, next: continuationAt(start, probe.length, 10) });
  }
  return hits;
}

export function stripSpaces(value) {
  return String(value ?? "").replace(/[\s\u00a0]/g, "");
}

function digitCheck(input, expectedLength) {
  const raw = String(input ?? "");
  if (raw.trim() === "") return { ok: false, reason: "empty" };
  const normalized = stripSpaces(raw);
  if (!/^[0-9]+$/.test(normalized)) return { ok: false, reason: "chars" };
  if (normalized.length !== expectedLength) {
    return { ok: true, correct: false, normalized, reason: "length" };
  }
  return { ok: true, normalized };
}

export function gradeFixedDigits(input, expected) {
  const checked = digitCheck(input, expected.length);
  if (!checked.ok || checked.reason === "length") return checked.ok ? { ...checked, correct: false } : checked;
  return { ok: true, correct: checked.normalized === expected, normalized: checked.normalized };
}

export function gradeAnyDigits(input, expectedList) {
  if (!expectedList.length) return { ok: false, reason: "empty-key" };
  const checked = digitCheck(input, expectedList[0].length);
  if (!checked.ok) return checked;
  if (checked.reason === "length") return { ok: true, correct: false, normalized: checked.normalized, reason: "length" };
  return {
    ok: true,
    correct: expectedList.includes(checked.normalized),
    normalized: checked.normalized,
  };
}

export function gradeLetters(input, expectedCompact) {
  const raw = String(input ?? "");
  if (raw.trim() === "") return { ok: false, reason: "empty" };
  const normalized = stripSpaces(raw).toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) return { ok: false, reason: "chars" };
  if (normalized.length !== expectedCompact.length) return { ok: true, correct: false, normalized, reason: "length" };
  return { ok: true, correct: normalized === expectedCompact, normalized };
}

export function gradeOddInput(input, answer) {
  if (answer.special === "pi") return gradeFixedDigits(input, FIRST_PAGE_PI);
  const raw = String(input ?? "");
  if (raw.trim() === "") return { ok: false, reason: "empty" };
  const compact = stripSpaces(raw);
  if (/^[0-9]+$/.test(compact)) return gradeFixedDigits(input, answer.digits);
  if (/^[A-Za-z]+$/.test(compact)) return gradeLetters(input, answer.letters);
  return { ok: false, reason: "chars" };
}

export function gradeBirthdayInput(input, answer) {
  const raw = String(input ?? "").trim();
  if (!/^[0-9]+(?:\s+[0-9]+)*$/.test(raw)) return { ok: false, reason: "format" };
  const tokens = raw.split(/\s+/);
  if (!tokens || tokens.length !== 3) return { ok: false, reason: "format" };
  if (!tokens.every((token) => /^[0-9]+$/.test(token))) return { ok: false, reason: "format" };
  const page = Number(tokens[0]);
  const line = Number(tokens[1]);
  const column = Number(tokens[2]);
  if (![page, line, column].every(Number.isInteger)) return { ok: false, reason: "format" };
  const correct = page === answer.page && line === answer.line && column === answer.column;
  return { ok: true, correct };
}

export function gradeLieInput(input, answer) {
  const raw = String(input ?? "").trim();
  if (!/^[0-9]+(?:\s+[0-9]+)*$/.test(raw)) return { ok: false, reason: "format" };
  const tokens = raw.split(/\s+/);
  if (!tokens || tokens.length !== 2) return { ok: false, reason: "format" };
  if (!/^[0-9]{1,2}$/.test(tokens[0]) || !/^[0-9]$/.test(tokens[1])) return { ok: false, reason: "format" };
  const position = Number(tokens[0]);
  const original = tokens[1];
  return { ok: true, correct: gradeLie(answer.heard, position, original), position, original };
}

export function gradeMapInput(input, answer) {
  if (answer.kind === "digit") return gradeLetters(input, answer.letter);
  return gradeFixedDigits(input, answer.digit);
}

export function gradeRowInput(input, answer) {
  if (answer.kind === "english" || answer.kind === "next-english" || answer.kind === "sequence") {
    return gradeLetters(input, answer.letters);
  }
  return gradeFixedDigits(input, answer.digits);
}

export function gradeQuestion(question, input) {
  const answer = question.answer;
  switch (answer.type) {
    case "map":
      return gradeMapInput(input, answer);
    case "phrase":
      return gradeFixedDigits(input, answer.digits);
    case "phrase-next":
      return gradeFixedDigits(input, answer.rows.map(lineDigits).join(""));
    case "row":
      return gradeRowInput(input, answer);
    case "odd":
      return gradeOddInput(input, answer);
    case "next":
      return gradeAnyDigits(input, answer.nexts);
    case "birthday":
      return gradeBirthdayInput(input, answer);
    case "lie":
      return gradeLieInput(input, answer);
    default:
      return { ok: false, reason: "type" };
  }
}

/** Direct credit only when the typed answer is right and no hint or reveal was used. */
export function scoreAnswer(question, input, flags = {}) {
  const graded = gradeQuestion(question, input);
  if (!graded.ok) return graded;
  const hinted = flags.hintUsed === true;
  const revealed = flags.revealed === true;
  const direct = graded.correct === true && !hinted && !revealed;
  let outcome = "wrong";
  if (graded.correct && revealed) outcome = "revealed";
  else if (graded.correct && hinted) outcome = "assisted";
  else if (graded.correct) outcome = "direct";
  return { ok: true, correct: graded.correct, direct, outcome };
}

export function canonicalAnswerText(question) {
  const answer = question.answer;
  switch (answer.type) {
    case "map":
      return answer.kind === "digit" ? answer.letter : answer.digit;
    case "phrase":
      return answer.digits;
    case "phrase-next":
      return answer.rows.map(row => `${LINES[row].phrase} · ${lineDigits(row)}`).join("\n");
    case "row":
      return answer.kind === "digits" || answer.kind === "next-digits" ? answer.digits : answer.letters;
    case "odd":
      return answer.special === "pi" ? FIRST_PAGE_PI : `${answer.digits}|${answer.letters}`;
    case "next":
      return answer.nexts.join("|");
    case "birthday":
      return `${answer.page} ${answer.line} ${answer.column}`;
    case "lie":
      return answer.candidates.map((candidate) => `${candidate.position} ${candidate.original}`).join("|");
    default:
      return "";
  }
}

export function visiblePrompt(question, { showHint = false, showAnswer = false, phonetic = false } = {}) {
  const parts = [
    question.public.kicker,
    question.public.big,
    question.public.note,
    question.public.placeholder,
  ];
  if (phonetic && question.public.phonetic) parts.push(question.public.phonetic);
  if (showHint) parts.push(question.hint);
  if (showAnswer) parts.push(...explainQuestion(question));
  return parts.filter(Boolean).join("\n");
}

export function explainQuestion(question, options = {}) {
  const phonetic = options.phonetic !== false;
  const answer = question.answer;
  if (answer.type === "map") {
    const letter = answer.kind === "digit" ? answer.letter : answer.prompt;
    const digit = answer.kind === "digit" ? answer.prompt : answer.digit;
    return [
      `${digit} ↔ ${letter}`,
      phonetic ? `글자 이름 ${LETTER_NAME[letter]}` : "",
      "대응은 영문 철자 기준입니다. 한글 발음으로 숫자를 정하지 않습니다.",
    ].filter(Boolean);
  }
  if (answer.type === "phrase-next") return canonicalAnswerText(question).split("\n");
  if (answer.type === "phrase") {
    return [
      answer.phrase,
      answer.digits,
      "영어 문장 전체를 숫자로 바꿉니다. 앞의 0도 포함합니다.",
    ];
  }
  if (answer.type === "row") {
    if (answer.kind === "sequence") {
      return [
        LINES.map((line) => line.phrase).join(" / "),
        phonetic ? LINES.map((line) => line.spoken).join(" · ") : "",
        "마지막 줄 다음은 첫 줄로 돌아갑니다.",
      ].filter(Boolean);
    }
    const line = LINES[answer.row];
    const cycle = answer.kind.startsWith("next-")
      ? `${LINES[answer.from].phrase} 다음은 ${line.phrase} 입니다.`
      : `암기 줄 ${answer.row}`;
    return [
      cycle,
      phonetic ? `${line.phrase} · ${line.spoken}` : line.phrase,
      lineDigits(answer.row),
      phonetic ? `글자 이름 ${[...lineCompact(answer.row)].map((ch) => LETTER_NAME[ch]).join(" ")}` : "",
    ].filter(Boolean);
  }
  if (answer.type === "odd") {
    if (answer.special === "pi") {
      return [
        "1쪽의 첫 세 숫자는 314입니다.",
        "이 값만 실제 원주율의 시작입니다. 52자리 순환으로 계산하지 않습니다.",
      ];
    }
    return [
      `${answer.page}쪽 · 암기 줄 ${answer.row} · ${answer.column}번째`,
      `${answer.letters} · ${answer.digits}`,
      "10의 자리는 암기표의 줄 0-4, 1의 자리는 1부터 세는 글자 위치입니다.",
      "끝자리가 0이면 10번째입니다.",
      "고른 글자와 다음 두 글자를 52자리에서 이어서 읽습니다.",
      answer.page === 49 ? "49쪽 다음은 페이지 2 연습 범위 밖입니다." : "",
    ].filter(Boolean);
  }
  if (answer.type === "next") {
    return [
      `들은 다섯 자리 ${answer.given}`,
      `바로 다음 열 자리 ${answer.nexts.join(" 또는 ")}`,
      "다섯 자리는 정답 열 자리에 포함하지 않습니다. 52번째 다음은 처음으로 돌아갑니다.",
    ];
  }
  if (answer.type === "birthday") {
    const orderLabel = answer.order === "MMDD" ? "월일(MMDD)" : "일월(DDMM)";
    return [
      `${answer.month}월 ${answer.day}일 · ${orderLabel} · ${answer.dateStr}`,
      `쪽 ${answer.page} · 줄 ${answer.line} · ${answer.column}번째`,
      "쪽 = 일 + 50",
      "줄 = 월 × 2",
      "MMDD(월일) 시작 = 월 + 3",
      "DDMM(일월) 시작 = 월 + 1",
      "2월 29일 허용 · 번호는 1부터",
      "생일의 줄 번호와 암기표의 줄 번호는 다릅니다.",
    ];
  }
  if (answer.type === "lie") {
    const lines = answer.candidates.map(
      (candidate) =>
        `위치 ${candidate.position} · 원래 ${candidate.original} · 들은 ${candidate.heardDigit} · 실제 ${candidate.actual}`,
    );
    return [
      `${answer.heard.length}자리에서 한 자리만 다른 후보 ${answer.candidates.length}개`,
      ...lines,
      "맞는 후보의 위치와 원래 숫자는 모두 정답입니다.",
    ];
  }
  return [];
}

export function referenceNotes() {
  return {
    page21FormulaDigits: "201",
    page21FormulaLetters: "NOI",
    page21DemoDigits: "386",
    page21Warning: "시연 메모의 21쪽 386은 이 계산과 다릅니다. 연습 정답은 NOI / 201입니다.",
    piWarning: "1쪽만 실제 원주율 314입니다. 52자리 순환의 답이 아닙니다.",
    after49: "49쪽 다음은 페이지 2 범위 밖이라 순환 스택 연습으로 이어 갑니다.",
  };
}

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

export function isDirectOutcome(outcome) {
  return outcome === "direct";
}

function isRetiredMode(mode) {
  return RETIRED_MODES.has(mode);
}

function isRetiredQuestion(question) {
  return !!question && (isRetiredMode(question.mode) || isRetiredMode(question.answer?.type));
}

/** Drop removed modes before validation so old saves stay readable. */
function migrateRetiredPayload(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const sessionLike = Array.isArray(parsed.questions)
    || (isRetiredMode(parsed.mode) && ("index" in parsed || "accumulatedMs" in parsed));
  if (sessionLike) {
    if (isRetiredMode(parsed.mode)) return null;
    if (Array.isArray(parsed.questions) && parsed.questions.some(isRetiredQuestion)) {
      const kept = parsed.questions.filter((question) => !isRetiredQuestion(question));
      if (!kept.length) return null;
      const currentKey = parsed.questions[parsed.index]?.key;
      parsed.questions = kept;
      parsed.count = kept.length;
      const found = kept.findIndex((question) => question.key === currentKey);
      parsed.index = found >= 0 ? found : Math.min(Math.max(Number(parsed.index) || 0, 0), kept.length - 1);
    }
    return parsed;
  }
  if (isRetiredMode(parsed.mode)) delete parsed.mode;
  if (Array.isArray(parsed.recent)) {
    parsed.recent = parsed.recent.filter((item) => item && !isRetiredMode(item.mode));
  }
  if (Array.isArray(parsed.weak)) {
    parsed.weak = parsed.weak.filter((item) => item && !isRetiredMode(item.mode) && !isRetiredQuestion(item.question));
  }
  return parsed;
}

export function readSlot(raw, fallback, validate) {
  const copy = () => JSON.parse(JSON.stringify(fallback));
  if (raw == null || raw === "") return { value: copy(), corrupt: false, empty: true };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { value: copy(), corrupt: true, empty: false };
  }
  if (parsed && typeof parsed === "object") parsed = migrateRetiredPayload(parsed);
  if (parsed == null) return { value: copy(), corrupt: false, empty: true };
  if (typeof validate === "function" && !validate(parsed)) {
    return { value: copy(), corrupt: true, empty: false };
  }
  // Presentation is disposable; preserve saved progress and validated answer identity.
  if (Array.isArray(parsed?.questions)) parsed.questions = parsed.questions.map(restoreQuestion);
  if (Array.isArray(parsed?.weak)) parsed.weak = parsed.weak.map(item => {
    const question = restoreQuestion(item.question);
    return { ...item, question, label: `${question.public.kicker} ${question.public.big}` };
  });
  return { value: parsed, corrupt: false, empty: false };
}

export function defaultSettings() {
  return { version: 1, count: 10, phonetic: true, mapPool: "all", practiceStyle: "tap", phraseDisplay: "full", phraseLength: 5 };
}

export function defaultStats() {
  return {
    version: 1,
    totals: { sessions: 0, direct: 0, assisted: 0, revealed: 0, wrong: 0, hints: 0, reveals: 0, ms: 0 },
    recent: [],
    weak: [],
  };
}

export function validateSettings(value) {
  return Boolean(
    value
    && value.version === 1
    && [5, 10, 15, 20].includes(value.count)
    && (value.phraseDisplay === undefined || ["full", "half"].includes(value.phraseDisplay))
    && (value.phraseLength === undefined || [5, 10].includes(value.phraseLength))
    && (value.installDismissed === undefined || typeof value.installDismissed === "boolean")
    && typeof value.phonetic === "boolean"
    && (value.practiceStyle === undefined || ["input", "blind", "tap"].includes(value.practiceStyle))
    && (value.mapPool === "all" || value.mapPool === "weak"),
  );
}

export function validateStats(value) {
  if (!value || value.version !== 1 || !value.totals || !Array.isArray(value.recent) || !Array.isArray(value.weak)) {
    return false;
  }
  const keys = ["sessions", "direct", "assisted", "revealed", "wrong", "hints", "reveals", "ms"];
  return keys.every((key) => Number.isFinite(value.totals[key]) && value.totals[key] >= 0) &&
    value.recent.length <= 20 && value.weak.length <= 50 && weakItemCount(value.weak) <= 40 &&
    value.recent.every(item => item && typeof item.id === "string" &&
      (MODES.includes(item.mode) || item.mode === "review") &&
      Number.isFinite(item.endedAt) && Number.isFinite(new Date(item.endedAt).getTime()) &&
      ["count", "direct", "assisted", "wrong", "revealed", "hints", "reveals"].every(key => Number.isInteger(item[key]) && item[key] >= 0) &&
      Number.isFinite(item.ms) && item.ms >= 0) &&
    value.weak.every(item => item && validateQuestion(item.question) &&
      item.key === item.question.key && item.mode === item.question.mode &&
      typeof item.label === "string" && Number.isInteger(item.misses) && item.misses > 0);
}

function sameStoredData(actual, expected) {
  if (expected === null || typeof expected !== "object") return actual === expected;
  if (!actual || typeof actual !== "object" || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length && keys.every(key => sameStoredData(actual[key], expected[key]));
}

function validateQuestion(question) {
  if (!question || !MODES.includes(question.mode) || !question.answer || typeof question.key !== "string") return false;
  if (typeof question.draft !== "string" || ![null, "direct", "assisted", "revealed", "wrong"].includes(question.graded)) return false;
  if (![question.hintUsed, question.usedReveal, question.showHint].every(value => typeof value === "boolean")) return false;
  if (question.word !== undefined && ![0, 1].includes(question.word)) return false;
  const expected = questionTemplate(question);
  // Phrase spelling and all public/hint text are regenerated, never used as identity.
  const answerData = ({ phrase, ...data }) => data;
  return Boolean(expected) && question.mode === expected.mode && question.key === expected.key &&
    sameStoredData(answerData(question.answer), answerData(expected.answer));
}

function restoreQuestion(question) {
  const expected = questionTemplate(question);
  return expected ? { ...question, public: expected.public, hint: expected.hint, answer: expected.answer } : question;
}

function questionTemplate(question) {
  const answer = question.answer;
  try {
    switch (answer.type) {
      case "map":
        if (!["digit", "letter"].includes(answer.kind)) return null;
        return mapQuestion(answer.kind, answer.prompt);
      case "phrase": return phraseQuestion(answer.row, question.word);
      case "phrase-next": return phraseNextQuestion(answer.row, answer.length, question.word);
      case "row":
        if (!["english", "digits", "next-english", "next-digits", "sequence"].includes(answer.kind)) return null;
        return rowQuestion(answer.kind, answer.from ?? answer.row);
      case "odd": return oddQuestion(answer.special === "pi" ? 1 : answer.page);
      case "next": return nextQuestion(answer.start);
      case "birthday": return birthdayQuestion(answer.month, answer.day, answer.order);
      case "lie": return lieQuestion(answer.heard);
      default: return null;
    }
  } catch { return null; }
}

export function validateSession(value) {
  if (!value || value.version !== 1 || !(value.mode === "review" || MODES.includes(value.mode))) return false;
  if (!Array.isArray(value.questions) || !value.questions.length || value.questions.length > (value.mode === "review" ? 50 : 40)) return false;
  if (!Number.isInteger(value.index) || value.index < 0 || value.index >= value.questions.length) return false;
  if (value.count !== value.questions.length || typeof value.finished !== "boolean" || typeof value.statsPosted !== "boolean") return false;
  if (!Number.isFinite(value.accumulatedMs) || value.accumulatedMs < 0) return false;
  return value.questions.every(validateQuestion);
}

// Store both directional questions under the existing schema so old backups remain readable.
export function weakKeys(questionOrKey) {
  const key = typeof questionOrKey === "string" ? questionOrKey : questionOrKey.key;
  const match = /^map:(digit|letter):([0-9A-Z])$/.exec(key);
  if (!match) return [key];
  const letter = match[1] === "digit" ? LETTER_OF[Number(match[2])] : match[2];
  if (DIGIT_OF[letter] === undefined) return [key];
  return [`map:digit:${DIGIT_OF[letter]}`, `map:letter:${letter}`];
}

export function weakMapSymbols(weak) {
  return [...new Set((weak || []).flatMap(item => weakKeys(item.key)))].flatMap(key => {
    const match = /^map:(digit|letter):([0-9A-Z])$/.exec(key);
    return match ? [{ kind: match[1], symbol: match[2] }] : [];
  });
}

function weakEntry(question, misses) {
  return { key: question.key, mode: question.mode, label: `${question.public.kicker} ${question.public.big}`, misses, question: freshQuestion(question) };
}

function weakItemCount(items) {
  return new Set(items.map(item => weakKeys(item?.key || "")[0])).size;
}

function limitWeak(items) {
  // Newest first: a map pair is ONE item, stored as two directional questions.
  // Keep 40 whole items (at most 50 entries); evict only the oldest whole items.
  const groups = new Map();
  for (const item of items) {
    const identity = weakKeys(item.key)[0];
    if (!groups.has(identity)) groups.set(identity, new Map());
    groups.get(identity).set(item.key, item);
  }
  return [...groups.values()].slice(0, 40).flatMap(group => {
    const item = group.values().next().value;
    return weakKeys(item.key).map(key => group.get(key) || weakEntry(mapQuestion(key.split(":")[1], key.split(":")[2]), item.misses));
  });
}

export function migrateWeak(stats) {
  const seen = new Set();
  const result = [];
  for (const item of stats.weak) {
    const keys = weakKeys(item.key);
    if (seen.has(keys[0])) continue;
    keys.forEach(key => seen.add(key));
    const misses = Math.max(...stats.weak.filter(other => keys.includes(other.key)).map(other => other.misses));
    for (const key of keys) {
      const existing = stats.weak.find(other => other.key === key);
      const question = keys.length === 2 ? mapQuestion(key.split(":")[1], key.split(":")[2]) : item.question;
      result.push(existing ? { ...existing, misses } : weakEntry(question, misses));
    }
  }
  stats.weak = limitWeak(result);
}

export function recordWeak(stats, question) {
  const keys = weakKeys(question);
  const misses = Math.max(0, ...stats.weak.filter(item => keys.includes(item.key)).map(item => item.misses)) + 1;
  const entries = keys.map(key => weakEntry(keys.length === 2 ? mapQuestion(key.split(":")[1], key.split(":")[2]) : question, misses));
  stats.weak = limitWeak([...entries, ...stats.weak.filter(item => !keys.includes(item.key))]);
}

export function clearWeak(stats, key) {
  const keys = weakKeys(key);
  stats.weak = stats.weak.filter(item => {
    if (!keys.includes(item.key)) return true;
    item.misses -= 1;
    return item.misses > 0;
  });
}

export function summarizeSession(session) {
  const summary = { direct: 0, assisted: 0, revealed: 0, wrong: 0, hints: 0, reveals: 0, open: 0 };
  for (const question of session.questions) {
    if (question.hintUsed) summary.hints += 1;
    if (question.usedReveal) summary.reveals += 1;
    if (!question.graded) summary.open += 1;
    else summary[question.graded] += 1;
  }
  return summary;
}
