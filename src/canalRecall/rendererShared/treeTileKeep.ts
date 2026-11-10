// Tree tile hysteresis (lane P6, #334). The municipal trees stream the 12 z15 tiles nearest the view centre. From the
// air that set changes every few seconds, and tiles that just left came back: P5 (#332) logged rebuild pairs like
// `+11266/-22657` then `+22657/-11266`, each one a fetch, a parse and 10-22 k tree instances dissolving out and in.
// Two bounded fixes, both measured in pop-bands' `treeTiles`:
//  - a keep band: a resident tile stays while it ranks within `budget + keepExtra` of the wanted (in-view) tiles; a
//    tile not yet resident is only added within `budget`. At most `budget + keepExtra` tiles are drawn.
//  - a recently-dropped cache: a tile that does leave keeps its parsed records for `cacheMs` (at most `cacheMax`
//    tiles, oldest evicted first; 8 held only ~11 s of a 42-drop/min flight, 24 holds about the 45 s aerial loop), so coming back within that time restores it without a fetch or parse.
// `?treeTileKeep=0` (or `window.__canalRecallTreeTileKeep = false`) restores the plain nearest-12 set and no cache.

export const TREE_TILE_KEEP_DEFAULT = true;

export function treeTileKeepFlag(): boolean {
  const g = globalThis as { __canalRecallTreeTileKeep?: boolean | string; location?: { search?: string } };
  // A regex, not URLSearchParams: bundles are also evaluated in Node checks without it.
  const m = /[?&]treeTileKeep=([^&]*)/.exec(g.location?.search ?? '');
  const asked = g.__canalRecallTreeTileKeep ?? (m ? m[1] : null);
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  return TREE_TILE_KEEP_DEFAULT;
}

export type TileKeepOptions = { budget: number; keepExtra: number; cacheMax: number; cacheMs: number };
export const TREE_TILE_KEEP: TileKeepOptions = { budget: 12, keepExtra: 4, cacheMax: 24, cacheMs: 60_000 };

/**
 * The tiles to hold. `ranked` are the wanted tile keys, nearest first. Off (`keepExtra` 0) this is the first `budget`.
 */
export function keepTiles(ranked: readonly string[], resident: ReadonlySet<string> | { has(k: string): boolean }, o: Pick<TileKeepOptions, 'budget' | 'keepExtra'>): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i < ranked.length; i++) {
    if (i < o.budget) keys.add(ranked[i]);
    else if (i < o.budget + o.keepExtra && resident.has(ranked[i])) keys.add(ranked[i]);
    else if (i >= o.budget + o.keepExtra) break;
  }
  return keys;
}

/** Parsed tiles that just left, for `cacheMs`, at most `cacheMax` (oldest evicted). */
export class DroppedTileCache<T> {
  private readonly items = new Map<string, { data: T; at: number }>();
  restores = 0;
  evictions = 0;
  constructor(private readonly o: Pick<TileKeepOptions, 'cacheMax' | 'cacheMs'>) {}
  get size(): number { return this.items.size; }
  put(key: string, data: T, now: number): void {
    if (this.o.cacheMax <= 0) return;
    this.items.delete(key);
    this.items.set(key, { data, at: now });
    this.expire(now);
    while (this.items.size > this.o.cacheMax) { this.items.delete(this.items.keys().next().value as string); this.evictions++; }
  }
  /** The tile's data if it left less than `cacheMs` ago (and forget it: it is resident again). */
  take(key: string, now: number): T | undefined {
    this.expire(now);
    const it = this.items.get(key);
    if (!it) return undefined;
    this.items.delete(key);
    this.restores++;
    return it.data;
  }
  expire(now: number): void {
    for (const [k, it] of this.items) { if (now - it.at <= this.o.cacheMs) break; this.items.delete(k); this.evictions++; }
  }
  clear(): void { this.items.clear(); }
}
