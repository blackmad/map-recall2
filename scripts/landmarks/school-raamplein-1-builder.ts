import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, disc, getSink, ledgeStrip, letters, poly, put, ringFrame, setSink, slab, segBand, type Frame} from './nearbar-kit';
import {balustrade} from '../../src/canalRecall/landmarks/balustrade';
import source from './school-raamplein-1-footprints.json';

/**
 * SCHOOL RAAMPLEIN 1, the former Openbare Handelsschool (BAG pand 0363100012165430, BAG 1905; rijksmonument 518264,
 * wikidata Q17302591; H. Leguyt and B. Springer, Publieke Werken, 1899-1901; later the Hogeschool voor Economische Studies,
 * since 2012 offices). Register (nl.wikipedia "Raamplein 1", quoting the 2017 register text): a rectangular building in
 * natural stone, red and yellow brick, three storeys under a slate mansard with a cornice; a broad front on the Raamplein
 * with two corner risalits and a middle risalit in yellow brick; in the middle risalit a round-arched entrance with two
 * half-columns, a small stone balcony with an open balustrade on the first floor, colossal half-pilasters through the
 * second and third storeys, and an aedicule with two round-arched lights crowned by a pediment with a gilded eagle; the
 * corner risalits plainer; the Passeerdersgracht front shares the left corner risalit. The 1899 description: Escaussines
 * hardstone ground storey, brown-red and brown-yellow brick above, dressings of Obernkirchen sandstone.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts). 3DBAG fits one plane through the cornice and
 * the mansard's lower slope, so its walls stop at 16.6-17.3 m; the rectified fronts (w03, w04, w09; storey levels agree to
 * 0.1 m) put the cornice top at 19.2 m. Shell points within 1.7 m of the Raamplein and Passeerdersgracht fronts between
 * 15.5 m and 19.2 m are lifted to 19.2 m (the photo, not the 3DBAG plane), so the mansard rises from the cornice.
 *
 * Fronts read from Gemeente Amsterdam panoramas (CC BY 4.0), rectified at 50 px/m, heights above the 3DBAG ground
 * (0.93 m NAP):
 *  - Raamplein, NW corner risalit (ring edge 18, w10-246): TMX7316010203-002550_pano_0000_000918 (2022);
 *  - Raamplein, north brick wing (edge 22, w04-246, INSPIRING): TMX7316010203-001048_pano_0000_003411 (2019);
 *  - Raamplein, middle risalit (edge 26, w07-246, AUDIENCES): TMX7316010203-001178_pano_0001_002898 (2019, a lorry hides
 *    the ground storey) and TMX7316010203-002970_pano_0000_000007 (2022);
 *  - Raamplein, south brick wing (edge 30, w03-247, WORLDWIDE): TMX7316010203-002970_pano_0003_000157 (2023);
 *  - Raamplein, SE corner risalit (edge 34, w09-246): TMX7316010203-002306_pano_0001_000921 (2021);
 *  - Passeerdersgracht (edges 15 and 17, w02-337): TMX7316010203-002306_pano_0002_000944 (2021, sunlit).
 * Per item in school-raamplein-1-inventory.json.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]; nativeRing: number[][]};
const src = source as unknown as Src;
const edge = (i: number) => ringFrame(src.facadeRing, i);

/** Storey levels (sill, head) above the 3DBAG ground, from w03/w09. */
const PLINTH = 2.1, G = 6.0, GB = 6.5;
const W0: [number, number] = [2.4, 5.3];
const S1: [number, number] = [7.3, 10.25];
const S2: [number, number] = [12.3, 15.0];
const SILL2 = 12.05, FR0 = 15.95, FR1 = 17.4, CR = 19.2;
/** Flush cladding stops this far short of each end: an end face in a re-entrant corner would lie in the return wall's plane. */
const E = 0.035;

/** Front edges whose eaves the photo lifts (Raamplein, its jogs, the Passeerdersgracht front, the SE side). */
const LIFT_EDGES = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35];

