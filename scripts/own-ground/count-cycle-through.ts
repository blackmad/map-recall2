// City-wide count of the red bands across junction mouths (cycleThrough.ts; lane road-look-continuity 2026-10-29).
//
//   npx tsx scripts/own-ground/count-cycle-through.ts [--json=out.json]
//
// Per streamed cell with the roads extract: the cell's input as the game builds it (its own ways drawn, the 3×3
// neighbourhood's ways linking the ends, the neighbourhood's road polygons), and cycleThrough's drawn / skipped runs.
// No meshes are kept, only the stats.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore } from '../../src/canalRecall/ownGround/groundStore.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { prepareWays } from '../../src/canalRecall/ownGround/streets.ts';
import { cycleThrough, emptyThroughStats } from '../../src/canalRecall/ownGround/cycleThrough.ts';
import { emptyMesh } from '../../src/canalRecall/ownGround/drape.ts';

async function main(): Promise<void> {
  const ROOT = 'public/data/extracts/amsterdam';
  const bytes = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
  const store = new GroundStore(bytes, { roads: true });
  await store.init();
  const total = emptyThroughStats(), perCell: Record<string, { drawn: number; skipped: number }> = {};
  let cells = 0;
  for (const key of [...store.osmCells].sort()) {
    if (!store.covers(key)) continue;
    const input = await store.cellInput(key, 0);
    if (!input.roads?.surfaces.length) continue;
    const own = new Set(prepareWays(input.osm?.ways ?? [], input.project).map(w => w.id));
    const seen = new Set<number>(), ways = [input.osm, ...input.osmAround].flatMap(o => (o ? prepareWays(o.ways, input.project) : [])).filter(w => !seen.has(w.id) && !!seen.add(w.id));
    const index = new RoadIndex([input.roads, ...(input.roadsAround ?? [])]);
    const s = cycleThrough(emptyMesh(), ways, w => own.has(w.id), index, () => 0);
    total.drawn += s.drawn; total.metres += s.metres;
    for (const k of Object.keys(total.skipped) as (keyof typeof total.skipped)[]) total.skipped[k] += s.skipped[k];
    perCell[key] = { drawn: s.drawn, skipped: s.skipped.long + s.skipped.bent + s.skipped.unbracketed };
    cells++;
  }
  const out = { cells, drawn: total.drawn, metres: Math.round(total.metres), skipped: total.skipped, perCell };
  console.log(JSON.stringify({ ...out, perCell: undefined }));
  const json = process.argv.find(a => a.startsWith('--json='))?.slice(7);
  if (json) writeFileSync(json, JSON.stringify(out, null, 1) + '\n');
}

main().catch(e => { console.error(e); process.exit(1); });
