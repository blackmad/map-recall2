// Lane R3-C (#232): why the rail ballast beds went missing, and the small rules that keep them built.
//
// The owner the ten-load measurement found (tests/e2e/rail-beds.spec.ts): the own ground's resident ring was centred
// on the rider (`view.subject`), also while the camera was panned off it (camera.js `detached`, RE-CENTER showing).
// The user's S4 frame was taken that way: the rider at the Amstel, the view 2.8 km away over the Zuidas corridor, past
// the 2 km aerial ring, so the corridor drew from the far ring (flat bands) and the overview, never from built cells.
// `groundCentre` centres the ring on the view while detached (`?groundView=0`: the rider, as before).
//
// The brief's other candidates, made robust behind `?railRetry=0` and `?groundRequeue=0`. In 200 measured loads
// (2026-11-06) no rail fetch failed, both manifests read 139 cells and no build errored; 5 installs were discarded
// and each came back by the next residency update. They are cheap, and when one does fire it leaves a cell without
// rails or without a build, silently:
// - a failed rail cell fetch is not cached as "no rails" for the rest of the ride: it is retried with a backoff and,
//   when it keeps failing, the cell build fails (and is retried) instead of building a cell without its rails;
// - a failed rail manifest (cells.json) is retried and logged instead of switching every rail off;
// - the worker is handed the main thread's rail manifest (one source of truth);
// - a build thrown away at install because the ring changed, or a worker build error, asks again on the next
//   frame (errors with a backoff) instead of waiting for a 60 m move.

export type LngLat = [number, number];

/** Where the resident ring is centred: the view's centre while the camera is panned off the rider, else the rider. */
export function groundCentre(view: { subject: LngLat; lngLat: LngLat; detached?: boolean }, followView = true): LngLat {
  return followView && view.detached ? view.lngLat : view.subject;
}

function search(): string {
  return (globalThis as { location?: { search?: string } }).location?.search ?? '';
}

/** `?groundView=0`: the ground follows the rider also while the camera is panned away (the build before #232). */
export function groundViewFlag(query = search()): boolean {
  return !/[?&]groundView=0\b/.test(query);
}

/** `?railRetry=0`: rail fetch and manifest failures are cached as "no rails", the worker loads its own manifest. */
export function railRetryFlag(query = search()): boolean {
  return !/[?&]railRetry=0\b/.test(query);
}

/**
 * Ground workers start with the ground, not after the page's store has loaded (lane LS 2026-11-13): their bundle, their
 * own extract fetches and their store init run alongside the page's store init, and the page hands them its rail
 * manifest once it has it (#232 keeps one source of truth). Measured cold 2026-11-13: the workers were created 4 s after
 * the ground bundle, then fetched bridges.json again before asking for any cell. `?groundEarlyWorkers=0`: the old order.
 */
export function groundEarlyWorkersFlag(query = search()): boolean {
  return !/[?&]groundEarlyWorkers=0\b/.test(query);
}

/** `?groundRequeue=0`: a discarded install or a failed build waits for the next 60 m move (the build before #232). */
export function groundRequeueFlag(query = search()): boolean {
  return !/[?&]groundRequeue=0\b/.test(query);
}

/** Fetch backoff, ms: three more tries over ~5 s, then the failure stands. */
export const RAIL_RETRY_MS: readonly number[] = [250, 1000, 4000];

/** `fn` until it resolves, waiting `delays[i]` before try i + 1; rejects with the last error once they run out. */
export async function retrying<T>(fn: () => Promise<T>, delays: readonly number[] = RAIL_RETRY_MS, sleep: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms))): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i >= delays.length) throw error;
      await sleep(delays[i]);
    }
  }
}

/** Build retry backoff after a worker error, ms (a cell that fails four times stays out until the ring moves on). */
export const BUILD_RETRY_MS: readonly number[] = [500, 2000, 8000];

/**
 * Failed cell builds waiting for another try: `fail` books the next try after the key's backoff (false when the key
 * has used them all), `due` says whether any try is due now, `forget` clears keys the ring no longer wants.
 */
export class BuildRetries {
  private readonly tries = new Map<string, { n: number; at: number }>();
  constructor(private readonly delays: readonly number[] = BUILD_RETRY_MS) {}
  fail(key: string, now: number): boolean {
    const t = this.tries.get(key), n = (t?.n ?? 0) + 1;
    if (n > this.delays.length) { this.tries.set(key, { n, at: Infinity }); return false; }
    this.tries.set(key, { n, at: now + this.delays[n - 1] });
    return true;
  }
  /** Some booked try is due at `now` (each is reported once: its time moves to Infinity until it fails again). */
  due(now: number): boolean {
    let any = false;
    for (const t of this.tries.values()) if (t.at <= now) { t.at = Infinity; any = true; }
    return any;
  }
  /** A key built (or no longer wanted): its count starts again. */
  forget(key: string): void { this.tries.delete(key); }
  get size(): number { return this.tries.size; }
}