function liftedShell(): Src {
  const r = src.facadeRing;
  const near = (p: number[]) => LIFT_EDGES.some(i => {
    const a = r[i], c = r[(i + 1) % r.length], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz);
    const d = Math.abs((p[0] - a[0]) * dz - (p[2] - a[1]) * dx) / L, t = ((p[0] - a[0]) * dx + (p[2] - a[1]) * dz) / L;
    return d < 1.7 && t > -0.5 && t < L + 0.5;
  });
  // 3DBAG notches the NW risalit front (edge 18) 0.6-2 m deep above 7 m at t 5.2-6.3; w10-246 shows a flat yellow-brick
  // front there, so the notch's points are put back on the front plane.
  const a18 = r[18], c18 = r[19], ex = c18[0] - a18[0], ez = c18[1] - a18[1], L18 = Math.hypot(ex, ez);
  const unnotch = (p: number[]) => {
    const t = ((p[0] - a18[0]) * ex + (p[2] - a18[1]) * ez) / L18, d = ((p[0] - a18[0]) * ez - (p[2] - a18[1]) * ex) / L18;
    if (t < 4.9 || t > 6.6 || p[1] < 6.9 || p[1] > 24 || Math.abs(d) < 0.3 || Math.abs(d) > 2.1) return p;
    return [p[0] - (d * ez) / L18, p[1], p[2] + (d * ex) / L18];
  };
  const lift = (q: number[]) => { const p = unnotch(q); return p[1] > 15.5 && p[1] < CR && near(p) ? [p[0], CR, p[2]] : p; };
  return {...src, surfaces: src.surfaces.map(s => ({...s, rings: s.rings.map(q => q.map(lift))}))};
}

/** Ring edges of the yellow-brick risalits and their returns (the shell wall there is drawn in yellow brick). */
const YELLOW_EDGES = [16, 17, 18, 19, 20, 21, 25, 26, 27, 33, 34];

/** The facade-ring edge a wall surface stands on (smallest mean distance of its vertices to the edge segment). */
function nearestEdge(s: Surface): number {
  const r = src.facadeRing, pts = s.rings[0];
  let best = -1, bd = Infinity;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], c = r[(i + 1) % r.length], dx = c[0] - a[0], dz = c[1] - a[1], L2 = dx * dx + dz * dz;
    let d = 0;
    for (const p of pts) {
      const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[1]) * dz) / L2));
      d += Math.hypot(p[0] - a[0] - u * dx, p[2] - a[1] - u * dz);
    }
    if (d / pts.length < bd) { bd = d / pts.length; best = i; }
  }
  return bd < 0.5 ? best : -1;
}

export function buildSchoolRaamplein1(_w: number, _d: number, b: BuildingTools) {
  addShell(b, liftedShell() as never, {wall: 'brick', roof: 'slate', wallFor: s => (YELLOW_EDGES.includes(nearestEdge(s)) ? 'ochre' : 'brick')});
  const sink0 = getSink();
  // no sink: every solid's back face lies on the wall plane, so an end face at a corner never overlaps the neighbouring wall
  setSink(0);
  brickWing(b, 22, 'INSPIRING');
  brickWing(b, 30, 'WORLDWIDE');
  brickWing(b, 15, '', 3);
  cornerRisalit(b, 18);
  cornerRisalit(b, 34);
  cornerRisalit(b, 17);
  middleRisalit(b);
  for (const i of [16, 19, 20, 21, 23, 24, 25, 27, 28, 29, 31, 32, 33]) returnFace(b, i);
  sideSE(b);
  conciergeHouse(b);
  setSink(sink0);
}

/** Multi-light classroom window: white frame, glass, `cols` lights with a transom at `tr` below the head. */
function win(b: BuildingTools, f: Frame, c: number, y0: number, y1: number, w: number, cols = 3, tr = 0.85, o = 0) {
  const h = y1 - y0;
  // the frame is a ring of four strips round the pane (no sheet behind it: back faces would share the wall plane)
  for (const s of [-1, 1]) slab(b, f, c + s * (w / 2 + 0.03), y0 - 0.06, 0.06, h + 0.12, 0.07, 'white', o);
  for (const y of [y0 - 0.06, y1]) slab(b, f, c, y, w, 0.06, 0.07, 'white', o);
  slab(b, f, c, y0, w, h, 0.13, 'glass', o);
  for (let k = 1; k < cols; k++) ledgeStrip(b, f, c - w / 2 + (w * k) / cols, y0, 0.07, h, 0.2, 'white', o);
  ledgeStrip(b, f, c, y1 - tr, w, 0.07, 0.2, 'white', o);
  // glazing bars: the transom lights in small panes, the lower sashes in three rows
  for (let k = 1; k < cols * 2; k += 2) ledgeStrip(b, f, c - w / 2 + (w * k) / (cols * 2), y1 - tr, 0.03, tr, 0.18, 'white', o);
  for (const q of [1 / 3, 2 / 3]) ledgeStrip(b, f, c, y0 + (h - tr) * q, w, 0.03, 0.18, 'white', o);
}

