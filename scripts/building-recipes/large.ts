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
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';
import type {CompiledLargeBuilding} from '../../src/canalRecall/buildingRecipe/largeCompile.ts';
import {bearingOfNormal} from '../../src/canalRecall/buildingRecipe/fitLarge.ts';
import {decodeTriangles} from './compile.ts';
import {closeRenderer, contactSheet, renderModels} from './render.ts';

const HOUSES = 'scripts/building-recipes/houses', ARTIFACTS = 'artifacts/building-recipes';
const readJson = async (file: string) => JSON.parse(await fs.readFile(file, 'utf8'));

export async function compileLargeHouse(id: string) {
  const t0 = performance.now();
  const intent = validateLargeIntent(await readJson(path.join(HOUSES, id, 'intent.json')));
  const facts: BuildingFacts = await readJson(path.join(HOUSES, id, 'facts.json'));
  const built = compileBuilding(intent, facts);
  const t1 = performance.now();
  const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  const tris = await decodeTriangles(glb.bytes);
  const {gates, topology} = evaluateLargeGates(tris, built);
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
    passed: gates.every(g => g.pass), timings: {fitCompileMs: +(t1 - t0).toFixed(1), exportGateMs: +(performance.now() - t1).toFixed(1)}};
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 1) + '\n');
  return {report, built, intent};
}

/** Front-on and 3/4 views of a wall-group's main panel, plus two aerials. */
export async function largeContactSheets(id: string, built: CompiledLargeBuilding, intent: {sources: {image?: string; capturedAt: string}[]}) {
  const file = path.join(ARTIFACTS, id, 'model.glb'), sheets: string[] = [], r = built.recipe;
  const top = Math.max(built.facts.heights.roofMaxM, 6), report = await readJson(path.join(ARTIFACTS, id, 'report.json'));
  const status = `${report.triangles} tris · ${report.passed ? 'gates pass' : 'GATE FAIL ' + report.gates.filter((g: any) => !g.pass).map((g: any) => g.id).join(', ')}`;
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
    const src = intent.sources[g.index] ?? intent.sources[0];
    const photo = src?.image ? await fs.readFile(src.image).catch(() => null) : null;
    const out = path.join(ARTIFACTS, id, `contact-walls-${g.index}.png`);
    await contactSheet([
      {image: photo ?? await sharp({create: {width: 8, height: 6, channels: 3, background: '#dddddd'}}).png().toBuffer(), text: photo ? `reference ${src.capturedAt} (panorama, CC BY 4.0)` : 'no reference photo'},
      {image: front, text: `walls[${g.index}] ${g.system} · ${g.storeys} st · ${g.bays} bays`}, {image: three, text: status}], out, {width: 640, height: 448}, `${id} — walls[${g.index}] (${g.bearingDeg}°)`);
    sheets.push(out);
  }
  // Aerials from the footprint centre, two opposite corners.
  const xs = r.set.ground.flatMap(s => s.rings.flat().map(p => p[0])), zs = r.set.ground.flatMap(s => s.rings.flat().map(p => p[2]));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2, ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), top);
  const d = ext * 1.6, size = {width: 800, height: 600};
  const aerial = await renderModels([{file}], [[1, 1], [-1, -1]].map(([sx, sz]) => ({eye: [cx + sx * d * 0.7, top + d * 0.55, cz + sz * d * 0.7], target: [cx, top * 0.35, cz], fov: 35, ...size})));
  const out = path.join(ARTIFACTS, id, 'contact-aerial.png');
  await contactSheet([{image: aerial[0], text: 'aerial from south-east'}, {image: aerial[1], text: 'aerial from north-west'}], out, {width: 640, height: 480}, `${id} — ${status}`);
  sheets.push(out);
  return sheets;
}

if (process.argv[1]?.endsWith('building-recipes/large.ts')) {
  const ids = (process.argv.find(a => a.startsWith('--house='))?.slice(8) ?? '').split(',').filter(Boolean);
  if (!ids.length) throw Error('Use --house=<id>[,<id>...]');
  let failed = false;
  try {
    for (const id of ids) {
      const {report, built, intent} = await compileLargeHouse(id);
      const bad = report.gates.filter(g => !g.pass);
      failed ||= bad.length > 0;
      console.log(`${id}: ${report.triangles} tris, ${report.bytes} B, ${(report.timings.fitCompileMs + report.timings.exportGateMs).toFixed(0)} ms, openings ${report.compose.recessed ?? 0} recessed / ${report.compose.proud ?? 0} flush, components ${JSON.stringify(report.components)}, gates ${bad.length ? 'FAIL ' + bad.map(g => `${g.id}=${JSON.stringify(g.value)}`).join('; ') : 'pass'}`);
      for (const w of report.fit.warnings) console.log(`  warn: ${w}`);
      if (!process.argv.includes('--no-render')) for (const s of await largeContactSheets(id, built, intent)) console.log(`  ${s}`);
    }
  } finally { await closeRenderer(); }
  if (process.argv.includes('--strict') && failed) process.exit(1);
}
