/**
 * Likeness gate regressions for GitHub #58 (Stadsloket Zuidoost): a mixed-width window row judged as one typical
 * window, and crops placed on an assumed 0.4 m NAP street. Mask fixtures (`likeness-<name>-mask.png`, MASK values as
 * grey on 10 cm cells, the photo's at the likeness shift) come from the 2025-09-01 panorama w01-331 (CC BY 4.0).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {analyseMask, MASK, type FacadeBox} from './measureFacade.ts';
import {compareRowOpenings, ROW_OPENINGS, rowOpenings} from './rowOpenings.ts';
import {CAMERA_ABOVE_TERRAIN_M, cropsOfWallsJson, cropStreetShiftM} from './cropToPanel.ts';

const fixture = (f: string) => new URL(`./fixtures/${f}`, import.meta.url);
async function maskFixture(name: string) {
  const meta = JSON.parse(fs.readFileSync(fixture(`likeness-${name}-mask.json`), 'utf8')) as {cell: number; box: FacadeBox; lines: number[]};
  const {data, info} = await sharp(fs.readFileSync(fixture(`likeness-${name}-mask.png`))).extractChannel(0).raw().toBuffer({resolveWithObject: true});
  return {mask: new Uint8Array(data), cols: info.width, rows: info.height, cell: meta.cell, box: meta.box, lines: meta.lines};
}

/** A 30 m front, storeys 3.4 m over a 4 m ground storey; per bay of `pitch` m the openings [u0, u1, sill, head] in bay metres. */
function front(windows: [number, number, number, number][], pitch: number, storeys = 4) {
  const cell = 0.1, lines = [0, 4, ...Array.from({length: storeys - 1}, (_, s) => 4 + 3.4 * (s + 1))];
  const box: FacadeBox = {u0: 0, u1: 30, v0: 0, v1: lines[lines.length - 1]}, cols = 300, rows = Math.round(box.v1 / cell);
  const mask = new Uint8Array(cols * rows).fill(MASK.wall);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const v = box.v1 - (j + 0.5) * cell, u = (i + 0.5) * cell, s = lines.findIndex((l, k) => v >= l && v < (lines[k + 1] ?? Infinity));
    if (s < 1) continue;
    const dv = v - lines[s], du = u % pitch;
    if (windows.some(([a, b, sill, head]) => du >= a && du < b && dv >= sill && dv < head)) mask[j * cols + i] = MASK.dark;
  }
  return {mask, cols, rows, cell, box, lines};
}
// Stadsloket's rhythm: per 4.5 m one 2.4 m four-light window and two 0.5 m slots, all 1.6 m high
const mixed = front([[0.3, 2.7, 0.8, 2.4], [3.1, 3.6, 0.8, 2.4], [3.8, 4.3, 0.8, 2.4]], 4.5);

test('rowOpenings: a mixed row keeps its wide window and its two slots per bay', () => {
  const s = rowOpenings(mixed);
  assert.equal(s.rows.length, 3);
  assert.equal(s.count, 19, 'per storey: 6 bays of 3 openings and the wide window of the seventh');
  assert.ok(s.mix.tall > 0.55 && s.mix.wide > 0.25, JSON.stringify(s.mix));
  assert.equal(s.widthP90, 2.4);
  assert.equal(s.widthP50, 0.5);
});

test('compareRowOpenings: the same mixed row passes; a uniform row of either kind, or the wrong count, fails', () => {
  const photo = rowOpenings(mixed);
  const same = compareRowOpenings(photo, rowOpenings(front([[0.3, 2.7, 0.8, 2.4], [3.1, 3.6, 0.7, 2.4], [3.8, 4.3, 0.8, 2.4]], 4.5)));
  assert.deepEqual([same.countPass, same.mixPass, same.widthPass], [true, true, true], JSON.stringify(same));
  // what the old fold produced for the model: one 1.4 m window per 1.5 m pitch (all wide-ish squares)
  const uniformWide = compareRowOpenings(photo, rowOpenings(front([[0.1, 1.4, 0.8, 2.4]], 1.5)));
  assert.equal(uniformWide.mixPass, false, JSON.stringify(uniformWide));
  // six uniform square rows of tall slots: the wide windows are missing
  const slotsOnly = compareRowOpenings(photo, rowOpenings(front([[0.3, 0.8, 0.8, 2.4]], 1.5)));
  assert.equal(slotsOnly.widthPass, false, JSON.stringify(slotsOnly));
  const halfCount = compareRowOpenings(photo, rowOpenings(front([[0.3, 2.7, 0.8, 2.4], [3.4, 3.9, 0.8, 2.4]], 4.5)));
  assert.equal(halfCount.countPass, false, JSON.stringify(halfCount));
});

test('compareRowOpenings: a uniform front of the wrong window shape still fails (the gate is not looser)', () => {
  const tall = rowOpenings(front([[0.4, 1.2, 0.6, 2.8]], 1.6)), square = rowOpenings(front([[0.3, 1.5, 0.8, 2.0]], 1.6));
  const c = compareRowOpenings(tall, square);
  assert.equal(c.mixPass, false, JSON.stringify(c));
  assert.equal(compareRowOpenings(tall, tall).mixPass, true);
});

