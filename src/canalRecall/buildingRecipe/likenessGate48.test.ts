/**
 * Gate vs review (issue #48): measurement regressions where the photo likeness misread fronts an Opus review passed
 * beside their panoramas (Oostpoort Montessori, Metis Montessori, pand-165427). Fixture crops under ./fixtures are
 * slices of the rectified photo mosaic (50 px/m), CC BY 4.0 Amsterdam panoramas.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {analyseMask, halvedPeriod, dominantPeriod, lightTrimNormalisation, measureFacade, MASK, rgbToLab, type FacadeBox, type Rgb} from './measureFacade.ts';
import {linkedPieces} from './facadeOpenings.ts';
import {rgbToHsl} from '../blockFace/wallColour.ts';

const fixture = (f: string) => new URL(`./fixtures/${f}`, import.meta.url);
async function measureFixture(name: string) {
  const meta = JSON.parse(fs.readFileSync(fixture(`likeness-${name}.json`), 'utf8')) as {ppm: number; topM: number; box: FacadeBox; lines: number[]};
  const {data, info} = await sharp(fs.readFileSync(fixture(`likeness-${name}.jpg`))).removeAlpha().raw().toBuffer({resolveWithObject: true});
  return measureFacade({image: {width: info.width, height: info.height, rgb: new Uint8Array(data), ppm: meta.ppm, topM: meta.topM}, box: meta.box, lines: meta.lines});
}

test('lightTrimNormalisation: a cream trim sets the exposure but no white balance; a white one balances', () => {
  // twenty dark brick cells and one light trim cell (the p97 reference), Lab from the RGB
  const brick: Rgb = [76, 59, 56];
  const run = (trim: Rgb) => { const rgb = [...Array(40).fill(brick), trim, trim] as Rgb[]; return lightTrimNormalisation(rgb.map(rgbToLab), rgb); };
  const cream = run([152, 148, 137]); // Oostpoort Montessori's cream frames in the shade (b* 6.4)
  assert.ok(cream.gain > 1, 'exposure from the trim');
  assert.deepEqual(cream.wb, [1, 1, 1], 'no white balance from cream paint');
  const white = run([140, 148, 160]); // a white frame under a blue sky (b* < 0)
  assert.ok(white.wb[2] < 1 && white.wb[0] > 1, `a white reference is balanced (${white.wb})`);
});

test('Oostpoort Montessori walls[0]: the brick keeps its raw hue (cream frames are not a white reference)', async () => {
  const m = await measureFixture('oostpoort-walls0');
  const raw = rgbToHsl(m.wall.raw), norm = rgbToHsl(m.wall.normalised);
  let d = Math.abs(raw[0] - norm[0]); if (d > 180) d = 360 - d;
  assert.ok(d < 4, `hue raw ${raw[0].toFixed(0)} vs normalised ${norm[0].toFixed(0)}`);
  assert.equal(m.window?.shape, 'tall', '1.6 x 3.0 m sashes');
});

test('Oostpoort Montessori walls[1]: the soffit and frieze over the attic windows are not glazing', async () => {
  const m = await measureFixture('oostpoort-walls1');
  // attic band (8.3..12.2 m): 0.8 x 0.9 m lights on 1.5 m centres, ~0.12 by hand; the whole soffit read 0.43 before
  assert.ok(m.storeyGlazing[2]! < 0.35, `attic band glazing ${m.storeyGlazing[2]}`);
  assert.ok(m.glazing < 0.45, `glazing ${m.glazing}`);
});

test('halvedPeriod: evenly spaced windows broken by an entrance keep their own pitch; paired windows keep the bay', () => {
  // 2.4 m windows (24 cells, 16 wide) over 48 m, with every other window lost behind a tree or a stair window on one side
  const even = Array.from({length: 480}, (_, i) => ((i % 24) < 16 && !(i < 140 && (Math.floor(i / 24) % 2)) ? 0.8 : 0.05));
  const per = dominantPeriod(even, 8, 80)!;
  const half = halvedPeriod(even, {lag: 48, score: per.score}, 8);
  assert.ok(half && Math.abs(half.lag - 24) < 1.5, `half lag ${half?.lag}`);
  // pairs: two 0.6 m windows 0.3 m apart in a 3 m bay repeat at 9 cells inside the bay, not at its half (15)
  const pairs = Array.from({length: 480}, (_, i) => ((i % 30) < 6 || ((i % 30) >= 9 && (i % 30) < 15) ? 0.8 : 0.05));
  assert.equal(halvedPeriod(pairs, {lag: 30, score: 0.9}, 8), null);
});

test('linkedPieces: windows joined by a head and a sill strip are cut at the piers; a pane in the wall colour is not', () => {
  const cols = 40, cell = 0.1, at = (x: number, y: number) => y * cols + x;
  // three 0.8 m windows (rows 2..9) with 0.4 m piers, linked by a strip along row 0 and a sill strip on rows 10..11
  const comp: number[] = [];
  for (let x = 0; x < 32; x++) { comp.push(at(x, 0), at(x, 10), at(x, 11)); if (x % 12 < 8) for (let y = 1; y < 10; y++) comp.push(at(x, y)); }
  const pieces = linkedPieces(comp, cols, cell);
  assert.equal(pieces.length, 3);
  // one 1.6 m window whose middle 0.6 m panes read as wall: frames round it, both rails in every column
  const win: number[] = [];
  for (let x = 0; x < 16; x++) for (let y = 0; y < 12; y++) if (x < 2 || x >= 14 || x === 7 || x === 8 || y < 2 || y >= 10 || (x >= 2 && x < 5)) win.push(at(x, y));
  assert.equal(linkedPieces(win, cols, cell).length, 1);
});

test('analyseMask: the window shape comes from the main window storey, not pooled with attic friezes', () => {
  // lines 0 / 4.3 / 8.3 / 11.7 / 15.1: ground and first-floor sashes 1.6 x 3.0 m on 2.4 m centres, two attic storeys
  // of 0.9 x 0.8 m lights on 1.2 m centres; pooled, the friezes fold the sashes into one square window
  const lines = [0, 4.3, 8.3, 11.7, 15.1], cell = 0.1, cols = 240, rows = 151, box: FacadeBox = {u0: 0, u1: 24, v0: 0, v1: 15.1};
  const mask = new Uint8Array(cols * rows).fill(MASK.wall);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const v = box.v1 - (j + 0.5) * cell, u = (i + 0.5) * cell;
    if (((v > 0.7 && v < 3.7) || (v > 5.0 && v < 8.0)) && u % 2.4 > 0.4 && u % 2.4 < 2.0) mask[j * cols + i] = MASK.dark;
    for (const b of [9.9, 13.3]) if (v > b && v < b + 0.8 && u % 1.2 > 0.15 && u % 1.2 < 1.05) mask[j * cols + i] = MASK.dark;
  }
  const g = analyseMask({mask, cols, rows, cell, box, lines});
  assert.equal(g.window?.shape, 'tall', JSON.stringify(g.window));
});
