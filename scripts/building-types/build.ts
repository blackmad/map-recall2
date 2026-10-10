/**
 * Generate the staged building-type GLBs for one pilot area and measure them.
 *
 *   node --import tsx scripts/building-types/build.ts --area=slotermeer-geuzenveld
 *
 * Reads  staging/building-types/<area>/instances.json (select-area.ts), variants.json (per-pand cladding, optional)
 * Writes staging/building-types/<area>/{<area>-baked-<n>.glb, <area>-merged.glb, <area>-instanced.glb, types/<group>.glb,
 *        placements.json, report.json}. Nothing is installed into the game.
 */
import fs from 'node:fs';
import path from 'node:path';
import {generate, type GenerateReport} from '../../src/canalRecall/buildingTypes/generate.ts';
import {lngLatToLocal, minimumRotatedRectangle, rectIoU, bearingDeg, type Anchor, type Pt} from '../../src/canalRecall/buildingTypes/geometry.ts';
import {frontSide, frontYaw, type Street} from '../../src/canalRecall/buildingTypes/orientation.ts';
import {paramsFromFacts, roofFactsFromItem, type CityJsonItem, type RoofFacts} from '../../src/canalRecall/buildingTypes/facts.ts';
import {validateSpec, type TypeSpec} from '../../src/canalRecall/buildingTypes/spec.ts';
import {writeBakedGlb, writeInstancedGlb, writeMergedGlb, writeTypeGlb, type InstancedGroup, type PlacedInstance} from '../../src/canalRecall/buildingTypes/glb.ts';
import type {MeshBuilder} from '../../src/canalRecall/buildingTypes/mesh.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const area = arg('area', 'slotermeer-geuzenveld'), dir = path.join('staging/building-types', area);
const TYPES_DIR = 'src/canalRecall/buildingTypes/types';
const specs = new Map<string, TypeSpec>();
for (const f of fs.readdirSync(TYPES_DIR).filter(f => f.endsWith('.json'))) { const s = JSON.parse(fs.readFileSync(path.join(TYPES_DIR, f), 'utf8')) as TypeSpec; const e = validateSpec(s); if (e.length) throw new Error(`${f}: ${e.join('; ')}`); specs.set(s.id, s); }

const input = JSON.parse(fs.readFileSync(path.join(dir, 'instances.json'), 'utf8')) as {anchor: Anchor; instances: any[]; streets: Street[]};
const variantsFile = path.join(dir, 'variants.json');
const overrides: Record<string, {type?: string; variant?: string; groundMode?: 'solid' | 'pilotis'; hold?: string; note?: string}> = fs.existsSync(variantsFile) ? JSON.parse(fs.readFileSync(variantsFile, 'utf8')) : {};

