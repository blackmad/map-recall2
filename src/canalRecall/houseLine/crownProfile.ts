/**
 * Lane 1 step c (Haarlemmerdijk renderer, 2026-11-13): measured crown profiles for a gabled street front, drawn by the
 * roof planner in place of its own `gableProfile` when a front record states the crown (roofMesh `plan.rowCrown`, set by
 * houseLine/rowFront.ts behind the rowFront flag). Absent: nothing here runs.
 *
 * The planner's own neck is shoulders that ride the roof slope with a square box on top (the "stovepipe hat" on 167818,
 * 176174, 176175); its bell and step take their size from the roof's rise. Here every profile is sized from the record:
 * the crown's rise above the foot (`riseM`), the foot width (`footW`, the full front when unread) and the neck or cap
 * width (`neckW`), symmetric, and the saddle behind it is lowered to sit inside it (`rowCrownRoofRise`).
 *
 *   neck  - claw shoulders (white scroll pieces, klauwstukken) from the foot to an upright neck, a white pediment cap;
 *   bell  - S-curved shoulders sweeping in to the cap width, closed by an arch, white blocks at the shoulders;
 *   point - a plain triangle on the saddle itself, white verge;
 *   step  - treads up to a flat top of the neck width, a white coping on each;
 *   raised - a straight cornice front with a raised centre piece (a crowned, lantern, pediment or box dormer standing on
 *            the cornice, HD22, HD12, HD6): a full-width cornice band, the piece with a window or hoist door and a cap.
 * Each gets white edge trim and, when the record reads one, an attic light or a hoist door in the crown.
 */
import type { RoofSink, V2, V3 } from '../roofSink.js';
import { canalhouseCrownProfile, capRiseOf, crownProfile, type CanalhousePoint } from '../crownOutline.js';
import type { FrontIntent } from '../buildingRecipe/intent.js';

