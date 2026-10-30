import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ahnHeights, appendSupplement, DECK_CLEARANCE_M, fillDecision, findBagGaps, forBuildingTiles, osmHeightGuessed, overRoadPartFeatures, quantile, supplementFeature, type RegisterPand } from './bagGaps';
import { isPandId } from './bagTiles';
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
  assert.equal(fillDecision({ ...gap, areaM2: 5557 }, h), 'fill', 'Wibautstraat 150 at Pauwenpad: AHN sees a 16-20 m mass');
  assert.equal(fillDecision({ ...gap, areaM2: 7800 }, ahnHeights(Array(50).fill(3.5), [0.6, 0.6, 0.6])), 'too-large', 'low and large: a car-park roof, look first');
  assert.equal(fillDecision({ ...gap, modelCover: 0.3 }, h), 'under-model', 'Nieuwe Kerk notch annex');
  assert.equal(fillDecision({ ...gap, roadInsideM: 286 }, h), 'over-road', 'Amstel station hole across Julianaplein');
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

test('a guessed-height outline does not draw a pand; the fill replaces it (Jan van Zutphenstraat)', () => {
  assert.ok(osmHeightGuessed({ 'building:part': 'yes' }), 'w1313016956: no height, no levels -> the 9 m default');
  assert.ok(!osmHeightGuessed({ 'building:part': 'yes', 'building:levels': '12' }));
  assert.ok(!osmHeightGuessed({ building: 'yes', height: '33' }));
  const tower = sq(4.8853, 52.3765, 0.00015); // a third of the lot
  const tiles: TileBuilding[] = [{ id: 'w1313016956', height: 9, rings: [tower] }];
  const pands = [pand('0363100012078768', [lot])];
  assert.equal(findBagGaps(pands, new Set(), () => tiles)[0].tileCover > 0.2, true, 'counted as drawn, the pand is held as half-drawn');
  const [gap] = findBagGaps(pands, new Set(), () => tiles, new Set(['w1313016956']));
  assert.equal(gap.tileCover, 0);
  assert.deepEqual(gap.guessIds, ['w1313016956']);
  const h = ahnHeights(Array(50).fill(37.4), [0.6, 0.6, 0.6]);
  const fill = supplementFeature(gap, [lot], h)!;
  assert.deepEqual(fill.properties.replaces, ['w1313016956']);
  assert.deepEqual(forBuildingTiles(fill).properties.replaces, ['w1313016956']);
  const ringsOf = (g: unknown) => ((g as { coordinates: Ring[] }).coordinates).slice(0, 1);
  const existing = [{ properties: { id: 'w1313016956' }, geometry: { type: 'Polygon', coordinates: [tower] } }, { properties: { id: 'w2' }, geometry: { type: 'Polygon', coordinates: [sq(4.8870, 52.3765)] } }];
  const once = appendSupplement(existing, [fill], ringsOf);
  assert.deepEqual(once.added, ['NL.IMBAG.Pand.0363100012078768']);
  assert.deepEqual(once.replaced, ['w1313016956']);
  assert.deepEqual(once.features.map(f => f.properties.id), ['w2', 'NL.IMBAG.Pand.0363100012078768']);
  const twice = appendSupplement(once.features, [fill], ringsOf);
  assert.deepEqual([twice.added, twice.replaced, twice.features.length], [[], [], 2], 'idempotent');
  const towerOnLawn = { ...h!, height: 11.67, ridge: 35.29 }; // pand 126344: a tower over a low base
  assert.equal(fillDecision(gap, towerOnLawn), 'mixed-under-guess', 'the guesses stay and are measured on their own');
});

test('over-road parts: ground faces stand, faces over the road become decks, low ones over it go', () => {
  const ring = sq(4.9178, 52.3465);
  const faces = [
    { rings: [ring], topM: 13.8, roadInsideM: 0, areaM2: 620 },
    { rings: [ring], topM: 18.1, roadInsideM: 31, areaM2: 958 }, // Amstel station over the Julianaplein underpass
    { rings: [ring], topM: 5.5, roadInsideM: 41, areaM2: 268 },
    { rings: [ring], topM: 10.7, roadInsideM: 0, areaM2: 4 },
  ];
  const parts = overRoadPartFeatures('NL.IMBAG.Pand.0363100012145715', faces, 1939);
  assert.deepEqual(parts.map(p => [p.properties.id, p.properties.minHeight]), [
    ['part:NL.IMBAG.Pand.0363100012145715:0', 0],
    ['part:NL.IMBAG.Pand.0363100012145715:1', DECK_CLEARANCE_M],
  ]);
  assert.ok(parts.every(p => !isPandId(p.properties.id)));
});
