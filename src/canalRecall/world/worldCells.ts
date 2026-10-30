/**
 * Browser/worker client for `world-v1` (behind `?world=v1`). v1 is tile-preserving: the streamer still
 * plans z14 tiles exactly as the default path does, and asks this client for a tile's buildings, which it
 * assembles from the cells that hold them (index.json `tileCells`), in the tile's own order (`ordinal`).
 * So the resident set, its order, the chunk groups and their context are the default path's, and the
 * chunk arrays are identical; what goes away is the GeoJSON parse, the clones, dropNestedDuplicates, the
 * facts/roof-facts tile fetches and the decorator chain on the main thread.
 */
import { decodeCellResponse, rawFeature, styledFeature, WORLD_FORMAT_VERSION, type Cell, type Props, type Geometry } from './cellFormat.js';

export type WorldIndex = { version: 1; format: number; compiler: string; tileCells: Record<string, string[]>; cells: Record<string, { gzBytes: number; buildings: number; sha256: string }> };
export type WorldFeature = { type: 'Feature'; properties: Props; geometry: Geometry };

export function worldV1Enabled(search: string = typeof location !== 'undefined' ? location.search : ''): boolean {
  try { return new URLSearchParams(search).get('world') === 'v1'; } catch { return false; }
}

/** Parse and check index.json; null when it is not a world-v1 index (a host answering with the app page). */
export function readWorldIndex(value: unknown): WorldIndex | null {
  const v = value as Partial<WorldIndex> | null;
  if (!v || v.version !== 1 || v.format !== WORLD_FORMAT_VERSION || !v.tileCells || typeof v.tileCells !== 'object' || !v.cells || typeof v.cells !== 'object') return null;
  return v as WorldIndex;
}

/** Decoded cells kept for neighbouring tiles; a z14 tile spans ~2x2 cells, and the streamer holds 9-12 tiles. */
export const WORLD_CELL_CACHE = 24;

export class WorldCellClient {
  private readonly cells = new Map<string, Promise<Cell>>();
  /** Last decode time per cell, ms (diagnostics: `?world=v1` decode table). */
  readonly decodeMs = new Map<string, number>();
  constructor(readonly index: WorldIndex, private readonly baseUrl: string, private readonly fetcher: typeof fetch = (...a) => fetch(...a)) {}

  private cell(key: string, signal?: AbortSignal): Promise<Cell> {
    let hit = this.cells.get(key);
    if (hit) { this.cells.delete(key); this.cells.set(key, hit); return hit; }
    hit = (async () => {
      const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}/world-v1/cells/${key}.bin`, { signal });
      if (!response.ok) throw Error(`world cell ${key}: HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const t0 = performance.now();
      const cell = await decodeCellResponse(bytes, `world cell ${key}`);
      this.decodeMs.set(key, performance.now() - t0);
      return cell;
    })();
    // A failed or aborted fetch must not stay cached.
    hit.catch(() => { if (this.cells.get(key) === hit) this.cells.delete(key); });
    this.cells.set(key, hit);
    while (this.cells.size > WORLD_CELL_CACHE) this.cells.delete(this.cells.keys().next().value as string);
    return hit;
  }

  /**
   * A z14 tile's buildings in the default path's adopted order, with the baked styled copy of each.
   * Empty when the index lists no cell for the tile (the tile 404s in the default path too).
   */
  async tile(tileKey: string, signal?: AbortSignal): Promise<{ features: WorldFeature[]; styled: Map<WorldFeature, WorldFeature> }> {
    const keys = this.index.tileCells[tileKey] ?? [];
    const cells = await Promise.all(keys.map(k => this.cell(k, signal)));
    const picked: { ordinal: number; raw: WorldFeature; styled: WorldFeature }[] = [];
    for (const cell of cells) for (const b of cell.buildings) {
      if (b.tile !== tileKey) continue;
      const raw = rawFeature(b);
      picked.push({ ordinal: b.ordinal, raw, styled: styledFeature(b, raw) });
    }
    picked.sort((a, b) => a.ordinal - b.ordinal);
    for (let i = 1; i < picked.length; i++) if (picked[i].ordinal === picked[i - 1].ordinal) throw Error(`world tile ${tileKey}: ordinal ${picked[i].ordinal} twice`);
    const styled = new Map<WorldFeature, WorldFeature>();
    for (const p of picked) styled.set(p.raw, p.styled);
    return { features: picked.map(p => p.raw), styled };
  }
}
