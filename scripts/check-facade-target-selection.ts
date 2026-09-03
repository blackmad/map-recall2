/**
 * Named regressions for façade target selection.
 *
 * Every fixture here is a real building from the first grammar pilot, whose crop
 * was classified by two vision models at 0.8–0.9 visibility confidence. Five of
 * the six could not have shown the target's façade at all.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_FACADE_TARGET_POLICY, footprintMetrics, judgeFacadeTarget, metresToNearestFootprintPoint, outerRing, planFacadeCrop } from '../src/canalRecall/building/facadeTarget.ts';

const extract = JSON.parse(await readFile('public/data/extracts/amsterdam/buildings-colored.geojson', 'utf8')) as {
  features: Array<{ geometry: { type: string; coordinates: unknown }; properties: { osmId?: string | number; height?: number } }>;
};
const byOsmId = new Map(extract.features.map(feature => [String(feature.properties.osmId), feature]));

/** osmId, why it is pinned, and whether a façade could be photographed. */
const fixtures: Array<[string, string, boolean, string | null]> = [
  ['w1475011497', 'a 1 m2 object the pilot classified as a building', false, 'footprint-too-small-for-a-facade'],
  ['w282294826', 'a 7 m2 / 2.5 m box that was the block demo anchor', false, 'footprint-too-small-for-a-facade'],
  ['w282294463', 'a 7 m2 / 3 m box', false, 'footprint-too-small-for-a-facade'],
  ['w1412702187', 'an 18 m2 / 3 m structure, near the extract median footprint', false, 'footprint-too-small-for-a-facade'],
  ['w1388560103', 'a 112 m2 footprint only 3.7 m tall: broad, but no facade to photograph', false, 'too-short-for-a-facade'],
  ['w274039950', 'the one pilot target that is genuinely a building: 134 m2, 17.7 m', true, null],
];

for (const [osmId, why, usable, reason] of fixtures) {
  const feature = byOsmId.get(osmId);
  assert.ok(feature, `${osmId} (${why}) is still present in the Amsterdam extract`);
  const ring = outerRing(feature.geometry);
  assert.ok(ring, `${osmId} has an outer ring`);
  const verdict = judgeFacadeTarget(footprintMetrics(ring), feature.properties.height);
  assert.equal(verdict.usable, usable, `${osmId} (${why}) usable=${usable}`);
  assert.equal(verdict.reason, reason, `${osmId} rejection reason`);
}

// The gate has to reject most of this appearance-filtered extract, or it is not a gate.
// It also has to keep a real pool, or the stratified sample it guards cannot be drawn.
const verdicts = extract.features.flatMap(feature => {
  const ring = outerRing(feature.geometry);
  return ring ? [judgeFacadeTarget(footprintMetrics(ring), feature.properties.height)] : [];
});
const usable = verdicts.filter(verdict => verdict.usable).length;
assert.ok(usable >= 2_000, `the gate keeps a usable pool, got ${usable}`);
assert.ok(usable / verdicts.length < 0.5, `the gate rejects the small-structure majority, kept ${(100 * usable / verdicts.length).toFixed(1)}%`);
assert.equal(judgeFacadeTarget({ areaSquareMetres: 200, longestEdgeMetres: 20, vertices: 4 }, null).reason, 'no-measured-height');
assert.equal(judgeFacadeTarget({ areaSquareMetres: 0, longestEdgeMetres: 0, vertices: 0 }, 12).reason, 'degenerate-footprint');

// Framing regressions, at real façade distances rather than centroid distances.
for (const [height, distance] of [[20.3, 15], [18, 12], [18, 22], [12.7, 20], [9, 8], [6, 10]] as const) {
  const framing = planFacadeCrop(height, distance);
  assert.ok(framing.fullFacadeVisible, `a ${height} m facade fits in frame from ${distance} m`);
  assert.ok(framing.visibleTopMetres >= height, `${height} m at ${distance} m sees the top`);
  // `horizon` is measured from the bottom of the frame, so aiming up means a SMALL value.
  // horizon=0 returns pure sky; the pilot's 0.34 pointed most of the frame at the road.
  assert.ok(framing.horizon < 0.5, `the crop aims above the horizon, not at the road (got ${framing.horizon})`);
  assert.ok(framing.fov >= 20 && framing.fov <= 100, `fov ${framing.fov} stays inside the lens range`);
}
// A short building should get a tighter crop, spending its pixels on the facade.
assert.ok(planFacadeCrop(6, 20).fov < planFacadeCrop(20, 20).fov, 'a small building is framed tighter than a tall one');
// Physically impossible framing must be reported, never silently truncated.
assert.equal(planFacadeCrop(18, 6).fullFacadeVisible, false, 'an 18 m facade cannot fit from 6 m away');
// Framing follows the wall: a deep block's centroid is far behind the façade it is aimed at.
assert.ok(metresToNearestFootprintPoint([4.9, 52.37], [[4.9005, 52.37], [4.902, 52.371]]) < 40, 'nearest wall point, not centroid');

process.stdout.write(`Façade target selection checks passed: ${usable}/${verdicts.length} (${(100 * usable / verdicts.length).toFixed(1)}%) of the appearance extract can show a façade, policy ${JSON.stringify(DEFAULT_FACADE_TARGET_POLICY)}.\n`);
