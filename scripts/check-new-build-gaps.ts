/**
 * New-build gaps: the rules that decide an OSM footprint fills a hole, and the
 * reported places that must stay filled in the published tiles.
 *
 *   npx tsx scripts/check-new-build-gaps.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ExistingIndex, findGapFills, type ExistingBuilding, type GapCandidate } from '../src/canalRecall/newBuildGaps.ts';
import { pointInRing, type Ring } from '../src/canalRecall/buildingGeometry.ts';
import { tileFor } from '../src/canalRecall/slippyTiles.ts';

// --- rules, on a synthetic block ----------------------------------------------
const box = (lng: number, lat: number, w: number, h: number): Ring =>
  [[lng, lat], [lng + w, lat], [lng + w, lat + h], [lng, lat + h], [lng, lat]];
const D = 0.00001; // about 0.7 m east-west, 1.1 m north-south
const row: ExistingBuilding[] = [0, 1, 2, 3].map(i => ({ id: `NL.IMBAG.Pand.000000000000000${i}`, rings: [box(4.9 + i * 10 * D, 52.37, 10 * D, 12 * D)], height: 14, minHeight: 0, tier: 3 }));
const parts: ExistingBuilding = { id: 'w900', rings: [box(4.91, 52.37, 10 * D, 10 * D)], height: 60, minHeight: 0, tier: 2 };
const canopy: ExistingBuilding = { id: 'w901', rings: [box(4.92, 52.37, 10 * D, 10 * D)], height: 6, minHeight: 4, tier: 4 };
const index = new ExistingIndex([...row, parts, canopy]);
const candidate = (osmId: number, ring: Ring, tags: Record<string, string> = {}): GapCandidate => ({ osmId, ring, tags: { building: 'yes', ...tags } });
const ids = (list: GapCandidate[]) => findGapFills(list, index).map(fill => fill.id);

assert.deepEqual(ids([candidate(1, box(4.9 + 40 * D, 52.37, 10 * D, 12 * D))]), ['w1'], 'an infill pand beside the row is a gap');
assert.deepEqual(ids([candidate(2, box(4.9 + 2 * D, 52.37 + 2 * D, 5 * D, 5 * D))]), [], 'a footprint on ground the row already covers is not');
assert.deepEqual(ids([candidate(3, box(4.95, 52.37, 10 * D, 10 * D), { 'ref:bag': '1' })]), [], 'a pand drawn under its BAG id is not');
assert.deepEqual(ids([candidate(4, box(4.91 + 8 * D, 52.37, 12 * D, 10 * D))]), [], 'a pand under hand-mapped parts stays suppressed even where the parts leave ground open');
assert.deepEqual(ids([candidate(5, box(4.92, 52.37, 10 * D, 10 * D))]), ['w5'], 'a canopy over the ground does not fill it');
assert.deepEqual(ids([candidate(6, box(4.95, 52.37, 10 * D, 10 * D), { building: 'construction' })]), [], 'a building site is not drawn');
assert.deepEqual(ids([candidate(7, box(4.95, 52.37, 2 * D, 2 * D))]), [], 'a 2 m² fragment is not drawn');

const kiosk = findGapFills([candidate(8, box(4.9 + 45 * D, 52.37 + 20 * D, 5 * D, 3 * D))], index)[0];
assert.equal(kiosk.heightSource, 'small', 'a kiosk-sized footprint draws as one storey');
const infill = findGapFills([candidate(9, box(4.9 + 40 * D, 52.37, 10 * D, 12 * D))], index)[0];
assert.deepEqual([infill.heightSource, infill.height], ['neighbours', 14], 'infill takes its measured neighbours\' height');
const levels = findGapFills([candidate(10, box(4.9 + 40 * D, 52.37, 10 * D, 12 * D), { 'building:levels': '4' })], index)[0];
assert.deepEqual([levels.heightSource, levels.height], ['osm-levels', 12.4], 'OSM storeys beat the neighbours');

// --- reported places in the published tiles -----------------------------------
const tileRoot = 'public/data/extracts/amsterdam/building-tiles/14';
const buildingsAt = (lng: number, lat: number) => {
  const { x, y } = tileFor(lng, lat, 14), hits: Record<string, unknown>[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const file = path.join(tileRoot, String(x + dx), `${y + dy}.geojson.gz`);
    if (!fs.existsSync(file)) continue;
    for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString()).features) {
      const rings: Ring[] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p: Ring[]) => p[0]);
      if (rings.some(ring => pointInRing([lng, lat], ring))) hits.push(f.properties);
    }
  }
  return hits;
};

const places: Array<{ name: string; at: [number, number]; why: string }> = [
  // OSM node 9039944077; its kiosk is pand 0363100012571031 (2023), OSM way 1311060949.
  { name: 'Mr Blou I Love You, Elandsgracht 150', at: [4.8775567, 52.3689948], why: 'user report 2026-10-03: the kiosk had no building' },
];
for (const place of places) {
  const hits = buildingsAt(...place.at);
  assert.ok(hits.length > 0 && hits.every(h => Number(h.height) <= 6), `${place.name} stands in a small building (${place.why}); found ${JSON.stringify(hits)}`);
}

console.log(`new-build gaps: rules hold; ${places.length} reported place(s) have their building`);
