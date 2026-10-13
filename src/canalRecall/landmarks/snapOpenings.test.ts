import assert from 'node:assert/strict';
import test from 'node:test';
import {auditOpenings} from './geometryAudit';
import type {MaterialSoup} from './facadeCompare';
import {snapOpenings} from './snapOpenings';

type V3 = [number, number, number];
const MATS = ['brick', 'glass', 'white', 'dark'];

function boxes(...bs: {min: V3; max: V3; mat: string}[]): MaterialSoup {
  const positions: number[] = [], indices: number[] = [], triMaterial: number[] = [];
  for (const b of bs) {
    const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
    const quads: V3[][] = [
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
    ];
    for (const q of quads) {
      const base = positions.length / 3;
      for (const p of q) positions.push(...p);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      triMaterial.push(MATS.indexOf(b.mat), MATS.indexOf(b.mat));
    }
  }
  return {positions, indices, triMaterial, materials: MATS.map(name => ({name, rgb: [128, 128, 128] as [number, number, number]}))};
}

const block = {min: [0, 0, 0] as V3, max: [12, 9, 8] as V3, mat: 'brick'};
// A window: white surround 12 cm thick with a glass pane 6 cm proud of it, sitting at wall + off.
const window = (x: number, off: number, depth = 0.12) => [
  {min: [x, 3, 8 + off] as V3, max: [x + 1.4, 5.2, 8 + off + depth] as V3, mat: 'white'},
  {min: [x + 0.1, 3.1, 8 + off + depth] as V3, max: [x + 1.3, 5.1, 8 + off + depth + 0.06] as V3, mat: 'glass'},
];

test('a window 12 cm off its wall is moved onto it, keeping its own layering', () => {
  const soup = boxes(block, ...window(2, 0.12), ...window(6, 0));
  assert.ok(auditOpenings(soup).issues.some(i => i.kind === 'floating'));
  const z0 = Math.max(...soup.positions.filter((_, i) => i % 3 === 2).map(Number));
  const r = snapOpenings(soup);
  assert.ok(r.floatingMoved >= 1, JSON.stringify(r));
  assert.deepEqual(auditOpenings(soup).issues, []);
  const z1 = Math.max(...soup.positions.filter((_, i) => i % 3 === 2).map(Number));
  assert.ok(z1 < z0, 'the floating window came back towards the wall');
  assert.ok(z1 >= 8 + 0.12 + 0.06 - 0.001, `the pane still stands proud of the surround by 6 cm (z ${z1})`);
});

test('a window sunk 5 cm behind the wall face is lifted clear of it', () => {
  // Wall face at z = 8: surround/pane of the window sit entirely inside the block (z 7.7..7.95).
  const soup = boxes(block, {min: [2, 3, 7.7], max: [3.4, 5.2, 7.95], mat: 'dark'});
  assert.ok(auditOpenings(soup).issues.some(i => i.kind === 'buried'));
  const r = snapOpenings(soup);
  assert.ok(r.buriedMoved >= 1, JSON.stringify(r));
  assert.deepEqual(auditOpenings(soup).issues, []);
  const zmax = Math.max(...soup.positions.filter((_, i) => i % 3 === 2).map(Number));
  assert.ok(zmax > 8 && zmax < 8.2, `front face now proud of the wall by a few cm (z ${zmax})`);
});

test('what it cannot fix is reported, not moved: overhang, and glazing 70 cm out is free-standing, not a detached window', () => {
  const soup = boxes(block, ...window(11.4, 0));      // hangs half past the wall end
  const far = boxes(block, ...window(2, 0.7));        // 70 cm off: beyond the audit's 60 cm, a canopy or screen rather than a window off its wall
  const before = [...soup.positions];
  const r = snapOpenings(soup);
  assert.deepEqual(soup.positions, before);
  assert.ok(r.skipped.overhang >= 1, JSON.stringify(r));
  const r2 = snapOpenings(far);
  assert.equal(r2.floatingMoved, 0, JSON.stringify(r2));
});

test('a window 45 cm off (a recessed survey wall) is brought back; a zero-thickness pane rests in front of the wall instead of vanishing into it', () => {
  const soup = boxes(block, ...window(2, 0.45));
  const r = snapOpenings(soup);
  assert.ok(r.floatingMoved >= 1, JSON.stringify(r));
  assert.deepEqual(auditOpenings(soup).issues, []);
  // A sheet: one glass quad (two triangles), 15 cm off the wall face z = 8.
  const sheet: MaterialSoup = {
    positions: [...boxes(block).positions, 2, 3, 8.15, 3.4, 3, 8.15, 3.4, 5.2, 8.15, 2, 5.2, 8.15], indices: [], triMaterial: [], materials: boxes(block).materials,
  };
  const base = boxes(block);
  sheet.indices = [...base.indices, base.positions.length / 3, base.positions.length / 3 + 1, base.positions.length / 3 + 2, base.positions.length / 3, base.positions.length / 3 + 2, base.positions.length / 3 + 3];
  sheet.triMaterial = [...base.triMaterial, MATS.indexOf('glass'), MATS.indexOf('glass')];
  snapOpenings(sheet);
  const z = sheet.positions[(base.positions.length / 3) * 3 + 2];
  assert.ok(z > 8.01 && z < 8.04, `sheet rests ${(z - 8) * 100} cm in front of the wall`);
});
