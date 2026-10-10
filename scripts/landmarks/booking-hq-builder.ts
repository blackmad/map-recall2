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
 * Read from the municipal panoramas of 2025-06-17 and 2025-10-01 (artifacts/landmark-lanes/booking-hq/ref-*.jpg). The BAG outline is the
 * OUTERMOST line of the stacked floor plates, so every rectangular tall wall of the shell is replaced by a stack of plates that sit on
 * that line with the glazing set back behind them (the 3DBAG walls are dropped by `skip`; the plate boxes close their loop edges):
 *  - office wings (roof 37-44 m), from the south front: glazed lobby 0-9.5 m set 2.0 m back (the photos only bound it to about 2-4 m; 2.0 is the deepest recess the existing cantilever rule of the audit accepts, 2.4 and deeper fail see-through) under a dark cantilever plate (9.4-11 m, the
 *    entrance terrace at the 11 m roof of the 3DBAG link), then glass 11-19.5 m (the sign band), plate 19.5-20.4 m with an orange soffit,
 *    glass 20.4-30.6 m with a 14.5 m wide, 3.5 m deep terrace cut at 24.4-30.3 m, plate 30.6-31.5 m, top glass to the parapet;
 *    mullions every 1.5 m, a thin transom per 4.2 m storey;
 *  - residential tower (west block, 48-51 m): glazed podium 0-11.5 m set back, plate 11.5-13.2 m, eleven storeys on a 3.2 m pitch of
 *    glass ribbon between dark floor edges, dark piers every 3.3 m, alternating balcony rails on the east and south faces;
 *  - the white "Booking.com" wordmark (lower case, kit glyphs) on the glazed band above the entrance terrace, centred 9.8 m along
 *    3DBAG wall 72 (bearing from the 2025-10-01 panorama), 15.3-16.5 m high.
 * INFERRED: every wall not photographed (north, east beyond the restaurant corner, courtyards) uses the same plate recipe; the curve of the
 * south front and the slanted fins of the terrace cuts are not modelled (the plan is the straight BAG ring). 3DBAG wall 52 is a single
 * triangle with its companion missing, repaired below.
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

/** Rectangular, ground-standing tall wall that the plate recipe replaces. */
function replaceable(w: RawWall): 'tower' | 'office' | null {
  if (w.len < 6 || w.base > 0.5 || w.top < 36) return null;
  for (const u of [0.1, 0.3, 0.5, 0.7, 0.9]) { const t = topOf(w, w.len * u); if (!Number.isFinite(t) || Math.abs(t - w.top) > 0.35) return null; }
  return w.top >= 46.5 ? 'tower' : 'office';
}
const inArc = (b: number, lo: number, hi: number) => lo <= hi ? b >= lo && b <= hi : b >= lo || b <= hi;

type Bld = BuildingTools & {mark?: (n: string) => void};

/** Plate on the BAG line: a closed box from the wall plane back `deep` metres. */
const plate = (b: Bld, f: Frame, L: number, y: number, th: number, deep: number, colour: string, t0 = 0, t1 = L) =>
  slab(b, f, (t0 + t1) / 2, y, t1 - t0, th, deep, colour, -deep);
/** Glass set `r` metres behind the BAG line. */
const glass = (b: Bld, f: Frame, t0: number, t1: number, y0: number, y1: number, r: number) => slab(b, f, (t0 + t1) / 2, y0, t1 - t0, y1 - y0, 0.12, 'glass', -r);
function mullions(b: Bld, f: Frame, t0: number, t1: number, y0: number, y1: number, r: number, pitch: number, transom: number) {
  const n = Math.max(1, Math.round((t1 - t0) / pitch));
  for (let c = 0; c <= n; c++) slab(b, f, t0 + c * (t1 - t0) / n, y0, 0.09, y1 - y0, 0.16, 'frame', -r - 0.04);
  for (let y = y0 + transom; y < y1 - 0.5; y += transom) slab(b, f, (t0 + t1) / 2, y, t1 - t0, 0.08, 0.16, 'frame', -r - 0.04);
}

