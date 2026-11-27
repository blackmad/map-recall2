// How many ground workers build cells, and which one builds a cell (pure; lane R5-A #260).
//
// Measured 2026-11-08 (production and lane harness): the ground worker builds one cell at a time, ~1–2 s each on the
// user's Mac, so the 13–20 cells of a start or an aerial view land one by one over 20–30 s while the buildings are
// already crisp ("the land is fuzzy"). With several workers the cells build side by side (handed out as workers free
// up: nextDispatch).
//
// `?groundWorkers=N` (1–4, or `window.__canalRecallGroundWorkers`) sets the count; 1 is the single worker as before.

export const GROUND_WORKERS_MAX = 4;

/** The count asked for (1–4), else `fallback` (the device default). */
export function groundWorkersFlag(fallback: number, search?: string): number {
  const g = globalThis as { __canalRecallGroundWorkers?: number | string; location?: { search?: string } };
  const raw = g.__canalRecallGroundWorkers ?? new URLSearchParams(search ?? g.location?.search ?? '').get('groundWorkers');
  const n = Number(raw);
  if (raw != null && raw !== '' && Number.isInteger(n) && n >= 1 && n <= GROUND_WORKERS_MAX) return n;
  return Math.max(1, Math.min(GROUND_WORKERS_MAX, Math.floor(fallback)));
}

/**
 * The camera's cell first (lane R5-A #260): the cell under the view's look-at point and its 8 neighbours build before
 * the rest of the ring, nearest the look-at first. inFocusBlock: whether cell `key` ("x_y") is `focus` or one of its 8
 * neighbours.
 */
export function inFocusBlock(key: string, focus: string | null): boolean {
  if (!focus) return false;
  const [x, y] = key.split('_').map(Number), [fx, fy] = focus.split('_').map(Number);
  return Math.abs(x - fx) <= 1 && Math.abs(y - fy) <= 1;
}

/** Ranks below every ring rank (metres or the look-ahead's score) for a focus-block cell: its look-at distance first. */
export const FOCUS_RANK_BASE = -1e9;

/** Default ground workers: 3 on a desktop (the ring in about half the time, measured), 1 on a touch device (unmeasured). */
export function defaultGroundWorkers(detail: 'full' | 'touch'): number { return detail === 'touch' ? 1 : 3; }

/**
 * Cells handed to the workers as they free up (lane R5-A #260 step 2). Measured 2026-11-08 (quiet machine, 3 cold
 * desktop starts, workerTrace.ts): sending the whole ring at once, balanced by count, gave one worker two or three of
 * the LOD 0 cells (each ~2–4 s against ~0.5–1 s for LOD 1) while the others went idle, so the ring waited on that one
 * worker (ring 10.0 s, the other two workers done by 5.6 s). Now each worker holds at most `PULL_DEPTH` cells and the
 * next best-ranked cell goes to whichever worker replies first. Depth 1: with 2 the first deal still gave one worker
 * two LOD 0 cells (block 7.6 s against ~6 s, 2 of 3 runs). Far blocks (worker 0's queue, after cells) may now run
 * between two of its cells.
 */
export const PULL_DEPTH = 1;

/**
 * How far down the waiting list a worker with room may look for a cell near the ones it already loaded (lane R5-A
 * #260 step 2). Measured 2026-11-08: each cell loads and plans its whole 3×3 neighbourhood (relief, OSM, roads, way
 * decks, tunnel cuts), and with the ring dealt out by rank the three workers fetched and decoded the same files 2.4
 * times over (793 fetches, 328 distinct); data-in was ~2/3 of each worker's time. A worker now takes, among the next
 * `AFFINITY_WINDOW` waiting cells, the one sharing the most neighbours with what it already holds (ties: the best
 * ranked).
 */
export const AFFINITY_WINDOW = 4;

/**
 * Affinity within one level (lane R5-A #260 step 3). Measured 2026-11-09 (3 cold desktop starts): at +1.9 s worker 0
 * was free with `0_-1@0, -2_0@1, …` waiting, and affinity took `-2_0@1` (6 shared neighbours against 4), so the last
 * LOD 0 cell of the block waited 1.6 s for another worker and set the block (6.6–6.9 s). Now a free worker's affinity
 * only chooses among waiting cells of the same level as the best-ranked one.
 *
 * Block first (lane R5-A #260 step 3, follow-up). Measured 2026-11-09 (start 0_-1, level-bound affinity on): the
 * focus block's L1 cell 1_-2 landed at +8.1 s because free workers' affinity, looking 4 cells down the waiting list,
 * took L1 cells outside the block (-1_1, 0_1) that shared more neighbours with what they held. Now affinity only
 * chooses among waiting cells in the same tier as the best-ranked one: same level and same side of the focus block.
 *
 * A waiting cell's dispatch tier: its level, and with `focus` whether it is in the focus block (inFocusBlock).
 */
export function dispatchTier(key: string, lod: number | undefined, focus: string | null | undefined): string {
  return focus === undefined ? `${lod}` : `${lod}:${inFocusBlock(key, focus) ? 1 : 0}`;
}

/** Neighbour cells of `key` ("x_y", its 3×3 block) already in `seen` (a worker's loaded neighbourhoods). */
export function sharedNeighbours(key: string, seen: ReadonlySet<string>): number {
  const [x, y] = key.split('_').map(Number);
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (seen.has(`${x + dx}_${y + dy}`)) n++;
  return n;
}

/**
 * The cells to send now, as [key, worker]: while a worker holds fewer than `depth`, the worker holding the fewest
 * (lowest index on a tie) takes a pending cell not already with a worker, from the first `window` such cells in
 * `order` (best first): the one with the highest `affinity(key, worker)`, ties to the best ranked. With `window` 1
 * (the default) it is simply the next cell in order. With `tierOf`, only cells in the best-ranked cell's tier compete
 * (its level and its side of the focus block: dispatchTier).
 */
export function nextDispatch(order: readonly string[], pending: { has(key: string): boolean }, sent: { has(key: string): boolean }, held: readonly number[], depth = PULL_DEPTH, window = 1, affinity?: (key: string, worker: number) => number, tierOf?: (key: string) => string | number | undefined): [string, number][] {
  const load = [...held], out: [string, number][] = [];
  const waiting = order.filter(key => pending.has(key) && !sent.has(key));
  while (waiting.length) {
    let w = -1;
    for (let i = 0; i < load.length; i++) if (load[i] < depth && (w < 0 || load[i] < load[w])) w = i;
    if (w < 0) break;
    let pick = 0;
    if (affinity && window > 1) {
      let best = -Infinity;
      const tier = tierOf?.(waiting[0]);
      for (let i = 0; i < Math.min(window, waiting.length); i++) {
        if (tierOf && i > 0 && tierOf(waiting[i]) !== tier) continue;
        const a = affinity(waiting[i], w); if (a > best) { best = a; pick = i; }
      }
    }
    const [key] = waiting.splice(pick, 1);
    load[w]++;
    out.push([key, w]);
  }
  return out;
}
