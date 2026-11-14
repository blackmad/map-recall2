// House rows (lane R): byte-identity and cost of the row renderer. For each staged row (lane D's
// artifacts/house-rows/staging/<row>.json), every pand in the members' tiles: a sha256 over its walls, extras and coarse
// chunks (every typed array, in order), its triangles and bytes. Members are totalled per row (the cost report); the
// rest are the sample that must hash the same with and without the row records, and against main.
//
//   ROW_FRONT=0 node --import tsx scripts/house-line/row-front/row-hash.ts --rows a.json,b.json [--sample 40] --json out.json
//     (the flag-off world: rows draw by default since the round-1 install, so a flag-off hash sets ROW_FRONT=0)
//   ROW_FRONT=1 ROW_FRONT_RECORDS=a.json node --import tsx ... (the same, records installed)
//   node --import tsx scripts/house-line/row-front/row-hash.ts --compare a.json b.json   (sample ids that differ)
import '../../world/useBrowserMath.ts';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { PreviewSession } from '../../house-preview/preview.ts';
import { shellStreets, shellProfiles } from '../../world/shellBake.ts';
import { buildFeatureChunk, asPolygons } from '../../../src/canalRecall/threeBuildingFeatures.ts';
import { BuildingContextIndex } from '../../../src/canalRecall/buildingContextIndex.ts';
import type { Feature } from '../../world/pipeline.ts';

const REPO_ROOT = new URL('../../../', import.meta.url).pathname;
const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
type Out = { members: Record<string, Row>; sample: Record<string, Row>; rows: Record<string, { pands: number; triangles: number; bytes: number }> };
type Row = { hash: string; triangles: number; bytes: number };

const cmp = argv.indexOf('--compare');
if (cmp >= 0) {
  const [a, b] = [argv[cmp + 1], argv[cmp + 2]].map(f => JSON.parse(fs.readFileSync(f, 'utf8')) as Out);
  const ids = Object.keys(a.sample).filter(id => b.sample[id]);
  const diff = ids.filter(id => a.sample[id].hash !== b.sample[id].hash);
  console.log(`sample: ${ids.length} pands in both, ${diff.length} differ${diff.length ? `: ${diff.join(' ')}` : ''}`);
  for (const r of Object.keys(a.rows)) if (b.rows[r]) console.log(`${r}: ${a.rows[r].triangles} -> ${b.rows[r].triangles} tris, ${(a.rows[r].bytes / 1024).toFixed(1)} -> ${(b.rows[r].bytes / 1024).toFixed(1)} KiB`);
  process.exit(diff.length ? 1 : 0);
}

const boxOf = (f: Feature): [number, number, number, number] => {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of asPolygons(f.geometry).flat(2)) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  return b;
};
const short = (id: unknown) => String(id).replace(/^NL\.IMBAG\.Pand\./, '');
const rowFiles = (opt('--rows') ?? '').split(',').filter(Boolean), sampleN = Number(opt('--sample') ?? 40);
const rows = rowFiles.map(f => JSON.parse(fs.readFileSync(f, 'utf8')).row as { id: string; members: Array<{ pandId: string }> });
const memberOf = new Map(rows.flatMap(r => r.members.map(m => [m.pandId, r.id] as const)));

const session = new PreviewSession('photo');
const profiles = shellProfiles(REPO_ROOT);
const out: Out = { members: {}, sample: {}, rows: {} };
const tiles = new Map<string, string>();
for (const id of memberOf.keys()) tiles.set(String(session.tileOf(id)), id);
for (const [, anyId] of tiles) {
  const tileRows = await session.rows(session.tileOf(anyId));
  const styled = tileRows.map(r => r.styled), ctx = new BuildingContextIndex(styled, boxOf);
  const own = styled.filter(f => memberOf.has(short(f.properties.id)));
  const rest = styled.filter(f => !memberOf.has(short(f.properties.id)) && !out.sample[short(f.properties.id)]);
  // The sample: the pands nearest the row first (they share its context), then the tile's others, to sampleN per tile.
  const c = own.length ? boxOf(own[0]) : [0, 0, 0, 0];
  const d = (f: Feature) => { const b = boxOf(f); return Math.hypot((b[0] + b[2]) / 2 - (c[0] + c[2]) / 2, (b[1] + b[3]) / 2 - (c[1] + c[3]) / 2); };
  const sample = rest.sort((a, b) => d(a) - d(b)).slice(0, sampleN);
  for (const f of [...own, ...sample]) {
    const id = short(f.properties.id);
    const context = ctx.neighbors([f], g => g.properties.id === f.properties.id);
    const streets = shellStreets(REPO_ROOT, [f] as never);
    const h = createHash('sha256');
    let triangles = 0, bytes = 0;
    for (const mode of ['walls', 'extras', 'coarse'] as const) {
      const ch = buildFeatureChunk([f] as never, 'photo', mode, streets, profiles, context as never) as unknown as Record<string, unknown> & { indices: { length: number } };
      triangles += ch.indices.length / 3;
      for (const [k, v] of Object.entries(ch).sort(([a], [b]) => a.localeCompare(b))) if (ArrayBuffer.isView(v)) { h.update(`${mode}:${k}`); h.update(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); bytes += v.byteLength; }
    }
    const rec = { hash: h.digest('hex').slice(0, 16), triangles, bytes };
    const row = memberOf.get(id);
    if (row) { out.members[id] = rec; const t = out.rows[row] ??= { pands: 0, triangles: 0, bytes: 0 }; t.pands++; t.triangles += triangles; t.bytes += bytes; }
    else out.sample[id] = rec;
  }
}
for (const [r, t] of Object.entries(out.rows)) console.log(`${r}: ${t.pands} pands, ${t.triangles} tris, ${(t.bytes / 1024).toFixed(1)} KiB (walls + extras + coarse)`);
console.log(`sample: ${Object.keys(out.sample).length} pands without a row record`);
const json = opt('--json');
if (json) fs.writeFileSync(json, JSON.stringify(out, null, 1));
