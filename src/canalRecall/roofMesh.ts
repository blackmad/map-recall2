// Roofs and gables for the three.js building layer.
//
// MapLibre extrusions are prisms, so every building ends in a flat lid. This
// module decides, per building, whether it gets a real roof and builds it:
//   gable   – ridge along the long axis, a shaped gable (step, neck, bell, spout
//             or plain) standing on each short end: the Amsterdam canal house
//   pitched – the same slopes with plain triangular ends: a terrace or a block
//   mansard – steep lower slope, shallow top, dormers on the steep faces
// The plan (`planRoof`) is pure and deterministic from the building id and its
// footprint, so it can run in the tile decorator (to lower the plain wall to the
// eaves) and again in the mesh builder (to build the geometry) and agree.
// Buildings whose footprint is not close to a rectangle keep the flat lid.

export type RoofKind = 'gable' | 'pitched' | 'mansard';
export type GableShape = 'step' | 'neck' | 'bell' | 'spout' | 'plain';

export type RoofPlan = {
  kind: RoofKind;
  gable: GableShape;
  /** Roof rise above the eaves, metres (for a gable plate, the roof's own rise; the plate stands higher). */
  riseM: number;
  dormers: boolean;
  material: 'tile' | 'slate';
  /** 0..1, picks the roof colour from the look's palette. */
  tone: number;
  /** Per-building seed for small extras (chimney placement). */
  seed: string;
  /** Set false for churches and other roofs that should not grow a chimney. */
  chimney?: boolean;
};

export type Rect = { cx: number; cy: number; ux: number; uy: number; len: number; wid: number; coverage: number; /** Farthest any footprint vertex sits from the rectangle's border, metres. */ maxDev: number };
type Vec3 = [number, number, number];
type Vec2 = [number, number];

export type RoofPart = 'slope' | 'plate' | 'dormerFace' | 'dormerSide';
export type RoofTri = { p: [Vec3, Vec3, Vec3]; uv: [Vec2, Vec2, Vec2]; part: RoofPart; n: Vec3 };

export function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Smallest-area oriented rectangle over the footprint's own edge directions. */
export function fitRect(points: readonly Vec2[], maxVertices = 14): Rect | null {
  const pts = points.length > 1 && points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1] ? points.slice(0, -1) : points;
  if (pts.length < 4 || pts.length > maxVertices) return null;
  let area2 = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area2 += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  const polyArea = Math.abs(area2) / 2;
  let best: { area: number; ux: number; uy: number; minU: number; maxU: number; minV: number; maxV: number } | null = null;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
    if (l < 0.5) continue;
    const ux = dx / l, uy = dy / l;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of pts) {
      const u = x * ux + y * uy, v = -x * uy + y * ux;
      if (u < minU) minU = u; if (u > maxU) maxU = u; if (v < minV) minV = v; if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) best = { area, ux, uy, minU, maxU, minV, maxV };
  }
  if (!best || best.area <= 0) return null;
  let { ux, uy, minU, maxU, minV, maxV } = best;
  let len = maxU - minU, wid = maxV - minV;
  let cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
  if (wid > len) { // make u the long axis
    [ux, uy] = [-uy, ux];
    [len, wid] = [wid, len];
    [cu, cv] = [cv, -cu];
  }
  // How far each vertex is from the nearest side of the box: a slanted or notched footprint
  // would leave a roof (and its gable plates) hanging off the walls.
  const U = [ux, uy], V = [-uy, ux];
  let maxDev = 0;
  for (const [x, y] of pts) {
    const du = x * U[0] + y * U[1] - cu, dv = x * V[0] + y * V[1] - cv;
    maxDev = Math.max(maxDev, Math.min(len / 2 - Math.abs(du), wid / 2 - Math.abs(dv)) < 0 ? 0 : Math.min(len / 2 - Math.abs(du), wid / 2 - Math.abs(dv)));
  }
  return { cx: cu * ux - cv * uy, cy: cu * uy + cv * ux, ux, uy, len, wid, coverage: polyArea / (len * wid), maxDev };
}

const pick = <T>(r: number, weights: Array<[T, number]>): T => {
  let acc = 0; const total = weights.reduce((s, [, w]) => s + w, 0);
  for (const [item, w] of weights) { acc += w / total; if (r < acc) return item; }
  return weights[weights.length - 1][0];
};

/**
 * The roof for one building, or null to keep the flat lid. `style` is the
 * building's facade style (canal, c19, school, postwar...), which sets the odds.
 */
