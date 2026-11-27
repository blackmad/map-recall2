/**
 * Per-pand modern walls (GitHub #117): the post-1945 fronts that scripts/buurt-profiles/sample-panos.ts --modern
 * measured on their own pand, calibrated by derive.ts and published as `modern-pand-walls.json`
 * ({ walls: { "<16-digit pand id>": "<b|p>rrggbb" } }, b brick, p paint or render). A measured building draws its
 * own wall and material; every other one draws from its buurt's modern mix. Bundled into the building layer and
 * its chunk worker.
 */
import SET from './modern-pand-walls.json';
import CORRECTIONS from './modern-pand-wall-corrections.json';

export type ModernPandWallSet = { schemaVersion: 1; revision: string; licence?: string; walls: Record<string, string> };
export type OwnWall = { hex: string; painted: boolean };

const CODE = /^[bp][0-9a-f]{6}$/;
let walls: Record<string, string> = validate(SET as unknown as ModernPandWallSet).walls;
/**
 * Hand corrections (modern-pand-wall-corrections.json): a pand whose panorama sample read something other than its wall
 * (feedback 174f6f: Spaarndammerdijk 1-11's red-brown piers averaged with its dark loggias into near-black #2f201c).
 * Kept apart from the derive.ts output so a re-run keeps them; each row cites its photo.
 */
export type ModernPandWallCorrection = { wall: string; measured?: string; why: string; source: string };
const CORRECTED: Record<string, string> = correctionWalls((CORRECTIONS as unknown as { walls: Record<string, ModernPandWallCorrection> }).walls);
export function correctionWalls(rows: Record<string, ModernPandWallCorrection>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, r] of Object.entries(rows)) {
    if (!/^\d{16}$/.test(id) || !CODE.test(r.wall) || !r.why || !r.source) throw new Error(`modern-pand-wall-corrections: bad row ${id}`);
    out[id] = r.wall;
  }
  return out;
}

export function validate(set: ModernPandWallSet): ModernPandWallSet {
  if (set?.schemaVersion !== 1 || typeof set.walls !== 'object') throw new Error('modern-pand-walls: bad schema');
  for (const [id, code] of Object.entries(set.walls)) if (!/^\d{16}$/.test(id) || !CODE.test(code)) throw new Error(`modern-pand-walls: bad row ${id} ${code}`);
  return set;
}

/** The building's own measured wall, or null. Accepts a full `NL.IMBAG.Pand.` id or the 16-digit tail. */
export function modernPandWall(id: string): OwnWall | null {
  const key = id.startsWith('NL.IMBAG.Pand.') ? id.slice(14) : id, code = CORRECTED[key] ?? walls[key];
  return code ? { hex: `#${code.slice(1)}`, painted: code[0] === 'p' } : null;
}

/** Tests and tools: replace the set. */
export function setModernPandWalls(set: ModernPandWallSet): void { walls = validate(set).walls; }
