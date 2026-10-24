import {
  LINES,
  MODES,
} from "./core.mjs";
import {
  state,
  current,
  saveSettings,
} from "./state.mjs";
import {
  checkCurrent,
  useReveal,
  toggleWeak,
} from "./session.mjs";
import {
  runPageCheck,
  runDateCheck,
} from "./learn.mjs";
import {
  setCount,
  setPhonetic,
  setMapPool,
  resetStats,
} from "./settings.mjs";
import {
  saveSession,
  startSession,
  startWeakReview,
  goNext,
  closeInstallSheet,
  runInstall,
  render,
} from "./app.mjs";

export {
  onSubmit,
  onInput,
  onClick,
};

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
