import {
  LETTER_OF,
  LINES,
  MODES,
  birthdayAddress,
  canonicalAnswerText,
  buildSession,
  clearWeak,
  weakKeys,
  migrateWeak,
  defaultSettings,
  defaultStats,
  freshQuestion,
  lineDigits,
  pageLocus,
  readSlot,
  recordWeak,
  referenceNotes,
  scoreAnswer,
  summarizeSession,
  validateSession,
  validateSettings,
  validateStats,
} from "./core.mjs";

const KEYS = {
  settings: "pimax-practice-settings",
  stats: "pimax-practice-stats",
  session: "pimax-practice-session",
};

const MODE_LABEL = {
  map: "대응",
  phrase: "문장 대응",
  row: "페이지 1",
  odd: "페이지 2",
  next: "다음 10",
  birthday: "생일",
  review: "다시 풀기",
};

const MODE_DESCRIPTION = {
  row: "암기표의 문장과 숫자열을 줄별로 떠올립니다.",
  odd: "쪽 번호를 보고 그 쪽에서 시작하는 숫자 세 개를 떠올립니다. 1쪽은 원주율의 첫 세 자리입니다.",
  next: "보이는 다섯 자리 다음부터 숫자 열 개를 떠올립니다.",
  phrase: "문장을 보고 전체 숫자열을 떠올립니다.",
  map: "글자와 숫자의 짝을 떠올립니다.",
  birthday: "생일로 쪽, 줄, 시작 자리를 찾습니다.",
};

const state = {
  tab: "practice",
  settings: defaultSettings(),
  stats: defaultStats(),
  session: null,
  notice: "",
  confirmReset: false,
  storageOk: true,
  checker: { page: "", month: "", day: "", order: "MMDD", pageResult: "", dateResult: "" },
};

const blockedSlots = new Set();
let runningSince = Date.now();
let focusAnswer = false;

const main = () => document.querySelector("#app");
const notice = () => document.querySelector("#notice");

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function chunks(lines) {
  return `<p class="subtle explain">${lines.filter(Boolean).map((line) => `<span>${esc(line)}</span>`).join("")}</p>`;
}

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    state.storageOk = false;
    return null;
  }
}

function storageSet(key, value) {
  if (!state.storageOk || blockedSlots.has(key)) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    state.storageOk = false;
    return false;
  }
}

function freshSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
}

function current() {
  const session = state.session;
  if (!session || session.finished) return null;
  return session.questions[session.index] || null;
}

function persistTime() {
  const session = state.session;
  if (!session || session.clockFrozen) return;
  const now = Date.now();
  session.accumulatedMs += Math.max(0, now - runningSince);
  runningSince = now;
}

function saveSettings() {
  storageSet(KEYS.settings, state.settings);
}

function saveStats() {
  storageSet(KEYS.stats, state.stats);
}

function saveSession() {
  persistTime();
  storageSet(KEYS.session, state.session);
}

function formatDuration(ms) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes <= 0) return `${seconds}초`;
  return `${minutes}분 ${seconds}초`;
}

function isPristine(session) {
  if (!session || session.finished || session.review || session.mode === "review") return false;
  if (session.index !== 0) return false;
  return session.questions.every((question) => (
    !question.graded && !question.hintUsed && !question.usedReveal && !String(question.draft || "").trim()
  ));
}

function hasEffort(session) {
  if (!session || session.statsPosted) return false;
  return session.questions.some((question) => question.graded || question.hintUsed || question.usedReveal);
}

function postSession(session) {
  if (!session || session.statsPosted || !hasEffort(session)) return;
  persistTime();
  session.clockFrozen = true;
  session.finished = true;
  const summary = summarizeSession(session);
  const totals = state.stats.totals;
  totals.sessions += 1;
  totals.direct += summary.direct;
  totals.assisted += summary.assisted;
  totals.revealed += summary.revealed;
  totals.wrong += summary.wrong;
  totals.hints += summary.hints;
  totals.reveals += summary.reveals;
  totals.ms += session.accumulatedMs || 0;
  for (const question of session.questions) {
    if (question.graded === "direct") clearWeak(state.stats, question.key);
  }
  state.stats.recent.unshift({
    id: session.id,
    mode: session.mode,
    endedAt: Date.now(),
    count: session.questions.length,
    direct: summary.direct,
    assisted: summary.assisted,
    wrong: summary.wrong,
    revealed: summary.revealed,
    hints: summary.hints,
    reveals: summary.reveals,
    ms: session.accumulatedMs || 0,
  });
  state.stats.recent = state.stats.recent.slice(0, 20);
  session.statsPosted = true;
  saveStats();
}

function weakReviewQuestions() {
  const questions = [];
  for (const item of state.stats.weak) {
    if (!item?.question?.answer || !item.question.public || typeof item.question.hint !== "string") continue;
    questions.push(freshQuestion(item.question));
  }
  return questions;
}

function reviewSession(questions) {
  return {
    version: 1,
    id: `w${Date.now().toString(36)}`,
    mode: "review",
    review: true,
    count: questions.length,
    seed: 0,
    lieLength: 5,
    index: 0,
    finished: false,
    statsPosted: false,
    accumulatedMs: 0,
    questions,
  };
}

function startSession(mode, { force = false, keepTab = false } = {}) {
  if (!MODES.includes(mode)) mode = MODES[0];
  const active = state.session;
  if (!force && active && !active.finished && active.mode === mode && active.mode !== "review") {
    if (!keepTab) state.tab = "practice";
    focusAnswer = state.tab === "practice";
    render();
    return;
  }
  postSession(active);
  const session = buildSession({
    mode,
    count: state.settings.count,
    seed: freshSeed(),
    phraseDisplay: state.settings.phraseDisplay,
  });
  state.session = session;
  runningSince = Date.now();
  if (!keepTab) state.tab = "practice";
  focusAnswer = state.tab === "practice";
  saveSession();
  render();
}

function startWeakReview() {
  const questions = weakReviewQuestions();
  if (!questions.length) {
    state.notice = "약한 것이 없습니다.";
    render();
    return;
  }
  postSession(state.session);
  state.session = reviewSession(questions);
  runningSince = Date.now();
  state.tab = "practice";
  state.notice = "";
  focusAnswer = false;
  saveSession();
  render();
}

function reasonCopy(reason) {
  if (reason === "empty") return "답을 입력해 주세요. 빈 칸은 오답으로 세지 않습니다.";
  if (reason === "chars") return "숫자와 글자를 섞었거나 다른 기호가 있습니다. 공백만 빼고 다시 입력해 주세요.";
  if (reason === "format") return "칸 수가 맞지 않습니다. 안내한 개수대로 나눠 입력해 주세요.";
  return "이 답은 아직 확인할 수 없습니다.";
}

