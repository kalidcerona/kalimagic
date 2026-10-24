import {
  clearWeak,
  weakKeys,
  freshQuestion,
  recordWeak,
  scoreAnswer,
  summarizeSession,
} from "./core.mjs";
import {
  state,
  current,
  saveStats,
} from "./state.mjs";
import {
  persistTime,
  saveSession,
  render,
} from "./app.mjs";

export {
  isPristine,
  postSession,
  weakReviewQuestions,
  reviewSession,
  checkCurrent,
  useReveal,
  isWeakMarked,
  toggleWeak,
};

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
