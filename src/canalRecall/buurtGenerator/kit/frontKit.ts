/**
 * Buurt generator kit, the front (docs/handoffs/buurt-generators-20261115.md, round 2). A generated row member carries
 * `buurtKit` on its front record: the front line the generator measured (the longest street edge's line, over the
 * member's whole front, left to right as seen from the street) and the erkers BAG draws in front of it.
 *
 * BAG outlines are the plan from above, so an upper-storey erker is in the footprint and the game extruded it from the
 * pavement as a wall jog: the street front broke into several wall runs, and the row's stated bays were fitted to each
 * piece (a 4.0 m piece of a 7.95 m front drew two wide cells where the series has four, Biesboschstraat 0363100012077118).
 * Under `buurtKit` the record's outline is straightened onto its front line (`straightenFeature`: only vertices in front
 * of the line, within the member's span, move), so the front is one run, and the erker is drawn as what it is, a bay on
 * the upper storeys (roofKit.ts `drawErkers`). Pure: no fs, no DOM.
 */
export type LngLat = readonly [number, number];
/** One erker on a member's front: its base span (fractions of the front line, left to right as seen), depth and face width (m). */
export interface BuurtErker { a0: number; a1: number; depthM: number; faceM: number;
  /** Brick strips (front fractions) beside an erker that keeps BAG's span (round 5): where a cell's window would be half
   *  behind the erker, the kit bricks over the rest of that cell so no window pokes out beside it. */
  plates?: Array<[number, number]>;
  /** Round 12 (lane R, Plan Zuid photos): `timber` a white-painted timber bay front, the lights corner to corner on every
   *  face in thick white frames and corner posts, a band of small-paned toplights over a transom and pale glass; the
   *  brick shows only as the spandrels between storeys (Hunzestraat, Kuinderstraat, Stadionkade). Absent: brick between
   *  white-framed lights, as before. */
  front?: 'timber';
  /** The upper storeys the bay covers from the first floor (Stadionkade's one-storey oriels over the ground floor);
   *  absent: every upper storey to the line. */
  storeys?: number;
  /** A corner oriel: closed on its party-wall side too, where a half erker would be left open for its neighbour's half. */
  corner?: true;
  /** A white timber apron under the first storey's lights (Stadionkade's oriels), in place of the brick spandrel. */
  apron?: true }
/** An erker's covered upper storeys (its `storeys`, else all `rows`). */
export const erkerRowsOf = (k: BuurtErker, rows: number): number => Number.isInteger(k.storeys) && k.storeys! >= 1 ? Math.min(rows, k.storeys!) : rows;
export interface BuurtKitFront {
  /** The member's front line, left to right as seen from the street (lng/lat). */
  frontLine: [LngLat, LngLat];
  erkers: BuurtErker[];
  /** Erker windows as continuous white bands round all faces, corner to corner (round 5, Rooseveltlaan street note). */
  erkerBands?: true;
  /** Loggias on the upper storeys between the erkers (round 5, Rooseveltlaan's west end, a row note per member). */
  loggias?: true;
  /** The series roof: an eaves-front pitched roof at this pitch over the 3DBAG rise (roofs from the front: the photo
   *  shows it; 3DBAG gives its height). Absent: the series' stated roof storey as the row path draws it. */
  roof?: { pitchDeg: number; riseM: number; roofHex?: string; /** false: the series shows no dormers (Rooseveltlaan). */ dormers?: false;
    /** Broad flat eaves over the street front, this overhang (m) (round 4, Rooseveltlaan). */ eavesM?: number;
    /** false: the eaves slab sits on the line with no lattice frieze under it (Apollo: Minervalaan, Quinten Massijsstraat). */ eavesFrieze?: false };
  /** The series' windows are paired casements, one cell with a white mullion (round 3: Maasstraat). */
  sash?: 'paired-transom';
  /** The top storey is a ribbon of attic lights across the front, party wall to party wall (round 3: Maasstraat). */
  ribbon?: true;
  /** The top storey is the attic band (round 13): `KitAttic`. Wins over `ribbon`. */
  attic?: KitAttic;
  /** Raised brick parts over the line (round 13): `KitRaised`. */
  raised?: KitRaised[];
  /** The upper storeys' window rhythm (singles and the stair pair) drawn by the kit (round 4, roofKit.ts drawRhythm). */
  rhythm?: true;
  /** What stands at each party wall: a block's end pier or its middle (pair) wall (round 4). */
  sides?: { left?: 'pier' | 'pair'; right?: 'pier' | 'pair' };
  /** A flat series' low coping (erkers or ribbon on it) in the series brick, read as the parapet it is (round 3). */
  copingHex?: string;
  /** The member's row neighbours (left/right as seen): a flat series' coping runs on into theirs (no hip). */
  joins?: { left?: boolean; right?: boolean };
  /** A flat series' broad eaves (round 7, Apollo: the 3DBAG roof behind is not seen from the street), overhang (m). */
  eaves?: KitEaves;
  /** The member's street entrances (round 7, a row note from its photo): fraction across the front and what stands there. */
  entries?: BuurtEntry[];
}
/**
 * A flat series' broad eaves. `overhangM` the slab's reach over the street; `frieze` absent the Rooseveltlaan lattice
 * frieze under it, `false` none. Round 13 (lane R), each drawn only when stated:
 *  - `fasciaM` the slab's fascia (m; absent 0.4): the Plan Zuid slab is thin, 0.15-0.3 m (Hunzestraat, Kuinderstraat);
 *  - `lid` the slab is the flat roof's lid: it sits on the coping, so no brick coping shows over it (Hunzestraat: the
 *    coping read as a pitched brown band over the eaves), and the erkers rise to its soffit.
 */