function officeWall(b: Bld, w: RawWall) {
  const f = w.f, L = w.len, top = w.top, R = 2.0, r = 0.8, EM = 0.3;
  slab(b, f, L / 2, 0, L, 0.5, 0.4, 'concrete', -0.4); // sill on the ground edge
  plate(b, f, L, top - 0.7, 0.7, 0.6, 'dark'); // parapet edge
  plate(b, f, L, 0, top, 0.6, 'frame', 0, 0.3); plate(b, f, L, 0, top, 0.6, 'frame', L - 0.3, L); // end piers
  // ground floor: glazed lobby under the cantilever plate
  glass(b, f, EM, L - EM, 0.5, 9.5, R); mullions(b, f, EM, L - EM, 0.5, 9.5, R, 2.0, 4.8);
  plate(b, f, L, 9.4, 1.6, R + 0.2, 'dark', EM, L - EM);
  slab(b, f, L / 2, 9.3, L - 2 * EM, 0.1, 0.3, 'red', -R); // copper-coloured soffit strip
  const bands: [number, number][] = [[11, 19.5], [20.4, 30.6]];
  const plates: [number, number][] = [[19.5, 0.9], [30.6, 0.9]];
  // upper storeys: a plate every 5.4 m while more than 6.5 m of wall remain (the 41-44 m wings)
  let y = 31.5;
  while (top - 0.7 - y > 6.5) { bands.push([y, y + 4.2]); plates.push([y + 4.2, 0.9]); y += 5.4; }
  bands.push([y, top - 0.7]);
  // terrace cut on a south-facing wide front: deeper, 14.5 m wide, 24.4-30.3 m
  const cut = L > 30 && inArc(w.bearing, 150, 210) ? [0.0, 14.5] : null;
  bands.forEach(([y0, y1], k) => {
    if (y1 - y0 < 1) return;
    if (k === 1 && cut) {
      glass(b, f, EM, L - EM, y0, 24.4, r); mullions(b, f, EM, L - EM, y0, 24.4, r, 1.5, 4.2);
      plate(b, f, L, 24.4, 0.6, 3.7, 'dark', cut[0] + EM, cut[1]); // terrace floor
      glass(b, f, cut[0] + EM, cut[1], 25.0, y1, 3.5); mullions(b, f, cut[0] + EM, cut[1], 25.0, y1, 3.5, 1.5, 4.2);
      glass(b, f, cut[1], L - EM, 24.4, y1, r); mullions(b, f, cut[1], L - EM, 24.4, y1, r, 1.5, 4.2);
      return;
    }
    glass(b, f, EM, L - EM, y0, y1, r); mullions(b, f, EM, L - EM, y0, y1, r, 1.5, 4.2);
  });
  for (const [py, th] of plates) { plate(b, f, L, py, th, r + 0.4, 'dark', EM, L - EM); slab(b, f, L / 2, py - 0.08, L - 2 * EM, 0.08, 0.3, 'red', -r); }
}

