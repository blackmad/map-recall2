/**
 * Blind A/B sheets for a hand-modelled block, in Node (lane hand-blocks-c-20261122): photo | A | B, today and the new
 * landmark GLB on shuffled sides, the key in a separate file the judge never sees.
 *
 *   node --import tsx scripts/landmarks/hand-block-ab.ts --id=<landmark id> --pand=<pand> --tag=<crop tag> --line=<lng,lat,lng,lat>
 *        [--pano=<panorama id>] [--top=<m>] [--seed=<string>] [--out=<dir>] [--glb=<path>] [--ppm=20]
 *
 * Today is what house:preview draws for the pand (installed model, else the generic streamed path); the new model is
 * public/canal-drive/models/<id>.glb placed at <id>-footprints.json's anchor (north offset 0), both through the
 * preview's GLB elevation renderer on the same wall line, plus (--pano) a street view from that panorama's camera aimed at
 * the wall centre as the brief's aimed thumbnail is (house:preview --pose), set beside the thumbnail. The photo is artifacts/landmark-briefs/<id>/<tag>.jpg (rectified on the same line). Writes
 * <out>/<tag>-front.jpg and <tag>-street.jpg (sides from a seeded RNG: hash of seed + tag) and <out>/key-<tag>.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {parseArgs, PreviewSession, renderInstalled, renderPand} from '../house-preview/preview.ts';
import {cachedJson} from '../pand-reference/core.ts';

const arg = (n: string, d?: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const id = arg('id')!, pand = arg('pand')!, tag = arg('tag')!, line = arg('line')!;
if (!id || !pand || !tag || !line) throw new Error('usage: hand-block-ab.ts --id= --pand= --tag= --line=');
const out = path.resolve(arg('out', `artifacts/hand-blocks/${id}/ab`)!), seed = arg('seed', id)!, ppm = Number(arg('ppm', '20'));
const glb = path.resolve(arg('glb', `public/canal-drive/models/${id}.glb`)!);
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
fs.mkdirSync(out, {recursive: true});

/** mulberry32 over a 32-bit FNV-1a hash of the seed string. */
export function seededFlip(s: string): boolean {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  let t = (h + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296) < 0.5;
}

const session = new PreviewSession('photo');
// --pano: the aimed-thumbnail pose (pand-reference/rectify.ts aimedThumbnail), eye 1.7 m instead of the camera's 2.4 m
let pose: string | null = null;
if (arg('pano')) {
  const rec = await cachedJson(`https://api.data.amsterdam.nl/panorama/panoramas/${arg('pano')}/`);
  const cam = rec.geometry.coordinates as number[], [a0, a1, b0, b1] = line.split(',').map(Number), lngC = (a0 + b0) / 2, latC = (a1 + b1) / 2;
  const dx = (lngC - cam[0]) * 111320 * Math.cos(latC * Math.PI / 180), dy = (latC - cam[1]) * 110540, d = Math.max(Math.hypot(dx, dy), 4);
  const lenM = Math.hypot((b0 - a0) * 111320 * Math.cos(latC * Math.PI / 180), (b1 - a1) * 110540), h = Number(arg('top', '20'));
  const fov = Math.round(Math.min(100, Math.max(40, 2 * Math.atan(Math.max(lenM / 2 + 1.5, h / 2 + 1) / d) * 180 / Math.PI)));
  const pitch = Math.round(Math.atan((h / 2 - 2.4) / d) * 180 / Math.PI);
  pose = `${cam[0]},${cam[1]},${(Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360},${fov},${pitch}`;
}
const base = parseArgs([pand, `--wall=line:${line}`, '--threeq', `--ppm=${ppm}`, ...(pose ? [`--pose=${pose}`] : [])]);
const today = await renderPand(session, pand, {...base, out: path.join(out, `today-${tag}`)});
const fresh = await renderInstalled(session, pand, {key: id, glb, anchor: src.anchor, northOffsetDegrees: 0, mirror: false, source: `${id}-footprints.json`},
  {...base, out: path.join(out, `new-${tag}`)}, 'landmark GLB');
const flip = seededFlip(`${seed}:${tag}`);
const [A, B] = flip ? [fresh, today] : [today, fresh];
const file = (r: typeof today, f: string) => r.files.find(x => x.endsWith(f))!;

async function stack(imgs: {f: string; label: string}[], W: number, dest: string, vertical: boolean) {
  const parts = [];
  for (const {f, label} of imgs) {
    const img = await sharp(f).flatten({background: '#c8d4dc'}).resize(vertical ? {width: W, height: 520, fit: 'contain', background: '#c8d4dc'} : {width: W, height: W, fit: 'contain', background: '#c8d4dc'}).png().toBuffer({resolveWithObject: true});
    const bar = Buffer.from(`<svg width="${img.info.width}" height="40"><rect width="100%" height="40" fill="#202020"/><text x="50%" y="28" text-anchor="middle" font-size="24" fill="#fff" font-family="sans-serif">${label}</text></svg>`);
    parts.push({bar, img});
  }
  const comps: {input: Buffer; left: number; top: number}[] = [];
  let x = 0, y = 0, H = 0, WT = 0;
  for (const p of parts) {
    comps.push({input: p.bar, left: x, top: y}, {input: p.img.data, left: x, top: y + 40});
    if (vertical) { y += 40 + p.img.info.height; WT = Math.max(WT, p.img.info.width); H = y; } else { x += p.img.info.width + 8; WT = x; H = Math.max(H, 40 + p.img.info.height); }
  }
  await sharp({create: {width: WT, height: H, channels: 3, background: '#202020'}}).composite(comps).jpeg({quality: 85}).toFile(dest);
}
const photo = `artifacts/landmark-briefs/${id}/${tag}.jpg`, thumb = `artifacts/landmark-briefs/${id}/${tag}.thumb.jpg`;
await stack([{f: photo, label: 'PHOTO (Gemeente Amsterdam panorama, rectified)'}, {f: file(A, 'front.png'), label: 'A'}, {f: file(B, 'front.png'), label: 'B'}], 1400, path.join(out, `${tag}-front.jpg`), true);
const view = pose ? 'pose.png' : 'threeq.png';
await stack([{f: fs.existsSync(thumb) ? thumb : photo, label: 'PHOTO'}, {f: file(A, view), label: 'A'}, {f: file(B, view), label: 'B'}], 620, path.join(out, `${tag}-street.jpg`), false);
fs.writeFileSync(path.join(out, `key-${tag}.json`), JSON.stringify({id, tag, seed: `${seed}:${tag}`, A: flip ? 'new' : 'today', B: flip ? 'today' : 'new', todayRoute: today.measure.route, todayWhy: today.measure.routeWhy}, null, 1) + '\n');
console.log(`${tag}: ${path.relative(process.cwd(), path.join(out, `${tag}-front.jpg`))}, ${tag}-street.jpg; key in key-${tag}.json`);
