import type {BuildingTools} from './cultural-builders';
import {disc, poly, type Frame} from './nearbar-kit';
import {tympanumArch, type TympanumArch, type TympanumArchOptions} from '../../src/canalRecall/landmarks/tympanumArch';

export interface TympanumArchLook {
  /** Colour of the filled field. */
  field: string;
  /** Voussoir colours by course (0 = the keystone's course); one string for a plain ring. */
  voussoirColours: [string, string] | string;
  keyColour?: string;
  impostColour?: string;
  bossColour?: string;
  /** Offsets of the faces' backs from the wall and the solids' depths (m). */
  fieldOut?: number;
  fieldD?: number;
  ringOut?: number;
  ringD?: number;
  keyD?: number;
}

/**
 * Builder adapter for src/canalRecall/landmarks/tympanumArch.ts: a round or segmental arch with a filled tympanum over a
 * square-headed window at `t` on a wall frame (nearbar-kit Frame: x along the wall, y up, z out). The tympanum stands
 * `fieldOut` from the wall (keep it below the ring's face for a recessed field), the voussoirs `ringOut`, the keystone a
 * little prouder; courses 0 and 1 take the two voussoir colours. Returns the layout.
 */
export function tympanumArchAt(b: BuildingTools, f: Frame, t: number, o: TympanumArchOptions, look: TympanumArchLook): TympanumArch {
  const a = tympanumArch(o);
  const fieldOut = look.fieldOut ?? 0, fieldD = look.fieldD ?? 0.05, ringOut = look.ringOut ?? 0, ringD = look.ringD ?? 0.09, keyD = look.keyD ?? ringD + 0.05;
  const colours = typeof look.voussoirColours === 'string' ? [look.voussoirColours, look.voussoirColours] : look.voussoirColours;
  poly(b, f, t, 0, a.tympanum, fieldD, look.field, fieldOut);
  for (const v of a.voussoirs) poly(b, f, t, 0, v.outline, v.key ? keyD : ringD, v.key ? look.keyColour ?? colours[0] : colours[v.course], ringOut);
  for (const p of a.imposts) poly(b, f, t, 0, p, ringD + 0.03, look.impostColour ?? colours[0], ringOut);
  if (a.boss) disc(b, f, t + a.boss.centre[0], a.boss.centre[1], a.boss.radius, 0.06, look.bossColour ?? colours[0], fieldOut + fieldD);
  return a;
}
