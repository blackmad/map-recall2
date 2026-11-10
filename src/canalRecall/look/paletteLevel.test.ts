// node --import tsx --test src/canalRecall/look/paletteLevel.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PALETTE_LEVEL, PALETTE_LEVEL_OFF, applyTransfer, deltaE76, fitTransfer, levelRgb, levelWallHex, paletteLevelEnabled } from './paletteLevel.ts';
import { RENDER_TRANSFER_ROWS } from './paletteLevelTransfer.ts';
import { hexToRgb } from './palette.ts';
import { rgbToLab } from './brickTone.ts';

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
const lchOf = (rgb: readonly number[]) => { const [L, a, b] = rgbToLab(rgb); return { L, C: Math.hypot(a, b) }; };
// The buurt profiles' wall swatches, weighted by the fronts each stands for (scripts/look/palette-level-table.ts reads them the same way).
const profiles = JSON.parse(readFileSync(new URL('../buurtProfiles/buurt-profiles.json', import.meta.url), 'utf8')).profiles as any[];
const walls = profiles.flatMap(p => Object.values<any>(p.eras).flatMap(e => ((e.walls ?? []) as [string, number][]).flatMap(([hex, w]) => Array<string>(w).fill(hex))));

test('?paletteLevel=0 is the before: on by default, off with the flag', () => {
  assert.equal(paletteLevelEnabled(''), false);
  assert.equal(paletteLevelEnabled('?a=1&paletteLevel=0'), false);
  assert.equal(paletteLevelEnabled('?paletteLevel=1'), true);
});

test('the off level is the identity, byte for byte', () => {
  for (const hex of ['#40261f', '#b05a40', '#efe7e0', '#6f6f6f']) assert.equal(levelWallHex(hex, PALETTE_LEVEL_OFF), hex);
});

test('the level shifts L* and scales C*, hue kept', () => {
  const before = lchOf(hexToRgb('#b05a40')), after = lchOf(levelRgb(hexToRgb('#b05a40'), { dL: 4, chroma: 0.8 }));
  assert.ok(Math.abs(after.L - before.L - 4) < 0.6);
  assert.ok(Math.abs(after.C / before.C - 0.8) < 0.03);
});

test('the browser-measured sun-side transfer: per-channel fit within 3 dE (CIE76) of every measured tint frame', () => {
  const fit = fitTransfer(RENDER_TRANSFER_ROWS);
  assert.ok(fit.error < 3, `mean dE ${fit.error}`);
  for (const [hex, row] of Object.entries(RENDER_TRANSFER_ROWS)) if (hex !== '#000000' && hex !== '#ffffff' && row.sun.every(v => v < 250)) assert.ok(deltaE76(applyTransfer(fit, hex, 'sun'), row.sun) < 3, hex);
});

test('the level moves the rendered-minus-measured medians (sun side, all fronts) to zero', () => {
  const fit = fitTransfer(RENDER_TRANSFER_ROWS);
  const deltas = (level: typeof PALETTE_LEVEL) => {
    const dL: number[] = [], dC: number[] = [];
    for (const hex of walls) { const m = lchOf(hexToRgb(hex)), r = lchOf(applyTransfer(fit, levelWallHex(hex, level), 'sun')); dL.push(r.L - m.L); dC.push(r.C - m.C); }
    return { dL: median(dL), dC: median(dC) };
  };
  const off = deltas(PALETTE_LEVEL_OFF), on = deltas(PALETTE_LEVEL);
  assert.ok(Math.abs(off.dL) > 0.5 && Math.abs(off.dC) > 1, `before: ${JSON.stringify(off)}`);
  assert.ok(Math.abs(on.dL) < 0.25 && Math.abs(on.dC) < 0.25, `after: ${JSON.stringify(on)}`);
});

test('no levelled swatch leaves the real range (L* 5..97)', () => {
  for (const hex of walls) { const L = lchOf(levelRgb(hexToRgb(hex), PALETTE_LEVEL)).L; assert.ok(L > 5 && L < 97, hex); }
});
