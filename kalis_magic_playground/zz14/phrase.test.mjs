import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as core from "./core.mjs";

const PHRASES = [
  ["OBESE GOATS", "오비스 고츠", "0835360475", "08353 60475"],
  ["INEPT BEING", "이넵트 비잉", "1239783126", "12397 83126"],
  ["NOISE AGAIN", "노이즈 어겐", "2015346412", "20153 46412"],
  ["EATEN ONION", "이튼 어니언", "3473202102", "34732 02102"],
  ["AGING PIANIST", "에이징 피애니스트", "461269142157", "46126 9142157"],
];

function load(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  const app = { innerHTML: "", setAttribute() {}, removeAttribute() {} };
  const notice = { textContent: "" };
  const document = {
    body: { dataset: {}, addEventListener() {} },
    querySelector: (selector) => (selector === "#app" ? app : selector === "#notice" ? notice : null),
    querySelectorAll: () => [],
  };
  const context = vm.createContext({
    __core: core,
    document,
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        writes.push([key, value]);
        values.set(key, value);
      },
    },
    Date,
    Math,
    JSON,
    HTMLFormElement: class {},
    HTMLInputElement: class {},
  });
  const source = readFileSync(new URL("./app.mjs", import.meta.url), "utf8")
    .replace(/^import\s+\{([\s\S]*?)\}\s+from "\.\/core\.mjs";/, "const {$1}=globalThis.__core;");
  vm.runInContext(`${source}\nglobalThis.review={state,current,startSession,startWeakReview,render,onClick,saveSession,postSession};`, context);
  return { ...context.review, app, notice, values, writes };
}

function click(env, action, extra = {}) {
  env.onClick({ target: { closest: () => ({ disabled: false, dataset: { action, ...extra } }) } });
}

function cell(html, letter, form) {
  const found = html.match(new RegExp(`data-letter="${letter}" data-form="${form}"[\\s\\S]*?<\\/div>`));
  assert.ok(found, `${letter} ${form}`);
  return found[0];
}

test("five mnemonic phrases map to exact digits, including a leading zero", () => {
  assert.equal(core.MODES.includes("phrase"), true);
  assert.equal(core.MODES.includes("row"), true);
  assert.equal("PIANIST".length, 7);
  for (const [phrase, spoken, digits, grouped] of PHRASES) {
    const line = core.LINES.find((item) => item.phrase === phrase);
    assert.equal(line.spoken, spoken);
    assert.equal(core.lineDigits(line.row), digits);
    assert.equal(digits.startsWith("0") || line.row !== 0, true);
    const spaced = [];
    let index = 0;
    for (const ch of phrase) {
      if (ch === " ") spaced.push(" ");
      else {
        spaced.push(digits[index]);
        index += 1;
      }
    }
    assert.equal(spaced.join(""), grouped);
    assert.equal(index, digits.length);
  }
  assert.equal(core.lineDigits(0), "0835360475");
  for (let seed = 0; seed < 12; seed += 1) {
    const questions = core.buildQuestions("phrase", 5, seed);
    assert.deepEqual(
      questions.map((question) => question.answer.phrase).sort(),
      PHRASES.map(([phrase]) => phrase).sort(),
    );
    for (const question of questions) {
      const digits = PHRASES.find(([phrase]) => phrase === question.answer.phrase)[2];
      assert.equal(question.mode, "phrase");
      assert.equal(question.public.big, question.answer.phrase);
      assert.equal(question.public.phonetic, "");
      assert.equal(question.hint, "");
      assert.equal(core.canonicalAnswerText(question), digits);
      assert.equal(core.scoreAnswer(question, digits, {}).correct, true);
      assert.equal(core.scoreAnswer(question, digits, {}).direct, true);
      assert.equal(core.scoreAnswer(question, digits, { revealed: true }).direct, false);
      assert.equal(core.scoreAnswer(question, digits.slice(1), {}).correct, false);
      const hidden = core.visiblePrompt(question, { showHint: true, showAnswer: false, phonetic: true });
      assert.equal(hidden.includes(digits), false);
      assert.equal(hidden.includes(question.answer.phrase), true);
      for (const spoken of PHRASES.map((item) => item[1])) assert.equal(hidden.includes(spoken), false);
      assert.equal(core.visiblePrompt(question, { showAnswer: true }).includes(digits), true);
    }
  }
  const row = core.buildQuestions("row", 4, 3);
  assert.ok(row.every((question) => question.mode === "row"));
});

