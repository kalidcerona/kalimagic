// Use the app's pure readers. DOM-bound readers have equivalent narrow shape
// guards here, with the originating module named beside the guard.
import { TARGETS } from './data.mjs';

const sourceAliases = { 'kairos-classic': 'kairos', release: 'unlock', arosaegida: 'qr', tyche: 'spinner' };
async function native(target, name, options) {
  if (options.loadModule) return options.loadModule(name);
  const url = import.meta.url.startsWith('file:')
    ? new URL(`../distribution-snapshots/${sourceAliases[target] || target}/${name}`, import.meta.url)
    : new URL(`../${name}`, import.meta.url);
  return import(url.href);
}
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
function requireValid(condition) {
  if (!condition) throw new Error('앱에서 읽을 수 없는 저장 형식입니다.');
}
const JSON_KEYS =
  /(?:unlock-settings-v1|\.v1\.store(?:\.backup)?|\.user-icons|\.meta\.v1|\.custom12\.v1|\.photoSets\.v2|friend-tobira\.v1$|coinChoices|detector\.v1$|asrai\.prototype\.v2$|alter-settings$|spinner-state-v[12]$|memdeck-v1$|qr-session-v1-arosaegida$|pimax\.distribution\.(?:settings|stats|session)$|uramichi\.web\.(?:presets|armed|recent|settings)$|_seq_slots$|_named_presets_v1$|magic-performance-link:|magic-appearance:)/;
