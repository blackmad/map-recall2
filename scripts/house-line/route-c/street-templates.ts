/**
 * Writes src/canalRecall/houseSpec/street-templates.json: the street-template table (streetTemplate.ts). One row per published
 * HouseSpec with at least one dressing field from a photo source (`author`, `reviewed`, `streetlevel-measured`): short pand id,
 * centroid (building tile), BAG year (bag-facts), the front's street and its class (streetClass.ts), the scale (the building
 * tile's 3DBAG height; the footprint's narrow side as the front width), the field source, and the
 * photo-sourced dressings only. Interwar and post-war houses never template (round 3 ruling) and are left out.
 *
 *   node --import tsx scripts/house-line/route-c/street-templates.ts [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { DRESSING_FIELDS, TEMPLATE_BANDS, footprintWidthM } from '../../../src/canalRecall/houseSpec/streetTemplate.ts';
import { streetClassOf } from '../../../src/canalRecall/houseSpec/streetClass.ts';
import { familyOf } from '../../../src/canalRecall/houseSpec/families.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
const PHOTO = new Set(['author', 'reviewed', 'streetlevel-measured']);
const gz = (f: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
const rows: unknown[] = [];
const bySrc: Record<string, number> = {};
for (const x of fs.readdirSync(path.join(EXTRACT, 'house-specs/14'))) for (const yf of fs.readdirSync(path.join(EXTRACT, 'house-specs/14', x))) {
  const y = yf.replace('.json.gz', ''), specs = gz(path.join(EXTRACT, 'house-specs/14', x, yf)).buildings as Record<string, any>;
  const bagFile = path.join(EXTRACT, 'bag-facts/14', x, `${y}.json.gz`), tileFile = path.join(EXTRACT, 'building-tiles/14', x, `${y}.geojson.gz`);
  const bag = fs.existsSync(bagFile) ? gz(bagFile).pands : {};
  const at = new Map<string, [number, number]>(), wid = new Map<string, number | null>(), hgt = new Map<string, number | null>();
  if (fs.existsSync(tileFile)) for (const f of gz(tileFile).features) {
    const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates[0][0] : null;
    if (!ring) continue;
    wid.set(f.properties.id, footprintWidthM(ring)); hgt.set(f.properties.id, typeof f.properties.height === 'number' && f.properties.height > 0 ? f.properties.height : null);
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
    const short = id.replace('NL.IMBAG.Pand.', ''), b6 = bag[short], yr = b6?.[5] || null;
    if (!(TEMPLATE_BANDS as readonly string[]).includes(familyOf(yr))) { bySrc['skipped: band ' + familyOf(yr)] = (bySrc['skipped: band ' + familyOf(yr)] ?? 0) + 1; continue; }
    const hm = hgt.get(id) ?? null, w = wid.get(id) ?? null;
    rows.push({ p: short, x: +c[0].toFixed(6), y: +c[1].toFixed(6), yr, st: f0.street, c: streetClassOf(f0.street), h: hm === null ? null : +hm.toFixed(1), w: w === null ? null : +w.toFixed(1), src, f: fields });
    bySrc[src] = (bySrc[src] ?? 0) + 1;
  }
}
const out = { v: 2, generated: 'scripts/house-line/route-c/street-templates.ts', rows };
console.log(JSON.stringify({ rows: rows.length, bySrc }));
if (process.argv.includes('--write')) fs.writeFileSync('src/canalRecall/houseSpec/street-templates.json', JSON.stringify(out) + '\n');
