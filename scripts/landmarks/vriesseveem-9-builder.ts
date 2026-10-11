import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, letters, put} from './nearbar-kit';
import {rawWall} from './big-kit';
import {ribbon, beginFacade, addShellTess, windowGrid, centredColumns, claimOpening} from './big-facade';
import raw from './vriesseveem-9-footprints.json';

/**
 * Piet Hein Buildings, Piet Heinkade 61-135 (BAG pand 0363100012239869 = Vriesseveem 9 / Piet Heinkade 67 / Blauwhoedenveem 4, BAG 2013, 11
 * bouwlagen, 71 verblijfsobjecten of which 63 offices, 42,143 m2). Hans van Heeswijk Architects, construction 2008, completed 2014: four units
 * on one underground garage beside the Passenger Terminal Amsterdam, glass-clad touring-car garage at ground level, 9-storey office blocks
 * with city views and a four-storey harbour-side block, linked by glazed bridges (heeswijk.nl). The pand's own 3DBAG massing: south front on
 * Piet Heinkade 33.4 m (11 storeys), harbour (north) side 22.5 m.
 * Facade rhythm read from the 2025-06-16 municipal panoramas (artifacts/landmark-lanes/vriesseveem-9/ref-*.jpg):
 *  - south front, ref-south.jpg: grey-green aluminium panel cladding with vertical window strips (about 2.3 m wide on a 4.4 m pitch) divided by
 *    horizontal transoms (about three lights per 3 m storey) and floor bands, from pavement to roof;
 *  - the main entrance (Piet Hein 81-95) is a tall curved glazed lobby behind round grey columns with the white PIET HEIN BUILDINGS lettering,
 *    ref-entrance.jpg; the east end carries glass-block walls and a diagonal steel grille on the garage, ref-east.jpg.
 * INFERRED: the harbour (north) front, the west end and every face above the panorama reach (about 20 m): same strip module as the south front;
 * the bridges and the inner courtyard walls are not modelled.
 */
const source = {...raw, surfaces: raw.surfaces.map(s => ({...s, rings: s.rings.map(r => r.map(p => [p[0], Math.max(0, p[1]), p[2]]))}))};
const surfaces = source.surfaces as {type: string; rings: number[][][]}[];
const ring = (source as {nativeRing: number[][]}).nativeRing;

function onPerimeter(mx: number, mz: number): boolean {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1], l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((mx - a[0]) * dx + (mz - a[1]) * dz) / l2));
    if (Math.hypot(mx - (a[0] + t * dx), mz - (a[1] + t * dz)) < 0.6) return true;
  }
  return false;
}

const LOBBY = 53;

export function buildVriesseveem9(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShellTess(b, source as never, {wall: 'greyBrick', roof: 'concrete'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  beginFacade(source as never);
  setSink(0.3);
  const storey = 3.04;
  surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface') return;
    const w = rawWall(source as never, i);
    if (!(w.len >= 2.4) || !Number.isFinite(w.f.n[0]) || w.top - w.base < 3) return;
    const mx = w.f.origin[0] + w.f.tangent[0] * w.len / 2, mz = w.f.origin[1] + w.f.tangent[1] * w.len / 2;
    const perim = onPerimeter(mx, mz);
    const east = perim && w.bearing > 90 && w.bearing < 125;
    let y0 = 0.5;
    if (!perim) { y0 = Math.max(0.5, w.base + 0.4); } else if (i === LOBBY) {
      // tall glazed lobby in front of round columns, lettering PIET HEIN
      for (let t = 0.5; t + 3.4 <= w.len - 0.4; t += 3.6) ribbon(b, w, t, Math.min(t + 3.3, w.len - 0.4), 0.5, 6.4, {ring: 0.05, frame: 'frame', glass: 'glass'});
      for (let t = 1.6; t <= w.len - 1; t += 5.4) {
        const g = new T.CylinderGeometry(0.3, 0.3, 7.4, 10).translate(0, 3.7, 0);
        put(b, w.f, g, t, 0, 1.3, 'frame');
      }
      letters(b, w.f, 'PIET', w.len * 0.62, 8.1, 0.12, 0.3, 0.06, 'white');
      letters(b, w.f, 'HEIN', w.len * 0.62, 5.6, 0.12, 0.3, 0.06, 'white');
      y0 = 7.3;
    } else if (east && w.base < 0.5) {
      // glass-block garage wall (ground floor, to 6.6 m)
      for (let t = 0.6; t + 3 <= w.len - 0.4; t += 6.5) ribbon(b, w, t, Math.min(t + 6.3, w.len - 0.4), 0.4, 6.2, {ring: 0.05, frame: 'frame', glass: 'concrete'});
      y0 = 7.0;
    }
    const ww = Math.min(2.9, w.len - 0.9), c = centredColumns(w.len, 4.4, Math.max(1.6, ww / 2 + 0.5) > w.len / 2 ? ww / 2 + 0.25 : 1.6);
    const sills: number[] = [];
    for (let f = 0; f * storey + 0.5 < w.top - 1.2; f++) {
      for (let j = 0; j < 3; j++) {
        const y = f * storey + 0.4 + j * 0.95;
        if (y >= y0 && y + 0.85 <= w.top - 0.5) sills.push(+y.toFixed(2));
      }
    }
    windowGrid(b, w, {t0: c.t0, pitch: c.pitch, n: c.n, w: ww, h: 0.85, sills, frame: 'dark', glass: 'glass', ring: 0.04});
    void claimOpening;
  });
  setSink(0);
}
