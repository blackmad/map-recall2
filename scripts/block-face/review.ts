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
import {houseIntents, validateBlockFace, type BlockFaceIntent} from '../../src/canalRecall/blockFace/intent.ts';
import {measureWallColour, toHex} from '../../src/canalRecall/blockFace/wallColour.ts';
import {compareBands, countBands, groundStoreysOf, type FrontBands} from '../../src/canalRecall/blockFace/openingCount.ts';
import {FACES, STAGING} from './intake.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function chunkSoup(file: string): Promise<MaterialSoup> {
  const doc = await new NodeIO().registerExtensions([KHRMeshQuantization]).read(file);
  const positions: number[] = [], indices: number[] = [], triMaterial: number[] = [], materials: MaterialSoup['materials'] = [];
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial()!, slot = (mat.getExtras() as any).materialSlot ?? 'brick', c = mat.getBaseColorFactor();
    // Sign lettering (signage.ts) shares the door slot; it is not an opening.
    if ((mat.getExtras() as any).canalhouseSurface === 'sign') continue;
    // Shop joinery (pui posts, arcade piers) shares the door slot; only door/shutter panes count as openings.
    const mi = materials.length; materials.push({name: slot === 'door' && (mat.getExtras() as any).canalhouseSurface === 'shop' ? 'shop' : slot, rgb: [c[0], c[1], c[2]]});
    const base = positions.length / 3, pos = prim.getAttribute('POSITION')!, idx = prim.getIndices()!;
    for (let v = 0; v < pos.getCount(); v++) positions.push(...pos.getElement(v, []));
    for (let k = 0; k < idx.getCount(); k++) indices.push(base + idx.getScalar(k));
    for (let t = 0; t < idx.getCount() / 3; t++) triMaterial.push(mi);
  }
  return {positions, indices, triMaterial, materials};
}

const roundOpening = (o: {t0: number; t1: number; y0: number; y1: number}) => ({t0: +o.t0.toFixed(2), t1: +o.t1.toFixed(2), y0: +o.y0.toFixed(2), y1: +o.y1.toFixed(2)});

/** Storey bands per front of a pand, fronts left to right in proportion to their compiled widths. */
export function frontBands(intentFronts: {id: string; basement?: string; shopfront?: {storeys?: number} | null}[], perPand: {storeyHeightsM: number[]; fronts?: {id: string; widthM: number; storeyHeightsM: number[]}[]}, lengthM: number): FrontBands[] {
  const compiled = perPand.fronts ?? [{id: intentFronts[0].id, widthM: 1, storeyHeightsM: perPand.storeyHeightsM}];
  const total = compiled.reduce((a, f) => a + f.widthM, 0);
  let t = 0;
  return compiled.map((f, k) => {
    const intent = intentFronts.find(x => x.id === f.id) ?? intentFronts[0];
    const t0 = t; t += f.widthM / total * lengthM;
    // The outer edges take everything (openings measured from the span start may overhang it by a pixel).
    return {id: f.id, t0: k === 0 ? -1 : +t0.toFixed(2), t1: k === compiled.length - 1 ? +(lengthM + 1).toFixed(2) : +t.toFixed(2), storeyHeightsM: f.storeyHeightsM, groundStoreys: groundStoreysOf(intent)};
  });
}

