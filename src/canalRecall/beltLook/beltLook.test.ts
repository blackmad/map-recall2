// Belt look (lane D 2026-11-15): the donor match is deterministic and never stands a gable on a flat-topped pand; a donor's
// read is fitted to the pand; a generated row draws own reads as reads and donors' as the look's period defaults; described
// pands only break a row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { donorFor, fittedRead, gableable, hash32, segmentOf, type BeltDonor, type BeltTarget } from './donors.ts';
import { generateBelt, BELT_LOOK_REF } from './generate.ts';
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
