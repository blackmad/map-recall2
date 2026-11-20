import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {letters, poly, ringFrame, setSink, getSink, slab, type Frame} from './nearbar-kit';
import {inPart} from './pand-part-shell';
import {rowFront, storeysUnder} from './row-front';
import {fullPand, type PandPart} from '../../src/canalRecall/landmarks/pandParts';
import source from './holland-casino-amsterdam-footprints.json';
import spec from './holland-casino-amsterdam-spec.json';

/**
 * HOLLAND CASINO AMSTERDAM, Max Euweplein 62 (1991; nl.wikipedia Holland Casino Amsterdam, CC BY-SA 4.0). The casino
 * stands on part of BAG pand 0363100012173447: the pand also holds the north-east arm, the 1890s houses on the
 * Weteringschans side of the Max Euweplein (brick with cream stucco dressings, balconies, shopfronts) and its courtyard
 * walls. Since 2026-11-20 (landmarks r8 lane) the model draws the WHOLE pand: the full 3DBAG LoD2.2 shell, the casino's
 * faces as before and the arm in brick, its front laid out by row-front.ts from recording_2025-07-14_05-25-22_01977 and
 * _01963 (2025). Read from rectified Gemeente Amsterdam panoramas
 * (CC BY 4.0, 50 px/m), with heights from the 3DBAG shell (canal block 5.9 m, set-back storey 12.2 m, 3.7 m back):
 * - the Singelgracht front (ring edges 37 and 38; w03-257, w07-252): yellow-framed glazing on the deck, red steel columns,
 *   timber lattice screens, a red beam and the sloped timber pergola up to the white-tiled set-back storey;
 * - the white-tiled storey with square windows, the HOLLAND CASINO sign, a red light trim and five flags;
 * - the curved end (edges 40 and 41; w04-245, w10-239): dark glazing on the deck with white panels, no pergola;
 * - the glass fronts on the Max Euweplein (edges 60 and 62; w06-134, w08-134).
 */
