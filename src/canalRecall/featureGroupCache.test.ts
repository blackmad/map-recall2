import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ORIGIN, type Feature } from './threeBuildingFeatures.js';
import { ThreeBuildings } from './threeBuildingsBrowser.js';
// setFeatures' grouping memo (lane E5, #218): a long-lived instance, whose memo has seen earlier feature objects,
// groups exactly as a fresh instance given fresh copies, across a detail-centre move, a tile flush and a restyled
// (new) feature object. (The `?featureGroupCache=0` uncached loop this once compared against was retired 2026-11-27.)

const kx = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const ll = (x: number, y: number): [number, number] => [ORIGIN.lng + x / kx, ORIGIN.lat + y / 110540];
const box = (id: string, x: number, y: number): Feature => ({
  type: 'Feature', properties: { id, height: 12 },
  geometry: { type: 'Polygon', coordinates: [[ll(x, y), ll(x + 8, y), ll(x + 8, y + 10), ll(x, y + 10), ll(x, y)]] },
} as unknown as Feature);

function city(): Feature[] {
  const out: Feature[] = [];
  for (let i = 0; i < 40; i++) for (let j = 0; j < 20; j++) out.push(box(`way/${i}-${j}`, i * 90 - 1800, j * 90 - 900));
  return out;
}

function fresh(): any {
  const map = { getZoom: () => 17, triggerRepaint() {}, getCanvas: () => ({}) } as never;
  const tb = new ThreeBuildings(map, {} as never, 'photo', { detail: 'full' }) as any;
  tb.pump = () => {}; // no THREE: record the groups instead of building
  return tb;
}
const snap = (tb: any) => [...tb.sourceGroups].map(([k, l]: [string, Feature[]]) => `${k}=${l.map(f => f.properties.id).join(',')}`).join(' | ');
const copy = (fs: Feature[]) => fs.map(f => structuredClone(f));

test('the memoised grouping equals a cold instance on fresh objects across detail moves and tile flushes', () => {
  const warm = fresh();
  let features = city();
  let centre: [number, number] | null = null;
  const cold = () => { const tb = fresh(); tb.setFeatures(copy(features)); if (centre) tb.setDetailCentre(...centre); return snap(tb); };
  const steps: string[] = [];
  const check = (label: string) => { const s = snap(warm); steps.push(s); assert.equal(s, cold(), label); };
  warm.setFeatures(features); check('initial');
  centre = ll(0, 0); warm.setDetailCentre(...centre); check('detail centre');
  centre = ll(900, 300); warm.setDetailCentre(...centre); check('detail move');
  features = features.slice(100).concat(city().slice(0, 50)); // tiles left, tiles (new objects) arrived
  warm.setFeatures(features); check('tile flush');
  features = features.slice();
  features[200] = { ...features[200], geometry: box('way/moved', 5, 5).geometry } as Feature; // restyled/moved feature
  warm.setFeatures(features); check('restyled feature');
  assert.ok(steps[1].includes('near:'), 'the detail centre made near groups');
});
