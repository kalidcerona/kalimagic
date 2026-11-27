import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const appIds = ['zz1', 'zz2', 'zz3', 'zz4', 'zz5', 'zz6', 'zz7', 'zz8', 'zz10', 'zz11', 'zz12', 'zz13', 'zz14', 'zz15'];
const json = JSON.stringify;
const savedAt = 1795900000123;
const linkKey = 'magic-performance-link:v1:release-hitsuzen:personal';
const appearances = ['stopwatch', 'unlock', 'calculator', 'choice', 'aletheia', 'tobira', 'usotsuki', 'asrai', 'alter', 'spinner'];

export function photoSets(ids) {
  return json({ version: 2, sets: Array.from({ length: 3 }, (_, set) =>
    Array.from({ length: 12 }, (_, slot) => set === slot ? ids[set] ?? null : null)) });
}

export function photoPresets(imageId) {
  return json({ version: 1, selectedId: imageId ? 'p_fixture' : null,
    presets: imageId ? [{ id: 'p_fixture', name: '검증 프리셋', mode: 'free', brushSize: 46,
      hiddenPercent: null, imageId, imageMime: 'image/png', updatedAt: savedAt }] : [] });
}

// A real (decodable) PNG with deterministic content. Level 0 preserves size for the large-photo test.
function png(size) {
  const signature = Buffer.from('89504e470d0a1a0a', 'hex');
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = Buffer.alloc(size * (1 + 4 * size));
  function chunk(name, data) {
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length, 0);
    result.write(name, 4, 'ascii');
    data.copy(result, 8);
    let crc = 0xffffffff;
    for (const byte of result.subarray(4, -4)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    result.writeUInt32BE((~crc) >>> 0, result.length - 4);
    return result;
  }
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(pixels, { level: 0 })), chunk('IEND', Buffer.alloc(0))]);
}

