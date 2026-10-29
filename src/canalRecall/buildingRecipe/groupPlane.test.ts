/**
 * Group-plane crop pairing (GitHub #114, cropToPanel.ts header): a front that 3DBAG facets into several panels of one
 * wall group pairs the crop cut on its BAG edge through the group's merged plane, with the same 0.5 m / 5 degree / 60 %
 * thresholds; a house whose main panel pairs keeps its pieces.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {groupPlaneCoverage, matchCropToPanel, mergedPanelPlane, panelCoverageStraight, type CropWall, type GroupPanel, type Xy} from './cropToPanel.ts';

// local metres: x east, z south; a south front (outward +z, RD normal (0, -1)), the viewer's right is east
const facet = (x0: number, z0: number, x1: number, z1: number, index: number): GroupPanel => {
  const len = Math.hypot(x1 - x0, z1 - z0), r = [(x1 - x0) / len, 0, (z1 - z0) / len];
  return {index, o: [x0, 0, z0], r, n: [-r[2], 0, r[0]], uMin: 0, uMax: len};
};
// a zig-zag front: four 5 m facets 8 degrees off the BAG edge, alternately 0.35 m in front of it and behind
const zig = [0, 1, 2, 3].map(k => facet(5 * k, k % 2 ? -0.35 : 0.35, 5 * k + 5, k % 2 ? 0.35 : -0.35, k));
const crop = (a: Xy, b: Xy, tag = 'w01-180'): CropWall => ({tag, file: `${tag}.jpg`, a, b, normal: [0, -1], ppm: 50, widthPx: 1000, heightPx: 500, wallHeightM: 10, baseZ: 0, obliquityDeg: 3, foliage: 0, washedOut: 0});
const anchor: Xy = [0, 0];

test('a zig-zag front: no facet pairs the BAG-edge crop on its own, the group plane does', () => {
  const c = crop([0, 0], [20, 0]);
  assert.equal(matchCropToPanel(c, zig[0], anchor).relation, 'angle');
  assert.equal(panelCoverageStraight([c], zig[0], anchor).coverage, 0);
  const plane = mergedPanelPlane(zig, zig[0])!;
  assert.ok(Math.abs(plane.n[2] - 1) < 1e-9 && Math.abs(plane.o[2] - 0.07) < 1e-9, `plane ${JSON.stringify(plane)}`);
  const res = groupPlaneCoverage([c], zig[0], zig, anchor);
  assert.equal(res.via, 'group');
  assert.ok(res.coverage >= 0.99, `coverage ${res.coverage}`);
  assert.equal(res.pieces[0].match.relation, 'match');
  assert.ok(Math.abs(res.pieces[0].match.alongAtUMin) < 1e-6 && Math.abs(res.pieces[0].match.alongAtUMax - 5) < 1e-6, 'the main facet\'s ends on the crop');
});

test('the same thresholds: a crop 2 m in front of the group plane is not paired', () => {
  const res = groupPlaneCoverage([crop([0, -2], [20, -2])], zig[0], zig, anchor);
  assert.equal(res.via, 'panel'); assert.equal(res.coverage, 0);
});

test('a main panel that pairs on its own keeps its pieces', () => {
  const flat = [facet(0, 0, 20, 0, 0)], c = crop([0, 0.1], [20, 0.1]);
  const own = panelCoverageStraight([c], flat[0], anchor), res = groupPlaneCoverage([c], flat[0], [...flat, ...zig], anchor);
  assert.equal(res.via, 'panel');
  assert.deepEqual({pieces: res.pieces, coverage: res.coverage}, own);
});

test('Het Nieuwe Huis walls[3] (0363100012148010): its 3DBAG front stands 0.3-1.0 m behind the BAG edge, so even the merged plane misses w01-33', () => {
  const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/group-plane-het-nieuwe-huis-walls3.json', import.meta.url), 'utf8'));
  const main = fx.group.find((p: GroupPanel) => p.index === fx.main), c: CropWall = fx.crops[0];
  assert.equal(matchCropToPanel(c, main, fx.anchorRD).relation, 'offset');
  const plane = mergedPanelPlane(fx.group, main)!, m = matchCropToPanel(c, plane, fx.anchorRD);
  assert.ok(m.angleDeg <= 5 && m.offsetM > 0.5 && m.offsetM < 0.85, `merged plane: ${m.angleDeg} deg, ${m.offsetM} m`);
  // no pairing until a crop is cut on the 3DBAG plane (all-walls.ts --inset), the tolerance stays 0.5 m
  assert.equal(groupPlaneCoverage([c], main, fx.group, fx.anchorRD).via, 'panel');
});
