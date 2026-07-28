import {
  signGateCookie,
  verifyGateCookie
} from '../functions/_lib/tool-gate.mjs';

const COOKIE_NAME = 'kali_tool_gate';
const COOKIE_MAX_AGE = 7_776_000;
const RENEWAL_WINDOW_SECONDS = 3_888_000;
const DEFAULT_TOOL = 'calc';

function analyzePath(rawPathname) {
  if (typeof rawPathname !== 'string') {
    return { mode: 'block', pathname: '' };
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPathname);
  } catch {
    return { mode: 'block', pathname: '' };
  }

  const lowerPath = decodedPath.toLowerCase();
  if (lowerPath.split('/').some((segment) => segment === '.' || segment === '..')) {
    return { mode: 'block', pathname: lowerPath };
  }

  const pathname = lowerPath.replace(/\/{2,}/g, '/');
  const isToolsPath = pathname === '/tools' || pathname.startsWith('/tools/');
  if (!isToolsPath) {
    return { mode: 'block', pathname };
  }

  const isLoginPath =
    pathname === '/tools/login' || pathname.startsWith('/tools/login/');
  const isPublicAsset =
    pathname.endsWith('/manifest.webmanifest') ||
    pathname.endsWith('/icon-192.png') ||
    pathname.endsWith('/icon-512.png');
  if (isLoginPath || isPublicAsset) {
    return { mode: 'public', pathname };
  }

  if (pathname === '/tools/stopwatch' || pathname.startsWith('/tools/stopwatch/')) {
    return { mode: 'gated', tool: 'stopwatch', pathname };
  }

  return { mode: 'gated', tool: DEFAULT_TOOL, pathname };
}

export function classifyPath(rawPathname) {
  const { mode, tool } = analyzePath(rawPathname);
  return tool ? { mode, tool } : { mode };
}

function rawPathnameFromUrl(rawUrl) {
  const authorityStart = rawUrl.indexOf('://');
  const pathnameStart = rawUrl.indexOf('/', authorityStart === -1 ? 0 : authorityStart + 3);
  if (pathnameStart === -1) return '/';

  const queryStart = rawUrl.indexOf('?', pathnameStart);
  const fragmentStart = rawUrl.indexOf('#', pathnameStart);
  const ends = [queryStart, fragmentStart].filter((index) => index !== -1);
  const pathnameEnd = ends.length > 0 ? Math.min(...ends) : rawUrl.length;
  return rawUrl.slice(pathnameStart, pathnameEnd);
}

function cookieValue(request, name) {
  const cookieHeader = request.headers.get('cookie') || '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

function gateSecret() {
  return (
    globalThis.Netlify?.env?.get?.('TOOL_GATE_SECRET') ||
    globalThis.Deno?.env?.get?.('TOOL_GATE_SECRET') ||
    ''
  );
}

function safeReturnPath(pathname, search, fallback) {
  if (
    pathname.startsWith('/tools/calc/') ||
    pathname.startsWith('/tools/stopwatch/')
  ) {
    return `${pathname}${search}`;
  }
  return fallback;
}

function loginRedirect(request, tool, pathname) {
  const requestUrl = new URL(request.url);
  const fallback = `/tools/${tool}/`;
  const redirectUrl = new URL('/tools/login/', requestUrl.origin);
  redirectUrl.searchParams.set(
    'to',
    safeReturnPath(pathname, requestUrl.search, fallback)
  );
  return Response.redirect(redirectUrl, 302);
}

export function shouldRenewGateCookie(gate, nowMs = Date.now()) {
  if (gate?.kind !== 'life' || !Number.isSafeInteger(gate.exp)) return false;

  const now = Math.floor(nowMs / 1000);
  const remainingSeconds = gate.exp - now;
  return remainingSeconds > 0 && remainingSeconds < RENEWAL_WINDOW_SECONDS;
}

function gateCookieHeader(value) {
  return [
    `${COOKIE_NAME}=${value}`,
    'Path=/tools',
    `Max-Age=${COOKIE_MAX_AGE}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax'
  ].join('; ');
}

function withGateCookie(response, value) {
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', gateCookieHeader(value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default async function toolsGate(request, context) {
  const path = analyzePath(rawPathnameFromUrl(request.url));
  if (path.mode === 'public') return context.next();

  const tool = path.tool || DEFAULT_TOOL;
  if (path.mode === 'block') {
    return loginRedirect(request, tool, '');
  }

  const secret = gateSecret();
  if (!secret) return loginRedirect(request, tool, path.pathname);

  const nowMs = Date.now();
  const gate = await verifyGateCookie(
    cookieValue(request, COOKIE_NAME),
    secret,
    nowMs
  );
  if (gate.valid && (gate.tool === tool || gate.tool === 'all')) {
    const response = await context.next();
    if (!shouldRenewGateCookie(gate, nowMs)) return response;

    const value = await signGateCookie(
      gate.email,
      gate.tool,
      secret,
      nowMs,
      gate.kind
    );
    return withGateCookie(response, value);
  }

  return loginRedirect(request, tool, path.pathname);
}
