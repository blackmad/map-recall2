/**
 * The baked coarse tier (lane R4-A, #243; `?bakedCoarse=0` off: the runtime coarse shells, as before). The city away
 * from the rider's detailed block used to be built at runtime: one `coarse:` chunk per z14 tile, built in the worker
 * from the tile's buildings (threeBuildingFeatures.buildFeatureChunk 'coarse' with shell roofs), uploaded, dissolved in
 * and dropped, again every time the world ring topped a tile up with a further cell. From the air that was the pop-in
 * and the upload churn (17.8 GB over a 3-minute pan). The world compiler bakes the same chunk per 1 km cell
 * (`world:compile --shell`, SHEL, scripts/world/shellBake.ts); this layer draws it, one mesh (one draw) per cell:
 *
 * - The world worker fetches, inflates and decodes a cell (world/worldCells.ts `world-shell`), regroups its vertices
 *   per building and names each range by building id, and transfers the buffers; the main thread wraps them.
 * - The cells it holds are the cells of the facade layer's resident buildings (the world ring's cells), nearest first,
 *   within a triangle and cell budget per profile, with hysteresis (BAKED_KEEP_M). A building whose cell this layer
 *   covers (wanted, in flight or drawn, and not failed) is left out of the runtime `coarse:` groups, so a tile whose
 *   cells are all baked builds no coarse chunk at all; a cell that fails (or a stale layer table) falls back to it.
 * - Each mesh carries the chunk material and the per-vertex `hidden` and `swapSlot` bytes, registered with the facade
 *   layer (ThreeBuildings.bakedCoarseHost), which fills a building's range as it does in a coarse chunk: hidden ids,
 *   detail installed over it, ghosted, highlighted, dimmed, the swap's complementary dissolve.
 * - Arrivals dissolve in over BAKED_FADE_MS on a clone of the material (one program). The far tier hides its part of a
 *   cell once the cell draws here (FarShellHost.coarseDrawn(tile, cell)).
 * - Ground: each building is lifted onto the own ground's footprint base (the coarse chunks' rule), in time-sliced
 *   passes (`refreshShellBases`); a cell is kept on the CPU for that only while it is within BAKED_LIFT_RADIUS_M at
 *   street level, BAKED_AIR_LIFT_RADIUS_M from the air (only where the detail tier swaps in: a shell left at z 0 under
 *   a lifted detail chunk stripes through the complementary dissolve, swap-zfight at s1-hoftuin). A cell installed
 *   without its CPU copy is fetched again when it comes within that radius.
 */
import { LeavingFades, popFadeFlag } from './popFade.js';
import { CELL_GRID, cellBounds, parseCellKey } from '../world/cellGrid.js';
import { shellOrigin } from '../world/shellMesh.js';
import type { BakedRange } from '../world/bakedCellArrays.js';
import { orderByDistance } from '../rendererShared/baseRefreshBudget.js';
import { FrameAdmit } from './arrivalPace.js';

/** A cell's SW corner in chunk metres (the baked meshes' position). */
export function bakedCellOrigin(key: string): [number, number] { const [i, j] = parseCellKey(key); return shellOrigin(i, j); }

/**
 * Touch devices keep their runtime `shell` chunks by default (lane R4-A measured both, iPhone pan headed 2026-11-07:
 * baked GL max 419 MB against 356 and 23 frames over 100 ms against 13, a whole cell uploading on one frame; facade
 * draws 22 against 48 median). `?bakedCoarse=1` turns it on there.
 */
export const BAKED_COARSE_TOUCH_DEFAULT = false;

/**
 * Desktop default ON (lane R4-A #243, 2026-11-07). It was turned off for a few hours the same evening when a held-camera
 * spec (crisp-textures with `sync` stubbed) showed no houses at the user's Da Costakade chase poses: the baked dissolves
 * only advanced from `OwnWorldView.sync`, so the held spec left every covered cell at fade 0 while their buildings were
 * already out of the runtime coarse chunks. Real play never lost them (parked rider, 13 of 13 cells drawn). The dissolve
 * now steps in the facade layer's `prepareFrame` (`BakedCoarseHostView.setFrame`) and `tests/e2e/baked-fabric.spec.ts`
 * pins the pose with the tier on and off.
 */
export const BAKED_COARSE_DESKTOP_DEFAULT = true;

/**
 * `?bakedCoarse=0` (or `window.__canalRecallBakedCoarse = false`): the runtime coarse shells, as before. `?bakedCoarse=1`
 * forces it on (touch included), `?bakedCoarse=desktop` turns it on for desktop only; the defaults are the two constants below the touch note.
 */
export function bakedCoarseEnabled(touch: boolean, search: string = typeof location !== 'undefined' ? location.search : '', w: any = typeof window !== 'undefined' ? window : {}): boolean {
  let v: string | null = null;
  try { v = new URLSearchParams(search).get('bakedCoarse'); } catch { /* no location */ }
  if (v === null && w.__canalRecallBakedCoarse !== undefined) v = String(w.__canalRecallBakedCoarse);
  if (v === '0' || v === 'off' || v === 'false') return false;
  if (v === '1' || v === 'on' || v === 'true') return true;
  if (v === 'desktop') return !touch;
  return touch ? BAKED_COARSE_TOUCH_DEFAULT : BAKED_COARSE_DESKTOP_DEFAULT;
}

