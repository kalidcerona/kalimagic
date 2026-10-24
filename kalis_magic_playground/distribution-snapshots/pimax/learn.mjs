import {
  LETTER_OF,
  LINES,
  birthdayAddress,
  lineDigits,
  pageLocus,
  referenceNotes,
} from "./core.mjs";
import {
  MODE_DESCRIPTION,
  state,
  esc,
  chunks,
} from "./state.mjs";
import {
  inkGlyph,
  glyphRun,
} from "./glyphs.mjs";
import {
  render,
} from "./app.mjs";

export {
  runPageCheck,
  runDateCheck,
  learnHtml,
};

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
