// The window table against the painter (lane R2-A #228): for every bay layer of the photo look, paint the cell as the
// atlas does (bayTextures at 520 x 310/340, drawn into a 256 px square), find its glass texels (the glazing gradient
// is the only blue-over-red paint in a bay cell) and check that every table window's pane is where the glass is,
// edge for edge within one texel, and that no glass is left unclaimed outside the named exceptions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { BAY_ENTRIES, bayVariant } from '../bayLook.js';
import { bayTextures, releaseBayTextures, SHOP_KINDS } from '../bayTextures.js';
import { BAY_PX } from '../bayTextures.js';
import { MUNTIN, WINDOW_TABLE_MAX, WINDOW_TABLE_WIDTH, calmInk, canvasWindows, lookWindowLayers, windowTableData } from './windowTable.js';
import { lookAtlasLayers } from './paintLookAtlas.js';
import { SDF_BAY_PX } from './windowSdf.js';

test('the shader cell width is the painter\'s', () => assert.equal(SDF_BAY_PX, BAY_PX));

const SIZE = 256;

function withCanvasDocument<T>(fn: () => T): T {
  const g = globalThis as any, previous = g.document;
  g.document = { createElement: (tag: string) => { if (tag !== 'canvas') throw new Error(tag); return createCanvas(1, 1); } };
  try { return fn(); } finally { if (previous === undefined) delete g.document; else g.document = previous; }
}

/** The cell as the atlas holds it: the colour canvas drawn into SIZE², read top-down. */
function paintedCell(entry: (typeof BAY_ENTRIES)[number]): Uint8ClampedArray {
  return withCanvasDocument(() => {
    const painted = bayTextures(bayVariant(entry), createCanvas(1, 1) as any, 'photo');
    const scratch = createCanvas(SIZE, SIZE), ctx = scratch.getContext('2d');
    ctx.drawImage(painted.colour as any, 0, 0, SIZE, SIZE);
    return ctx.getImageData(0, 0, SIZE, SIZE).data;
  });
}
const isGlass = (px: Uint8ClampedArray, x: number, y: number) => { const o = (y * SIZE + x) * 4; return px[o + 3] > 128 && px[o + 2] - px[o] > 12; };

test('every photo bay layer with windows: the table panes are the painted glass, within one texel', () => {
  const rows = lookWindowLayers('photo');
  let checked = 0;
  const unclaimedByLayer: Record<number, number> = {};
  for (const entry of BAY_ENTRIES) {
    const row = rows[entry.layer];
    if (!row.windows.length) continue;
    const px = paintedCell(entry), sx = SIZE / BAY_PX, sy = SIZE / row.cellH;
    const claimed = new Uint8Array(SIZE * SIZE);
    for (const w of row.windows) {
      // The pane in texels (top-down), and the glass texels inside the opening (outer rect + 2 texels).
      const pane = { x0: (w.x + w.inset) * sx, x1: (w.x + w.w - w.inset) * sx, y0: (w.y + (w.insetY ?? w.inset)) * sy, y1: (w.y + w.h - (w.insetY ?? w.inset)) * sy };
      let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
      for (let y = Math.max(0, Math.floor(w.y * sy) - 2); y < Math.min(SIZE, Math.ceil((w.y + w.h) * sy) + 2); y++)
        for (let x = Math.max(0, Math.floor(w.x * sx) - 2); x < Math.min(SIZE, Math.ceil((w.x + w.w) * sx) + 2); x++) {
          if (!isGlass(px, x, y)) continue;
          claimed[y * SIZE + x] = 1;
          bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x + 1); by0 = Math.min(by0, y); by1 = Math.max(by1, y + 1);
        }
      const where = `layer ${entry.layer} ${entry.archetype}/${entry.style}/${entry.kind} window at x ${w.x.toFixed(0)}`;
      assert.ok(Number.isFinite(bx0), `${where}: no glass painted`);
      for (const [edge, table, painted] of [['left', pane.x0, bx0], ['right', pane.x1, bx1], ['top', pane.y0, by0], ['bottom', pane.y1, by1]] as const)
        assert.ok(Math.abs(table - painted) <= 1, `${where}: ${edge} edge table ${table.toFixed(2)} vs painted ${painted} texels`);
      checked++;
    }
    let unclaimed = 0;
    for (let i = 0; i < SIZE * SIZE; i++) if (!claimed[i] && isGlass(px, i % SIZE, Math.floor(i / SIZE))) unclaimed++;
    if (unclaimed) unclaimedByLayer[entry.layer] = unclaimed;
  }
  releaseBayTextures();
  assert.ok(checked > 150, `windows checked: ${checked}`);
  // Glass the table leaves to the painted cell: the side-entry door's fanlight glazing (its leaf is painted over the
  // lower half) and the raised-plain basement lights. Nothing else.
  for (const [layer, n] of Object.entries(unclaimedByLayer)) {
    const e = BAY_ENTRIES[Number(layer)], v = bayVariant(e);
    const allowed = (v.groundAssembly === 'tall-side-entry' && e.kind === 'ground') || (v.entranceAssembly === 'raised-plain' && e.kind === 'ground');
    assert.ok(allowed, `layer ${layer} ${e.archetype}/${e.style}/${e.kind}: ${n} glass texels no table window claims`);
  }
});