export function fixtures(origin) {
  const small = png(1);
  const large = png(1536);
  const releaseLink = { [linkKey]: json({ updatedAt: savedAt, hourCycle: '24' }) };
  const raw = {
    zz1: { stopwatch2_preset_cs: '2700', stopwatch2_custom_text: '  옛 문구  ', stopwatch_named_presets_v1: json([{ name: '한글', value: 2123 }]), stopwatch_seq_slots: json([2, 1, 3]) },
    zz2: { 'unlock-settings-personal-v2': json({ imageCrop: { lock: { x: 1, y: 2 } }, fixture: 'release' }), 'unlock-settings-entry-tutorial-v1': '1', 'unlock-install-personal-v1': 'true', 'release.rewindGridGuide.v1': '', 'release.rewindCharging.v1': 'false', 'unlock.photo-save-failed.v1': '{diagnostic', ...releaseLink },
    zz3: { 'magic-calc-date-delay': '1973', 'magic-calc-hour-cycle': '24', 'magic-calc-skin': 'android', installNudgeDone: '1', 'calculator-settings-entry-tutorial-v1:/zz3': '1', ...releaseLink },
    zz4: {
      'magic-choice.v1.store': json({ version: 1, presets: [{ id: 'list-fixture', name: '과일', items: ['사과', '배'], targetIndex: 1, targetItem: '배', appearance: 'memo', updatedAt: savedAt }], options: { wallpaperKey: 'w_fixture' }, sets: [{ id: 'show-fixture', name: '공연', presetIds: ['list-fixture'], dummyIds: ['note-fixture'] }], dummyNotes: [{ id: 'note-fixture', title: '메모', body: '보존', updatedAt: savedAt }] }),
      'magic-choice.v1.store.backup': '{unfinished', 'magic-choice.settings-gesture-guide.v1': 'done', 'magic-choice.v1.input-guide': '1', 'choice.photo-save-failed.v1': '',
      'magic-choice.v1.user-icons': json([{ id: 'icon-fixture', row: 1, col: 2, page: 1, dataUrl: `data:image/png;base64,${small.toString('base64')}` }]),
      'magic-choice.performance-log.v1': json([{ type: 'opened', at: savedAt }, { type: 'closed', at: savedAt + 1 }]),
    },
    zz5: { 'aletheia.meta.v1': photoPresets('img_photo_1'), 'aletheia.photoSets.v2': photoSets(['img_photo_0', 'img_photo_1', 'img_photo_2']), 'aletheia.cellGuide.v1': '1', 'aletheia.photo-save-failed.v1': '' },
    zz6: { 'tobira.v1': json({ fixture: '원본' }), 'tobira.v1.recovery': '{raw-recovery', 'tobira.objectKind.v1': 'coin', 'tobira.wallpaperCrop.v1': json({ x: 0.22, y: 0.76 }), 'tobira.photo-save-failed.v1': '' },
    zz7: { 'usotsuki.detector.v1': json({ truthTurn: 3 }), 'usotsuki.detector.sound.v1': 'off', 'usotsuki.detector.scan-duration.v1': '2300', 'usotsuki.detector.vibration.v1': '0', 'usotsuki.performance-log.v1': json([{ at: savedAt }, { at: savedAt + 1 }]), 'first-settings-guide:v1:usotsuki:/zz7': '1' },
    zz8: { 'asrai.prototype.v2': json({ names: ['안나', '보라'], fixedNumber: 3, region: '서울', memo: '다시 시작', targetTurn: 7, count: 2 }), 'asrai.prototype.settings-guide.v1': '1' },
    zz10: { 'alter-settings': json({ rank: 'A', suit: 'spade', brightness: 80 }), 'alter-settings-gesture-guide-v1': 'seen' },
    zz11: { 'zz11-spinner-state-v1': json({ forceSpin: 5 }), 'zz11-table-theme-v1': 'oak', 'zz11-screen-design-v1': 'classic', 'zz11-guide-seen-v2': '1' },
    zz12: { 'magic-memdeck-v1-preserved-raw': '{ 👀 incomplete\r\n', 'first-settings-guide:v1:memdeck:/zz12': '1' },
    zz13: { 'magic-qr-session-v1-preserved-raw': '{invalid-qr', 'first-settings-guide:v1:arosaegida:/zz13': '1' },
    zz14: { 'pimax-practice-install-dismissed': '1', 'pimax-practice-session': '{intentionally-truncated' },
    zz15: { 'uramichi.web.settings': json({ openInSameTab: true }), 'uramichi.web.install.dismissed': '1', 'uramichi.web.recent': json(['link-b', 'link-a']), 'uramichi.web.armMode': '' },
  };
  for (let i = 0; i < appearances.length; i++) {
    const appId = appIds[i];
    const appearance = appearances[i];
    for (const suffix of ['', '/', '/index.html']) {
      raw[appId][`magic-appearance:v1:${appearance}:${origin}/${appId}${suffix}`] = json({ fixture: suffix });
    }
  }

  const mediaPlan = {
    zz2: ['unlock-images-personal', 'images', [['lock', small], ['unlock', small], ['home2', small]]],
    zz4: ['magic-choice.v1.media', 'wallpaper', [['current', large], ['w_fixture', large]]],
    zz5: ['aletheia', 'images', [['img_photo_0', small, { savedAt }], ['img_photo_1', small, { savedAt: savedAt + 1 }], ['img_photo_2', small, { savedAt: savedAt + 2 }]]],
    zz6: ['tobira.localImages.v1', 'images', [['coin:fixture', small], ['wallpaper:original', small], ['wallpaper', small]]],
  };
  const media = {};
  const blobs = {};
  for (const [appId, [db, store, records]] of Object.entries(mediaPlan)) {
    media[appId] = records.map(([key, bytes, recordMeta]) => {
      const sha256 = hash(bytes);
      blobs[sha256] = bytes;
      return { db, store, key, type: 'image/png', size: bytes.length, sha256, recordMeta };
    });
  }

  const excluded = {
    'sb-fixture-auth-token': '{"fake":"synthetic only"}',
    'friend-kairos_preset_cs': '9900',
    'magic-choice-dist.v1.store': '{existing-public-choice',
    'unlock-settings-v1': '{existing-public-release',
    'magic-performance-link:v1:release-hitsuzen:shared': '{existing-public-link',
    'magic-choice.v1.store.unrelated': 'wrong-prefix',
    [`magic-appearance:v1:choice:${origin}/zz40/`]: 'wrong-scope',
    'first-settings-guide:v1:memdeck:/tools/memdeck': 'public-guide',
  };
  return { raw, media, blobs, excluded };
}
