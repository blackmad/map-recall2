// Ground determinism (#260 follow-up): does an own-ground cell's mesh depend on what its store built before it?
// Each LOD 0 cell is built three ways from the published extracts (the worker's code path, Node):
//   a  a fresh GroundStore
//   b  a store that first prepared each of its 8 neighbours, in a fixed order (row by row, NW first)
//   c  the same neighbours in the reverse order
// and each layer is hashed (positions, normals, uvs, colours, indices) with its triangle count and plan area. For a cell
// that differs, the decks and cuts near it are compared across the histories with the plan that placed each
// (GroundStore.planTrace): who reached a shared way deck or cut first.
//
//   npx tsx scripts/own-ground/probe-cell-determinism.ts                      # block + 20 belt cells + tunnel pin cells
//   npx tsx scripts/own-ground/probe-cell-determinism.ts --cells=-1_0,0_0     # only these
//   … --json=out.json   --seed=7   --belt=20   --build (also build the neighbours' meshes, not only prepare them)
//   … --deterministic=0  (the store's groundDeterministic option off: today's first-arrival planning)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type BuiltCell, type PackedMesh } from '../../src/canalRecall/ownGround/groundCell.ts';
import { TUNNEL_SITES } from '../../src/canalRecall/ownGround/tunnelRegressions.ts';

const ROOT = 'public/data/extracts/amsterdam';
const args = process.argv.slice(2);
const flag = (k: string) => args.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const read = async (p: string) => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const deterministic = flag('deterministic');
const options = { parks: true, roads: true, rails: true, ...(deterministic === '0' ? { deterministic: false } : {}) };

/** The worker's per-layer content: positions, normals, uvs, colours and indices hashed, triangles and plan area summed. */
interface LayerSig { hash: string; tris: number; area: number }
function layerSig(m: PackedMesh): LayerSig {
  const h = createHash('sha256');
  for (const a of [m.positions, m.normals, m.uvs, m.colors, m.indices]) if (a) { h.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); h.update('|'); }
  let area = 0;
  const p = m.positions, ix = m.indices;
  for (let t = 0; t + 2 < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    area += Math.abs((p[b] - p[a]) * (p[c + 1] - p[a + 1]) - (p[c] - p[a]) * (p[b + 1] - p[a + 1])) / 2;
  }
  return { hash: h.digest('hex').slice(0, 16), tris: ix.length / 3, area };
}
function cellSig(c: BuiltCell): Record<string, LayerSig> {
  const out: Record<string, LayerSig> = {};
  for (const k of Object.keys(c.layers).sort()) { const m = c.layers[k as keyof typeof c.layers]; if (m) out[k] = layerSig(m); }
  if (c.mask) { const h = createHash('sha256'); h.update(JSON.stringify(c.mask, (_, v) => ArrayBuffer.isView(v) ? Array.from(v as Float32Array) : v)); out['(mask)'] = { hash: h.digest('hex').slice(0, 16), tris: 0, area: 0 }; }
  return out;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v, (_, x) => typeof x === 'number' ? r3(x) : ArrayBuffer.isView(x) ? Array.from(x as Float32Array).map(r3) : x)).digest('hex').slice(0, 12);

interface History { sig: Record<string, LayerSig>; decks: Map<string, { sig: string; plan: string }>; cuts: Map<string, { sig: string; plan: string }>; ms: number }

async function history(key: string, before: string[], build: boolean): Promise<History> {
  const store = new GroundStore(read, options);
  await store.init();
  const plans = new Map<string, string>();
  store.planTrace = (kind, id, plan) => { if (kind === 'deck' || kind === 'cut') plans.set(`${kind}:${id}`, plan); };
  for (const n of before) {
    if (!store.covers(n)) continue;
    const input = await store.cellInput(n, 0);
    if (build) buildCell(input);
  }
  const t0 = performance.now();
  const input = await store.cellInput(key, 0);
  const built = buildCell(input);
  const ms = performance.now() - t0;
  const [x0, y0, x1, y1] = store.cellRect(key), pad = 200;
  const near = (b: readonly number[]) => !(b[2] < x0 - pad || b[0] > x1 + pad || b[3] < y0 - pad || b[1] > y1 + pad);
  const decks = new Map<string, { sig: string; plan: string }>(), cuts = new Map<string, { sig: string; plan: string }>();
  // The decks of the 3×3 (what cellInput reads; a store that prepared the neighbours also holds decks beyond it).
  for (const d of GroundStore.neighbours(key).flatMap(k => store.decks(k))) if (near(d.profile.bbox)) {
    const p = d.profile;
    decks.set(p.id, { sig: digest([p.x, p.y, p.s, p.halfWidth, p.sides, p.edges, p.deck, p.bbox]), plan: plans.get(`deck:${p.id}`) ?? 'measured' });
  }
  for (const c of store.surface.cuts) if (near(c.bbox)) cuts.set(c.id, { sig: digest([c.x, c.y, c.floor, c.left, c.right, c.wallL, c.wallR, c.rimL, c.rimR, c.gapL, c.gapR, c.portals]), plan: plans.get(`cut:${c.id}`) ?? '?' });
  return { sig: cellSig(built), decks, cuts, ms };
}

