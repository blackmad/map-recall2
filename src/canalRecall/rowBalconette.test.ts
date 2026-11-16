// #393 (De Pijp): the row-balconette wall component, French balconies stated per front span. A wall that states none
// draws nothing; `centre` draws one railing per storey, `all` one per window.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExtraContext } from './facadeExtras.js';
import { ORNAMENT_COMPONENTS } from './facadeOrnaments.js';
import { ExtraSink } from './facadeExtraCore.js';

const wall = (balconettes?: Array<{ x0: number; x1: number; storeys: number[]; axis: 'centre' | 'all' }>): ExtraContext => ({
  id: 'p1', style: 'c19', period: 'c19', wallKey: 'front',
  f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 6 }, base: 0, top: 13,
  layout: { bays: 3, bayWidthM: 2, groundM: 3.2, storeys: 3, storeyM: 3, doorBays: [] },
  wallHex: '#6b4a3c', accentHex: '#ffffff', groundLevel: true, streetSide: true,
  openings: { upper: { axes: [0.5], width: 0.5, sill: 0.25, head: 0.85 }, ground: null, doorWindow: null, door: null },
  rowDress: { windows: [0, 1, 2].flatMap(k => [{ x0: 0.6, x1: 1.4 }, { x0: 2.6, x1: 3.4 }, { x0: 4.6, x1: 5.4 }].map(w => ({ ...w, z0: 4 + 3 * k, z1: 5.8 + 3 * k, storey: k + 1 }))), ...(balconettes ? { balconettes } : {}) },
} as unknown as ExtraContext);
const run = (c: ExtraContext) => { const s = new ExtraSink(1e6); ORNAMENT_COMPONENTS.find(x => x.id === 'row-balconette')!.build(c, s, 0); return s.tris.length; };

test('row-balconette: none stated draws nothing; centre draws one per storey, all one per window', () => {
  assert.equal(run(wall()), 0);
  const one = run(wall([{ x0: 0, x1: 6, storeys: [1], axis: 'centre' }]));
  assert.ok(one > 0);
  assert.equal(run(wall([{ x0: 0, x1: 6, storeys: [1, 2], axis: 'centre' }])), 2 * one);
  assert.equal(run(wall([{ x0: 0, x1: 6, storeys: [1], axis: 'all' }])), 3 * one);
  assert.equal(run(wall([{ x0: 0, x1: 2, storeys: [1], axis: 'all' }])), one, 'only the windows inside the span');
  assert.equal(run(wall([{ x0: 0, x1: 6, storeys: [5], axis: 'all' }])), 0, 'a storey the wall does not have');
});
