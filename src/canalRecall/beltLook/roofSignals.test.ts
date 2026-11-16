// Roof signals (centrum-looks round 2, 2026-11-16): a modern rebuild behind an old year is read from the measured roof,
// never BAG's year. Named regressions: Boomstraat 0363100012172664 (register neck gable, BAG 1990, flat 3DBAG roof and AHN
// band: the judges' "flat modern block" drawn with a neck gable) and 0363100012172663 (a cornice front whose AHN band
// climbs the roof slope: drawn at the p90 15.13 m, about 2 m over the photo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { measuredFlatTop, modernBehindRegister, roofStoreyOverCornice, slopedBandTop } from './roofSignals.ts';
import { beltRowInput, type BeltStated } from './generate.ts';
import { BELT_LOOK, type BeltDonor, type LookDistrict } from './donors.ts';
import type { GenPand, GenRow } from '../buurtGenerator/rows.ts';
import type { DescriberAnswer } from '../houseSpec/describer.ts';
import type { AhnFront } from './ahnFront.ts';

// Measured values as the extracts carry them (bag-tiles z14, data/buurt-generators/jordaan/ahn-fronts.json).
const B172664 = { year: 1990, roofCode: 2, eavesM: 8.6, ridgeM: null, heightM: 11.19 };
const A172664: AhnFront = { n: 70, p50: 9.58, p90: 11.11, max: 11.2 };
const B172663 = { year: 1897, roofCode: 3, eavesM: 10, ridgeM: 15.5, heightM: 13.9 };
const A172663: AhnFront = { n: 35, p50: 13.27, p90: 15.13, max: 15.9 };

test('Boomstraat 172664: a measured flat top; the register 1762 neck gable does not hold it in the look', () => {
  assert.equal(measuredFlatTop(B172664, A172664), true);
  assert.match(modernBehindRegister(B172664, 1762, 1914, A172664) ?? '', /BAG 1990 over register 1762/);
  // a slanted roof, a ridge over the eaves, or a bump in the AHN band is not flat
  assert.equal(measuredFlatTop(B172663, A172663), false);
  assert.equal(measuredFlatTop({ ...B172664, ridgeM: 11 }, A172664), false);
  assert.equal(measuredFlatTop(B172664, { ...A172664, max: 13.5 }), false);
  // BAG's year alone (no flat top) or a stated year after maxYear never moves a pand
  assert.equal(modernBehindRegister(B172663, 1700, 1914, A172663), null);
  assert.equal(modernBehindRegister(B172664, 1930, 1914, A172664), null);
});

test('Boomstraat 172663: a cornice front whose AHN band climbs the slope stands at the band p50', () => {
  assert.equal(slopedBandTop(B172663, A172663), 13.27);
  // a tight band (Rozengracht 168914: p50 14.0, p90 14.04) keeps its p90
  assert.equal(slopedBandTop({ roofCode: 3, eavesM: 14.2, ridgeM: 16 }, { n: 32, p50: 14, p90: 14.04, max: 14.86 }), null);
  // a flat roof never does
  assert.equal(slopedBandTop(B172664, A172664), null);
});

test('a slanted ridge 2 m over the front top is a roof storey behind the cornice (Marnixstraat 172786)', () => {
  assert.equal(roofStoreyOverCornice({ roofCode: 3, eavesM: 15.2, ridgeM: 18.3 }, 16.05), true);
  assert.equal(roofStoreyOverCornice({ roofCode: 3, eavesM: 14.9, ridgeM: null }, 15.6), false);
  assert.equal(roofStoreyOverCornice({ roofCode: 1, eavesM: 14.9, ridgeM: 18 }, 15.6), false);
});

const read = (pandId: string, crown: string): DescriberAnswer => ({
  v: 1, pandId, image: { ref: `cuts/${pandId}.jpg`, kind: 'pose-photo' }, reader: 'test', prompt: 'v4.3', readable: true, extent: 'single',
  storeys: 3, bays: 3, windows: 'sash-small-panes', heads: ['flat', 'flat', 'flat'], whiteFrames: true, sills: 'stone', doorBay: 'left', doorIndex: 0, groundBays: 3,
  ground: 'dwelling', basement: 'none', crown, cornice: 'simple', finish: 'brick', doorSurround: false, gaps: [], notes: '',
} as unknown as DescriberAnswer);
const pand = (id: string, m: typeof B172664): GenPand => ({ id: `NL.IMBAG.Pand.${id}`, ring: [[4.88, 52.37], [4.8801, 52.37], [4.8801, 52.3701]], ...m } as unknown as GenPand);
const row = (p: GenPand): GenRow => ({ id: 'boomstraat-test', street: 'Boomstraat', series: [], members: [{ pand: p, front: { street: 'Boomstraat', a: { x: 0, y: 0 }, b: { x: 11.47, y: 0 }, aLngLat: [4.88, 52.37], bLngLat: [4.8801, 52.37], lengthM: 11.47, n: { x: 0, y: -1 }, streetM: 5, lineA: [4.88, 52.37], lineB: [4.8801, 52.37], erkers: [] } }] });
const donors: BeltDonor[] = [
  { pandId: '0363100012900001', street: 'Boomstraat', year: 1760, widthM: 11, heightM: 9, answer: read('0363100012900001', 'neck') },
  { pandId: '0363100012900002', street: 'Tuinstraat', year: 1880, widthM: 9, heightM: 11, answer: read('0363100012900002', 'cornice') },
];
const crownOf = (look: LookDistrict, stated: Map<string, BeltStated>) => {
  const input = beltRowInput(row(pand('0363100012172664', B172664)), new Map(), donors, '2026-11-16', {}, stated, new Map([['0363100012172664', A172664]]), look);
  return String((input!.members[0].read as { crown?: string }).crown);
};

test('flatTopNoGable: no register or donor gable stands on Boomstraat 172664; the belt default is unchanged', () => {
  const look: LookDistrict = { ...BELT_LOOK, id: 'jordaan', flatTopNoGable: true };
  const stated = new Map<string, BeltStated>([['0363100012172664', { crown: 'neck', year: 1762 }]]);
  assert.equal(crownOf(look, stated), 'cornice');
  assert.equal(crownOf(look, new Map()), 'cornice');
  // without the option the register's neck stands as before (the belt sets it since lane D round 9: no belt front changes)
  assert.equal(crownOf({ ...BELT_LOOK, flatTopNoGable: false }, stated), 'neck');
  assert.equal(BELT_LOOK.flatTopNoGable, true);
});

test('the staged Jordaan look: Boomstraat 172664 left to today; 172663 draws the neck its cut shows (Centrum round 5 crown read)', async () => {
  const fs = await import('node:fs');
  const url = new URL('../../../data/buurt-generators/jordaan/row-front.json', import.meta.url);
  if (!fs.existsSync(url)) return;
  const recs = new Map((JSON.parse(fs.readFileSync(url, 'utf8')).records as { pandId: string; topM: number; crown?: { family?: string } }[]).map(r => [r.pandId, r]));
  assert.equal(recs.has('0363100012172664'), false);
  // Round 5: the v2 reader reads a neck at cc 0.8 on 172663's cut (a dark-painted neck gable with a white top; the lane
  // looked), where the register is silent. Its wall stays under the old band-p50 line; the gable rises above it.
  const r = recs.get('0363100012172663')!;
  assert.equal(r.crown?.family, 'neck', JSON.stringify(r.crown));
  assert.ok(r.topM <= 16, `172663 top ${r.topM}`);
});
