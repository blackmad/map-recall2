// Which z16 (desktop) / z17 (touch) tiles get the detailed facade chunks.
//
// The detailed block is 2×2 tiles: the tile under a centre point and its neighbours on the side of the nearest
// tile edges. It used to be centred on the rider with the side flipping exactly at the tile's midline, so:
// - the tiles ahead turned detailed only ~190 m before the rider reached them, in full view, and the coarse
//   shells there swapped to detailed facades and roofs on screen;
// - riding along a midline, or wobbling across it, flipped two tiles detailed→coarse→detailed;
// - the two tiles that left the block (beside or just behind the rider, still on screen) dropped to coarse.
// Now the centre leads the rider along its heading, the side flips only past the midline by a margin
// (hysteresis), and a tile that leaves the block stays detailed while the rider is within `lingerM` of it.
// See docs/perf-pop-in-20261016.md.

import { offsetLngLat, type LngLat } from './streamingLookAhead.js';

export type DetailBlock = {
  /** Tile under the (led) centre and the side of its neighbours, -1 or 1 on each axis. */
  x: number; y: number; dx: number; dy: number;
  /** Tile keys `x/y` that draw detailed: the 2×2 block, then lingering tiles nearest first. */
  keys: string[];
};

export type DetailOptions = {
  /** Metres the block's centre leads the rider along the heading. */
  leadM?: number;
  /** Fraction of a tile past the midline before the side flips. */
  margin?: number;
  /** A tile that left the block stays while the rider is this close to it, metres. */
  lingerM?: number;
  /** At most this many detailed tiles (block + lingering). */
  maxTiles?: number;
};

export const DETAIL_LEAD_M = 110;
export const DETAIL_SIDE_MARGIN = 0.12;
export const DETAIL_LINGER_M = 160;
export const DETAIL_MAX_TILES = 6;

const M_PER_DEG_LAT = 111_320;

function fractionalTile(lng: number, lat: number, zoom: number): [number, number] {
  const n = 2 ** zoom, rad = (lat * Math.PI) / 180;
  return [((lng + 180) / 360) * n, ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n];
}

/** Metres from a point to the tile `x/y`'s rectangle (0 inside). */
export function metresToTile(at: LngLat, key: string, zoom: number): number {
  const [x, y] = key.split('/').map(Number);
  const n = 2 ** zoom;
  const west = (x / n) * 360 - 180, east = ((x + 1) / n) * 360 - 180;
  const lat = (t: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / n))) * 180) / Math.PI;
  const north = lat(y), south = lat(y + 1);
  const cx = Math.max(west, Math.min(east, at[0])), cy = Math.max(south, Math.min(north, at[1]));
  const mLng = M_PER_DEG_LAT * Math.cos((at[1] * Math.PI) / 180);
  return Math.hypot((at[0] - cx) * mLng, (at[1] - cy) * M_PER_DEG_LAT);
}

/**
 * The detailed tiles for a rider at `rider` heading along `direction` (east/north unit vector, or null when
 * standing), given the previous answer. `legacy` reproduces the old rule exactly (no lead, no hysteresis, no
 * linger) for A/B.
 */
export function detailBlock(rider: LngLat, direction: readonly [number, number] | null, zoom: number, previous: DetailBlock | null, options: DetailOptions & { legacy?: boolean } = {}): DetailBlock {
  const { leadM = DETAIL_LEAD_M, margin = DETAIL_SIDE_MARGIN, lingerM = DETAIL_LINGER_M, maxTiles = DETAIL_MAX_TILES, legacy = false } = options;
  const centre = !legacy && direction ? offsetLngLat(rider, direction, leadM) : rider;
  const [fx, fy] = fractionalTile(centre[0], centre[1], zoom);
  const x = Math.floor(fx), y = Math.floor(fy);
  const side = (f: number, prev: number | undefined) => {
    if (!legacy && prev !== undefined && Math.abs(f - 0.5) < margin) return prev;
    return f < 0.5 ? -1 : 1;
  };
  const same = previous && previous.x === x && previous.y === y;
  const dx = side(fx - x, same ? previous!.dx : undefined), dy = side(fy - y, same ? previous!.dy : undefined);
  const keys = [`${x}/${y}`, `${x + dx}/${y}`, `${x}/${y + dy}`, `${x + dx}/${y + dy}`];
  if (!legacy && previous) {
    const lingering = previous.keys.filter(k => !keys.includes(k))
      .map(k => ({ k, d: metresToTile(rider, k, zoom) }))
      .filter(t => t.d <= lingerM)
      .sort((a, b) => a.d - b.d);
    for (const t of lingering) if (keys.length < maxTiles) keys.push(t.k);
  }
  return { x, y, dx, dy, keys };
}
