import type {BuildingTools} from './cultural-builders';
import {setSink} from './nearbar-kit';
import {rawWall} from './big-kit';
import {ribbon, beginFacade, addShellTess} from './big-facade';
import raw from './jacob-bontiusplaats-9-footprints.json';

/**
 * Glass-walled office block, Jacob Bontiusplaats 9-11 / Isaac Titsinghkade, Oostenburg (BAG pand 0363100012165819, 2005; 13,616 m2 offices
 * plus 15 small utility units; no pand name and no architect found in BAG or the web sources, so it is ordinary: no card). The BAG
 * footprint is a 140 x 75 m slab with a 19-20 m eave and many inner roof volumes (20-25 m) that stand inside the perimeter.
 * Rhythm read from three municipal panoramas (2025-01-30 and 2025-06-19, see jacob-bontiusplaats-9-research.json):
 *  - ground floor (0-5 m): glazed shopfront/office fronts in grey stone piers (about 7 m pitch), with louvred plant doors and a bicycle store;
 *  - above, a curtain wall of vertical steel mullions about 2.4-3 m apart with thin horizontal transoms; on the south-east long wall a belt of
 *    fixed glass louvres (about 0.4 m pitch) in white steel posts covers the storeys from 5 to about 13 m under plain glass above.
 * INFERRED: the north-east end and any perimeter wall that no panorama saw head on (same curtain-wall module as the photographed walls).
 * Not modelled: the inner roof volumes' fittings, the louvre blade depth, signage (DAAN, FIETSENSTALLING lettering), roof plant.
 */
// A garage ramp at the north-west corner (3DBAG vertices to -3.4 m) dips below street level; that geometry is hidden under the road, so
// the shell is clamped to ground (y >= 0). Every above-ground surface is unchanged.
const source = {...raw, surfaces: raw.surfaces.map(s => ({...s, rings: s.rings.map(r => r.map(p => [p[0], Math.max(0, p[1]), p[2]]))}))};
const surfaces = (source as {surfaces: {type: string; rings: number[][][]}[]}).surfaces;
const ring = (source as {nativeRing: number[][]}).nativeRing;

function onPerimeter(mx: number, mz: number): boolean {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1], l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((mx - a[0]) * dx + (mz - a[1]) * dz) / l2));
    if (Math.hypot(mx - (a[0] + t * dx), mz - (a[1] + t * dz)) < 0.6) return true;
  }
  return false;
}

export function buildJacobBontiusplaats9(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShellTess(b, source as never, {wall: 'frame', roof: 'concrete'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  beginFacade(source as never);
  setSink(0.3);
  surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface') return;
    const w = rawWall(source as never, i);
    if (!(w.len >= 2.5) || !Number.isFinite(w.f.n[0]) || w.top - w.base < 3 || w.base > 1) return;
    const mx = w.f.origin[0] + w.f.tangent[0] * w.len / 2, mz = w.f.origin[1] + w.f.tangent[1] * w.len / 2;
    if (!onPerimeter(mx, mz)) return;
    // SE long wall: louvre belt (outward normal pointing south-east).
    const louvred = w.bearing > 100 && w.bearing < 160;
    // ground floor: glazed fronts between stone piers (7 m pitch, 1.2 m piers)
    const gh = Math.min(4.6, w.top - 1);
    for (let t = 0.5; t + 5.0 <= w.len - 0.4; t += 7) ribbon(b, w, t, t + 5.8, 0.4, gh, {ring: 0.06, frame: 'frame', glass: 'glass'});
    const upper = 5.3;
    const top = Math.min(w.top - 0.8, 18.9);
    if (louvred) {
      ribbon(b, w, 0.6, w.len - 0.6, upper, 7.6, {frame: 'frame', glass: 'glass', ring: 0.04, louvres: Array.from({length: 13}, (_, k) => [upper + 0.5 + k * 0.55, 0.2] as [number, number])});
      ribbon(b, w, 0.6, w.len - 0.6, upper + 8.0, top - upper - 8.0, {ring: 0.04, frame: 'frame', glass: 'glass'});
    } else {
      for (let y = upper; y + 3.0 <= top; y += 3.7) ribbon(b, w, 0.6, w.len - 0.6, y, 3.3, {ring: 0.04, frame: 'frame', glass: 'glass'});
    }
  });
  setSink(0);
}
