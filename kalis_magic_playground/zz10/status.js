import { runtimeNote } from "./dom.js";

const lifecycleCounts = Object.create(null);

// Only event codes/counts are retained; frames and device details are never logged.
function recordLifecycle(code) {
  lifecycleCounts[code] = Math.min(999, (lifecycleCounts[code] || 0) + 1);
  try { sessionStorage.setItem("alter-runtime-events", JSON.stringify(lifecycleCounts)); }
  catch { /* Diagnostics are optional in private browsing. */ }
}

function setRuntimeStatus(message) {
  runtimeNote.textContent = message;
}

export { recordLifecycle, setRuntimeStatus };
