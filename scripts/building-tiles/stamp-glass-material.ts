/**
 * Stamp OSM's glazing material onto the published building tiles (lane glass-parts-20261110, feedback fc427560).
 *
 * The tiles kept a glass part's colour prior (`#5a81a0`) but dropped `building:material`, so the mesh could not tell a
 * skybridge from a blue slab. build-lod1-tiles.ts now keeps `material` for glass and mirror; this script carries it into
 * the tiles already published (which several later passes rewrote), without a full rebuild:
 *
 *   - the source is buildings-colored.geojson (`material`, from `building:material`, per OSM id);
 *   - a feature is stamped only when its own id is that OSM way or relation (never a BAG pand that matched it, never a
 *     pipeline piece `passage:…`), the same rule build-lod1-city.ts applies;
 *   - only the stamped feature changes (`"material":"glass"` after its id); every other byte of the tile body is the
 *     same, and tiles without a glazed part are not rewritten at all.
 *
 * Usage:
 *   node --import tsx scripts/building-tiles/stamp-glass-material.ts             # staging/building-tiles-glass + report
 *   node --import tsx scripts/building-tiles/stamp-glass-material.ts --publish   # rewrite the published tiles in place
 * Idempotent: a feature that already carries `material` is left alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { glazedMaterialOf, type GlazedMaterial } from '../../src/canalRecall/glazedMaterial.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const TILES = path.join(EXTRACT, 'building-tiles/14');
const STAGING = path.join(EXTRACT, 'staging/building-tiles-glass');
const publish = process.argv.includes('--publish');

/** The OSM ids whose own tags state a glazed wall. */
export function glazedSourceIds(colored: { features: { properties: Record<string, unknown> }[] }): Map<string, GlazedMaterial> {
  const out = new Map<string, GlazedMaterial>();
  for (const f of colored.features) {
    const p = f.properties, id = typeof p.osmId === 'string' ? p.osmId : '';
    const material = glazedMaterialOf({ 'building:material': p.material, 'building:facade:material': p.facadeMaterial });
    if (/^[wr]\d+$/.test(id) && material) out.set(id, material);
  }
  return out;
}

/** A feature's properties opening, wherever it sits (one feature a line, or a tile a later pass wrote on one line). */
const OPENING = /"properties":\{"id":"([^"]+)",/g;
/** One tile body with the glazed features stamped; the ids it stamped. Every byte outside the stamped insertions is kept. */
export function stampTileBody(body: string, glazed: ReadonlyMap<string, GlazedMaterial>): { body: string; stamped: string[]; present: string[] } {
  const stamped: string[] = [], present: string[] = [];
  const next = body.replace(OPENING, (opening: string, id: string, at: number) => {
    const material = glazed.get(id);
    if (!material) return opening;
    present.push(id);
    const end = body.indexOf('},"geometry"', at);
    if (body.slice(at, end < 0 ? undefined : end).includes('"material":')) return opening;
    stamped.push(id);
    return `${opening}"material":"${material}",`;
  });
  return { body: next, stamped, present };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const glazed = glazedSourceIds(JSON.parse(fs.readFileSync(path.join(EXTRACT, 'buildings-colored.geojson'), 'utf8')));
  const report: { source: number; stamped: { tile: string; ids: string[] }[]; byMaterial: Record<string, number>; unplaced: string[] } = { source: glazed.size, stamped: [], byMaterial: {}, unplaced: [] };
  const seen = new Set<string>();
  for (const x of fs.readdirSync(TILES).sort()) {
    const dir = path.join(TILES, x);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.geojson.gz')).sort()) {
      const body = zlib.gunzipSync(fs.readFileSync(path.join(dir, file))).toString('utf8');
      const { body: next, stamped, present } = stampTileBody(body, glazed);
      for (const id of present) seen.add(id);
      if (!stamped.length) continue;
      const tile = `${x}/${file.replace('.geojson.gz', '')}`;
      report.stamped.push({ tile, ids: stamped });
      for (const id of stamped) report.byMaterial[glazed.get(id)!] = (report.byMaterial[glazed.get(id)!] ?? 0) + 1;
      const out = publish ? path.join(dir, file) : path.join(STAGING, '14', x, file);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, zlib.gzipSync(next));
    }
  }
  report.unplaced = [...glazed.keys()].filter(id => !seen.has(id)).sort();
  const total = report.stamped.reduce((s, t) => s + t.ids.length, 0);
  fs.mkdirSync(STAGING, { recursive: true });
  fs.writeFileSync(path.join(STAGING, 'report.json'), `${JSON.stringify(report, null, 1)}\n`);
  process.stdout.write(`glazed OSM sources ${glazed.size}; stamped ${total} features in ${report.stamped.length} tiles (${Object.entries(report.byMaterial).map(([k, v]) => `${k} ${v}`).join(', ')}); `
    + `${report.unplaced.length} sources not in the tiles under their own id (BAG pand stood in, or outside the extract)\n`
    + `${publish ? 'published into' : 'staged at'} ${publish ? TILES : STAGING}; report ${path.join(STAGING, 'report.json')}\n`);
}
