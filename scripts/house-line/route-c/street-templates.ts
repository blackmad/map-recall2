/**
 * Writes src/canalRecall/houseSpec/street-templates.json: the street-template table (streetTemplate.ts). One row per published
 * HouseSpec with at least one dressing field from a photo source (`author`, `reviewed`, `streetlevel-measured`): short pand id,
 * centroid (building tile), BAG year (bag-facts), the front's street, the field source, and the photo-sourced dressings only.
 *
 *   node --import tsx scripts/house-line/route-c/street-templates.ts [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { DRESSING_FIELDS } from '../../../src/canalRecall/houseSpec/streetTemplate.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
const PHOTO = new Set(['author', 'reviewed', 'streetlevel-measured']);
const gz = (f: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
const rows: unknown[] = [];
const bySrc: Record<string, number> = {};
for (const x of fs.readdirSync(path.join(EXTRACT, 'house-specs/14'))) for (const yf of fs.readdirSync(path.join(EXTRACT, 'house-specs/14', x))) {
  const y = yf.replace('.json.gz', ''), specs = gz(path.join(EXTRACT, 'house-specs/14', x, yf)).buildings as Record<string, any>;
  const bagFile = path.join(EXTRACT, 'bag-facts/14', x, `${y}.json.gz`), tileFile = path.join(EXTRACT, 'building-tiles/14', x, `${y}.geojson.gz`);
  const bag = fs.existsSync(bagFile) ? gz(bagFile).pands : {};
  const at = new Map<string, [number, number]>();
  if (fs.existsSync(tileFile)) for (const f of gz(tileFile).features) {
    const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates[0][0] : null;
    if (!ring) continue;
    at.set(f.properties.id, [ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length, ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length]);
  }
  for (const [id, b] of Object.entries(specs)) {
    const s: Record<string, string> = b.s ?? {}, d = b.d ?? {}, f0 = d.fronts?.[0] ?? {};
    const fields: Record<string, unknown> = {}, srcs = new Set<string>();
    for (const p of DRESSING_FIELDS) {
      if (!PHOTO.has(s[p])) continue;
      const [a, k1, k2] = p.split('/');
      const v = a === 'fronts' ? f0[k2] : d.palette?.[k1];
      if (v !== undefined) { fields[p] = v; srcs.add(s[p]); }
    }
    const c = at.get(id);
    if (!Object.keys(fields).length || !c || !f0.street) continue;
    const src = [...srcs].sort().join('+');
    bySrc[src] = (bySrc[src] ?? 0) + 1;
    rows.push({ p: id.replace('NL.IMBAG.Pand.', ''), x: +c[0].toFixed(6), y: +c[1].toFixed(6), yr: bag[id.replace('NL.IMBAG.Pand.', '')]?.[5] || null, st: f0.street, src, f: fields });
  }
}
const out = { v: 1, generated: 'scripts/house-line/route-c/street-templates.ts', radiusM: 150, rows };
console.log(JSON.stringify({ rows: rows.length, bySrc }));
if (process.argv.includes('--write')) fs.writeFileSync('src/canalRecall/houseSpec/street-templates.json', JSON.stringify(out) + '\n');
