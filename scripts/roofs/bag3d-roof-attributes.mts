/**
 * 3DBAG roof attributes per pand from the cached 3DBAG tiles (open data, CC BY 4.0), for the roof facts:
 *   dormer  - a sloped roof (b3_dak_type slanted) that also carries flat roof area between 2 m² and 35 %
 *             of the roof, over at least three roof planes: the flat tops of dakkapellen in LoD2.2;
 *   glass   - b3_is_glas_dak (a glass roof: conservatory, atrium, greenhouse).
 * Writes `artifacts/roofs/bag3d-roof-attributes.json` ({ pand16: [dormer 0/1, glass 0/1] }, only non-zero).
 *
 *   tsx scripts/roofs/bag3d-roof-attributes.mts [--cache=~/Code/map-recall2/.cache/3dbag/v20250903/tiles]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const cache = process.argv.find(a => a.startsWith('--cache='))?.slice(8) ?? path.join(os.homedir(), 'Code/map-recall2/.cache/3dbag/v20250903/tiles');
const out: Record<string, [number, number]> = {};
let pands = 0, slanted = 0, dormers = 0, glass = 0;
for (const file of fs.readdirSync(cache).filter(f => f.endsWith('.city.json.gz'))) {
  const cj = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(cache, file))).toString('utf8'));
  for (const [id, obj] of Object.entries<any>(cj.CityObjects)) {
    if (obj.type !== 'Building' || !id.startsWith('NL.IMBAG.Pand.')) continue;
    const short = id.slice(14);
    if (short in out) continue;
    const a = obj.attributes ?? {};
    pands++;
    const flat = Number(a.b3_opp_dak_plat) || 0, sloped = Number(a.b3_opp_dak_schuin) || 0, planes = Number(a.b3_n_vlakken) || 0;
    const isSlanted = a.b3_dak_type === 'slanted';
    if (isSlanted) slanted++;
    const dormer = isSlanted && sloped > 0 && flat >= 2 && flat <= 0.35 * (flat + sloped) && planes >= 3 ? 1 : 0;
    const g = a.b3_is_glas_dak === true ? 1 : 0;
    dormers += dormer; glass += g;
    if (dormer || g) out[short] = [dormer, g];
  }
}
fs.mkdirSync('artifacts/roofs', { recursive: true });
fs.writeFileSync('artifacts/roofs/bag3d-roof-attributes.json', JSON.stringify(out));
console.log({ pands, slanted, dormers, glass });
