/**
 * Where the chase vehicle lands on screen, and where the START tag goes so it
 * never covers it.
 *
 * The START tag is screen-sized and sat a fixed `(roadWidth + 20) × zoom`
 * above the start point. Zoomed out that offset shrinks to a few pixels while
 * the boat, grown by `boatZoomScale`, does not, so the tag's pill was drawn
 * over the hull (user follow-up 2026-10-22). The vehicle now reports the
 * screen box of its mesh every frame (player-vehicles `screenBox`), and the
 * tag moves above that box when they would overlap.
 *
 * Pure: matrices are column-major 4×4 arrays (three.js `elements`).
 */

export type Mat4 = ArrayLike<number>;
export type Vec3 = readonly [number, number, number];
export type ScreenBox = { left: number; top: number; right: number; bottom: number };

/** a × b, column-major. */
export function multiplyMat4(a: Mat4, b: Mat4): number[] {
  const out = new Array<number>(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    out[c * 4 + r] = s;
  }
  return out;
}

/**
 * The CSS-pixel box of a local axis-aligned box (`min`/`max`, scaled by
 * `scale` about the origin) under `clipFromLocal`, in a `width × height`
 * viewport. Null when any corner is behind the camera.
 */
export function projectLocalBox(clipFromLocal: Mat4, min: Vec3, max: Vec3, scale: number, width: number, height: number): ScreenBox | null {
  if (!(width > 0) || !(height > 0)) return null;
  const m = clipFromLocal;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (let i = 0; i < 8; i++) {
    const x = (i & 1 ? max[0] : min[0]) * scale, y = (i & 2 ? max[1] : min[1]) * scale, z = (i & 4 ? max[2] : min[2]) * scale;
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (!(cw > 1e-9)) return null;
    const sx = (cx / cw + 1) / 2 * width, sy = (1 - cy / cw) / 2 * height;
    left = Math.min(left, sx); right = Math.max(right, sx);
    top = Math.min(top, sy); bottom = Math.max(bottom, sy);
  }
  return Number.isFinite(left + top + right + bottom) ? { left, top, right, bottom } : null;
}

/** The square box of a flat glyph of `radius` px centred on `x, y` (the canvas fallback vehicle). */
export function glyphBox(x: number, y: number, radius: number): ScreenBox {
  return { left: x - radius, top: y - radius, right: x + radius, bottom: y + radius };
}

export function boxesIntersect(a: ScreenBox, b: ScreenBox): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Clear space between the tag and the vehicle, CSS px. */
export const START_TAG_GAP_PX = 4;

/**
 * The START pill's centre y: its usual spot, unless that box would cover the
 * vehicle, then just above the vehicle's top edge.
 */
export function startTagCentreY(centreX: number, defaultCentreY: number, pill: { width: number; height: number }, avoid: ScreenBox | null | undefined, gap = START_TAG_GAP_PX): number {
  if (!avoid) return defaultCentreY;
  const box = { left: centreX - pill.width / 2, right: centreX + pill.width / 2, top: defaultCentreY - pill.height / 2 - gap, bottom: defaultCentreY + pill.height / 2 + gap };
  if (!boxesIntersect(box, avoid)) return defaultCentreY;
  return Math.min(defaultCentreY, avoid.top - gap - pill.height / 2);
}
