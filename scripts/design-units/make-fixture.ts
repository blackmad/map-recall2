/**
 * Cut the design-unit regression fixture (src/canalRecall/designUnits/fixtures/regression-rows.json): the pands of the
 * four named rows (REGRESSION_ROWS) and every pand, ordekaart object and named street within 60 m of them, so the unit
 * test runs the real join on real geometry without the 60,000-pand ring.
 *
 *   node --import tsx scripts/design-units/make-fixture.ts [--source <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parseOrdekaart } from '../../src/canalRecall/designUnits/join.ts';
import { REGRESSION_ROWS } from '../../src/canalRecall/designUnits/regressionRows.ts';
import { ORDEKAART_LAYERS, ORDEKAART_SOURCES, type UnitPand } from '../../src/canalRecall/designUnits/types.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const i = process.argv.indexOf('--source');
const SOURCE = path.resolve(ROOT, i >= 0 ? process.argv[i + 1] : '.cache/ordekaart-20261119');
const OUT = path.join(ROOT, 'src/canalRecall/designUnits/fixtures/regression-rows.json');
const STREET_CLASSES = new Set(['residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'living_street', 'pedestrian', 'busway', 'trunk']);
const R = 0.0009; // ~60 m

const wanted = new Set(REGRESSION_ROWS.flatMap(r => r.units.flat()));
const pands = new Map<string, UnitPand>();
const TILES = path.join(EXTRACT, 'bag-tiles/14');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
for (const x of fs.readdirSync(TILES).filter(n => /^\d+$/.test(n))) for (const file of fs.readdirSync(path.join(TILES, x)).filter(n => n.endsWith('.geojson.gz'))) {
  for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(TILES, x, file))).toString('utf8')).features) {
    const full = String(f.properties?.id ?? ''); if (!full.startsWith('NL.IMBAG.Pand.') || !f.geometry) continue;
    const id = full.slice(14); if (pands.has(id)) continue;
    const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates[0][0] : null;
    if (!ring) continue;
    const y = num(f.properties.year);
    pands.set(id, { id, ring: ring.map((c: number[]) => [+c[0].toFixed(7), +c[1].toFixed(7)]), year: y && y > 1000 ? y : null, eavesM: num(f.properties.eaves), heightM: num(f.properties.height), roofCode: num(f.properties.roof) });
  }
}
const missing = [...wanted].filter(id => !pands.has(id));
if (missing.length) throw Error(`regression pands missing from the base tiles: ${missing.join(', ')}`);
const centres = [...wanted].map(id => pands.get(id)!.ring[0]);
const near = (c: readonly number[]) => centres.some(k => Math.abs(k[0] - c[0]) < R && Math.abs(k[1] - c[1]) < R * 0.62);
const keep = [...pands.values()].filter(p => p.ring.some(near)).sort((a, b) => (a.id < b.id ? -1 : 1));

const objects = [];
for (const layer of ORDEKAART_LAYERS) {
  const plain = path.join(SOURCE, `${ORDEKAART_SOURCES[layer].kaartlaag}.geojson`);
  const raw = fs.existsSync(plain) ? fs.readFileSync(plain) : zlib.gunzipSync(fs.readFileSync(`${plain}.gz`));
  for (const o of parseOrdekaart(layer, JSON.parse(raw.toString('utf8')))) if (o.polygons.some(poly => poly[0].some(near))) objects.push(o);
}
const ways = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'streets-routing.json'), 'utf8')) as Array<{ name?: string; highway?: string; path?: number[][]; paths?: number[][][] }>;
const streets = ways.filter(x => x.name && STREET_CLASSES.has(x.highway ?? '')).flatMap(x => (x.paths ?? [x.path!]).filter(Boolean).map(p => ({ name: x.name!, path: p.map(q => [q[1], q[0]] as const) })))
  .filter(s => s.path.some(c => near(c)));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ note: 'Cut by scripts/design-units/make-fixture.ts from bag-tiles/14, the ordekaart layers (2026-11-19) and streets-routing.json.', pands: keep, objects, streets }));
console.log(`fixture: ${keep.length} pands, ${objects.length} objects, ${streets.length} streets → ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
