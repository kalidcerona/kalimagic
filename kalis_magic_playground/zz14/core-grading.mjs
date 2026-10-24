import {
  LINES,
  FIRST_PAGE_PI,
  lineDigits,
} from "./core-stack.mjs";
import {
  gradeLie,
} from "./core-windows.mjs";

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

export function isDirectOutcome(outcome) {
  return outcome === "direct";
}
