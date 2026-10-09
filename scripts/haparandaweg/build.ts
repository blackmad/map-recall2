/**
 * Block-kit build: spec + 3DBAG surfaces -> GLB (uncompressed + meshopt) + gate report.
 *
 *   node --import tsx scripts/haparandaweg/build.ts --id=haparandaweg-902-950 [--budget=30000]
 *
 * Writes artifacts/haparandaweg/<id>/{model.glb,model.min.glb,report.json,panels.json}.
 */
import fs from 'node:fs';
import * as T from 'three';
import opentype from 'opentype.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { compose, bearingOf, type TextShaper } from '../../src/canalRecall/blockBuilding/compose.ts';
import { runGates } from '../../src/canalRecall/blockBuilding/gates.ts';
import type { BlockSpec } from '../../src/canalRecall/blockBuilding/spec.ts';
import type { SurfaceSet } from '../../src/canalRecall/blockBuilding/types.ts';
import type { MeshBuilder } from '../../src/canalRecall/blockBuilding/mesh.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;

const fontCache = new Map<string, opentype.Font>();
export const shaper: TextShaper = (text, fontName = 'ArchivoBlack-Regular') => {
  let font = fontCache.get(fontName);
  if (!font) { const buf = fs.readFileSync(`public/canal-drive/fonts/${fontName}.ttf`); font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer); fontCache.set(fontName, font); }
  const path = font.getPath(text, 0, 0, 100), sp = new T.ShapePath();
  for (const c of path.commands as any[]) {
    if (c.type === 'M') sp.moveTo(c.x, -c.y); else if (c.type === 'L') sp.lineTo(c.x, -c.y);
    else if (c.type === 'Q') sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y); else if (c.type === 'C') sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
    else if (c.type === 'Z') sp.currentPath?.closePath();
  }
  const shapes = sp.toShapes(false), bb = new T.Box2();
  for (const s of shapes) for (const p of s.getPoints()) bb.expandByPoint(p);
  const out = shapes.map(s => {
    const mv = (p: T.Vector2) => new T.Vector2(p.x - bb.min.x, p.y - bb.min.y), n = new T.Shape(s.getPoints().map(mv));
    for (const h of s.holes) n.holes.push(new T.Path(h.getPoints().map(mv)));
    return n;
  });
  return { shapes: out, width: bb.max.x - bb.min.x, ascent: bb.max.y - bb.min.y };
};

export async function writeGlb(mesh: MeshBuilder, palette: Record<string, string>, id: string, outDir: string, compress = true) {
  const doc = new Document(), buf = doc.createBuffer(), scene = doc.createScene(id), gm = doc.createMesh(id);
  doc.getRoot().setDefaultScene(scene);
  for (const [slot, s] of mesh.slots) {
    const hex = palette[slot]; if (!hex) throw new Error(`slot ${slot} has no palette colour`);
    const col = new T.Color(hex);
    const mat = doc.createMaterial(slot).setBaseColorFactor([col.r, col.g, col.b, 1]).setMetallicFactor(0).setRoughnessFactor(0.9).setDoubleSided(false);
    const pos = Float32Array.from(s.positions), nor = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 9) {
      const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2], bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      for (let k = 0; k < 3; k++) { nor[i + k * 3] = nx; nor[i + k * 3 + 1] = ny; nor[i + k * 3 + 2] = nz; }
    }
    gm.addPrimitive(doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nor).setBuffer(buf)).setMaterial(mat));
  }
  scene.addChild(doc.createNode(id).setMesh(gm));
  await doc.transform(weld(), dedup(), prune());
  fs.mkdirSync(outDir, { recursive: true });
  await new NodeIO().write(`${outDir}/model.glb`, doc);
  if (compress) {
    await MeshoptEncoder.ready;
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder }).write(`${outDir}/model.min.glb`, doc);
  }
}

export function loadSpec(id: string): { spec: BlockSpec; set: SurfaceSet } {
  const spec = JSON.parse(fs.readFileSync(`scripts/haparandaweg/specs/${id}.json`, 'utf8')) as BlockSpec;
  const set = JSON.parse(fs.readFileSync(`scripts/haparandaweg/data/${spec.pandId}.surfaces.json`, 'utf8')) as SurfaceSet;
  return { spec, set };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = arg('id'), { spec, set } = loadSpec(id), t0 = Date.now();
  if (arg('nosigns')) spec.signs = [];
  const res = compose(set, spec, { shaper });
  const gates = runGates(res.mesh, set, { budget: Number(arg('budget', '30000')) });
  const out = `artifacts/haparandaweg/${id}`;
  await writeGlb(res.mesh, spec.palette, id, out);
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ id, pandId: spec.pandId, buildMs: Date.now() - t0, stats: res.stats, gates, bytes: { raw: fs.statSync(`${out}/model.glb`).size, meshopt: fs.statSync(`${out}/model.min.glb`).size } }, null, 1));
  fs.writeFileSync(`${out}/panels.json`, JSON.stringify(res.assignment.map(a => ({ ...a, bearing: Math.round(bearingOf(res.panels[a.panel].n)), vMax: +res.panels[a.panel].vMax.toFixed(1), partyH: res.panels[a.panel].partyH, centre: a.centre.map(v => +v.toFixed(1)), width: +a.width.toFixed(1) }))));
  console.log(JSON.stringify({ id, stats: res.stats, gates }, null, 1));
  if (!gates.ok) process.exitCode = 1;
}
