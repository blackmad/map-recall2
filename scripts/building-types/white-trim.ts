/**
 * Material-only white-trim recolour (#78) of a building-types GLB document: unit files (regen-units.ts --white-only) and
 * the staged per-area baked GLBs the review sheets render (`--dir=staging/building-types/<area>` below).
 *
 *   node --import tsx scripts/building-types/white-trim.ts --dir=staging/building-types/nd-nn-03 [--out=<dir>]
 *
 * Every material whose published `slot|tint` is a painted-white trim colour of one of the given palettes takes the trim
 * white (whiteTrim.ts `whiteTrimRemap`); materials that become one key are merged. Accessors, nodes and meshes are
 * untouched, so the geometry is identical (checked by --check).
 */
import fs from 'node:fs';
import path from 'node:path';
import {NodeIO, type Document, type Material} from '@gltf-transform/core';
import {EXTMeshGPUInstancing, KHRMeshQuantization, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import {whiteTrimRemap} from '../../src/canalRecall/buildingTypes/whiteTrim.ts';
import {materialId, type MaterialKey} from '../../src/canalRecall/buildingTypes/mesh.ts';
import type {Palette, TypeSpec} from '../../src/canalRecall/buildingTypes/spec.ts';

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Recolour the painted-white trim materials of `doc` for the given palettes (union of their remaps). */
export function recolourWhiteTrim(doc: Document, palettes: Palette[]): {changed: number; conflicts: string[]; summary: string} {
  const remap = new Map<string, MaterialKey>(), conflicts = new Set<string>();
  for (const p of palettes) { const r = whiteTrimRemap(p); for (const [k, v] of r.remap) remap.set(k, v); for (const c of r.conflicts) conflicts.add(c); }
  const published = (m: Material) => { const ex = m.getExtras() as {materialSlot?: string; tint?: string; tintSource?: string}; return `${ex.materialSlot}|${ex.tint}${ex.tintSource === 'measured' ? '|measured' : ''}`; };
  const used = doc.getRoot().listMaterials().map(published);
  const blocked = [...conflicts].filter(c => used.includes(c));
  if (blocked.length) return {changed: 0, conflicts: blocked, summary: ''};
  const target = new Map<string, Material>(), moved: string[] = [];
  let changed = 0;
  for (const m of doc.getRoot().listMaterials()) {
    const key = remap.get(published(m));
    if (!key) continue;
    const id = materialId(key);
    const keep = target.get(id);
    if (keep) {
      // Same new key as an earlier material: its primitives move to that one.
      for (const prim of doc.getRoot().listMeshes().flatMap(me => me.listPrimitives())) if (prim.getMaterial() === m) prim.setMaterial(keep);
      moved.push(`${published(m)}->${id}`); m.dispose(); changed++;
      continue;
    }
    const lin = [1, 3, 5].map(i => srgbToLinear(parseInt(key.tint.slice(i, i + 2), 16) / 255));
    moved.push(`${published(m)}->${id}`);
    m.setName(`${key.slot}_${key.tint.slice(1)}`).setBaseColorFactor([lin[0], lin[1], lin[2], 1]).setExtras({materialSlot: key.slot, tint: key.tint});
    target.set(id, m); changed++;
  }
  return {changed, conflicts: [], summary: moved.join(' ')};
}

/** Decoded accessor arrays of every primitive, in order: the geometry a recolour must leave identical. */
export function geometryOf(doc: Document): Float64Array[] {
  const out: Float64Array[] = [];
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    for (const sem of prim.listSemantics().sort()) out.push(Float64Array.from(prim.getAttribute(sem)!.getArray()!));
    const idx = prim.getIndices(); if (idx) out.push(Float64Array.from(idx.getArray()!));
  }
  for (const node of doc.getRoot().listNodes()) out.push(Float64Array.from([...node.getTranslation(), ...node.getRotation(), ...node.getScale()]));
  return out;
}

const io = () => new NodeIO().registerExtensions([KHRMeshQuantization, EXTMeshoptCompression, EXTMeshGPUInstancing]).registerDependencies({'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder});

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
  await MeshoptDecoder.ready; await MeshoptEncoder.ready;
  const TYPES = 'src/canalRecall/buildingTypes/types';
  const palettes = fs.readdirSync(TYPES).filter(f => f.endsWith('.json')).flatMap(f => Object.values((JSON.parse(fs.readFileSync(path.join(TYPES, f), 'utf8')) as TypeSpec).variants).map(v => v.palette));
  const dir = arg('dir'), out = arg('out', dir), check = process.argv.includes('--check');
  if (!dir) throw new Error('--dir=<folder of GLBs> required');
  fs.mkdirSync(out, {recursive: true});
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.glb'))) {
    const doc = await io().read(path.join(dir, f)), before = geometryOf(doc);
    const r = recolourWhiteTrim(doc, palettes);
    if (r.conflicts.length) { console.warn('SKIP', f, r.conflicts.join(' ')); continue; }
    const after = geometryOf(doc);
    if (before.length !== after.length || before.some((a, i) => a.length !== after[i].length || a.some((v, j) => v !== after[i][j]))) throw new Error(`${f}: geometry changed`);
    if (!check) fs.writeFileSync(path.join(out, f), await io().writeBinary(doc));
    console.log(f, r.changed, 'material(s)');
  }
}
