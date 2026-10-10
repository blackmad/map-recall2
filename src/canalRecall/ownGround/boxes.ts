// The two prototype areas for the own-ground renderer (docs/research/own-ground-20261009.md).

export interface GroundBox { id: string; label: string; lng: number; lat: number; halfM: number }

export const OWN_GROUND_BOXES: readonly GroundBox[] = [
  // Nassaukade along the Singelgracht, the Bilderdijkstraat bridges, west to the Kostverlorenvaart.
  { id: 'nassaukade', label: 'Nassaukade / Kostverlorenvaart / Bilderdijkstraat', lng: 4.8690, lat: 52.3700, halfM: 750 },
  // Canal belt: Herengracht and the Leidsegracht.
  { id: 'leidsegracht', label: 'Herengracht / Leidsegracht', lng: 4.8875, lat: 52.3665, halfM: 750 },
];

export const boxById = (id: string): GroundBox | undefined => OWN_GROUND_BOXES.find(b => b.id === id);
