import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {ringFrame, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './room-mate-aitana-footprints.json';

/**
 * ROOM MATE AITANA (IJdok, BAG pand 0363100012239296, 2012; OSM w1088833543): the glass hotel on the IJdok, a 41-44 m slab
 * with a lower wing whose roof slopes from 34 m down to 15 m towards the Westerdok. Massing: the 3DBAG LoD2.2 shell
 * (room-mate-aitana-footprints.json, bag-shell-prepare.ts), every wall a curtain wall.
 *
 * Read from the rectified Gemeente Amsterdam panorama TMX7316010203-001899_pano_0000_000206 (2020-08-31, CC BY 4.0), w01-183,
 * the south end (ring edge 3, 24.9 m), 50 px/m, the crop base at the quay:
 *  - dark grey aluminium transoms every 1.77 m from 8.0 m (20.9, 18.5 ... 8.0 m), main mullions every 3.1 m (5.1, 11.3,
 *    17.4 m); every second band of two rows holds a strip of opening lights with mullions at 1.5 m;
 *  - below 8 m: tall glazing with one transom at 5.0 m, and a grey panelled plinth with doors to 3.1 m at t 5.1-17.4;
 *  - the glazed stair hall at t 17.4-24.9: taller panes, mullions at 19.9 and 22.3 m.
 * The thumbnail (w01-183.thumb) shows the curved glass end, simplified to the 3DBAG facets. Every other wall gets the
 * same grid, clipped to the 3DBAG wall's top so the sloping wing keeps its line.
 */
export function buildRoomMateAitana(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as {facadeRing: number[][]; surfaces: Surface[]};
  const ring = src.facadeRing;
  addShell(b, src as never, {wall: 'glass', roof: 'concrete'});
  const sink0 = getSink();
  setSink(0.04, true);
  const walls = src.surfaces.filter(s => s.type === 'WallSurface');

  /** The wall top along ring edge e: the highest point of the 3DBAG wall polygons on that edge at t. */
  const topOf = (f: Frame, len: number) => {
    const polys: [number, number][][] = [];
    for (const s of walls) {
      const pts = (s.rings[0] as number[][]).map(p => {
        const dx = p[0] - f.origin[0], dz = p[2] - f.origin[1];
        return {t: dx * f.tangent[0] + dz * f.tangent[1], d: dx * f.n[0] + dz * f.n[1], y: p[1]};
      });
      if (pts.every(p => Math.abs(p.d) < 0.6 && p.t > -0.5 && p.t < len + 0.5)) polys.push(pts.map(p => [p.t, p.y]));
    }
    return (t: number) => {
      let top = 0;
      for (const P of polys) for (let i = 0; i < P.length; i++) {
        const [a, c] = [P[i], P[(i + 1) % P.length]];
        if ((a[0] - t) * (c[0] - t) > 0 || a[0] === c[0]) continue;
        top = Math.max(top, a[1] + ((t - a[0]) / (c[0] - a[0])) * (c[1] - a[1]));
      }
      return top;
    };
  };
  /** A horizontal transom at y over t a..z, cut where the wall top drops below it (sampled every 0.5 m). */
  const transom = (f: Frame, a: number, z: number, y: number, top: (t: number) => number, h = 0.09, d = 0.1) => {
    let s: number | null = null;
    for (let t = a; t <= z + 1e-6; t += 0.5) {
      const ok = top(Math.min(t, z - 0.01)) >= y + h + 0.15 && top(Math.max(a + 0.01, Math.min(z - 0.01, t + 0.25))) >= y + h + 0.15;
      if (ok && s === null) s = t;
      if ((!ok || t + 0.5 > z + 1e-6) && s !== null) { const e = ok ? z : t; if (e - s > 0.3) slab(b, f, (s + e) / 2, y, e - s, h, d, 'frame'); s = null; }
    }
  };
  const mullion = (f: Frame, t: number, y0: number, top: (t: number) => number, w = 0.08, d = 0.14) => {
    const y1 = Math.min(top(t - w / 2 - 0.05), top(t + w / 2 + 0.05)) - 0.15;
    if (y1 - y0 > 0.3) slab(b, f, t, y0, w, y1 - y0, d, 'frame');
  };

  for (let e = 0; e < ring.length; e++) {
    const {f, len} = ringFrame(ring, e);
    if (len < 2) continue;
    const top = topOf(f, len);
    const isSouth = e === 3;
    const GRID_Y0 = 8.0, P = 1.77;
    // horizontal transoms from 8.0 m, and the 5.0 m transom and 8.0 m sill below
    for (let y = GRID_Y0; y < 46; y += P) transom(f, 0.3, len - 0.3, y, top, y === GRID_Y0 ? 0.16 : 0.09);
    transom(f, 0.3, len - 0.3, 5.0, top);
    // main mullions every 3.1 m (aligned to the south end's 5.1 m)
    const t0 = isSouth ? 5.1 % 3.1 : (len % 3.1) / 2;
    for (let t = t0; t < len - 0.3; t += 3.1) if (t > 0.3) mullion(f, t, 0, top, 0.1, 0.14);
    // strips of opening lights: every second pair of rows (rows 2 and 6 above 8 m), mullions at 1.55 m between the main ones
    for (let k = 1; GRID_Y0 + P * (k + 1) < 46; k += 4) {
      const y0 = GRID_Y0 + P * k, y1 = y0 + P;
      for (let t = t0 + 1.55; t < len - 0.1; t += 3.1) {
        if (t - 1.45 < 0.5 || t > len - 0.5 || Math.min(top(t), top(t - 1.45), top(t - 0.05)) < y1 + 0.3) continue;
        slab(b, f, t, y0 + 0.09, 0.06, P - 0.09, 0.1, 'frame');
        slab(b, f, t - 0.75, y0 + 0.2, 1.3, P - 0.31, 0.07, 'dark');
      }
    }
    if (isSouth) {
      // the grey panelled plinth with doors (t 5.1-17.4, 0-3.1 m), the stair hall mullions
      slab(b, f, 11.25, 0, 12.3, 3.1, 0.05, 'stone');
      for (let t = 6.2; t < 17.4; t += 1.25) slab(b, f, t, 0.05, 0.03, 3.0, 0.1, 'frame');
      slab(b, f, 7.1, 0, 1.6, 2.6, 0.1, 'dark');
      slab(b, f, 15.6, 0, 0.8, 2.3, 0.1, 'dark');
      for (const t of [19.9, 22.3]) mullion(f, t, 0, top, 0.08, 0.14);
    }
  }
  setSink(sink0);
}
