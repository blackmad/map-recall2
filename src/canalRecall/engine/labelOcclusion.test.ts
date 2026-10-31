import assert from 'node:assert/strict';
import test from 'node:test';
import { LabelOcclusion, OCCLUSION_MARGIN_M } from './labelOcclusion';

// Metres → lng/lat around the Overtoom crossing.
const O = [4.8742, 52.3615] as const, mLng = 111320 * Math.cos(O[1] * Math.PI / 180), mLat = 111320;
const at = (e: number, n: number): [number, number] => [O[0] + e / mLng, O[1] + n / mLat];
const box = (id: string, e0: number, n0: number, e1: number, n1: number, height: number) => ({
  type: 'Feature', properties: { id, height },
  geometry: { type: 'Polygon', coordinates: [[at(e0, n0), at(e1, n0), at(e1, n1), at(e0, n1), at(e0, n0)]] },
});

// The camera 150 m south of the crossing at 90 m (a chase view looking north up the street).
const eye = { lng: at(0, -150)[0], lat: at(0, -150)[1], altitudeM: 90 };
const eye_ = [eye.lng, eye.lat] as const;
// Street frontage on the east side (x 8..20) and a block of 20 m houses across the street's end, 60–80 m north.
const frontage = box('front', 8, 40, 20, 60, 15);
const across = box('across', -30, 60, 30, 80, 20);
const behind = box('behind', -10, 90, 10, 105, 15);

test('a place behind a nearer, taller block is hidden; one on the street frontage is drawn', () => {
  const occ = new LabelOcclusion();
  occ.index([frontage, across, behind], eye_);
  assert.equal(occ.occluded('frontage', at(9, 50), eye), false, 'shop in the frontage facing the camera');
  assert.equal(occ.occluded('behind', at(0, 97), eye), true, 'place in the block behind the one across the street end');
  assert.equal(occ.occluded('open', at(0, 30), eye), false, 'a statue in the street (no host, 3 m anchor)');
});

test('a shopfront facing away from the camera hides its label, the host never blocks its own frontage; hysteresis keeps an edge label from flickering', () => {
  const occ = new LabelOcclusion();
  occ.index([across], eye_);
  assert.equal(occ.occluded('own', at(0, 62), eye), false, 'inside its own block, frontage facing the camera');
  assert.equal(occ.occluded('far side', at(0, 78), eye), true, 'shopfront on the far side of its block (label over the roof)');
  assert.equal(occ.occluded('corner', at(-29, 62.5), eye), false, 'a corner shop: the nearest (west) frontage faces away, the south one 2.5 m off still faces the camera');
  // A wall exactly at the line height: within the margin it keeps whichever state it had.
  const lineAt = (n: number, anchorAlt: number, anchorN: number) => anchorAlt + (90 - anchorAlt) * ((anchorN - n) / (anchorN + 150));
  const h = lineAt(60, 3, 120); // the ray from a 3 m anchor at 120 m north, crossing a wall at 60 m north
  const wall = (dh: number) => box('wall', -30, 58, 30, 62, h + dh);
  const a = new LabelOcclusion(); a.index([wall(0.5)], eye_);
  assert.equal(a.occluded('x', at(0, 120), eye), false, 'shown: 0.5 m over the line is inside the margin');
  const b = new LabelOcclusion(); b.index([wall(OCCLUSION_MARGIN_M + 0.5)], eye_);
  assert.equal(b.occluded('x', at(0, 120), eye), true, 'hidden: clearly above the line');
  b.index([wall(0.5)], eye_);
  assert.equal(b.occluded('x', at(0, 120), eye), true, 'stays hidden while within the margin (no flicker)');
  b.index([wall(-OCCLUSION_MARGIN_M - 0.5)], eye_);
  assert.equal(b.occluded('x', at(0, 120), eye), false, 'shown again once clearly below');
});
