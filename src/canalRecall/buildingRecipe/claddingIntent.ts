/**
 * Validation of a large-tier wall group's `cladding` (geometry in blockBuilding/cladding.ts, GitHub #49). Kept out of
 * largeIntent.ts so that file does not grow. Fractions of the eaves for heights; `pitch` / `rowPitch` are the profile's
 * line spacing in metres (a material property like meshScreen.joint, not a coordinate).
 */
import {CLADDING, CLADDING_KINDS} from '../blockBuilding/cladding.ts';

const HEX = /^#[0-9a-f]{6}$/i;
const KEYS = ['kind', 'colour', 'lines', 'pitch', 'rowPitch', 'from', 'to', 'side'];

/** Problems with `walls[i].cladding`; `system` is the group's facade system. */
export function claddingProblems(input: unknown, at: string, system?: string, wallSplit?: unknown): string[] {
  if (input === undefined) return [];
  const p: string[] = [], c = input as Record<string, unknown>, where = `${at}.cladding`;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return [`${where}: an object {${KEYS.join(', ')}}`];
  for (const k of Object.keys(c)) if (!KEYS.includes(k)) p.push(`${where}.${k}: unknown field (${KEYS.join(', ')})`);
  const kind = c.kind as string;
  if (!(CLADDING_KINDS as readonly string[]).includes(kind)) p.push(`${where}.kind: one of ${CLADDING_KINDS.join(', ')}`);
  for (const k of ['colour', 'lines']) if (c[k] !== undefined && (typeof c[k] !== 'string' || !HEX.test(c[k] as string))) p.push(`${where}.${k}: a #rrggbb colour`);
  const D = kind in CLADDING ? CLADDING[kind as keyof typeof CLADDING] : null;
  if (c.pitch !== undefined) {
    if (!D) p.push(`${where}.pitch: ${kind} has no lines`);
    else if (!(typeof c.pitch === 'number' && c.pitch >= D.min && c.pitch <= D.max)) p.push(`${where}.pitch: metres ${D.min}..${D.max} for ${kind}`);
  }
  if (c.rowPitch !== undefined && (kind !== 'panels' || !(typeof c.rowPitch === 'number' && c.rowPitch >= 0.4 && c.rowPitch <= 20))) p.push(`${where}.rowPitch: panels only, metres 0.4..20`);
  if (c.lines !== undefined && kind === 'paint') p.push(`${where}.lines: paint has no lines`);
  const from = c.from ?? 0, to = c.to ?? 1;
  if (!(typeof from === 'number' && typeof to === 'number' && from >= 0 && to <= 1 && to - from >= 0.1)) p.push(`${where}: 0 <= from < to <= 1, at least 0.1 of the eaves`);
  if (c.side !== undefined && (!['left', 'right'].includes(c.side as string) || wallSplit === undefined)) p.push(`${where}.side: "left" or "right" of a wallSplit`);
  if (system === 'curtain-wall' || system === 'glazed-hall') p.push(`${where}: over a wall with a face (not a curtain wall or glazed hall: their wall is the glass skin)`);
  return p;
}
