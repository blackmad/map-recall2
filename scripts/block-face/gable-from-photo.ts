/**
 * Gables from the photo: per pand (per front) roofline from the face's rectified strip, classified and fitted with
 * facade/gable.ts + facade/gableFit.ts, compared with the intent's authored crown.
 *
 *   node --import tsx scripts/block-face/gable-from-photo.ts --face=marnix-124-138
 *   node --import tsx scripts/block-face/gable-from-photo.ts --all
 *   node --import tsx scripts/block-face/gable-from-photo.ts --house=bilder-156287 --strip-face=bilder-081118-155417
 *
 * Reads staging/block-face/<face>/strip.jpg (falls back to the source pack's models/<face>/files/strip.jpg) and
 * strip.json. Writes staging/block-face/<face>/gables.json, gables.jpg (the strip with photo roofline in cyan, the
 * fitted template in yellow, the authored crown at its compiled height dashed red, the crown `crownFromPhoto` would compile
 * in green) and gables-sheet.jpg (one crop
 * per front, labelled). Sky/building is a deterministic colour test (blockFace/gableFromStrip.ts), not Mask2Former.
 */
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {houseIntents, validateBlockFace} from '../../src/canalRecall/blockFace/intent.ts';
import {planFaceGround} from '../../src/canalRecall/blockFace/compile.ts';
import {fitIntent} from '../../src/canalRecall/buildingRecipe/fit.ts';
import {validateIntent, type CanalHouseIntent} from '../../src/canalRecall/buildingRecipe/intent.ts';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {applyPhotoCrowns, authoredOutline, authoredShape, compareCrowns, photoCrownPatch, readPhotoGable, spanProfile, stripSkyline, withModelEaves, type CrownComparison, type PhotoCrownPatch, type PhotoGable, type StripPixels} from '../../src/canalRecall/blockFace/gableFromStrip.ts';
import type {GableProfileSample} from '../../src/canalRecall/facade/gableFit.ts';
import {FACES, STAGING} from './intake.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const SOURCE_PACK = process.env.BLOCK_FACE_SOURCE_PACK ?? '/Users/blackmad/Code/map-recall2-source-data-wt/bilderdijk-faces/models';

interface StripJson { width: number; height: number; pixelsPerMetre: number; groundNAP: number; spans: {pandId: string; px: [number, number]}[] }
export interface FrontRow {
  pand: string; slug: string; front: string; spanPx: [number, number];
  photo: PhotoGable; comparison: CrownComparison; suggestedPatch: PhotoCrownPatch | null;
  /** Eaves above the strip ground: photo vs compiled model (the model's ground offset to the strip's applied). */
  eaves: {photoM: number; modelM: number; deltaM: number};
  authoredOutline: [number, number][] | null; profile: GableProfileSample[];
  /** The crown `crownFromPhoto` would compile (patched intent through the same fit), eaves-relative like authoredOutline. */
  fromPhotoOutline: [number, number][] | null;
}

async function loadStrip(faceId: string): Promise<{strip: StripJson; img: StripPixels; file: string}> {
  const strip: StripJson = JSON.parse(await fs.readFile(path.join(FACES, faceId, 'strip.json'), 'utf8'));
  const file = [path.join(STAGING, faceId, 'strip.jpg'), path.join(SOURCE_PACK, faceId, 'files', 'strip.jpg')].find(p => existsSync(p));
  if (!file) throw Error(`${faceId}: no strip.jpg in ${STAGING} or the source pack`);
  const {data, info} = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true});
  if (info.width !== strip.width || info.height !== strip.height) throw Error(`${faceId}: ${file} is ${info.width}x${info.height}, strip.json says ${strip.width}x${strip.height}`);
  return {strip, img: {data, width: info.width, height: info.height, channels: info.channels}, file};
}

