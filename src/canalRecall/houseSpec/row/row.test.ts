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
const { solveRow, readDormers, heldReason, compatible, ROW_EXTRAS_DEFAULT, groundColourOfRead, headsList, oneShopfront } = await import('./solve.ts');
const { rowSpec, rowFrontRecords } = await import('./emit.ts');
const { toRowCheck } = await import('./check.ts');
const { frontDesign } = await import('./types.ts');
const { ROW_FRONT_EXTRAS } = await import('../../houseLine/rowFront.ts');
const { checkRow, runRegressions, checkOneDesign } = await import('../rowChecks.ts');
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
  // one design but for 100's own dormer (an ornate wall dormer with a pediment and finial: D1 gap + face "larger pediment dormer")
  // and its reviewed block surrounds (integrator, sheet photo, 2026-11-14)
  // and the reviewed flat-topped hoist dormers on 102/104 (blind review 6): the roof storey's dormer is a member variant
  const noDormerKind = (id: string) => { const d = design(K, id); return strip({ ...d, heads: design(K, ids[0]).heads, roofStorey: design(K, '0363100012160809').roofStorey }); };
  assert.equal(new Set(ids.map(noDormerKind)).size, 1);
  assert.equal(design(K, '0363100012160809').roofStorey.value.dormerKind, 'ornate-pinnacle');
  assert.equal(design(K, '0363100012152925').roofStorey.value.dormerKind, 'plain');
  assert.equal(design(K, '0363100012152925').roofStorey.value.hoist, true);
  // one wall tone, one roof, one cornice line (street datum) for the three; the hash path drew one red and two tan
  const bricks = ids.map(id => K.specs[id].design.palette?.brick);
  assert.equal(new Set(bricks).size, 1);
  const d = design(K, ids[0]);
  assert.equal(d.corniceTopM.value, 14.18);
  assert.deepEqual(K.row.series.find(x => x.id === fronts[0].seriesId)!.design.roofStorey.value, { kind: 'mansard', material: 'slate', dormersPerFront: 1, dormerKind: 'pediment' }, 'the series roof; 102/104 carry reviewed hoist dormers');
  assert.deepEqual(d.heads.value, { shape: 'flat', dressing: 'block-course' }, 's1 heads on every upper storey (no storeys list)');
  assert.equal(d.wall.value.family, 'red-brown-brick');
});

test('Kinkerstraat 92–94 (236213): the netted 2019 read is replaced by the 2023 re-read, which draws the right front only', () => {
  const fronts = K.row.fronts.filter(f => f.pandId === '0363100012236213');
  assert.equal(fronts.length, 2);
  for (const f of fronts) assert.equal(f.readHeld, undefined);
  assert.ok(!K.row.flags.some(f => f.kind === 'scaffold' && f.fronts.some(x => x.startsWith('0363100012236213'))));
  const rr = K.row.flags.find(f => f.kind === 'reread')!;
  assert.match(rr.detail, /2023-01-10 capture TMX7316010203-002921_pano_0015_000068/);
  assert.match(rr.detail, /2019-12-09/);
  assert.equal(K.answers['0363100012236213']!.image.ref, 'artifacts/house-rows/reread/cuts/0363100012236213.jpg');
  // the re-read describes the right front (92); the left one (94) keeps the face and its series
  assert.match(fronts[0].readElsewhere ?? '', /front 2 of 2/);
  assert.equal(fronts[1].readElsewhere, undefined);
  assert.deepEqual(fronts.map(f => headsList(design(K, f.id).heads.value).map(h => h.dressing)), [['keystone'], ['segmental-tympanum', 'keystone']]);
  assert.notEqual(K.specs['0363100012236213'].design.palette?.brick, '#243142', 'the netting colour is not the wall');
});

