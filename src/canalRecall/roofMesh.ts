// Roofs and gables for the three.js building layer.
//
// MapLibre extrusions are prisms, so every building ends in a flat lid. This
// module decides, per building, whether it gets a real roof and builds it:
//   gable      – ridge along the long axis, a shaped gable on each short end: the canal
//                house. Shapes: step, neck, raised neck with white claws, bell, clock,
//                spout (warehouse, with shutters), plain, and the flat-topped cornice
//                front (lijstgevel) with a deep white cornice and the roof hipped behind it
//   pitched    – the same slopes with plain triangular ends: a terrace or a block
//   mansard    – steep lower slope, shallow top, dormers on the steep faces
//   mansardHip – a mansard on all four sides with a flat top: the 19th-century row
//                house, dormers to the street and a white eaves cornice
//   hipped     – four slopes (schilddak): villas and 19th-century blocks
//   halfHipped – gable ends clipped by a small hip (wolfdak)
//   school     – steep Amsterdam School tile roof: deep eaves, softened hip corners, a dormer band
//   sawtooth   – north-light sheds on big low industrial footprints
//   parapet    – flat roof behind a parapet with a coping: post-war and modern blocks
// plus a small corner turret with a spire where a 19th-century block has a cut corner.
// The plan (`planBuildingRoof`) is pure and deterministic from the building id
// and its footprint, so it runs in the tile decorator (to lower the plain wall to
// the eaves) and again in the mesh builder (to build the geometry) and agrees.
// Convex nonrectangular footprints can slope inward from their actual perimeter
// to a flat deck. Concave wings roof inscribed rectangles over a flat lid.

import earcut from 'earcut';
import { largeTierProperties } from './largeBuildingTier.js';
import { RoofSink, type V2, type V3 } from './roofSink.js';
import { findChamfer, inscribedRects, insetRing, openRing, parapetRingOk, perimeterRoofInset, signedArea } from './roofFootprint.js';
import { gableAccents, outlineBand, vergeBoards } from './gableTrim.js';
import { repeatedTerraceRoofTriangles, type RepeatedTerraceRoof } from './repeatedTerraceRoof.js';

export type RoofKind = 'gable' | 'pitched' | 'mansard' | 'mansardHip' | 'hipped' | 'halfHipped' | 'school' | 'sawtooth' | 'parapet';
export type GableShape = 'step' | 'neck' | 'bell' | 'spout' | 'plain' | 'clock' | 'raisedNeck' | 'cornice';
export const GABLE_SHAPES: readonly GableShape[] = ['step', 'neck', 'bell', 'spout', 'plain', 'clock', 'raisedNeck', 'cornice'];
export const ROOF_KINDS: readonly RoofKind[] = ['gable', 'pitched', 'mansard', 'mansardHip', 'hipped', 'halfHipped', 'school', 'sawtooth', 'parapet'];

export type RoofPlan = {
  repeatedTerrace?: RepeatedTerraceRoof;
  kind: RoofKind;
  gable: GableShape;
  /** Inscribed roofs may decorate only ends supported by the exterior outline: negative u, positive u. */
  gableEnds?: [boolean, boolean];
  /** Roof rise above the eaves, metres (for a gable plate, the roof's own rise; the plate stands higher). */
  riseM: number;
  /** Source-admitted crown geometry must fit the native total-height envelope. */
  nativeEnvelopeM?: number;
  /** Admitted surveyed frontage in the same local footprint frame as pieces. */
  sourceCrownFront?: {start: Vec2; end: Vec2; normal: Vec2; shape: GableShape; pairedOculi?: boolean};
  dormers: boolean;
  material: 'tile' | 'slate';
  /** 0..1, picks the roof colour from the look's palette. */
  tone: number;
  /** Per-building seed for small extras (chimney placement). */
  seed: string;
  /** Set false for churches and other roofs that should not grow a chimney. */
  chimney?: boolean;
  /** White stone and paint: copings, gable edging, cornices, barge boards, dormer cheeks. Off for landmarks. */
  accents?: boolean;
  /** The accent colour (white sandstone, cream, aluminium...). */
  trimHex?: string;
  /** Painted loading-door shutters in a spout gable. */
  shutters?: boolean;
  shutterHex?: string;
  /** Roofed rectangles in the footprint frame (`localOuterRing`), when the roof does not cover the whole outline's box. */
  pieces?: Array<{ rect: Rect; plan: RoofPlan }>;
  /** Draw the flat lid at the eaves as well (around pieces, or inside a parapet). */
  keepLid?: boolean;
  /** Sloping perimeter and flat deck following a convex, nonrectangular wall outline. */
  perimeterInsetM?: number;
  /** Parapet height above the lid, metres (kind 'parapet'). */
  parapetM?: number;
  /** A corner turret: centre and radius in the footprint frame. */
  turret?: { x: number; y: number; r: number };
};

export type Rect = { cx: number; cy: number; ux: number; uy: number; len: number; wid: number; coverage: number; /** Farthest any footprint vertex sits from the rectangle's border, metres. */ maxDev: number };
type Vec2 = [number, number];

/** slope/plate/dormer: textured as before; trim: flat-coloured closed solid; decal: flat-coloured one-sided paint just proud of a surface. */
export type RoofPart = 'slope' | 'plate' | 'dormerFace' | 'dormerSide' | 'trim' | 'decal';
export type RoofTri = { p: [V3, V3, V3]; uv: [V2, V2, V2]; part: RoofPart; n: V3; /** Flat colour for trim and decals (or a tint override). */ hex?: string; /** Shape of an explicitly admitted, exterior crown plate. */ sourceCrownShape?: GableShape; sourceCrownPairedOculi?: boolean };

export const TRIM_WHITE = '#efebe2';
const TRIM_CREAM = '#e6dcc5';

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

/** OSM `roof:shape` values the planner honours, and the kinds they allow. */
const TAGGED: Record<string, RoofKind[]> = {
  gabled: ['gable', 'pitched'], double_saltbox: ['gable', 'pitched', 'mansard'], saltbox: ['pitched'],
  hipped: ['hipped'], quadruple_saltbox: ['mansardHip', 'hipped'], 'half-hipped': ['halfHipped'],
  mansard: ['mansardHip', 'mansard'], gambrel: ['mansard'],
};
export const honouredRoofTag = (tag: unknown): boolean => typeof tag === 'string' && tag in TAGGED;

const riseFor = (kind: RoofKind, wid: number): number =>
  kind === 'mansard' ? 2.6 : kind === 'mansardHip' ? 3.0 : kind === 'school' ? Math.max(2.8, Math.min(6.5, wid * 0.5))
    : kind === 'hipped' ? Math.max(1.6, Math.min(4.2, wid * 0.33)) : kind === 'sawtooth' ? 2.4 : Math.max(1.6, Math.min(4.6, wid * 0.36));

/**
 * The roof for one rectangle, or null to keep the flat lid. `style` is the
 * building's facade style (canal, c19, school, postwar...), which sets the odds;
 * `tag` an OSM roof shape to honour (gabled, hipped, quadruple_saltbox...).
 */
