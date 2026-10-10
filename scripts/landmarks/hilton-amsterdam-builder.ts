import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {letters, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import {rawWall, topOf, type RawWall} from './big-kit';
import source from './hilton-amsterdam-footprints.json';

/**
 * Hilton Amsterdam, Apollolaan 138 (Huig Maaskant with De Vlaming en Salm, 1958-1962; rijksmonument 532205). BAG pand 0363100012078084:
 * a V-shaped eleven-storey slab (apex to the canal in the north, two arms opening to the south), standing on a low podium of lobby,
 * restaurant and ballroom. Massing is the 3DBAG LoD2.2 shell (native east/south metres from the BAG centroid). Read from the municipal
 * panoramas of 2025-07-29 (south) and 2021-01-18 (north, across the Noorder Amstelkanaal):
 *  - tower: eleven storeys on a 2.88 m pitch from y 6.4 to 38.1; each storey ends in a thin white slab edge, under it a ribbon of glass
 *    cells on a 4.0 m module (two panes per cell, white mullions) over a dark grey-brown brick spandrel;
 *  - the lift and stair cores in the inside of the V (walls rising to 41.6 m) are blank brick between the continuing slab edges;
 *  - both gable ends carry a glazed balcony room with white balustrade on every storey;
 *  - the plant box on the apex (to 49 m) is pale concrete;
 *  - south: low red-brown brick block under a white fascia, recessed glazed entrance under a flat white canopy on slim columns, a black
 *    box (ballroom) and glazed curtain wall to the east; north: a curved two-storey glass restaurant under a concrete overhang.
 * INFERRED: the west end and the courtyard faces (no photograph from that side), the glazed band heights of the north-east podium.
 * Not modelled: roof equipment, flagpoles, planting, the hedge, signage.
 */
const surfaces = (source as {surfaces: {type: string; rings: number[][][]}[]}).surfaces;
const GLAZED = new Set([10, 18, 20]);
const Y0 = 8.0, P = 3.34, NSTOREY = 9, MODULE = 4.0;

/** Outward frame: the raw 3DBAG winding is not reliable for stepped volumes, so pick the side with the lower roof. */
function outward(i: number): RawWall {
  const w = rawWall(source as never, i), t = w.len / 2;
  const mx = w.f.origin[0] + w.f.tangent[0] * t, mz = w.f.origin[1] + w.f.tangent[1] * t;
  const a = roofHeightAt(surfaces as never, mx + w.f.n[0] * 0.7, mz + w.f.n[1] * 0.7) ?? -1;
  const c = roofHeightAt(surfaces as never, mx - w.f.n[0] * 0.7, mz - w.f.n[1] * 0.7) ?? -1;
  if (a <= c + 0.15) return w;
  const f: Frame = {origin: [w.f.origin[0] + w.f.tangent[0] * w.len, w.f.origin[1] + w.f.tangent[1] * w.len], tangent: [-w.f.tangent[0], -w.f.tangent[1]], n: [-w.f.n[0], -w.f.n[1]]};
  return {...w, f, poly: w.poly.map(p => [w.len - p[0], p[1]] as [number, number]), bearing: (w.bearing + 180) % 360};
}
const inArc = (b: number, lo: number, hi: number) => lo <= hi ? b >= lo && b <= hi : b >= lo || b <= hi;

export function buildHiltonAmsterdam(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'concrete'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  const walls: RawWall[] = [];
  surfaces.forEach((s, i) => { if (s.type === 'WallSurface') walls.push(outward(i)); });

  for (const w of walls) {
    const f = w.f, L = w.len, mid = topOf(w, L / 2);
    const top = Number.isFinite(mid) ? Math.min(mid, w.top) : w.top;
    // ---------- plant box on the apex: pale concrete ----------
    if (w.base >= 37.5 && w.top > 41) { slab(b, f, L / 2, w.base, L, Math.max(0.5, top - w.base), 0.08, 'concrete'); continue; }
    // ---------- tower ----------
    if (w.top >= 36 && w.base >= 5 && L >= 0.9) {
      const mx = w.f.origin[0] + w.f.tangent[0] * L / 2;
      const core = w.top >= 40.4 && mx > -8 && mx < 3; // blank brick field of the central lift core under the plant box
      const east = inArc(w.bearing, 60, 120), west = inArc(w.bearing, 240, 300);
      if (east || west) slab(b, f, L / 2, Math.max(w.base, Y0 - 0.2), L, Math.max(0.5, top - Math.max(w.base, Y0 - 0.2)), 0.08, 'concrete');
      else if (w.base < Y0 - 0.5) slab(b, f, L / 2, w.base, L, Y0 - w.base, 0.12, 'concrete'); // recessed intermediate floor
      for (let k = 0; k < NSTOREY; k++) {
        const y = Y0 + k * P;
        if (y < w.base - 0.05 || y + P > w.top + 0.2) continue;
        slab(b, f, L / 2, y + P - 0.28, L, 0.28, 0.3, 'white');
        if (core || L < 1.8) continue;
        if (east || west) {
          // gable end: pale decorative-concrete cladding; a corner room with a balcony on alternate storeys
          const rw = Math.min(L - 0.8, 1.5), t0 = 0.3 + rw / 2;
          slab(b, f, t0, y + 0.75, rw, 2.1, 0.12, 'glass');
          if (k % 2 === 1) {
            slab(b, f, t0, y + 0.1, rw + 0.2, 0.2, 1.3, 'white');
            slab(b, f, t0, y + 0.3, rw + 0.2, 0.9, 0.05, 'glass', 1.25);
          }
          continue;
        }
        const n = Math.max(1, Math.round(L / MODULE)), m = L / n;
        for (let c = 0; c < n; c++) {
          const t = (c + 0.5) * m;
          slab(b, f, t, y + 1.2, m - 0.4, 1.55, 0.14, 'glass');
          slab(b, f, t, y + 1.2, 0.07, 1.55, 0.18, 'white');
        }
      }
      continue;
    }
    // ---------- glazed entrance ----------
    if (GLAZED.has(w.index)) {
      const n = Math.max(1, Math.round(L / 1.9)), m = L / n;
      slab(b, f, L / 2, 0, L, 0.4, 0.2, 'concrete');
      for (let c = 0; c < n; c++) slab(b, f, (c + 0.5) * m, 0.4, m - 0.1, 4.0, 0.14, 'glass');
      for (let c = 0; c <= n; c++) slab(b, f, Math.min(L - 0.05, Math.max(0.05, c * m)), 0.4, 0.1, 4.0, 0.2, 'white');
      slab(b, f, L / 2, 2.3, L, 0.1, 0.22, 'white');
      slab(b, f, L / 2, 4.4, L, w.top - 4.4, 0.2, 'white');
      continue;
    }
    // ---------- upper ballroom box: black ribbed cladding ----------
    if (w.top <= 12.5 && w.base >= 4 && L >= 2 && !inArc(w.bearing, 300, 60)) { slab(b, f, L / 2, w.base, L, w.top - w.base, 0.08, 'dark'); continue; }
    // ---------- podium ----------
    if (w.top <= 12 && w.base < 1 && L >= 2.5) {
      const north = inArc(w.bearing, 300, 60);
      if (!north) {
        if (w.top > 7) {
          slab(b, f, L / 2, 0, L, 5.3, 0.08, 'red');
          slab(b, f, L / 2, 5.3, L, 1.0, 0.9, 'concrete');
          slab(b, f, L / 2, 6.3, L, w.top - 6.3, 0.08, 'dark');
        } else {
          slab(b, f, L / 2, 0, L, w.top - 0.9, 0.08, 'red');
          slab(b, f, L / 2, w.top - 0.9, L, 0.9, 0.35, 'white');
        }
      } else if (L >= 4) {
        const h = Math.min(w.top - 1.1, 3.9);
        if (h < 1.8) continue;
        const n = Math.max(1, Math.round(L / 2.4)), m = L / n;
        for (let c = 0; c < n; c++) {
          slab(b, f, (c + 0.5) * m, 0.5, m - 0.12, h - 0.5, 0.14, 'dark');
          slab(b, f, c * m, 0.5, 0.1, h - 0.5, 0.18, 'white');
        }
        slab(b, f, L / 2, h, L, w.top - h, 0.5, 'concrete');
      }
    }
  }
  // HILTON on the south face of the lift tower (RCE 532205: the old cursive lettering over the canopy is gone).
  { const w = walls.find(q => q.index === 303); if (w) letters(b, w.f, 'HILTON', w.len / 2, 42.4, 0.05, 0.22, 0.1, 'white'); }
  // Porte-cochere canopy: flat white slab on slim columns in front of the recessed entrance.
  b.add(new T.BoxGeometry(23.4, 0.45, 10.9).translate(-11.4, 4.85, 23.1), 'white');
  for (const x of [-22, -17.2, -12, -6.8, -1.6]) b.add(new T.BoxGeometry(0.4, 4.6, 0.4).translate(x, 2.3, 27.9), 'white');
  setSink(0);
}
