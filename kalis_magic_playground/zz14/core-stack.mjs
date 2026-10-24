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