function outcomeCopy(outcome) {
  if (outcome === "direct") return "맞았습니다. 직접 정답으로 기록합니다.";
  if (outcome === "assisted") return "맞았습니다. 단서를 봐서 직접 정답에는 넣지 않습니다.";
  if (outcome === "revealed") return "맞았습니다. 답을 본 뒤에는 직접 정답으로 세지 않습니다.";
  return "다릅니다. 이번 것은 직접 정답에 들어가지 않습니다.";
}

function checkCurrent(raw) {
  const question = current();
  if (!question || question.graded) return;
  const result = scoreAnswer(question, raw, {
    hintUsed: question.hintUsed === true,
    revealed: question.usedReveal === true,
  });
  question.draft = raw;
  if (!result.ok) {
    state.notice = reasonCopy(result.reason);
    saveSession();
    render();
    return;
  }
  question.graded = result.outcome;
  state.notice = outcomeCopy(result.outcome);
  saveSession();
  render();
}

function useHint() {
  const question = current();
  if (!question || question.graded) return;
  question.hintUsed = true;
  question.showHint = true;
  state.notice = "단서를 봤습니다. 맞혀도 직접 정답에는 들어가지 않습니다.";
  saveSession();
  render();
}

function useReveal() {
  const question = current();
  if (!question || question.graded) return;
  question.usedReveal = true;
  state.notice = "답을 공개했습니다. 직접 정답으로 세지 않습니다.";
  saveSession();
  render();
}

function isWeakMarked(question) {
  return state.stats.weak.some((item) => weakKeys(question).includes(item.key));
}

function toggleWeak() {
  const question = current();
  if (!question) return;
  if (isWeakMarked(question)) {
    state.stats.weak = state.stats.weak.filter((item) => !weakKeys(question).includes(item.key));
    state.notice = "약점 표시를 해제했습니다.";
  } else {
    recordWeak(state.stats, question);
    state.notice = "약점으로 표시했습니다.";
  }
  saveStats();
  render();
}

function goNext() {
  const session = state.session;
  const question = current();
  if (!session || !question) return;
  if (!question.graded) {
    if (!question.usedReveal) return;
    question.graded = "revealed";
  }
  state.notice = "";
  if (session.index < session.questions.length - 1) {
    session.index += 1;
    focusAnswer = true;
    saveSession();
    render();
    return;
  }
  postSession(session);
  session.finished = true;
  session.clockFrozen = true;
  saveSession();
  render();
}

function setCount(count) {
  state.settings.count = count;
  saveSettings();
  if (isPristine(state.session)) {
    startSession(state.session.mode, { force: true, keepTab: true });
    state.notice = "문제 수를 바꿨습니다. 아직 풀기 전이라 이 회차에 바로 적용했습니다.";
    notice().textContent = state.notice;
    return;
  }
  state.notice = "문제 수는 다음 회차부터 적용됩니다. 지금 문제는 그대로입니다.";
  render();
}

function setPhonetic(on) {
  state.settings.phonetic = on;
  saveSettings();
  state.notice = on ? "발음 도움을 켭니다." : "발음 도움을 끕니다. 철자와 숫자는 그대로입니다.";
  render();
}

function setMapPool(pool) {
  const next = pool === "weak" ? "weak" : "all";
  const same = state.settings.mapPool === next;
  if (same && next === "weak" && state.session?.mode === "review" && !state.session.finished) {
    render();
    return;
  }
  if (same && next === "all" && state.session?.mode !== "review") {
    render();
    return;
  }
  state.settings.mapPool = next;
  saveSettings();
  if (next === "weak") {
    startWeakReview();
    return;
  }
  if (state.session?.mode === "review") {
    startSession("map", { force: true });
    state.notice = "전체 문제로 시작합니다.";
    notice().textContent = state.notice;
    return;
  }
  state.notice = "";
  render();
}

function resetStats() {
  blockedSlots.delete(KEYS.stats);
  state.stats = defaultStats();
  state.confirmReset = false;
  saveStats();
  state.notice = "이 기기의 연습 기록을 지웠습니다. 지금 문제는 남겨 두었습니다.";
  render();
}

function runPageCheck() {
  const raw = String(state.checker.page).trim();
  const page = Number(raw);
  if (raw === "") {
    state.checker.pageResult = "쪽 번호를 입력해 주세요.";
  } else if (page === 1) {
    state.checker.pageResult = "1쪽은 314입니다. 52자리 순환으로 계산하지 않습니다.";
  } else if (!Number.isInteger(page) || page < 3 || page > 49 || page % 2 === 0) {
    state.checker.pageResult = "1쪽 또는 3-49쪽 중 홀수 번호를 입력해 주세요.";
  } else {
    const locus = pageLocus(page);
    if (!locus.ok) state.checker.pageResult = "3-49쪽 중 홀수 번호를 확인합니다. 1쪽은 원주율 예외입니다.";
    else {
      const even = page % 2 === 0 ? " 짝수 쪽은 연습 문제에 넣지 않습니다." : "";
      state.checker.pageResult = `${page}쪽 · 암기 줄 ${locus.row} · ${locus.column}번째 · ${locus.letters} · ${locus.digits}.${even}`;
    }
  }
  render();
}

function runDateCheck() {
  const monthRaw = String(state.checker.month).trim();
  const dayRaw = String(state.checker.day).trim();
  if (monthRaw === "" || dayRaw === "") {
    state.checker.dateResult = "월과 일을 모두 입력해 주세요. 연도는 묻지 않습니다.";
    render();
    return;
  }
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const address = birthdayAddress(month, day, state.checker.order);
  if (!address.ok) {
    state.checker.dateResult = "없는 날짜입니다. 2월 29일만 예외로 받을 수 있고, 연도는 묻지 않습니다.";
  } else {
    const orderLabel = address.order === "MMDD" ? "월일" : "일월";
    state.checker.dateResult = `${orderLabel} ${address.dateStr} · ${address.page}쪽 · 줄 ${address.line} · 시작 ${address.column}번째. 생일의 줄 번호와 암기표의 줄 번호는 다릅니다.`;
  }
  render();
}

