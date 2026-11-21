/**
 * Residential ground storey for the large kit (`ground: "residential"`, lane large-kit-gaps-20261121). The kit-vs-hand
 * test (Valkenburgerstraat 69-165, 2026-11-20) found the kit's only ground choices for a housing block were the upper
 * windows (`system`) or a shop row with a fascia (`plinth-shopfronts`); the photos of 1985+ housing blocks show
 * stair-hall entrance doors, storage doors (bergingen) and the ground-floor flats' windows, and no fascia.
 *
 * The ground row is a cycle across the bays from the viewer's left, one entry per bay:
 * - `window`: the upper storeys' window (a ground-floor flat);
 * - `door`: a stair-hall entrance, a glazed door with a side light under a transom light, in dark frames;
 * - `storage`: a closed storage or service door leaf;
 * - `wall`: plain wall.
 * `doors`: both door kinds' leaves in that painted colour instead of glass and the dark door slot.
 * Default `RESIDENTIAL_GROUND.pattern`: an entrance every fourth bay with a storage door between the flats' windows.
 * Pure: compose rows only.
 */
import type { Row, WinParams } from './spec.ts';

export const RESIDENTIAL_BAYS = ['window', 'door', 'storage', 'wall'] as const;
export type ResidentialBay = typeof RESIDENTIAL_BAYS[number];

/**
 * Proportions (w of the bay pitch, h of the ground storey, sill in m): a 1.3 m entrance on a 3.2 m bay, 2.4 m tall
 * under a transom light at 0.78 with its side light right of 0.62; a 0.95 m storage door 2.2 m tall.
 */
export const RESIDENTIAL_GROUND = {
  pattern: ['window', 'door', 'window', 'storage'] as ResidentialBay[],
  door: { w: 0.42, h: 0.8, sill: 0.02, sideLight: 0.62, transom: 0.78 },
  storage: { w: 0.3, h: 0.73, sill: 0.02 },
};

/** `doorSlot`: the door leaves' own painted colour (the red and blue doors of a 1990s block), else glass / the door slot */
export interface ResidentialGroundFit { pattern: ResidentialBay[]; doorSlot?: string }

/** Problems with an intent's `residential` entry at `at` (its `pattern`, 1..12 bays). */
export function residentialGroundProblems(v: unknown, at: string): string[] {
  if (v === undefined) return [];
  const r = v as { pattern?: unknown };
  if (!r || typeof r !== 'object' || Array.isArray(r)) return [`${at}: object {pattern}`];
  const p: string[] = [];
  for (const k of Object.keys(r)) if (k !== 'pattern' && k !== 'doors') p.push(`${at}.${k}: unknown field (pattern, doors)`);
  const doors = (r as { doors?: unknown }).doors;
  if (doors !== undefined && !(typeof doors === 'string' && /^#[0-9a-f]{6}$/i.test(doors))) p.push(`${at}.doors: #rrggbb`);
  if (!Array.isArray(r.pattern) || !r.pattern.length || r.pattern.length > 12) p.push(`${at}.pattern: 1..12 of ${RESIDENTIAL_BAYS.join('|')}`);
  else r.pattern.forEach((b, k) => { if (!(RESIDENTIAL_BAYS as readonly unknown[]).includes(b)) p.push(`${at}.pattern[${k}]: one of ${RESIDENTIAL_BAYS.join('|')}`); });
  return p;
}

/**
 * The ground row: a per-bay cycle of `pattern` (default `RESIDENTIAL_GROUND.pattern`). `upper` is the storeys' typical
 * row (a per-bay cycle is indexed by bay, since compose resolves one cycle level).
 */
export function residentialGroundRow(upper: Row, slots: { frame: string; glass: string; door: string }, o: { pattern?: ResidentialBay[]; doorSlot?: string; frames?: boolean; deepBars?: boolean } = {}): Row {
  const D = RESIDENTIAL_GROUND.door, S = RESIDENTIAL_GROUND.storage, bars = o.deepBars ? { barD: 0.035 } : {};
  const door: WinParams = { w: D.w, h: D.h, sill: D.sill, mullAt: [D.sideLight], rowsAt: [D.transom], frame: slots.door, glass: o.doorSlot ?? slots.glass, sillSlot: null, frameW: o.frames === false ? 0 : 0.07, ...bars };
  const storage: WinParams = { w: S.w, h: S.h, sill: S.sill, frame: slots.frame, glass: o.doorSlot ?? slots.door, sillSlot: null, frameW: o.frames === false ? 0 : 0.05 };
  const pattern = o.pattern?.length ? o.pattern : RESIDENTIAL_GROUND.pattern;
  const win = (k: number): Row => (upper.cycle ? upper.cycle[k % upper.cycle.length] : upper);
  return { kind: 'wall', cycle: pattern.map((b, k): Row => (b === 'door' ? { kind: 'punched', win: door } : b === 'storage' ? { kind: 'punched', win: storage } : b === 'wall' ? { kind: 'wall' } : win(k))) };
}
