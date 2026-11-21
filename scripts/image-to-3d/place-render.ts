/**
 * Place an image-to-3D GLB at real size and render it (front and oblique) in Node with the repo's GLB raster
 * (src/canalRecall/glbRaster through scripts/building-recipes/render.ts, flat look: the GLB's own colours/textures).
 *
 *   node --import tsx scripts/image-to-3d/place-render.ts --glb=<in.glb> --out=<dir> --height=<m> [--width=<m>]
 *        [--front=+x|-x|+y|-y|+z|-z] [--up=+y|+z|-y|-z] [--oblique=35] [--fit=height|width]
 *
 * Normalises the model into the landmark frame (x east, y up, z south) with its front facing +z (the viewer),
 * scaled uniformly so its height (or with --fit=width its width) is the real one, centred in x, base on y = 0,
 * front at z = 0. Writes <out>/placed.glb, front.png, oblique.png (camera turned --oblique degrees to the left of
 * the front normal), and place.json (tris, scaled extents, depth/width ratio).
 *
 *   node --import tsx scripts/image-to-3d/place-render.ts --landmark=<id> --view=<ornament-view.json> --target=<lng,lat>
 *        --up=<m> --box=x0,y0,x1,y1 --out=<file.png>
 * renders an installed landmark GLB from the panorama pose of an ornament view and crops the same box: the
 * "today" panel for an ornament.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {NodeIO, getBounds, type Document} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {closeRenderer, renderModels, useFlatMaterials} from '../building-recipes/render.ts';

const arg = (k: string, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
useFlatMaterials();

async function plain(doc: Document, file: string) {
  await doc.transform(dequantize());
  doc.getRoot().listExtensionsUsed().forEach(e => { if (!/texture_webp|materials_/.test(e.extensionName)) e.dispose(); });
  await new NodeIO().registerExtensions(ALL_EXTENSIONS).write(file, doc);
}

const AX: Record<string, number[]> = {'+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1]};
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Quaternion of the rotation taking the source basis (front f, up u) to (+z, +y). */
function quatFromAxes(f: number[], u: number[]) {
  const r = cross(u, f); // source "right" (x' = y' x z')
  // Rows: target x = r, y = u, z = f expressed in source coords -> rotation matrix R with R * r = x etc.
  const m = [r, u, f]; // R = [r; u; f] (row-major)
  const [m00, m01, m02] = m[0], [m10, m11, m12] = m[1], [m20, m21, m22] = m[2];
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = s / 4; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (m21 - m12) / s; x = s / 4; y = (m01 + m10) / s; z = (m02 + m20) / s; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (m02 - m20) / s; x = (m01 + m10) / s; y = s / 4; z = (m12 + m21) / s; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = s / 4; }
  return [x, y, z, w] as [number, number, number, number];
}

if (arg('landmark')) {
  const id = arg('landmark'), view = JSON.parse(await fs.readFile(arg('view'), 'utf8'));
  const cat = JSON.parse(await fs.readFile('public/canal-drive/models/signature-landmarks.json', 'utf8')).models[id];
  const [lng0, lat0] = cat.surveyed?.anchor ?? cat.footprint.centre;
  const [tl, tb] = arg('target').split(',').map(Number), up = Number(arg('up'));
  const local = (lng: number, lat: number) => [(lng - lng0) * 111320 * Math.cos(lat0 * Math.PI / 180), -(lat - lat0) * 110540];
  const [tx, tz] = local(tl, tb);
  const b = view.bearingDeg * Math.PI / 180, d = view.distM;
  const ex = tx - d * Math.sin(b), ez = tz + d * Math.cos(b), ey = up - d * Math.tan(view.pitchDeg * Math.PI / 180);
  const doc = await io.read(`public/canal-drive/models/${id}.glb`);
  const tmp = arg('out').replace(/\.png$/, '.plain.glb');
  await plain(doc, tmp);
  // The view json's pitch is the angle to the target; aim the camera exactly as ornament-view.ts did.
  const [W, H] = view.size;
  // Oblique: the same camera swung --oblique degrees (default 35) to the left about the vertical through the target.
  const ob = Number(arg('oblique', '35')) * Math.PI / 180, vx = ex - tx, vz = ez - tz;
  const eo = [tx + vx * Math.cos(ob) - vz * Math.sin(ob), ey, tz + vx * Math.sin(ob) + vz * Math.cos(ob)];
  const [img, imgO] = await renderModels([{file: tmp}], [{eye: [ex, ey, ez], target: [tx, up, tz], fov: view.fovDeg, width: W, height: H, background: '#bcd3e6'},
    {eye: eo, target: [tx, up, tz], fov: view.fovDeg, width: W, height: H, background: '#bcd3e6'}]);
  const [x0, y0, x1, y1] = arg('box').split(',').map(Number);
  await sharp(img).extract({left: x0, top: y0, width: x1 - x0, height: y1 - y0}).png().toFile(arg('out'));
  await sharp(imgO).extract({left: x0, top: y0, width: x1 - x0, height: y1 - y0}).png().toFile(arg('out').replace(/\.png$/, '-oblique.png'));
  await sharp(img).png().toFile(arg('out').replace(/\.png$/, '-full.png'));
  await fs.rm(tmp);
  await closeRenderer();
  console.log(JSON.stringify({id, eye: [ex, ey, ez].map(v => +v.toFixed(2)), target: [tx, up, tz].map(v => +v.toFixed(2)), out: arg('out')}));
  process.exit(0);
}

