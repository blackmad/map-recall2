/**
 * Validation of `eavesOverhang` (the flat roof's deep eaves overhang of the Plan Zuid rows; geometry in
 * eavesOverhang.ts). Kept out of intent.ts so that file does not grow; type-only imports, so there is no runtime cycle.
 */
import type {FrontIntent} from './intent.ts';

/** Validation ranges (metres; the intent names no `...M` keys). */
export const EAVES_OVERHANG = {projection: [0.2, 1.5], fascia: [0.08, 0.8], insetM: 0.005} as const;

export interface EavesOverhangIntent {
  /** Metres from the wall plane to the fascia's face. */
  projection: number;
  /** Metres: the fascia board's height (the slab's thickness), hanging from the eaves line. */
  fascia: number;
  /** Fascia and top colour (measured tint, #rrggbb); default the front's trim. */
  colour?: string;
  /** Soffit colour (measured tint, #rrggbb); default the fascia colour. */
  soffit?: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Problems with `eavesOverhang`. */
export function eavesOverhangProblems(f: FrontIntent, at: string): string[] {
  const o = f.eavesOverhang as unknown as Record<string, unknown> | undefined, p: string[] = [];
  if (o === undefined) return p;
  if (!o || typeof o !== 'object' || Object.keys(o).some(k => !['projection', 'fascia', 'colour', 'soffit'].includes(k))) return [`${at}.eavesOverhang: {projection, fascia, colour?, soffit?}`];
  const inRange = (v: unknown, [a, b]: readonly [number, number]) => typeof v === 'number' && v >= a && v <= b;
  if (!inRange(o.projection, EAVES_OVERHANG.projection)) p.push(`${at}.eavesOverhang.projection: ${EAVES_OVERHANG.projection.join('..')} m from the wall`);
  if (!inRange(o.fascia, EAVES_OVERHANG.fascia)) p.push(`${at}.eavesOverhang.fascia: ${EAVES_OVERHANG.fascia.join('..')} m fascia height`);
  for (const k of ['colour', 'soffit'] as const) if (o[k] !== undefined && (typeof o[k] !== 'string' || !HEX.test(o[k] as string))) p.push(`${at}.eavesOverhang.${k}: a #rrggbb colour`);
  if (f.gable !== 'flat' && f.gable !== 'cornice') p.push(`${at}.eavesOverhang: only on a flat or cornice front (gable ${f.gable})`);
  if (f.cornice !== 'none') p.push(`${at}.eavesOverhang: the overhang is the front's eaves; cornice must be "none"`);
  if (f.parapet !== undefined) p.push(`${at}.eavesOverhang: not together with a parapet`);
  if (f.repeat) p.push(`${at}.eavesOverhang: not on a repeated front`);
  return p;
}
