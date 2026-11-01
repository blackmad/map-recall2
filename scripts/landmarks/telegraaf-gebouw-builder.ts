import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, put, poly, roofHeightAt, ringFrame, wallProbe, type Frame} from './nearbar-kit';
import {addShellTess} from './big-facade';
import {planarPolygon} from './worship-shell';
import source from './telegraaf-gebouw-footprints.json';

/**
 * Former Telegraaf building, Nieuwezijds Voorburgwal 225 (BAG pand 0363100012253832, BAG year 1930; built 1928-1930 to the
 * design of J.F. Staal for the newspaper De Telegraaf, later Kas-Bank; nl.wikipedia "Nieuwezijds Voorburgwal" and "J.F. Staal").
 * Redeveloped by the Kroonenberg Groep from 2019 (scaffolding in the 2019 panorama, site hoardings in 2025).
 *
 * Massing is the 3DBAG LoD2.2 shell (CC BY 4.0) in the native frame of telegraaf-gebouw-footprints.json (prepared by
 * telefooncentrale-telegraaf-prepare.ts). 3DBAG leaves the north strip of the BAG ring (the red-finned glass building and
 * the curved corner beyond it) empty; that strip is not drawn. Facades are read from the rectified Gemeente Amsterdam
 * panorama crops (CC BY 4.0, ~50 px/m; inventory telegraaf-gebouw-inventory.json):
 *  - the 1930 front (z -8.7 to the tower at 22.5): near-black brick, six groups of three white-framed windows (multi-pane top,
 *    two-light bottom) on four storeys between 1.2 m brick piers; under each group a tall glass-block panel over a glazed
 *    ground storey between light stone piers; stone coping at 28.5 m; a thin dark canopy over the entrance at the south end;
 *  - the brick tower at the south end (3DBAG top 46.8 m) behind a low brick block with stone coping and a round-arched door
 *    in a white stone surround; south of it the stair annex with three glass-block bands;
 *  - north of the 1930 front: a slim dark-brick bay with one window per storey, a cream stone-clad bay with slatted openings
 *    and a grey stone-clad corner with slit windows (later additions, w09-269, w11-271);
 *  - the Kalverstraat side: shopfronts with fascias and plain upper windows (w02-71, w04-157, w08-73), simplified.
 */
type Surface = {type: string; rings: number[][][]};
type Src = {surfaces: Surface[]; facadeRing: number[][]; nativeRing: number[][]};
const src = source as unknown as Src;
const RING = src.facadeRing;

/** NZV front, z (south) ranges. Group starts from the w07/w10/w12 crops, the last group ends at the tower (3DBAG z 22.5). */
const GROUP_W = 4.2, WIN_W = 1.4;
const GROUPS = [-8.7, -3.3, 2.1, 7.5, 12.9, 18.3];
/** Window rows (m above ground): crop heights scaled to the 3DBAG wall head 28.5 m. */
const ROWS: [number, number][] = [[9.3, 12.8], [14.3, 17.8], [19.4, 22.8], [24.4, 27.9]];
const BLOCKS: [number, number] = [3.4, 7.8];
const SHOP_TOP = 3.2;
const COPING = 28.2;  // stone coping 28.2-28.7 m
/** The slim brick bay north of the 1930 front: one window per storey (w11-271). */
const BAY: [number, number] = [-13.9, -9.3];
const BAY_ROWS: [number, number][] = [[5.0, 7.1], [9.2, 11.3], [14.2, 16.2], [19.0, 21.1]];
/** Cream stone-clad bay (3DBAG wall 82, top 25.2) and grey stone-clad corner (walls 153 and the chamfer 52, top 24.1-24.2). */
const CREAM: [number, number] = [-16.05, -14.06];
const CREAM_ROWS: [number, number][] = [[4.8, 6.9], [9.0, 11.1], [13.7, 16.0], [18.7, 20.8]];
const GREY: [number, number] = [-19.24, -16.12];
const SLITS: [number, number][] = [[5.3, 6.4], [9.15, 10.2], [13.6, 14.7], [18.1, 19.2]];
/** Low block before the tower and its round-arched door (w07-270, the crop registered 1.6 m north of 3DBAG). */
const LOW: [number, number] = [22.6, 26.4];
const ARCH_Z = 24.7;
/** Kalverstraat-side facade ring edges (w02-71, w04-157, w08-73). */
const KALVER = [14, 15, 16, 18, 19, 21, 23];