export interface KitEaves { overhangM: number; frieze?: false; fasciaM?: number; lid?: true }
/** A kit's eaves, validated (null when absent or malformed); stated fields only, in a fixed order. */
export function kitEavesOf(v: unknown): KitEaves | null {
  const x = v as { overhangM?: unknown; frieze?: unknown; fasciaM?: unknown; lid?: unknown } | undefined;
  const ov = Number(x?.overhangM);
  if (!x || typeof x !== 'object' || !(ov > 0.2 && ov < 2)) return null;
  const f = Number(x.fasciaM);
  return { overhangM: ov, ...(x.frieze === false ? { frieze: false as const } : {}),
    ...(f >= 0.08 && f <= 0.8 ? { fasciaM: f } : {}), ...(x.lid === true ? { lid: true as const } : {}) };
}
/** The attic band (round 13, lane R; Stadionkade, Europaplein): the top storey drawn as a white band under the line
 *  with small paired lights, brick under it; `heightM` the band (m), `pitchM` the light pairs' pitch along the front. */
export interface KitAttic { heightM?: number; pitchM?: number }
/** A raised brick part over the series line (round 13, lane R; Pieter Lastmankade's stair blocks 0.65-1.2 m over the
 *  parapet, Amstelkade's block parapets, Rubensstraat's and Borssenburgstraat's piers): across [a0, a1] of the front (left
 *  to right as seen), `riseM` over the line, `outM` proud of the wall (absent: flush; a proud part runs from the pavement
 *  and hides the windows behind it, so it is for piers and fins between windows). */
export interface KitRaised { a0: number; a1: number; riseM: number; outM?: number }
export const raisedOf = (v: unknown): KitRaised[] => (Array.isArray(v) ? v : []).filter((r): r is KitRaised => !!r && typeof r === 'object'
  && [r.a0, r.a1, r.riseM].every(Number.isFinite) && r.a0 >= 0 && r.a1 <= 1 && r.a1 - r.a0 > 0.005 && r.riseM > 0.1 && r.riseM <= 6)
  .map(r => ({ a0: r.a0, a1: r.a1, riseM: r.riseM, ...(Number.isFinite(r.outM) && r.outM! > 0 && r.outM! <= 1.5 ? { outM: r.outM } : {}) }));
export function kitAtticOf(v: unknown): KitAttic | null {
  if (!v || typeof v !== 'object') return null;
  const x = v as { heightM?: unknown; pitchM?: unknown }, h = Number(x.heightM), p = Number(x.pitchM);
  return { ...(h >= 0.5 && h <= 3 ? { heightM: h } : {}), ...(p >= 0.6 && p <= 4 ? { pitchM: p } : {}) };
}
/** An entrance: `door` a red door in a white frame; `canopy` that door under a white flat canopy; `gable-bay` the
 *  portiek bay: a brick strip proud of the wall from the pavement through the eaves, the stair's narrow lights up it, the
 *  door under a canopy at its foot and a white gable with a dark diamond over the eaves (Sportstraat). */
