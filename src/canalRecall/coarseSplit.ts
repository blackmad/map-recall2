/**
 * Coarse shells split per world cell (feedback 748b1a8f, 2026-11-14: "why do chunks of the city sometimes take so long
 * to load?"; lane pan-load-prod).
 *
 * The runtime coarse shell (`coarse:x/y`, threeBuildingsBrowser.ts) was one chunk per z14 tile (~1.5 km square, up to
 * ~5,000 buildings). The complete city fills a tile cell by cell (world-v1 1 km cells, as the fetch ring grows), and
 * every top-up changed the tile's building list, so the whole tile rebuilt in one worker: 400–900 ms in the storybook
 * look, which has no baked tier. While the camera kept moving the next top-up made the build stale before it landed,
 * so the new cell's buildings stayed bare for seconds (measured on production, a 300 m/s drag into the Jordaan: the
 * bottom of the screen 18 % drawn at the end of the drag, three rebuilds of coarse:8414/5383 of which one was thrown
 * away at 902 ms).
 *
 * `?coarseSplit` keys the shell per tile and world cell, `coarse:x/y~i_j` (the cell of the building's first vertex,
 * world/cellGrid.ts buildingCell, as the baked tier groups). A top-up then builds only the new cell's chunk; the
 * other cells keep their source lists (the streamer keeps a held building's objects) and are not rebuilt, unless a
 * new neighbour lands inside their bounds (the context rule). Builds are smaller and run on several workers at once.
 *
 * `?coarseSplit=0` (or `window.__canalRecallCoarseSplit = false`): one chunk per z14 tile, as before.
 */
import { cellBounds, parseCellKey } from './world/cellGrid.js';

export const COARSE_SPLIT_PREFIX = 'coarse:';
/** Separates the z14 tile from the world cell in a split key. */
export const COARSE_CELL_SEP = '~';
/** Desktop default (pointer: fine); touch keeps one shell per tile until measured on the iPhone. */
export const COARSE_SPLIT_DESKTOP_DEFAULT = true;
export const COARSE_SPLIT_TOUCH_DEFAULT = false;

export function coarseSplitEnabled(search: string = typeof location !== 'undefined' ? location.search : '', w: any = typeof window !== 'undefined' ? window : {}): boolean {
  let v: string | null = null;
  try { v = new URLSearchParams(search).get('coarseSplit'); } catch { /* no location */ }
  if (v === null && w?.__canalRecallCoarseSplit !== undefined) v = String(w.__canalRecallCoarseSplit);
  if (v === null) {
    let touch = false;
    try { touch = !!w?.matchMedia?.('(pointer: coarse)')?.matches; } catch { /* no matchMedia */ }
    return touch ? COARSE_SPLIT_TOUCH_DEFAULT : COARSE_SPLIT_DESKTOP_DEFAULT;
  }
  return v === '1' || v === 'on' || v === 'true' || v === '';
}

/** The coarse chunk key of a building in z14 tile `tile` (`x/y`) and world cell `cell` (`i_j`, null: none). */
export function coarseKey(tile: string, cell: string | null, split: boolean): string {
  return split && cell !== null ? `${COARSE_SPLIT_PREFIX}${tile}${COARSE_CELL_SEP}${cell}` : `${COARSE_SPLIT_PREFIX}${tile}`;
}

/** The z14 tile (`x/y`) of a coarse key, split or not; null for any other key. */
export function coarseTileOf(key: string): string | null {
  if (!key.startsWith(COARSE_SPLIT_PREFIX)) return null;
  const rest = key.slice(COARSE_SPLIT_PREFIX.length), at = rest.indexOf(COARSE_CELL_SEP);
  return at < 0 ? rest : rest.slice(0, at);
}

/** The world cell of a split coarse key, else null. */
export function coarseCellOf(key: string): string | null {
  if (!key.startsWith(COARSE_SPLIT_PREFIX)) return null;
  const at = key.indexOf(COARSE_CELL_SEP);
  return at < 0 ? null : key.slice(at + 1);
}

/** [west, south, east, north] of a z14 tile `x/y`. */
export function tileBoxOf(tile: string, zoom = 14): [number, number, number, number] | null {
  const [x, y] = tile.split('/').map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const n = 2 ** zoom, latOf = (t: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / n))) * 180) / Math.PI;
  return [(x / n) * 360 - 180, latOf(y + 1), ((x + 1) / n) * 360 - 180, latOf(y)];
}

/**
 * The ground a coarse key covers: its z14 tile, cut to its world cell when split. A building is keyed by its first
 * vertex, so a split chunk's buildings start inside this box (their footprints may reach past it).
 */
export function coarseBoxOf(key: string): [number, number, number, number] | null {
  const tile = coarseTileOf(key);
  const box = tile === null ? null : tileBoxOf(tile);
  const cell = coarseCellOf(key);
  if (!box || cell === null) return box;
  let c: [number, number, number, number];
  try { const [i, j] = parseCellKey(cell); c = cellBounds(i, j); } catch { return box; }
  const out: [number, number, number, number] = [Math.max(box[0], c[0]), Math.max(box[1], c[1]), Math.min(box[2], c[2]), Math.min(box[3], c[3])];
  return out[0] <= out[2] && out[1] <= out[3] ? out : box;
}

/**
 * Coarse chunks by z14 tile: which keys of a tile exist, so tile-level questions ("is this tile's shell drawn?") work
 * whether the shell is one chunk or one per cell.
 */
export class CoarseTileIndex {
  private readonly byTile = new Map<string, Set<string>>();
  add(key: string): void {
    const tile = coarseTileOf(key);
    if (tile === null) return;
    let set = this.byTile.get(tile);
    if (!set) this.byTile.set(tile, set = new Set());
    set.add(key);
  }
  delete(key: string): void {
    const tile = coarseTileOf(key);
    if (tile === null) return;
    const set = this.byTile.get(tile);
    if (!set) return;
    set.delete(key);
    if (!set.size) this.byTile.delete(tile);
  }
  keysOf(tile: string): ReadonlySet<string> { return this.byTile.get(tile) ?? EMPTY; }
  clear(): void { this.byTile.clear(); }
}
const EMPTY: ReadonlySet<string> = new Set();
