import {
  MODES,
} from "./core-stack.mjs";
import {
  phraseQuestion,
  phraseNextQuestion,
  mapQuestion,
  rowQuestion,
  oddQuestion,
  nextQuestion,
  birthdayQuestion,
  lieQuestion,
} from "./core-questions.mjs";
import {
  weakItemCount,
} from "./core-stats.mjs";

/** Modes removed from practice. Saved sessions and stats may still name them. */
const RETIRED_MODES = new Set(["phrase-next", "lie"]);

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
