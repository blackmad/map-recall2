/**
 * `kind: large` recipes: compile intent + facts → GLB + gates (+ contact sheets), one or more houses.
 *
 *   node --import tsx scripts/building-recipes/large.ts --house=<id>[,<id>...] [--strict] [--no-render]
 *
 * Writes artifacts/building-recipes/<id>/{model.glb,fitted-recipe.json,report.json,contact-*.png}. Facts come from
 * `facts.ts --house=<id> --pand=<16 digits> --large`; walls to list in the intent from `walls.ts --house=<id>`.
 * The contact sheets show, per wall group with an entrance or of at least 6 m: the reference photo cited for that
 * group (`sources` in wall-group order, else the first source), the recipe front-on and 3/4; plus two aerial views.
 * Never installs into the game catalogues.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {canalhouseGroupToGlb} from '../canalhouse-recipes/export-glb.ts';
import {compileBuilding} from '../../src/canalRecall/buildingRecipe/compile.ts';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent.ts';
import {evaluateLargeGates} from '../../src/canalRecall/buildingRecipe/largeGates.ts';
import {openingsWithinWallsGate} from '../../src/canalRecall/buildingRecipe/roofChecks.ts';
import {trustFactsGround, type BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {sharedTerrain} from '../lib/terrainField.ts';
import type {CompiledLargeBuilding} from '../../src/canalRecall/buildingRecipe/largeCompile.ts';
import {bearingOfNormal} from '../../src/canalRecall/buildingRecipe/fitLarge.ts';
import {decodeTriangles} from './compile.ts';
import {closeRenderer, contactSheet, renderModels} from './render.ts';
import {houseLikeness, likenessRows, likenessSummary, type GroupLikeness} from './likeness-house.ts';
import {pandWallsDir} from './sourceData.ts';

const HOUSES = 'scripts/building-recipes/houses', ARTIFACTS = 'artifacts/building-recipes';
const readJson = async (file: string) => JSON.parse(await fs.readFile(file, 'utf8'));

export async function compileLargeHouse(id: string) {
  const t0 = performance.now();
  const intent = validateLargeIntent(await readJson(path.join(HOUSES, id, 'intent.json')));
  // On the trusted ground (bag3dCityJson.ts `pandGroundNap`): a facts.json built before the terrain rule is re-measured here.
  const facts: BuildingFacts = trustFactsGround(await readJson(path.join(HOUSES, id, 'facts.json')), sharedTerrain());
  const built = compileBuilding(intent, facts);
  const t1 = performance.now();
  const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  const tris = await decodeTriangles(glb.bytes);
  const {gates, topology} = evaluateLargeGates(tris, built);
  // Openings inside their walls and clear of the roof planes (roofChecks.ts, with the landmark pipeline's hard gate).
  gates.push(openingsWithinWallsGate(built.group, m => m.userData.materialSlot as string).gate);
  const out = path.join(ARTIFACTS, id);
  await fs.mkdir(out, {recursive: true});
  await fs.writeFile(path.join(out, 'model.glb'), glb.bytes);
  const r = built.recipe;
  await fs.writeFile(path.join(out, 'fitted-recipe.json'), JSON.stringify({kind: 'large', anchorRD: r.anchorRD, recessM: r.recessM, groups: r.groups, other: r.other, panelGroup: r.panelGroup, roofPlant: r.roofPlant, systems: r.spec.systems, palette: r.spec.palette}, null, 1) + '\n');
  const report = {id, kind: 'large', pandId: intent.pandId, anchorRD: built.anchorRD, fit: built.fit, components: built.components, compose: built.stats,
    // Blank panels of 8 m or more that touch a taller neighbour are genuine party walls: audit-glb-quality exempts these bearings from its blank-wall check.
    partyWallBearings: [...new Set(built.panels.filter(p => p.partyH > 0.5 && p.uMax - p.uMin >= 8 && r.panelGroup[p.index] < 0).map(p => Math.round(bearingOfNormal(p.n))))].sort((a, b) => a - b),
    triangles: glb.triangles, bytes: glb.bytes.length, materials: glb.materials, sha256: createHash('sha256').update(glb.bytes).digest('hex'),
    gates, topology: {components: topology.components, floating: topology.floating, openEdges: topology.openEdges, openEdgeLengthM: +topology.openEdgeLengthM.toFixed(2), openEdgeSamples: topology.openEdgeSamples},
    passed: gates.every(g => g.pass || g.advisory), timings: {fitCompileMs: +(t1 - t0).toFixed(1), exportGateMs: +(performance.now() - t1).toFixed(1)}};
  // Likeness to the archived photos (needs MAP_RECALL_SOURCE_DATA; a warning, not a gate: install-large decides).
  // Tints the intent measured (measure.ts --write): drawn as measured once the exporter marks them `tintSource: "measured"`.
  const measuredTints = new Set<string>();
  for (const gi of intent.measured?.groups ?? []) for (const c of [intent.walls[gi]?.palette?.brick, intent.walls[gi]?.palette?.glass]) if (c?.startsWith('#')) measuredTints.add(c.toLowerCase());
  const likeness = await houseLikeness(built, path.join(out, 'model.glb'), measuredTints);
  const withLikeness = {...report, likeness: likeness ? likenessSummary(likeness) : null};
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(withLikeness, null, 1) + '\n');
  return {report: withLikeness, built, intent, likeness};
}

/** Front-on and 3/4 views of a wall-group's main panel, plus two aerials. */
/** One-line likeness for a sheet header: per photographed group its verdict. */
export function likenessLine(likeness: GroupLikeness[] | null | undefined) {
  if (!likeness) return 'likeness: no archived photos (MAP_RECALL_SOURCE_DATA)';
  const m = likeness.filter(g => g.likeness);
  return m.length ? 'likeness ' + m.map(g => `g${g.group} ${g.likeness!.verdict}`).join(', ') : 'likeness: no photographed group';
}

