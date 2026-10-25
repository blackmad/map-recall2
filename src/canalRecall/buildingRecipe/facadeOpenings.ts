/**
 * Openings of a facade cell mask: glazing is measured as the area of the openings (glass, its frame, glazing bars,
 * railings across a French window), not as the share of cells whose colour differs from the wall.
 *
 * The colour clusters of measureFacade.ts give a wall / not-wall mask in which a white-framed or barred window falls
 * apart: the frame and the bars are a light cluster, the panes a dark (or sky-lit) one, and where a frame or a pane
 * happens to share the wall's cluster (dark panes in dark brick, grey frames in grey brick) those cells read as wall.
 * Here the not-wall cells are regrouped into connected openings first:
 *
 * 1. **Frame-like wall clusters**: a wall cluster most of whose cells touch a not-wall cell (>= 55 %) is a ring round
 *    the openings (frames, reveals, the dark rails of a ribbon), not the wall body; its cells within 0.3 m of an
 *    opening join the opening. The body cluster with the fewest such contacts always stays wall.
 * 2. **Second materials**: a large (>= 4 m^2), thick, single-cluster not-wall region that encloses two or more
 *    openings (a rendered or concrete block in a brick front) is wall of another material, not glazing.
 * 3. **Bands**: a horizontal run of one cluster >= 2 m long and <= 0.5 m tall (string courses, sills, lintels, cornice
 *    lines) is trim, not part of an opening; a band touching openings along >= 70 % of its run is *ambiguous* (a
 *    ribbon window's frame rail or the sill band under it) and counts as opening, with the range reported.
 * 4. **Openings**: connected components of what remains. Long thin vertical strips (<= 0.3 m wide, >= 2 m tall:
 *    downpipes, lamp posts, pilasters, column faces) and specks under 0.05 m^2 are trim. A compact component (<= 6 m wide,
 *    <= 4.5 m tall, filling >= 55 % of its bounding box) is filled to its rectangle: the bars and mullions inside a
 *    window are part of the opening whatever their colour.
 *
 * Abstains (`abstain` set, glazing still reported) when the ambiguous band cells move the glazing by more than 0.10:
 * the photo cannot tell window frames from bands there. Pure: no I/O.
 */
export const OPENING = {frameShare: 0.55, frameReachCells: 3, secondMaterialM2: 4, holeM2: 0.3, bandLenM: 2, bandMaxM: 0.5, bandTouch: 0.7,
  stripMaxWM: 0.3, stripMinHM: 2, speckM2: 0.05, holeMaxM2: 3, stackGapM: 0.75, sideGapM: 0.25, accessoryM: 1.5, accessoryRow: 0.5, furnitureMaxWM: 4, frameEdge: 3, surroundM: 0.3, hullMaxWM: 6, hullMaxHM: 4.5, hullFill: 0.55, abstainRange: 0.1, fullRow: 0.8, rowGapCells: 2, fullRowsMax: 0.35} as const;

/** Mask values: the cluster mask's wall / dark / trim plus `frame` (a light or wall-coloured part of an opening). */
export const OMASK = {wall: 0, dark: 1, trim: 2, frame: 3, unusable: 255} as const;
export const isOpening = (m: number) => m === OMASK.dark || m === OMASK.frame;

export interface OpeningInput {
  /** cluster mask: OMASK wall / dark / trim / unusable */
  mask: Uint8Array;
  /** colour cluster per cell (-1 = none) */
  label: Int8Array;
  /** per cluster: part of the wall set */
  wallSet: boolean[];
  /** per cluster: its Lab centre; clusters within dE76 12 are one material for the window-furniture patches */
  centres?: [number, number, number][];
  cols: number; rows: number; cell: number;
  /** cells counted for the glazing range (the upper storeys); default all usable */
  counted?: (k: number) => boolean;
  /** rows of the floors (the fit's storey lines and the photo's floor zones): openings are never stacked across them */
  floorRows?: number[];
  /** rows of the fit's storey lines only: window furniture (railings) never extends an opening across them */
  fitFloorRows?: number[];
  /** per cell: the horizontal lightness step |L(i+1) - L(i-1)| (vertical edges), for frame continuation */
  edgeX?: Float32Array;
  /** the fit storey of each row (0 = ground): openings are never stacked across the ground storey's top (a shop fascia never
   *  joins the window over it); the upper fit lines can sit half a storey off, so the upper floors use `floorRows` */
  storeyOfRow?: Int16Array;
}
export interface OpeningResult {
  mask: Uint8Array;
  /** share of the opening cells in rectangular openings (>= 75 % of their bounding box) */
  regularity: number;
  /** openings whose light surround (>= 0.3 m deep) was taken out as trim */
  surrounds: number;
  /** wall clusters reclassed as rings round the openings */
  frameLike: boolean[];
  /** wall clusters read as window furniture (railings, balustrades) next to openings */
  accessory: number[];
  /** cells of a second wall material (by cluster), now wall */
  secondMaterial: {cluster: number; cells: number; holes: number}[];
  openings: {x0: number; x1: number; y0: number; y1: number; cells: number; filled: boolean}[];
  bands: number; ambiguous: number;
  /** glazing without and with the ambiguous band cells, over the counted cells */
  range: [number, number];
  abstain: string | null;
}

