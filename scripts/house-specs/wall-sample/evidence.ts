// Lane d1-wall-colour round 2 (2026-11-14): the dark-finish evidence (src/canalRecall/houseSpec/darkFinish.ts) of one pand
// from its captures.ts row (exposure-corrected L per capture; the same-cut neighbours `nb`) and its D1 answer.
import { hexToOklab } from '../../../src/canalRecall/houseSpec/wallColour.ts';
import { WALL_SAMPLE, correctCapture, type WallSampleParams } from '../../../src/canalRecall/houseSpec/wallSample.ts';
import { DARK_FINISH, capturesDark, darkFinish, describerDarkPhrase, neighboursDark } from '../../../src/canalRecall/houseSpec/darkFinish.ts';

/** Dark-finish evidence of one pand from its captures.ts row and D1 answer (exposure-corrected L per capture; same-cut
 *  neighbours). */
export function darkEvidence(capRow: any, answer: any, P: WallSampleParams = WALL_SAMPLE, D = DARK_FINISH) {
  const caps = (capRow?.captures ?? []) as any[];
  const cor = caps.map(c => hexToOklab(correctCapture({ hex: c.w1.hex, refs: c.refs ?? null }, P).out)[0]);
  const nb = caps.filter(c => c.nb).map(c => ({ L: c.w1.L, left: c.nb.left, right: c.nb.right }));
  return darkFinish({ describer: describerDarkPhrase(answer), captures: capturesDark(cor, D), neighbours: neighboursDark(nb, D) }, D);
}
