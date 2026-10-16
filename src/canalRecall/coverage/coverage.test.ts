import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aggregate, bboxOf, buurtLocator, claim, clusterKey, dominantDecade, isMinor, rankForGenerators, rectSides, repetition, ringAreaM2, simplifyRing,
  type Buurt, type BuurtMeta, type PandRecord, type Ring, type TierId,
} from './coverage.js';

// Two side-by-side buurten, each about 700 m square, west and east of 4.87 E.
const square = (x0: number, y0: number, x1: number, y1: number): Ring => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const WEST: Buurt = { code: 'W01', name: 'Westbuurt', polygons: [[square(4.86, 52.36, 4.87, 52.367)]], bbox: [0, 0, 0, 0] };
const EAST: Buurt = { code: 'E01', name: 'Oostbuurt', polygons: [[square(4.87, 52.36, 4.88, 52.367)]], bbox: [0, 0, 0, 0] };
for (const b of [WEST, EAST]) b.bbox = bboxOf(b.polygons);
const META: BuurtMeta[] = [{ code: 'W01', name: 'Westbuurt', wijk: 'Test' }, { code: 'E01', name: 'Oostbuurt', wijk: 'Test' }];

// A footprint `w` metres wide (east–west) and `d` deep at (lng, lat).
const DEG_X = 1 / (111_320 * Math.cos(52.36 * Math.PI / 180)), DEG_Y = 1 / 111_320;
const house = (id: string, lng: number, lat: number, w: number, d: number, height: number, year: number): PandRecord => ({
  id, centroid: [lng + w * DEG_X / 2, lat + d * DEG_Y / 2], ring: square(lng, lat, lng + w * DEG_X, lat + d * DEG_Y), height, year,
});

// West: a row of 8 identical 1925 houses (6 m × 10 m, 13 m high), 2 sheds, 2 one-offs.
const west: PandRecord[] = [
  ...Array.from({ length: 8 }, (_, i) => house(`w${i}`, 4.861 + i * 0.0001, 52.361, 6.2, 10, 13, 1925)),
  house('shed1', 4.865, 52.362, 2, 2, 2.2, 1960), house('shed2', 4.8653, 52.362, 2, 2, 2.4, 1961),
  house('odd1', 4.866, 52.363, 14, 20, 25, 1972), house('odd2', 4.8665, 52.364, 9, 30, 7, 1890),
];
// East: all different, two of them drawn by models, one by a building type.
const east: PandRecord[] = [
  house('e1', 4.871, 52.361, 5.5, 10, 10, 1880), house('e2', 4.872, 52.361, 7.5, 12, 16, 1902),
  house('e3', 4.873, 52.362, 9.5, 14, 19, 1931), house('e4', 4.874, 52.363, 11.5, 9, 22, 1958),
];

test('rectSides measures the short and long side of a footprint in metres', () => {
  const [w, l] = rectSides(square(4.87, 52.36, 4.87 + 6 * DEG_X, 52.36 + 10 * DEG_Y));
  assert.ok(Math.abs(w - 6) < 0.05 && Math.abs(l - 10) < 0.05, `${w} × ${l}`);
  assert.ok(Math.abs(ringAreaM2(square(4.87, 52.36, 4.87 + 6 * DEG_X, 52.36 + 10 * DEG_Y)) - 60) < 0.5);
});

test('pands land in the buurt holding their centroid; outside points find none', () => {
  const locate = buurtLocator([WEST, EAST]);
  assert.equal(locate(west[0].centroid), 'W01');
  assert.equal(locate(east[0].centroid), 'E01');
  assert.equal(locate([4.9, 52.37]), null);
});

test('claim keeps the higher-precedence tier', () => {
  const map = new Map<string, TierId>();
  claim(map, 'p', 'landmarkKit');
  assert.equal(claim(map, 'p', 'chunk'), true);
  assert.equal(claim(map, 'p', 'buildingType'), false);
  assert.equal(map.get('p'), 'chunk');
});

test('repetition: the identical row dominates; sheds are left out; missing data lowers the score', () => {
  assert.equal(clusterKey(west[0]), '6m×12m×1925');
  assert.ok(isMinor(west[8]) && !isMinor(west[0]));
  const r = repetition(west);
  // 10 non-minor pands: 8 in the row cluster + 1 + 1 → top 3 hold all 10.
  assert.equal(r.clusters[0].n, 8);
  assert.equal(r.score, 1);
  assert.equal(repetition(west, 1).score, 0.8);
  const noYear = west.map((p, i) => (i < 4 ? { ...p, year: undefined } : p));
  assert.equal(repetition(noYear, 1).score, 0.4);
  assert.deepEqual(dominantDecade(west), { decade: 1920, share: 0.8 });
});

test('aggregate: per-tier counts, shares, survey/type flags and the generator ranking over two buurten', () => {
  const tierOf = new Map<string, TierId>([['e1', 'bespoke'], ['e2', 'largeRecipe'], ['e3', 'buildingType'], ['w7', 'chunk']]);
  const flags = { survey: new Map([['w0', ['Teststraat']], ['w1', ['Teststraat']]]), types: new Map([['w0', ['test-district']]]), faces: new Set(['w0']) };
  const rows = aggregate(META, new Map([['W01', west], ['E01', east]]), tierOf, flags);
  const [w, e] = rows;
  assert.equal(w.pands, 12);
  assert.equal(w.minor, 2);
  assert.equal(w.tiers.chunk, 1);
  assert.equal(w.tiers.generic, 11);
  assert.equal(w.modelled, 1);
  assert.equal(w.modelledDefault, 0, 'chunks are behind ?streetChunks=1');
  assert.equal(w.repetitiveGeneric, 9, 'row houses 0–6 + the two one-offs, not the chunk house');
  assert.deepEqual(w.survey, { pands: 2, streets: ['Teststraat'] });
  assert.deepEqual(w.types, { pands: 1, districts: ['test-district'] });
  assert.equal(w.faces, 1);
  assert.deepEqual({ ...e.tiers }, { bespoke: 1, chunk: 0, largeRecipe: 1, houseRecipe: 0, ordinaryGlb: 0, buildingType: 1, landmarkKit: 0, generic: 1 });
  assert.equal(e.share, 0.75);
  assert.equal(e.shareDefault, 0.5);
  assert.equal(e.repetition, 0.75, 'four singletons: the top 3 hold three of four');
  assert.equal(e.priority, 0.188);
  // Ranking: the repetitive, barely-modelled west first.
  assert.deepEqual(rankForGenerators(rows, 1).map(r => r.code), ['W01', 'E01']);
  assert.deepEqual(rankForGenerators(rows, 5).map(r => r.code), ['W01']);
});

test('simplifyRing keeps a closed ring closed and drops collinear points', () => {
  const ring: Ring = [[0, 0], [0.5, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
  const out = simplifyRing(ring, 0.01);
  assert.deepEqual(out[0], out[out.length - 1]);
  assert.ok(!out.some(p => p[0] === 0.5 && p[1] === 0));
  assert.equal(out.length, 5);
});
