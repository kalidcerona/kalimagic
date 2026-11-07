// Personal performance log. The caller shows the verdict first; this module only stores it.
// A storage failure is swallowed so the performance path cannot break or wait on the log.
const KEY = "usotsuki.performance-log.v1";
const LIMIT = 100;
const THEME_LABELS = {
  green: "딥 그린 테이블",
  wine: "와인 카드룸",
  recorder: "목재 드럼",
  "recorder-a": "강철 타자기",
  "recorder-d": "황동 타자기",
};

function readEntries(storage) {
  try {
    storage ??= globalThis.localStorage;
    const parsed = JSON.parse(storage.getItem(KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry === "object").slice(0, LIMIT);
  } catch {
    return [];
  }
}

function formatWhen(at) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    }).format(new Date(at));
  } catch {
    return "";
  }
}

function formatPerformanceResult(entry) {
  const verdict = entry?.verdict === "TRUE" ? "진실 판정" : "거짓 판정";
  const theme = THEME_LABELS[entry?.theme];
  return theme ? `${verdict} · ${theme}` : verdict;
}

function replaceChildren(node, children) {
  if (typeof node.replaceChildren === "function") {
    node.replaceChildren(...children);
    return;
  }
  if (Array.isArray(node.children)) {
    while (node.children.length) {
      const child = node.children.pop();
      if (child) child.parentElement = null;
    }
  }
  for (const child of children) {
    if (typeof node.appendChild === "function") node.appendChild(child);
    else if (typeof node.append === "function") node.append(child);
  }
}

function paint(doc, list, empty, entries) {
  const items = entries.map((entry) => {
    const item = doc.createElement("li");
    const when = doc.createElement("span");
    when.textContent = formatWhen(entry.at);
    const result = doc.createElement("span");
    result.textContent = formatPerformanceResult(entry);
    if (typeof item.appendChild === "function") item.appendChild(when);
    const breakLine = doc.createElement("br");
    if (typeof item.appendChild === "function") {
      item.appendChild(breakLine);
      item.appendChild(result);
    } else if (typeof item.append === "function") item.append(when, breakLine, result);
    return item;
  });
  replaceChildren(list, items);
  list.hidden = entries.length === 0;
  if (empty) empty.hidden = entries.length > 0;
}

function recordCompletedTest(entry, storage) {
  try {
    if (storage === undefined) {
      const snapshot = { ...entry };
      const at = Date.now();
      const write = () => {
        try { recordCompletedTest({ ...snapshot, at }, globalThis.localStorage ?? null); } catch {}
      };
      // Leave the result handler immediately; allow a paint before synchronous storage work.
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => { try { setTimeout(write, 0); } catch {} });
      } else {
        setTimeout(write, 0);
      }
      return;
    }
    const next = {
      at: entry?.at ?? Date.now(),
      verdict: entry?.verdict === "TRUE" ? "TRUE" : "LIE",
      theme: typeof entry?.theme === "string" ? entry.theme : "",
    };
    const entries = readEntries(storage);
    entries.unshift(next);
    storage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));

  } catch {
    // Logging must not break the verdict that is already on screen.
  }
}

function readPerformanceLog(storage) {
  try {
    return readEntries(storage);
  } catch {
    return [];
  }
}

function clearPerformanceLog(storage) {
  try {
    storage ??= globalThis.localStorage;
    storage.removeItem(KEY);
  } catch {
    // Clearing is best-effort; reread storage so a failed clear never hides retained data.
  }
}

function mountNow(doc, storage) {
  if (!doc?.querySelector || !doc.createElement) return;
  const host = doc.querySelector("#settings-screen .stack");
  if (!host) return;
  if (typeof host.querySelector === "function" && host.querySelector("#performance-log")) return;
  const details = doc.createElement("details");
  details.id = "performance-log";
  details.className = "settings-disclosure";
  const summary = doc.createElement("summary");
  summary.textContent = "공연 기록";
  const empty = doc.createElement("p");
  empty.id = "performance-log-empty";
  empty.textContent = "아직 기록이 없습니다.";
  const list = doc.createElement("ul");
  list.id = "performance-log-list";
  const button = doc.createElement("button");
  button.type = "button";
  button.id = "performance-log-clear";
  button.textContent = "기록 지우기";
  const add = (parent, child) => {
    if (typeof parent.appendChild === "function") parent.appendChild(child);
    else if (typeof parent.append === "function") parent.append(child);
  };
  add(details, summary);
  add(details, empty);
  add(details, list);
  add(details, button);
  const actions = typeof host.querySelector === "function" ? host.querySelector(".row-actions") : null;
  if (actions && typeof host.insertBefore === "function") host.insertBefore(details, actions);
  else add(host, details);
  const render = (bucket = storage) => paint(doc, list, empty, readEntries(bucket));
  if (typeof button.addEventListener === "function") {
    button.addEventListener("click", () => {
      clearPerformanceLog(storage);
      render(storage);
    });
  }
  if (typeof details.addEventListener === "function") details.addEventListener("toggle", () => render(storage));
  render(storage);
}

function mountPerformanceLog(doc = globalThis.document, storage) {
  Promise.resolve().then(() => {
    try { mountNow(doc, storage); } catch { /* Settings stay usable when the log cannot mount. */ }
  });
}

export {
  KEY as PERFORMANCE_LOG_KEY,
  LIMIT as PERFORMANCE_LOG_LIMIT,
  recordCompletedTest,
  readPerformanceLog,
  clearPerformanceLog,
  formatPerformanceResult,
  mountPerformanceLog,
};
