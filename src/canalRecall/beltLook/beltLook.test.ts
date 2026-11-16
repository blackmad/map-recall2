// Belt look (lane D 2026-11-15): the donor match is deterministic and never stands a gable on a flat-topped pand; a donor's
// read is fitted to the pand; a generated row draws own reads as reads and donors' as the look's period defaults; described
// pands only break a row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { donorFor, fittedRead, frontTopM, gableable, hash32, segmentOf, type BeltDonor, type BeltTarget } from './donors.ts';
import { generateBelt, BELT_LOOK_REF, brickDonorSample, corniceLine, WAREHOUSE_EXTRAS } from './generate.ts';
import { mansardAsDormers, stripRoofStorey, warehouseRead } from './donors.ts';
import { registerStone } from './stone.ts';
import { frontBandHeights } from './ahnFront.ts';
import { ahnCorniceTop, ahnGableApex } from './generate.ts';
import type { GenPand, GenStreet } from '../buurtGenerator/rows.ts';
import type { DescriberAnswer } from '../houseSpec/describer.ts';

const read = (pandId: string, over: Partial<DescriberAnswer> = {}): DescriberAnswer => ({
  v: 1, pandId, image: { ref: `cuts/${pandId}.jpg`, kind: 'pose-photo' }, reader: 'test', prompt: 'v4.3', readable: true, extent: 'single',
  storeys: 4, bays: 3, windows: 'sash-small-panes', heads: ['flat', 'flat', 'flat', 'flat'], whiteFrames: true, sills: 'stone', doorBay: 'left', doorIndex: 0, groundBays: 3,
  ground: 'dwelling', basement: 'stoop', crown: 'cornice', cornice: 'simple', finish: 'brick', doorSurround: true, gaps: [], notes: '', ...over,
} as unknown as DescriberAnswer);
const donor = (id: string, street: string, year: number, widthM: number, heightM: number, over: Partial<DescriberAnswer> = {}): BeltDonor =>
  ({ pandId: id, street, year, widthM, heightM, answer: read(id, over), sample: '#6a5040' });
const DONORS: BeltDonor[] = [
  donor('0363100012900001', 'Keizersgracht', 1680, 6, 13, { crown: 'neck', storeys: 4, bays: 3 }),
  donor('0363100012900002', 'Keizersgracht', 1690, 6.4, 13.5, { crown: 'bell', storeys: 4, bays: 3 }),
  donor('0363100012900003', 'Keizersgracht', 1700, 9, 15, { crown: 'cornice', storeys: 4, bays: 5 }),
  donor('0363100012900004', 'Prinsengracht', 1685, 6.1, 13, { crown: 'step', storeys: 4, bays: 3 }),
  donor('0363100012900005', 'Kerkstraat', 1880, 6, 12, { crown: 'cornice', storeys: 4, bays: 3 }),
  donor('0363100012900006', 'Keizersgracht', 1710, 6.2, 13.2, { crown: 'cornice', storeys: 4, bays: 3 }),
];
const target = (over: Partial<BeltTarget> = {}): BeltTarget => ({ pandId: '0363100012800001', street: 'Keizersgracht', year: 1690, widthM: 6.2, eavesM: 13, ridgeM: 17, roofCode: 3, ...over });

test('the donor is one of the nearest, the same for the same pand, and never gabled on a flat-topped pand', () => {
  const a = donorFor(target(), DONORS)!, b = donorFor(target(), [...DONORS].reverse())!;
  assert.equal(a.donor.pandId, b.donor.pandId, 'order-free');
  assert.equal(a.rank, hash32('0363100012800001') % a.of);
  assert.ok(a.donor.street === 'Keizersgracht', 'same canal first');
  const flat = target({ ridgeM: 13.4, roofCode: 1 });
  assert.equal(gableable(flat), false);
  for (let i = 0; i < 40; i++) {
    const d = donorFor({ ...flat, pandId: `03631000128${String(i).padStart(5, '0')}` }, DONORS)!;
    assert.ok(!['neck', 'bell', 'step', 'point', 'spout'].includes(String(d.donor.answer.crown)), `flat pand ${i} took a ${d.donor.answer.crown}`);
  }
  assert.equal(segmentOf('Kerkstraat'), 'cross');
  // A stated crown (the monument register via house-specs) picks its family: a register cornice never takes a gable.
  for (let i = 0; i < 40; i++) {
    const id = `03631000128${String(i).padStart(5, '0')}`;
    assert.ok(['cornice', 'mansard', 'pitched-eaves'].includes(String(donorFor({ ...target(), pandId: id, statedCrown: 'cornice' }, DONORS)!.donor.answer.crown)));
    const g = donorFor({ ...target({ ridgeM: 13.2, roofCode: 1 }), pandId: id, statedCrown: 'bell' }, DONORS)!;
    assert.equal(g.donor.answer.crown, 'bell', 'a stated bell takes a bell donor even on a flat-topped pand');
    assert.equal(fittedRead({ ...target(), pandId: id, statedCrown: 'point' }, g.donor).crown, 'point', 'a stated gable kind is drawn as stated');
  }
});

test('a donor read is fitted: storeys to the eaves at the donor pitch, bays to the width at its axis, the door inside', () => {
  const d = donor('0363100012900003', 'Keizersgracht', 1700, 9, 15, { crown: 'cornice', storeys: 5, bays: 5, groundBays: 5, doorIndex: 4 });
  const f = fittedRead(target({ widthM: 5.5, eavesM: 9 }), d);
  assert.equal(f.storeys, 3);
  assert.equal(f.bays, 3);
  assert.equal(f.groundBays, 3);
  assert.equal(f.doorIndex, 2);
  assert.equal(f.pandId, '0363100012800001');
  // Round 7: a 17.8 m front at a tall donor pitch takes 4 storeys, not 5 (Keizersgracht 571488).
  assert.equal(fittedRead(target({ eavesM: 17.76 }), donor('0363100012178164', 'Keizersgracht', 1700, 7, 15.1, { crown: 'cornice', storeys: 2, bays: 3 })).storeys, 4);
  assert.equal(d.answer.bays, 5, 'the donor is untouched');
  // A mansard donor whose cut wall takes in the roof (2 storeys in 12.9 m) still gives a 10.8 m pand its 3-4 storeys.
  const m = donor('0363100012169011', 'Keizersgracht', 1900, 10.35, 12.93, { crown: 'mansard', storeys: 2, bays: 4 });
  assert.ok((fittedRead(target({ widthM: 12, eavesM: 10.8 }), m).storeys as number) >= 3);
});

// A canal-side run of five 6 m pands on a straight street (north side), one described.
const LAT0 = 52.37, LNG0 = 4.885, M_LAT = 1 / 111_320, M_LNG = 1 / (111_320 * Math.cos(LAT0 * Math.PI / 180));
const at = (x: number, y: number) => [LNG0 + x * M_LNG, LAT0 + y * M_LAT] as const;
const pand = (i: number): GenPand => {
  const x0 = i * 6, y0 = 6;
  return { id: `NL.IMBAG.Pand.03631000128000${String(i).padStart(2, '0')}`, ring: [at(x0, y0), at(x0 + 6, y0), at(x0 + 6, y0 + 14), at(x0, y0 + 14), at(x0, y0)], year: 1690, eavesM: 13, ridgeM: 17.5, roofCode: 3 };
};
const streets: GenStreet[] = [{ name: 'Keizersgracht', path: [at(-20, 0), at(80, 0)] }];

