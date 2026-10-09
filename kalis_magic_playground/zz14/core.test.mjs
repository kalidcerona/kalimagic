import assert from "node:assert/strict";
import test from "node:test";
import {
  FIRST_PAGE_PI,
  LETTER_NAME,
  LETTER_OF,
  LINES,
  STACK_DIGITS,
  STACK_LETTERS,
  allMonthDays,
  birthdayAddress,
  buildQuestions,
  buildSession,
  canonicalAnswerText,
  circularSlice,
  continuationAt,
  explainQuestion,
  freshQuestion,
  givenWindow,
  gradeFixedDigits,
  gradeLetters,
  gradeLie,
  hamming,
  isDirectOutcome,
  isValidMonthDay,
  lettersToDigits,
  lieCandidates,
  lieQuestion,
  lineDigits,
  mutateWindow,
  pageLocus,
  readSlot,
  referenceNotes,
  scoreAnswer,
  validateSession,
  validateSettings,
  validateStats,
  visiblePrompt,
  defaultSettings,
  defaultStats,
} from "./core.mjs";

const MAP = { O: "0", I: "1", N: "2", E: "3", A: "4", S: "5", G: "6", T: "7", B: "8", P: "9" };
const SPEC_DIGITS = "0835360475123978312620153464123473202102461269142157";

function independentDigits(letters) {
  let out = "";
  for (const ch of letters) out += MAP[ch];
  return out;
}

function independentLocus(page) {
  const row = Math.floor(page / 10);
  const column = page % 10 === 0 ? 10 : page % 10;
  const index = [0, 10, 20, 30, 40][row] + column - 1;
  let letters = "";
  for (let i = 0; i < 3; i += 1) letters += STACK_LETTERS[(index + i) % 52];
  return { row, column, index, letters, digits: independentDigits(letters) };
}

function independentCandidates(heard, stack = STACK_DIGITS) {
  const found = [];
  for (let start = 0; start < stack.length; start += 1) {
    let actual = "";
    for (let i = 0; i < heard.length; i += 1) actual += stack[(start + i) % stack.length];
    const diffs = [];
    for (let i = 0; i < heard.length; i += 1) if (actual[i] !== heard[i]) diffs.push(i);
    if (diffs.length === 1) {
      found.push({ start, position: diffs[0] + 1, original: actual[diffs[0]], actual });
    }
  }
  return found;
}

function independentBirthday(month, day, order) {
  const dateStr = order === "MMDD"
    ? String(month).padStart(2, "0") + String(day).padStart(2, "0")
    : String(day).padStart(2, "0") + String(month).padStart(2, "0");
  return {
    dateStr,
    page: day + 50,
    line: month * 2,
    column: order === "MMDD" ? month + 3 : month + 1,
  };
}

test("52-letter cycle, map, and spec digits stay aligned", () => {
  assert.equal(STACK_LETTERS.length, 52);
  assert.equal(STACK_LETTERS, "OBESEGOATSINEPTBEINGNOISEAGAINEATENONIONAGINGPIANIST");
  assert.equal(STACK_DIGITS, SPEC_DIGITS);
  assert.equal(independentDigits(STACK_LETTERS), SPEC_DIGITS);
  assert.equal(STACK_DIGITS.length, 52);
  assert.equal(lettersToDigits("OBESEGOATS"), "0835360475");
  assert.deepEqual(LETTER_OF, ["O", "I", "N", "E", "A", "S", "G", "T", "B", "P"]);
  for (let digit = 0; digit <= 9; digit += 1) {
    const letter = LETTER_OF[digit];
    assert.equal(MAP[letter], String(digit));
    assert.equal(lettersToDigits(letter), String(digit));
  }
  assert.equal(LINES.reduce((sum, line) => sum + line.length, 0), 52);
  assert.deepEqual(LINES.map((line) => line.spoken), [
    "오비스 고츠",
    "이넵트 비잉",
    "노이즈 어겐",
    "이튼 어니언",
    "에이징 피애니스트",
  ]);
  assert.deepEqual(
    LINES.map((line) => lineDigits(line.row)),
    ["0835360475", "1239783126", "2015346412", "3473202102", "461269142157"],
  );
  assert.equal(lineDigits(0).startsWith("0"), true);
  assert.equal(LETTER_NAME.O, "오");
  assert.notEqual(LETTER_NAME.O, "OBESE");
});

