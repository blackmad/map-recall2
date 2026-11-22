/**
 * Round-2 wall reliefs (lane sculpture-r2-20261122): one generated mesh (TripoSR raw.ply or ComfyUI TRELLIS.2 GLB) decimated,
 * cut flat at the wall plane and placed on its landmark (src/canalRecall/sculptures/wallRelief.ts), then
 *   - relief.glb: the placed relief in the landmark frame (one material, the landmark's palette key, no photo colour);
 *   - composed.glb: today's landmark GLB minus the kit triangles in the item's wall cut, plus the relief (for review sheets);
 *   - record.json: the scripts/sculptures/installed/<model>.json figure entry that installs it through installed-figures.ts.
 *
 *   node --import tsx scripts/sculptures/r2-relief.ts --item=<key> --raw=<raw.ply|.glb> --label=<run> [--tris=<n>]
 *        [--config=scripts/sculptures/reliefs-r2-20261122.json]
 *
 * Config `items.<key>`: model, material (palette key), front/up of the generator frame is per raw type (TripoSR +x/z,
 * ComfyUI +z/y, both handled by decimate_scale_glb.py, whose output faces north), instances [{origin, normal}] (bottom
 * centre on the wall plane), width, height, depth, embed?, uniform?, mirror? (per instance: reflect along the wall),
 * cut {min, max} in the wall frame per instance and cutMaterials. Output: artifacts/sculpture-r2/reliefs/<key>/<label>/.
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Document, NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import type {V3} from '../../src/canalRecall/sculptures/kitParts.js';
import {inWallCut, placeRelief, type WallCut} from '../../src/canalRecall/sculptures/wallRelief.js';
import {composeDoc, kitTriangles, plainTriangles} from './kit-compose.js';
import {clampToGable} from './gable-clip.js';

const arg = (k: string, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const key = arg('item'), label = arg('label'), raw = path.resolve(arg('raw'));
const it = JSON.parse(fs.readFileSync(arg('config', 'scripts/sculptures/reliefs-r2-20261122.json'), 'utf8')).items[key];
if (!it) throw new Error(`no item ${key}`);
const tools = process.env.SCULPTURE_TOOLS ?? path.join(os.homedir(), 'Code/map-recall2-sculpt');
const py = path.join(tools, 'venv-o3d/bin/python');
const out = path.join('artifacts/sculpture-r2/reliefs', key, label);
fs.mkdirSync(out, {recursive: true});
const run = (bin: string, a: string[]) => {
  const r = spawnSync(bin, a, {encoding: 'utf8', maxBuffer: 1 << 28});
  if (r.status !== 0) throw new Error(`${path.basename(bin)} failed: ${(r.stderr || r.stdout).slice(-2000)}`);
  return r.stdout.trim().split('\n').filter(l => l.startsWith('{')).pop()!;
};
let ply = raw, front = '+x', up = 'z';
if (raw.endsWith('.glb')) {
  ply = path.join(out, 'raw.ply');
  run(py, ['-I', '-c', 'import sys,trimesh;m=trimesh.load(sys.argv[1],force="mesh");trimesh.Trimesh(m.vertices,m.faces,process=False).export(sys.argv[2]);print("{}")', raw, ply]);
  front = '+z'; up = 'y';
}
const plain = path.join(out, 'plain.glb');
const tris = Number(arg('tris', String(it.tris ?? 6000)));
const mesh = JSON.parse(run(py, ['-I', 'scripts/sculptures/decimate_scale_glb.py', ply, plain, '--height=1', '--facing=0', `--tris=${tris}`, '--no-colors',
  `--front=${front}`, `--up=${up}`, `--min-component=${it.minComponent ?? 0.02}`]));
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
// decimate_scale_glb's output: facing compass 0 (north, -z), y up; the viewer's right as seen from the north is west (-x).
const gen = plainTriangles(await io.read(plain));
const placed: V3[][] = [];
const cuts: WallCut[] = [];
let droppedBack = 0;
for (const inst of it.instances) {
  const src = inst.mirror ? gen.map(t => [t[0], t[2], t[1]].map(p => [-p[0], p[1], p[2]] as V3)) : gen;
  const r = placeRelief(src, '-z', '+y', {origin: inst.origin, normal: inst.normal}, {width: inst.width ?? it.width, height: inst.height ?? it.height,
    depth: it.depth, embed: it.embed, uniform: it.uniform, alignToPlane: it.alignToPlane, maxTiltDeg: it.maxTiltDeg, dropBackFacing: it.dropBackFacing});
  // round 3: `gable: {halfBase, rise, flattenAt?}` holds a pediment group inside its tympanum triangle (gable-clip.ts)
  const g = it.gable ? clampToGable(r.triangles, {origin: inst.origin, normal: inst.normal, embed: it.embed, ...it.gable}) : null;
  placed.push(...(g ? g.triangles : r.triangles));
  droppedBack += r.droppedBack;
  // round 3: `cuts: [{min, max}]` replaces kit parts box by box (palace: one per kit figure, clear of the raking cornice)
  for (const c of (it.cuts ?? [inst.cut ?? it.cut])) cuts.push({origin: inst.origin, normal: inst.normal, min: c.min, max: c.max});
}
// relief.glb: one mesh, one material named after the palette key (installed-figures.ts reads positions only)
const doc = new Document();
const buf = doc.createBuffer();
const mat = doc.createMaterial(it.material);
const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(placed.flat(2))).setBuffer(buf);
doc.createScene().addChild(doc.createNode(key).setMesh(doc.createMesh(key).addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos).setMaterial(mat))));
await new NodeIO().write(path.join(out, 'relief.glb'), doc);
// composed.glb: today's model minus the cut, plus the relief in the kit's own material of that name
const kitDoc = await io.read(`public/canal-drive/models/${it.model}.glb`);
await kitDoc.transform(dequantize());
const kit = kitTriangles(kitDoc);
const cutMats: string[] = it.cutMaterials ?? [it.material];
const dropped = new Set<number>();
kit.forEach((t, i) => {
  if (!cutMats.some(m => t.material.includes(m))) return;
  const c = [0, 1, 2].map(k => (t.a[k] + t.b[k] + t.c[k]) / 3) as V3;
  if (cuts.some(cut => inWallCut(c, cut))) dropped.add(i);
});
const composed = composeDoc(it.model, kit, i => !dropped.has(i), [{tris: placed, material: it.material}]);
await new NodeIO().write(path.join(out, 'composed.glb'), composed.doc);
// one GLB holds every instance; its record entry lists one wall cut per instance (an empty axis-aligned cut)
const record = {name: key, glb: `scripts/sculptures/installed/${it.model}/${key}.glb`, at: [0, 0, 0], cut: {min: [0, 0, 0], max: [-1, -1, -1]},
  cutMaterials: cutMats, material: it.material, route: label, wallCut: cuts.length === 1 ? cuts[0] : cuts};
const rec = {key, label, raw, model: it.model, mesh, triangles: placed.length, droppedBack, droppedKitTriangles: dropped.size, record};
fs.writeFileSync(path.join(out, 'run.json'), JSON.stringify(rec, null, 1) + '\n');
console.log(JSON.stringify({key, label, triangles: placed.length, droppedBack, droppedKitTriangles: dropped.size}));