/** Round-headed window (square lower lights, glazed fan), white frame and bars. */
function archWin(b: BuildingTools, f: Frame, c: number, y0: number, top: number, w: number, o = 0) {
  const h = top - y0;
  archBand(b, f, c, y0 - 0.06, w + 0.12, h + 0.12, 0.06, 0.07, 'white', o, 10);
  slab(b, f, c, y0 - 0.06, w, 0.06, 0.07, 'white', o);
  archSlab(b, f, c, y0, w, h, 0.13, 'glass', o, 10);
  const spring = top - w / 2;
  for (const k of [1, 2]) ledgeStrip(b, f, c - w / 2 + (w * k) / 3, y0, 0.07, spring - y0 + w * 0.36, 0.2, 'white', o);
  ledgeStrip(b, f, c, spring, w, 0.07, 0.2, 'white', o);
  for (const q of [1 / 3, 2 / 3]) ledgeStrip(b, f, c, y0 + (spring - y0) * q, w, 0.03, 0.18, 'white', o);
}

/** Rusticated hardstone ground storey and plinth across [t0, t1]; windows at `cols`. */
function groundStorey(b: BuildingTools, f: Frame, t0: number, t1: number, cols: number[], ww: number, o = 0) {
  const c = (t0 + t1) / 2, w = t1 - t0 - 2 * E;
  slab(b, f, c, 0, w, PLINTH, 0.22, 'concrete', o);
  slab(b, f, c, PLINTH - 0.12, w, 0.14, 0.3, 'concrete', o);
  // hardstone face in pieces round the windows (piers, sill and lintel courses), so the windows sit 15 cm in their reveals
  const xs = [...cols].sort((p, q) => p - q), half = ww / 2 + 0.06;
  const edges = [t0 + E, ...xs.flatMap(x => [x - half, x + half]), t1 - E];
  for (let k = 0; k < edges.length; k += 2) if (edges[k + 1] - edges[k] > 0.02) {
    const pc = (edges[k] + edges[k + 1]) / 2, pw = edges[k + 1] - edges[k];
    slab(b, f, pc, PLINTH, pw, G - PLINTH, 0.15, 'greyBrick', o);
    // rustication: sunk joints every 0.48 m on the piers (thin darker courses read as the grooves)
    for (let y = PLINTH + 0.48; y < G - 0.2; y += 0.48) ledgeStrip(b, f, pc, y, pw, 0.035, 0.24, 'concrete', o);
  }
  for (const x of xs) {
    slab(b, f, x, PLINTH, 2 * half, W0[0] - 0.06 - PLINTH, 0.15, 'greyBrick', o);
    slab(b, f, x, W0[1] + 0.06, 2 * half, G - W0[1] - 0.06, 0.15, 'greyBrick', o);
    win(b, f, x, W0[0], W0[1], ww, 3, 0.85, o);
    slab(b, f, x, W0[0] - 0.14, ww + 0.2, 0.12, 0.3, 'greyBrick', o);
  }
  // the storey's stone cornice band
  slab(b, f, c, G, w, 0.3, 0.3, 'greyBrick', o);
  slab(b, f, c, G + 0.3, w, 0.18, 0.4, 'greyBrick', o);
  // vents in the plinth (souterrain)
  for (const x of cols) for (const s of [-0.5, 0.5]) slab(b, f, x + s, 0.45, 0.22, 0.12, 0.25, 'dark', o);
}

/** Frieze band, lettering, modillion cornice across [t0, t1]. */
function frieze(b: BuildingTools, f: Frame, t0: number, t1: number, text: string, wall: string, o = 0) {
  const c = (t0 + t1) / 2, w = t1 - t0;
  slab(b, f, c, FR0 - 0.15, w + 0.04, 0.17, 0.2, 'stone', o);
  slab(b, f, c, FR0, w - 2 * E, FR1 - FR0, 0.08, wall, o);
  if (text) letters(b, f, text, c, FR0 + 0.48, o + 0.08, Math.min(0.13, (w * 0.5) / ([...text].length * 6 - 1)), 0.09, 'gold', 0.065);
  slab(b, f, c, FR1, w + 0.1, 0.22, 0.2, 'stone', o);
  slab(b, f, c, FR1 + 0.22, w + 0.2, 0.28, 0.38, 'stone', o);
  for (let t = t0 + 0.25; t < t1 - 0.1; t += 0.5) slab(b, f, t, FR1 + 0.5, 0.16, 0.36, 0.72, 'stone', o);
  slab(b, f, c, FR1 + 0.86, w + 0.5, CR - FR1 - 0.86, 0.95, 'stone', o);
}