let probe: ReturnType<typeof wallProbe>;

/** The 3DBAG front wall pieces of the NZV front (walls running along z, x < -8.4): [z0, z1, x]. */
const FRONT = src.surfaces.filter(s => {
  if (s.type !== 'WallSurface') return false;
  const xs = s.rings[0].map(p => p[0]);
  return Math.max(...xs) - Math.min(...xs) < 0.2 && Math.max(...xs) < -8.4 && Math.max(...s.rings[0].map(p => p[1])) > 3;
}).map(s => { const zs = s.rings[0].map(p => p[2]), xs = s.rings[0].map(p => p[0]); return [Math.min(...zs), Math.max(...zs), Math.min(...xs)]; });
const ALONG = FRONT.filter(w => w[1] - w[0] > 0.1);
const JOGS = [...new Set(FRONT.flatMap(w => [w[0], w[1]]).map(z => Math.round(z * 100) / 100))].sort((a, c) => a - c);
/**
 * `slab` on an NZV front frame (tangent +z), split at the 0.1-0.2 m jogs of the shell, each piece set (not sunk) on the
 * wall piece behind it, so every opening part lies within one wall's silhouette (the audit's
 * opening-outside rule). Bars stay on the outermost plane.
 */
function fslab(b: BuildingTools, f: Frame, c: number, y: number, w: number, h: number, d: number, col: string) {
  const z0 = f.origin[1] + c - w / 2, z1 = f.origin[1] + c + w / 2;
  const cuts = [z0, ...JOGS.filter(z => z > z0 + 0.05 && z < z1 - 0.05), z1];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i], e = cuts[i + 1], m = (a + e) / 2;
    const wall = ALONG.filter(q => q[0] <= m && q[1] >= m).sort((p, q) => p[2] - q[2])[0];
    const g: Frame = wall ? {...f, origin: [wall[2], f.origin[1]]} : f;
    // not sunk: the piece's end faces then stop at its own wall plane and never lie in a jog wall
    put(b, g, new T.BoxGeometry(e - a, h, d).translate(0, h / 2, d / 2), m - f.origin[1], y, 0, col);
  }
}

export function buildTelegraafGebouw(_w: number, _d: number, b: BuildingTools) {
  addShellTess(b, {surfaces: src.surfaces, nativeRing: src.nativeRing} as never, {wall: 'brick', roof: 'slate'});
  setSink(0.3, true);
  probe = wallProbe(src.surfaces.filter(s => s.type === 'WallSurface').map(s => planarPolygon(s.rings)).filter((g): g is T.BufferGeometry => !!g));
  mainFront(b);
  brickBay(b);
  creamBay(b);
  greyCorner(b);
  lowBlock(b);
  tower(b);
  annex(b);
  for (const e of KALVER) kalverstraat(b, e);
}

/**
 * Frame on the NZV front from z0 to z1: on the outermost (most westerly) 3DBAG front wall in that range, so trim stands proud
 * of every 0.1-0.2 m jog of the shell; slabs sink 0.3 m back and stay attached to the recessed parts.
 */
function nzv(z0: number, z1: number): Frame {
  let x = Infinity;
  for (const s of src.surfaces) {
    if (s.type !== 'WallSurface') continue;
    const r = s.rings[0], xs = r.map(p => p[0]), zs = r.map(p => p[2]);
    if (Math.max(...xs) - Math.min(...xs) > 0.2 || Math.max(...xs) > -8.4) continue;
    if (Math.max(...zs) <= z0 + 0.05 || Math.min(...zs) >= z1 - 0.05 || Math.max(...r.map(p => p[1])) < 3) continue;
    x = Math.min(x, ...xs);
  }
  if (!isFinite(x)) throw new Error(`telegraaf: no front wall between z ${z0} and ${z1}`);
  return {origin: [x, z0], tangent: [0, 1], n: [-1, 0]};
}

