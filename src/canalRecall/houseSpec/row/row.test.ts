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
const { solveRow, readDormers, heldReason, compatible, ROW_EXTRAS_DEFAULT, BELT_GABLE_RISE, GABLE_ON_RIDGE, groundColourOfRead, headsList, oneShopfront } = await import('./solve.ts');
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
  // Left to right as seen from the street: the even side's numbers fall (the October strip of herengracht-84-148).
  assert.deepEqual(ms.map(m => [m.pandId, m.widthM, m.side]), [['a', 5.12, 'even'], ['c', 12, 'even']]);
  assert.deepEqual(beltMembers([...sel, { ...sel[1], pandId: 'd', number: 5, addresses: ['Herengracht 5'] }], new Map(), 'Herengracht', 3, 5).map(m => m.pandId), ['b', 'd']);
  // Herengracht 82 (held read) is its own series, never 80's neck gable; the register gable is its crown.
  const r = solveRow(loadRow(loadRowDefs()['herengracht-76-90'], '2026-11-15').input);
  const s82 = r.fronts.find(f => f.pandId === '0363100012175703')!.seriesId;
  assert.notEqual(s82, r.fronts.find(f => f.pandId === '0363100012175783')!.seriesId);
  assert.equal(frontDesign(r, r.fronts.find(f => f.pandId === '0363100012175703')!).crown.value, 'cornice');
  // 82 (1905, no cut read) sits between 84 (1615, painted dark) and 80 (1905, buff): equal distance, so the neighbour of its
  // own era gives the wall, with its material.
  assert.deepEqual(frontDesign(r, r.fronts.find(f => f.pandId === '0363100012175703')!).wall.value, { material: 'brick', family: 'buff-brick', hex: frontDesign(r, r.fronts.find(f => f.pandId === '0363100012175703')!).wall.value.hex });
});

test('Herengracht belt rows: the cut sample judges brick; painted stays painted; no-cut fronts take their neighbours', () => {
  const r = solveRow(loadRow(loadRowDefs()['herengracht-56-74'], '2026-11-15').input);
  const wall = (pid: string) => frontDesign(r, r.fronts.find(f => f.pandId === pid)!).wall.value;
  // 58 is painted dark (its note's "red brick" is the neighbour), black paint by its colourless sample (2026-11-15: the
  // green-black painted-dark drew Herengracht's dark fronts green); 56 brick never shares its series.
  assert.equal(wall('0363100012167495').family, 'painted-black');
  assert.notEqual(r.fronts.find(f => f.pandId === '0363100012167494')!.seriesId, r.fronts.find(f => f.pandId === '0363100012167495')!.seriesId);
  // 74 (sample L 0.42) is dark purple-brown, not the era red-brown.
  assert.equal(wall('0363100012175616').family, 'purple-brown-brick');
  const a = solveRow(loadRow(loadRowDefs()['herengracht-2-24'], '2026-11-15').input);
  const six = a.fronts.find(f => f.pandId === '0363100012179834')!;
  assert.equal(frontDesign(a, six).wall.value.family, frontDesign(a, a.fronts.find(f => f.pandId === '0363100100091828')!).wall.value.family, '6 (no cut) takes its neighbour 2-4');
});

test('Canal windows (round 5): belt series with read white frames state glazing; Kinkerstraat rows do not', () => {
  const belt = solveRow(loadRow(loadRowDefs()['herengracht-56-74'], '2026-11-15').input);
  for (const s of belt.series) {
    const wf = s.design.whiteFrames;
    assert.equal(!!s.design.glazing, wf.value === true && wf.source !== 'period-default', `${s.id}: glazing follows the read white frames`);
  }
  assert.ok(belt.series.some(s => s.design.glazing));
  const k = solveRow(loadRow(loadRowDefs()['kinkerstraat-86-110'], '2026-11-15').input);
  assert.ok(k.series.every(s => !s.design.glazing));
});