export type RowCrownShape = 'neck' | 'bell' | 'point' | 'step' | 'raised' | 'spout';
/** The shapes a lane 2 front record's measured crown draws (unchanged: a spout there keeps the planner's gable). */
export const ROW_CROWN_SHAPES: readonly RowCrownShape[] = ['neck', 'bell', 'point', 'step', 'raised'];
/** House rows: every shape a stated gable (RowDesign.gable) draws, the spout (tuitgevel) included. */
export const ROW_GABLE_SHAPES: readonly RowCrownShape[] = [...ROW_CROWN_SHAPES, 'spout'];
/** Brick of a chimney stack on a crown, and its stone cap. */
const CHIMNEY_HEX = '#6a4034', CHIMNEY_CAP_HEX = '#d9d3c7';
/** A stack on the crown's top, just behind the front plane: four brick sides, a stone cap. */
function chimneyStack(s: RoofSink, ch: { topM: number; widthM: number }, f: number, e: number, T: number, cap: number): void {
  const hw = Math.max(0.2, ch.widthM / 2), uf = f - e * 0.12, ub = f - e * (0.12 + Math.max(0.45, ch.widthM * 0.8)), z0 = Math.max(0, T - cap - 0.4), z1 = ch.topM;
  const box = (zb: number, zt: number, grow: number, hex: string) => {
    const a = uf + e * grow, b = ub - e * grow, w = hw + grow;
    s.quad([a, -w, zb], [a, w, zb], [a, w, zt], [a, -w, zt], [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [e, 0, 0], hex);
    s.quad([b, w, zb], [b, -w, zb], [b, -w, zt], [b, w, zt], [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [-e, 0, 0], hex);
    s.quad([b, -w, zb], [a, -w, zb], [a, -w, zt], [b, -w, zt], [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [0, -1, 0], hex);
    s.quad([a, w, zb], [b, w, zb], [b, w, zt], [a, w, zt], [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [0, 1, 0], hex);
    s.quad([a, -w, zt], [a, w, zt], [b, w, zt], [b, -w, zt], [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [0, 0, 1], hex);
  };
  box(z0, z1 - 0.12, 0, CHIMNEY_HEX);
  box(z1 - 0.12, z1, 0.06, CHIMNEY_CAP_HEX);
}
/** Traced attic lights on the crown's face (seen x mirrored onto the end's v axis), each kept inside the profile. */
function tracedLights(s: RoofSink, lights: ReadonlyArray<readonly [number, number, number, number]>, prof: readonly V2[], f: number, e: number, trimHex: string): void {
  const fr = 0.07;
  for (const [x0, x1, z0, top] of lights) {
    // A light reaching into the cap stops where the profile still holds it with its frame.
    let z1 = top, sp = spanAt(prof, z1 + fr);
    while (z1 - z0 >= 0.25 && (!sp || sp[1] - sp[0] < 0.6)) { z1 -= 0.05; sp = spanAt(prof, z1 + fr); }
    if (!sp || z1 - z0 < 0.25 || x1 - x0 < 0.2) continue;
    // Viewed from outside the end (normal e along u), the viewer's right is +v when e > 0.
    const [v0, v1] = e > 0 ? [x0, x1] : [-x1, -x0];
    const a = Math.max(v0, sp[0] + 0.12), b = Math.min(v1, sp[1] - 0.12);
    if (b - a < 0.2) continue;
    rect(s, f, e, a - fr, b + fr, z0 - fr, z1 + fr, trimHex);
    rect(s, f, e, a, b, z0, z1, GLASS, PROUD_HI);
    rect(s, f, e, a - fr - 0.05, b + fr + 0.05, z0 - fr - 0.07, z0 - fr, trimHex, PROUD_HI);
    rect(s, f, e, a, b, (z0 + z1) / 2 - 0.025, (z0 + z1) / 2 + 0.025, trimHex, PROUD_HI + 0.004);
  }
}
export interface RowCrown {
  shape: RowCrownShape;
  /** Crown top above its foot (the wall's eaves), metres. */
  riseM: number;
  /** Width of the crown at its foot; the whole front when unread. */
  footW?: number;
  /** A crown narrower than its front standing off centre (design units, Jan Luijkenstraat 160504/166029): its centre's
   *  shift from the front's centre along the end's v axis (m), kept inside the front. Absent: centred, byte-identical. */
  offsetM?: number;
  /** Neck (neck gable), cap (bell) or top tread (step) width. */
  neckW?: number;
  /** Attic lights read in the crown (0 = none, absent = unread: one light where it fits). */
  attic?: number;
  /** Traced attic lights, [x0, x1, z0, z1]: x across the crown as seen from the street (0 = its centre, left negative),
   *  z above its foot. Drawn instead of the counted centred light. */
  lights?: Array<[number, number, number, number]>;
  /** A chimney stack standing on the crown: its top above the crown's foot and its width (m). */
  chimney?: { topM: number; widthM: number };
  hoist?: boolean;
  /** Step gable: the treads up each side as read on the photo (absent: one per ~0.85 m of rise, 2 to 5). */
  steps?: number;
  /** Raised centre: the cornice band's height over the wall's eaves (the band covers the low saddle behind it). */
  bandM?: number;
  /** Raised centre on a front standing mid-run (house rows' raised fronts): the plate starts at its foot. */
  onWall?: boolean;
  /** Raised centre: the piece's cap (a pediment, a segmental arch, or a flat cornice cap). Neck and bell (house rows'
   *  stated gable): the neck's cap, the kit's crownCap (absent: the kit's stock pediment on a neck, rounded on a bell). */
  cap?: 'pediment' | 'segmental' | 'rounded' | 'flat';
  /** Neck and bell: where the shoulders end, as a share of the rise (the kit's crownShoulderRise; absent: its stock). */
  shoulderRise?: number;
  /** White stone finials: on each tread's outer corner (step), at the shoulders' feet (neck, bell, spout). */
  finials?: boolean;
  /** Step: the lowest tread each side is a sloped shoulder from the foot to the first riser's top (Kinkerstraat 67). */
  shoulder?: 'sloped';
  /** The attic light's head: a round or segmental arch (absent: square). */
  atticHead?: 'round' | 'segmental';
  /** A small round-headed light over the attic light, high in the neck (stated per house). */
  upperLight?: boolean;
  /** House rows: the gable's white sandstone with thickness (copings, treads, klauwstukken, cap); absent: flat white edges. */
  stone?: { copingM?: number; claws?: boolean | 'carved'; crest?: 'pediment' | 'segmental' | 'crest'; hood?: 'dark' | string; neck?: 'panel' | 'cartouche' | 'oculus'; cap?: 'shell' | 'carved'; festoon?: boolean; shoulders?: 'oval' };
  /** `belt`: the canal belt's gable dress (BELT_GABLE). Absent: the kit's stock outlines and trim, byte-identical. */
  dress?: 'belt';
}
/**
 * The canal belt's gable outlines (lane D, 2026-11-15; David on #391: "Gables still look pretty bad"), from the Herengracht
 * 25-73 cuts beside the sheets. Outline proportions only; the trim (claws, copings, caps, finials) is lane R's.
 *   neck  - the neck stands tall on low claw pieces (shoulders at 0.22 of the rise: the photos measure 0.17 on 55 and
 *           0.3 on 31; the kit's 0.45 made a wide trapezoid); a segmental cap a sixth of the rise high;
 *   bell  - the arched crest narrower than the bell's body (0.72), so a ledge shows at its springing; a cap a fifth of
 *           the rise;
 *   step  - treads about 0.6 m high (3-7 a side; the kit's 0.85 m drew three broad steps on Herengracht 27's six);
 *   spout - the upright top a fifth of the rise (0.5-0.9 m; the kit's third drew a chimney).
 */
export const BELT_GABLE = { tread: 0.6, steps: [3, 7], neckShoulder: 0.22, neckCap: [0.16, 0.7], bellCrest: 0.72, bellCap: [0.2, 0.9], spoutTop: [0.2, 0.5, 0.9] } as const;
export function isRowCrown(v: unknown): v is RowCrown {
  const c = v as RowCrown | null;
  return !!c && typeof c === 'object' && (ROW_GABLE_SHAPES as readonly string[]).includes(c.shape) && Number.isFinite(c.riseM) && c.riseM > 0.5;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The sizes every profile and its trim agree on, for a front `W` wide. */
export function crownDims(c: RowCrown, W: number) {
  const half = W / 2, T = c.riseM;
  const foot = clamp(c.footW ?? W, Math.min(W, 1.6), W) / 2;
  const defaultNeck = c.shape === 'raised' ? clamp(W * 0.32, 1.1, 2.4) : c.shape === 'bell' ? foot * 0.46 : c.shape === 'step' ? foot * 0.3 : c.shape === 'spout' ? foot * 0.32 : foot * 0.5; // the kit's stock shares (crownOutline neckShare, trap 0.3)
  const belt = c.dress === 'belt' && (c.shape === 'neck' || c.shape === 'bell');
  // The belt's neck and bell: the neck as wide as the profile draws it (the kit's stock share of the foot when unread).
  const neck = clamp((c.neckW ?? (belt ? 2 * foot * (c.shape === 'bell' ? 0.46 : 0.5) : defaultNeck)) / 2, 0.45, foot * 0.8);
  // Neck and bell: the kit's stock cap rise (crownOutline capRiseOf), so the trim and the opening follow its outline.
  const kitCap = (c.shape === 'neck' || c.shape === 'bell') ? capRiseOf({ gable: c.shape, ...(c.cap ? { crownCap: c.cap } : {}) } as unknown as FrontIntent, T, 2 * foot) : 0;
  const B = BELT_GABLE;
  const cap = belt ? (c.shape === 'bell' ? clamp(T * B.bellCap[0], 0.3, B.bellCap[1]) : clamp(T * B.neckCap[0], 0.3, B.neckCap[1]))
    : c.shape === 'neck' || c.shape === 'bell' ? kitCap : c.shape === 'raised' ? clamp(c.cap === 'flat' ? 0.25 : neck * 0.55, 0.2, Math.min(0.6, (T - (c.bandM ?? 0.5)) * 0.35)) : 0;
  const steps = c.shape === 'step' ? (c.steps && c.steps >= 1 ? clamp(Math.round(c.steps), 1, 8) : c.dress === 'belt' ? clamp(Math.round(T / B.tread), B.steps[0], B.steps[1]) : clamp(Math.round(T / 0.85), 2, 5)) : 0;
  return { half, T, foot, neck, cap, steps };
}

/** The saddle's rise behind the crown: its ridge meets the crown under its top, and its slope stays inside the profile. */
export function rowCrownRoofRise(c: RowCrown, W: number): number {
  const d = crownDims(c, W);
  if (c.shape === 'point') return r3(d.T);
  if (c.shape === 'raised') return r3(Math.max(0.2, (c.bandM ?? 0.5) - 0.06));
  if (c.shape === 'neck') return r3(Math.max(0.8, d.T - d.cap - 0.15));
  if (c.shape === 'bell') return r3(Math.max(0.8, d.T - 0.3));
  // Step: the highest ridge whose slope passes under every tread's inner corner (0.1 m clear).
  const prof = rowCrownProfile(c, W, 0);
  let R = d.T - 0.2;
  for (const [x, y] of prof) if (Math.abs(x) < d.half - 1e-6 && y > 0) R = Math.min(R, (y - 0.1) / (1 - Math.abs(x) / d.half));
  return r3(Math.max(0.8, R));
}

/** A crown plate's outline above the eaves, x across (-W/2..W/2, never going back), y up; at or above the saddle `R`.
 *  The outline itself is the kit's (crownOutline.ts, one definition for the kit and this renderer): its neck, bell,
 *  point and step at the kit's stock shoulders and caps, and its cornice-with-cap for the raised centre. Here it is only
 *  placed on the foot, centred, and kept over the saddle behind it. */
/** The kit's outlines want a positive eaves height: they are drawn this far up and moved back down. */
const KIT_Z = 10;

/** A narrower crown's shift off the front's centre, kept inside the front (0 when centred or as wide as the front). */
export const crownOffset = (c: RowCrown, W: number): number => { const { half, foot } = crownDims(c, W); return c.offsetM ? clamp(c.offsetM, -(half - foot), half - foot) : 0; };
export function rowCrownProfile(c: RowCrown, W: number, R: number): V2[] {
  const d = crownDims(c, W), { half, T, foot, neck } = d, off = crownOffset(c, W);
  const slope = (x: number) => R * (1 - Math.abs(x) / half);
  // Outside a narrower crown's foot: the roof's cheek, the plate just covering the slope (off centre: the lower side's).
  const y0 = foot < half - 0.01 ? Math.min(slope(-foot + off), slope(foot + off)) + 0.04 : 0;
  let kit: CanalhousePoint[] | null, x0: number;
  if (c.shape === 'raised') {
    const b = c.bandM ?? 0.5, flat = c.cap === 'flat';
    // The outline's ends: KIT_Z under the foot (a whole front's plate, its ends inside the party walls), or at the foot
    // for a front standing mid-run (`onWall`), whose plate ends would otherwise show as risers down the wall below it.
    const end = c.onWall ? KIT_Z : -KIT_Z;
    kit = [[0, end], ...canalhouseCrownProfile('lijst', 2 * half, b + KIT_Z, T + KIT_Z, 2 * neck, b + KIT_Z, 0, { cap: flat ? 'flat' : c.cap === 'pediment' ? 'pediment' : 'segmental', capRiseM: flat ? 0 : d.cap, crestWidthM: 2 * neck }), [2 * half, end]];
    x0 = -half;
  } else {
    const necked = c.shape === 'neck' || c.shape === 'bell';
    if (necked && c.dress === 'belt') {
      // The belt's neck and bell (BELT_GABLE): the kit's own outline maths, at the belt's shoulders, crest and cap.
      const b = y0 + KIT_Z, t = T + KIT_Z, bell = c.shape === 'bell', sr = c.shoulderRise ?? (bell ? 0.55 : BELT_GABLE.neckShoulder);
      kit = canalhouseCrownProfile(bell ? 'klok' : 'hals', 2 * foot, b, t, 2 * neck, b + (T - y0) * sr, 0,
        { cap: c.cap ?? (bell ? 'rounded' : 'segmental'), capRiseM: Math.min(d.cap, (T - y0) * (1 - sr)), crestWidthM: bell ? 2 * neck * BELT_GABLE.bellCrest : 2 * neck, shoulder: 'concave' });
    } else
    kit = crownProfile({ gable: c.shape, ...(c.neckW ? { crownNeckWidth: neck / foot } : {}), crownSteps: d.steps || undefined,
      ...(necked && c.cap ? { crownCap: c.cap } : {}), ...(necked && c.shoulderRise ? { crownShoulderRise: c.shoulderRise } : {}) } as unknown as FrontIntent, 2 * foot, y0 + KIT_Z, T + KIT_Z);
    x0 = -foot;
    // The spout (tuitgevel, Herengracht 71/73): straight rakes up to small shoulders, then a narrow upright top the neck's
    // width, about a third of the rise tall (the kit's tuit drew a truncated point, its top a third of the front wide).
    if (c.shape === 'spout') {
      const b = y0 + KIT_Z, t = T + KIT_Z, sy = t - spoutTop(c), ledge = clamp(foot * 0.08, 0.12, 0.25);
      kit = [[0, b], [foot - neck - ledge, sy], [foot - neck, sy], [foot - neck, t], [foot + neck, t], [foot + neck, sy], [foot + neck + ledge, sy], [2 * foot, b]];
    }
    // A sloped shoulder: the eaves-level corners under the first risers go, so the foot runs straight to the riser's top.
    if (kit && c.shape === 'step' && c.shoulder === 'sloped') { const base = y0 + KIT_Z, w = 2 * foot; kit = kit.filter(([x, y]) => !(Math.abs(y - base) < 1e-6 && x > 1e-6 && x < w - 1e-6)); }
  }
  if (!kit) return [[-half, 0], [half, 0]];
  const out: V2[] = [];
  const push = (x: number, y: number) => {
    const p: V2 = [x, Math.abs(x) < half - 1e-6 ? Math.max(y, slope(x) + 0.04) : y];
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > 1e-9 || Math.abs(q[1] - p[1]) > 1e-9) out.push(p);
  };
  if (c.shape !== 'raised') { push(-half, 0); if (foot < half - 0.01) push(-foot + off, y0); }
  // Never back: a point left of the last one moves onto it (the kit's outlines are single-valued already).
  for (const [x, y] of kit) push(Math.max(out.length ? out[out.length - 1][0] : -Infinity, x + x0 + off), y - KIT_Z);
  if (c.shape !== 'raised') { if (foot < half - 0.01) push(foot + off, y0); push(half, 0); }
  return out;
}

/** The spout's upright top: a third of the rise (0.8-1.4 m), the belt's a fifth (0.5-0.9 m). */
const spoutTop = (c: RowCrown) => c.dress === 'belt' ? clamp(c.riseM * BELT_GABLE.spoutTop[0], BELT_GABLE.spoutTop[1], BELT_GABLE.spoutTop[2]) : clamp(c.riseM * 0.3, 0.8, 1.4);
const PROUD = 0.014, PROUD_HI = 0.026;
const GLASS = '#272c33';

function rect(s: RoofSink, f: number, e: number, v0: number, v1: number, z0: number, z1: number, hex: string, proud = PROUD): void {
  const u = f + e * proud;
  s.quad([u, v0, z0], [u, v1, z0], [u, v1, z1], [u, v0, z1], [0, 0], [0, 0], [0, 0], [0, 0], 'decal', [e, 0, 0], hex);
}
function fan(s: RoofSink, f: number, e: number, centre: V2, rim: readonly V2[], hex: string): void {
  const u = f + e * PROUD_HI;
  for (let i = 0; i < rim.length - 1; i++) s.tri([u, centre[0], centre[1]], [u, rim[i][0], rim[i][1]], [u, rim[i + 1][0], rim[i + 1][1]], [0, 0], [0, 0], [0, 0], 'decal', [e, 0, 0], hex);
}
/** A band `bw` wide just inside the outline, over the crown's own edges (not the roof cheeks outside its foot). */
function edgeBand(s: RoofSink, prof: readonly V2[], f: number, e: number, bw: number, foot: number, hex: string): void {
  const u = f + e * PROUD;
  for (let i = 0; i < prof.length - 1; i++) {
    const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
    if ((y0 < 0.02 && y1 < 0.02) || Math.max(Math.abs(x0), Math.abs(x1)) > foot + 0.01 && Math.min(Math.abs(x0), Math.abs(x1)) >= foot - 0.01) continue;
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
    if (l < 1e-4) continue;
    const nx = dy / l, ny = -dx / l;
    const a: V3 = [u, x0, y0], b: V3 = [u, x1, y1], c: V3 = [u, x1 + nx * bw, Math.max(0, y1 + ny * bw)], dd: V3 = [u, x0 + nx * bw, Math.max(0, y0 + ny * bw)];
    s.quad(a, b, c, dd, [0, 0], [0, 0], [0, 0], [0, 0], 'decal', [e, 0, 0], hex);
  }
}
/** Left and right extent of the profile at height y. */
function spanAt(prof: readonly V2[], y: number): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < prof.length - 1; i++) {
    const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
    if ((y0 <= y && y1 >= y) || (y1 <= y && y0 >= y)) {
      if (Math.abs(y1 - y0) < 1e-9) { lo = Math.min(lo, x0, x1); hi = Math.max(hi, x0, x1); continue; }
      const x = x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    }
  }
  return hi > lo ? [lo, hi] : null;
}

/** An arch `hw` half-wide rising `rise` over the springing z (a half ellipse), filled, on the end at u = f. */
function arch(s: RoofSink, f: number, e: number, hw: number, rise: number, z: number, hex: string, proud: number): void {
  const u = f + e * proud, n = 12;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI * i / n, a1 = Math.PI * (i + 1) / n;
    s.tri([u, 0, z], [u, hw * Math.cos(a0), z + rise * Math.sin(a0)], [u, hw * Math.cos(a1), z + rise * Math.sin(a1)], [0, 0], [0, 0], [0, 0], 'decal', [e, 0, 0], hex);
  }
}
/** Stone finials (a post and a ball cap) standing on a crown: each step's outer top corner, or the shoulders' tops beside
 *  the neck (neck, bell, spout). */
export const ROW_FINIAL = { w: 0.16, h: 0.38, capW: 0.26, capH: 0.16 } as const;
function finials(s: RoofSink, c: RowCrown, prof: readonly V2[], f: number, e: number, foot: number, neck: number, trimHex: string): void {
  const F = ROW_FINIAL, at: V2[] = [];
  if (c.shape === 'step') {
    // A riser's top: the vertex whose neighbour on the outer side is directly below it.
    for (let i = 1; i < prof.length - 1; i++) {
      const [x, y] = prof[i], p = prof[i - 1], q = prof[i + 1];
      if (y < 0.05 || Math.abs(x) > foot + 1e-6) continue;
      const outer = x < 0 ? p : q;
      if (Math.abs(outer[0] - x) < 1e-6 && outer[1] < y - 0.05) at.push([x < 0 ? x + F.w / 2 : x - F.w / 2, y]);
    }
  } else for (const sg of [-1, 1]) {
    // The shoulder's top: the outline's highest point outside the neck on this side.
    const side = prof.filter(([x]) => sg * x >= neck + F.capW && sg * x <= foot + 1e-6);
    if (!side.length) continue;
    const top = side.reduce((a, b) => b[1] > a[1] ? b : a);
    at.push([top[0] + sg * F.w / 2, top[1]]);
  }
  for (const [x, y] of at) {
    rect(s, f, e, x - F.w / 2, x + F.w / 2, y, y + F.h, trimHex, PROUD_HI);
    rect(s, f, e, x - F.capW / 2, x + F.capW / 2, y + F.h, y + F.h + F.capH, trimHex, PROUD_HI);
  }
}

/** The gable's stone with thickness (RowCrown.stone, or the belt dress): how far each piece stands proud of the brick,
 *  and how far behind the front it reaches (`back`: past the plate, whose depth is `plate` for a stone crown). */
export const ROW_STONE = { plate: 0.45, back: 0.2, coping: 0.06, overhang: 0.03, copingW: 0.08, claw: 0.16, bellClaw: 0.12, clawProud: 0.04, piece: 0.06,
  volute: 0.08, voluteK: 0.75, cap: 0.08, capBand: 0.14, capOver: 0.1, ledge: 0.1, ledgeH: 0.12, band: 0.1,
  /** Shoulder ovals: half-height (m), width to height, how proud. */
  oval: { ry: 0.3, k: 0.78, out: 0.05, under: 0.22 },
  /** A neck festoon: leaf radius, the garland's sag, the side drops' length, the centre pendant's height (m). */
  festoon: { r: 0.1, sag: 0.3, drop: 0.95, pend: 0.24, out: 0.07 } } as const;
/** The stone a crown draws: its stated stone, else the belt dress's (claws, the crest a bell or step stands under). */
export function rowCrownStone(c: RowCrown): NonNullable<RowCrown['stone']> | undefined {
  if (c.shape === 'raised') return undefined;
  if (c.stone) return c.stone;
  if (c.dress !== 'belt') return undefined;
  return c.shape === 'bell' || c.shape === 'step' ? { crest: 'crest' } : {};
}
/** The belt's sandstone: the trim white mixed this far toward a bright warm white, and the values the pieces walk
 *  through, so the stone reads as stone rather than one paint. Blind A/Bs 2026-11-15: a cooler near-white (0.3 toward
 *  #d6d8d6) lost 0-6 to a warm grey-buff (0.18 toward #c9bda6); per-face shading by orientation lost 0-5-1 (returns read
 *  into the sky); this brighter warm white beat the buff 5-1 (the one loss a dim, overcast photo). */
export const ROW_STONE_WEATHER = { hex: '#f7efdd', mix: 0.35, values: [1.02, 0.99, 1.04, 1, 0.97, 1.03, 1] } as const;
function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [x, y] = [p(a), p(b)];
  if (x.some(v => !Number.isFinite(v)) || y.some(v => !Number.isFinite(v))) return a;
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
/** A darker stone for the scroll's coil, so the volute reads as carved. */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  if (!Number.isFinite(n)) return hex;
  const ch = (sh: number) => Math.min(255, Math.round(((n >> sh) & 255) * k)).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}
/** A convex outline (x across, y up) as a stone block on the end at u = f: its face `proud` in front of the brick, its
 *  sides reaching `back` behind the front. */
function prism(s: RoofSink, pts: readonly V2[], f: number, e: number, proud: number, back: number, hex: string): void {
  if (pts.length < 3) return;
  const uF = f + e * proud, uB = f - e * back;
  let cx = 0, cy = 0;
  for (const [x, y] of pts) { cx += x; cy += y; }
  cx /= pts.length; cy /= pts.length;
  s.flatPoly(pts.map(([x, y]): V3 => [uF, x, y]), 'trim', [e, 0, 0], hex);
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    const l = Math.hypot(x1 - x0, y1 - y0);
    if (l < 1e-4) continue;
    let nx = (y1 - y0) / l, ny = -(x1 - x0) / l;
    if (nx * ((x0 + x1) / 2 - cx) + ny * ((y0 + y1) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
    s.quad([uF, x0, y0], [uF, x1, y1], [uB, x1, y1], [uB, x0, y0], [0, 0], [0, 0], [0, 0], [0, 0], 'trim', [0, nx, ny], hex);
  }
}
/** The colour of a stated dark hood (`stone.hood: 'dark'`): a painted dark green-grey. */
export const ROW_STONE_HOOD = '#3f4a44';
const STONE_SEG = 16;
const disc = (cx: number, cy: number, r: number, n = STONE_SEG): V2[] => Array.from({ length: n }, (_, i): V2 => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)]);
/** A volute: a stone drum with a darker coil and a white eye, its face standing `proud`. */
function volute(s: RoofSink, f: number, e: number, cx: number, cy: number, r: number, hex: string, proud: number = ROW_STONE.volute): void {
  prism(s, disc(cx, cy, r), f, e, proud, 0.02, hex);
  prism(s, disc(cx + r * 0.12, cy + r * 0.08, r * 0.58), f, e, proud + 0.012, 0, shade(hex, 0.8));
  prism(s, disc(cx + r * 0.2, cy + r * 0.12, r * 0.24, 10), f, e, proud + 0.024, 0, hex);
}
/** The crown's edges a coping runs along (the edgeBand rule: not the eaves, not the roof cheeks outside the foot), as runs
 *  of consecutive outline points. */
