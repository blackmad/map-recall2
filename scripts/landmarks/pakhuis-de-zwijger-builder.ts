import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, planarPolygon} from './worship-shell';
import {poly, setSink, slab, type Frame} from './nearbar-kit';
import source from './pakhuis-de-zwijger-footprints.json';

/**
 * Pakhuis de Zwijger, Piet Heinkade 179 (J. de Bie Leuveling Tjeenk and K. Bakker, 1933-34): a cold-store warehouse, a brick box of
 * four storeys of small square windows carried out over the quay on splayed concrete piers, with two orange-shuttered stair towers
 * capped by concrete hoods. The Jan Schaeferbrug (2001) runs straight through its ground floor.
 *
 * Massing: 3DBAG LoD2.2 shell of the BAG pand (native east/south metres from the BAG centroid). 3DBAG fuses the open ground floor
 * into solid walls down to the ground, so every wall is cut at the soffit (6.0 m) and a downward-facing soffit plate closes the box;
 * the ground floor is rebuilt as a recessed brick storey behind concrete piers, with a 13 m roadway portal (the bridge road, centred
 * 11.4 m from the west end of the north and south faces, measured on the OSM road, the 2019 aerial and the municipal panoramas).
 * Faces (compass): south 196 (35.5 m, 4 rows of small windows, two towers, DE ZWYGER lettering), north 16 (34.4 m, five tall glazed
 * strips from the 2006 conversion), east 106 (28.8 m, blank brick with six pale lettering bands), west 286 (not photographed).
 */
type V = [number, number];
const HS = 6.0;                       // soffit height of the overhanging box
const S0: V = [-19.288, 17.022], S1: V = [14.814, 26.705], N0: V = [22.654, -1.046], N1: V = [-10.454, -10.418];
/** Frame on a ring edge, moved `off` metres along its outward normal onto the real 3DBAG wall plane. */
const frame = (p: V, q: V, off: number): {f: Frame; len: number} => {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]), t: V = [(q[0] - p[0]) / len, (q[1] - p[1]) / len], n: V = [-t[1], t[0]];
  return {f: {origin: [p[0] + n[0] * off, p[1] + n[1] * off], tangent: t, n}, len};
};

/** Keep the part of a planar ring above y0 (Sutherland-Hodgman against one plane). */
function clipAbove(r: number[][], y0: number) {
  const ring = r.length > 1 && r[0].every((v, i) => v === r[r.length - 1][i]) ? r.slice(0, -1) : r;
  const out: number[][] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], ia = a[1] >= y0, ic = c[1] >= y0;
    if (ia) out.push(a);
    if (ia !== ic) { const k = (y0 - a[1]) / (c[1] - a[1]); out.push([a[0] + (c[0] - a[0]) * k, y0, a[2] + (c[2] - a[2]) * k]); }
  }
  return out;
}