test("page locus uses floor(page/10), 1-based column, and wrap", () => {
  const page21 = pageLocus(21);
  assert.equal(page21.ok, true);
  assert.deepEqual(
    { row: page21.row, column: page21.column, letters: page21.letters, digits: page21.digits },
    { row: 2, column: 1, letters: "NOI", digits: "201" },
  );
  assert.deepEqual(
    { row: page21.row, column: page21.column, index: page21.index, letters: page21.letters, digits: page21.digits },
    independentLocus(21),
  );
  assert.notEqual(page21.digits, "386");
  assert.equal(pageLocus(1).ok, false);
  assert.equal(pageLocus(1).reason, "pi-exception");
  assert.equal(pageLocus(1).pi, "314");
  assert.equal(FIRST_PAGE_PI, "314");
  assert.notEqual(FIRST_PAGE_PI, independentLocus(1).digits);
  assert.equal(independentLocus(1).digits, "083");

  for (const page of [3, 9, 19, 23, 29, 39, 41, 49]) {
    const locus = pageLocus(page);
    const indie = independentLocus(page);
    assert.equal(locus.ok, true);
    assert.equal(locus.row, indie.row);
    assert.equal(locus.column, indie.column);
    assert.equal(locus.letters, indie.letters);
    assert.equal(locus.digits, indie.digits);
    assert.equal(hamming(locus.digits, indie.digits), 0);
  }

  assert.equal(pageLocus(9).letters, "TSI");
  assert.equal(pageLocus(9).digits, "751");
  assert.equal(pageLocus(23).letters, "ISE");
  assert.equal(pageLocus(23).digits, "153");
  assert.equal(pageLocus(49).row, 4);
  assert.equal(pageLocus(49).column, 9);

  assert.equal(pageLocus(40).column, 10);
  assert.equal(pageLocus(40).digits, independentLocus(40).digits);
  assert.equal(pageLocus(10).column, 10);
  assert.equal(pageLocus(10).letters, "GNO");
  assert.equal(circularSlice(STACK_LETTERS, 51, 3), "TOB");
  assert.equal(lettersToDigits("TOB"), "708");
  assert.equal(pageLocus(2).ok, true);
  assert.equal(pageLocus(50).ok, false);
  assert.equal(pageLocus(21.5).ok, false);
});

test("birthday address keeps leading zeros and rejects impossible dates", () => {
  const aprilMmdd = birthdayAddress(4, 12, "MMDD");
  const aprilDdmm = birthdayAddress(4, 12, "DDMM");
  assert.deepEqual(independentBirthday(4, 12, "MMDD"), {
    dateStr: aprilMmdd.dateStr,
    page: aprilMmdd.page,
    line: aprilMmdd.line,
    column: aprilMmdd.column,
  });
  assert.equal(aprilMmdd.dateStr, "0412");
  assert.equal(aprilMmdd.page, 62);
  assert.equal(aprilMmdd.line, 8);
  assert.equal(aprilMmdd.column, 7);
  assert.equal(aprilDdmm.dateStr, "1204");
  assert.equal(aprilDdmm.page, 62);
  assert.equal(aprilDdmm.line, 8);
  assert.equal(aprilDdmm.column, 5);

  const leap = birthdayAddress(2, 29, "MMDD");
  assert.equal(leap.ok, true);
  assert.equal(leap.dateStr, "0229");
  assert.equal(leap.page, 79);
  assert.equal(leap.line, 4);
  assert.equal(leap.column, 5);
  assert.equal(birthdayAddress(2, 29, "DDMM").dateStr, "2902");
  assert.equal(birthdayAddress(2, 29, "DDMM").column, 3);

  assert.equal(birthdayAddress(2, 30, "MMDD").ok, false);
  assert.equal(birthdayAddress(4, 31, "MMDD").ok, false);
  assert.equal(birthdayAddress(0, 1, "MMDD").ok, false);
  assert.equal(birthdayAddress(13, 1, "MMDD").ok, false);
  assert.equal(birthdayAddress(1, 0, "MMDD").ok, false);
  assert.equal(birthdayAddress(1, 1,5, "MMDD").ok, false);
  assert.equal(birthdayAddress(1, 15, "YYYY").ok, false);
  assert.equal(isValidMonthDay(2, 29), true);
  assert.equal(allMonthDays().some((date) => date.month === 2 && date.day === 29), true);
  assert.equal(allMonthDays().some((date) => date.month === 2 && date.day === 30), false);
  assert.equal(allMonthDays().length, 366);
});

