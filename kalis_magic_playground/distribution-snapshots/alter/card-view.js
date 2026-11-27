import { AlterState } from "./logic.js";
import { stage, overlay, rank, suit, brightness, stateNote } from "./dom.js";
import { machine, stream } from "./state.js";
import { suits, saveSettings } from "./settings-store.js";

function renderCard() {
  const chosen = suits[suit.value] || suits.spade;
  overlay.classList.toggle("red", chosen.red);
  overlay.querySelectorAll(".rank").forEach((element) => { element.textContent = rank.value; });
  overlay.querySelectorAll(".suit").forEach((element) => { element.textContent = chosen.symbol; });
  const value = Number(brightness.value) / 100;
  stage.style.setProperty("--camera-brightness", String(value));
  saveSettings();
}

function stateLabel() {
  switch (machine.state) {
    case AlterState.IDLE: return "카드를 기다리는 중";
    case AlterState.CARD_DETECTED: return "카드 윤곽 확인 중";
    case AlterState.ALTER_VISIBLE: return "카메라 속 카드 표시 중";
    case AlterState.CARD_FULLY_OUT: return "카드 재진입 대기 중";
    case AlterState.REAL_CARD: return "실제 카드 공개 중";
    case AlterState.DONE: return "공연 완료";
    default: return "";
  }
}

function updateStateNote() {
  stateNote.textContent = stream ? stateLabel() : "카메라 시작 전";
}

export { renderCard, updateStateNote };
