/**
 * The far tier's per-cell hand-over (lane R4-K #255), pure and light (the facade layer's bundle imports it): which far
 * prism parts hide under what the facade layer draws. See engine/farShells.ts for the tier itself.
 */
import { cellsCovering } from '../world/cellGrid.js';

/**
 * Whether a far cell's z14-tile part hides (lane R4-K #255), pure. `bakedDrawn`: the baked coarse mesh of this cell is
 * installed and done dissolving in. `bakedHolds`: the baked tier covers the cell (no runtime coarse chunk holds its
 * buildings) but does not draw it now, released from the air or (release on) still arriving: then only a drawn detail
 * chunk inside this cell and tile stands in for the prisms; the tile's runtime coarse chunk holds other cells' buildings
 * and a near chunk elsewhere in the tile holds none of this cell's. Otherwise (no baked tier, or a cell it does not
 * cover) the tile-wide rule of R2-B: a drawn coarse chunk or any drawn near chunk in the tile.
 */
export function farPartHidden(s: { bakedDrawn: boolean; bakedHolds: boolean; coarseTile: boolean; nearTile: boolean; nearCell: boolean }): boolean {
  if (s.bakedDrawn) return true;
  if (s.bakedHolds) return s.nearCell;
  return s.coarseTile || s.nearTile;
}

/** Web-mercator tile bounds [west, south, east, north] in degrees. */
export function tileBounds(z: number, x: number, y: number): [number, number, number, number] {
  const n = 2 ** z, lng = (v: number) => v / n * 360 - 180, lat = (v: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * v / n))) * 180 / Math.PI;
  return [lng(x), lat(y + 1), lng(x + 1), lat(y)];
}

/**
 * The drawn detail chunks (`x/y` keys at `detailZoom`) by z14 tile (`tileZoom`), each with the world cells its bounds
 * touch (a building's near tile and cell are both keyed by its first vertex, world/cellGrid.ts buildingCell). Pure.
 */
export function nearTileCells(nearKeys: Iterable<string>, detailZoom: number, tileZoom = 14): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>(), shift = 2 ** (detailZoom - tileZoom);
  for (const k of nearKeys) {
    const [x, y] = k.split('/').map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const tile = `${Math.floor(x / shift)}/${Math.floor(y / shift)}`;
    let cells = out.get(tile); if (!cells) out.set(tile, cells = new Set());
    const [w, s, e, n] = tileBounds(detailZoom, x, y), eps = 1e-9;
    for (const c of cellsCovering(w + eps, s + eps, e - eps, n - eps)) cells.add(c);
  }
  return out;
}