/**
 * The smaller GPU layout of a baked cell (lane R4-I #253; `?bakedBytes=0` or `window.__canalRecallBakedBytes = false`
 * restores the R4-A layout exactly): accents as RGB (3 bytes a vertex, not 4; bakedCellArrays `compact`).
 */
export function bakedBytesEnabled(search: string = typeof location !== 'undefined' ? location.search : '', w: any = typeof window !== 'undefined' ? window : {}): boolean {
  let v: string | null = null;
  try { v = new URLSearchParams(search).get('bakedBytes'); } catch { /* no location */ }
  if (v === null && w.__canalRecallBakedBytes !== undefined) v = String(w.__canalRecallBakedBytes);
  return !(v === '0' || v === 'off' || v === 'false');
}

/**
 * Release from the air (lane R4-I #253): from the air (not street level), a covered cell whose nearest edge is at least
 * this far from the camera eye drops its baked mesh while the far tier holds the cell's SHL1 prisms (they un-hide when
 * the cell is no longer drawn here, FarShellHost.coarseDrawn); the cell stays covered, so no runtime coarse chunk is
 * built for it. It comes back under `BAKED_RELEASE_M - BAKED_RELEASE_BACK_M` (hysteresis).
 */
export const BAKED_RELEASE_M = 3000;
export const BAKED_RELEASE_BACK_M = 600;
/** The default: null, release off (see bakedReleaseM). */
export const BAKED_RELEASE_DEFAULT: number | null = null;
/** `?bakedRelease=0` off, `=1` on at BAKED_RELEASE_M, `=<metres>` (≥ 500) on at that distance; absent: the default. */
export function bakedReleaseM(search: string = typeof location !== 'undefined' ? location.search : '', w: any = typeof window !== 'undefined' ? window : {}): number | null {
  let v: string | null = null;
  try { v = new URLSearchParams(search).get('bakedRelease'); } catch { /* no location */ }
  if (v === null && w.__canalRecallBakedRelease !== undefined) v = String(w.__canalRecallBakedRelease);
  if (v === null) return BAKED_RELEASE_DEFAULT;
  if (v === '0' || v === 'off' || v === 'false') return null;
  if (v === '1' || v === 'on' || v === 'true') return BAKED_RELEASE_M;
  const m = Number(v);
  return Number.isFinite(m) && m >= 500 ? m : BAKED_RELEASE_DEFAULT;
}

/**
 * Which covered cells are released (pure): from the air only, those at least `releaseM` from the eye (nearest edge),
 * or still `releaseM - backM` for a cell already released, and only where `farReady` (the far tier draws them instead).
 */
export function releasedCells(covered: Iterable<string>, eye: [number, number] | null, aerial: boolean, releaseM: number | null, previous: ReadonlySet<string>, farReady: (key: string) => boolean, backM = BAKED_RELEASE_BACK_M): Set<string> {
  const out = new Set<string>();
  if (!eye || !aerial || releaseM == null) return out;
  for (const key of covered) {
    const d = cellDistanceM(key, eye[0], eye[1]);
    if ((d >= releaseM || (previous.has(key) && d >= releaseM - backM)) && farReady(key)) out.add(key);
  }
  return out;
}

/** The resident budget: cells and triangles (a touch device holds fewer). */
export function bakedCoarseBudget(touch: boolean): { cells: number; triangles: number } {
  return touch ? { cells: 24, triangles: 2_000_000 } : { cells: 96, triangles: 3_500_000 };
}
export const BAKED_INFLIGHT = 4;
/** The arrival dissolve (the coarse chunks' CHUNK_FADE_MS). */
export const BAKED_FADE_MS = 700;
/** Hysteresis: a resident cell the plan no longer wants stays while its nearest edge is within the wanted radius plus this. */
export const BAKED_KEEP_M = 600;
/** Street level: cells whose nearest edge is within this of the rider keep their positions on the CPU to be lifted. */
export const BAKED_LIFT_RADIUS_M = 1500;
/** From the air: the lift radius (nearest cell edge), the detail tier's neighbourhood only. */
export const BAKED_AIR_LIFT_RADIUS_M = 300;
/** Triangles per gzip byte of SHEL, the plan's estimate before a cell is seen (604 staged cells: 10.2 M over 49.6 MB). */
export const TRIS_PER_GZ_BYTE = 0.2;

/** Distance from (lng, lat) to a cell's nearest edge, metres (the cell grid's metres per degree). */
export function cellDistanceM(key: string, lng: number, lat: number): number {
  const [i, j] = parseCellKey(key), [w, s, e, n] = cellBounds(i, j), [mx, my] = CELL_GRID.metresPerDegree;
  return Math.hypot(Math.max(w - lng, 0, lng - e) * mx, Math.max(s - lat, 0, lat - n) * my);
}