/** Houses to read: resolved intents and the facts their compile uses (face-grounded for a face). */
async function subjects(faceId: string, house?: string): Promise<{intents: CanalHouseIntent[]; facts: BuildingFacts[]}> {
  if (house) {
    const dir = path.join('scripts/building-recipes/houses', house);
    return {intents: [validateIntent(JSON.parse(await fs.readFile(path.join(dir, 'intent.json'), 'utf8')))], facts: [JSON.parse(await fs.readFile(path.join(dir, 'facts.json'), 'utf8'))]};
  }
  const dir = path.join(FACES, faceId), face = validateBlockFace(JSON.parse(await fs.readFile(path.join(dir, 'intent.json'), 'utf8')));
  const raw: BuildingFacts[] = await Promise.all(face.houses.map(async h => JSON.parse(await fs.readFile(path.join(dir, 'pands', h.pandId, 'facts.json'), 'utf8'))));
  const s = JSON.parse(await fs.readFile(path.join(dir, 'strip.json'), 'utf8'));
  const ground = planFaceGround(face, raw, undefined, {heightPx: s.height, pixelsPerMetre: s.pixelsPerMetre, groundNAP: s.groundNAP});
  return {intents: houseIntents(face), facts: ground.facts};
}

export async function readFaceGables(faceId: string, house?: string) {
  const {strip, img, file} = await loadStrip(faceId);
  const ppm = strip.pixelsPerMetre, skyline = stripSkyline(img, 0, img.width, {pixelsPerMetre: ppm});
  const {intents, facts} = await subjects(faceId, house);
  const rows: FrontRow[] = [];
  for (const [i, intent] of intents.entries()) {
    const span = strip.spans.find(s => s.pandId === intent.pandId);
    if (!span) { console.warn(`${intent.pandId}: not on the strip`); continue; }
    const {recipe, report} = fitIntent(intent, facts[i]);
    // Several fronts on one pand: split its strip span left to right by fitted widths.
    const total = report.fronts.reduce((s, f) => s + f.widthM, 0);
    let x = span.px[0];
    const groundOffset = facts[i].heights.groundNAP - strip.groundNAP;
    for (const front of intent.fronts) {
      const rf = report.fronts.find(f => f.id === front.id)!, w = (span.px[1] - span.px[0]) * rf.widthM / total, spanPx: [number, number] = [Math.round(x), Math.round(x + w)];
      x += w;
      const profile = spanProfile(skyline, spanPx, strip.height, ppm);
      const shape = authoredShape(recipe, report, front.id);
      const modelM = +(rf.eavesM + groundOffset).toFixed(2);
      const photo = withModelEaves(readPhotoGable(profile), modelM);
      // Both crowns in the strip frame: strip.json is calibrated (crown tops agree to cm on Marnixstraat), so the
      // authored crown is compared at its absolute height, its rise measured from the photo's eaves line.
      const inStrip = {...shape, eavesUp: modelM, riseM: shape.span ? +Math.max(0, modelM + shape.riseM - photo.shape.eavesUp).toFixed(2) : 0};
      const comparison = compareCrowns(front.gable, inStrip, photo, front.crownSteps, front.roofFront ? 'mansard' : front.dormers ? 'dormers' : undefined);
      const suggestedPatch = photoCrownPatch(intent.pandId, front, photo, {widthM: rf.widthM, upperStoreyM: rf.storeyHeightsM.at(-1)!, authoredSpan: shape.span, modelEavesUp: modelM});
      const toStrip = (o: [number, number][] | null, eavesM: number) => o?.map(([ax, ay]) => [+(ax * (spanPx[1] - spanPx[0]) / ppm / rf.widthM).toFixed(3), +(ay - eavesM).toFixed(3)] as [number, number]) ?? null;
      // What `crownFromPhoto` would compile: the patched intent through the same fit.
      let fromPhotoOutline: [number, number][] | null = null;
      if (suggestedPatch) {
        try {
          const patched = applyPhotoCrowns([intent], [suggestedPatch])[0], fp = fitIntent(patched, facts[i]);
          fromPhotoOutline = toStrip(authoredOutline(fp.recipe, fp.report, front.id), fp.report.fronts.find(f => f.id === front.id)!.eavesM);
        } catch (e) { console.warn(`${intent.id}/${front.id}: photo patch does not fit: ${(e as Error).message}`); }
      }
      rows.push({pand: intent.pandId, slug: intent.id, front: front.id, spanPx, photo, comparison, suggestedPatch, eaves: {photoM: photo.shape.eavesUp, modelM, deltaM: +(modelM - photo.shape.eavesUp).toFixed(2)},
        authoredOutline: toStrip(authoredOutline(recipe, report, front.id), rf.eavesM), fromPhotoOutline, profile});
    }
  }
  return {strip, img, file, skyline, rows};
}

