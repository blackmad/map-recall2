/**
 * Curtain-wall symmetry in the likeness judge (GitHub #114, likeness.ts header). The model's curtain grid is read as the
 * photo reads a curtain front: its wall is the spandrels or the grid, grid cells split wall / trim / glazing like the
 * photo's not-wall cells, and the mask goes through the photo's 3x3 majority clean-up. Fixtures under ./fixtures come
 * from the 2016-2025 Amsterdam panoramas (CC BY 4.0): the photo mosaic (jpg, metric), its validity, the model elevation's
 * mask (MASK values as grey), its game colours and its curtain reading, on 10 cm cells.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {analyseMask, MASK, majorityClean, measureFacade, type FacadeBox, type Rgb} from './measureFacade.ts';
import {compareLikeness, curtainReading, LIKENESS, PAD_M, type ModelElevation} from './likeness.ts';
import {insidePanel} from '../blockBuilding/panels.ts';

const fixture = (f: string) => new URL(`./fixtures/${f}`, import.meta.url);
const raw = async (f: string, ch: 1 | 3) => { const s = sharp(fs.readFileSync(fixture(f))); const {data} = await (ch === 1 ? s.extractChannel(0) : s.removeAlpha()).raw().toBuffer({resolveWithObject: true}); return new Uint8Array(data); };

/** A fixture group judged with this checkout's code; `curtain: false` drops the model's curtain reading (the judge before #114). */
async function judge(name: string, curtain = true) {
  const meta = JSON.parse(fs.readFileSync(fixture(`likeness-curtain-${name}.json`), 'utf8'));
  const rgb = await raw(`likeness-curtain-${name}.jpg`, 3), valid = await raw(`likeness-curtain-${name}-valid.png`, 1);
  const photo = measureFacade({image: {...meta.image, rgb, valid}, box: meta.photoBox as FacadeBox, lines: meta.lines,
    inside: (u, v) => insidePanel({polys: meta.polys} as Parameters<typeof insidePanel>[0], [u + meta.panelU0, v])});
  const {curtain: cm, ...rest} = meta.model, at = {cols: rest.cols, rows: rest.rows, cell: rest.cell, box: rest.box, lines: meta.lines};
  const mask = await raw(`likeness-curtain-${name}-model.png`, 1), colours = await raw(`likeness-curtain-${name}-model-colours.png`, 3);
  const cmask = cm && curtain ? await raw(`likeness-curtain-${name}-curtain.png`, 1) : null;
  const model: ModelElevation = {...rest, ...(curtain ? {} : {system: undefined}), mask, colours, grid: analyseMask({mask, ...at}),
    ...(cm && cmask ? {curtain: {...cm, mask: cmask, grid: analyseMask({mask: cmask, ...at})}} : {})};
  return {meta, photo, L: compareLikeness({photo, padCells: Math.round(PAD_M / photo.cell), model, lines: meta.lines, obliquityDeg: meta.obliquityDeg, cameraDistM: meta.cameraDistM, cameraSpanM: meta.cameraSpanM})};
}

test('the bar is unchanged: LIKENESS constants as before #114', () => {
  assert.deepEqual({dL: LIKENESS.dL, storeyGlazing: LIKENESS.storeyGlazing, meanGlazing: LIKENESS.meanGlazing, columns: LIKENESS.columns, iouWarn: LIKENESS.iouWarn},
    {dL: 0.12, storeyGlazing: 0.15, meanGlazing: 0.1, columns: 0.2, iouWarn: 0.45});
});

// synthetic front, 10 cm cells: glass with mullions one cell (x 10, 30) and two cells (x 20-21) wide, a floor band (rows 20-24) of the grid
function front(opts: {spandrel?: boolean}) {
  const cols = 40, rows = 60, matAt = new Int32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i;
    matAt[k] = j >= 20 && j < 25 ? (opts.spandrel ? 2 : 1) : i === 10 || i === 30 || i === 20 || i === 21 ? 1 : 0;
  }
  const slotOf = ['glass', 'frame', 'stone'], colourOf: Rgb[] = [[88, 106, 117], [200, 198, 190], [120, 120, 118]];
  return {matAt, cols, rows, cell: 0.1, box: {u0: 0, u1: 4, v0: 0, v1: 6}, lines: [0, 3, 6], slotOf, colourOf, todayOf: colourOf};
}

