import { PRIVATE_URAMICHI_WAKE, PUBLIC_URAMICHI_WAKE } from './public-uramichi-wake.mjs';
// Existing public snapshots are canonical. New publications accept an explicit private source.
const canonical = Object.fromEntries([
  ['tobira', 'tobira'], ['aletheia', 'aletheia'], ['tyche', 'spinner'],
  ['usotsuki', 'usotsuki'], ['choice', 'choice'], ['memdeck', 'memdeck'],
  ['pimax', 'pimax'], ['release', 'unlock'], ['hitsuzen', 'calculator'],
  ['qr', 'qr'], ['kairos', 'kairos']
].map(([name, snapshot]) => [name, Object.freeze({ snapshot })]));

const keys = values => values.map(value => [value, `friend-${value}`]);
export const FRIEND_APPS = Object.freeze({ ...canonical,
  asrai: {
    generated: true, snapshot: 'asrai', cacheSuffix: '-distribution',
    exclude: ['app.js'],
    keys: keys(['asrai.prototype.v2', 'asrai.prototype.settings-guide.v1', 'asrai-shell-']),
    leak: ["['\"`]asrai\\.(?:prototype)", "['\"`]asrai-shell-"],
    plain: [['contacts-screen.js', 'return document.visibilityState === "visible";', 'return performanceOpen() && document.visibilityState === "visible";']]
  },
  alter: {
    generated: true, snapshot: 'alter', cacheSuffix: '-distribution',
    keys: keys(['alter-settings', 'alter-settings-gesture-guide-v1', 'alter-runtime-events', 'alter-shell-']),
    leak: ["['\"`]alter-(?:settings|runtime-events|shell-)"],
    plain: [['wake-lock.js', 'return document.visibilityState === "visible";', 'return !document.getElementById("stage").hidden && document.getElementById("settings").hidden && document.visibilityState === "visible";']]
  },
  uramichi: {
    generated: true, snapshot: 'uramichi', cacheSuffix: '-distribution',
    plain: [['camera.mjs', PRIVATE_URAMICHI_WAKE, PUBLIC_URAMICHI_WAKE]],
    keys: keys(['uramichi.web.presets', 'uramichi.web.armed', 'uramichi.web.armMode', 'uramichi.web.recent', 'uramichi.web.settings', 'uramichi.web.intro', 'uramichi.web.install.dismissed', 'uramichi.web.install.seen', 'uramichi-web-']),
    leak: ["['\"`]uramichi\\.web\\.", "['\"`]uramichi-web-"]
  }
});