export function planRoof(id: string, style: string, heightM: number, minHeightM: number, rect: Rect | null, tag?: string, year?: number | null, measured?: GableShape | null): RoofPlan | null {
  if (!rect || minHeightM > 0.5 || heightM < 6.5 || rect.wid < 3.6 || rect.len < 4.5 || rect.coverage < 0.88 || rect.maxDev > 1.0) return null;
  // A gable the monuments register names (monumentGables.ts) outranks the style's odds and any OSM tag.
  if (measured) { tag = undefined; if (style !== 'canal' && style !== 'c19' && style !== 'school') style = 'canal'; }
  if (style === 'modern' || style === 'tower') return null;
  const r = hash01(`${id}:roof`), narrow = rect.wid <= 8.5 && rect.len >= 1.25 * rect.wid;
  const area = rect.len * rect.wid;
  const industrial = (style === 'c19' || style === 'school' || style === 'postwar') && area >= 350 && rect.wid >= 14 && heightM <= 12;
  const villa = (style === 'c19' || style === 'school') && !narrow && rect.len <= 1.5 * rect.wid && area <= 260 && heightM <= 14;
  let kind: RoofKind | 'flat';
  const allowed = tag ? TAGGED[tag] : undefined;
  if (measured) kind = 'gable';
  else if (allowed) {
    // A mapped roof shape: only its kinds, picked with the style's taste where there is a choice.
    kind = allowed.length === 1 ? allowed[0] : allowed.includes('gable') && !narrow ? 'pitched'
      : pick(r, allowed.map(k => [k, k === 'gable' ? (style === 'canal' || style === 'c19' ? 0.5 : 0.1) : 1 / allowed.length] as [RoofKind, number]));
  } else if (industrial) kind = pick(r, [['sawtooth', 0.55], ['pitched', 0.15], ['flat', 0.3]]);
  else if (style === 'school') kind = narrow ? pick(r, [['pitched', 0.3], ['school', 0.3], ['mansard', 0.08], ['flat', 0.32]]) : pick(r, [['school', 0.45], ['pitched', 0.15], ['hipped', 0.08], ['mansard', 0.05], ['flat', 0.27]]);
  else if (style === 'postwar') kind = heightM <= 14 ? pick(r, [['pitched', 0.2], ['hipped', 0.06], ['flat', 0.74]]) : 'flat';
  else if (style === 'canal') kind = narrow ? pick(r, [['gable', 0.45], ['pitched', 0.2], ['mansard', 0.2], ['flat', 0.15]]) : pick(r, [['pitched', 0.25], ['mansard', 0.25], ['hipped', 0.2], ['flat', 0.3]]);
  else if (villa) kind = pick(r, [['hipped', 0.45], ['halfHipped', 0.25], ['mansardHip', 0.15], ['flat', 0.15]]);
  else kind = narrow ? pick(r, [['gable', 0.32], ['mansardHip', 0.3], ['pitched', 0.1], ['mansard', 0.08], ['halfHipped', 0.05], ['flat', 0.15]])
    : pick(r, [['mansardHip', 0.25], ['hipped', 0.18], ['mansard', 0.2], ['pitched', 0.12], ['halfHipped', 0.07], ['flat', 0.18]]);
  if (kind === 'flat') return null;
  if ((kind === 'mansard' || kind === 'mansardHip') && rect.wid < 5.2) kind = 'pitched';
  if ((kind === 'school' && rect.wid < 6) || (kind === 'halfHipped' && rect.wid < 5)) kind = 'pitched';
  const riseM = riseFor(kind, rect.wid);
  if (heightM - riseM < 4.5) return null;
  const g = hash01(`${id}:gable`);
  const styleWeights: Array<[GableShape, number]> = style === 'c19'
    ? [['step', 0.26], ['neck', 0.2], ['raisedNeck', 0.1], ['cornice', 0.14], ['clock', 0.06], ['bell', 0.08], ['spout', 0.08], ['plain', 0.08]]
    : [['step', 0.15], ['neck', 0.13], ['raisedNeck', 0.13], ['bell', 0.12], ['clock', 0.12], ['spout', 0.08], ['cornice', 0.17], ['plain', 0.1]];
  let gable: GableShape = measured ?? pick(g, gableWeightsForYear(styleWeights, year));
  // A deep narrow canal building is often a warehouse: a spout gable with shutters.
  if (!measured && style === 'canal' && rect.len >= 2.6 * rect.wid && hash01(`${id}:warehouse`) < 0.15) gable = 'spout';
  const accents = style === 'canal' || style === 'c19' || style === 'school';
  const plan: RoofPlan = {
    kind, gable, riseM,
    dormers: kind === 'mansard' || kind === 'mansardHip' || kind === 'school' || ((kind === 'pitched' || kind === 'hipped') && !narrow && hash01(`${id}:dorm`) < 0.45) || (kind === 'gable' && hash01(`${id}:dorm`) < 0.2),
    material: kind === 'mansard' || kind === 'mansardHip' || kind === 'sawtooth' ? 'slate' : kind === 'school' ? 'tile' : hash01(`${id}:mat`) < 0.62 ? 'tile' : 'slate',
    tone: hash01(`${id}:tone2`),
    seed: id,
  };
  if (kind === 'sawtooth') plan.chimney = false;
  if (accents) { plan.accents = true; plan.trimHex = hash01(`${id}:trim`) < 0.8 ? TRIM_WHITE : TRIM_CREAM; }
  if (kind === 'gable' && gable === 'spout') { plan.shutters = true; plan.shutterHex = pick(hash01(`${id}:shut`), [['#2f4a3a', 0.5], ['#6e2620', 0.3], ['#253129', 0.2]]); }
  return plan;
}

/**
 * When each gable was built (BAG year): step ~1600–1665, neck ~1640–1790, bell
 * ~1660–1790, raised neck ~1640–1720, clock ~1650–1750, cornice front from
 * 1700, plus the neo-renaissance revival of step and neck gables in the late
 * 19th century (Oud-West, Kinkerstraat). Spout gables are warehouses at any
 * date (planRoof forces them on warehouse-shaped plots).
 */
export const GABLE_PERIODS: Partial<Record<GableShape, Array<[number, number]>>> = {
  step: [[1600, 1665], [1875, 1915]], neck: [[1640, 1790], [1875, 1915]], bell: [[1660, 1790]], raisedNeck: [[1640, 1720]],
  clock: [[1650, 1750]], cornice: [[1700, 3000]],
};
/** Outside its period a gable keeps this share of its weight. */
export const GABLE_OFF_PERIOD = 0.15;
/**
 * The style's gable weights reweighted by construction year: in-period shapes
 * keep their weight, the rest drop to GABLE_OFF_PERIOD of it; a plain gable is
 * rare on a dated street front (0.3) and a spout belongs to warehouses (0.15).
 * Unknown years and 1905 (the BAG placeholder) change nothing.
 */
export function gableWeightsForYear(weights: Array<[GableShape, number]>, year: number | null | undefined): Array<[GableShape, number]> {
  if (year === null || year === undefined || !Number.isFinite(year) || year === 1905) return weights;
  return weights.map(([shape, w]) => {
    const periods = GABLE_PERIODS[shape];
    const k = shape === 'plain' ? 0.3 : shape === 'spout' ? GABLE_OFF_PERIOD : periods!.some(([a, b]) => year >= a && year <= b) ? 1 : GABLE_OFF_PERIOD;
    return [shape, w * k];
  });
}

/** Parapet odds and heights for flat-roofed periods. */
const PARAPET: Record<string, { p: number; h: [number, number]; hex: string }> = {
  school: { p: 0.85, h: [0.8, 1.0], hex: TRIM_WHITE },
  postwar: { p: 0.75, h: [0.5, 0.8], hex: '#d9d5cc' },
  modern: { p: 0.7, h: [0.6, 1.0], hex: '#c9ccce' },
  tower: { p: 0.55, h: [0.9, 1.3], hex: '#c9ccce' },
};

/** A facade ornament needs an exterior wall across its width, not an interior roof-piece edge. */
function exteriorGableEnds(rect: Rect, ring: readonly Vec2[]): [boolean, boolean] {
  const distanceToOutline = (x: number, y: number): number => {
    let nearest = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
      if (!length2) continue;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / length2));
      nearest = Math.min(nearest, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
    }
    return nearest;
  };
  // Sample most of the end width; a single corner touching a side wall is insufficient.
  return [-1, 1].map(end => [-0.45, -0.225, 0, 0.225, 0.45].every(across => {
    const u = end * rect.len / 2, v = across * rect.wid;
    return distanceToOutline(rect.cx + u * rect.ux - v * rect.uy, rect.cy + u * rect.uy + v * rect.ux) <= 0.35;
  })) as [boolean, boolean];
}

/**
 * The roof for a building from its footprint ring (metres, any frame), or null
 * for the plain flat lid. Rectangles get `planRoof`; convex outlines can get a
 * perimeter roof, concave wings get inscribed pieces, and flat periods a parapet.
 */
export function planBuildingRoof(id: string, style: string, heightM: number, minHeightM: number, ring: readonly Vec2[], tag?: string, year?: number | null, measured?: GableShape | null): RoofPlan | null {
  if (minHeightM > 0.5 || heightM < 6.5) return null;
  const pts = openRing(ring);
  if (pts.length < 4) return null;
  const rect = fitRect(pts);
  const simple = !!rect && rect.coverage >= 0.88 && rect.maxDev <= 1.0;
  const tagged = tag && TAGGED[tag] ? tag : undefined;
  if (simple) {
    const plan = planRoof(id, style, heightM, minHeightM, rect, tagged, year, measured);
    if (plan) {
      const out: RoofPlan = { ...plan, pieces: [{ rect: rect!, plan }] };
      // A cut corner on a 19th-century block: a small turret with a spire.
      if (style === 'c19' && plan.kind !== 'gable' && plan.kind !== 'sawtooth' && rect!.len * rect!.wid >= 90 && hash01(`${id}:turret`) < 0.6) {
        const ch = findChamfer(pts, rect!);
        if (ch) out.turret = { x: ch.x, y: ch.y, r: Math.max(1.1, Math.min(1.9, ch.len * 0.42)) };
      }
      return out;
    }
  } else if (style === 'canal' || style === 'c19' || style === 'school' || tagged) {
    const frame = fitRect(pts, 40);
    const ins = frame ? inscribedRects(pts, frame) : null;
    if (ins && ins.mainShare >= 0.5 && ins.main.len * ins.main.wid >= 24) {
      const plan = planRoof(id, style, heightM, minHeightM, ins.main, tagged, year, measured);
      if (plan && plan.kind !== 'sawtooth') {
        const perimeterInsetM = frame && !tagged && !measured && plan.kind !== 'gable' ? perimeterRoofInset(pts, frame.wid) : null;
        if (perimeterInsetM !== null) {
          return { ...plan, kind: 'mansardHip', gable: 'plain', dormers: false, chimney: false, perimeterInsetM };
        }
        const mainPlan = plan.kind === 'gable' ? { ...plan, gableEnds: exteriorGableEnds(ins.main, pts) } : plan;
        const pieces: RoofPlan['pieces'] = [{ rect: ins.main, plan: mainPlan }];
        if (ins.second) {
          const w = ins.second, wingKind: RoofKind = plan.kind === 'hipped' || plan.kind === 'school' && w.wid >= 6 ? plan.kind : 'pitched';
          const riseM = Math.min(plan.riseM, riseFor(wingKind, w.wid));
          if (heightM - riseM >= 4.5) pieces.push({ rect: w, plan: { ...plan, kind: wingKind, gable: 'plain', riseM, dormers: false, seed: `${id}:wing`, chimney: false, shutters: undefined } });
        }
        return { ...plan, pieces, keepLid: true };
      }
    }
  }
  if (tagged) return null;
  const par = PARAPET[style];
  if (par && hash01(`${id}:parapet`) < par.p && parapetRingOk(pts, 0.25, 40)) {
    const parapetM = par.h[0] + (par.h[1] - par.h[0]) * hash01(`${id}:parapetH`);
    if (heightM - parapetM < 4) return null;
    return { kind: 'parapet', gable: 'plain', riseM: parapetM, dormers: false, material: 'slate', tone: hash01(`${id}:tone2`), seed: id, chimney: false, accents: true, trimHex: par.hex, parapetM, keepLid: true };
  }
  return null;
}