export type BuurtEntryKind = 'door' | 'canopy' | 'gable-bay';
export interface BuurtEntry { a: number; kind: BuurtEntryKind; /** The series' ground cells: the kit redraws the member's ground storey with the door in its place (no stray door). */ cells?: number }
export const entriesOf = (v: unknown): BuurtEntry[] => (Array.isArray(v) ? v : []).filter((e): e is BuurtEntry => !!e && typeof e === 'object'
  && Number.isFinite(e.a) && e.a > 0 && e.a < 1 && (e.kind === 'door' || e.kind === 'canopy' || e.kind === 'gable-bay')).map(e => ({ a: e.a, kind: e.kind, ...(Number.isInteger(e.cells) && e.cells! >= 1 && e.cells! <= 12 ? { cells: e.cells } : {}) }));
/** The paired casements' white mullion, a share of the window's width (Maasstraat: about 0.5 m on a 1.6 m opening). */
export const KIT_MULLION_SHARE = 0.3;
/** A flat series draws the low coping when the kit hangs anything on its front (erkers, ribbon, rhythm, piers). */
/** Round 10: a member carrying its series' `copingHex` draws the coping too (the series line runs through). */
export const kitWantsCoping = (k: BuurtKitFront): boolean => !!(k.erkers.length || k.ribbon || k.attic || k.raised?.length || k.rhythm || k.sides || k.loggias || k.eaves || k.entries?.length || k.copingHex);
/** A flat series with erkers draws its lid as a low coping behind the white cornice ledge (m), the erkers on it. */
export const KIT_FLAT_RISE_M = 0.55;

/** Vertices further than this (m) in front of the line are an erker; nearer, a BAG jitter that straightening also takes. */
export const ERKER_MIN_M = 0.2;
/** Deeper than this (m) is a wing or a shop extension, not an erker: left as BAG draws it. */
export const ERKER_MAX_M = 1.5;
/** An erker narrower than this (m) is a pilaster or a chamfer. */
export const ERKER_MIN_WIDTH_M = 0.9;
/** Wider than this (m) is a wing or a stepped front: left as BAG draws it. */
export const ERKER_MAX_WIDTH_M = 3.5;
/** Straightening moves a vertex at most this far onto the line (m), and only within the line's span (+ this margin). */
const SNAP_MAX_M = ERKER_MAX_M, SPAN_MARGIN_M = 0.05;

type XY = { x: number; y: number };
const sub = (a: XY, b: XY): XY => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: XY, b: XY) => a.x * b.x + a.y * b.y;
const len = (a: XY) => Math.hypot(a.x, a.y);

/**
 * The erkers of one front (generator side, local metres). `ring` is the outline, `lineA`/`lineB` the front line left to
 * right as seen, `n` its outward normal. Contiguous runs of vertices in front of the line by ERKER_MIN_M..ERKER_MAX_M
 * are one erker each; its base is where the run leaves and rejoins the line.
 */
