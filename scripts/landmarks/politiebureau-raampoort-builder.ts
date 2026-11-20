import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, disc, eaveOffset, ledgeStrip, ringFrame, ringSlab, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './politiebureau-raampoort-footprints.json';

/**
 * POLITIEBUREAU RAAMPOORT, Marnixstraat 148 (BAG pand 0363100012169781, 1888, Willem Springer; rijksmonument 518437):
 * the former police station on the Singelgracht at the Bullebaksluis, "het gebouw met de karakteristieke torens en kantelen"
 * (nl.wikipedia Politiebureau_Raampoort). Massing: the 3DBAG LoD2.2 shell (politiebureau-raampoort-footprints.json, written by
 * bag-shell-prepare.ts): the three-storey Marnixstraat block (flat roof 13.0 m), the hipped north-east block, the lower water
 * wing (9.8 m) with its 5.1 m front strip on the Singelgracht. The clock tower, the crenellations, the corner pinnacles and
 * every opening are drawn here from rectified Gemeente Amsterdam panoramas (CC BY 4.0), per wall in
 * politiebureau-raampoort-inventory.json:
 *  - Marnixstraat front (ring edge 11, 16.75 m, TMX7316010203-002967_pano_0005_000107 rectified at 50 px/m): six bays of
 *    round-headed windows on the banded ground floor and the first floor under dark relieving arches, paired small round-headed
 *    windows on the top floor, copper coping; the north-east block's arched corbel table and octagonal pinnacles.
 *  - north front (ring edge 0, TMX7316010203-002552_pano_0002_001693): two bays of the same rhythm under the corbel table, the
 *    lower crenellated wing to the west, the square clock tower with its dial and slate spire behind.
 *  - Singelgracht fronts (ring edges 2-9, TMX7316010203-000205_pano_0000_000212/213): dark brick basement out of the water,
 *    banded storey with small square-headed windows and two round-headed ones, the set-back upper storey with five round-headed
 *    windows, the rounded north-west corner with its crenellated parapet.
 */