/** Height of the flat top of a cornice front (lijstgevel) above the eaves. */
export const corniceHeight = (roofRiseM: number) => roofRiseM * 0.5 + 0.3;

/** The raised neck gable's claw arcs (left, then right), for the white claw pieces. */
function raisedNeckDims(widthM: number, R: number) {
  const half = widthM / 2, neck = half * 0.4, s0 = Math.max(0.9, R * 0.6 + 0.2), topN = R * 1.45 + 0.9, top = topN + neck * 0.6;
  let rc = Math.min(half - neck - 0.12, (topN - s0) * 0.45);
  if (rc < 0.3) rc = 0;
  const arc: Vec2[] = [];
  for (let i = 0; i <= 3 && rc > 0; i++) { const t = (i / 3) * Math.PI / 2; arc.push([-neck - rc * Math.cos(t), s0 + rc * Math.sin(t)]); }
  return { half, neck, s0, topN, top, rc, arc };
}
export function clawArcs(widthM: number, roofRiseM: number): Vec2[][] {
  const { arc } = raisedNeckDims(widthM, roofRiseM);
  return arc.length ? [arc, arc.map(([x, y]) => [-x, y] as Vec2).reverse()] : [];
}

/** Where the white crown of a raised neck (its pediment) or a clock gable (its arch) begins. */
function crownBaseOf(shape: GableShape, widthM: number, R: number): number | undefined {
  if (shape === 'raisedNeck') return raisedNeckDims(widthM, R).topN;
  if (shape === 'clock') return clockDims(widthM, R).nt;
  return undefined;
}
function clockDims(widthM: number, R: number) {
  const half = widthM / 2, neck = half * 0.46, slopeAtNeck = R * (1 - 0.46);
  const sh = Math.max(slopeAtNeck + 0.3, R * 0.75), nt = Math.max(sh + 0.5, R * 1.35 + 0.7);
  return { neck, sh, nt, top: nt + neck * 0.6 };
}

/** A gable plate's outline above the eaves: x across (−W/2..W/2, never going back), y up. */
export function gableProfile(shape: GableShape, widthM: number, roofRiseM: number): Vec2[] {
  const half = widthM / 2, pts: Vec2[] = [];
  const slope = (x: number) => roofRiseM * (1 - Math.abs(x) / half);
  const add = (x: number, y: number) => pts.push([x, Math.max(y, slope(x) + 0.04)]);
  const mirror = (left: Vec2[]): Vec2[] => {
    const right = left.slice(0, -1).reverse().map(([x, y]) => [-x, y] as Vec2);
    const all = [...left, ...right];
    all[0] = [all[0][0], 0]; all[all.length - 1] = [all[all.length - 1][0], 0];
    return dedupe(all);
  };
  const N = 10;
  if (shape === 'plain') { add(-half, 0); add(0, roofRiseM); add(half, 0); pts[0][1] = 0; pts[2][1] = 0; return pts; }
  if (shape === 'cornice') { const hc = corniceHeight(roofRiseM); return [[-half, 0], [-half, hc], [half, hc], [half, 0]]; }
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
    for (let i = 1; i <= 4; i++) { const t = i / 4, x = -half + (half - neck) * t; add(x, 0.15 + (shoulder - 0.15) * Math.pow(t, 1.7)); }
    add(-neck, top); add(neck, top);
    for (let i = 4; i >= 1; i--) { const t = i / 4, x = half - (half - neck) * t; add(x, 0.15 + (shoulder - 0.15) * Math.pow(t, 1.7)); }
    add(half, 0);
    pts[0][1] = 0; pts[pts.length - 1][1] = 0;
    return dedupe(pts);
  }
  if (shape === 'raisedNeck') {
    // Verhoogde halsgevel: a short upright, a level shoulder, white claws against a tall neck, a pediment.
    const d = raisedNeckDims(widthM, roofRiseM);
    add(-half, 0); add(-half, d.s0);
    if (d.arc.length) { if (d.arc[0][0] > -half + 0.01) add(d.arc[0][0], d.s0); for (const [x, y] of d.arc) add(x, y); } else add(-d.neck, d.s0);
    add(-d.neck, d.topN); add(0, d.top);
    return mirror(pts);
  }
  if (shape === 'clock') {
    // Klokgevel: S-curved shoulders up to an upright neck, closed by an arch.
    const { neck, sh, nt, top } = clockDims(widthM, roofRiseM);
    for (let i = 0; i <= 4; i++) { const t = i / 4; add(-half + (half - neck) * t, sh * (3 * t * t - 2 * t * t * t)); }
    for (let i = 0; i <= 3; i++) { const a = Math.PI - (i / 3) * (Math.PI / 2); add(neck * Math.cos(a), nt + (top - nt) * Math.sin(a)); }
    return mirror(pts);
  }
  const bell = shape === 'bell', top = roofRiseM * (bell ? 1.3 : 1.55) + (bell ? 0.6 : 0.9);
  for (let i = 0; i <= N; i++) {
    const x = -half + (widthM * i) / N, t = Math.abs(x) / half;
    let f: number;
    if (bell) f = t < 0.18 ? 1 : 0.12 + 0.88 * (0.5 + 0.5 * Math.cos(Math.PI * Math.pow((t - 0.18) / 0.82, 0.85)));
    else { const tt = t < 0.26 ? 0 : (t - 0.26) / 0.74; f = t < 0.26 ? 1 : 0.1 + 0.9 * (1 - Math.pow(tt, 0.6)); }
    add(x, top * f);
  }
  pts[0][1] = 0; pts[pts.length - 1][1] = 0;
  return dedupe(pts);
}
const dedupe = (pts: Vec2[]): Vec2[] => pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);

export type RoofDims = { bayM: number; storeyM: number; cellM: number };

// --- builders ------------------------------------------------------------------

/** A gable plate as a slab `t` deep behind the end plane: front, back, top (coping) and risers. */
function gableSlab(s: RoofSink, prof: readonly Vec2[], e: number, L: number, topPart: 'plate' | 'trim', topHex?: string, t = 0.32): void {
  const f = e * L / 2, b = e * (L / 2 - t), st = s.dims.storeyM;
  for (let i = 0; i < prof.length - 1; i++) {
    const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
    if (Math.abs(x1 - x0) > 1e-4) {
      s.quad([f, x0, 0], [f, x1, 0], [f, x1, y1], [f, x0, y0], s.wallUv(x0, 0), s.wallUv(x1, 0), s.wallUv(x1, y1), s.wallUv(x0, y0), 'plate', [e, 0, 0]);
      s.quad([b, x0, 0], [b, x1, 0], [b, x1, y1], [b, x0, y0], s.wallUv(x0, 0), s.wallUv(x1, 0), s.wallUv(x1, y1), s.wallUv(x0, y0), 'plate', [-e, 0, 0]);
      s.quad([f, x0, y0], [f, x1, y1], [b, x1, y1], [b, x0, y0], [0, 0], [1, 0], [1, 1], [0, 1], topPart, [0, 0, 1], topPart === 'trim' ? topHex : undefined);
    } else {
      // A riser: its side faces the opposite way to the step it climbs.
      const hi = Math.max(y0, y1), lo = Math.min(y0, y1), faceV = y1 > y0 ? -1 : 1;
      s.quad([f, x0, lo], [b, x0, lo], [b, x0, hi], [f, x0, hi], [0, lo / st], [0.1, lo / st], [0.1, hi / st], [0, hi / st], 'plate', [0, faceV, 0]);
    }
  }
}

type DormerSpec = { axis: 'u' | 'v'; side: number; c: number; pf: number; dw: number; hd: number; surf: (a: number) => number; band?: boolean };