export function erkersOf(ring: readonly XY[], lineA: XY, lineB: XY, n: XY): BuurtErker[] {
  const L = len(sub(lineB, lineA));
  if (!(L > 1)) return [];
  const u = { x: (lineB.x - lineA.x) / L, y: (lineB.y - lineA.y) / L };
  const pts = ring.length > 1 && ring[0].x === ring[ring.length - 1].x && ring[0].y === ring[ring.length - 1].y ? ring.slice(0, -1) : ring.slice();
  const N = pts.length;
  const off = pts.map(p => dot(sub(p, lineA), n)), t = pts.map(p => dot(sub(p, lineA), u));
  const inSpan = (i: number) => t[i] > -SPAN_MARGIN_M && t[i] < L + SPAN_MARGIN_M;
  const out = (i: number) => off[i] > ERKER_MIN_M && off[i] <= ERKER_MAX_M && inSpan(i);
  const near = (i: number) => Math.abs(off[i]) <= ERKER_MIN_M && inSpan(i);
  // Start the walk on a vertex on the line, so no run wraps round the ring's start.
  const start = pts.findIndex((_, i) => near(i));
  if (start < 0) return [];
  const found: BuurtErker[] = [];
  let run: number[] = [];
  // A run that reaches the front's end is half of a pair across the party wall: its base there is the line's end.
  const END_M = 0.2, atEnd = (j: number) => t[j] < END_M ? 0 : t[j] > L - END_M ? L : null;
  for (let k = 1; k <= N; k++) {
    const i = (start + k) % N;
    if (out(i)) { run.push(i); continue; }
    if (run.length) {
      const before = (run[0] - 1 + N) % N, after = i;
      const ea = near(before) ? t[before] : atEnd(run[0]), eb = near(after) ? t[after] : atEnd(run[run.length - 1]);
      if (ea !== null && eb !== null && (near(before) || near(after))) {
        const ta = Math.min(ea, eb), tb = Math.max(ea, eb);
        const depth = Math.max(...run.map(j => off[j]));
        const outer = run.filter(j => off[j] >= depth - 0.12).map(j => t[j]);
        const face = outer.length >= 2 ? Math.max(...outer) - Math.min(...outer) : 0;
        if (tb - ta >= ERKER_MIN_WIDTH_M && tb - ta <= ERKER_MAX_WIDTH_M) found.push({ a0: +Math.max(0, ta / L).toFixed(4), a1: +Math.min(1, tb / L).toFixed(4), depthM: +depth.toFixed(2), faceM: +Math.min(tb - ta, face).toFixed(2) });
      }
    }
    run = [];
  }
  return found.sort((p, q) => p.a0 - q.a0);
}