/** Box from `o0` to `o1` out of the wall, not sunk: bars on glass. */
function plate(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, o0: number, o1: number, c: string) {
  // on the jogged NZV front the bars run back 0.25 m into the outermost wall plane, so they reach the recessed wall pieces too
  if (f.tangent[1] === 1 && o0 > 0) {
    o0 = -0.25;
    // a bar side face within 4 cm of a jog would lie in the jog wall or on a glass piece's end: nudge the bar off it
    const zc = f.origin[1] + t, j = JOGS.find(q => q > zc - w / 2 - 0.04 && q < zc + w / 2 + 0.04);
    if (j !== undefined && w < 1) t += zc >= j ? j + w / 2 + 0.045 - zc : j - w / 2 - 0.045 - zc;
  }
  put(b, f, new T.BoxGeometry(w, h, o1 - o0).translate(0, h / 2, (o1 - o0) / 2), t, y, o0, c);
}

/**
 * A group of `n` touching windows with white frames (w12-270): glass 6 cm proud; white bars 6-13 cm: the outer frame, the
 * frames between the windows, a transom at 58 % height, two glazing bars each way in the upper part, a mullion below.
 */
function windowGroup(b: BuildingTools, f: Frame, t0: number, y0: number, y1: number, n: number, w = WIN_W) {
  const h = y1 - y0, W = n * w, tr = y0 + h * 0.42, c = t0 + W / 2;
  (f.tangent[1] === 1 ? fslab : slab)(b, f, c, y0 + 0.05, W, h - 0.1, 0.06, 'glass');
  plate(b, f, c, y0, W + 0.1, 0.12, 0.06, 0.15, 'frame'); // sill line
  plate(b, f, c, y1 - 0.1, W + 0.1, 0.1, 0.06, 0.13, 'frame');
  plate(b, f, c, tr, W, 0.1, 0.06, 0.13, 'frame');
  for (const k of [1, 2]) plate(b, f, c, tr + (y1 - tr) * k / 3, W, 0.04, 0.06, 0.12, 'frame');
  for (let i = 0; i <= n; i++) plate(b, f, t0 + i * w, y0 + 0.12, 0.12, h - 0.22, 0.06, 0.13, 'frame');
  for (let i = 0; i < n; i++) {
    const m = t0 + (i + 0.5) * w;
    plate(b, f, m, y0 + 0.12, 0.07, tr - y0 - 0.12, 0.06, 0.12, 'frame');
    for (const k of [-1, 1]) plate(b, f, m + k * w / 6, tr + 0.1, 0.04, y1 - tr - 0.2, 0.06, 0.12, 'frame');
  }
}

/** Glass-block panel: pale glass with a mortar grid on ~0.6 m (the blocks themselves are 0.2 m; the grid reads at range). */
function glassBlocks(b: BuildingTools, f: Frame, c: number, y0: number, y1: number, w: number) {
  (f.tangent[1] === 1 ? fslab : slab)(b, f, c, y0, w, y1 - y0, 0.07, 'canopyGlass');
  const nv = Math.max(2, Math.round(w / 0.6)), nh = Math.max(2, Math.round((y1 - y0) / 0.6));
  for (let i = 1; i < nv; i++) plate(b, f, c - w / 2 + i * w / nv, y0 + 0.05, 0.04, y1 - y0 - 0.1, 0.07, 0.13, 'concrete');
  for (let i = 1; i < nh; i++) plate(b, f, c, y0 + i * (y1 - y0) / nh, w - 0.1, 0.04, 0.07, 0.13, 'concrete');
  // brick reveal frame round the panel (the panels sit in a slightly projecting brick surround, w07-270)
  plate(b, f, c, y1, w + 0.2, 0.1, 0, 0.12, 'brick');
}

