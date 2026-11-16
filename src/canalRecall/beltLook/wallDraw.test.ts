// The district wall draw (centrum-looks round 3: run by run). Named regressions:
//  - round 1 "too dark and uniform": Westerkade 174838 (173518-173521, 174936, 173525), Rozengracht 168914;
//  - round 2 "colours alternate where the row is one wall": Lindengracht 168662, Leidsekade 174376, Bloemgracht 172858
//    (staged-data pins at the end); Nieuwmarkt's grey-brown and near-black brick: Groenburgwal 178635, Prins Hendrikkade 181609.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { drawRowWalls, isBrickFamily, measuredWeights, streetFamily, type WallDrawConfig } from './wallDraw.ts';
import { lchOf } from '../houseSpec/judgedColour.ts';

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

test('Lindengracht 168662 and Leidsekade 174376 (round 2: "colours alternate"): one brick family along the row, no tan by lot', () => {
  const recs = staged('jordaan');
  for (const row of ['jordaan-lindengracht-168662', 'jordaan-leidsekade-174376']) {
    const w = rowWalls(recs, row).filter(x => x.src.includes('wall draw'));
    assert.ok(w.length >= 8, `${row}: drawn fronts`);
    assert.equal(new Set(w.map(x => familyOf(x.src))).size, 1, `${row}: one family (${w.map(x => familyOf(x.src))})`);
    assert.ok(!w.some(x => familyOf(x.src) === 'buff-brick'), `${row}: no buff`);
    const L = w.map(x => lchOf(x.hex).L);
    assert.ok(Math.max(...L) - Math.min(...L) <= 0.06, `${row}: small tone differences`);
  }
});

test("Bloemgracht 172858: the street's 21 own reads agree (dark grey-brown canal brick): the row takes it", () => {
  const w = rowWalls(staged('jordaan'), 'jordaan-bloemgracht-172858');
  assert.equal(w.length, 8);
  for (const x of w) assert.equal(familyOf(x.src), 'dark-grey-brick', `${x.id}: ${x.src}`);
  assert.ok(w.filter(x => x.src.includes(': street,')).length >= 6, 'by the street rule');
});

test('Groenburgwal 178635 and Prins Hendrikkade 181609 (Nieuwmarkt round 2: "grey-brown, near-black where bright red"): one family from the measured weights, never orange or buff', () => {
  const recs = staged('nieuwmarkt-lastage');
  const g = rowWalls(recs, 'nieuwmarkt-lastage-groenburgwal-178635');
  assert.ok(g.length >= 4);
  for (const x of g) assert.equal(familyOf(x.src), 'dark-grey-brick', `${x.id}: ${x.src}`);
  const p = rowWalls(recs, 'nieuwmarkt-lastage-prins-hendrikkade-181609');
  assert.equal(p.length, 5);
  assert.equal(new Set(p.map(x => familyOf(x.src))).size, 1, 'one family along the row');
  for (const x of p) assert.ok(!['orange-red-brick', 'buff-brick'].includes(familyOf(x.src)!), `${x.id}: ${x.src}`);
});
