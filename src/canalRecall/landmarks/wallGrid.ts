/**
 * Window grids on overlapping boxes: where each pane of a `grid()` box goes once the other boxes of the same model
 * are known (scripts/landmarks/cultural-builders.ts).
 *
 * Why (feedback a4013653 / 10ada6d9, 2026-11-14, the Pontsteiger): `grid()` glazed all four faces of every box it
 * was given. The Pontsteiger is built from overlapping boxes: the tower legs and the skybridge share their front and
 * back planes, so two grids with different column and row phases landed on one wall and read as a chequer; the low
 * front bar stands 0.4 m behind the legs' front face, so its panes doubled the column at the seam. The kit could not
 * say "this face is buried" or "these two boxes are one wall".
 *
 * Rules, all measured in metres in the model frame (x across, y up, z towards the front):
 * - A face is a wall plane of one grid box. Faces of different grid boxes with the same normal, planes within
 *   `tolerance` (0.5 m) of each other and overlapping rectangles form one wall. A wall gets one column phase and one
 *   row phase, anchored at its lower-left corner; each pane goes on the outermost member face under it (ties: the
 *   box declared first), so a seam never doubles a column.
 * - A pane is dropped when other boxes (anything that is not a member of its wall) cover at least `coverage` (half)
 *   of it within `tolerance` in front of its face: a face buried in, or flush behind, another box is not glazed.
 *   Thin bands that cross a pane (a string course) cover less than half and keep it.
 * - A face alone on its wall with nothing in front of it keeps exactly the panes, values and order `grid()` always
 *   drew, so models without overlapping boxes rebuild byte-identical.
 */
export interface Aabb {x0: number; x1: number; y0: number; y1: number; z0: number; z1: number}

/** The arguments of `grid(x, y, z, width, height, depth, colour, step)`: x/z centre, y bottom. */
export interface GridBox {x: number; y: number; z: number; width: number; height: number; depth: number; step: number}

/** A pane as `box(x, y, z, w, h, d)` takes it: x/z centre, y bottom. */
export interface Pane {x: number; y: number; z: number; w: number; h: number; d: number}

export interface WallGridOptions {
  /** Planes closer than this are one wall; boxes closer than this in front of a pane cover it (m). */
  tolerance?: number;
  /** Fraction of a pane's area other boxes must cover before it is dropped. */
  coverage?: number;
}

/** The pane geometry `grid()` has always used. */
export const ROW_PITCH = 3.4, ROW_START = 1.2, ROW_END = 1.3, COL_START = 1.5, COL_END = 1, PANE_H = 1.9, PANE_T = 0.12, PANE_OUT = 0.05;

export function gridAabb(g: GridBox): Aabb {
  return {x0: g.x - g.width / 2, x1: g.x + g.width / 2, y0: g.y, y1: g.y + g.height, z0: g.z - g.depth / 2, z1: g.z + g.depth / 2};
}

/** Axis-aligned bounds of `box(x, y, z, w, h, d, c, angle)` (rotation about y). */
export function boxAabb(x: number, y: number, z: number, w: number, h: number, d: number, angle = 0): Aabb {
  const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  const hx = angle ? (w * c + d * s) / 2 : w / 2, hz = angle ? (w * s + d * c) / 2 : d / 2;
  return {x0: x - hx, x1: x + hx, y0: y, y1: y + h, z0: z - hz, z1: z + hz};
}

type Axis = 'x' | 'z';
interface Face {grid: number; axis: Axis; sign: -1 | 1; plane: number; u0: number; u1: number; v0: number; v1: number; step: number}
/** A pane on a face in that face's grid-local terms: u across the face (relative to the box centre), v the pane bottom. */
interface Cell {u: number; v: number; w: number}