export function buildHollandCasino(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as {facadeRing: number[][]; surfaces: Surface[]; nativeRing: number[][]; anchorRD: [number, number]; bagId: string};
  const part: PandPart = {pand: fullPand(String(src.bagId)), ring: (spec as {landmarkShare: {ring: [number, number][]}}).landmarkShare.ring};
  const ring = src.facadeRing;
  // Walls above the canal block are the white-tiled storey and the drum; below, dark glazing bands. The hall's radial roof is light grey.
  const isCasino = inPart(src, part);
  addShell(b, {surfaces: src.surfaces, nativeRing: src.nativeRing}, {
    wall: 'stone', roof: 'slate',
    wallFor: s => (!isCasino(s) ? 'brick' : Math.max(...s.rings[0].map(p => p[1])) > 6.5 ? 'concrete' : 'stone'),
    roofFor: s => (Math.min(...s.rings[0].map(p => p[1])) > 18 ? 'concrete' : 'slate'),
  });
  const sink0 = getSink();
  setSink(0.05);

  /** A frame square to the wall at `t`: x runs into the building, extrusion along the wall. */
  const across = (f: Frame, t: number): Frame => ({origin: [f.origin[0] + f.tangent[0] * t, f.origin[1] + f.tangent[1] * t], tangent: [-f.n[0], -f.n[1]], n: [f.tangent[0], f.tangent[1]]});

  /** Ground floor on the deck: glazing with yellow frames, red columns, lattice screens and the red beam. */
  const groundFloor = (f: Frame, len: number, glazed = true, deckH = 0.12, beamH = 0.5) => {
    slab(b, f, len / 2, 0, len + 0.4, deckH, 2.6, 'ochre'); // timber deck over the water (neighbouring edges' decks 4 cm apart in height)
    if (glazed) slab(b, f, len / 2, 0.12, len - 0.1, 2.75, 0.04, 'glass', 0.18);
    for (let t = 0.15; t <= len - 0.1; t += len / Math.max(1, Math.round(len / 1.7))) slab(b, f, t, 0.12, 0.12, 2.75, 0.05, 'gold', 0.24);
    slab(b, f, len / 2, 2.87, len - 0.1, 0.12, 0.05, 'gold', 0.24);
    slab(b, f, len / 2, 0.12, len - 0.1, 0.12, 0.05, 'gold', 0.24);
    const n = Math.max(1, Math.round(len / 3.7)), step = len / n;
    for (let k = 0; k <= n; k++) {
      const t = Math.min(len - 0.15, Math.max(0.15, k * step));
      slab(b, f, t, 0.12, 0.2, 5.75, 0.2, 'red', 0.55); // red steel column
    }
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) * step, w = step - 0.45;
      slab(b, f, t, 3.2, w, 1.6, 0.05, 'ochre', 0.6); // timber lattice screen
      // lattice slats: dark timber, not an opening colour (as 'dark' the openings audit hung them on whichever wall plane its
      // greedy clustering found nearest, and the arm's fronts moved that choice)
      for (let q = 1; q < 8; q++) slab(b, f, t - w / 2 + (w * q) / 8, 3.2, 0.04, 1.6, 0.04, 'green', 0.66);
      slab(b, f, t, 3.95, w, 0.04, 0.04, 'green', 0.66);
      slab(b, f, t, 3.15, w + 0.1, 0.08, 0.1, 'concrete', 0.58); // white frame of the screen
      slab(b, f, t, 4.82, w + 0.1, 0.08, 0.1, 'concrete', 0.58);
    }
    slab(b, f, len / 2, 5.4, len + 0.2, beamH, 0.35, 'red', 0.45); // red beam
  };

  // ---------- Singelgracht front: ground floor, pergola, set-back white storey ----------
  // The white storey's wall is one slanted 3DBAG face 3.7-5.2 m behind ring edges 37/38: frame it from the face itself.
  const ref = ringFrame(ring, 37).f;
  const storey = src.surfaces.filter(s => s.type === 'WallSurface').map(s => {
    const pts = s.rings[0], ys = pts.map(p => p[1]);
    const us = pts.map(p => (p[0] - ref.origin[0]) * ref.tangent[0] + (p[2] - ref.origin[1]) * ref.tangent[1]);
    const vs = pts.map(p => (p[0] - ref.origin[0]) * ref.n[0] + (p[2] - ref.origin[1]) * ref.n[1]);
    return {pts, ys, us, vs};
  }).filter(w => Math.min(...w.ys) < 6.5 && Math.max(...w.ys) > 11.5 && Math.max(...w.vs) < -3 && Math.min(...w.vs) > -6)
    .sort((a, b) => (Math.max(...b.us) - Math.min(...b.us)) - (Math.max(...a.us) - Math.min(...a.us)))[0];
  const ia = storey.us.indexOf(Math.min(...storey.us)), ib = storey.us.indexOf(Math.max(...storey.us));
  const pa = storey.pts[ia], pb = storey.pts[ib], blenS = Math.hypot(pb[0] - pa[0], pb[2] - pa[2]);
  const tS: [number, number] = [(pb[0] - pa[0]) / blenS, (pb[2] - pa[2]) / blenS];
  // outward normal: the side towards ring edge 37 (v increasing)
  const nS: [number, number] = (-tS[1] * ref.n[0] + tS[0] * ref.n[1]) > 0 ? [-tS[1], tS[0]] : [tS[1], -tS[0]];
  const back: Frame = {origin: [pa[0], pa[2]], tangent: tS, n: nS};
  for (const i of [37, 38]) {
    const {f, len} = ringFrame(ring, i);
    // edge 38's 3DBAG wall stops short of the deck's run: its glazing would stand past the wall
    groundFloor(f, len, i !== 38, i === 38 ? 0.16 : 0.12, i === 38 ? 0.56 : 0.5);
    // sloped timber rafters from the beam up towards the set-back storey (3.7 m back at the north end), and a purlin
    for (let t = 0.3; t < len - 0.1; t += 0.9) poly(b, across(f, t - 0.06), 0, 5.9, [[-0.75, 0], [3.3, 2.3], [3.3, 2.5], [-0.75, 0.22]], 0.12, 'ochre');
  }
  const blen = blenS;
  slab(b, back, blen / 2, 8.25, blen, 0.2, 0.25, 'ochre', 0.05);
  // square windows in the white storey (w03-257: five across 20 m)
  const nw = Math.max(1, Math.round(blen / 3.9));
  for (let k = 0; k < nw; k++) {
    const t = ((k + 0.5) * blen) / nw;
    slab(b, back, t, 9.1, 2.1, 1.7, 0.04, 'dark', 0.05); // deep dark-grey reveal (blind review)
    slab(b, back, t, 9.25, 1.7, 1.4, 0.04, 'glass', 0.09);
    slab(b, back, t, 9.25, 0.08, 1.4, 0.04, 'dark', 0.13);
  }
  // thin dark coping with a row of red lights (w03-257)
  slab(b, back, blen / 2, 11.85, blen - 0.1, 0.25, 0.14, 'dark', 0.05);
  for (let t = 0.6; t < blen - 0.4; t += 1.2) slab(b, back, t, 11.6, 0.18, 0.12, 0.06, 'red', 0.19);
  // the sign and the five flags along the canal front
  const mid = blen / 2;
  // bronze letters standing on the roof edge (bronze tagged #b08a4a, material-slot-tags.ts)
  letters(b, back, 'HOLLAND', mid - 2.9, 12.35, 0.05, 0.12, 0.08, 'bronze');
  letters(b, back, 'CASINO', mid + 2.5, 12.35, 0.05, 0.12, 0.08, 'bronze');
  poly(b, back, mid + 5.6, 12.35, [[-0.5, 0], [0.5, 0], [0.65, 0.4], [0, 0.8], [-0.65, 0.4]], 0.08, 'red', 0.05); // logo
  // five tall poles on the roof edge, about 6 m, each with a long white banner (about 1 x 2.6 m) and a coloured corner
  for (let k = 0; k < 5; k++) {
    const t = mid + (k - 2) * 4.0;
    slab(b, back, t, 12.1, 0.12, 6.6, 0.12, 'concrete', 0.3);
    slab(b, back, t + 0.62, 15.9, 1.1, 2.6, 0.03, 'concrete', 0.34);
    slab(b, back, t + 0.85, 17.95, 0.55, 0.5, 0.03, k % 2 ? 'red' : 'blue', 0.38); // coloured corner of each banner
  }

  // ---------- the curved end (w04-245, w10-239): the pergola stops before it. Dark glazing on the deck between dark
  // mullions, with tall white panels. (The upper storey's set-back facets carry no windows: dark-framed windows there
  // and a full-height glazing tier both failed the openings gate on the curve's narrow 3DBAG facets.) ----------
  for (const i of [40, 41]) {
    const {f, len} = ringFrame(ring, i);
    const dh = i === 40 ? 0.17 : 0.22;
    slab(b, f, len / 2, 0, len + 0.4, dh, 2.6, 'ochre'); // the deck runs on
    // dark glazing ('glass': drawn as a 'dark' slab it hangs off the curve's facets for the openings audit)
    slab(b, f, len / 2, dh, len - 0.1, 2.75, 0.04, 'glass', 0.18);
    for (let t = 0.6; t <= len - 0.6; t += (len - 1.2) / Math.max(1, Math.round(len / 1.7))) slab(b, f, t, dh, 0.12, 2.75, 0.05, 'dark', 0.24);
    for (const t of [len * 0.3, len * 0.7]) slab(b, f, t, dh, 0.6, 2.75, 0.05, 'concrete', 0.32); // tall white panels
  }

  // ---------- glass fronts on the Max Euweplein ----------
  for (const i of [60, 62]) {
    const {f, len} = ringFrame(ring, i);
    slab(b, f, len / 2, 0, len - 0.1, 3.2, 0.12, 'stone'); // grey ground storey
    slab(b, f, len / 2, 0.3, len - 0.8, 2.6, 0.04, 'glass', 0.16);
    slab(b, f, len / 2, 3.4, len - 0.2, 12.0, 0.04, 'glass', 0.08);
    for (let t = 0.15; t <= len; t += (len - 0.3) / Math.round(len / 1.6)) slab(b, f, t, 3.4, 0.1, 12.0, 0.05, 'frame', 0.16);
    for (let y = 3.4; y <= 15.5; y += 3.0) slab(b, f, len / 2, y, len - 0.2, 0.1, 0.05, 'frame', 0.21);
  }
  restArm(b, ring);
  setSink(sink0);
}

