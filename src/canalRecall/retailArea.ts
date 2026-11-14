// Where the retail census counts (lane retail-ground-20261114): the centre inside the Singelgracht (a hand-traced
// polygon along the Singelgracht, Mauritskade and the IJ shore, lng/lat, ~50 m accurate) and the ring as a distance
// from the Dam (the 19th-century ring, De Pijp, Oud-West, Oost and the Jordaan sit inside RING_KM). Counting only.
export const DAM: readonly [number, number] = [4.8926, 52.3731];
export const RING_KM = 3;
export const CENTRE_POLYGON: ReadonlyArray<readonly [number, number]> = [
  [4.8760, 52.3700], [4.8790, 52.3780], [4.8810, 52.3825], [4.8890, 52.3835], [4.9000, 52.3800], [4.9130, 52.3770],
  [4.9260, 52.3720], [4.9200, 52.3640], [4.9150, 52.3615], [4.9060, 52.3590], [4.8960, 52.3570], [4.8880, 52.3585],
  [4.8820, 52.3610], [4.8790, 52.3640],
];
export function insideCentre(lng: number, lat: number): boolean {
  let inside = false;
  const r = CENTRE_POLYGON;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
