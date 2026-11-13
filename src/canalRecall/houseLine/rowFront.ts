/**
 * Lane 1 (Haarlemmerdijk renderer, 2026-11-13): the ordinary generic house drawn from its front record, behind ONE flag
 * (`?rowFront=1`, ROW_FRONT=1 in Node), only for pands that carry a record (the block's list).
 *
 * Step a, front height: the street wall rises to the record's measured cornice top or gable foot, above or below 3DBAG
 *   (house-line.md "Not wired" item 1: Haarlemmerdijk 18 drew 7.94 m against an 11.0 m measured cornice).
 * Step b, roof from the front: a cornice front has a flat lid at its top (no roof face over the cornice, #87); a gabled
 *   front gets the planner's saddle with its eaves at the measured foot, the gable profile in front of it.
 *
 * The record type meets lane 2's front records (`src/canalRecall/houseLine/frontRecord.ts`, `data/front-records/`):
 * `rowFrontFromRecord` is the one adapter. Flag off, or no record: the same feature object back (byte-identical).
 */
import { GABLE_SHAPES, roofPlanForFeature, type GableShape } from '../roofMesh.js';

export type RowCrownFamily = 'cornice' | 'neck' | 'bell' | 'point' | 'step' | 'spout' | 'raised-cornice-dormer';
export interface RowFrontRecord {
  pandId: string;
  face?: string;
  /** The front's highest line above its ground (m): a cornice top, or a gable's apex. */
  topM: number | null;
  /** Where the crown starts (m): a cornice front's top (= topM), a gable's foot. */
  eavesM: number | null;
  crown: { family: RowCrownFamily; riseM?: number; widthM?: number };
  /** Storey lines above the ground (m), from measured window heights or stated storey heights. */
  rowLines?: number[];
  storeys?: number;
  confidence: number;
  /** Low confidence: the row line from measured neighbours and a plain cornice. */
  fallback?: 'row-line';
  skyline?: Record<string, number | null>;
  sources: Record<string, string>;
}

export const ROW_FRONT_DEFAULT = false;
export function rowFrontEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]rowFront=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? ROW_FRONT_DEFAULT : v === '1';
}
let flagNow: boolean | undefined;
export function rowFrontOn(): boolean {
  if (flagNow !== undefined) return flagNow;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (flagNow = rowFrontEnabled(g.location?.search ?? null, g.process?.env?.ROW_FRONT ?? null));
}
/** Tests and harnesses: forget the cached flag. */
export const resetRowFront = () => { flagNow = undefined; };

const records = new Map<string, RowFrontRecord>();
const key = (id: string) => String(id).replace(/^NL\.IMBAG\.Pand\./, '').slice(-16);
/** Install the block's records (Node: scripts/world/pipeline.ts from ROW_FRONT_RECORDS; tests directly). */
export function setRowFrontRecords(list: readonly RowFrontRecord[]): void { records.clear(); for (const r of list) records.set(key(r.pandId), r); }
export function rowFrontFor(id: unknown): RowFrontRecord | null { return typeof id === 'string' || typeof id === 'number' ? records.get(key(String(id))) ?? null : null; }

/** Crown family -> the roof planner's gable profile. */
export const FAMILY_GABLE: Readonly<Record<RowCrownFamily, GableShape | null>> = {
  cornice: null, 'raised-cornice-dormer': null, neck: 'neck', bell: 'bell', point: 'plain', step: 'step', spout: 'spout',
};
/** The lowest front the planner roofs (planBuildingRoof refuses under 6.5 m); a record below it keeps a flat lid. */
const MIN_PLANNED_M = 6.5;

type Feature = { type?: string; properties: Record<string, unknown>; geometry: unknown };

/**
 * Decorator step after withHouseSpecCrown, before decorateRoof (galleryPipeline.ts). Applies steps a and b to a pand
 * with a record when the flag is on; otherwise returns the same object.
 */
export function withRowFront<T extends Feature>(feature: T): T {
  if (!rowFrontOn()) return feature;
  const rec = rowFrontFor(feature.properties.id);
  if (!rec || rec.eavesM === null || !(rec.eavesM > 2)) return feature;
  const p = feature.properties;
  const family: RowCrownFamily = rec.fallback ? 'cornice' : rec.crown.family;
  const gable = FAMILY_GABLE[family];
  const { monumentGable, roofShapeTag: _tag, ...rest } = p;
  const held = typeof monumentGable === 'string' ? { historicGable: monumentGable } : {};
  const sr = p.specRecipe && typeof p.specRecipe === 'object' ? p.specRecipe as Record<string, unknown> : null;
  if (!gable || rec.eavesM < MIN_PLANNED_M) {
    // A cornice (or a fallback) front: the wall to the measured top, a flat lid there, nothing over it from the street.
    const top = rec.topM ?? rec.eavesM;
    return { ...feature, properties: { ...rest, ...held, height: top, roofEavesHeightM: top, roofPlanned: false, roofShape: 'flat', rowFront: family,
      ...(sr ? { specRecipe: { ...sr, eavesM: top, corniceCrown: true } } : {}) } };
  }
  // A gabled front: the planner's saddle behind the record's gable, its eaves on the measured foot.
  let height = rec.topM ?? rec.eavesM + 3;
  const trial = (h: number) => roofPlanForFeature({ ...feature, properties: { ...rest, height: h, monumentGable: gable, roofPlanned: true } } as never);
  let plan = trial(height);
  for (let i = 0; i < 3 && plan; i++) { const next = rec.eavesM + plan.riseM; if (Math.abs(next - height) < 0.01) break; height = next; plan = trial(height); }
  if (!plan || !(GABLE_SHAPES as readonly string[]).includes(gable)) return feature;
  return { ...feature, properties: { ...rest, ...held, height, monumentGable: gable, roofPlanned: true, roofShape: plan.kind, roofEavesHeightM: height - plan.riseM, rowFront: family,
    ...(sr ? { specRecipe: { ...sr, eavesM: rec.eavesM } } : {}) } };
}
