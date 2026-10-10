import {
  LETTER_OF,
  LINES,
  MODES,
  birthdayAddress,
  canonicalAnswerText,
  buildSession,
  clearWeak,
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
  row: "줄 회상",
  odd: "홀수 쪽",
  next: "다음 10",
  birthday: "생일",
  lie: "거짓말",
  review: "다시 풀기",
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

function startSession(mode, { lieLength = 5, force = false, keepTab = false } = {}) {
  const nextLie = lieLength === 7 ? 7 : 5;
  const active = state.session;
  if (!force && active && !active.finished && active.mode === mode && active.mode !== "review") {
    if (mode !== "lie" || active.lieLength === nextLie) {
      if (!keepTab) state.tab = "practice";
      focusAnswer = state.tab === "practice";
      render();
      return;
    }
  }
  postSession(active);
  const session = buildSession({
    mode,
    count: state.settings.count,
    seed: freshSeed(),
    lieLength: nextLie,
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
  return state.stats.weak.some((item) => item.key === question.key);
}

function toggleWeak() {
  const question = current();
  if (!question) return;
  if (isWeakMarked(question)) {
    state.stats.weak = state.stats.weak.filter((item) => item.key !== question.key);
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
    startSession(state.session.mode, { lieLength: state.session.lieLength, force: true, keepTab: true });
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
    state.checker.pageResult = "1쪽 또는 3–49쪽의 홀수 쪽을 입력해 주세요.";
  } else {
    const locus = pageLocus(page);
    if (!locus.ok) state.checker.pageResult = "3–49쪽의 홀수 쪽을 확인합니다. 1쪽은 원주율 예외입니다.";
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
    state.checker.dateResult = `${orderLabel} ${address.dateStr} · ${address.page}쪽 · 주소 줄 ${address.line} · ${address.column}번째. 주소 줄은 암기 줄 0–4가 아닙니다.`;
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
  const lieSwitch = session.mode === "lie"
    ? `<div class="subswitch" role="group" aria-label="거짓말 길이">
      <button type="button" data-action="lie-length" data-length="5" class="${session.lieLength === 5 ? "selected" : ""}">5자리</button>
      <button type="button" data-action="lie-length" data-length="7" class="${session.lieLength === 7 ? "selected" : ""}">7자리</button>
    </div>`
    : "";
  let body;
  if (!question) {
    body = `${summaryHtml(summary)}
      <button type="button" data-action="new-session">새 회차</button>`;
  } else {
    const showAnswer = question.graded || question.usedReveal;
    const markedWeak = isWeakMarked(question);
    const bigClass = ["big", question.public.bigClass || ""].filter(Boolean).join(" ");
    const answerText = showAnswer ? esc(canonicalAnswerText(question).replaceAll("|", " / ")) : "?";
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
    <div class="quiz-actions">
      <button type="button" class="blind-answer${mapPictures ? " map-answer" : ""}" data-action="tap"${answerName}>${answerContent}</button>
      <p class="quiz-status">${showAnswer ? "한 번 더 탭하면 다음" : ""}</p>
      <button type="button" data-action="weak-toggle" aria-pressed="${markedWeak ? "true" : "false"}" class="weak-toggle">약점</button>
      <button type="button" data-action="new-session">새 회차</button>
    </div>`;
  }
  return `<section class="workspace">
    <div class="spread"><h2>연습</h2><span class="pill">${esc(formatDuration(live))}</span></div>
    <div class="mode-switch" role="group" aria-label="연습 종류">${modeButtons()}</div>
    ${lieSwitch}
    ${poolSwitch()}
    <div class="spread"><span>${session.finished ? "회차 끝" : `문제 ${session.index + 1} / ${session.questions.length}`}</span></div>
    <div class="bar" aria-hidden="true"><span style="width:${width}%"></span></div>
    ${body}
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
      <h3>홀수 쪽</h3>
      ${chunks([
        "10의 자리는 암기표의 줄 0~4, 1의 자리는 1부터 세는 글자 위치입니다.",
        "찾은 글자와 다음 두 글자를 읽습니다. 줄이 넘어가도 순환을 따라갑니다.",
        notes.piWarning,
        notes.after49,
      ])}
    </section>
    <section class="panel formula">
      <h3>생일 주소</h3>
      ${chunks([
        "쪽 = 일 + 50. 주소 줄 = 월 × 2.",
        "월일 MMDD의 시작 = 월 + 3. 일월 DDMM의 시작 = 월 + 1.",
        "번호는 1부터입니다. 2월 29일은 허용하고, 그 밖에는 없는 날짜를 받지 않습니다.",
        "주소 줄은 암기 줄 번호가 아닙니다.",
      ])}
    </section>
    <section class="panel formula">
      <h3>이어서 말하기 · 거짓말</h3>
      ${chunks([
        "다섯 자리 바로 다음부터 열 자리만 말합니다. 앞의 다섯은 정답에 다시 넣지 않습니다.",
        "52번째 다음은 첫 자리로 돌아갑니다. 이것은 원주율 전체가 아닙니다.",
        "거짓말은 순환 구간과 정확히 한 자리만 다릅니다. 가능한 위치와 원래 숫자를 모두 정답으로 봅니다.",
      ])}
    </section>
    <section class="panel address-checker">
      <h3>주소 확인</h3>
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
          <p class="checker-label">날짜 주소</p>
          <div class="subswitch" role="group" aria-label="날짜 순서">
            <button type="button" data-action="checker-order" data-order="MMDD" class="${state.checker.order === "MMDD" ? "selected" : ""}">월일</button>
            <button type="button" data-action="checker-order" data-order="DDMM" class="${state.checker.order === "DDMM" ? "selected" : ""}">일월</button>
          </div>
          <form id="date-form" class="checker-date-form">
            <label for="month-check">월<input id="month-check" inputmode="numeric" autocomplete="off" value="${esc(state.checker.month)}" placeholder="월"></label>
            <label for="day-check">일<input id="day-check" inputmode="numeric" autocomplete="off" value="${esc(state.checker.day)}" placeholder="일"></label>
            <button type="submit" class="primary">날짜 계산</button>
          </form>
          <div class="checker-result checker-date-result" role="status" aria-live="polite">${state.checker.dateResult ? esc(state.checker.dateResult).replace("번째. 주소", "번째 · 주소").split(" · ").map(part => `<span>${part}</span>`).join("") : '<span class="subtle">월과 일을 넣어<br>날짜 주소를 확인하세요.</span>'}</div>
        </section>
      </div>
    </section>
  </section>`;
}

function settingsHtml() {
  const counts = [5, 10, 15, 20].map((count) => (
    `<button type="button" data-action="count" data-count="${count}" class="${state.settings.count === count ? "selected" : ""}">${count}</button>`
  )).join("");
  return `<section class="workspace">
    <h2>설정</h2>
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
  if (state.tab === "learn") root.innerHTML = learnHtml();
  else if (state.tab === "settings") root.innerHTML = settingsHtml();
  else root.innerHTML = practiceHtml();
  notice().textContent = state.notice || "";
  focusAnswer = false;
  if (scrollY != null && typeof window.scrollTo === "function" && window.scrollY !== scrollY) window.scrollTo(0, scrollY);
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
    startSession(button.dataset.mode, { lieLength: state.session?.lieLength || 5 });
    return;
  }
  if (action === "lie-length") {
    startSession("lie", { lieLength: Number(button.dataset.length) });
    return;
  }
  if (action === "map-pool") {
    setMapPool(button.dataset.pool === "weak" ? "weak" : "all");
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
    const mode = state.session?.mode === "review" ? "map" : (state.session?.mode || "map");
    startSession(mode, { lieLength: state.session?.lieLength || 5, force: true });
    return;
  }
  if (action === "weak-review") return startWeakReview();
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
  if (settingsRead.corrupt) blockedSlots.add(KEYS.settings);
  if (statsRead.corrupt) blockedSlots.add(KEYS.stats);
  if (sessionRead.corrupt) blockedSlots.add(KEYS.session);
  if (!settingsRead.corrupt && state.settings.practiceStyle !== "tap") {
    state.settings.practiceStyle = "tap";
    saveSettings();
  }
  if (settingsRead.corrupt) notes.push("설정을 읽지 못해 기본값으로 시작합니다.");
  if (statsRead.corrupt) notes.push("저장된 기록을 보존하고 임시 기록으로 연습합니다.");
  if (sessionRead.corrupt) notes.push("저장된 문제를 보존하고 새 문제로 연습합니다. 이번 진행은 저장하지 않습니다.");
  if (!state.storageOk) notes.push("이 브라우저에서는 저장이 막혀 있습니다. 새로고침하면 현재 문제가 사라집니다.");
  if (sessionRead.corrupt || sessionRead.empty || !sessionRead.value || sessionRead.value.finished) {
    const previousMode = sessionRead.value && MODES.includes(sessionRead.value.mode) ? sessionRead.value.mode : "map";
    const previousLie = sessionRead.value?.lieLength === 7 ? 7 : 5;
    const weakQuestions = !statsRead.corrupt && state.settings.mapPool === "weak" ? weakReviewQuestions() : [];
    state.session = weakQuestions.length
      ? reviewSession(weakQuestions)
      : buildSession({
        mode: previousMode,
        count: state.settings.count,
        seed: freshSeed(),
        lieLength: previousLie,
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
  document.body.addEventListener("click", onClick);
  document.body.addEventListener("submit", onSubmit);
  document.body.addEventListener("input", onInput);
  render();
}

if (typeof document !== "undefined") boot();