const out = arg('out'), height = Number(arg('height')), widthM = Number(arg('width', '0')), oblique = Number(arg('oblique', '35'));
await fs.mkdir(out, {recursive: true});
const doc = await io.read(arg('glb'));
await doc.transform(dequantize());
// A primitive without a material reads as glTF's default (metallic 1), which the raster draws black: give
// vertex-coloured meshes (TripoSR, Hunyuan3D shape) a plain dielectric material instead.
const plainMat = doc.createMaterial('dielectric').setMetallicFactor(0).setRoughnessFactor(1);
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) if (!p.getMaterial()) p.setMaterial(plainMat);
const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
const wrap = doc.createNode('placed');
for (const c of scene.listChildren()) { scene.removeChild(c); wrap.addChild(c); }
scene.addChild(wrap);
wrap.setRotation(quatFromAxes(AX[arg('front', '+z')], AX[arg('up', '+y')]));
let bb = getBounds(scene);
const ext0 = [0, 1, 2].map(i => bb.max[i] - bb.min[i]);
const s = arg('fit') === 'width' && widthM ? widthM / ext0[0] : height / ext0[1];
wrap.setScale([s, s, s]);
bb = getBounds(scene);
wrap.setTranslation([-(bb.min[0] + bb.max[0]) / 2, -bb.min[1], -bb.max[2]]);
bb = getBounds(scene);
const ext = [0, 1, 2].map(i => +(bb.max[i] - bb.min[i]).toFixed(2));
let tris = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3;
const textured = doc.getRoot().listTextures().length, vertexColours = doc.getRoot().listMeshes().some(m => m.listPrimitives().some(p => p.getAttribute('COLOR_0')));
const placed = path.join(out, 'placed.glb');
await plain(doc, placed);
const W = Math.max(ext[0], widthM || 0), Hm = ext[1];
const size = {width: 640, height: 800}, fov = 14;
const span = Math.max(Hm, W * size.height / size.width) * 1.12;
const dist = span / 2 / Math.tan(fov * Math.PI / 360);
const mid = [0, Hm / 2, 0], a = oblique * Math.PI / 180;
const [front, obl] = await renderModels([{file: placed}], [
  {eye: [0, mid[1], dist], target: mid, fov, ...size, background: '#ffffff', noGround: true},
  {eye: [-Math.sin(a) * dist, mid[1], Math.cos(a) * dist], target: mid, fov, ...size, background: '#ffffff', noGround: true},
]);
await fs.writeFile(path.join(out, 'front.png'), front);
await fs.writeFile(path.join(out, 'oblique.png'), obl);
const rec = {glb: arg('glb'), front: arg('front', '+z'), up: arg('up', '+y'), scale: +s.toFixed(4), extentsM: ext, widthTargetM: widthM || null, heightM: height,
  depthOverWidth: +(ext[2] / ext[0]).toFixed(3), widthErrorPct: widthM ? +((ext[0] / widthM - 1) * 100).toFixed(1) : null, triangles: tris, textures: textured, vertexColours, obliqueDeg: oblique};
await fs.writeFile(path.join(out, 'place.json'), JSON.stringify(rec, null, 1) + '\n');
await closeRenderer();
console.log(JSON.stringify(rec));
