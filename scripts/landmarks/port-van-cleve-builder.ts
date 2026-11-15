import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {rawWall} from './big-kit';
import {archBand, archSlab, letters, poly, ringFrame, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './port-van-cleve-footprints.json';

/**
 * HOTEL DIE PORT VAN CLEVE, Nieuwezijds Voorburgwal 176-180 (BAG pand 0363100012175580, rijksmonument 5988): "Hotel-Restaurant
 * die Port van Cleve (1888, door I. Gosschalk). Hoofdgebouw in zeer origineel mengsel van neo-gothiek en neo-renaissance, met
 * gelobde vensterbogen en middentopgevel. Links aanbouw met erker en neobarokke klokgevel" (RCE register, cited in the brief).
 * Massing: the 3DBAG LoD2.2 shell (port-van-cleve-footprints.json, bag-shell-prepare.ts): the front cornice at 13.8 m, a
 * slate front slope to 19.2 m, the deeper hotel block behind to 23-27 m. The NZV front is facade-ring edge 8 (t 0 at the
 * south corner by Magna Plaza, 21.0 m to the white corner house); every detail is read from the rectified Gemeente Amsterdam
 * panorama TMX7316010203-001900_pano_0006_000054 (2020, CC BY 4.0; 45 px/m vertically, the horizontal scale set by the
 * 3DBAG walls: the annex to t 4.84, the main block to t 21.0):
 *  - the annex (t 0-4.84): striped brick and stone, a two-storey stone erker with a lead dome, the bell gable with an oculus;
 *  - the main block (t 4.84-21.0): four bays; a grey stone ground floor of four round arches with orange-red frames between
 *    columns; stone balconettes; three-light first-floor windows under carved stone lunettes (the "gelobde vensterbogen");
 *    the lettered frieze DIE PORT VAN CLEVE; a pierced stone balustrade with pinnacles; slate dormers; the central gable with
 *    two arched lights and its finialled aedicule;
 *  - the red neon roof sign "die PORT van CLEVE" on its frame over the south half of the roof.
 * The Spuistraat back (walls brg 288) is the plain later hotel block: brick with a grid of white-framed windows.
 */
export function buildPortVanCleve(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as {facadeRing: number[][]; surfaces: Surface[]; nativeRing: number[][]};
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.05);
  const {f} = ringFrame(src.facadeRing, 8);
  // layers: face 0.15, dressings 0.2-0.3, frames +0.04, glass +0.08, bars +0.12
  const A0 = 0, A1 = 4.84, M0 = 4.84, M1 = 21.0, BAYS = [7.1, 10.9, 14.6, 18.4];

  // ---------- front face: grey stone ground floor, brick above (the 3DBAG front is a 6-step saw, so it is faced over) ----------
  slab(b, f, (M0 + M1) / 2, 0, M1 - M0, 7.3, 0.45, 'stone', -0.3);
  slab(b, f, (M0 + M1) / 2, 7.3, M1 - M0, 6.6, 0.45, 'brick', -0.3);
  slab(b, f, (A0 + A1) / 2, 0, A1 - A0, 4.7, 0.45, 'stone', -0.3);
  slab(b, f, (A0 + A1) / 2, 4.7, A1 - A0, 9.3, 0.45, 'brick', -0.3);
  // stone banding across the brick (w04-117: the striped front, a stone course every 0.6-0.7 m)
  for (let y = 7.9; y < 13.6; y += 0.66) slab(b, f, (M0 + M1) / 2, y, M1 - M0 - 0.06, 0.12, 0.21, 'sandstone');
  for (let y = 5.3; y < 13.9; y += 0.62) slab(b, f, (A0 + A1) / 2, y, A1 - A0 - 0.06, 0.15, 0.21, 'sandstone');

  // ---------- main block ground floor: four round arches between columns, orange-red frames ----------
  slab(b, f, (M0 + M1) / 2, 0, M1 - M0 - 0.06, 0.4, 0.3, 'stone');
  for (const t of BAYS) {
    archBand(b, f, t, 0.4, 3.1, 6.3, 0.3, 0.3, 'sandstone');
    archSlab(b, f, t, 0.4, 2.5, 6.0, 0.2, 'red');
    archSlab(b, f, t, 0.5, 2.3, 5.85, 0.24, 'glass');
    slab(b, f, t, 4.5, 2.3, 0.12, 0.28, 'red');
    for (const dt of [-0.58, 0, 0.58]) slab(b, f, t + dt, 4.6, 0.07, 1.2, 0.28, 'red');
    slab(b, f, t, 0.5, 0.08, 4.0, 0.28, 'red');
  }
  for (const t of [M0 + 0.3, 8.95, 12.75, 16.5, M1 - 0.3]) {
    slab(b, f, t, 0.4, 0.55, 4.6, 0.38, 'stone');
    slab(b, f, t, 5.0, 0.75, 0.4, 0.45, 'sandstone'); // carved capitals
  }
  // carved spandrel panels over the arches up to the ground-floor cornice
  for (const t of [8.95, 12.75, 16.5]) poly(b, f, t, 5.4, [[-0.55, 0], [0.55, 0], [0.4, 1.4], [-0.4, 1.4]], 0.08, 'sandstone', 0.3);
  // dark blue entrance canopy lettered de Port van Cleve over the first arch
  slab(b, f, 7.1, 3.95, 2.9, 0.45, 0.9, 'blue');
  letters(b, f, 'PORT VAN CLEVE', 7.1, 4.08, 0.92, 0.03, 0.02, 'concrete', 0.03);
  // ground-floor cornice and the stone balcony slab
  slab(b, f, (M0 + M1) / 2, 6.95, M1 - M0 - 0.06, 0.4, 0.55, 'sandstone');

  // ---------- first floor: bowed stone balconettes, three-light windows, carved lunettes ----------
  for (const t of BAYS) {
    poly(b, f, t, 7.35, [[-1.45, 0], [1.45, 0], [1.45, 0.12], [-1.45, 0.12]], 0.5, 'sandstone', 0);
    slab(b, f, t, 7.47, 2.7, 0.75, 0.08, 'sandstone', 0.42);
    for (const dt of [-0.9, -0.3, 0.3, 0.9]) slab(b, f, t + dt, 7.6, 0.32, 0.5, 0.06, 'dark', 0.5);
    slab(b, f, t, 8.25, 3.0, 0.12, 0.55, 'sandstone');
    // window: stone surround, stone mullions, transom, glass
    slab(b, f, t, 8.3, 3.0, 2.85, 0.27, 'sandstone');
    slab(b, f, t, 8.4, 2.7, 2.6, 0.31, 'frame');
    slab(b, f, t, 8.45, 2.6, 2.5, 0.36, 'glass');
    for (const dt of [-0.45, 0.45]) slab(b, f, t + dt, 8.4, 0.16, 2.6, 0.42, 'sandstone');
    slab(b, f, t, 10.2, 2.6, 0.1, 0.47, 'frame');
    // lunette: a semicircular stone tympanum with a carved shell boss (the lobed window heads)
    archSlab(b, f, t, 11.0, 3.4, 1.7, 0.27, 'sandstone', 0, 12);
    archBand(b, f, t, 11.0, 3.6, 1.8, 0.18, 0.33, 'sandstone', 0, 12);
    archSlab(b, f, t, 11.2, 1.1, 0.9, 0.39, 'stone', 0, 8);
  }
  // stone pilaster strips at the bay divisions rising to pinnacles above the balustrade
  for (const t of [M0 + 0.3, 8.95, 12.75, 16.5, M1 - 0.3]) {
    slab(b, f, t, 7.35, 0.5, 7.3, 0.45, 'sandstone');
    slab(b, f, t, 14.65, 0.42, 0.55, 0.42, 'sandstone', -0.06);
    poly(b, f, t, 15.2, [[-0.2, 0], [0.2, 0], [0, 0.65]], 0.3, 'sandstone', 0.0);
  }
  // lettered frieze: four white panels DIE / PORT / VAN / CLEVE, one word per bay between the pilasters (nzv-0)
  slab(b, f, (M0 + M1) / 2, 12.85, M1 - M0 - 0.06, 0.2, 0.28, 'sandstone');
  for (const [t, w, word] of [[BAYS[0], 1.6, 'DIE'], [BAYS[1], 1.8, 'PORT'], [BAYS[2], 1.6, 'VAN'], [BAYS[3], 2.1, 'CLEVE']] as [number, number, string][]) {
    slab(b, f, t, 13.05, w, 0.55, 0.33, 'concrete');
    letters(b, f, word, t, 13.13, 0.33, 0.055, 0.03, 'bronze', 0.055);
  }
  // cornice and pierced balustrade
  slab(b, f, (M0 + M1) / 2, 13.65, M1 - M0 - 0.06, 0.3, 0.55, 'sandstone');
  slab(b, f, (M0 + M1) / 2, 13.95, M1 - M0 - 0.06, 0.12, 0.4, 'sandstone');
  slab(b, f, (M0 + M1) / 2, 14.5, M1 - M0 - 0.06, 0.15, 0.4, 'sandstone');
  for (let t = M0 + 0.6; t < M1 - 0.4; t += 0.55) slab(b, f, t, 14.07, 0.18, 0.43, 0.3, 'sandstone', 0.05);
  slab(b, f, (M0 + M1) / 2, 14.07, M1 - M0 - 0.06, 0.43, 0.04, 'slate', 0.12);

  // ---------- roof: stone dormers with pointed caps, chimneys, the central gable ----------
  for (const t of [7.4, 9.6, 17.4, 19.2]) {
    slab(b, f, t, 14.65, 1.1, 1.6, 0.9, 'sandstone', -1.0);
    slab(b, f, t, 14.85, 0.7, 1.15, 0.04, 'glass', -0.1);
    poly(b, f, t, 16.25, [[-0.62, 0], [0.62, 0], [0, 0.85]], 0.9, 'slate', -1.0);
  }
  for (const t of [5.3, 20.4]) slab(b, f, t, 14.6, 0.7, 2.6, 0.8, 'brick', -0.9);
  {
    const G0 = 11.67, G1 = 15.66, c = (G0 + G1) / 2; // the 3DBAG gable walls (35-38, 64, 157) to 18.9-19.5 m
    slab(b, f, c, 14.6, G1 - G0, 2.4, 1.0, 'brick', -0.85);
    for (const y of [15.2, 16.0]) slab(b, f, c, y, G1 - G0, 0.12, 0.2, 'sandstone', 0.1);
    for (const t of [c - 1.0, c + 1.0]) {
      archSlab(b, f, t, 14.85, 1.15, 1.75, 0.28, 'sandstone', 0.1);
      archSlab(b, f, t, 14.95, 0.9, 1.55, 0.33, 'glass', 0.1);
    }
    // stepped shoulders and the finialled aedicule (w: 17-20.5 m)
    poly(b, f, c, 17.0, [[-2.0, 0], [2.0, 0], [2.0, 0.2], [1.5, 0.6], [1.4, 1.0], [-1.4, 1.0], [-1.5, 0.6], [-2.0, 0.2]], 0.9, 'sandstone', -0.75);
    slab(b, f, c, 18.0, 2.3, 1.6, 0.9, 'brick', -0.8);
    archSlab(b, f, c, 18.2, 0.8, 1.2, 0.9, 'sandstone', -0.7);
    for (const s of [-1, 1]) slab(b, f, c + s * 1.15, 18.0, 0.3, 1.9, 0.98, 'sandstone', -0.72);
    poly(b, f, c, 19.6, [[-1.35, 0], [1.35, 0], [0.5, 0.55], [0.25, 0.55], [0.12, 1.15], [-0.12, 1.15], [-0.25, 0.55], [-0.5, 0.55]], 0.8, 'sandstone', -0.7);
  }

  // ---------- red neon roof sign on a dark frame over the south half ----------
  {
    const c = 8.2;
    // nzv-0: the letters stand ~2.8 m tall above the cornice, two lines from 15.75 m to ~18 m on a bar at 15.55 m
    for (const t of [c - 2.9, c + 2.9]) slab(b, f, t, 14.6, 0.1, 4.9, 0.1, 'bronze', -1.6);
    slab(b, f, c, 15.55, 6.0, 0.08, 0.1, 'bronze', -1.6);
    letters(b, f, 'DIE PORT', c - 0.2, 16.85, -1.5, 0.11, 0.07, 'pink', 0.16);
    letters(b, f, 'VAN CLEVE', c + 0.1, 15.75, -1.5, 0.1, 0.07, 'pink', 0.13);
  }

  // ---------- annex (t 0-4.84): shopfront, erker with lead dome, bell gable with oculus ----------
  {
    const c = 2.42;
    slab(b, f, c, 0.3, 4.2, 4.0, 0.22, 'red');
    slab(b, f, c, 0.45, 3.9, 3.7, 0.26, 'glass');
    for (const dt of [-1.3, 0, 1.3]) slab(b, f, c + dt, 0.4, 0.1, 3.8, 0.3, 'red');
    slab(b, f, c, 4.35, 4.6, 0.35, 0.6, 'red'); // orange awning fascia
    slab(b, f, c, 4.85, 3.2, 0.6, 0.3, 'blue'); // De Blauwe Parade sign
    letters(b, f, 'BLAUWE PARADE', c, 5.0, 0.3, 0.035, 0.02, 'concrete', 0.04);
    // canted stone erker, two storeys (6.1-12.6 m)
    const D = 0.8, pts: [number, number][] = [[-1.4, 0], [-1.0, D], [1.0, D], [1.4, 0]];
    const pr = (y0: number, y1: number, p: [number, number][], col: string) => {
      const sh = new T.Shape(p.map(([x, o]) => new T.Vector2(x, o)));
      const g = new T.ExtrudeGeometry(sh, {depth: y1 - y0, bevelEnabled: false}).rotateX(-Math.PI / 2).translate(0, y0, 0);
      // map local (x, out) to the front frame
      const pos = g.getAttribute('position');
      for (let k = 0; k < pos.count; k++) {
        const x = pos.getX(k), o = -pos.getZ(k), y = pos.getY(k);
        pos.setXYZ(k, f.origin[0] + f.tangent[0] * (c + x) + f.n[0] * (o + 0.1), y, f.origin[1] + f.tangent[1] * (c + x) + f.n[1] * (o + 0.1));
      }
      g.computeVertexNormals();
      b.add(g, col as never);
    };
    pr(5.6, 6.1, [[-1.2, 0], [-0.8, 0.6], [0.8, 0.6], [1.2, 0]], 'sandstone');
    pr(6.1, 12.6, pts, 'sandstone');
    pr(12.6, 13.0, [[-1.5, 0], [-1.1, D + 0.1], [1.1, D + 0.1], [1.5, 0]], 'sandstone');
    // lead dome cap
    {
      const g = new T.SphereGeometry(1.0, 12, 6, 0, Math.PI, 0, Math.PI / 2);
      g.scale(1.35, 1.3, 0.85);
      const pos = g.getAttribute('position');
      for (let k = 0; k < pos.count; k++) {
        const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
        // half dome bulging out of the wall: z>=0 is the outward half
        const o = Math.abs(z);
        pos.setXYZ(k, f.origin[0] + f.tangent[0] * (c + x) + f.n[0] * (o + 0.1), 13.0 + y, f.origin[1] + f.tangent[1] * (c + x) + f.n[1] * (o + 0.1));
      }
      g.computeVertexNormals();
      b.add(g, 'greyBrick' as never);
    }
    const front: Frame = {origin: [f.origin[0] + f.n[0] * (D + 0.1), f.origin[1] + f.n[1] * (D + 0.1)], tangent: f.tangent, n: f.n};
    for (const [y0, y1] of [[6.6, 9.0], [9.9, 12.2]] as [number, number][]) {
      slab(b, front, c, y0, 1.7, y1 - y0, 0.04, 'red');
      slab(b, front, c, y0 + 0.08, 1.55, y1 - y0 - 0.16, 0.08, 'glass');
      slab(b, front, c, y0 + (y1 - y0) * 0.7, 1.55, 0.07, 0.1, 'red');
      slab(b, front, c, y1 + 0.1, 2.0, 0.2, 0.12, 'sandstone');
    }
    // windows beside the erker are absent (w04-117: brick piers); the gable above the cornice line
    slab(b, f, c, 13.9, 4.84, 0.3, 0.45, 'sandstone');
    poly(b, f, c, 14.2, [[-2.42, 0], [2.42, 0], [2.0, 0.6], [1.6, 0.9], [1.6, 2.2], [1.2, 2.7], [0.5, 3.1], [-0.5, 3.1], [-1.2, 2.7], [-1.6, 2.2], [-1.6, 0.9], [-2.0, 0.6]], 0.4, 'brick', -0.1);
    // scrolled stone edge and pediment top
    for (const s of [-1, 1]) poly(b, f, c + s * 1.8, 14.2, [[-0.35, 0], [0.35, 0], [0.2, 2.2], [-0.2, 2.2]], 0.48, 'sandstone', -0.1);
    poly(b, f, c, 17.25, [[-1.4, 0], [1.4, 0], [0, 0.55]], 0.5, 'sandstone', -0.1);
    // oculus: a round dark light in a stone ring (built from slabs: a square ring of four, then the dark disc proud of it)
    for (const [dt, dy, w, h] of [[0, 0.42, 0.9, 0.18], [0, -0.42, 0.9, 0.18], [-0.42, 0, 0.18, 0.9], [0.42, 0, 0.18, 0.9]] as [number, number, number, number][]) slab(b, f, c + dt, 15.6 + dy - h / 2, w, h, 0.52, 'sandstone', -0.1);
    archSlab(b, f, c, 15.25, 0.66, 0.7, 0.5, 'dark', -0.1, 10);
  }

  // ---------- Spuistraat back: the later brick hotel block, white-framed windows in a grid ----------
  for (const idx of [18, 20]) {
    const w = rawWall(src as never, idx);
    const fr = w.f as Frame;
    const yTop = w.top - 1.2;
    const y0 = Math.max(w.base + 3.6, 3.6);
    const n = Math.max(1, Math.floor((w.len - 0.6) / 2.4));
    const pitch = w.len / n;
    if (w.base < 1) slab(b, fr, w.len / 2, 0, w.len - 0.4, 3.0, 0.12, 'glass');
    for (let y = y0; y + 1.7 <= yTop; y += 3.0) for (let k = 0; k < n; k++) {
      const t = pitch * (k + 0.5);
      slab(b, fr, t, y, 1.5, 1.8, 0.08, 'white');
      slab(b, fr, t, y + 0.08, 1.34, 1.64, 0.12, 'glass');
      slab(b, fr, t, y + 1.2, 1.34, 0.06, 0.16, 'white');
    }
  }
  // ---------- Spuistraat: the stepped-gable house in the pand (w02-290, 7 m; 3DBAG walls 9 and 13) ----------
  {
    const w = rawWall(src as never, 9), w13 = rawWall(src as never, 13);
    const fr = w.f as Frame;
    const along = (p: [number, number]) => (p[0] - fr.origin[0]) * fr.tangent[0] + (p[1] - fr.origin[1]) * fr.tangent[1];
    const end = (q: {f: {origin: [number, number]; tangent: [number, number]}; len: number}): [number, number] => [q.f.origin[0] + q.f.tangent[0] * q.len, q.f.origin[1] + q.f.tangent[1] * q.len];
    const ts = [along(w.f.origin as [number, number]), along(end(w as never)), along(w13.f.origin as [number, number]), along(end(w13 as never))];
    const c = (Math.min(...ts) + Math.max(...ts)) / 2;
    // Heights read off the w02-290 crop (gable foot 13.9, top 20.2) scaled by K so the gable foot meets the 3DBAG eave (11.7 m)
    // and the top its 16.6-17 m gable walls: the crop's vertical scale ran 19 % long.
    const K = 0.84, Y = (v: number) => v * K;
    const steps: [number, number][] = ([[3.55, 13.9], [3.0, 14.8], [2.45, 15.9], [1.85, 16.9], [1.25, 17.9], [0.7, 18.9], [0.3, 20.2]] as [number, number][]).map(([hw, y]) => [hw, Y(y)]);
    const foot = steps[0][1];
    const outline: [number, number][] = [];
    steps.forEach(([hw, y], i) => { const yn = steps[i + 1]?.[1]; outline.push([hw, y - foot]); if (yn !== undefined) outline.push([hw, yn - foot]); });
    const right = outline.slice(), left = outline.slice().reverse().map(([x, y]) => [-x, y] as [number, number]);
    poly(b, fr, c, foot, [[-3.55, 0], [3.55, 0], ...right.slice(1), ...left.slice(0, -1)], 0.1, 'brick', 0.05);
    // the storeys are the 3DBAG brick wall itself; only the white ground floor is faced
    slab(b, fr, c, 0, 7.1, Y(6.2), 0.15, 'concrete');
    for (const [hw, y] of steps.slice(0, -1)) for (const s of [-1, 1]) slab(b, fr, c + s * (hw - 0.15), y + (y === foot ? 0.6 : 0.72), 0.42, 0.12, 0.08, 'concrete', 0.15);
    slab(b, fr, c, steps[steps.length - 1][1], 0.5, 0.25, 0.1, 'concrete', 0.05);
    slab(b, fr, c, foot - 0.17, 7.1, 0.17, 0.08, 'concrete', 0.15);
    // ground floor: white pilasters and tall many-paned windows, a dark door
    for (const t of [c - 2.3, c - 0.75, c + 2.3]) { slab(b, fr, t, 0.35, 1.15, Y(5.4), 0.2, 'glass'); slab(b, fr, t, Y(2.7), 1.15, 0.06, 0.24, 'white'); slab(b, fr, t, 0.35, 0.06, Y(5.4), 0.24, 'white'); }
    slab(b, fr, c + 0.8, 0, 0.9, 2.2, 0.22, 'dark');
    for (const [y0, y1, o, hw] of [[Y(7.3), Y(9.6), 0, 1.35], [Y(10.8), Y(12.85), 0, 1.35]] as [number, number, number, number][]) for (const t of [c - 1.6, c + 1.6]) {
      slab(b, fr, t, y0 - 0.06, hw + 0.2, y1 - y0 + 0.12, 0.2, 'white', o);
      slab(b, fr, t, y0, hw, y1 - y0, 0.24, 'glass', o);
      slab(b, fr, t, (y0 + y1) / 2, hw, 0.06, 0.28, 'white', o);
      slab(b, fr, t, y0, 0.06, y1 - y0, 0.28, 'white', o);
    }
    // The two gable lights and the hoist hatch are not drawn: above the 3DBAG eave the shell is a roof slope, and the openings
    // gate reads a light on the gable face drawn over it as buried or piercing (kit gap: gable faces over LoD2 roofs).
  }
  setSink(sink0);
}