/**
 * Which cells the tier wants (the wanted cells that have a shell, nearest first, within the budget by their triangle
 * estimate) and keeps (the wanted ones, plus residents within the wanted radius + `keepM`). Pure.
 */
/** Residents kept past the wanted set may take the budget this far over (cells and triangles). */
export const BAKED_KEEP_OVER = 1.1;

export function planBakedCells(lng: number, lat: number, wanted: Iterable<string>, available: ReadonlyMap<string, number>, budget: { cells: number; triangles: number }, triangles: (key: string) => number, residents: Iterable<string> = [], keepM = BAKED_KEEP_M): { want: string[]; keep: Set<string> } {
  const near: { key: string; d: number }[] = [];
  for (const key of new Set(wanted)) if (available.has(key)) near.push({ key, d: cellDistanceM(key, lng, lat) });
  near.sort((a, b) => a.d - b.d || (a.key < b.key ? -1 : 1));
  const want: string[] = [], keep = new Set<string>();
  let tris = 0, radius = 0;
  for (const { key, d } of near) {
    if (want.length >= budget.cells) break;
    const t = triangles(key);
    if (tris + t > budget.triangles && want.length) break;
    tris += t; want.push(key); keep.add(key); radius = Math.max(radius, d);
  }
  // Hysteresis: residents just outside the wanted radius stay, nearest first, up to a tenth over the budget (a long
  // jump must not keep the old view's cells on top of the new one's).
  const extra: { key: string; d: number }[] = [];
  for (const key of residents) if (!keep.has(key) && available.has(key) && want.length) { const d = cellDistanceM(key, lng, lat); if (d <= radius + keepM) extra.push({ key, d }); }
  extra.sort((a, b) => a.d - b.d || (a.key < b.key ? -1 : 1));
  const maxCells = Math.ceil(budget.cells * BAKED_KEEP_OVER), maxTris = budget.triangles * BAKED_KEEP_OVER;
  for (const { key } of extra) {
    const t = triangles(key);
    if (keep.size >= maxCells || tris + t > maxTris) break;
    tris += t; keep.add(key);
  }
  return { want, keep };
}

/** Per-building ranges as the facade layer's applyHidden reads them (id → contiguous vertex range); '' ranges are never named. */
export function rangeMap(ranges: readonly BakedRange[]): Map<string, { start: number; count: number }> {
  const out = new Map<string, { start: number; count: number }>();
  for (const r of ranges) if (r.id && !out.has(r.id)) out.set(r.id, { start: r.start, count: r.count });
  return out;
}

/**
 * Lift buildings onto their ground base: for each pending id whose `base(id)` is known (a number, or null: no relief,
 * 0), move its range's z by the change since the last lift. Returns the ids lifted; stops at `deadline` (checked every
 * 32 buildings). `pending` is consumed from the front. Pure over the arrays.
 */
export function liftRanges(positions: Float32Array | Int16Array, ranges: ReadonlyMap<string, { start: number; count: number }>, pending: string[], applied: Map<string, number>, base: (id: string) => number | null | undefined, deadline = Infinity, now: () => number = () => performance.now(), unit = 1): { lifted: number; done: number; min: number; max: number } {
  let lifted = 0, k = 0, min = 0, max = 0;
  const waiting: string[] = [];
  for (; k < pending.length; k++) {
    if ((k & 31) === 31 && now() > deadline) break;
    const id = pending[k], b = base(id);
    if (b === undefined) { waiting.push(id); continue; }
    // On a grid (`unit` < 1, Int16 positions) the change is between the two bases' grid steps, so lifts never drift.
    const z = b ?? 0, prev = applied.get(id) ?? 0, delta = unit === 1 ? z - prev : Math.round(z / unit) - Math.round(prev / unit), range = ranges.get(id);
    applied.set(id, z);
    if (!range || !delta) continue;
    for (let v = range.start; v < range.start + range.count; v++) positions[v * 3 + 2] += delta;
    lifted++; min = Math.min(min, z); max = Math.max(max, z);
  }
  const done = k;
  pending.splice(0, k, ...waiting);
  return { lifted, done, min, max };
}

/** A decoded, regrouped cell (world/worldCells.ts ShellCellData). */
export type BakedCellData = { key: string; positions: Float32Array | Int16Array; positionUnit?: number; uvs: Float32Array; layers: Uint8Array; tints: Uint8Array; /** 3 or 4 bytes a vertex (`accentSize`; absent: 4). */ accents: Uint8Array; accentSize?: 3 | 4; indices: Uint16Array | Uint32Array; ranges: BakedRange[]; triangles: number; gzBytes: number; /** look/thinFade.ts pairs, 2 per vertex (SHEL level 2). */ thin?: Uint8Array };

