import { TRUSTED_START_SESSION_KEY, legacyWorkerSpecByTool } from './legacy-shared-contract.mjs';

// Public update script for one old registration scope. It has no app shell,
// account data, or API payload. It must not widen scope or move open clients.
export function legacyBridgeSource(spec) {
  return `/* Public legacy scope bridge. No protected app or API data. */
const LEGACY_SCOPE_PATH = ${JSON.stringify(spec.legacyScopePath)};
const CANONICAL_PATH = ${JSON.stringify(spec.canonicalPath)};
const TRUSTED_TOOL = ${JSON.stringify(spec.tool)};
const TRUSTED_START_KEY = ${JSON.stringify(TRUSTED_START_SESSION_KEY)};

function scopePath() {
  try { return new URL(self.registration.scope).pathname; } catch (error) { return ''; }
}
function exactLegacyScope() {
  return scopePath() === LEGACY_SCOPE_PATH;
}
self.addEventListener('install', (event) => {
  if (!exactLegacyScope()) return;
  event.waitUntil(Promise.resolve(self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  // Leave every existing cache in place. Ownership of historical names is not
  // assumed here, and a narrow scope must not claim clients outside itself.
  if (!exactLegacyScope()) return;
  event.waitUntil(Promise.resolve(self.clients.claim()));
});
function bridgeDocument() {
  const script = 'try{sessionStorage.setItem(' + JSON.stringify(TRUSTED_START_KEY) + ',' + JSON.stringify(TRUSTED_TOOL) + ');}catch(e){}location.replace(' + JSON.stringify(CANONICAL_PATH) + ');';
  return '<!doctype html><meta charset="utf-8"><title>\\uacc4\\uc18d</title><script>' + script + '<\\/script>';
}
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!request || request.method !== 'GET' || request.mode !== 'navigate') return;
  if (!exactLegacyScope()) return;
  let url;
  let scope;
  try {
    url = new URL(request.url);
    scope = new URL(self.registration.scope);
  } catch (error) { return; }
  if (url.origin !== scope.origin || !url.pathname.startsWith(LEGACY_SCOPE_PATH)) return;
  // This answers a new navigation only. It does not move or refresh an open
  // performance client, and it does not attach the canonical scope.
  event.respondWith(new Response(bridgeDocument(), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, no-cache' }
  }));
});
`;
}

export function legacySharedWorkerResponse(tool) {
  const spec = legacyWorkerSpecByTool(tool);
  const headers = {
    'Cache-Control': 'no-store, no-cache',
    'X-Content-Type-Options': 'nosniff',
  };
  if (!spec) {
    headers['Content-Type'] = 'text/plain; charset=utf-8';
    return new Response('Not found', { status: 404, headers });
  }
  headers['Content-Type'] = 'application/javascript; charset=utf-8';
  return new Response(legacyBridgeSource(spec), { status: 200, headers });
}
