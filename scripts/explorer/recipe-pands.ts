/**
 * What the published recipe tiles (public/canal-drive/recipe-tiles/, the `?recipeTiles=1` near tier) draw, per pand:
 * where it stands, which authoring unit it comes from, and the city-look layers and tints its triangles carry. Read
 * straight from the mesh tiles and their units, so it says what the ride draws, not what the authoring hopes for.
 * Used by build-looks.ts for explorer-recipe-pands.json and each look's `recipeTiles`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { tileIO } from '../../src/canalRecall/tileBuildings/writeTile';
import { tileInstances } from '../../src/canalRecall/tileBuildings/readTile';
import { fromFrame, parseTileId, tileFrame } from '../../src/canalRecall/tileBuildings/tiles';
import { SLOT_LAYERS } from '../../src/canalRecall/look/cityLook';
import type { MeshTileMeta } from '../../src/canalRecall/tileBuildings/schema';
import type { LngLat } from '../../src/canalRecall/explorer/types';
import type { RecipePand } from '../../src/canalRecall/explorer/looks';

type Acc = { tris: number; area: number; sx: number; sz: number; n: number; slots: Map<string, number>; unit?: string };
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Per (layer, tint) triangle counts and the vertex centroid of a primitive's triangles [first, first + count). */
function primStats(prim: any, world: number[], first: number, count: number, acc: Acc): void {
  const pos = prim.getAttribute('POSITION'), idx = prim.getIndices(), layer = prim.getAttribute('_LAYER'), tint = prim.getAttribute('_TINT');
  const p: number[] = [], t: number[] = [], w: number[][] = [[], [], []];
  for (let tri = first; tri < first + count; tri++) {
    const v0 = idx ? idx.getScalar(tri * 3) : tri * 3;
    for (let j = 0; j < 3; j++) {
      pos.getElement(idx ? idx.getScalar(tri * 3 + j) : tri * 3 + j, p);
      for (let r = 0; r < 3; r++) w[j][r] = world[r] * p[0] + world[4 + r] * p[1] + world[8 + r] * p[2] + world[12 + r];
      acc.sx += w[j][0]; acc.sz += w[j][2];
      acc.n++;
    }
    acc.tris++;
    const ax = w[1][0] - w[0][0], ay = w[1][1] - w[0][1], az = w[1][2] - w[0][2], bx = w[2][0] - w[0][0], by = w[2][1] - w[0][1], bz = w[2][2] - w[0][2];
    const area = Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) / 2;
    acc.area += area;
    if (!layer) continue;
    const cell = SLOT_LAYERS[layer.getScalar(v0)]?.cell ?? 'other';
    if (tint) { tint.getElement(v0, t); }
    // Normalized u8 reads back as 0..1.
    const key = `${cell}|${tint ? hex(t[0] * 255, t[1] * 255, t[2] * 255) : ''}`;
    acc.slots.set(key, (acc.slots.get(key) ?? 0) + area);
  }
}

export type RecipeTilesSummary = { pands: Map<string, RecipePand & { lngLat: LngLat }>; tiles: string[] };

