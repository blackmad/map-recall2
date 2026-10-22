import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { bagPandNumber, blockName, buurtBboxes, buurtFor, buurtList, modelRow, pageUrl, prepareBoundaries, type Boundary } from './indexBuilder';
import {
  deepLinkSearch, downloadName, formatBytes, LICENCE, LICENCE_LINE, modelsIn, pandIndex, panelView, parseDeepLink,
  reportOptions, requestOptions, searchModels,
} from './panel';
import { footprintAt } from './pandLookup';
import { clampOrbit, orbitPosition } from './viewer';
import { ELSEWHERE, type ExplorerIndex, type ExplorerModel } from './types';

// Two nested squares in [lat, lng], as boundaries.json stores them: a quarter and a smaller neighbourhood inside it.
const square = (lat0: number, lng0: number, size: number) => [[[[lat0, lng0], [lat0, lng0 + size], [lat0 + size, lng0 + size], [lat0 + size, lng0], [lat0, lng0]]]];
const boundaries: Boundary[] = [
  { name: 'Big Quarter', kind: 'quarter', geometry: square(52.0, 4.0, 1) },
  { name: 'Small Buurt', kind: 'neighbourhood', geometry: square(52.2, 4.2, 0.2) },
  { name: 'Suburbia', kind: 'suburb', geometry: square(53.0, 5.0, 1) },
];
const prepared = prepareBoundaries(boundaries);

test('a point takes the smallest containing neighbourhood, then a suburb, else elsewhere', () => {
  assert.equal(buurtFor([4.3, 52.3], prepared), 'Small Buurt');
  assert.equal(buurtFor([4.8, 52.8], prepared), 'Big Quarter');
  assert.equal(buurtFor([5.5, 53.5], prepared), 'Suburbia');
  assert.equal(buurtFor([9, 9], prepared), ELSEWHERE);
});

test('block-face names collapse addresses on one street into a number range', () => {
  assert.equal(blockName(['Bilderdijkstraat 154', 'Bilderdijkstraat 150-152', 'Bilderdijkstraat 142-144'], 'x'), 'Bilderdijkstraat 142–154');
  assert.equal(blockName(['Kinkerstraat 32'], 'x'), 'Kinkerstraat 32');
  assert.equal(blockName(['Kinkerstraat 32', 'Bellamyplein 1'], 'x'), 'Kinkerstraat 32 +1');
  assert.equal(blockName([undefined], 'face-x'), 'face-x');
});

test('rows carry bare pand numbers, page-relative URLs, the LOD only when present, and rounded positions', () => {
  assert.equal(bagPandNumber('NL.IMBAG.Pand.0363100012061542'), '0363100012061542');
  assert.equal(bagPandNumber('w123'), undefined);
  assert.equal(pageUrl('./models/ordinary-buildings/chunks/a.glb?asset=01ce'), 'models/ordinary-buildings/chunks/a.glb');
  const row = modelRow({
    id: 'kerk', kind: 'landmark', name: ' Kerk ', lngLat: [4.31234567, 52.31234567], modelUrl: './models/kerk.glb', bytes: 2048,
    lodExists: true, pandIds: ['NL.IMBAG.Pand.0363100012061542', '0363100012061542', 'w42'], wiki: 'https://en.wikipedia.org/wiki/Kerk',
  }, prepared);
  assert.deepEqual(row, {
    id: 'kerk', kind: 'landmark', name: 'Kerk', lngLat: [4.312346, 52.312346], buurt: 'Small Buurt', glbUrl: 'models/kerk.glb',
    lodUrl: 'models/kerk.lod1.glb', bytes: 2048, pandIds: ['0363100012061542'], wiki: 'https://en.wikipedia.org/wiki/Kerk',
  });
  const flat = modelRow({ id: 'shed', kind: 'ordinary', name: 'Shed', lngLat: [4.8, 52.8], modelUrl: 'models/shed.glb', bytes: 1, lodExists: false, pandIds: [] }, prepared);
  assert.equal('lodUrl' in flat, false);
  assert.equal('wiki' in flat, false);
  const list = buurtList([row, flat], buurtBboxes(prepared));
  assert.deepEqual(list.map(b => [b.name, b.count]), [['Big Quarter', 1], ['Small Buurt', 1]]);
  assert.deepEqual(list[1].bbox, [4.2, 52.2, 4.4, 52.4]);
});

const model = (over: Partial<ExplorerModel> = {}): ExplorerModel => ({
  id: 'westerkerk', kind: 'landmark', name: 'Westerkerk / Westertoren', lngLat: [4.883896, 52.3745], buurt: 'Grachtengordel',
  glbUrl: 'models/westerkerk.glb', bytes: 234440, pandIds: ['0363100012164998', '0363100012168591', '0363100012174220', '0363100012174222'],
  wiki: 'https://en.wikipedia.org/wiki/Westerkerk', ...over,
});

test('the panel offers the GLB with its size and the licence line', () => {
  assert.equal(formatBytes(900), '900 B');
  assert.equal(formatBytes(234440), '229 KB');
  assert.equal(formatBytes(1_450_000), '1.4 MB');
  const view = panelView(model());
  assert.deepEqual(view.download, { href: 'models/westerkerk.glb', filename: 'canal-recall-westerkerk.glb', label: 'Download GLB · 229 KB' });
  assert.deepEqual(view.pandLines, ['BAG pand 0363100012164998', 'BAG pand 0363100012168591', 'BAG pand 0363100012174220', '+1 more']);
  assert.equal(view.wiki, 'https://en.wikipedia.org/wiki/Westerkerk');
  assert.equal(view.licence, LICENCE);
  assert.equal(LICENCE_LINE, 'CC BY 4.0 · credit Ride Amsterdam, 3DBAG, BAG and OpenStreetMap contributors; see credits.html');
  assert.equal(view.kindLabel, 'Landmark');
  assert.equal(downloadName({ id: 'a b/c' }), 'canal-recall-a-b-c.glb');
});

