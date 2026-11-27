import { createHmac } from 'node:crypto';

// Exact bytes are signed. Never put credentials or applicant data into a URL.
export function signEnvelope(payload, secret, timestamp = Date.now()) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32 || !Number.isSafeInteger(timestamp)) throw new Error('service_unavailable');
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  const signature = createHmac('sha256', secret).update(`1\n${timestamp}\n${encoded}`).digest('hex');
  return { version: 1, timestamp, payload: encoded, signature };
}
export function validSheetsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'script.google.com' && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname);
  } catch { return false; }
}
function validRedirect(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'script.googleusercontent.com' && !url.port && !url.username && !url.password && !url.hash && url.pathname === '/macros/echo';
  } catch { return false; }
}
async function boundedJson(response) {
  if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '') || Number(response.headers.get('content-length')) > 16384) throw new Error('service_unavailable');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('service_unavailable');
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16384) { await reader.cancel(); throw new Error('service_unavailable'); }
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}
export function createSheetsStore(config, { fetcher = fetch, clock = Date.now, timeoutMs = 12000 } = {}) {
  return {
    async submit(payload) {
      if (!validSheetsUrl(config.sheetsUrl)) throw new Error('service_unavailable');
      const envelope = signEnvelope(payload, config.signingSecret, clock());
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response = await fetcher(config.sheetsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(envelope), redirect: 'manual', signal: controller.signal });
        if ([302,303].includes(response.status)) {
          const destination = response.headers.get('location');
          if (!validRedirect(destination)) throw new Error('service_unavailable');
          // ContentService redirects only its output. The signed POST must never be forwarded.
          await response.body?.cancel();
          response = await fetcher(destination, { method: 'GET', redirect: 'manual', signal: controller.signal });
        }
        return await boundedJson(response);
      } catch { throw new Error('service_unavailable'); }
      finally { clearTimeout(timeout); }
    }
  };
}
