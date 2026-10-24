import {
  MODES,
  canonicalAnswerText,
  summarizeSession,
} from "./core.mjs";
import {
  MODE_LABEL,
  MODE_DESCRIPTION,
  state,
  esc,
  current,
  formatDuration,
} from "./state.mjs";
import {
  isWeakMarked,
} from "./session.mjs";
import {
  inkGlyph,
} from "./glyphs.mjs";
import {
  runningSince,
} from "./app.mjs";

export {
  practiceHtml,
};

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
