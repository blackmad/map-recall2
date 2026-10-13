/**
 * Upsert the manualCatalogue.json entry of a hand-built landmark from scripts/landmarks/<id>-spec.json.
 *
 *   node --import tsx scripts/landmarks/upsert-catalogue-entry.ts <id> [--footprint-from=<facts.json>]
 *
 * With --footprint-from the BAG ring of a large-tier facts file (`bagFootprintRD`) is converted to a WGS84 Polygon and stored as
 * `buildingFootprint` (the plan that check:osm-under-models and the footprint overlays read). Keeps the catalogue's formatting.
 */
import fs from 'node:fs';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';

const id = process.argv[2];
if (!id) throw new Error('usage: upsert-catalogue-entry.ts <id> [--footprint-from=<facts.json>]');
const from = process.argv.find(a => a.startsWith('--footprint-from='))?.slice('--footprint-from='.length);
const cat = 'src/canalRecall/landmarks/manualCatalogue.json';
const list = JSON.parse(fs.readFileSync(cat, 'utf8')) as {id: string}[];
const entry = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-spec.json`, 'utf8')) as Record<string, unknown>;
if (from) {
  const facts = JSON.parse(fs.readFileSync(from, 'utf8'));
  const rd = facts.bagFootprintRD as unknown[];
  const outer = (Array.isArray(rd[0]) && Array.isArray((rd[0] as unknown[])[0]) ? rd[0] : rd) as ({x: number; y: number} | number[])[];
  const ring = outer.map(p => {
    const [lng, lat] = Array.isArray(p) ? rdToLngLat({x: p[0], y: p[1]}) : rdToLngLat(p);
    return [Math.round(lng * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7];
  });
  const last = ring[ring.length - 1], first = ring[0];
  if (last[0] !== first[0] || last[1] !== first[1]) ring.push([...first]);
  entry.buildingFootprint = {type: 'Polygon', coordinates: [ring]};
}
const i = list.findIndex(e => e.id === id);
if (i >= 0) list[i] = entry as {id: string}; else list.push(entry as {id: string});
fs.writeFileSync(cat, JSON.stringify(list, null, 2) + '\n');
console.log(i >= 0 ? 'updated' : 'added', id);
