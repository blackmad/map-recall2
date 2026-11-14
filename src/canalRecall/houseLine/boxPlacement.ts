/**
 * Lane 1 step d (rowFront flag): place window units on measured boxes.
 *
 * A front's windows are boxes (along the run in metres, sill and head in metres). Each box gets one quad cropped to a
 * window unit's texture rect (the unit's window plus its frame and sill margin), sized so the unit's window lands
 * exactly on the box. The rest of the front is tiled with plain-wall pieces: full-width strips between window rows,
 * piers between windows and the wall above and below a window inside its row.
 *
 * Nothing here knows what a unit is. Today a unit is a crop of an existing atlas cell (look/windowTable.ts gives the
 * cell's window rect); later a separate window-unit array with its own designs supplies the same `WindowUnit`.
 */

/** A measured window: along the run (m from the run start) and sill/head (m, the same z frame as the region). */
export interface WindowBox { a0: number; a1: number; sillM: number; headM: number; kind?: string }

/** What placement needs from a unit: its window's width/height ratio, its margins (frame, sill) as fractions of the
 *  window's own width/height, and the texture rect of window plus margins (any uv frame the caller uses). */
export interface WindowUnit {
  aspect: number;
  margin: { l: number; r: number; t: number; b: number };
  uv: { u0: number; u1: number; v0: number; v1: number };
  /** The caller's tag for where the unit's texture lives (today: the atlas layer of the cell it is cropped from). */
  layer?: number;
}

export interface PlacedWindow { a0: number; a1: number; z0: number; z1: number; u0: number; u1: number; v0: number; v1: number; stretch: number; box: WindowBox; unit: WindowUnit }
export interface WallPiece { a0: number; a1: number; z0: number; z1: number }
export interface Placement { windows: PlacedWindow[]; walls: WallPiece[] }

/** Largest allowed ratio between the box's aspect and the unit's (either way). Beyond it the caller keeps its grid. */
export const STRETCH_CAP = 1.6;

/** The stretch a unit takes on a box: box aspect over unit aspect (1 = undistorted). */
export function stretchOf(box: WindowBox, unit: Pick<WindowUnit, 'aspect'>): number {
  return ((box.a1 - box.a0) / (box.headM - box.sillM)) / unit.aspect;
}

/** Of several units, the one whose median stretch over the boxes is nearest 1 (index), or -1 when none is under the cap. */
export function nearestUnit(boxes: readonly WindowBox[], units: readonly Pick<WindowUnit, 'aspect'>[], cap = STRETCH_CAP): number {
  let best = -1, bestErr = Infinity;
  units.forEach((u, i) => {
    const s = boxes.map(b => Math.abs(Math.log(stretchOf(b, u)))).sort((p, q) => p - q);
    const err = s.length ? s[s.length >> 1] : Infinity;
    if (err < bestErr && err <= Math.log(cap)) { best = i; bestErr = err; }
  });
  return best;
}

/**
 * Place a unit (one for all, or one per box) on every box inside the region [0, lengthM] x [z0, z1]. Returns null (the caller keeps its grid) when a
 * box is degenerate, outside the region, stretched past the cap, or overlaps another box's frame.
 */
