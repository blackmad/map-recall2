/**
 * Likeness gate regressions for GitHub #61: fronts the photo-likeness gate misread after the #59 re-authoring (the
 * photo, not the model, was wrong). Fixtures under ./fixtures come from the 2016-2025 Amsterdam panoramas (CC BY 4.0):
 * mask PNGs hold MASK values as grey on 10 cm cells at the likeness shift; `-wall-like-` masks are 255 where the photo's
 * colour cluster is a wall cluster; `-photo-clusters` hold cluster + 1. The known-wrong models (Politie Postjesweg
 * walls[1]) must still fail.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {analyseMask, MASK, measureFacade, type FacadeBox, type FacadeMeasurement, type Rgb} from './measureFacade.ts';
import {compareRowOpenings, rowOpenings} from './rowOpenings.ts';
import {LIKENESS, rereadPalePanels, shadedWallMatch} from './likeness.ts';
import {insidePanel} from '../blockBuilding/panels.ts';

const fixture = (f: string) => new URL(`./fixtures/${f}`, import.meta.url);
const grey = async (f: string) => { const {data, info} = await sharp(fs.readFileSync(fixture(f))).extractChannel(0).raw().toBuffer({resolveWithObject: true}); return {data: new Uint8Array(data), width: info.width, height: info.height}; };
async function maskFixture(name: string) {
  const meta = JSON.parse(fs.readFileSync(fixture(`likeness-${name}-mask.json`), 'utf8')) as {cell: number; box: FacadeBox; lines: number[]};
  const g = await grey(`likeness-${name}-mask.png`);
  return {mask: g.data, cols: g.width, rows: g.height, cell: meta.cell, box: meta.box, lines: meta.lines};
}
const widest = (s: ReturnType<typeof rowOpenings>, storey: number) => Math.max(0, ...(s.rows.find(r => r.storey === storey)?.openings.map(o => o.w) ?? []));

test('Barlaeus walls[1]: a frame-and-voussoir cluster on the enrichment threshold gives the gate both readings (2 cm moved glazing 0.48 -> 0.27)', async () => {
  const meta = JSON.parse(fs.readFileSync(fixture('likeness-barlaeus-walls1.json'), 'utf8'));
  const {data, info} = await sharp(fs.readFileSync(fixture('likeness-barlaeus-walls1.jpg'))).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const measure = (dy: number) => {
    // the mosaic moved up by dy pixels (2 cm each at 50 px/m): a placement change well inside the crop's error
    const rgb = new Uint8Array(data.length);
    for (let y = 0; y < info.height; y++) { const sy = Math.min(info.height - 1, y + dy); rgb.set(data.subarray(sy * info.width * 3, (sy + 1) * info.width * 3), y * info.width * 3); }
    return measureFacade({image: {width: info.width, height: info.height, rgb, ppm: meta.ppm, topM: meta.topM}, box: meta.box, lines: meta.lines,
      inside: (u, v) => insidePanel({polys: meta.polys} as Parameters<typeof insidePanel>[0], [u + meta.panelU0, v])});
  };
  const a = measure(0), b = measure(1);
  assert.ok(a.glazing - b.glazing > 0.15, `the threshold flips: ${a.glazing} vs ${b.glazing} 2 cm higher`);
  assert.ok(a.altMask, 'the undecided blend cluster gives a second reading');
  const alt = analyseMask({mask: a.altMask!, cols: a.cols, rows: a.rows, cell: a.cell, box: a.box, lines: meta.lines}).glazing;
  assert.ok(Math.abs(alt - b.glazing) < 0.03, `the second reading ${alt} is what the shifted crop reads (${b.glazing})`);
  assert.ok(alt < 0.35, `three arched windows per 8 m storey are ~0.3 glazed, not ${a.glazing}`);
});

test('Spinozastraat 51 walls[0]: an overcast crop of the sunlit golden brick is the same wall by chromaticity; other colours are not', () => {
  const photo: Rgb = [89, 79, 59], model: Rgb = [191, 162, 113]; // #594f3b in shade (exposure not normalised) vs the measured #bfa271
  assert.equal(shadedWallMatch(photo, model, 0.306, false), true);
  assert.equal(shadedWallMatch(photo, model, 0.306, true), false, 'a normalised exposure is trusted: lightness judges');
  assert.equal(shadedWallMatch(model, photo, -0.306, false), false, 'never when the photo is the lighter');
  assert.equal(shadedWallMatch(photo, model, 0.4, false), false, `at most ${LIKENESS.shadeMaxDL} darker`);
  assert.equal(shadedWallMatch([91, 75, 68], model, 0.3, false), false, 'dark brown brick (#5b4b44) is not the yellow brick in shade');
  assert.equal(shadedWallMatch([106, 99, 80], model, 0.23, false), false, 'walls[1] #6a6350, greyer than shade alone makes it, still fails');
  assert.equal(shadedWallMatch([92, 92, 96], [200, 200, 205], 0.4, false), false, 'a grey wall is not judged on chromaticity');
});

test('Politie IJ-tunnel walls[1]: the pale panel band is the model\'s panel, not glazing (storey 3: 0.49 -> under 0.1)', async () => {
  const meta = JSON.parse(fs.readFileSync(fixture('likeness-ij-tunnel-walls1.json'), 'utf8'));
  const win = (await grey('likeness-ij-tunnel-walls1-photo-mask.png')), cl = await grey('likeness-ij-tunnel-walls1-photo-clusters.png'), mm = await grey('likeness-ij-tunnel-walls1-model-mask.png');
  const {data: colours} = await sharp(fs.readFileSync(fixture('likeness-ij-tunnel-walls1-model-colours.png'))).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const {width: cols, height: rows} = win, clusters = Int16Array.from(cl.data, v => v - 1);
  const photo = {clusters: meta.clusters, wallCluster: meta.wallCluster} as unknown as FacadeMeasurement;
  const model = {mask: mm.data, colours: new Uint8Array(colours)};
  const grid = (m: Uint8Array) => analyseMask({mask: m, cols, rows, cell: meta.cell, box: meta.box, lines: meta.lines});
  const before = grid(win.data).storeyGlazing[3]!;
  const mask = Uint8Array.from(win.data), n = rereadPalePanels(mask, clusters, photo, model);
  const after = grid(mask).storeyGlazing[3]!;
  assert.ok(before > 0.4 && after < 0.1, `storey 3 glazing ${before} -> ${after} (${n} cells), model ${meta.modelStoreyGlazing[3]}`);
  for (const st of [1, 2]) assert.equal(grid(mask).storeyGlazing[st], grid(win.data).storeyGlazing[st], `storey ${st} (no panels in the model) is untouched`);
  // where the model draws glass over the band, nothing is re-read: a model that glazes a panel band still fails
  const glassModel = {mask: Uint8Array.from(model.mask, m => (m === MASK.trim ? MASK.frame : m)), colours: model.colours};
  assert.equal(rereadPalePanels(Uint8Array.from(win.data), clusters, photo, glassModel), 0);
  // a dark model panel (brick-red) does not match the pale photo cluster
  const darkPanels = {mask: model.mask, colours: Uint8Array.from(model.colours, (v, i) => (model.mask[Math.floor(i / 3)] === MASK.trim ? [150, 60, 50][i % 3] : v))};
  assert.equal(rereadPalePanels(Uint8Array.from(win.data), clusters, photo, darkPanels), 0);
});

test('Utrechtsestraat 15 walls[2]: brick and a sill course between two three-light groups do not make a 10.9 m ribbon', async () => {
  const photo = await maskFixture('utrechtsestraat15-walls2-photo'), model = await maskFixture('utrechtsestraat15-walls2-model'), wl = await maskFixture('utrechtsestraat15-walls2-wall-like');
  const wallLike = Uint8Array.from(wl.mask, v => (v ? 1 : 0));
  assert.ok(widest(rowOpenings(photo), 2) >= 10, `without the colours the opening pass's mask has a ${widest(rowOpenings(photo), 2)} m ribbon`);
  const cut = rowOpenings({...photo, wallLike});
  assert.ok(widest(cut, 2) < 5, `cut where it is wall-coloured: widest ${widest(cut, 2)} m`);
  assert.equal(compareRowOpenings(cut, rowOpenings(model)).rowMismatch.length, 0);
  // the cut only touches would-be ribbons: every storey without one keeps its openings
  const plain = rowOpenings(photo);
  for (const s of [1, 3, 4]) assert.deepEqual(cut.rows.find(r => r.storey === s), plain.rows.find(r => r.storey === s), `storey ${s}`);
});

test('Stadsloket Zuidoost walls[0]: an 18 m window box is not judged against the punched windows beside it', async () => {
  const photo = rowOpenings(await maskFixture('stadsloket-zuidoost-walls0-photo')), model = rowOpenings(await maskFixture('stadsloket-zuidoost-walls0-model'));
  assert.ok(widest(model, 2) >= 18, `the model's window box ${widest(model, 2)} m`);
  const box = model.rows.find(r => r.storey === 2)!.openings.find(o => o.w >= 8)!;
  const under = photo.rows.find(r => r.storey === 2)!.openings.filter(o => Math.min(o.u1, box.u1) - Math.max(o.u0, box.u0) > 0);
  assert.ok(under.length < 2, `the photo reads the box's glass as wall: ${under.length} openings under it`);
  assert.equal(compareRowOpenings(photo, model).rowMismatch.length, 0);
});

test('Politie Postjesweg walls[1] (known wrong): a 20 m photo ribbon over the model\'s paired windows still fails', async () => {
  const photoM = await maskFixture('postjesweg-walls1-photo'), wl = await maskFixture('postjesweg-walls1-wall-like');
  const photo = rowOpenings({...photoM, wallLike: Uint8Array.from(wl.mask, v => (v ? 1 : 0))}), model = rowOpenings(await maskFixture('postjesweg-walls1-model'));
  const c = compareRowOpenings(photo, model);
  assert.deepEqual(c.rowMismatch.map(r => r.storey), [2], JSON.stringify(c.rowMismatch));
  assert.ok(c.rowMismatch[0].photoMaxM >= 15, `photo ribbon ${c.rowMismatch[0].photoMaxM} m`);
});

test('rowOpenings wallLike: a glass ribbon is not cut by its mullions and still fails against windows under it', () => {
  const cell = 0.1, lines = [0, 4, 7.4, 10.8], box: FacadeBox = {u0: 0, u1: 30, v0: 0, v1: 10.8}, cols = 300, rows = 108;
  const mask = new Uint8Array(cols * rows).fill(MASK.wall), wallLike = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const v = box.v1 - (j + 0.5) * cell, u = (i + 0.5) * cell, k = j * cols + i;
    // storey 2: a 20 m ribbon with 0.1 m mullions every 1.5 m (mullions read in the wall's colour)
    if (v > 8.2 && v < 9.6 && u > 2 && u < 22) { mask[k] = MASK.dark; if (u % 1.5 < 0.1) wallLike[k] = 1; }
    if (v > 4.8 && v < 6.4 && u % 2.5 > 0.4 && u % 2.5 < 1.4) mask[k] = MASK.dark;
  }
  const s = rowOpenings({mask, cols, rows, cell, box, lines, wallLike});
  assert.ok(widest(s, 2) >= 19, `mullions under 0.3 m do not cut the ribbon: ${widest(s, 2)}`);
  // the model's windows under the ribbon are a mismatch, whatever stands elsewhere in the storey
  const windows = new Uint8Array(mask);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const v = box.v1 - (j + 0.5) * cell, u = (i + 0.5) * cell, k = j * cols + i; if (v > 7.4) windows[k] = v > 8.2 && v < 9.6 && u % 2.5 > 0.4 && u % 2.5 < 1.4 ? MASK.dark : MASK.wall; }
  assert.deepEqual(compareRowOpenings(s, rowOpenings({mask: windows, cols, rows, cell, box, lines})).rowMismatch.map(r => r.storey), [2]);
});
