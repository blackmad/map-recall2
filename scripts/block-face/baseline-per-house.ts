/**
 * Baseline for a block face: the per-house recipes that already exist for pands of the face, compiled as one
 * street chunk (what the per-house path would install), re-framed into the FACE's chunk frame so
 * `review.ts --glb=<out>` renders them on the same strip.
 *   node --import tsx scripts/block-face/baseline-per-house.ts --face=marnix-124-138 --houses=marnixstraat-row-1,...-5 --out=staging/block-face/marnix-124-138/per-house-before.glb
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {KHRMeshQuantization} from '@gltf-transform/extensions';
import {loadIntent, HOUSES} from '../building-recipes/compile.ts';
import {compileChunk} from '../../src/canalRecall/streetChunks/index.ts';
import {FACES} from './intake.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const face = arg('face')!, ids = arg('houses')!.split(','), out = arg('out')!;
const strip = JSON.parse(await fs.readFile(path.join(FACES, face, 'strip.json'), 'utf8'));
const houses = [];
for (const id of ids) houses.push({id, intent: (await loadIntent(id)).intent, facts: JSON.parse(await fs.readFile(path.join(HOUSES, id, 'facts.json'), 'utf8'))});
const r = await compileChunk(houses, {name: 'per-house-before'});
const f = r.frame, F = strip.frame;
const dx = (f.midRD[0] - F.midRD[0]) * F.uRD[0] + (f.midRD[1] - F.midRD[1]) * F.uRD[1];
const dz = (f.midRD[0] - F.midRD[0]) * F.nRD[0] + (f.midRD[1] - F.midRD[1]) * F.nRD[1];
console.log('frame shift', dx.toFixed(2), dz.toFixed(2), 'u dot', (f.uRD[0] * F.uRD[0] + f.uRD[1] * F.uRD[1]).toFixed(4));
const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
await fs.mkdir(path.dirname(out), {recursive: true});
await fs.writeFile(out + '.raw', r.glb);
const doc = await io.readBinary(r.glb);
for (const node of doc.getRoot().listScenes()[0].listChildren()) { const t = node.getTranslation(); node.setTranslation([t[0] + dx, t[1], t[2] + dz]); }
await fs.writeFile(out, await io.writeBinary(doc));
await fs.rm(out + '.raw');
console.log(JSON.stringify({triangles: r.report.triangles, primitives: r.report.primitives, bytes: r.report.bytes, order: r.order.map((o: any) => o.id ?? o)}));
