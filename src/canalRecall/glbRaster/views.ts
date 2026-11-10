/**
 * One view vocabulary for GLB first passes (lane H12, docs/house-line.md §8), the JSON landmark-views.mjs takes:
 * `{name, light?, w?, hgt?, kind, ...}`, resolved here to a render.ts RenderView (eye, target, vertical fov, size,
 * optional ortho extents) that the Node rasteriser and the browser page both draw. Pure maths; frame x east, y up,
 * z south (the sheet page's world; a recipe model's anchorRD offsets, render.ts rdToRecipeLocal).
 *
 *   orbit   {theta, phi, zoom?}: the landmark gallery camera (manual-landmarks.html): vertical fov 32, fitted to the
 *           bounding sphere of the box, theta about +y from +z (south), phi from +y. The gallery card is
 *           {theta: 0.55, phi: 1.02}.
 *   street  {x, z, h, fov, eye?, pitch?}: a camera at x/z metres, `eye` m up (2.5), heading `h` degrees from north,
 *           horizontal fov `fov` degrees, pitch degrees up.
 *   front   {a: [x, z], b: [x, z], ppm?, v0?, v1?, pad?}: the orthographic elevation of the wall a -> b at `ppm` px/m
 *           (50), seen from outside with a on the left, heights v0..v1 above y = 0 (0 .. box top). The axis of
 *           scripts/pand-reference/rectify.ts rectifyWall (u from a, rows from the top, the same 50 px/m), so the
 *           rectified photo and the render overlay pixel for pixel. Outward normal = right x up.
 *   threeq  {a, b, heightM?}: render.ts frontViews' three-quarter view of the same wall (38 degrees off the normal).
 */

export type Box = { min: [number, number, number]; max: [number, number, number] };
export type ViewSpec =
  | { kind: 'orbit'; theta: number; phi: number; zoom?: number }
  | { kind: 'street'; x: number; z: number; h: number; fov: number; eye?: number; pitch?: number }
  | { kind: 'front'; a: [number, number]; b: [number, number]; ppm?: number; v0?: number; v1?: number; pad?: number }
  | { kind: 'threeq'; a: [number, number]; b: [number, number]; heightM?: number };
export type NamedView = ViewSpec & { name: string; light?: 'game' | 'gallery'; w?: number; hgt?: number };
export type ResolvedView = { eye: number[]; target: number[]; fov: number; width: number; height: number; ortho?: [number, number, number, number]; near?: number; far?: number; noGround?: boolean };

const DEG = Math.PI / 180;

/** Outward normal (x, z) of the wall a -> b seen with a on the left: right x up. */
export function wallNormal(a: readonly number[], b: readonly number[]): [number, number] {
  const rx = b[0] - a[0], rz = b[1] - a[1], l = Math.hypot(rx, rz) || 1;
  // right = (rx, 0, rz), up = (0, 1, 0): right x up = (0*0 - rz*1, rz*0 - rx*0, rx*1 - 0*0) = (-rz, 0, rx)
  return [-rz / l, rx / l];
}

/** Order a wall's ends so that `outward` (x, z) is its normal: a on the left of a viewer outside. */
export function orientWall(a: [number, number], b: [number, number], outward: readonly number[]): { a: [number, number]; b: [number, number] } {
  const n = wallNormal(a, b);
  return n[0] * outward[0] + n[1] * outward[1] >= 0 ? { a, b } : { a: b, b: a };
}

