import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISTRIBUTION_APPS, PUBLIC_DIRS } from '../../scripts/build-public.mjs';
import { cardAtIndex as personalCourtCard } from '../../zz5/logic.js';
import { cardAtIndex as sharedCourtCard } from '../../distribution-snapshots/aletheia/logic.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const distDir = path.join(root, 'dist');
const LOGO_LIMIT = 300 * 1024;
const RUNTIME = /\.(?:css|html|js|json|mjs|svg|webmanifest)$/i;
const PNG_COURT_OR_COIN = /(?:court-cards\/[^"'`\s<>]*\.png|coin-[^"'`\s<>]*\.png)\b/i;

const personalApps = PUBLIC_DIRS.filter((dir) => /^zz\d+$/.test(dir));
const sharedSources = [...new Set(DISTRIBUTION_APPS.map((app) => app.source))];
const appSources = [...personalApps, ...sharedSources];
const courtApps = [
  ['zz5', personalCourtCard],
  ['distribution-snapshots/aletheia', sharedCourtCard]
];
const coinApps = ['zz6', 'distribution-snapshots/tobira'];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function routesFor(source) {
  const shared = DISTRIBUTION_APPS
    .filter((app) => app.source === source)
    .map((app) => path.join('tools', app.target));
  return shared.length ? shared : [source];
}

async function walk(dir, visit) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, visit);
    else if (entry.isFile()) await visit(full);
  }
}

function shellEntries(source) {
  const entries = [];
  for (const match of source.matchAll(/\b(?:SHELL|PRECACHE|FILES|ASSETS)\s*=\s*\[([\s\S]*?)\]\s*;/g)) {
    if (match[1].includes('${')) throw new Error('dynamic precache entry');
    entries.push(...[...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]));
  }
  return entries;
}