test('a generated belt row: own reads stay reads, donors are the look\'s period defaults, described pands only break it', () => {
  const pands = Array.from({ length: 6 }, (_, i) => pand(i));
  const described = new Set(['0363100012800005']);
  const own = new Map([['0363100012800001', { answer: read('0363100012800001', { crown: 'cornice', bays: 3 }), sample: '#5a4a40', ref: 'own/0363100012800001.json' }]]);
  const a = generateBelt(pands, streets, described, own, DONORS, '2026-11-15');
  const b = generateBelt([...pands].reverse(), streets, described, own, DONORS, '2026-11-15');
  assert.equal(JSON.stringify(a.rows), JSON.stringify(b.rows), 'deterministic');
  assert.equal(a.rows.length, 1);
  assert.ok(!a.rows[0].members.some(m => m.pandId === '0363100012800005'));
  assert.deepEqual(a.provenance['0363100012800001'], { own: true, ref: 'own/0363100012800001.json' });
  for (const id of ['0363100012800000', '0363100012800002']) assert.ok('donor' in a.provenance[id], id);
  for (const s of a.rows[0].series) {
    const donorOnly = s.fronts.every(f => 'donor' in a.provenance[f.split('#')[0]]);
    if (!donorOnly) continue;
    for (const [k, v] of Object.entries(s.design)) {
      const f = v as { source?: string; ref?: string } | undefined;
      if (!f?.source) continue;
      assert.ok(f.source === 'period-default' || f.source === 'reviewed', `${s.id} ${k}: ${f.source}`);
      if (f.source === 'period-default' && /donor/.test(f.ref ?? '')) assert.ok(f.ref!.startsWith(BELT_LOOK_REF));
    }
  }
  // A belt read's door surround over a stoop draws the stone doorcase.
  assert.ok(a.rows[0].fronts.every(f => f.ground.doorcase?.material === 'stone'));
});

test('belt stone: 1700s necks and bells only, deterministic, near the audited rates, never over a stated stone', async () => {
  const { beltStone, dressBeltStone, BELT_STONE_RATES } = await import('./stone.ts');
  assert.equal(beltStone('a', 'cornice', 1750), null);
  assert.equal(beltStone('a', 'neck', 1650), null);
  assert.equal(beltStone('a', 'step', 1750), null);
  assert.deepEqual(beltStone('k1', 'neck', 1750), beltStone('k1', 'neck', 1750));
  let carved = 0, hood = 0, cart = 0, ocu = 0;
  const n = 2000;
  for (let i = 0; i < n; i++) {
    const s = beltStone(`03631000127${String(i).padStart(5, '0')}`, 'neck', 1740) ?? {};
    if (s.claws === 'carved') carved++; if (s.hood === 'dark') hood++; if (s.neck === 'cartouche') cart++; if (s.neck === 'oculus') ocu++;
    assert.equal(beltStone(`x${i}`, 'bell', 1740)?.neck, undefined, 'a bell has no neck');
  }
  assert.ok(Math.abs(carved / n - BELT_STONE_RATES.carvedClaws) < 0.04, `carved ${carved / n}`);
  assert.ok(Math.abs(hood / n - BELT_STONE_RATES.darkHood) < 0.04, `hood ${hood / n}`);
  assert.ok(Math.abs(cart / n - BELT_STONE_RATES.neckCartouche) < 0.04, `cartouche ${cart / n}`);
  assert.ok(Math.abs(ocu / n - BELT_STONE_RATES.neckOculus) < 0.04, `oculus ${ocu / n}`);
  const row = { members: [{ pandId: 'p1', built: 1740 }], series: [
    { id: 's1', fronts: ['p1'], design: { crown: { value: 'neck' }, gable: { value: { riseM: 4.2 }, source: 'period-default', ref: 'r' } } },
    { id: 's2', fronts: ['p1'], design: { crown: { value: 'neck' }, gable: { value: { riseM: 4.2, stone: { claws: false } }, source: 'period-default', ref: 'r' } } },
    { id: 's3', fronts: ['p1'], design: { crown: { value: 'neck' }, gable: { value: { riseM: 4.2 }, source: 'reviewed', ref: 'r' } } },
  ] } as never;
  dressBeltStone(row, 'look');
  const ss = (row as { series: Array<{ design: { gable: { value: { stone?: unknown } } } }> }).series;
  assert.deepEqual(ss[0].design.gable.value.stone, beltStone('p1', 'neck', 1740) ?? undefined);
  assert.deepEqual(ss[1].design.gable.value.stone, { claws: false });
  assert.equal(ss[2].design.gable.value.stone, undefined);
});

test('belt cornice: 1800s cornice series only, deterministic, near the read rates, a centre only on three bays or more', async () => {
  const { beltCornice, dressBeltCornice, BELT_CORNICE_RATES } = await import('./cornice.ts');
  assert.equal(beltCornice('a', 1750, 3), null);
  assert.deepEqual(beltCornice('k', 1850, 3), beltCornice('k', 1850, 3));
  const n = 3000, count: Record<string, number> = {};
  for (let i = 0; i < n; i++) { const d = beltCornice(`p${i}`, 1850, 4)!; for (const k of ['paint', 'frieze', 'supports', 'centre'] as const) { const key = `${k}:${d[k] ?? null}`; count[key] = (count[key] ?? 0) + 1; } assert.equal(beltCornice(`p${i}`, 1850, 2)!.centre, undefined); }
  // Round 7: the centre is the register's (a balustrade or pediment it names), never drawn at a rate.
  assert.equal(count['centre:null'], n);
  assert.equal(beltCornice('k', 1850, 3, ['balustrade'])!.centre, 'balustrade');
  assert.equal(beltCornice('k', 1850, 3, ['pediment'])!.centre, 'pediment');
  assert.equal(beltCornice('k', 1850, 2, ['balustrade'])!.centre, undefined);
  for (const k of ['paint', 'frieze', 'supports'] as const) {
    const w = BELT_CORNICE_RATES[k] as ReadonlyArray<readonly [unknown, number]>, tot = w.reduce((s, [, x]) => s + x, 0);
    for (const [v, x] of w) assert.ok(Math.abs((count[`${k}:${v}`] ?? 0) / n - x / tot) < 0.04, `${k} ${v}`);
  }
  const row = { members: [{ pandId: 'p1', built: 1850 }], series: [
    { id: 's1', fronts: ['p1'], design: { crown: { value: 'cornice' }, bays: { value: 3 } } },
    { id: 's2', fronts: ['p1'], design: { crown: { value: 'neck' }, bays: { value: 3 } } },
    { id: 's3', fronts: ['p1'], design: { crown: { value: 'cornice' }, bays: { value: 3 }, corniceDress: { value: { paint: 'grey' }, source: 'reviewed', ref: 'r' } } },
  ] } as never;
  dressBeltCornice(row, 'look');
  const ss = (row as { series: Array<{ design: { corniceDress?: { value: unknown; source: string } } }> }).series;
  assert.deepEqual(ss[0].design.corniceDress?.value, beltCornice('p1', 1850, 3));
  assert.equal(ss[0].design.corniceDress?.source, 'period-default');
  assert.equal(ss[1].design.corniceDress, undefined);
  assert.deepEqual(ss[2].design.corniceDress?.value, { paint: 'grey' });
});

