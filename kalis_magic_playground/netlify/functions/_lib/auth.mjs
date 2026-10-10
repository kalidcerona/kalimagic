import { createHmac, createPublicKey, timingSafeEqual, verify as verifySignature } from 'node:crypto';
import { getSupabaseAdmin } from './supabase.mjs';

const JWKS_TTL_MS = 10 * 60 * 1000;
const JWKS_NEGATIVE_TTL_MS = 60 * 1000;
const JWKS_TIMEOUT_MS = 3000;
let jwksCache = null;

export function clearJwksCache() {
  jwksCache = null;
}

export function bearerToken(event) {
  const value = event.headers.authorization || event.headers.Authorization || '';
  return value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
}

export function defaultProfileNickname(email, random = Math.random) {
  const localPart = String(email || '').split('@')[0].trim();
  const nickname = Array.from(localPart).slice(0, 24).join('');
  if (nickname.length >= 2) return nickname;

  const value = Number(random());
  const number = Number.isFinite(value) ? Math.floor(value < 1 ? value * 100 : value) : 0;
  const suffix = String(Math.abs(number) % 100).padStart(2, '0');
  return `마술인${suffix}`;
}

async function createProfileForUser(supabase, user) {
  const { data: created, error } = await supabase
    .from('profiles')
    .upsert({
      user_id: user.id,
      nickname: defaultProfileNickname(user.email),
      role: 'member',
      nickname_set: false
    }, {
      onConflict: 'user_id',
      ignoreDuplicates: true
    })
    .select('user_id,nickname,role')
    .maybeSingle();
  if (error) throw error;
  if (created) return created;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id,nickname,role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  return profile;
}

function audienceAllowed(aud) {
  if (aud === 'authenticated') return true;
  return Array.isArray(aud) && aud.includes('authenticated');
}

function issuerAllowed(iss) {
  if (typeof iss !== 'string' || !iss) return false;
  const base = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  if (!base) return false;
  return iss === `${base}/auth/v1`;
}

// 'fallback': iss/aud disagree with this project, so auth.getUser decides.
// 'reject': the token itself is not acceptable. null: claims are trusted.
function claimDecision(claims, now = Date.now()) {
  if (!claims || typeof claims !== 'object') return 'reject';
  if (typeof claims.sub !== 'string' || !claims.sub) return 'reject';
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) return 'reject';
  if (claims.exp * 1000 <= now) return 'reject';
  if (claims.nbf != null) {
    if (typeof claims.nbf !== 'number' || !Number.isFinite(claims.nbf) || claims.nbf * 1000 > now) return 'reject';
  }
  if (!audienceAllowed(claims.aud)) return 'fallback';
  if (claims.iss != null && !issuerAllowed(claims.iss)) return 'fallback';
  return null;
}

function userFromClaims(claims) {
  const user = { id: claims.sub };
  if (typeof claims.email === 'string') user.email = claims.email;
  return user;
}

function decodeJwtJson(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

function userFromDecision(claims) {
  const decision = claimDecision(claims);
  if (decision === 'fallback') return undefined;
  if (decision) return null;
  return userFromClaims(claims);
}

function userFromHs256(parts, secret) {
  let claims;
  try {
    claims = decodeJwtJson(parts[1]);
  } catch {
    return null;
  }
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const actual = Buffer.from(parts[2], 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return userFromDecision(claims);
}

// undefined: fall back to auth.getUser. null: signature or claims failed closed.
function userFromAsymmetric(parts, alg, jwk) {
  let claims;
  try {
    claims = decodeJwtJson(parts[1]);
  } catch {
    return null;
  }
  let ok = false;
  try {
    const key = createPublicKey({ key: jwk, format: 'jwk' });
    const data = Buffer.from(`${parts[0]}.${parts[1]}`);
    const signature = Buffer.from(parts[2], 'base64url');
    if (alg === 'RS256') ok = verifySignature('RSA-SHA256', data, key, signature);
    else ok = verifySignature('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, signature);
  } catch {
    return undefined;
  }
  if (!ok) return null;
  return userFromDecision(claims);
}

function cacheJwksFailure(url, now) {
  jwksCache = { url, keys: null, expiresAt: now + JWKS_NEGATIVE_TTL_MS };
  return null;
}

async function loadJwks() {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  if (!base) return null;
  const url = `${base}/auth/v1/.well-known/jwks.json`;
  const now = Date.now();
  if (jwksCache && jwksCache.url === url && jwksCache.expiresAt > now) return jwksCache.keys;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JWKS_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch {
    return cacheJwksFailure(url, now);
  } finally {
    clearTimeout(timer);
  }
  if (!response?.ok) return cacheJwksFailure(url, now);
  let body;
  try {
    body = await response.json();
  } catch {
    return cacheJwksFailure(url, now);
  }
  if (!body || !Array.isArray(body.keys)) return cacheJwksFailure(url, now);
  jwksCache = { url, keys: body.keys, expiresAt: now + JWKS_TTL_MS };
  return jwksCache.keys;
}

// Returns a user, null to fall back to auth.getUser, or throws auth_invalid.
async function verifiedUserFromToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2 || parts.length > 3) return null;
  let header;
  try {
    header = decodeJwtJson(parts[0]);
  } catch {
    return null;
  }
  if (!header || typeof header.alg !== 'string') return null;
  if (header.alg.toLowerCase() === 'none') throw new Error('auth_invalid');
  if (parts.length !== 3) return null;
  const asymmetric = header.alg === 'RS256' || header.alg === 'ES256';
  if (header.alg !== 'HS256' && !asymmetric) throw new Error('auth_invalid');

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (secret) {
    if (header.alg === 'HS256') {
      const user = userFromHs256(parts, secret);
      if (user === undefined) return null;
      if (!user) throw new Error('auth_invalid');
      return user;
    }
    return null;
  }

  if (typeof header.kid === 'string' && header.kid && asymmetric) {
    const keys = await loadJwks();
    if (!keys) return null;
    const jwk = keys.find((key) => key && key.kid === header.kid);
    if (!jwk) return null;
    const user = userFromAsymmetric(parts, header.alg, jwk);
    if (user === undefined) return null;
    if (!user) throw new Error('auth_invalid');
    return user;
  }
  return null;
}

async function resolveAuthUser(supabase, token) {
  const verified = await verifiedUserFromToken(token);
  if (verified) return verified;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('auth_invalid');
  return data.user;
}

export async function requireViewer(event, supabase) {
  const token = bearerToken(event);
  if (!token) throw new Error('auth_required');
  const client = supabase || getSupabaseAdmin();
  const user = await resolveAuthUser(client, token);
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('user_id,nickname,role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  const viewerProfile = profile || await createProfileForUser(client, user);
  return {
    userId: user.id,
    email: user.email,
    nickname: viewerProfile?.nickname || defaultProfileNickname(user.email),
    role: viewerProfile?.role || 'member'
  };
}

export async function requireAdmin(event, supabase) {
  const viewer = await requireViewer(event, supabase);
  if (!['admin', 'kali'].includes(viewer.role)) throw new Error('admin_required');
  return viewer;
}
