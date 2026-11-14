/**
 * The rowFront variant of a staged face chunk (house rows, lane D 2026-11-14): the same GLB without the wall of each
 * pand that scripts/house-specs/rows/wall-only.json gives to a row (RowMember.wallOnly). The roof, its dormers, the
 * pand's other street and the other pands stay; the row draws that wall (lane R, `<pand>#row-wall`, ROW_FRONT on).
 *
 *   node --import tsx scripts/block-face/row-wall-variant.ts --face=bilder-233580-162444 [--install]
 *
 * Reads staging/block-face/<face>/chunk.glb (run compile.ts first), writes chunk-rowfront.glb and rowfront.json beside it
 * (triangles cut per material, the zone, the entry's `rowFront` fields) and adds `rowFront` to the staged manifest-entry.json. --install (the
 * integrator's) writes the quantized + meshopt GLB as models/.../chunk-<name>-rowfront.glb and sets `rowFront` on the
 * chunk's chunks.json entry. Flag off, the loader keeps modelUrl: nothing changes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { cutPrimitive, rdToChunk, wallZone, type ChunkFrame } from '../../src/canalRecall/streetChunks/rowWallCut.ts';
import { compressGlb, describeInstalledGlb } from '../../src/canalRecall/glb/compressGlb.ts';
import { STAGING } from './intake.ts';

const MODELS = 'public/canal-drive/models/ordinary-buildings/chunks', MANIFEST = 'public/canal-drive/ordinary-buildings-data/chunks.json';
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);

type WallOnly = { chunk: string; edgeRD: [[number, number], [number, number]]; ref: string };
type PandMeta = { pandId: string; triangles: number; ranges: { primitive: number; firstTriangle: number; triangleCount: number }[]; eavesM?: number };

export async function rowWallVariant(faceId: string) {
  const dir = path.join(STAGING, faceId), name = `face-${faceId}`, chunkId = `chunk-${name}`;
  const rows = (JSON.parse(await fs.readFile('scripts/house-specs/rows/wall-only.json', 'utf8')) as { rows: Record<string, Record<string, WallOnly>> }).rows;
  const walls = Object.entries(rows).flatMap(([row, m]) => Object.entries(m).filter(([, w]) => w.chunk === chunkId).map(([pandId, w]) => ({ row, pandId, ...w })));
  if (!walls.length) throw new Error(`no wall-only pands for ${chunkId} in wall-only.json`);
  const report = JSON.parse(await fs.readFile(path.join(dir, 'report.json'), 'utf8')) as { perPand: { pand: string; fronts: { id: string; widthM: number; eavesM: number }[] }[] };
  const doc = await new NodeIO().read(path.join(dir, 'chunk.glb'));
  const node = doc.getRoot().listNodes()[0], extras = node.getExtras() as { streetChunk: { frame: ChunkFrame; pands: PandMeta[] } };
  const sc = extras.streetChunk, prims = node.getMesh()!.listPrimitives();
  const cuts: Record<string, unknown>[] = [];
  for (const w of walls) {
    const pand = sc.pands.findIndex(p => p.pandId === w.pandId);
    if (pand < 0) throw new Error(`${w.pandId} not in ${chunkId}`);
    const a = rdToChunk(sc.frame, w.edgeRD[0]), b = rdToChunk(sc.frame, w.edgeRD[1]), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // The front on this edge (the compile's per-front eaves): the one whose width matches the edge.
    const fr = report.perPand.find(p => p.pand === w.pandId)!.fronts.reduce((x, y) => (Math.abs(y.widthM - L) < Math.abs(x.widthM - L) ? y : x));
    if (Math.abs(fr.widthM - L) > 0.3) throw new Error(`${w.pandId}: no front of the compile matches the ${L.toFixed(2)} m edge (closest ${fr.id} ${fr.widthM} m)`);
    // A point inside the pand: its vertex mean.
    let sx = 0, sz = 0, nv = 0;
    for (const r of sc.pands[pand].ranges) {
      const p = prims[r.primitive], pos = p.getAttribute('POSITION')!.getArray()!, idx = p.getIndices()!.getArray()!;
      for (let k = 3 * r.firstTriangle; k < 3 * (r.firstTriangle + r.triangleCount); k++) { sx += pos[3 * idx[k]]; sz += pos[3 * idx[k] + 2]; nv++; }
    }
    const zone = wallZone(a, b, [sx / nv, sz / nv], fr.eavesM - 0.02);
    const perMaterial: Record<string, number> = {};
    let removed = 0;
    prims.forEach((p, i) => {
      const ranges = ((p.getExtras() as { pandRanges?: number[][] }).pandRanges ?? []);
      if (!ranges.some(r => r[0] === pand)) return;
      const idxAcc = p.getIndices()!, res = cutPrimitive({ indices: idxAcc.getArray()!, positions: p.getAttribute('POSITION')!.getArray()!, ranges }, pand, zone);
      if (!res.removed) return;
      const Arr = idxAcc.getArray()!.constructor as Uint16ArrayConstructor | Uint32ArrayConstructor;
      idxAcc.setArray(new Arr(res.indices));
      p.setExtras({ ...p.getExtras(), pandRanges: res.ranges });
      for (const pm of sc.pands) for (const r of pm.ranges) if (r.primitive === i) {
        const t = res.ranges.find(x => x[0] === sc.pands.indexOf(pm))!;
        pm.triangles += t[2] - r.triangleCount; r.firstTriangle = t[1]; r.triangleCount = t[2];
      }
      perMaterial[p.getMaterial()?.getName() ?? `#${i}`] = res.removed; removed += res.removed;
    });
    cuts.push({ row: w.row, pandId: w.pandId, front: fr.id, edgeM: +L.toFixed(3), eavesM: fr.eavesM, zone: { ...zone, a: zone.a.map(v => +v.toFixed(3)), b: zone.b.map(v => +v.toFixed(3)), out: zone.out.map(v => +v.toFixed(4)) }, removed, perMaterial });
  }
  node.setExtras(extras);
  const glb = await new NodeIO().writeBinary(doc);
  const out = path.join(dir, 'chunk-rowfront.glb');
  await fs.writeFile(out, glb);
  const triangles = prims.reduce((t, p) => t + p.getIndices()!.getCount() / 3, 0);
  const rowFront = { modelUrl: `./models/ordinary-buildings/chunks/${chunkId}-rowfront.glb`, sha256: createHash('sha256').update(glb).digest('hex'), bytes: glb.length, triangles };
  const summary = { face: faceId, chunk: chunkId, staged: out, cuts, rowFront, note: 'staged bytes (plain); --install writes the quantized + meshopt GLB and re-describes sha256/bytes' };
  await fs.writeFile(path.join(dir, 'rowfront.json'), JSON.stringify(summary, null, 1) + '\n');
  // The staged chunks.json entry carries it too (re-described from the installed bytes by --install).
  const entryPath = path.join(dir, 'manifest-entry.json'), entry = JSON.parse(await fs.readFile(entryPath, 'utf8'));
  await fs.writeFile(entryPath, JSON.stringify({ ...entry, rowFront: { ...rowFront, modelUrl: `${rowFront.modelUrl}?asset=${rowFront.sha256.slice(0, 16)}` } }, null, 1) + '\n');
  for (const c of cuts) console.log(`${chunkId}: ${String(c.pandId).slice(-6)} ${c.front} (${c.edgeM} m, below ${c.eavesM} m): ${c.removed} triangles cut ${JSON.stringify(c.perMaterial)}`);
  console.log(`  rowFront variant: ${triangles} triangles, ${glb.length} B -> ${out}`);
  return { out, rowFront };
}

export async function installRowWallVariant(faceId: string, staged: string) {
  const chunkId = `chunk-face-${faceId}`;
  const installed = await compressGlb(new Uint8Array(await fs.readFile(staged)));
  await fs.writeFile(path.join(MODELS, `${chunkId}-rowfront.glb`), installed);
  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8')) as { chunks: Array<{ id: string; triangles: number; rowFront?: unknown }> };
  const entry = manifest.chunks.find(c => c.id === chunkId);
  if (!entry) throw new Error(`${chunkId} is not installed: install the chunk first (compile.ts --install)`);
  const summary = JSON.parse(await fs.readFile(path.join(path.dirname(staged), 'rowfront.json'), 'utf8')) as { rowFront: { modelUrl: string; triangles: number } };
  entry.rowFront = { ...describeInstalledGlb({ modelUrl: summary.rowFront.modelUrl, sha256: '', bytes: 0 }, installed), triangles: summary.rowFront.triangles };
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
  console.log(`installed ${chunkId} rowFront (${installed.length} B)`);
}

if (process.argv[1]?.endsWith('block-face/row-wall-variant.ts')) {
  const faceId = arg('face');
  if (!faceId) throw Error('Use --face=<id> [--install]');
  const { out } = await rowWallVariant(faceId);
  if (process.argv.includes('--install')) await installRowWallVariant(faceId, out);
}
