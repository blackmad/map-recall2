import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, ledgeStrip, poly, ringFrame, setSink, getSink, slab, type Frame} from './nearbar-kit';
import {inPart} from './pand-part-shell';
import {frameCoords} from './shell-gable-fit';
import {rowFront, storeysUnder} from './row-front';
import {fullPand, type PandPart} from '../../src/canalRecall/landmarks/pandParts';
import source from './handelsbank-singel-250-footprints.json';
import spec from './handelsbank-singel-250-spec.json';

/**
 * FORMER NEDERLANDSCH-INDISCHE HANDELSBANK, Singel 250 (Van Rossem & Vuyk 1910-1912, extended south by A.D.N. van Gendt
 * 1925; nl.wikipedia Singel 250, CC BY-SA 4.0). The bank stands on part of BAG pand 0363100012167627: the pand also holds
 * the canal houses on the Herengracht (nos. 229-233) and their backs, the white stucco house Singel 258 and the courtyard
 * walls between them. Since 2026-11-20 (landmarks r8 lane) the model draws the WHOLE pand: the full 3DBAG LoD2.2 shell,
 * the bank's faces in sandstone and the houses in their own brick, each house front laid out by row-front.ts from the
 * 2024-2025 panoramas (b_20241203 / recording_2025-06-16 Herengracht, w11-102 Singel 258, w05-10 the north side). Fronts read from rectified Gemeente Amsterdam panoramas (CC BY 4.0, 50 px/m):
 * - Raadhuisstraat (ring edge 36, 25.7 m): TMX7316010203-002538_pano_0000_001765;
 * - Singel (edges 35 and 31): TMX7316010203-002865_pano_0020_000019 and _000024, TMX7316010203-000354_pano_0001_000138.
 * One system on both fronts:
 * - a rusticated sandstone ground floor over a plinth with barred cellar lights;
 * - giant Corinthian pilasters through the two upper floors, with festoon panels between the windows;
 * - entablature, a dentil cornice and a balustrade with urns in front of the slate mansard;
 * - the arched double-door entrance at the step in the Singel front.
 */