test('Weteringschans 169016: a slate mansard with a pedimented dormer and a hoist, no pointed gable', () => {
  const d = design(W, '0363100012169016');
  assert.equal(d.crown.value, 'cornice');
  assert.deepEqual(d.roofStorey.value, { kind: 'mansard', material: 'slate', dormersPerFront: 1, dormerKind: 'pediment', hoist: true });
  // the hoist is 169016's own: 171218's ornate dormer has none
  assert.equal(design(W, '0363100012171218').roofStorey.value.hoist, undefined);
  const f = W.specs['0363100012169016'].design.fronts![0] as Record<string, unknown>;
  assert.equal(f.gable, 'cornice');
  assert.equal(f.roofStorey, 'mansard');
  assert.equal(f.dormers, 1);
  assert.equal(f.dormerStyle, 'pediment');
  // 171218 is its own series (round heads on its top storey); both mansards keep a line under the 3DBAG height
  assert.notEqual(W.row.fronts.find(x => x.id === '0363100012171218')!.seriesId, W.row.fronts.find(x => x.id === '0363100012169016')!.seriesId);
  assert.deepEqual(design(W, '0363100012171218').heads.value, [{ shape: 'flat', dressing: 'stone-lintel', storeys: [1] }, { shape: 'round', dressing: 'arch-ring', storeys: [2] }]);
  assert.deepEqual(design(W, '0363100012171218').extras.value.slice(6).sort(), ['row-balcony', 'row-porch', 'row-rustication', 'speklagen']);
  assert.deepEqual(design(W, '0363100012169016').extras.value.slice(6).sort(), ['floor-cornices', 'row-balcony', 'row-porch', 'speklagen', 'string-courses'], 'speklagen added by review 4');
  assert.ok(d.corniceTopM.value! < 15);
  // s1's cornice is the 3DBAG eaves (14.31 / 14.17), not the 16.5 m roof height: within 0.5 m of the mansard pair's line
  const s1 = design(W, '0363100012168096').corniceTopM;
  assert.equal(s1.value, 14.24);
  assert.ok(Math.abs(s1.value! - d.corniceTopM.value!) < 0.5);
  assert.ok(W.row.flags.some(f => f.kind === 'no-reading' && f.field === 'corniceTopM' && f.fronts.includes('0363100012168096')));
  // bands are read and drawn as extras: 169016 floor cornices and string courses, 171218 speklagen
  assert.ok(['floor-cornices', 'string-courses'].every(x => design(W, '0363100012169016').extras.value.includes(x)));
  assert.ok(design(W, '0363100012171218').extras.value.includes('speklagen'));
  // review 4 adds speklagen to 169016 (reviewed); the read alone drew only its floor cornices and string courses
  assert.ok(!W.row.readNotDrawn.some(r => r.field === 'bands'));
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

test('Weteringschans review 3: doors left, 168042 a shop, block crowns on the first storey only, balconies on the first storey', () => {
  for (const id of ['0363100012168096', '0363100012169016', '0363100012171218']) {
    const f = W.row.fronts.find(x => x.id === id)!;
    assert.equal(f.ground.doorSide, 'left', id);
    assert.equal((W.specs[id].design.fronts![0] as Record<string, unknown>).doorBay, 0, id);
  }
  assert.equal(W.row.fronts.find(x => x.id === '0363100012168042')!.ground.use, 'shop');
  assert.equal(W.specs['0363100012168042'].facts?.pui, 'shop');
  assert.deepEqual(design(W, '0363100012168096').heads.value, { shape: 'flat', dressing: 'jack-blocks', storeys: [1] });
  assert.equal(design(W, '0363100012168096').storeys.value, 3);
  for (const id of ['0363100012169016', '0363100012171218']) {
    assert.equal(design(W, id).storeys.value, 3, 'bel-etage + 2 above; the souterrain is not counted');
    assert.deepEqual(design(W, id).balcony?.value, { storeys: [1], axis: 'centre' });
  }
});

test('Kinkerstraat 90 and 92: tympana on storeys 1-2, flat heads with a keystone on storey 3 (face + D1; the review override reverted)', () => {
  for (const id of ['0363100012155794', '0363100012236213#m1']) {
    const h = design(K, id).heads;
    assert.equal(h.source, 'face-intent');
    assert.deepEqual(h.value, [{ shape: 'segmental', dressing: 'segmental-tympanum', storeys: [1, 2] }, { shape: 'flat', dressing: 'keystone', storeys: [3] }]);
    assert.match(h.ref, /flat heads on storey 3/);
  }
  assert.equal((design(K, '0363100012236213#m0').heads.value as { dressing: string }).dressing, 'keystone');
  assert.ok(!K.row.flags.some(f => f.kind === 'reviewed' && f.field === 'heads' && f.fronts.includes('0363100012155794')));
});

test('Weteringschans review 4: 169016 adds speklagen (reviewed) and keeps its floor cornices, its own series; 168096 ground stated', () => {
  const ex = design(W, '0363100012169016').extras;
  assert.equal(ex.source, 'reviewed');
  for (const e of ['speklagen', 'floor-cornices', 'string-courses']) assert.ok(ex.value.includes(e), e);
  const sid = (id: string) => W.row.fronts.find(x => x.id === id)!.seriesId;
  assert.notEqual(sid('0363100012169016'), sid('0363100012171218'));
  assert.deepEqual(W.row.fronts.find(x => x.id === '0363100012168096')!.ground, { use: 'dwelling', doorSide: 'left', doorIndex: 0, groundBays: 3, basement: 'windows' });
  assert.notEqual(W.specs['0363100012168096'].design.fronts![0].souterrain, true, 'basement windows are not a souterrain');
});

test('Kinkerstraat shopfront colour: read where a reading names it, reviewed over the face shopPaint', () => {
  const g = (id: string) => K.row.fronts.find(x => x.id === id)!.ground.colour;
  // reviewed (integrator, sheet photo): 106-108 dark, 92-94 white, 100 light, 98 dark (the read agrees); face shopPaint flagged
  const want: Record<string, string> = { '0363100012236027#m0': 'dark', '0363100012236027#m1': 'dark', '0363100012236213#m0': 'white', '0363100012236213#m1': 'white', '0363100012160809': 'light', '0363100012158180': 'dark' };
  for (const [id, v] of Object.entries(want)) assert.deepEqual([g(id)?.value, g(id)?.source], [v, 'reviewed'], id);
  for (const id of ['0363100012236027#m0', '0363100012236213#m1', '0363100012160809']) assert.ok(K.row.flags.some(f => f.kind === 'reviewed' && f.field === 'ground.colour' && f.fronts.includes(id) && /shopPaint/.test(f.detail)), id);
  assert.ok(!K.row.flags.some(f => f.field === 'ground.colour' && f.fronts.includes('0363100012158180')), '98 agrees with its read');
  for (const id of ['0363100012159635', '0363100012156028', '0363100012165799']) assert.equal(g(id), undefined, id);
  const read = (what: string, notes = '') => groundColourOfRead({ gaps: [{ component: 'shopfront', what }], notes } as never)?.value ?? null;
  assert.equal(read('a painted timber shopfront with a row of transom lights'), null);
  assert.equal(read('a deep dark canopy runs along the whole row over the shopfronts'), null);
  assert.equal(read('a red-and-white shopfront'), 'red');
  assert.equal(read('', 'a black pui with gold lettering'), 'dark');
  assert.equal(read('a varnished timber shopfront'), 'timber');
});

test('Kinkerstraat 100: reviewed block surrounds as a front override in s1; the one-design gate takes it as headVariant', () => {
  const f = K.row.fronts.find(x => x.id === '0363100012160809')!;
  assert.equal(f.seriesId, K.row.fronts.find(x => x.id === '0363100012159635')!.seriesId);
  assert.deepEqual([f.overrides.heads?.value, f.overrides.heads?.source], [{ shape: 'flat', dressing: 'block-surround' }, 'reviewed']);
  const fr = K.specs['0363100012160809'].design.fronts![0] as Record<string, unknown>;
  assert.equal(fr.windowSurround, 'block-dressings');
  assert.equal(fr.bandLines, undefined, 'the face head band is replaced, not added to');
  const c = toRowCheck(K.row, {}, new Set());
  const m = c.members.find(x => x.key === '0363100012160809')!;
  assert.equal(m.design.headVariant, 'flat/block-surround');
  assert.equal(m.design.head, c.members.find(x => x.key === '0363100012159635')!.design.head);
  assert.deepEqual(checkOneDesign(c), []);
  // an unreviewed per-front heads difference still fails the gate
  const row2 = structuredClone(K.row);
  row2.fronts.find(x => x.id === '0363100012160809')!.overrides.heads!.source = 'single-read';
  assert.ok(checkOneDesign(toRowCheck(row2, {}, new Set())).length > 0);
});

test('Kinkerstraat 86-88 (233580) corner: the Bilderdijkstraat face that owns it states its Kinkerstraat front (no blank slab right of 90)', async () => {
  const { blankCornerFronts } = await import('../../../../scripts/house-specs/rows/house-rows.ts');
  assert.deepEqual(blankCornerFronts('Kinkerstraat', K.row.members.map(m => m.pandId)), []);
  // the check bites: the same pand on a street its owning face does not state
  assert.deepEqual(blankCornerFronts('Overtoom', ['0363100012233580']).map(g => g.face), ['bilder-233580-162444']);
});

test('Weteringschans 168042: one dark shopfront (a narrow door and one large window), drawn as one unit', () => {
  const g = W.row.fronts.find(x => x.id === '0363100012168042')!.ground;
  assert.equal(g.shopUnits?.value, 1);
  assert.equal(g.colour?.value, 'dark');
  const sf = (W.specs['0363100012168042'].design.fronts![0] as Record<string, any>).shopfront;
  assert.deepEqual([sf.displayWindows, sf.glazing, sf.entrance], [1, 'single', 'left']);
  assert.equal(oneShopfront({ gaps: [{ component: 'shopfront', what: 'two shops side by side under one fascia' }] } as never), null);
});

test('Kinkerstraat 31-49 (round 2): a front with no head joins only a neighbour of the same type, dormers and crown', () => {
  const r = solveRow(loadRow(loadRowDefs()['kinkerstraat-31-49'], '2026-11-15').input);
  const series = (pid: string) => r.fronts.find(f => f.pandId === pid)!.seriesId;
  // 31 (158968): no dormer, its own series; 49 (157926): the 1893 neo-renaissance corner, its own series; 33-47 one series.
  assert.notEqual(series('0363100012158968'), series('0363100012160646'));
  assert.notEqual(series('0363100012157926'), series('0363100012161457'));
  assert.equal(new Set(['0363100012160646', '0363100012155369', '0363100012160073', '0363100012160074', '0363100012167106', '0363100012159384', '0363100012154359', '0363100012161457'].map(series)).size, 1);
  const d31 = frontDesign(r, r.fronts.find(f => f.pandId === '0363100012158968')!);
  assert.equal(d31.roofStorey.value.dormersPerFront, 0, '31 draws no dormer');
  // Keystones stated as a surround (windowSurround keystone) are the series head.
  assert.equal(headsList(d31.heads.value)[0].dressing, 'keystone');
});

test('Kinkerstraat 126-138 (round 2): a module pand splits by the face module shares, not equally', () => {
  const r = solveRow(loadRow(loadRowDefs()['kinkerstraat-120-138'], '2026-11-15').input);
  const subs = r.fronts.filter(f => f.pandId === '0363100012233461').map(f => f.sub!);
  assert.equal(subs.length, 7);
  assert.equal(subs[0].a0, 0);
  assert.equal(subs[6].a1, 1);
  // The two narrow round-window gable axes (modules 4 and 7, shares 0.113 and 0.109) are narrower than their neighbours.
  const w = subs.map(s => s.a1 - s.a0);
  assert.ok(w[3] < w[2] && w[3] < w[4], `module 4 narrow: ${w.join(',')}`);
  assert.ok(w[6] < w[5], `module 7 narrow: ${w.join(',')}`);
});

test('Kinkerstraat 126-138 (round 3): reviewed series split the left building and 132; a reviewed cornice line moves the tops', () => {
  const r = solveRow(loadRow(loadRowDefs()['kinkerstraat-120-138'], '2026-11-15').input);
  const f = (n: number) => r.fronts.find(x => x.numbers.includes(n))!;
  const s = (n: number) => r.series.find(x => x.id === f(n).seriesId)!;
  // 138-134 are one series of their own, on a lower line; 132 and 126 are separate gabled designs on the series line.
  assert.equal(new Set([138, 136, 134].map(n => f(n).seriesId)).size, 1);
  assert.ok(![132, 130, 128, 126, 122, 120].some(n => f(n).seriesId === f(138).seriesId));
  assert.equal(s(138).design.corniceTopM.value, 12.5);
  assert.equal(f(138).topM, 12.89);
  assert.notEqual(f(132).seriesId, f(126).seriesId);
  assert.equal(s(132).design.crown.value, 'step');
  assert.deepEqual(s(132).design.gable?.value, { riseM: 2.7, steps: 2, attic: 1 });
  assert.equal(s(126).design.crown.value, 'neck');
  for (const n of [132, 126]) {
    assert.equal(s(n).design.corniceTopM.value, 13.45);
    assert.equal(f(n).topM, 13.84, `${n}: the series line, not the 16.45 apex`);
    assert.deepEqual(s(n).design.heads.value, { shape: 'round', dressing: 'arch-ring' });
  }
  assert.equal(f(130).topM, 13.84);
});

test('Kinkerstraat 244-248 (round 2): a face that states one front is never split by a wide reading', () => {
  const r = solveRow(loadRow(loadRowDefs()['kinkerstraat-244-332'], '2026-11-15').input);
  assert.deepEqual(r.fronts.filter(f => f.pandId === '0363100012233496').map(f => f.id), ['0363100012233496']);
  assert.ok(r.series.every(s => s.type), 'every series has a face type');
});

test('Herengracht belt rows: a front with no face and no usable reading draws its own plain series', async () => {
  const { numbersOf, beltMembers } = await import('../../../../scripts/house-specs/rows/belt-rows.ts');
  assert.deepEqual(numbersOf(['Herengracht 46D', 'Herengracht 48', 'Herengracht 46A'], 'Herengracht'), [46, 48]);
  const sel = [
    { pandId: 'a', street: 'Herengracht', number: 4, addresses: ['Herengracht 4'], year: 1615, height: 12, areaM2: 90, picked: true },
    { pandId: 'b', street: 'Herengracht', number: 3, addresses: ['Herengracht 3'], year: 1889, height: 18, areaM2: 90, picked: true },
    { pandId: 'c', street: 'Herengracht', number: 2, addresses: ['Herengracht 2'], year: 1616, height: 12, areaM2: 300, picked: true },
  ];
  const ms = beltMembers(sel, new Map([['a', { pandId: 'a', wallLenM: 5.123 }]]), 'Herengracht', 2, 4);
  assert.deepEqual(ms.map(m => [m.pandId, m.widthM, m.side]), [['c', 12, 'even'], ['a', 5.12, 'even']]);
  // Herengracht 82 (held read) is its own series, never 80's neck gable; the register gable is its crown.
  const r = solveRow(loadRow(loadRowDefs()['herengracht-76-90'], '2026-11-15').input);
  const s82 = r.fronts.find(f => f.pandId === '0363100012175703')!.seriesId;
  assert.notEqual(s82, r.fronts.find(f => f.pandId === '0363100012175783')!.seriesId);
  assert.equal(frontDesign(r, r.fronts.find(f => f.pandId === '0363100012175703')!).crown.value, 'cornice');
});

test('Herengracht belt rows: the cut sample judges brick; painted stays painted; no-cut fronts take their neighbours', () => {
  const r = solveRow(loadRow(loadRowDefs()['herengracht-56-74'], '2026-11-15').input);
  const wall = (pid: string) => frontDesign(r, r.fronts.find(f => f.pandId === pid)!).wall.value;
  // 58 is painted dark (its note's "red brick" is the neighbour); 56 brick never shares its series.
  assert.equal(wall('0363100012167495').family, 'painted-dark');
  assert.notEqual(r.fronts.find(f => f.pandId === '0363100012167494')!.seriesId, r.fronts.find(f => f.pandId === '0363100012167495')!.seriesId);
  // 74 (sample L 0.42) is dark purple-brown, not the era red-brown.
  assert.equal(wall('0363100012175616').family, 'purple-brown-brick');
  const a = solveRow(loadRow(loadRowDefs()['herengracht-2-24'], '2026-11-15').input);
  const six = a.fronts.find(f => f.pandId === '0363100012179834')!;
  assert.equal(frontDesign(a, six).wall.value.family, frontDesign(a, a.fronts.find(f => f.pandId === '0363100012168202')!).wall.value.family, '6 (no cut) takes its neighbour 2-4');
});