function mainFront(b: BuildingTools) {
  const z0 = GROUPS[0] - 0.4, z1 = 22.4;
  const f = nzv(z0, z1);
  const T0 = (z: number) => z - z0;
  slab(b, f, T0((BAY[0] + z1) / 2), COPING, z1 - BAY[0], 0.5, 0.15, 'stone'); // top 10-20 cm over the 28.5 m roof edge
  GROUPS.forEach((g, k) => {
    const t = T0(g), c = t + GROUP_W / 2;
    for (const [y0, y1] of ROWS) windowGroup(b, f, t, y0, y1, 3);
    glassBlocks(b, f, c, BLOCKS[0], BLOCKS[1], GROUP_W);
    // ground storey: glazed between light stone piers, dark frames; the two south groups are the entrance doors
    fslab(b, f, c, 0.35, GROUP_W, SHOP_TOP - 0.4, 0.06, 'glass');
    const doors = k >= 4;
    for (let i = 0; i <= 4; i++) plate(b, f, t + i * GROUP_W / 4, 0.3, 0.1, SHOP_TOP - 0.3, 0.06, 0.11, 'dark');
    plate(b, f, c, doors ? 2.5 : 2.6, GROUP_W, 0.1, 0.06, 0.14, 'dark');
    slab(b, f, c, 0, GROUP_W, 0.3, 0.1, 'stone');
    slab(b, f, c, SHOP_TOP, GROUP_W, 0.2, 0.08, 'stone'); // lintel under the glass blocks
  });
  // light stone piers at the ground storey between and beside the groups (w07-270, w10-270 alt)
  for (let k = 0; k <= GROUPS.length; k++) {
    const a = k === 0 ? GROUPS[0] - 0.35 : GROUPS[k - 1] + GROUP_W, e = k === GROUPS.length ? z1 : GROUPS[k];
    if (e - a > 0.2) slab(b, f, T0((a + e) / 2), 0, e - a, SHOP_TOP + 0.2, 0.14, 'stone');
  }
  // the dark entrance canopy over the two south groups (w07-270), 1.2 m deep
  slab(b, f, T0((GROUPS[4] + z1) / 2) - 0.3, SHOP_TOP + 0.25, z1 - GROUPS[4] + 0.6, 0.22, 1.2, 'bronze');
}

/** Slim dark-brick bay: one white-framed window per storey with two slats in its head, a small square window near the top. */
function brickBay(b: BuildingTools) {
  const f = nzv(BAY[0], BAY[1]), c = 1.4;
  for (const [y0, y1] of BAY_ROWS) {
    slab(b, f, c, y0 + 0.05, 0.86, y1 - y0 - 0.1, 0.06, 'glass');
    for (const k of [-1, 1]) plate(b, f, c + k * 0.47, y0, 0.1, y1 - y0, 0.06, 0.14, 'frame');
    for (const y of [y0, y1 - 0.1, y0 + (y1 - y0) * 0.62, y0 + (y1 - y0) * 0.76, y0 + (y1 - y0) * 0.89]) plate(b, f, c, y, 1.0, 0.1, 0.06, 0.14, 'frame');
  }
  slab(b, f, 2.9, 24.45, 0.6, 1.0, 0.06, 'glass');
  for (const k of [-1, 1]) plate(b, f, 2.9 + k * 0.33, 24.4, 0.09, 1.1, 0.06, 0.13, 'frame');
  for (const y of [24.4, 25.41]) plate(b, f, 2.9, y, 0.75, 0.09, 0.06, 0.13, 'frame');
  fslab(b, f, (BAY[1] - BAY[0]) / 2, 0, BAY[1] - BAY[0] - 0.1, 2.8, 0.08, 'dark'); // closed ground storey behind the 2025 hoarding
}

