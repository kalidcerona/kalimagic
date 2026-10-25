// Friend builds: one source per app (the personal zz* folder), plus the few things that genuinely differ.
// Data only. The generator lives in friend-builds.mjs.
//
// Fields per app:
//   source        personal folder, relative to the playground root
//   snapshot      distribution-snapshots/<snapshot>
//   files         'all' (default) | 'choice' | 'pimax' | 'unlock' | string[]   which source files ship
//   exclude       extra files the friend build never had
//   keys          [personalName, friendName] storage/DB/cache-family literals. Replaced only when they are
//                 a whole quoted string ('x', "x" or `x`) in js/mjs/html. A third item {files:[...]} narrows it.
//   leak          regex sources that must not match anywhere in the output (a missed key would mix friend
//                 data with the owner's data)
//   cacheSuffix   appended to the service worker cache version literal (publish adds -legacy-1 before it)
//   manifestId / manifestStartUrl   manifest overrides
//   plain         [file, from, to] exact text replacements, each must hit exactly once (start mode etc.)
//
// Owner-only parts are removed by the generator itself, not configured here:
//   local-preview.js|mjs, every line marked "local-preview-hook", the cache version tokens
//   -local-preview-1 / -local-preview-module-1, and (fallback) the old inline local-preview block.

const k = (from, to) => [from, to];

export const FRIEND_APPS = {
  tobira: {
    source: 'zz6',
    snapshot: 'tobira',
    exclude: ['brand-logo.png', 'coin-500won.svg', 'coin-kennedy.svg'],
    manifestId: './',
    keys: [
      k('tobira.v1', 'friend-tobira.v1'),
      k('tobira.v1.recovery', 'friend-tobira.v1.recovery'),
      k('tobira.v1.notice', 'friend-tobira.v1.notice'),
      k('tobira.session-gone', 'friend-tobira.session-gone'),
      k('tobira.session-crack', 'friend-tobira.session-crack'),
      k('tobira.objectKind.v1', 'friend-tobira.objectKind.v1'),
      k('tobira.coinChoices.v1', 'friend-tobira.coinChoices.v1'),
      k('tobira.localImages.v1', 'friend-tobira.localImages.v1'),
      k('tobira.motion-effects.v1', 'friend-tobira.motion-effects.v1'),
      k('tobira.settings-gesture-guide.v1', 'friend-tobira.settings-gesture-guide.v1'),
      k('tobira.wallpaperCrop.v1', 'friend-tobira.wallpaperCrop.v1')
    ],
    leak: ['[\'"`]tobira\\.']
  },
  aletheia: {
    source: 'zz5',
    snapshot: 'aletheia',
    manifestId: './',
    keys: [
      k('aletheia.meta.v1', 'aletheia.distribution.meta.v1'),
      k('aletheia.custom12.v1', 'aletheia.distribution.custom12.v1'),
      k('aletheia.photoSets.v2', 'aletheia.distribution.photoSets.v2'),
      k('aletheia.cellGuide.v1', 'aletheia.distribution.cellGuide.v1'),
      k('aletheia.coverage.v1', 'aletheia.distribution.coverage.v1'),
      k('aletheia.settings-gesture-guide.v1', 'aletheia.distribution.settings-gesture-guide.v1'),
      ['aletheia', 'aletheia-distribution', { files: ['dom.js'] }],
      k('aletheia-shell-', 'friend-aletheia-shell-')
    ],
    leak: ['[\'"`]aletheia\\.(?!distribution)', '[\'"`]aletheia-shell-']
  },
  tyche: {
    source: 'zz11',
    snapshot: 'spinner',
    manifestId: './',
    manifestStartUrl: './',
    keys: [
      k('zz11-spinner-state-v2', 'friend-spinner-state-v2'),
      k('zz11-spinner-state-v1', 'friend-spinner-state-v1'),
      k('zz11-table-theme-v1', 'friend-spinner-table-theme-v1'),
      k('zz11-screen-design-v1', 'friend-spinner-screen-design-v1'),
      k('zz11-guide-seen-v2', 'friend-spinner-guide-seen-v2')
    ],
    leak: ['zz11-']
  },
  usotsuki: {
    source: 'zz7',
    snapshot: 'usotsuki',
    manifestId: './',
    cacheSuffix: '-distribution',
    keys: [
      k('usotsuki.detector.v1', 'usotsuki.distribution.detector.v1'),
      k('usotsuki.detector.sound.v1', 'usotsuki.distribution.detector.sound.v1'),
      k('usotsuki.detector.theme.v1', 'usotsuki.distribution.detector.theme.v1')
    ],
    // scan-duration and vibration keys were never isolated; friends keep sharing them as today
    leak: ['[\'"`]usotsuki\\.detector\\.(?:v1|sound\\.v1|theme\\.v1)[\'"`]']
  },
  choice: {
    source: 'zz4',
    snapshot: 'choice',
    files: 'choice',
    manifestId: './',
    cacheSuffix: '-distribution',
    keys: [
      k('magic-choice.v1.store', 'magic-choice-dist.v1.store'),
      k('magic-choice.v1.store.backup', 'magic-choice-dist.v1.store.backup'),
      k('magic-choice.v1.user-icons', 'magic-choice-dist.v1.user-icons'),
      k('magic-choice.v1.media', 'magic-choice-dist.v1.media'),
      k('magic-choice.v1.input-guide', 'magic-choice-dist.v1.input-guide'),
      k('magic-choice.settings-gesture-guide.v1', 'magic-choice-dist.settings-gesture-guide.v1'),
      k('choice-shell-', 'choice-dist-shell-')
    ],
    leak: ['[\'"`]magic-choice\\.', '[\'"`]choice-shell-']
  },
  pimax: {
    source: 'zz14',
    snapshot: 'pimax',
    files: 'pimax',
    cacheSuffix: '-distribution',
    keys: [
      k('pimax-practice-settings', 'pimax.distribution.settings'),
      k('pimax-practice-stats', 'pimax.distribution.stats'),
      k('pimax-practice-session', 'pimax.distribution.session')
    ],
    leak: ['pimax-practice-(?:settings|stats|session)']
  },
  // RELEASE keeps the editor (publish leaves data-magic-customize off the body). Other storage keys stay shared with zz2 on purpose.
  release: {
    source: 'zz2',
    snapshot: 'unlock',
    files: 'unlock',
    manifestId: './',
    keys: [k('unlock-shell-', 'friend-unlock-shell-')],
    leak: ['[\'"`]unlock-shell-']
  },
  // HITSUZEN and QR share storage names with the personal build on purpose (decision 2026-10-25).
  hitsuzen: { source: 'zz3', snapshot: 'calculator', keys: [], leak: [] },
  qr: { source: 'zz13', snapshot: 'qr', keys: [], leak: [] },
  // KAIROS friends start in landscape. The publish step adds key isolation (friend-kairos_ ...) later.
  kairos: {
    source: 'zz1',
    snapshot: 'kairos',
    keys: [],
    leak: [],
    plain: [
      ['app.js', 'let uiMode="portrait"', 'let uiMode="landscape"'],
      ['index.html', '<main id="shell">', '<main id="shell" data-ui-mode="landscape">'],
      ['index.html', '<section id="portrait-app" class="mode-view" aria-label', '<section id="portrait-app" class="mode-view" hidden aria-label'],
      ['index.html', '<section id="landscape-frame" class="mode-view" hidden aria-label', '<section id="landscape-frame" class="mode-view" aria-label']
    ]
  }
};
