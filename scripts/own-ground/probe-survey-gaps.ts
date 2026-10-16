// roads-v1: land in the survey's gaps around junctions, where the band model (roads off) paved.
//
//   npx tsx scripts/own-ground/probe-survey-gaps.ts [cell,cell,…] [--radius 12] [--list 40]   # default: every roads-v1 cell
//
// For every junction node of the cell, a 1 m grid within the radius: points under no wegdeel polygon whose top is
// land with the survey on but a street surface with it off (a band, a node fill or a pocket paved it). Counted
// apart: points whose node itself lies in a survey gap (`gapNode`: the pocket pass must pave those) and points by
// a surveyed node (`surveyedNode`: a berm or tree pit the survey leaves, shown as land by design).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { junctionGeometry, prepareWays, resolvePriorSidewalks } from '../../src/canalRecall/ownGround/streets.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { STREET_TOPS, topAcross } from '../../src/canalRecall/ownGround/roadRegressions.ts';

const ROOT = 'public/data/extracts/amsterdam';
const readExtract = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const argOf = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const RADIUS = Number(argOf('--radius') ?? 12), LIST = Number(argOf('--list') ?? 40);

export interface GapResult { key: string; junctions: number; gapNodes: number; gapNodeLandM2: number; surveyedNodeLandM2: number; worst: { at: [number, number]; m2: number; gapNode: boolean }[] }

export async function surveyGaps(on: GroundStore, off: GroundStore, key: string, radius = RADIUS): Promise<GapResult> {
  const input = await on.cellInput(key, 0);
  const cellOn = buildCell(input), cellOff = buildCell(await off.cellInput(key, 0));
  const [x0, y0, x1, y1] = on.cellRect(key);
  const seen = new Set<number>();
  const ways = resolvePriorSidewalks([input.osm, ...input.osmAround].flatMap(e => (e ? prepareWays(e.ways, input.project) : [])).filter(w => !seen.has(w.id) && seen.add(w.id)));
  const index = new RoadIndex([input.roads, ...(input.roadsAround ?? [])]);
  const out: GapResult = { key, junctions: 0, gapNodes: 0, gapNodeLandM2: 0, surveyedNodeLandM2: 0, worst: [] };
  const counted = new Set<string>();
  for (const n of junctionGeometry(ways).values()) {
    if (n.kind !== 'junction') continue;
    const [x, y] = n.p;
    if (x < x0 + 1 || x >= x1 - 1 || y < y0 + 1 || y >= y1 - 1) continue;
    out.junctions++;
    const gapNode = index.find(x, y) < 0;
    if (gapNode) out.gapNodes++;
    let m2 = 0;
    for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const px = Math.round(x) + dx, py = Math.round(y) + dy, k = `${px},${py}`;
      if (counted.has(k) || px < x0 || px >= x1 || py < y0 || py >= y1 || index.find(px, py) >= 0) continue;
      if (topAcross([cellOn], px, py) !== 'land' || !STREET_TOPS.has(topAcross([cellOff], px, py) as never)) continue;
      counted.add(k); m2++;
    }
    if (gapNode) out.gapNodeLandM2 += m2; else out.surveyedNodeLandM2 += m2;
    if (m2) out.worst.push({ at: fromLocal(x, y).map(v => +v.toFixed(6)) as [number, number], m2, gapNode });
  }
  out.worst.sort((a, b) => b.m2 - a.m2);
  return out;
}

if (process.argv[1]?.endsWith('probe-survey-gaps.ts')) {
  const on = new GroundStore(readExtract, { roads: true }), off = new GroundStore(readExtract);
  await on.init(); await off.init();
  const keys = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2].split(',') : [...on.roadCells].sort();
  let gap = 0, surveyed = 0, gapNodes = 0;
  const worst: (GapResult['worst'][number] & { key: string })[] = [];
  for (const key of keys) {
    if (!on.covers(key)) continue;
    const r = await surveyGaps(on, off, key);
    gap += r.gapNodeLandM2; surveyed += r.surveyedNodeLandM2; gapNodes += r.gapNodes;
    worst.push(...r.worst.map(w => ({ ...w, key })));
    console.log(JSON.stringify({ ...r, worst: r.worst.slice(0, 3) }));
  }
  worst.sort((a, b) => b.m2 - a.m2);
  for (const w of worst.filter(q => q.gapNode).slice(0, LIST)) console.log(`  gap node ${w.key} ${w.at.join(',')}: ${w.m2} m² land the bands paved`);
  for (const w of worst.filter(q => !q.gapNode).slice(0, 10)) console.log(`  surveyed node ${w.key} ${w.at.join(',')}: ${w.m2} m²`);
  console.log(JSON.stringify({ cells: keys.length, gapNodes, gapNodeLandM2: gap, surveyedNodeLandM2: surveyed }));
}
