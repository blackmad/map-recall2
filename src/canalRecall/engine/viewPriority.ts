/**
 * View priority (feedback 748b1a8f, 2026-11-14: "why do chunks of the city sometimes take so long to load? are we
 * doing anything to prioritize a load that's on screen / cancel ones that are off?").
 *
 * Every building loader ranked its work from the rider: the cell queue (worldStreamer.ts rankCells, aheadRank from the
 * rider), the chunk builds (threeBuildingsBrowser.ts chunkRank), the baked coarse fetches (bakedCoarse.ts, nearest the
 * rider first) and the complete city's tile fetches (buildingTileSource.ts planTilesAhead, nearest the view *box*
 * centre, which in a pitched view lies far up the screen). With the camera panned away from the rider (RE-CENTER
 * showing) the screen is somewhere else, so the blocks under the camera waited behind work for the rider's
 * neighbourhood and the far end of the view.
 *
 * This module ranks work by the screen instead. The view is a grid of screen points unprojected onto the ground
 * (`viewSamples`): every sample stands for the same share of the screen, so the number of samples inside a ground
 * box is its screen share, the near ground at the bottom of the screen weighing what it covers. `viewRank` puts boxes
 * on screen first, largest share first, then the rest by ground distance from the view's focus. The own engine
 * publishes the samples each camera change (`publishViewPriority`, a page global so every bundle reads the same one)
 * while the camera is detached from the rider; the loaders read `activeViewPriority()` and fall back to their rider
 * ranks when it is null, so the ride itself is unchanged and the rider corridor stays hot.
 *
 * `?viewPriority=0` (or `window.__canalRecallViewPriority = false`) turns it off: every loader ranks from the rider, as
 * before. `?viewPriority=all` also ranks by the screen while riding (A/B only).
 */

export type LngLat = [number, number];
/** [west, south, east, north] in degrees. */
export type GroundBox = readonly [number, number, number, number];

/** Grid density: columns × rows of screen points (a sample every ~40 px on a 1326×761 desktop view). */
export const VIEW_SAMPLE_COLS = 32;
export const VIEW_SAMPLE_ROWS = 20;
/** Ranks of on-screen boxes lie below this (−1e9 × share); off-screen ranks are metres (≥ 0). */
export const ON_SCREEN_RANK = -1e9;

export type ViewSamples = {
  /** lng, lat pairs of the samples that hit the ground (sky samples are left out). */
  readonly points: Float64Array;
  /** Samples taken, the sky included: a box's share is its samples over this. */
  readonly total: number;
  /** The ground the view centres on (the screen's lower middle): distance ranks are measured from it. */
  readonly focus: LngLat | null;
};

/**
 * Unproject a `cols` × `rows` grid of screen points (cell centres, CSS px) onto the ground. `unproject` returns null
 * above the horizon. The focus is the ground at 70 % down the screen's middle (near the viewer, as the rider is in
 * the chase view), else the nearest sample that hit the ground.
 */
export function viewSamples(unproject: (x: number, y: number) => LngLat | null, width: number, height: number, cols = VIEW_SAMPLE_COLS, rows = VIEW_SAMPLE_ROWS): ViewSamples {
  const out: number[] = [];
  let lowest: LngLat | null = null;
  if (width > 0 && height > 0) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const p = unproject((c + 0.5) * width / cols, (r + 0.5) * height / rows);
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    out.push(p[0], p[1]);
    if (c === cols >> 1) lowest = p;
  }
  let focus = width > 0 && height > 0 ? unproject(width / 2, height * 0.7) : null;
  if (!focus || !Number.isFinite(focus[0]) || !Number.isFinite(focus[1])) focus = lowest;
  return { points: Float64Array.from(out), total: Math.max(1, cols * rows), focus };
}

/** Share of the screen (0..1) whose ground lies in `box`. */
export function screenShare(box: GroundBox, view: ViewSamples): number {
  const [w, s, e, n] = box, p = view.points;
  let k = 0;
  for (let i = 0; i < p.length; i += 2) if (p[i] >= w && p[i] <= e && p[i + 1] >= s && p[i + 1] <= n) k++;
  return k / view.total;
}