test('curtainReading: the grid is the wall without spandrels; one-cell mullions vanish as in the photo, two-cell ones stay', () => {
  const f = front({}), c = curtainReading({...f, wallMat: -1, system: 'curtain-wall'})!;
  assert.ok(c, 'a curtain-wall group drawing a grid has a curtain reading');
  assert.deepEqual(c.wall, f.colourOf[1]);
  assert.equal(c.wallSlot, 'frame');
  const at = (i: number, j: number) => c.mask[j * f.cols + i];
  assert.equal(at(10, 5), MASK.dark, 'a one-cell mullion is cleaned away (glazing), like a thin frame line in the photo');
  assert.equal(at(20, 5), MASK.wall); assert.equal(at(21, 5), MASK.wall);
  assert.equal(at(5, 22), MASK.wall, 'the floor band is wall');
  // the same clean-up the photo pass uses
  assert.deepEqual(c.mask, majorityClean(Uint8Array.from(f.matAt, (m: number) => (m === 1 ? MASK.wall : MASK.dark)), f.cols, f.rows));
  assert.ok(c.grid.glazing < 1 && c.grid.glazing > 0.8, `glazing ${c.grid.glazing}`);
});

test('curtainReading: spandrels are the wall; a lighter grid is trim, not glazing', () => {
  const f = front({spandrel: true}), c = curtainReading({...f, wallMat: 2, system: 'curtain-wall'})!;
  assert.deepEqual(c.wall, f.colourOf[2]);
  assert.equal(c.mask[5 * f.cols + 20], MASK.trim);
  assert.equal(c.mask[22 * f.cols + 5], MASK.wall);
});

test('curtainReading: none for a brick group with a wall material, or a front without a frame material', () => {
  const f = front({spandrel: true});
  assert.equal(curtainReading({...f, wallMat: 2, system: 'brick-bay-grid'}), null);
  assert.equal(curtainReading({...f, wallMat: 2}), null);
  assert.equal(curtainReading({...f, matAt: new Int32Array(f.cols * f.rows), wallMat: -1, system: 'curtain-wall'}), null);
});

test('NFTA Markenplein walls[4]: the curtain wall is judged on its grid, not "wall not drawn", and still fails: the model lacks the concrete piers', async () => {
  const before = (await judge('nfta-walls4', false)).L, {L} = await judge('nfta-walls4');
  assert.ok(before.reasons.some(r => r.startsWith('wall not drawn')), before.reasons.join('; '));
  assert.ok(!L.reasons.some(r => r.startsWith('wall not drawn')), L.reasons.join('; '));
  assert.equal(L.wall.model, '#bdbab2', 'the grid colour is the model wall');
  assert.ok(L.modelReading?.startsWith('curtain grid'));
  assert.equal(L.verdict, 'FAIL');
  assert.ok(L.glazing.modelMean > 0.9 && L.glazing.photoMean < 0.45, `glazing ${L.glazing.modelMean} vs photo ${L.glazing.photoMean}`);
});

test('Politie Nieuwezijds Voorburgwal walls[2] (installed, inferred): photo and model are both read as curtain fronts', async () => {
  const before = (await judge('politie-nzv-walls2', false)).L, {L} = await judge('politie-nzv-walls2');
  assert.equal(L.classes.photo, 'curtain');
  assert.ok(L.modelReading);
  assert.ok(L.glazing.modelMean < before.glazing.modelMean, `the grid's floor lines are wall: ${before.glazing.modelMean} -> ${L.glazing.modelMean}`);
  // the white model wall against the dark photo grid remains the miss
  assert.equal(L.verdict, 'FAIL');
  assert.ok(L.reasons.some(r => r.startsWith('wall dL')), L.reasons.join('; '));
});

test('Het Nieuwe Huis walls[0] (brick): no curtain reading, the verdict and reasons are as before', async () => {
  const {meta, L} = await judge('brick-hnh-walls0');
  assert.equal(meta.model.curtain, null);
  assert.equal(L.modelReading, undefined);
  assert.equal(L.verdict, meta.verdict);
  assert.deepEqual(L.reasons, meta.reasons);
});