export async function largeContactSheets(id: string, built: CompiledLargeBuilding, _intent: unknown, likeness?: GroupLikeness[] | null) {
  const file = path.join(ARTIFACTS, id, 'model.glb'), sheets: string[] = [], r = built.recipe;
  const top = Math.max(built.facts.heights.roofMaxM, 6), report = await readJson(path.join(ARTIFACTS, id, 'report.json'));
  const status = `${report.triangles} tris · ${report.passed ? 'gates pass' : 'GATE FAIL ' + report.gates.filter((g: any) => !g.pass).map((g: any) => g.id).join(', ')}`;
  const like = new Map((likeness ?? []).map(g => [g.group, g]));
  for (const g of r.groups) {
    const p = g.mainPanel === null ? undefined : built.panels[g.mainPanel];
    if (!p || (!g.entrance && g.widthM < 6)) continue;
    const u = (p.uMin + p.uMax) / 2, mid = [p.o[0] + p.r[0] * u, top / 2, p.o[2] + p.r[2] * u], W = Math.max(p.uMax - p.uMin, 8);
    const fov = 30, span = Math.max(W * 0.8, top) * 1.15, dist = span / 2 / Math.tan(fov * Math.PI / 360);
    const yaw = 35 * Math.PI / 180, rx = p.n[0] * Math.cos(yaw) - p.n[2] * Math.sin(yaw), rz = p.n[0] * Math.sin(yaw) + p.n[2] * Math.cos(yaw);
    const size = {width: 800, height: 560};
    const views = [
      {eye: [mid[0] + p.n[0] * dist, Math.max(1.7, top * 0.35), mid[2] + p.n[2] * dist], target: mid, fov, ...size},
      {eye: [mid[0] + rx * dist * 0.75, top * 0.8, mid[2] + rz * dist * 0.75], target: [mid[0], top * 0.4, mid[2]], fov: 40, ...size},
    ];
    const [front, three] = await renderModels([{file}], views);
    // The photo is the archived crop matched to this group's main panel (cropToPanel), not sources[g.index].
    const gl = like.get(g.index), crop = gl?.crop;
    const photo = crop ? await fs.readFile(path.join(pandWallsDir(r.pandId), crop.file)).catch(() => null) : null;
    const out = path.join(ARTIFACTS, id, `contact-walls-${g.index}.png`);
    const verdict = gl?.likeness ? `likeness ${gl.likeness.verdict}` : gl ? 'likeness: no matched photo' : 'likeness: not measured';
    const legacy = path.join(ARTIFACTS, id, `.views-${g.index}.png`);
    await contactSheet([
      {image: photo ?? await sharp({create: {width: 8, height: 6, channels: 3, background: '#dddddd'}}).png().toBuffer(), text: photo ? `reference ${crop!.capturedAt} ${crop!.tag} (panorama, CC BY 4.0)` : 'no matched reference photo'},
      {image: front, text: `walls[${g.index}] ${g.system} · ${g.storeys} st · ${g.bays} bays`}, {image: three, text: status}], gl?.likeness ? legacy : out, {width: 640, height: 448}, `${id} — walls[${g.index}] (${g.bearingDeg}°) — ${verdict} · ${status}`);
    if (gl?.likeness) {
      // Rows: photo | model elevation | overlay; swatches, numbers, verdict; the front and 3/4 views.
      const {row1, row2, width} = await likenessRows(gl, 640);
      const views = await sharp(legacy).toBuffer(), vm = await sharp(views).metadata(), r1 = await sharp(row1).metadata(), r2 = await sharp(row2).metadata();
      const W = Math.max(width, vm.width!), title = Buffer.from(`<svg width="${W}" height="40"><text x="10" y="27" font-family="Helvetica, Arial" font-size="22" font-weight="bold" fill="#1f2328">${`${id} — walls[${g.index}] (${g.bearingDeg}°) — ${verdict} · ${status}`.replace(/&/g, '&amp;')}</text></svg>`);
      await sharp({create: {width: W, height: 40 + r1.height! + 8 + r2.height! + 8 + vm.height!, channels: 3, background: '#f4f4f2'}})
        .composite([{input: title, left: 0, top: 0}, {input: row1, left: 0, top: 40}, {input: row2, left: 0, top: 48 + r1.height!}, {input: views, left: 0, top: 56 + r1.height! + r2.height!}]).png().toFile(out);
      await fs.rm(legacy, {force: true});
    }
    sheets.push(out);
  }
  // Aerials from the footprint centre, two opposite corners.
  const xs = r.set.ground.flatMap(s => s.rings.flat().map(p => p[0])), zs = r.set.ground.flatMap(s => s.rings.flat().map(p => p[2]));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2, ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), top);
  const d = ext * 1.6, size = {width: 800, height: 600};
  const aerial = await renderModels([{file}], [[1, 1], [-1, -1]].map(([sx, sz]) => ({eye: [cx + sx * d * 0.7, top + d * 0.55, cz + sz * d * 0.7], target: [cx, top * 0.35, cz], fov: 35, ...size})));
  const out = path.join(ARTIFACTS, id, 'contact-aerial.png');
  await contactSheet([{image: aerial[0], text: 'aerial from south-east'}, {image: aerial[1], text: 'aerial from north-west'}], out, {width: 640, height: 480}, `${id} — ${status} · ${likenessLine(likeness)}`);
  sheets.push(out);
  return sheets;
}

