import { readFileSync } from 'node:fs';
import path from 'node:path';

// Personal-only launch self-check (2026-11-07). Pinned friend snapshots do not carry it.
// Compare personal USOTSUKI to the snapshot only after this list is removed.
export const PERSONAL_LAUNCH_CHECK_FILES = ['launch-check.js'];
export const LAUNCH_CHECK_CACHE_SUFFIX = '-launch-check-1';

export function stripPersonalLaunchCheck(text) {
  return text
    .replace(/^import \{ startLaunchCheck \} from ["']\.\/launch-check\.js["'];\n/gm, '')
    .replace(/^startLaunchCheck\(\);\n/gm, '')
    .replace(/^[ \t]*["']\.\/launch-check\.js["'],?[ \t]*\n/gm, '')
    .replaceAll(LAUNCH_CHECK_CACHE_SUFFIX, '');
}

// usotsukiAppSource joins raw module files with a newline. Drop launch-check.js and the
// extra join newline so the remaining personal source matches the friend snapshot.
export function excisePersonalLaunchCheck(source, dir) {
  const body = readFileSync(path.join(dir, 'launch-check.js'), 'utf8');
  const needle = body.endsWith('\n') ? body : `${body}\n`;
  const at = source.indexOf(needle);
  if (at < 0) throw new Error('launch-check.js was not in the personal USOTSUKI source');
  const start = at > 0 && source[at - 1] === '\n' ? at - 1 : at;
  return stripPersonalLaunchCheck(source.slice(0, start) + source.slice(at + needle.length));
}
