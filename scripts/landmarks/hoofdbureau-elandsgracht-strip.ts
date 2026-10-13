/**
 * Four-side gallery strip of the built Hoofdbureau GLB (aerial three-quarter views from each corner, plus two street-level
 * views of the Marnixstraat end block and the Singelgracht wing):
 *
 *   node --import tsx scripts/landmarks/hoofdbureau-elandsgracht-strip.ts [--glb=public/canal-drive/models/hoofdbureau-elandsgracht.glb] [--out=artifacts/landmark-lanes/hoofdbureau-elandsgracht]
 *
 * The landmark GLB is meshopt-compressed and quantized; the offline renderer reads plain glTF, so a dequantized copy is rendered.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {closeRenderer, contactSheet, renderModels} from '../building-recipes/render';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const glb = arg('glb', 'public/canal-drive/models/hoofdbureau-elandsgracht.glb'), out = arg('out', 'artifacts/landmark-lanes/hoofdbureau-elandsgracht');
await fs.mkdir(out, {recursive: true});
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const doc = await io.read(glb);
await doc.transform(dequantize());
doc.getRoot().listExtensionsUsed().forEach(e => e.dispose());
const plain = path.join(out, 'plain.glb');
await new NodeIO().write(plain, doc);

const size = {width: 900, height: 620};
const aerial = (name: string, az: number) => {
  const a = az * Math.PI / 180, d = 215;
  return {name, view: {eye: [Math.sin(a) * d, 120, -Math.cos(a) * d], target: [0, 8, 0], fov: 38, ...size}};
};
// Compass bearings of the camera from the model centre (x east, z south): the strip reads SE, SW, NW, NE.
const views = [aerial('from south-east', 135), aerial('from south-west', 225), aerial('from north-west', 315), aerial('from north-east', 45)];
// Street level: the Marnixstraat end block (panel 19, centre near x 37, z -38, facing ENE) and the Singelgracht wing (facing WSW).
const street = [
  {name: 'Marnixstraat end block', view: {eye: [37 + 0.94 * 26, 3.5, -38 - 0.34 * 26], target: [37, 9, -38], fov: 55, ...size}},
  {name: 'Singelgracht wing', view: {eye: [-40, 3.5, 14], target: [-20, 9, 24], fov: 50, ...size}},
];
const all = [...views, ...street];
const images = await renderModels([{file: plain}], all.map(v => v.view));
await contactSheet(images.slice(0, 4).map((image, i) => ({image, text: all[i].name})), path.join(out, 'strip-four-sides.png'), {width: 640, height: 440}, 'Hoofdbureau van Politie, Elandsgracht 117 - four sides');
await contactSheet(images.slice(4).map((image, i) => ({image, text: all[4 + i].name})), path.join(out, 'strip-street.png'), {width: 640, height: 440}, 'Hoofdbureau van Politie - street level');
await fs.rm(plain);
await closeRenderer();
console.log('wrote', path.join(out, 'strip-four-sides.png'), path.join(out, 'strip-street.png'));
