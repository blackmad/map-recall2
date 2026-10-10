/**
 * Recipe fidelity gates re-run on the CHUNKED geometry, per pand.
 *
 *   node --import tsx scripts/street-chunks/gates.ts [--glb-dir=artifacts/street-chunks] [--out=artifacts/street-chunks/gates.json] [--install]
 *
 * The recipe gates (buildingRecipe/gates.ts) run on a single house in its own frame. In a chunk the house is
 * re-grounded (<= 1 m) and its eaves may snap (<= ~0.25 m), so this decodes each pand's triangle range from the
 * built chunk GLB and checks it against the ORIGINAL 3DBAG facts in absolute NAP:
 *   footprint-vs-bag   raster IoU (10 cm) of the pand's triangles projected to the ground vs BAG LoD0, >= 0.90
 *   ridge-vs-3dbag     roof-surface max (NAP) within 0.30 m (+ the house's declared dormer allowance) of LoD2.2 roof max
 *   eaves-vs-3dbag     chunk cornice (NAP) within 0.30 m of the LoD2.2 front eaves (single-front houses)
 * and reports what re-grounding/snapping moved relative to the same house compiled alone.
 * Exit code 1 when any gate fails.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {KHRMeshQuantization} from '@gltf-transform/extensions';
import {HOUSES, compileHouse} from '../building-recipes/compile.ts';
import {pointInRing, type BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {readChunkExtras} from '../../src/canalRecall/streetChunks/extras.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const dir = arg('glb-dir') ?? 'artifacts/street-chunks', outFile = arg('out') ?? path.join(dir, 'gates.json');
const r2 = (v: number) => +v.toFixed(2);

type V3 = [number, number, number];
interface PandTris { all: [V3, V3, V3][]; roofMaxY: number }

async function pandTriangles(glb: Uint8Array) {
  const doc = await new NodeIO().registerExtensions([KHRMeshQuantization]).readBinary(glb);
  const node = doc.getRoot().listNodes().find(n => n.getMesh())!;
  const extras = readChunkExtras(node.getExtras())!;
  const prims = node.getMesh()!.listPrimitives();
  const pands: PandTris[] = extras.pands.map(() => ({all: [], roofMaxY: -Infinity}));
  extras.pands.forEach((pand, pi) => {
    for (const range of pand.ranges) {
      const prim = prims[range.primitive], pos = prim.getAttribute('POSITION')!, idx = prim.getIndices()!;
      const roof = (prim.getMaterial()!.getExtras() as any).canalhouseSurface === 'roof';
      for (let t = range.firstTriangle; t < range.firstTriangle + range.triangleCount; t++) {
        const tri = [0, 1, 2].map(k => pos.getElement(idx.getScalar(t * 3 + k), []) as number[]) as [V3, V3, V3];
        pands[pi].all.push(tri);
        if (roof) for (const p of tri) pands[pi].roofMaxY = Math.max(pands[pi].roofMaxY, p[1]);
      }
    }
  });
  return {extras, pands};
}

/** Raster IoU on a 10 cm RD grid: the pand's projected triangles against the BAG rings. */
function footprintIoU(tris: [V3, V3, V3][], frame: {midRD: number[]; uRD: number[]; nRD: number[]}, facts: BuildingFacts) {
  const toRD = (p: V3) => [frame.midRD[0] + p[0] * frame.uRD[0] + p[2] * frame.nRD[0], frame.midRD[1] + p[0] * frame.uRD[1] + p[2] * frame.nRD[1]];
  const model = tris.map(t => t.map(toRD)), bag = facts.bagFootprintRD, step = 0.1;
  const all = [...model.flat(), ...bag.flat()];
  const x0 = Math.min(...all.map(p => p[0])), y0 = Math.min(...all.map(p => p[1]));
  const w = Math.ceil((Math.max(...all.map(p => p[0])) - x0) / step) + 2, h = Math.ceil((Math.max(...all.map(p => p[1])) - y0) / step) + 2;
  const covered = new Uint8Array(w * h);
  for (const [a, b, c] of model) {
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(area) < 1e-9) continue;
    const ix0 = Math.floor((Math.min(a[0], b[0], c[0]) - x0) / step), ix1 = Math.ceil((Math.max(a[0], b[0], c[0]) - x0) / step);
    const iy0 = Math.floor((Math.min(a[1], b[1], c[1]) - y0) / step), iy1 = Math.ceil((Math.max(a[1], b[1], c[1]) - y0) / step);
    for (let ix = ix0; ix <= ix1; ix++) for (let iy = iy0; iy <= iy1; iy++) {
      const px = x0 + (ix + 0.5) * step, py = y0 + (iy + 0.5) * step;
      const l1 = ((px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1])) / area, l2 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / area;
      if (l1 >= 0 && l2 >= 0 && l1 + l2 <= 1) covered[iy * w + ix] = 1;
    }
  }
  let inter = 0, union = 0;
  for (let ix = 0; ix < w; ix++) for (let iy = 0; iy < h; iy++) {
    const a = covered[iy * w + ix] === 1, b = bag.reduce((s, r) => s + (pointInRing([x0 + (ix + 0.5) * step, y0 + (iy + 0.5) * step], r) ? 1 : 0), 0) % 2 === 1;
    if (a && b) inter++;
    if (a || b) union++;
  }
  return union ? inter / union : 0;
}

