/**
 * City-wide roof attachment audit: runs every building tile through the game's decorator
 * chain (galleryPipeline.gameDecorator), builds each roofed building's roof exactly as the
 * mesh does, and measures it against the walls under it (src/canalRecall/roofAttachmentAudit.ts):
 * roof eaves off the wall top by > 0.3 m, an eave line hanging > 0.6 m past the wall outline,
 * and a pitched roof over a footprint that is mostly bare flat deck.
 *
 * Usage: tsx scripts/check-roof-attachment.ts [--json=out.json] [--verbose] [--limit-tiles=N]
 * Fails when a flag count exceeds its pinned ceiling in CEILINGS (lower them as the planner improves).
 * Not covered: roofs the street-appearance profiles substitute (sourceVisualRoof) and landmark kits.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gameDecorator, loadGameData, loadTile } from '../src/canalRecall/galleryPipeline.ts';
import { ORIGIN, meshBuildingFor } from '../src/canalRecall/threeBuildingFeatures.ts';
import { roofTrianglesForOutline } from '../src/canalRecall/roofMesh.ts';
import { roofAttachment, type AttachmentFlag, type AttachmentReport } from '../src/canalRecall/roofAttachmentAudit.ts';

const BASE = 'public/data/extracts/amsterdam';
/** Flagged-pand ceilings (2026-10-13: before the fix 54 / 5947 / 2783; the remaining hang and bare-deck are register-measured gable crowns, kept). Flagged-pand ceilings. A regression past these fails the check; improve the planner, then lower them. */
const CEILINGS: Record<AttachmentFlag, number> = { vertical: 75, hang: 390, 'bare-deck': 410 };

const args = process.argv.slice(2);
const flag = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const verbose = args.includes('--verbose');

const fetchImpl: typeof fetch = (async (url: string) => {
  const path = String(url).replace(/^.*?amsterdam\//, `${BASE}/`).replace(/^\.\.\/data\/extracts\/amsterdam/, BASE);
  return existsSync(path) ? new Response(readFileSync(path)) : new Response(null, { status: 404 });
}) as typeof fetch;

const data = await loadGameData(BASE, fetchImpl);
const decorate = gameDecorator({ gables: data.gables, landmarkIds: data.landmarkIds, listed: data.listed });
const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180);

const tiles: string[] = [];
for (const x of readdirSync(`${BASE}/building-tiles/14`)) for (const f of readdirSync(`${BASE}/building-tiles/14/${x}`)) tiles.push(`${x}/${f.replace('.geojson.gz', '')}`);
const limit = Number(flag('limit-tiles') ?? Infinity);

type Row = AttachmentReport & { measured: boolean; id: string; style: string; kind: string; tile: string; pieces: number; lid: boolean; wallTopM: number; areaM2: number };
const rows: Row[] = [];
let pands = 0, roofed = 0;
for (const key of tiles.slice(0, limit)) {
  const features = await loadTile(key, BASE, fetchImpl);
  for (const feature of features) {
    pands++;
    const d = decorate(feature);
    if (!d.properties.roofPlanned) continue;
    const b = meshBuildingFor(d, 'photo');
    if (!b?.roof) continue;
    roofed++;
    const outer = b.polygons[0]?.[0];
    if (!outer || outer.length < 4) continue;
    const tris = roofTrianglesForOutline(outer, ORIGIN, b.roof.plan, b.heightM, b.roof.dims, kx);
    if (!tris.length) continue;
    const ring = outer.slice(0, -1).map(([lng, lat]) => [(lng - ORIGIN.lng) * kx, (lat - ORIGIN.lat) * 110_540] as [number, number]);
    const lid = !!b.lid && (!tris.length || !!b.roof.plan.keepLid);
    const report = roofAttachment(ring, tris, b.heightM, lid);
    rows.push({ ...report, measured: typeof d.properties.monumentGable === 'string', id: String(d.properties.id), style: String(d.properties.facadeStyle ?? ''), kind: b.roof.plan.kind, tile: key, pieces: b.roof.plan.pieces?.length ?? 0, lid, wallTopM: b.heightM, areaM2: 0 });
  }
}

const count = (f: AttachmentFlag, subset: Row[] = rows) => subset.filter(r => r.flags.includes(f)).length;
const flagged = rows.filter(r => r.flags.length);
const lines: string[] = [];
lines.push(`tiles ${Math.min(tiles.length, limit)}  pands ${pands}  roofed ${roofed}  measured ${rows.length}`);
lines.push(`flagged any ${flagged.length}  vertical ${count('vertical')}  hang ${count('hang')}  bare-deck ${count('bare-deck')}`);
const byKind = new Map<string, Row[]>();
for (const r of rows) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r]);
for (const [kind, list] of [...byKind].sort((a, b) => b[1].length - a[1].length)) {
  lines.push(`  ${kind.padEnd(11)} n ${String(list.length).padStart(6)}  hang ${String(count('hang', list)).padStart(5)}  bare-deck ${String(count('bare-deck', list)).padStart(5)}  vertical ${count('vertical', list)}`);
}
const pieceSplit = (n: number) => rows.filter(r => r.pieces === n);
const bare = rows.filter(r => r.flags.includes('bare-deck'));
lines.push(`  bare-deck on a register-measured gable (kept as is): ${bare.filter(r => r.measured).length}, generated roofs: ${bare.filter(r => !r.measured).length}`);
lines.push(`  by plan: simple-box ${pieceSplit(1).length} (hang ${count('hang', pieceSplit(1))}), pieces2 ${pieceSplit(2).length} (hang ${count('hang', pieceSplit(2))}, bare ${count('bare-deck', pieceSplit(2))}), no pieces ${pieceSplit(0).length}`);
if (verbose) for (const r of [...flagged].sort((a, b) => b.hangM - a.hangM || b.bareDeckShare - a.bareDeckShare).slice(0, 25)) {
  lines.push(`  ${r.id.slice(-16)} ${r.tile} ${r.style}/${r.kind} gap ${r.verticalGapM.toFixed(2)} hang ${r.hangM.toFixed(2)} (${(r.hangAreaShare * 100).toFixed(0)}% area) bare ${(r.bareDeckShare * 100).toFixed(0)}% ${r.bareDeckM2.toFixed(0)} m2 [${r.flags.join(',')}]`);
}
console.log(lines.join('\n'));
const jsonPath = flag('json');
if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ pands, roofed, rows: flagged }, null, 1));

let failed = false;
for (const f of Object.keys(CEILINGS) as AttachmentFlag[]) {
  if (limit === Infinity && count(f) > CEILINGS[f]) { console.error(`FAIL ${f}: ${count(f)} > ceiling ${CEILINGS[f]}`); failed = true; }
}
if (failed) process.exit(1);
