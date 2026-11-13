// Named ground regressions of lane R2-D (Canal Recall feedback 2026-11-13): the five poses where the ground looked wrong.
// check-ground-spots.ts pins them (z-fight ceilings from the audit, the layers drawn at the probes); groundSurface.test.ts
// pins the layer rule; tests/e2e/r2-ground-frames.spec.ts shoots the ride and aerial frames.
//
//   762c6e04 slab        Spaarndammerdijk, a 150 x 60 m construction lot drawn as saturated sand (BGT zand, 2025 photo: rough
//                        ground, dry grass, a car park; sunlit tone 205,197,185 where the sand layer was 212,194,150)
//   b1e259b9 wiborgeiland sand strip on the bank of the Wiborgeiland canal, ragged where the water polygon is
//   ab50459f rembrandtpark open-ground meadow and shrub drawn under the parks-v1 lawn and shrub: coplanar, z-fight
//   a5806a8e lelylaan    junction slivers (earcut needles in the road surfaces; not fixed here, see the report)
//   7517fef7 haparandadam the cream block stands on a pontoon in the water: the land is right, pinned in check-land-mask

import type { OpenGroundCover } from './groundSurface.js';

export interface R2GroundSpot {
  name: string;
  feedback: string;
  lng: number; lat: number;
  /** The own-ground cell (elevation-v1 key). */
  cell: string;
  /** Where the ride frame stands the rider, and the way it looks (degrees from north). */
  frame: { lng: number; lat: number; bearing: number };
  /** Audit window radius, metres (groundAudit.ts). */
  r: number;
}

export const R2_GROUND_SPOTS: readonly R2GroundSpot[] = [
  { name: 'houthavens-slab', feedback: '762c6e04', lng: 4.87509, lat: 52.39312, cell: '-2_2', frame: { lng: 4.87509, lat: 52.39312, bearing: 300 }, r: 100 },
  { name: 'wiborgeiland', feedback: 'b1e259b9', lng: 4.88209, lat: 52.39203, cell: '-2_2', frame: { lng: 4.88209, lat: 52.39203, bearing: 40 }, r: 100 },
  { name: 'rembrandtpark', feedback: 'ab50459f', lng: 4.84760, lat: 52.36128, cell: '-4_-1', frame: { lng: 4.84760, lat: 52.36128, bearing: 340 }, r: 100 },
  { name: 'lelylaan', feedback: 'a5806a8e', lng: 4.84224, lat: 52.35860, cell: '-4_-2', frame: { lng: 4.84224, lat: 52.35860, bearing: 0 }, r: 100 },
];

/** Probe: the open-ground cover whose polygon (BGT id prefix) holds the point in the published extract, and the layer it draws in. */
export interface R2GroundProbe {
  spot: string;
  what: string;
  lng: number; lat: number;
  /** BGT id prefix of the open-ground area that holds the probe (open-ground-v1 / v2 ids carry it). */
  id: string;
  /** The extract's cover (unchanged by the lane). */
  cover: OpenGroundCover;
  /** The ground layer the cover draws in (groundSurface.ts OPEN_GROUND_LAYER). */
  layer: 'bare' | 'sand' | 'garden' | 'shrub';
}

export const R2_GROUND_PROBES: readonly R2GroundProbe[] = [
  { spot: 'houthavens-slab', what: 'the lot beside the Spaarndammerdijk (BGT zand, a building site on the 2025 photo)', lng: 4.87391, lat: 52.39367, id: 'G0363.80c8c8bb7d754e078b4a581131d14d07', cover: 'sand', layer: 'bare' },
  { spot: 'wiborgeiland', what: 'the sand strip on the canal bank (BGT zand, a building site on the 2025 photo)', lng: 4.88128, lat: 52.39167, id: 'G0363.894deacb510c40c1be57bf3501395c8f#1', cover: 'sand', layer: 'bare' },
];

/**
 * Lelylaan (a5806a8e): BGT L0002 `onbegroeidterreindeel` `gesloten verharding` (Rijkswaterstaat, no function) polygons are the
 * A10 slip roads (lane arrows on the 2025 photo); roads-v1 files them as `square` of asphalt and they drew as pale paving.
 */
export const R2_ROAD_PROBES: readonly { spot: string; what: string; lng: number; lat: number; layer: 'asphalt' }[] = [
  { spot: 'lelylaan', what: 'the west slip road (BGT L0002.f3760b4a6acd402f8c57685be5e17cd2, a 1,220 m² asphalt square)', lng: 4.841909, lat: 52.358577, layer: 'asphalt' },
  { spot: 'lelylaan', what: 'the same slip road, 40 m north', lng: 4.841909, lat: 52.358917, layer: 'asphalt' },
];

/**
 * Open-ground areas laid on a parks-v1 surface of the same layer were coplanar with it (the Rembrandtpark shimmer). Ceilings
 * for check-ground-spots.ts (audit z-fight m², window of R2GroundSpot.r, the R2-D build + 5 %); before the clip:
 * rembrandtpark 4,734 (garden 2,917), lelylaan 622, houthavens-slab 1,483, wiborgeiland 466.
 */
export const R2_ZFIGHT_M2: Readonly<Record<string, { total: number; garden: number }>> = {
  rembrandtpark: { total: 1780, garden: 60 },
  lelylaan: { total: 650, garden: 10 },
  'houthavens-slab': { total: 1530, garden: 30 },
  wiborgeiland: { total: 490, garden: 10 },
};
