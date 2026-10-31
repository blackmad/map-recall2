import assert from 'node:assert/strict';
import test from 'node:test';
import { LABEL_ALT_M, LabelOcclusion, OCCLUSION_MARGIN_M } from './labelOcclusion';

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
  const h = lineAt(60, LABEL_ALT_M, 120); // the ray from the label's anchor at 120 m north, crossing a wall at 60 m north
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

test('a pitched roof hides what is behind it above its eave line (between eaves and ridge, as the street-name test)', () => {
  // Eye 150 m south at 90 m; a place 120 m north with no host (3 m anchor). The line crosses 60 m north at
  // 1.5 + 88.5 × (60 / 270) ≈ 21.2 m. A gable with eaves 18 m and ridge 30 m (mid 24 m) stands above it; its eaves do not.
  const gable = (eaves: number, ridge: number) => ({ ...box('gable', -30, 58, 30, 62, ridge), properties: { id: 'gable', height: ridge, roofEavesHeightM: eaves, roofShape: 'gabled' } });
  const occ = new LabelOcclusion();
  occ.index([gable(18, 30)], eye_);
  assert.equal(occ.occluded('x', at(0, 120), eye), true, 'hidden by the roof above the eaves');
  const flat = new LabelOcclusion();
  flat.index([{ ...gable(18, 30), properties: { id: 'gable', height: 18, roofEavesHeightM: 18, roofShape: 'flat' } }], eye_);
  assert.equal(flat.occluded('x', at(0, 120), eye), false, 'an 18 m flat roof is below the line');
});

test('a party wall is no frontage: a place whose nearest edge is shared with the next house is seen through its street side', () => {
  // Two houses in a row, west one hosting the place 1 m from the party wall; the street frontage faces south (the eye).
  const west = box('west', -20, 40, 0, 52, 14), east = box('east', 0, 40, 20, 52, 14);
  const occ = new LabelOcclusion();
  occ.index([west, east], eye_);
  assert.equal(occ.occluded('p', at(-1, 46), eye), false, 'the south frontage faces the eye');
  const f = occ.front.get('p')!;
  const [fe, fn] = [(f[0] - O[0]) * mLng, (f[1] - O[1]) * mLat];
  assert.ok(fn < 40 && Math.abs(fe + 1) < 1, `drawn at the street frontage, not across the party wall (${fe.toFixed(1)}, ${fn.toFixed(1)})`);
});