/**
 * One dormer standing on a roof face: window face, cheeks (white with accents)
 * and a small pitched cap with a pediment, or a flat top for a dormer band. Its
 * back sits where the roof has risen over it, so it is closed against the roof.
 */
function dormer(s: RoofSink, d: DormerSpec, plan: RoofPlan): boolean {
  const P = (a: number, b: number, z: number): V3 => (d.axis === 'v' ? [b, d.side * a, z] : [d.side * a, b, z]);
  const n: V3 = d.axis === 'v' ? [0, d.side, 0] : [d.side, 0, 0];
  const tan = (sg: number): V3 => (d.axis === 'v' ? [sg, 0, 0] : [0, sg, 0]);
  const zf = d.surf(d.pf), zb = zf - 0.15, ph = d.band ? 0 : Math.min(0.5, d.dw * 0.4);
  let hd = d.hd, pb = -1;
  for (; hd >= 0.75; hd -= 0.1) {
    const need = zb + hd + ph + 0.06;
    for (let a = d.pf - 0.2; a >= 0; a -= 0.05) if (d.surf(a) >= need) { pb = a; break; }
    if (pb >= 0) break;
  }
  if (pb < 0) return false;
  const zt = zb + hd, b0 = d.c - d.dw / 2, b1 = d.c + d.dw / 2, accents = !!plan.accents, trim = plan.trimHex ?? TRIM_WHITE;
  const rep = d.band ? Math.max(1, Math.round(d.dw / 1.5)) : 1;
  s.quad(P(d.pf, b0, zb), P(d.pf, b1, zb), P(d.pf, b1, zt), P(d.pf, b0, zt), [0, 0], [rep, 0], [rep, 1], [0, 1], 'dormerFace', n);
  for (const [b, sg] of [[b0, -1], [b1, 1]] as const) s.quad(P(d.pf, b, zb), P(pb, b, zb), P(pb, b, zt), P(d.pf, b, zt), [0, 0], [1, 0], [1, 1], [0, 1], accents ? 'trim' : 'dormerSide', tan(sg), accents ? trim : undefined);
  if (d.band) {
    s.quad(P(d.pf, b0, zt), P(d.pf, b1, zt), P(pb, b1, zt), P(pb, b0, zt), [0, 0], [1, 0], [1, 1], [0, 1], 'dormerSide', [0, 0, 1]);
    if (accents) s.quad(P(d.pf + 0.012, b0, zt - 0.14), P(d.pf + 0.012, b1, zt - 0.14), P(d.pf + 0.012, b1, zt), P(d.pf + 0.012, b0, zt), [0, 0], [0, 0], [0, 0], [0, 0], 'decal', n, trim);
  } else {
    s.tri(P(d.pf, b0, zt), P(d.pf, b1, zt), P(d.pf, d.c, zt + ph), [0, 0], [0, 0], [0, 0], accents ? 'trim' : 'plate', n, accents ? trim : undefined);
    for (const sg of [-1, 1]) {
      const b = sg < 0 ? b0 : b1;
      s.slopeTri(P(d.pf, b, zt), P(pb, b, zt), P(pb, d.c, zt + ph), [...tan(sg).slice(0, 2), 0.8] as V3, 'dormerSide');
      s.slopeTri(P(d.pf, b, zt), P(pb, d.c, zt + ph), P(d.pf, d.c, zt + ph), [...tan(sg).slice(0, 2), 0.8] as V3, 'dormerSide');
    }
  }
  return true;
}

/** A chimney stack: brick box on the roof at one end, a pale cap. `surf(u, v)` is the roof height there. */
function chimney(s: RoofSink, plan: RoofPlan, L: number, W: number, R: number, surf: (u: number, v: number) => number): void {
  if (plan.chimney === false || hash01(`${plan.seed}:chim`) >= 0.62) return;
  const side = hash01(`${plan.seed}:chimside`) < 0.5 ? -1 : 1, cu = side * (L / 2 - 1.2), cv = (hash01(`${plan.seed}:chimv`) - 0.5) * W * 0.25;
  const cw = 0.42, top = R + 1.15 + hash01(`${plan.seed}:chimh`) * 0.5;
  const c = [[cu - cw, cv - cw], [cu + cw, cv - cw], [cu + cw, cv + cw], [cu - cw, cv + cw]] as Vec2[];
  const base = Math.max(-0.3, Math.min(...c.map(([u, v]) => surf(u, v))) - 0.4), st = s.dims.storeyM;
  for (let i = 0; i < 4; i++) {
    const [a, b] = [c[i], c[(i + 1) % 4]];
    s.quad([a[0], a[1], base], [b[0], b[1], base], [b[0], b[1], top], [a[0], a[1], top], [0, 0], [0.5, 0], [0.5, 1.2 / st * 2], [0, 1.2 / st * 2], 'plate', [(a[0] + b[0]) / 2 - cu, (a[1] + b[1]) / 2 - cv, 0]);
  }
  s.quad([c[0][0], c[0][1], top], [c[1][0], c[1][1], top], [c[2][0], c[2][1], top], [c[3][0], c[3][1], top], [0, 0], [1, 0], [1, 1], [0, 1], 'slope', [0, 0, 1]);
}

/** A thin white board hanging under an eave edge from a to b (local), facing `out`. */
function fascia(s: RoofSink, a: V3, b: V3, out: V3, hex: string, h = 0.16): void {
  s.quad(a, b, [b[0], b[1], b[2] - h], [a[0], a[1], a[2] - h], [0, 0], [0, 0], [0, 0], [0, 0], 'decal', out, hex);
}

function buildMansard(s: RoofSink, plan: RoofPlan, L: number, W: number, R: number): void {
  const k = Math.min(1.0, W * 0.16), h1 = R * 0.88, trim = plan.trimHex ?? TRIM_WHITE;
  const prof: Vec2[] = [[-W / 2, 0], [-W / 2 + k, h1], [0, R], [W / 2 - k, h1], [W / 2, 0]];
  for (let i = 0; i < prof.length - 1; i++) {
    const [v0, z0] = prof[i], [v1, z1] = prof[i + 1];
    s.slopePoly([[-L / 2, v0, z0], [L / 2, v0, z0], [L / 2, v1, z1], [-L / 2, v1, z1]], [0, (v0 + v1) / 2, (z0 + z1) / 2 - R * 0.4]);
  }
  // The end wall is a fan about an inner point, closed along the eaves too: without the
  // eaves edge a triangle was missing and every mansard end showed a hole (user report 2026-10-02).
  for (const e of [-1, 1]) for (let i = 0; i < prof.length; i++) {
    const a = prof[i], b = prof[(i + 1) % prof.length];
    s.tri([e * L / 2, a[0], a[1]], [e * L / 2, b[0], b[1]], [e * L / 2, 0, R * 0.4], s.wallUv(a[0], a[1]), s.wallUv(b[0], b[1]), s.wallUv(0, R * 0.4), 'plate', [e, 0, 0]);
  }
  for (const sg of [-1, 1]) {
    s.quad([-L / 2, sg * W / 2, 0], [L / 2, sg * W / 2, 0], [L / 2, sg * (W / 2 + 0.28), -0.1], [-L / 2, sg * (W / 2 + 0.28), -0.1], [0, 0], [L / s.dims.cellM, 0], [L / s.dims.cellM, 0.25], [0, 0.25], plan.accents ? 'trim' : 'slope', [0, sg * 0.3, 1], plan.accents ? trim : undefined);
    if (plan.accents) fascia(s, [-L / 2, sg * (W / 2 + 0.28), -0.1], [L / 2, sg * (W / 2 + 0.28), -0.1], [0, sg, 0], trim, 0.22);
  }
  if (plan.dormers) {
    const n = Math.min(3, Math.floor((L - 2) / 3.6));
    const surf = (a: number) => (a >= W / 2 - k ? h1 * (W / 2 - a) / k : h1 + (R - h1) * (1 - a / (W / 2 - k)));
    for (const sd of [-1, 1]) for (let i = 0; i < n; i++) dormer(s, { axis: 'v', side: sd, c: -L / 2 + ((i + 0.5) * L) / n, pf: W / 2 - k * 0.5, dw: 1.05, hd: 1.25, surf }, plan);
  }
}

