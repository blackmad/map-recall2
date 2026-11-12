/**
 * The canal-house stoop (stoep, K-stoep #360): a flight of stone steps up to a bel-etage door on a landing (bordes), with
 * wrought-iron balustrades, and the souterrain door or window under it.
 *
 * Before this module the kit drew a raised door's stoop as the canal-house library's front flight (`basement: stoop`
 * -> fit.ts `elevation.entrance`, plain steps straight out, no rail) and the streamed path as three pale slabs
 * (facadeExtras.ts `stoop`). The canal belt's stoops mostly climb *along* the facade (one flight to the side, or two
 * meeting at the landing) because the pavement in front of a Herengracht house is two to three metres deep, and their
 * black iron balustrades are what the eye reads.
 *
 * `FrontIntent.stoop` (every field optional, absent = byte-identical: the old front flight stays):
 *   flight     front | side-left | side-right | double (side-left: the flight descends towards the viewer's left)
 *   steps      risers from the pavement to the landing, 2..16 (absent: the sill height over `riseM`, rounded)
 *   riseM      riser height, 0.12..0.25 m (absent: the sill height over `steps`; both given: they must meet the sill)
 *   treadM     going of one step, 0.2..0.4 m (default 0.28)
 *   widthM     flight width, 0.6..2.4 m (default: front the door + 0.4 m, side 1.0 m)
 *   landing    {depth 0.6..2 m, width 1..4 m}: the bordes in front of the door (default: front 0.9 x door + 0.6,
 *              side/double 1.2 x door + 0.4)
 *   material   stone (default) | brick | painted: steps and landing in the front's stone, wall brick or trim paint
 *   rail       iron (default) | stone | none: wrought-iron balustrades, a solid stone cheek, or none
 *   railStyle  plain | bars (default) | ornate (ironRailing.ts)
 *   under      door | window | closed (default): a souterrain door (sill >= 1.4 m) or window (sill >= 0.8 m) in the
 *              wall under the landing between two piers, or a solid masonry body
 *   zone       the measured stoep zone, metres from the facade (the strip/photo or BGT): the stoop must fit inside it
 *
 * Validation (`stoopProblems` on the intent, `planStoop` against the fitted front) rejects what cannot be built: a
 * landing that misses the door sill (steps x rise), a flight beyond the front's ends, a side flight wider than its
 * landing is deep, a stoop deeper than the stoep zone, a door under a landing too low for one.
 *
 * Frames: the plan is in the viewer's frame of one house module (x from the viewer's left, y up from the pavement,
 * z out of the wall). `emitStoop` draws into any `RailSink` set (the recipe pass `stoopMesh.ts` for GLBs and chunks,
 * the streamed path's ExtraSink adapter in facadeExtras.ts); `xMap` places and mirrors it.
 */
import {BALUSTER, landingRun, slopedRun, STAIR_RAIL, type LevelRun, type RailSink, type RailStyle, type V3} from './ironRailing.ts';

export type StoopFlight = 'front' | 'side-left' | 'side-right' | 'double';
export interface StoopIntent {
  flight?: StoopFlight;
  steps?: number;
  riseM?: number;
  treadM?: number;
  widthM?: number;
  landing?: {depth: number; width: number};
  material?: 'stone' | 'brick' | 'painted';
  rail?: 'iron' | 'stone' | 'none';
  railStyle?: RailStyle;
  under?: 'door' | 'window' | 'closed';
  /** Measured stoep zone (m from the facade): the photo's paving joint / kerb, or BGT. */
  zone?: number;
}
export const STOOP_FLIGHTS: readonly StoopFlight[] = ['front', 'side-left', 'side-right', 'double'];
const KEYS = ['flight', 'steps', 'riseM', 'treadM', 'widthM', 'landing', 'material', 'rail', 'railStyle', 'under', 'zone'];

/** Proportions (metres). Defaults from the register's Herengracht/Keizersgracht stoops and the user's photo row. */
export const STOOP = {
  riseM: 0.18, treadM: 0.28, sideWidthM: 1.0, frontExtraM: 0.4,
  frontLanding: {depth: 0.9, extra: 0.6}, sideLanding: {depth: 1.2, extra: 0.4},
  slabM: 0.16, pierM: 0.22, railInsetM: 0.04, sillTolM: 0.06,
  underDoor: {minSillM: 1.4, widthM: 0.9, headroomM: 0.2, maxM: 2.0}, underWindow: {minSillM: 0.8, widthM: 1.0},
  /** A solid stone cheek (rail: stone): thickness and height over the nosings. */
  cheek: {widthM: 0.16, heightM: 0.7},
  /** Iron of the balustrades (wrought iron, painted black). */
  ironHex: '#1d1f22',
  /** The under-landing opening's dark panel. */
  underHex: '#2a2622',
} as const;

