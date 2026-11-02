/**
 * Tray stack: a rectilinear office block read as a pile of floor slabs ("trays"), each storey's glass line either on the slab
 * edge (flush ribbon) or set back behind it (a loggia under the slab above, with columns on the slab edge), and loggias that run
 * through two or more storeys where the slab between them is left out (an open void, often screened by louvres).
 *
 * Built for the KPN office at the Teleportboulevard (kpn-teleport): seven glazed storeys over a half-sunken car park, where every
 * face carries loggias on different storeys and the corners open up two storeys high. The kit had ribbon facades (one plane per
 * wall) and holed walls, but no way to say "this storey of this face is recessed 3 m behind its slab edge, that one is not".
 *
 * Pure plan arithmetic, no three.js. Plan coordinates (a, b): a and b any right-handed pair with the same handedness as the
 * native (x east, z south) frame; a wall's tangent runs to the viewer's right seen from outside and its outward normal is
 * n = [-t_b, t_a]. The plan is cut into a grid by every rectangle edge; per storey each cell is outside the outline, enclosed
 * (inside the glass line) or recessed (inside the outline, outside the glass line). From that the stack derives:
 *  - `walls`: glass-line runs, `outline` where they stand on the slab edge, `inner` for loggia back walls and returns;
 *  - `slab`: cells carrying the slab above the storey (all outline cells unless an `open` recess runs on into the next storey);
 *  - `floors` / `soffits`: recessed cells open to the sky above a slab below / under a slab above (merged rectangles);
 *  - `roofs`: slab cells with nothing above them (the top storey, courtyard decks over a podium);
 *  - `bandLoops`: closed boundary loops of the slab cells, for the slab-edge band in [glassTop, y1];
 *  - `columns`: points just inside the slab edge in front of recessed cells, on a fixed pitch and at recessed corners.
 */
export type Rect = {a0: number; a1: number; b0: number; b1: number};
export type P2 = [number, number];
export type TrayLevel = {name: string; y0: number; glassTop: number; y1: number};
/**
 * `open`: the slab between two consecutive storeys of this recess is left out on its cells. `columns`: explicit positions (the
 * coordinate along the slab edge, a for edges facing north or south, b for east or west) replacing the pitch inside the rect.
 */
export type TrayRecess = {rect: Rect; levels: number[]; open?: boolean; columns?: number[]};
export type TrayPlan = {outer: Rect[]; holes: {rect: Rect; levels: number[]}[]; levels: TrayLevel[]; recesses: TrayRecess[]};
export type Run = {p: P2; q: P2; n: P2; kind: 'outline' | 'inner'};
export type TrayColumn = {at: P2; y0: number; y1: number};
export type TrayStorey = {
  level: TrayLevel; index: number;
  walls: Run[]; floors: Rect[]; soffits: Rect[]; roofs: Rect[]; bandLoops: P2[][]; columns: TrayColumn[];
};
export type TrayOptions = {columnPitch: number; columnInset: number; columnMargin?: number};

const EPS = 1e-6;
const inside = (r: Rect, a: number, b: number) => a > r.a0 + EPS && a < r.a1 - EPS && b > r.b0 + EPS && b < r.b1 - EPS;
const uniq = (v: number[]) => [...new Set(v.map(x => Math.round(x * 1e6) / 1e6))].sort((x, y) => x - y);