test("phrase sessions round-trip and old version-1 backups still validate", () => {
  const phrase = core.buildSession({ mode: "phrase", count: 10, seed: 9 });
  assert.equal(phrase.version, 1);
  assert.equal(core.validateSession(JSON.parse(JSON.stringify(phrase))), true);
  assert.equal(phrase.questions.filter((question) => question.answer.digits.startsWith("0")).length, 2);
  const tampered = JSON.parse(JSON.stringify(phrase));
  tampered.questions[0].answer.digits = "9".repeat(tampered.questions[0].answer.digits.length);
  assert.equal(core.validateSession(tampered), false);

  const legacy = core.buildSession({ mode: "map", count: 5, seed: 4 });
  assert.equal(core.validateSession(JSON.parse(JSON.stringify(legacy))), true);
  const row = core.buildSession({ mode: "row", count: 5, seed: 8 });
  assert.equal(core.validateSession(JSON.parse(JSON.stringify(row))), true);
  assert.equal(core.validateSettings({ version: 1, count: 10, phonetic: true, mapPool: "all" }), true);
  assert.equal(core.validateSettings(core.defaultSettings()), true);

  const stats = core.defaultStats();
  core.recordWeak(stats, phrase.questions[0]);
  core.recordWeak(stats, legacy.questions[0]);
  assert.equal(core.validateStats(JSON.parse(JSON.stringify(stats))), true);
  const review = {
    version: 1,
    mode: "review",
    index: 0,
    count: 1,
    finished: false,
    statsPosted: false,
    accumulatedMs: 0,
    questions: [core.freshQuestion(phrase.questions[0])],
  };
  assert.equal(core.validateSession(review), true);
  assert.match(core.referenceNotes().page21Warning, /시연 메모의 21쪽 386/);
  assert.match(core.referenceNotes().page21Warning, /201/);
});

test("phrase tap hides digits until the first tap, then the second tap advances", () => {
  const env = load();
  env.startSession("phrase", { force: true });
  const questions = core.buildQuestions("phrase", 5, 1);
  env.state.session.questions = [0, 1, 2, 3, 4].map((row) => questions.find((question) => question.answer.row === row));
  env.state.session.count = 5;
  env.state.session.index = 0;
  env.render();

  const hidden = env.app.innerHTML;
  assert.equal((hidden.match(/data-action="mode"/g) || []).length, 7);
  assert.match(hidden, /data-mode="phrase"[^>]*class="selected"/);
  assert.match(hidden, /class="big phrase-prompt">OBESE GOATS</);
  assert.equal(hidden.includes("0835360475"), false);
  assert.equal(hidden.includes("오비스 고츠"), false);
  assert.equal(hidden.includes("아이"), false);
  assert.equal(hidden.includes("<input"), false);
  assert.equal(hidden.includes("단서"), false);
  assert.match(hidden, /aria-label="탭해서 답 확인"/);
  assert.equal(hidden.includes('aria-label="0835360475"'), false);
  assert.match(hidden, /data-action="tap"[^>]*>\?<\/button>/);

  click(env, "tap");
  assert.equal(env.current().usedReveal, true);
  assert.equal(env.state.session.index, 0);
  assert.match(env.app.innerHTML, /data-action="tap"[^>]*>0835360475<\/button>/);
  assert.match(env.app.innerHTML, /class="big phrase-prompt">OBESE GOATS</);
  assert.equal(env.app.innerHTML.includes('aria-label="0835360475"'), false);
  assert.equal(env.app.innerHTML.includes("오비스 고츠"), false);
  assert.match(env.app.innerHTML, /data-action="weak-toggle"/);
  assert.match(env.app.innerHTML, /data-action="new-session"/);
  assert.match(env.app.innerHTML, /class="quiz-status"/);
  assert.match(env.app.innerHTML, /class="quiz-actions"/);

  click(env, "tap");
  assert.equal(env.state.session.index, 1);
  assert.equal(env.current().usedReveal, false);
  assert.equal(env.state.stats.totals.direct, 0);
  const nextDigits = core.canonicalAnswerText(env.current());
  assert.equal(env.app.innerHTML.includes(nextDigits), false);
});

test("phrase weak marks survive reload and open a review session", () => {
  const env = load();
  env.startSession("phrase", { force: true });
  const key = env.current().key;
  assert.equal(env.current().mode, "phrase");
  click(env, "weak-toggle");
  env.saveSession();
  const restored = load(Object.fromEntries(env.values));
  assert.equal(restored.state.stats.weak.length, 1);
  assert.equal(restored.state.stats.weak[0].mode, "phrase");
  assert.equal(restored.state.stats.weak[0].key, key);
  assert.match(restored.app.innerHTML, /data-action="weak-toggle"[^>]*aria-pressed="true"/);
  restored.startWeakReview();
  assert.equal(restored.state.session.mode, "review");
  assert.equal(restored.state.session.version, 1);
  assert.equal(restored.current().key, key);
  assert.equal(restored.app.innerHTML.includes(core.canonicalAnswerText(restored.current())), false);
  assert.equal(core.validateSession(restored.state.session), true);
  assert.equal(core.validateStats(restored.state.stats), true);
});