export async function reviewFace(faceId: string, glbOverride?: string, label?: string) {
  const dir = path.join(FACES, faceId), stage = path.join(STAGING, faceId), out = path.join(stage, 'review');
  await fs.mkdir(out, {recursive: true});
  const strip = JSON.parse(await fs.readFile(path.join(dir, 'strip.json'), 'utf8'));
  // Validated: a typed house's rhythm spec is its type's plus what the house states (blockFace/houseType.ts).
  const face: BlockFaceIntent = validateBlockFace(JSON.parse(await fs.readFile(path.join(dir, 'intent.json'), 'utf8')));
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

  // Wall colour per pand: photo median vs model median on the same wall pixels (storeys above the ground floor).
  const rawOf = async (png: Buffer) => new Uint8Array(await sharp(png).removeAlpha().raw().toBuffer());
  const photoRaw = await rawOf(photo), modelRaw = await rawOf(modelPng);
  const wall = face.houses.map((_, i) => {
    const s = strip.spans[i], eaves = report.perPand[i].eavesM;
    return measureWallColour({photo: photoRaw, model: modelRaw, width: W, height: H, box: {x0: Math.round(s.px[0] + 8), x1: Math.round(s.px[1] - 8), y0: Math.max(0, Math.round(H - (eaves - 1) * ppm)), y1: Math.round(H - 3.8 * ppm)}});
  });

  // Facade-compare per pand span (photo counts from the rhythm spec vs the orthographic material render). Openings are
  // counted per storey band (openingCount.ts): the ground band (pui/arcade/shop with its transoms, a basement) as bays,
  // then each upper storey, then attic rows; gable peaks as before.
  const soup = await chunkSoup(glb), resolved = houseIntents(face);
  const fc = face.houses.map((h, i) => {
    const s = strip.spans[i], span: [number, number] = [s.x0M + 0.05, s.x1M - 0.05];
    const inv: FacadeInventory = {name: h.pandId.slice(-6), bearing: 180, span, depthBand: 3, openings: ['glass'], ...(h.rhythm.photoGables !== undefined ? {gables: h.rhythm.photoGables} : {})};
    const m = measureFacade(soup, inv), every = measureFacade(soup, {...inv, openings: ['glass', 'door']});
    const fronts = frontBands(resolved[i].fronts, report.perPand[i], span[1] - span[0]);
    const bands = countBands(m.openings, every.openings, fronts);
    const checks = [...(h.rhythm.photoRows ? compareBands(inv.name, h.rhythm.photoRows, bands, {groundRows: h.rhythm.photoGroundRows}) : []), ...compare(inv, m)];
    return {pand: h.pandId, checks, wallColour: wall[i], measured: {bands, rows: m.rows, rowHeights: m.rowHeights, gables: m.gables, columns: m.columns}, fronts,
      openings: {glazed: m.openings.map(roundOpening), all: every.openings.map(roundOpening)}};
  });
  await fs.writeFile(path.join(out, 'facade-compare.json'), JSON.stringify(fc, null, 1) + '\n');

  // Sheet.
  const LABEL = 30, INFO = 236, PARTY = 64, GAP = 6, titleH = 44;
  const lines = (yTop: number, h: number) => strip.spans.map((s: any) => `<line x1="${s.px[0]}" y1="${yTop}" x2="${s.px[0]}" y2="${yTop + h}" stroke="#ff2d55" stroke-width="2"/>`).join('') + `<line x1="${W - 1}" y1="${yTop}" x2="${W - 1}" y2="${yTop + h}" stroke="#ff2d55" stroke-width="2"/>`;
  const rowY = [titleH, titleH + LABEL + H + GAP, titleH + 2 * (LABEL + H + GAP)], infoY = titleH + 3 * (LABEL + H + GAP), partyY = infoY + INFO;
  const totalH = partyY + PARTY + 10;
  const rowLabels = [`1. photo strip, rectified, ${strip.date} (Gemeente Amsterdam panoramas, CC BY 4.0) · ${ppm} px/m`, `2. model, orthographic, same frame and scale${label ? ' · ' + label : ''}${(report.rears ?? []).length ? ' · street side only: rear facades are INFERRED (plain window grid, not shown here)' : ''}`, '3. overlay 50 %'];
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
    const wc = wall[i];
    if (wc) svg += tx(126 + checks.length * 16, 12, clip(`${wc.pass ? '✓' : '✗'} wall ${toHex(wc.photo)} photo / ${toHex(wc.model)} model${wc.pass ? '' : ': ' + wc.note}`, 12), wc.pass ? '#1d7a35' : '#c62828');
    // Backs are not photographed: the plain window grid in the model is INFERRED from storey heights and width.
    const rear = (report.rears ?? []).find((r: any) => r.pandId === h.pandId);
    const rearLines = rear ? [`rear: INFERRED (no photo), ${rear.windows} plain windows`] : [];
    rearLines.forEach((l, k) => { svg += tx(126 + checks.length * 16 + 18 + k * 15, 11, clip(l, 11), '#7a1fa2', 'bold'); });
    (h.rhythm.schemaLimits ?? []).slice(0, 3).forEach((l, k) => { svg += tx(126 + checks.length * 16 + 20 + (rearLines.length + k) * 15, 11, clip(`limit: ${l}`, 11), '#6b4e00'); });
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
  for (const f of fc) if (f.wallColour) console.log(`  ${f.pand.slice(-6)} wall: photo ${toHex(f.wallColour.photo)} model ${toHex(f.wallColour.model)} (${f.wallColour.pass ? 'ok' : f.wallColour.note})`);
  for (const f of fc) console.log(`  ${f.pand.slice(-6)}: ${f.checks.map(c => `${c.pass ? 'ok' : 'FAIL'} ${c.what} ${c.expected} vs ${c.measured}`).join(' | ')}`);
  return {sheet, fc};
}

if (process.argv[1]?.endsWith('block-face/review.ts')) {
  const faceId = arg('face');
  if (!faceId) throw Error('Use --face=<id> [--glb=<file> --label=<text>]');
  await reviewFace(faceId, arg('glb'), arg('label'));
}
