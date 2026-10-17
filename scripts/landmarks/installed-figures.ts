/**
 * Installed statue reconstructions (scripts/sculptures/rebuild.ts --steps=install, after the user picked the comparison
 * sheet): the landmark's kit builder still runs and keeps its plinth, pier and architecture; the kit figure triangles inside each
 * recorded cut are dropped and the TRELLIS.2/TripoSR figure is added in the kit's own material (bronze/stone, no photo colour),
 * so the GLB keeps the landmark id, placement, material overrides, slots and LOD path. Provenance (photos, authors, licences,
 * sculptor) is in scripts/sculptures/rebuild-sources/<id>.json.
 */
import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import * as T from 'three';
import {keptTriangles, type Box, type V3} from '../../src/canalRecall/sculptures/kitParts.js';

export interface InstalledFigure { name: string; glb: string; at: V3; cut: Box; cutMaterials: string[]; material: string; route?: string }
export interface InstalledRecord { id: string; provenance: string; figures: InstalledFigure[] }

const recordPath = (id: string) => `scripts/sculptures/installed/${id}.json`;

export function installedRecord(id: string): InstalledRecord | null {
  return fs.existsSync(recordPath(id)) ? JSON.parse(fs.readFileSync(recordPath(id), 'utf8')) as InstalledRecord : null;
}

interface BuilderPart { g: T.BufferGeometry; c: string; hex?: string; unlit?: boolean }

/** Cut the kit figures out of the builder parts and add the installed figures; no-op (null) when the landmark has no record. */
export async function applyInstalledFigures(id: string, parts: BuilderPart[]): Promise<{dropped: number; added: number} | null> {
  const rec = installedRecord(id);
  if (!rec) return null;
  const cuts = rec.figures.map(f => ({box: f.cut, materials: f.cutMaterials}));
  let dropped = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part.hex) continue; // decals and lettering are never a figure
    const g = part.g.index ? part.g.toNonIndexed() : part.g;
    const pos = g.getAttribute('position').array;
    const keep = keptTriangles(pos, part.c, cuts);
    const total = pos.length / 9;
    if (keep.length === total) continue;
    dropped += total - keep.length;
    if (!keep.length) { parts.splice(i, 1); continue; }
    const ng = new T.BufferGeometry();
    for (const name of Object.keys(g.attributes)) {
      const a = g.getAttribute(name), arr = new Float32Array(keep.length * 3 * a.itemSize);
      keep.forEach((t, j) => { for (let k = 0; k < 3 * a.itemSize; k++) arr[j * 3 * a.itemSize + k] = a.array[t * 3 * a.itemSize + k]; });
      ng.setAttribute(name, new T.BufferAttribute(arr, a.itemSize));
    }
    part.g = ng;
  }
  let added = 0;
  const io = new NodeIO();
  for (const f of rec.figures) {
    const doc = await io.read(f.glb);
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh(); if (!mesh) continue;
      const m = new T.Matrix4().fromArray(node.getWorldMatrix());
      for (const p of mesh.listPrimitives()) {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(Float32Array.from(p.getAttribute('POSITION')!.getArray()!), 3));
        const idx = p.getIndices();
        if (idx) g.setIndex(Array.from(idx.getArray()!));
        g.applyMatrix4(m);
        g.translate(f.at[0], f.at[1], f.at[2]);
        g.computeVertexNormals(); // smooth shading across the reconstructed surface
        added += (idx ? idx.getCount() : g.getAttribute('position').count) / 3;
        parts.push({g, c: f.material});
      }
    }
  }
  return {dropped, added};
}