test("stored row and phrase sessions restore without rewriting the sibling backup", () => {
  const row = core.buildSession({ mode: "row", count: 5, seed: 12 });
  const settings = { version: 1, count: 10, phonetic: true, mapPool: "all", practiceStyle: "tap" };
  const rowEnv = load({
    "pimax-practice-session": JSON.stringify(row),
    "pimax-practice-settings": JSON.stringify(settings),
  });
  assert.equal(rowEnv.state.session.mode, "row");
  assert.equal(rowEnv.state.session.questions[0].key, row.questions[0].key);
  assert.equal(rowEnv.state.settings.version, 1);

  const phrase = core.buildSession({ mode: "phrase", count: 5, seed: 15 });
  const phraseEnv = load({
    "pimax-practice-session": JSON.stringify(phrase),
    "pimax-practice-settings": JSON.stringify(settings),
  });
  assert.equal(phraseEnv.state.session.mode, "phrase");
  assert.equal(phraseEnv.current().key, phrase.questions[0].key);
  assert.equal(phraseEnv.app.innerHTML.includes(core.canonicalAnswerText(phraseEnv.current())), false);
});

test("learn chart keeps spoken phrases, drops letter names and the page-21 warning", () => {
  const index = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const sw = readFileSync(new URL("./sw.js", import.meta.url), "utf8");
  assert.match(index, /data-tab="learn">암기표</);
  assert.match(sw, /pimax-practice-v20261005-7/);

  const env = load();
  env.state.tab = "learn";
  env.render();
  const html = env.app.innerHTML;
  assert.match(html, /<h2>암기표<\/h2>/);
  assert.equal(html.includes("<h2>암기</h2>"), false);
  assert.equal(html.includes("시연 메모의 21쪽 386"), false);
  assert.match(html, /10의 자리는 암기표의 줄 0~4, 1의 자리는 1부터 세는 글자 위치입니다\./);
  assert.equal(html.includes('class="names"'), false);
  assert.equal(html.includes("아이"), false);
  assert.equal(html.includes("에스"), false);
  const cards = [...html.matchAll(/<article class="line-card">([\s\S]*?)<\/article>/g)].map((match) => match[1]);
  assert.equal(cards.length, 5);
  for (const [phrase, spoken, digits, grouped] of PHRASES) {
    const card = cards.find((item) => item.includes(phrase));
    assert.ok(card, phrase);
    assert.match(card, new RegExp(spoken));
    assert.match(card, new RegExp(digits));
    assert.match(card, /숫자를 닮은 영어/);
    assert.match(card, /글자를 닮은 숫자/);
    assert.match(card, new RegExp(`숫자를 닮은 영어 ${phrase}`));
    assert.match(card, new RegExp(`글자를 닮은 숫자 ${grouped}`));
    assert.equal((card.match(/glyph-gap/g) || []).length, 2);
    assert.equal((card.match(/<svg/g) || []).length, phrase.replace(/ /g, "").length * 2);
    assert.match(card, /<path /);
  }
  assert.match(cell(html, "N", "letter-digit"), /rotate\(90 18 24\)/);
  assert.doesNotMatch(cell(html, "N", "letter"), /rotate|scale\(-1/);
  assert.match(cell(html, "N", "digit-letter"), /rotate\(-90 18 24\)/);
  assert.match(cell(html, "E", "letter-digit"), /scale\(-1 1\)/);
  assert.match(cell(html, "P", "letter-digit"), /scale\(-1 1\)/);
  assert.match(cell(html, "E", "digit-letter"), /scale\(-1 1\)/);
  assert.match(cell(html, "P", "digit-letter"), /scale\(-1 1\)/);
  assert.match(cell(html, "A", "letter-digit"), /<path /);
  assert.match(html, /보통 글자/);
  assert.match(html, /보통 숫자/);
  assert.equal(html.includes(".pdf"), false);

  env.state.settings.phonetic = false;
  env.render();
  assert.equal(env.app.innerHTML.includes("오비스 고츠"), false);
  assert.match(env.app.innerHTML, /OBESE GOATS/);
  assert.match(env.app.innerHTML, /0835360475/);
});
