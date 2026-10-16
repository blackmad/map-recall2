/**
 * DeLaMar review renders: four three-quarter views at gallery-card size, the Leidsebosje view across the Singelgracht
 * (the angle of the user's report) and the Marnixstraat view, with the neighbouring BAG blocks as grey extrusions
 * (heights from the building tiles, scripts/landmarks/delamar-shell.json) so the reviewer sees which walls are exposed.
 *
 *   node --import tsx scripts/landmarks/delamar-strip.ts [--glb=public/canal-drive/models/delamar.glb] [--out=artifacts/landmark-lanes/delamar]
 */
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {Document, NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {closeRenderer, contactSheet, renderModels, useFlatMaterials, type RenderModel, type RenderView} from '../building-recipes/render';
import shell from './delamar-shell.json';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const glb = arg('glb', 'public/canal-drive/models/delamar.glb'), out = arg('out', 'artifacts/landmark-lanes/delamar');
fs.mkdirSync(out, {recursive: true});

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const doc = await io.read(glb);
await doc.transform(dequantize());
doc.getRoot().listExtensionsUsed().forEach(e => e.dispose());
const plain = path.resolve(out, 'plain-delamar.glb');
await new NodeIO().write(plain, doc);

/** Neighbour blocks as one grey GLB (flat roofs at the tile height). */
async function neighboursGlb(file: string) {
  const d = new Document(), buf = d.createBuffer(), mesh = d.createMesh('n'), pos: number[] = [];
  for (const n of (shell as unknown as {neighbours: {heightM: number; ring: number[][]}[]}).neighbours) {
    const ring = n.ring.slice(0, n.ring.length > 1 && n.ring[0][0] === n.ring.at(-1)![0] && n.ring[0][1] === n.ring.at(-1)![1] ? -1 : undefined);
    const shape = new T.Shape(ring.map(p => new T.Vector2(p[0], -p[1])));
    const g = new T.ExtrudeGeometry(shape, {depth: n.heightM, bevelEnabled: false}).rotateX(-Math.PI / 2).toNonIndexed();
    pos.push(...g.getAttribute('position').array);
  }
  const mat = d.createMaterial('neighbour').setBaseColorFactor([0.78, 0.78, 0.76, 1]).setRoughnessFactor(1).setMetallicFactor(0).setDoubleSided(true);
  mesh.addPrimitive(d.createPrimitive().setAttribute('POSITION', d.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf)).setMaterial(mat));
  d.createScene().addChild(d.createNode('n').setMesh(mesh));
  await new NodeIO().write(file, d);
}
const nfile = path.resolve(out, 'neighbours.glb');
await neighboursGlb(nfile);

useFlatMaterials();
const models: RenderModel[] = [{file: plain}, {file: nfile}];
const size = {width: 640, height: 440};
const centre = [12, 10, 0];
const view = (bearing: number, dist: number, h: number, fov = 40, target = centre): RenderView => {
  const a = bearing * Math.PI / 180;
  return {eye: [target[0] + Math.sin(a) * dist, h, target[2] - Math.cos(a) * dist], target, fov, ...size};
};
const sides: [string, number][] = [['from the Leidsebosje (SSW, canal side)', 200], ['from the Marnixstraat (NE, entrance)', 45], ['from the north-west (gardens)', 315], ['from Leidseplein (SE)', 135]];
const views: RenderView[] = [
  ...sides.map(([, b]) => view(b, 120, 70, 42)),
  // eye height 1.7 m on the Stadhouderskade quay across the Singelgracht, looking north (the user's screenshot)
  {eye: [-4, 1.7, 92], target: [0, 9, 20], fov: 55, ...size},
  {eye: [58, 1.7, -32], target: [26, 9, -12], fov: 60, ...size},
  // game-like pitched view from the canal side
  {eye: [-30, 45, 110], target: [5, 8, 10], fov: 40, ...size},
];
const images = await renderModels(models, views);
// gallery card: the model alone, as the gallery shows it
const alone = await renderModels([{file: plain}], sides.map(([, b]) => view(b, 95, 45, 42)));
await closeRenderer();
await contactSheet(alone.map((image, i) => ({image, text: sides[i][0]})), path.join(out, 'gallery-four-sides.png'), {width: 320, height: 220}, 'DeLaMar - four sides, model alone (gallery size)');
await contactSheet(images.slice(0, 4).map((image, i) => ({image, text: sides[i][0]})), path.join(out, 'strip-four-sides.png'), {width: 320, height: 220}, 'DeLaMar - four sides (gallery size), neighbours grey');
await contactSheet([{image: images[4], text: 'Stadhouderskade quay across the Singelgracht, 1.7 m (the report angle)'}, {image: images[5], text: 'Marnixstraat, 1.7 m'}, {image: images[6], text: 'pitched, canal side (game camera)'}], path.join(out, 'street-views.png'), {width: 640, height: 440}, 'DeLaMar street views');
console.log('wrote', path.join(out, 'gallery-four-sides.png'), path.join(out, 'strip-four-sides.png'), path.join(out, 'street-views.png'));
