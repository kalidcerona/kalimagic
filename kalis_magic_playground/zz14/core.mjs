/**
 * Pi Max practice rules. Answers are derived from the 52-letter cycle.
 * Page 1 pi (314) is never produced by this cycle.
 */

export {
  STACK_LETTERS,
  DIGIT_OF,
  LETTER_OF,
  LETTER_NAME,
  LINES,
  FIRST_PAGE_PI,
  MONTH_DAYS,
  MODES,
  ODD_PAGES,
  lettersToDigits,
  STACK_DIGITS,
  lineDigits,
  lineCompact,
  circularSlice,
  pageLocus,
  isQuizOddPage,
  isValidMonthDay,
  pad2,
  birthdayAddress,
  allMonthDays,
} from "./core-stack.mjs";

export {
  hamming,
  lieCandidates,
  gradeLie,
  mutateWindow,
  givenWindow,
  continuationAt,
  continuationsForGiven,
} from "./core-windows.mjs";

export {
  stripSpaces,
  gradeFixedDigits,
  gradeAnyDigits,
  gradeLetters,
  gradeOddInput,
  gradeBirthdayInput,
  gradeLieInput,
  gradeMapInput,
  gradeRowInput,
  gradeQuestion,
  scoreAnswer,
  canonicalAnswerText,
  isDirectOutcome,
} from "./core-grading.mjs";

export {
  visiblePrompt,
  explainQuestion,
  referenceNotes,
} from "./core-explain.mjs";

export {
  phraseNextQuestion,
  lieQuestion,
  buildQuestions,
  clampCount,
  buildSession,
  freshQuestion,
} from "./core-questions.mjs";

export {
  readSlot,
  defaultSettings,
  defaultStats,
  validateSettings,
  validateStats,
  validateSession,
} from "./core-storage.mjs";

export {
  weakKeys,
  weakMapSymbols,
  migrateWeak,
  recordWeak,
  clearWeak,
  summarizeSession,
} from "./core-stats.mjs";