/** Small round-headed dormer in the mansard with a white arched hood. */
function dormer(b: BuildingTools, f: Frame, c: number) {
  // stands on the cornice top in front of the mansard foot, so no pane crosses the roof plane; the slate front is the
  // pane's host wall (at least three times its face), the stone hood an arched band round the light
  const sink = getSink();
  setSink(0);
  slab(b, f, c, CR, 1.6, 2.15, 2.2, 'slate', -1.7);
  archSlab(b, f, c, CR + 0.3, 0.8, 1.35, 0.06, 'white', 0.5, 8);
  archSlab(b, f, c, CR + 0.34, 0.7, 1.27, 0.1, 'glass', 0.5, 8);
  ledgeStrip(b, f, c, CR + 0.34, 0.05, 0.92, 0.14, 'white', 0.5);
  archBand(b, f, c, CR + 0.22, 1.2, 1.6, 0.2, 0.16, 'stone', 0.5, 8);
  setSink(sink);
}

/** The red-brick wings between the risalits: four bays (three on the Passeerdersgracht). */
function brickWing(b: BuildingTools, i: number, text: string, bays = 4) {
  const {f, len} = edge(i);
  const p = len / bays, cols = Array.from({length: bays}, (_, k) => p * (k + 0.5)), ww = Math.min(2.1, p - 1.1);
  groundStorey(b, f, 0, len, cols, ww);
  for (const c of cols) {
    // first floor: yellow panel under the window, stone sill, the window, the yellow lintel panel in stone ears and its hood
    slab(b, f, c, GB, ww + 0.45, S1[0] - GB - 0.12, 0.06, 'ochre');
    slab(b, f, c, S1[0] - 0.2, ww + 0.3, 0.14, 0.24, 'stone');
    win(b, f, c, S1[0], S1[1], ww);
    slab(b, f, c, S1[1] + 0.05, ww + 0.45, 0.6, 0.06, 'ochre');
    for (const s of [-1, 1]) slab(b, f, c + s * (ww / 2 + 0.3), S1[1] - 0.5, 0.18, 1.15, 0.1, 'stone');
    slab(b, f, c, S1[1] + 0.65, ww + 0.8, 0.12, 0.22, 'stone');
    slab(b, f, c, S1[1] + 0.77, ww + 0.95, 0.1, 0.3, 'stone');
    // second floor: round-headed window under a yellow-brick archivolt with stone imposts and a keystone console
    archWin(b, f, c, S2[0], S2[1], ww);
    archBand(b, f, c, S2[1] - ww / 2, ww + 0.82, ww / 2 + 0.41, 0.35, 0.07, 'ochre', 0, 10);
    for (const s of [-1, 1]) slab(b, f, c + s * (ww / 2 + 0.28), S2[1] - ww / 2 - 0.12, 0.42, 0.18, 0.12, 'stone');
    slab(b, f, c, S2[1] + 0.12, 0.3, 0.62, 0.2, 'stone');
  }
  slab(b, f, len / 2, SILL2, len - 2 * E, 0.16, 0.14, 'stone');
  frieze(b, f, 0, len, text, 'ochre');
  if (bays === 4) for (const c of [p, len - p]) dormer(b, f, c);
  else dormer(b, f, cols[1]);

}

/** Stone half-pilaster of the colossal order from the ground-storey band to the frieze. */
function pilaster(b: BuildingTools, f: Frame, c: number, w: number, o = 0) {
  slab(b, f, c, GB + 0.2, w + 0.14, 0.7, 0.3, 'stone', o);
  slab(b, f, c, GB + 0.9, w, FR0 - GB - 1.4, 0.22, 'stone', o);
  slab(b, f, c, FR0 - 0.5, w + 0.16, 0.36, 0.3, 'stone', o);
}

