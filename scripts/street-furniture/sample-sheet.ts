// Contact sheet of panorama views for a sample of extract records (measurement evidence, lane #170):
//
//   npx tsx scripts/street-furniture/sample-sheet.ts --kind=container [--subtype=glas] [--n=8] [--box=w,s,e,n] [--out=staging/street-furniture/sample-container.jpg] [--fov=45] [--pitch=-10]
//
// Reads the staging extract, samples records deterministically (every k-th), labels each view with id, subtype,
// panorama id and distance. Open data only (Gemeente Amsterdam panoramas, CC BY 4.0).
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import { panoView } from './pano.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;

async function main(): Promise<void> {
  const kind = arg('kind', 'container'), subtype = arg('subtype'), n = Number(arg('n', '8'));
  const box = arg('box', '4.875,52.355,4.905,52.382').split(',').map(Number);
  const dir = 'artifacts/street-furniture/staging/tiles';
  const recs: any[] = [];
  for (const f of readdirSync(dir)) for (const r of JSON.parse(gunzipSync(readFileSync(`${dir}/${f}`)).toString()).items)
    if (r.kind === kind && (!subtype || r.subtype === subtype) && r.lng >= box[0] && r.lng <= box[2] && r.lat >= box[1] && r.lat <= box[3]) recs.push(r);
  recs.sort((a, b) => a.id.localeCompare(b.id));
  const step = Math.max(1, Math.floor(recs.length / (n * 2)));
  const tiles: Buffer[] = [], labels: string[] = [];
  for (let i = 0; i < recs.length && tiles.length < n; i += step) {
    const r = recs[i];
    const v = await panoView(r.lng, r.lat, { fov: Number(arg('fov', '45')), pitch: Number(arg('pitch', '-10')), min: 3, max: Number(arg('max', '12')), width: 480, height: 480 }).catch(() => null);
    if (!v) continue;
    const label = `${r.id} ${r.subtype}${r.fraction ? ` ${r.fraction}` : ''} | ${v.pick.panoId.slice(-26)} ${v.pick.distanceM} m`;
    const svg = Buffer.from(`<svg width="480" height="30"><rect width="480" height="30" fill="black" opacity="0.7"/><text x="6" y="20" font-size="13" font-family="Helvetica" fill="white">${label.replace(/&/g, '&amp;')}</text></svg>`);
    tiles.push(await sharp(v.jpeg).composite([{ input: svg, top: 450, left: 0 }]).jpeg().toBuffer());
    labels.push(`${label} | ${v.pick.lng.toFixed(6)},${v.pick.lat.toFixed(6)} → ${r.lng},${r.lat}`);
  }
  const cols = 4, rows = Math.ceil(tiles.length / cols);
  const out = arg('out', `staging/street-furniture/sample-${kind}${subtype ? `-${subtype}` : ''}.jpg`);
  mkdirSync(dirname(out), { recursive: true });
  await sharp({ create: { width: cols * 480, height: rows * 480, channels: 3, background: '#222' } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * 480, top: Math.floor(i / cols) * 480 }))).jpeg({ quality: 82 }).toFile(out);
  writeFileSync(out.replace(/\.jpg$/, '.txt'), labels.join('\n') + '\n');
  console.log(`${tiles.length} views of ${recs.length} candidates -> ${out}`);
}
void main();
