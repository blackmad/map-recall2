import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {eaveOffset, ledgeStrip, ringFrame, slab, setSink, getSink, type Frame} from './nearbar-kit';
import {basin, glassDome, offsetRing, post, prismRing, spiralSlide, tubePath, type XZ} from './pool-kit';
import source from './de-mirandabad-footprints.json';

/**
 * DE MIRANDABAD, De Mirandalaan 9 (BAG pand 0363100012107139, bouwjaar 1979; the subtropical bath of Amsterdam-Zuid, with outdoor
 * basins in the Amstelpark corner of the site). Sources: BAG ring + 3DBAG LoD2.2 shell (CC0 / CC BY 4.0) via pool-site-prepare.ts,
 * Gemeente Amsterdam panoramas (CC BY 4.0) for the street fronts, PDOK luchtfoto (Beeldmateriaal Nederland, CC BY 4.0) for the
 * dome, the outdoor basins and the slides, OSM leisure=swimming_pool areas (ODbL) for the basin outlines. Per item in
 * de-mirandabad-inventory.json.
 *  - The glass dome over the tropical hall is the signature: a low spherical cap of white-ribbed glass rising out of the flat
 *    roof (TMX7316010203-001173_pano_0000_001323, the orthophoto). Its centre is fitted to the 3DBAG roof vertices above
 *    12 m; the cap encloses the faceted 3DBAG dome (foot = furthest facet vertex + 0.4 m, apex = highest + 0.3 m).
 *  - West and north fronts (ring edges 42 and 41, photographed; edges 44 and 46 continue the same front, inferred): a glazed
 *    ground floor behind round concrete columns, a deep exposed-aggregate beam, a band of light block panels with tall windows,
 *    and a fascia with notched clerestory lights.
 *  - Outdoor (orthophoto, OSM): the 50 m lap pool with eight lanes and its deck, two hexagonal basins (the east one with a
 *    channel) on one paved deck, the blue spiral slide tube south of the hall and the yellow chute on the hexagon deck.
 */
type Pand = {id: string; nativeRing: number[][]; surfaces: Surface[]; groundOffset: number};
type Src = {nativeRing: number[][]; surfaces: Surface[]; pands: Pand[]; basins: {osm: string; ring: number[][]}[]};
export function buildDeMirandabad(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as Src;
  const ring = src.nativeRing;

  // ---- dome circle from the 3DBAG roof vertices above 12 m ----
  const hi = src.surfaces.filter(s => s.type === 'RoofSurface').flatMap(s => s.rings.flat()).filter(v => v[1] > 12);
  const cx = (Math.min(...hi.map(v => v[0])) + Math.max(...hi.map(v => v[0]))) / 2, cz = (Math.min(...hi.map(v => v[2])) + Math.max(...hi.map(v => v[2]))) / 2;
  const DOME_BASE = 10.3; // flat roof round the dome: 3DBAG 70th percentile 10.8 m NAP over a 0.5 m NAP ground
  // The whole 3DBAG shell stays (dropping its dome facets left open loops); the glass cap is sized to enclose them: its foot
  // circle takes the furthest faceted vertex above the flat roof plus 0.4 m, its apex the highest vertex plus 0.3 m.
  const domeV = src.surfaces.filter(s => s.type === 'RoofSurface').flatMap(s => s.rings.flat()).filter(v => v[1] > DOME_BASE + 0.4 && Math.hypot(v[0] - cx, v[2] - cz) < 30);
  const R = Math.max(...domeV.map(v => Math.hypot(v[0] - cx, v[2] - cz))) + 0.4;
  const APEX = Math.max(...domeV.map(v => v[1])) + 0.3;
  addShell(b, src as never, {wall: 'greyBrick', roof: 'slate'});
  // one glass pane per rib cell (pool-kit domePanes: each pane takes the game's glass cell), 32 meridians and 6 rings as the
  // orthophoto counts them; the single shell of 20 x 3 read as an opaque pale dome (review 2026-11-15)
  glassDome(b, [cx, cz], R, DOME_BASE, APEX, {glass: 'canopyGlass', rib: 'frame', meridians: 32, rings: 6, panes: true});
  // the dome's centre boss (orthophoto: a white hub where the ribs meet)
  post(b, [cx, cz], APEX - 0.1, APEX + 0.35, 0.8, 'frame');

  // ---- west and north fronts ----
  const sink0 = getSink();
  setSink(0.05);
  // each front stands on the 3DBAG wall (median eave offset from the BAG edge), not on the BAG line
  const roofs = src.surfaces.filter(s => s.type === 'RoofSurface');
  for (const i of [41, 42, 44, 46]) front(b, ringFrame(ring, i, Math.max(-0.5, Math.min(1.5, eaveOffset(ring, roofs, i)))));
  setSink(sink0);

  // ---- the striped glass entrance tower (ring edges 36-38: the 6 x 6 m block between the hall and the drum, 3DBAG roof
  // 11.5 m; TMX7316010203-001173_pano_0000_001317: glass in white frames, banded with red panels) ----
  setSink(0.05);
  for (const i of [36, 37, 38]) stripedTower(b, ringFrame(ring, i, 0.02));
  setSink(sink0);

  // ---- the other panden of the site on their 3DBAG shells ----
  for (const p of src.pands) addShell(b, {surfaces: p.surfaces} as never, {wall: p.id === '0363100012140021' ? 'brick' : 'greyBrick', roof: 'slate'});

  // ---- outdoor basins ----
  const [lap, hexW, hexE] = ['a133365162', 'a133364352', 'a2534962162'].map(id => src.basins.find(x => x.osm === id)!.ring);
  basin(b, lap, {deck: 4.5, lanes: 8});
  // one paved deck under both hexagons (orthophoto: a pale paved field reaching 5-8 m past the basins)
  const deck = hull([...offsetRing(hexW, 6), ...offsetRing(hexE, 6)]);
  prismRing(b, deck, 0, 0.1, 'concrete');
  basin(b, hexW, {});
  basin(b, hexE, {});

  // ---- slides ----
  // blue spiral tube south of the hall (orthophoto at native (2..6, 50..57)); it leaves the hall wall at about 7 m
  spiralSlide(b, [4.4, 53.2], 2.6, 1.2, 7.4, 2.25, 0.55, 'copper', Math.PI);
  tubePath(b, [[4.4 - 2.6, 7.4, 53.2], [0, 7.9, 50.5], [-2.5, 8.2, 47.5]], 0.55, 'copper');
  for (const a of [0.5, 2.1, 3.7, 5.3]) post(b, [4.4 + Math.cos(a) * 2.6, 53.2 + Math.sin(a) * 2.6], 0, 6.5, 0.12, 'frame');
  tubePath(b, [[4.4 + 2.6, 1.2, 53.2], [7.8, 0.7, 55.6], [8.6, 0.5, 57.2]], 0.55, 'copper');
  // yellow chute on the hexagon deck, from a small tower at (133.1, -6.6) down to the east basin at (126.9, 2.4)
  for (const [x, z] of [[132.4, -7.4], [134.0, -7.4], [132.4, -5.8], [134.0, -5.8]] as XZ[]) post(b, [x, z], 0, 3.9, 0.1, 'frame');
  prismRing(b, [[132.2, -7.6], [134.2, -7.6], [134.2, -5.6], [132.2, -5.6]], 3.75, 3.9, 'gold');
  tubePath(b, [[133.1, 4.0, -6.6], [130.4, 2.6, -2.6], [127.4, 0.9, 1.6], [126.9, 0.6, 2.4]], 0.45, 'gold', 6);
}

