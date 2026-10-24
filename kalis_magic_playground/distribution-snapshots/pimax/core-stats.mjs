import {
  DIGIT_OF,
  LETTER_OF,
} from "./core-stack.mjs";
import {
  mapQuestion,
  freshQuestion,
} from "./core-questions.mjs";

export {
  weakItemCount,
};

// Store both directional questions under the existing schema so old backups remain readable.
export function weakKeys(questionOrKey) {
  const key = typeof questionOrKey === "string" ? questionOrKey : questionOrKey.key;
  const match = /^map:(digit|letter):([0-9A-Z])$/.exec(key);
  if (!match) return [key];
  const letter = match[1] === "digit" ? LETTER_OF[Number(match[2])] : match[2];
  if (DIGIT_OF[letter] === undefined) return [key];
  return [`map:digit:${DIGIT_OF[letter]}`, `map:letter:${letter}`];
}

export function weakMapSymbols(weak) {
  return [...new Set((weak || []).flatMap(item => weakKeys(item.key)))].flatMap(key => {
    const match = /^map:(digit|letter):([0-9A-Z])$/.exec(key);
    return match ? [{ kind: match[1], symbol: match[2] }] : [];
  });
}

function weakEntry(question, misses) {
  return { key: question.key, mode: question.mode, label: `${question.public.kicker} ${question.public.big}`, misses, question: freshQuestion(question) };
}

function weakItemCount(items) {
  return new Set(items.map(item => weakKeys(item?.key || "")[0])).size;
}

function limitWeak(items) {
  // Newest first: a map pair is ONE item, stored as two directional questions.
  // Keep 40 whole items (at most 50 entries); evict only the oldest whole items.
  const groups = new Map();
  for (const item of items) {
    const identity = weakKeys(item.key)[0];
    if (!groups.has(identity)) groups.set(identity, new Map());
    groups.get(identity).set(item.key, item);
  }
  return [...groups.values()].slice(0, 40).flatMap(group => {
    const item = group.values().next().value;
    return weakKeys(item.key).map(key => group.get(key) || weakEntry(mapQuestion(key.split(":")[1], key.split(":")[2]), item.misses));
  });
}

export function migrateWeak(stats) {
  const seen = new Set();
  const result = [];
  for (const item of stats.weak) {
    const keys = weakKeys(item.key);
    if (seen.has(keys[0])) continue;
    keys.forEach(key => seen.add(key));
    const misses = Math.max(...stats.weak.filter(other => keys.includes(other.key)).map(other => other.misses));
    for (const key of keys) {
      const existing = stats.weak.find(other => other.key === key);
      const question = keys.length === 2 ? mapQuestion(key.split(":")[1], key.split(":")[2]) : item.question;
      result.push(existing ? { ...existing, misses } : weakEntry(question, misses));
    }
  }
  stats.weak = limitWeak(result);
}

export function recordWeak(stats, question) {
  const keys = weakKeys(question);
  const misses = Math.max(0, ...stats.weak.filter(item => keys.includes(item.key)).map(item => item.misses)) + 1;
  const entries = keys.map(key => weakEntry(keys.length === 2 ? mapQuestion(key.split(":")[1], key.split(":")[2]) : question, misses));
  stats.weak = limitWeak([...entries, ...stats.weak.filter(item => !keys.includes(item.key))]);
}

export function clearWeak(stats, key) {
  const keys = weakKeys(key);
  stats.weak = stats.weak.filter(item => {
    if (!keys.includes(item.key)) return true;
    item.misses -= 1;
    return item.misses > 0;
  });
}

export function summarizeSession(session) {
  const summary = { direct: 0, assisted: 0, revealed: 0, wrong: 0, hints: 0, reveals: 0, open: 0 };
  for (const question of session.questions) {
    if (question.hintUsed) summary.hints += 1;
    if (question.usedReveal) summary.reveals += 1;
    if (!question.graded) summary.open += 1;
    else summary[question.graded] += 1;
  }
  return summary;
}