test('front top: 3DBAG eaves unless a rear eave or mansard sits well under the front (Leidsestraat, Amstelstraat)', () => {
  assert.equal(frontTopM(9.3, 17.66, null), 17.66, 'Leidsestraat 176397: no ridge, eaves under 0.75 of the height');
  assert.equal(frontTopM(22, 27.76, 25.6), 22, 'Leidsestraat 176395: a pitched roof over its eaves');
  assert.equal(frontTopM(8.8, 14.05, 12), 14.05, 'Leidsestraat 176398: the ridge under the height is a lower part');
  assert.equal(frontTopM(5.3, 14.16, 13.9), 13.9, 'Amstelstraat 182681: a mansard 8.6 m over its eaves stands at the ridge');
  assert.equal(frontTopM(10.8, 12.8, 14.4), 10.8);
  assert.equal(frontTopM(null, 12, null), 12);
});
test('front top: Reguliersbreestraat 179879 (no ridge, eaves 0.75 of the height) stands at the height', () => {
  assert.equal(frontTopM(12.6, 16.84, null), 16.84);
});

test('a shop pand prefers a shop donor and its fitted read has a shopfront ground, never a stoop', () => {
  const shopDonor = donor('0363100012900009', 'Keizersgracht', 1690, 6.2, 13, { crown: 'cornice', ground: 'shopfront' } as never);
  const d = donorFor({ ...target(), shop: true, statedCrown: 'cornice' }, [...DONORS, shopDonor])!;
  assert.equal(fittedRead({ ...target(), shop: true }, d.donor).ground, 'shopfront');
  const f = fittedRead({ ...target(), shop: true }, DONORS[2]);
  assert.equal(f.ground, 'shopfront');
  assert.notEqual(f.basement, 'stoop');
});

test('register silent: a donor pand takes a cornice; register finish and storeys are drawn; a cornice front stands at the height', () => {
  for (let i = 0; i < 40; i++) {
    const d = donorFor({ ...target(), pandId: `03631000128${String(i).padStart(5, '0')}` }, DONORS)!;
    assert.ok(!['neck', 'bell', 'step', 'point', 'spout'].includes(String(d.donor.answer.crown)), 'unstated takes no gable');
  }
  const f = fittedRead({ ...target(), finish: 'plaster', storeys: 5 }, DONORS[2]) as unknown as { finish: string; pale: boolean; storeys: number };
  assert.equal(f.finish, 'stucco'); assert.equal(f.pale, true); assert.equal(f.storeys, 5);
  const pands = Array.from({ length: 3 }, (_, i) => ({ ...pand(i), eavesM: 9, ridgeM: 12, heightM: 13.5 }));
  const res = generateBelt(pands, streets, new Set(), new Map(), DONORS, '2026-11-15');
  for (const s of res.rows[0].series) assert.equal(s.design.corniceTopM.value, 13.5, 'a cornice front at the representative height');
});

test('a belt read frieze cornice draws RowCorniceDress.frieze (attic-frieze: attic lights, frieze: panels)', () => {
  const pands = Array.from({ length: 2 }, (_, i) => ({ ...pand(i), year: 1850 }));
  for (const [cornice, frieze] of [['attic-frieze', 'attic-lights'], ['frieze', 'panels']] as const) {
    const own = new Map(pands.map(p => { const id = p.id.slice(-16); return [id, { answer: read(id, { cornice } as never), sample: '#5a4a40', ref: `own/${id}` }]; }));
    const res = generateBelt(pands, streets, new Set(), own, DONORS, '2026-11-15');
    for (const s of res.rows[0].series) assert.equal((s.design.corniceDress?.value as { frieze?: string }).frieze, frieze);
    assert.ok(!res.rows[0].readNotDrawn.some(x => x.field === 'cornice'), 'the frieze is drawn, not noted');
  }
});

test('round 5: a donor brings no roof storey the register does not state, no paint the register does not state, no shop without one on record', () => {
  const m = donor('0363100012900007', 'Keizersgracht', 1700, 6.2, 13, { crown: 'mansard', finish: 'stucco', pale: true, ground: 'shopfront', basement: 'none',
    storeyParts: { full: 4, roof: 'mansard', souterrain: false }, dormers: { kind: 'pediment', count: 2 }, gaps: [{ component: 'dormer', what: 'two pedimented dormers in the slate mansard' }] } as never);
  const f = fittedRead(target(), m) as unknown as { crown: string; finish: string; pale?: boolean; ground: string; storeyParts: { roof: string }; dormers: { count: number }; gaps: unknown[] };
  assert.deepEqual([f.crown, f.storeyParts.roof, f.dormers.count, f.gaps.length], ['cornice', 'none', 0, 0]);
  assert.deepEqual([f.finish, f.pale, f.ground], ['brick', undefined, 'dwelling']);
  const g = fittedRead(target({ roofStorey: true, finish: 'painted', shop: true }), m) as unknown as typeof f;
  assert.deepEqual([g.storeyParts.roof, g.dormers.count, g.finish, g.ground], ['mansard', 2, 'stucco', 'shopfront'], 'stated: drawn as the donor read it');
  // A no-shop pand prefers a house donor.
  const shopDonor = donor('0363100012900008', 'Keizersgracht', 1690, 6.2, 13, { ground: 'shopfront' });
  const houseDonor = donor('0363100012900009', 'Keizersgracht', 1690, 6.2, 13);
  assert.equal(donorFor(target({ pandId: '0363100012800009' }), [shopDonor, houseDonor].map(d => ({ ...d })))!.of, 2);
  // Only a brick donor's non-buff sample is lent.
  assert.equal(brickDonorSample({ answer: read('x'), sample: '#6a5040' }), '#6a5040');
  assert.equal(brickDonorSample({ answer: read('x', { finish: 'stucco' } as never), sample: '#d8d0c0' }), undefined);
  assert.equal(brickDonorSample({ answer: read('x'), sample: '#c9a46a' }), undefined, 'a buff (tan) sample');
});

