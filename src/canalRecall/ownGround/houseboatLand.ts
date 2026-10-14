// Houseboats under the own ground (pure): which houseboat footprints a built
// cell covers with land, a quay band or a path instead of leaving them on the
// water (user 2026-10-14, "ground is running into houseboats").
//
// A boat is sampled at its centroid and at each vertex pulled 10 % toward the
// centroid (just inside the hull); a sample is covered
// when the topmost visible layer there (`layersAt`, mask cut applied) is
// anything but water. Decks are ignored: a bridge may pass over a boat.

import { layersAt, type BuiltCell, type GroundLayer } from './groundCell.js';
import type { Vec2 } from './surface.js';

/** Frederik Hendrikbuurt, Westerkanaal, Spaarndammerbuurt and Zeeheldenbuurt (1 km cells, elevation-v1 frame). */
export const HOUSEBOAT_LAND_CELLS = ['-2_0', '-2_1', '-2_2', '-1_1', '-1_2', '-3_1', '-3_2'];

const IGNORED: ReadonlySet<GroundLayer> = new Set<GroundLayer>(['deckTop', 'deckBody']);

export interface CoveredBoat { id: string; samples: number; covered: number; layers: GroundLayer[]; at: Vec2 }

export function boatSamples(ring: readonly Vec2[]): Vec2[] {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [[cx, cy], ...pts.map(p => [p[0] + (cx - p[0]) * 0.1, p[1] + (cy - p[1]) * 0.1] as Vec2)];
}

/** Boats whose centroid lies in the cell, and those of them with any covered sample. */
export function houseboatsOnLand(cell: BuiltCell, boats: readonly { id: string; ring: readonly Vec2[] }[]): { boats: number; covered: CoveredBoat[] } {
  const [x0, y0, x1, y1] = cell.rect;
  const out: CoveredBoat[] = [];
  let n = 0;
  for (const b of boats) {
    const samples = boatSamples(b.ring), [cx, cy] = samples[0];
    if (cx < x0 || cx >= x1 || cy < y0 || cy >= y1) continue;
    n++;
    const layers = new Set<GroundLayer>();
    let covered = 0;
    for (const [x, y] of samples) {
      const top = layersAt(cell, x, y).top;
      if (top && !IGNORED.has(top)) { covered++; layers.add(top); }
    }
    if (covered) out.push({ id: b.id, samples: samples.length, covered, layers: [...layers], at: [+cx.toFixed(1), +cy.toFixed(1)] });
  }
  return { boats: n, covered: out };
}
