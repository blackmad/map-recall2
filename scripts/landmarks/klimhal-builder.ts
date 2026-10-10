import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './klimhal-footprints.json';

/**
 * Klimhal Amsterdam (Naritaweg 48, 1996): a climbing hall under a leaning, doubly curved dark-brown
 * "sail" roof. The 3DBAG LoD2.2 shell only knows a 21 m flat-topped box, so the hall is lofted here from
 * the BAG footprint (native east/south metres from the anchor, +z = south) with the profile read off the
 * 2018 and 2025 panoramas:
 *  - cross-section a pointed ogive 18 m wide at the base meeting at a ridge 21 m up (half-width falls off
 *    as 1-(h/H)^1.75), end walls leaning back the same way, so the corner edges read as curved brown ribs;
 *  - east/west flanks dark brown standing-seam cladding with a tall cross-shaped window on the west flank;
 *  - glazed south (and inferred north) ends with white mullions, a white climbing sail with a grey
 *    climbing-wall panel standing proud of the glass, and a low rendered entrance block with a flat canopy
 *    and a red door on the south;
 *  - concrete boulder walls along the west foot.
 */
const H = 21.1, CX = -0.55, ZS = 9.9, ZN = -19.1, HW = 9.0, LEAN = 8;
const hw = (h: number) => HW * (1 - Math.pow(Math.min(h, H) / H, 1.75));
const zS = (h: number) => ZS - LEAN * Math.pow(Math.min(h, H) / H, 1.6);
const zN = (h: number) => ZN + LEAN * Math.pow(Math.min(h, H) / H, 1.6);

type V = [number, number, number];

