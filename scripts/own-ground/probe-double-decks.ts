// Bridges drawn twice: a deck (measured, way deck or flat footprint) whose span lies beside another deck's within a few
// metres (user 2026-10-16, a Prinsengracht bridge drawn as two parallel decks with road floating between).
//   npx tsx scripts/own-ground/probe-double-decks.ts [--box=W,S,E,N] [--near=12]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import type { Vec2 } from '../../src/canalRecall/ownGround/surface.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const [W, S, E, N] = (flag('box') ?? '-180,-90,180,90').split(',').map(Number);
const NEAR = Number(flag('near') ?? 12);
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
interface Span { id: string; kind: string; name: string; pts: Vec2[] }
const spans = new Map<string, Span>();
for (const k of [...store.osmCells].sort()) {
  const [x0, y0, x1, y1] = store.cellRect(k), [lng, lat] = fromLocal((x0 + x1) / 2, (y0 + y1) / 2);
  if (lng < W - 0.01 || lng > E + 0.01 || lat < S - 0.01 || lat > N + 0.01) continue;
  await store.prepareCell(k);
  for (const d of store.decks(k)) {
    const p = d.profile; if (spans.has(p.id)) continue;
    const pts: Vec2[] = [];
    for (let i = 0; i < p.x.length; i++) if (p.s[i] >= p.deck[0] && p.s[i] <= p.deck[1]) pts.push([p.x[i], p.y[i]]);
    spans.set(p.id, { id: p.id, kind: p.family === 'way-deck' ? 'way' : 'measured', name: p.name, pts });
  }
  const meta = store.flatDeckMeta(k);
  store.flatDecks(k).forEach((ring, i) => { const id = `${meta[i]?.id}#${k}#${i}`; spans.set(id, { id, kind: 'flat', name: '', pts: ring }); });
}
const list = [...spans.values()].filter(s => s.pts.length);
const segDist = (p: Vec2, pts: Vec2[]) => {
  if (pts.length === 1) return Math.hypot(pts[0][0] - p[0], pts[0][1] - p[1]);
  let b = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], c = pts[i + 1], dx = c[0] - a[0], dy = c[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1e-9)));
    b = Math.min(b, Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]));
  }
  return b;
};
const mid = (s: Span): Vec2 => s.kind === 'flat' ? [s.pts.reduce((a, q) => a + q[0], 0) / s.pts.length, s.pts.reduce((a, q) => a + q[1], 0) / s.pts.length] : s.pts[s.pts.length >> 1];
const inBox = (p: Vec2) => { const [lng, lat] = fromLocal(p[0], p[1]); return lng >= W && lng <= E && lat >= S && lat <= N; };
let pairs = 0;
for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
  const a = list[i], b = list[j];
  if (a.kind === 'flat' && b.kind === 'flat') continue;
  const ma = mid(a), mb = mid(b);
  if (!inBox(ma) || Math.hypot(ma[0] - mb[0], ma[1] - mb[1]) > 40) continue;
  const d = Math.min(segDist(ma, b.kind === 'flat' ? [...b.pts, b.pts[0]] : b.pts), segDist(mb, a.kind === 'flat' ? [...a.pts, a.pts[0]] : a.pts));
  if (d > NEAR) continue;
  pairs++;
  const ll = fromLocal(ma[0], ma[1]);
  console.log(`${a.kind} ${a.id} ${JSON.stringify(a.name)} + ${b.kind} ${b.id} ${JSON.stringify(b.name)} d=${d.toFixed(1)}m at ${ll[0].toFixed(5)},${ll[1].toFixed(5)}`);
}
console.log(`${list.length} decks, ${pairs} pairs within ${NEAR} m`);
