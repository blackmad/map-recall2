// Ground v2 named places (lane G2a #372): the eight places of the user's 2026-11-10 shots (plan
// docs/handoffs/ground-v2-plan-20261110.md, "Context"), pinned for the bake's priority set, the v2 audit, the seam pin
// and the before/after ride frames. G0 (`groundRegressions.ts`, not landed when G2a ran) owns the canonical list; when it
// lands, this file should re-export from it.

/** `bearing`: the ride frame's heading, degrees clockwise from north (along the street or path under review). */
export interface GroundV2Place { id: string; label: string; at: [number, number]; bearing: number }

export const GROUND_V2_PLACES: readonly GroundV2Place[] = [
  { id: 'kranenbergpad', label: 'Piet Kranenbergpad, under the ring and Schiphol rail decks', at: [4.8521, 52.3412], bearing: 90 },
  { id: 'amstelveenseweg-viaduct', label: 'Amstelveenseweg viaduct', at: [4.8575, 52.3422], bearing: 0 },
  { id: 'schinkel-jachthavenweg', label: 'Schinkel bank by Jachthavenweg', at: [4.8537, 52.3367], bearing: 0 },
  { id: 'overschiestraat', label: 'Overschiestraat underpass', at: [4.8410, 52.34335], bearing: 90 },
  { id: 'sportparklaan', label: 'Sportparklaan', at: [4.8395, 52.3437], bearing: 90 },
  { id: 'anthony-fokkerweg', label: 'Anthony Fokkerweg by the A10 strip', at: [4.8419, 52.3430], bearing: 90 },
  { id: 'vlaardingenlaan', label: 'Vlaardingenlaan / Naaldwijkstraat (flat ground)', at: [4.8410, 52.3468], bearing: 90 },
  { id: 'cornelis-lelylaan', label: 'Cornelis Lelylaan / Delflandlaan', at: [4.8408, 52.3577], bearing: 90 },
];

/** The seam pin (typed check): a G0 cell and its east neighbour. */
export const GROUND_V2_SEAM_PIN = { a: '-4_-3', b: '-3_-3' } as const;
