import { replaceAll } from './core-model.mjs';

// ---------- CardCode ----------

export const RANKS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
export const SUITS = Object.freeze(['S', 'H', 'D', 'C']);
/** Macro numeric code rank*10 + suit: 1 clubs, 2 hearts, 3 spades, 4 diamonds. */
export const MACRO_SUITS = Object.freeze(['C', 'H', 'S', 'D']);
const SYMBOLS = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const suitSymbol = (suit) => SYMBOLS[suit] || '';
export const cardDisplay = (code) => code.slice(0, -1) + suitSymbol(code.slice(-1));

/** Accepts QH, qh, Q♥, 10S, TS, 1S (ace) or the macro number (121). Returns the canonical code or null. */
export function normalizeCard(input) {
  if (input === null || input === undefined) return null;
  let t = String(input).trim().toUpperCase();
  for (const [letter, sym] of Object.entries(SYMBOLS)) t = replaceAll(t, sym, letter);
  t = replaceAll(t, ' ', '');
  if (!t) return null;
  if (/^[0-9]+$/.test(t)) {
    const n = Number(t);
    const rank = Math.floor(n / 10), suit = n % 10;
    if (rank < 1 || rank > 13 || suit < 1 || suit > 4) return null;
    return RANKS[rank - 1] + MACRO_SUITS[suit - 1];
  }
  const suit = t.slice(-1);
  if (!SUITS.includes(suit)) return null;
  const r = t.slice(0, -1);
  const rank = { 1: 'A', T: '10', 11: 'J', 12: 'Q', 13: 'K' }[r] || r;
  return RANKS.includes(rank) ? rank + suit : null;
}