/** Two-light window group with a stone colonnette between and stone frames (the risalits). */
function pairGroup(b: BuildingTools, f: Frame, c: number, y0: number, y1: number, lights: number[], o = 0) {
  const W = lights.reduce((s, w) => s + w, 0) + 0.32 * (lights.length - 1);
  slab(b, f, c, y0 - 0.22, W + 0.5, 0.16, 0.26, 'stone', o);
  slab(b, f, c, y1 + 0.06, W + 0.4, 0.22, 0.2, 'stone', o);
  for (const s of [-1, 1]) slab(b, f, c + s * (W / 2 + 0.16), y0 - 0.06, 0.2, y1 - y0 + 0.12, 0.14, 'stone', o);
  let u = c - W / 2;
  for (const [k, w] of lights.entries()) {
    win(b, f, u + w / 2, y0, y1, w, w > 1.2 ? 3 : 1, 0.8, o);
    u += w;
    if (k < lights.length - 1) {
      // colonnette: shaft, base and capital
      slab(b, f, u + 0.16, y0 - 0.06, 0.18, y1 - y0 + 0.12, 0.22, 'stone', o);
      slab(b, f, u + 0.16, y1 - 0.12, 0.2, 0.18, 0.28, 'stone', o);
      u += 0.32;
    }
  }
}

/** Urn finial on a block. */
function urn(b: BuildingTools, f: Frame, t: number, y: number, o = 0) {
  slab(b, f, t, y, 0.55, 0.35, 0.55, 'stone', o);
  const g = new T.SphereGeometry(0.24, 8, 6).scale(1, 1.25, 1);
  put(b, f, g, t, y + 0.62, o + 0.27, 'stone');
  const cap = new T.ConeGeometry(0.1, 0.32, 6).translate(0, 0.16, 0);
  put(b, f, cap, t, y + 0.9, o + 0.27, 'stone');
}

/** Corner risalit: yellow brick between colossal pilasters, paired windows, frieze, cornice, urns and the aedicule dormer. */
function cornerRisalit(b: BuildingTools, i: number, aed = true) {
  const {f, len} = edge(i);
  const L = len, pw = 0.95, cols = [L / 2 - 1.2, L / 2 + 1.2], ww = 1.95;
  groundStorey(b, f, 0, L, cols, ww);
  for (const c of [pw / 2 + 0.05, L - pw / 2 - 0.05]) pilaster(b, f, c, pw);
  pairGroup(b, f, L / 2, S1[0], S1[1], [ww, ww]);
  pairGroup(b, f, L / 2, S2[0] - 0.2, S2[1] - 0.2, [ww, ww]);
  // stone strips between the storeys round the yellow spandrel panel
  slab(b, f, L / 2, S1[1] + 0.85, L - 2 * pw - 0.2, 0.14, 0.14, 'stone');
  slab(b, f, L / 2, S2[0] - 0.6, L - 2 * pw - 0.2, 0.14, 0.14, 'stone');
  frieze(b, f, 0, L, '', 'ochre');
  for (const t of [pw / 2 + 0.05, L - pw / 2 - 0.05]) disc(b, f, t, FR0 + 0.7, 0.24, 0.08, 'stone', 0.08);
  for (const t of [0.4, L - 0.4]) urn(b, f, t, CR, -0.2);
  if (aed) aedicule(b, f, L / 2, 1);
}

/**
 * Aedicule dormer standing on the cornice: yellow brick between stone pilasters, round-arched light(s), entablature and
 * pediment, stone scrolls either side. `lights` 1 on the corner risalits, 2 (with the gilded eagle) on the middle risalit.
 */
