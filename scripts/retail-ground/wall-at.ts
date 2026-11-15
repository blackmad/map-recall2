/**
 * Frames lists for retail fronts (round 7): house:frames skips a pose with no wall within 3 m of `at`, and an OSM shop
 * node often stands several metres inside its pand. This moves each entry's `at` to the nearest point of its pand's
 * outline when the node is more than WALL_M from it, and notes the move.
 *   node --import tsx scripts/retail-ground/wall-at.ts --in=<list.json> --out=<list.json>
 * Entries: { pandId, key, case, at: [lng, lat] }.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const WALL_M = 2.5, LAT0 = 52.37, KX = 111_320 * Math.cos(LAT0 * Math.PI / 180), KY = 110_540;
type Entry = { pandId: string; key: string; case: string; at: [number, number]; note?: string };
const list = JSON.parse(fs.readFileSync(arg('in')!, 'utf8')) as Entry[];
const want = new Set(list.map(e => e.pandId)), rings = new Map<string, [number, number][]>();
const root = 'public/data/extracts/amsterdam/building-tiles/14';
for (const x of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, x))) {
  const bytes = fs.readFileSync(path.join(root, x, f));
  for (const ft of JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString()).features) {
    const id = String(ft.properties.id).replace(/^NL\.IMBAG\.Pand\./, '');
    if (!want.has(id) || rings.has(id)) continue;
    const g = ft.geometry; rings.set(id, g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]);
  }
}
for (const e of list) {
  const ring = rings.get(e.pandId); if (!ring) { console.log(`${e.key}: pand ${e.pandId} not in the tiles`); continue; }
  let best = { d: Infinity, p: e.at };
  for (let i = 0; i + 1 < ring.length; i++) {
    const ax = (ring[i][0] - e.at[0]) * KX, ay = (ring[i][1] - e.at[1]) * KY, bx = (ring[i + 1][0] - e.at[0]) * KX, by = (ring[i + 1][1] - e.at[1]) * KY;
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l)) : 0, px = ax + dx * t, py = ay + dy * t, d = Math.hypot(px, py);
    if (d < best.d) best = { d, p: [+(e.at[0] + px / KX).toFixed(6), +(e.at[1] + py / KY).toFixed(6)] };
  }
  if (best.d > WALL_M) { e.note = `at moved ${best.d.toFixed(1)} m from the OSM node to the pand's outline (frames need a wall within 3 m)`; e.at = best.p as [number, number]; }
  console.log(`${e.key}: ${best.d.toFixed(1)} m${best.d > WALL_M ? ' (moved)' : ''}`);
}
fs.writeFileSync(arg('out')!, JSON.stringify(list, null, 1) + '\n');