export function planRoof(id: string, style: string, heightM: number, minHeightM: number, rect: Rect | null): RoofPlan | null {
  if (!rect || minHeightM > 0.5 || heightM < 6.5 || rect.wid < 3.6 || rect.len < 4.5 || rect.coverage < 0.88 || rect.maxDev > 1.0) return null;
  if (style === 'modern' || style === 'tower') return null;
  const r = hash01(`${id}:roof`), narrow = rect.wid <= 8.5 && rect.len >= 1.25 * rect.wid;
  let kind: RoofKind | 'flat';
  if (style === 'school') kind = pick(r, [['pitched', 0.55], ['mansard', 0.1], ['flat', 0.35]]);
  else if (style === 'postwar') kind = heightM <= 14 ? pick(r, [['pitched', 0.25], ['flat', 0.75]]) : 'flat';
  else kind = narrow ? pick(r, [['gable', 0.45], ['pitched', 0.2], ['mansard', 0.2], ['flat', 0.15]]) : pick(r, [['pitched', 0.4], ['mansard', 0.3], ['flat', 0.3]]);
  if (kind === 'flat') return null;
  if (kind === 'mansard' && rect.wid < 5.2) kind = 'pitched';
  const riseM = kind === 'mansard' ? 2.6 : Math.max(1.6, Math.min(4.6, rect.wid * 0.36));
  if (heightM - riseM < 4.5) return null;
  const gable = pick(hash01(`${id}:gable`), [['step', 0.3], ['neck', 0.22], ['bell', 0.22], ['spout', 0.12], ['plain', 0.14]] as Array<[GableShape, number]>);
  return {
    kind, gable, riseM,
    dormers: kind === 'mansard' || (kind === 'pitched' && !narrow && hash01(`${id}:dorm`) < 0.45) || (kind === 'gable' && hash01(`${id}:dorm`) < 0.2),
    material: kind === 'mansard' ? 'slate' : hash01(`${id}:mat`) < 0.62 ? 'tile' : 'slate',
    tone: hash01(`${id}:tone2`),
    seed: id,
  };
}

/** Height of a gable plate above the eaves at fraction `t` (0 centre, 1 edge) of half-width. */
export function gableProfile(shape: GableShape, widthM: number, roofRiseM: number): Vec2[] {
  const half = widthM / 2, pts: Vec2[] = [];
  const slope = (x: number) => roofRiseM * (1 - Math.abs(x) / half);
  const add = (x: number, y: number) => pts.push([x, Math.max(y, slope(x) + 0.04)]);
  const N = 24;
  if (shape === 'plain') { add(-half, 0); add(0, roofRiseM); add(half, 0); pts[0][1] = 0; pts[2][1] = 0; return pts; }
  if (shape === 'step') {
    // Stairs up to a flat crown: `steps` treads each side, risers vertical.
    const top = roofRiseM * 1.18 + 0.55, steps = 3, w = half / (steps + 0.6);
    const left: Vec2[] = [[-half, 0]];
    let prev = 0;
    for (let j = 0; j <= steps; j++) {
      const x0 = -half + j * w, x1 = j === steps ? 0 : -half + (j + 1) * w;
      const h = Math.max((top * (j + 1)) / (steps + 1), slope(x1) + 0.12);
      if (h > prev) { left.push([x0, h]); prev = h; } else left.push([x0, prev]);
      left.push([x1, prev]);
    }
    const right = left.slice(0, -1).reverse().map(([x, y]) => [-x, y] as Vec2);
    return dedupe([...left, ...right].map(([x, y], i, all) => [x, i === 0 || i === all.length - 1 ? 0 : y] as Vec2));
  }
  if (shape === 'neck') {
    const top = roofRiseM * 1.45 + 0.7, neck = half * 0.42, shoulder = roofRiseM * 0.62;
    add(-half, 0);
    for (let i = 1; i <= 8; i++) { const t = i / 8, x = -half + (half - neck) * t; add(x, 0.15 + (shoulder - 0.15) * Math.pow(t, 1.7)); }
    add(-neck, top); add(neck, top);
    for (let i = 8; i >= 1; i--) { const t = i / 8, x = half - (half - neck) * t; add(x, 0.15 + (shoulder - 0.15) * Math.pow(t, 1.7)); }
    add(half, 0);
    pts[0][1] = 0; pts[pts.length - 1][1] = 0;
    return dedupe(pts);
  }
  const bell = shape === 'bell', top = roofRiseM * (bell ? 1.3 : 1.55) + (bell ? 0.6 : 0.9);
  for (let i = 0; i <= N; i++) {
    const x = -half + (widthM * i) / N, t = Math.abs(x) / half;
    let f: number;
    if (bell) f = t < 0.18 ? 1 : 0.12 + 0.88 * (0.5 + 0.5 * Math.cos(Math.PI * Math.pow((t - 0.18) / 0.82, 0.85)));
    else { const tt = t < 0.26 ? 0 : (t - 0.26) / 0.74; f = t < 0.26 ? 1 : 0.1 + 0.9 * (1 - Math.pow(tt, 0.6)) * (1 - 0.0 * tt); }
    add(x, top * f);
  }
  pts[0][1] = 0; pts[pts.length - 1][1] = 0;
  return dedupe(pts);
}
const dedupe = (pts: Vec2[]): Vec2[] => pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export type RoofDims = { bayM: number; storeyM: number; cellM: number };

