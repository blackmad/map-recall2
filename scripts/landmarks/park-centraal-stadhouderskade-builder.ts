import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, letters, poly, ringFrame, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './park-centraal-stadhouderskade-footprints.json';

/**
 * PARK HOTEL BLOCK, Stadhouderskade 25 (BAG pand 0363100012233471, BAG year 1930): one pand holding three fronts on the
 * Singelgracht corner by the Rijksmuseum. Massing: the 3DBAG LoD2.2 shell (park-centraal-stadhouderskade-footprints.json,
 * bag-shell-prepare.ts).
 *  - Park Centraal (edge 0, t 0-26.9): the hotel's concrete frame grid, seven bays at 3.5 m and a narrow end bay, five
 *    rows of recessed balconies with glass rails over a glazed first floor and a deep canopy fascia lettered "Park
 *    Centraal"; a glazed set-back top storey with seven dark roof boxes.
 *  - MOMO, the neo-Renaissance corner (edge 0 t 26.9-31.2, edge 2, the round corner tower on edges 4-8, edge 11 on the
 *    Hobbemastraat): red-brown brick ground storey with black MOMO awnings and a white block band; a dark painted brick
 *    upper front with arched first-floor windows in white voussoir rings and iron balconies, alternating flat-hooded and
 *    round-headed second-floor windows between rusticated white pilasters, a console frieze and cornice, a slate mansard
 *    with white pedimented dormers, and a copper dome with a lantern on the corner tower.
 *  - The Hobbemastraat range (edge 13): dark brick over a grey stone shop plinth, five stacks of cantilevered concrete
 *    balconies with iron rails and paired French doors, thin white sill bands, an attic window row and an overhanging
 *    flat roof.
 * The walls on the courtyard side (edges 22-31, 5.9-6.9 m in the 3DBAG) stand behind the P.C. Hooftstraat houses: their
 * brief crops show the neighbours, so they are plain.
 *
 * Read from rectified Gemeente Amsterdam panoramas (CC BY 4.0): w02-1 TMX7316010203-001675_pano_0000_002449 (2020) and
 * its 2025 second view (hotel), w04-1 TMX7316010203-002548_pano_0000_000344 (2022) and w06-246
 * b_20241211_0838_Track07_Sphere_00080 (2024) (MOMO), w01-246 TMX7316010203-002920_pano_0000_000143 (2023) (Hobbemastraat).
 * Heights: storey lines from the crops scaled to the 3DBAG wall tops (hotel 22.3 m, MOMO cornice 17.8 m, range 17.3 m).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const TOWER: [number, number] = [-34.9, -25.3]; // centre of the round corner tower (fit to ring vertices 4-9, r 3.0 m)

export function buildParkCentraalStadhouderskade(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as Src;
  const ring = src.facadeRing;
  const e0 = ringFrame(ring, 0).f;
  const HOTEL_T = 26.9;
  /** Position of a point along edge 0 (t) and out of it (o). */
  const along0 = (x: number, z: number) => ({t: (x - e0.origin[0]) * e0.tangent[0] + (z - e0.origin[1]) * e0.tangent[1], o: (x - e0.origin[0]) * e0.n[0] + (z - e0.origin[1]) * e0.n[1]});
  const pts = (s: Surface) => s.rings[0] as number[][];
  const nearTower = (s: Surface) => { const p = pts(s); const cx = p.reduce((a, q) => a + q[0], 0) / p.length, cz = p.reduce((a, q) => a + q[2], 0) / p.length; return Math.hypot(cx - TOWER[0], cz - TOWER[1]) < 3.4; };
  // the hotel's frame front is drawn by hand with the balconies recessed into it, so its shell wall goes
  const hotelFront = (s: Surface) => s.type === 'WallSurface' && pts(s).every(p => { const a = along0(p[0], p[2]); return a.t > -0.05 && a.t < HOTEL_T + 0.05 && Math.abs(a.o) < 0.7; }) && Math.min(...pts(s).map(p => p[1])) < 1;
  // the tower's faceted 3DBAG cap and lantern go; a turned copper dome replaces them
  const towerCap = (s: Surface) => nearTower(s) && (s.type === 'RoofSurface' ? Math.min(...pts(s).map(p => p[1])) > 23 : Math.min(...pts(s).map(p => p[1])) > 25.4);
  addShell(b, src as never, {
    wall: 'greyBrick', roof: 'slate',
    skip: s => hotelFront(s) || towerCap(s),
    wallFor: s => {
      const p = pts(s), y0 = Math.min(...p.map(q => q[1])), y1 = Math.max(...p.map(q => q[1]));
      const cx = p.reduce((a, q) => a + q[0], 0) / p.length, cz = p.reduce((a, q) => a + q[2], 0) / p.length;
      if (y1 < 7.2) return 'red'; // the courtyard block
      if (cx > -8.4 && cz < -9.5) return y0 > 22 && y1 < 25.4 ? 'frame' : 'concrete'; // hotel: glazed top storey, concrete flanks
      if (cz > -6.5) return 'red'; // the Hobbemastraat range
      return 'greyBrick';
    },
  });
  const sink0 = getSink();
  setSink(0.05, true);

  // ================= Park Centraal (edge 0, t 0-26.9) =================
  {
    const f = e0;
    const IN = 1.3, GIN = 2.2; // balcony recess and ground-floor recess behind the frame front
    const PIERS = [0.22, 3.6, 7.1, 10.7, 14.3, 17.9, 21.3, 24.9];
    const PW = 0.42;
    const FLOORS = [7.0, 9.95, 12.9, 15.85, 18.8];
    const TOP0 = 21.75, TOP = 22.25;
    // ground floor: recessed glazing, a dark car entrance on the east, the deep canopy fascia
    slab(b, f, 4.25, 0, 8.1, 3.85, 0.05, 'dark', -GIN - 0.05);
    slab(b, f, 17.1, 0, 17.6, 3.85, 0.05, 'glass', -GIN - 0.05);
    for (let t = 8.6; t < 25.8; t += 2.85) slab(b, f, t, 0, 0.1, 3.85, 0.1, 'sandstone', -GIN);
    slab(b, f, 13.075, 3.85, 25.25, 1.35, GIN + 0.05, 'concrete', -GIN - 0.05); // stops short of the end piers
    letters(b, f, 'PARK', 14.4, 4.45, 0.0, 0.055, 0.05, 'gold');
    letters(b, f, 'CENTRAAL', 14.4, 3.88, 0.0, 0.05, 0.05, 'gold', 0.055);
    // the upper back wall: curtained glazing (pale) with white frames
    slab(b, f, 12.875, 5.2, 25.75, TOP - 5.2, 0.05, 'frame', -IN - 0.05);
    for (let i = 0; i < PIERS.length - 1; i++) {
      const a = PIERS[i] + PW / 2, z = PIERS[i + 1] - PW / 2, n = Math.max(1, Math.round((z - a) / 1.15));
      for (let k = 1; k < n; k++) slab(b, f, a + ((z - a) * k) / n, 5.2, 0.07, TOP0 - 5.2, 0.1, 'sandstone', -IN);
    }
    // narrow end bay and the brick end pier on the MOMO side
    slab(b, f, 26.3, 0, 1.2, TOP, GIN, 'concrete', -GIN);
    // the frame: piers full height, slabs between them (fronts 5 cm behind the piers)
    for (const t of PIERS) slab(b, f, t, t < 1 ? 0 : 5.2, PW, TOP - (t < 1 ? 0 : 5.2), t < 1 ? GIN : IN, 'concrete', t < 1 ? -GIN : -IN);
    const bays: [number, number][] = [];
    for (let i = 0; i < PIERS.length - 1; i++) bays.push([PIERS[i], PIERS[i + 1]]);
    bays.push([PIERS[PIERS.length - 1], 25.7]);
    for (const [a, z] of bays) {
      for (const y of FLOORS) slab(b, f, (a + z) / 2, y - 0.3, z - a, 0.3, IN - 0.05, 'concrete', -IN);
      slab(b, f, (a + z) / 2, TOP0, z - a, TOP - TOP0, IN - 0.05, 'concrete', -IN);
      // glass balcony rails with a rust-red handrail, on each balcony floor
      const ra = a + PW / 2 + 0.03, rz = z - PW / 2 - 0.03;
      for (const y of FLOORS) {
        slab(b, f, (ra + rz) / 2, y, rz - ra, 0.98, 0.04, 'canopyGlass', -0.3);
        slab(b, f, (ra + rz) / 2, y + 0.98, rz - ra, 0.06, 0.08, 'ochre', -0.32);
      }
    }
    // set-back top storey: the glass terrace rail on the roof edge, seven dark roof boxes on its roof (25.2 m)
    slab(b, f, 12.6, TOP - 0.05, 24.8, 1.05, 0.04, 'canopyGlass', -0.45);
    for (const t of [2.7, 6.1, 9.4, 12.7, 16.1, 19.4, 22.8]) slab(b, f, t, 25.15, 2.0, 0.95, 1.5, 'bronze', -2.8);
  }

  // ================= MOMO, the neo-Renaissance corner =================
  /** One MOMO front: bays at `bays` (centres), alternating wide/narrow second-floor windows, wall top `top`. */
  const momo = (f: Frame, len: number, bays: number[], top: number, o: {from?: number; to?: number; wideFirst?: boolean; cornice?: boolean; windows?: boolean; awnings?: boolean} = {}) => {
    const t0 = o.from ?? 0.05, t1 = o.to ?? len - 0.05, mid = (t0 + t1) / 2, W = t1 - t0;
    // ground storey: grey stone base, red-brown brick, a white block band, the cream ledge
    slab(b, f, mid, 0, W, 0.7, 0.06, 'stone');
    slab(b, f, mid, 4.75, W, 0.85, 0.05, 'brick');
    const gaps = bays.map(c => [c - 1.17, c + 1.17]);
    let p = t0;
    for (const [a, z] of [...gaps, [t1, t1]]) { if (a - p > 0.05) slab(b, f, (p + a) / 2, 0.7, a - p, 4.05, 0.05, 'brick'); p = z; }
    for (const c of bays) {
      slab(b, f, c, 4.82, 1.3, 0.45, 0.1, 'sandstone');
      for (const s of [-1, 1]) slab(b, f, c + s * 1.08, 4.88, 0.28, 0.33, 0.1, 'sandstone');
      // shop window, black awning box lettered MOMO, the stone pedestal between windows
      slab(b, f, c, 0.7, 2.3, 4.0, 0.05, 'glass');
      if (o.awnings !== false) {
        slab(b, f, c, 2.0, 2.3, 0.55, 0.75, 'dark', 0.06);
        slab(b, f, c, 2.6, 2.3, 2.0, 0.45, 'dark', 0.06);
        letters(b, f, 'MOMO', c, 3.25, 0.51, 0.06, 0.04, 'sandstone');
      } else {
        // the Hobbemastraat side: flat black MOMO boards over the windows (w06-246)
        slab(b, f, c, 3.9, 2.3, 0.75, 0.05, 'bronze', 0.06);
        letters(b, f, 'MOMO', c, 4.05, 0.11, 0.06, 0.04, 'sandstone');
      }
    }
    // the long white blocks over the brick piers (between bays and at the ends)
    const piers = [bays[0] - 1.8, ...bays.slice(1).map((c, i) => (bays[i] + c) / 2), bays[bays.length - 1] + 1.8];
    for (const t of piers) {
      const a = Math.max(t0, t - 0.45), z = Math.min(t1, t + 0.45);
      if (z - a > 0.2) slab(b, f, (a + z) / 2, 4.82, z - a, 0.45, 0.1, 'sandstone');
    }
    for (let i = 0; i < bays.length - 1; i++) slab(b, f, (bays[i] + bays[i + 1]) / 2, 0, 0.8, 1.2, 0.11, 'stone');
    slab(b, f, mid, 5.6, W, 0.75, 0.3, 'sandstone');
    // iron balconies on cream slabs under the arched windows
    if (o.windows !== false) for (const c of bays) {
      slab(b, f, c, 6.2, 2.7, 0.2, 0.65, 'sandstone');
      slab(b, f, c, 7.32, 2.6, 0.06, 0.06, 'bronze', 0.56);
      slab(b, f, c, 6.5, 2.6, 0.05, 0.05, 'bronze', 0.56);
      for (let k = 0; k <= 12; k++) slab(b, f, c - 1.27 + (k * 2.54) / 12, 6.4, 0.025, 0.92, 0.025, 'bronze', 0.57);
      for (const s of [-1, 1]) slab(b, f, c + s * 1.32, 6.4, 0.04, 0.95, 0.55, 'bronze', 0.03);
    }
    // first floor: arched French windows in white voussoir rings, iron balconies on cream slabs, impost band between
    if (o.windows !== false) for (const c of bays) {
      archSlab(b, f, c, 6.35, 2.0, 4.35, 0.05, 'glass');
      slab(b, f, c, 6.35, 0.07, 3.2, 0.1, 'sandstone');
      slab(b, f, c, 9.55, 2.0, 0.08, 0.1, 'sandstone');
      archBand(b, f, c, 8.75, 2.6, 2.3, 0.3, 0.1, 'sandstone');
      slab(b, f, c, 10.55, 0.42, 0.6, 0.15, 'sandstone');
    }
    for (let i = -1; i < bays.length; i++) {
      const a = i < 0 ? t0 : bays[i] + 1.36, z = i + 1 < bays.length ? bays[i + 1] - 1.36 : t1;
      if (z - a > 0.1) slab(b, f, (a + z) / 2, 9.5, z - a, 0.2, 0.08, 'sandstone');
    }
    slab(b, f, mid, 11.45, W, 0.5, 0.14, 'sandstone');
    // second floor: flat-hooded wide windows and round-headed narrow ones, alternating, white aprons; rusticated pilasters
    if (o.windows !== false) bays.forEach((c, i) => {
      const wide = (i % 2 === 0) === (o.wideFirst ?? true);
      if (wide) {
        slab(b, f, c, 11.95, 2.6, 0.55, 0.08, 'sandstone');
        slab(b, f, c, 12.5, 2.4, 2.85, 0.05, 'white');
        slab(b, f, c, 12.6, 2.0, 2.65, 0.1, 'glass');
        slab(b, f, c, 12.6, 0.06, 2.65, 0.15, 'sandstone');
        slab(b, f, c, 14.4, 2.0, 0.06, 0.15, 'sandstone');
        slab(b, f, c, 15.35, 2.8, 0.25, 0.2, 'sandstone');
        slab(b, f, c, 15.6, 1.4, 0.2, 0.12, 'sandstone');
      } else {
        slab(b, f, c, 11.95, 2.2, 0.55, 0.08, 'sandstone');
        archSlab(b, f, c, 12.5, 2.0, 3.1, 0.05, 'white');
        archSlab(b, f, c, 12.6, 1.6, 2.85, 0.1, 'glass');
        slab(b, f, c, 12.6, 0.06, 2.0, 0.15, 'sandstone');
        slab(b, f, c, 14.6, 0.36, 0.95, 0.14, 'sandstone', 0.01);
      }
    });
    for (let i = 0; i <= bays.length; i++) {
      const t = i === 0 ? bays[0] - 1.8 : i === bays.length ? bays[bays.length - 1] + 1.8 : (bays[i - 1] + bays[i]) / 2;
      if (t < t0 + 0.3 || t > t1 - 0.3) continue;
      for (let y = 12.05, k = 0; y < 15.6; y += 0.45, k++) slab(b, f, t + (k % 2 ? 0.08 : -0.08), y, k % 2 ? 0.34 : 0.5, 0.24, 0.08, 'sandstone');
    }
    // console frieze and cornice
    if (o.cornice !== false) {
      slab(b, f, mid, 16.15, W, 0.18, 0.1, 'sandstone');
      for (let t = t0 + 0.35; t < t1 - 0.2; t += 0.9) slab(b, f, t, 16.33, 0.2, top - 0.5 - 16.33, 0.25, 'sandstone');
      slab(b, f, mid, top - 0.5, W, 0.45, 0.45, 'sandstone');
    }
  };
  // edge 0's MOMO bay (t 26.9-31.2, wall top 16.2: no frieze there)
  {
    const {f, len} = ringFrame(ring, 0);
    momo(f, len, [29.05], 16.2, {from: 27.0, to: len - 0.05, cornice: false, windows: false});
    // above 7.5 m this bay's 3DBAG wall is a 1.4 m piece turned 9 degrees and set 0.26-0.5 m back (x -8.84..-10.23):
    // its arched and second-floor windows go on that piece, narrowed to fit, with the iron balcony in front
    const p0: [number, number] = [-8.844, -27.681], p1: [number, number] = [-10.233, -27.462];
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), tg: [number, number] = [(p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L];
    const g: Frame = {origin: p0, tangent: tg, n: [-tg[1], tg[0]]};
    const c = L / 2;
    archSlab(b, g, c, 7.6, 1.05, 3.1, 0.05, 'white');
    archSlab(b, g, c, 7.65, 0.85, 2.95, 0.1, 'glass');
    slab(b, g, c, 7.65, 0.06, 2.3, 0.15, 'sandstone');
    slab(b, g, c, 12.5, 1.05, 2.8, 0.05, 'white');
    slab(b, g, c, 12.6, 0.85, 2.6, 0.1, 'glass');
    slab(b, g, c, 12.6, 0.06, 2.6, 0.15, 'sandstone');
    // its balcony floor is the 3DBAG's 7.5 m step: the rail stands on it
    slab(b, f, 28.96, 7.5, 1.9, 0.15, 0.4, 'sandstone');
    slab(b, f, 28.96, 8.57, 1.8, 0.06, 0.06, 'bronze', 0.3);
    for (let k = 0; k <= 8; k++) slab(b, f, 28.11 + (k * 1.7) / 8, 7.65, 0.025, 0.92, 0.025, 'bronze', 0.31);
  }
  // the Stadhouderskade front (edge 2), wall top 17.8; dormers on the mansard at t 0.9, 7.4, 14.6
  {
    const {f, len} = ringFrame(ring, 2);
    momo(f, len, [3.8, 7.4, 11.0, 14.6, 18.2], 17.75, {wideFirst: false});
    for (const t of [1.3, 7.4, 14.6]) dormer(b, f, t, 17.7);
  }
  // the Hobbemastraat front (edge 11), wall tops 17.5-17.7; the shell carries the dormer at t 12
  {
    const {f, len} = ringFrame(ring, 11);
    momo(f, len, [1.8, 5.2, 8.6, 12.0, 15.4], 17.45, {wideFirst: false, awnings: false});
    dormer(b, f, 5.2, 17.4);
  }
  // the round corner tower: five facets (edges 4-8) with the ledge, bands and a window per storey. The 3DBAG facets are
  // pieced: edges 6 and 8 have a loggia recess above 7.8 m, so their upper bands and windows sit only on the full-height
  // pieces [a, z], and the ground window goes where the piece is flush (`g`).
  const FACETS: Record<number, {a: number; z: number; ua: number; uz: number; win: number | null; g: number | null}> = {
    4: {a: 0.2, z: 2.45, ua: 0.2, uz: 1.55, win: 0.87, g: 0.87},
    5: {a: 0.05, z: 2.2, ua: 0.05, uz: 1.45, win: 0.75, g: 0.75},
    6: {a: 0.05, z: 2.3, ua: 1.33, uz: 2.3, win: null, g: 0.65},
    7: {a: 0.05, z: 2.3, ua: 0.05, uz: 2.3, win: 1.17, g: 1.17},
    8: {a: 0.7, z: 2.45, ua: 1.8, uz: 2.45, win: null, g: null},
  };
  for (let e = 4; e <= 8; e++) {
    const {f} = ringFrame(ring, e);
    const {a, z, ua, uz, win, g} = FACETS[e];
    const c = (a + z) / 2, w = z - a, uc = (ua + uz) / 2, uw = uz - ua;
    slab(b, f, c, 0, w, 0.7, 0.06, 'stone');
    slab(b, f, c, 0.7, w, 4.9, 0.05, 'brick');
    if (g !== null) slab(b, f, g, 1.0, 1.0, 3.4, 0.1, 'glass');
    slab(b, f, c, 5.6, w, 0.75, 0.3, 'sandstone');
    slab(b, f, uc, 11.45, uw, 0.5, 0.14, 'sandstone');
    if (win !== null) {
      slab(b, f, win, 6.45, 1.1, 2.7, 0.05, 'white');
      slab(b, f, win, 6.55, 0.9, 2.5, 0.1, 'glass');
      slab(b, f, win, 12.5, 1.1, 2.5, 0.05, 'white');
      slab(b, f, win, 12.6, 0.9, 2.3, 0.1, 'glass');
      slab(b, f, win, 15.1, 1.3, 0.22, 0.18, 'sandstone');
    }
    slab(b, f, uc, 16.15, uw, 0.18, 0.1, 'sandstone');
    slab(b, f, uc, 16.75, uw, 0.42, 0.4, 'sandstone');
  }
  // the copper dome and its lantern (the 3DBAG cap reaches 28.8 m)
  {
    const R = 2.78, Y = 24.3, H = 3.2;
    const ring0 = new T.CylinderGeometry(R + 0.12, R + 0.12, 0.4, 24).translate(TOWER[0], Y - 0.2, TOWER[1]);
    b.add(ring0, 'sandstone' as never);
    const prof: T.Vector2[] = [];
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * (Math.PI / 2); prof.push(new T.Vector2(Math.max(0.42, R * Math.cos(a)), Y + H * Math.sin(a))); }
    b.add(new T.LatheGeometry(prof, 24).translate(TOWER[0], 0, TOWER[1]), 'copper' as never);
    b.add(new T.CylinderGeometry(0.42, 0.42, 0.9, 12).translate(TOWER[0], Y + H + 0.4, TOWER[1]), 'sandstone' as never);
    b.add(new T.ConeGeometry(0.55, 0.6, 12).translate(TOWER[0], Y + H + 1.15, TOWER[1]), 'copper' as never);
  }

  // ================= the Hobbemastraat range (edge 13) =================
  {
    const {f, len} = ringFrame(ring, 13);
    const S = 4.9; // the older piece t 0-4.9 (wall top 15.9) ahead of the 1930 range
    // grey stone shop plinth 0-4.8 with its openings, a stone ledge
    const OPEN: [number, number, number, number, string][] = [
      [0.6, 3.6, 1.0, 3.6, 'glass'], [4.6, 6.7, 1.2, 3.6, 'glass'], [7.9, 9.7, 0, 3.0, 'dark'], [10.9, 16.6, 0.4, 3.35, 'glass'],
      [17.9, 22.6, 0.4, 3.35, 'glass'], [23.7, 29.3, 0.4, 3.35, 'glass'], [30.0, 35.7, 0.4, 3.35, 'glass'],
    ];
    let p = 0.05;
    for (const [a, z] of OPEN) { if (a - p > 0.05) slab(b, f, (p + a) / 2, 0, a - p - 0.04, 4.8, 0.05, 'stone'); p = z; }
    slab(b, f, (p + len) / 2, 0, len - 0.05 - p - 0.04, 4.8, 0.05, 'stone');
    for (const [a, z, y0, y1, col] of OPEN) {
      slab(b, f, (a + z) / 2, 3.45, z - a, 4.8 - 3.45, 0.05, a > 10 ? 'stone' : 'stone');
      if (y1 < 3.45) slab(b, f, (a + z) / 2, y1, z - a - 0.04, 3.45 - y1, 0.05, 'stone');
      if (y0 > 0) slab(b, f, (a + z) / 2, 0, z - a - 0.04, y0, 0.05, 'stone');
      slab(b, f, (a + z) / 2, y0, z - a - 0.04, Math.min(y1, 3.45) - y0, 0.05, col);
      for (let t = a + 1.4; t < z - 0.6; t += 1.4) slab(b, f, t, y0, 0.08, Math.min(y1, 3.45) - y0, 0.1, 'dark');
      if (a > 10) slab(b, f, (a + z) / 2, 3.55, Math.min(5.2, z - a - 0.4), 0.7, 0.1, a < 12 ? 'concrete' : 'dark');
    }
    slab(b, f, len / 2, 4.8, len - 0.1, 0.22, 0.18, 'stone');
    // the older piece: white-framed windows, two iron balconies
    for (const y of [6.0, 9.5, 12.9]) for (const t of [1.5, 3.4]) { slab(b, f, t, y, 1.1, 2.1, 0.05, 'white'); slab(b, f, t, y + 0.08, 0.9, 1.94, 0.1, 'glass'); }
    for (const y of [5.75, 9.25]) { slab(b, f, 2.4, y, 4.2, 0.2, 0.8, 'concrete'); slab(b, f, 2.4, y + 1.0, 4.1, 0.05, 0.06, 'bronze', 0.72); for (let t = 0.5; t < 4.4; t += 0.3) slab(b, f, t, y + 0.2, 0.025, 0.82, 0.025, 'bronze', 0.74); }
    // the 1930 range: five balcony stacks with paired French doors and a white fin; single windows either side
    const STACKS = [7.17, 13.77, 20.26, 26.87, 33.25];
    const SLABS = [5.65, 9.15, 12.65];
    const ROWS = [6.0, 9.5, 13.0];
    for (const c of STACKS) {
      for (let k = 0; k < 3; k++) {
        const y = ROWS[k];
        for (const s of [-1, 1]) {
          slab(b, f, c + s * 1.0, y, 1.55, 2.5, 0.05, 'white');
          slab(b, f, c + s * 1.0, y + 0.08, 1.4, 1.9, 0.1, 'dark');
          slab(b, f, c + s * 1.0, y + 2.05, 1.4, 0.37, 0.1, 'glass');
          slab(b, f, c + s * 1.0, y + 0.08, 0.06, 1.9, 0.15, 'sandstone');
        }
        for (const s of [-1, 1]) { slab(b, f, c + s * 2.3, y, 0.7, 2.15, 0.05, 'white'); slab(b, f, c + s * 2.3, y + 0.08, 0.56, 2.0, 0.1, 'glass'); }
        // balcony: slab, iron rail, white fin
        const sy = SLABS[k];
        slab(b, f, c, sy, 4.05, 0.25, 0.95, 'concrete');
        slab(b, f, c, sy + 1.25, 3.9, 0.05, 0.06, 'bronze', 0.85);
        slab(b, f, c, sy + 0.35, 3.9, 0.04, 0.05, 'bronze', 0.86);
        for (let t = c - 1.85; t <= c + 1.86; t += 0.22) slab(b, f, t, sy + 0.25, 0.025, 1.0, 0.025, 'bronze', 0.87);
        slab(b, f, c, sy + 0.25, 0.24, 2.65, 0.55, 'sandstone', 0.05);
      }
      // attic row under the overhanging roof
      for (const s of [-1, 1]) { if (c + s * 2.3 < S + 0.4) continue; slab(b, f, c + s * 1.0, 15.85, 1.6, 0.95, 0.05, 'white'); slab(b, f, c + s * 1.0, 15.92, 1.46, 0.8, 0.1, 'glass'); slab(b, f, c + s * 2.3, 15.85, 0.7, 0.95, 0.05, 'white'); slab(b, f, c + s * 2.3, 15.92, 0.56, 0.8, 0.1, 'glass'); }
    }
    // thin white sill bands, between the balcony stacks
    for (const y of [5.85, 9.35, 12.85]) {
      let q = S + 0.1;
      for (const c of STACKS) { const a = c - 2.3 - 0.4; if (a - q > 0.1) slab(b, f, (q + a) / 2, y, a - q, 0.1, 0.05, 'sandstone'); q = c + 2.3 + 0.4; }
      if (len - 0.1 - q > 0.1) slab(b, f, (q + len - 0.1) / 2, y, len - 0.1 - q, 0.1, 0.05, 'sandstone');
    }
    // the overhanging flat roof (17.3-17.8 m, 1 m out)
    slab(b, f, (S + len) / 2, 17.3, len - S - 0.1, 0.45, 1.0, 'concrete');
  }
  setSink(sink0);
}

/** A white pedimented dormer on the mansard behind the cornice: a box, its window, and a triangular pediment. */
function dormer(b: BuildingTools, f: Frame, t: number, y: number) {
  const W = 1.9, H = 2.1, D = 2.4, O = -0.1;
  slab(b, f, t, y, W, H, D, 'sandstone', O - D);
  // the window has no sink: its back stays on the dormer front, clear of the mansard plane
  const k0 = getSink();
  setSink(0);
  slab(b, f, t, y + 0.35, 1.2, 1.45, 0.05, 'glass', O);
  slab(b, f, t, y + 0.35, 0.06, 1.45, 0.1, 'sandstone', O);
  setSink(k0, true);
  poly(b, f, t, y + H, [[-W / 2 - 0.1, 0], [W / 2 + 0.1, 0], [0, 0.7]], 0.3, 'sandstone', O - 0.25);
  slab(b, f, t, y + H, W + 0.2, 0.7, D - 0.3, 'slate', O - D);
}