/** One drawn cell as the facade layer sees it (ThreeBuildings applyHidden / paintShells read `mesh` and `ranges`). */
export type BakedEntry = { key: string; mesh: any; ranges: Map<string, { start: number; count: number }> };

export interface BakedCoarseHost {
  THREE: any;
  scene(): any | null;
  material(): any | null;
  /** A clone of the material with its own `cityFade` (shares the program), or null. */
  fadeMaterial(value: number): any | null;
  /** Register a drawn cell with the facade layer: it fills `hidden` / `swapSlot` now and on every later change. */
  attach(entry: BakedEntry): void;
  detach(entry: BakedEntry): void;
  /** Whether the far tier holds this cell's prisms, drawn (a released cell shows them; lane R4-I). Absent: never released. */
  farReady?(key: string): boolean;
  /** Whether meshes need the `swapSlot` byte (the complementary dissolve is on). */
  swapSlots(): boolean;
  /** `exact`: Float32 metres at the SHEL's own unit (a cell within the lift radius), else Int16 decimetres. */
  fetchShell(key: string, signal: AbortSignal, exact?: boolean, compact?: boolean): Promise<BakedCellData>;
  /** Cells with a SHEL (tiles.json `shell`): gzip bytes. */
  available(): ReadonlyMap<string, number>;
  /** The coverage changed outside a plan call (a fetch failed, the tier turned off): regroup the coarse chunks. */
  coverageChanged(): void;
  /** A building's ground base (metres; null: no relief there; undefined: not known yet). */
  groundBase(id: string): number | null | undefined;
  repaint(): void;
}

/** GPU bytes of one resident cell by attribute (lane R4-I #253, the measure-first table). */
export type BakedAttrBytes = { vertices: number; position: number; uv: number; layer: number; tint: number; accent: number; thin: number; hidden: number; swapSlot: number; index: number; float32: boolean; index32: boolean };

type Resident = BakedEntry & { triangles: number; bytes: number; gzBytes: number; attrs: BakedAttrBytes; fade?: { start: number; clone: any; source: any }; drawn: boolean;
  /** Street-level lift: the CPU positions kept while buildings wait for their base. */
  lift?: { positions: Float32Array | Int16Array; unit: number; pending: string[]; applied: Map<string, number> }; lifted: boolean; liftable: boolean };

export class BakedCoarse {
  private readonly residents = new Map<string, Resident>();
  private readonly inflight = new Map<string, AbortController>();
  private readonly failed = new Set<string>();
  private readonly knownTriangles = new Map<string, number>();
  private at: [number, number] | null = null;
  private planAt: [number, number] | null = null;
  private wanted = new Set<string>();
  /** The cells the plan covers (want ∪ keep), minus failures: buildings there are not built as runtime coarse. */
  private covered = new Set<string>();
  private queue: string[] = [];
  private enabled = true;
  private liftOn = false;
  private fetchedBytes = 0;
  private uploads = 0;
  private readonly budget: { cells: number; triangles: number };
  /**
   * `?arrivalPace=1|baked` (engine/arrivalPace.ts, lane R4-E #248): fetched cells wait in `ready` and `frame` installs
   * at most one a frame, nearest first. Null: a cell installs when its fetch resolves, as before.
   */
  private readonly admit: FrameAdmit | null;
  private ready: { data: BakedCellData; relift: boolean }[] = [];
  /** The R4-I layout (bakedBytesEnabled); false: the R4-A arrays, byte for byte. */
  private readonly compact: boolean;
  /** Release from the air (bakedReleaseM): metres from the eye, or null (off). */
  private readonly releaseM: number | null;
  private readonly now: () => number;
  private eye: [number, number] | null = null;
  /** Covered cells released to the far tier (no mesh here, not fetched). */
  private released = new Set<string>();
  private lastWant: string[] = [];
  private releases = 0;
  constructor(private readonly host: BakedCoarseHost, options: { touch?: boolean; budget?: { cells: number; triangles: number }; paceInstalls?: boolean; compact?: boolean; releaseM?: number | null; /** The clock the dissolve starts on (tests inject one; the frame's `now` is read on the same one). */ now?: () => number } = {}) {
    this.now = options.now ?? (() => performance.now());
    this.budget = options.budget ?? bakedCoarseBudget(!!options.touch);
    this.compact = options.compact ?? false;
    this.releaseM = options.releaseM ?? null;
    this.admit = options.paceInstalls ? new FrameAdmit() : null;
  }

