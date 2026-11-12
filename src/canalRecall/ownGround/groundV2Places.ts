// Ground v2 named places (lane G2a #372): G0's nine named ground-defect places (groundRegressions.ts GROUND_SPOTS on
// lane/ground-g0-20261110 at 5223a6cca, positions on the named OSM way, 150 m windows), copied here until G0 reaches
// main; then this list should re-export from it. G2a's acceptance bar (coordinator, 2026-11-12): every place at zero
// sliver, poke-through, z-fight and crack inside its window, and before/after frames beside the orthophoto.

/** `bearing`: the ride frame's heading, degrees clockwise from north (along the way named). */
export interface GroundV2Place { id: string; label: string; at: [number, number]; cell: string; bearing: number }

/** Radius of a place's audit window, metres (G0 GROUND_SPOT_RADIUS_M). */
export const GROUND_V2_PLACE_RADIUS_M = 150;

export const GROUND_V2_PLACES: readonly GroundV2Place[] = [
  { id: 'piet-kranenbergpad', label: 'Piet Kranenbergpad, under the ring and Schiphol rail decks', at: [4.85089, 52.34442], cell: '-4_-3', bearing: 90 },
  { id: 'amstelveenseweg-viaduct', label: 'Amstelveenseweg viaduct', at: [4.85748, 52.3421], cell: '-3_-4', bearing: 0 },
  { id: 'schinkel-jachthavenweg', label: 'Schinkel bank by Jachthavenweg', at: [4.85369, 52.33664], cell: '-4_-4', bearing: 0 },
  { id: 'overschiestraat', label: 'Overschiestraat underpass', at: [4.841, 52.34335], cell: '-4_-3', bearing: 90 },
  { id: 'sportparklaan', label: 'Sportparklaan', at: [4.83954, 52.34395], cell: '-5_-3', bearing: 90 },
  { id: 'anthony-fokkerweg', label: 'Anthony Fokkerweg by the A10 cut', at: [4.84208, 52.3451], cell: '-4_-3', bearing: 90 },
  { id: 'vlaardingenlaan-naaldwijkstraat', label: 'Vlaardingenlaan / Naaldwijkstraat (flat ground)', at: [4.84598, 52.34685], cell: '-4_-3', bearing: 90 },
  { id: 'lelylaan-delflandlaan', label: 'Delflandlaan by Cornelis Lelylaan', at: [4.84085, 52.35716], cell: '-5_-2', bearing: 90 },
  { id: 'radarweg-south-abutment', label: 'Radarweg bridge over the Sloterdijk yard, south abutment', at: [4.83455, 52.38484], cell: '-5_1', bearing: 0 },
];

/** The seam pin (typed check): a G0 cell and its east neighbour. */
export const GROUND_V2_SEAM_PIN = { a: '-4_-3', b: '-3_-3' } as const;

/**
 * Seam pairs that differed in the first priority bake (2026-11-10), pinned in check-ground-v2.ts beside the seam pin:
 * a kerb band ending 2 cm into -4_-2 (seam vertices on different levels, 110 mm apart) and a pond ending 9 mm past
 * -2_0 | -1_0 (a seam vertex only one cell held). Fixed by seamClassifier in groundPartition.ts.
 */
export const GROUND_V2_SEAM_REGRESSIONS: readonly { a: string; b: string; why: string }[] = [
  { a: '-4_-3', b: '-4_-2', why: 'kerb band ending 2 cm past the seam: seam levels differed' },
  { a: '-2_0', b: '-1_0', why: 'pond ending 9 mm past the seam: a seam vertex in one cell only' },
];