/** Cream stone cladding, four openings closed by white horizontal slats over dark glass (w09-269). */
function creamBay(b: BuildingTools) {
  const f = nzv(CREAM[0], CREAM[1]), len = CREAM[1] - CREAM[0], c = len / 2;
  slab(b, f, c, 0, len, 25.3, 0.12, 'sandstone');
  for (const [y0, y1] of CREAM_ROWS) {
    slab(b, f, c, y0 + 0.05, 1.5, y1 - y0 - 0.1, 0.16, 'glass');
    plate(b, f, c, y0, 1.6, 0.1, 0.16, 0.22, 'frame');
    plate(b, f, c, y1 - 0.1, 1.6, 0.1, 0.16, 0.22, 'frame');
    for (const k of [-1, 1]) plate(b, f, c + k * 0.75, y0, 0.1, y1 - y0, 0.16, 0.22, 'frame');
    for (const u of [0.55, 0.68, 0.81]) plate(b, f, c - 0.15, y0 + (y1 - y0) * u, 1.15, 0.09, 0.16, 0.21, 'frame');
  }
}

/** Grey stone cladding on the north corner (wall 153 and the chamfer), one slit window per storey on the NZV face. */
function greyCorner(b: BuildingTools) {
  const f = nzv(GREY[0], GREY[1]), len = GREY[1] - GREY[0];
  slab(b, f, len / 2, 0, len, 24.2, 0.1, 'greyBrick');
  for (const [y0, y1] of SLITS) put(b, f, new T.BoxGeometry(0.36, y1 - y0, 0.14).translate(0, (y1 - y0) / 2, 0.07), 0.9, y0, 0, 'glass');
  // the chamfer to the north (3DBAG wall 52, (-8.70,-19.3) to (-4.96,-20.6))
  const a: [number, number] = [-8.7, -19.3], e: [number, number] = [-4.96, -20.6];
  const L = Math.hypot(e[0] - a[0], e[1] - a[1]), tg: [number, number] = [(a[0] - e[0]) / L, (a[1] - e[1]) / L];
  const fc: Frame = {origin: e, tangent: tg, n: [tg[1], -tg[0]]};
  slab(b, fc, L / 2, 0, L - 0.12, 24.3, 0.1, 'greyBrick');
  for (const [y0, y1] of SLITS) slab(b, fc, L * 0.5, y0, 0.36, y1 - y0, 0.14, 'glass');
}

/** Low brick block before the tower: stone coping, a stone pier and plaque, the round-arched door in a white surround. */
function lowBlock(b: BuildingTools) {
  const f = nzv(LOW[0], LOW[1]), len = LOW[1] - LOW[0], T0 = (z: number) => z - LOW[0];
  slab(b, f, len / 2, 4.55, len, 0.35, 0.16, 'stone');
  slab(b, f, 0.4, 0, 0.8, 2.7, 0.12, 'stone');
  slab(b, f, T0(23.7), 3.6, 0.4, 0.75, 0.08, 'stone');
  const arch = (w: number, h: number, seg = 10): [number, number][] => {
    const r = w / 2, pts: [number, number][] = [[-r, 0], [r, 0], [r, h - r]];
    for (let i = 1; i < seg; i++) { const a = Math.PI * i / seg; pts.push([r * Math.cos(a), h - r + r * Math.sin(a)]); }
    pts.push([-r, h - r]);
    return pts;
  };
  poly(b, f, T0(ARCH_Z), 0, arch(1.55, 2.9), 0.1, 'white');
  poly(b, f, T0(ARCH_Z), 0, arch(1.05, 2.55), 0.16, 'dark');
}

/** Tower (3DBAG shaft to 46.8 m): stone corbels where it meets the main coping, a pale cap band (w05-342, w07-270; the flagpole is left out, the audit reads it as far-outside geometry). */
function tower(b: BuildingTools) {
  const roof = src.surfaces.find(s => s.type === 'RoofSurface' && Math.min(...s.rings[0].map(p => p[1])) > 46)!;
  const pts = roof.rings[0].map(p => [p[0], p[2]] as [number, number]);
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const grow = (k: number) => pts.map(p => [cx + (p[0] - cx) * k, cz + (p[1] - cz) * k] as [number, number]);
  const top = Math.max(...roof.rings[0].map(p => p[1]));
  extrude(b, grow(1.07), top - 1.6, 1.4, 'stone');
  extrude(b, grow(1.1), top - 0.2, 0.45, 'stone');
  // two stone corbels on the tower's NZV face just above the main coping (w07-270)
  const f: Frame = {origin: [-7.66, 22.75], tangent: [0, 1], n: [-1, 0]};
  for (const t of [0.35, 1.05]) slab(b, f, t, COPING + 0.3, 0.3, 1.6, 0.35, 'stone');
}

