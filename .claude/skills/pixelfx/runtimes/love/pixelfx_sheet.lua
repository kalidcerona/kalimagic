-- Standalone LOVE 11 sprite sheet player. Positions and pivots are in pixels.
local M, cache = {}, {}
local Instance = {}
Instance.__index = Instance
function M.load(name)
  assert(type(name) == "string" and name:match("^[%w_-]+$"), "Invalid asset name")
  if cache[name] then return cache[name] end
  local chunk, err = love.filesystem.load("assets/fx/" .. name .. ".lua")
  assert(chunk, err)
  local metadata = chunk()
  local m = metadata.meta.pixelfx
  assert(m.fps > 0 and m.frames > 0 and m.columns > 0, "Invalid sheet metadata")
  local image = love.graphics.newImage("assets/fx/" .. name .. ".png")
  image:setFilter("nearest", "nearest")
  local quads, w, h = {}, m.frameSize[1], m.frameSize[2]
  for i = 0, m.frames - 1 do
    quads[i + 1] = love.graphics.newQuad((i % m.columns) * w,
      math.floor(i / m.columns) * h, w, h, image:getDimensions())
  end
  cache[name] = {image = image, quads = quads, meta = m}
  return cache[name]
end
function M.new(name, x, y)
  return setmetatable({sheet = M.load(name), x = x or 0, y = y or 0,
    time = 0, frame = 1}, Instance)
end
function Instance:update(dt)
  assert(type(dt) == "number" and dt >= 0, "Invalid dt")
  self.time = self.time + dt
  local m = self.sheet.meta
  local index = math.floor(self.time * m.fps)
  self.frame = (m.loop and index % m.frames or math.min(index, m.frames - 1)) + 1
end
function Instance:done()
  local m = self.sheet.meta
  return not m.loop and self.time >= m.frames / m.fps
end
function Instance:draw(scale)
  if self:done() then return end
  local s, m = scale or 1, self.sheet.meta
  love.graphics.push("all")
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(self.sheet.image, self.sheet.quads[self.frame], self.x, self.y,
    0, s, s, m.pivot[1], m.pivot[2])
  love.graphics.pop()
end
return M
