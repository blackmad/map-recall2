// House rows lane R round 24: a stated white timber erker (lane D's `bay-window` kit gap). Absent, nothing is drawn.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExtraContext } from './facadeExtras.js';
import { erkerPlan, ORNAMENT_COMPONENTS, ROW_ERKER, storeyZ, WHITE } from './facadeOrnaments.js';
import { ExtraSink } from './facadeExtraCore.js';
import { bayWindowOf } from './houseSpec/row/solve.js';
import type { DescriberAnswer } from './houseSpec/describer.js';

const wall = (erker?: NonNullable<ExtraContext['rowDress']>['erker']): ExtraContext => ({
  id: 'h1', style: 'canal', period: 'canal', wallKey: 'front',
  f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 7.5 }, base: 0, top: 15,
  layout: { bays: 3, bayWidthM: 2.5, groundM: 3.4, storeys: 3, storeyM: 3.3, doorBays: [] },
  wallHex: '#6b4a3c', accentHex: '#ffffff', groundLevel: true, streetSide: true,
  openings: { upper: { axes: [0.5], width: 0.45, sill: 0.25, head: 0.85 }, ground: null, doorWindow: null, door: null },
  rowDress: { cornice: 'consoled', ...(erker ? { erker } : {}) },
} as unknown as ExtraContext);
const run = (c: ExtraContext) => { const s = new ExtraSink(1e6); ORNAMENT_COMPONENTS.find(x => x.id === 'row-erker')!.build(c, s, 0); return s.tris; };
const outOf = (t: ReturnType<typeof run>) => t.flatMap(x => x.p.map(p => -p[1]));

test('row-erker: absent draws nothing', () => {
  assert.equal(run(wall()).length, 0);
  assert.equal(erkerPlan(wall()), null);
});

test('row-erker: a box over the centre bay, on consoles, its storeys glazed, capped under the next floor', () => {
  const c = wall({ storeys: [1, 2], kind: 'box', at: 3.75 }), p = erkerPlan(c)!, t = run(c);
  assert.ok(p.xa < 3.75 && p.xb > 3.75 && Math.abs((p.xa + p.xb) / 2 - 3.75) < 1e-9);
  assert.equal(p.fa, p.xa);
  assert.equal(p.zb, storeyZ(c, 0));
  assert.ok(Math.abs(p.zt - (storeyZ(c, 2) - ROW_ERKER.gap)) < 1e-9);
  assert.ok(Math.max(...outOf(t)) >= ROW_ERKER.depth && Math.max(...outOf(t)) < ROW_ERKER.depth + 0.15);
  assert.ok(Math.min(...t.flatMap(x => x.p.map(q => q[2]))) < p.zb - ROW_ERKER.slab - 0.3, 'consoles under the slab');
  const hexes = new Set(t.map(x => x.hex));
  assert.ok(hexes.has(WHITE) && hexes.has(ROW_ERKER.glass) && !hexes.has('#1f2124'));
});

test('row-erker: canted sides run on the diagonal; a stated roof balcony draws an iron railing on the cap', () => {
  const p = erkerPlan(wall({ storeys: [1], kind: 'canted', at: 3.75 }))!;
  assert.ok(p.fa > p.xa && p.fb < p.xb);
  const t = run(wall({ storeys: [1], kind: 'box', roofBalcony: true, at: 3.75 }));
  const iron = t.filter(x => x.hex === '#1f2124');
  assert.ok(iron.length > 0 && Math.min(...iron.flatMap(x => x.p.map(q => q[2]))) >= erkerPlan(wall({ storeys: [1], kind: 'box', at: 3.75 }))!.zt - 1e-9);
  // The top storey's erker stops under the cornice band.
  assert.ok(erkerPlan(wall({ storeys: [3], kind: 'box', at: 3.75 }))!.zt <= 15 - 0.95 + 1e-9);
});

test('bayWindowOf: the describer rows and the gap words; no rows, no erker', () => {
  const a = (x: Partial<DescriberAnswer>) => x as DescriberAnswer;
  assert.equal(bayWindowOf(a({})), null);
  assert.equal(bayWindowOf(a({ bayWindow: [] })), null);
  assert.deepEqual(bayWindowOf(a({ bayWindow: [2, 1] }))!.value, { storeys: [1, 2], kind: 'box' });
  assert.deepEqual(bayWindowOf(a({ bayWindow: [1], gaps: [{ component: 'erker', what: 'a white timber canted erker on consoles with a balcony on its roof' }] } as never))!.value, { storeys: [1], kind: 'canted', roofBalcony: true });
});

test('row-erker: a full-width erker spans the front; a side erker stands over the window nearest that end', () => {
  const full = erkerPlan(wall({ storeys: [1, 2], kind: 'box', width: 'full', at: 3.75 }))!;
  assert.ok(Math.abs(full.xa - ROW_ERKER.fullInset) < 1e-9 && Math.abs(full.xb - (7.5 - ROW_ERKER.fullInset)) < 1e-9);
  const left = erkerPlan(wall({ storeys: [1], kind: 'box', end: 'start', at: 3.75 }))!;
  assert.ok((left.xa + left.xb) / 2 < 2, 'over the first bay');
  const right = erkerPlan(wall({ storeys: [1], kind: 'box', end: 'end', at: 3.75 }))!;
  assert.ok((right.xa + right.xb) / 2 > 5.5, 'over the last bay');
});

test('bayWindowOf: width and side from the gap; an erker gap\'s balcony is its roof balcony, not a row-balcony', async () => {
  const { gapExtras } = await import('./houseSpec/row/solve.js');
  const g = (what: string, rows = [1, 2]) => ({ bayWindow: rows, gaps: [{ component: 'erker', what }] }) as unknown as DescriberAnswer;
  assert.equal(bayWindowOf(g('a full-width two-storey white bay window over storeys 1 and 2, with a solid-guard balcony on its roof'))!.value.width, 'full');
  assert.equal(bayWindowOf(g('a shallow one-storey bay window over the left axis of storey 1, carrying a white balustraded balcony', [1]))!.value.side, 'left');
  assert.equal(bayWindowOf(g('a shallow one-storey bay window over the left axis of storey 1, carrying a white balustraded balcony', [1]))!.value.roofBalcony, true);
  assert.deepEqual(gapExtras(g('a bay window with a balcony on its roof')), []);
  // Without bayWindow rows the gap's balcony stays the row-balcony it was.
  assert.deepEqual(gapExtras({ gaps: [{ component: 'erker', what: 'a bay window with a balcony on its roof' }] } as unknown as DescriberAnswer).map(x => x.id), ['row-balcony']);
});
