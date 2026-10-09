/**
 * Contact sheet: reference | model front | model 3/4 | (optional) in-game desktop.
 *
 *   node --import tsx scripts/haparandaweg/render.ts --id=haparandaweg-902-950 [--game=path.png] [--ref=front.jpg|front-alt.jpg|thumb.jpg] [--bearing=320]
 */
import fs from 'node:fs';
import sharp from 'sharp';
import { renderModels, frontViews, closeRenderer } from '../building-recipes/render.ts';
import { loadSpec } from './build.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const id = arg('id'), { spec, set } = loadSpec(id);
const refDir = `artifacts/haparandaweg/ref/${spec.pandId}`;
const refJson = fs.existsSync(`${refDir}/reference.json`) ? JSON.parse(fs.readFileSync(`${refDir}/reference.json`, 'utf8')) : null;
const toLocal = (lng: number, lat: number): [number, number] => [(lng - set.anchor[0]) * 111320 * Math.cos(set.anchor[1] * Math.PI / 180), (set.anchor[1] - lat) * 111320];
let target: [number, number] = [0, 0], bearing = Number(arg('bearing', refJson?.wall?.outwardBearingDeg ?? 0)), widthM = 25;
if (refJson?.wall) {
  const a = toLocal(...(refJson.wall.startLngLat as [number, number])), b = toLocal(...(refJson.wall.endLngLat as [number, number]));
  target = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; widthM = refJson.wall.lengthM;
}
if (arg('at')) target = arg('at').split(',').map(Number) as [number, number];
const rad = bearing * Math.PI / 180, normal: [number, number] = [Math.sin(rad), -Math.cos(rad)];
const file = arg('glb', `artifacts/haparandaweg/${id}/model.glb`);
const views = frontViews([target[0], 0, target[1]], normal, Math.max(widthM, 14), set.heightMax, { width: 520, height: 700 });
const [front, tq] = await renderModels([{ file }], [views.front, views.threeQuarter]).then(async a => {
  const b = await renderModels([{ file }], [views.threeQuarter]); return [a[0], b[0]];
});
await closeRenderer();
const H = 700, W = 520;
const panels: { buf: Buffer; label: string }[] = [];
const refName = arg('ref', 'front.jpg');
if (fs.existsSync(`${refDir}/${refName}`)) panels.push({ buf: await sharp(`${refDir}/${refName}`).resize(W, H, { fit: 'contain', background: '#1a1a1a' }).png().toBuffer(), label: `reference ${refName}` });
panels.push({ buf: await sharp(front).resize(W, H).png().toBuffer(), label: 'model front' }, { buf: await sharp(tq).resize(W, H).png().toBuffer(), label: 'model 3/4' });
if (arg('game') && fs.existsSync(arg('game'))) panels.push({ buf: await sharp(arg('game')).resize(W, H, { fit: 'cover' }).png().toBuffer(), label: 'in-game desktop' });
const svg = (t: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="28"><rect width="100%" height="100%" fill="#111"/><text x="8" y="20" font-family="Helvetica" font-size="16" fill="#eee">${t}</text></svg>`);
const sheet = sharp({ create: { width: W * panels.length, height: H + 28, channels: 3, background: '#111' } })
  .composite(panels.flatMap((p, i) => [{ input: svg(`${spec.name} - ${p.label}`), left: i * W, top: 0 }, { input: p.buf, left: i * W, top: 28 }]));
const out = arg('out', `artifacts/haparandaweg/${id}/contact.png`);
await sheet.png().toFile(out);
console.log(out);
