import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {validateIntent} from './intent.ts';
import {compileBuilding, resolveIntent} from './compile.ts';
import {frontFrame, localToFrameMatrix, matchDesign, mirrorIntent, placementFor, ringToFrame, frameFootprintIoU, bearingDegrees} from './instances.ts';
import {SharedAssetCache} from '../landmarks/sharedAssetCache.ts';
import {ordinarySpecFor, type Entry} from '../landmarks/ordinaryModels.ts';
import {placementFor as runtimePlacement} from '../landmarks/signaturePlacement.ts';
import type {BuildingFacts} from './facts.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const intent = (id: string) => resolveIntent(raw(id), raw);

test('street-house schema: balconies, bay windows and bands validate and reject impossible storeys', () => {
  const base = raw('bilder-081118');
  assert.equal(validateIntent(base).fronts[0].balconies?.storeys.length, 2);
  assert.throws(() => validateIntent({...base, fronts: [{...base.fronts[0], balconies: {storeys: [0], bays: [1]}}]}), /balconies/);
  assert.throws(() => validateIntent({...base, fronts: [{...base.fronts[0], bayWindows: {bay: 1, storeys: [9]}}]}), /bayWindows/);
  assert.throws(() => validateIntent({...base, fronts: [{...base.fronts[0], bands: 'frieze'}]}), /bands/);
});

test('Bilderdijkstraat 080336: bay windows compile into glazed bays on the three upper storeys', () => {
  const built = compileBuilding(intent('bilder-080336'), facts('bilder-080336'));
  let bays = 0;
  built.group.traverse(o => { if (o.userData.component === 'glazedBay' && o instanceof T.Mesh) bays++; });
  assert(bays > 0, 'glazed bay meshes present');
});

test('Bilderdijkstraat 081118: balcony guards stand in front of the French windows', () => {
  const built = compileBuilding(intent('bilder-081118'), facts('bilder-081118'));
  let rails = 0;
  built.group.traverse(o => { if (o.name.includes('balcony/')) rails++; });
  assert(rails > 0, 'balcony rail meshes present');
});

test('mirror: the right-bay twin of 080336 is its mirror image, a plain neighbour is not', () => {
  // The two houses now carry their own evidenced shops; compare the building body with the original plain shop door.
  const plain = (i: ReturnType<typeof intent>, doorBay: number) => ({...i, fronts: i.fronts.map(f => ({...f, doorBay, shopfront: {colour: 'dark-brown', fascia: false}}))});
  const left = plain(intent('bilder-080336'), 1), right = plain(intent('bilder-090492'), 0);
  assert.equal(matchDesign(left, right), 'mirror');
  assert.equal(matchDesign(intent('bilder-080336'), intent('bilder-090492')), null, 'different shops are not twins');
  assert.equal(matchDesign(left, left), 'same');
  assert.equal(matchDesign(left, plain(intent('bilder-092394'), 0)), null);
  const flipped = mirrorIntent(right)!;
  assert.equal(flipped.fronts[0].bayWindows?.bay, 0);
  assert.equal(flipped.fronts[0].doorBay, 1);
  assert.equal(matchDesign(intent('bilder-092394'), intent('bilder-092395')), null, '092395 carries its own BENU shop');
});

