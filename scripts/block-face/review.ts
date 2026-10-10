/**
 * Block-face review: ONE strip sheet per face.
 *
 *   node --import tsx scripts/block-face/review.ts --face=bilder-081118-155417 [--glb=<other chunk glb> --label=<text>]
 *
 * Rows, all at the strip's scale (px/m) and ground line, x = chunk-frame metres along the face:
 *   1. rectified photo strip (dated) with pand boundaries;
 *   2. the chunk GLB rendered orthographically along the frontage normal (same frame, same scale);
 *   3. 50 % overlay of 1 and 2;
 *   4. per pand: address, ground-floor use (name, category, OSM/BAG/photo agreement, photo date), triangles,
 *      gates, facade-compare (glazed openings per row and gable peaks: photo counts vs the render), schema limits;
 *   5. per party line: interference verdict (gap/overlap, penetration, z-fight, cornice step vs photo).
 * Writes staging/block-face/<face>/review/{strip-sheet.png,model-ortho.png,overlay.png,facade-compare.json}.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {NodeIO} from '@gltf-transform/core';
import {KHRMeshQuantization} from '@gltf-transform/extensions';
import {renderModels, closeRenderer} from '../building-recipes/render.ts';
import {compare, measureFacade, type FacadeInventory, type MaterialSoup} from '../../src/canalRecall/landmarks/facadeCompare.ts';
import type {BlockFaceIntent} from '../../src/canalRecall/blockFace/intent.ts';
import {FACES, STAGING} from './intake.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function chunkSoup(file: string): Promise<MaterialSoup> {
  const doc = await new NodeIO().registerExtensions([KHRMeshQuantization]).read(file);
  const positions: number[] = [], indices: number[] = [], triMaterial: number[] = [], materials: MaterialSoup['materials'] = [];
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial()!, slot = (mat.getExtras() as any).materialSlot ?? 'brick', c = mat.getBaseColorFactor();
    const mi = materials.length; materials.push({name: slot, rgb: [c[0], c[1], c[2]]});
    const base = positions.length / 3, pos = prim.getAttribute('POSITION')!, idx = prim.getIndices()!;
    for (let v = 0; v < pos.getCount(); v++) positions.push(...pos.getElement(v, []));
    for (let k = 0; k < idx.getCount(); k++) indices.push(base + idx.getScalar(k));
    for (let t = 0; t < idx.getCount() / 3; t++) triMaterial.push(mi);
  }
  return {positions, indices, triMaterial, materials};
}

export async function reviewFace(faceId: string, glbOverride?: string, label?: string) {
  const dir = path.join(FACES, faceId), stage = path.join(STAGING, faceId), out = path.join(stage, 'review');
  await fs.mkdir(out, {recursive: true});
  const strip = JSON.parse(await fs.readFile(path.join(dir, 'strip.json'), 'utf8'));
  const face: BlockFaceIntent = JSON.parse(await fs.readFile(path.join(dir, 'intent.json'), 'utf8'));
  const report = JSON.parse(await fs.readFile(path.join(stage, 'report.json'), 'utf8'));
  const glb = glbOverride ?? path.join(stage, 'chunk.glb');
  const W = strip.width, H = strip.height, ppm = strip.pixelsPerMetre, x0 = strip.x0M, x1 = strip.x1M, top = strip.heightM;
  // Model: chunk frame (x along the face, y up, z outward); camera on +z looking back, same metres as the strip.
  const [model] = await renderModels([{file: glb}], [{eye: [(x0 + x1) / 2, top / 2, 200], target: [(x0 + x1) / 2, top / 2, 0], fov: 30, width: W, height: H,
    ortho: [-(x1 - x0) / 2, (x1 - x0) / 2, top / 2, -top / 2], background: '#9fb8cf', noGround: true}]);
  await closeRenderer();
  const modelPng = await sharp(model).resize(W, H, {fit: 'fill'}).png().toBuffer();
  await fs.writeFile(path.join(out, 'model-ortho.png'), modelPng);
  const photo = await sharp(strip.image).resize(W, H, {fit: 'fill'}).png().toBuffer();
  const overlay = await sharp(photo).composite([{input: await sharp(modelPng).removeAlpha().ensureAlpha(0.5).png().toBuffer(), blend: 'over'}]).png().toBuffer();
  await fs.writeFile(path.join(out, 'overlay.png'), overlay);

  // Facade-compare per pand span (photo counts from the rhythm spec vs the orthographic material render).
  const soup = await chunkSoup(glb);
  const fc = face.houses.map((h, i) => {
    const s = strip.spans[i];
    const inv: FacadeInventory = {name: h.pandId.slice(-6), bearing: 180, span: [s.x0M + 0.05, s.x1M - 0.05], depthBand: 3, openings: ['glass'],
      ...(h.rhythm.photoRows ? {rows: h.rhythm.photoRows} : {}), ...(h.rhythm.photoGables !== undefined ? {gables: h.rhythm.photoGables} : {})};
    const m = measureFacade(soup, inv);
    return {pand: h.pandId, checks: compare(inv, m), measured: {rows: m.rows, rowHeights: m.rowHeights, gables: m.gables, columns: m.columns}};
  });
  await fs.writeFile(path.join(out, 'facade-compare.json'), JSON.stringify(fc, null, 1) + '\n');

  // Sheet.
  const LABEL = 30, INFO = 236, PARTY = 64, GAP = 6, titleH = 44;
  const lines = (yTop: number, h: number) => strip.spans.map((s: any) => `<line x1="${s.px[0]}" y1="${yTop}" x2="${s.px[0]}" y2="${yTop + h}" stroke="#ff2d55" stroke-width="2"/>`).join('') + `<line x1="${W - 1}" y1="${yTop}" x2="${W - 1}" y2="${yTop + h}" stroke="#ff2d55" stroke-width="2"/>`;
  const rowY = [titleH, titleH + LABEL + H + GAP, titleH + 2 * (LABEL + H + GAP)], infoY = titleH + 3 * (LABEL + H + GAP), partyY = infoY + INFO;
  const totalH = partyY + PARTY + 10;
  const rowLabels = [`1. photo strip, rectified, ${strip.date} (Gemeente Amsterdam panoramas, CC BY 4.0) · ${ppm} px/m`, `2. model, orthographic, same frame and scale${label ? ' · ' + label : ''}`, '3. overlay 50 %'];
  let svg = `<svg width="${W}" height="${totalH}" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:Helvetica,Arial}</style>`;
  svg += `<text x="10" y="30" font-size="22" font-weight="bold" fill="#1f2328">${esc(face.street)} · block face ${esc(face.id)} · ${face.houses.length} pands · ${report.triangles.chunk} tris · ${(report.bytes.chunk / 1024).toFixed(0)} KB · ${report.passed ? 'gates pass' : 'GATES FAIL'}</text>`;
  rowY.forEach((y, k) => { svg += `<rect x="0" y="${y}" width="${W}" height="${LABEL}" fill="#1f2328"/><text x="8" y="${y + 21}" font-size="16" fill="#fff">${esc(rowLabels[k])}</text>` + lines(y + LABEL, H); });
  face.houses.forEach((h, i) => {
    const s = strip.spans[i], w = s.px[1] - s.px[0], x = s.px[0] + 5, g = h.groundFloor;
    const gates = report.gates.filter((q: any) => q.pand === h.pandId.slice(-6)), bad = gates.filter((q: any) => !q.pass);
    const checks = fc[i].checks, cbad = checks.filter(c => !c.pass);
    const t = report.perPand[i];
    const tx = (dy: number, size: number, text: string, colour = '#1f2328', weight = 'normal') => `<text x="${x}" y="${infoY + dy}" font-size="${size}" font-weight="${weight}" fill="${colour}">${esc(text)}</text>`;
    const clip = (text: string, px: number) => text.length * px * 0.55 > w - 10 ? text.slice(0, Math.max(4, Math.floor((w - 10) / (px * 0.55)) - 1)) + '…' : text;
    svg += `<rect x="${s.px[0]}" y="${infoY}" width="${w}" height="${INFO - 4}" fill="${i % 2 ? '#eef0f2' : '#e3e6ea'}"/>`;
    svg += tx(18, 15, clip(`${i + 1}. ${h.pandId.slice(-6)} ${h.address}`, 15), '#1f2328', 'bold');
    svg += tx(38, 13, clip(`${g.use}${g.name ? ': ' + g.name : ''}`, 13), '#0b5394', 'bold');
    svg += tx(55, 12, clip(`${g.category ?? (g.bag ?? []).join('+')}`, 12));
    svg += tx(71, 12, clip(`${g.agreement} · photo ${g.photoDate}`, 12), g.agreement === 'osm-and-photo' ? '#1d7a35' : '#a15c00');
    svg += tx(91, 12, clip(`${t.triangles} tris · eaves ${t.eavesM} m · roof ${t.roofMaxM}/${t.roofMaxFactsM}`, 12));
    svg += tx(108, 12, clip(bad.length ? `GATES: ${bad.map((q: any) => q.id).join(', ')}` : `gates: ${gates.length} pass`, 12), bad.length ? '#c62828' : '#1d7a35');
    checks.forEach((c, k) => { svg += tx(126 + k * 16, 12, clip(`${c.pass ? '✓' : '✗'} ${c.what.replace(' (bottom→top)', '')}: ${c.expected} vs ${c.measured.replace(/ at y.*$/, '')}`, 12), c.pass ? '#1d7a35' : '#c62828'); });
    (h.rhythm.schemaLimits ?? []).slice(0, 4).forEach((l, k) => { svg += tx(126 + checks.length * 16 + 4 + k * 15, 11, clip(`limit: ${l}`, 11), '#6b4e00'); });
    void cbad;
  });
  report.interference.forEach((it: any, i: number) => {
    const xp = strip.spans[i + 1].px[0], ok = it.pass;
    svg += `<line x1="${xp}" y1="${partyY}" x2="${xp}" y2="${partyY + PARTY}" stroke="${ok ? '#1d7a35' : '#c62828'}" stroke-width="3"/>`;
    const txt = [`${ok ? 'ok' : 'FAIL'} gap ${it.frontGapM} m · z ${it.zFightM2}/${it.roofZFightM2} m²`, `eaves ${it.eavesStepM >= 0 ? '+' : ''}${it.eavesStepM} m ${it.corniceVerdict}`, `pen ${it.penetrationM2.leftIntoRight}/${it.penetrationM2.rightIntoLeft} · over ${it.detailOverhangM.left}/${it.detailOverhangM.right}`];
    txt.forEach((l, k) => { svg += `<text x="${Math.min(W - 230, xp + 4)}" y="${partyY + 16 + k * 16}" font-size="12" fill="${ok ? '#1d7a35' : '#c62828'}">${esc(l)}</text>`; });
  });
  svg += '</svg>';
  const sheet = path.join(out, 'strip-sheet.png');
  await sharp({create: {width: W, height: totalH, channels: 3, background: '#f6f7f8'}})
    .composite([{input: photo, left: 0, top: rowY[0] + LABEL}, {input: modelPng, left: 0, top: rowY[1] + LABEL}, {input: overlay, left: 0, top: rowY[2] + LABEL}, {input: Buffer.from(svg), left: 0, top: 0}])
    .png().toFile(sheet);
  console.log(sheet);
  for (const f of fc) console.log(`  ${f.pand.slice(-6)}: ${f.checks.map(c => `${c.pass ? 'ok' : 'FAIL'} ${c.what} ${c.expected} vs ${c.measured}`).join(' | ')}`);
  return {sheet, fc};
}

if (process.argv[1]?.endsWith('block-face/review.ts')) {
  const faceId = arg('face');
  if (!faceId) throw Error('Use --face=<id> [--glb=<file> --label=<text>]');
  await reviewFace(faceId, arg('glb'), arg('label'));
}
