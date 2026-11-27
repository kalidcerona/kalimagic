import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ZZ_RETIREMENT_SPECS, retirementWorkerSource } from '../../scripts/zz-retirement.mjs';
import { classifyPath } from '../../netlify/edge-functions/tools-gate.mjs';
const origin = 'https://retirement.invalid';
const config = JSON.parse(execFileSync('python3', ['-c', 'import tomllib,json,sys;print(json.dumps(tomllib.load(open(sys.argv[1],"rb"))))', new URL('../../netlify.toml', import.meta.url).pathname], { encoding: 'utf8' }));
const matches = (pattern, pathname) => pattern.endsWith('/*') ? pathname.startsWith(pattern.slice(0, -1)) : pattern === pathname;
function response(path) {
  const url = new URL(path, origin);
  const rule = config.redirects.find(item => matches(item.from, url.pathname));
  const headers = {};
  for (const entry of config.headers) if (matches(entry.for, url.pathname)) Object.assign(headers, entry.values);
  if (rule?.status === 301) headers.Location = new URL(rule.to + url.search, origin).href;
  return new Response(null, { status: rule?.status || 404, headers });
}
for (const spec of ZZ_RETIREMENT_SPECS) {
  test(`${spec.id} exact old HTTP contract`, async () => {
    for (const suffix of ['', '/', '/index.html']) {
      const result = response('/' + spec.id + suffix + '?from=old');
      assert.equal(result.status, spec.destination ? 301 : 404);
      if (spec.destination) {
        assert.equal(result.headers.get('location'), origin + spec.destination + '?from=old');
        assert.equal(classifyPath(spec.destination).mode, 'gated');
      }
    }
    const sw = response('/' + spec.id + '/sw.js');
    assert.equal(sw.status, 200);
    assert.match(sw.headers.get('content-type'), /application\/javascript/);
    assert.equal(sw.headers.get('cache-control'), 'no-store');
    for (const suffix of ['/manifest.webmanifest', '/app.js', '/photo.png', '/unknown.html', '/sw.js/extra']) {
      assert.equal(response('/' + spec.id + suffix).status, 404);
    }
    assert.equal(classifyPath('/' + spec.id + '/').mode, 'block');
  });
  test(`${spec.id} retirement preserves unrelated caches and never moves clients`, async () => {
    const scope = origin + '/' + spec.id + '/';
    const name = spec.prefix + (spec.scopeEncoding === 'none' ? '' : (spec.scopeEncoding === 'raw' ? scope : encodeURIComponent(scope)) + '-') + spec.version;
    async function run(entries, wrongScope = false) {
      const listeners = {}, deleted = [];
      let unregister = 0, skipped = 0;
      const self = { location: new URL(scope + 'sw.js'), registration: { scope: wrongScope ? origin + '/tools/' : scope, unregister: async () => { unregister++; } }, skipWaiting: async () => { skipped++; }, addEventListener: (name, fn) => { listeners[name] = fn; } };
      vm.runInNewContext(retirementWorkerSource(spec), { self, URL, caches: { keys: async () => [name, name + '-distribution', name + '-unknown'], open: async () => ({ keys: async () => entries.map(url => ({ url })) }), delete: async key => deleted.push(key) } });
      let promise;
      if (wrongScope) assert.throws(() => listeners.install({ waitUntil: p => { promise = p; } }), /Unexpected/);
      else { listeners.install({ waitUntil: p => { promise = p; } }); await promise; }
      listeners.activate({ waitUntil: p => { promise = p; } });
      await promise;
      assert.equal(listeners.fetch, undefined);
      return { deleted, unregister, skipped };
    }
    assert.deepEqual(await run([scope + 'index.html', scope + 'app.js']), { deleted: [name], unregister: 1, skipped: 1 });
    for (const entries of [[], [scope + 'index.html', origin + '/tools/kairos/app.js'], ['https://other.invalid/' + spec.id + '/app.js']]) {
      assert.deepEqual((await run(entries)).deleted, []);
    }
    assert.deepEqual(await run([scope + 'index.html'], true), { deleted: [], unregister: 0, skipped: 0 });
  });
}
test('recorders and missing zz9', async () => {
  for (const recorder of ['a', 'd']) assert.equal(response(`/zz7/recorder-${recorder}.html`).headers.get('location'), `${origin}/tools/usotsuki/recorder-${recorder}.html`);
  for (const path of ['/zz9', '/zz9/', '/zz9/sw.js']) assert.equal(response(path).status, 404);

});
test('deployment rules keep precise worker rewrites ahead of disposal and remove camera grants', () => {
  const toml = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');
  for (const spec of ZZ_RETIREMENT_SPECS) {
    const root = '/' + spec.id;
    assert.ok(toml.indexOf(`from = "${root}/sw.js"`) < toml.indexOf(`from = "${root}/*"`));
    assert.ok(toml.includes(`to = "/legacy-bridges/${spec.id}/sw.js"\n  status = 200`));
    assert.ok(toml.includes(`for = "${root}/sw.js"`));
    assert.ok(!toml.includes(`for = "${root}/manifest.webmanifest"`));
    assert.ok(!toml.includes(`for = "${root}/*"`));
  }
});
