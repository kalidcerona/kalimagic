import { existsSync } from 'node:fs';
import path from 'node:path';

// Loader hooks for usotsuki-app-script.mjs, registered with module.register() so they also run on Node 20.
const USOTSUKI_FEATURE_MODULES = new Set(['controller.js', 'controller-state.js', 'controller-themes.js', 'controller-audio.js', 'controller-storage.js', 'controller-hold.js', 'controller-haptic.js', 'controller-screens.js', 'controller-attempts.js', 'controller-gestures.js', 'controller-display-theme.js', 'dom.js', 'storage.js', 'heartbeat.js',
  'vibration.js', 'wake-lock.js', 'preferences.js', 'stage.js', 'bindings.js']);

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  const parent = context.parentURL ? new URL(context.parentURL) : null;
  if (!parent || !parent.search || parent.protocol !== 'file:' || !specifier.startsWith('./')) return result;
  const url = new URL(result.url);
  if (url.protocol !== 'file:' || url.search || !USOTSUKI_FEATURE_MODULES.has(path.basename(url.pathname))) return result;
  if (path.dirname(url.pathname) !== path.dirname(parent.pathname)) return result;
  if (!existsSync(new URL('./detector.js', url))) return result;
  if (!USOTSUKI_FEATURE_MODULES.has(path.basename(parent.pathname)) && path.basename(parent.pathname) !== 'detector.js') return result;
  url.search = parent.search;
  return { ...result, url: url.href };
}
