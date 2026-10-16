// The bridge ways near a measured deck and the deck's own axis (railings lane 2026-10-16: which streets cross its
// parapet lines, railingRuns.ts crossingWays).
//
//   npx tsx scripts/own-ground/probe-deck-ways.ts BRU0063 [radiusM=25]
//   npx tsx scripts/own-ground/probe-deck-ways.ts 4.864878,52.370101 [radiusM=25]   a flat footprint: the ways near it
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { isBridgeWay, prepareWays } from '../../src/canalRecall/ownGround/streets.ts';

const ROOT = 'public/data/extracts/amsterdam';
const [id, radius = '25'] = process.argv.slice(2);
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });

async function main(): Promise<void> {
  await store.init();
  const deck = store.surface.decks.find(d => d.profile.id === id), R = Number(radius);
  let cx: number, cy: number, ax = 1, ay = 0;
  if (deck) {
    const p = deck.profile, n = p.x.length, mid = n >> 1;
    cx = p.x[mid]; cy = p.y[mid]; ax = p.x[n - 1] - p.x[0]; ay = p.y[n - 1] - p.y[0];
    const al = Math.hypot(ax, ay);
    console.log(JSON.stringify({ id, family: p.family, span: deck.span, deck: p.deck, water: p.water, sides: p.sides, axis: [+(ax / al).toFixed(3), +(ay / al).toFixed(3)], halfWidthMid: p.halfWidth[mid] }));
  } else if (/^[\d.]+,[\d.]+$/.test(id)) [cx, cy] = toLocal(...(id.split(',').map(Number) as [number, number]));
  else throw new Error(`${id}: no measured deck (give lng,lat for a flat footprint)`);
  const al = Math.hypot(ax, ay);
  const key = store.cellAt(cx, cy);
  await store.prepareCell(key);
  const input = await store.cellInput(key, 0), seen = new Set<number>();
  input.flatDecks.forEach((ring, k) => { const c = ring.reduce((s, q) => [s[0] + q[0] / ring.length, s[1] + q[1] / ring.length], [0, 0]); if (Math.hypot(c[0] - cx, c[1] - cy) < R) console.log(JSON.stringify({ flat: input.flatDeckMeta?.[k] ?? null, vertices: ring.length })); });
  for (const e of [input.osm, ...input.osmAround]) if (e) for (const w of prepareWays(e.ways, input.project)) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    const near = w.points.some(q => Math.hypot(q[0] - cx, q[1] - cy) < R);
    if (!near) continue;
    const d = [w.points[w.points.length - 1][0] - w.points[0][0], w.points[w.points.length - 1][1] - w.points[0][1]], dl = Math.hypot(d[0], d[1]) || 1;
    const angle = Math.acos(Math.min(1, Math.abs(d[0] * ax + d[1] * ay) / (dl * al))) * 180 / Math.PI;
    console.log(JSON.stringify({ way: w.id, bridge: isBridgeWay(w), highway: w.tags.highway, half: w.section.halfWidth, angleToDeck: +angle.toFixed(0), points: w.points.length }));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
