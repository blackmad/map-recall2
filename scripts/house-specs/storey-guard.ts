/**
 * Storey guard report (lane WG, docs/house-line.md §1 "Storey fit with a souterrain and a roof storey"): per pand, the
 * storey plan the generic mesher made for its stated count (houseSpec/storeyPlan.ts storeyPlanProbe) and the street run it
 * drew (threeBuildingMesh.ts layoutProbe). The rejected pands are the publish veto list and the second-read queue.
 *
 *   HOUSE_SPECS_DIR=staging/house-specs node --import tsx scripts/house-specs/storey-guard.ts <pandId,...|--ids-file f> --out <file.json>
 *
 * Built through house:preview's PreviewSession and the game's chunk builder, as D1's pixel-probe.ts.
 */
import '../world/useBrowserMath.ts';
import fs from 'node:fs';
import { PreviewSession, ROW_M } from '../house-preview/preview.ts';
import type { Feature } from '../world/pipeline.ts';
import { shellProfiles, shellStreets } from '../world/shellBake.ts';
import { buildFeatureChunk, asPolygons } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { layoutProbe } from '../../src/canalRecall/threeBuildingMesh.ts';
import { EAVES_OVER_WALL_M, storeyPlanProbe, storeyGuardOn, type StoreyPlan, type StoreyPlanInput } from '../../src/canalRecall/houseSpec/storeyPlan.ts';
import { BuildingContextIndex } from '../../src/canalRecall/buildingContextIndex.ts';
import { KIT_HIDE_IDS } from '../../src/canalRecall/landmarkKits.ts';
import { REPO_ROOT } from '../house-preview/nodeDom.ts';

const argv = process.argv.slice(2);
const flag = (n: string) => { const i = argv.indexOf(n); return i < 0 ? undefined : argv[i + 1]; };
const idsFile = flag('--ids-file');
const pands = (idsFile ? fs.readFileSync(idsFile, 'utf8') : argv.find(a => /^\d{16}(,\d{16})*$/.test(a)) ?? '').split(/[\s,]+/).filter(s => /^\d{16}$/.test(s));
const out = flag('--out');
if (!pands.length || !out) { console.error('storey-guard.ts <pandId,...> | --ids-file <file> --out <file.json>'); process.exit(2); }

/**
 * Why a count was rejected (the integrator's split, 2026-11-13): (c) 3DBAG's eaves lay outside the window, so the wall top
 * was the line; (a) too tall, no roof storey read, and one more row (a roof storey in the wall) would be in range;
 * eavesAboveDrawnWall: (c) with 3DBAG's eaves over 1 m above the drawn wall (kept a reject, filed as a mesher height item);
 * (d) the rest: the row count is plausibly wrong (too short, or too tall even with a tall ground and a roof row).
 * (b), a tall ground row, is not a reject: the retry draws it (`tallGround`).
 */