function copingRuns(prof: readonly V2[], foot: number): V2[][] {
  const runs: V2[][] = [];
  let cur: V2[] = [];
  for (let i = 0; i < prof.length - 1; i++) {
    const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
    const skip = (y0 < 0.02 && y1 < 0.02) || (Math.max(Math.abs(x0), Math.abs(x1)) > foot + 0.01 && Math.min(Math.abs(x0), Math.abs(x1)) >= foot - 0.01) || Math.hypot(x1 - x0, y1 - y0) < 1e-4;
    if (skip) { if (cur.length >= 2) runs.push(cur); cur = []; continue; }
    if (!cur.length) cur.push(prof[i]);
    cur.push(prof[i + 1]);
  }
  if (cur.length >= 2) runs.push(cur);
  return runs;
}
/** A run of outline offset `dist` inward (negative: outward), mitred at its corners (mitre held to 3x). */
function offsetRun(run: readonly V2[], dist: number): V2[] {
  const nrm = (a: V2, b: V2): V2 => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l]; };
  return run.map((p, i): V2 => {
    const n0 = i > 0 ? nrm(run[i - 1], p) : null, n1 = i < run.length - 1 ? nrm(p, run[i + 1]) : null;
    let m: V2 = n0 && n1 ? [n0[0] + n1[0], n0[1] + n1[1]] : (n0 ?? n1)!;
    const ml = Math.hypot(m[0], m[1]);
    if (ml < 1e-6) m = n1 ?? n0!;
    else m = [m[0] / ml, m[1] / ml];
    const cos = n1 ? m[0] * n1[0] + m[1] * n1[1] : 1, k = dist / Math.max(1 / 3, cos);
    return [p[0] + m[0] * k, Math.max(0, p[1] + m[1] * k)];
  });
}
/** A stone band along a run: from `out` outside the outline to `bw` inside it, each segment a block. */
function stoneBand(s: RoofSink, run: readonly V2[], f: number, e: number, out: number, bw: number, proud: number, back: number, hex: string): void {
  const a = offsetRun(run, -out), b = offsetRun(run, bw);
  for (let i = 0; i < run.length - 1; i++) prism(s, [a[i], a[i + 1], b[i + 1], b[i]], f, e, proud, back, hex);
}
/** The outline's height at x on the side `sg` (the highest crossing on that side, the crown's edge). */
function edgeAt(prof: readonly V2[], x: number): number {
  let best = -Infinity;
  for (let i = 0; i < prof.length - 1; i++) {
    const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
    if ((x0 - x) * (x1 - x) > 0 || Math.abs(x1 - x0) < 1e-9) continue;
    best = Math.max(best, y0 + ((x - x0) / (x1 - x0)) * (y1 - y0));
  }
  return best;
}