function renderNav() {
  document.body.dataset.tab = state.tab;
  for (const button of document.querySelectorAll("#nav button")) {
    const on = button.dataset.tab === state.tab;
    button.classList.toggle("active", on);
    if (on) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  const root = main();
  if (state.tab === "settings") root.setAttribute("data-product-settings", "");
  else root.removeAttribute("data-product-settings");
}

function answerInput(question) {
  const answer = question.answer;
  const digits = answer.type === "next"
    || answer.type === "birthday"
    || answer.type === "lie"
    || (answer.type === "map" && answer.kind === "letter")
    || (answer.type === "row" && (answer.kind === "digits" || answer.kind === "next-digits"))
    || (answer.type === "odd" && answer.special === "pi");
  return { mode: digits ? "numeric" : "text", capitalize: digits ? "off" : "characters" };
}

function modeButtons() {
  return MODES.map((mode) => {
    const selected = state.session?.mode === mode;
    return `<button type="button" data-action="mode" data-mode="${mode}" class="${selected ? "selected" : ""}" aria-pressed="${selected ? "true" : "false"}">${MODE_LABEL[mode]}</button>`;
  }).join("");
}

function poolSwitch() {
  const pool = state.settings.mapPool === "weak" ? "weak" : "all";
  return `<div class="subswitch" role="group" aria-label="문제 범위">
      <button type="button" data-action="map-pool" data-pool="all" class="${pool === "all" ? "selected" : ""}" aria-pressed="${pool === "all" ? "true" : "false"}">전체</button>
      <button type="button" data-action="map-pool" data-pool="weak" class="${pool === "weak" ? "selected" : ""}" aria-pressed="${pool === "weak" ? "true" : "false"}">약한 것</button>
    </div>`;
}

function practiceHtml() {
  const session = state.session;
  const summary = summarizeSession(session);
  const done = session.questions.filter((question) => question.graded).length;
  const width = Math.round((done / session.questions.length) * 100);
  const live = session.finished ? session.accumulatedMs : (session.accumulatedMs || 0) + Math.max(0, Date.now() - runningSince);
  const question = current();
  let body;
  if (!question) {
    body = `${summaryHtml(summary)}
      <button type="button" data-action="new-session">새 회차</button>`;
  } else {
    const showAnswer = question.graded || question.usedReveal;
    const markedWeak = isWeakMarked(question);
    const bigClass = ["big", question.public.bigClass || ""].filter(Boolean).join(" ");
    const answerText = showAnswer
      ? (question.answer.type === "phrase"
        ? `<span>${esc(question.answer.phrase)}</span><span>${esc(canonicalAnswerText(question))}</span>`
        : esc(canonicalAnswerText(question).replaceAll("|", " / ")))
      : "?";
    const mapPictures = showAnswer && question.answer.type === "map"
      ? `<span class="map-answer-pictures">${inkGlyph(question.answer.letter, question.answer.kind === "digit" ? "letter-digit" : "digit-letter")}${inkGlyph(question.answer.letter, question.answer.kind === "digit" ? "letter" : "digit")}</span>`
      : "";
    const answerContent = mapPictures ? `${mapPictures}<span class="map-answer-text">${answerText}</span>` : answerText;
    const answerName = showAnswer ? "" : ` aria-label="탭해서 답 확인"`;
    body = `<article class="practice-card">
      <p class="kicker">${esc(question.public.kicker)}</p>
      <p class="${esc(bigClass)}">${esc(question.public.big)}</p>
      <p class="caption">${esc(question.public.note.replaceAll("입력합니다", "떠올립니다").replaceAll("다시 쓰지 않습니다", "포함하지 않습니다"))}</p>
    </article>
    <div class="quiz-actions answer-${esc(question.answer.type)}">
      <button type="button" class="blind-answer${question.answer.type === "phrase" ? " phrase-answer" : ""}${mapPictures ? " map-answer" : ""}" data-action="tap"${answerName}>${answerContent}</button>
      <p class="quiz-status">${showAnswer ? "한 번 더 탭하면 다음" : ""}</p>
      <button type="button" data-action="weak-toggle" aria-pressed="${markedWeak ? "true" : "false"}" class="weak-toggle">약점</button>
      <button type="button" data-action="new-session">새 회차</button>
    </div>`;
  }
  const phraseControls = session.mode === "phrase"
    ? `<div class="subswitch" role="group" aria-label="문장 표시">${[["full", "전체 문장"], ["half", "반만"]].map(([value, label]) => `<button type="button" data-action="phrase-display" data-value="${value}" class="${(state.settings.phraseDisplay || "full") === value ? "selected" : ""}" aria-pressed="${(state.settings.phraseDisplay || "full") === value}">${label}</button>`).join("")}</div>`
    : "";
  return `<section class="workspace practice-workspace">
    <div class="practice-controls">
      <div class="sr-only"><h2>연습</h2><span>${esc(formatDuration(live))}</span></div>
      <div class="mode-switch" role="group" aria-label="연습 종류">${modeButtons()}</div>
      ${phraseControls}
      <p class="mode-description">${esc(MODE_DESCRIPTION[session.mode] || "표시한 약점을 다시 떠올립니다.")}</p>
      <div class="practice-progress">
        <span>${session.finished ? "회차 끝" : `문제 ${session.index + 1} / ${session.questions.length}`}</span>
        ${poolSwitch()}
      </div>
      <div class="bar" aria-hidden="true"><span style="width:${width}%"></span></div>
    </div>
    <div class="practice-stage">${body}</div>
  </section>`;
}

function summaryHtml(summary) {
  return `<section class="panel">
    <h3>이번 회차</h3>
    <div class="stats-grid">
      <div class="metric"><strong>${summary.direct}</strong><span>직접 정답</span></div>
      <div class="metric"><strong>${summary.wrong}</strong><span>오답</span></div>
      <div class="metric"><strong>${summary.assisted + summary.revealed}</strong><span>보고 맞힘</span></div>
    </div>
  </section>`;
}

/* Original ink strokes. N→2 is a quarter-turn. E→3 and P→9 are mirrors. */
const LETTER_PATH = {
  O: "M18 11c-6.2 0-10.2 6.2-10.2 13s4 13 10.2 13 10.2-6.2 10.2-13-4-13-10.2-13z",
  I: "M11 10h14M18 10v28M11 38h14",
  N: "M9 10v28M27 10v28M9 10L27 38",
  E: "M27 10H11v28h16M11 24h12",
  A: "M18 9L8 40M18 9l10 31M12 27h12",
  S: "M25 16c0-4.2-3.2-7-7-7s-7 2.4-7 6c0 7 14 3.5 14 11.5 0 4.2-3.4 7.5-8 7.5s-7.6-2.6-7.6-6",
  G: "M25 16c0-5-3.8-8-8.4-8C11 8 8 13 8 24s3.2 16 9.2 16c4 0 7-1.8 8-5h-7",
  T: "M8 12h20M18 12v26",
  B: "M11 10v28M11 10h8c5.4 0 8.4 2.6 8.4 6.5S24.4 23 19 23H11M11 23h9c5.8 0 9 2.8 9 7.2S25.6 38 19.4 38H11",
  P: "M11 10v28M11 10h8c6.2 0 9.6 3 9.6 7.5S25.2 25 19 25H11",
};

const DIGIT_PATH = {
  O: "M18 7c-5 0-8.2 7.4-8.2 17S13 41 18 41s8.2-7.4 8.2-17S23 7 18 7z",
  I: "M15 15L19 8v30M12 38h14",
  N: "M8 15h18L10 38h18",
  E: "M12 12h12c6.5 0 8 5 5.5 8.5-2 2.6-6 3.5-11 3.5 6 .6 11 2.8 11.5 7.8.6 5.4-3.6 8.2-10 8.2H12",
  A: "M22 8v31M22 8L8 25h18",
  S: "M26 12H12v9c7 .6 12 2.4 12 8.4C24 37 19 41 13 41c-4 0-7-2-8-5",
  G: "M23 13C17 6 8 12 9 23c1 12 15 15 18 6 1.2-3.6-1.6-6-5.6-6",
  T: "M8 11h20L12 40",
  B: "M18 24c-5.4 0-9-4-9-8.2S12.8 8 18 8s9 3.6 9 7.8-3.6 8.2-9 8.2zm0 0c-6 0-10 4.4-10 9S12.2 42 18 42s10-4.2 10-9-4-9-10-9z",
  P: "M23 18c0-6-4.6-10-10-10S4 12 4 18s4.2 9 9.6 9c4.8 0 9.4-.6 9.4-.6V40",
};

const TOWARD_DIGIT = {
  O: "M18 8c-4.4 0-7.2 7-7.2 16s2.8 16 7.2 16 7.2-7 7.2-16-2.8-16-7.2-16z",
  I: "M14 16L18 9v29M12 38h12",
  A: "M23 8v32M23 8L8 26h18",
  S: "M26 11H11v10c8 .4 13 2.4 13 8.8C24 37.5 19 41 13 41c-3.6 0-6.4-1.8-7.2-4.4",
  G: "M22 12C15 6 8 13 10 24c1.4 10 12 14 16 6.5 1.6-3-1-5.5-5-5.5-3.2 0-5 1.6-5 3.6",
  T: "M8 11h20L12 40",
  B: "M18 24c-5.2 0-8.6-4-8.6-8S13 8 18 8s8.6 3.6 8.6 8-3.4 8-8.6 8zm0 0c-5.8 0-9.6 4.2-9.6 8.8S12.4 42 18 42s9.4-4.2 9.4-9.2S23.8 24 18 24z",
};

const TOWARD_LETTER = {
  O: "M18 11c-7.2 0-12 5.4-12 13s4.8 13 12 13 12-5.4 12-13-4.8-13-12-13z",
  I: "M18 9v29M11 11h14M11 38h14",
  A: "M18 9L8 40M18 9l10 31M11 27h14M24 14v24",
  S: "M24 15c-1-5-6-8-10-6-4 2-3 6 0 8 4 2.4 12 3 13 9 1 5.2-3 10-9 10-5 0-8-2.4-9-6",
  G: "M24 16c0-6-4-9-9-9S7 12 8 23c1 12 12 15 16 8 1.4-2.4.2-4.2-2.4-4.6H16",
  T: "M8 11h20M16 13L18 40",
  B: "M12 8v32M18 24c-5 0-8-3.6-8-7.6S13.2 9 18 9s8 3.2 8 7.4S23 24 18 24zm0 0c-5.6 0-9 4-9 8.6S12.6 41 18 41s9-3.6 9-8.4S23.6 24 18 24z",
};

function glyphSpec(letter, form) {
  if (form === "letter") return { d: LETTER_PATH[letter] };
  if (form === "digit") return { d: DIGIT_PATH[letter] };
  if (form === "letter-digit") {
    if (letter === "N") return { d: LETTER_PATH.N, transform: "rotate(90 18 24)" };
    if (letter === "E" || letter === "P") return { d: LETTER_PATH[letter], transform: "translate(36 0) scale(-1 1)" };
    return { d: TOWARD_DIGIT[letter] };
  }
  if (letter === "N") return { d: DIGIT_PATH.N, transform: "rotate(-90 18 24)" };
  if (letter === "E" || letter === "P") return { d: DIGIT_PATH[letter], transform: "translate(36 0) scale(-1 1)" };
  return { d: TOWARD_LETTER[letter] };
}

function inkGlyph(letter, form) {
  const spec = glyphSpec(letter, form);
  const transform = spec.transform ? ` transform="${spec.transform}"` : "";
  return `<svg class="ink-glyph" viewBox="0 0 36 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"${transform}><path d="${spec.d}"/></g></svg>`;
}

function glyphRun(line, form) {
  const digits = lineDigits(line.row);
  const glyphs = [];
  for (const ch of line.phrase) {
    if (ch === " ") glyphs.push(`<span class="glyph-gap"></span>`);
    else glyphs.push(inkGlyph(ch, form));
  }
  const grouped = [];
  let index = 0;
  for (const ch of line.phrase) {
    if (ch === " ") grouped.push(" ");
    else {
      grouped.push(digits[index]);
      index += 1;
    }
  }
  const label = form === "letter-digit"
    ? `숫자를 닮은 영어 ${line.phrase}`
    : `글자를 닮은 숫자 ${grouped.join("")}`;
  return `<div class="glyph-row" aria-hidden="true">${glyphs.join("")}</div><p class="sr-only">${esc(label)}</p>`;
}

function shapeChart() {
  const forms = [
    ["letter", "보통 글자"],
    ["letter-digit", "숫자를 닮은 글자"],
    ["digit-letter", "글자를 닮은 숫자"],
    ["digit", "보통 숫자"],
  ];
  const groups = [LETTER_OF.slice(0, 5), LETTER_OF.slice(5)].map((letters, group) => {
    const rows = forms.map(([form, label]) => {
      const cells = letters.map((letter) => (
        `<div class="shape-cell" data-letter="${letter}" data-form="${form}">${inkGlyph(letter, form)}</div>`
      )).join("");
      return `<div class="shape-row"><div class="shape-label">${label}</div>${cells}</div>`;
    }).join("");
    const heads = letters.map((letter, digit) => `<div class="shape-label shape-axis"><span>${letter}</span><span>↔</span><span>${digit + group * 5}</span></div>`).join("");
    return `<div class="shape-group"><div class="shape-row shape-head"><div class="shape-label">대응</div>${heads}</div>${rows}</div>`;
  }).join("");
  return `<section class="panel shape-panel">
    <h3>모양 비교</h3>
    ${chunks(["글자↔숫자. N은 돌려 2가 되고, E와 P는 좌우를 뒤집어 3과 9가 됩니다."])}
    <div class="shape-scroll">
      ${groups}
    </div>
    <p class="sr-only">O는 0, I는 1, N은 2, E는 3, A는 4, S는 5, G는 6, T는 7, B는 8, P는 9.</p>
  </section>`;
}

function learnHtml() {
  const notes = referenceNotes();
  const phonetic = state.settings.phonetic;
  const birthdayMMDD = birthdayAddress(3, 14, "MMDD");
  const birthdayDDMM = birthdayAddress(3, 14, "DDMM");
  const lines = LINES.map((line) => `<article class="line-card">
      <p class="phrase"><span class="spell">${esc(line.phrase)}</span>${phonetic ? `<span class="spoken">${esc(line.spoken)}</span>` : ""}</p>
      <p class="digits-line">${esc(lineDigits(line.row))}</p>
      <p class="shape-caption">숫자를 닮은 영어</p>
      ${glyphRun(line, "letter-digit")}
      <p class="shape-caption">글자를 닮은 숫자</p>
      ${glyphRun(line, "digit-letter")}
    </article>`).join("");
  return `<section class="learn">
    <div>
      <h2>암기표</h2>
      ${chunks(["다섯 줄을 먼저 읽고, 연습 탭에서 가린 답을 확인합니다.", "한글 발음은 문장 전체의 읽기 도움이고, 숫자 변환은 영문 철자만 봅니다."])}
    </div>
    <div class="line-list">${lines}</div>
    ${shapeChart()}
    <section class="panel formula">
      <h3>페이지 1</h3>
      ${chunks([MODE_DESCRIPTION.row])}
    </section>
    <section class="panel formula">
      <h3>페이지 2</h3>
      ${chunks([MODE_DESCRIPTION.odd])}
      ${chunks([
        "10의 자리는 암기표의 줄 0-4, 1의 자리는 1부터 세는 글자 위치입니다.",
        "찾은 글자와 다음 두 글자를 읽습니다. 줄이 넘어가도 순환을 따라갑니다.",
        notes.piWarning,
        notes.after49,
      ])}
    </section>
    <section class="panel formula">
      <h3>생일 페이지 찾는 법</h3>
      ${chunks([
        "쪽 = 일 + 50",
        "줄 = 월 × 2",
        "MMDD(월일) 시작 = 월 + 3",
        "DDMM(일월) 시작 = 월 + 1",
        `예: 3월 14일 → 쪽 ${birthdayMMDD.page}, 줄 ${birthdayMMDD.line}, MMDD 시작 ${birthdayMMDD.column}, DDMM 시작 ${birthdayDDMM.column}`,
        "2월 29일 허용 · 번호는 1부터",
        "생일의 줄 번호와 암기표의 줄 번호는 다릅니다.",
      ])}
    </section>
    <section class="panel formula">
      <h3>다음 10</h3>
      ${chunks([
        MODE_DESCRIPTION.next,
        "52번째 다음은 첫 자리로 돌아갑니다. 이것은 원주율 전체가 아닙니다.",
      ])}
    </section>
    <section class="panel address-checker">
      <h3>쪽과 생일 확인</h3>
      <div class="checker-grid">
        <section class="checker-block">
          <label class="checker-label" for="page-check">쪽 번호</label>
          <form id="page-form" class="checker-form">
            <input id="page-check" inputmode="numeric" autocomplete="off" value="${esc(state.checker.page)}" placeholder="예: 17" aria-label="쪽 번호">
            <button type="submit" class="primary">쪽 계산</button>
          </form>
          <div class="checker-result" role="status" aria-live="polite">${state.checker.pageResult ? esc(state.checker.pageResult).split(" · ").map(part => `<span>${part}</span>`).join("") : '<span class="subtle">쪽 번호를 넣어<br>암기 위치를 확인하세요.</span>'}</div>
        </section>
        <section class="checker-block">
          <p class="checker-label">생일 페이지</p>
          <div class="subswitch" role="group" aria-label="날짜 순서">
            <button type="button" data-action="checker-order" data-order="MMDD" class="${state.checker.order === "MMDD" ? "selected" : ""}">월일</button>
            <button type="button" data-action="checker-order" data-order="DDMM" class="${state.checker.order === "DDMM" ? "selected" : ""}">일월</button>
          </div>
          <form id="date-form" class="checker-date-form">
            <label for="month-check">월<input id="month-check" inputmode="numeric" autocomplete="off" value="${esc(state.checker.month)}" placeholder="월"></label>
            <label for="day-check">일<input id="day-check" inputmode="numeric" autocomplete="off" value="${esc(state.checker.day)}" placeholder="일"></label>
            <button type="submit" class="primary">날짜 계산</button>
          </form>
          <div class="checker-result checker-date-result" role="status" aria-live="polite">${state.checker.dateResult ? esc(state.checker.dateResult).replace("번째. 생일", "번째 · 생일").split(" · ").map(part => `<span>${part}</span>`).join("") : '<span class="subtle">월과 일을 넣어<br>생일 페이지를 확인하세요.</span>'}</div>
        </section>
      </div>
    </section>
  </section>`;
}

let deferredPrompt = null;
function standaloneDisplay() {
  let mode = false;
  try {
    if (typeof window.matchMedia === "function") mode = window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: window-controls-overlay)").matches;
  } catch {}
  return mode || (typeof navigator !== "undefined" && navigator.standalone === true);
}
function promptReady(event) {
  return !!event && event.isTrusted !== false && typeof event.prompt === "function" && !!event.userChoice && typeof event.userChoice.then === "function";
}
function installLines() {
  const nav = typeof navigator === "undefined" ? {} : navigator;
  const ua = String(nav.userAgent || ""), touch = Number(nav.maxTouchPoints) || 0;
  const ios = /iPad|iPhone|iPod/.test(ua) || (String(nav.platform || "") === "MacIntel" && touch > 1);
  if (ios) {
    if (/CriOS|FxiOS|EdgiOS/.test(ua)) return ["지금 브라우저에서는 설치 창이 안 열릴 수 있어요.", "Safari로 이 주소를 연 뒤 공유, 홈 화면에 추가를 눌러 주세요."];
    return ["Safari 아래의 공유 버튼을 누르고", "홈 화면에 추가를 눌러 주세요.", "‘웹 앱으로 열기’가 보이면 켜 주세요."];
  }
  if (/Android/i.test(ua)) return ["앱 설치 버튼이 없으면 Chrome 메뉴에서", "‘앱 설치’를 눌러 주세요.", "‘홈 화면에 추가’는 바로가기일 수 있어요."];
  return ["설치 창이 없으면 브라우저 메뉴에서", "‘앱 설치’를 확인해 주세요."];
}
let installed = false;
let installHelp = false;
let showInstallSheet = false;
let focusInstallSheet = false;
let installLayerOpen = false;
let installReturnFocus = null;
let pageRevealWatch = null;
let pullingSheetFocus = false;
const installInertNodes = new Set();
function installPanel() {
  if (installed || standaloneDisplay()) return "";
  return `<section class="panel install-card" data-install-card>
        <h3>홈 화면에 설치</h3>
        ${chunks(["홈 화면에 설치하면 공연 중에도 바로 열 수 있어요."])}
        ${chunks(installLines())}${installHelp ? chunks(["브라우저 메뉴를 열어 위 순서대로 설치해 주세요."]) : ""}
        <div class="install-actions">
          <button type="button" data-action="install" class="primary"${promptReady(deferredPrompt) ? "" : ` aria-expanded="${installHelp}"`}>${promptReady(deferredPrompt) ? "앱 설치" : (installHelp ? "설치 방법 접기" : "설치 방법 보기")}</button>
        </div>
      </section>
      `;
}
function installSheetOpen() {
  return showInstallSheet && !installed && !standaloneDisplay();
}
function installSheetHtml() {
  if (!installSheetOpen()) return "";
  const ready = promptReady(deferredPrompt);
  const steps = ready ? "" : `<div id="install-sheet-steps">${chunks(installLines())}</div>`;
  const primary = ready ? `<button type="button" class="primary" data-action="install">앱 설치</button>` : "";
  return `<div class="install-sheet" data-install-sheet>
      <div class="install-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="install-sheet-title"${ready ? "" : ` aria-describedby="install-sheet-steps"`}>
        <h2 id="install-sheet-title">홈 화면에 설치</h2>
        ${chunks(["홈 화면에 설치하면 공연 중에도 바로 열 수 있어요."])}
        ${steps}
        <div class="install-actions">
          ${primary}
          <button type="button" class="${ready ? "" : "primary"}" data-action="install-later">나중에</button>
        </div>
      </div>
    </div>`;
}
function closeInstallSheet() {
  showInstallSheet = false;
  focusInstallSheet = false;
  render();
}
function rerenderInstall() {
  render();
}
async function runInstall() {
  const event = deferredPrompt;
  if (standaloneDisplay()) return;
  if (!promptReady(event)) { installHelp = !installHelp; rerenderInstall(); return; }
  deferredPrompt = null;
  rerenderInstall();
  try {
    await event.prompt();
    await event.userChoice;
  } catch {}
  rerenderInstall();
}
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    if (!promptReady(event) || standaloneDisplay()) return;
    if (typeof event.preventDefault === "function") event.preventDefault();
    deferredPrompt = event;
    if (installSheetOpen()) focusInstallSheet = true;
    rerenderInstall();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    showInstallSheet = false;
    focusInstallSheet = false;
    deferredPrompt = null;
    rerenderInstall();
  });
  window.addEventListener("keydown", onKeyDown);
}

