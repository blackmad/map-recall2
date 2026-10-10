/**
 * Generic city buildings versus the landmark/ordinary models that replace them.
 *
 * The complete-city layer draws every streamed z14 feature unless a shown
 * model names its id in `suppressOsmIds`. Two failures follow from that list
 * being written by hand, and neither shows up in a per-landmark check:
 *
 *  (a) **Orphan suppression** — a model hides a real building it does not
 *      draw. The Muziekgebouw model hid the Mövenpick hotel's 65 m tower and
 *      podium, so the "Mövenpick Hotel" label sat over a 43 m² canopy part.
 *      Measured as suppressed footprint area that no model triangle covers.
 *  (b) **Filler against a landmark** — a generic box that is not suppressed
 *      but lies inside (duplicates) or abuts a model, e.g. the lean-to shops
 *      against the Westerkerk nave and tower.
 *
 * Model footprints are measured, not assumed: every GLB is decoded and its
 * triangles projected through the runtime placement matrix (the same one
 * signature-landmarks-source.js builds), rasterised on a 0.5 m grid. Ground
 * plates (triangles below 1 m) are ignored so paving does not count as mass.
 *
 * Usage:
 *   node --max-old-space-size=8192 --import tsx scripts/audit-landmark-filler.ts            # report
 *   node --max-old-space-size=8192 --import tsx scripts/audit-landmark-filler.ts --check    # + named regressions
 *   ... --out=artifacts/landmark-filler/report.json --top=40
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { MANUAL_LANDMARKS } from '../src/canalRecall/landmarks/manualModels';
import { ORDINARY_BUILDINGS } from '../src/canalRecall/landmarks/ordinaryModels';
import { applyStreetChunks } from '../src/canalRecall/landmarks/ordinaryChunks';
import { placementFor, type SignatureModelSpec } from '../src/canalRecall/landmarks/signaturePlacement';
import { KITS } from '../src/canalRecall/landmarkKits';
import {
  CELL, cellsOfPolygon, markTriangle, type Ring, toLocal, FILLER_REGRESSIONS,
} from '../src/canalRecall/landmarkFiller';

const flag = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const CHECK = process.argv.includes('--check');
const OUT = flag('out') ?? 'artifacts/landmark-filler/report.json';
const TOP = Number(flag('top') ?? 40);
const ONLY = flag('only')?.split(',');
const TILE_DIR = flag('tiles') ?? 'public/data/extracts/amsterdam/building-tiles/14';
const MODEL_ROOT = 'public/canal-drive';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

// --- models as the game lists them --------------------------------------------
const chunkManifest = JSON.parse(readFileSync(path.join(MODEL_ROOT, 'ordinary-buildings-data/chunks.json'), 'utf8'));
let specs: SignatureModelSpec[] = applyStreetChunks([...MANUAL_LANDMARKS, ...ORDINARY_BUILDINGS], chunkManifest).models;
if (ONLY) specs = specs.filter(s => ONLY.includes(s.id));

type Occ = Map<number, number>; // cell → max model elevation (m)
const modelOcc = new Map<string, Occ>();
const owner = new Map<number, string>(); // cell → first model id (for attribution)
const allOcc: Occ = new Map();
const decoded = new Map<string, { tris: Float32Array; min: T.Vector3; max: T.Vector3 } | null>();

async function decode(url: string) {
  if (decoded.has(url)) return decoded.get(url)!;
  const file = path.join(MODEL_ROOT, url.replace(/^\.\//, '').replace(/\?.*$/, ''));
  if (!existsSync(file)) { decoded.set(url, null); return null; }
  const doc = await io.read(file);
  const out: number[] = [];
  const min = new T.Vector3(Infinity, Infinity, Infinity), max = new T.Vector3(-Infinity, -Infinity, -Infinity);
  const v = new T.Vector3();
  for (const node of doc.getRoot().listNodes()) for (const prim of node.getMesh()?.listPrimitives() ?? []) {
    const pos = prim.getAttribute('POSITION'); if (!pos) continue;
    const idx = prim.getIndices(), world = new T.Matrix4().fromArray(node.getWorldMatrix());
    const n = idx?.getCount() ?? pos.getCount();
    for (let i = 0; i < n; i++) {
      v.fromArray(pos.getElement(idx ? idx.getScalar(i) : i, [])).applyMatrix4(world);
      out.push(v.x, v.y, v.z); min.min(v); max.max(v);
    }
  }
  const result = { tris: Float32Array.from(out), min, max };
  decoded.set(url, result);
  return result;
}

const t0 = Date.now();
for (const spec of specs) {
  const mesh = await decode(spec.modelUrl);
  if (!mesh) continue;
  const placement = placementFor(spec, { min: mesh.min.toArray(), max: mesh.max.toArray() });
  const [alng, alat] = placement.anchor;
  const cx = spec.surveyed ? 0 : (mesh.min.x + mesh.max.x) / 2, cz = spec.surveyed ? 0 : (mesh.min.z + mesh.max.z) / 2;
  const s = placement.scale, mirror = placement.mirror ? -1 : 1, phi = (90 - placement.modelRotationDegrees) * Math.PI / 180;
  const basis = placement.horizontalBasis;
  const kx = 111320 * Math.cos(alat * Math.PI / 180), ky = 111320;
  const occ: Occ = new Map();
  const tri = mesh.tris;
  const pts: number[] = new Array(9);
  for (let i = 0; i < tri.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const x = (tri[i + 3 * k] - cx) * s * mirror, y = (tri[i + 3 * k + 1] - mesh.min.y) * s, z = (tri[i + 3 * k + 2] - cz) * s;
      let east: number, north: number;
      if (basis) { east = x * basis.x[0] - z * basis.y[0]; north = -(x * basis.x[1] - z * basis.y[1]); }
      else { east = x * Math.cos(phi) + z * Math.sin(phi); north = x * Math.sin(phi) - z * Math.cos(phi); }
      // Model metres → lng/lat at the anchor → the audit's shared local grid.
      const [gx, gy] = toLocal(alng + east / kx, alat + north / ky);
      pts[3 * k] = gx; pts[3 * k + 1] = gy; pts[3 * k + 2] = y;
    }
    if (Math.max(pts[2], pts[5], pts[8]) < 1) continue; // paving / ground plates
    markTriangle(pts, occ);
  }
  modelOcc.set(spec.id, occ);
  for (const [k, h] of occ) {
    if ((allOcc.get(k) ?? -1) < h) allOcc.set(k, h);
    if (!owner.has(k)) owner.set(k, spec.id);
  }
}
// Mass, not trim: a cell counts as inside a model only when its four neighbours are
// occupied too. Cornices, window frames and buttress caps stand ~0.2–0.4 m proud of a
// wall; without this erosion a 1.7 m-deep lean-to against the wall reads as 60% inside.
const massOcc: Occ = new Map();
for (const [k, h] of allOcc) if (allOcc.has(k + 1) && allOcc.has(k - 1) && allOcc.has(k + 1e6) && allOcc.has(k - 1e6)) massOcc.set(k, h);
process.stderr.write(`models: ${modelOcc.size}/${specs.length} decoded, ${allOcc.size} occupied cells, ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);

// Coarse 16 m buckets of model mass, for prefiltering features.
const BUCKET = 16;
const buckets = new Set<string>();
for (const k of allOcc.keys()) {
  const ix = Math.floor(k / 1e6) - 500000, iy = (k % 1e6) - 500000;
  buckets.add(`${Math.floor(ix * CELL / BUCKET)},${Math.floor(iy * CELL / BUCKET)}`);
}
const suppressedBy = new Map<string, string[]>();
for (const spec of specs) for (const id of spec.suppressOsmIds ?? []) {
  if (!modelOcc.has(spec.id)) continue;
  (suppressedBy.get(id) ?? suppressedBy.set(id, []).get(id)!).push(spec.id);
}

// --- streamed city features ---------------------------------------------------
type Row = { id: string; tile: string; areaM2: number; heightM: number | null; minHeightM: number; tier: unknown; centre: [number, number] };
const orphans: (Row & { suppressedBy: string[]; uncoveredM2: number; uncoveredFraction: number; score: number })[] = [];
const overlaps: (Row & { model: string; insideM2: number; insideFraction: number; modelHeightM: number; aboveModelM2: number; outsideM2: number; visibleScore: number; kind: 'duplicate' | 'abut' })[] = [];
let featureCount = 0;
for (const x of readdirSync(TILE_DIR)) for (const file of readdirSync(path.join(TILE_DIR, x))) {
  const fc = JSON.parse(gunzipSync(readFileSync(path.join(TILE_DIR, x, file))).toString());
  for (const f of fc.features) {
    featureCount++;
    const id = String(f.properties.id);
    const polys: Ring[][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const suppressed = suppressedBy.get(id);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const local = polys.map(rings => rings.map(r => r.map(([lng, lat]) => {
      const p = toLocal(lng, lat);
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
      return p;
    })));
    if (!suppressed) {
      let near = false;
      for (let bx = Math.floor((minX - 2) / BUCKET); bx <= Math.floor((maxX + 2) / BUCKET) && !near; bx++)
        for (let by = Math.floor((minY - 2) / BUCKET); by <= Math.floor((maxY + 2) / BUCKET); by++) if (buckets.has(`${bx},${by}`)) { near = true; break; }
      if (!near) continue;
    }
    const cells = local.flatMap(rings => cellsOfPolygon(rings));
    if (!cells.length) continue;
    const ring0 = polys[0][0];
    const row: Row = {
      id, tile: `${x}/${file.replace('.geojson.gz', '')}`, areaM2: cells.length * CELL * CELL,
      heightM: typeof f.properties.height === 'number' ? f.properties.height : null, minHeightM: f.properties.minHeight ?? 0, tier: f.properties.tier,
      centre: [+(ring0.reduce((s: number, p: number[]) => s + p[0], 0) / ring0.length).toFixed(6), +(ring0.reduce((s: number, p: number[]) => s + p[1], 0) / ring0.length).toFixed(6)],
    };
    if (suppressed) {
      const occs = suppressed.map(m => modelOcc.get(m)!);
      const uncovered = cells.filter(k => !occs.some(o => o.has(k))).length;
      const uncoveredM2 = uncovered * CELL * CELL, frac = uncovered / cells.length;
      if (uncoveredM2 >= 25 && frac >= 0.25) orphans.push({ ...row, suppressedBy: suppressed, uncoveredM2, uncoveredFraction: +frac.toFixed(2), score: Math.round(uncoveredM2 * Math.max(3, (row.heightM ?? 5) - row.minHeightM)) });
      continue;
    }
    // Inside: cells the model occupies. Abut: within 1 m (2 cells) of model mass.
    // A generic box wholly inside a taller model is invisible (cost only); one whose top
    // clears the model, or that sticks out of it, is what a player sees.
    const top = row.heightM ?? 5;
    const byModel = new Map<string, { inside: number; ring: number; h: number; above: number }>();
    for (const k of cells) {
      const h = massOcc.get(k);
      if (h !== undefined) { const m = owner.get(k)!; const e = byModel.get(m) ?? { inside: 0, ring: 0, h: 0, above: 0 }; e.inside++; e.h = Math.max(e.h, h); if (top > h + 0.5) e.above++; byModel.set(m, e); continue; }
    }
    if (!byModel.size) {
      // Ring test only for features with no interior overlap.
      const seen = new Set(cells);
      for (const k of cells) for (const d of [-2, -1, 1, 2]) for (const nk of [k + d * 1e6, k + d]) if (!seen.has(nk) && allOcc.has(nk)) {
        const m = owner.get(nk)!; const e = byModel.get(m) ?? { inside: 0, ring: 0, h: 0, above: 0 }; e.ring++; e.h = Math.max(e.h, allOcc.get(nk)!); byModel.set(m, e);
      }
    }
    for (const [model, e] of byModel) {
      const frac = e.inside / cells.length;
      const outsideM2 = (cells.length - e.inside) * CELL * CELL, aboveModelM2 = e.above * CELL * CELL;
      const visibleScore = Math.round(aboveModelM2 * Math.max(1, top - e.h) + (frac >= 0.3 ? outsideM2 * (top - row.minHeightM) : 0));
      overlaps.push({ ...row, model, insideM2: e.inside * CELL * CELL, insideFraction: +frac.toFixed(2), modelHeightM: +e.h.toFixed(1), aboveModelM2, outsideM2, visibleScore, kind: frac >= 0.3 ? 'duplicate' : 'abut' });
    }
  }
}
orphans.sort((a, b) => b.score - a.score);
// Ranked by what shows: area above the model's roof and area sticking out of its walls.
const dupes = overlaps.filter(o => o.kind === 'duplicate' && o.insideM2 >= 4).sort((a, b) => b.visibleScore - a.visibleScore || b.insideM2 - a.insideM2);
const hiddenDupes = dupes.filter(d => d.visibleScore === 0).length;
const abuts = overlaps.filter(o => o.kind === 'abut' || (o.kind === 'duplicate' && o.insideM2 < 4));
const abutByModel = new Map<string, number>();
for (const a of abuts) abutByModel.set(a.model, (abutByModel.get(a.model) ?? 0) + 1);

const report = {
  generatedAt: new Date().toISOString(), tiles: TILE_DIR, features: featureCount, models: modelOcc.size, cellMetres: CELL,
  summary: { orphanSuppressions: orphans.length, orphanUncoveredM2: Math.round(orphans.reduce((s, o) => s + o.uncoveredM2, 0)), duplicates: dupes.length, hiddenDuplicates: hiddenDupes, abutting: abuts.length },
  orphans: orphans.slice(0, TOP), duplicates: dupes.slice(0, TOP),
  abuttingByModel: [...abutByModel].sort((a, b) => b[1] - a[1]).slice(0, TOP),
  abutting: abuts.sort((a, b) => b.areaM2 - a.areaM2).slice(0, TOP * 2),
};
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 1));
process.stderr.write(`${featureCount} features; ${orphans.length} orphan suppressions, ${dupes.length} duplicates, ${abuts.length} abutting → ${OUT}\n`);
for (const o of orphans.slice(0, 12)) console.log(`orphan  ${o.id.padEnd(32)} ${String(o.uncoveredM2).padStart(6)} m² uncovered (${o.uncoveredFraction}) h=${o.heightM} by ${o.suppressedBy.join(',')} @${o.centre}`);
for (const o of dupes.slice(0, 20)) console.log(`dup     ${o.id.padEnd(32)} ${String(o.insideM2).padStart(6)} m² inside ${o.model} (${o.insideFraction}) h=${o.heightM}/${o.modelHeightM} above=${o.aboveModelM2} out=${o.outsideM2} score=${o.visibleScore} @${o.centre}`);

// --- named regressions --------------------------------------------------------
if (CHECK) {
  const failures: string[] = [];
  for (const r of FILLER_REGRESSIONS) {
    if (r.notOrphan) for (const id of r.notOrphan) if (orphans.some(o => o.id === id)) failures.push(`${r.name}: ${id} is suppressed but no model draws it`);
    if (r.noDuplicateOf) for (const model of r.noDuplicateOf) {
      const bad = dupes.filter(d => d.model === model && !(r.allowDuplicate ?? []).includes(d.id));
      if (bad.length) failures.push(`${r.name}: generic ${bad.map(b => `${b.id} (${b.insideM2} m²)`).join(', ')} inside ${model}`);
    }
    if (r.kitBody) {
      const kit = KITS.find(k => k.name === r.kitBody!.kit);
      const missing = r.kitBody.ids.filter(id => !kit?.body?.includes(id));
      if (!kit?.wall || missing.length) failures.push(`${r.name}: ${missing.join(', ') || 'kit wall'} not walled by the ${r.kitBody.kit} kit`);
    }
  }
  if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
  console.log(`named filler regressions pass (${FILLER_REGRESSIONS.map(r => r.name).join(', ')})`);
}
