import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createSign, generateKeyPairSync } from 'node:crypto';
import { clearJwksCache, requireAdmin, requireViewer } from '../../netlify/functions/_lib/auth.mjs';

const SECRET = 'test-supabase-jwt-secret';
const URL = 'https://example.supabase.co';
const SUB = '11111111-1111-4111-8111-111111111111';

function b64(value) {
  const raw = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return raw.toString('base64url');
}

function signHs256(payload, secret = SECRET, header = { alg: 'HS256', typ: 'JWT' }) {
  const encodedHeader = b64(JSON.stringify(header));
  const encodedPayload = b64(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest();
  return `${encodedHeader}.${encodedPayload}.${b64(signature)}`;
}

function claims(extra = {}) {
  return {
    sub: SUB,
    aud: 'authenticated',
    iss: `${URL}/auth/v1`,
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'admin@example.com',
    ...extra
  };
}

function authEvent(token) {
  return { headers: { authorization: `Bearer ${token}` } };
}

function authClient(role = 'admin') {
  const calls = [];
  let lookedUp = null;
  return {
    calls,
    auth: {
      getUser(token) {
        calls.push(['getUser', token]);
        return Promise.resolve({
          data: { user: { id: 'from-get-user', email: 'member@example.com' } },
          error: null
        });
      }
    },
    from() {
      calls.push(['profiles']);
      const query = {
        select() { return query; },
        eq(_column, value) {
          lookedUp = value;
          calls.push(['eq', value]);
          return query;
        },
        maybeSingle() {
          return Promise.resolve({
            data: { user_id: lookedUp, nickname: '별명', role },
            error: null
          });
        },
        upsert() { return query; }
      };
      return query;
    }
  };
}

async function withAuthEnv(values, fn) {
  const previous = {
    secret: process.env.SUPABASE_JWT_SECRET,
    url: process.env.SUPABASE_URL,
    fetch: globalThis.fetch
  };
  clearJwksCache();
  if (values.secret === undefined) delete process.env.SUPABASE_JWT_SECRET;
  else process.env.SUPABASE_JWT_SECRET = values.secret;
  if (values.url === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = values.url;
  if (values.fetch) globalThis.fetch = values.fetch;
  try {
    await fn();
  } finally {
    if (previous.secret === undefined) delete process.env.SUPABASE_JWT_SECRET;
    else process.env.SUPABASE_JWT_SECRET = previous.secret;
    if (previous.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous.url;
    globalThis.fetch = previous.fetch;
    clearJwksCache();
  }
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
jwk.kid = 'cache-key';
jwk.alg = 'RS256';
jwk.use = 'sig';

function signRs256(payload, kid = jwk.kid) {
  const encodedHeader = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
  const encodedPayload = b64(JSON.stringify(payload));
  const signer = createSign('RSA-SHA256');
  signer.update(`${encodedHeader}.${encodedPayload}`);
  signer.end();
  return `${encodedHeader}.${encodedPayload}.${signer.sign(privateKey).toString('base64url')}`;
}

describe('local admin jwt verification', { concurrency: 1 }, () => {
  test('a valid HS256 token is accepted without auth.getUser and still loads the profile role', async () => {
    const token = signHs256(claims());
    const admin = authClient('admin');
    const member = authClient('member');
    const kali = authClient('kali');
    await withAuthEnv({ secret: SECRET, url: URL }, async () => {
      const viewer = await requireViewer(authEvent(token), admin);
      assert.equal(viewer.userId, SUB);
      assert.equal(viewer.email, 'admin@example.com');
      assert.equal(viewer.role, 'admin');
      assert.equal(admin.calls.some((call) => call[0] === 'getUser'), false);
      assert.deepEqual(admin.calls.filter((call) => call[0] === 'eq'), [['eq', SUB]]);

      assert.equal((await requireAdmin(authEvent(token), kali)).role, 'kali');
      assert.equal(kali.calls.some((call) => call[0] === 'getUser'), false);
      await assert.rejects(() => requireAdmin(authEvent(token), member), /admin_required/);
      assert.equal(member.calls.some((call) => call[0] === 'getUser'), false);
      assert.equal(member.calls.some((call) => call[0] === 'profiles'), true);
    });
  });

  test('expired, bad-signature, unsupported-alg and alg=none tokens are never accepted', async () => {
    const header = b64(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const payload = b64(JSON.stringify(claims()));
    const tokens = [
      signHs256(claims({ exp: Math.floor(Date.now() / 1000) - 60 })),
      signHs256(claims(), 'other-secret'),
      signHs256(claims({ iss: 'https://evil.example/auth/v1' }), 'other-secret'),
      signHs256(claims(), SECRET, { alg: 'HS384', typ: 'JWT' }),
      `${header}.${payload}.`
    ];
    await withAuthEnv({ secret: SECRET, url: URL }, async () => {
      for (const token of tokens) {
        const supabase = authClient('admin');
        await assert.rejects(() => requireViewer(authEvent(token), supabase), /auth_invalid/);
        assert.equal(supabase.calls.some((call) => call[0] === 'getUser'), false);
        assert.equal(supabase.calls.some((call) => call[0] === 'profiles'), false);
      }
    });
  });

  test('an iss or aud mismatch falls back to auth.getUser', async () => {
    const mismatched = [
      claims({ iss: 'https://auth.custom.example/auth/v1' }),
      claims({ iss: `${URL}/auth/v1/` }),
      claims({ iss: 'example.supabase.co/auth/v1' }),
      claims({ aud: 'anon' })
    ];
    await withAuthEnv({ secret: SECRET, url: URL }, async () => {
      for (const payload of mismatched) {
        const token = signHs256(payload);
        const supabase = authClient('member');
        const viewer = await requireViewer(authEvent(token), supabase);
        assert.equal(viewer.userId, 'from-get-user');
        assert.equal(viewer.role, 'member');
        assert.deepEqual(supabase.calls.filter((call) => call[0] === 'getUser'), [['getUser', token]]);
      }
    });

    await withAuthEnv({ secret: SECRET, url: `${URL}/` }, async () => {
      const supabase = authClient('admin');
      const viewer = await requireViewer(authEvent(signHs256(claims())), supabase);
      assert.equal(viewer.userId, SUB);
      assert.equal(supabase.calls.some((call) => call[0] === 'getUser'), false);
    });
  });

  test('nbf in the future is rejected and a past nbf still verifies locally', async () => {
    const future = signHs256(claims({ nbf: Math.floor(Date.now() / 1000) + 3600 }));
    const past = signHs256(claims({ nbf: Math.floor(Date.now() / 1000) - 60 }));
    await withAuthEnv({ secret: SECRET, url: URL }, async () => {
      const rejected = authClient('admin');
      await assert.rejects(() => requireViewer(authEvent(future), rejected), /auth_invalid/);
      assert.equal(rejected.calls.some((call) => call[0] === 'getUser'), false);
      assert.equal(rejected.calls.some((call) => call[0] === 'profiles'), false);

      const accepted = authClient('admin');
      assert.equal((await requireViewer(authEvent(past), accepted)).userId, SUB);
      assert.equal(accepted.calls.some((call) => call[0] === 'getUser'), false);
    });
  });

  test('with no secret and no JWKS, verification falls back to auth.getUser', async () => {
    await withAuthEnv({}, async () => {
      const opaque = authClient('member');
      const viewer = await requireViewer(authEvent('member-token'), opaque);
      assert.equal(viewer.userId, 'from-get-user');
      assert.equal(viewer.role, 'member');
      assert.equal(opaque.calls.filter((call) => call[0] === 'getUser').length, 1);
    });

    let jwksFetches = 0;
    await withAuthEnv({
      url: URL,
      fetch: async () => {
        jwksFetches += 1;
        throw new Error('jwks unavailable');
      }
    }, async () => {
      const supabase = authClient('member');
      const viewer = await requireViewer(authEvent(signRs256(claims())), supabase);
      assert.equal(jwksFetches, 1);
      assert.equal(viewer.userId, 'from-get-user');
      assert.equal(supabase.calls.filter((call) => call[0] === 'getUser').length, 1);
    });
  });

  test('the JWKS cache is reused across verifications', async () => {
    let jwksFetches = 0;
    await withAuthEnv({
      url: URL,
      fetch: async (input) => {
        jwksFetches += 1;
        assert.equal(String(input), `${URL}/auth/v1/.well-known/jwks.json`);
        return new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
    }, async () => {
      const first = authClient('admin');
      const second = authClient('admin');
      const token = signRs256(claims());
      assert.equal((await requireViewer(authEvent(token), first)).userId, SUB);
      assert.equal((await requireViewer(authEvent(token), second)).userId, SUB);
      assert.equal(jwksFetches, 1);
      assert.equal(first.calls.some((call) => call[0] === 'getUser'), false);
      assert.equal(second.calls.some((call) => call[0] === 'getUser'), false);
    });
  });

  test('a JWKS timeout is negatively cached and the next request goes straight to getUser', async () => {
    let jwksFetches = 0;
    await withAuthEnv({
      url: URL,
      fetch: (input, init) => {
        jwksFetches += 1;
        assert.equal(String(input), `${URL}/auth/v1/.well-known/jwks.json`);
        assert.ok(init && init.signal);
        return new Promise((resolve, reject) => {
          const fail = setTimeout(() => reject(new Error('jwks timeout was not aborted')), 8000);
          init.signal.addEventListener('abort', () => {
            clearTimeout(fail);
            reject(new DOMException('The operation was aborted', 'AbortError'));
          }, { once: true });
        });
      }
    }, async () => {
      const first = authClient('member');
      const started = Date.now();
      const viewer = await requireViewer(authEvent(signRs256(claims())), first);
      const elapsed = Date.now() - started;
      assert.ok(elapsed >= 2500 && elapsed < 7000, `timeout was ${elapsed}ms`);
      assert.equal(viewer.userId, 'from-get-user');
      assert.equal(first.calls.filter((call) => call[0] === 'getUser').length, 1);
      assert.equal(jwksFetches, 1);

      const second = authClient('member');
      const againStarted = Date.now();
      const again = await requireViewer(authEvent(signRs256(claims())), second);
      assert.ok(Date.now() - againStarted < 1000);
      assert.equal(again.userId, 'from-get-user');
      assert.equal(second.calls.filter((call) => call[0] === 'getUser').length, 1);
      assert.equal(jwksFetches, 1);
    });
  });
});
