import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripPerformanceLog } from '../../scripts/friend-builds.mjs';

// Personal-only performance log (2026-11-07). Pinned friend snapshots do not ship it.
export const PERFORMANCE_LOG_FILES = ['performance-log.js'];
export { stripPerformanceLog };

// usotsukiAppSource joins raw module files with a newline. Drop performance-log.js and the
// extra join newline, then drop the hooks left in the other modules.
export function excisePerformanceLog(source, dir) {
  const body = readFileSync(path.join(dir, 'performance-log.js'), 'utf8');
  const needle = body.endsWith('\n') ? body : `${body}\n`;
  const at = source.indexOf(needle);
  if (at < 0) throw new Error('performance-log.js was not in the personal USOTSUKI source');
  const start = at > 0 && source[at - 1] === '\n' ? at - 1 : at;
  return stripPerformanceLog(source.slice(0, start) + source.slice(at + needle.length));
}
