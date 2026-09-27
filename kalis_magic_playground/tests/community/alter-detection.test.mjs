import test from "node:test";
import assert from "node:assert/strict";
import { detectCard } from "../../zz10/vision.js";

test("ALTER finds a printed card against an unevenly lit background", () => {
  const width = 240;
  const height = 320;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let shade = (x < 120 ? 25 : 175) +
        Math.round(8 * Math.sin(x / 13) + 7 * Math.cos(y / 19));
      if (x >= 65 && x < 175 && y >= 85 && y < 239) {
        shade = x > 76 && x < 164 && y > 97 && y < 227 && (x + y) % 53 < 20
          ? 35 : 230;
      }
      const offset = (y * width + x) * 4;
      data[offset] = shade;
      data[offset + 1] = shade;
      data[offset + 2] = shade;
      data[offset + 3] = 255;
    }
  }

  const result = detectCard({ data, width, height });
  assert.ok(result);
  const expected = [
    { x: 65, y: 85 }, { x: 175, y: 85 },
    { x: 175, y: 239 }, { x: 65, y: 239 },
  ];
  for (let i = 0; i < expected.length; i += 1) {
    assert.ok(Math.hypot(
      result.corners[i].x - expected[i].x,
      result.corners[i].y - expected[i].y,
    ) < 3);
  }
});