function towerWall(b: Bld, w: RawWall) {
  const f = w.f, L = w.len, top = w.top, R = 2.0, EM = 0.3;
  const east = inArc(w.bearing, 45, 135), south = inArc(w.bearing, 135, 225);
  slab(b, f, L / 2, 0, L, 0.5, 0.4, 'concrete', -0.4);
  plate(b, f, L, top - 0.7, 0.7, 0.6, 'dark');
  plate(b, f, L, 0, top, 0.6, 'frame', 0, 0.3); plate(b, f, L, 0, top, 0.6, 'frame', L - 0.3, L);
  glass(b, f, EM, L - EM, 0.5, 11.6, R); mullions(b, f, EM, L - EM, 0.5, 11.6, R, 2.0, 4.2);
  plate(b, f, L, 11.5, 1.7, R + 0.2, 'dark', EM, L - EM);
  const P = 3.2, n = Math.floor((top - 0.7 - 13.2) / P);
  for (let k = 0; k < n; k++) {
    const y = 13.2 + k * P;
    plate(b, f, L, y, 0.45, 0.4, 'dark', EM, L - EM); // floor edge
    glass(b, f, EM, L - EM, y + 0.45, y + P, 0.4);
    if ((east || south) && k % 2 === 1) for (let t = 2.0; t < L - 2.0; t += 6.6) slab(b, f, t, y + 0.45, 2.6, 1.0, 0.5, 'frame', 0);
  }
  const np = Math.max(1, Math.round((L - 2 * EM) / 3.3));
  for (let c = 1; c < np; c++) plate(b, f, L, 13.2, top - 0.7 - 13.2, 0.4, 'frame', EM + c * (L - 2 * EM) / np - 0.14, EM + c * (L - 2 * EM) / np + 0.14);
}

/** Fallback for walls that are not rectangular/ground-standing: banding on the existing shell wall. */
function bandWall(b: Bld, w: RawWall) {
  const f = w.f, L = w.len;
  if (L < 1.4) return;
  const mid = topOf(w, L / 2), top = Number.isFinite(mid) ? Math.min(mid, w.top) : w.top;
  const y0 = Math.max(w.base, 0), h = top - y0;
  if (h < 2.5) return;
  const tower = w.top >= 46.5 && w.base < 2 && L >= 2, P = tower ? 3.2 : 4.2, yb = y0 < 2 ? 4.2 : y0 + 0.6, n0 = Math.max(1, Math.floor((top - yb) / P));
  if (y0 < 2) slab(b, f, L / 2, y0, L - 0.1, Math.min(4.2, h), 0.06, 'glass');
  for (let k = 0; k < n0; k++) {
    const y = yb + k * P;
    if (y + 1 > top) break;
    slab(b, f, L / 2, y, L, 0.5, 0.2, 'dark');
    slab(b, f, L / 2, y + 0.5, L - 0.1, Math.min(P - 0.5, top - y - 0.5), 0.06, 'glass');
  }
  const n = Math.max(1, Math.round(L / (tower ? 3 : 1.5)));
  for (let c = 0; c <= n; c++) slab(b, f, Math.min(L - 0.04, Math.max(0.04, c * L / n)), y0, 0.08, h - 0.3, 0.14, 'frame');
}

export function buildBookingHq(_w: number, _d: number, b: Bld) {
  const walls = new Map<number, RawWall>();
  surfaces.forEach((s, i) => { if (s.type === 'WallSurface') walls.set(i, outward(i)); });
  const replaced = new Map<number, 'tower' | 'office'>();
  for (const [i, w] of walls) { const k = replaceable(w); if (k) replaced.set(i, k); }
  addShell(b, source as never, {wall: 'dark', roof: 'concrete', skip: (_s, i) => replaced.has(i)});
  b.mark?.('shell');
  // Shell repair: 3DBAG wall 52 is a single triangle (A, B, C of the quad A-B-D-C); its companion triangle B-D-C is missing from the
  // LoD2.2 data and leaves an open slit in the shell. Add it, wound like the surviving triangle, so the wall is whole again.
  { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([-24.16, 0, -25.81, -23.27, 0, -15.84, -23.27, 47.94, -15.84], 3)); g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1], 2)); g.computeVertexNormals(); b.add(g, 'dark' as never); }
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  for (const [i, w] of walls) {
    const k = replaced.get(i);
    if (k === 'office') officeWall(b, w); else if (k === 'tower') towerWall(b, w); else bandWall(b, w);
  }
  // Wordmark on the glass band above the entrance terrace (wall 72, 9.8 m along: bearing 6.6 deg from the 2025-10-01 panorama).
  { const w = walls.get(72); if (w) letters(b, w.f, 'Booking.com', 9.8, 15.3, -0.7, 0.17, 0.12, 'white'); }
  setSink(0);
}
