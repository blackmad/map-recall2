// Tunnel wall edge roughness in the own ground (engine round 5, lane R5-C2, issue #263; user shot U3 at Rapenburg:
// pale shards hanging over the IJ-tunnel ramp walls).
//
//   npx tsx scripts/own-ground/probe-portal-edges.ts [lng lat radiusM=120] [--roads=0] [--portalClip=0]
//
// Builds the LOD 0 cells around the point as the game does (roads-v1 on unless --roads=0) and, for every walled
// station of every cut within the radius, looks at the ground triangles (every layer except the cut's own walls and
// floor, kerbs, paint) within WALL_BAND_M of the wall line:
//   straddle  a triangle with vertices on both sides of the wall line (inside the strip and outside it) whose height
//             spans more than 0.3 m: it slopes from the rim down to the floor across the wall: a shard;
//   offLevel  a vertex within the band whose height is more than 0.3 m off the level the cut says (the floor inside
//             the strip, the ground outside): mean and p95 deviation, metres.
// Counted per layer. The wall-line deviation is the distance of a straddling triangle's farthest vertex from the wall
// line (how far a shard reaches over or into the trench).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { insideCut, locateCut, type Cut } from '../../src/canalRecall/ownGround/tunnels.ts';

const WALL_BAND_M = 3, SPAN_M = 0.3;
const pos = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flag = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const [lng, lat, radius] = [Number(pos[0] ?? 4.91165), Number(pos[1] ?? 52.37250), Number(pos[2] ?? 120)];
const ROOT = 'public/data/extracts/amsterdam';
const bytes = async (p: string) => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const portalClip = flag('portalClip') !== '0';
const store = new GroundStore(bytes, { roads: flag('roads') !== '0', ...(portalClip ? {} : { portalClip: false }) } as never);
await store.init();
const [x, y] = toLocal(lng, lat), key = store.cellAt(x, y);
const keys = new Set<string>([key]);
for (const dx of [-radius, radius]) for (const dy of [-radius, radius]) keys.add(store.cellAt(x + dx, y + dy));
const cells: BuiltCell[] = [];
for (const k of keys) if (store.covers(k)) cells.push(buildCell(await store.cellInput(k, 0)));
const s = store.surface;
const cuts = s.cuts.filter((c: Cut) => c.x.some((cx, i) => Math.hypot(cx - x, c.y[i] - y) < radius));

/** Signed distance from the nearest walled edge (+ outside the strip), or NaN when no walled edge is within the band. */
const wallSide = (px: number, py: number): { d: number; inside: boolean; floor: number } | null => {
  let best: { d: number; inside: boolean; floor: number } | null = null;
  for (const c of cuts) {
    const h = locateCut(c, px, py);
    if (!h || h.s < 0 || h.s > c.s[c.s.length - 1]) continue;
    for (const [edge, wall, sg] of [[h.left, h.wallL, 1], [h.right, h.wallR, -1]] as const) {
      if (wall < 0.5) continue;
      const d = sg * h.lateral - edge; // + outside
      if (Math.abs(d) <= WALL_BAND_M && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, inside: insideCut(c, h), floor: h.floor };
    }
  }
  return best;
};

const SKIP = new Set<GroundLayer>(['kerb', 'paint', 'deckBody', 'bollard', 'furniture', 'hedge', 'track', 'ballast', 'water']);
const rows: Record<string, { tris: number; straddle: number; straddleM2: number; reachMax: number; off: number; devs: number[] }> = {};
for (const c of cells) for (const [layer, m] of Object.entries(c.layers) as [GroundLayer, NonNullable<BuiltCell['layers'][GroundLayer]>][]) {
  if (SKIP.has(layer) || !m) continue;
  const p = m.positions, idx = m.indices;
  const row = rows[layer] ?? (rows[layer] = { tris: 0, straddle: 0, straddleM2: 0, reachMax: 0, off: 0, devs: [] });
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const cx = (p[v[0]] + p[v[1]] + p[v[2]]) / 3, cy = (p[v[0] + 1] + p[v[1] + 1] + p[v[2] + 1]) / 3;
    if (Math.hypot(cx - x, cy - y) > radius) continue;
    const sides = v.map(a => wallSide(p[a], p[a + 1]));
    if (!sides.some(Boolean)) continue;
    row.tris++;
    const zs = v.map(a => p[a + 2]);
    const span = Math.max(...zs) - Math.min(...zs);
    const ins = sides.filter(q => q && q.inside).length, outs = sides.filter(q => q && !q.inside).length;
    if (ins && outs && span > SPAN_M) {
      row.straddle++;
      const [a, b, k] = v, ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], wx = p[k] - p[a], wy = p[k + 1] - p[a + 1];
      row.straddleM2 += Math.abs(ux * wy - uy * wx) / 2;
      row.reachMax = Math.max(row.reachMax, ...sides.map(q => q ? Math.abs(q.d) : 0));
    }
    v.forEach((a, j) => {
      const q = sides[j];
      if (!q) return;
      const want = q.inside ? q.floor : s.ground(p[a], p[a + 1]);
      const dev = Math.abs(p[a + 2] - want);
      row.devs.push(dev);
      if (dev > SPAN_M) row.off++;
    });
  }
}
const table = Object.entries(rows).filter(([, r]) => r.tris).map(([layer, r]) => {
  const d = [...r.devs].sort((a, b) => a - b);
  return { layer, tris: r.tris, straddle: r.straddle, straddleM2: +r.straddleM2.toFixed(1), reachMaxM: +r.reachMax.toFixed(2), offVerts: r.off, devMean: +(d.reduce((s_, v) => s_ + v, 0) / Math.max(1, d.length)).toFixed(3), devP95: +(d[Math.floor(d.length * 0.95)] ?? 0).toFixed(3) };
});
console.table(table);
const tot = table.reduce((t, r) => ({ straddle: t.straddle + r.straddle, straddleM2: t.straddleM2 + r.straddleM2, offVerts: t.offVerts + r.offVerts }), { straddle: 0, straddleM2: 0, offVerts: 0 });
console.log(JSON.stringify({ at: [lng, lat], radius, portalClip, cuts: cuts.map(c => c.id), cells: cells.map(c => c.key), total: { ...tot, straddleM2: +tot.straddleM2.toFixed(1) } }));