export async function validateProfile(target, profile, options = {}) {
  const invalid = [];
  const aletheiaPhotoRefs = new Map();
  const currentPhotoSets = target === 'aletheia' &&
    profile.entries.some(([key, raw]) => key === 'aletheia.distribution.photoSets.v2' && raw !== null);
  for (const [key, raw] of profile.entries) {
    if (raw === null || /preserved-raw$/.test(key)) continue;
    try {
      let value;
      if (JSON_KEYS.test(key)) value = JSON.parse(raw);
      if (key.startsWith('magic-appearance:')) {
        if (!globalThis.MagicSettingsUI) await native(target, 'settings-ui.js', options);
        const api = globalThis.MagicSettingsUI;
        requireValid(api?.load({ getItem: () => raw }, key, api.profiles.unlock).status === 'valid');
      } else if (/\.v1\.store(?:\.backup)?$/.test(key)) {
        const result = (await native(target, 'logic-storage.js', options)).parseStorage(raw);
        requireValid(result.ok && !result.issues?.length);
        for (const field of ['presets', 'sets', 'dummyNotes']) {
          if (Array.isArray(value[field])) requireValid(result.data[field].length === value[field].length);
        }
        const presetIds = new Set(result.data.presets.map((item) => item.id)),
          dummyIds = new Set(result.data.dummyNotes.map((item) => item.id));
        requireValid(presetIds.size === result.data.presets.length);
        requireValid(
          result.data.sets.every((set) =>
            set.presetIds.every((id) => presetIds.has(id)) && set.dummyIds.every((id) => dummyIds.has(id))
          ),
        );
      } else if (key === 'magic-choice-dist.v1.user-icons') {
        const module = await native(target, 'logic-user-icons.js', options);
        requireValid(Array.isArray(value) && module.normalizeUserIcons(value).length === value.length);
      } else if (key === 'friend-memdeck-v1') (await native(target, 'core.mjs', options)).loadState(raw);
      else if (key === 'magic-qr-session-v1-arosaegida') {
        (await native(target, 'core.mjs', options)).restore(raw);
      } else if (key === 'friend-tobira.v1') {
        requireValid((await native(target, 'logic.js', options)).parseStoredState(raw).ok);
      } else if (key === 'usotsuki.distribution.detector.v1') {
        requireValid((await native(target, 'logic.js', options)).parseStoredPayload(raw).status === 'ok');
      } else if (key === 'aletheia.distribution.meta.v1') {
        const result = (await native(target, 'logic-presets.js', options)).parseMeta(raw);
        requireValid(result.ok);
        aletheiaPhotoRefs.set(key, result.meta.presets.map((preset) => preset.imageId));
      } else if (
        key === 'aletheia.distribution.photoSets.v2' || key === 'aletheia.distribution.custom12.v1'
      ) {
        const parse = (await native(target, 'logic-photo-sets.js', options)).parsePhotoSets;
        const legacy = key.endsWith('custom12.v1');
        const result = legacy ? parse(null, raw) : parse(raw);
        requireValid(result.ok);
        // Like the app and the backup worker, use legacy slots only when current slots are absent.
        if (!legacy || !currentPhotoSets) aletheiaPhotoRefs.set(key, result.sets.flat().filter(Boolean));
      } else if (/pimax\.distribution\.(settings|stats|session)$/.test(key)) {
        const module = await native(target, 'core-storage.mjs', options), kind = key.split('.').at(-1);
        const validator = module[`validate${kind[0].toUpperCase()}${kind.slice(1)}`];
        requireValid(!module.readSlot(raw, {}, validator).corrupt && value !== null);
      } else if (key === 'friend-uramichi.web.presets') {
        const module = await native(target, 'core-json.mjs', options);
        requireValid(module.parseImport(raw).ok);
        const categories = Array.isArray(value) ? value : value.categories;
        const ids = new Set();
        for (const category of categories) {
          requireValid(typeof category.id === 'string' && category.id && !ids.has(category.id));
          ids.add(category.id);
          const entries = new Set();
          for (const entry of category.entries || []) {
            requireValid(typeof entry.id === 'string' && entry.id && !entries.has(entry.id));
            entries.add(entry.id);
          }
        }
      } else if (key === 'friend-uramichi.web.armed') {
        requireValid(!!(await native(target, 'core-json.mjs', options)).decodeArmed(raw));
      } else if (key === 'friend-uramichi.web.recent') {
        requireValid(Array.isArray(value));
        requireValid(
          (await native(target, 'core-json.mjs', options)).decodeRecents(raw).length === value.length,
        );
      } else if (/_seq_slots$|_named_presets_v1$/.test(key)) {
        requireValid(Array.isArray(value) && value.length <= 3);
        const module = await native(target, 'logic.js', options);
        const storage = { getItem: () => raw };
        if (key.endsWith('_seq_slots')) module.loadPresetSlots(storage);
        else module.loadNamedPresets(storage);
        requireValid(
          value.every((item) =>
            typeof item === 'string' ||
            (object(item) && ['text', 'seq'].includes(item.kind) && typeof item.value === 'string')
          ),
        );
      } else if (key === 'unlock-settings-v1') {
        requireValid(object(value));
        (await native(target, 'logic.js', options)).normalizeSettings(value);
      } else if (key === 'friend-alter-settings') {
        // settings-store.js: readSavedSettings (DOM-bound select options).
        requireValid(
          object(value) &&
            ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].includes(value.rank) &&
            ['spade', 'heart', 'club', 'diamond'].includes(value.suit) && finite(value.brightness) &&
            value.brightness >= 75 && value.brightness <= 125,
        );
      } else if (/friend-spinner-state-v[12]$/.test(key)) {
        // spinner/app.js startup reader; v1 only stores forceSpin.
        requireValid(
          object(value) && Number.isInteger(value.forceSpin) && value.forceSpin >= 1 && value.forceSpin <= 8,
        );
        if (key.endsWith('v2')) {
          requireValid(
            Number.isInteger(value.spins) && value.spins >= 0 &&
              ['targetAngle', 'previousAngle'].every((field) =>
                value[field] === null || (finite(value[field]) && value[field] >= 0 && value[field] < 360)
              ),
          );
        }
      } else if (key === 'friend-asrai.prototype.v2') {
        // contacts-storage.js: parseStored; use the same pure limits/name normalizer.
        const module = await native(target, 'logic.js', options), limits = module.LIMITS;
        requireValid(
          object(value) && Array.isArray(value.names) && value.names.length >= 1 &&
            value.names.length <= limits.contacts,
        );
        requireValid(
          value.names.every((name) =>
            typeof name === 'string' &&
            name === name.replace(/\u0000/g, '').normalize('NFC').trim().replace(/\s+/g, ' ') && name &&
            Array.from(name).length <= limits.contactName
          ),
        );
        requireValid(new Set(value.names.map(module.normalizeName)).size === value.names.length);
        requireValid(
          Number.isInteger(value.clickCount) && value.clickCount >= 0 &&
            value.clickCount <= limits.maxClickCount && Number.isInteger(value.targetClick) &&
            value.targetClick >= limits.targetClickMin && value.targetClick <= limits.targetClickMax,
        );
        requireValid(
          ['phone', 'region', 'note'].every((field) =>
            typeof value[field] === 'string' &&
            value[field] ===
              value[field].replace(/\u0000/g, '').normalize('NFC').trim().replace(/\s+/g, ' ') &&
            Array.from(value[field]).length <= limits[field]
          ),
        );
      } else if (key === 'friend-tobira.wallpaperCrop.v1') {
        requireValid(
          raw.trim() !== '' && Number.isFinite(Number(raw)) && Number(raw) >= 0 && Number(raw) <= 18,
        );
      } else if (key === 'magic-calc-date-delay') {
        requireValid(/^\d+$/.test(raw) && Number(raw) >= 5 && Number(raw) <= 120);
      } else if (key === 'magic-calc-hour-cycle') requireValid(['12', '24'].includes(raw));
      else if (key === 'magic-calc-skin') requireValid(['default', 'iphone'].includes(raw));
      else if (key.startsWith('magic-performance-link:')) {
        requireValid(
          object(value) && value.version === 1 && Number.isInteger(value.days) && value.days >= 0 &&
            value.days <= 100000 && finite(value.updatedAt) && value.updatedAt >= 0,
        );
      } else if (JSON_KEYS.test(key)) requireValid(value !== null && typeof value === 'object');
    } catch (error) {
      invalid.push({ key, message: error.message });
    }
  }
  const aletheiaMedia = target === 'aletheia' ? TARGETS.aletheia.media[0] : null;
  const availablePhotos = new Set();
  for (const item of profile.media) {
    if (item.value === undefined) continue;
    const blob = item.value instanceof Blob ? item.value : item.value?.blob;
    if (!(blob instanceof Blob)) {
      invalid.push({ key: String(item.ref.key), message: '사진 원본 형식이 올바르지 않습니다.' });
      continue;
    }
    if (
      aletheiaMedia && item.targetDb === aletheiaMedia.targetDb &&
      item.targetStore === aletheiaMedia.targetStore && !(item.value instanceof Blob) && blob.size > 0
    ) availablePhotos.add(item.ref.key);
    if (typeof globalThis.createImageBitmap === 'function') {
      try {
        const image = await createImageBitmap(blob);
        image.close();
      } catch {
        invalid.push({ key: String(item.ref.key), message: '사진을 디코딩할 수 없습니다.' });
      }
    }
  }
  for (const [key, ids] of aletheiaPhotoRefs) {
    if (ids.some((id) => !availablePhotos.has(id))) {
      invalid.push({ key, message: '연결된 사진 원본이 누락되었거나 비어 있습니다.' });
    }
  }
  return invalid;
}
