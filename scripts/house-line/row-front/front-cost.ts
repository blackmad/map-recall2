// Lane 1: what one front costs the near tier. For each pand: its own walls + extras triangles, the chunk bytes those
// triangles take (every vertex and index array), and the build ("compile") time, median of --runs. Run it twice to A/B
// a change, e.g. ROW_FRONT_BOXES=0 (the grid) against the default (window units on the record's boxes).
//
//   ROW_FRONT=1 ROW_FRONT_RECORDS=... ROW_FRONT_INTERIM=... node --import tsx scripts/house-line/row-front/front-cost.ts \
//     0363100012167818 0363100012167817 [--runs 5] [--json out.json]
import '../../world/useBrowserMath.ts';
import fs from 'node:fs';
import { PreviewSession } from '../../house-preview/preview.ts';
import { shellStreets, shellProfiles } from '../../world/shellBake.ts';
import { buildFeatureChunk } from '../../../src/canalRecall/threeBuildingFeatures.ts';
import { BuildingContextIndex } from '../../../src/canalRecall/buildingContextIndex.ts';
import { asPolygons } from '../../../src/canalRecall/threeBuildingFeatures.ts';
import type { Feature } from '../../world/pipeline.ts';

const REPO_ROOT = new URL('../../../', import.meta.url).pathname;
const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
const runs = Number(opt('--runs') ?? 5), jsonOut = opt('--json');
const ids = argv.map(id => id.replace(/^NL\.IMBAG\.Pand\./, ''));

const boxOf = (f: Feature): [number, number, number, number] => {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of asPolygons(f.geometry).flat(2)) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  return b;
};
const bytesOf = (c: Record<string, unknown>) => Object.values(c).reduce<number>((s, v) => s + (ArrayBuffer.isView(v) ? v.byteLength : 0), 0);

const session = new PreviewSession('photo');
const out: Record<string, { triangles: number; bytes: number; ms: number }> = {};
for (const id of ids) {
  const rows = await session.rows(session.tileOf(id));
  const own = rows.find(r => r.raw.properties.id === `NL.IMBAG.Pand.${id}`)?.styled;
  if (!own) { console.log(`${id}: not in its tile`); continue; }
  const styled = rows.map(r => r.styled), ctx = new BuildingContextIndex(styled, boxOf);
  const context = ctx.neighbors([own], f => f.properties.id === own.properties.id);
  const streets = shellStreets(REPO_ROOT, [own] as never), profiles = shellProfiles(REPO_ROOT);
  const times: number[] = [];
  let tris = 0, bytes = 0;
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    const walls = buildFeatureChunk([own] as never, 'photo', 'walls', streets, profiles, context as never);
    const extras = buildFeatureChunk([own] as never, 'photo', 'extras', streets, profiles, context as never);
    times.push(performance.now() - t);
    tris = (walls.indices.length + extras.indices.length) / 3; bytes = bytesOf(walls) + bytesOf(extras);
  }
  times.sort((a, b) => a - b);
  out[id] = { triangles: tris, bytes, ms: +times[times.length >> 1].toFixed(2) };
  console.log(`${id}  ${tris} tris  ${(bytes / 1024).toFixed(1)} KiB  ${out[id].ms} ms`);
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out, null, 1));
