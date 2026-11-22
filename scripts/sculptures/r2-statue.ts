/**
 * Round-2 statue candidates (lane sculpture-r2-20261122): one raw generator mesh (TripoSR raw.ply, or a ComfyUI TRELLIS.2
 * GLB) through the October post-process (decimate to ~6k tris, no photo colour, scale to the kit figure it replaces, face
 * it) and composed into the kit model in place of that figure, so it can be judged against the kit and installed with
 * `rebuild.ts`'s install record format (scripts/sculptures/installed/<id>.json, applied by installed-figures.ts).
 *
 *   node --import tsx scripts/sculptures/r2-statue.ts --id=<statue> --raw=<raw.ply|.glb> --label=<run name>
 *        [--front=+x] [--up=z] [--remesh=<cells>] [--level=<frac>] [--tris=6000] [--config=scripts/sculptures/rebuild-r2-20261122.json]
 *
 * Frames: TripoSR raw.ply is z up with the photo's camera on +x (front +x, up z, the default). ComfyUI SaveGLB output is
 * glTF y up with the input view's camera on +z (front +z, up y). Writes artifacts/sculpture-r2/statues/<id>/<label>/
 * {figure.glb, composed.glb, run.json}.
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {boxOf, cutTriangles, type Box, type V3} from '../../src/canalRecall/sculptures/kitParts.js';
import {composeDoc, kitTriangles, plainTriangles} from './kit-compose.js';

const arg = (k: string, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const id = arg('id'), label = arg('label'), raw = path.resolve(arg('raw'));
const cfg = JSON.parse(fs.readFileSync(arg('config', 'scripts/sculptures/rebuild-r2-20261122.json'), 'utf8')).statues[id];
const f = cfg.figures[0];
const tools = process.env.SCULPTURE_TOOLS ?? path.join(os.homedir(), 'Code/map-recall2-sculpt');
const py = path.join(tools, 'venv-o3d/bin/python');
const out = path.join('artifacts/sculpture-r2/statues', id, label);
fs.mkdirSync(out, {recursive: true});
const run = (bin: string, a: string[]) => {
  const r = spawnSync(bin, a, {encoding: 'utf8', maxBuffer: 1 << 28});
  if (r.status !== 0) throw new Error(`${path.basename(bin)} failed: ${(r.stderr || r.stdout).slice(-2000)}`);
  return r.stdout.trim().split('\n').filter(l => l.startsWith('{')).pop()!;
};

let ply = raw;
if (raw.endsWith('.glb')) { // ComfyUI SaveGLB: one scene of textured/painted meshes; flatten to a coloured PLY for the post-process
  ply = path.join(out, 'raw.ply');
  run(py, ['-I', '-c', 'import sys,trimesh;m=trimesh.load(sys.argv[1],force="mesh");trimesh.Trimesh(m.vertices,m.faces,process=False).export(sys.argv[2]);print("{}")', raw, ply]);
}
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const kitDoc = await io.read(`public/canal-drive/models/${cfg.kit}.glb`);
await kitDoc.transform(dequantize());
const kit = kitTriangles(kitDoc);
const cutIdx = cutTriangles(kit, [f.cut as Box], f.cutMaterials ?? ['bronze']);
const cutBox = boxOf(kit, cutIdx);
const height: number = f.height ?? (cutBox!.max[1] - cutBox!.min[1]);
const at: V3 = f.base ?? [(cutBox!.min[0] + cutBox!.max[0]) / 2, cutBox!.min[1], (cutBox!.min[2] + cutBox!.max[2]) / 2];
const figure = path.join(out, 'figure.glb');
const mesh = JSON.parse(run(py, ['-I', 'scripts/sculptures/decimate_scale_glb.py', ply, figure, `--height=${height}`, `--facing=${f.facing}`,
  `--tris=${arg('tris', String(f.tris ?? 6000))}`, '--no-colors', `--front=${arg('front', '+x')}`, `--up=${arg('up', 'z')}`,
  ...(arg('remesh') ? [`--remesh=${arg('remesh')}`] : []), ...(arg('level') ? [`--level=${arg('level')}`] : [])]));
const {doc, triangles, kitTriangles: kept} = composeDoc(id, kit, i => !cutIdx.has(i), [{tris: plainTriangles(await io.read(figure), at), material: f.material ?? 'bronze'}]);
await new NodeIO().write(path.join(out, 'composed.glb'), doc);
const rec = {id, label, raw, front: arg('front', '+x'), up: arg('up', 'z'), remesh: arg('remesh') || null, level: arg('level') || null, heightM: +height.toFixed(3), at: at.map(v => +v.toFixed(3)),
  cutKitTriangles: cutIdx.size, mesh, composedTriangles: triangles, keptKitTriangles: kept};
fs.writeFileSync(path.join(out, 'run.json'), JSON.stringify(rec, null, 1) + '\n');
console.log(JSON.stringify(rec));
