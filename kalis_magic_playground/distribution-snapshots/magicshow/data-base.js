// Release rule (common.md): bump only GAME_BUILD here for each release; keep save versions separate.
const GAME_BUILD = '13 (10-20)';
/* GAME_DATA keys (content and tree metadata; effect formulas live in core):
 * title: string.
 * venues[16]: {id: display order, slug: stable identity, balanceRank, name, intro, palette:{bg1,bg2,accent},
 *   successLine, trophy,
 *   headliner:{id, name, emoji, flavor, pattern, bossProfile?, preLine, defeatLine, phase2Line?},
 *   audiences[]:{id, name, emoji, flavor, extra:{type, value}},
 *   invitation?: {keys, name}}.
 * extra.type: none | finisher | noDamage | timeLimit | combo.
 *   none: no extra beyond three wins ("3번 감탄"). value 0.
 *   finisher: a finisher fired and the fight was won. value 1.
 *   noDamage: won without losing mental. value 0.
 *   timeLimit: won within value seconds.
 *   combo: combo reached value during the fight, then won.
 *   Venue 1 is all none. From venue 2 each regular has one extra.
 * headliner.pattern: none | slow | sealBox | stealCoins | heal | invisible | twoPhase | friendlyReview | homecoming.
 *   none: no pattern (venues 1..3). slow: time slow. sealBox: seal one box.
 *   stealCoins: steal coins. heal: restore doubt. invisible: missable beats.
 *   twoPhase: two phases. Only multiverse, name "의심 많은 나".
 *   phase2Line is the second-phase entrance, only on twoPhase.
 * invitation is attached to its venue slug; no numeric progression gates.
 * items.types[]: {id, name, emoji, effect: damage|shield|heal|coins}.
 * items.rarities[]: {id, name, color}.
 * tree[]: {id, name, desc, emoji, max, cost, currency, prereqs, x, y, reveal, branch, icon, pending, starKey?}.
 *   cost is a per-level list or {c,g}; starKey maps to the existing state.stars ledger.
 * dealer: {name, cardVenue, slotVenue, introLines[], cardRules, dudLine,
 *   cardPrizes[{id, name, emoji, kind, value}], slotRules,
 *   slotSymbols[{id, name, emoji, good}], forceLine}.
 *   kind: coins | gems | heal | buff.
 *   coins/gems value = amount. heal value = percent of max mental.
 *   buff value = percent trick-power bonus until the next audience.
 *   cardVenue party, slotVenue theater: stable slugs for dealer unlocks.
 * pools: {win[], fail[], heckles[], failReason}. failReason uses {pct}.
 * dimensions[5]: {d, name, hue, ending:{title, body}}. hue is degrees.
 * genericEnding: {title, body} with a {d} placeholder. For D>5.
 * story.reveal[]: short lines on the first multiverse clear.
 * ui: menu labels, rotate, restart, retreat, rebirth, stat labels,
 *   bestiary condition templates (timeLimit/combo use {value}).
 * Copy: banners <= 14 chars, other lines <= 34. No em dash, no tilde.
 */
(typeof window!=='undefined'?window:globalThis).GAME_DATA = {
  title: "칼리 마술 성장기",
};

