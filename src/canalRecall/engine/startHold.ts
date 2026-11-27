// Lane S1 (#313, 2026-11-09): the loading screen waits for the city in the first frame, not just near the rider.
// User on ef73a29 (Free Ride at Westermarkt): "we should wait a little longer for settling the map so it doesn't start
// [like this]": the near ring resolved and, from ~250 m out, the frame was shells with grey lids to the horizon.
//
// Pure policy, read by the own world view (ownWorldView.ts startShellBusy) and by the game's loading hold
// (presentationRuntime.ts): what "the city is in" means at the first frame, the hold's cap, the message the
// loading screen shows while it waits, and the dissolve that hides what a capped hold still leaves.
//
// "In" (the census): the view is sampled on a screen grid, each sample unprojected to the ground, and each ground
// point asks which building tier owns it (START_TIER_OWNERS). The hold waits while any sample within
// START_HOLD_SHELL_RING_M of the view centre is owned by a stand-in: `farPending` (a cell the baked coarse tier covers
// but has not drawn yet, so the far tier's grey prisms stand there) or `coarse` (a runtime coarse shell on a tile
// whose detail chunk is still wanted). A runtime coarse shell that is the steady state (beyond the detail block on a
// phone, where the baked tier is off) is `coarse` with `wanted: false` and does not hold: waiting cannot replace it.

/** Ring from the view centre inside which no stand-in may show in the first frame, metres. */
export const START_HOLD_SHELL_RING_M = 600;
/** The whole start's cap (the ride-pose hold plus the intro hold), ms. Was 4000 + 1800. */
export const START_HOLD_CAP_MS = 10_000;
/** The intro hold keeps at least today's 1.8 s, whatever the ride-pose hold spent. */
export const START_HOLD_INTRO_MIN_MS = 1800;
/** After this long on "Settling the map…" the loading screen says it is building the city. */
export const START_HOLD_MESSAGE_AFTER_MS = 1500;
/** A capped hold dissolves the loading screen into the ride over this long, so the residual pop sits behind it. */
export const REVEAL_DISSOLVE_MS = 600;
/**
 * While a start hold waits, the game ticks the world (ownWorldView.settleTick: ground, far and baked tiers at the held
 * camera) at most this often, ms. Those tiers only advanced from sync(), which the game never ran under the loading
 * screen, so the baked cells the aim planned stayed undrawn (far prisms) until the reveal (#313).
 */
export const START_HOLD_TICK_MS_DESKTOP = 100;
export const START_HOLD_TICK_MS_TOUCH = 250;
/** Whether the loading frame ticks the held world: not on touch, where the baked tier is off and nothing it advances shows (#313 iPhone profile). */
export function startHoldTicks(touch: boolean): boolean { return !touch; }
export function startHoldTickDue(now: number, last: number | null | undefined, touch: boolean): boolean {
  return last == null || !Number.isFinite(last) || now - last >= (touch ? START_HOLD_TICK_MS_TOUCH : START_HOLD_TICK_MS_DESKTOP) || now < last;
}

/** Grid the census samples the view on (columns × rows). */
export const START_HOLD_GRID: readonly [number, number] = [24, 16];

export type StartTierOwner = 'facade' | 'baked' | 'coarse' | 'farPending' | 'none';
export const START_TIER_OWNERS: readonly StartTierOwner[] = ['facade', 'baked', 'coarse', 'farPending', 'none'];

/** One census sample: the ground point's distance from the view centre and the tier that owns it. */
export interface StartTierSample { distanceM: number; owner: StartTierOwner; /** For `coarse`: a detail chunk is wanted there (it will be replaced). */ wanted?: boolean }

/** `?startHold=0` (or `window.__canalRecallStartHold = false`) restores the 4 s + 1.8 s hold. */
export function startHoldEnabled(asked: unknown): boolean {
  return !(asked === false || asked === 0 || asked === '0' || asked === 'false' || asked === 'off');
}

/** The cap, ms: `?startHoldCap=8000` for the sweep (2–20 s), else START_HOLD_CAP_MS. */
export function startHoldCapMs(asked: unknown): number {
  const n = Number(asked);
  return asked != null && asked !== '' && Number.isFinite(n) && n >= 2000 && n <= 20_000 ? Math.round(n) : START_HOLD_CAP_MS;
}

/** The intro hold's cap: what is left of the whole start's cap, never under today's 1.8 s. */
export function introHoldCapMs(spentMs: number, capMs = START_HOLD_CAP_MS): number {
  return Math.max(START_HOLD_INTRO_MIN_MS, Math.round(capMs - Math.max(0, spentMs)));
}

