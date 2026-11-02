#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { allIds } from '../vendor/tools/lib/fxlib.mjs';
const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(skill, 'vendor');
const run = (tool, args) => {
  const r = spawnSync(process.execPath, [path.join(vendor, 'tools', tool), ...args], { cwd: vendor, stdio: 'inherit' });
  if (r.error || r.status !== 0) throw new Error(`${tool} failed: ${r.error?.message || r.status}`);
};
// Refuse symlink components, including dangling links, before creating directories.
function target(root, rel) {
  const dest = path.resolve(root, rel);
  if (!dest.startsWith(root + path.sep)) throw new Error('Destination escapes game');
  let cur = root;
  for (const part of path.relative(root, dest).split(path.sep)) {
    cur = path.join(cur, part);
    try { if (fs.lstatSync(cur).isSymbolicLink()) throw new Error(`Symlink refused: ${cur}`); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return dest;
}
function lua(v) {
  if (v === null) return 'nil';
  if (typeof v === 'string') return '"' + v.replace(/[\\"\x00-\x1f\x7f]/g, c => '\\' + c.charCodeAt(0).toString().padStart(3, '0')) + '"';
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v)) return '{' + v.map(lua).join(',') + '}';
  return '{' + Object.entries(v).map(([k, val]) => `[${lua(k)}]=${lua(val)}`).join(',') + '}';
}
async function menu() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('No TTY: use <effect-id> --engine love|web --game <dir>');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  async function pick(label, choices) {
    console.log(label); choices.forEach((c, i) => console.log(`${i + 1}. ${c}`));
    const n = Number(await rl.question('Number: '));
    if (!Number.isInteger(n) || n < 1 || n > choices.length) throw new Error('Invalid selection');
    return n - 1;
  }
  try {
    const home = process.env.HOME || '';
    const games = [`${home}/Desktop/AI/Projects/cookey-remake`, `${home}/Desktop/AI/AiGo/magic-show-game/v3-next`];
    const g = await pick('Game', [...games, 'Custom path']);
    const game = g < 2 ? games[g] : await rl.question('Game directory: ');
    const engine = g < 2 ? ['love', 'web'][g] : ['love', 'web'][await pick('Engine', ['love', 'web'])];
    const ids = allIds(), cats = [...new Set(ids.map(id => id.split('/')[0]))];
    const cat = cats[await pick('Category', cats)];
    const effects = ids.filter(id => id.startsWith(cat + '/'));
    return [effects[await pick('Effect (exports immediately)', effects)], '--engine', engine, '--game', game];
  } finally { rl.close(); }
}
async function main() {
  let args = process.argv.slice(2);
  if (!args.length) args = await menu();
  if (args[0] === '--list') { run('list.mjs', args.slice(1)); return; }
  const id = args.shift(), flags = {};
  if (!allIds().includes(id)) throw new Error(`Unknown effect id: ${id}`);
  while (args.length) {
    const flag = args.shift();
    if (!['--engine', '--game', '--opts', '--name'].includes(flag) || !args.length || flag in flags) throw new Error(`Invalid option: ${flag}`);
    flags[flag] = args.shift();
  }
  const engine = flags['--engine'];
  if (!['love', 'web'].includes(engine) || !flags['--game']) throw new Error('Required: --engine love|web --game <existing directory>');
  const game = fs.realpathSync(flags['--game']);
  if (!fs.statSync(game).isDirectory()) throw new Error('Game must be a directory');
  const name = flags['--name'] ?? id.split('/')[1];
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(name)) throw new Error('Unsafe asset name: use 1-80 letters, digits, underscores or hyphens');
  if (flags['--opts']) {
    const opts = JSON.parse(flags['--opts']);
    if (!opts || typeof opts !== 'object' || Array.isArray(opts)) throw new Error('--opts must be a JSON object');
  }
  const records = path.join(skill, 'records');
  fs.mkdirSync(records, { recursive: true });
  const temp = fs.mkdtempSync(path.join(records, 'export-'));
  try {
    run('render.mjs', [id, '--sheet', '--out', temp, ...(flags['--opts'] ? ['--opts', flags['--opts']] : [])]);
    const stem = path.join(temp, id, id.split('/')[1]);
    for (const ext of ['png', 'json']) if (!fs.existsSync(`${stem}.${ext}`)) throw new Error(`Missing output: ${stem}.${ext}`);
    const meta = JSON.parse(fs.readFileSync(stem + '.json', 'utf8'));
    meta.meta.image = name + '.png';
    const outputs = [[`assets/fx/${name}.png`, fs.readFileSync(stem + '.png')], [`assets/fx/${name}.json`, Buffer.from(JSON.stringify(meta) + '\n')]];
    if (engine === 'love') outputs.push([`assets/fx/${name}.lua`, Buffer.from('return ' + lua(meta) + '\n')]);
    const runtime = engine === 'love' ? 'src/core/pixelfx_sheet.lua' : 'pixelfx-sheet.js';
    const source = engine === 'love' ? 'love/pixelfx_sheet.lua' : 'web/pixelfx-sheet.js';
    if (!fs.existsSync(target(game, runtime))) outputs.push([runtime, fs.readFileSync(path.join(skill, 'runtimes', source))]);
    outputs.push(['THIRD_PARTY_NOTICES.md', fs.readFileSync(path.join(skill, 'NOTICE.md'))]);
    const pending = [];
    for (const [rel, data] of outputs) {
      const dest = target(game, rel);
      if (fs.existsSync(dest)) {
        const old = fs.readFileSync(dest);
        if (old.equals(data) || (rel === 'THIRD_PARTY_NOTICES.md' && old.toString().includes(data.toString()))) continue;
        throw new Error(`Existing file differs; refusing overwrite: ${dest}`);
      }
      pending.push([dest, data]);
    }
    for (const [dest, data] of pending) {
      target(game, path.relative(game, dest));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, data, { flag: 'wx' });
      console.log(`Created ${dest}`);
    }
    console.log(`PASS exported ${id} (${engine})`);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
main().catch(e => { console.error(`pixelfx: ${e.message}`); process.exitCode = 1; });