/** Flat plate over the footprint at height y, facing down. */
function soffit(ring: number[][], y: number) {
  const pts = ring.slice(0, -1).map(p => new T.Vector2(p[0], p[1]));
  const tris = T.ShapeUtils.triangulateShape(pts, []);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pts.flatMap(p => [p.x, y, p.y]), 3));
  const idx: number[] = [];
  for (const [a, c, d] of tris) {
    const ny = (pts[c].x - pts[a].x) * (pts[d].y - pts[a].y) - (pts[c].y - pts[a].y) * (pts[d].x - pts[a].x);   // y component of (c-a)x(d-a) in x,z
    // for triangle (a,c,d) the face normal y = (dz1*dx2 - dx1*dz2); we want it negative (facing down)
    const nyReal = -ny;
    if (nyReal < 0) idx.push(a, c, d); else idx.push(a, d, c);
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildPakhuisDeZwijger(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  setSink(0.4);
  // ---- shell: walls above the soffit, all roofs, soffit plate ----
  const surfaces = (source.surfaces as {type: string; rings: number[][][]}[]).flatMap((s): {type: string; rings: number[][][]}[] => {
    // 3DBAG's 0.5 m chimney stack is 34.4 m, above the building's own roofMax of 28.0 m: cap it there
    if (s.rings[0].some(p => p[1] > 28.2)) s = {type: s.type, rings: s.rings.map(r => r.map(p => [p[0], Math.min(p[1], 28.0), p[2]]))};
    if (s.type === 'RoofSurface' && Math.max(...s.rings[0].map(p => p[1])) <= HS + 0.05) return [];   // sliver roofs of the dropped ground floor
    if (s.type !== 'WallSurface') return [s];
    if (Math.max(...s.rings[0].map(p => p[1])) <= HS + 0.05) return [];
    const ring = clipAbove(s.rings[0], HS);
    return ring.length >= 3 && planarPolygon([ring]) ? [{type: s.type, rings: [ring]}] : [];
  });
  addShell(b, {...(source as object), surfaces} as never, {wall: 'brick', roof: 'concrete'});
  b.add(soffit(source.nativeRing, HS), 'concrete' as never);
  b.mark?.('shell');

  // the 3DBAG walls sit a few decimetres off the BAG ring: south -0.28, east +0.11, north +0.27, west -0.11 m (measured on the shell)
  const S = frame(S0, S1, -0.28), E = frame(S1, N0, 0.11), N = frame(N0, N1, 0.27), W = frame(N1, S0, -0.11);
  // ---- overhang fascia (concrete edge beam) and parapet coping on every face ----
  for (const [fr, top] of [[S, 19.5], [E, 19.5], [N, 23.1], [W, 23.4]] as const) {
    slab(b, fr.f, fr.len / 2, HS - 0.95, fr.len, 0.95, 0.22, 'concrete');
    slab(b, fr.f, fr.len / 2, top - 0.36, fr.len, 0.36, 0.2, 'stone');
  }

  // ---- ground floor: recessed brick storey either side of the 13 m roadway portal, behind splayed concrete piers ----
  const PU0 = 4.9, PU1 = 17.9;                                   // portal along the south face, from the west end
  const box = (u0: number, u1: number, v0: number, v1: number, y: number, h: number, c: string) =>
    slab(b, S.f, (u0 + u1) / 2, y, u1 - u0, h, v1 - v0, c, -v1);   // v measured inland from the south face
  box(0.0, PU0, 1.5, 26.5, 0, HS, 'greyBrick');                  // west block, hard against the neighbouring warehouse
  box(PU1, 32.5, 3.0, 25.8, 0, HS, 'greyBrick');                 // east block under the overhang
  // massive concrete corner piers at the east corners (ref-east.jpg: a full-height pier block stands at the corner of the overhang and
  // closes the east gallery; the gallery itself runs behind the flared piers to a recessed brick wall)
  slab(b, S.f, S.len - 1.25, 0, 2.5, HS - 0.95, 3.0, 'concrete', -3.0);
  slab(b, N.f, 1.25, 0, 2.5, HS - 0.95, 3.0, 'concrete', -3.0);
  // glazed cafe front on the south side of the east block
  slab(b, S.f, 25.2, 0.45, 13.0, 4.4, 0.1, 'glass', -2.95);
  for (let u = 19.0; u < 32.0; u += 2.6) slab(b, S.f, u, 0.45, 0.14, 4.4, 0.16, 'concrete', -2.97);
  slab(b, S.f, 25.2, 4.85, 13.4, 0.35, 0.2, 'concrete', -3.0);
  // splayed piers: a slim column that flares into the soffit
  const pier = (f: Frame, t: number, out: number) =>
    poly(b, f, t, 0, [[-0.34, 0], [0.34, 0], [0.34, 3.7], [1.75, HS], [-1.75, HS], [-0.34, 3.7]], 0.7, 'concrete', out);
  for (const t of [19.4, 24.1, 28.8, 33.5]) pier(S.f, t, -2.5);
  for (const t of [3.3, 8.1, 12.9, 17.7, 22.5, 26.9]) pier(E.f, t, -2.5);
  for (const t of [3.0, 7.6, 12.2]) pier(N.f, t, -2.5);
  pier(S.f, 2.2, -1.4);
  // portal: grey steel portal beam over the road, and the dark brick flanks
  slab(b, S.f, (PU0 + PU1) / 2, HS - 1.25, PU1 - PU0, 0.5, 0.5, 'concrete', -0.5);

  // ---- south face: 4 rows of small square windows in three blocks, two stair towers, DE ZWYGER lettering ----
  {
    const f = S.f, rows = [1.95, 5.2, 8.5, 11.4].map(c => HS + c - 0.38);
    const cols = [5.2, 7.1, 9.0, 16.5, 18.3, 20.2, 27.6, 29.4, 31.1, 32.9];
    for (const u of cols) for (const y of rows) {
      slab(b, f, u, y - 0.08, 0.96, 0.08, 0.14, 'stone');                 // sill
      slab(b, f, u, y + 0.76, 0.9, 0.07, 0.13, 'stone');                // lintel
      slab(b, f, u, y, 0.76, 0.76, 0.12, 'glass');
    }
    // Stair towers as in the 2005 survey photograph (ref-south.jpg): five shuttered modules between concrete pilasters, black joints between
    // them; the west tower has one open dark stair window as its second module from the bottom, both tops carry a small dark slot.
    const tower = (uc: number, open: boolean) => {
      for (const s of [-1, 1]) slab(b, f, uc + s * 1.3, HS, 0.44, 22.0 - HS, 0.45, 'stone');       // concrete pilasters
      slab(b, f, uc, HS, 2.1, 15.8, 0.1, 'greyBrick');                                               // dark shaft behind the shutters
      const mh = 15.4 / 5;
      for (let k = 0; k < 5; k++) {
        const y0 = HS + 0.15 + k * mh;
        if (open && k === 1) slab(b, f, uc, y0 + 0.15, 1.75, mh - 0.45, 0.2, 'dark');               // open stair window
        else slab(b, f, uc, y0 + 0.15, 1.75, mh - 0.45, 0.23, 'red');                                 // boarded orange shutters
        if (k === 4) slab(b, f, uc, y0 + 1.2, 0.5, 0.9, 0.26, 'dark');                               // slot under the hood
        slab(b, f, uc, y0 + mh - 0.3, 2.0, 0.14, 0.18, 'greyBrick');                                  // black joint
      }
      slab(b, f, uc, 21.55, 3.9, 0.55, 1.3, 'stone');                                                // flat concrete hood
      slab(b, f, uc, 22.1, 3.5, 0.25, 0.9, 'stone');
    };
    tower(13.0, true); tower(23.75, false);
    // concrete DE ZWYGER lettering over the east end of the overhang, as on the original front
    glyphs(b, f, 'DE ZWYGER', 28.6, HS + 0.32, 0.0, 0.1, 0.07, 'bronze');
  }

  // ---- north face: five tall glazed strips (narrow, wide, narrow, wide, narrow) between brick piers ----
  {
    const f = N.f, y0 = HS + 0.9, y1 = 22.3, st = (y1 - y0) / 4;
    const strips: [number, number][] = [[3.4, 1.8], [10.3, 3.8], [17.2, 1.8], [24.1, 3.8], [31.0, 1.8]];
    for (const [t, w] of strips) {
      const proj = 0.1;   // flush glazing in concrete reveals (ref-north.jpg shows no projecting bays)
      for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 + 0.2), HS, 0.4, y1 + 0.7 - HS, 0.34, 'stone');   // concrete reveals
      slab(b, f, t, y0, w, y1 - y0, 0.1 + proj, 'glass');
      for (let k = 0; k <= 4; k++) slab(b, f, t, y0 + k * st - 0.2, w + 0.1, 0.42, 0.14 + proj, 'concrete');
      // thin transoms halve each storey: the photographed strips read as 7-8 glazing modules (ref-north.jpg)
      for (let k = 0; k < 4; k++) for (const q of [0.5]) slab(b, f, t, y0 + (k + q) * st - 0.04, w, 0.08, 0.13 + proj, 'concrete');
      if (w > 3) slab(b, f, t, y0, 0.12, y1 - y0, 0.16 + proj, 'concrete');
    }
  }

  // ---- east face: blank brick with pale staggered lettering bands ----
  {
    const f = E.f;
    [[5.5, 0.9], [14.4, 0], [23.3, -0.9]].forEach(([t, dy]) => [10.0, 6.7, 3.4].forEach(h => slab(b, f, t, HS + h + dy - 0.25, 5.0, 0.5, 0.07, 'stone')));
  }
  setSink(0);
}

/** 5x7 capitals for the fascia lettering; rows merged into runs. Back face at `out`. */
const GL: Record<string, string[]> = {
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
};
function glyphs(b: BuildingTools, f: Frame, text: string, t: number, y: number, out: number, px: number, d: number, colour: string) {
  const total = ([...text].length * 6 - 1) * px; let u = t - total / 2;
  for (const ch of text) {
    const rows = GL[ch];
    if (rows) for (let j = 0; j < 7; j++) {
      const row = rows[j]; let k = 0;
      while (k < 5) {
        if (row[k] !== '1') { k++; continue; }
        let e = k; while (e < 5 && row[e] === '1') e++;
        slab(b, f, u + (k + e) / 2 * px, y + (6 - j) * px, (e - k) * px, px, d, colour, out);
        k = e;
      }
    }
    u += 6 * px;
  }
}