export function placeOnBoxes(boxes: readonly WindowBox[], units: WindowUnit | ((box: WindowBox) => WindowUnit | null), region: { lengthM: number; z0: number; z1: number }, cap = STRETCH_CAP): Placement | null {
  const { lengthM: L, z0, z1 } = region;
  if (!boxes.length || !(L > 0) || !(z1 > z0)) return null;
  const unitOf = new Map<WindowBox, WindowUnit>();
  for (const box of boxes) {
    if (!(box.a1 - box.a0 > 0.1) || !(box.headM - box.sillM > 0.1)) return null;
    const unit = typeof units === 'function' ? units(box) : units;
    if (!unit) return null;
    unitOf.set(box, unit);
    const stretch = stretchOf(box, unit);
    if (!(stretch <= cap && stretch >= 1 / cap)) return null;
    if (box.a0 < -1e-6 || box.a1 > L + 1e-6 || box.sillM < z0 - 1e-6 || box.headM > z1 + 1e-6) return null;
  }
  // Each unit's margins (frame, sill) stop halfway to a neighbouring box: side by side in a row, or stacked in a column.
  const lim = boxes.map(b => ({ a0: 0, a1: L, zb: z0, zt: z1, b }));
  for (let i = 0; i < boxes.length; i++) for (let j = 0; j < boxes.length; j++) {
    if (i === j) continue;
    const p = boxes[i], q = boxes[j];
    const xOver = Math.min(p.a1, q.a1) - Math.max(p.a0, q.a0) > 1e-6, zOver = Math.min(p.headM, q.headM) - Math.max(p.sillM, q.sillM) > 1e-6;
    if (xOver && zOver) return null;
    if (zOver) { if (q.a0 >= p.a1) lim[i].a1 = Math.min(lim[i].a1, (p.a1 + q.a0) / 2); else lim[i].a0 = Math.max(lim[i].a0, (q.a1 + p.a0) / 2); }
    else if (xOver) { if (q.sillM >= p.headM) lim[i].zt = Math.min(lim[i].zt, (p.headM + q.sillM) / 2); else lim[i].zb = Math.max(lim[i].zb, (q.headM + p.sillM) / 2); }
  }
  const windows: PlacedWindow[] = [];
  for (const { a0: la0, a1: la1, zb: lzb, zt: lzt, b: box } of lim) {
    const unit = unitOf.get(box)!, w = box.a1 - box.a0, h = box.headM - box.sillM;
    const a0 = Math.max(la0, box.a0 - unit.margin.l * w), a1 = Math.min(la1, box.a1 + unit.margin.r * w);
    const zb = Math.max(lzb, box.sillM - unit.margin.b * h), zt = Math.min(lzt, box.headM + unit.margin.t * h);
    // A margin cut short crops the unit's uv by the same share.
    const fu = (a: number) => unit.uv.u0 + (unit.uv.u1 - unit.uv.u0) * (a - (box.a0 - unit.margin.l * w)) / (w * (1 + unit.margin.l + unit.margin.r));
    const fv = (z: number) => unit.uv.v0 + (unit.uv.v1 - unit.uv.v0) * (z - (box.sillM - unit.margin.b * h)) / (h * (1 + unit.margin.b + unit.margin.t));
    windows.push({ a0, a1, z0: zb, z1: zt, u0: fu(a0), u1: fu(a1), v0: fv(zb), v1: fv(zt), stretch: stretchOf(box, unit), box, unit });
  }
  // Rows: windows whose framed z ranges overlap share a band.
  const sorted = [...windows].sort((p, q) => p.z0 - q.z0);
  const bands: Array<{ z0: number; z1: number; members: PlacedWindow[] }> = [];
  for (const win of sorted) {
    const last = bands[bands.length - 1];
    if (last && win.z0 < last.z1 - 1e-6) { last.z1 = Math.max(last.z1, win.z1); last.members.push(win); }
    else bands.push({ z0: win.z0, z1: win.z1, members: [win] });
  }
  const walls: WallPiece[] = [];
  const push = (a0: number, a1: number, zb: number, zt: number) => { if (a1 - a0 > 1e-4 && zt - zb > 1e-4) walls.push({ a0, a1, z0: zb, z1: zt }); };
  let z = z0;
  for (const band of bands) {
    push(0, L, z, band.z0);
    const row = band.members.sort((p, q) => p.a0 - q.a0);
    let a = 0;
    for (const win of row) {
      if (win.a0 < a - 1e-6) return null;
      push(a, win.a0, band.z0, band.z1);
      push(win.a0, win.a1, band.z0, win.z0);
      push(win.a0, win.a1, win.z1, band.z1);
      a = win.a1;
    }
    push(a, L, band.z0, band.z1);
    z = band.z1;
  }
  push(0, L, z, z1);
  return { windows, walls };
}