function aedicule(b: BuildingTools, f: Frame, c: number, lights: 1 | 2) {
  const W = lights === 1 ? 2.5 : 3.6, H = 2.6, back = -1.6, y = CR;
  slab(b, f, c, y, W, H, 1.9, 'ochre', back);
  slab(b, f, c, y, W + 0.2, 0.35, 0.3, 'stone', -0.25);
  for (const s of [-1, 1]) slab(b, f, c + s * (W / 2 - 0.19), y + 0.35, 0.3, H - 0.35, 0.2, 'stone', 0.25);
  const lw = lights === 1 ? 1.05 : 0.95;
  for (const k of lights === 1 ? [0] : [-0.62, 0.62]) {
    archSlab(b, f, c + k, y + 0.55, lw + 0.12, 1.85, 0.06, 'white', 0.3, 8);
    archSlab(b, f, c + k, y + 0.6, lw, 1.75, 0.12, 'glass', 0.3, 8);
    ledgeStrip(b, f, c + k, y + 0.6, 0.06, 1.75 - lw / 2, 0.18, 'white', 0.3);
    archBand(b, f, c + k, y + 0.6 + 1.75 - lw - 0.04, lw + 0.4, lw / 2 + 0.25, 0.2, 0.06, 'stone', 0.3, 8);
  }
  // entablature and pediment
  slab(b, f, c, y + H, W + 0.3, 0.3, 0.5, 'stone', 0.05);
  poly(b, f, c, y + H + 0.3, [[-W / 2 - 0.15, 0], [W / 2 + 0.15, 0], [0, lights === 1 ? 0.75 : 0.95]], 1.9, 'stone', back);
  if (lights === 2) {
    // the gilded eagle in the tympanum: body disc and spread wings
    disc(b, f, c, y + H + 0.52, 0.16, 0.06, 'gold', 0.31);
    poly(b, f, c, y + H + 0.38, [[-0.62, 0.12], [-0.1, 0], [0.1, 0], [0.62, 0.12], [0.18, 0.34], [-0.18, 0.34]], 0.05, 'gold', 0.3);
  }
  // scroll volutes either side, down to the cornice
  for (const s of [-1, 1]) {
    const x0 = c + s * (W / 2);
    poly(b, f, x0, y, s < 0 ? [[-0.95, 0], [0, 0], [0, 1.9], [-0.25, 1.9], [-0.45, 0.9]] : [[0, 0], [0.95, 0], [0.45, 0.9], [0.25, 1.9], [0, 1.9]], 0.35, 'stone', -0.1);
    disc(b, f, x0 + s * 0.68, y + 0.38, 0.2, 0.1, 'stone', 0.25);
  }
}

/** The middle risalit (edge 26), 1.5 m proud: entrance, balcony, four-light groups, colossal pilasters, AUDIENCES, aedicule. */
function middleRisalit(b: BuildingTools) {
  const {f, len} = edge(26);
  const L = len, pw = 0.95, c = L / 2;
  groundStorey(b, f, 0, L, [1.5, L - 1.5], 1.2);
  // the round-arched entrance with two half-columns (register; the lorry hides it in 2019): stone porch carrying the balcony
  slab(b, f, c, 0, 4.4, G + 0.3, 0.6, 'greyBrick');
  archSlab(b, f, c, 0.3, 2.0, 4.0, 0.1, 'dark', 0.6, 10);
  archBand(b, f, c, 0.3, 2.5, 4.25, 0.25, 0.12, 'greyBrick', 0.6, 10);
  for (const s of [-1, 1]) {
    const g = new T.CylinderGeometry(0.2, 0.2, 3.6, 10, 1, false, 0, Math.PI).rotateY(-Math.PI / 2).translate(0, 1.8, 0);
    put(b, f, g, c + s * 1.45, 0.4, 0.6, 'greyBrick');
    slab(b, f, c + s * 1.45, 4.0, 0.55, 0.3, 0.32, 'greyBrick', 0.6);
  }
  // balcony slab on the porch, its open balustrade with a carved centre panel
  const bw = 4.6, by = GB + 0.15;
  slab(b, f, c, by, bw, 0.25, 1.0, 'greyBrick');
  const bl = balustrade({width: bw - 0.1, height: 0.95, post: 0.34, plinth: 0.14, rail: 0.14, baluster: 0.12, pitch: 0.27, bays: 2});
  const at = (x: number) => c + x, Y = by + 0.25, out = 0.62;
  slab(b, f, at(0), Y + bl.plinth.y, bl.plinth.x1 - bl.plinth.x0, bl.plinth.h, 0.32, 'stone', out);
  slab(b, f, at(0), Y + bl.rail.y, bl.rail.x1 - bl.rail.x0, bl.rail.h, 0.36, 'stone', out - 0.02);
  for (const p of bl.posts) slab(b, f, at(p.x), Y + p.y, p.w, bl.rail.y - p.y, 0.32, 'stone', out);
  for (const q of bl.balusters) if (Math.abs(q.x) > 0.75) slab(b, f, at(q.x), Y + q.y, q.w, q.h, 0.12, 'stone', out + 0.1);
  slab(b, f, c, Y, 1.4, 0.95, 0.3, 'stone', out);
  disc(b, f, c, Y + 0.48, 0.3, 0.05, 'stone', out + 0.3);
  // yellow brick between the colossal pilasters; four-light groups with colonnettes on both upper storeys
  for (const t of [pw / 2 + 0.05, L - pw / 2 - 0.05]) pilaster(b, f, t, pw);
  const lights = [0.85, 1.75, 1.75, 0.85];
  pairGroup(b, f, c, S1[0] + 0.1, S1[1], lights);
  pairGroup(b, f, c, S2[0] - 0.2, S2[1] - 0.2, lights);
  slab(b, f, c, S1[1] + 0.85, L - 2 * pw - 0.2, 0.14, 0.14, 'stone');
  slab(b, f, c, S2[0] - 0.6, L - 2 * pw - 0.2, 0.14, 0.14, 'stone');
  frieze(b, f, 0, L, 'AUDIENCES', 'ochre');
  for (const t of [pw / 2 + 0.05, L - pw / 2 - 0.05]) disc(b, f, t, FR0 + 0.7, 0.24, 0.08, 'stone', 0.08);
  for (const t of [0.4, L - 0.4]) urn(b, f, t, CR, -0.2);
  aedicule(b, f, c, 2);
}