/**
 * The gable's sandstone as built (RowCrown.stone, or the belt dress), in place of the flat white edges (lane D's renderer
 * asks, 2026-11-15, David on #391: "Gables still look pretty bad"):
 *   - a coping with thickness along every crown edge, its face proud of the brick, its top running back past the plate
 *     (on a step gable each tread and riser);
 *   - neck and bell: the klauwstukken, a broad stone band along each claw from the foot to the neck with a large volute at
 *     the foot, and a quarter-round piece standing on the shoulder against the neck with its own volute; a stone band
 *     across the neck's foot;
 *   - neck and bell: the cap block over the neck on a moulded ledge overhanging the neck;
 *   - spout: a cap slab on the upright top; a stated pediment or segmental cap on a flat top (step, spout);
 *   - a stated crest (the belt's bell and step): a pedestal and ball over the apex.
 */
function stoneCrown(s: RoofSink, c: RowCrown, st: NonNullable<RowCrown['stone']>, prof: readonly V2[], f: number, e: number, d: ReturnType<typeof crownDims>, y0: number, trimHex: string, clear: readonly [number, number] | null): void {
  const S = ROW_STONE, { T, foot, neck } = d, bw = clamp(st.copingM ?? S.copingW, 0.1, 0.4);
  // Weathered sandstone: the trim white drawn warm and a little darker, each piece its own value (a deterministic walk).
  const base = mixHex(trimHex, ROW_STONE_WEATHER.hex, ROW_STONE_WEATHER.mix);
  let k = 0;
  const tone = () => shade(base, ROW_STONE_WEATHER.values[k++ % ROW_STONE_WEATHER.values.length]);
  for (const run of copingRuns(prof, foot)) stoneBand(s, run, f, e, S.overhang, bw, S.coping, S.back, tone());
  const necked = c.shape === 'neck' || c.shape === 'bell';
  // The neck's upright sides (x = neck): their foot, and their top where the cap springs (the belt's bell steps in there).
  const upright = prof.filter(([x, y]) => Math.abs(Math.abs(x) - neck) < 0.02 && y > y0 + 0.05).map(([, y]) => y);
  const neckFoot = upright.length ? Math.min(...upright) : NaN;
  const tN = upright.length > 1 ? Math.max(...upright) : T - d.cap;
  if (necked && st.claws !== false && Number.isFinite(neckFoot) && neckFoot < tN - 0.4) {
    for (const sg of [-1, 1]) {
      // The claw: a broad band along the shoulder from the foot to the neck.
      const claw = prof.filter(([x, y]) => sg * x >= neck - 1e-3 && sg * x <= foot + 1e-6 && y <= neckFoot + 1e-3 && y > -1e-3);
      if (claw.length >= 2) stoneBand(s, claw, f, e, 0, c.shape === 'bell' ? S.bellClaw : S.claw, S.clawProud, S.back * 0.5, tone());
      // The klauwstuk against a neck: a quarter round standing on the shoulder, its foot along the outline (a bell's
      // shoulders curve into its body and carry none).
      const carved = st.claws === 'carved', w = carved ? clamp((foot - neck) * 0.5, 0.45, 1.05) : clamp((foot - neck) * 0.35, 0.3, 0.75), ht = clamp((tN - neckFoot) * 0.3, 0.4, 0.9);
      const xs = sg * (neck + w), ys = edgeAt(prof, xs);
      if (c.shape === 'neck' && Number.isFinite(ys)) {
        const under = prof.filter(([x, y]) => sg * x > neck + 1e-3 && sg * x < neck + w - 1e-3 && y > 0.01).sort((p, q) => sg * (p[0] - q[0]));
        const base = Math.max(ys, neckFoot - 0.05), arc: V2[] = [];
        if (st.claws === 'carved') {
          // A carved scroll (klauwstuk) standing above the shoulder line against the neck: an S-curved back rising to a
          // curl at the neck, about half the neck's height, a volute at its top and a carved leaf on its face.
          const hc = clamp((tN - neckFoot) * 0.68, 0.8, 1.9);
          for (let i = 0; i <= 12; i++) { const t = i / 12; arc.push([sg * (neck + w * Math.cos(t * Math.PI / 2) * (1 - 0.3 * Math.sin(t * Math.PI))), base + hc * Math.sin(t * Math.PI / 2)]); }
          prism(s, [[sg * neck, neckFoot], ...under, [xs, ys], ...(base > ys + 1e-3 ? arc : arc.slice(1))], f, e, S.piece, S.back * 0.5, tone());
          const rt = clamp(w * 0.24, 0.12, 0.26);
          volute(s, f, e, sg * (neck + rt + 0.02), base + hc - rt * 0.4, rt, tone(), S.piece + 0.03);
          prism(s, [[sg * (neck + w * 0.35), base + hc * 0.25], [sg * (neck + w * 0.6), base + hc * 0.3], [sg * (neck + w * 0.45), base + hc * 0.62], [sg * (neck + w * 0.3), base + hc * 0.5]], f, e, S.piece + 0.02, 0, shade(tone(), 0.8));
          const rv = clamp(w * 0.28, 0.12, 0.22) * S.voluteK;
          volute(s, f, e, xs - sg * rv * 0.4, base + rv * 0.9, rv, tone(), S.piece + 0.02);
        } else {
        prism(s, [[sg * neck, neckFoot], ...under, [xs, ys], ...(base > ys + 1e-3 ? arc : arc.slice(1))], f, e, S.piece, S.back * 0.5, tone());
        const rv = clamp(w * 0.28, 0.12, 0.22) * S.voluteK;
        volute(s, f, e, xs - sg * rv * 0.4, base + rv * 0.9, rv, tone(), S.piece + 0.02);
        }
      }
      // The claw's foot: a large volute where the shoulder meets the eaves.
      const r = (c.shape === 'bell' ? clamp((foot - neck) * 0.16, 0.16, 0.3) : clamp((foot - neck) * 0.2, 0.2, 0.42)) * S.voluteK;
      volute(s, f, e, sg * (foot - r - 0.02), y0 + r + 0.03, r, tone());
    }
    // A stone band across the neck's foot, unless the crown's light or door stands there.
    const o = clear;
    if (!o || neckFoot + S.band < o[0] - 0.1 || neckFoot > o[1] + 0.1) prism(s, [[-neck, neckFoot], [neck, neckFoot], [neck, neckFoot + S.band], [-neck, neckFoot + S.band]], f, e, S.clawProud, 0.02, tone());
  }
  if (necked && d.cap > 0) {
    const capRim = prof.filter(([x, y]) => y >= tN - 1e-3 && Math.abs(x) <= neck + 1e-6);
    const lw = neck + S.capOver;
    if (st.hood) {
      // A solid hood over a cornice (Herengracht 55, 57, 31: a dark green or grey curved hood standing on a white
      // entablature): the cap filled in the hood's colour, a little over the outline; under it a two-layer cornice.
      const hex = st.hood === 'dark' ? ROW_STONE_HOOD : st.hood;
      const rim = offsetRun(capRim, -(S.overhang + 0.02));
      if (rim.length >= 2) prism(s, [[0, tN], [rim[0][0], tN], ...rim, [rim[rim.length - 1][0], tN]], f, e, S.ledge + 0.02, S.back, hex);
      prism(s, [[-lw, tN - S.ledgeH], [lw, tN - S.ledgeH], [lw, tN], [-lw, tN]], f, e, S.ledge + 0.04, S.back, tone());
      prism(s, [[-lw + 0.05, tN - S.ledgeH - 0.18], [lw - 0.05, tN - S.ledgeH - 0.18], [lw - 0.05, tN - S.ledgeH], [-lw + 0.05, tN - S.ledgeH]], f, e, S.ledge - 0.03, 0.02, tone());
    } else {
      // The cap's moulding: a broad stone hood along its outline (the tympanum inside it stays brick).
      if (capRim.length >= 2) stoneBand(s, capRim, f, e, S.overhang + 0.02, S.capBand, S.ledge, S.back, tone());
      // A stated carved tympanum (Herengracht 51, 69): a shell's flutes fanning from the springing, or a carved field with a
      // cartouche and leaves, inside the moulding.
      if (st.cap && capRim.length >= 3) {
        const inner = offsetRun(capRim, S.capBand * 0.9).map(([x, y]): V2 => [clamp(x, -neck + 0.04, neck - 0.04), Math.max(y, tN)]);
        const rise = Math.max(...inner.map(([, y]) => y)) - tN;
        if (rise >= 0.25) {
          if (st.cap === 'shell') {
            const hinge: V2 = [0, tN + 0.02], n = 9;
            const at = (u: number): V2 => { const i = Math.min(inner.length - 2, Math.floor(u * (inner.length - 1))), k = u * (inner.length - 1) - i; return [inner[i][0] + (inner[i + 1][0] - inner[i][0]) * k, inner[i][1] + (inner[i + 1][1] - inner[i][1]) * k]; };
            const base = tone();
            // Flutes fanning over the whole tympanum, alternately lit and in shadow (blind review: the first fan read faint
            // and small), a ridge between each pair, and the hinge boss.
            for (let i = 0; i < n; i++) prism(s, [hinge, at(i / n), at((i + 1) / n)], f, e, S.ledge * 0.7, 0.02, shade(base, i % 2 ? 0.7 : 0.98));
            for (let i = 1; i < n; i++) { const p = at(i / n), dx = p[0] - hinge[0], dy = p[1] - hinge[1], l = Math.hypot(dx, dy) || 1, w = 0.015;
              prism(s, [[hinge[0] - dy / l * w, hinge[1] + dx / l * w], [p[0] - dy / l * w, p[1] + dx / l * w], [p[0] + dy / l * w, p[1] - dx / l * w], [hinge[0] + dy / l * w, hinge[1] - dx / l * w]], f, e, S.ledge * 0.7 + 0.015, 0, shade(base, 1.04)); }
            prism(s, disc(0, tN + 0.02, Math.min(0.2, rise * 0.3)).filter(([, y]) => y >= tN), f, e, S.ledge * 0.8, 0, shade(base, 0.85));
          } else {
            prism(s, [[inner[0][0], tN], ...inner, [inner[inner.length - 1][0], tN]], f, e, S.ledge * 0.6, 0.02, tone());
            // The cartouche and its leaves fill the field (blind review: the first read small and faint).
            const cy = tN + rise * 0.45, ry = Math.min(rise * 0.42, 0.5), rx = Math.min(ry * 1.9, (neck - S.capBand) * 0.5);
            const oval = (a: number, b: number): V2[] => Array.from({ length: 18 }, (_, i): V2 => [a * Math.cos(2 * Math.PI * i / 18), cy + b * Math.sin(2 * Math.PI * i / 18)]);
            prism(s, oval(rx * 1.12, ry * 1.12), f, e, S.ledge * 0.6 + 0.03, 0, shade(tone(), 0.66));
            prism(s, oval(rx, ry), f, e, S.ledge * 0.6 + 0.045, 0, tone());
            prism(s, oval(rx * 0.62, ry * 0.62), f, e, S.ledge * 0.6 + 0.06, 0, shade(tone(), 0.78));
            const reach = Math.max(0.2, neck - S.capBand - rx - 0.05);
            for (const sg of [-1, 1]) {
              prism(s, [[sg * rx * 1.05, cy - ry * 0.1], [sg * (rx + reach), tN + 0.06], [sg * (rx + reach * 0.6), tN + 0.06], [sg * rx * 1.02, cy - ry * 0.6]], f, e, S.ledge * 0.6 + 0.03, 0, shade(tone(), 0.7));
              volute(s, f, e, sg * (rx + reach * 0.55), tN + 0.06 + Math.min(0.14, rise * 0.15), Math.min(0.14, rise * 0.15), tone(), S.ledge * 0.6 + 0.05);
            }
          }
        }
      }
      // The moulding the cap stands on: a ledge at the springing, overhanging the neck.
      prism(s, [[-lw, tN - S.ledgeH], [lw, tN - S.ledgeH], [lw, tN], [-lw, tN]], f, e, S.ledge, S.back, tone());
    }
  }
  // Oval cartouches on the shoulders (0363100012176326): a carved frame with a dark oval field, in the brick under each
  // claw, midway between the neck and the foot.
  if (necked && st.shoulders === 'oval' && Number.isFinite(neckFoot)) for (const sg of [-1, 1]) {
    // The belt's low shoulders leave little brick under the claw: the oval may hang into the wall under the foot (the
    // photo's sit beside the top storey's lights), clear of the top windows' heads.
    const xc = sg * (neck + foot) / 2, edge = edgeAt(prof, xc), base = y0 - S.oval.under, room = edge - bw - 0.08 - base;
    const ry = Math.min(S.oval.ry, room / 2), rx = Math.min(ry * S.oval.k, (foot - neck) * 0.3);
    if (ry < 0.14 || rx < 0.1) continue;
    const cy = base + room / 2, ring = (a: number, b: number, n = 20): V2[] => Array.from({ length: n }, (_, i): V2 => [xc + a * Math.cos(2 * Math.PI * i / n), cy + b * Math.sin(2 * Math.PI * i / n)]);
    const lit = tone();
    prism(s, ring(rx * 1.18, ry * 1.12), f, e, S.oval.out, 0.02, shade(lit, 0.82));
    prism(s, ring(rx, ry), f, e, S.oval.out + 0.015, 0, lit);
    prism(s, ring(rx * 0.6, ry * 0.66), f, e, S.oval.out + 0.025, 0, shade(lit, 0.42));
    // The frame's carving: leaves at the top and foot, a small scroll each side.
    for (const dy of [1, -1]) prism(s, [[xc - rx * 0.45, cy + dy * ry * 0.95], [xc + rx * 0.45, cy + dy * ry * 0.95], [xc, cy + dy * (ry * 1.12 + 0.1)]], f, e, S.oval.out + 0.02, 0, lit);
    for (const sx of [-1, 1]) volute(s, f, e, xc + sx * rx * 1.12, cy, Math.min(0.08, rx * 0.3), lit, S.oval.out + 0.02);
  }
  // A festoon across the neck under the cap (0363100012176326): a garland of leaves sagging between two knots, a pendant
  // at its centre and drops hanging down both sides of the neck. It takes the neck's carving space.
  let festooned = false;
  if (c.shape === 'neck' && st.festoon && Number.isFinite(neckFoot)) {
    const F = S.festoon, zt = tN - S.ledgeH - (st.hood ? 0.22 : 0) - 0.05, xe = neck - bw - F.r - 0.06, lo = clear ? clear[1] + 0.04 : neckFoot + 0.3;
    const sag = Math.min(F.sag, zt - F.r - lo);
    if (xe > 0.25 && sag >= 0.08) {
      festooned = true;
      const lit = tone(), dark = shade(lit, 0.78), n = Math.max(7, Math.round(2 * xe / (F.r * 1.3)));
      // The garland: overlapping leaf discs, fullest at the middle, on a catenary-like sag.
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = -xe + 2 * xe * u, y = zt - F.r - sag * Math.sin(Math.PI * u), r = F.r * (0.65 + 0.35 * Math.sin(Math.PI * u));
        prism(s, disc(x, y, r, 10), f, e, F.out + (i % 2) * 0.008, 0.02, i % 2 ? dark : lit);
      }
      // The knots at its ends and the drops down the neck's sides, each bead smaller.
      const dropLo = Math.max(neckFoot + 0.15, zt - F.drop);
      for (const sg of [-1, 1]) {
        prism(s, disc(sg * xe, zt - F.r * 0.6, F.r * 0.9, 10), f, e, F.out + 0.015, 0.02, lit);
        for (let k = 0, y = zt - F.r * 1.8; y > dropLo; k++, y -= F.r * 1.25) prism(s, disc(sg * xe, y, F.r * Math.max(0.5, 0.9 - k * 0.07), 8), f, e, F.out + (k % 2) * 0.008, 0.02, k % 2 ? dark : lit);
      }
      // The pendant: a bell-shaped drop under the garland's centre.
      const py = zt - F.r - sag - F.r * 0.6;
      if (py - F.pend > lo) prism(s, [[-F.r * 0.5, py], [F.r * 0.5, py], [F.r * 0.9, py - F.pend * 0.8], [0, py - F.pend], [-F.r * 0.9, py - F.pend * 0.8]], f, e, F.out + 0.012, 0.02, lit);
    }
  }
  // Carving in the neck between its light and the cap: a framed panel, a cartouche, or an oeil-de-boeuf. (In the cap's
  // tympanum instead it lost a blind A/B 0-3-3: the photos keep the piece in the neck, under the cornice.)
  if (necked && st.neck && !festooned && Number.isFinite(neckFoot)) {
    const carve = (cy: number, rx: number, ry: number): void => {
      const oval = (a: number, b: number, n = 18): V2[] => Array.from({ length: n }, (_, i): V2 => [a * Math.cos(2 * Math.PI * i / n), cy + b * Math.sin(2 * Math.PI * i / n)]);
      if (st.neck === 'panel') {
        const pw = rx, ph = ry, b = 0.06;
        for (const pts of [[[-pw, cy - ph], [pw, cy - ph], [pw, cy - ph + b], [-pw, cy - ph + b]], [[-pw, cy + ph - b], [pw, cy + ph - b], [pw, cy + ph], [-pw, cy + ph]], [[-pw, cy - ph], [-pw + b, cy - ph], [-pw + b, cy + ph], [-pw, cy + ph]], [[pw - b, cy - ph], [pw, cy - ph], [pw, cy + ph], [pw - b, cy + ph]]] as V2[][]) prism(s, pts, f, e, 0.05, 0.02, tone());
        prism(s, [[-pw + b, cy - ph + b], [pw - b, cy - ph + b], [pw - b, cy + ph - b], [-pw + b, cy + ph - b]], f, e, 0.025, 0, shade(tone(), 0.86));
      } else if (st.neck === 'cartouche') {
        prism(s, oval(rx * 0.8, ry), f, e, 0.06, 0.02, tone());
        prism(s, oval(rx * 0.52, ry * 0.66), f, e, 0.075, 0, shade(tone(), 0.8));
        for (const sg of [-1, 1]) volute(s, f, e, sg * rx * 0.9, cy + ry * 0.35, Math.min(0.1, ry * 0.4), tone(), 0.07);
      } else {
        prism(s, oval(rx * 0.85, ry), f, e, 0.06, 0.02, tone());
        prism(s, oval(rx * 0.62, ry * 0.72), f, e, 0.065, 0, GLASS);
        prism(s, [[-0.02, cy - ry * 0.72], [0.02, cy - ry * 0.72], [0.02, cy + ry * 0.72], [-0.02, cy + ry * 0.72]], f, e, 0.07, 0, tone());
        prism(s, [[-rx * 0.62, cy - 0.02], [rx * 0.62, cy - 0.02], [rx * 0.62, cy + 0.02], [-rx * 0.62, cy + 0.02]], f, e, 0.07, 0, tone());
      }
    };
    const zl = clear ? clear[1] + 0.2 : neckFoot + 0.3, zh = tN - S.ledgeH - (st.hood ? 0.22 : 0.06) - 0.08, hh = zh - zl;
    const rx = Math.min(neck * 0.55, 0.42);
    if (hh >= 0.36 && rx >= 0.2) carve((zl + zh) / 2, rx, Math.min(hh / 2, 0.32));
    else if (st.neck !== 'panel' && rx >= 0.2) {
      // Where the light fills the neck (Herengracht 31, 57) a small round piece still sits between the light's head and
      // the cornice (the photos: below the cap, never in it), tight to both.
      const lo = clear ? clear[1] + 0.06 : neckFoot + 0.3, hi = tN - S.ledgeH - (st.hood ? 0.18 : 0) - 0.03, r = (hi - lo) / 2;
      // A small round piece (a blind judge: a dot a third the light's width, not a wide ellipse), clear of both.
      const rr = Math.min(r * 0.75, 0.16);
      if (rr >= 0.08) carve((lo + hi) / 2, rr / 0.85, rr);
    }
  }
  // The spout's cap slab on its upright top.
  let top = Math.max(...prof.map(([, y]) => y)) + S.overhang;
  if (c.shape === 'spout') {
    const hw = neck + S.overhang - 0.01;
    prism(s, [[-hw, top], [hw, top], [hw, top + 0.08], [-hw, top + 0.08]], f, e, S.coping + 0.02, S.back, tone());
    top += 0.08;
  }
  // A cap on a flat top: a pediment or a segmental arch standing on it.
  if ((c.shape === 'step' || c.shape === 'spout') && (st.crest === 'pediment' || st.crest === 'segmental')) {
    const hw = neck + S.overhang + 0.06, rise = clamp(hw * 0.4, 0.3, 0.6), pts: V2[] = [[-hw, top]];
    if (st.crest === 'pediment') pts.push([0, top + rise]);
    else for (let i = 1; i < 12; i++) { const a = Math.PI * (1 - i / 12); pts.push([hw * Math.cos(a), top + rise * Math.sin(a)]); }
    pts.push([hw, top]);
    prism(s, pts, f, e, S.cap, S.back, tone());
    top += rise;
  }
  if (st.crest === 'crest') {
    // A crest over the apex: a pedestal and a stone ball (the finial on a step's top, the ornament on a bell's crest).
    const hw = c.shape === 'step' ? 0.15 : 0.18;
    prism(s, [[-hw, top - 0.02], [hw, top - 0.02], [hw * 0.8, top + 0.22], [-hw * 0.8, top + 0.22]], f, e, S.piece, 0.18, tone());
    prism(s, disc(0, top + 0.22 + 0.14, 0.14), f, e, S.piece, 0.1, tone());
    if (c.shape === 'bell') for (const sg of [-1, 1]) volute(s, f, e, sg * (hw + 0.12), top + 0.1, 0.11, tone(), S.piece);
  }
}