test("digit grading preserves leading zeros and rejects foreign characters", () => {
  assert.equal(gradeFixedDigits("0835360475", "0835360475").correct, true);
  assert.equal(gradeFixedDigits("0835 360475", "0835360475").correct, true);
  assert.equal(gradeFixedDigits("835360475", "0835360475").correct, false);
  assert.equal(gradeFixedDigits("0835360475", "0835360475").normalized, "0835360475");
  assert.equal(gradeFixedDigits("0", "0").correct, true);
  assert.equal(gradeFixedDigits("00", "0").correct, false);
  assert.equal(gradeFixedDigits("", "0").ok, false);
  assert.equal(gradeFixedDigits("O835", "0835").reason, "chars");
  assert.equal(gradeFixedDigits("０８３５", "0835").reason, "chars");
  assert.equal(gradeLetters(" obese goats ", "OBESEGOATS").correct, true);
  assert.equal(gradeLetters("OBESEGOAT", "OBESEGOATS").correct, false);
  assert.equal(gradeLetters("OBESE GOATS!", "OBESEGOATS").reason, "chars");
  const stored = JSON.parse(JSON.stringify({ digits: lineDigits(0) }));
  assert.equal(stored.digits, "0835360475");
});

test("continuation is the next 10 digits and can wrap", () => {
  assert.equal(givenWindow(0, 5), "08353");
  assert.equal(continuationAt(0), "6047512397");
  assert.equal(givenWindow(0, 5) + continuationAt(0), STACK_DIGITS.slice(0, 15));
  const start = 48;
  const given = givenWindow(start, 5);
  const next = continuationAt(start);
  assert.equal(given.length, 5);
  assert.equal(next.length, 10);
  assert.equal(given + next, circularSlice(STACK_DIGITS, start, 15));
  const givenPos = new Set([0, 1, 2, 3, 4].map((offset) => (start + offset) % 52));
  for (let offset = 5; offset < 15; offset += 1) {
    assert.equal(givenPos.has((start + offset) % 52), false);
  }
  const question = buildQuestions("next", 1, 1)[0];
  assert.equal(question.public.big.length, 5);
  assert.equal(scoreAnswer(question, question.answer.nexts[0], {}).direct, true);
  assert.equal(scoreAnswer(question, question.answer.given, {}).correct, false);
});

test("83136 accepts every Hamming-1 candidate, not only one origin", () => {
  const heard = "83136";
  const core = lieCandidates(heard);
  const indie = independentCandidates(heard);
  assert.deepEqual(
    core.map((item) => `${item.position}:${item.original}:${item.actual}`).sort(),
    indie.map((item) => `${item.position}:${item.original}:${item.actual}`).sort(),
  );
  assert.ok(core.some((item) => item.position === 3 && item.original === "5" && item.actual === "83536"));
  assert.ok(core.some((item) => item.position === 4 && item.original === "2" && item.actual === "83126"));
  assert.ok(core.length >= 2);
  for (const candidate of core) assert.equal(hamming(candidate.actual, heard), 1);

  const question = lieQuestion(heard);
  assert.equal(scoreAnswer(question, "3 5", {}).outcome, "direct");
  assert.equal(scoreAnswer(question, "4 2", {}).direct, true);
  assert.equal(scoreAnswer(question, "위치 3, 원래 5", {}).ok, false);
  assert.equal(scoreAnswer(question, "3 1", {}).correct, false);
  assert.equal(scoreAnswer(question, "1 8", {}).correct, false);
  assert.equal(gradeLie(heard, 3, "5"), true);
  assert.equal(gradeLie(heard, 4, "2"), true);
  assert.equal(gradeLie(heard, 2, "5"), false);
  const hinted = scoreAnswer(question, "4 2", { hintUsed: true, revealed: false });
  assert.equal(hinted.correct, true);
  assert.equal(hinted.direct, false);
  assert.equal(hinted.outcome, "assisted");
  const revealed = scoreAnswer(question, "3 5", { hintUsed: false, revealed: true });
  assert.equal(revealed.direct, false);
  assert.equal(revealed.outcome, "revealed");
  assert.equal(isDirectOutcome(revealed.outcome), false);
  assert.equal(scoreAnswer(question, "3 05", {}).ok, false);
});