/** Mansard on all four sides: steep slate band to a flat top, dormers to the street ends, a white eaves cornice. */
function buildMansardHip(s: RoofSink, plan: RoofPlan, L: number, W: number, R: number): void {
  const k = Math.min(1.1, W * 0.17), trim = plan.trimHex ?? TRIM_WHITE, ov = 0.3, lip = -0.12;
  const o: Vec2[] = [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]];
  const inn: Vec2[] = [[-L / 2 + k, -W / 2 + k], [L / 2 - k, -W / 2 + k], [L / 2 - k, W / 2 - k], [-L / 2 + k, W / 2 - k]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, mid: V3 = [(o[i][0] + o[j][0]) / 2, (o[i][1] + o[j][1]) / 2, 0];
    s.slopePoly([[o[i][0], o[i][1], 0], [o[j][0], o[j][1], 0], [inn[j][0], inn[j][1], R], [inn[i][0], inn[i][1], R]], [mid[0], mid[1], 0.5]);
  }
  s.slopePoly(inn.map(([u, v]) => [u, v, R] as V3), [0, 0, 1]);
  // The eaves cornice: a white ledge all round with its fascia.
  const ex: Vec2[] = [[-L / 2 - ov, -W / 2 - ov], [L / 2 + ov, -W / 2 - ov], [L / 2 + ov, W / 2 + ov], [-L / 2 - ov, W / 2 + ov]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, out: V3 = [(ex[i][0] + ex[j][0]) / 2, (ex[i][1] + ex[j][1]) / 2, 0];
    const part = plan.accents ? 'trim' : 'slope', hex = plan.accents ? trim : undefined;
    s.quad([o[i][0], o[i][1], 0], [o[j][0], o[j][1], 0], [ex[j][0], ex[j][1], lip], [ex[i][0], ex[i][1], lip], [0, 0], [1, 0], [1, 0.25], [0, 0.25], part, [out[0] * 0.05, out[1] * 0.05, 1], hex);
    if (plan.accents) fascia(s, [ex[i][0], ex[i][1], lip], [ex[j][0], ex[j][1], lip], [out[0], out[1], 0], trim, 0.26);
  }
  if (!plan.dormers) return;
  // Dormers on the short ends (the street front of a row house); on the long sides only when they are not party walls.
  const nE = W >= 7.5 ? 2 : 1, dwE = Math.min(1.3, (W - 2 * k) / nE - 0.5);
  const surfU = (a: number) => (a >= L / 2 - k ? R * (L / 2 - a) / k : R);
  if (dwE >= 0.7) for (const e of [-1, 1]) for (let i = 0; i < nE; i++) dormer(s, { axis: 'u', side: e, c: nE === 1 ? 0 : (i - 0.5) * (W / 2), pf: L / 2 - k * 0.35, dw: dwE, hd: 1.2, surf: surfU }, plan);
  const narrow = W <= 8.5 && L >= 1.25 * W;
  if (!narrow) {
    const n = Math.min(4, Math.floor((L - 2 * k - 1) / 3));
    const surfV = (a: number) => (a >= W / 2 - k ? R * (W / 2 - a) / k : R);
    for (const sd of [-1, 1]) for (let i = 0; i < n; i++) dormer(s, { axis: 'v', side: sd, c: -(L / 2 - k) + ((i + 0.5) * (L - 2 * k)) / n, pf: W / 2 - k * 0.35, dw: 1.2, hd: 1.2, surf: surfV }, plan);
  }
}

/** Four slopes to a ridge (a pyramid on a square), optionally with softened corners. */
function buildHipped(s: RoofSink, plan: RoofPlan, L: number, W: number, R: number, ov: number, rc: number): void {
  const drop = ov * (R / (W / 2)), E = W / 2 + ov, Ue = L / 2 + ov, a = Math.max(0, L / 2 - W / 2);
  const apex = (su: number): V3 => [su * a, 0, R], trim = plan.trimHex ?? TRIM_WHITE;
  rc = Math.min(rc, ov * 2.2);
  for (const sv of [-1, 1]) s.slopePoly([[-Ue + rc, sv * E, -drop], [Ue - rc, sv * E, -drop], apex(1), apex(-1)], [0, sv, 1]);
  for (const su of [-1, 1]) {
    s.slopeTri([su * Ue, -E + rc, -drop], [su * Ue, E - rc, -drop], apex(su), [su, 0, 1]);
    if (rc > 0) for (const sv of [-1, 1]) {
      const cu = su * (Ue - rc), cv = sv * (E - rc), arc: V3[] = [];
      for (let i = 0; i <= 3; i++) { const f = (i / 3) * Math.PI / 2; arc.push([cu + su * rc * Math.sin(f), cv + sv * rc * Math.cos(f), -drop]); }
      for (let i = 0; i < 3; i++) s.slopeTri(arc[i], arc[i + 1], apex(su), [su, sv, 1.4]);
    }
  }
  if (plan.accents) {
    for (const sv of [-1, 1]) fascia(s, [-Ue + rc, sv * E, -drop], [Ue - rc, sv * E, -drop], [0, sv, 0], trim);
    for (const su of [-1, 1]) fascia(s, [su * Ue, -E + rc, -drop], [su * Ue, E - rc, -drop], [su, 0, 0], trim);
  }
  const surfV = (v: number) => R * (1 - Math.abs(v) / (W / 2));
  const surf = (u: number, v: number) => Math.min(surfV(v), Math.abs(u) > a ? R * (1 - (Math.abs(u) - a) / (W / 2)) : R);
  if (plan.kind === 'school') {
    // A dormer band along each long slope, as wide as the hip lets it be.
    const pf = (W / 2) * 0.7, need = surfV(pf) - 0.15 + 1.3 + 0.06, reach = a + (W / 2) * (1 - need / R) - 0.4;
    const dw = Math.min(L * 0.7, 2 * reach);
    if (dw >= 2) for (const sd of [-1, 1]) dormer(s, { axis: 'v', side: sd, c: 0, pf, dw, hd: 1.3, surf: (q: number) => surfV(q), band: true }, plan);
  } else if (plan.dormers) {
    const n = Math.min(3, Math.floor((2 * a + 1) / 3.2));
    for (const sd of [-1, 1]) for (let i = 0; i < n; i++) dormer(s, { axis: 'v', side: sd, c: n === 1 ? 0 : -a + ((i + 0.5) * 2 * a) / n, pf: (W / 2) * 0.72, dw: 1.05, hd: 1.3, surf: (q: number) => surfV(q) }, plan);
  }
  chimney(s, plan, L, W, R, surf);
}

/** Long slopes with ends clipped at `zc` by a small hip; the ends below `zc` are gable plates (or a cornice front's slab). */
function halfHipSlopes(s: RoofSink, L: number, W: number, R: number, zc: number, ov: number): void {
  const drop = ov * (R / (W / 2)), E = W / 2 + ov, vc = (W / 2) * (1 - zc / R), d = vc;
  for (const sv of [-1, 1]) s.slopePoly([[-L / 2, sv * E, -drop], [L / 2, sv * E, -drop], [L / 2, sv * vc, zc], [L / 2 - d, 0, R], [-L / 2 + d, 0, R], [-L / 2, sv * vc, zc]], [0, sv, 1]);
  for (const su of [-1, 1]) s.slopeTri([su * L / 2, -vc, zc], [su * L / 2, vc, zc], [su * (L / 2 - d), 0, R], [su, 0, 1]);
}

function buildSawtooth(s: RoofSink, plan: RoofPlan, L: number, W: number, R: number): void {
  const n = Math.max(2, Math.round(L / 7)), p = L / n;
  for (let k = 0; k < n; k++) {
    const u0 = -L / 2 + k * p, u1 = u0 + p;
    s.slopePoly([[u0, -W / 2, 0], [u0, W / 2, 0], [u1, W / 2, R], [u1, -W / 2, R]], [-R, 0, p]);
    const rep = Math.max(1, Math.round(W / 1.6));
    s.quad([u1, -W / 2, 0], [u1, W / 2, 0], [u1, W / 2, R], [u1, -W / 2, R], [0, 0], [rep, 0], [rep, 1], [0, 1], 'dormerFace', [1, 0, 0]);
    for (const sv of [-1, 1]) s.tri([u0, sv * W / 2, 0], [u1, sv * W / 2, 0], [u1, sv * W / 2, R], s.wallUv(u0, 0), s.wallUv(u1, 0), s.wallUv(u1, R), 'plate', [0, sv, 0]);
  }
  void plan;
}

/** A corner turret: an octagonal oriel from a storey below the eaves, a white band, a slate spire. */
function buildTurret(s: RoofSink, tu: number, tv: number, r: number, R: number, trim: string): void {
  const zb = -3.0, zt = R + 0.6, band = 0.35, hs = 2.6 + r * 1.2, k = 8, st = s.dims.storeyM;
  const ring: Vec2[] = [];
  for (let i = 0; i < k; i++) { const a = ((i + 0.5) / k) * Math.PI * 2; ring.push([tu + r * Math.cos(a), tv + r * Math.sin(a)]); }
  const arc = 2 * Math.PI * r / k;
  for (let i = 0; i < k; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % k]], out: V3 = [(a[0] + b[0]) / 2 - tu, (a[1] + b[1]) / 2 - tv, 0];
    s.quad([a[0], a[1], zb], [b[0], b[1], zb], [b[0], b[1], zt - band], [a[0], a[1], zt - band], s.wallUv(i * arc, 0), s.wallUv((i + 1) * arc, 0), s.wallUv((i + 1) * arc, zt - band - zb), s.wallUv(i * arc, zt - band - zb), 'plate', out);
    s.quad([a[0], a[1], zt - band], [b[0], b[1], zt - band], [b[0], b[1], zt], [a[0], a[1], zt], [0, 0], [0, 0], [0, 0], [0, 0], 'trim', out, trim);
    s.slopeTri([a[0], a[1], zt], [b[0], b[1], zt], [tu, tv, zt + hs], [out[0], out[1], 0.4], 'slope', '#545b63');
  }
  s.flatPoly(ring.map(([u, v]) => [u, v, zb] as V3), 'trim', [0, 0, -1], trim);
  void st;
}

