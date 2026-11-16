// The district wall draw (centrum-looks round 3: run by run). Named regressions:
//  - round 1 "too dark and uniform": Westerkade 174838 (173518-173521, 174936, 173525), Rozengracht 168914;
//  - round 2 "colours alternate where the row is one wall": Lindengracht 168662, Leidsekade 174376, Bloemgracht 172858
//    (staged-data pins at the end); Nieuwmarkt's grey-brown and near-black brick: Groenburgwal 178635, Prins Hendrikkade 181609.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { drawRowWalls, isBrickFamily, measuredWeights, streetFamily, type WallDrawConfig } from './wallDraw.ts';
import { lchOf, type JudgedFamily } from '../houseSpec/judgedColour.ts';

const cfg = JSON.parse(fs.readFileSync(new URL('./districts/jordaan.json', import.meta.url), 'utf8')).wallDraw as WallDrawConfig;
const WESTERKADE = ['0363100012173518', '0363100012173519', '0363100012173520', '0363100012173521', '0363100012174936', '0363100012173525'];
const ROZENGRACHT = ['0363100012168914', '0363100012168906', '0363100012169815', '0363100012169814', '0363100012169812', '0363100012169813'];

test('a run of one period is one family, each house a small tone of it (Westerkade, Rozengracht)', () => {
  for (const [ids, year] of [[WESTERKADE, 1880], [ROZENGRACHT, 1890]] as const) {
    const out = drawRowWalls(ids.map(pandId => ({ pandId, year, free: true })), cfg);
    assert.equal(new Set(out.map(w => w!.family)).size, 1, 'one family along the run');
    assert.equal(new Set(out.map(w => w!.hex)).size, ids.length, 'one tone per house');
    const L = out.map(w => lchOf(w!.hex).L);
    assert.ok(Math.max(...L) - Math.min(...L) <= 0.06, `small variation inside the family (L ${L.map(x => x.toFixed(3))})`);
    for (const w of out) assert.equal(w!.material, 'brick', 'never paint by lot');
    assert.deepEqual(drawRowWalls(ids.map(pandId => ({ pandId, year, free: true })), cfg), out, 'deterministic');
  }
});

test('runs break at a stated front and at the 1860 line; a series keeps its family across the break', () => {
  const ids = ROZENGRACHT;
  const out = drawRowWalls(ids.map((pandId, i) => ({ pandId, year: i < 3 ? 1700 : 1890, free: i !== 1, series: i === 0 || i === 5 ? 'r/s1' : `r/s${i + 2}` })), cfg);
  assert.equal(out[1], null, 'the stated front keeps its wall');
  assert.equal(out[5]!.family, out[0]!.family, 'the series keeps one family');
  assert.equal(out[5]!.by, 'series');
  assert.equal(out[3]!.family, out[4]!.family, 'one run, one family');
});

test("a run's own samples decide its family; the street's reads come next, paint included; an own brick read stays brick", () => {
  const dark = ['#3a3533', '#3c3634', '#3b3634'];
  const s = drawRowWalls(dark.map((sample, i) => ({ pandId: WESTERKADE[i], year: 1700, free: true, sample })), cfg);
  for (const w of s) { assert.equal(w!.by, 'run-sample'); assert.equal(w!.family, s[0]!.family); }
  const st = drawRowWalls(WESTERKADE.slice(0, 3).map((pandId, i) => ({ pandId, year: 1700, free: true, streetFamily: 'painted-white' as const, brickOnly: i === 2 })), cfg);
  assert.equal(st[0]!.family, 'painted-white'); assert.equal(st[0]!.material, 'painted-brick');
  assert.ok(isBrickFamily(st[2]!.family), 'its own read saw brick');
});

