#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(skill, 'vendor');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) throw new Error(`Unexpected symlink: ${p}`);
    return e.isDirectory() ? walk(p) : [p];
  });
}
try {
  const lines = fs.readFileSync(path.join(skill, 'vendor.sha256'), 'utf8').trim().split('\n');
  const expected = new Map(lines.map(line => {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match) throw new Error('Malformed checksum line');
    return [match[2], match[1]];
  }));
  if (expected.size !== lines.length) throw new Error('Duplicate checksum path');
  const files = walk(vendor);
  if (files.length !== expected.size) throw new Error('Vendor file count differs');
  for (const p of files) {
    const rel = path.relative(vendor, p).split(path.sep).join('/');
    if (crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') !== expected.get(rel)) throw new Error(`Checksum mismatch: ${rel}`);
  }
  for (const p of walk(skill)) if (/\.(woff2?|ttf|otf)$/i.test(p)) throw new Error(`Forbidden font: ${p}`);
  const forbidden = ['Patch', 'Pixel'].join('');
  for (const dir of ['runtimes', 'scripts']) for (const p of walk(path.join(skill, dir))) {
    if (fs.readFileSync(p, 'utf8').includes(forbidden)) throw new Error(`Forbidden font reference: ${p}`);
  }
  const records = path.join(skill, 'records');
  fs.mkdirSync(records, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(records, 'check-'));
  try {
    const r = spawnSync(process.execPath, ['tools/render.mjs', 'pickups/coin-spin', '--sheet', '--out', tmp], { cwd: vendor, encoding: 'utf8' });
    if (r.error || r.status !== 0) throw new Error(r.error?.message || r.stderr || 'Render failed');
    const base = path.join(tmp, 'pickups/coin-spin/coin-spin');
    const png = fs.readFileSync(base + '.png');
    if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Missing/invalid PNG');
    const meta = JSON.parse(fs.readFileSync(base + '.json', 'utf8')).meta.pixelfx;
    if (!(meta.frames > 1 && meta.fps > 0)) throw new Error('Missing/invalid sheet metadata');
    console.log(`PASS render: ${meta.frames} frames`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`PASS ${files.length} vendor checksums; no font files/references`);
} catch (e) { console.error(`FAIL: ${e.message}`); process.exitCode = 1; }
