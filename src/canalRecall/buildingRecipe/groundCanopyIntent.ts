/**
 * Validation of `groundCanopy` (slab canopies, "luifels", over the ground-storey door and windows of the Plan Zuid
 * portiek rows; geometry in groundCanopy.ts). Kept out of intent.ts so that file does not grow; type-only imports.
 */
import type {FrontIntent} from './intent.ts';

/** Validation ranges (metres; the intent names no `...M` keys). */
export const GROUND_CANOPY = {projection: [0.15, 1.2], thickness: [0.05, 0.3], overhang: [0, 0.4], gap: [0, 0.4], insetM: 0.005} as const;
export const GROUND_CANOPY_OVER = ['door', 'windows'] as const;

export interface GroundCanopyIntent {
  /** Which ground openings get a slab: the house door, the ground-storey windows (default both). */
  over?: (typeof GROUND_CANOPY_OVER[number])[];
  /** Metres from the wall plane to the slab's nose. */
  projection: number;
  /** Metres: the slab's thickness (its painted nose). */
  thickness: number;
  /** Metres the slab runs past each side of its opening (trim included), clamped to the front's ends. */
  overhang: number;
  /** Metres of wall between the opening's head and the slab's underside. */
  gap: number;
  /** Door slab overhang when it differs from the windows' (the portiek canopy is wider than its doorway). */
  doorOverhang?: number;
  /** Slab colour (measured tint, #rrggbb); default the front's trim. */
  colour?: string;
}

const HEX = /^#[0-9a-f]{6}$/i;
const KEYS = ['over', 'projection', 'thickness', 'overhang', 'gap', 'doorOverhang', 'colour'];

/** Problems with `groundCanopy`. */
export function groundCanopyProblems(f: FrontIntent, at: string): string[] {
  const o = f.groundCanopy as unknown as Record<string, unknown> | undefined, p: string[] = [];
  if (o === undefined) return p;
  if (!o || typeof o !== 'object' || Object.keys(o).some(k => !KEYS.includes(k))) return [`${at}.groundCanopy: {${KEYS.join(', ')}}`];
  const inRange = (v: unknown, [a, b]: readonly [number, number]) => typeof v === 'number' && v >= a && v <= b;
  for (const k of ['projection', 'thickness', 'overhang', 'gap'] as const) if (!inRange(o[k], GROUND_CANOPY[k])) p.push(`${at}.groundCanopy.${k}: ${GROUND_CANOPY[k].join('..')} m`);
  if (o.doorOverhang !== undefined && !inRange(o.doorOverhang, GROUND_CANOPY.overhang)) p.push(`${at}.groundCanopy.doorOverhang: ${GROUND_CANOPY.overhang.join('..')} m`);
  if (o.over !== undefined && (!Array.isArray(o.over) || !o.over.length || o.over.some(x => !(GROUND_CANOPY_OVER as readonly string[]).includes(x as string)))) p.push(`${at}.groundCanopy.over: some of ${GROUND_CANOPY_OVER.join(', ')}`);
  if (o.colour !== undefined && (typeof o.colour !== 'string' || !HEX.test(o.colour))) p.push(`${at}.groundCanopy.colour: a #rrggbb colour`);
  if (f.shopfront) p.push(`${at}.groundCanopy: not with a shopfront (its awning is the shop's canopy)`);
  if (f.repeat) p.push(`${at}.groundCanopy: not on a repeated front`);
  return p;
}