test("round 4: a front's photo read stands (paint and stucco included); a run's agreeing reads reach its unread fronts", () => {
  const ids = WESTERKADE.slice(0, 4);
  const out = drawRowWalls([
    { pandId: ids[0], year: 1700, free: true, photo: 'painted-white' as const },
    { pandId: ids[1], year: 1700, free: true, photo: 'painted-white' as const, photoStucco: true },
    { pandId: ids[2], year: 1700, free: true },
    { pandId: ids[3], year: 1700, free: false, photo: 'cream-render' as const },
  ], cfg);
  assert.equal(out[0]!.by, 'photo'); assert.equal(out[0]!.material, 'painted-brick');
  assert.equal(out[1]!.material, 'stucco');
  assert.equal(out[2]!.family, 'painted-white'); assert.equal(out[2]!.by, 'run-photo');
  assert.equal(out[3]!.family, 'cream-render', 'a read front is drawn even where the look called it plaster');
});

test('measured weights: the reads lead, the prior fills, paint is counted out', () => {
  const ev = [...Array(6)].map(() => ({ year: 1700, family: 'dark-grey-brick' as const })).concat([{ year: 1700, family: 'painted-white' as never }]);
  const w = measuredWeights(ev, { before1860: { 'red-brown-brick': 1 }, from1860: { 'brown-brick': 1 } }, 2);
  assert.deepEqual(w.before1860, { 'dark-grey-brick': 0.75, 'red-brown-brick': 0.25 });
  assert.deepEqual(w.from1860, { 'brown-brick': 1 }, 'no reads: the prior');
  assert.equal(w.n.before1860, 6);
});

test('street family: three reads and a majority, else none', () => {
  assert.equal(streetFamily(['brown-brick', 'brown-brick']), null);
  assert.equal(streetFamily(['brown-brick', 'brown-brick', 'red-brown-brick']), 'brown-brick');
  assert.equal(streetFamily(['brown-brick', 'red-brown-brick', 'buff-brick', 'painted-white']), null);
});

// Staged-data pins (data/buurt-generators/<district>/row-front.json, round 3).
const staged = (d: string) => JSON.parse(fs.readFileSync(new URL(`../../../data/buurt-generators/${d}/row-front.json`, import.meta.url), 'utf8')).records as any[];
const rowWalls = (recs: any[], row: string) => recs.filter(r => String(r.series?.id).startsWith(`${row}/`)).map(r => ({ id: r.pandId as string, hex: r.wall.hex as string, src: String(r.sources?.wall ?? '') }));
const familyOf = (src: string) => /^judged ([a-z-]+)/.exec(src)?.[1];

// Round 4: a front's own opus photo read (confidence >= 0.7, register silent) outranks the run, series and street rules,
// so the pins below hold the rule for the unread fronts and check the read fronts against the reads file.
const byPhoto = (src: string) => /wallDraw\.ts: (run-)?photo,/.test(src);
const ownPhoto = (src: string) => /wallDraw\.ts: photo,/.test(src);

test('Lindengracht 168662 and Leidsekade 174376 (round 2: "colours alternate"): one brick family along the unread fronts, no tan by lot', () => {
  const recs = staged('jordaan');
  for (const row of ['jordaan-lindengracht-168662', 'jordaan-leidsekade-174376']) {
    const w = rowWalls(recs, row).filter(x => x.src.includes('wall draw'));
    assert.ok(w.length >= 8, `${row}: drawn fronts`);
    const unread = w.filter(x => !ownPhoto(x.src)), fams = unread.map(x => familyOf(x.src));
    assert.ok(!w.some(x => familyOf(x.src) === 'buff-brick'), `${row}: no buff`);
    // Round 5: the run family holds the run; a later series of the row (Leidsekade 174372-174369, 1886) may take its own.
    const main = [...new Set(fams)].sort((a, b) => fams.filter(f => f === b).length - fams.filter(f => f === a).length)[0];
    assert.ok(fams.filter(f => f === main).length >= 0.8 * fams.length, `${row}: one family off the photo (${fams})`);
    const L = w.filter(x => familyOf(x.src) === main).map(x => lchOf(x.hex).L);
    assert.ok(Math.max(...L) - Math.min(...L) <= 0.06, `${row}: small tone differences within the family`);
  }
});