function settingsHtml() {
  const counts = [5, 10, 15, 20].map((count) => (
    `<button type="button" data-action="count" data-count="${count}" class="${state.settings.count === count ? "selected" : ""}">${count}</button>`
  )).join("");
  return `<section class="workspace">
    <h2>설정</h2>
    <header class="settingsbrand"><img src="./brand-logo.png" alt="Pi Max 연습실 로고" width="600" height="200"></header><details class="overview"><summary>개요</summary><p>원주율은 소수점 아래로 끝없이 이어지는 숫자임.</p><p>연습하면 그 흐름 속 위치를 알아보고 다음 숫자를 찾아갈 수 있음.</p><p>무한을 다 갖는 것이 아니라 길을 잃지 않는 감각을 익히는 연습실임.</p><p>끝없이 이어지는 숫자에도, 다음으로 향하는 길은 존재함.</p><p>Pi Max 연습실은 무한한 흐름 속에서 자신의 위치를 찾아가는 도구임.</p></details>
    ${chunks(["회차 길이와 발음 표시만 바꿉니다. 지금 문제는 탭을 옮겨도 유지됩니다."])}
    <div class="settings-groups">
      <section class="panel">
        <h3>회차 문제 수</h3>
        <div class="mode-switch" role="group" aria-label="문제 수">${counts}</div>
        ${chunks(["아직 답을 쓰지 않은 회차는 바로 바뀝니다. 풀기 시작한 회차는 다음부터입니다."])}
      </section>
      <section class="panel">
        <h3>발음 도움</h3>
        <div class="subswitch" role="group" aria-label="발음 표시">
          <button type="button" data-action="phonetic" data-on="true" class="${state.settings.phonetic ? "selected" : ""}">켜기</button>
          <button type="button" data-action="phonetic" data-on="false" class="${state.settings.phonetic ? "" : "selected"}">끄기</button>
        </div>
        ${chunks(["켜면 암기표 문장 옆의 한글 발음만 보여 줍니다. 글자마다의 이름은 보이지 않고, 연습 화면에는 발음을 표시하지 않습니다."])}
      </section>
      ${installPanel()}
      <section class="panel">
        <h3>기록 지우기</h3>
        ${chunks(["연습 기록만 지웁니다.", "지금 문제는 남습니다."])}
        ${state.confirmReset
          ? `<div class="train-actions"><button type="button" data-action="reset-yes" class="primary">정말 지우기</button><button type="button" data-action="reset-no">취소</button></div>`
          : `<button type="button" data-action="reset-ask">기록 지우기</button>`}
      </section>
    </div>
  </section>`;
}

