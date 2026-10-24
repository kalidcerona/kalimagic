import {
  STACK_DIGITS,
  circularSlice,
} from "./core-stack.mjs";

export function hamming(left, right) {
  if (left.length !== right.length) return null;
  let distance = 0;
  for (let i = 0; i < left.length; i += 1) if (left[i] !== right[i]) distance += 1;
  return distance;
}

/** Every circular window whose Hamming distance to `heard` is exactly 1. */
export function lieCandidates(heard) {
  const probe = String(heard);
  if (!/^[0-9]+$/.test(probe)) return [];
  const found = [];
  for (let start = 0; start < STACK_DIGITS.length; start += 1) {
    const actual = circularSlice(STACK_DIGITS, start, probe.length);
    const diffs = [];
    for (let i = 0; i < probe.length; i += 1) if (actual[i] !== probe[i]) diffs.push(i);
    if (diffs.length !== 1) continue;
    const at = diffs[0];
    found.push({
      start,
      position: at + 1,
      original: actual[at],
      heardDigit: probe[at],
      actual,
    });
  }
  return found;
}

export function gradeLie(heard, position, original) {
  const pos = Number(position);
  const orig = String(original);
  if (!Number.isInteger(pos) || pos < 1) return false;
  if (!/^[0-9]$/.test(orig)) return false;
  return lieCandidates(heard).some((candidate) => candidate.position === pos && candidate.original === orig);
}

export function mutateWindow(actual, index, altDigit) {
  const alt = String(altDigit);
  if (!/^[0-9]+$/.test(actual) || !/^[0-9]$/.test(alt)) throw new Error("digits required");
  if (!Number.isInteger(index) || index < 0 || index >= actual.length) throw new Error("index");
  if (actual[index] === alt) throw new Error("mutation must change the digit");
  return actual.slice(0, index) + alt + actual.slice(index + 1);
}

export function givenWindow(start, length = 5) {
  return circularSlice(STACK_DIGITS, start, length);
}

export function continuationAt(start, skip = 5, take = 10) {
  return circularSlice(STACK_DIGITS, start + skip, take);
}

export function continuationsForGiven(given) {
  const probe = String(given);
  const hits = [];
  for (let start = 0; start < STACK_DIGITS.length; start += 1) {
    if (givenWindow(start, probe.length) !== probe) continue;
    hits.push({ start, next: continuationAt(start, probe.length, 10) });
  }
  return hits;
}
