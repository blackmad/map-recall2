// Street template (houseSpec/streetTemplate.ts): dressings from the nearest reviewed house of the same band on the street or
// the adjoining block within 150 m, never structure; the variety guard spreads several templates over a street.
import test from 'node:test';
import assert from 'node:assert/strict';
import { streetTemplateFor, templatesInReach, DRESSING_FIELDS, STRUCTURE_FIELDS, STREET_TEMPLATE_TABLE, pandHash, type TemplateTable } from './streetTemplate.ts';

const at = (dxM: number, dyM = 0): [number, number] => [4.89 + dxM / (111_320 * Math.cos(52.37 * Math.PI / 180)), 52.36 + dyM / 110_540];
const row = (p: string, dx: number, yr: number, st: string, f: Record<string, unknown>) => { const [x, y] = at(dx); return { p, x, y, yr, st, src: 'author', f }; };
const T: TemplateTable = { v: 1, rows: [
  row('0000000000000001', 40, 1885, 'Den Texstraat', { 'fronts/0/windowSurround': 'stone-lintel', 'palette/frame': 'white-painted' }),
  row('0000000000000002', 60, 1888, 'Den Texstraat', { 'fronts/0/windowSurround': 'sill', 'fronts/0/bands': 'storey' }),
  row('0000000000000003', 20, 1885, 'Weteringschans', { 'fronts/0/cornice': 'bracketed' }),
  row('0000000000000004', 30, 1700, 'Den Texstraat', { 'fronts/0/cornice': 'heavy' }),
  row('0000000000000005', 400, 1885, 'Den Texstraat', { 'fronts/0/cornice': 'frieze' }),
] };
const q = (pandId: string, street = 'Den Texstraat', year = 1882) => ({ pandId, lng: at(0)[0], lat: at(0)[1], year, street });

test('no structure field is a dressing', () => {
  for (const p of STRUCTURE_FIELDS) assert.ok(!(DRESSING_FIELDS as readonly string[]).includes(p), p);
  for (const r of STREET_TEMPLATE_TABLE.rows.slice(0, 2000)) for (const k of Object.keys(r.f)) assert.ok((DRESSING_FIELDS as readonly string[]).includes(k), k);
});

test('same band, within 150 m, same street first; another band or a far house never', () => {
  const reach = templatesInReach(q('0363100012999999'), T);
  assert.deepEqual(reach.map(r => r.row.p), ['0000000000000003', '0000000000000001', '0000000000000002']);
  const pick = streetTemplateFor(q('0363100012999999'), T)!;
  assert.ok(pick.sameStreet && ['0000000000000001', '0000000000000002'].includes(pick.pandId));
  assert.equal(pick.pool, 2);
  // No template on the street: the adjoining block (any street in reach).
  assert.equal(streetTemplateFor(q('0363100012999999', 'Lijnbaansgracht'), T)!.pool, 3);
  assert.equal(streetTemplateFor(q('0363100012999999', 'Den Texstraat', 1950), T), null);
  assert.equal(streetTemplateFor({ ...q('0363100012999999'), year: null }, T), null);
});

test('variety guard: the pick follows a hash of the pand id, so a street gets both templates', () => {
  const picks = new Set<string>();
  for (let i = 0; i < 40; i++) picks.add(streetTemplateFor(q(`03631000121${String(10000 + i)}`), T)!.pandId);
  assert.equal(picks.size, 2);
  assert.equal(pandHash('abc'), pandHash('abc'));
  // The template house never templates itself.
  assert.ok(!templatesInReach({ ...q('0000000000000001') }, T).some(r => r.row.p === '0000000000000001'));
});