/** A record's `buurtKit`, validated; null when absent or malformed. */
export function buurtKitOf(v: unknown): BuurtKitFront | null {
  if (!v || typeof v !== 'object') return null;
  const k = v as { frontLine?: unknown; erkers?: unknown; roof?: { pitchDeg?: unknown; riseM?: unknown }; joins?: { left?: unknown; right?: unknown } };
  const line = k.frontLine as unknown[] | undefined;
  const pt = (p: unknown): p is LngLat => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
  if (!Array.isArray(line) || line.length !== 2 || !pt(line[0]) || !pt(line[1])) return null;
  const erkers = (Array.isArray(k.erkers) ? k.erkers : []).filter((e): e is BuurtErker => !!e && typeof e === 'object'
    && [e.a0, e.a1, e.depthM, e.faceM].every(Number.isFinite) && e.a1 > e.a0 && e.depthM > 0);
  const hex = k.roof && typeof (k.roof as { roofHex?: unknown }).roofHex === 'string' && /^#[0-9a-f]{6}$/i.test((k.roof as { roofHex: string }).roofHex) ? (k.roof as { roofHex: string }).roofHex : null;
  const rr = k.roof as { dormers?: unknown; eavesM?: unknown; eavesFrieze?: unknown } | undefined, eavesM = Number(rr?.eavesM);
  const roof = k.roof && Number(k.roof.pitchDeg) > 10 && Number(k.roof.pitchDeg) < 80 && Number(k.roof.riseM) > 0.5 ? { pitchDeg: Number(k.roof.pitchDeg), riseM: Number(k.roof.riseM), ...(hex ? { roofHex: hex } : {}),
    ...(rr?.dormers === false ? { dormers: false as const } : {}), ...(eavesM > 0.2 && eavesM < 2 ? { eavesM, ...(rr?.eavesFrieze === false ? { eavesFrieze: false as const } : {}) } : {}) } : undefined;
  const x = v as { sash?: unknown; ribbon?: unknown; attic?: unknown; raised?: unknown; copingHex?: unknown; rhythm?: unknown; erkerBands?: unknown; loggias?: unknown; sides?: { left?: unknown; right?: unknown }; eaves?: unknown; entries?: unknown };
  const flatEaves = !roof ? kitEavesOf(x.eaves) : null, entries = entriesOf(x.entries), attic = kitAtticOf(x.attic), raised = raisedOf(x.raised);
  const side = (q: unknown) => q === 'pier' || q === 'pair' ? q : null, sl = side(x.sides?.left), sr = side(x.sides?.right);
  const joins = k.joins && typeof k.joins === 'object' ? { ...(k.joins.left === true ? { left: true } : {}), ...(k.joins.right === true ? { right: true } : {}) } : {};
  return { frontLine: [[line[0][0], line[0][1]], [line[1][0], line[1][1]]], erkers, ...(roof ? { roof } : {}), ...(x.sash === 'paired-transom' ? { sash: 'paired-transom' as const } : {}), ...(x.ribbon === true ? { ribbon: true as const } : {}), ...(typeof x.copingHex === 'string' && /^#[0-9a-f]{6}$/i.test(x.copingHex) ? { copingHex: x.copingHex } : {}), ...(x.rhythm === true ? { rhythm: true as const } : {}), ...(x.erkerBands === true ? { erkerBands: true as const } : {}), ...(x.loggias === true ? { loggias: true as const } : {}), ...(sl || sr ? { sides: { ...(sl ? { left: sl } : {}), ...(sr ? { right: sr } : {}) } } : {}), ...(joins.left || joins.right ? { joins } : {}), ...(flatEaves ? { eaves: flatEaves } : {}), ...(entries.length ? { entries } : {}), ...(attic ? { attic } : {}), ...(raised.length ? { raised } : {}) };
}

/**
 * Erkers on the series' window cells (round 3): BAG draws the erker's plan, the series its bays. An erker takes as many
 * whole cells as its base reaches into, centred where BAG puts it (a half erker at a party wall one cell), so no wall window pokes out beside it
 * (Biesboschstraat 077118: BAG's 2.1 m base at 0.47-0.73 of a four-cell 7.95 m front; the photo shows the erker over the
 * middle two axes, a window either side). Canted: the face is the base less twice the depth, at most 55 % of the base
 * (photo: about 2.0 m on that 4 m base). A half erker at a party wall keeps that end. Overlapping results merge.
 */
export function erkersOnCells(erkers: readonly BuurtErker[], bays: number, widthM: number, windowShare = 0.71): BuurtErker[] {
  if (!(bays >= 1) || !(widthM > 0)) return [...erkers];
  const out: BuurtErker[] = [], cw = 1 / bays;
  for (const k of erkers) {
    // A whole erker takes the cells its base reaches into (a tenth of a cell over is a whole cell); a half one at a party
    // wall takes one cell, its neighbour's half the other: two axes for the pair, as the photo's whole erkers.
    const atL = k.a0 <= 0.005, atR = k.a1 >= 0.995, span = k.a1 - k.a0;
    const n = atL || atR ? 1 : Math.min(bays, Math.max(1, Math.ceil(span / cw + 0.1)));
    const start = atL ? 0 : atR ? bays - n : Math.max(0, Math.min(bays - n, Math.round((k.a0 + k.a1) / 2 / cw - n / 2)));
    const a0 = +(start * cw).toFixed(4), a1 = +((start + n) * cw).toFixed(4), base = (a1 - a0) * widthM;
    const canted = k.faceM < span * widthM - 0.15, half = atL || atR;
    // A whole erker the cells would carry onto a party wall would be drawn as half of a pair (open on that side): it
    // keeps BAG's span and face instead, and names the cells it stands over (Rooseveltlaan 080196: BAG 0.64-3.59 m of
    // 9.38 m, two cells from the wall; Biesboschstraat 088307: 5.09-7.47 m of 8.51 m).
    if (!half && (a0 <= 0.005 || a1 >= 0.995)) {
      const prevW = out[out.length - 1];
      if (prevW && k.a0 < prevW.a1 - 1e-6) { prevW.a1 = Math.max(prevW.a1, k.a1); continue; }
      // A cell whose window the erker covers in part: brick over the rest of that cell (its whole window goes).
      const plates: Array<[number, number]> = [];
      for (let c = start; c < start + n; c++) {
        const w0 = (c + (1 - windowShare) / 2) * cw, w1 = (c + (1 + windowShare) / 2) * cw;
        if (w0 < k.a0 && w1 > k.a0) plates.push([+(c * cw).toFixed(4), +k.a0.toFixed(4)]);
        if (w1 > k.a1 && w0 < k.a1) plates.push([+k.a1.toFixed(4), +((c + 1) * cw).toFixed(4)]);
      }
      out.push({ a0: +k.a0.toFixed(4), a1: +k.a1.toFixed(4), depthM: k.depthM, faceM: +k.faceM.toFixed(2), ...(plates.length ? { plates } : {}) });
      continue;
    }
    const faceM = +(canted ? Math.max(0.6, Math.min(base - (half ? 1 : 2) * k.depthM, base * (half ? 0.78 : 0.55))) : base).toFixed(2);
    const prev = out[out.length - 1];
    if (prev && a0 < prev.a1 - 1e-6) { prev.a1 = Math.max(prev.a1, a1); prev.faceM = Math.max(prev.faceM, faceM); continue; }
    out.push({ a0, a1, depthM: k.depthM, faceM });
  }
  return out;
}

/**
 * The outline with every vertex in front of the front line (within the member's span, at most SNAP_MAX_M out) moved onto
 * it, and the points that end up on one straight line merged: the street front is one wall run. Lng/lat in and out,
 * metres on a local frame at the line's start. Vertices behind the line (a recessed porch) stay.
 */
export function straightenRing(ring: readonly LngLat[], line: readonly [LngLat, LngLat], erkers: readonly BuurtErker[] = []): LngLat[] {
  const [lng0, lat0] = line[0], kx = 111_320 * Math.cos(lat0 * Math.PI / 180), ky = 110_540;
  const to = ([lng, lat]: LngLat): XY => ({ x: (lng - lng0) * kx, y: (lat - lat0) * ky });
  const back = (p: XY): LngLat => [+(lng0 + p.x / kx).toFixed(9), +(lat0 + p.y / ky).toFixed(9)];
  const A = to(line[0]), B = to(line[1]), L = len(sub(B, A));
  if (!(L > 1)) return ring.slice();
  const u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L }, n = { x: u.y, y: -u.x }; // outward: (right.y, -right.x)
  const closed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const open = (closed ? ring.slice(0, -1) : ring.slice()).map(to);
  const moved = open.map(p => {
    const o = dot(sub(p, A), n), t = dot(sub(p, A), u);
    // BAG jitter either side of the line, or a vertex of one of the record's erkers; a deeper step elsewhere (a wing, a
    // projection to the party wall) stays as BAG draws it.
    const erker = o > 0 && o <= SNAP_MAX_M && erkers.some(k => t >= k.a0 * L - SPAN_MARGIN_M && t <= k.a1 * L + SPAN_MARGIN_M);
    return (Math.abs(o) <= ERKER_MIN_M || erker) && Math.abs(o) > 1e-4 && t > -SPAN_MARGIN_M && t < L + SPAN_MARGIN_M ? { x: A.x + u.x * t, y: A.y + u.y * t } : p;
  });
  // Drop repeated points, points in the middle of a straight line (the erker's foot) and spikes (a point the outline
  // runs out to and straight back from), until none is left; the outline's turns stay.
  let keep = moved;
  for (let pass = 0; pass < 8; pass++) {
    const pts = keep.filter((p, i) => len(sub(p, keep[(i - 1 + keep.length) % keep.length])) > 0.01);
    const next = pts.filter((p, i) => {
      const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
      const e = sub(b, a), l = len(e);
      if (l < 1e-6) return false;
      return Math.abs((p.x - a.x) * e.y - (p.y - a.y) * e.x) / l >= 0.01;
    });
    if (next.length === keep.length) break;
    keep = next;
  }
  if (keep.length < 3) return ring.slice();
  // On the world cells' 1e-7 degree grid (cellFormat.ts FOOT), as rowWallSlab: the compile bakes this ring as the footprint.
  const grid = (v: number) => Math.round(v * 1e7) / 1e7;
  const outRing = keep.map(back).map((q): LngLat => [grid(q[0]), grid(q[1])]);
  return closed ? [...outRing, outRing[0]] : outRing;
}

type Feature = { type?: string; geometry: unknown; properties: Record<string, unknown> };
/** The feature with its outer ring straightened onto the kit's front line (Polygon or single MultiPolygon); else unchanged. */
export function straightenFeature<T extends Feature>(feature: T, kit: BuurtKitFront): T {
  const g = feature.geometry as { type?: string; coordinates?: any } | null;
  if (!g) return feature;
  if (g.type === 'Polygon') return { ...feature, geometry: { type: 'Polygon', coordinates: [straightenRing(g.coordinates[0], kit.frontLine, kit.erkers), ...g.coordinates.slice(1)] } };
  if (g.type === 'MultiPolygon' && g.coordinates.length === 1) return { ...feature, geometry: { type: 'MultiPolygon', coordinates: [[straightenRing(g.coordinates[0][0], kit.frontLine, kit.erkers), ...g.coordinates[0].slice(1)]] } };
  return feature;
}
