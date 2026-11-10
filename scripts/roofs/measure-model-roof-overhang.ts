/**
 * Lane S3 (#315), second pass: roofs of placed models (manual landmarks, ordinary-building GLBs, street chunks, and
 * each one's .lod2.glb) against the footprints of the pands they replace. Each GLB is decoded and projected through the
 * runtime placement (as scripts/audit-landmark-filler.ts does); a "roof" triangle is one that is not vertical
 * (|n.up| ≥ 0.3) and stands at least 3 m above the model's base. Its hang is the farthest such vertex outside every
 * footprint the runtime hides under the model (covers.json + suppressOsmIds), seen from above.
 *   node --max-old-space-size=8192 --import tsx scripts/roofs/measure-model-roof-overhang.ts [--only=id,...] [--top=20] [--json=out.json]
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { MANUAL_LANDMARKS } from '../../src/canalRecall/landmarks/manualModels';
import { ORDINARY_BUILDINGS } from '../../src/canalRecall/landmarks/ordinaryModels';
import { applyStreetChunks } from '../../src/canalRecall/landmarks/ordinaryChunks';
import { placementFor, type SignatureModelSpec } from '../../src/canalRecall/landmarks/signaturePlacement';
import { insideRing, distanceToRing } from '../../src/canalRecall/roofOverhang';

const flag = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const TOP = Number(flag('top') ?? 20), ONLY = flag('only')?.split(',');
const MODEL_ROOT = 'public/canal-drive', TILE_DIR = 'public/data/extracts/amsterdam/building-tiles/14';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const chunkManifest = JSON.parse(readFileSync(path.join(MODEL_ROOT, 'ordinary-buildings-data/chunks.json'), 'utf8'));
let specs: SignatureModelSpec[] = applyStreetChunks([...MANUAL_LANDMARKS, ...ORDINARY_BUILDINGS], chunkManifest).models;
if (ONLY) specs = specs.filter(s => ONLY.includes(s.id));

// Footprints of every suppressed id, in a shared metre frame.
const O = { lng: 4.9, lat: 52.37 }, KX = 111_320 * Math.cos(O.lat * Math.PI / 180), KY = 110_540;
const local = (lng: number, lat: number): [number, number] => [(lng - O.lng) * KX, (lat - O.lat) * KY];
// What the runtime hides under each model: covers.json (BAG pands and OSM ids) plus the spec's own suppress list.
const covers = JSON.parse(readFileSync(path.join(MODEL_ROOT, 'models/covers.json'), 'utf8')).models ?? {};
const hiddenBy = (s: SignatureModelSpec) => [...new Set([...(s.suppressOsmIds ?? []), ...(covers[s.id]?.p ?? []).map((p: string) => `NL.IMBAG.Pand.${p}`), ...(covers[s.id]?.o ?? []).map(String)])];
const wanted = new Set(specs.flatMap(hiddenBy));
const rings = new Map<string, Array<Array<[number, number]>>>();
for (const x of readdirSync(TILE_DIR)) for (const file of readdirSync(path.join(TILE_DIR, x))) {
  for (const f of JSON.parse(gunzipSync(readFileSync(path.join(TILE_DIR, x, file))).toString()).features) {
    const id = String(f.properties.id);
    if (!wanted.has(id) || rings.has(id)) continue;
    const polys: number[][][][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    rings.set(id, polys.map(p => p[0].map(([lng, lat]) => local(lng, lat))));
  }
}

async function decode(file: string) {
  if (!existsSync(file)) return null;
  const doc = await io.read(file), out: number[] = [];
  const min = new T.Vector3(Infinity, Infinity, Infinity), max = new T.Vector3(-Infinity, -Infinity, -Infinity), v = new T.Vector3();
  for (const node of doc.getRoot().listNodes()) for (const prim of node.getMesh()?.listPrimitives() ?? []) {
    const pos = prim.getAttribute('POSITION'); if (!pos) continue;
    const idx = prim.getIndices(), world = new T.Matrix4().fromArray(node.getWorldMatrix()), n = idx?.getCount() ?? pos.getCount();
    for (let i = 0; i < n; i++) { v.fromArray(pos.getElement(idx ? idx.getScalar(i) : i, [])).applyMatrix4(world); out.push(v.x, v.y, v.z); min.min(v); max.max(v); }
  }
  return { tris: Float32Array.from(out), min, max };
}

type Row = { id: string; file: string; category: string; pands: number; hangM: number; at: [number, number] | null };
const rows: Row[] = [];
let noFootprint = 0;
for (const spec of specs) {
  const footprint = hiddenBy(spec).flatMap(id => rings.get(id) ?? []);
  if (!footprint.length) { noFootprint++; continue; }
  const base = path.join(MODEL_ROOT, spec.modelUrl.replace(/^\.\//, '').replace(/\?.*$/, ''));
  const full = await decode(base);
  if (!full) continue;
  // The lod2 is placed with the full model's bounds (the runtime swaps meshes under one placement).
  const placement = placementFor(spec, { min: full.min.toArray(), max: full.max.toArray() });
  for (const file of [base, base.replace(/\.glb$/, '.lod2.glb')]) {
    const mesh = file === base ? full : await decode(file);
    if (!mesh) continue;
    const [alng, alat] = placement.anchor;
    const cx = spec.surveyed ? 0 : (full.min.x + full.max.x) / 2, cz = spec.surveyed ? 0 : (full.min.z + full.max.z) / 2;
    const s = placement.scale, mirror = placement.mirror ? -1 : 1, phi = (90 - placement.modelRotationDegrees) * Math.PI / 180, basis = placement.horizontalBasis;
    const kx = 111320 * Math.cos(alat * Math.PI / 180), ky = 111320;
    let hang = 0, at: [number, number] | null = null;
    const p = [0, 0, 0, 0, 0, 0, 0, 0, 0], t = mesh.tris;
    for (let i = 0; i < t.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const x = (t[i + 3 * k] - cx) * s * mirror, y = (t[i + 3 * k + 1] - full.min.y) * s, z = (t[i + 3 * k + 2] - cz) * s;
        let east: number, north: number;
        if (basis) { east = x * basis.x[0] - z * basis.y[0]; north = -(x * basis.x[1] - z * basis.y[1]); }
        else { east = x * Math.cos(phi) + z * Math.sin(phi); north = x * Math.sin(phi) - z * Math.cos(phi); }
        const [gx, gy] = local(alng + east / kx, alat + north / ky);
        p[3 * k] = gx; p[3 * k + 1] = gy; p[3 * k + 2] = y;
      }
      if (Math.min(p[2], p[5], p[8]) < 3) continue;
      const ax = p[3] - p[0], ay = p[4] - p[1], az = p[5] - p[2], bx = p[6] - p[0], by = p[7] - p[1], bz = p[8] - p[2];
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-9 || Math.abs(nz) / nl < 0.3) continue;
      for (let k = 0; k < 3; k++) {
        const q = [p[3 * k], p[3 * k + 1]];
        if (footprint.some(r => insideRing(r, q[0], q[1]))) continue;
        const d = Math.min(...footprint.map(r => distanceToRing(r, q[0], q[1])));
        if (d > hang) { hang = d; at = [+(O.lng + q[0] / KX).toFixed(6), +(O.lat + q[1] / KY).toFixed(6)]; }
      }
    }
    rows.push({ id: spec.id, file: path.basename(file), category: spec.buildingCategory ?? spec.assetKind ?? '?', pands: footprint.length, hangM: +hang.toFixed(2), at });
  }
}
rows.sort((a, b) => b.hangM - a.hangM);
const by: Record<string, [number, number, number]> = {};
for (const r of rows) { const k = `${r.category}${r.file.endsWith('.lod2.glb') ? ' lod2' : ''}`; by[k] ??= [0, 0, 0]; by[k][0]++; if (r.hangM > 1) by[k][1]++; if (r.hangM > 3) by[k][2]++; }
console.log(`models ${specs.length}, without a suppressed footprint ${noFootprint}, meshes measured ${rows.length}`);
for (const [k, v] of Object.entries(by)) console.log(k.padEnd(32), `meshes ${v[0]}  >1m ${v[1]}  >3m ${v[2]}`);
for (const r of rows.slice(0, TOP)) console.log(`${r.hangM.toFixed(2).padStart(7)} m  ${r.file}  ${r.category}  pands ${r.pands}  at ${r.at}`);
if (flag('json')) writeFileSync(flag('json')!, JSON.stringify(rows, null, 1));