export function buildHandelsbank(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as {facadeRing: number[][]; surfaces: Surface[]; nativeRing: number[][]; anchorRD: [number, number]; bagId: string};
  const part: PandPart = {pand: fullPand(String(src.bagId)), ring: (spec as {landmarkShare: {ring: [number, number][]}}).landmarkShare.ring};
  // The bank's share of the pand's 3DBAG shell, clipped to the part and closed by party walls on the cut line
  // (the rest, at its own 15.8 m, stands against them). Flat tops over 21.8 m are the bank's lead-grey decks.
  const isBank = inPart(src, part);
  const ring0 = src.facadeRing;
  // Wall colour per rest edge (the house the wall belongs to); faces off every listed edge are courtyard brick
  const restWall = (sf: Surface) => {
    const pts = sf.rings[0], cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[2], 0) / pts.length;
    for (const H of REST) {
      const {f, len} = ringFrame(ring0, H.e);
      const {t, d} = frameCoords(f, cx, cz);
      if (t > -0.2 && t < len + 0.2 && Math.abs(d) < 0.5) return H.wall;
    }
    return 'brick';
  };
  addShell(b, {surfaces: src.surfaces, nativeRing: src.nativeRing}, {
    wall: 'sandstone', roof: 'slate',
    wallFor: sf => (isBank(sf) ? 'sandstone' : restWall(sf)),
    roofFor: sf => (isBank(sf) && Math.min(...sf.rings[0].map(p => p[1])) > 21.8 ? 'concrete' : 'slate'),
  });
  restFronts(b, ring0);

  const sink0 = getSink();
  setSink(0.05);
  const K = 1.03; // photo heights to the 3DBAG front (balustrade top 18.4 m read, 19.0 m in the shell)
  const Y = (v: number) => v * K;
  // layers 4 cm apart: rustication 0.12, joints 0.16, frames 0.16-0.2, glass 0.2-0.24, bars 0.24-0.28
  const win = (fr: Frame, t: number, y0: number, y1: number, w: number, out: number) => {
    slab(b, fr, t, y0 - 0.04, w + 0.1, y1 - y0 + 0.08, 0.04, 'frame', out);
    slab(b, fr, t, y0, w - 0.08, y1 - y0, 0.04, 'glass', out + 0.04);
    slab(b, fr, t, y0, 0.07, y1 - y0, 0.04, 'frame', out + 0.08); // mullion
    slab(b, fr, t, y0 + (y1 - y0) * 0.7, w - 0.08, 0.07, 0.04, 'frame', out + 0.08); // transom
    for (const k of [1, 2]) slab(b, fr, t, y0 + (y1 - y0) * (0.7 + 0.1 * k), w - 0.08, 0.03, 0.04, 'frame', out + 0.08); // small panes above
  };
  /** One front: bays between pilasters at `pil` (t), windows centred between, entrance bay skipped. */
  const front = (i: number, pil: number[], cellar: boolean, skipBay = -1) => {
    const {f, len} = ringFrame(src.facadeRing, i);
    // plinth and rusticated ground floor (block pattern)
    slab(b, f, len / 2, 0, len - 0.12, Y(2.2), 0.16, 'stone');
    slab(b, f, len / 2, Y(2.2), len - 0.12, Y(6.6) - Y(2.2), 0.12, 'stone'); // joint colour behind the courses
    // rustication: block courses 0.45 m proud of grey joints 0.1 m deep (blind review: the joints did not read)
    // (strips, not slabs: a full-length slab per course is a wall plane to the openings gate and buries the cellar lights)
    for (let y = Y(2.2); y < Y(6.5) - 0.2; y += 0.47) ledgeStrip(b, f, len / 2, y, len - 0.18, Math.min(0.37, Y(6.6) - y - 0.02), 0.1, 'sandstone', 0.12);
    // string course over the ground floor
    slab(b, f, len / 2, Y(6.6), len + 0.1, Y(7.0) - Y(6.6), 0.5, 'sandstone');
    const bays = pil.slice(0, -1).map((p, k) => (p + pil[k + 1]) / 2);
    bays.forEach((t, k) => {
      const w = Math.min(1.5, pil[k + 1] - pil[k] - 1.1);
      if (k !== skipBay) {
        win(f, t, Y(2.5), Y(6.2), w + 0.2, 0.26); // ground windows larger than the upper ones (w01-10)
        slab(b, f, t, Y(2.35), w + 0.5, 0.15, 0.2, 'stone', 0.22); // sill
        if (cellar) {
          slab(b, f, t, Y(0.4), w - 0.1, Y(1.2), 0.04, 'dark', 0.2);
          for (let q = -2; q <= 2; q++) slab(b, f, t + q * (w - 0.1) / 5, Y(0.4), 0.04, Y(1.2), 0.04, 'bronze', 0.26); // grille bars
        }
      }
      // upper floors: two windows, festoon panel between, sills and cornice heads
      win(f, t, Y(7.5), Y(10.2), w, 0.06);
      win(f, t, Y(11.7), Y(14.4), w, 0.06);
      slab(b, f, t, Y(7.35), w + 0.3, 0.15, 0.16, 'sandstone');
      slab(b, f, t, Y(10.25), w + 0.3, 0.14, 0.14, 'sandstone');
      const pw = pil[k + 1] - pil[k] - 1.0;
      slab(b, f, t, Y(10.45), pw, Y(11.45) - Y(10.45), 0.14, 'stone'); // festoon panel, the full bay, darker than the wall
      poly(b, f, t, Y(10.6), [[-w / 2 + 0.1, 0.6], [-w / 4, 0.15], [0, 0.05], [w / 4, 0.15], [w / 2 - 0.1, 0.6], [w / 2 - 0.15, 0.7], [0, 0.25], [-w / 2 + 0.15, 0.7]], 0.08, 'sandstone', 0.12); // swag
      slab(b, f, t, Y(11.55), w + 0.3, 0.14, 0.14, 'sandstone');
      slab(b, f, t, Y(14.45), w + 0.25, 0.18, 0.16, 'sandstone'); // window cornice
    });
    // giant pilasters with Corinthian capitals
    for (const p of pil) {
      // blind review: 0.25-0.35 m proud, a bulky capital about 1.2 m tall and wider than the shaft
      slab(b, f, p, Y(7.0), 0.9, Y(14.3) - Y(7.0), 0.42, 'sandstone');
      slab(b, f, p, Y(7.0), 1.05, 0.4, 0.5, 'sandstone'); // base
      slab(b, f, p, Y(14.3), 1.15, 0.4, 0.5, 'sandstone'); // capital, lower bell
      slab(b, f, p, Y(14.3) + 0.4, 1.3, 0.4, 0.58, 'sandstone'); // capital, volutes
      slab(b, f, p, Y(14.3) + 0.8, 1.45, Y(15.3) - Y(14.3) - 0.8, 0.66, 'sandstone'); // abacus, up to the frieze
    }
    // entablature, dentil cornice, balustrade with dies and urns
    slab(b, f, len / 2, Y(15.3), len, Y(16.4) - Y(15.3), 0.34, 'sandstone');
    slab(b, f, len / 2, Y(16.4), len + 0.4, 0.3, 0.55, 'sandstone');
    for (let t = 0.25; t < len - 0.1; t += 0.35) slab(b, f, t, Y(16.4) - 0.14, 0.14, 0.14, 0.36, 'stone'); // dentils
    slab(b, f, len / 2, Y(16.4) + 0.3, len + 0.6, Y(17.3) - Y(16.4) - 0.3, 0.75, 'sandstone');
    slab(b, f, len / 2, Y(17.3), len - 0.1, 0.18, 0.5, 'sandstone'); // balustrade plinth
    for (let t = 0.3; t < len - 0.2; t += 0.32) slab(b, f, t, Y(17.3) + 0.18, 0.13, 0.62, 0.16, 'sandstone', 0.17); // balusters
    slab(b, f, len / 2, Y(17.3) + 0.8, len - 0.1, 0.2, 0.5, 'sandstone'); // rail
    for (const p of pil) slab(b, f, p, Y(17.3), 0.55, 1.12, 0.58, 'sandstone'); // dies over the pilasters, standing above the rail
    return {f, len};
  };

  // Raadhuisstraat: nine pilasters (w01-10), t from the Singel corner.
  const north = front(36, [0.55, 3.35, 6.2, 9.1, 12.0, 14.95, 17.85, 20.75, 23.65], false);
  // urns on the corner dies and the middle (w01-10 shows finials over the 3rd and 7th dies, 2022 crop)
  for (const t of [6.2, 17.85]) { slab(b, north.f, t, Y(17.3) + 1.0, 0.35, 0.45, 0.35, 'sandstone', 0.08); slab(b, north.f, t, Y(17.3) + 1.45, 0.18, 0.25, 0.18, 'sandstone', 0.17); }
  // Singel, north half (w02-104): eight bays to the corner.
  front(35, [0.6, 3.35, 6.1, 8.85, 11.6, 14.35, 17.1, 19.85, 22.1], true);
  // Singel, south half (w03-103): seven window bays, the entrance in the last bay by the step.
  const south = front(31, [0.6, 3.2, 5.8, 8.4, 11.0, 13.5, 16.1, 18.7, 20.4], true, 7);
  // entrance: arched double door in a stone surround over three steps (w03-103 2017, right edge)
  const te = 19.55;
  archBand(b, south.f, te, Y(0.6), 2.3, Y(5.8) - Y(0.6), 0.32, 0.2, 'sandstone', 0.16);
  archSlab(b, south.f, te, Y(0.6), 1.7, Y(5.6) - Y(0.6), 0.04, 'dark', 0.26); // clear of the rustication strips (front 0.22)
  slab(b, south.f, te, Y(0.6), 1.5, Y(3.4) - Y(0.6), 0.04, 'frame', 0.3);
  slab(b, south.f, te, Y(0.6), 0.06, Y(3.4) - Y(0.6), 0.04, 'dark', 0.34);
  archSlab(b, south.f, te, Y(3.55), 1.5, Y(5.45) - Y(3.55), 0.04, 'glass', 0.3, 6); // fanlight
  for (let k = 0; k < 3; k++) slab(b, south.f, te, 0.2 * k, 2.6 - 0.3 * k, 0.2, 0.75 - 0.25 * k, 'stone', 0.2);
  setSink(sink0);
}