test('a model that may not be redistributed has no download and says why', () => {
  const view = panelView(model({ restricted: { licence: '3D Warehouse General Model License', source: 'https://3dwarehouse.sketchup.com/model/x', author: 'City of Amsterdam' } }));
  assert.equal(view.download, undefined);
  assert.match(view.licence, /3D Warehouse General Model License \(City of Amsterdam\); not redistributed/);
});

test('report and request open the shared feedback form with typed subjects', () => {
  assert.deepEqual(reportOptions(model()), {
    category: 'building', subject: { kind: 'model', id: 'westerkerk', lngLat: [4.883896, 52.3745] },
    label: 'Westerkerk / Westertoren (westerkerk)', id: 'explore:westerkerk',
  });
  assert.deepEqual(requestOptions([4.1234567, 52.7654321]), {
    category: 'request', subject: { kind: 'point', lngLat: [4.123457, 52.765432] }, label: 'Building request', id: 'explore:request:4.123457,52.765432',
  });
  assert.deepEqual(requestOptions([4.1, 52.7], { kind: 'pand', id: '0363100012061542' }).subject, { kind: 'pand', id: '0363100012061542', lngLat: [4.1, 52.7] });
});

test('deep links round-trip and ignore unknown names', () => {
  const index = { buurten: [{ name: 'Jordaan', bbox: [0, 0, 1, 1] as [number, number, number, number], count: 1 }], models: [model()] };
  assert.deepEqual(parseDeepLink('?buurt=jordaan&model=westerkerk', index), { buurt: 'Jordaan', model: 'westerkerk' });
  assert.deepEqual(parseDeepLink('?buurt=Nowhere&model=nope', index), { buurt: undefined });
  assert.equal(deepLinkSearch('?debug=1', { buurt: 'Jordaan', model: 'westerkerk' }), '?debug=1&buurt=Jordaan&model=westerkerk');
  assert.equal(deepLinkSearch('?buurt=Jordaan&model=x', {}), '');
});

test('search matches word prefixes without accents, landmarks first', () => {
  const models = [
    model(),
    model({ id: 'west-shed', kind: 'ordinary', name: 'Westerpark shed', pandIds: [] }),
    model({ id: 'hotel', name: 'Hôtel de l’Europe', pandIds: ['0363100012000001'] }),
  ];
  assert.deepEqual(searchModels(models, 'west').map(m => m.id), ['westerkerk', 'west-shed']);
  assert.deepEqual(searchModels(models, 'hotel europe').map(m => m.id), ['hotel']);
  assert.deepEqual(searchModels(models, '036310001200').map(m => m.id), ['hotel']);
  assert.deepEqual(searchModels(models, '  '), []);
  assert.deepEqual(modelsIn(models).map(m => m.id), ['hotel', 'westerkerk', 'west-shed']);
  assert.equal(pandIndex(models).get('0363100012164998')?.id, 'westerkerk');
});

test('a click resolves to the pand, OSM way or open ground under it', () => {
  const ring = [[4, 52], [4.001, 52], [4.001, 52.001], [4, 52.001], [4, 52]];
  const features = [
    { properties: { id: 'NL.IMBAG.Pand.0363100012061542' }, geometry: { type: 'Polygon', coordinates: [ring] } },
    { properties: { id: 'w77' }, geometry: { type: 'MultiPolygon', coordinates: [[ring.map(([x, y]) => [x + 1, y])]] } },
  ];
  assert.deepEqual(footprintAt([4.0005, 52.0005], features), { kind: 'pand', id: '0363100012061542' });
  assert.deepEqual(footprintAt([5.0005, 52.0005], features), { kind: 'osm', id: 'w77' });
  assert.deepEqual(footprintAt([6, 52], features), { kind: 'point' });
});

test('orbit stays above the ground and inside a sane zoom', () => {
  assert.deepEqual(clampOrbit({ yaw: 1, pitch: -1, distance: 99 }), { yaw: 1, pitch: 0.05, distance: 5 });
  const [x, y, z] = orbitPosition({ yaw: 0, pitch: 0, distance: 2 }, 0.3);
  assert.deepEqual([x, y, z].map(v => Math.round(v * 1000) / 1000), [0, 0.3, 2]);
});

test('the published index is well formed and every GLB it names exists', { skip: !existsSync('public/data/extracts/amsterdam/explorer-index.json') }, () => {
  const index = JSON.parse(readFileSync('public/data/extracts/amsterdam/explorer-index.json', 'utf8')) as ExplorerIndex;
  assert.equal(index.version, 1);
  assert.ok(index.models.length > 400, `${index.models.length} models`);
  const ids = new Set(index.models.map(m => m.id));
  assert.equal(ids.size, index.models.length, 'ids are unique');
  for (const m of index.models) {
    assert.ok(existsSync(`public/canal-drive/${m.glbUrl}`), m.glbUrl);
    if (m.lodUrl) assert.ok(existsSync(`public/canal-drive/${m.lodUrl}`), m.lodUrl);
    assert.ok(m.lngLat[0] > 4.7 && m.lngLat[0] < 5.1 && m.lngLat[1] > 52.27 && m.lngLat[1] < 52.45, `${m.id} is in Amsterdam`);
    assert.ok(index.buurten.some(b => b.name === m.buurt), `${m.id} buurt ${m.buurt} is listed`);
  }
  assert.ok(readFileSync('public/data/extracts/amsterdam/explorer-index.json').length < 256 * 1024, 'index stays under 256 KB');
});
