/**
 * Ridge-axes sidecar tiles (`ridge-axes/14/x/y.json.gz`, src/canalRecall/roofs/ridgeFacts.ts) from the 3DBAG ridge axes
 * (scripts/roofs/bag3d-ridge-axes.mts). Writes to a STAGING directory and reports coverage; the integrator publishes
 * after review:
 *   tsx scripts/roofs/build-ridge-axes.ts [--axes=artifacts/roofs/bag3d-ridge-axes.json] [--out=artifacts/roofs/ridge-axes-staging]
 *   cp -R artifacts/roofs/ridge-axes-staging/14 public/data/extracts/amsterdam/ridge-axes/
 * A pand is kept when its slanted roof is one clean saddle: coherence >= 0.75, >= 20 m2 slanted, pitch >= 15 degrees.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const axes = JSON.parse(fs.readFileSync(arg('axes', 'artifacts/roofs/bag3d-ridge-axes.json'), 'utf8')) as Record<string, [number, number, number, number]>;
const out = arg('out', 'artifacts/roofs/ridge-axes-staging');
const TILES = 'public/data/extracts/amsterdam/building-tiles/14';
let tiles = 0, pands = 0, kept = 0;
for (const x of fs.readdirSync(TILES)) for (const f of fs.readdirSync(path.join(TILES, x))) {
  const fc = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(TILES, x, f))).toString('utf8')) as { features: { properties: { id?: string } }[] };
  const ridge: Record<string, number> = {};
  for (const ft of fc.features) {
    const id = String(ft.properties.id ?? '');
    if (!id.startsWith('NL.IMBAG.Pand.')) continue;
    pands++;
    const a = axes[id.slice(14)];
    if (a && a[1] >= 0.75 && a[2] >= 20 && a[3] >= 15) { ridge[id.slice(14)] = Math.round(a[0]) % 180; kept++; }
  }
  tiles++;
  if (!Object.keys(ridge).length) continue;
  const name = f.replace('.geojson.gz', '.json.gz');
  fs.mkdirSync(path.join(out, '14', x), { recursive: true });
  fs.writeFileSync(path.join(out, '14', x, name), zlib.gzipSync(JSON.stringify({ version: 1, ridge })));
}
console.log({ tiles, pands, withRidge: kept, share: +(kept / pands).toFixed(3), out });