/** 4-connected components of the cells where `on` holds; returns a component id per cell (-1 off) and the lists. */
export function components(on: (k: number) => boolean, cols: number, rows: number): {id: Int32Array; list: number[][]} {
  const id = new Int32Array(cols * rows).fill(-1), list: number[][] = [], stack: number[] = [];
  for (let s = 0; s < cols * rows; s++) {
    if (id[s] >= 0 || !on(s)) continue;
    const c = list.length, cells: number[] = []; id[s] = c; stack.push(s);
    while (stack.length) {
      const p = stack.pop()!, x = p % cols; cells.push(p);
      for (const q of [x > 0 ? p - 1 : -1, x < cols - 1 ? p + 1 : -1, p - cols, p + cols]) if (q >= 0 && q < cols * rows && id[q] < 0 && on(q)) { id[q] = c; stack.push(q); }
    }
    list.push(cells);
  }
  return {id, list};
}

const bbox = (cells: number[], cols: number) => {
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
  for (const k of cells) { const x = k % cols, y = (k - x) / cols; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return {x0, x1, y0, y1};
};

/**
 * The pieces of an opening component for the rectangle fill. A row of windows linked by thin strips along their heads
 * or sills (the shadow line under a soffit, a stone ledge whose cells split between clusters, so neither is a band) is
 * one component, and its rectangle would paint the piers between the windows as glazing (Oostpoort Montessori walls[0]:
 * ten 0.9 m attic windows on 1.4 m centres read as a continuous ribbon). The component is cut at piers: runs of >=
 * `pierM` columns inside the box whose cells leave at least half its height open in one run (wall between a head strip and a sill strip), each
 * between two parts at least `windowM` wide (windows of their own). A window whose panes mirror the wall keeps them:
 * either side of such a pane stands only a thin side frame, never a window's width.
 */
export function linkedPieces(comp: number[], cols: number, cell: number, pierM = 0.3, windowM = 0.4): number[][] {
  const b = bbox(comp, cols), w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  if (h < 6 || w < 3) return [comp];
  const occ = new Uint8Array(w * h);
  for (const k of comp) occ[(Math.floor(k / cols) - b.y0) * w + k % cols - b.x0] = 1;
  // the longest empty run down each column: a pier is open wall over at least half the component's height
  const gap = new Int32Array(w);
  for (let x = 0; x < w; x++) { let run = 0; for (let y = 0; y < h; y++) { run = occ[y * w + x] ? 0 : run + 1; if (run > gap[x]) gap[x] = run; } }
  const pier = (i: number) => gap[i] >= 0.5 * h;
  const runs: [number, number][] = [];
  for (let i = 0; i < w;) {
    if (!pier(i)) { i++; continue; }
    let e = i; while (e + 1 < w && pier(e + 1)) e++;
    if (i > 0 && e < w - 1 && (e - i + 1) * cell >= pierM - 1e-9) runs.push([i, e]);
    i = e + 1;
  }
  // keep the runs with a window's width of the component on both sides (up to the next run or the box edge)
  const keep = runs.filter(([i, e], r) => {
    const left = i - (r > 0 ? runs[r - 1][1] + 1 : 0), right = (r < runs.length - 1 ? runs[r + 1][0] : w) - e - 1;
    return left * cell >= windowM - 1e-9 && right * cell >= windowM - 1e-9;
  });
  if (!keep.length) return [comp];
  const seg = new Int32Array(w).fill(-1); let s = 0, r = 0;
  for (let i = 0; i < w; i++) {
    if (r < keep.length && i >= keep[r][0] && i <= keep[r][1]) { if (i === keep[r][1]) { r++; s++; } continue; }
    seg[i] = s;
  }
  const pieces: number[][] = Array.from({length: s + 1}, () => []);
  for (const k of comp) { const g = seg[k % cols - b.x0]; if (g >= 0) pieces[g].push(k); }
  return pieces.filter(p => p.length);
}

export function classifyOpenings(a: OpeningInput): OpeningResult {
  const {cols, rows, cell, label, wallSet} = a, N = cols * rows, m0 = a.mask, nC = wallSet.length;
  const usable = (k: number) => m0[k] !== OMASK.unusable;
  const notWall0 = (k: number) => m0[k] === OMASK.dark || m0[k] === OMASK.trim;
  const nb4 = (k: number) => { const x = k % cols; return [x > 0 ? k - 1 : -1, x < cols - 1 ? k + 1 : -1, k >= cols ? k - cols : -1, k + cols < N ? k + cols : -1].filter(q => q >= 0); };
  const cellsM2 = (n: number) => n * cell * cell;
  // The rectangles to fill for an opening component that is compact enough to be one window (<= hullMaxWM wide,
  // <= maxH tall, filling >= hullFill of its box): its pieces between piers (linkedPieces) that are themselves compact.
  // A component too big or too ragged to fill stays as it is; cutting it never makes new fills.
  const compact = (c: number[], maxH: number) => { const b = bbox(c, cols), w = (b.x1 - b.x0 + 1) * cell, h = (b.y1 - b.y0 + 1) * cell; return w <= OPENING.hullMaxWM && h <= maxH && c.length / ((b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1)) >= OPENING.hullFill; };
  const hullPieces = (c: number[], maxH: number) => (compact(c, maxH) ? linkedPieces(c, cols, cell).filter(q => compact(q, maxH)) : []);

  // 1. frame-like wall clusters
  const touch = new Array(nC).fill(0), tot = new Array(nC).fill(0);
  for (let k = 0; k < N; k++) {
    if (m0[k] !== OMASK.wall || label[k] < 0) continue;
    tot[label[k]]++; if (nb4(k).some(notWall0)) touch[label[k]]++;
  }
  const ratio = touch.map((t, c) => (tot[c] ? t / tot[c] : 1));
  const body = wallSet.map((w, c) => w && tot[c] > 0);
  const frameLike = body.map((b, c) => b && ratio[c] >= OPENING.frameShare);
  if (body.some(Boolean) && body.every((b, c) => !b || frameLike[c])) {
    // keep the least ringed wall cluster as the body
    let best = -1; body.forEach((b, c) => { if (b && (best < 0 || ratio[c] < ratio[best])) best = c; });
    frameLike[best] = false;
  }

  // 2. second materials: thick, large single-cluster not-wall regions enclosing openings
  const wall2 = new Uint8Array(N), secondMaterial: OpeningResult['secondMaterial'] = [];
  for (let c = 0; c < nC; c++) {
    if (wallSet[c]) continue;
    const {list} = components(k => notWall0(k) && label[k] === c, cols, rows);
    for (const comp of list) {
      if (cellsM2(comp.length) < OPENING.secondMaterialM2) continue;
      const inComp = new Uint8Array(N); for (const k of comp) inComp[k] = 1;
      let thick = 0;
      for (const k of comp) { const x = k % cols, y = (k - x) / cols; let all = true; for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= cols || yy >= rows || !inComp[yy * cols + xx]) { all = false; break; } } if (all) thick++; }
      if (thick < comp.length * 0.4) continue;
      // holes: regions of the component's bounding box not in the component and not reaching the box edge
      const b = bbox(comp, cols), bw = b.x1 - b.x0 + 1;
      const inBox = (k: number) => { const x = k % cols, y = (k - x) / cols; return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; };
      const holes = components(k => inBox(k) && !inComp[k], cols, rows).list.filter(h => {
        if (cellsM2(h.length) < OPENING.holeM2) return false;
        return !h.some(k => { const x = k % cols, y = (k - x) / cols; return x === b.x0 || x === b.x1 || y === b.y0 || y === b.y1; });
      });
      void bw;
      if (holes.length < 2) continue;
      for (const k of comp) wall2[k] = 1;
      secondMaterial.push({cluster: c, cells: comp.length, holes: holes.length});
    }
  }

  // candidates: not-wall cells (not a second material) and frame-like wall cells within reach of them
  const cand = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (notWall0(k) && !wall2[k]) cand[k] = 1;
  let front: number[] = []; for (let k = 0; k < N; k++) if (cand[k]) front.push(k);
  for (let step = 0; step < OPENING.frameReachCells; step++) {
    const next: number[] = [];
    for (const k of front) for (const q of nb4(k)) if (!cand[q] && m0[q] === OMASK.wall && label[q] >= 0 && frameLike[label[q]]) { cand[q] = 2; next.push(q); }
    front = next;
  }

  // 3. bands: per cluster, horizontal runs >= bandLen and <= bandMax thick
  const labOf = (k: number) => (cand[k] === 2 ? 100 + label[k] : label[k]);
  const vthick = new Int32Array(N);
  for (let x = 0; x < cols; x++) {
    let y = 0;
    while (y < rows) {
      const k = y * cols + x; if (!cand[k]) { y++; continue; }
      let e = y; while (e + 1 < rows && cand[(e + 1) * cols + x] && labOf((e + 1) * cols + x) === labOf(k)) e++;
      for (let q = y; q <= e; q++) vthick[q * cols + x] = e - y + 1;
      y = e + 1;
    }
  }
  const band = new Uint8Array(N), lenMin = Math.round(OPENING.bandLenM / cell), thickMax = Math.round(OPENING.bandMaxM / cell);
  for (let y = 0; y < rows; y++) {
    let x = 0;
    while (x < cols) {
      const k = y * cols + x;
      if (!cand[k] || vthick[k] > thickMax) { x++; continue; }
      let e = x; while (e + 1 < cols && cand[y * cols + e + 1] && vthick[y * cols + e + 1] <= thickMax && labOf(y * cols + e + 1) === labOf(k)) e++;
      if (e - x + 1 >= lenMin) for (let q = x; q <= e; q++) band[y * cols + q] = 1;
      x = e + 1;
    }
  }
  // A run that ends inside the opening it touches (within 0.5 m of that opening's sides) is a transom or a frame rail of
  // that opening, not a band: a band crosses the piers between openings. Along a ribbon (an opening wider than
  // hullMaxWM) a rail is as likely a band, so it stays a band and is judged below.
  const isOpenCand = (k: number) => cand[k] > 0 && !band[k];
  const openComps = components(isOpenCand, cols, rows), openBox = openComps.list.map(c => bbox(c, cols)), slack = Math.round(0.5 / cell);
  for (const run of components(k => band[k] === 1, cols, rows).list) {
    const r = bbox(run, cols), near = new Set<number>();
    for (const k of run) for (const q of [k - cols, k + cols, k - 2 * cols, k + 2 * cols]) if (q >= 0 && q < N && openComps.id[q] >= 0) near.add(openComps.id[q]);
    if ([...near].some(c => r.x0 >= openBox[c].x0 - slack && r.x1 <= openBox[c].x1 + slack && (openBox[c].x1 - openBox[c].x0 + 1) * cell <= OPENING.hullMaxWM)) for (const k of run) band[k] = 0;
  }
  // band runs (connected band cells) touching openings along >= bandTouch of their columns are ambiguous
  const amb = new Uint8Array(N);
  let bands = 0;
  for (const run of components(k => band[k] === 1, cols, rows).list) {
    bands++;
    const colsOf = new Map<number, boolean>();
    for (const k of run) {
      const x = k % cols; let t = colsOf.get(x) ?? false;
      for (const q of [k - cols, k + cols]) if (q >= 0 && q < N && isOpenCand(q)) t = true;
      colsOf.set(x, t);
    }
    const touching = [...colsOf.values()].filter(Boolean).length;
    // a dark run (>= 70 % darker than the wall) is as likely a ribbon's frame rail as a shadow line under a sill: ambiguous too
    const dark = run.filter(k => m0[k] === OMASK.dark).length;
    if (touching >= colsOf.size * OPENING.bandTouch || dark >= run.length * 0.7) for (const k of run) amb[k] = 1;
  }

  // 3b. full-width light rows: a row whose light not-wall cells run unbroken (gaps of <= rowGapCells: specks, a
  //     downpipe) across >= fullRow of its usable width is a cornice soffit, a frieze or a band, whatever its thickness
  //     or how its cells split between clusters: trim, not the frame of the windows under it (Oostpoort Montessori
  //     walls[1]: the soffit and frieze over the attic windows joined them into one 20 m "opening", frieze band glazing
  //     0.56 against 0.12 by hand). A row of windows always has piers between them, so it never runs unbroken. A
  //     light block lying directly on a full-width dark row is a ribbon's frame rail as much as a band: left ambiguous.
  //     Bands are a minority of the front: when full light rows make up more than fullRowsMax of it, the wall pick took
  //     the glass of a ribbon front and the "light rows" are its brick, so none is set.
  const fullDark = (y: number) => {
    if (y < 0 || y >= rows) return false;
    let n = 0, d = 0; for (let x = 0; x < cols; x++) { const k = y * cols + x; if (!usable(k)) continue; n++; if (m0[k] === OMASK.dark) d++; }
    return n >= 20 && d >= OPENING.fullRow * n;
  };
  const fullRuns: [number, number, number][] = [];
  for (let y = 0; y < rows; y++) {
    let n = 0; for (let x = 0; x < cols; x++) if (usable(y * cols + x)) n++;
    if (n < 20) continue;
    let best = [0, -1], s0 = -1, last = -1;
    let skipped = 0; // unusable cells (missing pixels, leaves) neither break nor extend a run
    for (let x = 0; x < cols; x++) {
      if (!usable(y * cols + x)) { skipped++; continue; }
      const t = m0[y * cols + x] === OMASK.trim;
      if (t) { if (s0 < 0 || x - last - 1 - skipped > OPENING.rowGapCells) s0 = x; last = x; skipped = 0; if (last - s0 > best[1] - best[0]) best = [s0, last]; }
    }
    let span = 0; for (let x = best[0]; x <= best[1]; x++) if (usable(y * cols + x)) span++;
    if (span < OPENING.fullRow * n) continue;
    fullRuns.push([y, best[0], best[1]]);
  }
  for (let i = 0; i < (fullRuns.length <= OPENING.fullRowsMax * rows ? fullRuns.length : 0);) {
    let j = i; while (j + 1 < fullRuns.length && fullRuns[j + 1][0] === fullRuns[j][0] + 1) j++;
    const ribbon = fullDark(fullRuns[i][0] - 1) || fullDark(fullRuns[j][0] + 1);
    if (!ribbon) for (let r = i; r <= j; r++) { const [y, x0, x1] = fullRuns[r]; for (let x = x0; x <= x1; x++) { const k = y * cols + x; if (m0[k] === OMASK.trim) { band[k] = 1; amb[k] = 0; } } }
    i = j + 1;
  }

  // 4. openings: components of non-band candidates (ambiguous bands join them)
  const out = new Uint8Array(m0);
  for (let k = 0; k < N; k++) if (wall2[k]) out[k] = OMASK.wall;
  for (let k = 0; k < N; k++) if (band[k] && !amb[k]) out[k] = OMASK.trim;
  const openings: OpeningResult['openings'] = [];
  const isOpen = (k: number) => cand[k] > 0 && (!band[k] || amb[k] === 1);
  const {list} = components(isOpen, cols, rows);
  const filled = new Uint8Array(N);
  for (const comp of list) {
    const b = bbox(comp, cols), w = (b.x1 - b.x0 + 1) * cell, h = (b.y1 - b.y0 + 1) * cell;
    const strip = w <= OPENING.stripMaxWM + 1e-9 && h >= OPENING.stripMinHM;
    if (strip || cellsM2(comp.length) < OPENING.speckM2) { for (const k of comp) out[k] = cand[k] === 2 ? OMASK.wall : OMASK.trim; continue; }
    for (const k of comp) out[k] = m0[k] === OMASK.dark ? OMASK.dark : OMASK.frame;
    const pieces = hullPieces(comp, OPENING.hullMaxHM), hull = pieces.length > 0;
    for (const piece of pieces) {
      const pb = bbox(piece, cols);
      for (let y = pb.y0; y <= pb.y1; y++) for (let x = pb.x0; x <= pb.x1; x++) {
        const k = y * cols + x; if (!usable(k) || wall2[k] || isOpening(out[k])) continue;
        out[k] = OMASK.frame; filled[k] = 1;
      }
    }
    openings.push({...b, cells: comp.length, filled: hull});
  }

  // 4b. window furniture: a patch of wall-cluster cells directly over or under an opening that is no wider than the
  //     opening (+0.4 m, <= 4 m, off the box edge) and reaches no further than accessoryM past it (a French window's railing, a balustrade, a frame in the wall's
  //     colour) belongs to it, row by row while such cells cover >= 50 % of the opening's width; a body patch that runs
  //     on past the opening (brick, a spandrel strip between ribbons) never does.
  const reach = Math.round(OPENING.accessoryM / cell), patch = new Int32Array(N).fill(-1), patchBox: {x0: number; x1: number; y0: number; y1: number}[] = [];
  // one material per group of wall clusters with near centres (a noisy or two-tone brick splits into interleaved clusters)
  const group = wallSet.map((_, c) => c);
  if (a.centres) for (let c = 0; c < nC; c++) for (let d = 0; d < c; d++) {
    const x = a.centres[c], y = a.centres[d];
    if (wallSet[c] && wallSet[d] && Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 12) { const g = group[d]; for (let e = 0; e < nC; e++) if (group[e] === group[c]) group[e] = g; }
  }
  for (let c = 0; c < nC; c++) {
    if (!wallSet[c] || group[c] !== c) continue;
    for (const comp of components(k => out[k] === OMASK.wall && label[k] >= 0 && group[label[k]] === c, cols, rows).list) { const id = patchBox.length; patchBox.push(bbox(comp, cols)); for (const k of comp) patch[k] = id; }
  }
  const furniture: number[] = [];
  // patches touching two openings (a spandrel between two ribbons, a pier between two windows) are body, not furniture
  const openId = components(k => isOpening(out[k]), cols, rows), touches = patchBox.map(() => new Set<number>());
  for (let k = 0; k < N; k++) if (patch[k] >= 0) for (const q of nb4(k)) if (openId.id[q] >= 0) touches[patch[k]].add(openId.id[q]);
  for (const [ci, comp] of openId.list.entries()) {
    if (cellsM2(comp.length) < 0.2) continue;
    const b = bbox(comp, cols), w = b.x1 - b.x0 + 1, slackX = Math.round(0.4 / cell);
    const small = (k: number) => { const p = patch[k]; if (p < 0 || [...touches[p]].some(o => o !== ci && cellsM2(openId.list[o].length) >= 0.2)) return false; const q = patchBox[p]; return q.x0 >= b.x0 - slackX && q.x1 <= b.x1 + slackX && (q.x1 - q.x0 + 1) * cell <= OPENING.furnitureMaxWM && q.x0 > 0 && q.y0 > 0 && q.x1 < cols - 1 && q.y1 < rows - 1 && q.y1 - q.y0 + 1 <= b.y1 - b.y0 + 1 + reach + 2; };
    for (const dir of [1, -1]) {
      for (let step = 1; step <= reach; step++) {
        const y = dir > 0 ? b.y1 + step : b.y0 - step;
        if (y < 0 || y >= rows || (a.storeyOfRow && (a.storeyOfRow[y] === 0) !== (a.storeyOfRow[dir > 0 ? b.y1 : b.y0] === 0))) break;
        let acc = 0;
        for (let x = b.x0; x <= b.x1; x++) { const k = y * cols + x; if (isOpening(out[k]) || small(k)) acc++; }
        if (acc < OPENING.accessoryRow * w) break;
        for (let x = b.x0; x <= b.x1; x++) { const k = y * cols + x; if (usable(k) && !isOpening(out[k]) && !wall2[k]) { out[k] = OMASK.frame; filled[k] = 1; furniture.push(k); } }
      }
    }
  }
  const accessory = wallSet.map((_, c) => furniture.some(k => label[k] === c));

  // 4c. frame continuation: the window's side frames go on past the part of it the colours found (a lower sash of dark
  //     panes, or panes mirroring the brick opposite): rows directly over or under an opening whose two side columns
  //     (+-1 cell) both hold a vertical edge >= frameEdge x the wall's median edge, and whose middle is the same material
  //     as the wall 0.3 m outside both sides (a thin frame in one wall, not a spandrel between columns), belong to it, up
  //     to accessoryM.
  if (a.edgeX) {
    const ex = a.edgeX, wallEdges: number[] = [];
    for (let k = 0; k < N; k++) if (m0[k] === OMASK.wall) wallEdges.push(ex[k]);
    wallEdges.sort((p, q) => p - q);
    const floor = Math.max(6, (wallEdges[Math.floor(wallEdges.length / 2)] ?? 0) * OPENING.frameEdge);
    const sideEdge = (y: number, x: number) => { for (let d = -1; d <= 1; d++) { const xx = x + d; if (xx >= 0 && xx < cols && ex[y * cols + xx] >= floor) return true; } return false; };
    for (const comp of components(k => isOpening(out[k]), cols, rows).list) {
      if (cellsM2(comp.length) < 0.2) continue;
      const b = bbox(comp, cols); if (b.x0 === 0 || b.x1 === cols - 1 || (b.x1 - b.x0 + 1) * cell > OPENING.hullMaxWM) continue;
      for (const dir of [1, -1]) for (let step = 1; step <= reach; step++) {
        const y = dir > 0 ? b.y1 + step : b.y0 - step;
        if (y < 0 || y >= rows || (a.storeyOfRow && (a.storeyOfRow[y] === 0) !== (a.storeyOfRow[dir > 0 ? b.y1 : b.y0] === 0))) break;
        if (!sideEdge(y, b.x0) || !sideEdge(y, b.x1)) break;
        // the frame is thin: 0.3 m outside each side is the same material as the row's commonest (a window in one wall), not a
        // column face of another material either side of a spandrel
        const gOf = (x: number) => { const l = x >= 0 && x < cols ? label[y * cols + x] : -1; return l >= 0 ? group[l] ?? l : -1; };
        const tally = new Map<number, number>(); for (let x = b.x0 + 2; x <= b.x1 - 2; x++) { const g = gOf(x); if (g >= 0) tally.set(g, (tally.get(g) ?? 0) + 1); }
        const mid = [...tally].sort((p, q) => q[1] - p[1])[0]?.[0] ?? -1, out3 = Math.round(0.3 / cell) + 1;
        const same = (x: number) => { const l = x >= 0 && x < cols ? label[y * cols + x] : -1; if (l < 0 || mid < 0) return false; if (group[l] === mid) return true; const p = a.centres?.[l], q = a.centres?.[mid]; return !!p && !!q && Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 20; };
        if (!same(b.x0 - out3) || !same(b.x1 + out3)) break;
        for (let x = b.x0; x <= b.x1; x++) { const k = y * cols + x; if (usable(k) && !isOpening(out[k]) && !wall2[k]) { out[k] = OMASK.frame; filled[k] = 1; } }
      }
    }
  }

  // 5. stacked openings: two openings over each other (x overlap >= 70 % of the narrower) with a gap <= stackGapM that
  //    holds no band, no second material and no floor line are one opening (a sign panel or a transom of dark panes in
  //    the wall's colour across a tall window); the gap is filled across the overlap.
  const floors = new Set(a.floorRows ?? []), gapMax = Math.round(OPENING.stackGapM / cell);
  const openBoxes = () => components(k => isOpening(out[k]), cols, rows).list.filter(c => cellsM2(c.length) >= 0.2).map(c => bbox(c, cols));
  // 7. transoms: a band run within (+-0.5 m) the sides of an opening directly over or under it (<= stackGapM) is that
  //    opening's transom or rail, not a band (bands cross the piers between openings)
  const transoms = () => {
    const boxes = openBoxes(); let n = 0;
    for (const run of components(k => band[k] === 1 && !amb[k] && out[k] === OMASK.trim, cols, rows).list) {
      const r = bbox(run, cols);
      // (not along a ribbon wider than hullMaxWM: there a run is as likely a band, as in step 3, and a cornice soffit over
      // a frieze of windows would otherwise become the frieze's transom)
      if (!boxes.some(b => r.x0 >= b.x0 - slack && r.x1 <= b.x1 + slack && (b.x1 - b.x0 + 1) * cell <= OPENING.hullMaxWM && (Math.abs(r.y0 - b.y1) <= gapMax || Math.abs(b.y0 - r.y1) <= gapMax || (r.y0 >= b.y0 && r.y1 <= b.y1)))) continue;
      for (const k of run) { band[k] = 0; out[k] = OMASK.frame; filled[k] = 1; } n++;
    }
    return n;
  };
  const stack = () => { let total = 0;
  for (let pass = 0; pass < 3; pass++) {
    const boxes = components(k => isOpening(out[k]), cols, rows).list.filter(c => cellsM2(c.length) >= 0.2).map(c => bbox(c, cols)).sort((p, q) => p.y0 - q.y0);
    let joined = 0;
    for (let i = 0; i < boxes.length; i++) for (let j = 0; j < boxes.length; j++) {
      const A = boxes[i], B = boxes[j]; if (i === j || B.y0 <= A.y1) continue;
      const gap = B.y0 - A.y1 - 1; if (gap < 1 || gap > gapMax) continue;
      // never across the ground storey's top (a shop fascia under a first-floor window); upper floors by `floorRows`
      if (a.storeyOfRow && (a.storeyOfRow[(A.y0 + A.y1) >> 1] === 0) !== (a.storeyOfRow[(B.y0 + B.y1) >> 1] === 0)) continue;
      const x0 = Math.max(A.x0, B.x0), x1 = Math.min(A.x1, B.x1), ov = x1 - x0 + 1;
      if (ov < 0.7 * Math.min(A.x1 - A.x0 + 1, B.x1 - B.x0 + 1)) continue;
      let ok = true;
      for (let y = A.y1 + 1; y < B.y0 && ok; y++) { if (floors.has(y)) ok = false; for (let x = x0; x <= x1 && ok; x++) { const k = y * cols + x; if (wall2[k] || (band[k] && !amb[k])) ok = false; } }
      if (!ok) continue;
      for (let y = A.y1 + 1; y < B.y0; y++) for (let x = x0; x <= x1; x++) { const k = y * cols + x; if (usable(k) && !isOpening(out[k])) { out[k] = OMASK.frame; filled[k] = 1; } }
      joined++;
    }
    // side by side: panes of one window split by mullions in the wall's colour (gap <= sideGapM, y overlap >= 70 %,
    // only wall cells in the gap: a trim strip such as a column face keeps two bays apart)
    const sideMax = Math.round(OPENING.sideGapM / cell);
    for (let i = 0; i < boxes.length; i++) for (let j = 0; j < boxes.length; j++) {
      const A = boxes[i], B = boxes[j]; if (i === j || B.x0 <= A.x1) continue;
      const gap = B.x0 - A.x1 - 1; if (gap < 1 || gap > sideMax) continue;
      const y0 = Math.max(A.y0, B.y0), y1 = Math.min(A.y1, B.y1), ov = y1 - y0 + 1;
      if (ov < 0.7 * Math.max(A.y1 - A.y0 + 1, B.y1 - B.y0 + 1)) continue;
      let ok = true;
      for (let y = y0; y <= y1 && ok; y++) for (let x = A.x1 + 1; x < B.x0; x++) { const k = y * cols + x; if (out[k] !== OMASK.wall && !isOpening(out[k])) { ok = false; break; } }
      if (!ok) continue;
      for (let y = y0; y <= y1; y++) for (let x = A.x1 + 1; x < B.x0; x++) { const k = y * cols + x; if (usable(k) && !isOpening(out[k])) { out[k] = OMASK.frame; filled[k] = 1; } }
      joined++;
    }
    if (!joined) break; total += joined;
  }
  return total; };

  // 6. holes: a wall island (<= holeMaxM2, off the box edge) whose boundary is >= 80 % opening cells is inside an opening
  //    (a dark sign panel or transom across a window, a pane in the wall's colour); it and its opening are refilled.
  const holes = () => { let total = 0;
  for (let pass = 0; pass < 2; pass++) {
    let grew = false;
    const isles = components(k => out[k] === OMASK.wall, cols, rows).list;
    for (const isle of isles) {
      if (cellsM2(isle.length) > OPENING.holeMaxM2) continue;
      let edge = false, bOpen = 0, bAll = 0;
      for (const k of isle) {
        const x = k % cols, y = (k - x) / cols; if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) { edge = true; break; }
        for (const q of nb4(k)) if (out[q] !== OMASK.wall) { bAll++; if (isOpening(out[q])) bOpen++; }
      }
      if (edge || !bAll || bOpen < bAll * 0.8) continue;
      for (const k of isle) { out[k] = OMASK.frame; filled[k] = 1; }
      grew = true; total++;
    }
    if (!grew) break;
    // refill rectangles of the grown openings
    for (const comp of components(k => isOpening(out[k]), cols, rows).list.flatMap(c => hullPieces(c, OPENING.hullMaxHM * 3))) {
      const b = bbox(comp, cols);
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { const k = y * cols + x; if (usable(k) && !wall2[k] && !isOpening(out[k]) && !(band[k] && !amb[k])) { out[k] = OMASK.frame; filled[k] = 1; } }
    }
  }
  return total; };
  for (let round = 0; round < 3; round++) if (!(transoms() + stack() + holes())) break;
  // the joined openings filled to their rectangles (the frame round panes joined across mullions or a sign panel)
  for (const comp of components(k => isOpening(out[k]), cols, rows).list.flatMap(c => hullPieces(c, OPENING.hullMaxHM * 3))) {
    const b = bbox(comp, cols);
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { const k = y * cols + x; if (usable(k) && !wall2[k] && out[k] === OMASK.wall) { out[k] = OMASK.frame; filled[k] = 1; } }
  }

  // 8. surrounds: an opening whose outer ring is one light cluster at least surroundM deep (three cells; a blurred frame is at most two) all round, round
  //    an inside of other clusters, wears a stone or rendered surround: the ring is trim, the opening is what it frames.
  //    A frame (one cell, a thin rail) stays part of the opening.
  const depthMin = Math.round(OPENING.surroundM / cell);
  let surrounds = 0;
  for (const comp of components(k => isOpening(out[k]), cols, rows).list) {
    if (cellsM2(comp.length) < 0.5) continue;
    const inComp = new Uint8Array(N); for (const k of comp) inComp[k] = 1;
    const edge = comp.filter(k => nb4(k).length < 4 || nb4(k).some(q => !inComp[q]));
    const counts = new Map<number, number>(); for (const k of edge) if (m0[k] === OMASK.trim && label[k] >= 0) counts.set(label[k], (counts.get(label[k]) ?? 0) + 1);
    const top = [...counts].sort((p, q) => q[1] - p[1])[0]; if (!top || top[1] < edge.length * 0.6) continue;
    const L = top[0];
    // peel the ring inward while its cells keep the ring's cluster
    const depth = new Int32Array(N).fill(-1); let layer = edge.filter(k => label[k] === L), d = 0;
    for (const k of layer) depth[k] = 0;
    while (layer.length && d < 4) { const next: number[] = []; for (const k of layer) for (const q of nb4(k)) if (inComp[q] && depth[q] < 0 && label[q] === L && m0[q] === OMASK.trim) { depth[q] = d + 1; next.push(q); } layer = next; d++; }
    const ring = comp.filter(k => depth[k] >= 0), deep = ring.filter(k => depth[k] >= depthMin - 1).length, inside = comp.length - ring.length;
    if (deep < ring.length * 0.3 || inside < comp.length * 0.3) continue;
    for (const k of ring) out[k] = OMASK.trim;
    surrounds++;
  }

  // regularity: the share of the counted opening cells in rectangular openings (filling >= 75 % of their bounding box);
  // smeared stitching, bare branches and reflections give ragged blobs instead
  const counted0 = a.counted ?? (() => true);
  let regular = 0, openTotal = 0;
  for (const comp of components(k => isOpening(out[k]), cols, rows).list) {
    const b = bbox(comp, cols), fill = comp.length / ((b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1)), n = comp.filter(counted0).length;
    openTotal += n; if (fill >= 0.75) regular += n;
  }
  const regularity = openTotal ? +(regular / openTotal).toFixed(3) : 1;

  // glazing range over the counted cells
  const counted = a.counted ?? (() => true);
  let n = 0, hi = 0, ambN = 0;
  for (let k = 0; k < N; k++) { if (!usable(k) || !counted(k)) continue; n++; if (isOpening(out[k])) { hi++; if (amb[k] && !filled[k]) ambN++; } }
  const range: [number, number] = n ? [+((hi - ambN) / n).toFixed(3), +(hi / n).toFixed(3)] : [0, 0];
  const abstain = range[1] - range[0] > OPENING.abstainRange
    ? `frames cannot be told from bands: ${((range[1] - range[0]) * 100).toFixed(0)} % of the front is a band run along openings (glazing ${range[0]}..${range[1]})` : null;
  let ambiguous = 0; for (let k = 0; k < N; k++) if (amb[k]) ambiguous++;
  return {mask: out, regularity, surrounds, frameLike, accessory: accessory.flatMap((f, i) => (f ? [i] : [])), secondMaterial, openings, bands, ambiguous, range, abstain};
}
