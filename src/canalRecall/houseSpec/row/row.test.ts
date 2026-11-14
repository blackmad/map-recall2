// House rows, lane D (#386): the row solve on the two round-1 rows, with the named regressions of the 2026-11-14
// rejection (docs/handoffs/house-rows-plan-20261114.md). D1 answers are fixtures (fixtures/d1, copied from the
// d1-tranche-ring worktree) so the test does not depend on another worktree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.ROW_D1_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/d1');
const { loadRowDefs } = await import('../../../../scripts/house-specs/rows/rowDefs.ts');
const { loadRow } = await import('../../../../scripts/house-specs/rows/house-rows.ts');
const { solveRow, readDormers, heldReason, compatible, ROW_EXTRAS_DEFAULT } = await import('./solve.ts');
const { rowSpec, rowFrontRecords } = await import('./emit.ts');
const { toRowCheck } = await import('./check.ts');
const { frontDesign } = await import('./types.ts');
const { ROW_FRONT_EXTRAS } = await import('../../houseLine/rowFront.ts');
const { checkRow, runRegressions } = await import('../rowChecks.ts');
const { specProblems } = await import('../spec.ts');

const defs = loadRowDefs();
function solved(id: string) {
  const l = loadRow(defs[id], '2026-11-14');
  const row = solveRow(l.input);
  const specs = Object.fromEntries(row.members.map(m => [m.pandId, rowSpec(row, m.pandId, l.faceSpecs[m.pandId], '2026-11-14')!]));
  return { ...l, row, specs };
}
const K = solved('kinkerstraat-86-110');
const W = solved('weteringschans-168096-171218');
const design = (r: typeof K, frontId: string) => frontDesign(r.row, r.row.fronts.find(f => f.id === frontId)!);
const strip = (d: ReturnType<typeof design>) => JSON.stringify(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.value])));

test('Kinkerstraat 106–108 (0363100012236027) is two fronts with their own numbers', () => {
  const m = K.row.members.find(x => x.pandId === '0363100012236027')!;
  assert.deepEqual(m.fronts, ['0363100012236027#m0', '0363100012236027#m1']);
  const fs = m.fronts.map(id => K.row.fronts.find(f => f.id === id)!);
  assert.deepEqual(fs.map(f => f.numbers), [[108], [106]]);
  assert.deepEqual(fs.map(f => f.sub), [{ index: 0, of: 2, a0: 0, a1: 0.5 }, { index: 1, of: 2, a0: 0.5, a1: 1 }]);
  for (const id of m.fronts) assert.equal(design(K, id).bays.value, 3, 'each front 3 bays (the reader counted 6 on one)');
  assert.ok(K.row.flags.some(f => f.kind === 'extent-mismatch' && f.fronts.includes('0363100012236027')));
  const rec = rowFrontRecords(K.row).find(r => r.pandId === '0363100012236027')!;
  assert.equal(rec.subFronts?.length, 2);
  assert.equal(rec.bays, 6);
  assert.equal(K.specs['0363100012236027'].design.fronts?.length, 2);
});

test('Kinkerstraat 104, 102, 100 (159635, 152925, 160809) resolve to one design', () => {
  const ids = ['0363100012159635', '0363100012152925', '0363100012160809'];
  const fronts = ids.map(id => K.row.fronts.find(f => f.id === id)!);
  assert.equal(new Set(fronts.map(f => f.seriesId)).size, 1);
  assert.equal(new Set(ids.map(id => strip(design(K, id)))).size, 1);
  // one wall tone, one roof, one cornice line (street datum) for the three; the hash path drew one red and two tan
  const bricks = ids.map(id => K.specs[id].design.palette?.brick);
  assert.equal(new Set(bricks).size, 1);
  const d = design(K, ids[0]);
  assert.equal(d.corniceTopM.value, 14.18);
  assert.deepEqual(d.roofStorey.value, { kind: 'mansard', material: 'slate', dormersPerFront: 1, dormerKind: 'pediment' });
  assert.equal(d.heads.value.dressing, 'block-course');
  assert.equal(d.wall.value.family, 'red-brown-brick');
});