function diffLayers(a: History, b: History): { layer: string; tris: number; area: number }[] {
  const out: { layer: string; tris: number; area: number }[] = [];
  for (const k of new Set([...Object.keys(a.sig), ...Object.keys(b.sig)])) {
    const x = a.sig[k], y = b.sig[k];
    if (x?.hash === y?.hash) continue;
    out.push({ layer: k, tris: (y?.tris ?? 0) - (x?.tris ?? 0), area: Math.round((y?.area ?? 0) - (x?.area ?? 0)) });
  }
  return out;
}
function diffShared(kind: string, a: Map<string, { sig: string; plan: string }>, b: Map<string, { sig: string; plan: string }>): string[] {
  const out: string[] = [];
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(id), y = b.get(id);
    if (x?.sig === y?.sig) continue;
    out.push(`${kind} ${id}: ${x ? `plan ${x.plan}` : 'absent'} vs ${y ? `plan ${y.plan}` : 'absent'}${x && y ? ' (geometry differs)' : ''}`);
  }
  return out;
}

// Cells: the free-ride start's block, belt cells (seeded), the tunnel pins' cells.
const probe = new GroundStore(read, options);
await probe.init();
let cells = flag('cells')?.split(',');
if (!cells) {
  const block = ['-1_0', '0_0', '-1_-1', '0_-1'];
  let seed = Number(flag('seed') ?? 7);
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const belt = [...probe.roadCells].filter(k => { const [x, y] = k.split('_').map(Number); return Math.abs(x) <= 3 && Math.abs(y) <= 3 && !block.includes(k) && probe.covers(k); }).sort();
  const pick: string[] = [];
  while (pick.length < Number(flag('belt') ?? 20) && belt.length) pick.push(belt.splice(Math.floor(rnd() * belt.length), 1)[0]);
  const tunnels = [...new Set(TUNNEL_SITES.map(s => { const [x, y] = toLocal(s.at[0], s.at[1]); return probe.cellAt(x, y); }))].filter(k => !block.includes(k) && !pick.includes(k));
  cells = [...block, ...pick.sort(), ...tunnels];
}
const build = args.includes('--build');
const rows: unknown[] = [];
console.log(`${cells.length} cells, options ${JSON.stringify(options)}${build ? ', neighbours built' : ', neighbours prepared'}`);
for (const key of cells) {
  const around = GroundStore.neighbours(key).filter(n => n !== key);
  const a = await history(key, [], build), b = await history(key, around, build), c = await history(key, [...around].reverse(), build);
  const ab = diffLayers(a, b), ac = diffLayers(a, c), bc = diffLayers(b, c);
  const shared = [...diffShared('deck', a.decks, b.decks), ...diffShared('cut', a.cuts, b.cuts)].map(s => `a/b ${s}`)
    .concat([...diffShared('deck', a.decks, c.decks), ...diffShared('cut', a.cuts, c.cuts)].map(s => `a/c ${s}`));
  const same = !ab.length && !ac.length && !bc.length;
  console.log(`${key}: ${same ? 'identical' : 'DIFFERS'}  build a ${a.ms.toFixed(0)} ms (b ${b.ms.toFixed(0)}, c ${c.ms.toFixed(0)})  tris ${Object.values(a.sig).reduce((s, l) => s + l.tris, 0)}`);
  for (const [name, d] of [['a/b', ab], ['a/c', ac], ['b/c', bc]] as const) if (d.length) console.log(`  ${name}: ${d.map(l => `${l.layer} ${l.tris >= 0 ? '+' : ''}${l.tris} tris ${l.area >= 0 ? '+' : ''}${l.area} m²`).join(', ')}`);
  for (const s of shared.slice(0, 12)) console.log(`  ${s}`);
  if (shared.length > 12) console.log(`  … ${shared.length - 12} more`);
  rows.push({ key, same, ms: { a: a.ms, b: b.ms, c: c.ms }, ab, ac, bc, shared });
}
const differing = rows.filter(r => !(r as { same: boolean }).same).length;
console.log(`\n${differing} of ${rows.length} cells differ across histories`);
if (flag('json')) writeFileSync(flag('json')!, JSON.stringify(rows, null, 1));