test('round 6: own dormers are no mansard unless seen as one or stated; pakhuis fronts; measured gable rise; register stone; a roof storey under the height', () => {
  // Keizersgracht 176027 and 165044: one dormer read over a cornice (roof part none / dormers) is not a mansard front.
  const dorm = stripRoofStorey(read('x', { storeyParts: { full: 4, roof: 'dormers', souterrain: false }, dormers: { count: 1, kind: 'plain' } } as never), true) as unknown as { dormers: { count: number }; storeyParts: { roof: string } };
  assert.deepEqual([dorm.dormers.count, dorm.storeyParts.roof], [0, 'none']);
  const seen = stripRoofStorey(read('x', { storeyParts: { full: 4, roof: 'mansard', souterrain: false }, dormers: { count: 2, kind: 'plain' } } as never), true) as unknown as { dormers: { count: number } };
  assert.equal(seen.dormers.count, 0, 'a read mansard is not kept without a stated roof storey (round 7 sample)');
  const statedM = mansardAsDormers(read('x', { crown: 'mansard', storeyParts: { full: 4, roof: 'mansard', souterrain: false }, dormers: { count: 3, kind: 'plain' } } as never)) as unknown as { crown: string; dormers: { count: number }; storeyParts: { roof: string } };
  assert.deepEqual([statedM.crown, statedM.storeyParts.roof, statedM.dormers.count], ['cornice', 'dormers', 3], 'a stated roof storey over a read mansard: dormers');
  // Molenpad 174768: a register dormer (roof storey) over 3DBAG eaves 7.2, height 14.07: the cornice at 14.07 - 2.2.
  assert.equal(corniceLine({ crown: 'cornice' }, { heightM: 14.07, roofStorey: true }, 14.07, 7.2), 11.87);
  assert.equal(corniceLine({ crown: 'cornice' }, { heightM: 14.07 }, 12, 12), 14.07, 'no roof storey: the height');
  assert.equal(corniceLine({ crown: 'neck' }, { heightM: 14.07, roofStorey: true }, 12, 12), 12, 'a gable stands at the front top');
  assert.deepEqual(registerStone('neck', ['claws', 'festoons', 'oeilDeBoeuf']), { claws: 'carved', festoon: true });
  assert.deepEqual(registerStone('neck', ['oeilDeBoeuf']), { neck: 'oculus' });
  assert.equal(registerStone('cornice', ['claws']), null);
  assert.ok(warehouseRead(read('x', { ground: 'warehouse' } as never)) && !warehouseRead(read('x', { notes: 'the dark warehouse front beside it' } as never)));

  const ps = Array.from({ length: 4 }, (_, i) => pand(i));
  // 0: own read with one dormer and the roof unseen; 1: a register pakhuis with a point gable; 2: a register point gable
  // over measured eaves 13.7 and ridge 16.8 (Driekoningenstraat 167637); 3: a register neck with claws and a festoon.
  Object.assign(ps[1], { eavesM: 12.8, ridgeM: 17.2, heightM: 15.85, year: 1650 });
  Object.assign(ps[2], { eavesM: 13.7, ridgeM: 16.8, heightM: 15.8, year: 1737 });
  Object.assign(ps[3], { eavesM: 13, ridgeM: 17.4, heightM: 15.5, year: 1660 });
  const id = (i: number) => `03631000128000${String(i).padStart(2, '0')}`;
  const own = new Map([[id(0), { answer: read(id(0), { storeyParts: { full: 4, roof: 'none', souterrain: false }, dormers: { count: 1, kind: 'gabled' } } as never), sample: '#5a4a40', ref: 'own' }]]);
  const donors = [...DONORS, donor('0363100012900007', 'Keizersgracht', 1650, 6, 12.8, { crown: 'point', storeys: 5, bays: 3, ground: 'warehouse' }),
    donor('0363100012900008', 'Keizersgracht', 1730, 6, 13.5, { crown: 'point', storeys: 4, bays: 3 })];
  const stated = new Map([[id(1), { crown: 'point', warehouse: true }], [id(2), { crown: 'point' }], [id(3), { crown: 'neck', elements: ['claws', 'festoons'] }]]);
  const r = generateBelt(ps, streets, new Set(), own, donors, '2026-11-15', stated as never);
  const row = r.rows[0], sOf = (i: number) => row.series.find(s => s.fronts.some(f => f.startsWith(id(i))))!, fOf = (i: number) => row.fronts.find(f => f.pandId === id(i))!;
  assert.equal(sOf(0).design.roofStorey.value.kind, 'none', 'own dormer over a cornice: no mansard');
  const ex = (i: number) => ((fOf(i).overrides as { extras?: { value: string[] } }).extras?.value ?? sOf(i).design.extras.value);
  assert.deepEqual(WAREHOUSE_EXTRAS.filter(x => ex(1).includes(x)), [...WAREHOUSE_EXTRAS]);
  assert.ok(!ex(2).includes('warehouse-shutters'), 'the house beside it draws no loading doors');
  assert.notEqual(fOf(2).ground.use, 'warehouse');
  assert.equal(fOf(1).ground.use, 'warehouse');
  const g2 = (fOf(2).overrides as { gable?: { value: { riseM: number } } }).gable;
  assert.deepEqual([g2?.value.riseM, fOf(2).topM], [3.1, 13.7], 'the gable from the measured front top to the ridge');
  const st3 = (sOf(3).design.gable?.value as { stone?: { claws?: unknown; festoon?: boolean } } | undefined)?.stone;
  assert.deepEqual([st3?.claws, st3?.festoon], ['carved', true], 'the register names claws and a festoon (any year)');
});

test('AHN street fronts: the band over the front line; a cornice at its p90 within the 3DBAG roof; a gable apex under the ridge', () => {
  // A 6 m front along y = 0, a wall top at 9.6 m in the band, the roof rising to 14.6 m behind it (Molenpad 174768).
  const cells: Array<[number, number, number]> = [];
  for (let x = 0.25; x < 6; x += 0.5) for (let y = 0.25; y < 10; y += 0.5) cells.push([x, y, 1 + (y <= 1.5 ? 9.6 : 9.6 + Math.min(5, (y - 1.5)))]);
  const a = frontBandHeights(cells, Array(20).fill(1), [0, 0], [6, 0])!;
  assert.deepEqual([a.p90, a.max], [9.6, 9.6]);
  assert.equal(ahnCorniceTop(a, { eavesM: 7.2, heightM: 14.07, ridgeM: 15.5 }), 9.6);
  assert.equal(ahnCorniceTop({ ...a, p90: 25 }, { eavesM: 7.2, heightM: 14.07, ridgeM: 15.5 }), null, 'over the ridge: not the front (a tree, a tower)');
  assert.equal(ahnCorniceTop({ ...a, p90: 4 }, { eavesM: 7.2, heightM: 14.07, ridgeM: 15.5 }), null, 'well under the eaves');
  // Molenpad's pakhuis: AHN front top 14.59 under a 17.2 m ridge on 12.8 m eaves: the apex at 14.8 (the 2 m minimum rise).
  assert.equal(ahnGableApex({ n: 100, p50: 13.5, p90: 14.4, max: 14.59 }, 12.8, 17.2), 14.8);
  assert.equal(ahnGableApex({ n: 30, p50: 13, p90: 15.4, max: 16.15 }, 13.7, 16.8), 16.15);
  assert.equal(ahnGableApex(undefined, 13.7, 16.8), 16.8);
});

