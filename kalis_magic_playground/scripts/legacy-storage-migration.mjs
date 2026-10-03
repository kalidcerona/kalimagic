import {
  TRUSTED_START_SESSION_KEY,
  isReusedPersonalRoute,
  legacyWorkerSpecByTarget,
} from './legacy-shared-contract.mjs';

// Raw keys from the portrait/landscape era. Destination prefixes are the
// rewritten friend-app keys. Values are copied only, never moved or normalized.
const PORTRAIT_FIELDS = Object.freeze(['preset_cs', 'preset_at', 'custom_text', 'text_at']);
const SHARED_FIELDS = Object.freeze([
  'preset_cs',
  'preset_at',
  'custom_text',
  'text_at',
  'ui_mode',
  'seq',
  'seq_slots',
  'named_presets_v1',
  'trick3',
  'portrait_digit_guide_v1',
  'uni_install_nudge_done',
]);
const LANDSCAPE_PREFIX = 'stopwatch_';
const PORTRAIT_PREFIX = 'stopwatch2_';
const ALLOWED_STORAGE_PREFIXES = new Set(['friend-kairos_', 'friend-kairos-classic_']);
const HISTORICAL_WORKER_IDS = Object.freeze(['kali-stopwatch-v2', 'stopwatch2-v2', 'stopwatch-uni-v14']);

function validPresetCs(value) {
  return typeof value === 'string' && /^\d{1,6}$/.test(value) && Number(value) <= 603999;
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{1,16}$/.test(value)) return false;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 && String(number) === value;
}

function validText(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 80 && !/[\u0000-\u001f]/.test(value);
}

function validSlotValue(kind, value) {
  if (kind === 'seq') return validSeq(value);
  return kind === 'text' && typeof value === 'string' &&
    value.length <= 80 && !/[\u0000-\u001f\u007f]/.test(value);
}

function validSeq(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 40) return false;
  const parts = value.split(',');
  return parts.length <= 8 && parts.every((part) => /^\d{1,2}$/.test(part) && Number(part) <= 99);
}

function validFlag(value) {
  return value === '0' || value === '1';
}

function validJsonSlots(value) {
  let parsed;
  try { parsed = JSON.parse(value); } catch { return false; }
  if (!Array.isArray(parsed) || parsed.length > 3) return false;
  return parsed.every((item) => {
    if (typeof item === 'string') return item === '' || validSeq(item);
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    if (item.kind !== 'text' && item.kind !== 'seq') return false;
    return validSlotValue(item.kind, item.value);
  });
}

function validNamedPresets(value) {
  let parsed;
  try { parsed = JSON.parse(value); } catch { return false; }
  if (!Array.isArray(parsed) || parsed.length > 3) return false;
  return parsed.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    if (item.kind !== 'text' && item.kind !== 'seq') return false;
    if (!validSlotValue(item.kind, item.value)) return false;
    if (item.name !== undefined && (typeof item.name !== 'string' || item.name.length > 40 || /[\u0000-\u001f\u007f]/.test(item.name))) return false;
    const count = item.forceAfter;
    return count === undefined || (Number.isInteger(count) && count >= 0 && count <= 99);
  });
}

function fieldIsValid(field, value) {
  if (field === 'preset_cs') return validPresetCs(value);
  if (field === 'preset_at' || field === 'text_at') return validTimestamp(value);
  if (field === 'custom_text') return validText(value);
  if (field === 'ui_mode') return value === 'portrait' || value === 'landscape';
  if (field === 'seq') return validSeq(value);
  if (field === 'seq_slots') return validJsonSlots(value);
  if (field === 'named_presets_v1') return validNamedPresets(value);
  if (field === 'uni_install_nudge_done') return value === '1';
  if (field === 'trick3' || field === 'portrait_digit_guide_v1') return validFlag(value);
  return false;
}

function canonicalDocument(pathname, canonicalPath) {
  const bare = canonicalPath.replace(/\/$/, '');
  return pathname === canonicalPath || pathname === bare || pathname === `${bare}/index.html`;
}

function readItem(storage, key) {
  const value = storage.getItem(key);
  return typeof value === 'string' ? value : null;
}

function chooseField(field, storage, allowPortrait) {
  const landscape = readItem(storage, LANDSCAPE_PREFIX + field);
  const landscapeOk = landscape !== null && fieldIsValid(field, landscape);
  const portraitAllowed = allowPortrait && PORTRAIT_FIELDS.includes(field);
  const portrait = portraitAllowed ? readItem(storage, PORTRAIT_PREFIX + field) : null;
  const portraitOk = portrait !== null && fieldIsValid(field, portrait);
  if (landscapeOk) return landscape;
  if (portraitOk) return portrait;
  return null;
}

