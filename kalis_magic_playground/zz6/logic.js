export function colonClassFor(trickState) { return trickState === "digit" ? "trick" : trickState === "text" ? "trick-text" : trickState === "seq" ? "trick-seq" : ""; }
export const LANDSCAPE_CONTROL_IS_IMMEDIATE = true;
export function pushPendingDigit(pending, digit) { return pending.length >= 2 ? [digit] : [...pending, digit]; }
export function digitFromPoint(x, y, w, h) {
  const width = Number.isFinite(w) && w > 0 ? w : 1;
  const height = Number.isFinite(h) && h > 0 ? h : 1;
  const px = Number.isFinite(x) ? Math.min(Math.max(x, 0), width) : 0;
  const py = Number.isFinite(y) ? Math.min(Math.max(y, 0), height) : 0;
  const col = Math.min(4, Math.floor(px / width * 5));
  const row = Math.min(1, Math.floor(py / height * 2));
  return row === 0 ? col + 1 : (col === 4 ? 0 : col + 6);
}
export function isLeftmostScreenFifth(x, width) { return x < width / 5; }
export function composeCs(tens, ones) { return tens * 10 + ones; }
export function normalizeTrickState(current, trick3Enabled) { return current === "seq" && !trick3Enabled ? "off" : ["off", "digit", "text", "seq"].includes(current) ? current : "off"; }
export function nextTrickState(current, trick3Enabled = false) {
  const state = normalizeTrickState(current, trick3Enabled);
  if (state === "off") return "digit";
  if (state === "digit") return "text";
  if (state === "text") return trick3Enabled ? "seq" : "off";
  return "off";
}
export function parseSequence(value) {
  const text = String(value ?? "").trim();
  if (!text) return [];
  return text.split(/[,\s]+/).filter(token => /^\d{1,2}$/.test(token)).map(Number).filter(value => value >= 0 && value <= 99).slice(0, 8);
}
export function normalizeSequence(value) { return parseSequence(value).map(value => String(value).padStart(2, "0")).join(","); }
export function loadSequenceSlots(storage) {
  try {
    const parsed = JSON.parse(storage.getItem("stopwatch_seq_slots") || "[]");
    if (!Array.isArray(parsed)) return ["", "", ""];
    return [0, 1, 2].map(index => typeof parsed[index] === "string" ? normalizeSequence(parsed[index]) : "");
  } catch (_) { return ["", "", ""]; }
}
export function saveSequenceSlots(storage, slots) {
  const saved = [0, 1, 2].map(index => normalizeSequence(Array.isArray(slots) ? slots[index] : ""));
  storage.setItem("stopwatch_seq_slots", JSON.stringify(saved));
  return saved;
}
export function clampElapsed(ms) { return Math.min(ms, 59990); }
export function formatCs(totalCs) {
  const value = Math.min(9999, Math.max(0, Math.floor(totalCs)));
  return { sec: String(Math.floor(value / 100)).padStart(2, "0"), cs: String(value % 100).padStart(2, "0") };
}
export function formatTimeInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(-6).padStart(6, "0");
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}.${digits.slice(4)}`;
}
export function parseTimeInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(-6).padStart(6, "0");
  return Math.min(5999, (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4))) * 100 + Number(digits.slice(4)));
}
export function parseStopwatchText(value) {
  const text = String(value ?? "").trim();
  if (!/^(?:\d{1,6}|\d{1,2}[.:]\d{2}(?:\.\d{2})?)$/.test(text)) return null;
  return parseTimeInput(text);
}
export function presetIndexFromX(x, left, width, count = 4) {
  if (![x, left, width].every(Number.isFinite) || width <= 0 || !Number.isInteger(count) || count <= 0 || x < left || x > left + width) return null;
  return Math.min(count - 1, Math.floor((x - left) / width * count));
}
export function applyPresetSwipe(entry, digitIndex, steps) {
  if (!/^\d{4}$/.test(entry) || !Number.isInteger(digitIndex) || digitIndex < 0 || digitIndex > 3 || !Number.isInteger(steps)) return entry;
  const digit = ((Number(entry[digitIndex]) + steps) % 10 + 10) % 10;
  return entry.slice(0, digitIndex) + digit + entry.slice(digitIndex + 1);
}
export function toAppPoint(clientX, clientY, viewportWidth, viewportHeight, rotated) { return rotated ? { x: clientY, y: viewportWidth - clientX } : { x: clientX, y: clientY }; }
export function applyPresetGroupSwipe(entry, groupIndex, steps) {
  if (!/^\d{4}(?:\d{2})?$/.test(entry) || !Number.isInteger(groupIndex) || !Number.isInteger(steps)) return entry;
  const groupCount = entry.length / 2;
  if (groupIndex < 0 || groupIndex >= groupCount) return entry;
  const limit = entry.length === 4 && groupIndex === 0 ? 60 : 100;
  const offset = groupIndex * 2;
  const value = ((Number(entry.slice(offset, offset + 2)) + steps) % limit + limit) % limit;
  return entry.slice(0, offset) + String(value).padStart(2, "0") + entry.slice(offset + 2);
}
export function presetSwipePxPerStep(velocityPxPerMs) {
  const speed = Math.abs(Number(velocityPxPerMs));
  if (!Number.isFinite(speed) || speed < 0.3) return 28;
  if (speed > 1.5) return 5;
  return 14;
}
export function presetSwipeSteps(deltaPx, velocityPxPerMs) {
  if (!Number.isFinite(deltaPx) || deltaPx === 0) return 0;
  const raw = Math.trunc(deltaPx / presetSwipePxPerStep(velocityPxPerMs));
  return Math.max(-20, Math.min(20, raw));
}
export function nextSwipeAccumulator(acc, steps, pxPerStep, cap) {
  if (!Number.isFinite(acc)) return 0;
  if (!Number.isFinite(steps) || !Number.isFinite(pxPerStep) || pxPerStep <= 0) return acc;
  const capAbs = Number.isFinite(cap) ? Math.abs(cap) : 20;
  if (Math.abs(steps) >= capAbs) return 0;
  let remainder = acc - steps * pxPerStep;
  if (!Number.isFinite(remainder)) return 0;
  if (remainder >= pxPerStep) remainder = pxPerStep - Number.MIN_VALUE;
  else if (remainder <= -pxPerStep) remainder = -pxPerStep + Number.MIN_VALUE;
  return remainder;
}
export function presetGroupIndexFromPoint(x, y, rect, count = 2) {
  if (!rect || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const { left, top, width, height } = rect;
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0 || !Number.isInteger(count) || count <= 0) return null;
  const band = height * 0.4;
  if (y < top - band || y > top + height + band || x < left || x > left + width) return null;
  return Math.min(count - 1, Math.floor((x - left) / width * count));
}
export function portraitPresetEntryFromCs(totalCs) {
  const value = Math.min(603999, Math.max(0, Math.floor(Number(totalCs) || 0)));
  const minutes = Math.min(99, Math.floor(value / 6000));
  const remainder = value - minutes * 6000;
  return String(minutes).padStart(2, "0") + String(Math.floor(remainder / 100)).padStart(2, "0") + String(remainder % 100).padStart(2, "0");
}
export function portraitPresetEntryToCs(entry) {
  if (!/^\d{6}$/.test(entry)) return null;
  return Number(entry.slice(0, 2)) * 6000 + Number(entry.slice(2, 4)) * 100 + Number(entry.slice(4, 6));
}
export function savePortraitGroupPreset(storage, entry, savedAt) {
  const value = portraitPresetEntryToCs(entry);
  if (value === null || !storage || typeof storage.setItem !== "function") return null;
  const at = Number.isFinite(savedAt) ? savedAt : Date.now();
  storage.setItem("stopwatch_preset_cs", String(value));
  storage.setItem("stopwatch_preset_at", String(at));
  return { presetCs: value, presetAt: at };
}
export function resolveStoppedCs({ elapsed, trickMode, reservedTens, stopDigit }) {
  if (elapsed >= 59990) return 5999;
  if (trickMode && reservedTens !== null && stopDigit !== null) return Math.floor(elapsed / 1000) * 100 + composeCs(reservedTens, stopDigit);
  return Math.floor(elapsed / 10);
}
export function resolveSequenceStop({ stopCount, sequence, elapsed }) {
  const values = Array.isArray(sequence) ? sequence.filter(value => Number.isInteger(value) && value >= 0 && value <= 99).slice(0, 8) : [];
  const realCs = Math.floor(clampElapsed(elapsed) / 10);
  if (!values.length) return { cs: realCs, nextStopCount: 0 };
  const current = Number.isInteger(stopCount) && stopCount >= 0 ? stopCount + 1 : 1;
  if (current <= 2) return { cs: realCs, nextStopCount: current };
  const sequenceIndex = current - 3;
  const cs = elapsed >= 59990 ? realCs : Math.floor(realCs / 100) * 100 + values[sequenceIndex];
  return { cs, nextStopCount: sequenceIndex === values.length - 1 ? 0 : current };
}
export function elapsedAtAction(elapsed, started, actionNow) { return clampElapsed(elapsed + actionNow - started); }
export function resolveStopOutcome({ trickState, presetCs, customText, elapsed, reservedTens, stopDigit, stopCount = 0, sequence = [] }) {
  if (trickState === "seq") {
    const result = resolveSequenceStop({ stopCount, sequence, elapsed });
    return { kind: "cs", cs: result.cs, nextStopCount: result.nextStopCount };
  }
  if (trickState === "text" && customText) {
    const parsed = parseStopwatchText(customText);
    return parsed === null ? { kind: "text", text: customText, nextStopCount: stopCount } : { kind: "cs", cs: parsed, nextStopCount: stopCount };
  }
  return { kind: "cs", cs: resolveStoppedCs({ elapsed, trickMode: trickState === "digit", reservedTens, stopDigit }), nextStopCount: stopCount };
}
export function storedMode(storage) {
  try { return storage.getItem("stopwatch_ui_mode") === "landscape" ? "landscape" : "portrait"; } catch (_) { return "portrait"; }
}
export function recognizesModeToggle(taps) {
  const valid = taps.filter(tap => tap && tap.fingers === 2 && Number.isFinite(tap.time) && Number.isFinite(tap.gap) && tap.gap <= 120);
  if (valid.length < 3) return false;
  const last = valid.slice(-3);
  return last[2].time - last[0].time <= 800;
}
export function transitionAlarmPreset(model, action) {
  const next = { ...model };
  if (action === "enter") {
    if (next.uiMode !== "portrait" || next.timerState === "running" || next.presetMode || next.editorOpen) return next;
    next.presetMode = true;
    next.presetKind = "portrait-group";
  } else if ((action === "save" || action === "cancel") && next.presetMode && next.presetKind === "portrait-group") {
    next.presetMode = false;
    next.presetKind = null;
  }
  return next;
}
export function migrateV2Storage(storage) {
  const marker = "stopwatch_storage_migrated_v2";
  try {
    if (storage.getItem(marker) === "1") return false;
    const pairs = [["stopwatch2_preset_cs", "stopwatch_preset_cs"], ["stopwatch2_preset_at", "stopwatch_preset_at"], ["stopwatch2_custom_text", "stopwatch_custom_text"], ["stopwatch2_text_at", "stopwatch_text_at"]];
    let copied = false;
    pairs.forEach(([oldKey, newKey]) => {
      const value = storage.getItem(oldKey);
      if (storage.getItem(newKey) === null && value !== null) { storage.setItem(newKey, value); copied = true; }
    });
    storage.setItem(marker, "1");
    return copied;
  } catch (_) { return false; }
}
