import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOF_EDGE, copingHex, kitRoofEdge, lipMinAreaM2, lipRoomBonus, lipStyle, parapetCopingHex, roofEdgeOn } from './roofEdge.ts';
import { parapetLipTris } from './flatRoofSurface.ts';
import { buildFeatureChunk } from '../threeBuildingFeatures.ts';

const g = globalThis as { __canalRecallRoofEdge?: boolean };
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;
const block = (k: number, w: number, d: number) => {
  const lng = (m: number) => 4.8375 + m / KX, lat = (m: number) => 52.3585 + m / KY, x = k * 40;
  return { type: 'Feature' as const, properties: { id: `NL.IMBAG.Pand.${k}`, height: 12, minHeight: 0, constructionYear: 1965, facade: 'postwar-priorBrickRed', facadeStyle: 'postwar', sideColour: '#a85a44', appearanceStyleSource: 'citywide-identity-palette-v3-not-measured' },
    geometry: { type: 'Polygon', coordinates: [[[lng(x), lat(0)], [lng(x + w), lat(0)], [lng(x + w), lat(d)], [lng(x), lat(d)], [lng(x), lat(0)]]] } };
};
const chunk = () => {
  const c = buildFeatureChunk(Array.from({ length: 30 }, (_, k) => block(k, k % 2 ? 30 : 9, k % 2 ? 12 : 8)) as never, 'photo' as never, 'walls') as unknown as { positions: ArrayLike<number>; tints: ArrayLike<number>; kinds: Record<string, number> };
  let h = 0; for (let i = 0; i < c.positions.length; i++) h = (h * 31 + Math.round(c.positions[i] * 1000)) | 0;
  let t = 0; for (let i = 0; i < c.tints.length; i++) t = (t * 31 + c.tints[i]) | 0;
  return { n: c.positions.length, h, t, lips: c.kinds['flat-lip'] ?? 0 };
};

test('flag off: every hook returns the old value, and a chunk is byte-identical with the flag unset or false', () => {
  delete g.__canalRecallRoofEdge;
  assert.equal(roofEdgeOn(), false);
  assert.equal(lipMinAreaM2(100), 100);
  assert.deepEqual(lipStyle('#a85a44'), { hex: '#a85a44', opts: {} });
  assert.equal(lipRoomBonus(10_000, false), 0);
  assert.equal(parapetCopingHex('#f0eee8'), '#f0eee8');
  assert.equal(kitRoofEdge(true, 1500), null);
  const unset = chunk();
  g.__canalRecallRoofEdge = false;
  assert.deepEqual(chunk(), unset);
  delete g.__canalRecallRoofEdge;
});

test('flag on: a dark band on more flat roofs, from 60 m², and the kit school gets the band only', () => {
  g.__canalRecallRoofEdge = false;
  const off = chunk();
  g.__canalRecallRoofEdge = true;
  const on = chunk();
  assert.ok(on.lips > off.lips, `${on.lips} lips on, ${off.lips} off`);
  assert.equal(lipMinAreaM2(100), ROOF_EDGE.minAreaM2);
  assert.deepEqual(kitRoofEdge(true, 1561), { lip: true, box: false, areaM2: 1561 });
  assert.equal(kitRoofEdge(false, 1561), null, 'a pitched kit roof keeps none');
  assert.equal(kitRoofEdge(true, 40), null);
  delete g.__canalRecallRoofEdge;
});

test('the coping is darker than the wall and a pale trim, and the band is top only (2 triangles an edge)', () => {
  const lum = (hex: string) => { const v = parseInt(hex.slice(1), 16); return 0.2126 * (v >> 16) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255); };
  for (const wall of ['#a85a44', '#d8d2c4', '#f0eee8']) assert.ok(lum(copingHex(wall)) < lum(wall) * 0.8, wall);
  assert.equal(copingHex('nonsense'), ROOF_EDGE.copingGrey);
  const square: [number, number][] = [[0, 0], [20, 0], [20, 20], [0, 20]];
  assert.equal(parapetLipTris([square], 10, '#444444').length, 16, 'default lip: coping and inner face');
  assert.equal(parapetLipTris([square], 10, '#444444', { h: ROOF_EDGE.h, w: ROOF_EDGE.w, innerFace: false }).length, 8);
});