async function item3d(id: string): Promise<CityJsonItem> {
  const file = `.cache/building-types/3dbag/${id}.json`;
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${id}`, {signal: AbortSignal.timeout(40000)});
      if (!r.ok) throw new Error(String(r.status));
      const text = await r.text();
      fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, text);
      return JSON.parse(text);
    } catch (e) { if (attempt >= 3) throw new Error(`3DBAG ${id}: ${(e as Error).message}`); await new Promise(res => setTimeout(res, 1000 * (attempt + 1))); }
  }
}

interface Built {
  pandId: string; type: string; variant: string; mesh: MeshBuilder; report: GenerateReport; position: [number, number, number]; yaw: number;
  held?: string; rect: ReturnType<typeof minimumRotatedRectangle>; front: ReturnType<typeof frontSide>; roof: RoofFacts | null; warnings: string[]; iou: number; bytes?: number; params: any;
}
const built: Built[] = [];
for (const instIn of input.instances) {
  const o = overrides[instIn.pandId] ?? {};
  // variants.json may re-assign the design (the footprint cluster does not know the facade) and hold a pand whose photo does not confirm one.
  const inst = {...instIn, type: o.type ?? instIn.type};
  const spec = specs.get(inst.type);
  if (!spec) throw new Error(`${inst.pandId}: unknown type ${inst.type}`);
  const ring: Pt[] = inst.ringLngLat.map(([lng, lat]: number[]) => lngLatToLocal(input.anchor, lng, lat));
  const rect = minimumRotatedRectangle(ring), iou = rectIoU(ring, rect);
  const front = frontSide(rect, input.streets);
  let roof: RoofFacts | null = null;
  try { roof = roofFactsFromItem(await item3d(inst.pandId)); } catch (e) { console.warn('roof facts failed', inst.pandId, (e as Error).message); }
  const {params, warnings} = paramsFromFacts(spec, rect, inst.attrs, roof, {variant: o.variant, groundMode: o.groundMode});
  if (front.ambiguous) warnings.push(`front ambiguous (scores ${front.score.toFixed(1)} / ${front.otherScore.toFixed(1)})`);
  const {mesh, report} = generate(spec, params);
  built.push({held: o.hold, pandId: inst.pandId, type: inst.type, variant: report.variant, mesh, report, position: [rect.center[0], inst.attrs.b3_h_maaiveld ?? 0, rect.center[1]], yaw: frontYaw(front), rect, front, roof, warnings, iou, params});
}

// One street level per chunk, as the street-chunks lane does: every instance stands on y = 0 and the median 3DBAG ground (NAP) is in the asset extras;
// each node records its own 3DBAG ground and the delta it was re-grounded by (b3_h_maaiveld wobbles by a few dm on flat streets).
const chunkGroundNap = [...built.map(b => b.position[1])].sort((a, b) => a - b)[Math.floor(built.length / 2)];
const rootExtras = {anchor: input.anchor, chunkGroundNapM: +chunkGroundNap.toFixed(3), frame: 'x east, z south, y up from chunkGroundNapM (median 3DBAG ground); metres from anchor', generator: 'src/canalRecall/buildingTypes'};
const placed: PlacedInstance[] = built.map(b => ({
  name: `${b.type}-${b.pandId}`, mesh: b.mesh, position: [b.position[0], 0, b.position[2]], yaw: b.yaw,
  extras: {pandId: b.pandId, groundNapM: +b.position[1].toFixed(3), regroundedByM: +(chunkGroundNap - b.position[1]).toFixed(3), type: b.type, variant: b.variant, groundMode: b.report.groundMode, storeys: b.report.storeys, frontBearingDeg: Math.round(bearingDeg(b.front.normal[0], b.front.normal[1])), frontStreet: b.front.street, roofForm: b.report.roofForm, ridge: b.report.ridge},
}));

fs.mkdirSync(path.join(dir, 'types'), {recursive: true});
// Baked: one node per instance with its own exact-size mesh; split so no file exceeds the audit's 60k-triangle cap.
const parts: PlacedInstance[][] = [[]];
for (const p of placed) { const cur = parts.at(-1)!; if (cur.length && cur.reduce((t, q) => t + q.mesh.triangles, 0) + p.mesh.triangles > 50000) parts.push([]); parts.at(-1)!.push(p); }
for (const old of fs.readdirSync(dir).filter(n => /-baked(-\d+)?\.glb$/.test(n))) fs.rmSync(path.join(dir, old));
const bakedParts = [];
for (const [i, part] of parts.entries()) { const r = await writeBakedGlb(`${area}-${i + 1}`, part, {rootExtras}); fs.writeFileSync(path.join(dir, `${area}-baked-${i + 1}.glb`), r.bytes); bakedParts.push({file: `${area}-baked-${i + 1}.glb`, instances: part.length, triangles: r.triangles, bytes: r.bytes.length}); }
const baked = {bytes: bakedParts.reduce((t, p) => t + p.bytes, 0), triangles: bakedParts.reduce((t, p) => t + p.triangles, 0), primitives: 0, vertices: 0}, merged = await writeMergedGlb(area, placed, {rootExtras});
fs.writeFileSync(path.join(dir, `${area}-merged.glb`), merged.bytes);
const bakedRaw = await writeBakedGlb(area, placed, {compress: 'none'}), mergedRaw = await writeMergedGlb(area, placed, {compress: 'none'});

// True instancing: one unit mesh per design group at the group's median size, per-instance scale.
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const groupKey = (b: Built) => [b.type, b.variant, b.report.storeys, b.report.roofForm, b.report.ridge, b.report.groundMode].join('|');
const groups = new Map<string, Built[]>();
for (const b of built.filter(b => !b.held)) groups.set(groupKey(b), [...(groups.get(groupKey(b)) ?? []), b]);
const instanced: InstancedGroup[] = [], groupInfo: any[] = [];
let maxScaleDev = 0;
for (const [key, members] of groups) {
  const [type] = key.split('|'), spec = specs.get(type)!;
  const L0 = median(members.map(m => m.params.lengthM)), W0 = median(members.map(m => m.params.widthM)), E0 = median(members.map(m => m.params.eavesM));
  const R0 = members.every(m => m.params.ridgeM != null) ? median(members.map(m => m.params.ridgeM)) : undefined;
  const first = members[0];
  const {mesh} = generate(spec, {...first.params, lengthM: L0, widthM: W0, eavesM: E0, ridgeM: R0});
  const name = key.replace(/\|/g, '__');
  const instances = members.map(m => {
    const scale: [number, number, number] = [m.params.lengthM / L0, m.params.eavesM / E0, m.params.widthM / W0];
    maxScaleDev = Math.max(maxScaleDev, ...scale.map(s => Math.abs(s - 1)));
    return {position: [m.position[0], 0, m.position[2]] as [number, number, number], yaw: m.yaw, scale, extras: {pandId: m.pandId}};
  });
  instanced.push({name, mesh, instances});
  const unit = await writeTypeGlb(name, mesh, {key, nominal: {L0, W0, E0, R0}});
  fs.writeFileSync(path.join(dir, 'types', `${name}.glb`), unit.bytes);
  const buckets = new Set(members.map(m => [Math.round(m.params.lengthM / 0.5), Math.round(m.params.widthM / 0.5), Math.round(m.params.eavesM / 0.4)].join())).size;
  groupInfo.push({key, members: members.length, dimensionBuckets: buckets, bucketedBytesEstimate: buckets * unit.bytes.length, maxScaleDeviation: +Math.max(...instances.flatMap(i => i.scale.map(v => Math.abs(v - 1)))).toFixed(3), nominal: {L: +L0.toFixed(2), W: +W0.toFixed(2), eaves: +E0.toFixed(2), ridge: R0 && +R0.toFixed(2)}, unitTriangles: mesh.triangles, unitBytes: unit.bytes.length});
}
const inst = await writeInstancedGlb(area, instanced, {rootExtras}), instRaw = await writeInstancedGlb(area, instanced, {compress: 'none'});
fs.writeFileSync(path.join(dir, `${area}-instanced.glb`), inst.bytes);

// Per-type measurements.
const perType: Record<string, any> = {};
for (const type of specs.keys()) {
  const mine = built.filter(b => b.type === type);
  if (!mine.length) continue;
  const tris = mine.map(b => b.report.triangles);
  perType[type] = {instances: mine.length, trisPerInstance: {min: Math.min(...tris), median: median(tris), max: Math.max(...tris)}, trianglesTotal: tris.reduce((s, t) => s + t, 0), warnings: mine.reduce((s, b) => s + b.warnings.length, 0)};
}
const instanceRecordBytes = built.length * 40; // 3 + 4 + 3 floats per instance, quantised: ~40 B
const report = {
  area, chunkGroundNapM: +chunkGroundNap.toFixed(3), generatedAt: new Date().toISOString().slice(0, 10), instances: built.length, perType,
  glb: {
    baked: {parts: bakedParts, bytes: baked.bytes, bytesUncompressed: bakedRaw.bytes.length, triangles: baked.triangles, vertices: bakedRaw.vertices},
    merged: {bytes: merged.bytes.length, bytesUncompressed: mergedRaw.bytes.length, triangles: merged.triangles, primitives: merged.primitives, vertices: merged.vertices},
    instanced: {bytes: inst.bytes.length, bytesUncompressed: instRaw.bytes.length, triangles: inst.triangles, primitives: inst.primitives, vertices: inst.vertices, designGroups: groups.size, maxScaleDeviation: +maxScaleDev.toFixed(3)},
    bucketed: {note: 'one unit mesh per (design group, +-0.25 m length/width, +-0.2 m eaves bucket) instead of per-instance scale', meshes: groupInfo.reduce((t, g) => t + g.dimensionBuckets, 0), bytesEstimate: groupInfo.reduce((t, g) => t + g.bucketedBytesEstimate, 0) + instanceRecordBytes},
    saving: {bytesVsMerged: +(1 - inst.bytes.length / merged.bytes.length).toFixed(3), bytesVsBaked: +(1 - inst.bytes.length / baked.bytes).toFixed(3), bytesUncompressedVsMerged: +(1 - instRaw.bytes.length / mergedRaw.bytes.length).toFixed(3)},
  },
  groups: groupInfo,
  instancesDetail: built.map(b => ({pandId: b.pandId, held: b.held ?? null, type: b.type, variant: b.variant, groundMode: b.report.groundMode, storeys: b.report.storeys, tris: b.report.triangles, lengthM: +b.rect.length.toFixed(2), widthM: +b.rect.width.toFixed(2), eavesM: +b.params.eavesM.toFixed(2), ridgeM: b.params.ridgeM && +b.params.ridgeM.toFixed(2), roof3dbag: b.roof?.form ?? null, roofUsed: b.report.roofForm, ridge: b.report.ridge, rectIoU: +b.iou.toFixed(3), frontBearingDeg: Math.round(bearingDeg(b.front.normal[0], b.front.normal[1])), frontStreet: b.front.street, frontStreetDistM: +b.front.streetDistanceM.toFixed(1), ambiguous: b.front.ambiguous, warnings: b.warnings})),
};
fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 1) + '\n');
fs.writeFileSync(path.join(dir, 'placements.json'), JSON.stringify({area, frame: 'x east, z south, y NAP metres from anchor; yaw about +y takes the local frame (front +z, tangent +x) to east/south', anchor: input.anchor, placements: built.map(b => ({pand: b.pandId, type: b.type, variant: b.variant, groundMode: b.report.groundMode, transform: {positionEastNapSouth: b.position.map(v => +v.toFixed(3)), positionChunk: [b.position[0], 0, b.position[2]].map(v => +v.toFixed(3)), yawRad: +b.yaw.toFixed(5), lengthM: +b.params.lengthM.toFixed(2), widthM: +b.params.widthM.toFixed(2), eavesM: +b.params.eavesM.toFixed(2)}}))}, null, 1) + '\n');
console.log(JSON.stringify({perType: report.perType, glb: report.glb}, null, 1));
for (const b of built) if (b.warnings.length) console.log(b.pandId, b.type.slice(3, 9), b.warnings.join(' | '));