/** The crown's opening's height (a hoist door or an attic light), or null when it has none. */
function openingZ(c: RowCrown, d: ReturnType<typeof crownDims>, y0: number): [number, number] | null {
  const T = d.T, lights = c.attic ?? 1;
  if (!c.hoist && lights < 1) return null;
  const capTop = c.shape === 'neck' || c.shape === 'raised' ? T - d.cap : c.shape === 'bell' ? T - 0.35 : c.shape === 'point' ? T * 0.72 : c.shape === 'spout' ? T - spoutTop(c) - 0.1 : T - 0.25;
  const z0 = c.shape === 'raised' ? (c.bandM ?? 0.5) + 0.12 : Math.max(y0 + 0.3, c.shape === 'point' ? 0.35 : y0 + 0.3);
  const z1 = Math.min(capTop - 0.15, z0 + (c.hoist ? 1.5 : 1.15));
  // The belt's neck: the attic light stands in the neck, over the shoulders, not in the shoulder band (Herengracht
  // 0363100012176326, R's festoon review 2026-11-15: the drops frame the light in the neck). Too little neck: as before.
  if (c.dress === 'belt' && c.shape === 'neck' && !c.hoist) {
    // A stated neck carving (oculus, cartouche) keeps its room under the cap.
    const carved = !!(c as { stone?: { neck?: string } }).stone?.neck;
    const n0 = y0 + (T - y0) * (c.shoulderRise ?? BELT_GABLE.neckShoulder) + 0.15, n1 = Math.min(capTop - (carved ? 0.8 : 0.15), n0 + 1.15);
    if (n0 > z0 && n1 - n0 >= 0.55) return [n0, n1];
  }
  return z1 - z0 < 0.55 ? null : [z0, z1];
}

