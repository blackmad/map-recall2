/**
 * Photo | model | 50 % overlay sheets of the Mercatorplein towers, one row per view:
 *
 *  - `--crops=a.json,b.json`: rectified panorama crops (tall-crops.ts / the brief; plane from the wall's viewer-left corner
 *    `wallRD.a` to `wallRD.b`, from `baseZ` m NAP up, `width / length` px per metre): the models are rendered in an
 *    orthographic elevation of exactly that wall rectangle, so the overlay is metre-true;
 *  - `--cams=dir,dir`: aimed panorama thumbnails written by aim.ts (heading, pitch, fov, panorama position), re-rendered in
 *    perspective from the panorama point (the thumbnail projection is not exactly rectilinear; use for silhouettes).
 *
 *   node --import tsx scripts/mercatorplein/sheets.ts --crops=artifacts/landmark-briefs/mercatorplein-noordtoren/tall-w02-165-0.json --out=artifacts/mercatorplein/sheets/n-w02.jpg
 *
 * Both Mercatorplein GLBs are placed at their anchors (BAG footprint vertex averages) relative to the north one.
 * Panoramas: Gemeente Amsterdam, CC BY 4.0.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {closeRenderer, renderModels, type RenderModel, type RenderView} from '../building-recipes/render';

const arg = (k: string, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const cams = arg('cams').split(',').filter(Boolean), crops = arg('crops').split(',').filter(Boolean);
const out = arg('out', 'artifacts/mercatorplein/sheets/sheet.jpg'), rows = Number(arg('rows', '3')), camH = Number(arg('cam-h', '2.5')), S = Number(arg('size', '420'));
const ANCHORS: Record<string, {rd: [number, number]; groundNAP: number}> = {
  'mercatorplein-noordtoren': {rd: [118460.66, 487085.28], groundNAP: 0.272},
  'mercatorplein-zuidtoren': {rd: [118464.64, 486912.0], groundNAP: 0.34},
};
const [AX, AY] = ANCHORS['mercatorplein-noordtoren'].rd;
fs.mkdirSync(path.dirname(out), {recursive: true});

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const models: RenderModel[] = [];
for (const [id, {rd: [x, y]}] of Object.entries(ANCHORS)) {
  const glb = arg(`glb-${id}`, `public/canal-drive/models/${id}.glb`);
  if (!fs.existsSync(glb)) continue;
  const doc = await io.read(glb);
  await doc.transform(dequantize());
  doc.getRoot().listExtensionsUsed().forEach(e => e.dispose());
  const plain = path.resolve(`artifacts/mercatorplein/plain-${id}.glb`);
  fs.mkdirSync(path.dirname(plain), {recursive: true});
  await new NodeIO().write(plain, doc);
  models.push({file: plain, position: [x - AX, 0, AY - y]});
}

interface Job { file: string; label: string; view: RenderView; w: number; h: number }
const jobs: Job[] = [];
for (const dir of cams) {
  const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')) as {id: string; date: string; heading: number; pitch: number; fov: number; panoRD: [number, number]}[];
  for (const c of idx.slice(0, rows)) {
    const eye = [c.panoRD[0] - AX, camH, AY - c.panoRD[1]], th = c.heading * Math.PI / 180, ph = c.pitch * Math.PI / 180;
    jobs.push({file: path.join(dir, `${c.id}.jpg`), label: `${c.id} (${c.date}) heading ${c.heading} pitch ${c.pitch} fov ${c.fov}`, w: S, h: S,
      view: {eye, target: [eye[0] + Math.sin(th) * Math.cos(ph) * 10, eye[1] + Math.sin(ph) * 10, eye[2] - Math.cos(th) * Math.cos(ph) * 10], fov: c.fov, width: S, height: S, background: '#ffffff'}});
  }
}
for (const file of crops) {
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  const {a, b, normal} = c.wallRD, L = Math.hypot(b.x - a.x, b.y - a.y), ppm = c.width / L, Hm = c.height / ppm;
  // the crop base is the street (rectify puts it 2.44 m under the published camera height, which can be off by metres; heights above it are true)
  const mid = [(a.x + b.x) / 2 - AX, Hm / 2, AY - (a.y + b.y) / 2];
  const n = [normal[0], -normal[1]], h = Math.round(S * 1.25), w = Math.round(h * c.width / c.height);
  jobs.push({file: file.replace(/\.json$/, '.jpg'), label: `${path.basename(file, '.json')} ${c.panoId} (${c.capturedAt}) rectified ${L.toFixed(1)} x ${Hm.toFixed(1)} m`, w, h,
    view: {eye: [mid[0] + n[0] * 80, mid[1], mid[2] + n[1] * 80], target: mid, fov: 30, width: w, height: h, ortho: [-L / 2, L / 2, Hm / 2, -Hm / 2], background: '#ffffff', noGround: true}});
}
const renders = await renderModels(models, jobs.map(j => j.view));
await closeRenderer();
const W = Math.max(...jobs.map(j => j.w)) * 3, tiles: sharp.OverlayOptions[] = [];
let y = 0;
for (let i = 0; i < jobs.length; i++) {
  const {w, h} = jobs[i];
  const photo = await sharp(jobs[i].file).resize(w, h, {fit: 'fill'}).removeAlpha().png().toBuffer();
  const model = await sharp(renders[i]).resize(w, h, {fit: 'fill'}).removeAlpha().png().toBuffer();
  const [pr, mr] = await Promise.all([sharp(photo).raw().toBuffer(), sharp(model).raw().toBuffer()]);
  const mix = Buffer.alloc(pr.length);
  for (let k = 0; k < pr.length; k++) mix[k] = (pr[k] + mr[k]) >> 1;
  const blend = await sharp(mix, {raw: {width: w, height: h, channels: 3}}).png().toBuffer();
  const text = `${jobs[i].label} | photo | model | 50% overlay`.replace(/&/g, '&amp;');
  tiles.push({input: Buffer.from(`<svg width="${W}" height="22"><rect width="100%" height="100%" fill="#222"/><text x="6" y="16" font-family="sans-serif" font-size="14" fill="#fff">${text}</text></svg>`), left: 0, top: y},
    {input: photo, left: 0, top: y + 22}, {input: model, left: w, top: y + 22}, {input: blend, left: 2 * w, top: y + 22});
  y += h + 22;
}
await sharp({create: {width: W, height: y, channels: 3, background: '#ffffff'}}).composite(tiles).jpeg({quality: 82}).toFile(out);
console.log('wrote', out, jobs.length, 'rows');
