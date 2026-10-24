// URAMICHI web core: a pure port of the Android app's preset model (Presets.kt, PresetJson.kt,
// UrlValidator.kt, ScanText.kt, OnceGate.kt). No DOM, no storage; node tests cover it.

export {
  InputKind,
  INPUT_KINDS,
  ArmMode,
  KIND_NAME,
  KIND_HELP,
  entry,
  category,
  armed,
  recent,
  sameArmed,
} from './core-model.mjs';

export {
  isValidWebUrl,
} from './core-url.mjs';

export {
  encodeValue,
} from './core-encode.mjs';

export {
  chipLabel,
  classifyTwoFingerSwipe,
  ZOOM_LABELS,
  zoomRatioFor,
  zoomSelectedIndex,
} from './core-scan.mjs';

export {
  OnceGate,
} from './core-gate.mjs';

export {
  RANKS,
  SUITS,
  MACRO_SUITS,
  suitSymbol,
  cardDisplay,
  normalizeCard,
} from './core-card.mjs';

export {
  parseDate,
  isoDate,
  fillDate,
  resolve,
  labelFor,
  validateEntry,
} from './core-resolve.mjs';

export {
  RECENT_MAX,
  normalizeArmed,
  target,
  afterOpen,
  shownMode,
  armSequence,
  armResolved,
  recentOfSequence,
  armFromRecent,
  pushRecent,
  pruneRecents,
  describe,
  scanAction,
  shells,
} from './core-logic.mjs';

export {
  JSON_VERSION,
  newId,
  encodeCategories,
  decodeCategories,
  encodeArmed,
  decodeArmed,
  encodeRecents,
  decodeRecents,
  parseImport,
  mergeCategories,
} from './core-json.mjs';