export async function readRecipePands(canal: string, refOf: (pand: string, unit?: string) => string | undefined): Promise<RecipeTilesSummary> {
  const base = path.join(canal, 'recipe-tiles');
  const index = JSON.parse(readFileSync(path.join(base, 'index.json'), 'utf8')) as { tiles: Record<string, unknown> };
  const io = await tileIO();
  const unitCache = new Map<string, { prims: { prim: any; world: number[]; count: number }[] }>();
  const unitOf = async (hash: string) => {
    let u = unitCache.get(hash);
    if (!u) {
      const doc = await io.readBinary(readFileSync(path.join(base, 'units', `${hash}.glb`)));
      const prims: { prim: any; world: number[]; count: number }[] = [];
      for (const node of doc.getRoot().listNodes()) for (const prim of node.getMesh()?.listPrimitives() ?? []) {
        const idx = prim.getIndices();
        prims.push({ prim, world: Array.from(node.getWorldMatrix()), count: (idx ? idx.getCount() : prim.getAttribute('POSITION')!.getCount()) / 3 });
      }
      unitCache.set(hash, u = { prims });
    }
    return u;
  };
  const pands = new Map<string, RecipePand & { lngLat: LngLat }>();
  const tiles = Object.keys(index.tiles).sort();
  for (const id of tiles) {
    const file = path.join(base, 'building-mesh', `${id}.glb`);
    if (!existsSync(file)) continue;
    const doc = await io.readBinary(readFileSync(file));
    const meta = (doc.getRoot().getExtras() as { recipeTile: MeshTileMeta }).recipeTile;
    const accs: Acc[] = meta.pands.map(() => ({ tris: 0, area: 0, sx: 0, sz: 0, n: 0, slots: new Map() }));
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh();
      if (!mesh || node.getExtension('EXT_mesh_gpu_instancing')) continue;
      const world = Array.from(node.getWorldMatrix());
      for (const prim of mesh.listPrimitives()) for (const [pand, first, count] of ((prim.getExtras() as any)?.pandRanges ?? []) as number[][]) primStats(prim, world, first, count, accs[pand]);
    }
    for (const { unit, items } of tileInstances(doc)) {
      const u = await unitOf(unit);
      for (const { matrix, pand } of items) {
        if (pand < 0) continue;
        accs[pand].unit = unit;
        for (const { prim, world, count } of u.prims) {
          // instance matrix × unit node transform
          const m = new Array(16).fill(0);
          for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) m[c * 4 + r] += matrix[k * 4 + r] * world[c * 4 + k];
          primStats(prim, m, 0, count, accs[pand]);
        }
      }
    }
    const frame = tileFrame(parseTileId(id));
    meta.pands.forEach((key, i) => {
      const a = accs[i];
      if (!a.n) return;
      const lngLat = fromFrame(frame, a.sx / a.n, a.sz / a.n).map(v => Math.round(v * 1e6) / 1e6) as LngLat;
      const slots = [...a.slots].sort((x, y) => y[1] - x[1]).slice(0, 6)
        .map(([k, n]) => { const [cell, tint] = k.split('|'); return [cell, tint, Math.round((100 * n) / (a.area || 1))] as [string, string, number]; });
      pands.set(key, {
        tile: id, name: meta.names[i] ?? key, lngLat, triangles: a.tris, slots,
        ...(a.unit ? { unit: a.unit } : {}),
        ...(refOf(key, a.unit) ? { ref: refOf(key, a.unit) } : {}),
      });
    });
  }
  return { pands, tiles };
}

/** Pand → authoring reference ("face:<face>/<i> · <type>", "type:<unit>", "house:<id>", "model:<spec>"). */
export function authoringRefs(root: string, canal: string, opts: { modelOfPand: Map<string, string> }): (pand: string) => string | undefined {
  const refs = new Map<string, string>();
  const short = (p: string) => p.replace(/^NL\.IMBAG\.Pand\./, '');
  const facesDir = path.join(root, 'scripts/block-face/faces');
  for (const face of readdirSync(facesDir)) {
    const f = path.join(facesDir, face, 'intent.json');
    if (!existsSync(f)) continue;
    const houses = (JSON.parse(readFileSync(f, 'utf8')).houses ?? []) as { pandId?: string; type?: { type?: string } }[];
    houses.forEach((h, i) => { if (h.pandId) refs.set(short(h.pandId), `face:${face}/${i}${h.type?.type ? ` · type ${h.type.type}` : ''}`); });
  }
  const housesDir = path.join(root, 'scripts/building-recipes/houses');
  if (existsSync(housesDir)) for (const id of readdirSync(housesDir)) {
    const f = path.join(housesDir, id, 'intent.json');
    if (!existsSync(f)) continue;
    const j = JSON.parse(readFileSync(f, 'utf8')) as { pandId?: string; kind?: string };
    if (j.pandId && !refs.has(short(j.pandId))) refs.set(short(j.pandId), `house:${id}${j.kind === 'large' ? ' · large' : ''}`);
  }
  const instances = JSON.parse(readFileSync(path.join(canal, 'building-types/instances.json'), 'utf8')) as { pand: string; unit: string }[];
  for (const i of instances) if (!refs.has(short(i.pand))) refs.set(short(i.pand), `type:${i.unit}`);
  return pand => {
    if (pand.startsWith('m:')) return `model:${pand.slice(2)}`;
    return refs.get(pand) ?? (opts.modelOfPand.get(pand) ? `model:${opts.modelOfPand.get(pand)}` : undefined);
  };
}