const rows: any[] = [];
for (const file of (await fs.readdir(dir)).filter(f => /^bilder-.*\.glb$/.test(f)).sort()) {
  const report = JSON.parse(await fs.readFile(path.join(dir, file.replace(/\.glb$/, '.report.json')), 'utf8'));
  const {extras, pands} = await pandTriangles(new Uint8Array(await fs.readFile(path.join(dir, file))));
  const frame = report.frame, sharedNap = report.ground.sharedNapM as number;
  for (let i = 0; i < extras.pands.length; i++) {
    const meta = extras.pands[i], facts: BuildingFacts = JSON.parse(await fs.readFile(path.join(HOUSES, meta.recipeId, 'facts.json'), 'utf8'));
    const alone = (await compileHouse(meta.recipeId)).report;
    const groundNap = facts.heights.groundNAP;
    // Target = LoD2.2 roof max after roofCleanup artefact removal (what the recipe gate compares to), in absolute NAP.
    const aloneRidge = alone.gates.find(g => g.id === 'ridge-vs-3dbag')!.value as any, roofNapTarget = aloneRidge.threeDBagM + groundNap;
    const roofNap = pands[i].roofMaxY + sharedNap;
    const allowance = (alone.fit as any).roofAllowanceM ?? 0, singleFront = facts.fronts.length === 1;
    const eavesTarget = facts.fronts[0].eavesM + groundNap, eavesNap = meta.eavesM + sharedNap, aloneEaves = alone.fit.fronts[0].eavesM + groundNap;
    const iou = footprintIoU(pands[i].all, frame, facts);
    const ridgeDelta = roofNap - roofNapTarget;
    const gates = [
      {id: 'footprint-vs-bag', pass: iou >= 0.9, value: r2(iou), limit: '>= 0.90'},
      {id: 'ridge-vs-3dbag', pass: ridgeDelta <= 0.3 + allowance && -ridgeDelta <= 0.3, value: r2(ridgeDelta), limit: `<= +${r2(0.3 + allowance)} / >= -0.30 m`},
      {id: 'eaves-vs-3dbag', pass: !singleFront || Math.abs(eavesNap - eavesTarget) <= 0.3, value: r2(eavesNap - eavesTarget), limit: singleFront ? '|d| <= 0.30 m' : 'multi-front: not gated'},
    ];
    rows.push({chunkName: report.name, recipeId: meta.recipeId, address: meta.address, groundShiftM: meta.groundShiftM,
      individual: {passed: alone.passed, ridgeDeltaM: r2(aloneRidge.modelM + groundNap - roofNapTarget), eavesDeltaM: r2(aloneEaves - eavesTarget), footprintIoU: alone.gates.find(g => g.id === 'footprint-vs-bag')!.value},
      chunk: {ridgeDeltaM: r2(ridgeDelta), eavesDeltaM: r2(eavesNap - eavesTarget), footprintIoU: r2(iou)},
      movedByChunkM: {ridge: r2(roofNap - (aloneRidge.modelM + groundNap)), eaves: r2(eavesNap - aloneEaves)}, gates, passed: gates.every(g => g.pass)});
  }
}
await fs.writeFile(outFile, JSON.stringify({generatedAt: new Date().toISOString(), pands: rows.length, failed: rows.filter(r => !r.passed).length, rows}, null, 1) + '\n');
for (const r of rows) {
  console.log(`${r.passed ? 'pass' : 'FAIL'} ${r.recipeId.padEnd(14)} ${r.address.padEnd(22)} IoU ${r.chunk.footprintIoU} (alone ${r.individual.footprintIoU}) | ridge ${r.chunk.ridgeDeltaM} (alone ${r.individual.ridgeDeltaM}) | eaves ${r.chunk.eavesDeltaM} (alone ${r.individual.eavesDeltaM}) | moved ridge ${r.movedByChunkM.ridge} eaves ${r.movedByChunkM.eaves} | ground ${r.groundShiftM}${r.passed ? '' : ' | ' + r.gates.filter((g: any) => !g.pass).map((g: any) => g.id).join(',')}`);
}
console.log(`${rows.length} pands, ${rows.filter(r => !r.passed).length} failing -> ${outFile}`);
if (process.argv.includes('--install')) await fs.copyFile(outFile, 'public/canal-drive/ordinary-buildings-data/chunks-gates.json');
process.exit(rows.some(r => !r.passed) ? 1 : 0);
