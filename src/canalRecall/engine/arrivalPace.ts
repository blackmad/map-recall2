/**
 * Arrival pacing from the air (lane R4-E #248). The long aerial frames that remained at ~500 draws are not harness
 * teleports: a player-like continuous pan (scripts/aerial-pan.mjs --continuous) has them too, and they sit on the frames
 * where the world-v1 fetch ring jumps from a handful of cells to the whole pitched view (4 -> 132, 25 -> 378 cells).
 * worldRing.rideBox keeps a ride-sized stand-in round the rider while the rider is inside the view's bounding box; a
 * pitched aerial view's box reaches kilometres, so a pan from the air holds the stand-in until the parked rider leaves
 * that box and then reads the whole view at once: 55-76 tiles, ~70 baked coarse cells and their ground in one or two
 * seconds, 15-22 frames over 100 ms with the main thread idle (the GPU process drains the arrival).
 *
 * `?arrivalPace=1` spreads such a jump: the ring admits new cells nearest the view centre first, from a token bucket
 * (RING_PACE_CELLS per RING_PACE_MS, burst RING_PACE_BURST); cells leave at once. A ring that grows by a row at the
 * pan's leading edge (about one cell a second at 120 m/s) never waits. `?arrivalPace=ring` paces the ring only,
 * `?arrivalPace=baked` only the baked coarse installs (bakedCoarse.ts: at most one cell installed per frame, so a
 * cell's upload does not share its frame with another's). Off by default until measured; with the flag off the ring
 * and the installs are exactly as before.
 */
import { cellBounds, parseCellKey } from '../world/cellGrid.js';

export const RING_PACE_CELLS = 6;
export const RING_PACE_MS = 250;
export const RING_PACE_BURST = 12;
/** Baked coarse cells installed per frame when paced. */
export const BAKED_PACE_PER_FRAME = 1;
/** Two calls closer than this belong to one frame (the baked tier steps from sync and from the facade layer). */
export const BAKED_PACE_FRAME_MS = 8;

export type ArrivalPace = { ring: boolean; baked: boolean };

/** `?arrivalPace=1|on` both, `ring`, `baked`; absent, `0` or anything else: off (null). */
export function arrivalPaceOption(search: string = typeof location !== 'undefined' ? location.search : '', w: any = typeof window !== 'undefined' ? window : {}): ArrivalPace | null {
  let v: string | null = null;
  try { v = new URLSearchParams(search).get('arrivalPace'); } catch { /* no location */ }
  if (v === null && w?.__canalRecallArrivalPace !== undefined) v = String(w.__canalRecallArrivalPace);
  if (v === '1' || v === 'on' || v === 'true') return { ring: true, baked: true };
  if (v === 'ring') return { ring: true, baked: false };
  if (v === 'baked') return { ring: false, baked: true };
  return null;
}

function cellCentreLngLat(key: string): [number, number] {
  const [w, s, e, n] = cellBounds(...parseCellKey(key));
  return [(w + e) / 2, (s + n) / 2];
}

/**
 * The paced ring: the cells of `next` already `held`, plus at most `allowance` of its new cells, nearest `centre`
 * first (ties by key, so the result is stable). Cells of `held` not in `next` are gone at once.
 */
export function paceRingCells(held: ReadonlySet<string> | null, next: ReadonlySet<string>, centre: readonly [number, number], allowance: number): Set<string> {
  if (!held) return new Set(next);
  const out = new Set<string>();
  const fresh: { key: string; d: number }[] = [];
  const cos = Math.cos(centre[1] * Math.PI / 180);
  for (const key of next) {
    if (held.has(key)) { out.add(key); continue; }
    const [lng, lat] = cellCentreLngLat(key);
    fresh.push({ key, d: Math.hypot((lng - centre[0]) * cos, lat - centre[1]) });
  }
  fresh.sort((a, b) => a.d - b.d || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (let i = 0; i < Math.min(Math.max(0, Math.floor(allowance)), fresh.length); i++) out.add(fresh[i].key);
  return out;
}

/** A token bucket: `perMs` tokens a millisecond up to `burst`; starts full. */
export class TokenBucket {
  private tokens: number;
  private at: number | null = null;
  constructor(private readonly perMs: number, private readonly burst: number) { this.tokens = burst; }
  available(now: number): number {
    return this.at == null ? this.tokens : Math.min(this.burst, this.tokens + Math.max(0, now - this.at) * this.perMs);
  }
  take(n: number, now: number): void {
    this.tokens = Math.max(0, this.available(now) - n);
    this.at = now;
  }
}

/**
 * The ring pacer the city streamer holds. `pace` is pure with respect to the bucket (the streamer calls it for its
 * follow signature every frame); `commit` spends the tokens for the cells a plan actually added.
 */
export class RingPacer {
  private readonly bucket = new TokenBucket(RING_PACE_CELLS / RING_PACE_MS, RING_PACE_BURST);
  /** Cells held back so far (diagnostics: the ring's shortfall against the full view). */
  deferred = 0;
  pace(held: ReadonlySet<string> | null, next: ReadonlySet<string>, centre: readonly [number, number], now: number): Set<string> {
    return paceRingCells(held, next, centre, this.bucket.available(now));
  }
  commit(held: ReadonlySet<string> | null, ring: ReadonlySet<string>, full: ReadonlySet<string>, now: number): void {
    if (!held) return;
    let added = 0;
    for (const key of ring) if (!held.has(key)) added++;
    this.deferred = full.size - ring.size;
    if (added) this.bucket.take(added, now);
  }
}

/** Installs per frame for the baked coarse tier: `admit(now)` is true while this frame has an install left. */
export class FrameAdmit {
  private frameAt = -Infinity;
  private used = 0;
  constructor(private readonly perFrame = BAKED_PACE_PER_FRAME, private readonly frameMs = BAKED_PACE_FRAME_MS) {}
  admit(now: number): boolean {
    if (now - this.frameAt >= this.frameMs) { this.frameAt = now; this.used = 0; }
    if (this.used >= this.perFrame) return false;
    this.used++;
    return true;
  }
}