if (process.argv[1]?.endsWith('building-recipes/large.ts')) {
  const ids = (process.argv.find(a => a.startsWith('--house='))?.slice(8) ?? '').split(',').filter(Boolean);
  if (!ids.length) throw Error('Use --house=<id>[,<id>...]');
  let failed = false;
  try {
    for (const id of ids) {
      const {report, built, intent, likeness} = await compileLargeHouse(id);
      const bad = report.gates.filter(g => !g.pass);
      failed ||= bad.length > 0;
      console.log(`${id}: ${report.triangles} tris, ${report.bytes} B, ${(report.timings.fitCompileMs + report.timings.exportGateMs).toFixed(0)} ms, openings ${report.compose.recessed ?? 0} recessed / ${report.compose.proud ?? 0} flush, components ${JSON.stringify(report.components)}, gates ${bad.length ? 'FAIL ' + bad.map(g => `${g.id}=${JSON.stringify(g.value)}`).join('; ') : 'pass'}`);
      for (const w of report.fit.warnings) console.log(`  warn: ${w}`);
      console.log(`  ${likenessLine(likeness)}`);
      for (const g of likeness ?? []) if (g.likeness) { const L = g.likeness; console.log(`    walls[${g.group}] ${L.verdict}: wall ${L.wall.photo} vs ${L.wall.model} (dL ${L.wall.dL}), glazing ${L.glazing.photoMean} vs ${L.glazing.modelMean}, columns ${L.columns.photo} vs ${L.columns.model}, shape ${L.shape.photo} vs ${L.shape.model}, IoU ${L.iou}${L.reasons.length ? ' — ' + L.reasons.join('; ') : ''}`); }
      if (!process.argv.includes('--no-render')) for (const s of await largeContactSheets(id, built, intent, likeness)) console.log(`  ${s}`);
    }
  } finally { await closeRenderer(); }
  if (process.argv.includes('--strict') && failed) process.exit(1);
}