test('round 8: pitched dormers, not a mansard; bays by width; storeys under a souterrain; photo samples and spec colour flags; step gables on a partial run', async () => {
  const { pitchedDormers, strongPhoto, specPhotoDisagree } = await import('./generate.ts');
  const { beltBays } = await import('./donors.ts');
  const { runTakesSteps, runTakesTrace } = await import('../houseLine/rowFront.ts');
  const { rowRoofOf } = await import('../roofMesh.ts');
  // A register dakkapel: the series roof storey becomes dormers in a tile pitched roof; a spec-stated mansard stays.
  const rs = { value: { kind: 'mansard' as const, material: 'slate' as const, dormersPerFront: 1 }, source: 'period-default' as const, ref: 'r' };
  const row = { series: [{ id: 's1', design: { roofStorey: structuredClone(rs) } }], fronts: [{ pandId: 'p1', seriesId: 's1', overrides: {} }] } as never;
  const out = pitchedDormers(row, new Map([['p1', { roofStorey: true }]])) as unknown as { series: Array<{ design: { roofStorey: { value: { pitched?: boolean; material?: string } } } }> };
  assert.deepEqual([out.series[0].design.roofStorey.value.pitched, out.series[0].design.roofStorey.value.material], [true, 'slate']);
  const kept = pitchedDormers({ series: [{ id: 's1', design: { roofStorey: structuredClone(rs) } }], fronts: [{ pandId: 'p1', seriesId: 's1', overrides: {} }] } as never, new Map([['p1', { roofStorey: true, mansard: true }]])) as unknown as typeof out;
  assert.equal(kept.series[0].design.roofStorey.value.pitched, undefined, 'a spec-stated mansard stays a mansard');
  assert.deepEqual(rowRoofOf({ riseM: 3, series: 's', dormers: [{ a: 0.5, kind: 'plain' }], shape: 'hipped' })?.shape, 'hipped');
  assert.equal(rowRoofOf({ riseM: 2.2, series: 's', dormers: [] })?.shape, undefined, 'absent: a mansard, as before');
  // Amstel 182460 (5.11 m) and 182461 (4.92 m): three bays; a 4.27 m front two; 9.35 m four.
  assert.deepEqual([beltBays(5.11), beltBays(4.92), beltBays(4.27), beltBays(9.35)], [3, 3, 2, 4]);
  // Prinsengracht 175987: 11.46 m over a souterrain at a 4.3 m pitch: two storeys, not three.
  const f = fittedRead(target({ eavesM: 11.46, widthM: 9.35 }), donor('0363100012176314', 'Prinsengracht', 1700, 9, 12.9, { storeys: 3, bays: 3, basement: 'souterrain' } as never));
  assert.equal(f.storeys, 2);
  // Keizersgracht 176392: the unreadable cut's wall sample is strong; foliage and few pixels are not.
  assert.equal(strongPhoto({ hex: '#4a423b', L: 0.386, C: 0.016, h: 64, n: 384 }), true);
  assert.equal(strongPhoto({ hex: '#4a5a3b', L: 0.45, C: 0.05, h: 130, n: 400 }), false);
  assert.equal(strongPhoto({ hex: '#4a423b', L: 0.386, C: 0.016, h: 64, n: 50 }), false);
  assert.equal(specPhotoDisagree({ specHex: '#c9b48a', photo: { hex: '#4a423b', L: 0.386, C: 0.016, h: 64, n: 384 } })?.photoHex, '#4a423b');
  assert.equal(specPhotoDisagree({ specHex: '#4d443c', photo: { hex: '#4a423b', L: 0.386, C: 0.016, h: 64, n: 384 } }), null);
  // Prinsengracht 175981: a 2.51 m street run of a 4.11 m front takes its step gable; a longer run (a corner) still does not.
  assert.equal(runTakesTrace(2.51, 4.11), false);
  assert.equal(runTakesSteps(2.51, 4.11), true);
  assert.equal(runTakesSteps(1.6, 4.11), false);
  assert.equal(runTakesSteps(6.5, 4.11), false);
});

test('round 9: an attiek is no roof storey; a register-silent pand takes no donor gable; a donor full frame stays with the donor', async () => {
  const { registerRoofStorey } = await import('./generate.ts');
  // Keizersgracht 177468: register stoep + attiek, a flat white cornice in the photo.
  assert.equal(registerRoofStorey(['stoop', 'attic']), false);
  assert.equal(registerRoofStorey(['dormer']), true);
  // Keizersgracht 171508: register silent; a donor never brings a gable (its own read's necks, seen on the 2023 cut, stay).
  const d = donorFor(target({ pandId: '0363100012171508', eavesM: 10.91, ridgeM: 15.13, roofCode: 3 }), DONORS);
  assert.ok(d && !['neck', 'bell', 'step', 'spout', 'point'].includes(String(d.donor.answer.crown)));
  // Reguliersgracht 178585: a donor's full-frame surround does not travel.
  const f = fittedRead(target(), donor('0363100012174842', 'Keizersgracht', 1700, 6.3, 15, { windowSurround: 'full-frame' } as never)) as unknown as { windowSurround: string };
  assert.equal(f.windowSurround, 'none');
});

test('round 9: the photo finish reader states stucco and paint only when confident; a stated paint paints a brick donor', async () => {
  const { photoFinish } = await import('./generate.ts');
  // Singel 167687: a confident stucco read is a plastered front (pale stucco, not the donor's brick).
  assert.equal(photoFinish({ finish: 'stucco', confidence: 0.85, reader: 'opus (cut)' }), 'plaster');
  assert.equal(photoFinish({ finish: 'paint', confidence: 0.75, reader: 'opus (cut)' }), 'painted');
  assert.equal(photoFinish({ finish: 'stucco', confidence: 0.6, reader: 'opus (cut)' }), undefined);
  assert.equal(photoFinish({ finish: 'unclear', confidence: 0.9, reader: 'opus (cut)' }), undefined);
  const s = fittedRead(target({ finish: 'plaster' }), donor('0363100012174842', 'Keizersgracht', 1700, 6.3, 15, { finish: 'brick' } as never)) as unknown as { finish: string; pale?: boolean };
  assert.deepEqual([s.finish, s.pale], ['stucco', true]);
  const p = fittedRead(target({ finish: 'painted' }), donor('0363100012174842', 'Keizersgracht', 1700, 6.3, 15, { finish: 'brick' } as never)) as unknown as { finish: string };
  assert.equal(p.finish, 'painted-brick');
});