/** Photo readings keyed `<pandId>/<frontId>` for compile (`continuity.crownFromPhoto`). */
export async function photoReadings(faceId: string): Promise<Map<string, PhotoGable>> {
  const {rows} = await readFaceGables(faceId);
  return new Map(rows.map(r => [`${r.pand}/${r.front}`, r.photo]));
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (r: FrontRow) => {
  const a = r.comparison.authored, p = r.photo, steps = (s: {stepsLeft: number; stepsRight: number}) => `${s.stepsLeft}/${s.stepsRight}`;
  return [`${r.slug}${r.front !== 'front0' ? ' ' + r.front : ''}`,
    `intent ${a.gable}${a.steps ? ' ' + a.steps : ''} rise ${a.shape.riseM} w ${a.shape.widthM} st ${steps(a.shape)}`,
    `photo ${p.intentGable ?? '?'} (${p.crown.type} ${p.crown.confidence.toFixed(2)}) rise ${p.shape.riseM} w ${p.shape.widthM} st ${steps(p.shape)} sym ${p.shape.symmetry}`,
    p.abstain.length ? `ABSTAIN ${p.abstain[0]}` : r.comparison.mismatches.length ? `${r.comparison.mismatches.length} mismatch` : 'match'];
};

async function render(out: string, data: Awaited<ReturnType<typeof readFaceGables>>) {
  const {strip, file, skyline, rows} = data, ppm = strip.pixelsPerMetre, H = strip.height;
  const yOf = (up: number) => (H - up * ppm).toFixed(1);
  const parts: string[] = [];
  // Raw skyline (cyan), null columns left blank.
  let seg: string[] = [];
  const flush = () => { if (seg.length > 1) parts.push(`<polyline points="${seg.join(' ')}" fill="none" stroke="#00e5ff" stroke-width="2"/>`); seg = []; };
  skyline.forEach((v, x) => { if (v === null) flush(); else seg.push(`${x},${v}`); }); flush();
  for (const r of rows) {
    const [a, b] = r.spanPx, toX = (along: number) => (a + along * ppm).toFixed(1);
    parts.push(`<line x1="${a}" y1="0" x2="${a}" y2="${H}" stroke="#ffffff" stroke-width="1" stroke-dasharray="6 6" opacity="0.7"/>`);
    parts.push(`<line x1="${a}" y1="${yOf(r.photo.shape.eavesUp)}" x2="${b}" y2="${yOf(r.photo.shape.eavesUp)}" stroke="#00e5ff" stroke-width="1" stroke-dasharray="3 5"/>`);
    if (r.photo.fit.trace.length) parts.push(`<polyline points="${r.photo.fit.trace.map(([x, y]) => `${toX(x)},${yOf(y)}`).join(' ')}" fill="none" stroke="#ffd400" stroke-width="3"/>`);
    if (r.authoredOutline) parts.push(`<polyline points="${r.authoredOutline.map(([x, y]) => `${toX(x)},${yOf(y + r.eaves.modelM)}`).join(' ')}" fill="none" stroke="#ff2a2a" stroke-width="3" stroke-dasharray="10 4"/>`);
    if (r.fromPhotoOutline) parts.push(`<polyline points="${r.fromPhotoOutline.map(([x, y]) => `${toX(x)},${yOf(y + r.eaves.modelM)}`).join(' ')}" fill="none" stroke="#19d13a" stroke-width="2.5"/>`);
    if (!r.authoredOutline) parts.push(`<line x1="${a}" y1="${yOf(r.eaves.modelM)}" x2="${b}" y2="${yOf(r.eaves.modelM)}" stroke="#ff2a2a" stroke-width="3" stroke-dasharray="10 4"/>`);
  }
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${strip.width}" height="${H}">${parts.join('')}</svg>`);
  const overlaid = await sharp(file).removeAlpha().composite([{input: svg}]).jpeg({quality: 88}).toBuffer();
  await sharp(overlaid).resize({width: Math.min(strip.width, 2400)}).jpeg({quality: 85}).toFile(path.join(out, 'gables.jpg'));
  // Sheet: one crop per front from the strip top down to 2 m below the photo eaves, with its label.
  const tileH = 300, labelH = 74, tiles: {input: Buffer; left: number; top: number}[] = [];
  let x = 0, y = 0, rowH = 0; const sheetW = 1800;
  for (const r of rows) {
    const [a, b] = r.spanPx, left = Math.max(0, a - 15), w = Math.min(strip.width, b + 15) - left;
    const base = Number.isFinite(r.photo.shape.eavesUp) ? Math.min(r.photo.shape.eavesUp, r.eaves.modelM) : r.eaves.modelM;
    const bottom = Math.min(H, Math.round(H - (base - 2) * ppm)), crop = await sharp(overlaid).extract({left, top: 0, width: w, height: Math.max(20, bottom)}).resize({height: tileH}).toBuffer({resolveWithObject: true});
    const tw = Math.max(crop.info.width, 330);
    if (x + tw > sheetW) { x = 0; y += rowH; rowH = 0; }
    const text = label(r).map((l, k) => `<text x="4" y="${15 + k * 17}" font-family="Helvetica" font-size="13" fill="${k === 3 && !l.startsWith('match') ? '#b00000' : '#111'}">${esc(l)}</text>`).join('');
    tiles.push({input: crop.data, left: x, top: y});
    tiles.push({input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${labelH}"><rect width="100%" height="100%" fill="#fff"/>${text}</svg>`), left: x, top: y + tileH});
    x += tw + 6; rowH = Math.max(rowH, tileH + labelH + 6);
  }
  await sharp({create: {width: sheetW, height: y + rowH, channels: 3, background: '#ddd'}}).composite(tiles).jpeg({quality: 85}).toFile(path.join(out, 'gables-sheet.jpg'));
}

async function run(faceId: string, house?: string) {
  const data = await readFaceGables(faceId, house), out = path.join(STAGING, house ?? faceId);
  await fs.mkdir(out, {recursive: true});
  const json = {face: faceId, house: house ?? null, strip: data.file, method: 'deterministic sky/building colour test (blockFace/gableFromStrip.ts); Mask2Former not installed locally',
    fronts: data.rows.map(({profile: _p, authoredOutline: _o, fromPhotoOutline: _f, ...r}) => r)};
  await fs.writeFile(path.join(out, 'gables.json'), JSON.stringify(json, null, 1) + '\n');
  await render(out, data);
  console.log(`${house ?? faceId}: ${data.rows.length} fronts -> ${out}/gables.{json,jpg} gables-sheet.jpg`);
  for (const r of data.rows) console.log(`  ${r.slug.padEnd(22)} ${r.front.padEnd(7)} ${label(r).slice(1).join(' | ')}${r.comparison.mismatches.length ? '\n      - ' + r.comparison.mismatches.join('\n      - ') : ''}`);
}

if (process.argv[1]?.endsWith('gable-from-photo.ts')) {
  if (process.argv.includes('--all')) {
    for (const f of (await fs.readdir(FACES)).sort()) if (existsSync(path.join(FACES, f, 'intent.json')) && existsSync(path.join(FACES, f, 'strip.json'))) await run(f);
  } else if (arg('house')) await run(arg('strip-face') ?? (() => { throw Error('--house needs --strip-face'); })(), arg('house'));
  else if (arg('face')) await run(arg('face')!);
  else throw Error('Use --face=<id> | --all | --house=<id> --strip-face=<face>');
}
