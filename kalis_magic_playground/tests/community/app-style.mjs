import { readFileSync } from 'node:fs';

// An app stylesheet may be split into style.css plus style-<feature>.css pieces. The pieces are linked in order
// from index.html, so the concatenation in link order is the same text the single file used to hold.
// `dir` is a directory URL.
export function readAppStyle(dir) {
  const base = new URL(dir.href.endsWith('/') ? dir.href : `${dir.href}/`);
  const html = readFileSync(new URL('index.html', base), 'utf8');
  const pieces = [...html.matchAll(/<link rel="stylesheet" href="(?:\.\/)?(style(?:-[a-z0-9-]+)?\.css)"/g)].map((match) => match[1]);
  if (!pieces.length || pieces[0] !== 'style.css') throw new Error(`style.css link not found in ${base.pathname}index.html`);
  return pieces.map((piece) => readFileSync(new URL(piece, base), 'utf8')).join('');
}