export function buildPolitiebureauRaampoort(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as {facadeRing: number[][]; surfaces: Surface[]; nativeRing: number[][]};
  const ring = src.facadeRing;
  // tower: the 3DBAG blob of the 21.5 m roof (x -3.7..1.3, z 2.7..7.8); its walls and top are replaced below
  const towerBlob = src.surfaces.find(s => s.type === 'RoofSurface' && s.rings[0].every(p => p[1] > 21))!.rings[0].map(p => [p[0], p[2]]);
  const inBlob = (x: number, z: number) => x > -3.75 && x < 1.35 && z > 2.65 && z < 7.85;
  addShell(b, src as never, {
    wall: 'brick', roof: 'slate',
    skip: s => s.rings[0].every(p => inBlob(p[0], p[2])) && s.rings[0].some(p => p[1] > 15),
    roofFor: s => (s.rings[0].every(p => Math.abs(p[1] - s.rings[0][0][1]) < 0.3) ? 'dark' : 'slate'),
    // triangular 3DBAG wall slivers where the hips meet the flat block read as red shards above the cornice: roof colour
    wallFor: s => (s.rings[0].length <= 4 && Math.min(...s.rings[0].map(p => p[1])) > 12.4 ? 'slate' : 'brick'),
  });

  // the rounded corner's 3DBAG facets stand 2-9 cm proud of the merged BAG ring (eaveOffset); its details stand on the shell
  const roofs = src.surfaces.filter(s => s.type === 'RoofSurface');
  const RF = (i: number) => ringFrame(ring, i, i >= 2 && i <= 5 ? eaveOffset(ring, roofs, i) : 0);
  const sink0 = getSink();
  setSink(0.18, true);

  // ---------- shared pieces (frame space: t along the wall, y up from the 3DBAG ground, out of the wall) ----------
  /** Round-headed window: white frame, glass, glazing bars (cols x rows below the spring), optional stone sill. */
  const rwin = (f: Frame, t: number, y0: number, y1: number, w: number, cols = 2, rows = 2, sill = true) => {
    // layers 4 cm apart (2-3 cm reads as z-fighting in audit:glb): bands 0.05, arches 0.09, frame 0.13, glass 0.17, bars 0.21
    archSlab(b, f, t, y0 - 0.05, w + 0.16, y1 - y0 + 0.1, 0.13, 'frame');
    archSlab(b, f, t, y0, w, y1 - y0, 0.17, 'glass');
    const spring = y1 - w / 2;
    for (let k = 1; k < cols; k++) slab(b, f, t - w / 2 + (w * k) / cols, y0, 0.05, spring - y0, 0.21, 'frame');
    for (let r = 1; r <= rows; r++) slab(b, f, t, y0 + ((spring - y0) * r) / (rows + 1), w, 0.05, 0.21, 'frame');
    slab(b, f, t, spring, w, 0.06, 0.21, 'frame');
    if (sill) slab(b, f, t, y0 - 0.16, w + 0.3, 0.11, 0.16, 'stone');
  };
  /** Square-headed small window with a white frame and a cross bar. */
  const swin = (f: Frame, t: number, y0: number, y1: number, w: number, sill = true) => {
    slab(b, f, t, y0 - 0.05, w + 0.14, y1 - y0 + 0.1, 0.13, 'frame');
    slab(b, f, t, y0, w, y1 - y0, 0.17, 'glass');
    slab(b, f, t, y0 + (y1 - y0) * 0.55, w, 0.05, 0.21, 'frame');
    slab(b, f, t, y0, 0.05, y1 - y0, 0.21, 'frame');
    if (sill) slab(b, f, t, y0 - 0.12, w + 0.2, 0.09, 0.14, 'stone');
  };
  /** Dark brick relieving arch round a round-headed window whose head springs at `spring`. */
  const relieve = (f: Frame, t: number, spring: number, w: number, th = 0.3) => archBand(b, f, t, spring, w + 2 * th + 0.1, (w + 2 * th + 0.1) / 2, th, 0.09, 'greyBrick');
  /** Alternating dark bands of the banded storeys, between y0 and y1, leaving gaps for windows (via `skip(t)` ranges). */
  const bands = (f: Frame, t0: number, t1: number, y0: number, y1: number, period = 0.85, th = 0.28) => {
    t0 += 0.05; t1 -= 0.05; // ends clear of the neighbouring wall planes (coplanar end faces z-fight)
    for (let y = y0; y + th <= y1 + 0.01; y += period) slab(b, f, (t0 + t1) / 2, y, t1 - t0, th, 0.05, 'greyBrick');
  };
  /** Crenellated parapet on top of a wall at roof height y: 1.0 m wall then merlons 0.6 m high, 0.5 m wide every 1.0 m. */
  const crenel = (f: Frame, t0: number, t1: number, y: number) => {
    slab(b, f, (t0 + t1) / 2, y - 0.1, t1 - t0, 1.1, 0.4, 'brick', -0.34);
    ledgeStrip(b, f, (t0 + t1) / 2, y + 0.95, t1 - t0, 0.16, 0.1, 'stone', 0.0);
    const n = Math.max(1, Math.round((t1 - t0) / 1.0));
    for (let k = 0; k < n; k++) slab(b, f, t0 + ((k + 0.5) * (t1 - t0)) / n, y + 1.0, Math.min(0.5, (t1 - t0) / n - 0.15), 0.6, 0.4, 'brick', -0.34);
  };
  /** Arched corbel table under a cornice: small round arches every 0.5 m between t0 and t1, cornice above. */
  const corbels = (f: Frame, t0: number, t1: number, y: number) => {
    const n = Math.max(1, Math.round((t1 - t0) / 0.5));
    for (let k = 0; k < n; k++) archBand(b, f, t0 + ((k + 0.5) * (t1 - t0)) / n, y, (t1 - t0) / n, 0.42, 0.07, 0.1, 'brick', 0.0, 4);
    ledgeStrip(b, f, (t0 + t1) / 2, y + 0.42, t1 - t0, 0.12, 0.16, 'brick');
    ledgeStrip(b, f, (t0 + t1) / 2, y + 0.6, t1 - t0, 0.25, 0.3, 'brick'); // brick, not stone: the photos show no pale cornice
  };
  /** Octagonal brick pinnacle with a stone ring and a slate cap at native point (x, z). */
  const pinnacle = (x: number, z: number, y0: number, y1: number, r = 0.34) => {
    b.add(new T.CylinderGeometry(r, r, y1 - y0, 8).translate(x, (y0 + y1) / 2, z), 'brick' as never);
    b.add(new T.CylinderGeometry(r + 0.07, r + 0.07, 0.16, 8).translate(x, y1 + 0.08, z), 'stone' as never);
    b.add(new T.ConeGeometry(r + 0.04, 0.75, 8).translate(x, y1 + 0.16 + 0.375, z), 'slate' as never);
  };
  /** The three-storey bay rhythm of the Marnixstraat block: round-headed ground and first floor windows, top-floor pair. */
  const bay = (f: Frame, t: number, door = false) => {
    if (door) {
      archSlab(b, f, t, 0.35, 1.36, 3.05, 0.13, 'frame');
      archSlab(b, f, t, 0.4, 1.2, 2.95, 0.17, 'glass');
      slab(b, f, t, 0.4, 1.14, 2.3, 0.21, 'dark');
      slab(b, f, t, 0.4, 0.04, 2.3, 0.25, 'frame');
    } else rwin(f, t, 1.2, 3.4, 1.4, 2, 2);
    relieve(f, t, 2.7, 1.4);
    rwin(f, t, 5.5, 8.3, 1.4, 2, 3);
    relieve(f, t, 7.6, 1.4);
    for (const s of [-1, 1]) {
      rwin(f, t + s * 0.42, 9.8, 11.2, 0.6, 1, 1, false);
      archBand(b, f, t + s * 0.42, 10.9, 0.84, 0.42, 0.1, 0.09, 'greyBrick', 0, 4);
    }
    slab(b, f, t, 9.66, 1.6, 0.1, 0.14, 'stone');
  };
  /** Courses common to the Marnixstraat block faces. */
  const courses = (f: Frame, t0: number, t1: number) => {
    t0 += 0.05; t1 -= 0.05;
    slab(b, f, (t0 + t1) / 2, 0, t1 - t0, 0.4, 0.12, 'stone');
    bands(f, t0, t1, 0.62, 4.3);
    slab(b, f, (t0 + t1) / 2, 4.4, t1 - t0, 0.28, 0.08, 'greyBrick');
    slab(b, f, (t0 + t1) / 2, 5.2, t1 - t0, 0.1, 0.12, 'stone');
    slab(b, f, (t0 + t1) / 2, 9.4, t1 - t0, 0.16, 0.08, 'greyBrick');
  };

  // ---------- Marnixstraat front (ring edge 11; t from the south end) ----------
  {
    const {f, len} = RF(11);
    courses(f, 0, len);
    for (const t of [1.94, 4.16, 6.38, 8.58, 14.16]) bay(f, t);
    bay(f, 10.8, true);
    // flat-roofed part: cornice with the green copper coping
    ledgeStrip(b, f, 6.2, 12.45, 12.4, 0.3, 0.2, 'brick');
    slab(b, f, 6.2, 12.75, 12.4, 0.2, 0.3, 'copper', -0.1);
    // the arched corbel table runs under the flat-roofed cornice too (blind review fix)
    for (let k = 0; k < 24; k++) archBand(b, f, 0.3 + (k + 0.5) * 0.5, 12.0, 0.5, 0.42, 0.07, 0.1, 'brick', 0.0, 4);
    // hipped north-east block: pilasters, arched corbel table, cornice, pinnacles
    for (const t of [12.65, 16.55]) slab(b, f, t, 0.4, 0.5, 12.0, 0.16, 'brick');
    corbels(f, 12.9, 16.3, 12.0);
    for (const t of [12.65, 16.55]) {
      const x = f.origin[0] + f.tangent[0] * t + f.n[0] * 0.05, z = f.origin[1] + f.tangent[1] * t + f.n[1] * 0.05;
      pinnacle(x, z, 11.6, 13.7);
    }
  }
  // north-east block, east faces (ring edges 15, 19; one bay each, seen obliquely in TMX7316010203-002552_pano_0002_001693)
  for (const i of [15, 19]) {
    const {f, len} = RF(i);
    courses(f, 0, len);
    bay(f, len / 2);
    corbels(f, 0.2, len - 0.2, 12.0);
  }
  // ---------- north front (ring edge 0; t from the east corner) ----------
  {
    const {f, len} = RF(0);
    // tall block t 0..6.6
    courses(f, 0, 6.6);
    for (const t of [1.7, 4.7]) bay(f, t);
    corbels(f, 0.4, 6.3, 12.0);
    for (const t of [0.15, 6.6]) {
      const x = f.origin[0] + f.tangent[0] * t + f.n[0] * 0.05, z = f.origin[1] + f.tangent[1] * t + f.n[1] * 0.05;
      pinnacle(x, z, 11.6, 13.7);
    }
    slab(b, f, 6.6, 0.4, 0.5, 12.0, 0.16, 'brick');
    // lower crenellated wing t 6.6..len: its 3DBAG wall stands 8.7 cm proud of the ring
    const {f: fw} = ringFrame(ring, 0, 0.087);
    slab(b, fw, (6.6 + len) / 2, 0, len - 6.6, 0.4, 0.12, 'stone');
    bands(fw, 6.9, len, 0.62, 4.3);
    ledgeStrip(b, fw, (6.6 + len) / 2, 4.4, len - 6.6, 0.28, 0.08, 'greyBrick');
    rwin(fw, 8.3, 1.2, 3.4, 1.3, 2, 2); relieve(fw, 8.3, 2.75, 1.3);
    rwin(fw, 8.3, 5.6, 8.3, 1.3, 2, 3); relieve(fw, 8.3, 7.65, 1.3);
    crenel(f, 6.85, len, 9.8);
  }
  // ---------- rounded north-west corner (ring edges 2-5) and the Singelgracht fronts ----------
  /** Water-wing storeys: dark basement band to 0.85 (the part below the street level stays with the quay: audit:glb keeps models
   *  above the ground), banded storey to 5.0, cornice band. */
  const waterBase = (f: Frame, t0: number, t1: number) => {
    t0 += 0.05; t1 -= 0.05;
    slab(b, f, (t0 + t1) / 2, 0, t1 - t0, 0.85, 0.05, 'greyBrick');
    ledgeStrip(b, f, (t0 + t1) / 2, 0.82, t1 - t0, 0.08, 0.1, 'stone');
    bands(f, t0, t1, 1.2, 4.6, 0.8, 0.26);
    ledgeStrip(b, f, (t0 + t1) / 2, 4.95, t1 - t0, 0.4, 0.12, 'greyBrick');
  };
  for (const i of [2, 3, 4, 5]) {
    const {f, len} = RF(i);
    waterBase(f, 0, len);
    if (len > 1.2) swin(f, len / 2, 2.4, 3.6, 0.5);
    // upper windows on the two middle facets; the last facet's 3DBAG wall stands inside the merged ring (openings gate)
    if (i === 3 || i === 4) rwin(f, len / 2, 6.2, 8.9, Math.min(1.1, len - 0.45), 2, 3);
    crenel(f, 0, len, 9.8);
  }
  // west wall next to the round corner (ring edge 7; t from the north end, w03-281 at 50 px/m)
  {
    const {f, len} = RF(7);
    waterBase(f, 0, len);
    for (const t of [1.04, 2.04, 3.36, 4.36, 5.7, 6.7]) swin(f, t, 2.4, 3.6, 0.5);
    for (const t of [1.54, 3.9, 6.05]) { rwin(f, t, 6.2, 8.9, 1.3, 2, 3); relieve(f, t, 8.25, 1.3); }
    crenel(f, 0, len, 9.8);
  }
  // Singelgracht front (ring edge 9; t from the north end, w02-281 at 50 px/m): banded front strip to 5.1 m
  {
    const {f, len} = RF(9);
    waterBase(f, 0, len);
    for (const t of [1.96, 4.28]) { rwin(f, t, 1.7, 3.8, 1.4, 2, 2); relieve(f, t, 3.1, 1.4); }
    for (const t of [6.1, 7.1, 8.5, 9.4, 10.8, 11.7]) swin(f, t, 2.4, 3.6, 0.5);
    ledgeStrip(b, f, len / 2, 5.0, len, 0.18, 0.22, 'stone');
  }
  // set-back upper storey of the water wing (3DBAG 9.8 m roof edge (-4.9, 6.1) -> (-7.8, 19.2))
  {
    const a = [-4.9, 6.1], c = [-7.8, 19.2], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const tg: [number, number] = [(c[0] - a[0]) / L, (c[1] - a[1]) / L];
    const f: Frame = {origin: [a[0], a[1]], tangent: tg, n: [-tg[1], tg[0]]};
    for (const t of [2.3, 4.4, 6.5, 8.6, 10.6]) { rwin(f, t, 6.1, 8.1, 1.3, 2, 2); relieve(f, t, 7.45, 1.3); }
    ledgeStrip(b, f, L / 2, 9.7, L, 0.3, 0.12, 'brick');
    slab(b, f, L / 2, 9.95, L, 0.16, 0.36, 'stone', -0.3);
    // chimney on the roof behind the parapet
    slab(b, f, 10.6, 9.6, 0.75, 3.6, 0.75, 'brick', -2.2);
    slab(b, f, 10.6, 13.2, 0.9, 0.14, 0.9, 'stone', -2.27);
  }

  // ---------- clock tower (replaces the 3DBAG blob above the roofs) ----------
  {
    // base: the blob outline up to the hip roof's highest edge against it, so no roof plane is left open
    const s = new T.Shape(towerBlob.map(p => new T.Vector2(p[0], p[1])));
    const base = new T.ExtrudeGeometry(s, {depth: 15.0 - 9.6, bevelEnabled: false});
    base.rotateX(Math.PI / 2).translate(0, 15.0, 0);
    b.add(base, 'brick' as never);
    // square tower on the building axes (east front tangent), 4.1 m, centred on the blob
    const {f: e} = RF(11);
    const ax: [number, number] = [e.tangent[0], e.tangent[1]]; // north-ish
    // the body runs down into the blob to the water-wing roof and up clear of the north-east hip (3DBAG ridge 18.4 m): from across
    // the water the shaft and clock stand above the pavilion under a short cap (TMX7316010203-000790_pano_0000_006114, blind review)
    // r6 blind A/B (2026-11-20): from across the Singelgracht (w281 pairs) the shaft stood too squat; raised 1.7 m, clock with it.
    const cx = -1.2, cz = 5.2, H = 2.05, y0 = 9.7, y1 = 22.0, dy = y1 - 20.3;
    const faces: Frame[] = [];
    for (const [nx, nz] of [[ax[0], ax[1]], [ax[1], -ax[0]], [-ax[0], -ax[1]], [-ax[1], ax[0]]] as [number, number][]) {
      const tg: [number, number] = [nz, -nx];
      faces.push({origin: [cx + nx * H - tg[0] * H, cz + nz * H - tg[1] * H], tangent: tg, n: [nx, nz]});
    }
    const sq = faces.map(f => [f.origin[0], f.origin[1]]);
    const shape = new T.Shape(sq.map(p => new T.Vector2(p[0], p[1])));
    const body = new T.ExtrudeGeometry(shape, {depth: y1 - y0, bevelEnabled: false});
    body.rotateX(Math.PI / 2).translate(0, y1, 0);
    b.add(body, 'brick' as never);
    faces.forEach((f, k) => {
      ledgeStrip(b, f, H, 15.03, 2 * H, 0.2, 0.12, 'brick');
      slab(b, f, H, 19.95, 2 * H, 0.18, 0.12, 'stone');
      corbels(f, 0.1, 2 * H - 0.1, y1 - 0.45);
      // r6: a dial on every face and a louvred arch under it (2017 Singelgracht view TMX7316010203-000205_pano_0000_000213
      // shows dial and louvre on the west face as on the north, TMX7316010203-002552_pano_0002_001693)
      void k;
      disc(b, f, H, 19.2 + dy, 0.62, 0.08, 'gold');
      disc(b, f, H, 19.2 + dy, 0.52, 0.12, 'dark');
      slab(b, f, H, 19.2 + dy, 0.05, 0.42, 0.16, 'gold');
      slab(b, f, H - 0.1, 19.2 + dy, 0.3, 0.05, 0.16, 'gold');
      ringSlab(b, f, H, 19.2 + dy, 0.62, 0.74, 0.06, 'stone');
      archSlab(b, f, H, 18.5, 0.9, 1.35, 0.08, 'dark');
      for (let j = 0; j < 4; j++) slab(b, f, H, 18.65 + j * 0.24, 0.8, 0.05, 0.11, 'stone');
    });
    // slate spire: square pyramid with an overhang, finial and weather vane. Round r6 (2026-11-20): the camera-matched
    // overlay of the 2022 Raampoort pano (TMX7316010203-002967_pano_0005_000107, wall 101) puts the photo's spire tip ~6 m
    // over the shaft top (about 11 px/m at the tower), and the 2022 north view shows a steep needle, not a 2.4 m cap.
    // The needle is octagonal (2022 north view TMX7316010203-002552_pano_0002_001693), seated on the shaft's corbel ledge.
    const top = y1 - 0.12, apex = 26.6 + dy;
    const g = new T.ConeGeometry(H + 0.05, apex - top, 8, 1, true).rotateY(Math.PI / 8 + Math.atan2(ax[0], ax[1])).translate(cx, top + (apex - top) / 2, cz);
    g.userData.role = 'roof';
    b.add(g, 'slate' as never);
    b.add(new T.CylinderGeometry(0.035, 0.035, 1.5, 6).translate(cx, apex + 0.7, cz), 'dark' as never);
    b.add(new T.SphereGeometry(0.11, 8, 6).translate(cx, apex + 0.35, cz), 'gold' as never);
    b.add(new T.BoxGeometry(0.6, 0.22, 0.03).translate(cx + 0.2, apex + 1.2, cz), 'dark' as never);
  }
  setSink(sink0);
}
