/**
 * A declared opening-frame clearance must stop two close observed openings from
 * drawing overlapping frames, without changing any undeclared opening.
 *
 * The extraction can place genuine neighbours very close (case-05 Lauriergracht
 * 67/69 returns a 1.9 px glazing gap between a narrow window and the wide bay
 * beside it), and the default .14 frame border then protrudes across the
 * neighbour so the pair reads as one blob. `frameClearancePx` is an opt-in,
 * per-feature reviewed clearance; the compiler caps the frame to it (and never
 * past the nearest same-row opening). This test pins both the cap and the
 * opt-in boundary on the shared compiler.
 */
import assert from 'node:assert/strict';
import { compileFacadePatches, facadeWallFrame } from '../../src/canalRecall/cityAppearanceFacadeRecipes.ts';
import { owner, record, image } from '../city-appearance/fidelity/synthetic-fixture.ts';

const wall = owner.geometry.building.surfaces[0];
const frame = facadeWallFrame(wall, owner, [owner])!;
assert.ok(frame, 'synthetic wall frame');
const along = (x: number, z: number) => (x - frame.a[0]) * frame.u[0] + (z - frame.a[1]) * frame.u[1];

const window = (id: string, x0: number, x1: number, frameClearancePx?: number): any => ({
  id, kind: 'window', bounds: [x0, 120, x1, 300], head: 'rectangular', disposition: 'machine-observed-unreviewed', ...(frameClearancePx === undefined ? {} : { frameClearancePx }),
});

const render = (features: any[]) => {
  const value: any = structuredClone(record);
  const source: any = structuredClone(record.facadeDescription.sources.ground);
  source.features = features;
  value.facadeDescription.sources = { ground: source };
  value.images = { ground: { ...image, sha256: source.cropSha256 } };
  return compileFacadePatches(owner, wall, 0, [value], [owner], { observed: true, procedural: false, contextual: false });
};

const extent = (patches: any[], id: string) => {
  const points = patches.filter((patch) => patch.featureId.endsWith(id)).flatMap((patch) => {
    const values: number[] = [];
    for (let index = 0; index < patch.triangles.length; index += 3) values.push(along(patch.triangles[index], patch.triangles[index + 2]));
    return values;
  });
  assert.ok(points.length, `${id} emitted patches`);
  return [Math.min(...points), Math.max(...points)] as [number, number];
};

// A declared 2 px clearance on a 2 px (0.02 m) glazing gap makes the two frames
// meet instead of crossing.
const capped = render([window('tight-a', 80, 180, 2), window('tight-b', 182, 282, 2)]);
const a = extent(capped, 'tight-a'), b = extent(capped, 'tight-b');
assert.ok(a[1] <= b[0] + 1e-6, `declared frames must not overlap (a ends ${a[1]}, b starts ${b[0]})`);
assert.ok(Math.abs(b[0] - a[1]) < 1e-6, 'declared frames meet at the measured gap');

// The same pair with no declaration keeps the default .14 border and overlaps.
const plain = render([window('plain-a', 80, 180), window('plain-b', 182, 282)]);
const pa = extent(plain, 'plain-a'), pb = extent(plain, 'plain-b');
assert.ok(pa[1] > pb[0] + 1e-6, 'an undeclared pair must keep the overlapping default frame');

// A clearance is the measured same-row gap, not a frame width: a well-spaced
// opening declares its large gap and keeps the 1 m + .14 m default span.
const loose = render([window('loose-a', 80, 180, 200), window('loose-b', 380, 480, 200)]);
const la = extent(loose, 'loose-a');
assert.ok(Math.abs((la[1] - la[0]) - 1.14) < 1e-6, `a declared clearance must not shrink a well-spaced frame (span ${la[1] - la[0]})`);

// The cap can never exceed the nearest same-row gap: a declared 200 px clearance
// on adjacent windows still only meets the measured 2 px.
const overdeclared = render([window('od-a', 80, 180, 200), window('od-b', 182, 282, 200)]);
const oa = extent(overdeclared, 'od-a'), ob = extent(overdeclared, 'od-b');
assert.ok(oa[1] <= ob[0] + 1e-6, 'a clearance larger than the gap must still not cross the neighbour');

console.log('Opening frame clearance: a declared clearance caps the frame so close neighbours meet instead of overlapping; an undeclared opening keeps the default border and a well-spaced opening is unchanged.');
