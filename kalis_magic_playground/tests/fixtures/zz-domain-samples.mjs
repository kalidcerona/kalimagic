// Held-out domain samples: fixed values distinct from the basic contract fixtures.
import { freshState } from '../../distribution-snapshots/memdeck/core.mjs';
import { defaultState as tobiraState } from '../../distribution-snapshots/tobira/logic.js';
import { defaultSettings, defaultStats } from '../../distribution-snapshots/pimax/core-storage.mjs';
import { mapQuestion } from '../../distribution-snapshots/pimax/core-questions.mjs';
import * as QR from '../../distribution-snapshots/qr/core.mjs';
export const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=';
const json = JSON.stringify;
export function imageBlob() {
  return new Blob([Uint8Array.from(atob(PNG_BASE64), (char) => char.charCodeAt(0))], { type: 'image/png' });
}
const image = (db, store, key, record = false) => ({
  db,
  store,
  key,
  value: record ? { blob: imageBlob(), savedAt: 1795700000123 } : imageBlob(),
});
function sample(target, appId, sourceEntries, media = []) {
  return { target, appId, sourceEntries, media };
}
export function domainSamples() {
  const choice = (label) => ({
    version: 1,
    presets: [{
      id: 'same-list',
      name: label,
      appearance: 'memo',
      items: [label + ' 하나', label + ' 둘'],
      forceItem: label + ' 둘',
    }],
    twoList: { enabled: false, presetIdA: null, presetIdB: null },
    options: { wallpaper: 'photo', wallpaperId: 'heldout' },
    sets: [{ id: 'same-set', name: label + ' 묶음', presetIds: ['same-list'], dummyIds: ['same-note'] }],
    activeSetId: 'same-set',
    dummyNotes: [{
      id: 'same-note',
      title: label + ' 메모',
      body: '첫 줄\n둘째 줄',
      updatedAt: 1795700000000,
    }],
    builtins: {},
    hiddenPresetIds: [],
  });
  const tobira = tobiraState();
  tobira.presets[0] = {
    ...tobira.presets[0],
    id: 'heldout-coin',
    name: '보관 동전',
    startX: 0.37,
    startY: 0.73,
    exitEdge: 'right',
    disappearDuration: 1300,
  };
  tobira.selectedId = 'heldout-coin';
  const memdeck = freshState();
  memdeck.selected = 'mnemonica';
  memdeck.stacks.redford = [...memdeck.stacks.redford.slice(1), memdeck.stacks.redford[0]];
  memdeck.progress.redford.stats['7'] = { attempts: 3, correct: 2, wrong: 1, slow: 0, totalMs: 7300 };
  const question = mapQuestion('digit', '7');
  const practice = {
    version: 1,
    mode: question.mode,
    questions: [question],
    index: 0,
    count: 1,
    finished: false,
    statsPosted: false,
    accumulatedMs: 2345,
  };
  const qr = {
    config: QR.settings({
      target: 'https://example.com/heldout',
      decoys: ['https://example.org/decoy'],
      ordinal: 2,
      dot: 120,
      extraTargets: [],
    }),
    counter: 0,
    frozen: false,
    current: null,
    bag: [],
    last: null,
  };
  QR.next(qr, () => 0.25);
  qr.frozen = true;
  const samples = [
    sample('kairos', 'zz1', {
      'stopwatch_named_presets_v1': json([{ name: '야간', kind: 'text', value: '밤 11:47', forceAfter: 6 }, {
        name: '순서',
        kind: 'seq',
        value: '07,31,82',
        forceAfter: 4,
      }, { name: '세 번째', kind: 'text', value: '가나다', forceAfter: 1 }]),
      'stopwatch_seq_slots': json([{ kind: 'seq', value: '07,31,82' }, { kind: 'text', value: '밤' }, {
        kind: 'text',
        value: '끝',
      }]),
      'stopwatch2_preset_cs': '47',
      'stopwatch2_custom_text': '구형 단독',
      'stopwatch_ui_mode': 'portrait',
      'stopwatch_seq': '07,31,82',
    }),
    sample('release', 'zz2', {
      'unlock-settings-personal-v2': json({
        style: 'galaxy',
        digits: 4,
        unlockMode: 'attempt',
        unlockAttempt: 5,
        revealAttempt: 3,
        cropTop: 41,
        imagePosition: 63,
        timeDelay: 7,
        timeDuration: 13,
        vibration: false,
        birthDaysLink: true,
        statusStyle: 'black-translucent',
        statusColor: '#123456',
      }),
      'release.rewindCharging.v1': '1',
    }, ['lock', 'unlock', 'home2'].map((key) => image('unlock-images-personal', 'images', key))),
    sample('hitsuzen', 'zz3', {
      'magic-calc-date-delay': '35',
      'magic-calc-hour-cycle': '12',
      'magic-calc-skin': 'iphone',
      'magic-performance-link:v1:release-hitsuzen:personal': json({ version: 1, days: 1234, updatedAt: 1795700000000 }),
    }),
    sample('choice', 'zz4', {
      'magic-choice.v1.store': json(choice('ZZ')),
      'magic-choice.v1.user-icons': json([{
        id: 'icon-heldout',
        label: '사진',
        dataUrl: 'data:image/png;base64,' + PNG_BASE64,
        page: 2,
        row: 1,
        col: 1,
      }]),
      'magic-choice.performance-log.v1': json([{ at: 1795700000000, choice: 2 }, {
        at: 1795700001000,
        choice: 1,
      }]),
    }, [
      image('magic-choice.v1.media', 'wallpaper', 'current'),
      image('magic-choice.v1.media', 'wallpaper', 'w_heldout'),
    ]),
    sample('aletheia', 'zz5', {
      'aletheia.meta.v1': json({ version: 1, presets: [], selectedId: null }),
      'aletheia.photoSets.v2': json({
        version: 2,
        sets: [['img_heldout', ...Array(11).fill(null)], Array(12).fill(null), [
          ...Array(11).fill(null),
          'img_end',
        ]],
      }),
    }, [image('aletheia', 'images', 'img_heldout', true), image('aletheia', 'images', 'img_end', true)]),
    sample('tobira', 'zz6', {
      'tobira.v1': json(tobira),
      'tobira.coinChoices.v1': json({ 'heldout-coin': 'upload' }),
      'tobira.wallpaperCrop.v1': '12',
    }, [
      image('tobira.localImages.v1', 'images', 'coin:heldout-coin'),
      image('tobira.localImages.v1', 'images', 'wallpaper:original'),
      image('tobira.localImages.v1', 'images', 'wallpaper'),
    ]),
    sample('usotsuki', 'zz7', {
      'usotsuki.detector.v1': json({ version: 1, attemptCount: 3, settings: { truthAttempts: [2, 5, 9] } }),
      'usotsuki.detector.scan-duration.v1': '4500',
      'usotsuki.detector.vibration.v1': '0',
      'usotsuki.performance-log.v1': json([{ at: 1795700000000, verdict: 'truth' }]),
    }),
    sample('asrai', 'zz8', {
      'asrai.prototype.v2': json({
        names: ['가상 하나', '가상 둘', '가상 셋'],
        targetClick: 7,
        clickCount: 4,
        phone: '010-1234-5678',
        region: '제주',
        note: '다섯째 줄',
      }),
    }),
    sample('alter', 'zz10', { 'alter-settings': json({ rank: '9', suit: 'diamond', brightness: 115 }) }),
    sample('tyche', 'zz11', {
      'zz11-spinner-state-v2': json({
        forceSpin: 7,
        spins: 3,
        targetAngle: 225,
        previousAngle: 90,
        rotation: 1440,
      }),
      'zz11-spinner-state-v1': json({ forceSpin: 6 }),
      'zz11-table-theme-v1': 'casino',
    }),
    sample('memdeck', 'zz12', { 'magic-memdeck-v1': json(memdeck) }),
    sample('arosaegida', 'zz13', { 'magic-qr-session-v1': QR.serialize(qr) }),
    sample('pimax', 'zz14', {
      'pimax-practice-settings': json({ ...defaultSettings(), count: 15, phonetic: false }),
      'pimax-practice-stats': json(defaultStats()),
      'pimax-practice-session': json(practice),
    }),
    sample('uramichi', 'zz15', {
      'uramichi.web.presets': json({
        app: 'URAMICHI',
        version: 1,
        categories: [{
          id: 'same-category',
          name: '보관 묶음',
          inputKind: 'NONE',
          entries: [{
            id: 'same-entry',
            label: '실행 금지',
            url: 'https://example.com/no-execution',
            code: '',
          }],
        }],
      }),
      'uramichi.web.armed': json({
        categoryId: 'same-category',
        entryId: 'same-entry',
        label: '실행 금지',
        url: 'https://example.com/no-execution',
        mode: 'SEQUENCE',
        seqIndex: 2,
      }),
      'uramichi.web.armMode': 'ALWAYS',
      'uramichi.web.recent': json([{
        categoryId: 'same-category',
        entryId: 'same-entry',
        label: '최근',
        url: 'https://example.com/no-execution',
        kind: 'NONE',
      }]),
      'uramichi.web.settings': json({ sameWindow: true }),
    }),
  ];
  for (const item of samples) {
    item.publicEntries = Object.fromEntries(
      Object.entries(item.sourceEntries).filter(([key]) => !key.includes('performance-log')).map((
        [key, value],
      ) => [key, value]),
    );
  }
  samples.find((item) => item.target === 'choice').publicEntries['magic-choice.v1.store'] = json(
    choice('공개'),
  );
  samples.find((item) => item.target === 'alter').publicEntries['alter-settings'] = json({
    rank: '3',
    suit: 'club',
    brightness: 85,
  });
  samples.find((item) => item.target === 'asrai').publicEntries['asrai.prototype.v2'] = json({
    names: ['공개 이름'],
    targetClick: 2,
    clickCount: 1,
    phone: '010-0000-0000',
    region: '서울',
    note: '공개 메모',
  });
  return samples;
}
