import {
  lineDigits,
} from "./core.mjs";
import {
  esc,
} from "./state.mjs";

export {
  inkGlyph,
  glyphRun,
};

/* Original ink strokes. N→2 is a quarter-turn. E→3 and P→9 are mirrors. */
const LETTER_PATH = {
  O: "M18 11c-6.2 0-10.2 6.2-10.2 13s4 13 10.2 13 10.2-6.2 10.2-13-4-13-10.2-13z",
  I: "M11 10h14M18 10v28M11 38h14",
  N: "M9 10v28M27 10v28M9 10L27 38",
  E: "M27 10H11v28h16M11 24h12",
  A: "M18 9L8 40M18 9l10 31M12 27h12",
  S: "M25 16c0-4.2-3.2-7-7-7s-7 2.4-7 6c0 7 14 3.5 14 11.5 0 4.2-3.4 7.5-8 7.5s-7.6-2.6-7.6-6",
  G: "M25 16c0-5-3.8-8-8.4-8C11 8 8 13 8 24s3.2 16 9.2 16c4 0 7-1.8 8-5h-7",
  T: "M8 12h20M18 12v26",
  B: "M11 10v28M11 10h8c5.4 0 8.4 2.6 8.4 6.5S24.4 23 19 23H11M11 23h9c5.8 0 9 2.8 9 7.2S25.6 38 19.4 38H11",
  P: "M11 10v28M11 10h8c6.2 0 9.6 3 9.6 7.5S25.2 25 19 25H11",
};

const DIGIT_PATH = {
  O: "M18 7c-5 0-8.2 7.4-8.2 17S13 41 18 41s8.2-7.4 8.2-17S23 7 18 7z",
  I: "M15 15L19 8v30M12 38h14",
  N: "M8 15h18L10 38h18",
  E: "M12 12h12c6.5 0 8 5 5.5 8.5-2 2.6-6 3.5-11 3.5 6 .6 11 2.8 11.5 7.8.6 5.4-3.6 8.2-10 8.2H12",
  A: "M22 8v31M22 8L8 25h18",
  S: "M26 12H12v9c7 .6 12 2.4 12 8.4C24 37 19 41 13 41c-4 0-7-2-8-5",
  G: "M23 13C17 6 8 12 9 23c1 12 15 15 18 6 1.2-3.6-1.6-6-5.6-6",
  T: "M8 11h20L12 40",
  B: "M18 24c-5.4 0-9-4-9-8.2S12.8 8 18 8s9 3.6 9 7.8-3.6 8.2-9 8.2zm0 0c-6 0-10 4.4-10 9S12.2 42 18 42s10-4.2 10-9-4-9-10-9z",
  P: "M23 18c0-6-4.6-10-10-10S4 12 4 18s4.2 9 9.6 9c4.8 0 9.4-.6 9.4-.6V40",
};

const TOWARD_DIGIT = {
  O: "M18 8c-4.4 0-7.2 7-7.2 16s2.8 16 7.2 16 7.2-7 7.2-16-2.8-16-7.2-16z",
  I: "M14 16L18 9v29M12 38h12",
  A: "M23 8v32M23 8L8 26h18",
  S: "M26 11H11v10c8 .4 13 2.4 13 8.8C24 37.5 19 41 13 41c-3.6 0-6.4-1.8-7.2-4.4",
  G: "M22 12C15 6 8 13 10 24c1.4 10 12 14 16 6.5 1.6-3-1-5.5-5-5.5-3.2 0-5 1.6-5 3.6",
  T: "M8 11h20L12 40",
  B: "M18 24c-5.2 0-8.6-4-8.6-8S13 8 18 8s8.6 3.6 8.6 8-3.4 8-8.6 8zm0 0c-5.8 0-9.6 4.2-9.6 8.8S12.4 42 18 42s9.4-4.2 9.4-9.2S23.8 24 18 24z",
};

const TOWARD_LETTER = {
  O: "M18 11c-7.2 0-12 5.4-12 13s4.8 13 12 13 12-5.4 12-13-4.8-13-12-13z",
  I: "M18 9v29M11 11h14M11 38h14",
  A: "M18 9L8 40M18 9l10 31M11 27h14M24 14v24",
  S: "M24 15c-1-5-6-8-10-6-4 2-3 6 0 8 4 2.4 12 3 13 9 1 5.2-3 10-9 10-5 0-8-2.4-9-6",
  G: "M24 16c0-6-4-9-9-9S7 12 8 23c1 12 12 15 16 8 1.4-2.4.2-4.2-2.4-4.6H16",
  T: "M8 11h20M16 13L18 40",
  B: "M12 8v32M18 24c-5 0-8-3.6-8-7.6S13.2 9 18 9s8 3.2 8 7.4S23 24 18 24zm0 0c-5.6 0-9 4-9 8.6S12.6 41 18 41s9-3.6 9-8.4S23.6 24 18 24z",
};

function glyphSpec(letter, form) {
  if (form === "letter") return { d: LETTER_PATH[letter] };
  if (form === "digit") return { d: DIGIT_PATH[letter] };
  if (form === "letter-digit") {
    if (letter === "N") return { d: LETTER_PATH.N, transform: "rotate(90 18 24)" };
    if (letter === "E" || letter === "P") return { d: LETTER_PATH[letter], transform: "translate(36 0) scale(-1 1)" };
    return { d: TOWARD_DIGIT[letter] };
  }
  if (letter === "N") return { d: DIGIT_PATH.N, transform: "rotate(-90 18 24)" };
  if (letter === "E" || letter === "P") return { d: DIGIT_PATH[letter], transform: "translate(36 0) scale(-1 1)" };
  return { d: TOWARD_LETTER[letter] };
}

function inkGlyph(letter, form) {
  const spec = glyphSpec(letter, form);
  const transform = spec.transform ? ` transform="${spec.transform}"` : "";
  return `<svg class="ink-glyph" viewBox="0 0 36 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"${transform}><path d="${spec.d}"/></g></svg>`;
}

function glyphRun(line, form) {
  const digits = lineDigits(line.row);
  const glyphs = [];
  for (const ch of line.phrase) {
    if (ch === " ") glyphs.push(`<span class="glyph-gap"></span>`);
    else glyphs.push(inkGlyph(ch, form));
  }
  const grouped = [];
  let index = 0;
  for (const ch of line.phrase) {
    if (ch === " ") grouped.push(" ");
    else {
      grouped.push(digits[index]);
      index += 1;
    }
  }
  const label = form === "letter-digit"
    ? `숫자를 닮은 영어 ${line.phrase}`
    : `글자를 닮은 숫자 ${grouped.join("")}`;
  return `<div class="glyph-row" aria-hidden="true">${glyphs.join("")}</div><p class="sr-only">${esc(label)}</p>`;
}
