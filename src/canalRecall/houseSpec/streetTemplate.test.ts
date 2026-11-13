// Street template (houseSpec/streetTemplate.ts), round 3 ruling: a template must MATCH the house, not only be near it.
// Same street first; else same street class and similar scale; else similar scale (an adjoining side street); within 300 m,
// same band; no template when nothing qualifies; interwar and post-war never template; dressings only, never structure;
// the variety guard spreads a pool over a street.
import test from 'node:test';
import assert from 'node:assert/strict';
import { streetClassOf } from './streetClass.ts';
import CLASSES from './street-classes.json' with { type: 'json' };
import { streetTemplateFor, templatesInReach, scaleMatch, footprintWidthM, DRESSING_FIELDS, STRUCTURE_FIELDS, STREET_TEMPLATE_TABLE, TEMPLATE_BANDS, SCALE_HEIGHT_M, pandHash, type TemplateTable, type TemplateRow } from './streetTemplate.ts';

const at = (dxM: number, dyM = 0): [number, number] => [4.89 + dxM / (111_320 * Math.cos(52.37 * Math.PI / 180)), 52.36 + dyM / 110_540];
const row = (p: string, dx: number, yr: number, st: string, c: 'main' | 'side', h: number | null, w: number | null, f: Record<string, unknown>): TemplateRow => {
  const [x, y] = at(dx); return { p, x, y, yr, st, c, h, w, src: 'streetlevel-measured', f };
};
// The pinned scale mismatch: a 16.6 m Weteringschans front (main street) against Den Texstraat houses about 11 m high (side
// street) 70-90 m away, and one tall Nicolaas Witsenstraat house that does match the scale.
const T: TemplateTable = { v: 2, rows: [
  row('0000000000000001', 70, 1876, 'Den Texstraat', 'side', 11, 6.1, { 'fronts/0/windowSurround': 'sill' }),
  row('0000000000000002', 80, 1877, 'Den Texstraat', 'side', 11.2, 6.2, { 'fronts/0/windowSurround': 'keystone' }),
  row('0000000000000003', 90, 1872, 'Den Texstraat', 'side', 10.8, 6.1, { 'fronts/0/cornice': 'simple' }),
  row('0000000000000004', 120, 1873, 'Nicolaas Witsenstraat', 'side', 17.5, 6.4, { 'fronts/0/windowSurround': 'stone-lintel' }),
  row('0000000000000005', 250, 1870, 'Vijzelgracht', 'main', 16.0, 6.6, { 'fronts/0/cornice': 'bracketed' }),
  row('0000000000000006', 280, 1871, 'Weteringschans', 'main', 12.0, 9.0, { 'fronts/0/cornice': 'heavy' }),
  row('0000000000000007', 350, 1870, 'Vijzelgracht', 'main', 16.4, 6.8, { 'fronts/0/cornice': 'frieze' }),
  row('0000000000000008', 60, 1930, 'Den Texstraat', 'side', 16.6, 6.8, { 'fronts/0/cornice': 'none' }),
] };
const wet = { pandId: '0363100012168094', lng: at(0)[0], lat: at(0)[1], year: 1870, street: 'Weteringschans', streetClass: 'main' as const, heightM: 16.6, widthM: 6.8 };

test('rule 1, pinned: a 16.6 m Weteringschans front takes nothing from the about-11 m Den Texstraat houses', () => {
  const reach = templatesInReach(wet, T);
  for (const r of reach.filter(r => r.row.st === 'Den Texstraat')) assert.equal(r.tier, null, r.row.p);
  assert.ok(!scaleMatch(wet, T.rows[0]) && 16.6 - 11 > SCALE_HEIGHT_M);
});

test('rule 1: same street first, even at another scale', () => {
  const pick = streetTemplateFor(wet, T)!;
  assert.equal(pick.tier, 'street');
  assert.equal(pick.pandId, '0000000000000006');
});