test('round 9: a row pitched roof storey runs one ridge along the row (Marnixstraat 172599: no pyramid per house); a row end is hipped', async () => {
  const { roofTriangles } = await import('../roofMesh.ts');
  const rect = { cx: 0, cy: 0, ux: 1, uy: 0, len: 15, wid: 5.5, coverage: 1, maxDev: 0 };
  const plan = (joins?: { left?: boolean; right?: boolean }) => ({ kind: 'hipped', gable: 'plain', riseM: 3, dormers: true, material: 'slate', tone: 0.5, seed: 's', chimney: false, accents: true, rowDormers: [{ a: 0.5, kind: 'plain' }], ...(joins ? { rowJoins: joins } : {}) }) as never;
  const dims = { bayM: 3, storeyM: 3, cellM: 1 };
  const ridge = (tris: ReturnType<typeof roofTriangles>) => tris.filter(t => t.part === 'slope').flatMap(t => t.p).filter(p => Math.abs(p[2] - 13) < 1e-6).map(p => p[1]);
  // Joined both sides (a middle member): the ridge spans the whole front, the party walls closed by plates, no hips.
  const mid = roofTriangles(rect, plan({ left: true, right: true }), 10, dims);
  const rm = ridge(mid);
  assert.ok(Math.min(...rm) <= -2.74 && Math.max(...rm) >= 2.74, `ridge spans the front: ${Math.min(...rm)}..${Math.max(...rm)}`);
  assert.equal(mid.filter(t => t.part === 'plate').length, 2);
  // The ridge runs across the front (along the row), 3 m behind the street eaves, not down the depth of the house.
  const us = mid.filter(t => t.part === 'slope').flatMap(t => t.p).filter(p => Math.abs(p[2] - 13) < 1e-6).map(p => p[0]);
  assert.ok(Math.max(...us) - Math.min(...us) < 1e-6, 'one ridge line');
  // A row end (joined on one side only): hipped on the open side, the ridge stops short of that wall.
  const end = ridge(roofTriangles(rect, plan({ right: true }), 10, dims));
  assert.ok(Math.max(...end) - Math.min(...end) < 5.5 - 1e-6);
  // The dormer stands on the street slope.
  assert.ok(mid.some(t => t.part === 'dormerFace'));
});

test('round 10: the photo crown reader states a confident gable, a tall cornice and a plausible storey count', async () => {
  const { photoCrown, plausiblePhotoStoreys, tallCorniceTop } = await import('./generate.ts');
  // Singel 168333 / Amstel 165494 (necks drawn flat in round 9): a confident neck read states the crown; a low one does not.
  assert.equal(photoCrown({ crown: 'neck', cornice: 'none', full: 4, souterrain: false, cc: 0.85, sc: 0.8 }).crown, 'neck');
  assert.equal(photoCrown({ crown: 'neck', cornice: 'none', full: 4, souterrain: false, cc: 0.6, sc: 0.8 }).crown, undefined);
  // A cornice read never states a crown (unstated is already a cornice); a bracketed one is a tall cornice.
  assert.deepEqual(photoCrown({ crown: 'cornice', cornice: 'bracketed', full: 5, souterrain: false, cc: 0.8, sc: 0.5 }), { tallCornice: 'bracketed' });
  assert.deepEqual(photoCrown({ crown: 'cornice', cornice: 'attic-frieze', full: 4, souterrain: true, cc: 0.75, sc: 0.6 }), { tallCornice: 'attic-frieze' });
  // A plain cornice states nothing: the flat-cornice fronts keep the p90.
  assert.deepEqual(photoCrown({ crown: 'cornice', cornice: 'simple', full: 4, souterrain: false, cc: 0.9, sc: 0.5 }), {});
  // Prinsengracht 173559: three storeys over a souterrain under a neck whose foot is 9.1 m is a plausible pitch (2.53 m).
  assert.equal(plausiblePhotoStoreys(3, true, 9.1), 3);
  assert.equal(plausiblePhotoStoreys(6, false, 9.1), undefined);
  assert.equal(plausiblePhotoStoreys(1, false, 9.1), undefined);
  // Keizersgracht 172210 (photo read: attic frieze, cc 0.75): a tall cornice stands at the band's top (19.19 m), not its p90 (18.01 m).
  const pand = { eavesM: 14.7, heightM: 18.13, ridgeM: null };
  assert.equal(tallCorniceTop({ n: 49, p50: 13.47, p90: 18.01, max: 19.19 }, pand), 19.19);
  // A max far over the p90 (a chimney, the roof behind) is not the cornice.
  assert.equal(tallCorniceTop({ n: 49, p50: 13.47, p90: 16, max: 18.6 }, pand), null);
});

test('round 10 pins on the staged belt (data/buurt-generators/belt/row-front.json)', async () => {
  const fs = await import('node:fs');
  const recs = new Map<string, { crown?: { family?: string }; storeys?: number; topM?: number; eavesM?: number; series?: { cornice?: string } }>(
    JSON.parse(fs.readFileSync('data/buurt-generators/belt/row-front.json', 'utf8')).records.map((r: { pandId: string }) => [r.pandId, r]));
  const rec = (id: string) => recs.get(`0363100012${id}`)!;
  // Necks the round-9 judges saw drawn flat: Singel 168333 house 1, Amstel 165494 (row 182625 house 2), Prinsengracht 173557.
  for (const id of ['168333', '165494', '173557']) assert.equal(rec(id).crown?.family, 'neck', id);
  // Prinsengracht 173559: three storeys under its neck (two in round 9).
  assert.equal(rec('173559').storeys, 3);
  // Keizersgracht 172210: its attic-frieze cornice at the AHN band's top, 19.19 m (18.01 m in round 9).
  assert.equal(rec('172210').eavesM, 19.19);
  assert.equal(rec('172210').series?.cornice, 'attic-frieze');
  // Singel 177196 (held-out round 10, Singel 177194 house 2): a photo bell over four storeys stands its foot at 11.2 m (four
  // storeys at 2.8 m, under the AHN apex 13.43 m less 2 m), not on 3DBAG's rear eave 8.7 m with two storeys.
  assert.equal(rec('177196').storeys, 4);
  // Round 12: at the belt's gable foot pitch (3.0 m) the foot is 12 m and the apex 15.5 m (the 2023 pano: shoulders ~12 m,
  // the neck's top ~16.5 m; AHN's 13.43 m misses the thin top).
  assert.equal(rec('177196').eavesM, 12);
  assert.ok(rec('177196').topM! >= 15);
});