test('Herengracht belt fix (2026-11-15): unread tops take the neighbours\' line, no roof form; no invented roofs; no anchor crosses', async () => {
  const a = solveRow(loadRow(loadRowDefs()['herengracht-2-24'], '2026-11-15').input);
  const front = (pid: string) => a.fronts.find(f => f.pandId === pid)!;
  // 6 (no read) and 8 (a hoarding: the reader marked it unreadable) are unread: the line of 10 and 2-4, a plain lid.
  for (const pid of ['0363100012179834', '0363100012179833']) {
    const f = front(pid), d = frontDesign(a, f);
    assert.ok(f.topUnread, `${pid} is unread`);
    assert.equal(d.roofStorey.value.kind, 'none');
    assert.equal(d.crown.value, 'cornice');
    const line = (frontDesign(a, front('0363100012179763')).corniceTopM.value! + frontDesign(a, front('0363100100091828')).corniceTopM.value!) / 2;
    assert.ok(Math.abs(d.corniceTopM.value! - line) < 0.01, `${pid} takes the neighbours' line ${line}`);
  }
  assert.ok(!front('0363100012179763').topUnread);
  // 18's hipped tiled roof is a kit gap, not a slate mansard.
  assert.equal(frontDesign(a, front('0363100012179760')).roofStorey.value.kind, 'none');
  assert.ok(a.series.every(s => !s.design.extras.value.includes('wall-anchors')), 'belt rows draw no anchor crosses');
  const { rowFrontsWithSeries } = await import('../../houseLine/rowSeries.ts');
  assert.ok(rowFrontsWithSeries(a).every(r => r.series?.omitExtras?.includes('wall-anchors')), 'the series draw omits the anchors');
  const b = solveRow(loadRow(loadRowDefs()['herengracht-51-73'], '2026-11-15').input);
  for (const pid of ['0363100012168129', '0363100012168130', '0363100012179751']) assert.equal(frontDesign(b, b.fronts.find(f => f.pandId === pid)!).roofStorey.value.kind, 'none', `${pid}: no invented roof`);
  const k = solveRow(loadRow(loadRowDefs()['kinkerstraat-86-110'], '2026-11-15').input);
  assert.ok(k.fronts.every(f => !f.topUnread) && k.series.every(s => s.design.extras.value.includes('wall-anchors')));
  assert.ok(rowFrontsWithSeries(k).every(r => !r.series?.omitExtras), 'Kinkerstraat omits nothing');
});

test('Herengracht belt fix 2: a reviewed split reads two gables; a reviewed top is not unread; 18 stands at 16\'s line', () => {
  const r = solveRow(loadRow(loadRowDefs()['herengracht-25-49'], '2026-11-15').input);
  const fs = r.fronts.filter(f => f.pandId === '0363100012168212');
  assert.deepEqual(fs.map(f => f.id), ['0363100012168212#m0', '0363100012168212#m1']);
  assert.ok(fs[0].widthM! < fs[1].widthM!, 'the right gable is the wider');
  for (const f of fs) { assert.ok(!f.topUnread); assert.equal(frontDesign(r, f).crown.value, 'point'); }
  const a = solveRow(loadRow(loadRowDefs()['herengracht-2-24'], '2026-11-15').input);
  assert.equal(a.fronts.find(f => f.pandId === '0363100012179760')!.topM, 12.4);
});

