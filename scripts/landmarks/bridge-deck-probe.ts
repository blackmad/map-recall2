// Sample the game's ride surface over a bridge, for a bespoke bridge model that must keep the
// deck at the road-graph height (lane landmarks-bridges-20261101, #175).
//
//   npx tsx scripts/landmarks/bridge-deck-probe.ts --deck=BRU0236 --anchor=4.90086,52.36639 [--along=<deg>]
//
// Prints JSON: the deck's outline (measured or flat footprint) in metres east/north of the anchor,
// the anchor's landmark base (lowest relief in the ±3 m square the runtime stands a point model on:
// signature-landmarks-source.js _applyGroundBase → gameGround.pointBase(anchor, 3)), the water z, and the
// ride surface (GroundSurface.height) on a grid along/across the bridge axis. Scene z (NAP − 1.37).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { footprintAxis } from '../../src/canalRecall/ownGround/decks.ts';
import type { Vec2 } from '../../src/canalRecall/ownGround/surface.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ROOT = 'public/data/extracts/amsterdam';
const id = arg('deck');
const anchorArg = arg('anchor');
if (!id || !anchorArg) { console.error('--deck=<BRU id> --anchor=<lng,lat> required'); process.exit(2); }
const [alng, alat] = anchorArg.split(',').map(Number);
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
const [ax, ay] = toLocal(alng, alat);
let ring: Vec2[] | null = null, kind = '', spine: { s: number; x: number; y: number; z: number; half: number }[] = [];
for (const k of [...store.osmCells]) {
  const [x0, y0, x1, y1] = store.cellRect(k);
  if (ax < x0 - 150 || ax > x1 + 150 || ay < y0 - 150 || ay > y1 + 150) continue;
  await store.prepareCell(k);
  for (const d of store.decks(k)) if (d.profile.id === id && !ring) {
    const p = d.profile;
    kind = 'measured';
    spine = [...p.s].map((s, i) => ({ s, x: p.x[i] - ax, y: p.y[i] - ay, z: d.z[i], half: p.halfWidth[i] }));
    const raw = JSON.parse(readFileSync(join(ROOT, 'elevation-v1/bridges.json'), 'utf8')).measured.find((b: { id: string }) => b.id === id);
    const q = (store as unknown as { elevation: { quantization: { xy: number } } }).elevation.quantization.xy;
    ring = [];
    for (let i = 0; i < raw.outline.length; i += 2) { const [x, y] = store.toScene(raw.outline[i] * q, raw.outline[i + 1] * q); ring.push([x - ax, y - ay]); }
  }
  const meta = store.flatDeckMeta(k);
  store.flatDecks(k).forEach((r, i) => { if (meta[i]?.id === id && !ring) { kind = 'flat'; ring = r.map(([x, y]) => [x - ax, y - ay] as Vec2); } });
}
if (!ring) { console.error(`deck ${id} not found near the anchor`); process.exit(1); }
const s = store.surface;
let base = Infinity;
for (const dx of [-3, 0, 3]) for (const dy of [-3, 0, 3]) base = Math.min(base, s.ground(ax + dx, ay + dy));
const axis = kind === 'flat' ? footprintAxis(ring) : null;
const along = Number(arg('along') ?? NaN);
const u: Vec2 = Number.isFinite(along) ? [Math.sin(along * Math.PI / 180), Math.cos(along * Math.PI / 180)] : axis ? axis.u : spine.length ? (() => { const a = spine[0], b = spine[spine.length - 1], L = Math.hypot(b.x - a.x, b.y - a.y); return [(b.x - a.x) / L, (b.y - a.y) / L] as Vec2; })() : [1, 0];
const n: Vec2 = [-u[1], u[0]];
const grid: { a: number; c: number; height: number; ground: number }[] = [];
for (let a = -50; a <= 50; a += 1) for (let c = -14; c <= 14; c += 2) {
  const x = ax + u[0] * a + n[0] * c, y = ay + u[1] * a + n[1] * c;
  grid.push({ a, c, height: +s.height(x, y).toFixed(3), ground: +s.ground(x, y).toFixed(3) });
}
console.log(JSON.stringify({ id, kind, anchor: [alng, alat], anchorLocal: [ax, ay], base: +base.toFixed(3), waterZ: +store.waterZ(ax, ay).toFixed(3), u, n, ring, spine, grid }));
