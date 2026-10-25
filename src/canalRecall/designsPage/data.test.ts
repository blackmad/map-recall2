import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDesigns, designTitle, rideHouse, totals, type BuurtFeatureInput, type DesignInstanceInput, type DesignSpecInput } from './data';
import { designCard, renderDesignsPage } from './template';

const sq = (lng: number, lat: number, d: number) => [[[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat]]];
const buurten: BuurtFeatureInput[] = [
  { properties: { code: 'AA01', name: 'Noordbuurt', wijk: 'Wijk A', stadsdeel: 'Noord' }, geometry: { type: 'Polygon', coordinates: sq(4.90, 52.40, 0.01) } },
  { properties: { code: 'BB01', name: 'Zuidbuurt', wijk: 'Wijk B', stadsdeel: 'Zuidoost' }, geometry: { type: 'Polygon', coordinates: sq(4.95, 52.30, 0.01) } },
];
const house = (pand: string, unit: string, lng: number, lat: number, variant = 'red'): DesignInstanceInput => ({ pand, unit, variant, anchor: [lng, lat] });
const instances = [
  house('1', 'aa-row__red__2__gable__long__solid', 4.901, 52.401),
  house('2', 'aa-row__red__2__gable__long__solid__mirror', 4.905, 52.405),
  house('3', 'aa-row__blue__2__gable__long__solid', 4.906, 52.406, 'blue'),
  house('4', 'aa-row__red__2__gable__long__solid', 4.955, 52.305),
  house('5', 'bb-flat__x__4__flat__long__solid', 4.951, 52.301, 'x'),
];
const specs: DesignSpecInput[] = [
  { id: 'aa-row', label: 'Test Noord (1960): brick row, pitched roof <b>', storeys: 2, source: { bouwjaar: [1958, 1962] }, roof: { form: 'gable' },
    variants: { red: { label: 'red brick', palette: { wall: { slot: 'brick', tint: '#AA3311' } } }, blue: { palette: { wall: '#2233aa' } } } },
  { id: 'bb-flat', label: 'Test Zuid: flat block', variants: { x: {} } },
  { id: 'cc-none', label: 'Unplaced: nothing' },
];

test('designs count houses per buurt and variant, newest-biggest first, with a ride link among its houses', () => {
  const ds = buildDesigns({ specs, instances, buurten, boundaries: [], images: { 'aa-row': { photo: 'designs/img/aa-row-photo.jpg' } } });
  assert.deepEqual(ds.map(d => [d.id, d.count]), [['aa-row', 4], ['bb-flat', 1], ['cc-none', 0]]);
  const a = ds[0];
  assert.deepEqual(a.buurten.map(b => [b.name, b.count]), [['Noordbuurt', 3], ['Zuidbuurt', 1]]);
  assert.deepEqual(a.stadsdelen, ['Noord', 'Zuidoost']);
  assert.deepEqual(a.variants.map(v => [v.key, v.label, v.wall, v.count]), [['red', 'red brick', '#aa3311', 3], ['blue', 'Blue', '#2233aa', 1]]);
  assert.deepEqual(a.years, [1958, 1962]);
  assert.ok(a.ride && ['1', '2', '3'].includes(a.ride.pand), 'ride starts in the biggest buurt');
  assert.match(a.ride!.href, /^index\.html\?travel=car#race=52\.40/);
  assert.ok(a.map && a.map.dots.length === 4 && a.map.outlines.length >= 1);
  assert.equal(ds[2].ride, undefined);
  const t = totals(ds);
  assert.deepEqual([t.designs, t.placed, t.houses, t.buurten], [3, 2, 5, 2]);
  assert.deepEqual(t.stadsdelen, ['Noord', 'Zuidoost']);
});

test('rideHouse picks the house nearest the middle, not an outlier', () => {
  const hs = [house('a0', 'u', 4.899, 52.3999), house('a', 'u', 4.90, 52.40), house('b', 'u', 4.901, 52.4001), house('c', 'u', 4.902, 52.4002), house('far', 'u', 5.2, 52.2)];
  assert.equal(rideHouse(hs, [])!.pand, 'b');
});

test('the page escapes spec text, anchors each design and filters by district', () => {
  const ds = buildDesigns({ specs, instances, buurten, boundaries: [], images: {} });
  const card = designCard(ds[0]);
  assert.match(card, /id="aa-row"/);
  assert.ok(!card.includes('<b>') || !card.includes('roof <b>'), 'label is escaped');
  assert.match(card, /&lt;b&gt;/);
  assert.match(card, /data-st="Noord\|Zuidoost"/);
  assert.match(card, /See it in the game/);
  assert.match(designCard(ds[2]), /Not placed in the game yet/);
  const html = renderDesignsPage(ds, totals(ds));
  assert.match(html, /<option value="Noord">Noord<\/option>/);
  assert.match(html, /CC BY 4\.0/);
});

test('designTitle splits a spec label into the place it was measured and a short name', () => {
  assert.deepEqual(designTitle('Tuindorp Oostzaan-Oost (1936-38) two-storey terraced house in dark clinker brick, white eaves fascia', 'x'),
    { place: 'Tuindorp Oostzaan-Oost', title: 'Two-storey terraced house in dark clinker brick' });
  assert.deepEqual(designTitle('Nieuw-West cluster 2 design B (Van Suchtelen van de Haarestraat, X): five-storey brick portiekflat 17 x 10.6 m, blue doors', 'x'),
    { place: 'Nieuw-West cluster 2 design B', title: 'Five-storey brick portiekflat 17 x 10.6 m' });
  assert.deepEqual(designTitle('Blauwe Zand (1931-32) two-storey terraced house: red-brown brick, cream frieze', 'x'),
    { place: 'Blauwe Zand', title: 'Two-storey terraced house: red-brown brick' });
  assert.equal(designTitle('Nieuw-West terraced house, brown brick, narrow glazed bay (dark door), more', 'x').title, 'Nieuw-West terraced house, brown brick, narrow glazed bay');
  assert.deepEqual(designTitle('', 'fallback-id'), { place: '', title: 'fallback-id' });
});
