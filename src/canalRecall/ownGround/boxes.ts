// The two prototype areas for the own-ground renderer (docs/research/own-ground-20261009.md).

export interface GroundBox { id: string; label: string; lng: number; lat: number; halfM: number }

export const OWN_GROUND_BOXES: readonly GroundBox[] = [
  // Nassaukade along the Singelgracht, the Bilderdijkstraat bridges, west to the Kostverlorenvaart.
  { id: 'nassaukade', label: 'Nassaukade / Kostverlorenvaart / Bilderdijkstraat', lng: 4.8690, lat: 52.3700, halfM: 750 },
  // Canal belt: Herengracht and the Leidsegracht.
  { id: 'leidsegracht', label: 'Herengracht / Leidsegracht', lng: 4.8875, lat: 52.3665, halfM: 750 },
];

export const boxById = (id: string): GroundBox | undefined => OWN_GROUND_BOXES.find(b => b.id === id);

/**
 * Streaming areas for the game (2026-10-10): lng/lat bounding boxes the relief
 * and the OSM ground cells are built for. `west` = canal belt, Jordaan,
 * Oud-West and Westerpark (it contains both prototype boxes).
 */
export interface GroundArea { id: string; label: string; west: number; south: number; east: number; north: number }

export const OWN_GROUND_AREAS: readonly GroundArea[] = [
  { id: 'west', label: 'Canal belt, Jordaan, Oud-West, Westerpark', west: 4.853, south: 52.352, east: 4.916, north: 52.393 },
];

export const areaById = (id: string): GroundArea | undefined => OWN_GROUND_AREAS.find(a => a.id === id);