// Face order matches grid(): the z faces (front/back, u along x) then the x faces (sides, u along z), sign -1 then +1.
function facesOf(g: GridBox, i: number): Face[] {
  const b = gridAabb(g), out: Face[] = [];
  for (const s of [-1, 1] as const) out.push({grid: i, axis: 'z', sign: s, plane: s < 0 ? b.z0 : b.z1, u0: b.x0, u1: b.x1, v0: b.y0, v1: b.y1, step: g.step});
  for (const s of [-1, 1] as const) out.push({grid: i, axis: 'x', sign: s, plane: s < 0 ? b.x0 : b.x1, u0: b.z0, u1: b.z1, v0: b.y0, v1: b.y1, step: g.step});
  return out;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Share of the pane rectangle (in-plane u x v) that the boxes cover within `tol` in front of the face plane. */
function covered(f: Face, uc: number, w: number, v: number, boxes: Aabb[], tol: number): number {
  const a0 = uc - w / 2, a1 = uc + w / 2, b0 = v, b1 = v + PANE_H, area = (a1 - a0) * (b1 - b0);
  // The slab in front of the face, along its outward normal.
  const n0 = f.sign > 0 ? f.plane : f.plane - tol, n1 = f.sign > 0 ? f.plane + tol : f.plane;
  let sum = 0;
  for (const o of boxes) {
    const [p0, p1, q0, q1] = f.axis === 'z' ? [o.z0, o.z1, o.x0, o.x1] : [o.x0, o.x1, o.z0, o.z1];
    if (overlap(p0, p1, n0, n1) <= 1e-6) continue;
    sum += overlap(q0, q1, a0, a1) * overlap(o.y0, o.y1, b0, b1);
  }
  return sum / area;
}

/** The original grid() loops, in a face's local terms. */
function soloCells(g: GridBox, f: Face): Cell[] {
  const out: Cell[] = [], half = f.axis === 'z' ? g.width / 2 : g.depth / 2;
  for (let v = g.y + ROW_START; v < g.y + g.height - ROW_END; v += ROW_PITCH)
    for (let u = -half + COL_START; u < half - COL_END; u += g.step) out.push({u, v, w: g.step * 0.6});
  return out;
}

/**
 * Panes for every grid box, in the order `grid()` emits them for that box. `others` are the model's other solid
 * boxes (not the grid boxes themselves, which are taken from `grids`).
 */
export function planWallGrids(grids: GridBox[], others: Aabb[], opts: WallGridOptions = {}): Pane[][] {
  const tol = opts.tolerance ?? 0.5, need = opts.coverage ?? 0.5;
  const faces = grids.flatMap(facesOf);
  // Walls: union faces of different boxes with the same normal, near planes and overlapping rectangles.
  const parent = faces.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) {
    const a = faces[i], b = faces[j];
    if (a.grid === b.grid || a.axis !== b.axis || a.sign !== b.sign || Math.abs(a.plane - b.plane) > tol) continue;
    if (overlap(a.u0, a.u1, b.u0, b.u1) <= 1e-6 || overlap(a.v0, a.v1, b.v0, b.v1) <= 1e-6) continue;
    parent[find(j)] = find(i);
  }
  const walls = new Map<number, number[]>();
  faces.forEach((_, i) => walls.set(find(i), [...(walls.get(find(i)) ?? []), i]));
  const boxes = grids.map(gridAabb);
  const cells: Cell[][] = faces.map(() => []);
  for (const members of walls.values()) {
    const blockers = [...others, ...boxes.filter((_, g) => !members.some(m => faces[m].grid === g))];
    if (members.length === 1) {
      const f = faces[members[0]], g = grids[f.grid], c = f.axis === 'z' ? g.x : g.z;
      cells[members[0]] = soloCells(g, f).filter(cell => covered(f, c + cell.u, cell.w, cell.v, blockers, tol) < need);
      continue;
    }
    // One wall, one phase: columns walk from the wall's left edge at the step of the face under them; rows from its foot.
    const fs = members.map(m => faces[m]);
    const U0 = Math.min(...fs.map(f => f.u0)), U1 = Math.max(...fs.map(f => f.u1));
    const V0 = Math.min(...fs.map(f => f.v0)), V1 = Math.max(...fs.map(f => f.v1));
    const cols: number[] = [];
    for (let u = U0 + COL_START; u < U1 - COL_END;) {
      cols.push(u);
      u += (fs.find(f => u >= f.u0 && u <= f.u1) ?? fs[0]).step;
    }
    for (let v = V0 + ROW_START; v < V1 - ROW_END; v += ROW_PITCH) {
      const live = members.filter(m => v >= faces[m].v0 + ROW_START - 1e-6 && v < faces[m].v1 - ROW_END);
      if (!live.length) continue;
      // Runs of continuous wall on this row; panes keep 0.4 m off a run's ends.
      const spans = live.map(m => [faces[m].u0, faces[m].u1]).sort((a, b) => a[0] - b[0]);
      const runs: number[][] = [];
      for (const s of spans) if (runs.length && s[0] <= runs[runs.length - 1][1] + tol) runs[runs.length - 1][1] = Math.max(runs[runs.length - 1][1], s[1]); else runs.push([...s]);
      for (const u of cols) {
        const under = live.filter(m => u >= faces[m].u0 && u <= faces[m].u1);
        if (!under.length) continue;
        const owner = under.reduce((a, b) => (faces[b].sign * faces[b].plane > faces[a].sign * faces[a].plane + 1e-6 ? b : a));
        const f = faces[owner], w = f.step * 0.6, run = runs.find(r => u >= r[0] && u <= r[1])!;
        if (u - w / 2 < run[0] + 0.4 || u + w / 2 > run[1] - 0.4) continue;
        if (covered(f, u, w, v, blockers, tol) >= need) continue;
        const g = grids[f.grid];
        cells[owner].push({u: u - (f.axis === 'z' ? g.x : g.z), v, w});
      }
    }
  }
  // Emit per box in grid()'s order: row by row; the z faces then the x faces; across the face; sign -1 then +1.
  return grids.map((g, gi) => {
    const own = faces.map((f, i) => ({f, c: cells[i]})).filter(e => e.f.grid === gi);
    const rows = [...new Set(own.flatMap(e => e.c.map(c => c.v)))].sort((a, b) => a - b);
    const out: Pane[] = [];
    for (const v of rows) for (const axis of ['z', 'x'] as const) {
      const pair = own.filter(e => e.f.axis === axis);
      const us = [...new Set(pair.flatMap(e => e.c.filter(c => c.v === v).map(c => c.u)))].sort((a, b) => a - b);
      for (const u of us) for (const e of pair) {
        const c = e.c.find(k => k.v === v && k.u === u);
        if (!c) continue;
        const s = e.f.sign;
        out.push(axis === 'z'
          ? {x: g.x + u, y: v, z: g.z + s * (g.depth / 2 + PANE_OUT), w: c.w, h: PANE_H, d: PANE_T}
          : {x: g.x + s * (g.width / 2 + PANE_OUT), y: v, z: g.z + u, w: PANE_T, h: PANE_H, d: c.w});
      }
    }
    return out;
  });
}
