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
  // looked), where the register is silent. Round 6: the Jordaan's gable foot pitch (3.42 m) stands its foot at the photo's
  // four storeys (13.9 m) and the neck rises 3.5 m over it.
  const r = recs.get('0363100012172663')!;
  assert.equal(r.crown?.family, 'neck', JSON.stringify(r.crown));
  assert.ok(r.topM >= 16.5 && r.topM <= 18, `172663 top ${r.topM}`);
});

test('Centrum round 6 staged: gable tops at the photo storeys, measured roof storeys only on photo evidence', async () => {
  const fs = await import('node:fs');
  const load = (d: string) => {
    const url = new URL(`../../../data/buurt-generators/${d}/row-front.json`, import.meta.url);
    return fs.existsSync(url) ? new Map((JSON.parse(fs.readFileSync(url, 'utf8')).records as any[]).map(r => [r.pandId.slice(-6), r])) : null;
  };
  const dw = load('de-weteringschans'), nm = load('nieuwmarkt-lastage'), jo = load('jordaan');
  if (!dw || !nm || !jo) return;
  // De Weteringschans Prinsengracht 179167: a neck over four storeys (photo), drawn 14.6 m in round 5 where the photo shows ~18
  const g = dw.get('179167');
  assert.equal(g.crown.family, 'neck');
  assert.ok(g.eavesM >= 14 && g.topM >= 17.5, `179167 foot ${g.eavesM} top ${g.topM}`);
  const roof = (r: any) => { const s = typeof r.series === 'string' ? JSON.parse(r.series) : r.series; const k = s?.roofStorey; return k && k.kind !== 'none' ? k : null; };
  // a slate roof storey from 3DBAG's ridge alone, the photo reading a flat cornice: Kloveniersburgwal 177790, Marnixstraat 168522
  assert.equal(roof(nm.get('177790')), null);
  // Round 7: 168522's re-read on another capture sees dormers (rc 0.6): the photo now evidences its roof storey.
  // Kloveniersburgwal 177790 stays without; its register plaster yields to two brick reads (round 7).
  assert.notEqual(nm.get('177790').wall.finish, 'stucco');
  // the register's dakkapel still stands (Goudsbloemstraat 168668)
  assert.ok(roof(jo.get('168668')));
});

test('Centrum round 7 staged: crowns re-read on another capture, photo roofs, the wall under a roof storey', async () => {
  const fs = await import('node:fs');
  const load = (d: string) => {
    const url = new URL(`../../../data/buurt-generators/${d}/row-front.json`, import.meta.url);
    return fs.existsSync(url) ? new Map((JSON.parse(fs.readFileSync(url, 'utf8')).records as any[]).map(r => [r.pandId.slice(-6), r])) : null;
  };
  const dw = load('de-weteringschans'), nm = load('nieuwmarkt-lastage'), jo = load('jordaan');
  if (!dw || !nm || !jo) return;
  const roof = (r: any) => { const s = typeof r.series === 'string' ? JSON.parse(r.series) : r.series; const k = s?.roofStorey; return k && k.kind !== 'none' ? k : null; };
  // gables drawn flat in round 6, read again as gables: Kalkmarkt 182745 (step), Amstel 183042 (neck), Tweede Laurierdwarsstraat 174724 (neck)
  assert.equal(nm.get('182745').crown.family, 'step');
  assert.equal(dw.get('183042').crown.family, 'neck');
  assert.equal(jo.get('174724').crown.family, 'neck');
  // the gable feet hold with lane D's round 12 rule (souterrain not counted under a Centrum gable foot)
  assert.ok(dw.get('179167').eavesM <= 15 && dw.get('179167').topM <= 18.5, `179167 ${dw.get('179167').eavesM}/${dw.get('179167').topM}`);
  assert.ok(jo.get('172663').topM >= 16.5 && jo.get('172663').topM <= 18);
  // Marnixplein 168305 / 174907: the photo's pantile roof with dormers
  for (const id of ['168305', '174907']) assert.equal(roof(jo.get(id))?.material, 'tile', id);
  // Westeinde 178341: a mansard read keeps the mansard (no pitched hip)
  assert.equal(roof(dw.get('178341'))?.kind, 'mansard'); assert.notEqual(roof(dw.get('178341'))?.pitched, true);
  // Goudsbloemstraat 172514: four storeys under a roof storey, the wall at the photo's storeys (not the band's 14.8)
  assert.ok(jo.get('172514').topM < 14.2, `172514 ${jo.get('172514').topM}`);
});

test('Centrum round 8 staged: tall cornices under a roof storey, a weak gable over a wide band, Westeinde and Prinsengracht walls', async () => {
  const fs = await import('node:fs');
  const load = (d: string) => {
    const url = new URL(`../../../data/buurt-generators/${d}/row-front.json`, import.meta.url);
    return fs.existsSync(url) ? new Map((JSON.parse(fs.readFileSync(url, 'utf8')).records as any[]).map(r => [r.pandId.slice(-6), r])) : null;
  };
  const dw = load('de-weteringschans'), nm = load('nieuwmarkt-lastage'), jo = load('jordaan');
  if (!dw || !nm || !jo) return;
  // Goudsbloemstraat 172466-172470: bracketed cornices under dormers, all at the photo storeys (4 x 3.44), not the band's 14.8
  for (const id of ['172514', '172469', '172466', '172470']) assert.ok(jo.get(id).topM < 14.2, `${id} ${jo.get(id).topM}`);
  // Kloveniersburgwal 177789: a weak step gable (third capture) over an AHN band 18.1-21.2 m: drawn gabled to ~22 m
  assert.equal(nm.get('177789').crown.family, 'step'); assert.ok(nm.get('177789').topM >= 21);
  // Westeinde: no red-brown; Prinsengracht 179167 and 168251 dark-grey (a weak purple-brown over a dark neutral cut)
  for (const id of ['171768', '178339', '178341', '178342', '178343']) assert.ok(!JSON.stringify(dw.get(id)).includes('red-brown brick'), id);
  for (const id of ['179167', '168251']) assert.ok(JSON.stringify(dw.get(id)).includes('nearly grey'), id);
});
