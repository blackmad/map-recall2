/**
 * Route A spec fields (lane WG step 2, 2026-11-13; docs/house-line.md "Spec fields on route A"): the dressing and crown
 * classes that passed D1's precision bar, drawn on the generic near tier with presets and existing quads only.
 *
 * Fill ladder (the reviewer's ruling): describer reading (passing classes) -> STREET TEMPLATE (streetTemplate.ts, dressings
 * only, filled at house:specs build time so the 414 kB table never ships) -> PR1 prior -> family default (both: today's
 * hash and buurt pick, untouched here).
 *
 * Classes and the bar (D1 v4.2, artifacts/describer-d1/versions-v4-v42.md; D1 writes confidence >= 0.5 only for a class
 * over its bar):
 *   bands   storey | lintel | both | speklagen (bands 0.93, kind 0.88). Drawn with the existing band-line components:
 *           `floor-cornices` (a band at every floor line) for storey, both and speklagen, `string-courses` (the sill
 *           ledge) for lintel and both, at the stated storeys' count. Stone bands are drawn wider than speklagen
 *           (BAND_M). `courses` (brick courses) and `painted` (stucco bands) have no generic quad: kit gap.
 *   head    flat | segmental, whole front only (per-row heads are HELD): a window-preset pick (bayLook `arch`).
 *   crown   cornice (0.98) | step (1.0, n 4) | curved (neck or bell, 0.89): the roof planner's own forms (GABLE_TO_ROOF).
 *           A curved reading takes the register's curved kind where the register names one, else `neck`.
 *   pale    from the street template only (the reader's surrounds miss the bar at 0.59; the street agrees on 84 %): an
 *           eared or stone surround on the template picks the pale-accent preset.
 * Structure (rows, bays, souterrain, roof storey) never comes from here: storeyPlan.ts owns it.
 *
 * `?specFields=0` (SPEC_FIELDS=0 in Node) draws none of it, byte-identical to the fit without fields.
 */
import type { HouseSpec } from './spec.ts';
import { provenanceOf } from './spec.ts';
import type { TemplatePick } from './streetTemplate.ts';

/** Photo sources only: the precision bar is D1's (the register's words are not a reading of today's front). */
export const FIELD_SOURCES: ReadonlySet<string> = new Set(['vision-judge', 'streetlevel-measured', 'reviewed', 'author']);
export const FIELD_MIN_CONFIDENCE = 0.5;

export const DRAWN_BANDS = ['storey', 'lintel', 'both', 'speklagen'] as const;
export type DrawnBand = typeof DRAWN_BANDS[number];
export const CURVED_CROWNS: ReadonlySet<string> = new Set(['neck', 'raised-neck', 'bell']);
/** Window surrounds whose white reads as the pale-accent preset (view.ts PALE_SURROUNDS plus the eared surround). */
export const PALE_TEMPLATE_SURROUNDS: ReadonlySet<string> = new Set(['stone-lintel', 'full-frame', 'keystone', 'eared-keystone', 'eared']);

/** The route-A fields a front carries in the spec view (`v.fields`). Absent keys keep today's pick. */
export interface RouteAFields {
  bands?: DrawnBand;
  head?: 'flat' | 'segmental';
  crown?: 'cornice' | 'step' | 'neck' | 'raised-neck' | 'bell';
  pale?: boolean;
  /** Where each came from: a reading's source, or `template:<pandId>`. */
  src: Partial<Record<'bands' | 'head' | 'crown' | 'pale', string>>;
}

const passing = (spec: HouseSpec, path: string): string | null => {
  const prov = provenanceOf(spec, path);
  return prov && FIELD_SOURCES.has(prov.source) && prov.confidence >= FIELD_MIN_CONFIDENCE ? prov.source : null;
};

