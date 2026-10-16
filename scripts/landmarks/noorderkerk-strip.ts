/**
 * Gallery-size renders of the Noorderkerk GLB from the four angles of the cross (where the 1623 service houses stand) and
 * street-level views of each corner house from its panorama position:
 *
 *   node --import tsx scripts/landmarks/noorderkerk-strip.ts [--glb=public/canal-drive/models/noorderkerk.glb] [--out=artifacts/landmark-lanes/noorderkerk]
 *
 * The landmark GLB is meshopt-compressed and quantized; the offline renderer reads plain glTF, so a dequantized copy is rendered.
 * Model frame: x east, z south, metres from the BAG anchor.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {closeRenderer, contactSheet, renderModels} from '../building-recipes/render';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const glb = arg('glb', 'public/canal-drive/models/noorderkerk.glb'), out = arg('out', 'artifacts/landmark-lanes/noorderkerk');
await fs.mkdir(out, {recursive: true});
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const doc = await io.read(glb);
await doc.transform(dequantize());
doc.getRoot().listExtensionsUsed().forEach(e => e.dispose());
const plain = path.join(out, 'plain.glb');
await new NodeIO().write(plain, doc);

const size = {width: 900, height: 620};
// Compass bearing of the camera from the crossing; the angles of the cross face 31 (NE), 121 (SE), 211 (SW), 301 (NW) degrees.
const centre = [1.3, 10, -7.1];
const aerial = (name: string, az: number, d = 95, h = 42) => {
  const a = az * Math.PI / 180;
  return {name, view: {eye: [centre[0] + Math.sin(a) * d, h, centre[2] - Math.cos(a) * d], target: centre, fov: 40, ...size}};
};
const street = (name: string, az: number, at: [number, number], d: number) => {
  const a = az * Math.PI / 180;
  return {name, view: {eye: [at[0] + Math.sin(a) * d, 1.7, at[1] - Math.cos(a) * d], target: [at[0], 7, at[1]], fov: 62, ...size}};
};
const views = [
  aerial('from north-east (Noordermarkt / Lindenstraat)', 31), aerial('from south-east (Noordermarkt)', 121),
  aerial('from south-west (Prinsengracht, consistory)', 211), aerial('from north-west (Noorderkerkstraat, kosterij)', 301),
];
// Front centres of the corner houses (x east, z south), from the BAG rings.
const streets = [
  street('north-east house, street level', 31, [9.6, -24.1], 22), street('south-east house, street level', 121, [17.5, 2.7], 24),
  street('north-west house, street level', 301, [-17.9, -18.5], 20),
];
const all = [...views, ...streets];
const images = await renderModels([{file: plain}], all.map(v => v.view));
for (const [i, image] of images.entries()) await fs.writeFile(path.join(out, `view-${String(i + 1).padStart(2, '0')}-${all[i].name.split(' (')[0].replace(/[^a-z]+/gi, '-').toLowerCase().replace(/-+$/, '')}.png`), image);
await contactSheet(images.slice(0, 4).map((image, i) => ({image, text: all[i].name})), path.join(out, 'strip-four-sides.png'), {width: 900, height: 620}, 'Noorderkerk with the 1623 corner houses - four angles');
await contactSheet(images.slice(4).map((image, i) => ({image, text: all[4 + i].name})), path.join(out, 'strip-street.png'), {width: 900, height: 620}, 'Noorderkerk corner houses - street level');
await fs.rm(plain);
await closeRenderer();
console.log('wrote', path.join(out, 'strip-four-sides.png'), path.join(out, 'strip-street.png'));