/**
 * Interim boxes (until lane 2's traced boxes land): one box per bay on each measured row, centred in its bay, `share`
 * of the bay wide. Rows are sill/head above the pand's ground; `base` shifts them into the region's z frame.
 */
export function interimBoxes(rows: readonly { sillM: number; headM: number }[], bays: number, lengthM: number, share = 0.62, base = 0): WindowBox[] {
  if (!(bays >= 1) || !(lengthM > 0)) return [];
  const bay = lengthM / bays;
  return rows.flatMap(r => Array.from({ length: bays }, (_, i) => ({ a0: (i + 0.5) * bay - share * bay / 2, a1: (i + 0.5) * bay + share * bay / 2, sillM: r.sillM + base, headM: r.headM + base })));
}

/** A ground-storey opening along the run (m): a door, a shop window or a plain ground window. */
export type GroundKind = 'door' | 'shop' | 'window';
export interface GroundSpan { a0: number; a1: number; kind: GroundKind | 'wall'; sillM?: number; headM?: number }

/**
 * The ground storey of a run cut at its traced openings: every opening is one span (overlapping neighbours meet at the
 * middle of their overlap), the rest is plain wall. Spans cover [0, lengthM] left to right without gaps; openings
 * narrower than `minM` after clipping are dropped into the wall.
 */
export function groundSpans(openings: readonly { a0: number; a1: number; kind: GroundKind; sillM?: number; headM?: number }[], lengthM: number, minM = 0.1): GroundSpan[] {
  if (!(lengthM > 0)) return [];
  const sorted = openings.map(o => ({ ...o, a0: Math.max(0, o.a0), a1: Math.min(lengthM, o.a1) })).filter(o => o.a1 > o.a0).sort((p, q) => p.a0 - q.a0);
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i - 1], q = sorted[i];
    if (q.a0 < p.a1) { const m = (Math.max(p.a0, q.a0) + Math.min(p.a1, q.a1)) / 2; p.a1 = Math.min(p.a1, m); q.a0 = Math.max(q.a0, m); }
  }
  const out: GroundSpan[] = [];
  let a = 0;
  for (const o of sorted) {
    if (o.a1 - o.a0 < minM) continue;
    if (o.a0 > a + 1e-6) out.push({ a0: a, a1: o.a0, kind: 'wall' });
    out.push({ ...o, a0: Math.max(a, o.a0) });
    a = o.a1;
  }
  if (a < lengthM - 1e-6) out.push({ a0: a, a1: lengthM, kind: 'wall' });
  return out;
}

/**
 * One cell's opening (its rect in the cell's uv, v up) put on a box: the cell runs vertically so the opening's bottom
 * and top land on the box's sill and head, cut to the region [z0, z1]; `walls` are the region's rest above and below.
 */
export function cellOnBox(rect: { v0: number; v1: number }, box: { sillM: number; headM: number }, z0: number, z1: number): { z0: number; z1: number; v0: number; v1: number; walls: Array<[number, number]> } | null {
  const k = (rect.v1 - rect.v0) / (box.headM - box.sillM);
  if (!(k > 0) || !(z1 > z0)) return null;
  const v = (z: number) => rect.v0 + (z - box.sillM) * k, zAt = (vv: number) => box.sillM + (vv - rect.v0) / k;
  const q0 = Math.max(z0, zAt(0)), q1 = Math.min(z1, zAt(1));
  if (!(q1 - q0 > 0.05)) return null;
  const walls: Array<[number, number]> = [];
  if (q0 > z0 + 1e-3) walls.push([z0, q0]);
  if (q1 < z1 - 1e-3) walls.push([q1, z1]);
  return { z0: q0, z1: q1, v0: v(q0), v1: v(q1), walls };
}