/** The 1979 front: glazed ground floor behind columns, exposed-aggregate beam, block panels with tall windows, notched fascia. */
function front(b: BuildingTools, {f, len}: {f: Frame; len: number}) {
  const bay = 5.7, n = Math.max(1, Math.round(len / bay)), step = len / n;
  slab(b, f, len / 2, 0.15, len - 1.4, 3.9, 0.14, 'glass'); // ground-floor glazing (simplified: drawn on the wall plane)
  for (let k = 0; k <= n; k++) {
    const t = Math.min(len - 0.3, Math.max(0.3, k * step));
    slab(b, f, t, 0, 0.5, 4.15, 0.45, 'sandstone'); // round concrete columns, drawn square
  }
  slab(b, f, len / 2, 4.1, len, 1.9, 0.5, 'sandstone'); // the deep beam over the ground floor
  slab(b, f, len / 2, 6.0, len, 2.4, 0.12, 'greyBrick'); // block panels
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) * step;
    slab(b, f, t, 6.15, 1.45, 2.25, 0.2, 'glass');
    slab(b, f, t, 6.1, 1.6, 0.08, 0.16, 'dark', 0.0);
  }
  slab(b, f, len / 2, 8.4, len, 1.65, 0.45, 'sandstone'); // fascia
  for (let k = 1; k < n; k++) slab(b, f, k * step, 8.55, Math.min(3, step * 0.5), 0.55, 0.08, 'glass', 0.45); // clerestory notches over the panels, between the windows (w04 crop)
}

/** A glass tower front: full-height glass in white frames, banded with red panels every storey band (w08-5 crop). */
function stripedTower(b: BuildingTools, {f, len}: {f: Frame; len: number}) {
  const TOP = 11.3;
  // the glass as a front-only strip, 5 cm behind the mullions: its (double-sided) back plane lay on the bands' and trims' back
  // planes and its front 2 cm off the mullions' (audit zfight 20 m2 + zfight-tight 3.4 m2, 2026-11-15)
  ledgeStrip(b, f, len / 2, 0.1, len - 0.2, TOP - 0.45, 0.09, 'glass'); // up to the coping's underside, 5 cm behind the mullions
  for (let y = 0.9; y + 0.75 < TOP; y += 1.55) slab(b, f, len / 2, y, len - 0.3, 0.75, 0.16, 'green'); // red enamel bands: the 'green' accent slot carries the spec's red, so they draw smooth, not as atlas brick
  for (let y = 0.1; y < TOP; y += 1.55) slab(b, f, len / 2, y, len - 0.5, 0.1, 0.2, 'white'); // white transoms
  for (const t of [0.3, len / 2, len - 0.3]) slab(b, f, t, 0.1, 0.12, TOP - 0.1, 0.14, 'white'); // mullions
  ledgeStrip(b, f, len / 2, TOP - 0.35, len - 0.5, 0.35, 0.3, 'white'); // coping (front and top only: its back plane lay on the top transom's), kept under the 3DBAG roof (11.5 m)
}

/** Convex hull (monotone chain) of native points. */
function hull(pts: XZ[]): XZ[] {
  const p = [...pts].sort((a, c) => a[0] - c[0] || a[1] - c[1]);
  const cross = (o: XZ, a: XZ, c: XZ) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
  const lo: XZ[] = [], up: XZ[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo.at(-2)!, lo.at(-1)!, q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cross(up.at(-2)!, up.at(-1)!, q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