test('Kinkerstraat 92–94 (236213): nothing staged from the scaffold read', () => {
  const fronts = K.row.fronts.filter(f => f.pandId === '0363100012236213');
  assert.equal(fronts.length, 2);
  for (const f of fronts) assert.match(f.readHeld ?? '', /scaffold/);
  assert.ok(K.row.flags.some(f => f.kind === 'scaffold'));
  const spec = K.specs['0363100012236213'];
  const reading = K.answers['0363100012236213']!.image.ref;
  for (const [p, prov] of Object.entries(spec.provenance)) {
    assert.ok(!prov.ref.includes(reading), `${p} cites the scaffold cut`);
    assert.ok(!prov.ref.includes('0363100012236213') || !/D1 answers/.test(prov.ref), `${p} cites the scaffold reading`);
  }
  assert.ok(!K.row.overruled.some(o => o.front.startsWith('0363100012236213')), 'no reading of it is weighed');
  // its two modules keep the face's head variants (keystone left, segmental tympanum right) and the row's lines
  assert.deepEqual(fronts.map(f => design(K, f.id).heads.value.dressing), ['keystone', 'segmental-tympanum']);
  assert.notEqual(spec.design.palette?.brick, '#243142', 'the netting colour is not the wall');
});

test('Weteringschans 169016: a slate mansard with a pedimented dormer and a hoist, no pointed gable', () => {
  const d = design(W, '0363100012169016');
  assert.equal(d.crown.value, 'cornice');
  assert.deepEqual(d.roofStorey.value, { kind: 'mansard', material: 'slate', dormersPerFront: 1, dormerKind: 'pediment', hoist: true });
  const f = W.specs['0363100012169016'].design.fronts![0] as Record<string, unknown>;
  assert.equal(f.gable, 'cornice');
  assert.equal(f.roofStorey, 'mansard');
  assert.equal(f.dormers, 1);
  assert.equal(f.dormerStyle, 'pediment');
  // the mansard pair shares a series and a cornice line under the 3DBAG height
  assert.equal(W.row.fronts.find(x => x.id === '0363100012171218')!.seriesId, W.row.fronts.find(x => x.id === '0363100012169016')!.seriesId);
  assert.ok(d.corniceTopM.value! < 15);
  assert.deepEqual(W.row.fronts.map(x => x.pandId), ['0363100012168096', '0363100012168042', '0363100012169016', '0363100012171218']);
  assert.equal(design(W, '0363100012168096').roofStorey.value.kind, 'none');
});

test('every staged spec validates and the row passes check:rows and its regressions', () => {
  for (const r of [K, W]) {
    for (const s of Object.values(r.specs)) assert.deepEqual(specProblems(s), [], s.pandId);
    const c = toRowCheck(r.row, r.answers, new Set(Object.keys(r.specs)));
    assert.deepEqual(checkRow(c), []);
  }
  const regs = runRegressions([toRowCheck(K.row, K.answers, new Set(Object.keys(K.specs))), toRowCheck(W.row, W.answers, new Set(Object.keys(W.specs)))]);
  for (const g of regs) assert.equal(g.status, 'pass', `${g.id}: ${g.message}`);
});

test('no sampled hex is drawn; one judged tone per series', () => {
  for (const r of [K, W]) for (const s of r.row.series) {
    const tones = new Set(s.fronts.map(id => r.specs[r.row.fronts.find(f => f.id === id)!.pandId].design.palette?.brick));
    assert.equal(tones.size, 1, s.id);
    assert.equal([...tones][0], s.design.wall.value.hex);
  }
  assert.ok(K.row.readNotDrawn.some(x => x.field === 'measuredPalette.brick'));
});

test('helpers: dormers from a gap sentence, held reads, class compatibility, the extras copy', () => {
  assert.deepEqual(readDormers({ gaps: [{ component: 'dormer', what: 'one pedimented dormer with a hoist beam over the centre of a slate mansard' }] } as never),
    { count: 1, kind: 'pediment', hoist: true, from: 'gap: one pedimented dormer with a hoist beam over the centre of a slate mansard' });
  assert.ok(heldReason({ notes: 'The whole upper front is wrapped in scaffold and blue netting', gaps: [] } as never));
  assert.equal(heldReason({ notes: 'a clean front', gaps: [] } as never), null);
  assert.ok(compatible('cornice', 'heavy', 'bracketed'));
  assert.ok(!compatible('heads', { dressing: 'keystone' }, { dressing: 'segmental-tympanum' }));
  assert.deepEqual([...ROW_EXTRAS_DEFAULT], [...ROW_FRONT_EXTRAS]);
});