/** Roof geometry for one rectangle, in the same metre frame as the rect. `h0` is the eaves height. */
function buildRoofTriangles(rect: Rect, plan: RoofPlan, h0: number, dims: RoofDims): RoofTri[] {
  const s = new RoofSink(rect, h0, dims);
  const { len: L, wid: W } = rect, R = plan.riseM, trim = plan.trimHex ?? TRIM_WHITE, accents = !!plan.accents;
  if (plan.kind === 'mansard') { buildMansard(s, plan, L, W, R); return s.out; }
  if (plan.kind === 'mansardHip') { buildMansardHip(s, plan, L, W, R); chimney(s, plan, L, W, R, () => R); return s.out; }
  if (plan.kind === 'hipped') { buildHipped(s, plan, L, W, R, 0.3, 0); return s.out; }
  if (plan.kind === 'school') { buildHipped(s, plan, L, W, R, 0.45, Math.min(0.9, W * 0.12)); return s.out; }
  if (plan.kind === 'sawtooth') { buildSawtooth(s, plan, L, W, R); return s.out; }
  if (plan.kind === 'parapet') return s.out;

  const ov = 0.3, drop = ov * (R / (W / 2));
  const surfV = (v: number) => R * (1 - Math.abs(v) / (W / 2));
  const cornice = plan.kind === 'gable' && plan.gable === 'cornice';
  if (plan.kind === 'halfHipped' || cornice) {
    const zc = cornice ? corniceHeight(R) : R * 0.55, vc = (W / 2) * (1 - zc / R);
    halfHipSlopes(s, L, W, R, zc, ov);
    for (const e of [-1, 1]) {
      const f = e * L / 2;
      if (cornice && plan.gableEnds?.[e < 0 ? 0 : 1] !== false) {
        const prof = gableProfile('cornice', W, R);
        gableSlab(s, prof, e, L, accents ? 'trim' : 'plate', trim);
        if (accents) gableAccents(s, { shape: 'cornice', prof, f, e, W, R, trimHex: trim, shutterHex: '', shutters: false });
      } else {
        s.quad([f, -W / 2, 0], [f, W / 2, 0], [f, vc, zc], [f, -vc, zc], s.wallUv(-W / 2, 0), s.wallUv(W / 2, 0), s.wallUv(vc, zc), s.wallUv(-vc, zc), 'plate', [e, 0, 0]);
        if (accents && plan.gableEnds?.[e < 0 ? 0 : 1] !== false) vergeBoards(s, f, e, [[[-W / 2, 0], [-vc, zc]], [[vc, zc], [W / 2, 0]]], trim);
      }
    }
    const d = vc;
    chimney(s, plan, L, W, R, (u, v) => Math.min(surfV(v), Math.abs(u) > L / 2 - d ? zc + (R - zc) * (L / 2 - Math.abs(u)) / d : R));
    if (accents) for (const sv of [-1, 1]) fascia(s, [-L / 2, sv * (W / 2 + ov), -drop], [L / 2, sv * (W / 2 + ov), -drop], [0, sv, 0], trim);
    return s.out;
  }

  // gable and pitched: two slopes about a ridge along u.
  // The slope runs on past the wall: a 0.3 m eave overhang that casts the shadow line a roof needs.
  for (const sv of [-1, 1]) s.slopePoly([[-L / 2, sv * (W / 2 + ov), -drop], [L / 2, sv * (W / 2 + ov), -drop], [L / 2, 0, R], [-L / 2, 0, R]], [0, sv * R, W / 2]);
  if (accents) for (const sv of [-1, 1]) fascia(s, [-L / 2, sv * (W / 2 + ov), -drop], [L / 2, sv * (W / 2 + ov), -drop], [0, sv, 0], trim);
  chimney(s, plan, L, W, R, (_u, v) => surfV(v));
  for (const e of [-1, 1]) {
    const f = e * L / 2;
    const exterior = plan.gableEnds?.[e < 0 ? 0 : 1] !== false;
    if (plan.kind === 'pitched' || !exterior) {
      s.tri([f, -W / 2, 0], [f, W / 2, 0], [f, 0, R], s.wallUv(-W / 2, 0), s.wallUv(W / 2, 0), s.wallUv(0, R), 'plate', [e, 0, 0]);
      if (accents && exterior) vergeBoards(s, f, e, [[[-W / 2, 0], [0, R]], [[0, R], [W / 2, 0]]], trim);
      continue;
    }
    const prof = gableProfile(plan.gable, W, R);
    gableSlab(s, prof, e, L, accents && plan.gable !== 'plain' ? 'trim' : 'plate', trim);
    if (accents) gableAccents(s, { shape: plan.gable, prof, f, e, W, R, trimHex: trim, shutterHex: plan.shutterHex ?? '#2f4a3a', shutters: !!plan.shutters, claws: plan.gable === 'raisedNeck' ? clawArcs(W, R) : undefined, crownBase: crownBaseOf(plan.gable, W, R) });
  }
  if (plan.dormers) {
    const n = Math.min(3, Math.floor((L - 2) / 3.4));
    for (const sd of [-1, 1]) for (let i = 0; i < n; i++) dormer(s, { axis: 'v', side: sd, c: -L / 2 + ((i + 0.5) * L) / n, pf: (W / 2) * 0.72, dw: 1.05, hd: 1.35, surf: surfV }, plan);
  }
  return s.out;
}

/** Fit only an explicitly admitted crown to its native envelope, keeping its eaves connected.
 * Normals follow the same vertical transform; ordinary city roof defaults are untouched. */
export function roofTriangles(rect: Rect, plan: RoofPlan, h0: number, dims: RoofDims): RoofTri[] {
  const triangles = buildRoofTriangles(rect, plan, h0, dims);
  if (!plan.nativeEnvelopeM || !triangles.length) return triangles;
  const top = Math.max(...triangles.flatMap(t => t.p.map(p => p[2] - h0)));
  if (top <= 0) return triangles;
  const scale = plan.nativeEnvelopeM / top;
  return triangles.map(t => {
    const nz = t.n[2] / scale, length = Math.hypot(t.n[0], t.n[1], nz);
    const endDot = t.n[0]*rect.ux+t.n[1]*rect.uy;
    const sourceCrownShape = plan.kind === 'gable' && t.part === 'plate' && Math.abs(endDot) > .9 && plan.gableEnds?.[endDot < 0 ? 0 : 1] !== false ? plan.gable : undefined;
    return {...t, sourceCrownShape, p: t.p.map(([x,y,z]) => [x,y,h0+(z-h0)*scale]) as RoofTri['p'],
      n: [t.n[0]/length,t.n[1]/length,nz/length] as RoofTri['n']};
  });
}

/** A parapet round a footprint ring (mesh frame): outer and inner faces, a coping band and top. */
export function parapetTriangles(ring: readonly Vec2[], h0: number, hp: number, dims: RoofDims, trimHex: string, t = 0.25): RoofTri[] {
  const pts = openRing(ring), inner = insetRing(pts, t);
  if (!inner) return [];
  const s = new RoofSink({ cx: 0, cy: 0, ux: 1, uy: 0, len: 1, wid: 1, coverage: 1, maxDev: 0 }, h0, dims);
  const ccw = signedArea(pts) > 0, band = Math.min(0.16, hp * 0.3);
  let along = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length, a = pts[i], b = pts[j], a2 = inner[i], b2 = inner[j];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    const out: V3 = ccw ? [dy / l, -dx / l, 0] : [-dy / l, dx / l, 0];
    const zb = hp - band;
    s.quad([a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], zb], [a[0], a[1], zb], s.wallUv(along, 0), s.wallUv(along + l, 0), s.wallUv(along + l, zb), s.wallUv(along, zb), 'plate', out);
    s.quad([a[0], a[1], zb], [b[0], b[1], zb], [b[0], b[1], hp], [a[0], a[1], hp], [0, 0], [0, 0], [0, 0], [0, 0], 'trim', out, trimHex);
    s.quad([a2[0], a2[1], 0], [b2[0], b2[1], 0], [b2[0], b2[1], hp], [a2[0], a2[1], hp], s.wallUv(along, 0), s.wallUv(along + l, 0), s.wallUv(along + l, hp), s.wallUv(along, hp), 'plate', [-out[0], -out[1], 0]);
    s.quad([a[0], a[1], hp], [b[0], b[1], hp], [b2[0], b2[1], hp], [a2[0], a2[1], hp], [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [0, 0, 1], trimHex);
    along += l;
  }
  return s.out;
}

/** Clip admitted generated slopes to the actual surveyed footprint.
 * Approximate rectangular end closures can stick through a trapezoid's street wall;
 * native boundary closures replace them, while the source frontage owns its crown. */
