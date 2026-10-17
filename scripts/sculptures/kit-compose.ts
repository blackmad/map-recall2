/**
 * glTF side of kit surgery (pure geometry in src/canalRecall/sculptures/kitParts.ts): read a kit landmark's triangles in the
 * landmark frame, and write a composed GLB of kept kit triangles (their own materials) plus reconstructed figures in the kit's
 * bronze/stone material slots (no photo colour baked).
 */
import {Document, type Material} from '@gltf-transform/core';
import type {Tri, V3} from '../../src/canalRecall/sculptures/kitParts.js';

export {partsOf} from '../../src/canalRecall/sculptures/kitParts.js';

export interface KitTri extends Tri { src: Material | null }

/** Every triangle of every mesh node, transformed by the node's world matrix (doc must be dequantized). */
export function kitTriangles(doc: Document): KitTri[] {
  const out: KitTri[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION')!, idx = p.getIndices();
      const n = idx ? idx.getCount() : pos.getCount();
      const v = (i: number): V3 => {
        const q = pos.getElement(idx ? idx.getScalar(i) : i, [0, 0, 0]) as number[];
        return [m[0] * q[0] + m[4] * q[1] + m[8] * q[2] + m[12], m[1] * q[0] + m[5] * q[1] + m[9] * q[2] + m[13], m[2] * q[0] + m[6] * q[1] + m[10] * q[2] + m[14]];
      };
      const mat = p.getMaterial();
      for (let t = 0; t + 2 < n; t += 3) out.push({a: v(t), b: v(t + 1), c: v(t + 2), material: mat?.getName() ?? '', src: mat});
    }
  }
  return out;
}

const FALLBACK = {
  bronze: {color: [0.07, 0.05, 0.04, 1], extras: {materialSlot: 'paint', tint: '#4a4038', materialSlotSource: 'inferred'}},
  stone: {color: [0.58, 0.54, 0.42, 1], extras: {materialSlot: 'stone', tint: '#c9c2ae', materialSlotSource: 'inferred'}},
};

/** Composed GLB document: kept kit triangles keep their own material (name, colour, extras); figure triangles take the kit's material named `figureMaterial` (else the first kit material whose name contains it, else a tagged default). */
export function composeDoc(name: string, kit: KitTri[], keep: (i: number) => boolean, figures: {tris: V3[][]; material: 'bronze' | 'stone'}[]): {doc: Document; triangles: number; kitTriangles: number} {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mats = new Map<string, Material>();
  const copy = (src: Material | null, fallbackName: 'bronze' | 'stone') => {
    const k = src ? `kit:${src.getName()}` : `fb:${fallbackName}`;
    if (!mats.has(k)) {
      const m = doc.createMaterial(src?.getName() || fallbackName);
      if (src) m.setBaseColorFactor(src.getBaseColorFactor()).setRoughnessFactor(src.getRoughnessFactor()).setMetallicFactor(src.getMetallicFactor()).setExtras({...src.getExtras()});
      else m.setBaseColorFactor(FALLBACK[fallbackName].color as any).setRoughnessFactor(0.9).setMetallicFactor(0).setExtras({...FALLBACK[fallbackName].extras});
      mats.set(k, m);
    }
    return mats.get(k)!;
  };
  const kitMat = (want: 'bronze' | 'stone') => {
    const all = [...new Set(kit.map(t => t.src).filter(Boolean))] as Material[];
    return all.find(m => m.getName() === want) ?? all.find(m => m.getName().includes(want)) ?? null;
  };
  const prims = new Map<Material, number[]>();
  const push = (m: Material, a: V3, b: V3, c: V3) => { if (!prims.has(m)) prims.set(m, []); prims.get(m)!.push(...a, ...b, ...c); };
  let kept = 0;
  kit.forEach((t, i) => { if (keep(i)) { push(copy(t.src, 'stone'), t.a, t.b, t.c); kept++; } });
  for (const f of figures) {
    const m = copy(kitMat(f.material), f.material);
    for (const [a, b, c] of f.tris) push(m, a, b, c);
  }
  const mesh = doc.createMesh(name);
  let total = 0;
  for (const [m, arr] of prims) {
    const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(arr)).setBuffer(buffer);
    mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos).setMaterial(m));
    total += arr.length / 9;
  }
  doc.createScene().addChild(doc.createNode(name).setMesh(mesh));
  return {doc, triangles: total, kitTriangles: kept};
}

/** Triangles of a plain (single-material) GLB, translated by `offset`. */
export function plainTriangles(doc: Document, offset: V3 = [0, 0, 0]): V3[][] {
  return kitTriangles(doc).map(t => [t.a, t.b, t.c].map(v => [v[0] + offset[0], v[1] + offset[1], v[2] + offset[2]] as V3));
}