test('compareRowOpenings: a ribbon storey against a row of windows is a row mismatch, either way round', () => {
  // Politie Postjesweg walls[1]: a 20 m ribbon window on the top storey over a row of slots; the model draws windows on both
  const ribbonTop = (() => { const f = front([[0.3, 0.9, 0.8, 2.4]], 1.5, 3); for (let j = 0; j < f.rows; j++) for (let i = 10; i < 290; i++) { const v = f.box.v1 - (j + 0.5) * f.cell; if (v > 8.2 && v < 9.6) f.mask[j * f.cols + i] = MASK.dark; } return f; })();
  const windows = front([[0.3, 1.6, 0.8, 2.4]], 2.5, 3);
  const c = compareRowOpenings(rowOpenings(ribbonTop), rowOpenings(windows));
  assert.deepEqual(c.rowMismatch.map(r => r.storey), [2], JSON.stringify(c.rowMismatch));
  assert.equal(compareRowOpenings(rowOpenings(windows), rowOpenings(ribbonTop)).rowMismatch.length, 1, 'a modelled ribbon where the photo has windows');
  assert.equal(compareRowOpenings(rowOpenings(ribbonTop), rowOpenings(ribbonTop)).rowMismatch.length, 0);
  assert.equal(compareRowOpenings(rowOpenings(mixed), rowOpenings(mixed)).rowMismatch.length, 0, '2.4 m windows are not ribbons');
  // Spinoza Lyceum walls[0]: 2.6 m windows between 0.3 m piers are a ribbon in all but name; a photo ribbon read over them is no mismatch
  const thinPiers = front([[0, 2.6, 0.8, 2.4]], 2.9, 3);
  assert.equal(compareRowOpenings(rowOpenings(ribbonTop), rowOpenings(thinPiers)).rowMismatch.length, 0, JSON.stringify(rowOpenings(thinPiers).rows.map(r => r.cover)));
});

test('Stadsloket Zuidoost walls[2]: the model reads like the photo opening for opening (photo 16 columns vs model 4 before)', async () => {
  const photo = rowOpenings(await maskFixture('stadsloket-zuidoost-walls2-photo')), model = rowOpenings(await maskFixture('stadsloket-zuidoost-walls2-model'));
  const c = compareRowOpenings(photo, model);
  assert.ok(photo.measured >= 20, `photo openings ${photo.measured}`);
  assert.deepEqual([c.countPass, c.mixPass, c.widthPass], [true, true, true], JSON.stringify(c));
  assert.ok(Math.max(...Object.values(photo.mix)) < ROW_OPENINGS.uniformShare, `a mixed row ${JSON.stringify(photo.mix)}`);
  // what the fold makes of the same masks: one typical window of another shape, and 16 columns against 4
  const pf = await maskFixture('stadsloket-zuidoost-walls2-photo'), mf = await maskFixture('stadsloket-zuidoost-walls2-model');
  const pg = analyseMask(pf), mg = analyseMask(mf);
  assert.notEqual(pg.window?.shape, mg.window?.shape, 'the fold misreads the mixed row');
  // the previous uniform model (one square window per bay, GitHub #56) does not match the photo's sequence
  const uniform = new Uint8Array(mf.mask);
  for (let j = 0; j < mf.rows; j++) for (let i = 0; i < mf.cols; i++) {
    const k = j * mf.cols + i; if (uniform[k] === MASK.dark || uniform[k] === MASK.frame) uniform[k] = MASK.wall;
    const v = mf.box.v1 - (j + 0.5) * mf.cell, u = (i + 0.5) * mf.cell;
    if (v > 7 && (v - 7) % 3.4 > 0.9 && (v - 7) % 3.4 < 2.2 && u % 2.4 > 0.6 && u % 2.4 < 1.9) uniform[k] = MASK.dark;
  }
  const u = compareRowOpenings(photo, rowOpenings({...mf, mask: uniform}));
  assert.ok(!(u.countPass && u.mixPass && u.widthPass), JSON.stringify(u));
});

test('cropStreetShiftM: an assumed 0.4 m NAP street is replaced by the terrain under the camera; a published height is kept', () => {
  // walls.json rows of Stadsloket Zuidoost (pand 0363100012078772): w03-241 faces the south-west plaza (AHN -2.74 m),
  // w01-331 the north-west deck (AHN +1.63 m), w01-331L carries a published camera height
  const walls = JSON.parse(fs.readFileSync(fixture('walls-stadsloket-zuidoost.json'), 'utf8'));
  const crops = cropsOfWallsJson(walls), byTag = new Map(crops.map(c => [c.tag, c]));
  const terrain = (x: number, y: number) => (y < 481040 ? -2.74 : 1.63);
  const sw = cropStreetShiftM(byTag.get('w03-241')!, terrain), nw = cropStreetShiftM(byTag.get('w01-331')!, terrain);
  assert.equal(byTag.get('w03-241')!.groundSource, 'published height implausible; assumed ground 0.4 m NAP');
  assert.ok(Math.abs(sw - (-2.74 + CAMERA_ABOVE_TERRAIN_M - 2.84)) < 1e-6, `south-west street ${sw}`);
  assert.ok(sw < -3.5, 'the plaza is 4 m below the assumed street: the photo moves down the panel');
  assert.ok(Math.abs(nw - (1.63 + CAMERA_ABOVE_TERRAIN_M - 2.84)) < 1e-6, `north-west deck ${nw}`);
  assert.equal(cropStreetShiftM(byTag.get('w01-331L')!, terrain), 0, 'published camera height kept');
  assert.equal(cropStreetShiftM(byTag.get('w03-241')!, () => NaN), 0, 'no terrain: unchanged');
  assert.equal(cropStreetShiftM(byTag.get('w03-241')!, null), 0, 'no terrain field: unchanged');
});