test('rule 1: else same class and scale, else scale on another class; scale outranks class; never farther than 300 m', () => {
  const offStreet = { ...wet, street: 'Lijnbaansgracht' };
  // Vijzelgracht 005 is main and in scale: class+scale. 007 is in scale and main but 350 m away: never.
  const pick = streetTemplateFor(offStreet, T)!;
  assert.deepEqual([pick.tier, pick.pandId, pick.pool], ['class+scale', '0000000000000005', 1]);
  // Without the main-street match, the tall side-street house qualifies on scale alone; the low ones never do.
  const noMain: TemplateTable = { v: 2, rows: T.rows.filter(r => r.c !== 'main') };
  const side = streetTemplateFor(offStreet, noMain)!;
  assert.deepEqual([side.tier, side.pandId], ['scale', '0000000000000004']);
  // A main-street house of another scale never qualifies on class alone.
  const notInScale: TemplateTable = { v: 2, rows: [row('0000000000000009', 50, 1870, 'Vijzelgracht', 'main', 12.0, 6.8, {})] };
  assert.equal(streetTemplateFor(offStreet, notInScale), null);
});

test('rule 1: nothing qualifies means no template; an unknown scale matches only on the same street', () => {
  const lowOnly: TemplateTable = { v: 2, rows: T.rows.slice(0, 3) };
  assert.equal(streetTemplateFor(wet, lowOnly), null);
  assert.equal(streetTemplateFor({ ...wet, street: 'Lijnbaansgracht', heightM: null }, T), null);
  assert.equal(streetTemplateFor({ ...wet, heightM: null }, T)!.tier, 'street');
  assert.ok(!scaleMatch({ heightM: 16, widthM: 6 }, { h: 16, w: null }));
  assert.ok(!scaleMatch({ heightM: 16, widthM: 6 }, { h: 16, w: 7.2 }), 'width within 1 m');
});

test('rule 3: interwar and post-war bands never lend or receive a template', () => {
  assert.deepEqual([...TEMPLATE_BANDS], ['before-1800', '1800-1879', '1880-1919']);
  assert.ok(!templatesInReach({ ...wet, street: 'Den Texstraat' }, T).some(r => r.row.p === '0000000000000008'));
  assert.equal(streetTemplateFor({ ...wet, year: 1930, street: 'Den Texstraat' }, T), null);
  assert.equal(streetTemplateFor({ ...wet, year: 1960, street: 'Den Texstraat' }, T), null);
  for (const r of STREET_TEMPLATE_TABLE.rows) assert.ok(r.yr !== null && r.yr < 1920, r.p);
});

test('no structure field is a dressing', () => {
  for (const p of STRUCTURE_FIELDS) assert.ok(!(DRESSING_FIELDS as readonly string[]).includes(p), p);
  for (const r of STREET_TEMPLATE_TABLE.rows.slice(0, 2000)) for (const k of Object.keys(r.f)) assert.ok((DRESSING_FIELDS as readonly string[]).includes(k), k);
});

test('variety guard: the pick follows a hash of the pand id, so a street gets both templates; never itself', () => {
  const dt = { pandId: '', lng: at(0)[0], lat: at(0)[1], year: 1875, street: 'Den Texstraat', streetClass: 'side' as const, heightM: 11, widthM: 6.1 };
  const picks = new Set<string>();
  for (let i = 0; i < 40; i++) picks.add(streetTemplateFor({ ...dt, pandId: `03631000121${String(10000 + i)}` }, T)!.pandId);
  assert.equal(picks.size, 3);
  assert.equal(pandHash('abc'), pandHash('abc'));
  assert.ok(!templatesInReach({ ...dt, pandId: '0000000000000001' }, T).some(r => r.row.p === '0000000000000001'));
});

test('footprint width: the narrow side of the minimum rectangle', () => {
  const [x0, y0] = at(0), [x1] = at(6.5), [, y1] = at(0, 15);
  assert.ok(Math.abs(footprintWidthM([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]])! - 6.5) < 0.05);
});

test('street class: tram streets and high-ride streets are main whatever their highway tag (Vijzelstraat, Leidsestraat pinned)', () => {
  assert.equal(streetClassOf('Vijzelstraat'), 'main');
  assert.equal(streetClassOf('Leidsestraat'), 'main');
  const why = (CLASSES as unknown as { why: Record<string, string[]> }).why;
  assert.ok(why.Vijzelstraat.includes('ride'), 'Vijzelstraat: ride rank (no tram track in OSM or GVB)');
  assert.ok(why.Leidsestraat.includes('tram'), 'Leidsestraat: tram track');
  assert.equal(streetClassOf('Weteringschans'), 'main');
  for (const side of ['Den Texstraat', 'Nicolaas Witsenstraat', 'Prinsengracht', 'Kerkstraat']) assert.equal(streetClassOf(side), 'side', side);
  assert.equal(streetClassOf(null), null);
});
