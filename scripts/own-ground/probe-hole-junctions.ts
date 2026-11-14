// Lane f1b-jagged 2026-11-14: hole-deck junctions city-wide (bridge-feedback-pins.ts junctionSunk): per way deck with a
// hole range, road vertices within JUNCTION_M of the hole-side deck end sunk more than JUNCTION_SUNK_M under the deck,
// for the default, holeCarried off (main before this lane) and holeStreets off (before F1b).
//   node --import tsx scripts/own-ground/probe-hole-junctions.ts [--list]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { junctionSunk } from './bridge-feedback-pins.ts';
const read = async (path: string) => { const b = readFileSync(join('public/data/extracts/amsterdam', path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const variants = [['after', {}], ['main', { holeCarried: false }], ['preF1b', { holeStreets: false }]] as const;
const rows = new Map<string, Record<string, number | string>>();
for (const [name, opts] of variants) {
  const st = new GroundStore(read, { roads: true, ...opts }); await st.init();
  for (const k of [...st.osmCells].filter(k => st.covers(k)).sort()) await st.prepareCell(k);
  const built = new Map<string, { cell: ReturnType<typeof buildCell>; index: RoadIndex }>();
  for (const d of st.surface.decks.filter(q => q.profile.under)) {
    const p = d.profile, keys = new Set<string>();
    for (const [a, b] of p.under!) for (let i = 0; i < p.s.length; i++) if (p.s[i] >= a && p.s[i] <= b) keys.add(st.cellAt(p.x[i], p.y[i]));
    let n = 0;
    for (const key of keys) {
      let c = built.get(key);
      if (!c) { const input = await st.cellInput(key, 0); c = { cell: buildCell(input), index: new RoadIndex([input.roads ?? null, ...(input.roadsAround ?? [])]) }; built.set(key, c); }
      n += junctionSunk(st, c.cell, c.index, d).n;
    }
    const [lng, lat] = fromLocal(p.x[0], p.y[0]);
    const r = rows.get(p.id) ?? rows.set(p.id, { id: p.id, name: p.name, at: `${lng.toFixed(5)},${lat.toFixed(5)}` }).get(p.id)!;
    r[name] = n;
  }
}
const all = [...rows.values()];
if (process.argv.includes('--list')) for (const r of all) if (variants.some(([v]) => (r[v] as number) > 0)) console.log(JSON.stringify(r));
console.log(JSON.stringify({ holeDecks: all.length, ...Object.fromEntries(variants.map(([v]) => [`decksWithSunkJunction_${v}`, all.filter(r => (r[v] as number) > 0).length])), ...Object.fromEntries(variants.map(([v]) => [`vertices_${v}`, all.reduce((a, r) => a + ((r[v] as number) || 0), 0)])) }));