test('round 11: two crown reads on different captures, and the photo colour read', async () => {
  const { mergeCrownReads, photoColourWall, photoColourWalls } = await import('./generate.ts');
  const r = (crown: string, cc: number, full: number | null = 4, sc = 0.8) => ({ crown, cornice: 'none', full, souterrain: false, cc, sc });
  // Prinsengracht 173558: a low neck read (0.55) and a confident second capture (neck 0.85, three storeys) states the neck.
  assert.equal(mergeCrownReads(r('neck', 0.55, 4, 0.55), r('neck', 0.85, 3, 0.85)).crown, 'neck');
  assert.equal(mergeCrownReads(r('neck', 0.55, 4, 0.55), r('neck', 0.85, 3, 0.85)).full, 3);
  // A not-visible first read takes the second's gable; a confident first read is kept over a weaker second.
  assert.equal(mergeCrownReads(r('not-visible', 0.8), r('step', 0.75)).crown, 'step');
  assert.equal(mergeCrownReads(r('bell', 0.85), r('neck', 0.75)).crown, 'bell');
  // Two confident reads that disagree on gabled against flat state no crown; on storeys, no storey count.
  const c = mergeCrownReads(r('bell', 0.8), r('cornice', 0.8));
  assert.ok(c.cc < 0.7 && c.conflict?.includes('crown'));
  assert.ok(mergeCrownReads(r('bell', 0.8, 4), r('bell', 0.8, 5)).sc < 0.7);
  // Keizersgracht 167979 (held-out round 10, Keizersgracht 167982 house 2): red-brown brick drawn buff from a washed-out
  // sample; a confident colour read draws it red-brown. A low read, an unclear one and a published spec colour do nothing.
  assert.deepEqual(photoColourWall({ photoColour: { finish: 'brick', family: 'red-brown-brick', confidence: 0.75 } }), { family: 'red-brown-brick', finish: 'brick' });
  assert.equal(photoColourWall({ photoColour: { finish: 'brick', family: 'red-brown-brick', confidence: 0.6 } }), undefined);
  assert.equal(photoColourWall({ photoColour: { finish: 'unclear', family: 'unclear', confidence: 0.9 } }), undefined);
  assert.equal(photoColourWall({ specHex: '#6f5543', photoColour: { finish: 'brick', family: 'red-brown-brick', confidence: 0.9 } }), undefined);
  assert.deepEqual(photoColourWall({ photoColour: { finish: 'stucco', family: 'white-paint', confidence: 0.8 } }), { family: 'painted-white', finish: 'stucco' });
  assert.deepEqual(photoColourWall({ photoColour: { finish: 'paint', family: 'dark-paint', confidence: 0.8 } }), { family: 'painted-black', finish: 'painted-brick' });
  const recs = [{ pandId: '0363100012167979', wall: { hex: '#b39c75', source: 'judged', finish: 'brick' }, sources: { wall: 'judged buff-brick (x)' } }] as never[];
  const tally = photoColourWalls(recs, new Map([['0363100012167979', { photoColour: { finish: 'brick', family: 'red-brown-brick', confidence: 0.75 } }]]));
  assert.deepEqual(tally, { 'buff-brick -> red-brown-brick': 1 });
  assert.notEqual((recs[0] as { wall: { hex: string } }).wall.hex, '#b39c75');
});

