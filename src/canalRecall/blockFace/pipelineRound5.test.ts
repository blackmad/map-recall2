/**
 * Transvaalbuurt round 5a pipeline fixes (#157): installed runs survive a buurt re-run, street furniture is no business,
 * the batch measures walls from tree-free columns, the likeness reads the facade foot off the strip.
 *   node --import tsx --test src/canalRecall/blockFace/pipelineRound5.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assignRunIds, frozenRuns, installedRunIds, type ExistingRun} from './autoPlace.ts';

const json = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const FACES = 'scripts/block-face/faces';
const members = (face: string): string[] => json(`${FACES}/${face}/discovery.json`).members;

test('fix 2: installed runs of pretorius-71-95 are read from chunks.json', () => {
  const chunks = json('public/canal-drive/ordinary-buildings-data/chunks.json').chunks.map((c: {id: string}) => c.id);
  assert.deepEqual(installedRunIds('pretorius-71-95', chunks).sort(), ['pretorius-71-95-r1', 'pretorius-71-95-r2']);
  // a longer face id sharing the prefix is not this face's run
  assert.deepEqual(installedRunIds('pretorius-71-9', chunks), []);
});

test('fix 2: a re-run keeps an installed run and numbers a new placement on the same face after it', () => {
  const face = members('pretorius-71-95'), r1 = members('pretorius-71-95-r1');
  // fixture: r1 installed, r2 an earlier uninstalled run on other pands
  const existing: ExistingRun[] = [{id: 'pretorius-71-95-r1', pands: r1, installed: true}, {id: 'pretorius-71-95-r2', pands: face.slice(9, 11), installed: false}];
  const none = new Set<string>();
  assert.deepEqual(frozenRuns(existing, none).map(r => r.id), ['pretorius-71-95-r1']);
  // the new placement: the three pands before r1 and three after it (r1's pands are held at stage `installed`)
  const runs = [face.slice(1, 4), face.slice(6, 9)];
  assert.deepEqual(assignRunIds('pretorius-71-95', face.length, runs, existing, none), ['pretorius-71-95-r2', 'pretorius-71-95-r3']);
  // the old numbering would have given r1 to the first new run and overwritten the installed intent
  assert.deepEqual(assignRunIds('pretorius-71-95', face.length, runs, [], none), ['pretorius-71-95-r1', 'pretorius-71-95-r2']);
  // one run of the whole face never takes the face id while a run is installed
  assert.deepEqual(assignRunIds('pretorius-71-95', face.length, [face.filter(p => !r1.includes(p))], existing, none), ['pretorius-71-95-r2']);
});

test('fix 2: --replace re-places an installed run under its own id', () => {
  const face = members('pretorius-71-95'), r1 = members('pretorius-71-95-r1'), r2 = members('pretorius-71-95-r2');
  const existing: ExistingRun[] = [{id: 'pretorius-71-95-r1', pands: r1, installed: true}, {id: 'pretorius-71-95-r2', pands: r2, installed: true}];
  const replace = new Set(['pretorius-71-95-r2']);
  assert.deepEqual(frozenRuns(existing, replace).map(r => r.id), ['pretorius-71-95-r1']);
  const i = face.indexOf(r2[0]);
  assert.deepEqual(assignRunIds('pretorius-71-95', face.length, [face.slice(1, 4), face.slice(i - 1, i + 3)], existing, replace), ['pretorius-71-95-r3', 'pretorius-71-95-r2']);
});

// --- fix 3: tree-free wall columns (Danie Theronstraat 2020-04-29 wall boxes, fixtures/theron-walls) ---
import sharp from 'sharp';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cleanWallVerdict, foliageColumns, maskColumns, rowMedianRgb} from './batchInstall.ts';
import {isLeaf} from '../buildingRecipe/measureFacade.ts';
import {measureStripPalette} from './stripPalette.ts';
import {rgbToHsl, type Rgb} from './wallColour.ts';

const WALLS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'theron-walls');
async function wallBox(pandId: string) {
  const ix = json(path.join(WALLS, 'index.json')).pands.find((p: any) => p.pandId.endsWith(pandId));
  const {data, info} = await sharp(path.join(WALLS, ix.file)).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const rgb = new Uint8Array(data), box = {x0: 0, x1: info.width, y0: 0, y1: info.height};
  // The wall of the box as face-wall-exposure.ts reads it (the box is the whole body band here).
  const wall = (buf: Uint8Array) => measureStripPalette({rgb: buf, width: info.width, height: info.height, x0: 0, x1: info.width, pixelsPerMetre: ix.pixelsPerMetre, eavesM: info.height / ix.pixelsPerMetre + 1, bodyFromM: 0});
  const masked = foliageColumns(rgb, info.width, box, isLeaf);
  return {ix, masked, verdict: cleanWallVerdict(masked, ix.pixelsPerMetre), naive: wall(rgb), clean: wall(maskColumns(rgb, info.width, info.height, box, masked, [128, 128, 128]))};
}
const hex = (h: string): Rgb => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb;

test('fix 3: Theronstraat 13A, 23A, 16A and 28 are under trees; 17A, 25D, 24 and 20 are clean enough to measure', async () => {
  for (const id of ['138289', '137971', '089089', '069116']) assert.equal((await wallBox(id)).verdict.own, false, id);
  for (const id of ['148172', '139446', '116701', '115092']) assert.equal((await wallBox(id)).verdict.own, true, id);
});

test('fix 3: the row median of the tree-free walls is brick, where the tree-covered reading is green', async () => {
  const clean = await Promise.all(['148172', '139446'].map(wallBox));
  const row = rowMedianRgb(clean.map(c => hex(c.clean.wall!)))!;
  const [hue, , l] = rgbToHsl(row);
  assert.ok(hue < 40 || hue > 340, `row wall hue ${hue} is a red-brown brick`);
  assert.ok(l > 0.2, `row wall lightness ${l}`);
  // Danie Theronstraat 13A read whole: the tree's green moves the wall hue towards olive (#1f1e15 on round 4's refit).
  const t = await wallBox('138289'), [nh] = rgbToHsl(hex(t.naive.wall!));
  assert.ok(nh > hue + 15, `13A naive wall hue ${nh} is greener than the row ${hue}`);
  // On a clean pand no column is dropped where nothing covers it: the masked reading is the plain one.
  const none = clean.find(c => !c.masked.some(Boolean));
  if (none) assert.equal(none.clean.wall, none.naive.wall);
});

// --- fix 4: OSM street furniture is no business ---
import {groundUse, osmCategory, STREET_FURNITURE, type PandEvidence} from './autoPlace.ts';

test('fix 4: pavement furniture never makes a shopfront (Hasebroekstraat 28, Vaalrivierstraat, Retiefstraat 61-63, Govert Flinckstraat 195)', () => {
  const ev = (osm: {category?: string; name?: string}[], groundUses: string[] = ['woonfunctie']) =>
    ({pandId: 'p', address: 'a', groundUses, osm: osm.map((o, i) => ({type: 'node', id: i + 1, ...o}))}) as unknown as PandEvidence;
  // Hasebroekstraat 28: amenity=public_bookcase was read as a bar (`amenity=pub` matched as a prefix).
  assert.equal(groundUse(ev([{category: 'amenity=public_bookcase'}], ['industriefunctie']), '2022-01-04').use, 'residential');
  for (const tag of ['waste_disposal', 'bicycle_parking', 'public_bookcase', 'bench', 'waste_basket', 'post_box', 'vending_machine', 'charging_station', 'bicycle_rental', 'parking', 'recycling', 'telephone', 'clock', 'drinking_water', 'fountain']) {
    assert.ok(STREET_FURNITURE.test(`amenity=${tag}`), tag);
    assert.equal(groundUse(ev([{category: `amenity=${tag}`}]), '2020-04-29').use, 'residential', tag);
  }
  // BAG still decides when the furniture is dropped (Eerste Jacob van Campenstraat 8: winkelfunctie).
  assert.equal(groundUse(ev([{category: 'amenity=bicycle_parking'}], ['winkelfunctie']), '2022-03-21').use, 'shop');
  // Real businesses are unchanged, the use patterns now match whole values.
  assert.equal(groundUse(ev([{category: 'amenity=pub', name: 'Café'}]), 'd').use, 'bar');
  assert.equal(groundUse(ev([{category: 'amenity=bar'}]), 'd').use, 'bar');
  assert.equal(groundUse(ev([{category: 'amenity=cafe'}]), 'd').use, 'cafe');
  assert.equal(groundUse(ev([{category: 'amenity=fast_food'}]), 'd').use, 'restaurant');
  assert.equal(groundUse(ev([{category: 'amenity=public_building'}]), 'd').use, 'services');
  assert.equal(osmCategory({amenity: 'public_bookcase', name: undefined}), 'amenity=public_bookcase');
  assert.equal(osmCategory({shop: 'bakery', amenity: 'cafe'}), 'shop=bakery');
});

// --- fix 5: the facade foot (fixtures/strip-foot: the bottom 3 m of strip spans) ---
import {measureFacadeFoot, stripFootOffset, type FootReading} from './stripFoot.ts';
import {spanLikeness} from './stripLikeness.ts';

const FOOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'strip-foot');
async function footOf(file: string) {
  const ix = json(path.join(FOOT, 'index.json')).spans.find((s: any) => s.file === file);
  const {data, info} = await sharp(path.join(FOOT, file)).removeAlpha().raw().toBuffer({resolveWithObject: true});
  return measureFacadeFoot({rgb: new Uint8Array(data), width: info.width, height: info.height, x0: 0, x1: info.width, pixelsPerMetre: ix.pixelsPerMetre});
}

test('fix 5: the Tugelaweg 1929 blocks stand 1.6-1.9 m up their 2020-04-29 strips; other rows read no foot', async () => {
  for (const f of ['tugelaweg-113-120--118471.jpg', 'tugelaweg-91-112--144774.jpg', 'tugelaweg-91-112--083727.jpg']) {
    const r = await footOf(f);
    assert.ok(r.offsetM >= 1.5 && r.offsetM <= 2.0, `${f}: foot ${r.offsetM} m`);
  }
  for (const f of ['theron-9-37--148172.jpg', 'luthuli-21-41--109924.jpg', 'retief-45-75--123300.jpg']) assert.equal((await footOf(f)).offsetM, 0, f);
});

test('fix 5: one offset per strip only when most spans agree', () => {
  const r = (offsetM: number): FootReading => ({offsetM, row: null, step: 20, pavingIqr: 8});
  // tugelaweg-91-112: ten spans, three hidden by parked cars
  assert.equal(stripFootOffset([1.6, 1.63, 0, 0, 0, 1.88, 1.9, 1.88, 1.9, 1.88].map(r)).offsetM, 1.88);
  assert.equal(stripFootOffset([0, 0, 0, 0, 1.1, 0].map(r)).offsetM, 0); // a lone reading
  assert.equal(stripFootOffset([0.5, 2.3, 0.6, 2.2].map(r)).offsetM, 0); // readings disagree
  assert.equal(stripFootOffset([0, 0, 0].map(r)).offsetM, 0);
});

test('fix 5: spanLikeness reads the photo band from the foot; without an offset it is unchanged', () => {
  // A synthetic facade: window rows every 3 m up to 16 m eaves; the photo stands it on a foot 1.9 m up the strip with
  // its cornice at the same 16 m (Tugelaweg: the pavement above the 3DBAG ground, the eaves on the 3DBAG line).
  const W = 200, H = 800, ppm = 40, E = 16, foot = 1.9, k = (E - foot) / E;
  const draw = (toModel: (h: number) => number) => { const a = new Uint8Array(W * H * 3).fill(150); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = toModel((H - y) / ppm); if (h > 0 && h % 3 > 1.2 && h % 3 < 2.4 && x % 50 > 15 && x % 50 < 40) a.fill(40, (y * W + x) * 3, (y * W + x) * 3 + 3); } return a; };
  const model = draw(h => h), photo = draw(h => (h - foot) / k);
  const base = {photoRgb: photo, modelRgb: model, width: W, height: H, px: [0, W] as [number, number], eavesM: E, pixelsPerMetre: ppm};
  const off = spanLikeness(base), on = spanLikeness({...base, footOffsetM: foot});
  assert.ok(on.ncc! > 0.9, `aligned NCC ${on.ncc}`);
  assert.ok(on.ncc! > off.ncc! + 0.3, `aligned ${on.ncc} vs unaligned ${off.ncc}`);
  assert.deepEqual(spanLikeness({...base, footOffsetM: 0}), off);
});
