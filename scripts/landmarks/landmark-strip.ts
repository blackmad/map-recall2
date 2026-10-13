/**
 * Gallery-size contact sheet of a built landmark GLB: four aerial three-quarter views (SE, SW, NW, NE) plus optional street-level views.
 *
 *   node --import tsx scripts/landmarks/landmark-strip.ts --id=<id> [--out=artifacts/landmark-lanes/<id>] [--title="Name"]
 *        [--fov=38] [--dist=<m>] [--street="name|ex,ey,ez|tx,ty,tz|fov;name2|..."]
 *
 * Model frame: x east, z south, y up (the landmark GLB frame). The camera distance defaults to 2.1 x the footprint diagonal.
 * The landmark GLB is meshopt-compressed and quantized; the offline renderer reads plain glTF, so a dequantized copy is rendered.
 * Writes strip-four-sides.png and, with --street, strip-street.png. Pair it with `npm run review:sheet -- --id=<id> --no-game --inventory`
 * (panorama against model, per wall) for the full review.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO, getBounds} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {closeRenderer, contactSheet, renderModels} from '../building-recipes/render';

const arg = (k: string, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const id = arg('id');
if (!id) throw new Error('--id=<landmark id> required');
const glb = arg('glb', `public/canal-drive/models/${id}.glb`), out = arg('out', `artifacts/landmark-lanes/${id}`), title = arg('title', id);
await fs.mkdir(out, {recursive: true});
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const doc = await io.read(glb);
await doc.transform(dequantize());
doc.getRoot().listExtensionsUsed().forEach(e => e.dispose());
const bounds = getBounds(doc.getRoot().listScenes()[0]);
const cx = (bounds.min[0] + bounds.max[0]) / 2, cz = (bounds.min[2] + bounds.max[2]) / 2;
const diag = Math.hypot(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]);
const dist = Number(arg('dist', String(Math.max(14, diag * 1.5)))), fov = Number(arg('fov', '38'));
const height = bounds.max[1] - bounds.min[1];
const plain = path.join(out, 'plain.glb');
await new NodeIO().write(plain, doc);

const size = {width: 900, height: 620};
const aerial = (name: string, az: number) => {
  const a = az * Math.PI / 180;
  return {name, view: {eye: [cx + Math.sin(a) * dist, Math.max(8, height * 0.55 + dist * 0.45), cz - Math.cos(a) * dist], target: [cx, height * 0.35, cz], fov, ...size}};
};
// Compass bearing of the camera from the model centre (x east, z south): the strip reads SE, SW, NW, NE.
const views = [aerial('from south-east', 135), aerial('from south-west', 225), aerial('from north-west', 315), aerial('from north-east', 45)];
const street = arg('street').split(';').filter(Boolean).map(s => {
  const [name, eye, target, f] = s.split('|');
  return {name, view: {eye: eye.split(',').map(Number), target: target.split(',').map(Number), fov: Number(f || 55), ...size}};
});
const all = [...views, ...street];
const images = await renderModels([{file: plain}], all.map(v => v.view));
await contactSheet(images.slice(0, 4).map((image, i) => ({image, text: all[i].name})), path.join(out, 'strip-four-sides.png'), {width: 640, height: 440}, `${title} - four sides`);
if (street.length) await contactSheet(images.slice(4).map((image, i) => ({image, text: all[4 + i].name})), path.join(out, 'strip-street.png'), {width: 640, height: 440}, `${title} - street level`);
await fs.rm(plain);
await closeRenderer();
console.log('wrote', path.join(out, 'strip-four-sides.png'), street.length ? path.join(out, 'strip-street.png') : '');
