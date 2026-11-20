import type {BuildingTools} from './cultural-builders';
import {poly, segBand, type Frame} from './nearbar-kit';
import {relievingArches, type RelievingArchOptions} from '../../src/canalRecall/landmarks/relievingArches';

/**
 * Builder adapter for src/canalRecall/landmarks/relievingArches.ts: a row of segmental rowlock arches over windows on a
 * wall frame (nearbar-kit Frame: x along the wall, y up, z out), springing from stone springer blocks that stand a little
 * prouder than the brick. `archOut`/`springerOut` are the faces' offsets from the wall; `d` the solids' depth.
 */
export function relievingArchRow(b: BuildingTools, f: Frame, o: RelievingArchOptions & {arch: string; stone: string; d?: number; springerD?: number; out?: number}) {
  const {arches, springers} = relievingArches(o);
  const d = o.d ?? 0.06, sd = o.springerD ?? d + 0.03, out = o.out ?? 0;
  // segBand(y) is the extrados at the springing; the intrados springs th lower, at the window head
  for (const a of arches) segBand(b, f, a.centre, a.springY + a.thickness, a.chord, a.rise, a.thickness, d, o.arch, out);
  for (const s of springers) poly(b, f, s.centre, s.y, s.outline, sd, o.stone, out);
  return {arches, springers};
}