test("every 7-digit single substitution in this cycle has one candidate", { timeout: 30000 }, () => {
  let mutations = 0;
  const ambiguous = [];
  for (let start = 0; start < 52; start += 1) {
    let actual = "";
    for (let i = 0; i < 7; i += 1) actual += STACK_DIGITS[(start + i) % 52];
    for (let index = 0; index < 7; index += 1) {
      for (let digit = 0; digit <= 9; digit += 1) {
        if (String(digit) === actual[index]) continue;
        const heard = actual.slice(0, index) + String(digit) + actual.slice(index + 1);
        mutations += 1;
        const core = lieCandidates(heard);
        const indie = independentCandidates(heard);
        assert.equal(core.length, 1, heard);
        assert.equal(indie.length, 1, heard);
        assert.equal(core[0].position, index + 1);
        assert.equal(core[0].original, actual[index]);
        assert.equal(core[0].start, start);
        assert.equal(gradeLie(heard, index + 1, actual[index]), true);
        assert.equal(gradeLie(heard, index + 1, heard[index]), false);
        if (core.length !== 1) ambiguous.push(heard);
      }
    }
  }
  assert.equal(mutations, 3276);
  assert.equal(ambiguous.length, 0);
});

test("5-digit substitutions always have a candidate and include real ambiguity", { timeout: 30000 }, () => {
  let mutations = 0;
  let ambiguous = 0;
  const seen = new Set();
  for (let start = 0; start < 52; start += 1) {
    const actual = circularSlice(STACK_DIGITS, start, 5);
    for (let index = 0; index < 5; index += 1) {
      for (let digit = 0; digit <= 9; digit += 1) {
        if (String(digit) === actual[index]) continue;
        const heard = mutateWindow(actual, index, digit);
        mutations += 1;
        const core = lieCandidates(heard);
        const indie = independentCandidates(heard);
        assert.ok(core.length >= 1);
        assert.equal(core.length, indie.length);
        assert.ok(core.every((item, itemIndex) => item.position === indie[itemIndex].position));
        assert.equal(gradeLie(heard, index + 1, actual[index]), true);
        if (core.length > 1 && !seen.has(heard)) {
          seen.add(heard);
          ambiguous += 1;
        }
      }
    }
  }
  assert.equal(mutations, 2340);
  assert.ok(ambiguous >= 1);
  assert.ok(seen.has("83136"));
  const leading = mutateWindow("08353", 0, "9");
  assert.equal(leading, "98353");
  assert.equal(gradeLie(leading, 1, "0"), true);
  assert.notEqual(gradeLie(leading, 1, ""), true);
});

test("prompts hide answers until reveal, and page-21 demo stays in reference", () => {
  const samples = [
    ...buildQuestions("map", 20, 7),
    ...buildQuestions("row", 8, 11),
    ...buildQuestions("odd", 6, 3),
    ...buildQuestions("next", 6, 9),
    ...buildQuestions("birthday", 8, 5),
    lieQuestion("83136"),
    ...buildQuestions("lie", 4, 13, { lieLength: 7 }),
  ];
  for (const question of samples) {
    const hidden = visiblePrompt(question, { showHint: false, showAnswer: false, phonetic: true });
    const hinted = visiblePrompt(question, { showHint: true, showAnswer: false, phonetic: true });
    const secret = canonicalAnswerText(question);
    for (const piece of secret.split("|")) {
      if (question.answer.type === "row" && question.answer.kind !== "digits" && question.answer.kind !== "next-digits") {
        assert.equal(hidden.includes(piece), false, piece);
      } else if (question.answer.type === "map" && question.answer.kind === "letter") {
        assert.equal(hidden.includes(piece), false);
      } else if (question.answer.type !== "map") {
        assert.equal(hidden.includes(piece), false, `${question.key} leaked ${piece}`);
      }
      assert.equal(hinted.includes(secret), false);
      if (piece.length >= 3) assert.equal(hinted.includes(piece), false, `hint leaked ${piece}`);
    }
    assert.equal(hidden.includes("386"), false);
    assert.equal(hinted.includes("386"), false);
    const explained = explainQuestion(question).join("\n");
    if (question.key !== "odd:21") assert.equal(explained.includes("386"), false);
  }
  const page21 = buildQuestions("odd", 12, 4).find((question) => question.key === "odd:21")
    || freshQuestion({
      mode: "odd",
      key: "odd:21",
      public: pageLocus(21) && buildQuestions("odd", 1, 1)[0].public,
      hint: "",
      answer: {
        type: "odd",
        special: "",
        page: 21,
        row: 2,
        column: 1,
        letters: "NOI",
        digits: "201",
      },
    });
  const made = samples.concat([page21]);
  const explicit = made.find((question) => question.answer?.page === 21) || {
    answer: { type: "odd", special: "", page: 21, row: 2, column: 1, letters: "NOI", digits: "201" },
    public: { kicker: "", big: "", note: "", placeholder: "", phonetic: "" },
    hint: "",
  };
  assert.equal(explainQuestion(explicit).join("\n").includes("386"), false);
  assert.equal(explainQuestion(explicit).join("\n").includes("201"), true);
  const notes = referenceNotes();
  assert.equal(notes.page21DemoDigits, "386");
  assert.match(notes.page21Warning, /386/);
  assert.match(notes.page21Warning, /201/);
  const pi = buildQuestions("odd", 8, 2).find((question) => question.answer.special === "pi");
  assert.ok(pi);
  assert.equal(visiblePrompt(pi).includes("314"), false);
  assert.match(explainQuestion(pi).join("\n"), /314/);
  assert.match(explainQuestion(pi).join("\n"), /52자리 순환으로 계산하지 않습니다/);
});