/** Roof geometry for one building, in the same metre frame as the rect. `h0` is the eaves height. */
export function roofTriangles(rect: Rect, plan: RoofPlan, h0: number, dims: RoofDims): RoofTri[] {
  const out: RoofTri[] = [];
  const { cx, cy, ux, uy, len: L, wid: W } = rect;
  const world = (u: number, v: number, z: number): Vec3 => [cx + u * ux - v * uy, cy + u * uy + v * ux, h0 + z];
  const dir = (u: number, v: number, z: number): Vec3 => [u * ux - v * uy, u * uy + v * ux, z];
  const tri = (a: Vec3, b: Vec3, c: Vec3, ua: Vec2, ub: Vec2, uc: Vec2, part: RoofPart, hint: Vec3) => {
    let n = cross(sub(b, a), sub(c, a));
    let B = b, C = c, UB = ub, UC = uc;
    if (dot(n, hint) < 0) { B = c; C = b; UB = uc; UC = ub; n = [-n[0], -n[1], -n[2]]; }
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    out.push({ p: [a, B, C], uv: [ua, UB, UC], part, n: [n[0] / l, n[1] / l, n[2] / l] });
  };
  const quad = (a: Vec3, b: Vec3, c: Vec3, d: Vec3, ua: Vec2, ub: Vec2, uc: Vec2, ud: Vec2, part: RoofPart, hint: Vec3) => {
    tri(a, b, c, ua, ub, uc, part, hint); tri(a, c, d, ua, uc, ud, part, hint);
  };
  const R = plan.riseM, cell = dims.cellM;
  const wallUv = (v: number, y: number): Vec2 => [v / dims.bayM, y / dims.storeyM];

  if (plan.kind === 'mansard') {
    const k = Math.min(1.0, W * 0.16), h1 = R * 0.88, top = R - h1;
    const prof: Vec2[] = [[-W / 2, 0], [-W / 2 + k, h1], [0, h1 + top], [W / 2 - k, h1], [W / 2, 0]];
    for (let i = 0; i < prof.length - 1; i++) {
      const [v0, z0] = prof[i], [v1, z1] = prof[i + 1], sl = Math.hypot(v1 - v0, z1 - z0);
      quad(world(-L / 2, v0, z0), world(L / 2, v0, z0), world(L / 2, v1, z1), world(-L / 2, v1, z1),
        [0, 0], [L / cell, 0], [L / cell, sl / cell], [0, sl / cell], 'slope', dir(0, (v0 + v1) / 2, (z0 + z1) / 2 - R * 0.4));
    }
    for (const e of [-1, 1]) for (let i = 0; i < prof.length - 1; i++) {
      tri(world(e * L / 2, prof[i][0], prof[i][1]), world(e * L / 2, prof[i + 1][0], prof[i + 1][1]), world(e * L / 2, 0, R * 0.4),
        wallUv(prof[i][0], prof[i][1]), wallUv(prof[i + 1][0], prof[i + 1][1]), wallUv(0, R * 0.4), 'plate', dir(e, 0, 0));
    }
    for (const sgn of [-1, 1]) quad(world(-L / 2, sgn * W / 2, 0), world(L / 2, sgn * W / 2, 0), world(L / 2, sgn * (W / 2 + 0.28), -0.1), world(-L / 2, sgn * (W / 2 + 0.28), -0.1), [0, 0], [L / cell, 0], [L / cell, 0.3 / cell], [0, 0.3 / cell], 'slope', dir(0, sgn * 0.3, 1));
    if (plan.dormers) {
      const n = Math.min(4, Math.floor((L - 2) / 3.2));
      for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
        const uc = -L / 2 + ((i + 0.5) * L) / n, dw = 1.05, u0 = uc - dw / 2, u1 = uc + dw / 2;
        const vf = s * (W / 2 - k * 0.5), vb = s * (W / 2 - k), zb = h1 * 0.5 - 0.1, zt = zb + 1.35;
        quad(world(u0, vf, zb), world(u1, vf, zb), world(u1, vf, zt), world(u0, vf, zt), [0, 0], [1, 0], [1, 1], [0, 1], 'dormerFace', dir(0, s, 0));
        for (const [u, sgn] of [[u0, -1], [u1, 1]] as const) quad(world(u, vf, zb), world(u, vb, zb), world(u, vb, zt), world(u, vf, zt), [0, 0], [1, 0], [1, 1], [0, 1], 'dormerSide', dir(sgn, 0, 0));
        quad(world(u0, vf, zt), world(u1, vf, zt), world(u1, vb, zt + 0.28), world(u0, vb, zt + 0.28), [0, 0], [1, 0], [1, 1], [0, 1], 'dormerSide', dir(0, 0, 1));
      }
    }
    return out;
  }

  // gable and pitched: two slopes about a ridge along u.
  // The slope runs on past the wall: a 0.3 m eave overhang that casts the shadow line a roof needs.
  const ov = 0.3, drop = ov * (R / (W / 2)), sl = Math.hypot(W / 2 + ov, R + drop);
  for (const s of [-1, 1]) {
    quad(world(-L / 2, s * (W / 2 + ov), -drop), world(L / 2, s * (W / 2 + ov), -drop), world(L / 2, 0, R), world(-L / 2, 0, R),
      [0, 0], [L / cell, 0], [L / cell, sl / cell], [0, sl / cell], 'slope', dir(0, s * R, W / 2));
  }
  // A chimney stack on most roofs with a ridge: brick box, a pale cap.
  if (plan.chimney !== false && hash01(`${plan.seed}:chim`) < 0.62) {
    const side = hash01(`${plan.seed}:chimside`) < 0.5 ? -1 : 1, cu = side * (L / 2 - 1.2), cv = (hash01(`${plan.seed}:chimv`) - 0.5) * W * 0.25;
    const cw = 0.42, top = R + 1.15 + hash01(`${plan.seed}:chimh`) * 0.5, base = Math.max(0, R * (1 - Math.abs(cv) / (W / 2)) - 0.4);
    const c = [[cu - cw, cv - cw], [cu + cw, cv - cw], [cu + cw, cv + cw], [cu - cw, cv + cw]] as Vec2[];
    for (let i = 0; i < 4; i++) {
      const [a, b] = [c[i], c[(i + 1) % 4]], mid: Vec2 = [(a[0] + b[0]) / 2 - cu, (a[1] + b[1]) / 2 - cv];
      quad(world(a[0], a[1], base), world(b[0], b[1], base), world(b[0], b[1], top), world(a[0], a[1], top), [0, 0], [0.5, 0], [0.5, 1.2 / dims.storeyM * 2], [0, 1.2 / dims.storeyM * 2], 'plate', dir(mid[0], mid[1], 0));
    }
    quad(world(c[0][0], c[0][1], top), world(c[1][0], c[1][1], top), world(c[2][0], c[2][1], top), world(c[3][0], c[3][1], top), [0, 0], [1, 0], [1, 1], [0, 1], 'slope', dir(0, 0, 1));
  }
  for (const e of [-1, 1]) {
    if (plan.kind === 'pitched') {
      tri(world(e * L / 2, -W / 2, 0), world(e * L / 2, W / 2, 0), world(e * L / 2, 0, R), wallUv(-W / 2, 0), wallUv(W / 2, 0), wallUv(0, R), 'plate', dir(e, 0, 0));
      continue;
    }
    const prof = gableProfile(plan.gable, W, R), t = 0.32, f = e * L / 2, b = e * (L / 2 - t);
    for (let i = 0; i < prof.length - 1; i++) {
      const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
      if (Math.abs(x1 - x0) > 1e-4) {
        quad(world(f, x0, 0), world(f, x1, 0), world(f, x1, y1), world(f, x0, y0), wallUv(x0, 0), wallUv(x1, 0), wallUv(x1, y1), wallUv(x0, y0), 'plate', dir(e, 0, 0));
        quad(world(b, x0, 0), world(b, x1, 0), world(b, x1, y1), world(b, x0, y0), wallUv(x0, 0), wallUv(x1, 0), wallUv(x1, y1), wallUv(x0, y0), 'plate', dir(-e, 0, 0));
        quad(world(f, x0, y0), world(f, x1, y1), world(b, x1, y1), world(b, x0, y0), [0, 0], [1, 0], [1, 1], [0, 1], 'plate', dir(0, 0, 1));
      } else {
        // A riser: its side faces the opposite way to the step it climbs.
        const hi = Math.max(y0, y1), lo = Math.min(y0, y1), faceV = y1 > y0 ? -1 : 1;
        quad(world(f, x0, lo), world(b, x0, lo), world(b, x0, hi), world(f, x0, hi), [0, lo / dims.storeyM], [0.1, lo / dims.storeyM], [0.1, hi / dims.storeyM], [0, hi / dims.storeyM], 'plate', dir(0, faceV, 0));
      }
    }
  }
  if (plan.dormers) {
    const n = Math.min(3, Math.floor((L - 2) / 3.4));
    for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
      const uc = -L / 2 + ((i + 0.5) * L) / n, dw = 1.05, u0 = uc - dw / 2, u1 = uc + dw / 2;
      const vf = s * W * 0.27, slopeAt = R * (1 - 0.54), zb = slopeAt - 0.2, zt = zb + 1.35, vb = s * W * 0.05;
      quad(world(u0, vf, zb), world(u1, vf, zb), world(u1, vf, zt), world(u0, vf, zt), [0, 0], [1, 0], [1, 1], [0, 1], 'dormerFace', dir(0, s, 0));
      for (const [u, sgn] of [[u0, -1], [u1, 1]] as const) quad(world(u, vf, zb), world(u, vb, zb), world(u, vb, zt), world(u, vf, zt), [0, 0], [1, 0], [1, 1], [0, 1], 'dormerSide', dir(sgn, 0, 0));
      quad(world(u0, vf, zt), world(u1, vf, zt), world(u1, vb, zt + 0.3), world(u0, vb, zt + 0.3), [0, 0], [1, 0], [1, 1], [0, 1], 'dormerSide', dir(0, 0, 1));
    }
  }
  return out;
}