/** Grid cell flags per storey. */
export function trayGrid(plan: TrayPlan) {
  const all = [...plan.outer, ...plan.holes.map(h => h.rect), ...plan.recesses.map(r => r.rect)];
  const as = uniq(all.flatMap(r => [r.a0, r.a1])), bs = uniq(all.flatMap(r => [r.b0, r.b1]));
  const ni = as.length - 1, nj = bs.length - 1, L = plan.levels.length;
  const ca = (i: number) => (as[i] + as[i + 1]) / 2, cb = (j: number) => (bs[j] + bs[j + 1]) / 2;
  const outline: boolean[][][] = [], recessed: boolean[][][] = [], open: boolean[][][] = [];
  for (let k = 0; k < L; k++) {
    outline.push([]); recessed.push([]); open.push([]);
    for (let i = 0; i < ni; i++) {
      outline[k].push([]); recessed[k].push([]); open[k].push([]);
      for (let j = 0; j < nj; j++) {
        const a = ca(i), b = cb(j);
        const o = plan.outer.some(r => inside(r, a, b)) && !plan.holes.some(h => h.levels.includes(k) && inside(h.rect, a, b));
        outline[k][i].push(o);
        recessed[k][i].push(o && plan.recesses.some(r => r.levels.includes(k) && inside(r.rect, a, b)));
        // open above storey k: a recess listing k and k+1 marked open covers the cell
        open[k][i].push(plan.recesses.some(r => r.open && r.levels.includes(k) && r.levels.includes(k + 1) && inside(r.rect, a, b)));
      }
    }
  }
  const at = (m: boolean[][][], k: number, i: number, j: number) => k >= 0 && k < L && i >= 0 && i < ni && j >= 0 && j < nj && m[k][i][j];
  const isOutline = (k: number, i: number, j: number) => at(outline, k, i, j);
  const isRecessed = (k: number, i: number, j: number) => at(recessed, k, i, j);
  const isEnclosed = (k: number, i: number, j: number) => isOutline(k, i, j) && !isRecessed(k, i, j);
  const hasSlab = (k: number, i: number, j: number) => isOutline(k, i, j) && !(isRecessed(k, i, j) && isRecessed(k + 1, i, j) && at(open, k, i, j));
  return {as, bs, ni, nj, isOutline, isRecessed, isEnclosed, hasSlab};
}

