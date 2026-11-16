// House rows lane R round 23: the row-heads wall component with the De Pijp heads list's new dressings. A wall that
// states none of them draws exactly what it drew before.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { ExtraContext } from './facadeExtras.js';
import { ORNAMENT_COMPONENTS, ROW_DRESS, shadeHex, WHITE } from './facadeOrnaments.js';
import { ExtraSink } from './facadeExtraCore.js';

const wall = (dressing: string, shape = 'flat'): ExtraContext => ({
  id: 'p1', style: 'c19', period: 'c19', wallKey: 'front',
  f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 6 }, base: 0, top: 13,
  layout: { bays: 3, bayWidthM: 2, groundM: 3.2, storeys: 3, storeyM: 3, doorBays: [] },
  wallHex: '#6b4a3c', accentHex: '#ffffff', groundLevel: true, streetSide: true,
  openings: { upper: { axes: [0.5], width: 0.5, sill: 0.25, head: 0.85 }, ground: null, doorWindow: null, door: null },
  rowDress: { windows: [0, 1, 2].flatMap(k => [{ x0: 0.6, x1: 1.4 }, { x0: 2.6, x1: 3.4 }, { x0: 4.6, x1: 5.4 }].map(w => ({ ...w, z0: 4 + 3 * k, z1: 5.8 + 3 * k, storey: k + 1, shape, dressing }))) },
} as unknown as ExtraContext);
const run = (c: ExtraContext) => { const s = new ExtraSink(1e6); ORNAMENT_COMPONENTS.find(x => x.id === 'row-heads')!.build(c, s, 0); return s.tris; };

// Digests of every existing dressing x shape on this wall, taken with the code before round 23 (3eb01f354).
const BEFORE: Record<string, string> = {
  'none/flat': '97d170e1550e',
  'none/segmental': 'd189875f05b0',
  'none/round': '28cba1faa79a',
  'none/relieving': '97d170e1550e',
  'block-course/flat': 'e2ff8a5cb988',
  'block-course/segmental': 'e2ff8a5cb988',
  'block-course/round': 'e2ff8a5cb988',
  'block-course/relieving': 'e2ff8a5cb988',
  'keystone/flat': 'c9eb01edf859',
  'keystone/segmental': '56b48daf98c8',
  'keystone/round': 'fc7b1a5ba569',
  'keystone/relieving': 'c9eb01edf859',
  'segmental-tympanum/flat': '05a5719411a9',
  'segmental-tympanum/segmental': '05a5719411a9',
  'segmental-tympanum/round': '05a5719411a9',
  'segmental-tympanum/relieving': '05a5719411a9',
  'dentil-lintel/flat': '8e4b5e661b1e',
  'dentil-lintel/segmental': '8e4b5e661b1e',
  'dentil-lintel/round': '8e4b5e661b1e',
  'dentil-lintel/relieving': '8e4b5e661b1e',
  'jack-blocks/flat': 'a81c903392ad',
  'jack-blocks/segmental': 'fa4a2d9a5b85',
  'jack-blocks/round': '32524cb9f955',
  'jack-blocks/relieving': 'a81c903392ad',
  'stone-lintel/flat': '8e4b5e661b1e',
  'stone-lintel/segmental': '8e4b5e661b1e',
  'stone-lintel/round': '8e4b5e661b1e',
  'stone-lintel/relieving': '8e4b5e661b1e',
  'arch-ring/flat': '3117a6c0f223',
  'arch-ring/segmental': '3117a6c0f223',
  'arch-ring/round': '3117a6c0f223',
  'arch-ring/relieving': '3117a6c0f223',
  'block-surround/flat': 'ff1ead250560',
  'block-surround/segmental': '91703e6a424a',
  'block-surround/round': '93c0cdcefa95',
  'block-surround/relieving': 'ff1ead250560',
  'tablet/flat': '7450fc3aeb0c',
  'tablet/segmental': '7450fc3aeb0c',
  'tablet/round': '7450fc3aeb0c',
  'tablet/relieving': 'e395f5d80351',
  'arched-frame/flat': 'ffe94e0bfefb',
  'arched-frame/segmental': 'ffe94e0bfefb',
  'arched-frame/round': 'd1631aeb96a7',
  'arched-frame/relieving': 'ffe94e0bfefb'
};

test('row-heads: every existing dressing and shape draws byte-identically to before round 23', () => {
  for (const [k, want] of Object.entries(BEFORE)) {
    const [d, s] = k.split('/');
    assert.equal(createHash('sha1').update(JSON.stringify(run(wall(d, s)))).digest('hex').slice(0, 12), want, k);
  }
  assert.equal(run(wall('none')).length, 0);
  assert.ok(run(wall('none', 'segmental')).length > 0, 'a plain segmental head draws its arched glass');
});

test('brick-band: one band per storey across the full front in the wall\'s darker brick, a row of burnt blocks, no white', () => {
  const t = run(wall('brick-band'));
  assert.ok(t.length > 0);
  const hexes = new Set(t.map(x => (x as unknown as { hex: string }).hex));
  assert.ok(!hexes.has(WHITE));
  assert.ok(hexes.has(shadeHex('#6b4a3c', ROW_DRESS.brickBand.band)) && hexes.has(shadeHex('#6b4a3c', ROW_DRESS.brickBand.dark)), [...hexes].join(','));
});

test('the new grammar dressings draw on a row wall', () => {
  for (const [d, s] of [['corner-blocks', 'segmental'], ['moulded-hood', 'flat'], ['voussoirs', 'segmental'], ['brick-arch-ring', 'segmental']] as const) assert.ok(run(wall(d, s)).length > 0, d);
});