/** A sink that moves every vertex `dv` along v (the crown's end plane), for an off-centre crown's trim. */
function shiftedSink(s: RoofSink, dv: number): RoofSink {
  const mv = (p: V3): V3 => [p[0], p[1] + dv, p[2]];
  const o = Object.create(s) as RoofSink & Record<string, unknown>;
  o.quad = ((a: V3, b: V3, c: V3, d: V3, ...rest: unknown[]) => (s.quad as (...x: unknown[]) => unknown).call(s, mv(a), mv(b), mv(c), mv(d), ...rest)) as RoofSink['quad'];
  o.tri = ((a: V3, b: V3, c: V3, ...rest: unknown[]) => (s.tri as (...x: unknown[]) => unknown).call(s, mv(a), mv(b), mv(c), ...rest)) as RoofSink['tri'];
  o.flatPoly = ((pts: V3[], ...rest: unknown[]) => (s.flatPoly as (...x: unknown[]) => unknown).call(s, pts.map(mv), ...rest)) as RoofSink['flatPoly'];
  return o;
}
/** White edge trim, scrolls, cap, shoulder blocks and the crown's light or hoist door on one gable end at u = f. */
export function rowCrownAccents(s0: RoofSink, c: RowCrown, prof0: readonly V2[], f: number, e: number, W: number, R: number, trimHex: string): void {
  // An off-centre crown: its trim and light drawn about its own centre, then shifted with it along v.
  const off = crownOffset(c, W), s = off ? shiftedSink(s0, off) : s0, prof = off ? prof0.map(([x, y]): V2 => [x - off, y]) : prof0;
  const d = crownDims(c, W), { T, foot, neck } = d;
  const slope = (x: number) => R * (1 - Math.abs(x) / d.half);
  const y0 = foot < d.half - 0.01 ? slope(-foot) + 0.04 : 0;
  const stone = rowCrownStone(c);
  if (stone) stoneCrown(s, c, stone, prof, f, e, d, y0, trimHex, openingZ(c, d, y0));
  else edgeBand(s, prof, f, e, c.shape === 'point' ? 0.2 : 0.15, foot, trimHex);
  if (c.shape === 'neck' && !stone) {
    // Scroll pieces: a broad white stone band along each claw (the brick shows inside it) ending in a volute at the
    // foot; the pediment cap filled white.
    const tN = T - d.cap;
    for (const side of [-1, 1]) {
      const claw = prof.filter(([x, y]) => side * x >= neck - 1e-6 && side * x <= foot + 1e-6 && y <= tN - 0.3 && y > 0.001);
      if (claw.length >= 2) edgeBand(s, claw, f, e, 0.3, foot, trimHex);
      const r = clamp((foot - neck) * 0.16, 0.14, 0.26), cx = side * (foot - r - 0.04), cy = y0 + r + 0.04, rim: V2[] = [];
      for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2; rim.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      fan(s, f, e, [cx, cy], rim, trimHex);
    }
    const capRim = prof.filter(([, y]) => y >= tN - 1e-6);
    if (capRim.length >= 3) fan(s, f, e, [0, tN], capRim, trimHex);
    rect(s, f, e, -neck, neck, tN - 0.12, tN, trimHex, PROUD_HI);
  }
  if (c.shape === 'raised') {
    const b = c.bandM ?? 0.5, tN = T - d.cap;
    // The cornice: a white band over the whole front's top, the cap of the piece filled white.
    rect(s, f, e, -d.half, d.half, Math.max(0, b - 0.3), b, trimHex, PROUD_HI);
    const capRim = prof.filter(([x, y]) => y >= tN - 1e-6 && Math.abs(x) <= neck + 1e-6);
    if (capRim.length >= 3) fan(s, f, e, [0, tN], capRim, trimHex);
    else rect(s, f, e, -neck, neck, tN, T, trimHex, PROUD_HI);
  }
  if (c.shape === 'bell' && !stone) for (const side of [-1, 1]) rect(s, f, e, side < 0 ? -foot : foot - 0.4, side < 0 ? -foot + 0.4 : foot, y0, y0 + 0.32, trimHex, PROUD_HI);
  if (c.finials) finials(s, c, prof, f, e, foot, neck, trimHex);
  if (c.chimney && c.chimney.topM > T + 0.2) chimneyStack(s, c.chimney, f, e, T, d.cap);
  if (c.lights?.length) { tracedLights(s, c.lights, prof, f, e, trimHex); return; }
  // The crown's opening: a hoist door (white frame, dark leaves) or an attic light, centred, inside the profile.
  const oz = openingZ(c, d, y0);
  if (!oz) return;
  const [z0, z1] = oz;
  const capTop = c.shape === 'neck' || c.shape === 'raised' ? T - d.cap : c.shape === 'bell' ? T - 0.35 : c.shape === 'point' ? T * 0.72 : c.shape === 'spout' ? T - spoutTop(c) - 0.1 : T - 0.25;
  const sp = spanAt(prof, z1), inner = sp ? Math.min(-sp[0], sp[1]) - 0.2 : 0;
  const hw = Math.min(c.hoist ? 0.5 : 0.42, inner, (c.shape === 'neck' || c.shape === 'step' || c.shape === 'raised' ? neck : foot) - 0.22);
  if (hw < 0.22) return;
  const fr = 0.08;
  // A stated upper light: a small round-headed light over the attic light, under the cap (Herengracht 39, 57, 71, 73;
  // blind gable reviews 2-3, 2026-11-15: right on those, wrong where the photo has one window).
  if (c.upperLight && !c.hoist && !c.lights?.length) {
    const u0 = z1 + fr + 0.3, uw = Math.min(0.24, hw * 0.6), u1 = Math.min(capTop - 0.2, u0 + uw * 2.6);
    const usp = spanAt(prof, u1), uin = usp ? Math.min(-usp[0], usp[1]) - 0.15 : 0;
    if (u1 - u0 >= uw * 2 && uin >= uw + fr) {
      rect(s, f, e, -uw - fr, uw + fr, u0 - fr, u1 - uw, trimHex);
      arch(s, f, e, uw + fr, uw + fr * 0.6, u1 - uw, trimHex, PROUD);
      rect(s, f, e, -uw, uw, u0, u1 - uw, GLASS, PROUD_HI);
      arch(s, f, e, uw, uw, u1 - uw, GLASS, PROUD_HI);
    }
  }
  if (c.atticHead && !c.hoist) {
    // An arched light: the jambs to the springing, the arch (a half round, or a segment of a sixth of the span) over it,
    // all inside the profile; a white frame ring round it.
    const rise = c.atticHead === 'round' ? hw : Math.max(0.12, hw / 3), zs = z1 - rise;
    if (zs - z0 >= 0.25) {
      rect(s, f, e, -hw - fr, hw + fr, z0 - fr, zs, trimHex);
      arch(s, f, e, hw + fr, rise + fr * 0.6, zs, trimHex, PROUD);
      rect(s, f, e, -hw, hw, z0, zs, GLASS, PROUD_HI);
      arch(s, f, e, hw, rise, zs, GLASS, PROUD_HI);
      rect(s, f, e, -hw - fr - 0.06, hw + fr + 0.06, z0 - fr - 0.07, z0 - fr, trimHex, PROUD_HI);
      rect(s, f, e, -0.025, 0.025, z0, zs, trimHex, PROUD_HI + 0.004);
      return;
    }
  }
  rect(s, f, e, -hw - fr, hw + fr, z0 - fr, z1 + fr, trimHex);
  rect(s, f, e, -hw, hw, z0, z1, GLASS, PROUD_HI);
  // A white sill a little wider than the frame.
  rect(s, f, e, -hw - fr - 0.06, hw + fr + 0.06, z0 - fr - 0.07, z0 - fr, trimHex, PROUD_HI);
  if (c.hoist) rect(s, f, e, -0.025, 0.025, z0, z1, trimHex, PROUD_HI + 0.004);
  else rect(s, f, e, -hw, hw, (z0 + z1) / 2 - 0.025, (z0 + z1) / 2 + 0.025, trimHex, PROUD_HI + 0.004);
}