function extrude(b: BuildingTools, pts: [number, number][], y: number, h: number, colour: string) {
  const s = new T.Shape(pts.map(p => new T.Vector2(p[0], -p[1])));
  const g = new T.ExtrudeGeometry(s, {depth: h, bevelEnabled: false, curveSegments: 1});
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  b.add(g, colour as never);
}

/** Stair annex south of the tower: three glass-block bands on its west face (facade ring edge 10; the 0.95 m return, edge 12, has no 3DBAG wall at band height; w07-270). */
function annex(b: BuildingTools) {
  for (const e of [10]) {
    const {f, len} = snapped(e);
    for (const [y0, y1] of [[5.7, 7.5], [8.1, 10.1], [10.4, 12.2]] as [number, number][]) glassBlocks(b, f, len / 2, y0, y1, len - 0.12);
    slab(b, f, len / 2, 14.6, len - 0.12, 0.42, 0.12, 'stone');
  }
}

function snapped(edge: number): {f: Frame; len: number} {
  const {f: f0, len} = ringFrame(RING, edge);
  const offs = [0.25, 0.5, 0.75].flatMap(u => [6, 11].map(y => probe.offset(f0, len * u, y))).filter((o): o is number => o !== null).sort((a, c) => a - c);
  const off = offs.length ? offs[Math.floor(offs.length / 2)] : 0;
  return {f: {...f0, origin: [f0.origin[0] + f0.n[0] * off, f0.origin[1] + f0.n[1] * off]}, len};
}

/**
 * Kalverstraat side: shop windows with a dark fascia over them, plain white-framed upper windows on a 2.6 m pitch up to the
 * wall head (w02-71 Score/Mango, w04-157 Topman, w08-73 DOGO). Shop lettering is tenant signage and not drawn.
 */
function kalverstraat(b: BuildingTools, edge: number) {
  const {f, len} = snapped(edge);
  // 3DBAG leaves the north strip of the ring empty: draw only on faces with a shell wall behind them along their whole length
  if (len < 3 || [0.03, 0.5, 0.97].some(u => probe.offset(ringFrame(RING, edge).f, len * u, 2) === null)) return;
  const heads = [0.25, 0.5, 0.75].map(u => roofHeightAt(src.surfaces as never, f.origin[0] + f.tangent[0] * len * u - f.n[0] * 0.8, f.origin[1] + f.tangent[1] * len * u - f.n[1] * 0.8) ?? 0);
  const head = Math.min(...heads);
  const e = len - 0.2;
  slab(b, f, len / 2, 0, e, 0.3, 0.1, 'stone');
  slab(b, f, len / 2, 0.3, e - 0.4, 3.0, 0.06, 'glass');
  for (let i = 0, n = Math.max(1, Math.round((e - 0.4) / 2.2)); i <= n; i++) plate(b, f, 0.3 + (len - 0.6) * i / n, 0.3, 0.1, 3.0, 0.06, 0.14, 'dark');
  slab(b, f, len / 2, 3.3, e, 0.8, 0.14, 'bronze');
  const cols = Math.floor((len - 0.6) / 2.6);
  for (let y0 = 4.8; y0 + 2.2 < head - 0.6; y0 += 3.3) {
    for (let i = 0; i < cols; i++) {
      const c = len / 2 + (i - (cols - 1) / 2) * 2.6;
      slab(b, f, c, y0, 1.4, 2.1, 0.06, 'glass');
      for (const k of [-1, 0, 1]) plate(b, f, c + k * 0.65, y0, k ? 0.1 : 0.07, 2.1, 0.06, 0.13, 'frame');
      for (const y of [y0, y0 + 2.0, y0 + 1.45]) plate(b, f, c, y, 1.4, 0.1, 0.06, 0.13, 'frame');
    }
  }
}