type RestHouse = {e: number; t?: [number, number]; wall: string; top: number; bays: number; doors?: number[]; stoop?: number; plinth?: number; floor?: number; cornice?: boolean};
/**
 * The rest of the pand, per ring edge (t from the viewer's left). Heights are the 3DBAG wall tops along each edge; bays
 * and doors read from the 2024-2025 panoramas: brown brick Herengracht houses with white sashes, stone stoops and raised
 * basements (no. 233 and its neighbours: b_20241203_0939 sphere 00352, recording_2025-06-16_04-42-37_01130); the
 * dark-painted brick neighbour (w09-280, 2025); the white stucco Singel 258 (w11-102); the north side's brown brick
 * (w05-10). Courtyard walls nobody photographs get a plain brick window grid.
 */
const REST: RestHouse[] = [
  {e: 22, wall: 'brick', top: 12.1, bays: 4, doors: [0], stoop: 1.1, plinth: 1.1, cornice: true},
  {e: 18, t: [0.9, 7.9], wall: 'brick', top: 11.4, bays: 3, doors: [0], stoop: 1.1, plinth: 1.1, cornice: true},
  {e: 26, wall: 'greyBrick', top: 13.3, bays: 6, doors: [0, 3], stoop: 1.1, plinth: 1.1, cornice: true},
  {e: 24, wall: 'greyBrick', top: 7.3, bays: 2, plinth: 1.1},
  {e: 7, wall: 'brick', top: 4.6, bays: 2, floor: 3.2},
  {e: 27, wall: 'pink', top: 12.4, bays: 1, doors: [0], stoop: 0.9, plinth: 0.9},
  {e: 14, wall: 'brick', top: 5.5, bays: 3},
  {e: 4, wall: 'brick', top: 18.0, bays: 2, plinth: 1.0, cornice: true},
  {e: 17, t: [0.3, 4.6], wall: 'greyBrick', top: 12.0, bays: 2, plinth: 1.0},
  {e: 3, wall: 'brick', top: 9.1, bays: 10},
  {e: 5, t: [0, 12.5], wall: 'brick', top: 13.0, bays: 4},
];

function restFronts(b: BuildingTools, ring: number[][]) {
  const sink0 = getSink();
  setSink(0.12, true);
  for (const H of REST) {
    const {f, len} = ringFrame(ring, H.e);
    const storeys = storeysUnder(H.top, {ground: H.plinth ?? 0.3, floor: H.floor ?? 3.6, winH: 2.8, attic: 0.7});
    rowFront(b, f, {
      t0: H.t?.[0] ?? 0, t1: H.t?.[1] ?? len, top: H.top, bays: H.bays, storeys, margin: 0.5, winW: Math.min(1.7, ((H.t?.[1] ?? len) - (H.t?.[0] ?? 0) - 1) / H.bays * 0.74),
      plinth: H.plinth ? {h: H.plinth, colour: 'stone'} : undefined,
      doors: (H.doors ?? []).map(bay => ({bay, stoop: H.stoop})),
      cornice: H.cornice ? 'white' : undefined,
      frame: 'white', glass: 'glass', sill: 'stone', door: 'dark', stone: 'stone',
    });
  }
  setSink(sink0);
}