  get isEnabled(): boolean { return this.enabled; }
  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (!on) { this.clear(); this.covered.clear(); }
    this.host.coverageChanged(); // regroup: off builds the runtime coarse chunks, on plans this tier first
  }

  /** The GL context was lost: every mesh goes (its CPU arrays were released after upload) and the plan fetches again. */
  contextLost(): void {
    const wanted = this.wanted, at = this.at;
    this.clear();
    this.at = at; this.wanted = new Set();
    if (this.enabled && wanted.size) { this.plan(wanted); this.host.coverageChanged(); }
  }

  /** Whether buildings in `cell` are drawn here (or about to be): the facade layer leaves them out of its coarse groups. */
  covers(cell: string): boolean { return this.enabled && this.covered.has(cell); }
  /** Whether the cell's mesh is installed and done dissolving in (the far tier then hides its part). */
  drawn(cell: string): boolean { const r = this.residents.get(cell); return !!r && r.drawn; }
  /**
   * With the release on (lane R4-K #255): the cell is covered but its mesh is not drawn (released to the far tier, or
   * still arriving / dissolving in after a return), so the far prisms stand in for it until `drawn` (farPartHidden).
   * Always false with the release off: the far tier's tile-wide hand-over is unchanged there.
   */
  holdsFar(cell: string): boolean { return this.enabled && this.releaseM !== null && this.covered.has(cell) && !this.drawn(cell); }

  /**
   * The facade layer's resident cells (the cells of its buildings): re-plan when they change. Called from inside its
   * grouping, so it does not call coverageChanged (the caller regroups with the new coverage).
   */
  plan(cells: ReadonlySet<string>): void {
    if (!this.enabled) return;
    const same = cells.size === this.wanted.size && [...cells].every(c => this.wanted.has(c));
    if (same && this.planAt && this.at && this.planAt[0] === this.at[0] && this.planAt[1] === this.at[1]) return;
    this.wanted = new Set(cells);
    this.replan();
  }

  /** The rider (or camera subject) and whether the view is at street level (lift) rather than in the air. */
  update(lng: number, lat: number, street: boolean): void {
    this.liftOn = street;
    if (!this.enabled) return;
    const moved = !this.at || Math.hypot((lng - this.at[0]) * CELL_GRID.metresPerDegree[0], (lat - this.at[1]) * CELL_GRID.metresPerDegree[1]) >= 200;
    if (!this.at) this.at = [lng, lat];
    if (!moved) return;
    this.at = [lng, lat];
    if (this.wanted.size && this.replan()) this.host.coverageChanged();
    this.reliftNear();
  }

  /**
   * The camera eye (lane R4-I): from the air, covered cells at least the release distance from it give their mesh up
   * to the far tier's prisms, and come back nearer. Called per frame; acts only on a change of the released set.
   */
  setEye(lng: number, lat: number): void {
    this.eye = [lng, lat];
    if (this.enabled) this.applyRelease();
  }

  private applyRelease(): void {
    const next = releasedCells(this.covered, this.eye, !this.liftOn, this.releaseM, this.released, key => !!this.host.farReady?.(key));
    if (next.size === this.released.size && [...next].every(k => this.released.has(k))) return;
    const back = [...this.released].filter(k => !next.has(k));
    for (const key of next) if (!this.released.has(key)) {
      this.releases++;
      if (this.residents.has(key)) this.drop(key);
      const c = this.inflight.get(key); if (c) { c.abort(); this.inflight.delete(key); }
    }
    this.released = next;
    if (this.ready.length) this.ready = this.ready.filter(r => !next.has(r.data.key));
    // A cell back from the far tier is fetched again, also one the plan only keeps (hysteresis: released cells count as
    // held in replan, lane R4-K), which `lastWant` does not list.
    if (back.length) { const want = new Set(this.lastWant); this.pump([...this.lastWant, ...back.filter(k => this.covered.has(k) && !want.has(k))]); }
    this.host.repaint();
  }

  private liftRadius(): number { return this.liftOn ? BAKED_LIFT_RADIUS_M : BAKED_AIR_LIFT_RADIUS_M; }

  /** Re-plan from `wanted` and the anchor; true when the covered set changed. */
  private replan(): boolean {
    const anchor = this.at ?? this.centreOf(this.wanted);
    if (!anchor) return false;
    this.planAt = this.at ? [this.at[0], this.at[1]] : null;
    const available = this.host.available();
    const { want, keep } = planBakedCells(anchor[0], anchor[1], this.wanted, available, this.budget, key => this.knownTriangles.get(key) ?? (available.get(key) ?? 0) * TRIS_PER_GZ_BYTE, [...this.residents.keys(), ...this.released]);
    for (const key of [...this.residents.keys()]) if (!keep.has(key)) this.drop(key);
    for (const [key, c] of [...this.inflight]) if (!keep.has(key)) { c.abort(); this.inflight.delete(key); }
    const covered = new Set([...keep].filter(k => !this.failed.has(k)));
    const changed = covered.size !== this.covered.size || [...covered].some(k => !this.covered.has(k));
    this.covered = covered;
    for (const key of [...this.released]) if (!covered.has(key)) this.released.delete(key);
    this.pump(want);
    this.applyRelease();
    return changed;
  }

  private centreOf(cells: ReadonlySet<string>): [number, number] | null {
    if (!cells.size) return null;
    let x = 0, y = 0;
    for (const key of cells) { const [w, s, e, n] = cellBounds(...parseCellKey(key)); x += (w + e) / 2; y += (s + n) / 2; }
    return [x / cells.size, y / cells.size];
  }

  private pump(want?: string[]): void {
    const waiting = (k: string) => this.ready.length > 0 && this.ready.some(r => r.data.key === k);
    if (want) { this.lastWant = want; this.queue = want.filter(k => !this.residents.has(k) && !this.failed.has(k) && !this.released.has(k) && !waiting(k)); }
    while (this.inflight.size < BAKED_INFLIGHT && this.queue.length) {
      const key = this.queue.shift()!;
      if (this.residents.has(key) || this.inflight.has(key) || this.released.has(key) || waiting(key)) continue;
      this.request(key, false);
    }
  }

  private request(key: string, relift: boolean): void {
    const controller = new AbortController();
    this.inflight.set(key, controller);
    // Within the lift radius the cell is fetched exact: the detail tier swaps over it (bakedCellArrays BAKED_GRID_M).
    const exact = !!this.at && cellDistanceM(key, this.at[0], this.at[1]) <= this.liftRadius();
    this.host.fetchShell(key, controller.signal, exact, this.compact).then(data => {
      if (this.inflight.get(key) !== controller) return;
      this.inflight.delete(key);
      if (this.enabled && this.covered.has(key) && !this.released.has(key)) {
        if (this.admit) { this.ready.push({ data, relift }); this.host.repaint(); } else this.install(data, relift);
      }
      this.pump();
    }, error => {
      if (this.inflight.get(key) !== controller) return;
      this.inflight.delete(key);
      // An abort (ours, or a worker that died) is retried on the next plan; anything else falls back to the runtime coarse.
      if (!controller.signal.aborted && (error as { name?: string })?.name !== 'AbortError') {
        this.failed.add(key); console.warn(`baked coarse ${key}:`, error);
        if (this.covered.delete(key)) this.host.coverageChanged();
      }
      this.pump();
    });
  }

  private install(data: BakedCellData, relift: boolean): void {
    const scene = this.host.scene(), material = this.host.material(), THREE = this.host.THREE;
    this.knownTriangles.set(data.key, data.triangles);
    if (!scene || !material || !data.indices.length) return;
    const n = data.layers.length, [ox, oy] = bakedCellOrigin(data.key);
    const keepPositions = this.at ? cellDistanceM(data.key, this.at[0], this.at[1]) <= this.liftRadius() : false;
    // A cell to be lifted is in Float32 metres (fetched exact: the SHEL's own unit). One that came within the radius
    // after its request went out arrives on the decimetre grid and is widened here (a base rounded to that grid left
    // the shell's window rows a few centimetres off the lifted detail chunk's, which flickers through the swap's
    // complementary dissolve).
    let positions = data.positions, unit = data.positionUnit ?? 1;
    if (keepPositions && unit !== 1) { const f = new Float32Array(positions.length); for (let k = 0; k < f.length; k++) f[k] = positions[k] * unit; positions = f; unit = 1; }
    // A kept cell is drawn in absolute metres from ORIGIN at the mesh origin, as the runtime chunks are: the same
    // Float32 values through the same matrices rasterise the same silhouette, where a cell-local mesh offset by the
    // cell origin rounded its edges differently (s3-slab-user's slab edge through the swap dissolve).
    const absolute = keepPositions;
    if (absolute) { if (positions === data.positions) positions = Float32Array.from(positions); for (let k = 0; k < positions.length; k += 3) { positions[k] += ox; positions[k + 1] += oy; } }
    const g = new THREE.BufferGeometry();
    const release = (a: any) => { a.onUpload(function (this: any) { this.array = null; }); return a; };
    const position = new THREE.BufferAttribute(positions, 3);
    g.setAttribute('position', keepPositions ? position : release(position));
    g.setAttribute('uv', release(new THREE.BufferAttribute(data.uvs, 2)));
    g.setAttribute('layer', release(new THREE.BufferAttribute(data.layers, 1, false)));
    g.setAttribute('tint', release(new THREE.BufferAttribute(data.tints, 4, true)));
    // RGB under the R4-I layout: the vec4 attribute's w defaults to 1.0, which is every SHEL accent's alpha (255).
    g.setAttribute('accent', release(new THREE.BufferAttribute(data.accents, data.accentSize ?? 4, true)));
    // The runtime coarse chunk's `thin` (look/thinFade.ts): without it the eaves and cornice strips the chunk fades out
    // under a pixel stayed solid on the baked shell, which differed from the detail chunk there (swap-zfight).
    if (data.thin && data.thin.length === n * 2) g.setAttribute('thin', release(new THREE.BufferAttribute(data.thin, 2, false)));
    g.setAttribute('hidden', new THREE.BufferAttribute(new Uint8Array(n), 1, false));
    if (this.host.swapSlots()) g.setAttribute('swapSlot', new THREE.BufferAttribute(new Uint8Array(n), 1, false));
    g.setIndex(release(new THREE.BufferAttribute(data.indices, 1)));
    g.computeBoundingSphere();
    if (keepPositions && g.boundingSphere) g.boundingSphere.radius += 5 / unit; // lifts are a few metres either way
    const old = this.residents.get(data.key);
    const clone = relift && old ? null : this.host.fadeMaterial(0);
    if (clone) this.fadeIns++;
    const mesh = new THREE.Mesh(g, clone ?? material);
    mesh.name = `baked-coarse/${data.key}`;
    if (!absolute) mesh.position.set(ox, oy, 0);
    if (unit !== 1) mesh.scale.setScalar(unit);
    mesh.castShadow = false;
    mesh.frustumCulled = true;
    mesh.userData.coarse = true;
    mesh.userData.bakedCoarse = data.key;
    const ranges = rangeMap(data.ranges);
    const attrs: BakedAttrBytes = { vertices: n, position: positions.byteLength, uv: data.uvs.byteLength, layer: data.layers.byteLength, tint: data.tints.byteLength, accent: data.accents.byteLength,
      thin: g.getAttribute('thin') ? data.thin!.byteLength : 0, hidden: n, swapSlot: g.getAttribute('swapSlot') ? n : 0, index: data.indices.byteLength, float32: positions instanceof Float32Array, index32: data.indices instanceof Uint32Array };
    const r: Resident = { key: data.key, mesh, ranges, triangles: data.triangles, gzBytes: data.gzBytes, drawn: !clone, attrs,
      bytes: attrs.position + attrs.uv + attrs.layer + attrs.tint + attrs.accent + attrs.thin + attrs.hidden + attrs.swapSlot + attrs.index,
      // A cell widened from the decimetre grid is drawn and lifted now, and fetched again exact (reliftNear).
      lifted: keepPositions, liftable: keepPositions && (data.positionUnit ?? 1) === 1,
      ...(clone ? { fade: { start: this.now(), clone, source: material } } : {}),
      ...(keepPositions ? { lift: { positions, unit, pending: [...ranges.keys()], applied: new Map<string, number>() } } : {}) };
    if (old) this.drop(data.key, true);
    this.host.attach(r);
    scene.add(mesh);
    this.fetchedBytes += data.gzBytes; this.uploads += r.bytes;
    this.residents.set(data.key, r);
    this.host.repaint();
    if (keepPositions && !r.liftable) this.reliftNear();
  }

  /** Cells within the lift radius installed without their CPU positions are fetched again to be lifted. */
  private reliftNear(): void {
    if (!this.at) return;
    for (const r of this.residents.values()) {
      if (r.liftable || this.inflight.has(r.key) || this.inflight.size >= BAKED_INFLIGHT) continue;
      if (cellDistanceM(r.key, this.at[0], this.at[1]) > this.liftRadius()) continue;
      r.liftable = true; // one refetch per cell
      this.request(r.key, true);
    }
  }

  /**
   * Lift pending buildings onto the ground within `budgetMs` (street level only); returns buildings lifted. Cells
   * beyond BAKED_LIFT_RADIUS_M + BAKED_KEEP_M stop waiting and let their CPU copy go.
   */
  /**
   * Street level: lift the baked buildings onto the own ground in a time slice, with the facade layer's budget
   * interface (rendererShared/baseRefreshBudget.ts, R3-F #241): `ms` per frame, nearest cell first; `restart` (a new
   * ground revision) queues every building of the lifted cells again, so a relief tile that arrives later re-bases them
   * as it re-bases the facade chunks. `done` is false while work remains. Returns the buildings moved.
   */
  refreshShellBases(budget: { ms: number; restart?: boolean; done?: boolean }): number {
    if (!this.enabled) { budget.done = true; return 0; }
    const deadline = this.now() + budget.ms;
    let lifted = 0, remaining = false;
    const order = orderByDistance([...this.residents.values()].filter(r => r.lift).map(r => ({ key: r, distance: this.at ? cellDistanceM(r.key, this.at[0], this.at[1]) : 0 })));
    for (const r of order) {
      const lift = r.lift!;
      const attribute = r.mesh.geometry.getAttribute('position');
      if (this.at && cellDistanceM(r.key, this.at[0], this.at[1]) > this.liftRadius() + BAKED_KEEP_M) { this.settle(r, attribute); continue; }
      if (budget.restart) lift.pending = [...r.ranges.keys()];
      if (!lift.pending.length) continue;
      if (this.now() > deadline) { remaining = true; continue; }
      const out = liftRanges(lift.positions, r.ranges, lift.pending, lift.applied, id => this.host.groundBase(id), deadline, this.now, lift.unit);
      if (out.lifted) { attribute.needsUpdate = true; lifted += out.lifted; }
      if (lift.pending.length) remaining = true;
    }
    budget.done = !remaining;
    if (lifted) this.host.repaint();
    return lifted;
  }
  /** `refreshShellBases` with a plain per-frame budget (tests, older call sites). */
  refreshBases(budgetMs: number): number { return this.refreshShellBases({ ms: budgetMs }); }
  private settle(r: Resident, attribute: any): void {
    if (!r.lift) return;
    delete r.lift;
    if (attribute.array) attribute.onUpload(function (this: any) { this.array = null; });
    attribute.needsUpdate = true;
  }

  /** Per frame: a paced install (`?arrivalPace`), then the dissolves. */
  frame(now = performance.now()): void {
    let repaint = false;
    if (this.admit && this.ready.length) {
      // Nearest the anchor first; a cell no longer covered (re-planned away while it waited) is dropped unread.
      this.ready = this.ready.filter(r => this.enabled && this.covered.has(r.data.key) && !this.released.has(r.data.key));
      if (this.at) { const at = this.at; this.ready.sort((a, b) => cellDistanceM(a.data.key, at[0], at[1]) - cellDistanceM(b.data.key, at[0], at[1])); }
      while (this.ready.length && this.admit.admit(now)) { const r = this.ready.shift()!; this.install(r.data, r.relift); }
      if (this.ready.length) repaint = true;
    }
    const material = this.host.material();
    for (const r of this.residents.values()) {
      if (r.fade) {
        const t = (now - r.fade.start) / BAKED_FADE_MS;
        if (t < 1 && material && r.fade.source === material) { r.fade.clone.uniforms.cityFade.value = t * (material.uniforms?.cityFade?.value ?? 1); repaint = true; }
        else { if (material) r.mesh.material = material; r.fade.clone.dispose?.(); delete r.fade; r.drawn = true; repaint = true; }
      } else if (material && r.mesh.material !== material) r.mesh.material = material;
    }
    if (this.leaving?.step(now, material?.uniforms?.cityFade?.value ?? 1)) repaint = true;
    if (repaint) this.host.repaint();
  }

  /** `?popFade` (lane P2 #325): a drawn cell given back dissolves out instead of vanishing. */
  private readonly leaving: LeavingFades | null = popFadeFlag() ? new LeavingFades() : null;
  private drop(key: string, now = false): void {
    const r = this.residents.get(key);
    if (!r) return;
    this.residents.delete(key);
    this.host.detach(r);
    const release = () => { r.mesh.parent?.remove(r.mesh); r.mesh.geometry.dispose(); };
    const from = r.fade ? r.fade.clone.uniforms.cityFade.value : 1;
    r.fade?.clone.dispose?.();
    // Not a re-install of the same cell (install drops the old mesh after adding the new one: no overlap wanted).
    if (!now && this.leaving && r.mesh.visible !== false && from > 0.05 && this.leaving.leave(r.mesh, this.host.fadeMaterial(from), release)) { this.host.repaint(); return; }
    release();
  }

  clear(): void {
    this.leaving?.flush();
    for (const key of [...this.residents.keys()]) this.drop(key, true);
    for (const c of this.inflight.values()) c.abort();
    this.inflight.clear(); this.queue = []; this.ready = []; this.released = new Set(); this.lastWant = [];
    this.at = null; this.planAt = null;
  }

  /** Per resident cell: its GPU bytes by attribute (diagnostics; scripts/aerial-pan.mjs `bakedAttr`). */
  residentDetail(at?: [number, number]): ({ key: string; drawn: boolean; distanceM: number | null } & BakedAttrBytes)[] {
    return [...this.residents.values()].map(r => ({ key: r.key, drawn: r.drawn, distanceM: at ? Math.round(cellDistanceM(r.key, at[0], at[1])) : null, ...r.attrs }));
  }

  /** The cells drawn now (diagnostics). */
  drawnCells(): string[] { return [...this.residents.values()].filter(r => r.drawn).map(r => r.key); }

  /** Cells installed with a dissolve in (aerial-pan's coarse rebuild-wave count, against the runtime coarse fades). */
  private fadeIns = 0;

  stats(): { enabled: boolean; wanted: number; cells: number; drawn: number; fading: number; fadeIns: number; covered: number; triangles: number; gpuMB: number; fetchedMB: number; uploadedMB: number; pending: number; failed: number; liftPending: number; cpuMB: number; released: number; releases: number } {
    let triangles = 0, bytes = 0, drawn = 0, liftPending = 0, cpu = 0, fading = 0;
    for (const r of this.residents.values()) { triangles += r.triangles; bytes += r.bytes; if (r.drawn) drawn++; if (r.fade) fading++; if (r.lift) { liftPending += r.lift.pending.length; cpu += r.lift.positions.byteLength; } }
    return { enabled: this.enabled, wanted: this.wanted.size, cells: this.residents.size, drawn, fading, fadeIns: this.fadeIns, covered: this.covered.size, triangles, gpuMB: +(bytes / 1048576).toFixed(1), fetchedMB: +(this.fetchedBytes / 1048576).toFixed(2), uploadedMB: +(this.uploads / 1048576).toFixed(1), pending: this.inflight.size + this.queue.length + this.ready.length, failed: this.failed.size, liftPending, cpuMB: +(cpu / 1048576).toFixed(1), released: this.released.size, releases: this.releases };
  }

  dispose(): void { this.clear(); }
}