test('Herengracht belt follow-up: a gabled crown with no read rise takes the family rise, its foot under the 3DBAG median', () => {
  // The fixtures carry no cut samples; a sample on one member makes it a row of measured cuts, as the live belt rows are.
  const belt = (id: string) => { const inp = loadRow(loadRowDefs()[id], '2026-11-15').input; inp.members[0].wallSample = '#6a5040'; return solveRow(inp); };
  const r = belt('herengracht-75-89'), at = (id: string) => frontDesign(r, r.fronts.find(f => f.pandId === id)!);
  // 79 (register neck, no read): the default neck rise; its foot (10.45 m, half the rise under the 3DBAG median) then moves
  // onto the 3DBAG ridge (13.7 m) less the rise, so the apex stands at the ridge and not above it.
  assert.equal(at('0363100012168064').gable?.value.riseM, BELT_GABLE_RISE.neck);
  assert.equal(at('0363100012168064').gable?.source, 'period-default');
  assert.equal(at('0363100012168064').gable?.value.dress, 'belt');
  assert.equal(at('0363100012168064').corniceTopM.value, +(13.7 - BELT_GABLE_RISE.neck).toFixed(2));
  assert.match(at('0363100012168064').corniceTopM.ref ?? '', /3DBAG ridge 13.7 m/);
  // 85 (reviewed bell rise 3.4 at 12.4 m) keeps its own; a cornice front takes none.
  assert.equal(at('0363100012179601').gable?.value.riseM, 3.4);
  assert.equal(at('0363100012179601').corniceTopM.value, 12.4);
  assert.equal(at('0363100012179680').gable, undefined);
  // Rows without measured cuts (Kinkerstraat) are untouched.
  const k = solveRow(loadRow(loadRowDefs()['kinkerstraat-65-87'], '2026-11-15').input);
  assert.ok(k.series.every(x => x.design.gable?.source !== 'period-default'));
});

test('Herengracht gables: a 3DBAG ridge counts only over a nok line; moves stay within the cap', async () => {
  // 57: dak_max 11.46 m with no nok (a flat roof behind a false front) offers no ridge and keeps its line.
  const { ridgeOf } = await import('../../../../scripts/house-specs/rows/belt-ridges.ts');
  const item = (a: Record<string, number>) => ({ feature: { CityObjects: { 'NL.IMBAG.Pand.1': { attributes: { b3_h_maaiveld: 0.5, ...a } } } } });
  assert.equal(ridgeOf(item({ b3_h_dak_max: 11.96, b3_h_nok: -0.1, b3_n_nok: 0 })), null);
  assert.equal(ridgeOf(item({ b3_h_dak_max: 17.7, b3_h_nok: 17.83, b3_n_nok: 5 })), 17.2);
  const inp = loadRow(loadRowDefs()['herengracht-51-73'], '2026-11-15').input; inp.members[0].wallSample = '#6a5040';
  const r = solveRow(inp), at = (id: string) => frontDesign(r, r.fronts.find(f => f.pandId === id)!);
  assert.equal(inp.members.find(x => x.pandId === '0363100012179673')?.ridge3dbag ?? null, null, '57 has no ridge');
  assert.ok(!/3DBAG ridge/.test(at('0363100012179673').corniceTopM.ref ?? ''), '57 keeps its line');
  const movedFronts = r.fronts.filter(f => /3DBAG ridge/.test(frontDesign(r, f).corniceTopM.ref ?? ''));
  assert.ok(movedFronts.length >= 3, `the row's other gables stand on their ridges (${movedFronts.length})`);
  for (const f of movedFronts) {
    const d = frontDesign(r, f), m = inp.members.find(x => x.pandId === f.pandId)!;
    assert.ok(d.corniceTopM.ref!.includes(`3DBAG ridge ${m.ridge3dbag} m`), `${f.pandId} cites its own ridge`);
    assert.ok(Math.abs(m.ridge3dbag! - d.gable!.value.riseM - d.corniceTopM.value!) <= GABLE_ON_RIDGE.maxMoveM, `${f.pandId} within the cap of its ridge`);
  }
  // A series moves as one (Herengracht 155/157, one design with ridges 1.24 m apart, stepped 1.24 m inside the pair):
  // no front moved onto its ridge differs from the rest of its series.
  for (const id of ['herengracht-51-73', 'herengracht-25-49', 'herengracht-75-89', 'herengracht-125-161']) {
    const i = loadRow(loadRowDefs()[id], '2026-11-15').input; i.members[0].wallSample = '#6a5040';
    const rr = solveRow(i);
    for (const s of rr.series) {
      const fs = rr.fronts.filter(f => f.seriesId === s.id && !f.sub), lines = fs.map(f => frontDesign(rr, f).corniceTopM);
      if (lines.some(l => /3DBAG ridge/.test(l.ref ?? ''))) assert.equal(new Set(lines.map(l => l.value)).size, 1, `${s.id} moves as one`);
    }
  }
});

