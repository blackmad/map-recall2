import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ahnHeights, appendSupplement, fillDecision, findBagGaps, forBuildingTiles, quantile, supplementFeature, type RegisterPand } from './bagGaps';
import type { Ring, TileBuilding } from './landmarks/osmUnderModels';

// ~20 m square at Prinsengracht 221-227 (the 2026-10-16 empty lot).
const sq = (x0: number, y0: number, d = 0.0003): Ring => [[x0, y0], [x0 + d, y0], [x0 + d, y0 + d * 0.6], [x0, y0 + d * 0.6], [x0, y0]];
const lot = sq(4.8853, 52.3765);
const pand = (id: string, rings: Ring[], status = 'Pand in gebruik'): RegisterPand => ({ id, status, year: 1939, rings });

test('a standing pand with no tile feature over it is a gap; one drawn by id or by area is not', () => {
  const tiles: TileBuilding[] = [
    { id: 'NL.IMBAG.Pand.0363100000000002', height: 10, rings: [sq(4.8860, 52.3765)] },
    { id: 'w1', height: 10, rings: [sq(4.8870, 52.3765)] },
  ];
  const pands = [
    pand('0363100012169308', [lot]),
    pand('0363100000000002', [sq(4.8860, 52.3765)]), // present by id
    pand('0363100000000003', [sq(4.8870, 52.3765)]), // drawn by an OSM twin of the same outline
    pand('0363100000000004', [sq(4.8880, 52.3765)], 'Bouwvergunning verleend'), // not built yet
  ];
  const gaps = findBagGaps(pands, new Set(tiles.map(t => t.id)), () => tiles);
  assert.deepEqual(gaps.map(g => g.id), ['NL.IMBAG.Pand.0363100012169308']);
  assert.ok(gaps[0].areaM2 > 300 && gaps[0].tileCover === 0);
});

test('AHN heights: p70 roof over the median ground; void or underground stays empty', () => {
  assert.equal(quantile([1, 2, 3, 4, 5], 0.5), 3);
  const h = ahnHeights(Array.from({ length: 100 }, (_, i) => 16 + (i % 10) / 10), [0.6, 0.65, 0.7, NaN]);
  assert.ok(h && Math.abs(h.height - 15.98) < 0.1, JSON.stringify(h));
  assert.equal(ahnHeights([NaN, NaN], [0.6, 0.6, 0.6]), null);
  const gap = { id: 'NL.IMBAG.Pand.1', status: 'Pand in gebruik', year: 1939, areaM2: 1800, tileCover: 0, centre: [4.9, 52.37] as const };
  assert.equal(supplementFeature(gap, [lot], ahnHeights(Array(50).fill(0.5), [2, 2, 2])), null, 'bike garage under the square');
  assert.equal(supplementFeature({ ...gap, areaM2: 4 }, [lot], h), null, 'sliver');
  assert.equal(supplementFeature({ ...gap, tileCover: 0.3 }, [lot], h), null, 'a third drawn already: would z-fight');
  assert.equal(fillDecision({ ...gap, year: 2024 }, h), 'newer-than-ahn');
  assert.equal(fillDecision({ ...gap, areaM2: 32000 }, h), 'too-large');
  assert.equal(fillDecision({ ...gap, modelCover: 0.3 }, h), 'under-model', 'Nieuwe Kerk notch annex');
  assert.equal(fillDecision(gap, h), 'fill');
  const f = supplementFeature(gap, [lot], h)!;
  assert.equal(f.properties.tier, 3);
  assert.equal(f.geometry.type, 'Polygon');
  assert.deepEqual(Object.keys(forBuildingTiles(f).properties).sort(), ['bagGap', 'height', 'heightSource', 'id', 'minHeight', 'tier']);
});

test('appendSupplement is idempotent and never doubles a drawn footprint', () => {
  const ringsOf = (g: unknown) => ((g as { coordinates: Ring[] }).coordinates).slice(0, 1);
  const h = ahnHeights(Array(50).fill(16), [0.6, 0.6, 0.6]);
  const base = { id: '', status: 'Pand in gebruik', year: 1939, areaM2: 400, tileCover: 0, centre: [0, 0] as const };
  const a = supplementFeature({ ...base, id: 'NL.IMBAG.Pand.A' }, [lot], h)!;
  const b = supplementFeature({ ...base, id: 'NL.IMBAG.Pand.B' }, [sq(4.8860, 52.3765)], h)!;
  const existing = [{ properties: { id: 'w9' }, geometry: { type: 'Polygon', coordinates: [sq(4.8860, 52.3765)] } }];
  const once = appendSupplement(existing, [a, b], ringsOf);
  assert.deepEqual(once.added, ['NL.IMBAG.Pand.A']);
  assert.deepEqual(once.skipped, ['NL.IMBAG.Pand.B']);
  const twice = appendSupplement(once.features, [a, b], ringsOf);
  assert.deepEqual(twice.added, []);
  assert.equal(twice.features.length, 2);
});
