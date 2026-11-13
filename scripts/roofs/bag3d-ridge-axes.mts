/**
 * 3DBAG ridge axis per pand from the cached 3DBAG tiles (open data, CC BY 4.0): the measured ridge direction the city
 * tier's guessed saddle direction is audited against (scripts/audit-ridge-vs-bag.ts, src/canalRecall/roofs/ridgeAxis.ts).
 * Writes `artifacts/roofs/bag3d-ridge-axes.json` ({ pand16: [angleDeg RD ccw from east, coherence 0..1, slanted m2, pitch deg] }).
 *
 *   tsx scripts/roofs/bag3d-ridge-axes.mts [--cache=~/Code/map-recall2/.cache/3dbag/v20250903/tiles]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { ridgeAxisOf } from '../../src/canalRecall/roofs/ridgeAxis.ts';

const cache = process.argv.find(a => a.startsWith('--cache='))?.slice(8) ?? path.join(os.homedir(), 'Code/map-recall2/.cache/3dbag/v20250903/tiles');
const out: Record<string, [number, number, number, number]> = {};
let pands = 0;
for (const file of fs.readdirSync(cache).filter(f => f.endsWith('.city.json.gz'))) {
  const cj = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(cache, file))).toString('utf8'));
  for (const [id, obj] of Object.entries<any>(cj.CityObjects)) {
    if (obj.type !== 'Building' || !id.startsWith('NL.IMBAG.Pand.')) continue;
    const short = id.slice(14);
    if (short in out) continue;
    pands++;
    const r = ridgeAxisOf(cj, id);
    if (r) out[short] = [Math.round(r.angleDeg * 10) / 10, Math.round(r.coherence * 100) / 100, Math.round(r.slantedM2), Math.round(r.slopeDeg)];
  }
}
fs.mkdirSync('artifacts/roofs', { recursive: true });
fs.writeFileSync('artifacts/roofs/bag3d-ridge-axes.json', JSON.stringify(out));
console.log({ pands, withRidge: Object.keys(out).length });