test('a module pand shares its read dormers out whole per front, at least one where any was read', () => {
  // Herengracht 320-324: one dormer read over two fronts gave 0.5 a front, which the spec schema refuses.
  for (const id of ['kinkerstraat-120-138', 'kinkerstraat-65-87', 'kinkerstraat-86-110']) {
    const r = solveRow(loadRow(loadRowDefs()[id], '2026-11-15').input);
    for (const s of r.series) assert.ok(Number.isInteger(s.design.roofStorey.value.dormersPerFront), `${s.id}: ${s.design.roofStorey.value.dormersPerFront}`);
    for (const f of r.flags.filter(x => x.kind === 'class-disagreement' && x.field === 'dormers')) assert.doesNotMatch(f.detail, /consensus "\d+\.\d+"/, f.detail);
  }
});

test('a tablet head (Herengracht 175404) emits a HouseSpec keystone head, the relieving arch in the wall colour, and a limit', () => {
  for (const [shape, kind, colour] of [['relieving', 'relieving', 'wall'], ['flat', 'flat', 'stone']] as const) {
    const row = structuredClone(K.row);
    const f = row.fronts.find(x => x.id === '0363100012160809')!;
    f.overrides.heads = { value: { shape, dressing: 'tablet' }, source: 'reviewed', ref: 'test' } as never;
    const spec = rowSpec(row, '0363100012160809', undefined, '2026-11-15')!;
    const head = (spec.design.fronts?.[0] as { windowHead?: { kind: string; archRing?: { colour: string; keystone?: boolean } } }).windowHead!;
    assert.equal(head.kind, kind);
    assert.deepEqual([head.archRing?.colour, head.archRing?.keystone], [colour, true]);
    assert.ok((spec.schemaLimits ?? []).some(l => (l as { what?: string }).what?.includes('tablet')));
    assert.deepEqual(specProblems(spec).filter(p => /windowHead|schemaLimits/.test(p)), []);
  }
});

test("lane R's ground openings (Herengracht 25-29, 27): a reviewed ground.openings states the bays, the arched one and the basement front; cross windows emit cross-transom", () => {
  const l = loadRow(defs['kinkerstraat-86-110'], '2026-11-15');
  const id = '0363100012160809';
  const input = { ...l.input, reviewed: [...(l.input.reviewed ?? []), { fronts: [id], field: 'ground.openings' as const, value: { groundBays: 2, archedOpenings: { index: [1] }, basementFront: { plinth: 'grey', doors: [0] } }, ref: 'test', at: '2026-11-15' }] };
  const row = solveRow(input);
  const f = row.fronts.find(x => x.id === id)!;
  assert.deepEqual([f.ground.groundBays, f.ground.archedOpenings, f.ground.basementFront], [2, { index: [1] }, { plinth: 'grey', doors: [0] }]);
  // Other fronts untouched.
  for (const o of row.fronts.filter(x => x.id !== id)) assert.ok(!o.ground.archedOpenings && !o.ground.basementFront, o.id);
  f.ground.basement = 'windows';
  f.overrides.windows = { value: 'cross', source: 'reviewed', ref: 'test' } as never;
  const spec = rowSpec(row, id, undefined, '2026-11-15')!;
  const fr = spec.design.fronts?.[0] as Record<string, unknown>;
  assert.deepEqual([fr.windows, fr.plinth, fr.basementDoor], ['cross-transom', 'full', 0]);
  const limits = (spec.schemaLimits ?? []).map(x => (x as { what: string }).what);
  assert.ok(limits.some(w => /archedOpenings/.test(w)) && limits.some(w => /basementFront/.test(w)), limits.join('\n'));
  assert.deepEqual(specProblems(spec).filter(p => /windows|plinth|basementDoor|schemaLimits/.test(p)), []);
});