type Edge = {p: P2; q: P2; n: P2};
/** Directed boundary edges of a cell set, outward normal n = [-t_b, t_a]. */
function boundaryEdges(as: number[], bs: number[], ni: number, nj: number, inSet: (i: number, j: number) => boolean, keep: (i: number, j: number, di: number, dj: number) => boolean = () => true): Edge[] {
  const out: Edge[] = [];
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
    if (!inSet(i, j)) continue;
    const [a0, a1, b0, b1] = [as[i], as[i + 1], bs[j], bs[j + 1]];
    if (!inSet(i, j - 1) && keep(i, j, 0, -1)) out.push({p: [a1, b0], q: [a0, b0], n: [0, -1]});
    if (!inSet(i, j + 1) && keep(i, j, 0, 1)) out.push({p: [a0, b1], q: [a1, b1], n: [0, 1]});
    if (!inSet(i + 1, j) && keep(i, j, 1, 0)) out.push({p: [a1, b1], q: [a1, b0], n: [1, 0]});
    if (!inSet(i - 1, j) && keep(i, j, -1, 0)) out.push({p: [a0, b0], q: [a0, b1], n: [-1, 0]});
  }
  return out;
}
const key = (p: P2) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
/** Merge collinear, touching, same-normal edges into maximal runs. */
export function mergeRuns<E extends Edge>(edges: E[], same: (x: E, y: E) => boolean = () => true): E[] {
  const left = [...edges], out: E[] = [];
  while (left.length) {
    let cur = left.pop()!;
    for (let grew = true; grew;) {
      grew = false;
      for (let m = 0; m < left.length; m++) {
        const e = left[m];
        if (e.n[0] !== cur.n[0] || e.n[1] !== cur.n[1] || !same(e, cur)) continue;
        if (key(e.p) === key(cur.q)) { cur = {...cur, q: e.q}; left.splice(m, 1); grew = true; break; }
        if (key(e.q) === key(cur.p)) { cur = {...cur, p: e.p}; left.splice(m, 1); grew = true; break; }
      }
    }
    out.push(cur);
  }
  return out.sort((x, y) => x.p[0] - y.p[0] || x.p[1] - y.p[1] || x.q[0] - y.q[0] || x.q[1] - y.q[1]);
}
/** Chain boundary edges into closed loops (vertices only at turns). */
export function loopsOf(edges: Edge[]): P2[][] {
  const runs = mergeRuns(edges), byStart = new Map<string, Edge[]>();
  for (const e of runs) byStart.set(key(e.p), [...(byStart.get(key(e.p)) ?? []), e]);
  const used = new Set<Edge>(), loops: P2[][] = [];
  for (const start of runs) {
    if (used.has(start)) continue;
    const loop: P2[] = []; let e: Edge | undefined = start;
    while (e && !used.has(e)) {
      used.add(e); loop.push(e.p);
      const nexts: Edge[] = (byStart.get(key(e.q)) ?? []).filter(x => !used.has(x));
      // at a pinch vertex prefer the right turn, which keeps each loop simple
      const prev: Edge = e;
      e = nexts.sort((x, y) => turn(prev, y) - turn(prev, x))[0];
    }
    loops.push(loop);
  }
  return loops;
}
const turn = (e: Edge, f: Edge) => { const t = [e.q[0] - e.p[0], e.q[1] - e.p[1]], u = [f.q[0] - f.p[0], f.q[1] - f.p[1]]; return t[0] * u[1] - t[1] * u[0]; };
/** Merge cells into rectangles: runs along b per column of cells, then identical runs across neighbouring columns. */
function cellRects(as: number[], bs: number[], ni: number, nj: number, inSet: (i: number, j: number) => boolean): Rect[] {
  const strips: Rect[] = [];
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj;) {
    if (!inSet(i, j)) { j++; continue; }
    let e = j; while (e < nj && inSet(i, e)) e++;
    strips.push({a0: as[i], a1: as[i + 1], b0: bs[j], b1: bs[e]}); j = e;
  }
  const out: Rect[] = [];
  for (const s of strips) {
    const prev = out.find(r => Math.abs(r.a1 - s.a0) < EPS && Math.abs(r.b0 - s.b0) < EPS && Math.abs(r.b1 - s.b1) < EPS);
    if (prev) prev.a1 = s.a1; else out.push({...s});
  }
  return out;
}

/** Offset a closed loop of axis-aligned edges by d along the edges' outward normals (mitred corners). */
export function offsetLoop(loop: P2[], d: number): P2[] {
  const n = loop.length, nrm = (p: P2, q: P2): P2 => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]); return [-(q[1] - p[1]) / l, (q[0] - p[0]) / l]; };
  return loop.map((v, i) => {
    const n1 = nrm(loop[(i - 1 + n) % n], v), n2 = nrm(v, loop[(i + 1) % n]);
    const par = Math.abs(n1[0] * n2[0] + n1[1] * n2[1]) > 1 - EPS;
    return par ? [v[0] + d * n1[0], v[1] + d * n1[1]] : [v[0] + d * (n1[0] + n2[0]), v[1] + d * (n1[1] + n2[1])];
  });
}