/** Short returns and jogs of the risalits: the ground storey, the brick or yellow face and the cornice carried round. */
function returnFace(b: BuildingTools, i: number) {
  const {f, len} = edge(i);
  if (len < 0.25) return;
  const c = len / 2;
  slab(b, f, c, 0, len - 2 * E, PLINTH, 0.22, 'concrete');
  slab(b, f, c, PLINTH, len - 2 * E, G - PLINTH, 0.15, 'greyBrick');
  slab(b, f, c, G, len + 0.06, 0.48, 0.3, 'greyBrick');
  slab(b, f, c, GB, len - 2 * E, FR0 - GB, 0.1, 'stone');
  slab(b, f, c, FR0, len - 2 * E, FR1 - FR0, 0.1, 'ochre');
  slab(b, f, c, FR1, len + 0.1, CR - FR1, 0.38, 'stone');
}

/** The SE side (edge 35, w01-155): behind bamboo in every capture; the corner risalit's ground storey and cornice carried round, brick above. */
function sideSE(b: BuildingTools) {
  const {f, len} = edge(35);
  groundStorey(b, f, 0, len, [6.0, 13.0, 16.5], 1.9);
  slab(b, f, len / 2, SILL2, len - 2 * E, 0.16, 0.14, 'stone');
  for (const c of [6.0, 13.0, 16.5]) {
    win(b, f, c, S1[0], S1[1], 1.9);
    archWin(b, f, c, S2[0], S2[1], 1.9);
  }
  frieze(b, f, 0, len, '', 'ochre');
}

/**
 * Passeerdersgracht 27 (edge 11, w08-332, 2024 and 2022): the two-storey brick house of the school's concierge in the same
 * pand (the register lists it as its own monument within the complex). Sash windows in white frames under segmental brick
 * arches, the black front door with a fanlight, a taller right bay with an attic window.
 */
function conciergeHouse(b: BuildingTools) {
  const {f, len} = edge(11);
  const W = 1.05, rows: [number, number][] = [[0.9, 2.8], [3.9, 5.9]];
  for (const [y0, y1] of rows) for (const c of [1.6, 3.2, 7.2]) {
    win(b, f, c, y0, y1, W, 2, 0.5);
    segBand(b, f, c, y1 + 0.32, W + 0.3, 0.16, 0.24, 0.05, 'brick');
  }
  // the door with its fanlight, the first-floor window over it
  slab(b, f, 5.2, 0.15, 1.0, 2.25, 0.06, 'dark');
  win(b, f, 5.2, 2.45, 2.85, 0.9, 1, 0.38);
  segBand(b, f, 5.2, 3.15, 1.25, 0.16, 0.24, 0.05, 'brick');
  win(b, f, 5.2, rows[1][0], rows[1][1], W, 2, 0.5);
  segBand(b, f, 5.2, rows[1][1] + 0.32, W + 0.3, 0.16, 0.24, 0.05, 'brick');
  // the right bay's attic window
  if (len > 7.8) win(b, f, 7.2, 7.1, 8.4, 0.95, 2, 0.4);
}