function sourceRoofWithinOutline(triangles:RoofTri[],outline:Vec2[],h0:number,dims:RoofDims):RoofTri[] {
  const ring=openRing(outline),indices=earcut(ring.flat()),result:RoofTri[]=[];
  type Vertex={p:V3;uv:V2};
  const cross=(a:Vec2,b:Vec2,p:V3)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const ccw=signedArea(ring)>0;
  for(const t of triangles.filter(t=>t.part==='slope'))for(let k=0;k<indices.length;k+=3){
    const cut=[ring[indices[k]],ring[indices[k+1]],ring[indices[k+2]]];
    const sign=cross(cut[0],cut[1],[...cut[2],0])>=0?1:-1;
    let polygon:Vertex[]=t.p.map((p,i)=>({p,uv:t.uv[i]}));
    for(let e=0;e<3&&polygon.length;e++){
      const a=cut[e],b=cut[(e+1)%3],next:Vertex[]=[];
      for(let i=0;i<polygon.length;i++){
        const v=polygon[i],w=polygon[(i+1)%polygon.length],dv=cross(a,b,v.p)*sign,dw=cross(a,b,w.p)*sign;
        if(dv>=-1e-8)next.push(v);
        if((dv>=0)!==(dw>=0)){const f=dv/(dv-dw);next.push({p:v.p.map((x,j)=>x+(w.p[j]-x)*f) as V3,uv:v.uv.map((x,j)=>x+(w.uv[j]-x)*f) as V2});}
      }
      polygon=next;
    }
    if(polygon.length<3)continue;
    for(let i=1;i<polygon.length-1;i++){
      const p=[polygon[0].p,polygon[i].p,polygon[i+1].p] as RoofTri['p'];
      if(Math.abs(cross([p[0][0],p[0][1]],[p[1][0],p[1][1]],p[2]))<1e-8)continue;
      result.push({...t,p,uv:[polygon[0].uv,polygon[i].uv,polygon[i+1].uv]});
    }
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i].p,b=polygon[(i+1)%polygon.length].p,l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<1e-5)continue;
      const edge=ring.findIndex((v,j)=>Math.abs(cross(v,ring[(j+1)%ring.length],a))<1e-6&&Math.abs(cross(v,ring[(j+1)%ring.length],b))<1e-6);
      if(edge<0||Math.max(a[2],b[2])<=h0+1e-6)continue;
      const r0=ring[edge],r1=ring[(edge+1)%ring.length],dx=r1[0]-r0[0],dy=r1[1]-r0[1],el=Math.hypot(dx,dy),n:V3=ccw?[dy/el,-dx/el,0]:[-dy/el,dx/el,0];
      const aTop:V3=[a[0],a[1],Math.max(h0,a[2])],bTop:V3=[b[0],b[1],Math.max(h0,b[2])];
      let p:RoofTri['p']=[[a[0],a[1],h0],[b[0],b[1],h0],bTop],q:RoofTri['p']=[[a[0],a[1],h0],bTop,aTop];
      const facing=(b[0]-a[0])*n[1]-(b[1]-a[1])*n[0];if(facing>0){p=[p[0],p[2],p[1]];q=[q[0],q[2],q[1]];}
      for(const tri of [p,q]) {
        const ab=tri[1].map((v,i)=>v-tri[0][i]),ac=tri[2].map((v,i)=>v-tri[0][i]);
        if(Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])<1e-8)continue;
        result.push({p:tri,uv:tri.map(v=>[Math.hypot(v[0]-a[0],v[1]-a[1])/dims.bayM,(v[2]-h0)/dims.storeyM]) as RoofTri['uv'],n,part:'plate'});
      }
    }
  }
  return result;
}

/** Gable end slabs must stand on the surveyed wall, not the fitted box.
 * A small trapezoid error is visible as sky below the cornice in upward views.
 * Warp the complete connected piece between its actual end edges; heights,
 * trim, chimneys and roof material stay unchanged. */
function gablePieceOnNativeWalls(triangles:RoofTri[],rect:Rect,outline:Vec2[],plan:RoofPlan):RoofTri[] {
  const ring=openRing(outline),ccw=signedArea(ring)>0;
  const corners=(e:number):[Vec2,Vec2]=>[-1,1].map(v=>[rect.cx+rect.ux*e*rect.len/2-rect.uy*v*rect.wid/2,rect.cy+rect.uy*e*rect.len/2+rect.ux*v*rect.wid/2] as Vec2) as [Vec2,Vec2];
  const ends:[Vec2,Vec2][]=[corners(-1),corners(1)];let recovered=false;
  for(const e of [-1,1]){
    if(plan.gableEnds?.[e<0?0:1]===false)continue;
    const cx=rect.cx+rect.ux*e*rect.len/2,cy=rect.cy+rect.uy*e*rect.len/2;let nearest=1.05;
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      if(length<rect.wid*.6||length>rect.wid*1.5)continue;
      const nx=(ccw?dy:-dy)/length,ny=(ccw?-dx:dx)/length;
      if((nx*rect.ux+ny*rect.uy)*e<.9)continue;
      const distance=Math.hypot((a[0]+b[0])/2-cx,(a[1]+b[1])/2-cy);
      if(distance>=nearest)continue;nearest=distance;
      const av=-a[0]*rect.uy+a[1]*rect.ux,bv=-b[0]*rect.uy+b[1]*rect.ux;
      ends[e<0?0:1]=av<bv?[a,b]:[b,a];recovered=true;
    }
  }
  if(!recovered)return triangles;
  const at=([x,y,z]:V3):V3=>{
    const dx=x-rect.cx,dy=y-rect.cy,u=(dx*rect.ux+dy*rect.uy)/rect.len+.5,v=(-dx*rect.uy+dy*rect.ux)/rect.wid+.5;
    const a:Vec2=[ends[0][0][0]+(ends[0][1][0]-ends[0][0][0])*v,ends[0][0][1]+(ends[0][1][1]-ends[0][0][1])*v],b:Vec2=[ends[1][0][0]+(ends[1][1][0]-ends[1][0][0])*v,ends[1][0][1]+(ends[1][1][1]-ends[1][0][1])*v];
    return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,z];
  };
  return triangles.map(t=>{
    const p=t.p.map(at) as RoofTri['p'],a=p[1].map((v,i)=>v-p[0][i]),b=p[2].map((v,i)=>v-p[0][i]),n:V3=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],l=Math.hypot(...n);
    return {...t,p,n:n.map(v=>v/l) as V3};
  });
}

/**
 * The whole roof of a building in the mesh frame: `outer` is its outer ring in
 * lng/lat, `origin` and `kx` (metres per degree of longitude there) the mesh
 * frame. A plan's pieces and turret live in the footprint frame of
 * `localOuterRing` (metres about the ring's first vertex) and are carried over.
 */
