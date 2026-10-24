import {
  defaultStats,
} from "./core.mjs";
import {
  KEYS,
  state,
  blockedSlots,
  notice,
  chunks,
  saveSettings,
  saveStats,
} from "./state.mjs";
import {
  isPristine,
} from "./session.mjs";
import {
  installPanel,
} from "./install.mjs";
import {
  startSession,
  startWeakReview,
  render,
} from "./app.mjs";

export {
  setCount,
  setPhonetic,
  setMapPool,
  resetStats,
  settingsHtml,
};

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