export function trayStack(plan: TrayPlan, opt: TrayOptions): TrayStorey[] {
  const g = trayGrid(plan), {as, bs, ni, nj} = g, margin = opt.columnMargin ?? 0.4;
  return plan.levels.map((level, k) => {
    const enclosed = (i: number, j: number) => g.isEnclosed(k, i, j);
    const walls = mergeRuns(
      boundaryEdges(as, bs, ni, nj, enclosed).map(e => ({...e, kind: kindOf(e)})),
      (x, y) => x.kind === y.kind,
    );
    function kindOf(e: Edge): Run['kind'] {
      // the cell just outside the edge's midpoint decides: outside the outline -> the glass stands on the slab edge
      const m: P2 = [(e.p[0] + e.q[0]) / 2 + e.n[0] * 1e-3, (e.p[1] + e.q[1]) / 2 + e.n[1] * 1e-3];
      const i = as.findIndex((x, u) => u < ni && m[0] > x && m[0] < as[u + 1]), j = bs.findIndex((x, u) => u < nj && m[1] > x && m[1] < bs[u + 1]);
      return i >= 0 && j >= 0 && g.isOutline(k, i, j) ? 'inner' : 'outline';
    }
    const recess = (i: number, j: number) => g.isRecessed(k, i, j);
    const floors = k === 0 ? [] : cellRects(as, bs, ni, nj, (i, j) => recess(i, j) && g.hasSlab(k - 1, i, j));
    const top = k === plan.levels.length - 1;
    const soffits = top ? [] : cellRects(as, bs, ni, nj, (i, j) => recess(i, j) && g.hasSlab(k, i, j));
    const roofs = cellRects(as, bs, ni, nj, (i, j) => g.hasSlab(k, i, j) && (top || !g.isOutline(k + 1, i, j)));
    const bandLoops = loopsOf(boundaryEdges(as, bs, ni, nj, (i, j) => g.hasSlab(k, i, j)));
    // columns: on outline edges of recessed cells, inset; pitch positions plus recessed outline corners
    const colEdges = mergeRuns(boundaryEdges(as, bs, ni, nj, (i, j) => g.isOutline(k, i, j), (i, j) => recess(i, j)));
    const colTop = (at: P2) => {
      const i = as.findIndex((x, u) => u < ni && at[0] > x && at[0] < as[u + 1]), j = bs.findIndex((x, u) => u < nj && at[1] > x && at[1] < bs[u + 1]);
      return i >= 0 && j >= 0 && !g.hasSlab(k, i, j) && !top ? level.y1 : level.glassTop;
    };
    const pts: P2[] = [];
    const push = (p: P2) => { if (!pts.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.3)) pts.push(p); };
    for (const e of colEdges) {
      const len = Math.hypot(e.q[0] - e.p[0], e.q[1] - e.p[1]), t: P2 = [(e.q[0] - e.p[0]) / len, (e.q[1] - e.p[1]) / len];
      const along = (s: number): P2 => [e.p[0] + t[0] * s - e.n[0] * opt.columnInset, e.p[1] + t[1] * s - e.n[1] * opt.columnInset];
      // global pitch: positions where the coordinate along the run is a multiple of the pitch
      const c0 = Math.abs(t[0]) > 0.5 ? e.p[0] : e.p[1], dir = Math.abs(t[0]) > 0.5 ? t[0] : t[1];
      const lo = Math.min(c0, c0 + dir * len), hi = Math.max(c0, c0 + dir * len);
      const mid: P2 = [(e.p[0] + e.q[0]) / 2 - e.n[0] * 1e-3, (e.p[1] + e.q[1]) / 2 - e.n[1] * 1e-3];
      const explicit = plan.recesses.find(r => r.columns && r.levels.includes(k) && inside(r.rect, mid[0], mid[1]));
      if (explicit) { for (const c of explicit.columns!) if (c >= lo - EPS && c <= hi + EPS) push(along((c - c0) / dir)); }
      else for (let c = Math.ceil((lo + margin) / opt.columnPitch) * opt.columnPitch; c <= hi - margin + EPS; c += opt.columnPitch) push(along((c - c0) / dir));
      // a corner of the outline at either end of the run (the perpendicular outline edge is recessed too)
      for (const [end, s] of [[e.p, 0], [e.q, len]] as const) {
        const corner = colEdges.some(f => f !== e && (key(f.p) === key(end) || key(f.q) === key(end)) && Math.abs(f.n[0] * e.n[0] + f.n[1] * e.n[1]) < EPS);
        if (corner) push(along(s === 0 ? opt.columnInset : len - opt.columnInset));
      }
    }
    const columns = pts.map(at => ({at, y0: level.y0, y1: colTop(at)}));
    return {level, index: k, walls, floors, soffits, roofs, bandLoops, columns};
  });
}
