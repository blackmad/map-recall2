// Lane E7 (#220): the ride's first frames no longer build the clearance and label-occlusion grids inline.
import assert from 'node:assert/strict';
import test from 'node:test';
import { featureBox, firstVertex, hasResidentIndex, residentIndex, residentIndexInSlices, residentsNear, sightlineBlocker } from './cameraClearance';
import { LabelOcclusion } from './labelOcclusion';

const O = [4.8742, 52.3615] as const, mLng = 111320 * Math.cos(O[1] * Math.PI / 180), mLat = 111320;
const at = (e: number, n: number): [number, number] => [O[0] + e / mLng, O[1] + n / mLat];
const box = (id: string, e0: number, n0: number, e1: number, n1: number, height = 15) => ({
  type: 'Feature', properties: { id, height },
  geometry: { type: 'Polygon', coordinates: [[at(e0, n0), at(e1, n0), at(e1, n1), at(e0, n1), at(e0, n0)]] },
}) as any;
// A city of 3,600 blocks on a 60 m grid, 3.6 km across, centred on O.
const city = () => { const out: any[] = []; for (let i = -30; i < 30; i++) for (let j = -30; j < 30; j++) out.push(box(`b${i}:${j}`, i * 60, j * 60, i * 60 + 40, j * 60 + 40, 12 + ((i * 7 + j * 3) % 9))); return out; };

test('featureBox is shared by a raw feature and its styled copy (one geometry); firstVertex reads the ring start', () => {
  const raw = box('a', 0, 0, 10, 20), styled = { ...raw, properties: { ...raw.properties, sideColour: '#fff' } };
  assert.equal(featureBox(styled), featureBox(raw), 'the same cached box object');
  assert.deepEqual(firstVertex(raw), at(0, 0));
  assert.deepEqual(firstVertex({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [[[at(5, 5), at(6, 5), at(6, 6), at(5, 5)]]] } } as any), at(5, 5));
});

test('residentIndexInSlices builds the same grid as residentIndex, one slice per callback, and reports ready', () => {
  const list = city(), queue: Array<() => void> = [];
  let ready = 0;
  residentIndexInSlices(list, cb => queue.push(cb), 1000, () => ready++);
  assert.equal(hasResidentIndex(list), false);
  let slices = 0;
  while (queue.length) { queue.shift()!(); slices++; }
  assert.equal(slices, 4, '3,600 residents in slices of 1,000');
  assert.equal(ready, 1);
  assert.equal(hasResidentIndex(list), true);
  const copy = list.slice(), expected = residentIndex(copy);
  assert.deepEqual([...residentIndex(list)].sort((a, b) => a[0] - b[0]), [...expected].sort((a, b) => a[0] - b[0]));
});

test('residentsNear: the sightline blocker over the near list equals the one over the whole city, and builds no grid', () => {
  const list = city();
  let blocked = 0;
  // Chase cameras 60-150 m behind riders all over the centre, at 40 m.
  for (const [re, rn, ce, cn] of [[0, 0, -10, -120], [300, -200, 330, -320], [-500, 450, -560, 400], [25, 25, 25, -130]]) {
    const rider = at(re, rn), cam = at(ce, cn);
    const near = residentsNear(list, rider, 600);
    assert.ok(near.length < list.length / 2, `${near.length} of ${list.length}`);
    const a = sightlineBlocker(cam, rider, 40, near), b = sightlineBlocker(cam, rider, 40, list.slice(), Infinity);
    assert.equal(a?.properties.id ?? null, b?.properties.id ?? null);
    if (a) blocked++;
    assert.equal(hasResidentIndex(near), false, 'a few frames\' list is walked by box, not indexed');
  }
  assert.ok(blocked >= 2, `sightlines blocked: ${blocked}`);
});

test('label occlusion: the first-vertex prefilter indexes the same disc; a stale grid covers an eye within its reach', () => {
  const list = city(), centre = at(100, 100);
  const a = new LabelOcclusion(), b = new LabelOcclusion();
  b.nearPadM = 0;
  a.index(list, centre); b.index(list, centre);
  const eyeAt = { lng: at(100, -50)[0], lat: at(100, -50)[1], altitudeM: 60 };
  for (let e = -400; e <= 400; e += 37) for (let n = -400; n <= 400; n += 41) {
    const p = at(e, n);
    assert.equal((a.at(p) as any)?.properties?.id ?? null, (b.at(p) as any)?.properties?.id ?? null);
    assert.equal(a.occluded(`p${e}:${n}`, p, eyeAt), b.occluded(`p${e}:${n}`, p, eyeAt));
  }
  const next = list.slice(1);
  assert.equal(a.coversStale(next, at(150, 120)), true, 'a new list, eye ~55 m from the grid centre');
  assert.equal(a.coversStale(next, at(500, 100)), false, 'eye 400 m away');
  assert.equal(a.coversStale(list, centre), false, 'the same list needs nothing');
  assert.equal(new LabelOcclusion().coversStale(next, centre), false, 'no grid yet');
});
