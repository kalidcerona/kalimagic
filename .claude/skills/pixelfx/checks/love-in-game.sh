#!/bin/bash
set -euo pipefail
if [ "$#" -ne 3 ]; then echo 'Usage: love-in-game.sh <game> <name> <out.png>' >&2; exit 1; fi
game=$(cd "$1" && pwd -P)
name=$2
case "$name" in ''|*[!a-zA-Z0-9_-]*) echo 'Invalid asset name' >&2; exit 1;; esac
out=$3
case "$out" in /*) ;; *) out="$PWD/$out";; esac
[ ! -e "$out" ] && [ ! -L "$out" ] || { echo 'Output already exists' >&2; exit 1; }
love_bin=/Applications/love.app/Contents/MacOS/love
[ -x "$love_bin" ] || { echo "Missing LOVE: $love_bin" >&2; exit 1; }
work=$(mktemp -d "${TMPDIR:-/tmp}/pixelfx-check.XXXXXX")
trap 'rm -rf "$work"' EXIT
ln -s "$game/src" "$work/src"
ln -s "$game/assets" "$work/assets"
cp "$game/main.lua" "$work/game_main.lua"
cp "$game/conf.lua" "$work/game_conf.lua"
printf 'return "%s"\n' "$name" > "$work/effect_name.lua"
cat > "$work/conf.lua" <<'LUA'
require("game_conf")
local game_conf = love.conf
function love.conf(t)
  if game_conf then game_conf(t) end
  t.identity = "pixelfx-check"
  t.console = true
end
LUA
cat > "$work/main.lua" <<'LUA'
require("game_main")
local boot = love.load
function love.load(args)
  assert(love.filesystem.getIdentity() == "pixelfx-check", "Unsafe save identity")
  boot(args)
  local update, draw = love.update, love.draw
  local fx = require("src.core.pixelfx_sheet").new(require("effect_name"), 640, 360)
  local elapsed, calls, changes, previous, captured = 0, 0, 0, fx.frame, false
  love.update = function(dt)
    if update then update(dt) end
    fx:update(dt)
    elapsed, calls = elapsed + dt, calls + 1
    if fx.frame ~= previous then changes = changes + 1; previous = fx.frame end
    if elapsed > 10 and not captured then
      print("FAIL screenshot timeout"); io.stdout:flush(); love.event.quit(1)
    end
  end
  love.draw = function()
    if draw then draw() end
    fx:draw(3)
    if elapsed >= 3 and not captured then
      captured = true
      love.graphics.captureScreenshot(function(data)
        data:encode("png", "pixelfx-result.png")
        local pass = changes > 1
        print((pass and "PASS" or "FAIL") .. " updates=" .. calls .. " frame_changes=" .. changes)
        print("PIXELFX_SCREENSHOT=" .. love.filesystem.getSaveDirectory() .. "/pixelfx-result.png")
        io.stdout:flush()
        love.event.quit(pass and 0 or 1)
      end)
    end
  end
end
LUA
"$love_bin" "$work" > "$work/run.log" 2>&1 &
love_pid=$!
# Bound startup failures too, including LOVE's graphical error screen.
( sleep 30; kill "$love_pid" 2>/dev/null || true ) &
watchdog=$!
set +e
wait "$love_pid"
status=$?
set -e
kill "$watchdog" 2>/dev/null || true
cat "$work/run.log"
[ "$status" -eq 0 ] || exit "$status"
shot=$(sed -n 's/^PIXELFX_SCREENSHOT=//p' "$work/run.log" | tail -n 1)
[ -n "$shot" ] && [ -f "$shot" ] || { echo 'FAIL missing screenshot' >&2; exit 1; }
# Exclusive creation prevents overwriting another session's output.
(set -o noclobber; cat "$shot" > "$out")
echo "PASS screenshot=$out"