test('door, shop, plain and masonry cells carry no analytic windows; upper cells do', () => {
  const rows = lookWindowLayers('photo');
  for (const entry of BAY_ENTRIES) {
    const row = rows[entry.layer];
    if (entry.originalMasonry || entry.kind === 'plain' || entry.kind === 'groundDoor' || (SHOP_KINDS as readonly string[]).includes(entry.kind)) assert.equal(row.windows.length, 0, `layer ${entry.layer} ${entry.kind}`);
    else if (entry.kind === 'upper') assert.ok(row.windows.length > 0, `layer ${entry.layer} upper has windows`);
  }
  // Roofs and the glass-block cell are not bay cells.
  const { layers } = lookAtlasLayers('photo', false);
  for (let layer = BAY_ENTRIES.length; layer < layers; layer++) assert.equal(rows[layer].windows.length, 0);
});

test('the drawn looks get no table (their frames are outlined); procedural shifts the bay layers', () => {
  assert.equal(windowTableData('cartoon').windows, 0);
  assert.equal(windowTableData('storybook').windows, 0);
  const photo = windowTableData('photo'), proc = windowTableData('procedural');
  assert.equal(photo.windows, proc.windows);
  assert.ok(proc.height > photo.height);
});

test('packing: header count, rects in uv (y up), shape/muntin codes, under 64 KB', () => {
  const t = windowTableData('photo');
  assert.equal(t.width, WINDOW_TABLE_WIDTH);
  assert.ok(t.data.byteLength < 64 * 1024, `${t.data.byteLength} bytes`);
  const rows = lookWindowLayers('photo');
  for (const row of rows) {
    const base = row.layer * WINDOW_TABLE_WIDTH * 4;
    assert.equal(t.data[base], row.windows.length);
    row.windows.forEach((w, i) => {
      const o = base + (1 + 4 * i) * 4, [x0, x1, y0, y1] = t.data.subarray(o, o + 4);
      assert.ok(x0 >= -1e-6 && x1 <= 1 + 1e-6 && x0 < x1 && y0 < y1 && y0 >= -1e-6 && y1 <= 1 + 1e-6, `layer ${row.layer} rect ${[x0, x1, y0, y1]}`);
      assert.ok(Math.abs(y1 - (1 - w.y / row.cellH)) < 1e-6);
      assert.ok(Object.values(MUNTIN).includes(t.data[o + 5] as 0));
    });
    assert.ok(row.windows.length <= WINDOW_TABLE_MAX);
  }
});

test('calm lift matches the atlas pass: dark ink lifts, pale stays', () => {
  assert.deepEqual(calmInk([241, 237, 226], 0.5), [241, 237, 226]);
  const lifted = calmInk([44, 48, 47], 0.5);
  assert.ok(lifted[0] > 44 && lifted[0] < 150);
});

test('the 1962-type modern punched cells: rect windows with the cross muntin', () => {
  const modern = BAY_ENTRIES.find(e => e.archetype === 'modern' && e.kind === 'upper' && bayVariant(e).family === 'punched' && !bayVariant(e).sash)!;
  const w = canvasWindows(bayVariant(modern)).windows;
  assert.ok(w.length >= 1);
  assert.equal(w[0].muntin, MUNTIN.cross);
});