function markerKey(spec) {
  return `${spec.storagePrefix}legacy_shared_migrated_v1`;
}

function clearTrustedStart(session, tool) {
  if (!session || typeof session.getItem !== 'function' || typeof session.removeItem !== 'function') return;
  if (session.getItem(TRUSTED_START_SESSION_KEY) !== tool) return;
  session.removeItem(TRUSTED_START_SESSION_KEY);
}

// Query strings are ignored on purpose: user values must never travel in the URL.
export function migrateTrustedLegacyStorage(input = {}) {
  const pathname = typeof input.pathname === 'string' ? input.pathname : '';
  if (isReusedPersonalRoute(pathname)) return { ok: false, reason: 'reused-route', wrote: [] };
  const spec = legacyWorkerSpecByTarget(input.target);
  if (!spec || !canonicalDocument(pathname, spec.canonicalPath)) {
    return { ok: false, reason: 'untrusted-path', wrote: [] };
  }
  void input.search;
  const session = input.session;
  const trusted = session && typeof session.getItem === 'function'
    ? session.getItem(TRUSTED_START_SESSION_KEY)
    : null;
  if (spec.sourceKind === 'calculator') {
    if (trusted === spec.tool) {
      try { clearTrustedStart(session, spec.tool); } catch { /* keep the app usable */ }
    }
    return { ok: true, reason: 'calculator-keys-unchanged', wrote: [] };
  }
  if (!ALLOWED_STORAGE_PREFIXES.has(spec.storagePrefix)) {
    return { ok: false, reason: 'target-allowlist', wrote: [] };
  }
  const storage = input.storage;
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    return { ok: false, reason: 'storage', wrote: [] };
  }
  const marker = markerKey(spec);
  if (readItem(storage, marker) === '1') {
    try { clearTrustedStart(session, spec.tool); } catch { /* marker already records success */ }
    return { ok: true, reason: 'already', wrote: [] };
  }
  if (trusted !== spec.tool) return { ok: false, reason: 'untrusted-start', wrote: [] };

  const planned = [];
  for (const field of SHARED_FIELDS) {
    const value = chooseField(field, storage, spec.sourceKind === 'integrated');
    if (value === null) continue;
    const dest = spec.storagePrefix + field;
    if (!dest.startsWith(spec.storagePrefix)) return { ok: false, reason: 'target-allowlist', wrote: [] };
    if (readItem(storage, dest) !== null) continue;
    planned.push([dest, value]);
  }
  if (spec.tutorialSourceKey && spec.tutorialDestKey) {
    const tutorial = readItem(storage, spec.tutorialSourceKey);
    if (tutorial === '1' && readItem(storage, spec.tutorialDestKey) === null) {
      planned.push([spec.tutorialDestKey, tutorial]);
    }
  }

  const wrote = [];
  try {
    for (const [dest, value] of planned) {
      if (readItem(storage, dest) !== null) continue;
      storage.setItem(dest, value);
      wrote.push(dest);
    }
    storage.setItem(marker, '1');
    wrote.push(marker);
    clearTrustedStart(session, spec.tool);
    return { ok: true, reason: 'migrated', wrote };
  } catch {
    return { ok: false, reason: 'partial', wrote };
  }
}

function scriptPathname(scriptUrl) {
  if (typeof scriptUrl !== 'string' || scriptUrl === '') return '';
  try { return new URL(scriptUrl, 'https://fixture.invalid').pathname; } catch { return ''; }
}

// Guidance only. Reused personal routes are never redirected or copied.
export function guidanceForReusedRoute(evidence = {}) {
  const pathname = typeof evidence.pathname === 'string' ? evidence.pathname : '';
  if (!isReusedPersonalRoute(pathname)) return null;
  const manifest = evidence.cachedManifest;
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return null;
  const title = `${manifest.name || ''} ${manifest.short_name || ''}`;
  if (!/스톱워치|stopwatch/i.test(title)) return null;
  if (/계산기|HITSUZEN|선택|TOBIRA|choice/i.test(title)) return null;
  const worker = typeof evidence.workerScript === 'string' ? evidence.workerScript : '';
  if (!HISTORICAL_WORKER_IDS.some((id) => worker.includes(id))) return null;
  if (!isReusedPersonalRoute(scriptPathname(evidence.workerScriptUrl))) return null;
  return {
    autoRedirect: false,
    autoCopy: false,
    message: '이전 스톱워치로 확인되었습니다. 값은 옮기지 않습니다. 새 주소를 직접 선택하세요.',
    choices: [
      { href: '/tools/kairos-classic/', label: 'KAIROS CLASSIC' },
      { href: '/tools/kairos/', label: 'KAIROS' },
    ],
  };
}
