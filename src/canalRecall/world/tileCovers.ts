/**
 * Per-tile covers slices (house line H3, docs/house-line.md section 3).
 *
 * `covers.json` (model -> the pands / OSM ways it replaces) reaches the baked world only through each cell's `hide`
 * list. It used to be a global compile input, so one installed house rebuilt every cell. A tile's slice is the part of
 * covers.json that names a building of that tile; it is hashed beside the tile's own inputs, so a covers change
 * rebuilds only the cells that list a tile whose slice moved. Pure functions, no file access (the compiler owns the I/O).
 */
import crypto from 'node:crypto';
import { HIDE_COVER_OSM, HIDE_COVER_PAND, type HideEntry } from './cellFormat.ts';

export type CoversFile = { models?: Record<string, { p?: unknown[]; o?: unknown[] }> };

/** The hide entries covers.json contributes, keyed by building id, in the order the compiler adds them
 *  (model order, a model's pands, then its OSM ways). Pands are `NL.IMBAG.Pand.<id>`, OSM ways their own id string. */
export function coversHides(covers: CoversFile): Map<string, HideEntry> {
  const hides = new Map<string, HideEntry>();
  const hide = (id: string, reason: number, model: string) => {
    let h = hides.get(id);
    if (!h) hides.set(id, h = { id, reasons: 0, models: [] });
    h.reasons |= reason;
    if (!h.models.includes(model)) h.models.push(model);
  };
  for (const [model, entry] of Object.entries(covers.models ?? {})) {
    for (const p of entry.p ?? []) hide(`NL.IMBAG.Pand.${p}`, HIDE_COVER_PAND, model);
    for (const o of entry.o ?? []) hide(String(o), HIDE_COVER_OSM, model);
  }
  return hides;
}

/** The text a tile's slice hashes: one line per hidden building of the tile, in covers order (the order a cell lists them). */
export function tileCoversLines(ids: Iterable<string>, hides: ReadonlyMap<string, HideEntry>): string[] {
  const own = new Set(ids), lines: string[] = [];
  for (const h of hides.values()) if (own.has(h.id)) lines.push(`${h.id}:${h.reasons}:${h.models.join(',')}`);
  return lines;
}

/** sha256 of a tile's slice; the empty slice has a fixed value, so a tile no model covers never changes. */
export const tileCoversHash = (ids: Iterable<string>, hides: ReadonlyMap<string, HideEntry>): string =>
  crypto.createHash('sha256').update(tileCoversLines(ids, hides).join('\n')).digest('hex').slice(0, 16);

/** tile-ids.json: the building ids of every tile, keyed by the sha256 of the tile file they were read from. */
export type TileIdsCache = { version: 1; tiles: Record<string, { sha: string; ids: string[] }> };

/** Ids for each tile: the cache entry when the tile file's sha is unchanged, else `read(tile)` (which parses the tile).
 *  Returns the ids and the cache to write back (only the tiles asked for, so a removed tile drops out). */
export function resolveTileIds(tiles: readonly string[], shaOf: (tile: string) => string, cache: TileIdsCache | null, read: (tile: string) => string[]): { ids: Map<string, string[]>; cache: TileIdsCache; parsed: number } {
  const ids = new Map<string, string[]>(), next: TileIdsCache = { version: 1, tiles: {} };
  let parsed = 0;
  for (const t of tiles) {
    const sha = shaOf(t), hit = cache?.version === 1 ? cache.tiles[t] : undefined;
    let list: string[];
    if (hit && hit.sha === sha) list = hit.ids;
    else { list = read(t); parsed++; }
    ids.set(t, list);
    next.tiles[t] = { sha, ids: list };
  }
  return { ids, cache: next, parsed };
}

/** Tiles whose slice differs between two index.json `tileCovers` maps (all of them when `previous` has none). */
export const changedCoversTiles = (tiles: readonly string[], previous: Record<string, string> | undefined, now: ReadonlyMap<string, string>): string[] =>
  tiles.filter(t => previous?.[t] !== now.get(t));