test('frontage frame: the matrix maps the survey frontage onto the X axis and the street side onto +Z', () => {
  const f = facts('bilder-080336'), frame = frontFrame(f.fronts[0] as any), anchor: [number, number] = [f.fronts[0].endpointsRD[0][0] - 3, f.fronts[0].endpointsRD[0][1] + 2];
  const m = localToFrameMatrix(frame, anchor), apply = (x: number, z: number) => [m[0] * x + m[2] * z + m[3], m[8] * x + m[10] * z + m[11]];
  // A point on the street side of the frontage midpoint, in recipe-local coordinates (x east, z south).
  const out = (d: number) => [frame.midRD[0] + frame.nRD[0] * d - anchor[0], anchor[1] - (frame.midRD[1] + frame.nRD[1] * d)];
  const [px, pz] = apply(...(out(4) as [number, number]));
  assert(Math.abs(px) < 1e-9 && Math.abs(pz - 4) < 1e-9, `street-side point lands on +Z (${px}, ${pz})`);
  const [lx] = apply(f.fronts[0].endpointsRD[0][0] - anchor[0], anchor[1] - f.fronts[0].endpointsRD[0][1]);
  assert(Math.abs(lx + f.fronts[0].widthM / 2) < 1e-6, 'left end of the frontage is at -width/2');
  // Rotation, not reflection: determinant of the 2x2 part is +1.
  assert(Math.abs(m[0] * m[10] - m[2] * m[8] - 1) < 1e-9);
  // BAG footprint of the house lies behind the front (z <= small) in the frame.
  const rings = f.bagFootprintRD.map(r => ringToFrame(r, frame));
  assert(Math.max(...rings.flat().map(p => p[1])) < 0.5);
  assert(frameFootprintIoU(rings, rings, false) > 0.999);
  const mirrored = frameFootprintIoU(rings, rings, true);
  assert(mirrored <= 1 && mirrored > 0.5);
});

test('placement: bearing of a due-east frontage direction is 90, offset 0', () => {
  assert.equal(Math.round(bearingDegrees([1, 0])), 90);
  const p = placementFor({midRD: [121000, 487000], uRD: [1, 0], nRD: [0, -1]}, true, ([x, y]) => [4.9 + (x - 121000) * 1e-5 / Math.cos(52.37 * Math.PI / 180) * 0.9, 52.37 + (y - 487000) * 1e-5 * 0.9]);
  assert(p.mirror && Math.abs(p.northOffsetDegrees) < 1, `offset ${p.northOffsetDegrees}`);
});

test('shared asset cache decodes a URL once and frees it with the last instance', async () => {
  const cache = new SharedAssetCache<{id: number}>();
  let loads = 0;
  const load = () => Promise.resolve({id: ++loads});
  const [a, b] = await Promise.all([cache.acquire('x.glb', load), cache.acquire('x.glb', load)]);
  assert.equal(a, b);
  assert.equal(loads, 1);
  assert.equal(cache.refs('x.glb'), 2);
  assert.equal(cache.release('x.glb'), undefined);
  assert.deepEqual(cache.release('x.glb'), {id: 1});
  assert.equal(cache.size, 0);
  // A failed load does not poison the URL.
  await assert.rejects(cache.acquire('bad.glb', () => Promise.reject(new Error('404'))));
  assert.equal(cache.size, 0);
  assert.deepEqual(await cache.acquire('bad.glb', () => Promise.resolve({id: 9})), {id: 9});
});

test('runtime spec: instance entries become shared, mirrored, rotated placements; legacy entries stay on their own origin', () => {
  const base = {id: 'ordinary-1', category: 'street-survey', buildingId: 'NL.IMBAG.Pand.1', name: 'x', anchor: [4.87, 52.36] as [number, number], footprint: {type: 'Polygon' as const, coordinates: []}, height: 16, modelUrl: './m.glb', hash: 'h', bounds: {min: [-3, 0, -1], max: [3, 17, 20]}};
  const legacy = ordinarySpecFor(base as Entry);
  assert.equal(legacy.sharedModel, undefined);
  assert.equal(runtimePlacement(legacy, {min: [0, 0, 0], max: [1, 1, 1]}).modelRotationDegrees, 90);
  const inst = ordinarySpecFor({...base, instance: {anchor: [4.8716, 52.3677], northOffsetDegrees: 247.13, mirror: true}} as Entry);
  assert.equal(inst.sharedModel, true);
  const placement = runtimePlacement(inst, {min: [0, 0, 0], max: [1, 1, 1]});
  assert.equal(placement.mirror, true);
  assert.deepEqual(placement.anchor, [4.8716, 52.3677]);
  assert(Math.abs(placement.modelRotationDegrees - (90 + 247.13) % 360) < 1e-9);
  assert.equal(inst.suppressOsmIds[0], 'NL.IMBAG.Pand.1', 'exact BAG-host suppression is unchanged');
});
