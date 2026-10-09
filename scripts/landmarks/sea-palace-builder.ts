import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import {fitObb, frustum, ridgedHip, toLocal} from './nightlife-geometry';
import data from './sea-palace-footprints.json';

/**
 * Sea Palace, the floating Chinese pagoda restaurant beside Oosterdokskade (floating since 1984, three
 * floors plus roof terrace). The hull is the real houseboat-extract outline w454006714, measured from the
 * POI. Tier layout, red columns, dark balustrades with gold medallions and green tiled eaves read from the
 * 2025 municipal panorama; heights approximate (OSM: 9 m to the eaves, 4 m roof).
 */
export function buildSeaPalace(_w: number, _d: number, b: BuildingTools) {
  const {add, box} = b;
  const anchor = data.identity.poiCoordinateLonLat;
  const ring = toLocal(data.houseboatRepresentation.ring, anchor).slice(0, -1);
  const o = fitObb(ring), ux = Math.sin(o.ang), uz = Math.cos(o.ang);
  // t across the hull (local x), s along it (local z)
  const at = (t: number, s: number) => [o.cx + ux * s + uz * t, o.cz + uz * s - ux * t];
  const put = (t: number, y: number, s: number, w: number, h: number, d: number, c: Parameters<typeof add>[1]) => { const [x, z] = at(t, s); box(x, y, z, w, h, d, c, o.ang); };
  const solid = (g: T.BufferGeometry, c: Parameters<typeof add>[1]) => add(g, c, o.cx, 0, o.cz, o.ang);

  // Pontoon hull on the real outline: red-edged dark float, flat deck.
  const shape = new T.Shape(ring.map(r => new T.Vector2(r[0], r[1])));
  add(openTopPrism(shape, -0.9, 0.4), 'dark');
  add(upwardRoofPlane(shape, 0.4), 'stone');
  const fascia = openTopPrism(shape, 0.0, 0.4), fp = fascia.getAttribute('position');
  for (let i = 0; i < fp.count; i++) { fp.setX(i, fp.getX(i) + (fp.getX(i) - o.cx) * 0.003); fp.setZ(i, fp.getZ(i) + (fp.getZ(i) - o.cz) * 0.003); }
  add(fascia, 'red');

  const HL = o.hl, HW = o.hw;
  // tiers: [wall half-width, wall half-length, base y, wall height]
  const tiers = [
    {hw: HW - 2.4, hl: HL - 2.4, y: 0.4, h: 2.7, rail: 0.7},
    {hw: HW - 3.7, hl: HL - 3.7, y: 4.0, h: 2.5, rail: 2.1},
    {hw: HW - 5.4, hl: HL - 5.4, y: 7.4, h: 2.1, rail: 3.9},
  ];
  const eaves = [
    {out: 0.5, in: 2.1, y: 3.1, rise: 0.9},
    {out: 2.3, in: 3.9, y: 6.5, rise: 0.9},
  ];
  tiers.forEach((t, i) => {
    // brick body with red columns and a glazed band
    solid(new T.BoxGeometry(t.hw * 2, t.h, t.hl * 2).translate(0, t.y + t.h / 2, 0), 'brick');
    for (const side of [-1, 1]) {
      const n = Math.max(3, Math.round(t.hl * 2 / 3.2));
      for (let k = 0; k <= n; k++) {
        const s = -t.hl + (t.hl * 2) * k / n;
        put(side * (t.hw + 0.1), t.y, s, 0.4, t.h, 0.4, 'red');
        if (k < n) put(side * (t.hw + 0.04), t.y + (i ? 0.9 : 0.6), s + t.hl / n, 0.1, t.h - (i ? 1.7 : 1.0), (t.hl * 2) / n - (i ? 1.6 : 0.6), 'glass');
      }
      const m = Math.max(2, Math.round(t.hw * 2 / 3.2));
      for (let k = 0; k <= m; k++) {
        const tt = -t.hw + (t.hw * 2) * k / m;
        put(tt, t.y, side * (t.hl + 0.1), 0.4, t.h, 0.4, 'red');
        if (k < m) put(tt + t.hw / m, t.y + (i ? 0.9 : 0.6), side * (t.hl + 0.04), (t.hw * 2) / m - (i ? 1.6 : 0.6), t.h - (i ? 1.7 : 1.0), 0.1, 'glass');
      }
    }
    // balustrade round the tier: low dark rail, white lamp posts, gold medallions
    const rail = {hw: HW - t.rail, hl: HL - t.rail, y: t.y};
    for (const side of [-1, 1]) {
      put(side * rail.hw, rail.y + 0.25, 0, 0.12, 0.75, rail.hl * 2, 'dark');
      put(0, rail.y + 0.25, side * rail.hl, rail.hw * 2, 0.75, 0.12, 'dark');
      const n = Math.round(rail.hl * 2 / 3);
      for (let k = 0; k <= n; k++) {
        const s = -rail.hl + rail.hl * 2 * k / n;
        put(side * rail.hw, rail.y, s, 0.2, 1.15, 0.2, 'dark'); put(side * rail.hw, rail.y + 1.15, s, 0.28, 0.28, 0.28, 'white');
        if (k < n) put(side * (rail.hw + 0.08), rail.y + 0.45, s + rail.hl / n, 0.06, 0.35, 0.35, 'gold');
      }
      const m = Math.round(rail.hw * 2 / 3);
      for (let k = 1; k < m; k++) {
        const tt = -rail.hw + rail.hw * 2 * k / m;
        put(tt, rail.y, side * rail.hl, 0.2, 1.15, 0.2, 'dark'); put(tt, rail.y + 1.15, side * rail.hl, 0.28, 0.28, 0.28, 'white');
        put(tt + rail.hw / m, rail.y + 0.45, side * (rail.hl + 0.08), 0.35, 0.35, 0.06, 'gold');
      }
    }
  });
  // sloped green-tile eave skirts with a red fascia line
  eaves.forEach(e => {
    solid(frustum(HW - e.out, HL - e.out, e.y, HW - e.in, HL - e.in, e.y + e.rise), 'green');
    solid(frustum(HW - e.out + 0.02, HL - e.out + 0.02, e.y - 0.25, HW - e.out + 0.02, HL - e.out + 0.02, e.y + 0.05, false), 'red');
  });
  // top hipped pagoda roof
  const topO = 3.6, ridgeY = 12.8;
  solid(ridgedHip(HW - topO, HL - topO, 9.5, ridgeY - 9.5, Math.max(0.5, HL - topO - (HW - topO) - 0.5)), 'green');
  solid(frustum(HW - topO + 0.02, HL - topO + 0.02, 9.25, HW - topO + 0.02, HL - topO + 0.02, 9.55, false), 'red');
  // main entrance on the quay (north-north-east) long face: glazed doors, red carpet, small canopy
  const q = Math.sign(uz * 0.43 + ux * 0.9); // +t is (uz,-ux) in world; the quay face looks north-north-east (0.43 east, -0.90 south)
  put(q * (tiers[0].hw + 0.12), 0.4, 0, 0.12, 2.2, 3.2, 'glass');
  put(q * (tiers[0].hw + 0.9), 0.4, 0, 1.6, 0.04, 2.0, 'red');
  put(q * (tiers[0].hw + 0.4), 2.7, 0, 0.8, 0.25, 4.2, 'red');
}