test('Round 5 (grey-brown read red-brown): Lindengracht 168662, Palmstraat 168635 and Groenburgwal 178637 draw grey-brown; Lindengracht 172512 keeps its red', () => {
  const j = staged('jordaan'), n = staged('nieuwmarkt-lastage');
  for (const row of ['jordaan-lindengracht-168662', 'jordaan-palmstraat-168635']) {
    const w = rowWalls(j, row).filter(x => x.id !== '0363100012172512');
    for (const x of w) assert.equal(familyOf(x.src), 'brown-brick', `${row} ${x.id}: ${x.src}`);
  }
  assert.equal(familyOf(rowWalls(j, 'jordaan-lindengracht-168662').find(x => x.id === '0363100012172512')!.src), 'red-brown-brick');
  const g3 = rowWalls(n, 'nieuwmarkt-lastage-groenburgwal-178635').find(x => x.id === '0363100012178637')!;
  assert.ok(ownPhoto(g3.src) && familyOf(g3.src) === 'brown-brick', g3.src);
});

test("Bloemgracht 172858: fronts the photo reads draw as read (173056 white paint); the rest take the street's dark grey-brown (173055: v1 red-brown, v2 and a second capture brown, left to the street)", () => {
  const w = rowWalls(staged('jordaan'), 'jordaan-bloemgracht-172858');
  assert.equal(w.length, 8);
  const reads = JSON.parse(fs.readFileSync(new URL('../../../data/buurt-generators/jordaan/photo-reads.json', import.meta.url), 'utf8')).reads;
  for (const x of w.filter(x => ownPhoto(x.src))) assert.ok(reads[x.id]?.confidence >= 0.7, `${x.id}: a photo wall needs a read >= 0.7`);
  for (const x of w.filter(x => !byPhoto(x.src))) assert.equal(familyOf(x.src), 'dark-grey-brick', `${x.id}: ${x.src}`);
  assert.ok(!ownPhoto(w.find(x => x.id === '0363100012173055')!.src));
  assert.equal(familyOf(w.find(x => x.id === '0363100012173056')!.src), 'painted-white');
});

test('Groenburgwal 178635 and Prins Hendrikkade 181609 (Nieuwmarkt round 2: "grey-brown, near-black where bright red"): unread fronts dark grey, never orange or buff', () => {
  const recs = staged('nieuwmarkt-lastage');
  const g = rowWalls(recs, 'nieuwmarkt-lastage-groenburgwal-178635');
  assert.ok(g.length >= 4);
  for (const x of g) assert.ok(!['orange-red-brick', 'buff-brick'].includes(familyOf(x.src)!), `${x.id}: ${x.src}`);
  for (const x of g.filter(x => !byPhoto(x.src))) assert.equal(familyOf(x.src), 'dark-grey-brick', `${x.id}: ${x.src}`);
  const p = rowWalls(recs, 'nieuwmarkt-lastage-prins-hendrikkade-181609');
  assert.equal(p.length, 5);
  assert.ok(new Set(p.filter(x => !ownPhoto(x.src)).map(x => familyOf(x.src))).size <= 1, 'one family along the unread fronts');
  for (const x of p) assert.ok(!['orange-red-brick', 'buff-brick'].includes(familyOf(x.src)!), `${x.id}: ${x.src}`);
});

test('round 6: a run of weak reads that mostly agree takes their family before the samples and the lot (DW Prinsengracht 168251-179166)', () => {
  const cfg = { before1860: { 'red-brown-brick': 0.6, 'orange-red-brick': 0.4 }, from1860: { 'red-brown-brick': 1 }, runSamples: 2 } as const;
  const f = (id: string, weakPhoto?: JudgedFamily) => ({ pandId: id, year: 1725, free: true, ...(weakPhoto ? { weakPhoto } : {}) });
  const w = drawRowWalls([f('a', 'purple-brown-brick'), f('b', 'purple-brown-brick'), f('c', 'purple-brown-brick'), f('d')], cfg);
  for (const x of w) assert.equal(x!.family, 'purple-brown-brick');
  assert.equal(w[3]!.by, 'run-weak');
  // two weak reads are not enough: the lot draws
  assert.equal(drawRowWalls([f('a', 'purple-brown-brick'), f('b', 'purple-brown-brick'), f('d')], cfg)[2]!.by, 'draw');
});