/** Triangle mesh from quads, each oriented to face away from `inside`. */
function quads(list: [V, V, V, V][], inside: V): T.BufferGeometry {
  const pos: number[] = [];
  const tri = (a: V, b: V, c: V) => {
    const n = new T.Vector3(...b).sub(new T.Vector3(...a)).cross(new T.Vector3(...c).sub(new T.Vector3(...a)));
    if (n.lengthSq() < 1e-10) return;
    const m = new T.Vector3((a[0] + b[0] + c[0]) / 3 - inside[0], (a[1] + b[1] + c[1]) / 3 - inside[1], (a[2] + b[2] + c[2]) / 3 - inside[2]);
    if (n.dot(m) >= 0) pos.push(...a, ...b, ...c); else pos.push(...a, ...c, ...b);
  };
  for (const [a, b, c, d] of list) { tri(a, b, c); tri(a, c, d); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

const levels = (h0: number, h1: number, n: number) => Array.from({length: n + 1}, (_, i) => h0 + (h1 - h0) * i / n);
const INSIDE: V = [CX, 8, (ZS + ZN) / 2];

export function buildKlimhal(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const add = (g: T.BufferGeometry, c: string) => b.add(g, c as never);
  const hs = levels(0, H, 22);

  // ---- Shell: the lofted hall ----
  const east: [V, V, V, V][] = [], west: [V, V, V, V][] = [], south: [V, V, V, V][] = [], north: [V, V, V, V][] = [];
  for (let i = 0; i < hs.length - 1; i++) {
    const a = hs[i], c = hs[i + 1];
    east.push([[CX + hw(a), a, zN(a)], [CX + hw(a), a, zS(a)], [CX + hw(c), c, zS(c)], [CX + hw(c), c, zN(c)]]);
    west.push([[CX - hw(a), a, zN(a)], [CX - hw(a), a, zS(a)], [CX - hw(c), c, zS(c)], [CX - hw(c), c, zN(c)]]);
    south.push([[CX - hw(a), a, zS(a)], [CX + hw(a), a, zS(a)], [CX + hw(c), c, zS(c)], [CX - hw(c), c, zS(c)]]);
    north.push([[CX - hw(a), a, zN(a)], [CX + hw(a), a, zN(a)], [CX + hw(c), c, zN(c)], [CX - hw(c), c, zN(c)]]);
  }
  add(quads(east, INSIDE), 'bronze');
  add(quads(west, INSIDE), 'bronze');
  add(quads(south, INSIDE), 'glass');
  add(quads(north, INSIDE), 'glass');
  // Floor plate so the hall is closed at the foot.
  add(quads([[[CX - hw(0), 0, zN(0)], [CX + hw(0), 0, zN(0)], [CX + hw(0), 0, zS(0)], [CX - hw(0), 0, zS(0)]]], [CX, 5, (ZS + ZN) / 2]), 'concrete');
  // Low entrance blocks that are part of the surveyed footprint (south: door block; north: inferred twin).
  b.box(-0.5, 0, (ZS + 12.1) / 2 - 0.05, 7.0, 4.3, 12.1 - ZS + 0.1, 'white');
  b.box(-0.75, 0, (ZN + -20.35) / 2 + 0.05, 7.3, 4.3, ZN - -20.35 + 0.1, 'white');
  b.mark?.('shell');

  // Face-following strip helper: points at fixed x across heights, offset along z (outward).
  const strip = (face: 'S' | 'N', xOf: (h: number) => [number, number], h0: number, h1: number, out: number, n = 14) => {
    const q: [V, V, V, V][] = [], dir = face === 'S' ? 1 : -1, zf = face === 'S' ? zS : zN;
    const hs2 = levels(h0, h1, n);
    for (let i = 0; i < hs2.length - 1; i++) {
      const a = hs2[i], c = hs2[i + 1], [a0, a1] = xOf(a), [c0, c1] = xOf(c);
      if (a1 - a0 < 0.02 || c1 - c0 < 0.02) continue;
      q.push([[a0, a, zf(a) + dir * out], [a1, a, zf(a) + dir * out], [c1, c, zf(c) + dir * out], [c0, c, zf(c) + dir * out]]);
    }
    return q;
  };
  /** Closed prism of the face strip between out0 and out1 (front, plus the two side cheeks and the cap). */
  const sail = (face: 'S' | 'N', halfW: (h: number) => number, centre: number, h0: number, h1: number, out: number, colour: string) => {
    const front = strip(face, h => [centre - halfW(h), centre + halfW(h)], h0, h1, out, 18);
    const dir = face === 'S' ? 1 : -1, zf = face === 'S' ? zS : zN, hs2 = levels(h0, h1, 18);
    const side: [V, V, V, V][] = [];
    for (let i = 0; i < hs2.length - 1; i++) for (const s of [-1, 1]) {
      const a = hs2[i], c = hs2[i + 1];
      side.push([[centre + s * halfW(a), a, zf(a) - dir * 0.015], [centre + s * halfW(a), a, zf(a) + dir * out], [centre + s * halfW(c), c, zf(c) + dir * out], [centre + s * halfW(c), c, zf(c) - dir * 0.015]]);
    }
    const t = h1, cap: [V, V, V, V] = [[centre - halfW(t), t, zf(t) - dir * 0.015], [centre + halfW(t), t, zf(t) - dir * 0.015], [centre + halfW(t), t, zf(t) + dir * out], [centre - halfW(t), t, zf(t) + dir * out]];
    const bottom: [V, V, V, V] = [[centre - halfW(h0), h0, zf(h0) - dir * 0.015], [centre + halfW(h0), h0, zf(h0) - dir * 0.015], [centre + halfW(h0), h0, zf(h0) + dir * out], [centre - halfW(h0), h0, zf(h0) + dir * out]];
    add(quads([...front, ...side, cap, bottom], [centre, (h0 + h1) / 2, zf((h0 + h1) / 2) - dir * 1]), colour);
  };

  for (const face of ['S', 'N'] as const) {
    // Brown ribs along the two leaning corner edges.
    for (const s of [-1, 1]) {
      const hTop = H * Math.pow(1 - 1.4 / HW, 1 / 1.75);
      add(quads(strip(face, h => s < 0 ? [CX - hw(h), CX - hw(h) + 1.0] : [CX + hw(h) - 1.0, CX + hw(h)], 0, hTop, 0.028, 20), INSIDE), 'bronze');
    }
    // White mullions every 1.5 m up to where the face narrows, and two transoms.
    for (let k = -5; k <= 5; k++) {
      const x = CX + k * 1.5, hMax = H * Math.pow(1 - (Math.abs(k) * 1.5 + 1.2) / HW, 1 / 1.75);
      if (Math.abs(k) * 1.5 + 1.3 > HW || hMax < 5) continue;
      add(quads(strip(face, () => [x - 0.04, x + 0.04], 0, hMax, 0.026, 12), INSIDE), 'frame');
    }
    for (const th of [4.45, 9.4, 14.2]) add(quads(strip(face, h => [CX - hw(h) + 0.9, CX + hw(h) - 0.9], th - 0.05, th + 0.05, 0.045, 1), INSIDE), 'frame');
  }
  // Sails: grey climbing-wall panel below, white above, standing 0.35 m proud of the glass.
  const sailW = (h: number) => Math.max(0.5, Math.min(3.45, hw(h) - 1.0));
  const sailTop = 19.4;
  sail('S', sailW, -0.75, 4.55, 9.2, 0.35, 'concrete');
  sail('S', sailW, -0.75, 9.2, sailTop, 0.35, 'white');
  sail('N', sailW, -0.75, 4.55, sailTop, 0.35, 'white');

  // ---- South entrance block details ----
  b.box(-0.5, 0, 12.1 - 0.02, 7.05, 0.75, 0.06, 'dark');                 // dark plinth
  b.box(-0.5, 4.3, (ZS + 12.6) / 2, 7.9, 0.28, 12.6 - ZS, 'white');      // flat canopy
  b.box(-2.9, 0, 12.1 - 0.02, 1.05, 2.25, 0.06, 'red');                  // red door (no. 48)
  b.box(-2.9, 0.75, 12.12, 0.55, 1.3, 0.05, 'glass');
  b.box(1.7, 3.0, 12.1 - 0.02, 1.4, 0.38, 0.06, 'glass');                // ribbon window
  b.box(-0.75, 4.3, -19.9, 7.9, 0.28, 1.7, 'white');       // north canopy (inferred)

  // ---- West flank: concrete boulder walls and the cross-shaped window ----
  b.box(-9.9, 0, -14.8, 1.6, 4.2, 5.4, 'concrete');
  b.box(-9.9, 0, -10.0, 1.6, 3.1, 4.2, 'concrete');
  b.box(-9.9, 0, -2.0, 1.6, 3.8, 12.0, 'concrete');
  b.box(-9.9, 0, 6.0, 1.6, 3.4, 3.6, 'concrete');
  const wx = (h: number) => CX - hw(h) - 0.027;
  const wStrip = (zc: number, wz: number, h0: number, h1: number) => {
    const q: [V, V, V, V][] = [], hs2 = levels(h0, h1, 10);
    for (let i = 0; i < hs2.length - 1; i++) { const a = hs2[i], c = hs2[i + 1]; q.push([[wx(a), a, zc - wz / 2], [wx(a), a, zc + wz / 2], [wx(c), c, zc + wz / 2], [wx(c), c, zc - wz / 2]]); }
    return q;
  };
  add(quads(wStrip(-10.5, 1.1, 3.4, 13.8), INSIDE), 'glass');
  add(quads(wStrip(-10.5, 3.3, 13.8, 16.4), INSIDE), 'glass');
  for (const [zc, wz, h0, h1] of [[-10.5, 0.06, 3.4, 13.8], [-10.1, 0.05, 3.4, 13.8], [-10.9, 0.05, 3.4, 13.8], [-10.5, 0.06, 13.8, 16.4], [-9.7, 0.05, 13.8, 16.4], [-11.3, 0.05, 13.8, 16.4]] as const)
    add(quads(wStrip(zc, wz, h0, h1).map(q => q.map(p => [p[0] - 0.002, p[1], p[2]]) as [V, V, V, V]), INSIDE), 'frame');
  for (const h of [6.0, 8.6, 11.2, 14.9]) add(quads(wStrip(h > 14 ? -10.5 : -10.5, h > 14 ? 3.3 : 1.1, h - 0.03, h + 0.03).map(q => q.map(p => [p[0] - 0.002, p[1], p[2]]) as [V, V, V, V]), INSIDE), 'frame');
  void source;
}