test('round 11 pins on the staged belt (data/buurt-generators/belt/row-front.json)', async () => {
  const fs = await import('node:fs');
  const recs = new Map<string, { crown?: { family?: string }; storeys?: number; wall?: { finish?: string }; sources?: { wall?: string } }>(
    JSON.parse(fs.readFileSync('data/buurt-generators/belt/row-front.json', 'utf8')).records.map((r: { pandId: string }) => [r.pandId, r]));
  const rec = (id: string) => recs.get(`0363100012${id}`)!;
  // Held-out round 10's "ornate flat tops drawn as gables" are gables on two capture dates: Singel 177194 a bell with a
  // white top (2022 and 2023 cuts, cc 0.85 both), Keizersgracht 180133 (180047 house 4) a step gable (its own D1 read, and
  // the 2023 cut at 0.75). They stay gables.
  assert.equal(rec('177194').crown?.family, 'bell');
  assert.equal(rec('180133').crown?.family, 'step');
  // Prinsengracht 173558: a neck read at 0.55 on the 2023-02-27 cut, 0.85 on the 2023-02-13 cut: a neck over three storeys.
  assert.equal(rec('173558').crown?.family, 'neck');
  assert.equal(rec('173558').storeys, 3);
  // Prinsengracht 167557 (Keizersgracht side street): painted black brick drawn pale grey stucco from a colourless paint read.
  assert.match(rec('167557').sources?.wall ?? '', /^judged painted-black \(photo colour read/);
  assert.equal(rec('167557').wall?.finish, 'painted-brick');
});

test('round 12: pale blocks (adjacent stucco or stone members) are one front', async () => {
  const { paleEvidence, paleRuns, paleBlockWalls } = await import('./generate.ts');
  assert.equal(paleEvidence({ finish: 'plaster' }), true);
  assert.equal(paleEvidence({ finish: 'brick', photoColour: { finish: 'stucco', family: 'pale-grey', confidence: 0.9 } }), false);
  assert.equal(paleEvidence(undefined, { finish: 'stone' } as never), true);
  assert.equal(paleEvidence({ photoColour: { finish: 'stucco', family: 'white-paint', confidence: 0.75 } }), true);
  assert.equal(paleEvidence({ photoColour: { finish: 'stucco', family: 'white-paint', confidence: 0.6 } }), false);
  assert.deepEqual(paleRuns([true, false, true, true, true, false, true]), [[2, 3, 4]]);
  const recs = [
    { pandId: 'a', wall: { hex: '#111111', source: 'judged', finish: 'brick' }, sources: { wall: 'judged brown-brick' } },
    { pandId: 'b', wall: { hex: '#cccccc', source: 'judged', finish: 'stone' }, sources: { wall: 'judged grey-stone' } },
    { pandId: 'c', wall: { hex: '#dddddd', source: 'judged', finish: 'stucco' }, sources: { wall: 'judged pale-grey-stucco (photo colour read 0.8)' } },
  ] as never[];
  assert.equal(paleBlockWalls(recs, [['a', 'b', 'c']]), 2);
  assert.deepEqual((recs as { wall: { hex: string; finish: string } }[]).map(r => r.wall.hex + r.wall.finish), ['#ddddddstucco', '#ddddddstucco', '#ddddddstucco']);
});

test('round 12 pins on the staged belt: roof storeys on photo evidence, gable feet at the photo storeys, pale blocks', async () => {
  const fs = await import('node:fs');
  const { BELT_LOOK, BELT_GABLE_FOOT_PITCH_M } = await import('./donors.ts');
  assert.equal(BELT_LOOK.roofStoreyNeedsPhoto, true);
  assert.equal(BELT_LOOK.gableFootPitchM, BELT_GABLE_FOOT_PITCH_M);
  type Rec = { crown?: { family?: string }; storeys?: number; eavesM?: number; topM?: number; wall?: { hex?: string; finish?: string }; series?: { roofStorey?: { kind?: string } } };
  const recs = new Map<string, Rec>(JSON.parse(fs.readFileSync('data/buurt-generators/belt/row-front.json', 'utf8')).records.map((r: { pandId: string }) => [r.pandId, r]));
  const rec = (id: string) => recs.get(`0363100012${id}`)!;
  // Singel 177346 and 177518: one flat 17.6 m cornice in the photo; no gable, no roof storey (no photo roof read).
  for (const id of ['177346', '177518']) {
    assert.equal(rec(id).crown?.family, 'cornice');
    assert.equal(rec(id).series?.roofStorey?.kind ?? 'none', 'none');
  }
  // Keizersgracht 176021: a neck over three storeys and a souterrain, its foot ~11.3 m and apex ~15.5 m on the 2025 pano;
  // drawn 8.83 / 13.03 before round 12.
  assert.ok(rec('176021').eavesM! >= 11 && rec('176021').topM! >= 15, `176021 ${rec('176021').eavesM}/${rec('176021').topM}`);
  // Keizersgracht 169442 row: 172281 (register stone, own read stone) and 172282 (register stone, a donor) are one stone
  // front, no donor gable; 172271 (register plaster, own read not-visible) is drawn stucco, not its neighbours' brick.
  assert.equal(rec('172281').wall?.hex, rec('172282').wall?.hex);
  assert.equal(rec('172282').wall?.finish, 'stone');
  assert.equal(rec('172282').crown?.family, 'cornice');
  assert.equal(rec('172271').wall?.finish, 'stucco');
});

test('round 13: tight AHN bands over a low 3DBAG roof, photo cornices over own gables, raised doors on stoops', async () => {
  const { ahnCorniceTop, photoCorniceOf, photoCorniceRead, beltRaisedDoorStoops } = await import('./generate.ts');
  // Keizersgracht 172277: 3DBAG height 16.31 m, ridge 17.4; AHN band p50 18.72, p90 19.31 (tight): the front's top.
  assert.equal(ahnCorniceTop({ n: 46, p50: 18.72, p90: 19.31, max: 19.33 } as never, { eavesM: 12.5, heightM: 16.31, ridgeM: 17.4 }), 19.31);
  // A loose band over the roof (a neighbour or a tree) stays out.
  assert.equal(ahnCorniceTop({ n: 41, p50: 8.81, p90: 15.01, max: 15.08 } as never, { eavesM: 7.2, heightM: 9.69, ridgeM: 10.3 }), null);
  assert.deepEqual(photoCorniceOf({ crown: 'point', cc: 0.55, dormerCheck: [{ top: 'dormer', hoist: 'y', conf: 0.9 }] }), { dormer: true, hoist: true });
  assert.equal(photoCorniceOf({ crown: 'point', cc: 0.55, dormerCheck: [{ top: 'dormer', hoist: 'y', conf: 0.9 }, { top: 'gable', hoist: 'n', conf: 0.8 }] }), undefined);
  assert.equal(photoCorniceOf({ crown: 'cornice', cc: 0.9 }), undefined, 'one capture is not enough');
  const a = photoCorniceRead({ crown: 'point', dormers: { kind: 'none', count: 0 } } as never, { cornice: 'bracketed', dormer: true, hoist: true }) as { crown: string; cornice: string; dormers?: unknown; gaps: Array<{ what: string }> };
  assert.equal(a.crown, 'cornice'); assert.equal(a.cornice, 'bracketed'); assert.equal(a.dormers, undefined);
  assert.match(a.gaps[0].what, /one gabled dormer with a hoist beam/);
  const recs = [{ pandId: 'x', series: { stoop: { side: 'right', steps: false } }, sources: {} }] as never[];
  assert.equal(beltRaisedDoorStoops(recs), 1);
  assert.deepEqual((recs[0] as { series: { stoop: unknown } }).series.stoop, { side: 'right' });
});

test('round 13 pins on the staged belt', async () => {
  const fs = await import('node:fs');
  type Rec = { pandId: string; crown?: { family?: string }; eavesM?: number; series?: { stoop?: { steps?: boolean }; roofStorey?: { kind?: string; dormers?: Array<{ hoist?: boolean }> } } };
  const all: Rec[] = JSON.parse(fs.readFileSync('data/buurt-generators/belt/row-front.json', 'utf8')).records;
  const recs = new Map(all.map(r => [r.pandId, r])), rec = (id: string) => recs.get(`0363100012${id}`)!;
  // Keizersgracht 172277: the pakhuis cornice at AHN's tight band, 19.31 m (16.31 before; the 2025 pano ~19.5 m).
  assert.equal(rec('172277').eavesM, 19.31);
  // Keizersgracht 178665: a bracketed cornice with a hoist dormer (the near 2023 capture), not a point gable.
  assert.equal(rec('178665').crown?.family, 'cornice');
  assert.equal(rec('178665').series?.roofStorey?.dormers?.[0]?.hoist, true);
  // Keizersgracht 171415: the raised door has its stoop.
  assert.notEqual(rec('171415').series?.stoop?.steps, false);
  assert.equal(all.filter(r => r.series?.stoop?.steps === false).length, 0);
  // No roof storey travels without evidence on the target: the register's dakkapel, a photo roof read, or a photo dormer.
  const facts = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/monument-facts.json', 'utf8')).buildings ?? {};
  const reg = new Set(Object.entries<{ elements?: Array<{ key: string }> }>(facts).filter(([, v]) => (v.elements ?? []).some(e => e.key === 'dormer')).map(([k]) => k.replace(/^NL\.IMBAG\.Pand\./, '')));
  const pr = JSON.parse(fs.readFileSync('data/buurt-generators/belt/photo-reads.json', 'utf8')).reads;
  const bare = all.filter(r => (r.series?.roofStorey?.kind ?? 'none') !== 'none').filter(r => {
    const p = pr[r.pandId] ?? {};
    return !reg.has(r.pandId) && !(p.cc >= 0.6 && ['mansard', 'pitched-eaves'].includes(p.crown)) && !(p.dormerCheck ?? []).some((d: { top: string; conf: number }) => d.top === 'dormer' && d.conf >= 0.7);
  });
  assert.deepEqual(bare.map(r => r.pandId), []);
});

test('round 13 after Centrum round 7: the belt souterrain share, the roof-storey cap, purple-brown', async () => {
  const fs = await import('node:fs');
  const { BELT_LOOK, BELT_GABLE_FOOT_SOUTERRAIN_SHARE } = await import('./donors.ts');
  const { JUDGED_PALETTE } = await import('../houseSpec/judgedColour.ts');
  // Measured on the belt's gabled photo reads against AHN (n 105 with a souterrain, 102 without): 0.30 of a storey, not 0.58.
  assert.equal(BELT_LOOK.gableFootSouterrainShare, BELT_GABLE_FOOT_SOUTERRAIN_SHARE);
  assert.equal(BELT_GABLE_FOOT_SOUTERRAIN_SHARE, 0.3);
  type Rec = { pandId: string; crown?: { family?: string }; eavesM?: number; topM?: number; wall?: { hex?: string } };
  const all: Rec[] = JSON.parse(fs.readFileSync('data/buurt-generators/belt/row-front.json', 'utf8')).records;
  const recs = new Map(all.map(r => [r.pandId, r])), rec = (id: string) => recs.get(`0363100012${id}`)!;
  // Keizersgracht 171444: a neck over four storeys and a souterrain stands its foot at (4 + 0.3) x 3.0 = 12.9 m (13.74 at 0.58).
  assert.equal(rec('171444').eavesM, 12.9);
  // Herengracht 176354: three storeys under the register's dakkapel stand at the AHN band's p50, 10.05 m (13.95 was the dormer's top).
  assert.equal(rec('176354').eavesM, 10.05);
  // The earlier pins hold through the merge: Keizersgracht 176021 and 177196, Singel 177346 / 177518, Keizersgracht 172277.
  assert.deepEqual([rec('176021').eavesM, rec('176021').topM, rec('177196').eavesM, rec('177196').topM], [11.86, 15.36, 12, 15.5]);
  assert.deepEqual([rec('177346').eavesM, rec('177518').eavesM, rec('172277').eavesM], [17.56, 17.56, 19.31]);
  // Centrum round 7's purple-brown tone reaches the belt (h 40, L .37).
  assert.equal(JUDGED_PALETTE['purple-brown-brick'].h, 40);
});