function render() {
  if (state.tab === "record") state.tab = "settings";
  const scrollY = typeof window !== "undefined" && typeof window.scrollY === "number" ? window.scrollY : null;
  renderNav();
  const root = main();
  const page = state.tab === "learn" ? learnHtml() : state.tab === "settings" ? settingsHtml() : practiceHtml();
  root.innerHTML = page + installSheetHtml();
  notice().textContent = state.notice || "";
  focusAnswer = false;
  syncInstallLayer();
  if (scrollY != null && typeof window.scrollTo === "function" && window.scrollY !== scrollY) window.scrollTo(0, scrollY);
}

// The distribution access guard sets documentElement.style.visibility = "hidden"
// until /tools/_check reveals the page. A focus call made while hidden does not stick.
function pageConcealed() {
  if (typeof document === "undefined") return false;
  let root = null;
  try { root = document.documentElement; } catch { return false; }
  if (!root || !root.style) return false;
  let visibility = "";
  try { visibility = root.style.visibility; } catch { return false; }
  return String(visibility || "").toLowerCase() === "hidden";
}

function installSheetElement() {
  const root = main();
  if (!root || typeof root.querySelector !== "function") return null;
  return root.querySelector("[data-install-sheet]");
}

function clearInstallInert() {
  for (const el of installInertNodes) {
    try {
      el.inert = false;
      if (typeof el.removeAttribute === "function") el.removeAttribute("data-install-inert");
    } catch { /* detached nodes can ignore cleanup */ }
  }
  installInertNodes.clear();
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return;
  let extras = [];
  try { extras = Array.from(document.querySelectorAll("[data-install-inert]")); } catch { extras = []; }
  for (const el of extras) {
    try {
      el.inert = false;
      if (typeof el.removeAttribute === "function") el.removeAttribute("data-install-inert");
    } catch { /* detached nodes can ignore cleanup */ }
  }
}

