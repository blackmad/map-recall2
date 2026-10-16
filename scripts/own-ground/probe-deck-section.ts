// What the built ground draws along and across a measured deck (lane prinsengracht-bridge 2026-10-16): at stations along
// the axis (offset `--off` m to the left) or across it at `--at` (station s), every layer's hit, its z and whether the
// water mask cuts it, with the riding surface and the water level.
//   npx tsx scripts/own-ground/probe-deck-section.ts BRU0065 [--off=0] [--from=20 --to=30 --step=0.5] [--across --at=37]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, layersAt, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const store = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: process.env.ROADS !== '0' });
await store.init();
const id = process.argv[2];
for (const k of [...store.osmCells].sort()) await store.prepareCell(k);
const deck = store.surface.decks.find(d => d.profile.id === id);
if (!deck) throw new Error(`${id} not placed`);
const p = deck.profile, n = p.x.length;
const key = store.cellAt(p.x[n >> 1], p.y[n >> 1]);
const cells: BuiltCell[] = [];
for (const k of GroundStore.neighbours(key)) if (store.covers(k)) cells.push(buildCell(await store.cellInput(k, 0)));
const at = (s: number) => { let i = 0; while (i < n - 2 && p.s[i + 1] < s) i++; const t = (s - p.s[i]) / (p.s[i + 1] - p.s[i] || 1); const dx = p.x[i + 1] - p.x[i], dy = p.y[i + 1] - p.y[i], l = Math.hypot(dx, dy) || 1; return { x: p.x[i] + dx * t, y: p.y[i] + dy * t, nx: -dy / l, ny: dx / l }; };
const show = (label: string, x: number, y: number) => {
  const hits = cells.flatMap(c => layersAt(c, x, y).hits).map(h => `${h.layer}${h.cut ? '(cut)' : ''}@${h.z.toFixed(2)}`);
  console.log(`${label} ride=${store.surface.height(x, y).toFixed(2)} | ${hits.join(' ')}`);
};
console.log(`${id} deck=${p.deck.map(v => v.toFixed(1))} water=${p.water?.map(v => v.toFixed(1))} span=${deck.span.map(v => v.toFixed(1))}`);
if (process.argv.includes('--across')) {
  const s = Number(flag('at') ?? (p.deck[0] + p.deck[1]) / 2), c = at(s), w = Number(flag('w') ?? 10), step = Number(flag('step') ?? 0.5);
  for (let t = w; t >= -w - 1e-6; t -= step) show(`s=${s.toFixed(1)} t=${t.toFixed(1)}`, c.x + c.nx * t, c.y + c.ny * t);
} else {
  const off = Number(flag('off') ?? 0), from = Number(flag('from') ?? p.deck[0] - 5), to = Number(flag('to') ?? p.deck[1] + 5), step = Number(flag('step') ?? 0.5);
  for (let s = from; s <= to + 1e-6; s += step) { const c = at(s); show(`s=${s.toFixed(1)} t=${off}`, c.x + c.nx * off, c.y + c.ny * off); }
}
