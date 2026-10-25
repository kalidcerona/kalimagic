// Personal apps carry the localhost-only preview hook; friend builds do not. The hook is one marked line in the app
// (plus its service worker shell entry and a cache-name suffix) and the local-preview.js(mjs) file.
export const LOCAL_PREVIEW_MARK = 'local-preview-hook';
export const LOCAL_PREVIEW_CACHE_SUFFIX = '-local-preview-module-1';
export const LOCAL_PREVIEW_FILE = /^local-preview\.m?js$/;

export function stripLocalPreview(text) {
  return text.split('\n').filter((line) => !line.includes(`// ${LOCAL_PREVIEW_MARK}`)).join('\n')
    .replace(LOCAL_PREVIEW_CACHE_SUFFIX, '');
}

// The pinned choice and spinner snapshots still carry the old inline hook. Remove it so they compare equal to a
// personal app whose marked line is stripped.
const INLINE_HOOK = /const localSettingsHost = typeof location !== 'undefined' && \['localhost', '127\.0\.0\.1', '::1', '\[::1\]'\]\.includes\(location\.hostname\);\nif \(localSettingsHost && new URLSearchParams\(location\.search\)\.get\('local-preview'\) === '1'\) \{[\s\S]*?\n\}\n/;
export function stripInlineLocalPreview(text) {
  return dropUnusedSingleImports(text.replace(INLINE_HOOK, ''));
}

// A friend build without the hook would leave single-name imports that only the hook used. Compare both sides
// without any single-name import whose name is no longer used.
export function dropUnusedSingleImports(text) {
  return text.replace(/^import \{ (\w+) \} from ['"][^'"]+['"];\n/gm, (line, name) => (text.split(new RegExp(`\\b${name}\\b`)).length === 2 ? '' : line));
}