function markInstallInert(el) {
  if (!el) return;
  installInertNodes.add(el);
  try { el.inert = true; } catch { /* inert is best-effort where the property is unsupported */ }
  if (typeof el.setAttribute === "function") el.setAttribute("data-install-inert", "");
}

// The sheet lives inside #app, so the app root itself cannot be inert.
function markBackgroundInert(sheet) {
  let node = sheet;
  const body = typeof document !== "undefined" ? document.body : null;
  while (node && node.parentElement) {
    const parent = node.parentElement;
    const children = parent.children;
    if (children && typeof children.length === "number") {
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i];
        if (child !== node) markInstallInert(child);
      }
    }
    if (!body || parent === body) break;
    node = parent;
  }
}

function rememberInstallReturn(sheet) {
  if (installLayerOpen) return;
  const active = typeof document !== "undefined" ? document.activeElement : null;
  if (!active || active === document.body || active === document.documentElement) {
    installReturnFocus = null;
    return;
  }
  if (sheet && typeof sheet.contains === "function" && sheet.contains(active)) {
    installReturnFocus = null;
    return;
  }
  installReturnFocus = active;
}

function restoreInstallFocus() {
  const saved = installReturnFocus;
  installReturnFocus = null;
  let target = saved && saved.isConnected !== false ? saved : null;
  if ((!target || typeof target.focus !== "function") && typeof document !== "undefined" && typeof document.querySelector === "function") {
    target = document.querySelector("#nav button[aria-current='page']") || document.querySelector("#app button");
  }
  if (target && typeof target.focus === "function") {
    try { target.focus(); } catch { /* restoring focus is optional */ }
  }
}