test('round 6 staged: the losses that drew red or orange where the photo is dark (DW Prinsengracht 180118, Prins Hendrikkade 181609, Raamgracht 178142)', () => {
  const dw = rowWalls(staged('de-weteringschans'), 'de-weteringschans-prinsengracht-180118');
  for (const x of dw.filter(x => /(168251|179168|179167|179166)$/.test(x.id))) assert.ok(['purple-brown-brick', 'dark-grey-brick', 'painted-black'].includes(familyOf(x.src)!), `${x.id}: ${x.src}`);
  const n = staged('nieuwmarkt-lastage');
  for (const row of ['nieuwmarkt-lastage-prins-hendrikkade-181609', 'nieuwmarkt-lastage-raamgracht-178142'])
    for (const x of rowWalls(n, row)) assert.ok(!['orange-red-brick', 'red-brown-brick', 'buff-brick'].includes(familyOf(x.src)!), `${row} ${x.id}: ${x.src}`);
  assert.equal(familyOf(rowWalls(n, 'nieuwmarkt-lastage-raamgracht-178142').find(x => x.id.endsWith('178111'))!.src), 'dark-grey-brick');
});

test('round 8: a run of weak brick reads that do not agree draws from them, each front its own (Westeinde 171768-178343)', () => {
  const cfg = { before1860: { 'red-brown-brick': 1 }, from1860: { 'red-brown-brick': 1 }, runSamples: 9 } as const;
  const f = (id: string, weakPhoto?: JudgedFamily) => ({ pandId: id, year: 1885, free: true, ...(weakPhoto ? { weakPhoto } : {}) });
  const w = drawRowWalls([f('a', 'purple-brown-brick'), f('b', 'brown-brick'), f('c', 'dark-grey-brick'), f('d', 'purple-brown-brick'), f('e')], cfg);
  assert.deepEqual(w.slice(0, 4).map(x => x!.family), ['purple-brown-brick', 'brown-brick', 'dark-grey-brick', 'purple-brown-brick']);
  assert.ok(['purple-brown-brick', 'brown-brick', 'dark-grey-brick'].includes(w[4]!.family));
  assert.ok(w.every(x => x!.family !== 'red-brown-brick'));
  // under three weak reads the lot draws as before
  assert.equal(drawRowWalls([f('a', 'purple-brown-brick'), f('b', 'brown-brick'), f('e')], cfg)[2]!.by, 'draw');
});

test('round 9: a weak read of a painted or plastered front stands over its run of brick reads (Korte Leidsedwarsstraat 173459)', () => {
  const cfg = { before1860: { 'red-brown-brick': 1 }, from1860: { 'red-brown-brick': 1 }, runSamples: 9 } as const;
  const f = (id: string, extra: object = {}) => ({ pandId: id, year: 1700, free: true, ...extra });
  const w = drawRowWalls([f('a', { weakPhoto: 'pale-grey-stucco', photoStucco: true }), f('b', { photo: 'brown-brick' }), f('c', { photo: 'brown-brick' }), f('d')], cfg);
  assert.equal(w[0]!.family, 'pale-grey-stucco');
  assert.equal(w[0]!.by, 'weak');
  assert.equal(w[0]!.material, 'stucco');
  assert.equal(w[3]!.family, 'brown-brick');
  // a weak brick read still takes its run's family
  assert.equal(drawRowWalls([f('a', { weakPhoto: 'red-brown-brick' }), f('b', { photo: 'brown-brick' }), f('c', { photo: 'brown-brick' })], cfg)[0]!.family, 'brown-brick');
});
