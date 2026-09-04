/**
 * Hold the Blender gable library against the profiles it is meant to build.
 *
 * `gableProfile()` in generate.ts is the source of truth for the seven outlines
 * and is pinned by its own 59 checks. This library is a second, independent
 * implementation in Python that also has to produce mouldings, thickness and
 * closed solids. The value of the check is that two implementations of one
 * shape agree — a silent divergence between them would put a step gable in the
 * extract and a bell gable in the mesh.
 */
import { execFileSync } from 'node:child_process';
import { gableProfile } from '../src/canalRecall/facade/generate.ts';
import { GABLE_TYPES, type GableType } from '../src/canalRecall/facade/houseRecord.ts';

const WIDTH = 5.66, RISE = 3.2;
const dump = JSON.parse(execFileSync('python3',
  ['scripts/blender/gable_library.py', String(WIDTH), String(RISE)], { encoding: 'utf8', maxBuffer: 32e6 })) as {
  gables: Array<{
    kind: string; profile: Array<[number, number]>;
    parts: Array<{ name: string; material: string; verts: number; faces: number; volume: number }>;
    totalVolume: number;
  }>;
};

const failures: string[] = [];
let checks = 0;
const check = (label: string, ok: boolean, detail: string) => {
  checks++;
  if (!ok) failures.push(`${label} — ${detail}`);
  if (!ok || process.env.VERBOSE) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label} — ${detail}`);
};

check('every gable type is built', dump.gables.length === GABLE_TYPES.length,
  `${dump.gables.length} of ${GABLE_TYPES.length}`);

/** Silhouette height at a given position along the plot, by scanning the outline. */
const heightAt = (profile: Array<[number, number]>, x: number): number => {
  let highest = 0;
  for (let i = 0; i < profile.length; i++) {
    const [x0, y0] = profile[i], [x1, y1] = profile[(i + 1) % profile.length];
    if (Math.min(x0, x1) - 1e-6 > x || Math.max(x0, x1) + 1e-6 < x) continue;
    const t = Math.abs(x1 - x0) < 1e-9 ? 0 : (x - x0) / (x1 - x0);
    highest = Math.max(highest, y0 + t * (y1 - y0));
  }
  return highest;
};

for (const built of dump.gables) {
  const kind = built.kind as GableType;
  const truth = gableProfile(kind, WIDTH, RISE);

  // Compare as silhouettes rather than vertex lists: the two implementations
  // are entitled to describe the same outline with different vertex counts, and
  // requiring identical points would pin an implementation detail.
  let worst = 0, worstAt = 0;
  for (let i = 0; i <= 60; i++) {
    const x = (WIDTH * i) / 60;
    const difference = Math.abs(heightAt(built.profile, x) - heightAt(truth, x));
    if (difference > worst) { worst = difference; worstAt = x; }
  }
  check(`${kind} silhouette matches generate.ts`, worst <= 0.12,
    `worst ${worst.toFixed(3)} m at ${worstAt.toFixed(2)} m across`);

  check(`${kind} spans the plot`,
    Math.min(...built.profile.map(p => p[0])) <= 0.02 && Math.max(...built.profile.map(p => p[0])) >= WIDTH - 0.02,
    `${Math.min(...built.profile.map(p => p[0]))}–${Math.max(...built.profile.map(p => p[0]))} m`);
  check(`${kind} stays within its rise`, built.profile.every(p => p[1] <= RISE + 0.01 && p[1] >= -0.01),
    `max ${Math.max(...built.profile.map(p => p[1])).toFixed(2)} m`);

  // Solids, not surfaces: a part with no volume is a triangulation that missed.
  check(`${kind} produces solids`, built.parts.length > 0 && built.parts.every(p => p.faces >= 4),
    `${built.parts.length} parts, ${built.parts.reduce((s, p) => s + p.faces, 0)} faces`);
  // A step coping is 0.44 x 0.09 x 0.11 m — 0.004 m³ — so the threshold has to
  // sit well below the smallest moulding the library legitimately makes.
  const hollow = built.parts.filter(p => Math.abs(p.volume) < 1e-5);
  check(`${kind} has no zero-volume part`, hollow.length === 0,
    hollow.length ? hollow.map(p => p.name).join(', ') : `${built.parts.length} parts all closed`);
  check(`${kind} volume is positive`, built.totalVolume > 0, `${built.totalVolume} m³`);
}

// The types that are meant to carry ornament must actually carry it, or the
// library has quietly degraded into seven extrusions of the same wall.
const named = (kind: string) => dump.gables.find(g => g.kind === kind)!.parts.map(p => p.name).join(' ');
check('a halsgevel has claw-pieces', /klauwstuk/.test(named('hals')), named('hals').slice(0, 80));
check('a trapgevel has step copings', /dekplaat/.test(named('trap')), named('trap').slice(0, 80));
check('a lijstgevel has a cornice', /kroonlijst|console/.test(named('lijst')), named('lijst').slice(0, 80));
check('a tuitgevel has a spout', /spout|tuit/.test(named('tuit')), named('tuit').slice(0, 80));

const totals = dump.gables.map(g => `${g.kind} ${g.parts.length}p/${g.totalVolume}m³`).join('  ');
console.log(`Gable library: ${totals}`);
if (failures.length) {
  console.error(`\n${failures.length} of ${checks} gable-library checks failed:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`All ${checks} gable-library checks passed.`);
