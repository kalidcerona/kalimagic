// Pure performance rules for the fictional contact-memory PWA.
// A spectator taps any displayed fictional contact. The chosen name stays exact.
// Each detail opening increments one local counter. Only the target click
// (default 4, allowed 1..20) shows the single fixed preset. Every other click
// shows different locally generated fictional phone/region/note/details at once.
// No DOM, storage, network, server, or device-contact access lives in this file.

export {
  LIMITS,
  DEFAULT_FIXED_DETAILS,
  DEFAULT_FICTIONAL_NAMES,
  charLength,
  normalizeTargetClick,
  normalizeClickCount,
  countContactOpening,
  normalizeFixedDetails,
  normalizePerformanceSettings,
  keepSelectedName,
} from "./logic-limits.js";

export {
  createClickState,
  resetClickState,
  createSeededRandomInt,
  resolveContactClick,
} from "./logic-clicks.js";

export {
  normalizeName,
  normalizeSearch,
  nameMatchesQuery,
  projectAudienceList,
} from "./logic-search.js";

export {
  reduceInput,
  classifySettingsSwipe,
  performanceZones,
  classifyZoneTap,
} from "./logic-zones.js";

export {
  moveItem,
  createId,
  validatePreset,
  validateLibrary,
  parseLibraryJson,
  createSampleLibrary,
} from "./logic-library.js";
