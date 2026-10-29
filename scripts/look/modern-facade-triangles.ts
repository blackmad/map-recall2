/**
 * The modern vocabulary's cost and its pre-1945 guarantee (GitHub #117).
 *   node --import tsx scripts/look/modern-facade-triangles.ts [spots.json]
 * Around each sheet spot (scripts/look/modern-gap-spots.json, 150 m), the BAG pands decorated as the streamer does
 * (genericFacades.ts decorateFacade), photo look: walls + extras chunks with `modernFacades` on and off. Prints
 * triangles per post-1945 building per spot (acceptance: < 10 % growth), and a hash of the pre-1945 buildings' chunk
 * arrays, which must not change.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { buildFeatureChunk } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { decorateFacade } from '../../src/canalRecall/genericFacades.ts';
import { decorateBuildingFeature } from '../../src/canalRecall/buildingTilesBrowser.ts';

const spots = JSON.parse(fs.readFileSync(process.argv[2] ?? 'scripts/look/modern-gap-spots.json', 'utf8')) as { slug: string; lng: number; lat: number }[];
const tile = (lng: number, lat: number) => { const n = 2 ** 14, s = Math.sin(lat * Math.PI / 180); return [Math.floor((lng + 180) / 360 * n), Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n)]; };
const tris = (c: any) => (c?.indices?.length ?? 0) / 3;
const digest = (chunks: any[]) => { const h = crypto.createHash('sha256'); for (const c of chunks) for (const v of Object.values(c ?? {})) if (ArrayBuffer.isView(v)) h.update(new Uint8Array((v as any).buffer, (v as any).byteOffset, (v as any).byteLength)); return h.digest('hex').slice(0, 16); };
const flag = (on: boolean) => { (globalThis as any).__canalRecallModernFacades = on; };
let on = 0, off = 0, oldSame = true;
for (const s of spots) {
  const [x, y] = tile(s.lng, s.lat);
  const fc = JSON.parse(zlib.gunzipSync(fs.readFileSync(`public/data/extracts/amsterdam/bag-tiles/14/${x}/${y}.geojson.gz`)).toString());
  const feats = (fc.features as any[]).filter(f => { const c = f.geometry?.coordinates?.[0]?.[0]; return c && Math.hypot((c[0] - s.lng) * 67900, (c[1] - s.lat) * 110500) < 150; })
    .map(f => decorateFacade(decorateBuildingFeature({ ...f, properties: { ...f.properties, constructionYear: f.properties.year, shopQuiet: true } } as any, new Map()) as any));
  const modern = feats.filter(f => f.properties.constructionYear >= 1945), old = feats.filter(f => !(f.properties.constructionYear >= 1945));
  const count = (v: boolean) => { flag(v); return tris(buildFeatureChunk(modern, 'photo', 'walls')) + tris(buildFeatureChunk(modern, 'photo', 'extras')); };
  const hashOld = (v: boolean) => { flag(v); return digest([buildFeatureChunk(old, 'photo', 'walls'), buildFeatureChunk(old, 'photo', 'extras')]); };
  const a = count(true), b = count(false), ha = hashOld(true), hb = hashOld(false); on += a; off += b; oldSame &&= ha === hb;
  console.log(s.slug.padEnd(28), String(modern.length).padStart(4), 'post-1945', `${(b / Math.max(1, modern.length)).toFixed(0)} -> ${(a / Math.max(1, modern.length)).toFixed(0)} tris/building`, `${b ? ((a / b - 1) * 100).toFixed(1) : '0.0'} %`, `| ${old.length} older ${ha === hb ? 'identical' : 'CHANGED'} ${ha}`);
}
flag(true);
console.log('all spots', `${((on / off - 1) * 100).toFixed(1)} %`, oldSame ? 'pre-1945 identical' : 'PRE-1945 CHANGED');
if (!oldSame || on / off - 1 >= 0.1) process.exitCode = 1;