type GeoFeature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };
const M_PER_DEG_LAT = 110_540;

/** The outer ring of a feature's first polygon in metres around its first vertex. */
export function localOuterRing(geometry: unknown): Vec2[] | null {
  const g = geometry as { type?: string; coordinates?: any } | null;
  const polygon = g?.type === 'Polygon' ? g.coordinates : g?.type === 'MultiPolygon' && g.coordinates.length === 1 ? g.coordinates[0] : null;
  const ring = polygon?.[0] as number[][] | undefined;
  if (!ring || ring.length < 4) return null;
  const [lng0, lat0] = ring[0], kx = 111_320 * Math.cos(lat0 * Math.PI / 180);
  return ring.map(([lng, lat]) => [(lng - lng0) * kx, (lat - lat0) * M_PER_DEG_LAT] as Vec2);
}

/** The roof plan for a decorated feature (needs `facadeStyle`), or null. */
export function roofPlanForFeature(feature: GeoFeature): RoofPlan | null {
  const p = feature.properties;
  const ring = localOuterRing(feature.geometry);
  if (!ring) return null;
  const height = Number(p.height), minHeight = Number(p.minHeight) || 0;
  if (!Number.isFinite(height)) return null;
  return planRoof(String(p.id ?? ''), String(p.facadeStyle ?? ''), height, minHeight, fitRect(ring));
}

