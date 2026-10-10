// The game's riding area as elevation-v1 1 km cells: every cell the routing
// network (streets-routing.json, the BBBike Amsterdam extract the bike can
// ride) passes through. City-wide own-ground builds cover exactly these cells,
// so nothing is fetched or published for cells the rider can never reach.
import { readFileSync } from 'node:fs';
import { cellKey, lngLatToLocal, type ElevationIndex } from '../../src/canalRecall/elevation/elevationData.ts';

const ROOT = 'public/data/extracts/amsterdam';

export function elevationIndex(): ElevationIndex {
  return JSON.parse(readFileSync(`${ROOT}/elevation-v1/index.json`, 'utf8')) as ElevationIndex;
}

/** Cell keys (elevation-v1 storage frame) that hold at least `minPoints` routing vertices. */
export function gameCells(minPoints = 1): Set<string> {
  const index = elevationIndex();
  const ways = JSON.parse(readFileSync(`${ROOT}/streets-routing.json`, 'utf8')) as { path: [number, number][] }[];
  const count = new Map<string, number>();
  for (const w of ways) for (const [lat, lng] of w.path) {
    const [x, y] = lngLatToLocal(index, lng, lat);
    const k = cellKey(Math.floor(x / index.cellSizeM), Math.floor(y / index.cellSizeM));
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return new Set([...count].filter(([, n]) => n >= minPoints).map(([k]) => k));
}

/** A cell's lng/lat bounds. */
export function cellBounds(index: ElevationIndex, key: string): [number, number, number, number] {
  const [cx, cy] = key.split('_').map(Number), s = index.cellSizeM;
  return [index.origin[0] + cx * s / index.metresPerDegree[0], index.origin[1] + cy * s / index.metresPerDegree[1],
    index.origin[0] + (cx + 1) * s / index.metresPerDegree[0], index.origin[1] + (cy + 1) * s / index.metresPerDegree[1]];
}
