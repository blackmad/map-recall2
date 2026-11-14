// Lane F1b (2026-11-14, Lelylaan 07ec0473): the ground drawn under way decks' hole ranges (DeckProfile.under) against
// the relief. Per deck, per layer: vertices of ground surfaces (off every deck-level survey polygon and every other deck)
// standing more than 0.5 m over the relief. City-wide over the cells holding a hole range, or one cell.
//
//   node --import tsx scripts/own-ground/probe-hole-streets.ts [--at=lng,lat | --cells=k,k] [--opts='{"holeStreets":false}'] [--list] [--top=N]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { GroundSurface } from '../../src/canalRecall/ownGround/surface.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const st = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: true, ...JSON.parse(flag('opts') ?? '{}') });
await st.init();
const keys: string[] = [];
if (flag('cells')) keys.push(...flag('cells')!.split(','));
else if (flag('at')) { const [lng, lat] = flag('at')!.split(',').map(Number), [x, y] = toLocal(lng, lat); keys.push(st.cellAt(x, y)); }
else { for (const k of [...st.osmCells].filter(k => st.covers(k)).sort()) await st.prepareCell(k); for (const d of st.surface.decks) if (d.profile.under) { const p = d.profile; for (const [a, b] of p.under!) { const i = p.s.findIndex(v => v >= (a + b) / 2); const k = st.cellAt(p.x[i], p.y[i]); if (!keys.includes(k)) keys.push(k); } } }
const layers = (flag('layers') ?? 'cycle,asphalt,paving,klinker,brick,square,land,park').split(',');
const total: Record<string, { n: number; high: number }> = {};
let worst: string[] = [];
for (const key of keys) {
  await st.prepareCell(key);
  const input = await st.cellInput(key, 0);
  const cell = buildCell(input);
  const index = new RoadIndex([input.roads ?? null, ...(input.roadsAround ?? [])]);
  const [rx0, ry0, rx1, ry1] = input.rect;
  const decks = st.surface.decks.filter(d => d.profile.under && d.profile.bbox[2] >= rx0 - 3 && d.profile.bbox[0] <= rx1 + 3 && d.profile.bbox[3] >= ry0 - 3 && d.profile.bbox[1] <= ry1 + 3);
  for (const d of decks) {
    const p = d.profile;
    const out: Record<string, { n: number; high: number; max: number }> = {};
    for (const L of layers) {
      const m = cell.layers[L as keyof typeof cell.layers];
      if (!m) continue;
      const pos = m.positions;
      for (let i = 0; i < pos.length; i += 3) {
        const vx = pos[i], vy = pos[i + 1], vz = pos[i + 2];
        const [bx0, by0, bx1, by1] = p.bbox;
        if (vx < bx0 - 3 || vx > bx1 + 3 || vy < by0 - 3 || vy > by1 + 3) continue;
        const at = GroundSurface.locate(d, vx, vy);
        if (!p.under!.some(([a, b]) => at.s >= a && at.s <= b)) continue;
        if (at.lateral > at.halfWidth + 3) continue;
        // Ground streets only: off every deck-level survey polygon by 0.3 m (their own vertices lie on the outline).
        if (L !== 'land' && L !== 'park' && [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].some(([ox, oy]) => index.onDeck(vx + ox, vy + oy))) continue;
        if (st.surface.decks.some(q => q !== d && !q.profile.under && GroundSurface.locate(q, vx, vy).d <= GroundSurface.locate(q, vx, vy).halfWidth + 1)) continue;
        const g = st.surface.ground(vx, vy), dz = vz - g;
        if (dz > 0.5 && process.argv.includes('--list')) console.log(L, vx.toFixed(1), vy.toFixed(1), 's', at.s.toFixed(1), 'lat', at.lateral.toFixed(1), '/', at.halfWidth.toFixed(1), 'dz', dz.toFixed(2));
        const o = (out[L] ??= { n: 0, high: 0, max: 0 });
        o.n++; if (dz > 0.5) o.high++; o.max = Math.max(o.max, dz);
        const t = (total[L] ??= { n: 0, high: 0 }); t.n++; if (dz > 0.5) t.high++;
      }
    }
    const hi = Object.values(out).reduce((a, v) => a + v.high, 0);
    if (hi) worst.push(`${hi} ${p.id} ${key} ${JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { n: v.n, over05: v.high, max: +v.max.toFixed(2) }])))}`);
  }
}
worst = worst.sort((a, b) => parseInt(b) - parseInt(a));
for (const w of worst.slice(0, Number(flag('top') ?? 15))) console.log(w);
console.log(JSON.stringify({ cells: keys.length, decksWithHigh: worst.length, total }));
