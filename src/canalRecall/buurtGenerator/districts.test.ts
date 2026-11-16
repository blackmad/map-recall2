// District libraries (docs/handoffs/buurt-generators-20261115.md): every library under districts/ is well formed (its
// families, pitched roof and notes), and generates a deterministic row on a fixture street.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateDistrict, type DistrictLibrary } from './generate.js';
import type { GenPand, GenStreet } from './rows.js';

const dir = new URL('./districts/', import.meta.url);
const libs = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => [f, JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8')) as DistrictLibrary] as const);
const LAT0 = 52.345, LNG0 = 4.87, M_LAT = 1 / 111_320, M_LNG = 1 / (111_320 * Math.cos(LAT0 * Math.PI / 180));
const at = (x: number, y: number) => [LNG0 + x * M_LNG, LAT0 + y * M_LAT] as const;
const pand = (i: number, eavesM: number, ridgeM: number, roofSlot: string | null, year = 1931): GenPand => {
  const x0 = i * 8, y0 = 6;
  return { id: `NL.IMBAG.Pand.03631000120000${String(i).padStart(2, '0')}`, ring: [at(x0, y0), at(x0 + 8, y0), at(x0 + 8, y0 + 11), at(x0, y0 + 11), at(x0, y0)], year, eavesM, ridgeM, roofSlot };
};
const streets: GenStreet[] = [{ name: 'Teststraat', path: [at(-20, 0), at(120, 0)] }];

test('district libraries: at least two, each with storey families, a cell design and notes on what it cannot draw', () => {
  assert.ok(libs.length >= 2, libs.map(l => l[0]).join(','));
  for (const [f, lib] of libs) {
    assert.equal(`${lib.district}.json`, f);
    assert.ok(lib.buurten.length && lib.families.length && lib.notDrawn.length, f);
    assert.ok(/^#[0-9a-f]{6}$/i.test(lib.design.wall.hex ?? ''), `${f}: a measured wall hex`);
    for (const n of Object.values(lib.rowNotes ?? {})) if (n.wall) assert.ok(/^#[0-9a-f]{6}$/i.test(n.wall.hex) && n.wall.evidence.length > 20, f);
  }
});

test('district libraries: a fixture row generates, deterministically, with the slot look on a pitched series', () => {
  for (const [f, lib] of libs) {
    // A year inside the library's period (De Pijp is 1868-1915; the fixture was a 1931 row).
    const year = lib.years && (1931 < lib.years[0] || 1931 > lib.years[1]) ? Math.round((lib.years[0] + lib.years[1]) / 2) : 1931;
    const pands = [0, 1, 2, 3].map(i => pand(i, 12.4, 17.4, 'slate', year));
    const a = JSON.stringify(generateDistrict(lib, pands, streets, new Set(), 'test')), b = JSON.stringify(generateDistrict(lib, [...pands].reverse(), streets, new Set(), 'test'));
    assert.equal(a, b, f);
    const res = generateDistrict(lib, pands, streets, new Set(), 'test');
    assert.equal(res.records.length, 4, f);
    const roof = (res.records[0] as { buurtKit?: { roof?: { roofHex?: string } } }).buurtKit?.roof;
    if (lib.pitched?.slotLooks?.slate) assert.equal(roof?.roofHex, lib.pitched.slotLooks.slate.roofHex, f);
  }
});
