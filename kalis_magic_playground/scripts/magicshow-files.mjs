// The entry document owns runtime membership and order; never maintain split-module lists here.
export const MAGICSHOW_EXTRAS = ['index.html', 'install-prompt.js', 'install-prompt.css', 'update-prompt.js', 'update-prompt.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png', 'og-image.png', 'sw.js', 'update.html'];
export function magicshowRuntimeFiles(html) {
  const files = [];
  for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(([, key, value]) => [key.toLowerCase(), value]));
    const file = /^<script\b/i.test(tag) ? attrs.src : (attrs.rel || '').split(/\s+/).includes('stylesheet') ? attrs.href : null;
    if (!file) continue;
    if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.(?:js|mjs|css)$/.test(file)) throw new Error(`Unsafe magicshow runtime reference: ${file}`);
    if (files.includes(file)) throw new Error(`Duplicate magicshow runtime reference: ${file}`);
    files.push(file);
  }
  if (!files.length) throw new Error('Missing magicshow runtime references');
  return files;
}
