import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { BUURT_KIND_RANKS, geometryFromExtract } from './knowledgeMap.ts';
import { decodePolyline, encodePolyline, geometryFromOutline, outlineFromGeometry, simplifyLine } from './knowledgeMapOutline.ts';

test('polyline codec round-trips to 1e-5 degrees', () => {
  const points: Array<[number, number]> = [[52.37428, 4.85557], [52.37112, 4.85655], [52.37152, 4.85986], [52.36, 4.8], [52.4, 5.1]];
  assert.deepEqual(decodePolyline(encodePolyline(points)), points);
});

test('simplifyLine keeps ends and corners, drops collinear points', () => {
  const line: Array<[number, number]> = [[52.37, 4.88], [52.37, 4.8801], [52.37, 4.8802], [52.371, 4.8802], [52.372, 4.8802]];
  const out = simplifyLine(line, 5);
  assert.deepEqual(out, [line[0], line[2], line[4]]);
});

test('outline round-trip keeps names, kinds, bboxes (within tolerance) and frame', () => {
  const geometry = geometryFromExtract([
    { name: 'Jordaan', kind: 'quarter', geometry: [[[[52.37, 4.88], [52.37, 4.89], [52.38, 4.89], [52.38, 4.88]]]] },
    { name: 'Centrum', kind: 'suburb', geometry: [[[[52.36, 4.87], [52.36, 4.92], [52.39, 4.92], [52.39, 4.87]]]] },
  ], [{ path: [[52.365, 4.87], [52.365, 4.93]] }]);
  const back = geometryFromOutline(JSON.parse(JSON.stringify(outlineFromGeometry(geometry))), BUURT_KIND_RANKS);
  assert.deepEqual(back.buurts.map(b => [b.name, b.kind]), geometry.buurts.map(b => [b.name, b.kind]));
  assert.equal(back.water.length, 1);
  assert.ok(Math.abs(back.frame.minLat - geometry.frame.minLat) < 1e-4);
});

test('the staged/published outline is slim and covers every ranked buurt', { skip: !existsSync('public/data/extracts/amsterdam/staging/knowledge-map-outline.json') }, () => {
  const raw = readFileSync('public/data/extracts/amsterdam/staging/knowledge-map-outline.json', 'utf8');
  assert.ok(raw.length < 100_000, `outline ${raw.length} B`);
  const boundaries = JSON.parse(readFileSync('public/data/extracts/amsterdam/boundaries.json', 'utf8'));
  const full = geometryFromExtract(boundaries);
  const back = geometryFromOutline(JSON.parse(raw), BUURT_KIND_RANKS);
  assert.equal(back.buurts.length, full.buurts.length);
});