const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Intent-level problems with `stoop` on one front (geometry against the fitted front is `planStoop`'s). */
export function stoopProblems(s: unknown, front: {basement: string; doorBay: number | null; shopfront?: {residentialDoor?: unknown}; groundFront?: unknown}, at: string): string[] {
  const a = `${at}.stoop`;
  if (!s || typeof s !== 'object' || Array.isArray(s) || Object.keys(s).some(k => !KEYS.includes(k))) return [`${a}: {${KEYS.map(k => k + '?').join(', ')}}`];
  const o = s as Record<string, unknown>, p: string[] = [];
  if (o.flight !== undefined && !STOOP_FLIGHTS.includes(o.flight as StoopFlight)) p.push(`${a}.flight: ${STOOP_FLIGHTS.join(' | ')}`);
  if (o.steps !== undefined && !(Number.isInteger(o.steps) && num(o.steps, 2, 16))) p.push(`${a}.steps: 2..16`);
  if (o.riseM !== undefined && !num(o.riseM, 0.12, 0.25)) p.push(`${a}.riseM: 0.12..0.25 m`);
  if (o.treadM !== undefined && !num(o.treadM, 0.2, 0.4)) p.push(`${a}.treadM: 0.2..0.4 m`);
  if (o.widthM !== undefined && !num(o.widthM, 0.6, 2.4)) p.push(`${a}.widthM: 0.6..2.4 m`);
  if (o.landing !== undefined) {
    const l = o.landing as Record<string, unknown>;
    if (!l || typeof l !== 'object' || Object.keys(l).some(k => k !== 'depth' && k !== 'width') || !num(l.depth, 0.6, 2) || !num(l.width, 1, 4)) p.push(`${a}.landing: {depth 0.6..2 m, width 1..4 m}`);
  }
  if (o.material !== undefined && !['stone', 'brick', 'painted'].includes(o.material as string)) p.push(`${a}.material: stone | brick | painted`);
  if (o.rail !== undefined && !['iron', 'stone', 'none'].includes(o.rail as string)) p.push(`${a}.rail: iron | stone | none`);
  if (o.railStyle !== undefined && !['plain', 'bars', 'ornate'].includes(o.railStyle as string)) p.push(`${a}.railStyle: plain | bars | ornate`);
  if (o.railStyle !== undefined && o.rail !== undefined && o.rail !== 'iron') p.push(`${a}.railStyle: only an iron rail has a style`);
  if (o.under !== undefined && !['door', 'window', 'closed'].includes(o.under as string)) p.push(`${a}.under: door | window | closed`);
  if (o.zone !== undefined && !num(o.zone, 0.6, 8)) p.push(`${a}.zone: 0.6..8 m`);
  if (num(o.widthM, 0.6, 2.4) && o.landing && typeof o.landing === 'object' && o.flight !== undefined && o.flight !== 'front' && (o.widthM as number) > ((o.landing as {depth: number}).depth ?? 0) + 1e-6) p.push(`${a}.widthM: a side flight stands beside its landing, no wider than the landing is deep`);
  if (front.basement !== 'stoop' && front.basement !== 'stoop-and-windows') p.push(`${a}: needs basement "stoop" or "stoop-and-windows" (a raised door)`);
  if (front.doorBay === null && !front.shopfront?.residentialDoor) p.push(`${a}: needs a door (doorBay or a shop's residentialDoor)`);
  if (front.groundFront !== undefined) p.push(`${a}: a groundFront draws its own doors`);
  return p;
}

export type StoopPart = 'body' | 'iron' | 'under';
export interface StoopBox {x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; part: StoopPart; skip?: string[]}
/** One raking guard (foot line low end first) or one level guard. */
export type StoopRail = {kind: 'flight'; foot0: V3; foot1: V3; newel: boolean} | {kind: 'level'; run: LevelRun; y: number};
export interface StoopPlan {
  flight: StoopFlight; steps: number; riseM: number; treadM: number; widthM: number;
  landing: {x0: number; x1: number; depth: number; top: number};
  material: 'stone' | 'brick' | 'painted'; rail: 'iron' | 'stone' | 'none'; railStyle: RailStyle; under: 'door' | 'window' | 'closed';
  boxes: StoopBox[]; rails: StoopRail[];
  /** Furthest reach from the wall (m) and the x span along it (viewer frame). */
  projectionM: number; extent: [number, number];
}
export interface StoopFrontContext {doorLeftM: number; doorWidthM: number; sillM: number; frontWidthM: number;
  /** Depth available in front of the wall (the measured stoep zone, or BGT); absent: unchecked. */
  zoneM?: number}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The stoop laid out against one fitted front, or the reasons it cannot be built there. */
export function planStoop(s: StoopIntent, ctx: StoopFrontContext): {plan: StoopPlan | null; problems: string[]} {
  const problems: string[] = [], sill = ctx.sillM, flight = s.flight ?? 'front', side = flight !== 'front';
  if (!(sill > 0)) return {plan: null, problems: ['stoop: the door is not raised (no basement under it)']};
  const steps = s.steps ?? Math.max(2, Math.round(sill / (s.riseM ?? STOOP.riseM)));
  const rise = sill / steps;
  if (s.riseM !== undefined && Math.abs(steps * s.riseM - sill) > STOOP.sillTolM) problems.push(`stoop: ${steps} x ${s.riseM} m = ${r3(steps * s.riseM)} m misses the door sill at ${r3(sill)} m (the landing must meet the sill)`);
  if (rise < 0.12 - 1e-9 || rise > 0.25 + 1e-9) problems.push(`stoop: ${steps} risers to a ${r3(sill)} m sill rise ${r3(rise)} m each (0.12..0.25)`);
  const tread = s.treadM ?? STOOP.treadM;
  const L = side ? STOOP.sideLanding : STOOP.frontLanding;
  const depth = s.landing?.depth ?? L.depth, lw = s.landing?.width ?? ctx.doorWidthM + L.extra;
  const width = s.widthM ?? (side ? Math.min(STOOP.sideWidthM, depth) : Math.min(lw, ctx.doorWidthM + STOOP.frontExtraM));
  const dc = ctx.doorLeftM + ctx.doorWidthM / 2, lx0 = dc - lw / 2, lx1 = dc + lw / 2;
  if (lw < ctx.doorWidthM + 0.1 - 1e-9) problems.push(`stoop.landing.width: ${r3(lw)} m is narrower than the door (${r3(ctx.doorWidthM)} m) + 0.1`);
  if (lx0 < -1e-6 || lx1 > ctx.frontWidthM + 1e-6) problems.push(`stoop.landing: ${r3(lx0)}..${r3(lx1)} m runs past the front (0..${r3(ctx.frontWidthM)} m)`);
  if (side && width > depth + 1e-6) problems.push(`stoop.widthM: a side flight (${r3(width)} m) is wider than its landing is deep (${r3(depth)} m)`);
  if (!side && width > lw + 1e-6) problems.push(`stoop.widthM: the front flight (${r3(width)} m) is wider than its landing (${r3(lw)} m)`);
  const run = (steps - 1) * tread;
  const left = flight === 'side-left' || flight === 'double', right = flight === 'side-right' || flight === 'double';
  if (left && lx0 - run < -1e-6) problems.push(`stoop: the left flight (${steps - 1} treads, ${r3(run)} m) runs past the front's left end`);
  if (right && lx1 + run > ctx.frontWidthM + 1e-6) problems.push(`stoop: the right flight (${steps - 1} treads, ${r3(run)} m) runs past the front's right end`);
  const projection = side ? Math.max(depth, width) : depth + run;
  const zone = s.zone ?? ctx.zoneM;
  if (zone !== undefined && projection > zone + 0.01) problems.push(`stoop: projects ${r3(projection)} m, past the ${r3(zone)} m stoep zone${side ? '' : ' (a side flight projects only its landing)'}`);
  const under = s.under ?? 'closed';
  if (under === 'door' && sill < STOOP.underDoor.minSillM) problems.push(`stoop.under: a door under a ${r3(sill)} m landing (needs ${STOOP.underDoor.minSillM} m)`);
  if (under === 'window' && sill < STOOP.underWindow.minSillM) problems.push(`stoop.under: a window under a ${r3(sill)} m landing (needs ${STOOP.underWindow.minSillM} m)`);
  if (problems.length) return {plan: null, problems};

  const boxes: StoopBox[] = [], rails: StoopRail[] = [];
  // The landing: a slab on a solid body, or on two piers over the souterrain opening.
  if (under === 'closed') boxes.push({x0: lx0, x1: lx1, y0: 0, y1: sill, z0: 0, z1: depth, part: 'body'});
  else {
    const slab = sill - STOOP.slabM;
    boxes.push({x0: lx0, x1: lx1, y0: slab, y1: sill, z0: 0, z1: depth, part: 'body', skip: []});
    for (const [a, b] of [[lx0, lx0 + STOOP.pierM], [lx1 - STOOP.pierM, lx1]]) boxes.push({x0: a, x1: b, y0: 0, y1: slab, z0: 0, z1: depth, part: 'body'});
    const w = Math.min(under === 'door' ? STOOP.underDoor.widthM : STOOP.underWindow.widthM, lw - 2 * STOOP.pierM - 0.2);
    const y0 = under === 'door' ? 0.02 : r3(sill * 0.35), y1 = under === 'door' ? Math.min(slab - STOOP.underDoor.headroomM, STOOP.underDoor.maxM) : slab - 0.25;
    boxes.push({x0: dc - w / 2, x1: dc + w / 2, y0, y1, z0: 0, z1: 0.02, part: 'under'});
  }
  // Treads below the landing: k = 1 (lowest, furthest from the landing) .. steps - 1, each a block from the pavement.
  const fx0 = dc - width / 2, fx1 = dc + width / 2;
  for (let k = 1; k < steps; k++) {
    const y1 = k * rise, far = steps - k, near = steps - 1 - k;
    if (!side) boxes.push({x0: fx0, x1: fx1, y0: 0, y1, z0: depth + near * tread, z1: depth + far * tread, part: 'body'});
    if (left) boxes.push({x0: lx0 - far * tread, x1: lx0 - near * tread, y0: 0, y1, z0: 0, z1: width, part: 'body'});
    if (right) boxes.push({x0: lx1 + near * tread, x1: lx1 + far * tread, y0: 0, y1, z0: 0, z1: width, part: 'body'});
  }
  // Guards: up each flight's open edge (a newel at its foot), then round the landing's open edges.
  const i = STOOP.railInsetM, railed = (s.rail ?? 'iron') !== 'none';
  if (railed) {
    const level = (along: 'x' | 'z', a: number, c: number, at: number) => { if (c - a > 0.15) rails.push({kind: 'level', run: {along, a, c, at}, y: sill}); };
    if (!side) {
      for (const x of [fx0 + i, fx1 - i]) rails.push({kind: 'flight', foot0: [x, rise, depth + run - 0.05], foot1: [x, sill, depth], newel: true});
      level('z', 0.02, depth, lx0 + i); level('z', 0.02, depth, lx1 - i);
      level('x', lx0 + i, fx0 + i, depth - i); level('x', fx1 - i, lx1 - i, depth - i);
    } else {
      if (left) rails.push({kind: 'flight', foot0: [lx0 - run + 0.05, rise, width - i], foot1: [lx0, sill, width - i], newel: true});
      if (right) rails.push({kind: 'flight', foot0: [lx1 + run - 0.05, rise, width - i], foot1: [lx1, sill, width - i], newel: true});
      level('x', lx0, lx1, depth - i);
      if (left && depth - width > 0.15) level('z', width, depth, lx0 + i);
      if (right && depth - width > 0.15) level('z', width, depth, lx1 - i);
      if (!left) level('z', 0.02, depth, lx0 + i);
      if (!right) level('z', 0.02, depth, lx1 - i);
    }
  }
  const x0 = Math.min(lx0, left ? lx0 - run : lx0, side ? lx0 : fx0), x1 = Math.max(lx1, right ? lx1 + run : lx1, side ? lx1 : fx1);
  return {plan: {flight, steps, riseM: r3(rise), treadM: tread, widthM: r3(width), landing: {x0: r3(lx0), x1: r3(lx1), depth, top: sill},
    material: s.material ?? 'stone', rail: s.rail ?? 'iron', railStyle: s.railStyle ?? 'bars', under, boxes, rails, projectionM: r3(projection), extent: [r3(x0), r3(x1)]}, problems};
}

/** Place a viewer-frame sink: x -> scale * x + offset (scale -1 mirrors). */
export function placedSink(s: RailSink, scale: 1 | -1, offset: number): RailSink {
  if (scale === 1 && offset === 0) return s;
  const X = (x: number) => scale * x + offset, P = (p: V3): V3 => [X(p[0]), p[1], p[2]];
  return {
    box: (x0, x1, y0, y1, z0, z1, skip) => s.box(Math.min(X(x0), X(x1)), Math.max(X(x0), X(x1)), y0, y1, z0, z1, skip),
    quad: (a, b, c, d, n) => s.quad(P(a), P(b), P(c), P(d), [scale * n[0], n[1], n[2]]),
  };
}

/**
 * Draw a plan: masonry into `sinks.body`, the guards into `sinks.iron` (a stone cheek into `sinks.body`), the
 * souterrain opening into `sinks.under`. `stream`: the streamed path's budget (no hidden pavement faces, coarse bars).
 * Returns the members drawn per part.
 */
export function emitStoop(plan: StoopPlan, sinks: Record<StoopPart, RailSink>, opts: {stream?: boolean} = {}): Record<StoopPart, number> {
  const count = {body: 0, iron: 0, under: 0};
  for (const b of plan.boxes) { sinks[b.part].box(b.x0, b.x1, b.y0, b.y1, b.z0, b.z1, b.skip ?? ['back', 'bottom']); count[b.part]++; }
  if (plan.rail === 'none') return count;
  for (const r of plan.rails) {
    if (plan.rail === 'stone') {
      const C = STOOP.cheek, s = sinks.body;
      if (r.kind === 'level') {
        const {along, a, c, at} = r.run, w = C.widthM / 2;
        if (along === 'x') s.box(a, c, r.y, r.y + C.heightM, at - w, at + w, ['bottom']); else s.box(at - w, at + w, r.y, r.y + C.heightM, a, c, ['bottom']);
      } else {
        // A raking stone cheek: a sheared slab from the nosing line up `heightM`, `widthM` thick.
        const along = Math.abs(r.foot1[0] - r.foot0[0]) >= Math.abs(r.foot1[2] - r.foot0[2]) ? 'x' : 'z';
        slopedCheek(s, r.foot0, r.foot1, C.widthM, C.heightM, along);
      }
      count.body++;
      continue;
    }
    count.iron += r.kind === 'flight'
      ? slopedRun(sinks.iron, r.foot0, r.foot1, plan.railStyle, {stream: opts.stream, newel: r.newel})
      : landingRun(sinks.iron, r.run, r.y, plan.railStyle, {stream: opts.stream});
  }
  return count;
}

function slopedCheek(s: RailSink, p: V3, q: V3, w: number, h: number, along: 'x' | 'z') {
  const off = (pt: V3, d: number, dy: number): V3 => along === 'x' ? [pt[0], pt[1] + dy, pt[2] + d] : [pt[0] + d, pt[1] + dy, pt[2]];
  const nO: V3 = along === 'x' ? [0, 0, 1] : [1, 0, 0], nI: V3 = along === 'x' ? [0, 0, -1] : [-1, 0, 0];
  // Its sides run from 0.2 m under the nosing line (inside the steps' body) to `h` over it; its top is the coping.
  const lo = -w / 2, hi = w / 2, b = -0.2;
  s.quad(off(p, lo, h), off(q, lo, h), off(q, hi, h), off(p, hi, h), [0, 1, 0]);
  s.quad(off(p, hi, b), off(q, hi, b), off(q, hi, h), off(p, hi, h), nO);
  s.quad(off(p, lo, b), off(q, lo, b), off(q, lo, h), off(p, lo, h), nI);
}

/** The hex each part draws in, from the front's palette (stone, wall, trim). */
export function stoopColours(plan: Pick<StoopPlan, 'material'>, palette: {stone?: string; trim: string; wall: string}): Record<StoopPart, string> {
  return {body: plan.material === 'brick' ? palette.wall : plan.material === 'painted' ? palette.trim : palette.stone ?? palette.trim, iron: STOOP.ironHex, under: STOOP.underHex};
}

/** Triangle soup sink (GLB passes): faces wound outward by the given normal. Exported for tests and stoopMesh.ts. */
export function soupSink(values: number[]): RailSink {
  const quad = (a: V3, b: V3, c: V3, d: V3, n: V3) => {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) values.push(...a, ...c, ...b, ...a, ...d, ...c);
    else values.push(...a, ...b, ...c, ...a, ...c, ...d);
  };
  return {
    quad,
    box: (x0, x1, y0, y1, z0, z1, skip = []) => {
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
      if (!skip.includes('back')) quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
      quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
      quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
      if (!skip.includes('top')) quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
      if (!skip.includes('bottom')) quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    },
  };
}

/** Problems a fitted plan has with the front's openings: a flight or pier over a window or door below its top. */
export function stoopBlocks(plan: StoopPlan, openings: readonly {id: string; leftM: number; widthM: number; bottomM: number}[]): string[] {
  const out: string[] = [];
  for (const b of plan.boxes) if (b.part === 'body') for (const o of openings) {
    if (Math.min(b.x1, o.leftM + o.widthM) - Math.max(b.x0, o.leftM) > 0.02 && o.bottomM < b.y1 - 0.02 && b.z0 < 0.05) out.push(o.id);
  }
  return [...new Set(out)];
}

export {BALUSTER, STAIR_RAIL};
