#!/usr/bin/env node
// Prints commands only. The leader runs the local server and gstack browse.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const [game, name = 'magic-circle-cast', out = '/tmp/pixelfx-web.png', port = '8765'] = process.argv.slice(2);
if (!game || !/^[a-zA-Z0-9_-]+$/.test(name) || !/^\d+$/.test(port) || +port < 1024 || +port > 65535) {
  console.error('Usage: node web-in-game.mjs <game> [name] [out.png] [port]'); process.exit(1);
}
const root = fs.realpathSync(game);
for (const rel of ['index.html', 'pixelfx-sheet.js', `assets/fx/${name}.png`, `assets/fx/${name}.json`]) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing ${rel}`);
}
const quote = s => "'" + s.replace(/'/g, "'\\''") + "'";
const overlay = path.join(path.dirname(fileURLToPath(import.meta.url)), 'web-overlay.js');
console.log(`# 터미널 1: 검사 후 Ctrl-C로 서버 종료\npython3 -m http.server ${port} --bind 127.0.0.1 --directory ${quote(root)}`);
console.log(`# 터미널 2: 기존 게임을 열고 오버레이 검사\n~/.local/bin/browse goto ${quote(`http://127.0.0.1:${port}/index.html?pixelfxCheck=${name}`)}\ncp ${quote(overlay)} /tmp/pixelfx-overlay.js\n~/.local/bin/browse eval /tmp/pixelfx-overlay.js\n~/.local/bin/browse js 'JSON.stringify(window.__pixelfxCheck)'\n~/.local/bin/browse screenshot ${quote(path.resolve(out))}`);
console.log('# pass:true, changes>1, nonempty:true 확인. 저장소 조작 명령은 없습니다.');
