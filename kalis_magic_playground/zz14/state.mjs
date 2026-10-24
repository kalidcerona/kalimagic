import {
  defaultSettings,
  defaultStats,
} from "./core.mjs";

export {
  KEYS,
  MODE_LABEL,
  MODE_DESCRIPTION,
  state,
  blockedSlots,
  main,
  notice,
  esc,
  chunks,
  storageGet,
  storageSet,
  freshSeed,
  current,
  saveSettings,
  saveStats,
  formatDuration,
};


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

function saveSettings() {
  storageSet(KEYS.settings, state.settings);
}

function saveStats() {
  storageSet(KEYS.stats, state.stats);
}


function formatDuration(ms) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes <= 0) return `${seconds}초`;
  return `${minutes}분 ${seconds}초`;
}