test("sessions are deterministic, cover both directions, and restore as data", () => {
  const first = buildSession({ mode: "map", count: 10, seed: 99 });
  const second = buildSession({ mode: "map", count: 10, seed: 99 });
  assert.deepEqual(first.questions.map((question) => question.key), second.questions.map((question) => question.key));
  assert.notDeepEqual(
    buildSession({ mode: "map", count: 10, seed: 100 }).questions.map((question) => question.key),
    first.questions.map((question) => question.key),
  );
  const kinds = new Set(first.questions.map((question) => question.answer.kind));
  assert.ok(kinds.has("digit"));
  assert.ok(kinds.has("letter"));
  const odd = buildSession({ mode: "odd", count: 12, seed: 4 });
  assert.ok(odd.questions.some((question) => question.answer.special === "pi"));
  assert.ok(odd.questions.filter((question) => question.answer.special !== "pi").every((question) => question.answer.page % 2 === 1));
  const row = buildSession({ mode: "row", count: 6, seed: 8 });
  const rowKinds = new Set(row.questions.map((question) => question.answer.kind));
  assert.ok(rowKinds.has("english") || rowKinds.has("sequence"));
  assert.ok(rowKinds.has("digits") || rowKinds.has("next-digits"));
  assert.ok([...rowKinds].some((kind) => kind.startsWith("next-")));
  const review = {
    ...buildSession({ mode: "map", count: 1, seed: 1 }),
    mode: "review",
    index: 0,
    questions: [freshQuestion(first.questions[0])],
  };
  assert.equal(validateSession(review), true);
  const birthdays = buildSession({ mode: "birthday", count: 12, seed: 15 });
  assert.ok(birthdays.questions.some((question) => question.answer.order === "MMDD"));
  assert.ok(birthdays.questions.some((question) => question.answer.order === "DDMM"));
  assert.equal(validateSession(first), true);
  assert.equal(validateSession({ version: 1, mode: "map", index: 0, questions: [] }), false);
  const feb = birthdays.questions[0];
  assert.equal(scoreAnswer(feb, `${feb.answer.page} ${feb.answer.line} ${feb.answer.column}`, {}).direct, true);
  assert.equal(scoreAnswer(feb, "쪽만", {}).ok, false);
});

test("corrupted storage falls back without dropping the sibling default", () => {
  const settings = defaultSettings();
  const stats = defaultStats();
  const broken = readSlot("{", settings, validateSettings);
  assert.equal(broken.corrupt, true);
  assert.deepEqual(broken.value, settings);
  broken.value.count = 5;
  assert.equal(settings.count, 10);
  const empty = readSlot(null, stats, validateStats);
  assert.equal(empty.empty, true);
  assert.equal(empty.corrupt, false);
  assert.deepEqual(empty.value, stats);
  const badShape = readSlot(JSON.stringify({ version: 1, count: 10 }), settings, validateSettings);
  assert.equal(badShape.corrupt, true);
  assert.equal(readSlot(JSON.stringify(settings), settings, validateSettings).corrupt, false);
  assert.equal(readSlot("[]", stats, validateStats).corrupt, true);
});

test("hint or reveal never becomes a direct correct, including a wrong check", () => {
  const question = buildQuestions("map", 1, 1)[0];
  const right = question.answer.kind === "digit" ? question.answer.letter : question.answer.digit;
  assert.equal(scoreAnswer(question, right, {}).direct, true);
  assert.equal(scoreAnswer(question, right, { hintUsed: true }).direct, false);
  assert.equal(scoreAnswer(question, right, { revealed: true }).direct, false);
  assert.equal(scoreAnswer(question, "?", {}).ok, false);
  assert.equal(scoreAnswer(question, right === "O" ? "Z" : "O", {}).outcome, "wrong");
  assert.equal(scoreAnswer(question, right === "O" ? "Z" : "O", {}).direct, false);
});
