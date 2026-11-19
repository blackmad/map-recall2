// The ground-floor extract and its flag (`?groundFloor=1`, env GROUND_FLOOR=1; default off until the blind test wins).
// The page installs `ground-floors.json` (the published merge, scripts/ground-floor/build.ts) only with the flag on, and
// shopfronts.ts decorateShopTemplate stamps `p.groundFloor` on a listed pand, so the mesh worker reads it from the
// feature's properties. Absent extract or flag off: nothing stamped, every front draws as before.
import { drawProblems, type GroundFloorDraw } from './types.js';

export type GroundFloorExtract = { version: 1; buildings: Record<string, GroundFloorDraw> };

export const GROUND_FLOOR_DEFAULT = false;
export function groundFloorEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]groundFloor=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? GROUND_FLOOR_DEFAULT : v === '1';
}
let cached: boolean | undefined;
/** The flag for this page, worker or process (a test may set `__canalRecallGroundFloor`). */
export function groundFloorOn(): boolean {
  const g = globalThis as { __canalRecallGroundFloor?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallGroundFloor === 'boolean') return g.__canalRecallGroundFloor;
  return (cached ??= groundFloorEnabled(g.location?.search ?? null, g.process?.env?.GROUND_FLOOR ?? null));
}

let installed: Map<string, GroundFloorDraw> | null = null;
/** Install the extract (only the flag's loader calls this); null removes it. Invalid records are dropped. */
export function setGroundFloors(data: GroundFloorExtract | null): void {
  installed = data && data.version === 1 && data.buildings ? new Map(Object.entries(data.buildings).filter(([, d]) => !drawProblems(d).length)) : null;
}
/** The record for a feature id (`NL.IMBAG.Pand.<16 digits>` or the bare id), when the extract lists it. */
export function groundFloorFor(id: string): GroundFloorDraw | undefined {
  if (!installed) return undefined;
  return installed.get(id) ?? installed.get(id.replace(/^NL\.IMBAG\.Pand\./, ''));
}
/** A stamped property as a record, or undefined (the worker re-validates what crossed the boundary). */
export function groundFloorOf(v: unknown): GroundFloorDraw | undefined {
  return v && typeof v === 'object' && !drawProblems(v).length ? v as GroundFloorDraw : undefined;
}