const M_PER_DEG_LAT = 111320;
/** Ground distance (metres) from `p` to the nearest point of `box`. */
export function boxDistanceM(box: GroundBox, p: LngLat): number {
  const [w, s, e, n] = box, kx = M_PER_DEG_LAT * Math.cos(p[1] * Math.PI / 180);
  return Math.hypot(Math.max(w - p[0], 0, p[0] - e) * kx, Math.max(s - p[1], 0, p[1] - n) * M_PER_DEG_LAT);
}

/**
 * Rank of a ground box (lower first): on screen, ON_SCREEN_RANK × share (the biggest on screen first); off screen,
 * its distance from the view's focus in metres. Without a focus (nothing hit the ground) every box ranks 0.
 */
export function viewRank(box: GroundBox, view: ViewSamples): number {
  const share = screenShare(box, view);
  if (share > 0) return ON_SCREEN_RANK * share;
  return view.focus ? boxDistanceM(box, view.focus) : 0;
}

/** Whether a rank is on screen. */
export const onScreenRank = (rank: number): boolean => rank < 0;

/** [west, south, east, north] of slippy tile x/y at `zoom`. */
export function tileBox(zoom: number, x: number, y: number): GroundBox {
  const n = 2 ** zoom, lat = (t: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * t / n))) * 180 / Math.PI;
  return [x / n * 360 - 180, lat(y + 1), (x + 1) / n * 360 - 180, lat(y)];
}

// --- the page's shared state (one per page, read by every bundle) ---------------------------------------------------

export type ViewPriorityMode = 'off' | 'detached' | 'all';
/** Default: by the screen while the camera is detached from the rider; the ride keeps its rider ranks. */
export const VIEW_PRIORITY_DEFAULT: ViewPriorityMode = 'detached';

export function viewPriorityMode(search: string = typeof location !== 'undefined' ? location.search : '', w: any = typeof window !== 'undefined' ? window : {}): ViewPriorityMode {
  let v: string | null = null;
  try { v = new URLSearchParams(search).get('viewPriority'); } catch { /* no location */ }
  if (v === null && w?.__canalRecallViewPriority !== undefined) v = String(w.__canalRecallViewPriority);
  if (v === '0' || v === 'off' || v === 'false') return 'off';
  if (v === 'all') return 'all';
  if (v === '1' || v === 'on' || v === 'true' || v === 'detached') return 'detached';
  return VIEW_PRIORITY_DEFAULT;
}

export type ViewPriority = { readonly view: ViewSamples; /** Bumped on every publish (consumers re-plan on a change). */ readonly version: number };
const KEY = '__canalRecallViewPriority_state';
type Slot = { state: ViewPriority | null; version: number };
const slot = (): Slot => { const g = globalThis as unknown as Record<string, Slot | undefined>; return g[KEY] ??= { state: null, version: 0 }; };

/** The own engine, each camera change: the view's samples while it ranks by the screen, else null (rider ranks). */
export function publishViewPriority(view: ViewSamples | null): void {
  const s = slot();
  if (!view && !s.state) return;
  s.version++;
  s.state = view ? { view, version: s.version } : null;
}

/** The view to rank by now, or null: rank from the rider. */
export function activeViewPriority(): ViewPriority | null { return slot().state; }

/** The box rank under the active view priority, or null when none is active. */
export function activeViewRank(box: GroundBox): number | null {
  const s = slot().state;
  return s ? viewRank(box, s.view) : null;
}

/**
 * Whether the engine should publish this frame: the mode allows it (`detached` only while detached, `all` always) and
 * the view is a ride view (not the intro flight).
 */
export function wantsViewPriority(mode: ViewPriorityMode, detached: boolean, introFlat: number): boolean {
  if (mode === 'off' || introFlat > 0) return false;
  return mode === 'all' || detached;
}
