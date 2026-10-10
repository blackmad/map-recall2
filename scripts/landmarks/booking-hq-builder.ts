import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {letters, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import {rawWall, topOf, type RawWall} from './big-kit';
import source from './booking-hq-footprints.json';

/**
 * Booking.com headquarters, Oosterdokskade 163 (UNStudio, completed 2023). BAG pand 0363100012250152 holds the whole complex: the
 * 51,543 m2 kantoorfunctie verblijfsobject at Oosterdokskade 163 (12 storeys) plus ~60 dwellings in the same building (Ton de Leeuwstraat),
 * 8,443 m2 footprint, roof 37 to 51 m. Massing is the 3DBAG LoD2.2 shell (native east/south metres from the footprint vertex mean).
 * Read from the municipal panoramas of 2025-06-17 and 2025-10-01 (artifacts/landmark-lanes/booking-hq):
 *  - office wings (roof 37-44 m): continuous glass curtain wall, vertical mullions every 1.5 m, a dark slab edge every 4.2 m;
 *    the south front reads as stacked glass bands with dark soffits over a double-height glazed ground floor;
 *  - residential tower (west block, 48-51 m): dark-grey anodised frame grid, window ribbon per storey on a 3.2 m pitch between dark
 *    piers every 3 m, slim balcony rails on every other storey;
 *  - the white "Booking.com" sign sits on the first terrace of the south front (set in capitals: the kit has no lower case).
 * INFERRED: every wall not photographed (north, east, courtyard walls) uses the same module.
 * Not modelled: the stepped-terrace setbacks beyond the 3DBAG steps, planting, roof plant, flags.
 */
const surfaces = (source as {surfaces: {type: string; rings: number[][][]}[]}).surfaces;

function outward(i: number): RawWall {
  const w = rawWall(source as never, i), t = w.len / 2;
  const mx = w.f.origin[0] + w.f.tangent[0] * t, mz = w.f.origin[1] + w.f.tangent[1] * t;
  const a = roofHeightAt(surfaces as never, mx + w.f.n[0] * 0.7, mz + w.f.n[1] * 0.7) ?? -1;
  const c = roofHeightAt(surfaces as never, mx - w.f.n[0] * 0.7, mz - w.f.n[1] * 0.7) ?? -1;
  if (a <= c + 0.15) return w;
  const f: Frame = {origin: [w.f.origin[0] + w.f.tangent[0] * w.len, w.f.origin[1] + w.f.tangent[1] * w.len], tangent: [-w.f.tangent[0], -w.f.tangent[1]], n: [-w.f.n[0], -w.f.n[1]]};
  return {...w, f, poly: w.poly.map(p => [w.len - p[0], p[1]] as [number, number]), bearing: (w.bearing + 180) % 360};
}

export function buildBookingHq(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'dark', roof: 'concrete'});
  b.mark?.('shell');
  // Shell repair: 3DBAG wall 52 is a single triangle (A, B, C of the quad A-B-D-C); its companion triangle B-D-C is missing from the
  // LoD2.2 data and leaves an open slit in the shell. Add it, wound like the surviving triangle, so the wall is whole again.
  { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([-24.16, 0, -25.81, -23.27, 0, -15.84, -23.27, 47.94, -15.84], 3)); g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1], 2)); g.computeVertexNormals(); b.add(g, 'dark' as never); }
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  const walls: RawWall[] = [];
  surfaces.forEach((s, i) => { if (s.type === 'WallSurface') walls.push(outward(i)); });
  for (const w of walls) {
    const f = w.f, L = w.len;
    if (L < 1.4) continue;
    const mid = topOf(w, L / 2), top = Number.isFinite(mid) ? Math.min(mid, w.top) : w.top;
    const y0 = Math.max(w.base, 0), h = top - y0;
    if (h < 2.5) continue;
    const tower = w.top >= 46.5 && w.base < 2 && L >= 2;
    if (tower) {
      // residential tower: dark frame, glass ribbon per storey, piers every ~3 m, balcony rail on alternate storeys
      const P = 3.2, n0 = Math.floor((top - 4.2) / P);
      for (let k = 0; k < n0; k++) {
        const y = 4.2 + k * P;
        slab(b, f, L / 2, y, L - 0.2, 0.5, 0.1, 'dark');
        slab(b, f, L / 2, y + 0.5, L - 0.2, 2.1, 0.06, 'glass');
        if (k % 2 === 1 && L > 4) slab(b, f, L / 2, y + 0.5, L - 0.4, 0.9, 0.28, 'frame');
      }
      const n = Math.max(1, Math.round(L / 3));
      for (let c = 0; c <= n; c++) slab(b, f, Math.min(L - 0.1, Math.max(0.1, c * L / n)), y0, 0.2, h, 0.16, 'dark');
      slab(b, f, L / 2, 0, L, 4.2, 0.08, 'glass'); // glazed ground floor
      continue;
    }
    // office wings: glass curtain wall between dark slab edges every 4.2 m (storeys count up from the wall's own base)
    const P = 4.2, yb = y0 < 2 ? 4.6 : y0 + 0.6, n0 = Math.max(1, Math.floor((top - yb) / P));
    if (y0 < 2) slab(b, f, L / 2, y0, L - 0.1, Math.min(4.6, h), 0.06, 'glass');
    for (let k = 0; k < n0; k++) {
      const y = yb + k * P;
      if (y + 1 > top) break;
      slab(b, f, L / 2, y, L, 0.55, 0.3, 'dark');
      slab(b, f, L / 2, y + 0.55, L - 0.1, Math.min(P - 0.55, top - y - 0.55), 0.06, 'glass');
    }
    slab(b, f, L / 2, Math.max(y0, top - 0.5), L, 0.5, 0.3, 'dark');
    const n = Math.max(1, Math.round(L / 1.5));
    for (let c = 0; c <= n; c++) slab(b, f, Math.min(L - 0.04, Math.max(0.04, c * L / n)), y0, 0.07, h - 0.5, 0.12, 'dark');
  }
  // sign on the first terrace of the south front
  { const w = walls.find(q => q.index === 72); if (w) letters(b, w.f, 'BOOKING.COM', 14, 9.2, 0.06, 0.28, 0.1, 'white'); }
  setSink(0);
}
