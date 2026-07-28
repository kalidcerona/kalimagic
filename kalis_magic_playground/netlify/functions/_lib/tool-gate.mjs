const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const GATE_LIFETIME_SECONDS = 7_776_000;
const VALID_TOOLS = new Set(['stopwatch', 'calc', 'all']);
const VALID_KINDS = new Set(['std', 'life']);

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

function base64UrlToBytes(value) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value) || value.length % 4 === 1) {
    throw new Error('invalid_base64url');
  }

  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey(secret, usages) {
  return globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages
  );
}

export async function signGateCookie(
  email,
  tool,
  secret,
  nowMs = Date.now(),
  kind = 'std'
) {
  if (!secret) throw new Error('gate_secret_required');

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || normalizedEmail.includes('|')) {
    throw new Error('invalid_gate_email');
  }
  if (!VALID_TOOLS.has(tool)) throw new Error('invalid_gate_tool');
  if (!VALID_KINDS.has(kind)) throw new Error('invalid_gate_kind');

  const exp = Math.floor(nowMs / 1000) + GATE_LIFETIME_SECONDS;
  const payload = `${normalizedEmail}|${tool}|${exp}|${kind}`;
  const key = await hmacKey(secret, ['sign']);
  const signature = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  return `${bytesToBase64Url(encoder.encode(payload))}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyGateCookie(cookieValue, secret, nowMs = Date.now()) {
  if (!secret) return { valid: false, reason: 'secret_missing' };
  if (typeof cookieValue !== 'string') return { valid: false, reason: 'malformed' };

  const parts = cookieValue.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };

  try {
    const payloadBytes = base64UrlToBytes(parts[0]);
    const signatureBytes = base64UrlToBytes(parts[1]);
    if (signatureBytes.length !== 32) return { valid: false, reason: 'bad_signature' };

    const payload = decoder.decode(payloadBytes);
    const fields = payload.split('|');
    if (fields.length !== 3 && fields.length !== 4) {
      return { valid: false, reason: 'malformed' };
    }

    const [email, tool, expValue, rawKind] = fields;
    const kind = rawKind || 'std';
    const exp = Number(expValue);
    if (
      !email ||
      email !== email.trim().toLowerCase() ||
      !VALID_TOOLS.has(tool) ||
      !VALID_KINDS.has(kind) ||
      !/^\d+$/u.test(expValue) ||
      !Number.isSafeInteger(exp)
    ) {
      return { valid: false, reason: 'malformed' };
    }

    const key = await hmacKey(secret, ['verify']);
    const signatureValid = await globalThis.crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      payloadBytes
    );
    if (!signatureValid) return { valid: false, reason: 'bad_signature' };
    if (Math.floor(nowMs / 1000) >= exp) return { valid: false, reason: 'expired' };

    return { valid: true, email, tool, exp, kind };
  } catch {
    return { valid: false, reason: 'malformed' };
  }
}