/**
 * The north-east arm (the rest of the pand), t from the viewer's left. Edge 6 (28.3 m, facing the Weteringschans side of
 * the plein; recording_2025-07-14_05-25-22_01977 from 68 m, _01963 close up): from the north-east end a grey stone
 * building with a big arched entrance, then a brick house with cream stucco dressings and iron balconies, then a banded
 * brick corner house with round-arched windows over a shopfront. Edges 4 and 5 face the courtyard (no panorama): plain
 * brick with dark windows. Edges 2 and 3 are the high party walls against the casino drum.
 */
function restArm(b: BuildingTools, ring: number[][]) {
  setSink(0.12, true);
  const st = storeysUnder(20.9, {ground: 0.4, floor: 3.6, winH: 2.4, attic: 2.2});
  const base = {frame: 'dark', glass: 'glass', sill: 'sandstone', door: 'dark', stone: 'greyBrick', rail: 'dark', cornice: 'sandstone'} as const;
  {
    const {f} = ringFrame(ring, 6);
    // two brick houses over a grey rusticated stone basement, raised ground floors reached by stoops, cream stucco bands and
    // rusticated cream pilasters, an iron balcony over each porch (_01963, review sheet 2025 pano)
    for (const [t0, t1] of [[0.0, 12.0], [12.0, 24.3]]) {
      rowFront(b, f, {...base, t0, t1, top: 20.5, bays: 4, winW: 1.55, storeys: storeysUnder(20.5, {ground: 1.5, floor: 3.6, winH: 2.9, attic: 1.8}), plinth: {h: 1.5, colour: 'greyBrick'}, bands: 'sandstone', balconies: [1], doors: [{bay: 0, stoop: 1.5}]});
    }
    for (const t of [0.5, 12.0, 23.8]) slab(b, f, t, 1.5, 0.9, 17.4, 0.3, 'sandstone');
    // the cream-tiled gateway into the courtyard at the south-west end, in a granite frame (_01963: "max inrijhoogte")
    const g0 = 24.3, g1 = 28.3, gm = (g0 + g1) / 2;
    slab(b, f, gm, 0, 3.3, 3.7, 0.12, 'greyBrick', 0.06);
    slab(b, f, gm, 0, 2.9, 3.5, 0.1, 'dark', 0.12);
    rowFront(b, f, {...base, t0: g0, t1: g1, top: 20.2, bays: 1, skin: 'pink', storeys: storeysUnder(20.2, {ground: 1.5, floor: 3.5, winH: 2.2, attic: 2.0}).slice(1).map(x => ({...x})), balconies: [0, 1], margin: 0.8, winW: 1.6, cornice: 'sandstone', frame: 'dark'});
  }
  for (const [e, bays] of [[4, 7], [5, 4]] as const) {
    const {f, len} = ringFrame(ring, e);
    rowFront(b, f, {...base, t0: 0.3, t1: len - 0.3, top: 20.4, bays, storeys: storeysUnder(20.4, {ground: 0.3, floor: 3.4, winH: 2.0, attic: 1.5}), cornice: undefined, sill: undefined});
  }
}