/** Resolve a view against the scene's bounding box at `size` px (orbit/street) or the view's own scale (front). */
export function resolveView(v: ViewSpec, box: Box, size: { width: number; height: number } = { width: 1200, height: 800 }): ResolvedView {
  const W = size.width, H = size.height;
  if (v.kind === 'orbit') {
    const c = box.min.map((m, i) => (m + box.max[i]) / 2), d0 = Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]);
    const hv = 16 * DEG, half = Math.min(hv, Math.atan(Math.tan(hv) * W / H));
    const d = d0 * 0.5 / Math.sin(half) * 1.05 / (v.zoom ?? 1);
    return { eye: [c[0] + d * Math.sin(v.phi) * Math.sin(v.theta), c[1] + d * Math.cos(v.phi), c[2] + d * Math.sin(v.phi) * Math.cos(v.theta)], target: c, fov: 32, width: W, height: H, near: d / 1000, far: 20000 };
  }
  if (v.kind === 'street') {
    const vfov = 2 * Math.atan(Math.tan(v.fov * DEG / 2) * H / W) / DEG, hd = v.h * DEG, p = (v.pitch ?? 0) * DEG, y = v.eye ?? 2.5;
    return { eye: [v.x, y, v.z], target: [v.x + Math.sin(hd) * Math.cos(p), y + Math.sin(p), v.z - Math.cos(hd) * Math.cos(p)], fov: vfov, width: W, height: H, near: 0.3, far: 3000 };
  }
  if (v.kind === 'front') {
    const ppm = v.ppm ?? 50, pad = v.pad ?? 0, len = Math.hypot(v.b[0] - v.a[0], v.b[1] - v.a[1]);
    const v0 = v.v0 ?? 0, v1 = v.v1 ?? box.max[1], [nx, nz] = wallNormal(v.a, v.b);
    const mid = [(v.a[0] + v.b[0]) / 2, (v0 + v1) / 2, (v.a[1] + v.b[1]) / 2], dist = 500;
    const halfW = len / 2 + pad, halfH = (v1 - v0) / 2;
    return {
      eye: [mid[0] + nx * dist, mid[1], mid[2] + nz * dist], target: mid, fov: 30,
      width: Math.max(1, Math.round(2 * halfW * ppm)), height: Math.max(1, Math.round(2 * halfH * ppm)),
      ortho: [-halfW, halfW, halfH, -halfH], near: 0.1, far: 2000, noGround: true,
    };
  }
  // threeq: render.ts frontViews().threeQuarter
  const len = Math.hypot(v.b[0] - v.a[0], v.b[1] - v.a[1]), heightM = v.heightM ?? box.max[1];
  const [nx, nz] = wallNormal(v.a, v.b), mid = [(v.a[0] + v.b[0]) / 2, heightM / 2, (v.a[1] + v.b[1]) / 2];
  const size2 = Math.max(len * H / W, heightM) * 1.25, fov = 30, dist = size2 / 2 / Math.tan(fov * Math.PI / 360);
  const yaw = 38 * DEG, rx = nx * Math.cos(yaw) - nz * Math.sin(yaw), rz = nx * Math.sin(yaw) + nz * Math.cos(yaw);
  return { eye: [mid[0] + rx * dist * 1.05, heightM * 0.9, mid[2] + rz * dist * 1.05], target: [mid[0], heightM * 0.45, mid[2]], fov, width: W, height: H };
}

/**
 * The fixed sheet: the gallery card, then front, top and back. With a wall, `front` is its elevation and `back` the
 * orbit from behind it; without one, both are orbits from the box's south (+z) and north.
 */
export function gallerySheetViews(wall?: { a: [number, number]; b: [number, number] } | null, ppm = 30): NamedView[] {
  const theta = wall ? (() => { const [nx, nz] = wallNormal(wall.a, wall.b); return Math.atan2(nx, nz); })() : 0;
  return [
    { name: 'gallery-card', light: 'gallery', kind: 'orbit', theta: 0.55, phi: 1.02, w: 600, hgt: 400 },
    wall ? { name: 'front', kind: 'front', a: wall.a, b: wall.b, ppm, pad: 1 } : { name: 'front', kind: 'orbit', theta, phi: 1.45, w: 600, hgt: 400 },
    { name: 'top', kind: 'orbit', theta, phi: 0.02, w: 600, hgt: 400 },
    { name: 'back', kind: 'orbit', theta: theta + Math.PI, phi: 1.2, w: 600, hgt: 400 },
  ];
}

/** Bounding box of positions (flat xyz). */
export function boxOf(positions: ArrayLike<number>[]): Box {
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const P of positions) for (let i = 0; i + 2 < P.length; i += 3) for (let k = 0; k < 3; k++) { if (P[i + k] < min[k]) min[k] = P[i + k]; if (P[i + k] > max[k]) max[k] = P[i + k]; }
  return { min, max };
}