/**
 * Tile decorator for the three.js looks: buildings that get a real roof have
 * their plain wall lowered to the eaves (`roofEavesHeightM`, which the wall-top
 * expression already honours) and stop drawing the flat lid (a shaped
 * `roofShape`). Measured roofs and anything without a facade are left alone.
 */
export function decorateRoof<T extends GeoFeature>(feature: T): T {
  const p = feature.properties;
  if (!p.facade || p.roofPlanned) return feature;
  if (Number(p.roofEavesHeightM) > 0 || (p.roofShape !== undefined && p.roofShape !== null && p.roofShape !== '' && p.roofShape !== 'flat')) return feature;
  const plan = roofPlanForFeature(feature);
  if (!plan) return feature;
  return { ...feature, properties: { ...p, roofPlanned: true, roofShape: plan.kind, roofEavesHeightM: Number(p.height) - plan.riseM } };
}

/**
 * Landmarks keep their own form: churches, museums, Centraal. Wrap a tile
 * decorator so any building in `ids` (the resolved landmark buildings) is
 * passed through untouched, with no generic facade or roof. `ids` is read at
 * call time, so it can fill in after the decorator is installed.
 */
export function exceptLandmarks<T extends GeoFeature>(decorate: (feature: T) => T, ids: ReadonlySet<string>): (feature: T) => T {
  return (feature: T) => (ids.size && ids.has(String(feature.properties.id ?? '')) ? feature : decorate(feature));
}