/**
 * A sample that holds the loading screen: a stand-in inside the ring. `touch`: only far prisms hold. Measured on the
 * iPhone profile (#313, 2026-11-09): with the baked tier off the frame beyond the detail block is runtime shells
 * whatever the hold does, and waiting on the detail block's own coarse tiles added 3.5-5.3 s to the start with the
 * first frame's tiers unchanged.
 */
export function isStandIn(s: StartTierSample, ringM = START_HOLD_SHELL_RING_M, touch = false): boolean {
  if (!(s.distanceM <= ringM)) return false;
  return s.owner === 'farPending' || (!touch && s.owner === 'coarse' && s.wanted !== false);
}

export interface StartTierCensus {
  /** Samples per owner within 300 / 600 / 1000 / 1200 m (for the probes). */
  within: Record<300 | 600 | 1000 | 1200, Partial<Record<StartTierOwner, number>>>;
  /** Stand-in samples inside the hold ring: > 0 holds the loading screen. */
  standIns: number;
  /** Samples per owner in the 600-1,200 m band (what shows past the ring: coloured baked shells or grey prisms). */
  band600to1200: Partial<Record<StartTierOwner, number>>;
}

export function startTierCensus(samples: Iterable<StartTierSample>, ringM = START_HOLD_SHELL_RING_M, touch = false): StartTierCensus {
  const within: StartTierCensus['within'] = { 300: {}, 600: {}, 1000: {}, 1200: {} };
  let standIns = 0;
  const band600to1200: StartTierCensus['band600to1200'] = {};
  for (const s of samples) {
    if (s.distanceM > 600 && s.distanceM <= 1200) band600to1200[s.owner] = (band600to1200[s.owner] ?? 0) + 1;
    for (const r of [300, 600, 1000, 1200] as const) if (s.distanceM <= r) within[r][s.owner] = (within[r][s.owner] ?? 0) + 1;
    if (isStandIn(s, ringM, touch)) standIns++;
  }
  return { within, standIns, band600to1200 };
}

/** Screen points of the census grid, CSS px, cell centres. */
export function censusGrid(width: number, height: number, [cols, rows]: readonly [number, number] = START_HOLD_GRID): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (!(width > 0 && height > 0)) return out;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) out.push([(x + 0.5) / cols * width, (y + 0.5) / rows * height]);
  return out;
}

/**
 * The lines a long hold rotates through after "Building the city…" (user 2026-11-27: "we can do the simcity thing of
 * 'dredging canals…' 'aligning polders'…"), so a 10 s hold reads as work under way, not a stuck screen.
 */
export const START_HOLD_BUILDING_LINES = [
  'ride.load.buildingCity',
  'ride.load.line.dredging',
  'ride.load.line.polders',
  'ride.load.line.narrowing',
  'ride.load.line.piles',
  'ride.load.line.gables',
  'ride.load.line.hoists',
  'ride.load.line.pumping',
  'ride.load.line.bridges',
  'ride.load.line.bikes',
  'ride.load.line.fishing',
  'ride.load.line.houseboats',
  'ride.load.line.shutters',
  'ride.load.line.trams',
  'ride.load.line.windowBoxes',
] as const;
/** How long each rotating line stays up, ms. */
export const START_HOLD_LINE_MS = 1600;

/**
 * The loading line for a hold that has run this long (message keys in src/i18n/messages). Past
 * START_HOLD_MESSAGE_AFTER_MS it rotates through START_HOLD_BUILDING_LINES every START_HOLD_LINE_MS, starting at
 * `offset` (the first slot of a start is always "Building the city…"; the intro hold continues where the ride hold
 * stopped, so a line never repeats back to back).
 */
export function startHoldMessageKey(
  elapsedMs: number,
  base: 'ride.load.settling' | 'ride.load.findingWay' = 'ride.load.settling',
  offset = 0,
): string {
  if (!(elapsedMs >= START_HOLD_MESSAGE_AFTER_MS)) return base;
  const n = START_HOLD_BUILDING_LINES.length;
  const step = Math.floor((elapsedMs - START_HOLD_MESSAGE_AFTER_MS) / START_HOLD_LINE_MS);
  const i = (((Math.floor(offset) + step) % n) + n) % n;
  return START_HOLD_BUILDING_LINES[i];
}

/**
 * The loading screen's opacity over the ride, from the reveal: 1 → 0 over REVEAL_DISSOLVE_MS (ease-out) when the
 * hold ended on its cap, 0 at once when it ended settled (nothing left to hide; a settled start keeps today's cut).
 */
export function revealDissolveAlpha(sinceRevealMs: number, capped: boolean, durationMs = REVEAL_DISSOLVE_MS): number {
  if (!capped || !(durationMs > 0) || sinceRevealMs >= durationMs) return 0;
  const t = Math.max(0, sinceRevealMs) / durationMs;
  return (1 - t) * (1 - t);
}