function disarmPageReveal() {
  if (!pageRevealWatch) return;
  const stop = pageRevealWatch;
  pageRevealWatch = null;
  try { stop(); } catch { /* the watcher may already have disconnected */ }
}

function armPageReveal() {
  if (pageRevealWatch || typeof document === "undefined") return;
  const root = document.documentElement;
  if (!root) return;
  let observer = null;
  let timer = null;
  const stop = () => {
    if (observer) {
      try { observer.disconnect(); } catch { /* already disconnected */ }
      observer = null;
    }
    if (timer != null && typeof clearInterval === "function") {
      clearInterval(timer);
      timer = null;
    }
    if (pageRevealWatch === stop) pageRevealWatch = null;
  };
  const retry = () => {
    if (!installSheetOpen()) {
      stop();
      return;
    }
    if (pageConcealed()) return;
    stop();
    moveFocusToInstallSheet();
  };
  pageRevealWatch = stop;
  let watching = false;
  try {
    if (typeof MutationObserver === "function") {
      observer = new MutationObserver(retry);
      observer.observe(root, { attributes: true, attributeFilter: ["style"] });
      watching = true;
    }
  } catch {
    observer = null;
    watching = false;
  }
  if (!watching && typeof setInterval === "function") timer = setInterval(retry, 50);
}

function syncInstallLayer() {
  const sheet = installSheetOpen() ? installSheetElement() : null;
  if (!sheet) {
    clearInstallInert();
    disarmPageReveal();
    if (installLayerOpen && !pageConcealed()) restoreInstallFocus();
    else installReturnFocus = null;
    installLayerOpen = false;
    return;
  }
  rememberInstallReturn(sheet);
  clearInstallInert();
  markBackgroundInert(sheet);
  installLayerOpen = true;
  moveFocusToInstallSheet();
}

function sheetFocusable(sheet) {
  if (!sheet || typeof sheet.querySelectorAll !== "function") return [];
  let nodes = [];
  try {
    nodes = Array.from(sheet.querySelectorAll("button, a[href], input, select, textarea, [tabindex]"));
  } catch {
    return [];
  }
  return nodes.filter((el) => {
    if (!el || el.disabled) return false;
    if (typeof el.getAttribute === "function" && el.getAttribute("tabindex") === "-1") return false;
    if (typeof el.getAttribute === "function" && el.getAttribute("type") === "hidden") return false;
    return true;
  });
}

function trapInstallTab(event) {
  const sheet = installSheetElement();
  if (!sheet) return;
  const focusable = sheetFocusable(sheet);
  if (!focusable.length) {
    if (typeof event.preventDefault === "function") event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = typeof document !== "undefined" ? document.activeElement : null;
  const inside = !!(active && typeof sheet.contains === "function" && sheet.contains(active));
  const backward = !!event.shiftKey;
  if (!inside || (backward && active === first) || (!backward && active === last)) {
    if (typeof event.preventDefault === "function") event.preventDefault();
    const target = backward ? last : first;
    if (typeof target.focus === "function") {
      try { target.focus(); } catch { /* keep the key from leaving the sheet */ }
    }
  }
}

function moveFocusToInstallSheet() {
  if (!installSheetOpen()) return;
  if (pageConcealed()) {
    armPageReveal();
    return;
  }
  disarmPageReveal();
  const sheet = installSheetElement();
  if (!sheet || typeof sheet.querySelector !== "function") return;
  const active = typeof document !== "undefined" ? document.activeElement : null;
  if (!focusInstallSheet && active && typeof sheet.contains === "function" && sheet.contains(active)) return;
  focusInstallSheet = false;
  const button = sheet.querySelector("[data-action='install']") || sheet.querySelector("button");
  if (button && typeof button.focus === "function") {
    pullingSheetFocus = true;
    try { button.focus(); } catch { /* focus is optional when the view is not visible */ }
    finally { pullingSheetFocus = false; }
  }
}

function onFocusIn(event) {
  if (pullingSheetFocus || !installSheetOpen() || pageConcealed()) return;
  const sheet = installSheetElement();
  if (!sheet || typeof sheet.querySelector !== "function") return;
  const target = event && event.target;
  if (target && typeof sheet.contains === "function" && sheet.contains(target)) return;
  const button = sheet.querySelector("[data-action='install']") || sheet.querySelector("button");
  if (!button || button === target || typeof button.focus !== "function") return;
  pullingSheetFocus = true;
  try { button.focus(); } catch { /* the tab trap is the primary guard */ }
  finally { pullingSheetFocus = false; }
}

function onKeyDown(event) {
  if (!event || !installSheetOpen()) return;
  if (event.key !== "Escape" && event.key !== "Tab") return;
  if (event.installKeyHandled) return;
  event.installKeyHandled = true;
  if (event.key === "Escape") {
    if (typeof event.preventDefault === "function") event.preventDefault();
    closeInstallSheet();
    return;
  }
  trapInstallTab(event);
}

function readChecker() {
  const page = document.querySelector("#page-check");
  const month = document.querySelector("#month-check");
  const day = document.querySelector("#day-check");
  if (page) state.checker.page = page.value;
  if (month) state.checker.month = month.value;
  if (day) state.checker.day = day.value;
}

function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === "answer-form") {
    event.preventDefault();
    checkCurrent(new FormData(form).get("answer"));
  } else if (form.id === "page-form") {
    event.preventDefault();
    readChecker();
    runPageCheck();
  } else if (form.id === "date-form") {
    event.preventDefault();
    readChecker();
    runDateCheck();
  }
}

function onInput(event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement)) return;
  if (field.id === "answer") {
    const question = current();
    if (!question || question.graded) return;
    question.draft = field.value;
    saveSession();
    return;
  }
  if (field.id === "page-check" || field.id === "month-check" || field.id === "day-check") readChecker();
}

