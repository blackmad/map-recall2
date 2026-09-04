/**
 * Pin the generator's geometry.
 *
 * A generator is more dangerous than a detector, because its output always
 * looks reasonable. These checks are the ones that would catch it drifting into
 * producing something that *looks* like a canal house while contradicting the
 * measurements it was given.
 */
import { STOREY_HEIGHT_M } from '../src/canalRecall/facade/grammar.ts';
import { assumedGable, bayCentres, bayCount, gableProfile, generateFacade, storeyHeights } from '../src/canalRecall/facade/generate.ts';
import { GABLE_TYPES } from '../src/canalRecall/facade/houseRecord.ts';

const failures: string[] = [];
let checks = 0;
const check = (label: string, ok: boolean, detail: string) => {
  checks++;
  if (!ok) failures.push(`${label} — ${detail}`);
  if (!ok || process.env.VERBOSE) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label} — ${detail}`);
};

// The measured total must survive. Storey heights are generated; the eaves
// height they sum to is a measurement, and a rule about the parts must never
// move the whole.
for (const [eaves, storeys] of [[12.1, 4], [14.9, 5], [9.5, 3], [17.2, 6]] as const) {
  const heights = storeyHeights(eaves, storeys);
  const total = heights.reduce((s, h) => s + h, 0);
  check(`storey heights sum to the measured eaves (${eaves} m, ${storeys})`, Math.abs(total - eaves) < 0.05, `${total.toFixed(2)} m`);
  check(`storeys diminish upward (${eaves} m, ${storeys})`, heights.every((h, i) => i === 0 || h <= heights[i - 1] + 1e-9), heights.join(', '));
  check(`generated storeys stay in the measured range (${eaves} m, ${storeys})`,
    heights.every(h => h >= STOREY_HEIGHT_M.min - 0.35 && h <= STOREY_HEIGHT_M.max + 0.35), heights.join(', '));
}

// Bays against frontage, at the pilot's real widths.
for (const [width, expected] of [[4.6, 2], [5.7, 3], [7.9, 4], [11.3, 5], [3.6, 2]] as const) {
  const bays = bayCount(width);
  check(`a ${width} m front takes a plausible number of bays`, bays >= 1 && bays <= 5, `${bays} bays`);
  const centres = bayCentres(width, bays);
  check(`bay centres stay inside the ${width} m plot`, centres.every(c => c > 0.2 && c < width - 0.2), centres.join(', '));
  check(`bay centres are ordered and distinct on a ${width} m front`,
    centres.every((c, i) => i === 0 || c > centres[i - 1] + 0.4), centres.join(', '));
}

// Gable profiles must be closed, span the plot, and stay inside their rise.
for (const kind of GABLE_TYPES) {
  const profile = gableProfile(kind, 5.7, 3.2);
  check(`${kind} profile spans the plot`, Math.min(...profile.map(p => p[0])) <= 0.01 && Math.max(...profile.map(p => p[0])) >= 5.69, `${profile.length} points`);
  check(`${kind} profile stays within its rise`, profile.every(p => p[1] >= -0.01 && p[1] <= 3.21), `max ${Math.max(...profile.map(p => p[1])).toFixed(2)} m`);
  check(`${kind} profile starts and ends at the eaves`, profile[0][1] < 0.01 && profile[profile.length - 1][1] < 0.01, `${profile[0][1]}, ${profile[profile.length - 1][1]}`);
}
// The step gable must actually step, or it is a triangle wearing a name.
const steps = gableProfile('trap', 5.7, 3.2);
const levels = new Set(steps.map(p => p[1].toFixed(2)));
check('a trapgevel has distinct step levels', levels.size >= 4, `${levels.size} levels`);
// And a lijstgevel must not, or it is not a cornice.
const cornice = gableProfile('lijst', 5.7, 3.2);
check('a lijstgevel is flat-topped', new Set(cornice.map(p => p[1].toFixed(2))).size === 2, `${new Set(cornice.map(p => p[1].toFixed(2))).size} levels`);

// A generated façade must be internally consistent and marked as generated.
const house = generateFacade({ plotWidthM: 5.66, eavesHeightM: 14.2, ridgeHeightM: 17.4, storeys: 5, gable: null, constructionYear: 1720, roofForm: 'pitched' });
check('generated output is labelled generated', house.provenance === 'generated', house.provenance);
check('an unstated gable is flagged as assumed', house.gableIsAssumed, String(house.gableIsAssumed));
check('every opening sits inside the plot', house.openings.every(o => o.xM >= -0.01 && o.xM + o.widthM <= 5.67), `${house.openings.length} openings`);
check('every opening sits below the eaves', house.openings.every(o => o.yM + o.heightM <= 14.21), `${house.openings.length} openings`);
check('the ground floor has a door', house.openings.some(o => o.kind === 'door' && o.yM < 0.01), `${house.openings.filter(o => o.kind === 'door').length} doors`);
check('there is one opening per bay per storey', house.openings.length === house.bays * house.storeys, `${house.openings.length} for ${house.bays}×${house.storeys}`);

// A stated gable must be used, never overridden by the era guess.
const stated = generateFacade({ plotWidthM: 5.1, eavesHeightM: 12, ridgeHeightM: 15, storeys: 4, gable: 'trap', constructionYear: 1780, roofForm: 'pitched' });
check('a stated gable overrides the era guess', stated.gable === 'trap' && !stated.gableIsAssumed, `${stated.gable}, assumed=${stated.gableIsAssumed}`);
check('the era guess follows the documented chronology',
  assumedGable(1620) === 'trap' && assumedGable(1680) === 'hals' && assumedGable(1720) === 'klok' && assumedGable(1800) === 'lijst',
  [1620, 1680, 1720, 1800].map(y => `${y}:${assumedGable(y)}`).join(' '));
check('an unknown year does not guess an early gable', assumedGable(null) === 'lijst', assumedGable(null));

console.log(`Generator: ${GABLE_TYPES.length} gable profiles, ${house.openings.length} openings on a 5.66 m front.`);
if (failures.length) {
  console.error(`\n${failures.length} of ${checks} generator checks failed:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`All ${checks} generator checks passed.`);