export function roofTrianglesForOutline(outer: readonly number[][], origin: { lng: number; lat: number }, plan: RoofPlan, h0: number, dims: RoofDims, kx: number): RoofTri[] {
  if (outer.length < 4) return [];
  if(plan.repeatedTerrace)return repeatedTerraceRoofTriangles(outer,origin,plan.repeatedTerrace,h0,plan.riseM,dims,kx);
  const toMesh = ([lng, lat]: readonly number[]): Vec2 => [(lng - origin.lng) * kx, (lat - origin.lat) * M_PER_DEG_LAT];
  const mesh = outer.map(toMesh);
  if (plan.perimeterInsetM !== undefined) {
    const ring = openRing(mesh), inner = insetRing(ring, plan.perimeterInsetM);
    if (!inner) return [];
    const s = new RoofSink({ cx: 0, cy: 0, ux: 1, uy: 0, len: 1, wid: 1, coverage: 1, maxDev: 0 }, h0, dims);
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      s.slopePoly([[...ring[i], 0], [...ring[j], 0], [...inner[j], plan.riseM], [...inner[i], plan.riseM]], [0, 0, 1]);
    }
    s.slopePoly(inner.map(([x, y]) => [x, y, plan.riseM]), [0, 0, 1]);
    return s.out;
  }
  if (plan.kind === 'parapet') return parapetTriangles(mesh, h0, plan.parapetM ?? plan.riseM, dims, plan.trimHex ?? TRIM_WHITE);
  if (!plan.pieces) { const rect = fitRect(mesh); return rect ? roofTriangles(rect, plan, h0, dims) : []; }
  const [lng0, lat0] = outer[0], sx = kx / (111_320 * Math.cos(lat0 * Math.PI / 180)), [x0, y0] = mesh[0];
  const at = (x: number, y: number): Vec2 => [x0 + x * sx, y0 + y];
  void lng0;
  const mapRect = (r: Rect): Rect => {
    const [cx, cy] = at(r.cx, r.cy), ax = r.ux * sx, ay = r.uy, al = Math.hypot(ax, ay), bl = Math.hypot(r.uy * sx, r.ux);
    return { ...r, cx, cy, ux: ax / al, uy: ay / al, len: r.len * al, wid: r.wid * bl };
  };
  const out: RoofTri[] = [];
  // The admitted exact frontage owns its street crown. Inscribed roof ends
  // behind it are plain closures, never a second shaped crown in the sky.
  for (const piece of plan.pieces) {
    const innerPlan = plan.sourceCrownFront ? {...piece.plan, kind: piece.plan.kind === 'gable' ? 'pitched' as const : piece.plan.kind, accents:false, sourceCrownFront:undefined} : piece.plan;
    const rect=mapRect(piece.rect),triangles=roofTriangles(rect,innerPlan,h0,dims);
    out.push(...(!plan.sourceCrownFront&&['gable','pitched','halfHipped','mansard'].includes(piece.plan.kind)?gablePieceOnNativeWalls(triangles,rect,mesh,piece.plan):triangles));
  }
  if(plan.sourceCrownFront) {
    const clipped=sourceRoofWithinOutline(out,mesh,h0,dims);out.length=0;out.push(...clipped);
    const front=plan.sourceCrownFront,a=at(...front.start),b=at(...front.end),width=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const nx=front.normal[0]*sx,ny=front.normal[1],nl=Math.hypot(nx,ny),ux=nx/nl,uy=ny/nl;
    const rect:Rect={cx:(a[0]+b[0])/2-ux*.16,cy:(a[1]+b[1])/2-uy*.16,ux,uy,len:.32,wid:width,coverage:1,maxDev:0};
    const sink=new RoofSink(rect,h0,dims),prof=gableProfile(front.shape,width,plan.riseM),f=.16;
    gableSlab(sink,prof,1,.32,plan.accents?'trim':'plate',plan.trimHex);
    if(plan.accents) {
      if(front.shape==='cornice') {
        // Observed fronts need a readable ledge, not the stock deep cornice's
        // broad white belt. Keep the same top/envelope and closed masonry slab;
        // these display proportions apply only to an admitted source frontage.
        const top=corniceHeight(plan.riseM),trim=plan.trimHex??TRIM_WHITE,half=width/2;
        sink.box(f,f+.18,-half-.05,half+.05,top-.20,top+.05,'trim',trim);
        const band=(v0:number,v1:number,z0:number,z1:number)=>sink.quad(
          [f+.012,v0,z0],[f+.012,v1,z0],[f+.012,v1,z1],[f+.012,v0,z1],
          [0,0],[0,0],[0,0],[0,0],'decal',[1,0,0],trim);
        band(-half,half,top-.34,top-.24);
        for(const side of [-1,1])band(side<0?-half:half-.16,side<0?-half+.16:half,-1.6,top-.24);
      } else gableAccents(sink,{shape:front.shape,prof,f,e:1,W:width,R:plan.riseM,trimHex:plan.trimHex??TRIM_WHITE,shutterHex:'',shutters:false,claws:front.shape==='raisedNeck'?clawArcs(width,plan.riseM):undefined,crownBase:crownBaseOf(front.shape,width,plan.riseM)});
    }
    const top=Math.max(...sink.out.flatMap(t=>t.p.map(p=>p[2]-h0)));
    // Cornices sit below the hidden rear ridge; raised silhouettes own the full envelope.
    const envelope=front.shape==='cornice'?Math.min(plan.riseM,corniceHeight(plan.riseM)+.05):plan.riseM;
    const scale=envelope/top;
    out.push(...sink.out.map(t=>{const nz=t.n[2]/scale,l=Math.hypot(t.n[0],t.n[1],nz);return {...t,p:t.p.map(([x,y,z])=>[x,y,h0+(z-h0)*scale]) as RoofTri['p'],n:[t.n[0]/l,t.n[1]/l,nz/l] as V3,sourceCrownShape:front.shape,sourceCrownPairedOculi:front.pairedOculi};}));
  }
  if (plan.turret) {
    const main = mapRect(plan.pieces[0].rect), [tx, ty] = at(plan.turret.x, plan.turret.y);
    const s = new RoofSink(main, h0, dims), du = tx - main.cx, dv = ty - main.cy;
    buildTurret(s, du * main.ux + dv * main.uy, -du * main.uy + dv * main.ux, plan.turret.r, plan.riseM, plan.trimHex ?? TRIM_WHITE);
    out.push(...s.out);
  }
  return out;
}
void outlineBand;

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
  const tag = typeof p.roofShapeTag === 'string' ? p.roofShapeTag : typeof p.roofShape === 'string' && !p.roofPlanned ? p.roofShape : undefined;
  const year = p.constructionYear === null || p.constructionYear === undefined ? null : Number(p.constructionYear);
  const measured = typeof p.monumentGable === 'string' && (GABLE_SHAPES as readonly string[]).includes(p.monumentGable) ? p.monumentGable as GableShape : null;
  const plan = planBuildingRoof(String(p.id ?? ''), String(p.facadeStyle ?? ''), height, minHeight, ring, tag && honouredRoofTag(tag) ? tag : undefined, Number.isFinite(year) ? year : null, measured);
  const g = feature.geometry as { type: string; coordinates: number[][][] | number[][][][] };
  const polygon = g.type === 'Polygon' ? g.coordinates : g.coordinates[0];
  // A perimeter deck must not cover an open courtyard.
  return plan?.perimeterInsetM !== undefined && polygon.length > 1 ? null : plan;
}

/**
 * Tile decorator for the three.js looks: buildings that get a real roof have
 * their plain wall lowered to the eaves (`roofEavesHeightM`, which the wall-top
 * expression already honours) and stop drawing the flat lid (a shaped
 * `roofShape`). A mapped OSM `roofShape` we can draw (gabled, hipped,
 * quadruple_saltbox...) picks the kind and is kept as `roofShapeTag`.
 * Measured eaves and anything without a facade are left alone.
 */
export function decorateRoof<T extends GeoFeature>(feature: T): T {
  const p = feature.properties;
  if (!p.facade || p.roofPlanned) return feature;
  // A measured eaves height is never overridden; an OSM roof shape we can draw is honoured, others left alone.
  const tagged = p.roofShape !== undefined && p.roofShape !== null && p.roofShape !== '' && p.roofShape !== 'flat';
  if (Number(p.roofEavesHeightM) > 0 || (tagged && !honouredRoofTag(p.roofShape) && !p.monumentGable)) return feature;
  const plan = roofPlanForFeature(feature);
  if (!plan) return feature;
  const props: Record<string, unknown> = { ...p, roofPlanned: true, roofShape: plan.kind, roofEavesHeightM: Number(p.height) - plan.riseM };
  if (tagged) props.roofShapeTag = p.roofShape;
  return { ...feature, properties: props as T['properties'] };
}

/**
 * Landmarks keep their own form: churches, museums, Centraal. Wrap a tile
 * decorator so any building in `ids` (the resolved landmark buildings) is
 * passed through untouched, with no generic facade or roof. `ids` is read at
 * call time, so it can fill in after the decorator is installed.
 *
 * Unless a kit models it (`modelled`), a landmark used to stand as one bare box in the
 * unmeasured identity palette (user 2026-10-03, after Fatih's 37 m green block: "More?
 * Landmarks?"). Now an old landmark the size of a house (built before 1945, at most
 * 26 m: Felix Meritis, a canal-house museum) takes the generic period facade and roof,
 * and a larger one keeps its bare form in period brick or concrete instead of a palette guess.
 * `listed`: landmark buildings in the monuments register (monument-gables.json), counted as old.
 */
export const OLD_LANDMARK_MAX_M = 26;
const UNMODELLED_OLD_WALL = '#7a4535', UNMODELLED_NEW_WALL = '#b9ad9a';
export function exceptLandmarks<T extends GeoFeature>(decorate: (feature: T) => T, ids: ReadonlySet<string>, modelled: ReadonlySet<string> = new Set(), listed: ReadonlySet<string> = new Set()): (feature: T) => T {
  return (feature: T) => {
    const id = String(feature.properties.id ?? '');
    // A kit part is the kit's own, landmark list or not: the Beurs van Berlage is not in the landmark
    // list, so its halls took house windows under the kit roofs (user 2026-10-03: "why does it have windows???").
    if (modelled.has(id)) return feature;
    if (!ids.size || !ids.has(id)) return decorate(feature);
    const p = feature.properties, height = Number(p.height), year = Number(p.constructionYear);
    const dated = p.constructionYear !== null && p.constructionYear !== undefined && Number.isFinite(year);
    if (dated && year < 1945 && height <= OLD_LANDMARK_MAX_M) return decorate(feature);
    // Not the generic facade for the big ones: tried 2026-10-03, Carré and the Oosterkerk read as nine-storey flats.
    // A listed landmark is old whatever BAG says: its year is often a restoration (Carré, the Oosterkerk).
    const old = (dated && year < 1945) || listed.has(id);
    const guessed = typeof p.appearanceStyleSource === 'string' && p.appearanceStyleSource.includes('not-measured');
    const wall = old ? UNMODELLED_OLD_WALL : UNMODELLED_NEW_WALL;
    // Not a bare box either (user 2026-10-09: big flat-coloured blocks between modelled canal
    // houses): the large-building tier gives it civic storeys, a plinth and a parapet in that colour.
    const coloured = guessed ? { ...p, sideColour: wall, groundColour: wall } : p;
    return { ...feature, properties: largeTierProperties(coloured, wall, listed.has(id)) as T['properties'] };
  };
}