function onClick(event) {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (!action) return;
  if (action === "tab") {
    state.tab = button.dataset.tab;
    state.confirmReset = false;
    render();
    return;
  }
  if (action === "mode") {
    if (state.settings.mapPool !== "all") {
      state.settings.mapPool = "all";
      saveSettings();
    }
    state.notice = "";
    startSession(button.dataset.mode);
    return;
  }
  if (action === "map-pool") {
    setMapPool(button.dataset.pool === "weak" ? "weak" : "all");
    return;
  }
  if (action === "install-later") {
    closeInstallSheet();
    return;
  }
  if (action === "phrase-display") {
    state.settings.phraseDisplay = button.dataset.value === "half" ? "half" : "full";
    saveSettings();
    // Apply the preference only to upcoming questions, including after a reload.
    for (const question of state.session.questions.slice(state.session.index + 1)) {
      if (question.mode !== "phrase") continue;
      if (state.settings.phraseDisplay === "half") {
        if (question.word === undefined) question.word = Math.floor(Math.random() * 2);
        question.public.big = LINES[question.answer.row].phrase.split(" ")[question.word];
      } else {
        delete question.word;
        question.public.big = LINES[question.answer.row].phrase;
      }
    }
    saveSession();
    render();
    return;
  }
  if (action === "practice-style") return;
  if (action === "hint") return;
  if (action === "reveal") return useReveal();
  if (action === "tap") return current()?.usedReveal ? goNext() : useReveal();
  if (action === "weak-toggle") return toggleWeak();
  if (action === "next") return goNext();
  if (action === "new-session") {
    if (state.settings.mapPool === "weak") {
      startWeakReview();
      return;
    }
    const mode = state.session?.mode === "review" || !MODES.includes(state.session?.mode) ? MODES[0] : state.session.mode;
    startSession(mode, { force: true });
    return;
  }
  if (action === "weak-review") return startWeakReview();
  if (action === "install") return runInstall();
  if (action === "count") return setCount(Number(button.dataset.count));
  if (action === "phonetic") return setPhonetic(button.dataset.on === "true");
  if (action === "checker-order") {
    state.checker.order = button.dataset.order === "DDMM" ? "DDMM" : "MMDD";
    render();
    return;
  }
  if (action === "reset-ask") {
    state.confirmReset = true;
    if (state.tab === "record") state.tab = "settings";
    render();
    return;
  }
  if (action === "reset-no") {
    state.confirmReset = false;
    render();
    return;
  }
  if (action === "reset-yes") resetStats();
}

function boot() {
  const notes = [];
  const settingsRead = readSlot(storageGet(KEYS.settings), defaultSettings(), validateSettings);
  const statsRead = readSlot(storageGet(KEYS.stats), defaultStats(), validateStats);
  const sessionRead = readSlot(storageGet(KEYS.session), null, (value) => Boolean(value) && validateSession(value));
  state.settings = settingsRead.value;
  state.stats = statsRead.value;
  if (!statsRead.corrupt) { migrateWeak(state.stats); saveStats(); }
  if (settingsRead.corrupt) blockedSlots.add(KEYS.settings);
  if (statsRead.corrupt) blockedSlots.add(KEYS.stats);
  if (sessionRead.corrupt) blockedSlots.add(KEYS.session);
  if (!settingsRead.corrupt && state.settings.practiceStyle !== "tap") {
    state.settings.practiceStyle = "tap";
    saveSettings();
  }
  if (!settingsRead.corrupt && Object.prototype.hasOwnProperty.call(state.settings, "installDismissed")) {
    delete state.settings.installDismissed;
    saveSettings();
  }
  if (settingsRead.corrupt) notes.push("설정을 읽지 못해 기본값으로 시작합니다.");
  if (statsRead.corrupt) notes.push("저장된 기록을 보존하고 임시 기록으로 연습합니다.");
  if (sessionRead.corrupt) notes.push("저장된 문제를 보존하고 새 문제로 연습합니다. 이번 진행은 저장하지 않습니다.");
  if (!state.storageOk) notes.push("이 브라우저에서는 저장이 막혀 있습니다. 새로고침하면 현재 문제가 사라집니다.");
  if (sessionRead.corrupt || sessionRead.empty || !sessionRead.value || sessionRead.value.finished) {
    const previousMode = sessionRead.value && MODES.includes(sessionRead.value.mode) ? sessionRead.value.mode : MODES[0];
    const weakQuestions = !statsRead.corrupt && state.settings.mapPool === "weak" ? weakReviewQuestions() : [];
    state.session = weakQuestions.length
      ? reviewSession(weakQuestions)
      : buildSession({
        mode: previousMode,
        count: state.settings.count,
        seed: freshSeed(),
        phraseDisplay: state.settings.phraseDisplay,
      });
    runningSince = Date.now();
    saveSession();
  } else {
    state.session = sessionRead.value;
    if (!Number.isFinite(state.session.accumulatedMs)) state.session.accumulatedMs = 0;
    runningSince = Date.now();
  }
  state.tab = "practice";
  state.notice = notes.join(" ");
  focusAnswer = false;
  showInstallSheet = !standaloneDisplay();
  focusInstallSheet = showInstallSheet;
  document.body.addEventListener("click", onClick);
  document.body.addEventListener("keydown", onKeyDown);
  document.body.addEventListener("focusin", onFocusIn);
  document.body.addEventListener("submit", onSubmit);
  document.body.addEventListener("input", onInput);
  render();
}

// Keep the screen awake while this personal app is visible, including idle screens.
function keepVisibleScreenAwake() {
  if (typeof document === 'undefined' || typeof navigator === 'undefined' || !navigator.wakeLock) return;
  let lock = null, pending = false;
  const visible = () => document.visibilityState === 'visible';
  const release = () => {
    const current = lock; lock = null;
    if (current) { try { Promise.resolve(current.release()).catch(() => {}); } catch {} }
  };
  async function request() {
    if (!visible() || lock || pending) return;
    pending = true;
    try {
      const acquired = await navigator.wakeLock.request('screen');
      if (!visible()) { await acquired.release(); return; }
      lock = acquired;
      acquired.addEventListener('release', () => { if (lock === acquired) lock = null; });
    } catch {} finally { pending = false; }
  }
  document.addEventListener('visibilitychange', () => { if (visible()) request(); else release(); });
  request();
}
keepVisibleScreenAwake();

if (typeof document !== "undefined") boot();
const localSettingsHost = typeof location !== 'undefined' && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
if (localSettingsHost && new URLSearchParams(location.search).get('local-preview') === '1') {
  window.addEventListener('magic-local-settings', () => {
    document.querySelector('#nav [data-tab="settings"]')?.click();
  });
  document.documentElement.dataset.localSettingsReady = 'true';
}
