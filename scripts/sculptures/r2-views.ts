/**
 * Gallery-size views of a landmark-frame GLB (x east, y up, z south) for the round-2 sculpture sheets (lane
 * sculpture-r2-20261122): the model drawn in Node (src/canalRecall/glbRaster through scripts/building-recipes/render.ts,
 * the recipe look, no browser) from several compass azimuths around a target, at one camera distance for every panel.
 *
 *   node --import tsx scripts/sculptures/r2-views.ts --glb=<model.glb> --out=<strip.png> [--facing=<deg>] [--az=0,90,180,270]
 *        [--crop=x0,y0,z0,x1,y1,z1] [--dist=<m>] [--size=360x480] [--pitch=8] [--eye-y=<m>] [--fov=20]
 *
 * --facing is the compass bearing the figure faces; azimuth 0 is in front of it. --crop limits the camera framing (not the
 * geometry) to a box in the model frame, so a statue on a large monument fills the panel. Prints the camera distance used,
 * so the "today" and "new" strips of one sheet share it (pass --dist from the first to the second).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {NodeIO, getBounds} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {closeRenderer, renderModels} from '../building-recipes/render.ts';

const arg = (k: string, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});

const out = arg('out');
const doc = await io.read(arg('glb'));
await doc.transform(dequantize());
doc.getRoot().listExtensionsUsed().forEach(e => { if (!/texture_webp|materials_/.test(e.extensionName)) e.dispose(); });
const plainMat = doc.createMaterial('dielectric').setMetallicFactor(0).setRoughnessFactor(1).setBaseColorFactor([0.6, 0.6, 0.6, 1]);
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) if (!p.getMaterial()) p.setMaterial(plainMat);
const tmp = out.replace(/\.png$/, '.plain.glb');
await fs.mkdir(path.dirname(out), {recursive: true});
await new NodeIO().registerExtensions(ALL_EXTENSIONS).write(tmp, doc);

const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
const bb = getBounds(scene);
const c = arg('crop') ? arg('crop').split(',').map(Number) : [...bb.min, ...bb.max];
const lo = c.slice(0, 3), hi = c.slice(3, 6);
const mid = [0, 1, 2].map(i => (lo[i] + hi[i]) / 2);
const [W, H] = arg('size', '360x480').split('x').map(Number);
const fov = Number(arg('fov', '20')), pitch = Number(arg('pitch', '8')) * Math.PI / 180;
const span = Math.max(hi[1] - lo[1], Math.hypot(hi[0] - lo[0], hi[2] - lo[2]) * H / W) * 1.15;
const dist = Number(arg('dist', String(+(span / 2 / Math.tan(fov * Math.PI / 360)).toFixed(2))));
const facing = Number(arg('facing', '0')) * Math.PI / 180;
const azs = arg('az', '0,90,180,270').split(',').map(Number);
// compass bearing b -> landmark frame direction (east = +x, north = -z)
const views = azs.map(a => {
  const b = facing + a * Math.PI / 180;
  const dir = [Math.sin(b), -Math.cos(b)];
  // --eye-y: a ride pose (eye at a fixed height above the model's ground, e.g. 1.6 m on a bike) at the same distance
  if (arg('eye-y')) return {eye: [mid[0] + dir[0] * dist, Number(arg('eye-y')), mid[2] + dir[1] * dist], target: mid, fov, width: W, height: H, background: '#dfe7ee'};
  return {eye: [mid[0] + dir[0] * dist * Math.cos(pitch), mid[1] + dist * Math.sin(pitch), mid[2] + dir[1] * dist * Math.cos(pitch)], target: mid, fov, width: W, height: H, background: '#dfe7ee'};
});
const imgs = await renderModels([{file: tmp}], views);
await sharp({create: {width: W * imgs.length, height: H, channels: 3, background: '#ffffff'}})
  .composite(imgs.map((b, i) => ({input: b, left: i * W, top: 0}))).png().toFile(out);
await fs.rm(tmp);
await closeRenderer();
console.log(JSON.stringify({out, dist, mid: mid.map(v => +v.toFixed(2)), az: azs}));
