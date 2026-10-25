import { mapSourceOntoCorners } from "./vision.js";
import { samplePointToView } from "./camera-geometry.js";
import { overlay, occlusionCanvas, occlusionContext } from "./dom.js";
import { setOcclusionSlot } from "./state.js";

// While detection is briefly lost the old quad is drawn whole. A hand mask computed
// on a stale quad would open holes in the wrong place and show the real card.
const HELD_OPAQUE = Object.freeze({ opaque: true });

function applyPaperStyle(color) {
  const style = overlay.style;
  if (!style || typeof style.setProperty !== "function") return;
  if (!color) {
    if (typeof style.removeProperty === "function") style.removeProperty("--card-paper");
    return;
  }
  style.setProperty("--card-paper", `rgb(${color.r}, ${color.g}, ${color.b})`);
}

function clearOverlayMask() {
  setOcclusionSlot({ quadKey: "", mask: null });
  overlay.style.maskImage = "none";
  overlay.style.webkitMaskImage = "none";
}

function quadKey(corners) {
  if (!corners) return "";
  return corners.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(";");
}

function showOverlay(displayCorners, mask, geometry) {
  const mapped = displayCorners.map((point) => samplePointToView(point, geometry));
  const h = mapSourceOntoCorners(240, 336, mapped);
  if (!h) {
    overlay.hidden = true;
    clearOverlayMask();
    return false;
  }
  overlay.style.transform = `matrix3d(${[
    h[0], h[3], 0, h[6],
    h[1], h[4], 0, h[7],
    0, 0, 1, 0,
    h[2], h[5], 0, h[8],
  ].join(",")})`;
  if (mask === HELD_OPAQUE) {
    clearOverlayMask();
    overlay.hidden = false;
    return true;
  }
  // A missing mask must not fall back to a solid card or a previous quad's bitmap.
  if (!mask || !occlusionContext) {
    overlay.hidden = true;
    clearOverlayMask();
    return false;
  }
  occlusionCanvas.width = mask.width;
  occlusionCanvas.height = mask.height;
  const image = occlusionContext.createImageData(mask.width, mask.height);
  image.data.set(mask.data);
  occlusionContext.putImageData(image, 0, 0);
  const url = `url("${occlusionCanvas.toDataURL("image/png")}")`;
  overlay.style.maskImage = url;
  overlay.style.webkitMaskImage = url;
  overlay.style.maskSize = overlay.style.webkitMaskSize = "100% 100%";
  overlay.style.maskRepeat = overlay.style.webkitMaskRepeat = "no-repeat";
  overlay.hidden = false;
  return true;
}

function hideOverlay() {
  overlay.hidden = true;
  clearOverlayMask();
}

function isPortrait(corners) {
  const top = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
  const side = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);
  return side > top * 1.05;
}

export { HELD_OPAQUE, applyPaperStyle, clearOverlayMask, quadKey, showOverlay, hideOverlay, isPortrait };