function causeOf(plan: StoreyPlan, input: StoreyPlanInput): 'a' | 'c' | 'd' | 'eavesAboveDrawnWall' | null {
  if (plan.ok) return null;
  // 3DBAG's eaves over 1 m above the wall the mesher draws: a mesher-vs-3DBAG height item, not a second read (integrator).
  if (plan.eavesIgnored && (input.eavesM ?? 0) > input.wallM + EAVES_OVER_WALL_M) return 'eavesAboveDrawnWall';
  if (plan.eavesIgnored) return 'c';
  const s = input.souterrain ? 0.58 : 0, withRoof = input.wallM / (Math.floor(input.storeys) + s + 1);
  if (!input.roofStorey && plan.pitchM > plan.range.max && withRoof >= plan.range.min && withRoof <= plan.range.max) return 'a';
  return 'd';
}
const boxOf = (f: Feature): [number, number, number, number] => {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of asPolygons(f.geometry).flat(2)) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  return b;
};
const full = (id: string) => `NL.IMBAG.Pand.${id}`;
const session = new PreviewSession('photo');
const profiles = shellProfiles(REPO_ROOT);
const kitHide = new Set(KIT_HIDE_IDS);
type Run = { storeys: number; groundM: number; storeyM: number; bays: number; street: boolean; lengthM: number; base: number };
const rows: Record<string, unknown>[] = [];
for (const id of pands) {
  const tileRows = await session.rows(session.tileOf(id));
  const raw = tileRows.find(r => r.raw.properties.id === full(id));
  if (!raw) { rows.push({ pandId: id, error: 'not drawn by the generic path' }); continue; }
  const own = raw.styled, ownBox = boxOf(own);
  const rowLng = ROW_M / (111_320 * Math.cos(52.37 * Math.PI / 180)), rowLat = ROW_M / 110_540;
  const near = (f: Feature) => { const q = boxOf(f); return q[0] <= ownBox[2] + rowLng && q[2] >= ownBox[0] - rowLng && q[1] <= ownBox[3] + rowLat && q[3] >= ownBox[1] - rowLat; };
  const features = tileRows.map(r => r.styled).filter(f => !kitHide.has(String(f.properties.id)) && near(f));
  const inChunk = new Set(features);
  const ctx = new BuildingContextIndex(tileRows.map(r => r.styled), boxOf);
  const context = ctx.neighbors(features, f => inChunk.has(f) || kitHide.has(String(f.properties.id)));
  const runs: Run[] = [], plans: { plan: StoreyPlan; input: StoreyPlanInput }[] = [];
  layoutProbe.sink = (bid, r) => { if (bid === own.properties.id) runs.push(r); };
  storeyPlanProbe.sink = (bid, plan, input) => { if (bid === own.properties.id) plans.push({ plan, input }); };
  try { buildFeatureChunk(features as never, 'photo', 'walls', shellStreets(REPO_ROOT, features as never), profiles, context as never, [], new Map(), {}); }
  finally { layoutProbe.sink = undefined; storeyPlanProbe.sink = undefined; }
  const run = runs.filter(r => r.street && r.base < 0.5).sort((a, b) => b.lengthM - a.lengthM)[0];
  // the plan of the longest ground-level run (the probe sees one plan per run with a stated count)
  const plan = plans.filter(p => p.input.wallM > 0).sort((a, b) => b.input.wallM - a.input.wallM)[0];
  const p = own.properties as Record<string, unknown>, sr = p.specRecipe as Record<string, unknown> | undefined;
  rows.push({
    pandId: id, year: p.constructionYear ?? null,
    spec: sr ? { storeys: sr.storeys ?? null, souterrain: sr.souterrain ?? null, roofStorey: sr.roofStorey ?? null, corniceCrown: sr.corniceCrown ?? null, eavesM: sr.eavesM ?? null, period: sr.period ?? null } : null,
    plan: plan ? { wallM: +plan.input.wallM.toFixed(2), eavesM: plan.input.eavesM ?? null, pitchM: +plan.plan.pitchM.toFixed(2), souterrainM: +plan.plan.souterrainM.toFixed(2), roofRow: plan.plan.roofRow, lineFrom: plan.plan.lineFrom, range: [plan.plan.range.min, plan.plan.range.max], ok: plan.plan.ok, tallGround: plan.plan.tallGround ? +plan.plan.tallGround.groundM.toFixed(2) : null, capped: plan.plan.capped ?? false, lineM: +plan.plan.lineM.toFixed(2), cause: causeOf(plan.plan, plan.input) } : null,
    drawn: run ? { storeys: run.storeys + 1, columns: run.bays, groundM: +run.groundM.toFixed(2), storeyM: +run.storeyM.toFixed(2), wallM: +(run.groundM + run.storeys * run.storeyM).toFixed(2) } : null,
  });
}
const planOf = (r: Record<string, unknown>) => r.plan as { ok?: boolean; cause?: string | null; tallGround?: number | null } | null;
const rejected = rows.filter(r => planOf(r)?.ok === false).map(r => r.pandId);
// second reads: every reject but the mesher-height items
const causes = Object.fromEntries(['a', 'c', 'd', 'eavesAboveDrawnWall'].map(c => [c, rows.filter(r => planOf(r)?.cause === c).map(r => r.pandId)]));
const tallGround = rows.filter(r => planOf(r)?.tallGround && !(planOf(r) as { capped?: boolean }).capped).map(r => r.pandId);
const capped = rows.filter(r => (planOf(r) as { capped?: boolean } | null)?.capped).map(r => r.pandId);
fs.writeFileSync(out, JSON.stringify({ env: { HOUSE_SPECS_DIR: process.env.HOUSE_SPECS_DIR ?? null, STOREY_GUARD: storeyGuardOn() }, pands: rows.length, withPlan: rows.filter(r => r.plan).length, rejected, secondRead: rows.filter(r => planOf(r)?.ok === false && planOf(r)?.cause !== 'eavesAboveDrawnWall').map(r => r.pandId), causes, tallGroundRescued: tallGround, cornicedCapped: capped, rows }, null, 1) + '\n');
console.log(`storey-guard: ${rows.length} pands, ${rows.filter(r => r.plan).length} with a plan, ${rejected.length} rejected (a ${causes.a.length}, c ${causes.c.length}, d ${causes.d.length}, eavesAboveDrawnWall ${causes.eavesAboveDrawnWall.length}), ${tallGround.length} rescued by a tall ground, ${capped.length} capped under a cornice/mansard -> ${out}`);
