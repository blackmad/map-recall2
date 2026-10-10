import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {archBand, archSlab, awning, put, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import {carveBox} from './shell-carve';
import {facePoly} from './worship-kit';
import {bar, ellipseRing, ellipseSlab, frameAt, lancet, pointedBand, pointedSlab} from './gothic-kit';
import source from './fatih-moskee-footprints.json';

/**
 * Fatih Mosque, Rozengracht 150: H.W. Valk's Sint-Ignatiuskerk of 1929 (De Zaaier), a mosque since 1981. Massing is the
 * 3DBAG LoD2.2 shell of the whole pand in native east/south metres (nave, twin-tower front, rectory at the west end).
 * The street front is one plane (bearing 158 degrees, over the Rozengracht tram lane); every detail below is measured by
 * eye from the 2024/2025 municipal panoramas and positioned along that plane from its west end (t = 0 at the rectory):
 *  - left (west) tower t 10-17.7, gable t 17.7-25.2, right (east) tower t 25.2-30.9 (the right tower is the narrower);
 *  - gable: three pointed door arches over the old main entrance (now shops), a corbelled blind arcade of four lancets under
 *    a string course, and the elliptical star-tracery rose with a stepped brick surround;
 *  - towers: a pair of lancets under a shared hood at the top of the visible shaft and two storeys of flat paired windows
 *    below it, shopfronts with a dark fascia and awning at street level; belfry louvres under the slate caps (from a
 *    distant oblique view, so the belfries are the least certain part);
 *  - rectory at the west end (t 1-9.7): paired white sashes in three storeys, a triple window under the cornice.
 * The nave's long walls and the north end are blank brick: they stand behind ordinary neighbours and the monument
 * description calls the Bloemstraat elevation nearly blind. Those faces are inferred, not photographed.
 */
const P0: [number, number] = [-7.05, 25.141];
const N: [number, number] = [0.3781, 0.9255];

export function buildFatihMoskee(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  setSink(0.2);
  const F = frameAt(P0, N);
  // 3DBAG merges the left tower into the gable (a 28 m wall where the gable is 15-21 m), so the 8 m deep front block is cut
  // out of the shell and rebuilt: two 7.2 m towers (t 9.5-16.7 and 23.7-30.85) with slate pyramids and the nave's steep gable
  // between them (apex 21.1 m at t 20.2, the same 57.5 degree planes as the nave roof that continues behind it).
  const D = 9.8, T0 = 9.5, T1 = 30.85, TL1 = 16.7, TR0 = 23.7, GA = 21.12;
  addShell(b, carveBox(source as never, F, {t0: T0, t1: T1, d0: -D, d1: 0.4}), {wall: 'brick', roof: 'slate'});
  b.mark?.('shell');
  const world = (t: number, y: number, d: number) => [F.origin[0] + F.tangent[0] * t + F.n[0] * d, y, F.origin[1] + F.tangent[1] * t + F.n[1] * d];
  const tower = (t0: number, t1: number) => {
    put(b, F, new T.BoxGeometry(t1 - t0, 28.3, D).translate(0, 14.15, -D / 2), (t0 + t1) / 2, 0, 0, 'brick');
    // dark eaves fascia and the slate pyramid, with a 0.4 m overhang
    const o = 0.4, ya = 28.1, yb = 28.6, apex = 37.3, tc = (t0 + t1) / 2, dc = -D / 2;
    put(b, F, new T.BoxGeometry(t1 - t0 + 2 * o, yb - ya, D + 2 * o).translate(0, (yb - ya) / 2, -D / 2), tc, ya, 0, 'dark');
    const base = [[t0 - o, 0.4], [t1 + o, 0.4], [t1 + o, -D - 0.4], [t0 - o, -D - 0.4]] as [number, number][];
    for (let i = 0; i < 4; i++) {
      const a = base[i], c = base[(i + 1) % 4];
      const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
      const out = [F.tangent[0] * (mid[0] - tc) + F.n[0] * (mid[1] - dc), 1.6, F.tangent[1] * (mid[0] - tc) + F.n[1] * (mid[1] - dc)];
      facePoly(b, [world(a[0], yb, a[1]), world(c[0], yb, c[1]), world(tc, apex, dc)], 'slate', out, 'roof');
    }
    // gilt ball and spike
    const [fx, , fz] = world(tc, 0, dc);
    b.add(new T.CylinderGeometry(0.05, 0.1, 1.8, 6).translate(fx, apex + 0.9, fz), 'gold' as never);
    b.add(new T.SphereGeometry(0.22, 8, 6).translate(fx, apex + 0.75, fz), 'gold' as never);
  };
  tower(T0, TL1);
  tower(TR0, T1);
  {
    // gable: front wall pentagon, two roof planes (same plane as the nave roof behind)
    // The nave ridge drifts 0.0125 m per metre of depth (0.7 degrees off this frame): follow the shell's own planes so the
    // join at the cut is exact. Slope 1.575 (57.6 degrees), apex 21.12 m.
    const k = 1.575, ridgeT = (d: number) => 20.19 - 0.0125 * d;
    const yAt = (t: number, d: number, sgn: number) => GA - k * (sgn < 0 ? ridgeT(d) - t : t - ridgeT(d));
    const pts: [number, number][] = [[TL1, 0], [TR0, 0], [TR0, yAt(TR0, 0, 1)], [ridgeT(0), GA], [TL1, yAt(TL1, 0, -1)]];
    facePoly(b, pts.map(([t, y]) => world(t, y, 0)), 'brick', [F.n[0], 0, F.n[1]]);
    for (const sgn of [-1, 1]) {
      const te = sgn < 0 ? TL1 : TR0;
      facePoly(b, [world(te, yAt(te, 0, sgn), 0), world(ridgeT(0), GA, 0), world(ridgeT(-D), GA, -D), world(te, yAt(te, -D, sgn), -D)], 'slate', [F.tangent[0] * sgn * k, 1, F.tangent[1] * sgn * k], 'roof');
    }
  }

  /** Flat sash window: stone sill, white frame, glass, centre bar. */
  const sash = (t: number, y: number, w: number, h: number, bars = 1) => {
    slab(b, F, t, y - 0.1, w + 0.4, 0.1, 0.18, 'stone');
    slab(b, F, t, y - 0.03, w + 0.16, h + 0.1, 0.07, 'frame');
    slab(b, F, t, y, w, h, 0.1, 'glass');
    for (let k = 1; k <= bars; k++) slab(b, F, t - w / 2 + w * k / (bars + 1), y, 0.05, h, 0.13, 'frame');
    slab(b, F, t, y + h * 0.66, w, 0.05, 0.13, 'frame');
  };
  /** Pair of flat windows with a shared stone lintel. */
  const pair = (tc: number, sp: number, y: number, w: number, h: number) => {
    for (const s of [-1, 1]) sash(tc + s * sp / 2, y, w, h, 0);
    slab(b, F, tc, y + h + 0.05, sp + w + 0.5, 0.14, 0.14, 'stone');
  };
  /** Pair of lancets under a shared pointed hood. */
  const lancetPair = (tc: number, sp: number, y: number, w: number, h: number) => {
    for (const s of [-1, 1]) lancet(b, F, tc + s * sp / 2, y, w, h, w * 0.7, {mullion: false});
    pointedBand(b, F, tc, y + h - w * 0.7 - 0.2, sp + w + 0.5, w * 0.7 + 1.3, 0.75, 0.13, 0.1, 'stone');
    slab(b, F, tc, y - 0.1, sp + w + 0.5, 0.1, 0.2, 'stone');
  };

  // ---- Twin towers: identical 7.2 m shafts centred on the 3DBAG cap apexes (t 13.25 and 27.2), 8 m deep ----
  const roundArcade = (f: Frame, tc: number, n: number, pitch: number, y: number) => {
    for (let k = 0; k < n; k++) {
      const t = tc + (k - (n - 1) / 2) * pitch;
      archBand(b, f, t, y, 0.78, 1.5, 0.12, 0.1, 'stone');
      archSlab(b, f, t, y + 0.1, 0.52, 1.25, 0.1, 'white');
    }
    slab(b, f, tc, y - 0.34, n * pitch + 0.5, 0.3, 0.3, 'stone');
  };
  for (const tc of [13.25, 27.2]) {
    lancetPair(tc, 1.2, 11.3, 0.85, 2.2);
    pair(tc, 1.2, 7.9, 0.85, 2.2);
    pair(tc, 1.2, 4.3, 0.85, 2.4);
    roundArcade(F, tc, 5, 1.3, 26.5);
    // shopfront: dark fascia, awning, glazing
    slab(b, F, tc, 2.8, 6.6, 0.8, 0.14, 'dark');
    awning(b, F, tc, 1.65, 6.4, 1.1, 0.7, 'dark');
    slab(b, F, tc, 0.25, 6.2, 1.6, 0.07, 'glass');
  }

  // Belfry arcades on the other tower faces (the west face is seen in the 2009 Commons view; the rest repeat it, inferred).
  {
    const U = F.tangent, mk = (p: [number, number], n: [number, number]) => frameAt(p, n);
    const at = (t: number, d: number): [number, number] => [F.origin[0] + U[0] * t + F.n[0] * d, F.origin[1] + U[1] * t + F.n[1] * d];
    const west = mk(at(T0, -D), [-U[0], -U[1]]);                 // west face of the west tower, t from the back corner forward
    roundArcade(west, 4.3, 6, 1.15, 26.5);
    archBand(b, west, 2.9, 23.3, 0.9, 1.7, 0.12, 0.1, 'stone');
    archSlab(b, west, 2.9, 23.4, 0.66, 1.5, 0.1, 'glass');
    for (const [t, d, n] of [[TL1, 0, U], [T1, 0, U]] as [number, number, number[]][]) roundArcade(mk(at(t, d), [n[0], n[1]]), 4.1, 6, 1.15, 26.5);
    roundArcade(mk(at(TR0, -D), [-U[0], -U[1]]), 4.1, 6, 1.15, 26.5);
    for (const [t0] of [[TL1], [T1]] as number[][]) roundArcade(mk(at(t0, -D), [-F.n[0], -F.n[1]]), 3.6, 5, 1.3, 26.5);
  }

  // ---- Gable, centred t 20.2 (rose and door arches measured from the 2025 panorama, 0.0196 m per pixel) ----
  {
    const g = 20.2;
    // three pointed door arches (old main entrance, now shops) over a grey stone base
    slab(b, F, g, 0, 6.7, 0.45, 0.35, 'concrete');
    for (const dt of [-2.4, 0, 2.5]) {
      const t = g + dt, w = dt === 2.5 ? 1.85 : 1.7;
      pointedBand(b, F, t, 0.4, w + 0.55, 4.1, 1.35, 0.28, 0.14, 'stone');
      pointedSlab(b, F, t, 0.4, w, 3.6, 1.05, 0.1, 'dark');
      slab(b, F, t, 0.4, w - 0.3, 2.6, 0.14, 'glass');
      slab(b, F, t, 0.4, 0.07, 2.6, 0.17, 'frame');
      slab(b, F, t, 1.3, w - 0.3, 0.06, 0.17, 'frame');
      pointedSlab(b, F, t, 3.0, w - 0.3, 0.9, 0.7, 0.14, 'glass');
    }
    for (const dt of [-1.2, 1.25]) slab(b, F, g + dt, 0, 0.45, 2.9, 0.2, 'concrete');
    // corbelled blind arcade of four lancets
    const ts = [-2.25, -0.6, 1.0, 2.5].map(d => g + d);
    for (const t of ts) {
      lancet(b, F, t, 6.0, 0.72, 2.3, 0.6, {mullion: false, sill: 'stone'});
      pointedBand(b, F, t, 7.7, 1.5, 1.4, 0.9, 0.1, 0.1, 'stone');
    }
    slab(b, F, g + 0.1, 7.95, 6.2, 0.14, 0.16, 'stone');
    for (const d of [-3.05, -1.45, 0.2, 1.75, 3.2]) {
      slab(b, F, g + d, 5.3, 0.7, 0.2, 0.12, 'greyBrick');
      slab(b, F, g + d, 5.0, 0.55, 0.2, 0.18, 'greyBrick');
    }
    // elliptical rose, white tracery star, stepped brick surround
    const rc = g + 0.15, ry = 12.4;
    ellipseRing(b, F, rc, ry, 1.5, 1.2, 1.78, 1.42, 0.12, 'stone');
    ellipseRing(b, F, rc, ry, 1.78, 1.42, 2.1, 1.7, 0.07, 'greyBrick');
    ellipseSlab(b, F, rc, ry, 1.5, 1.2, 0.08, 'glass');
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      bar(b, F, rc, ry, rc + Math.cos(a) * 1.45, ry + Math.sin(a) * 1.15, 0.1, 0.12, 'white');
    }
    for (let k = 0; k < 8; k++) {
      const a0 = k * Math.PI / 4 + Math.PI / 8, a1 = a0 + Math.PI / 4;
      bar(b, F, rc + Math.cos(a0) * 0.72, ry + Math.sin(a0) * 0.56, rc + Math.cos(a1) * 0.72, ry + Math.sin(a1) * 0.56, 0.08, 0.12, 'white');
    }
  }

  // ---- Rectory, t 1-9.7 (west end of the front) ----
  {
    pair(7.2, 1.35, 8.1, 0.95, 1.9);
    pair(7.2, 1.35, 5.0, 0.95, 1.9);
    slab(b, F, 7.2, 11.3, 2.4, 1.2, 0.08, 'glass');
    slab(b, F, 7.2, 11.2, 2.7, 0.1, 0.14, 'stone');
    for (const t of [2.0, 3.8]) { sash(t, 9.9, 0.85, 2.3); sash(t, 5.4, 0.85, 2.5); }
    // garage door and shop at street level
    slab(b, F, 6.2, 0.1, 2.3, 3.4, 0.1, 'dark');
    slab(b, F, 6.2, 0.1, 2.0, 3.3, 0.14, 'ochre');
    slab(b, F, 2.9, 0.4, 3.0, 1.9, 0.07, 'glass');
  }
  setSink(0);
  void put; void T;
}
