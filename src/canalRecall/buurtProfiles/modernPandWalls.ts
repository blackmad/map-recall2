/**
 * Per-pand modern walls (GitHub #117): the post-1945 fronts that scripts/buurt-profiles/sample-panos.ts --modern
 * measured on their own pand, calibrated by derive.ts and published as `modern-pand-walls.json`
 * ({ walls: { "<16-digit pand id>": "<b|p>rrggbb" } }, b brick, p paint or render). A measured building draws its
 * own wall and material; every other one draws from its buurt's modern mix. Bundled into the building layer and
 * its chunk worker; the `?modernFacades=0` A/B turns it off with the rest of the vocabulary.
 */
import SET from './modern-pand-walls.json';

export type ModernPandWallSet = { schemaVersion: 1; revision: string; licence?: string; walls: Record<string, string> };
export type OwnWall = { hex: string; painted: boolean };

const CODE = /^[bp][0-9a-f]{6}$/;
let walls: Record<string, string> = validate(SET as unknown as ModernPandWallSet).walls;

export function validate(set: ModernPandWallSet): ModernPandWallSet {
  if (set?.schemaVersion !== 1 || typeof set.walls !== 'object') throw new Error('modern-pand-walls: bad schema');
  for (const [id, code] of Object.entries(set.walls)) if (!/^\d{16}$/.test(id) || !CODE.test(code)) throw new Error(`modern-pand-walls: bad row ${id} ${code}`);
  return set;
}

/** The building's own measured wall, or null. Accepts a full `NL.IMBAG.Pand.` id or the 16-digit tail. */
export function modernPandWall(id: string): OwnWall | null {
  const code = walls[id.startsWith('NL.IMBAG.Pand.') ? id.slice(14) : id];
  return code ? { hex: `#${code.slice(1)}`, painted: code[0] === 'p' } : null;
}

/** Tests and tools: replace the set. */
export function setModernPandWalls(set: ModernPandWallSet): void { walls = validate(set).walls; }