/** The passing classes a front states, or null. `historicGable` is the register's gable (spec facts). */
export function readFields(spec: HouseSpec): RouteAFields | null {
  const f = spec.design.fronts?.[0] as Record<string, unknown> | undefined;
  if (!f) return null;
  const out: RouteAFields = { src: {} };
  const bands = f.bands as string | undefined, bandsSrc = bands ? passing(spec, 'fronts/0/bands') : null;
  if (bandsSrc && (DRAWN_BANDS as readonly string[]).includes(bands!)) { out.bands = bands as DrawnBand; out.src.bands = bandsSrc; }
  const head = f.windowHead as { kind?: string; storeys?: number[] } | undefined, headSrc = head?.kind ? passing(spec, 'fronts/0/windowHead') : null;
  // whole front only: a head stated for some storeys is a per-row head (held)
  if (headSrc && !head!.storeys && (head!.kind === 'flat' || head!.kind === 'segmental')) { out.head = head!.kind; out.src.head = headSrc; }
  const gable = f.gable as string | undefined, gableSrc = gable ? passing(spec, 'fronts/0/gable') : null;
  if (gableSrc && (gable === 'cornice' || gable === 'step')) { out.crown = gable; out.src.crown = gableSrc; }
  else if (gableSrc && CURVED_CROWNS.has(gable!)) {
    const register = (spec.facts as Record<string, unknown> | undefined)?.historicGable as string | undefined;
    out.crown = register && CURVED_CROWNS.has(register) ? register as RouteAFields['crown'] : 'neck';
    out.src.crown = register && CURVED_CROWNS.has(register) ? `${gableSrc}+monument-text` : gableSrc;
  }
  return out.bands || out.head || out.crown ? out : null;
}

/** The street template's rung: dressings the reading left open (bands, the pale surround); never structure. */
export function withTemplate(fields: RouteAFields | null, pick: TemplatePick | null): RouteAFields | null {
  if (!pick) return fields;
  const out: RouteAFields = fields ? { ...fields, src: { ...fields.src } } : { src: {} };
  const tag = `template:${pick.pandId}`;
  const bands = pick.fields['fronts/0/bands'] as string | undefined;
  if (out.bands === undefined && bands && (DRAWN_BANDS as readonly string[]).includes(bands)) { out.bands = bands as DrawnBand; out.src.bands = tag; }
  const surround = pick.fields['fronts/0/windowSurround'] as string | undefined;
  if (out.pale === undefined && surround) { out.pale = PALE_TEMPLATE_SURROUNDS.has(surround); out.src.pale = tag; }
  return out.bands || out.head || out.crown || out.pale !== undefined ? out : null;
}

/** Band heights (m): a stone band course is wider than a speklaag (two brick courses of stone). */
export const BAND_M = { stone: 0.16, speklagen: 0.1 } as const;

/** What the mesher draws for the fields: forced wall components (facadeExtras registerForce ids), the band height, the
 *  window-preset traits. */
export function fieldsDraw(fields: RouteAFields | undefined | null): { force: string[]; bandM?: number; arch?: boolean; pale?: boolean } {
  if (!fields) return { force: [] };
  const force: string[] = [];
  let bandM: number | undefined;
  if (fields.bands === 'storey' || fields.bands === 'both' || fields.bands === 'speklagen') force.push('floor-cornices');
  if (fields.bands === 'lintel' || fields.bands === 'both') force.push('string-courses');
  if (fields.bands) bandM = fields.bands === 'speklagen' ? BAND_M.speklagen : BAND_M.stone;
  return { force, ...(bandM ? { bandM } : {}), ...(fields.head ? { arch: fields.head === 'segmental' } : {}), ...(fields.pale !== undefined ? { pale: fields.pale } : {}) };
}

/** Default on; `?specFields=0` in the page or SPEC_FIELDS=0 in Node draws none of the fields (byte-identical). */
export function specFieldsEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]specFields=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? true : v === '1';
}
let fieldsNow: boolean | undefined;
export function specFieldsOn(): boolean {
  if (fieldsNow !== undefined) return fieldsNow;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (fieldsNow = specFieldsEnabled(g.location?.search ?? null, g.process?.env?.SPEC_FIELDS ?? null));
}
export const resetSpecFields = () => { fieldsNow = undefined; };
