/**
 * Photo-likeness measurement regressions on crops of the held large houses (issue #38). Fixtures under ./fixtures:
 * `likeness-<name>-mask.png` are cell masks (MASK values as grey, 10 cm cells) of a wall group's panel box, from the
 * model elevation or from the photo's opening pass at the likeness shift; `likeness-<name>.jpg` is a crop of a
 * group's rectified photo mosaic (50 px/m), CC BY 4.0 Amsterdam panoramas.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {analyseMask, measureFacade, sameMaterialClusters, windowGroupOf, type FacadeBox, type Rgb} from './measureFacade.ts';

const fixture = (f: string) => new URL(`./fixtures/${f}`, import.meta.url);
async function maskFixture(name: string) {
  const meta = JSON.parse(fs.readFileSync(fixture(`likeness-${name}-mask.json`), 'utf8')) as {cell: number; box: FacadeBox; lines: number[]};
  const {data, info} = await sharp(fs.readFileSync(fixture(`likeness-${name}-mask.png`))).extractChannel(0).raw().toBuffer({resolveWithObject: true});
  return analyseMask({mask: new Uint8Array(data), cols: info.width, rows: info.height, cell: meta.cell, box: meta.box, lines: meta.lines});
}

test('windowGroupOf: two alike windows per bay are a pair; unequal runs or a mullion gap are one window', () => {
  // a 3 m bay: windows 0.9 m wide at 0.3..1.2 and 1.6..2.5 m (0.4 m pier between)
  const prof = (spans: [number, number][], bays = 6, pitch = 30) => Array.from({length: bays * pitch}, (_, i) => (spans.some(([a, b]) => i % pitch >= a && i % pitch < b) ? 0.8 : 0.05));
  assert.deepEqual(windowGroupOf(prof([[3, 12], [16, 25]]), 30, 0.1), {n: 2, widthM: 0.9});
  assert.equal(windowGroupOf(prof([[3, 12]]), 30, 0.1).n, 1, 'one window per bay');
  assert.equal(windowGroupOf(prof([[3, 7], [11, 25]]), 30, 0.1).n, 1, 'a narrow and a wide window are not a pair');
  assert.equal(windowGroupOf(prof([[3, 12], [13, 22]]), 30, 0.1).n, 1, 'a 0.1 m mullion inside one window');
  assert.equal(windowGroupOf(prof([[2, 8], [12, 18], [22, 28]]), 30, 0.1).n, 3, 'three alike windows per bay');
});

test('Stadhouderskade 111 walls[1]: the model\'s paired sashes count as 26 window columns (13 bays) and read tall, as the photo\'s 28', async () => {
  const model = await maskFixture('stadhouderskade111-walls1-model');
  assert.equal(model.columns, 13, 'bays');
  assert.equal(model.window?.perBay, 2);
  assert.equal(model.windowColumns, 26);
  assert.equal(model.window?.shape, 'tall', 'one sash is tall; the pair together was read square');
  const photo = await maskFixture('stadhouderskade111-walls1-photo');
  assert.equal(photo.windowColumns, 28);
  assert.equal(photo.window?.shape, 'tall');
  assert.ok(Math.abs(photo.windowColumns! - model.windowColumns!) <= 0.2 * photo.windowColumns!, 'within the likeness column tolerance');
});

test('Overtoom 283 walls[1]: paired windows in the photo are 6 square windows, not 3 wide ones', async () => {
  const photo = await maskFixture('overtoom283-walls1-photo');
  assert.equal(photo.columns, 3);
  assert.equal(photo.windowColumns, 6);
  assert.equal(photo.window?.shape, 'square');
});

test('Quellijnstraat 36 walls[1]: unequal windows folded at a long pitch stay one per bay (shape from the whole run)', async () => {
  const photo = await maskFixture('quellijnstraat36-walls1-photo');
  assert.equal(photo.window?.perBay, undefined);
  assert.equal(photo.windowColumns, photo.columns);
  assert.equal(photo.window?.shape, 'square');
});

test('sameMaterialClusters: lit brick beside shaded brick is wall; glass, a darker cluster and a grey wall are not', () => {
  // clusters: 0 shaded brick (wall), 1 sunlit brick, 2 blue-grey glass, 3 dark panes mirroring the brick opposite
  const shade: Rgb = [94, 75, 66], lit: Rgb = [128, 102, 89], glass: Rgb = [92, 99, 108], darkMirror: Rgb = [60, 48, 42];
  const colours = [shade, shade, lit, lit, glass, glass, darkMirror, darkMirror], label = [0, 0, 1, 1, 2, 2, 3, 3];
  assert.deepEqual(sameMaterialClusters(colours, label, 4, [true, false, false, false], 0), [false, true, false, false]);
  // a grey wall: its chromaticity is the glass's, so nothing joins it
  const grey: Rgb = [120, 122, 124], greyLit: Rgb = [160, 162, 165];
  assert.deepEqual(sameMaterialClusters([grey, greyLit, glass], [0, 1, 2], 3, [true, false, false], 0), [false, false, false]);
});

test('pand-233585 walls[1]: the sunlit brick piers and frieze over the shaded wall are wall, not glazing', async () => {
  const meta = JSON.parse(fs.readFileSync(fixture('likeness-p233585-walls1.json'), 'utf8')) as {ppm: number; topM: number; box: FacadeBox; lines: number[]};
  const {data, info} = await sharp(fs.readFileSync(fixture('likeness-p233585-walls1.jpg'))).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const m = measureFacade({image: {width: info.width, height: info.height, rgb: new Uint8Array(data), ppm: meta.ppm, topM: meta.topM}, box: meta.box, lines: meta.lines});
  // the band over the windows (corbel table, frieze, attic: 14.1..17.2 m) has no glazing in the photo or the model
  assert.ok(m.storeyGlazing[4]! < 0.15, `frieze band glazing ${m.storeyGlazing[4]}`);
  // the two window bays (0.9 + 1.4 m of an 8 m crop, three stacked lights each) and no more
  assert.ok(m.glazing > 0.15 && m.glazing < 0.4, `glazing ${m.glazing}`);
  assert.ok(m.clusters!.some(c => c.wall && c.lab[0] > m.clusters![m.wallCluster!].lab[0] + 3), 'a lighter cluster joined the wall');
});
