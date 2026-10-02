import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { STOREFRONT_WALLS } from '../../src/canalRecall/storefrontWalls.generated.ts';
const want = new Set(Object.values(STOREFRONT_WALLS).map(w => w.pand)), rings = new Map<string, number[][]>();
const root = 'public/data/extracts/amsterdam/building-tiles/14';
for (const x of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, x))) {
  const b = fs.readFileSync(path.join(root, x, f));
  for (const ft of JSON.parse((b[0] === 0x1f ? zlib.gunzipSync(b) : b).toString()).features) {
    const id = String(ft.properties.id); if (!want.has(id) || rings.has(id)) continue;
    const g = ft.geometry; rings.set(id, g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]);
  }
}
const inside = (r: number[][], x: number, y: number) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const res: Record<string, string> = {};
for (const [slug, w] of Object.entries(STOREFRONT_WALLS)) {
  const r = rings.get(w.pand); if (!r) { res[slug] = 'nofoot'; continue; }
  const k = Math.cos(w.start[1] * Math.PI / 180) * 111320, ky = 110540;
  const dx = (w.end[0] - w.start[0]) * k, dy = (w.end[1] - w.start[1]) * ky, L = Math.hypot(dx, dy);
  const mx = (w.start[0] + w.end[0]) / 2, my = (w.start[1] + w.end[1]) / 2, ox = dy / L, oy = -dx / L; // outward = right of start->end
  const at = (d: number) => inside(r, mx + ox * d / k, my + oy * d / ky);
  res[slug] = !at(1.5) && at(-1.5) ? 'ok' : at(1.5) && !at(-1.5) ? 'reversed' : 'unclear';
}
const c: Record<string, number> = {}; for (const v of Object.values(res)) c[v] = (c[v] ?? 0) + 1;
console.log(c, Object.entries(res).filter(([s, v]) => v !== 'ok' && /troost|moshik|schiller/.test(s)));
fs.writeFileSync('tmp/storefronts/wallside.json', JSON.stringify(res));
// How far the footprint extends beyond the wall line, outward (0 = the wall is the footprint edge).
const bury: Record<string, number> = {};
for (const [slug, w] of Object.entries(STOREFRONT_WALLS)) {
  const r = rings.get(w.pand); if (!r) continue;
  const k = Math.cos(w.start[1] * Math.PI / 180) * 111320, ky = 110540;
  const dx = (w.end[0] - w.start[0]) * k, dy = (w.end[1] - w.start[1]) * ky, L = Math.hypot(dx, dy), ox = dy / L, oy = -dx / L;
  let worst = 0;
  for (const t of [0.2, 0.5, 0.8]) { const px = w.start[0] + (w.end[0] - w.start[0]) * t, py = w.start[1] + (w.end[1] - w.start[1]) * t; let d = 0; while (d < 8 && inside(r, px + ox * (d + 0.1) / k, py + oy * (d + 0.1) / ky)) d += 0.1; worst = Math.max(worst, d); }
  bury[slug] = Math.round(worst * 10) / 10;
}
const buried = Object.entries(bury).filter(([, d]) => d > 0.15).sort((a, b) => b[1] - a[1]);
console.log('buried', buried.length, buried.slice(0, 40));
fs.writeFileSync('tmp/storefronts/bury.json', JSON.stringify(bury));