function resolvePublished(route, entry, origin) {
  const clean = entry.split('#')[0].split('?')[0].trim();
  if (!clean || clean.includes('${') || /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(clean)) {
    throw new Error(`${origin} has an unresolvable entry ${entry}`);
  }
  let decoded;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    throw new Error(`${origin} has a malformed entry ${entry}`);
  }
  const target = decoded.startsWith('/')
    ? path.join(distDir, decoded.slice(1))
    : path.join(distDir, route, decoded);
  const relative = path.relative(distDir, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${origin} entry ${entry} leaves dist`);
  }
  return target;
}

function courtCardPaths(source) {
  const count = Number(source.match(/const COURT_CARD_COUNT = (\d+)/)?.[1]);
  const suitBlock = source.match(/const SUIT_CODE = Object\.freeze\(\{([\s\S]*?)\}\)/);
  const extension = source.match(/court-cards\/\$\{slotLabel\(card\)\}(\.[A-Za-z0-9]+)/)?.[1];
  if (!Number.isInteger(count) || count < 1 || !suitBlock || !extension) {
    throw new Error('court-card list could not be read');
  }
  const suits = {};
  for (const match of suitBlock[1].matchAll(/([A-Za-z]+)\s*:\s*['"]([^'"]+)['"]/g)) suits[match[1]] = match[2];
  return { count, extension, suits };
}

function coinAndCardPaths(source) {
  const block = source.match(/const DEFAULT_COIN_IMAGES = Object\.freeze\(\{([\s\S]*?)\}\)/);
  if (!block) throw new Error('DEFAULT_COIN_IMAGES missing');
  return [...block[1].matchAll(/['"](\.[^'"]+)['"]/g)].map((match) => match[1]);
}

async function buildPlan() {
  const required = [];
  const logos = [];
  for (const source of appSources) {
    const worker = await readFile(path.join(root, source, 'sw.js'), 'utf8');
    const entries = shellEntries(worker);
    if (!entries.length) throw new Error(`${source}/sw.js has no SHELL or precache list`);
    for (const route of routesFor(source)) {
      for (const entry of entries) required.push(resolvePublished(route, entry, `${source}/sw.js`));
    }
  }
  for (const [source, cardAtIndex] of courtApps) {
    const sourceText = await readFile(path.join(root, source, 'app.js'), 'utf8');
    const { count, extension, suits } = courtCardPaths(sourceText);
    const paths = [];
    for (let index = 0; index < count; index += 1) {
      const card = cardAtIndex(index);
      if (!card || !suits[card.suit] || !card.rank) throw new Error(`${source} court card ${index} is not labeled`);
      paths.push(`./court-cards/${suits[card.suit]}-${card.rank}${extension}`);
    }
    if (paths.length !== 12 || new Set(paths).size !== paths.length) {
      throw new Error(`${source} court-card list is ${paths.join(', ')}`);
    }
    for (const route of routesFor(source)) {
      for (const entry of paths) required.push(resolvePublished(route, entry, `${source}/app.js`));
    }
  }
  for (const source of coinApps) {
    const sourceText = await readFile(path.join(root, source, 'app.js'), 'utf8');
    const paths = coinAndCardPaths(sourceText);
    if (!paths.some((entry) => entry.includes('/coin-')) || !paths.some((entry) => entry.includes('/card-'))) {
      throw new Error(`${source} coin and card image list is ${paths.join(', ')}`);
    }
    for (const route of routesFor(source)) {
      for (const entry of paths) required.push(resolvePublished(route, entry, `${source}/app.js`));
    }
  }
  for (const source of appSources) {
    const sourceRoot = path.join(root, source);
    await walk(sourceRoot, async (full) => {
      if (path.basename(full) !== 'brand-logo.png') return;
      const relative = path.relative(sourceRoot, full);
      for (const route of routesFor(source)) logos.push(path.join(distDir, route, relative));
    });
  }
  assert.ok(logos.length >= 10, `expected published brand logos, found ${logos.length}`);
  return { required, logos };
}

async function assertNoPngCourtOrCoinReferences() {
  const hits = [];
  for (const source of appSources) {
    await walk(path.join(root, source), async (full) => {
      if (!RUNTIME.test(full)) return;
      const text = await readFile(full, 'utf8');
      const matches = [...text.matchAll(new RegExp(PNG_COURT_OR_COIN.source, 'gi'))].map((match) => match[0]);
      if (matches.length) hits.push(`${path.relative(root, full)} -> ${[...new Set(matches)].join(', ')}`);
    });
  }
  assert.equal(hits.length, 0, `png court card or coin still referenced:\n${hits.join('\n')}`);
}

async function verifyPublished(plan) {
  const missing = [];
  const checkedLogos = new Set();
  async function fileInfo(target) {
    try {
      const info = await stat(target);
      if (!info.isFile()) missing.push(`${path.relative(distDir, target)} is not a file`);
      return info;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      missing.push(path.relative(distDir, target));
      return null;
    }
  }
  for (const target of plan.required) await fileInfo(target);
  for (const target of plan.logos) {
    checkedLogos.add(target);
    const info = await fileInfo(target);
    if (info) assert.ok(info.size <= LOGO_LIMIT, `${path.relative(distDir, target)} is ${info.size} bytes`);
  }
  await walk(distDir, async (full) => {
    if (path.basename(full) !== 'brand-logo.png' || checkedLogos.has(full)) return;
    const info = await stat(full);
    assert.ok(info.size <= LOGO_LIMIT, `${path.relative(distDir, full)} is ${info.size} bytes`);
  });
  if (missing.length) {
    const error = new Error(`missing dist files:\n${missing.slice(0, 12).join('\n')}`);
    error.code = 'ENOENT';
    throw error;
  }
}

test('precache, court cards, coins, and brand logos stay within the image-weight checks', async () => {
  await assertNoPngCourtOrCoinReferences();
  const plan = await buildPlan();
  // Parallel build tests delete dist and publish it again, so a missing file is retried.
  let last;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await verifyPublished(plan);
      return;
    } catch (error) {
      last = error;
      if (error.code !== 'ENOENT' || attempt === 39) throw error;
      await delay(250);
    }
  }
  throw last;
});
