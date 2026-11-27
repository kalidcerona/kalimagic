// Keep every source key explicit. Reading this list never enumerates origin storage.
const prefixed = (prefix, names) => names.map(name => prefix + name);
const sharedLink = 'magic-performance-link:v1:release-hitsuzen:personal';

function app(appId, keys, options = {}) {
  return { appId, keys, media: null, settingsSelector: '[data-settings-root]', ...options };
}

export const registry = {
  zz1: app('zz1', [
    ...prefixed('stopwatch_', ['preset_cs', 'preset_at', 'custom_text', 'text_at', 'ui_mode',
      'seq', 'seq_slots', 'trick3', 'portrait_digit_guide_v1', 'named_presets_v1',
      'uni_install_nudge_done', 'storage_migrated_v2']),
    ...prefixed('stopwatch2_', ['preset_cs', 'preset_at', 'custom_text', 'text_at']),
    'stopwatch-settings-entry-tutorial-v1',
  ], { appearance: 'stopwatch' }),

  zz2: app('zz2', [
    'unlock-settings-personal-v2', 'unlock-settings-v1', 'unlock-settings-entry-tutorial-v1', 'unlock-install-personal-v1',
    'release.rewindGridGuide.v1', 'release.rewindCharging.v1', 'release.rewindDnd.v1',
    'unlock.photo-save-failed.v1', sharedLink,
  ], {
    appearance: 'unlock',
    media: { db: 'unlock-images-personal', store: 'images' },
    settingsFallback: { primary: 'unlock-settings-personal-v2', legacy: 'unlock-settings-v1' },
  }),

  zz3: app('zz3', [
    'magic-calc-date-delay', 'magic-calc-hour-cycle', 'magic-calc-skin', 'installNudgeDone',
    'calculator-settings-entry-tutorial-v1:/zz3', sharedLink,
  ], { appearance: 'calculator' }),

  zz4: app('zz4', [
    ...prefixed('magic-choice.v1.', ['store', 'store.backup', 'user-icons', 'input-guide']),
    'magic-choice.settings-gesture-guide.v1', 'magic-choice.performance-log.v1', 'choice.photo-save-failed.v1',
  ], { appearance: 'choice', media: { db: 'magic-choice.v1.media', store: 'wallpaper' } }),

  zz5: app('zz5', prefixed('aletheia.', [
    'meta.v1', 'custom12.v1', 'photoSets.v2', 'cellGuide.v1', 'coverage.v1',
    'settings-gesture-guide.v1', 'photo-save-failed.v1',
  ]), { appearance: 'aletheia', media: { db: 'aletheia', store: 'images' } }),

  zz6: app('zz6', prefixed('tobira.', [
    'v1', 'v1.notice', 'v1.recovery', 'objectKind.v1', 'coinChoices.v1', 'wallpaperCrop.v1',
    'motion-effects.v1', 'settings-gesture-guide.v1', 'photo-save-failed.v1',
  ]), { appearance: 'tobira', media: { db: 'tobira.localImages.v1', store: 'images' } }),

  zz7: app('zz7', [
    ...prefixed('usotsuki.detector.', ['v1', 'sound.v1', 'theme.v1', 'scan-duration.v1', 'vibration.v1']),
    'usotsuki.performance-log.v1', 'first-settings-guide:v1:usotsuki:/zz7',
  ], { appearance: 'usotsuki' }),

  zz8: app('zz8', ['asrai.prototype.v2', 'asrai.prototype.settings-guide.v1'], { appearance: 'asrai' }),
  zz10: app('zz10', ['alter-settings', 'alter-settings-gesture-guide-v1'], { appearance: 'alter' }),
  zz11: app('zz11', prefixed('zz11-', [
    'spinner-state-v2', 'spinner-state-v2-prelaunch', 'spinner-state-v1', 'table-theme-v1', 'screen-design-v1', 'guide-seen-v2',
  ]), { appearance: 'spinner' }),
  zz12: app('zz12', [
    'magic-memdeck-v1', 'magic-memdeck-v1-preserved-raw', 'first-settings-guide:v1:memdeck:/zz12',
  ]),
  zz13: app('zz13', [
    'magic-qr-session-v1', 'magic-qr-session-v1-preserved-raw', 'first-settings-guide:v1:arosaegida:/zz13',
  ]),
  zz14: app('zz14', prefixed('pimax-practice-', [
    'settings', 'stats', 'session', 'install-dismissed',
  ]), { settingsSelector: '.settings-groups' }),
  zz15: app('zz15', prefixed('uramichi.web.', [
    'presets', 'armed', 'armMode', 'recent', 'settings', 'intro', 'install.dismissed', 'install.seen',
  ])),
};

// The builder serializes this function into each private app's module.
export function runtimeKeys(config, location) {
  const keys = [...config.keys];
  if (config.appearance) {
    const prefix = 'magic-appearance:v1:' + config.appearance + ':' + location.origin + '/' + config.appId;
    for (const suffix of ['', '/', '/index.html']) keys.push(prefix + suffix);
  }
  return keys;
}
