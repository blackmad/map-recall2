/** The own-ground 1 km grid (elevation-v1 `index.json`: origin, metresPerDegree, cellSizeM) that keys
 *  `roads-v1/cells.json` and the `world-v1` cells. Kept as constants so the worker needs no fetch; the
 *  compiler asserts them against the published index. */
export const CELL_GRID = { origin: [4.9, 52.37] as const, metresPerDegree: [67967.53053174692, 111320.0] as const, cellSizeM: 1000 };

export type CellIndex = readonly [number, number];
export const cellKeyOf = (i: number, j: number): string => `${i}_${j}`;
export function parseCellKey(key: string): CellIndex {
  const m = /^(-?\d+)_(-?\d+)$/.exec(key);
  if (!m) throw Error(`bad cell key ${key}`);
  return [Number(m[1]), Number(m[2])];
}
export function cellOf(lng: number, lat: number): CellIndex {
  const { origin, metresPerDegree, cellSizeM } = CELL_GRID;
  return [Math.floor((lng - origin[0]) * metresPerDegree[0] / cellSizeM), Math.floor((lat - origin[1]) * metresPerDegree[1] / cellSizeM)];
}
/** [west, south, east, north] in degrees. */
export function cellBounds(i: number, j: number): [number, number, number, number] {
  const { origin, metresPerDegree, cellSizeM } = CELL_GRID;
  return [origin[0] + i * cellSizeM / metresPerDegree[0], origin[1] + j * cellSizeM / metresPerDegree[1], origin[0] + (i + 1) * cellSizeM / metresPerDegree[0], origin[1] + (j + 1) * cellSizeM / metresPerDegree[1]];
}
/** Cells a lng/lat box touches. */
export function cellsCovering(west: number, south: number, east: number, north: number): string[] {
  const [i0, j0] = cellOf(west, south), [i1, j1] = cellOf(east, north), out: string[] = [];
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) out.push(cellKeyOf(i, j));
  return out;
}
/** A building's cell: the cell of its first vertex (the same vertex `setFeatures` keys its group by). */
export function buildingCell(geometry: { type: string; coordinates: any }): string | null {
  const first = geometry.type === 'Polygon' ? geometry.coordinates?.[0]?.[0] : geometry.type === 'MultiPolygon' ? geometry.coordinates?.[0]?.[0]?.[0] : null;
  if (!first || !Number.isFinite(first[0]) || !Number.isFinite(first[1])) return null;
  const [i, j] = cellOf(first[0], first[1]);
  return cellKeyOf(i, j);
}
