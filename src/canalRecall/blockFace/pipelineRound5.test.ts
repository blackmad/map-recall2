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
