/**
 * Card-shaped geometry prototype for a live mobile camera.
 *
 * This module detects one convex card quadrilateral from an RGBA frame,
 * optionally using a stored empty-scene reference. It does not recognize a
 * printed identity, suit, rank, or "card A",
 * and it does not recover which physical edge is the top of the artwork.
 * Corner order is image-space only: clockwise, starting at the vertex with the
 * smallest x+y (top-left-most), then the smallest x, then the smallest y.
 *
 * Cost model for a W×H frame:
 *   s = max(1, ceil(max(W, H) / MAX_GRID_SIDE))
 *   Luminance samples, threshold, and connected components run on a grid of
 *   about (W/s) by (H/s), capped near MAX_GRID_SIDE² (≈ 192²) operations.
 *   The convex hull is built from that grid's boundary (O(B log B), B is the
 *   perimeter in grid cells). The minimum-area rectangle is O(H²) on the hull,
 *   which for a card is a short convex chain, not the full camera image.
 *   Full-resolution work is limited to Sobel probes along four sides
 *   (4 sides × ~16 samples × a ±(s+2) pixel normal search). No full-frame
 *   grayscale buffer is allocated. The final bright-paper fallback sorts at
 *   most one grid of foreground luminance values (O(N log N), N <= 192²).
 *
 * Limitations:
 *   - Single-frame detection estimates the scene from its border. The stored
 *     empty-scene path supports varied backgrounds. Both paths can separate a
 *     border-touching grip, including a short-edge end grip, from the card.
 *     Strongly warm paper or a grip that covers more than one side can still fail.
 *     A card cut off by the frame is rejected. One covered short edge is not.
 *   - The fitted shape is a rotated rectangle. Strong perspective keystone is
 *     only a limitation of detection; mapSourceOntoCorners still accepts a
 *     general convex destination quad.
 *   - Objects thinner than a few sample steps, heavy clutter, soft shadows,
 *     and low contrast return null. Downsampling limits coarse localization to
 *     about one sample step; refinement recovers a sharp edge only when it lies
 *     within the normal search radius.
 *   - Alpha is ignored. Results are deterministic and contain no tracking.
 */

export { isDegenerateQuad, orderCorners, quadArea, signedPolygonArea } from "./vision-geometry.js";
export { captureBackground, sceneChangeFraction } from "./vision-sampling.js";
export { detectCard, detectCardAgainstBackground } from "./vision-detect.js";
export { applyHomography, computeHomography, mapSourceOntoCorners } from "./vision-homography.js";
export { cardOcclusionMask, heldCardEvidence, heldCardPresent } from "./vision-paper.js";
