/**
 * Auto-placement of a buurt's block faces from a type library (blockFace/autoPlace.ts): evidence per pand from the
 * intake (facts, uses, the rectified strip), a scored type per pand, holds with reasons, one face intent per run of
 * placed pands, compile (never --install), a per-pand likeness gate on the compiled model against the strip, and a
 * second pass without the pands that fail it. Review sheets with --review.
 *
 *   node --import tsx scripts/block-face/auto-place.ts --buurt=bellamybuurt-zuid --district=bellamy [--only=<face>,...] [--review] [--no-compile]
 *
 * Reads scripts/block-face/buurten/<buurt>.json (buurt-survey.ts), scripts/block-face/faces/<face>/{discovery,strip,uses}.json,
 * pands/<id>/facts.json, staging/block-face/<face>/strip.jpg and the library scripts/block-face/types/<district>/.
 * Writes per face scripts/block-face/faces/<face>/auto-place.json (every pand: placed with type, score and likeness, or
 * held with the stage and reason), the run faces' intent.json (a run that is not the whole face gets its own face
 * directory `<face>-r<k>` with the members' facts, uses and a cropped strip), and scripts/block-face/buurten/<buurt>-placement.json.
 */
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {AUTO_PLACE, FRONT_EAVES, frontEavesFor, decidePand, ribbonRowHolds, fillPairs, medianGain, rowCoherence, rowExposure, trimGains, placementGate, scoreType, placedRuns, runIntent, type Decision, type Held, type MatchableType, type PandEvidence, type Placed} from '../../src/canalRecall/blockFace/autoPlace.ts';
import {classifyPixel, measureStripPalette} from '../../src/canalRecall/blockFace/stripPalette.ts';
import {measureSkyline} from '../../src/canalRecall/blockFace/stripSkyline.ts';
import {measureStripStructure} from '../../src/canalRecall/blockFace/stripStructure.ts';
import {isLeaf, measureFacade, type FacadeImage, type FrontClass} from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import {compareLikeness, modelElevation, PAD_M, type LikenessResult} from '../../src/canalRecall/buildingRecipe/likeness.ts';
import {chunkFrame} from '../../src/canalRecall/streetChunks/compileChunk.ts';
import {TYPE_LIBRARY_DIR} from '../../src/canalRecall/blockFace/typeLibrary.ts';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {loadMaterialSoup} from '../landmarks/material-soup.ts';
import {renderModels, closeRenderer} from '../building-recipes/render.ts';
import {STRIP_LIKENESS, spanLikeness} from '../../src/canalRecall/blockFace/stripLikeness.ts';
import {applyCrownPins, applyMirrorPins, crownPinProblems, mirrorPinProblems, typePinProblems, typesForFace, typesForPand, type CrownPin, type MirrorPin, type TypePin} from '../../src/canalRecall/blockFace/reviewCrowns.ts';
import {applyDoorPins, doorPinProblems, type DoorPin} from '../../src/canalRecall/blockFace/reviewDoors.ts';
import {acceptFloorFor, acceptPinProblems, applyPalettePins, palettePinProblems, type AcceptPin, type PalettePin} from '../../src/canalRecall/blockFace/reviewPalettes.ts';
import {frontBump} from '../../src/canalRecall/blockFace/bayOutline.ts';
import {FACES, STAGING} from './intake.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const readJson = async (f: string) => JSON.parse(await fs.readFile(f, 'utf8'));
const r2 = (v: number) => +v.toFixed(2);

type Raw = {rgb: Uint8Array; width: number; height: number};
async function stripRaw(file: string): Promise<Raw> {
  const {data, info} = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true});
  return {rgb: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height};
}

/** Shares of placeholder grey and foliage in the body band (4.4 m .. eaves - 1) of a span. */
function evidenceShares(raw: Raw, px: [number, number], ppm: number, eavesM: number) {
  const inset = Math.round((px[1] - px[0]) * 0.06), y0 = Math.max(0, Math.round(raw.height - (eavesM - 1) * ppm)), y1 = Math.round(raw.height - 4.4 * ppm);
  let n = 0, v = 0, leaf = 0;
  for (let y = y0; y < y1; y++) for (let x = px[0] + inset; x < px[1] - inset; x++) {
    const i = (y * raw.width + x) * 3, p: [number, number, number] = [raw.rgb[i], raw.rgb[i + 1], raw.rgb[i + 2]];
    n++; if (classifyPixel(p) === 'void') v++; else if (isLeaf(p[0], p[1], p[2])) leaf++;
  }
  return {voidShare: n ? r2(v / n) : 1, foliageShare: n ? r2(leaf / n) : 0};
}

/** A metric image of a strip span, padded by `padM` on each side and above the eaves (rows below the ground are invalid). */
function spanImage(raw: Raw, px: [number, number], ppm: number, heightM: number, padM: number): FacadeImage {
  const x0 = Math.round(px[0] - padM * ppm), x1 = Math.round(px[1] + padM * ppm), pad = Math.round(padM * ppm);
  const width = x1 - x0, height = raw.height + pad, rgb = new Uint8Array(width * height * 3), valid = new Uint8Array(width * height);
  for (let y = 0; y < raw.height; y++) for (let x = 0; x < width; x++) {
    const sx = x0 + x; if (sx < 0 || sx >= raw.width) continue;
    const i = (y * raw.width + sx) * 3, o = y * width + x;
    const p: [number, number, number] = [raw.rgb[i], raw.rgb[i + 1], raw.rgb[i + 2]];
    if (classifyPixel(p) === 'void') continue;
    valid[o] = 255; rgb.set(p, o * 3);
  }
  return {width, height, rgb, valid, ppm, topM: heightM};
}

/** The half of the upper storeys (6.5 m .. eaves - 0.5) with clearly more light accent pixels (white bays, frames). */
function accentSide(raw: Raw, px: [number, number], ppm: number, eavesM: number): {side: 'left' | 'right' | null; share: number} {
  const inset = Math.round((px[1] - px[0]) * 0.06), mid = (px[0] + px[1]) / 2, y0 = Math.max(0, Math.round(raw.height - (eavesM - 0.5) * ppm)), y1 = Math.round(raw.height - 6.5 * ppm);
  let l = 1, r = 1, n = 0;
  for (let y = y0; y < y1; y++) for (let x = px[0] + inset; x < px[1] - inset; x++) {
    const i = (y * raw.width + x) * 3;
    // Light accent; a washed-out white reads as `void` (l > 0.97) but is not the grey placeholder.
    const p: [number, number, number] = [raw.rgb[i], raw.rgb[i + 1], raw.rgb[i + 2]], c = classifyPixel(p), grey = Math.abs(p[0] - 128) <= 2 && Math.abs(p[1] - 128) <= 2 && Math.abs(p[2] - 128) <= 2;
    if (!grey) n++;
    if (c === 'accent' || (c === 'void' && !grey)) { if (x < mid) l++; else r++; }
  }
  const share = Math.round(1000 * (l + r - 2) / Math.max(1, n)) / 1000;
  return {side: l / r >= 1.6 ? 'left' : r / l >= 1.6 ? 'right' : null, share};
}

/** Door side on the ground band (0.1-2.3 m): the darkest 0.9 m window of columns, if it is dark and in an outer third. */
function doorSide(raw: Raw, px: [number, number], ppm: number): 'left' | 'right' | null {
  const y0 = Math.round(raw.height - 2.3 * ppm), y1 = Math.round(raw.height - 0.1 * ppm), cols = px[1] - px[0];
  const dark = Array.from({length: cols}, (_, k) => {
    let d = 0, n = 0;
    for (let y = y0; y < y1; y++) { const i = (y * raw.width + px[0] + k) * 3, p: [number, number, number] = [raw.rgb[i], raw.rgb[i + 1], raw.rgb[i + 2]]; const c = classifyPixel(p); if (c === 'void') continue; n++; if (c === 'glass') d++; }
    return n ? d / n : 0;
  });
  const w = Math.round(0.9 * ppm);
  if (cols < 2 * w) return null;
  let best = {at: -1, v: 0};
  for (let k = 0; k + w <= cols; k++) { let s = 0; for (let j = k; j < k + w; j++) s += dark[j]; s /= w; if (s > best.v) best = {at: k + w / 2, v: s}; }
  if (best.v < 0.55) return null;
  return best.at < cols / 3 ? 'left' : best.at > cols * 2 / 3 ? 'right' : null;
}

/**
 * A loosened type's eaves range: wide enough to veto nothing, centred on the type's own range, so the eaves criterion
 * still weighs the storey pitch (storeyPitch is the range's middle; [0, 99] made it 12.4 m on a 4-storey type and
 * scored every challenger's eaves 0: Eemsstraat's erker types never placed as challengers).
 */
const looseEaves = (t: MatchableType): [number, number] => { const e = t.match?.eavesM; if (!e) return [0, 99]; const mid = (e[0] + e[1]) / 2; return [mid - 50, mid + 50]; };

async function loadTypes(district: string): Promise<MatchableType[]> {
  const dir = path.join(TYPE_LIBRARY_DIR, district);
  return Promise.all((await fs.readdir(dir)).filter(f => f.endsWith('.json')).sort().map(f => readJson(path.join(dir, f))));
}

const PHOTO_EAVES = {on: process.argv.includes('--photo-eaves'), minConfidence: 0.6, minM: 6, minDeltaM: 0.4, maxRiseM: 1.5, maxDropM: 4} as const;
/** Pands whose eaves the strip skyline measured (--photo-eaves), keyed by pand id; read back by `withPhotoEaves`. */
const photoEaves = new Map<string, {row: number; eavesM: number; bagM: number; confidence: number}>();
/**
 * The run face with `continuity.measuredEaves` for its photo-eaves pands (--photo-eaves) and the pands placed with a
 * `match.frontEavesM` type (their own skyline cornice near the type's line, else the line); a cornice under 3DBAG's eaves
 * re-pitches the front roof (`frontRoof`).
 */
function withPhotoEaves(intent: ReturnType<typeof runIntent>, types: MatchableType[], evs: PandEvidence[], strip: {height: number; pixelsPerMetre: number}): ReturnType<typeof runIntent> {
  const m = intent.houses.flatMap(h => {
    const ev = evs.find(e => e.pandId === h.pandId), t = types.find(x => x.id === h.type?.type);
    const fe = t && ev ? frontEavesFor(t, ev) : null, bagM = photoEaves.get(h.pandId)?.bagM ?? ev?.eavesM;
    if (fe && ev && bagM !== undefined) {
      if (Math.abs(fe.eavesM - bagM) <= PHOTO_EAVES.minDeltaM && !photoEaves.has(h.pandId)) return [];
      return [{pand: h.pandId, stripRow: Math.round(strip.height - fe.eavesM * strip.pixelsPerMetre), ...(fe.eavesM < bagM ? {frontRoof: {}} : {}),
        evidence: fe.source === 'skyline' ? `auto-place: strip skyline cornice ${fe.eavesM} m within ${FRONT_EAVES.tolM} m of the ${t!.id} line ${t!.match!.frontEavesM} m; 3DBAG/PDOK eaves ${bagM} m`
          : `auto-place: the ${t!.id} cornice line ${fe.eavesM} m (measured on its exemplar strips; this pand's skyline unread); 3DBAG/PDOK eaves ${bagM} m`}];
    }
    const e = photoEaves.get(h.pandId);
    return e ? [{pand: h.pandId, stripRow: e.row, ...(e.eavesM < e.bagM ? {frontRoof: {}} : {}),
      evidence: `auto-place --photo-eaves: strip skyline cornice ${e.eavesM} m (confidence ${e.confidence}) vs 3DBAG/PDOK eaves ${e.bagM} m`}] : [];
  });
  return m.length ? {...intent, continuity: {...intent.continuity, measuredEaves: m}} : intent;
}

async function faceEvidence(faceId: string) {
  const dir = path.join(FACES, faceId);
  const [discovery, strip, uses] = await Promise.all(['discovery', 'strip', 'uses'].map(n => readJson(path.join(dir, `${n}.json`))));
  const raw = await stripRaw(path.join(STAGING, faceId, 'strip.jpg'));
  const evs: PandEvidence[] = [];
  for (const id of discovery.members as string[]) {
    const facts: BuildingFacts = await readJson(path.join(dir, 'pands', id, 'facts.json'));
    const u = uses.pands.find((p: any) => p.pandId === id), span = strip.spans.find((s: any) => s.pandId === id);
    const f0 = facts.fronts[0], eavesM = f0.eavesM >= 6 ? f0.eavesM : facts.heights.dak70pM;
    const ev: PandEvidence = {pandId: id, address: u?.addresses?.[0] ?? `pand ${id.slice(-6)}`, builtYear: facts.heights.builtYear, widthM: r2(f0.widthM), eavesM: r2(eavesM), roofMaxM: r2(facts.heights.roofMaxM), storeys3dbag: facts.heights.storeys,
      groundUses: [...new Set<string>((u?.groundUnits ?? []).map((g: any) => g.use))],
      osm: (u?.osm ?? []).map((b: any) => ({type: b.type, id: b.id, name: b.tags.name, category: b.tags.shop ? `shop=${b.tags.shop}` : b.tags.amenity ? `amenity=${b.tags.amenity}` : b.tags.craft ? `craft=${b.tags.craft}` : b.tags.office ? `office=${b.tags.office}` : b.tags.healthcare ? `healthcare=${b.tags.healthcare}` : undefined})),
      // The bay of the discovered BAG front (bay-outline.ts / intake --bay-outline=auto keep it in facts-bay-outline.json).
      bagBay: frontBump((existsSync(path.join(dir, 'pands', id, 'facts-bay-outline.json')) ? await readJson(path.join(dir, 'pands', id, 'facts-bay-outline.json')) as BuildingFacts : facts).fronts[0])};
    if (span) {
      const px: [number, number] = [Math.max(0, span.px[0]), Math.min(raw.width, span.px[1])];
      const palette = measureStripPalette({rgb: raw.rgb, width: raw.width, height: raw.height, x0: px[0], x1: px[1], pixelsPerMetre: strip.pixelsPerMetre, eavesM});
      const storeys = facts.heights.storeys ?? Math.max(2, Math.round(eavesM / 3.1));
      const lines = Array.from({length: storeys + 1}, (_, k) => r2(k * eavesM / storeys));
      let columns: number | null = null, wall: string | null = null, frontClass: FrontClass | undefined;
      try { const m = measureFacade({image: spanImage(raw, px, strip.pixelsPerMetre, strip.heightM, 0), box: {u0: 0, u1: (px[1] - px[0]) / strip.pixelsPerMetre, v0: 0, v1: eavesM}, lines}); columns = m.columns; wall = m.wall.cells ? m.wall.hex : null; frontClass = m.frontClass; } catch { columns = null; }
      const skyline = measureSkyline({rgb: raw.rgb, width: raw.width, height: raw.height, x0: px[0], x1: px[1], pixelsPerMetre: strip.pixelsPerMetre});
      // The structure reads the body up to the lower of the 3DBAG and the photographed eaves (a gable's shoulder is no wall).
      const structure = measureStripStructure({rgb: raw.rgb, width: raw.width, height: raw.height, x0: px[0], x1: px[1], pixelsPerMetre: strip.pixelsPerMetre,
        eavesM: skyline && skyline.confidence >= 0.6 && skyline.eavesM > 6 ? Math.min(eavesM, skyline.eavesM) : eavesM});
      // --photo-eaves (Helmersbuurt, 2026-10-25): the cornice line the strip skyline reads replaces the 3DBAG/PDOK eaves
      // when it is read under clean sky and differs by more than PHOTO_EAVES.minDeltaM (a mansard top or a rear roof read
      // as the eaves: Eerste Helmersstraat 223 cornice 10.8 m, PDOK eaves 13.05 m); the run faces then carry it as
      // continuity.measuredEaves (roofs from the front).
      if (PHOTO_EAVES.on && skyline && skyline.confidence >= PHOTO_EAVES.minConfidence && skyline.eavesM >= PHOTO_EAVES.minM
        && Math.abs(skyline.eavesM - ev.eavesM) > PHOTO_EAVES.minDeltaM && skyline.eavesM - ev.eavesM <= PHOTO_EAVES.maxRiseM && ev.eavesM - skyline.eavesM <= PHOTO_EAVES.maxDropM) {
        photoEaves.set(id, {row: skyline.eavesRow, eavesM: r2(skyline.eavesM), bagM: ev.eavesM, confidence: skyline.confidence});
        ev.eavesM = r2(skyline.eavesM);
      }
      ev.strip = {date: span.date, px, palette, wall, skyline, ...evidenceShares(raw, px, strip.pixelsPerMetre, eavesM), columns, ...(frontClass ? {frontClass} : {}), doorSide: doorSide(raw, px, strip.pixelsPerMetre), ...(a => ({accentSide: a.side, accentShare: a.share}))(accentSide(raw, px, strip.pixelsPerMetre, eavesM)), structure};
    }
    evs.push(ev);
  }
  return {discovery, strip, uses, raw, evs};
}

/** A face directory for a run of the parent face: members' facts, uses, discovery and the strip cropped to the run. */
export async function writeRunFace(parent: string, runId: string, ids: string[], parentStrip: any, parentUses: any, parentDiscovery: any) {
  const src = path.join(FACES, parent), dst = path.join(FACES, runId), stage = path.join(STAGING, runId);
  await fs.mkdir(dst, {recursive: true}); await fs.mkdir(stage, {recursive: true});
  const facts: {pandId: string; facts: BuildingFacts}[] = [];
  for (const id of ids) {
    await fs.mkdir(path.join(dst, 'pands', id), {recursive: true});
    // Facts only: the raw 3DBAG item stays in the parent face (nothing downstream of intake reads it).
    for (const f of ['facts.json']) if (existsSync(path.join(src, 'pands', id, f))) await fs.copyFile(path.join(src, 'pands', id, f), path.join(dst, 'pands', id, f));
    facts.push({pandId: id, facts: await readJson(path.join(src, 'pands', id, 'facts.json'))});
  }
  const spans = ids.map(id => parentStrip.spans.find((s: any) => s.pandId === id));
  const px0 = Math.max(0, spans[0].px[0]), px1 = Math.min(parentStrip.width, spans.at(-1).px[1]);
  const frame = chunkFrame(facts.map(f => ({id: f.pandId, intent: {} as any, facts: f.facts})));
  const xOf = (q: number[]) => (q[0] - frame.midRD[0]) * frame.uRD[0] + (q[1] - frame.midRD[1]) * frame.uRD[1];
  const image = path.join(stage, 'strip.jpg');
  await sharp(path.join(STAGING, parent, 'strip.jpg')).extract({left: px0, top: 0, width: px1 - px0, height: parentStrip.height}).jpeg({quality: 90}).toFile(image);
  const ppm = parentStrip.pixelsPerMetre, x0M = r2(xOf(facts[0].facts.fronts[0].endpointsRD[0]));
  const strip = {...parentStrip, face: runId, image, width: px1 - px0, x0M, x1M: r2(x0M + (px1 - px0) / ppm), frame: {midRD: frame.midRD, uRD: frame.uRD, nRD: frame.nRD},
    spans: spans.map((s: any) => ({...s, px: [s.px[0] - px0, s.px[1] - px0], x0M: r2(x0M + (s.px[0] - px0) / ppm), x1M: r2(x0M + (s.px[1] - px0) / ppm)})),
    croppedFrom: {face: parent, px: [px0, px1]}};
  await fs.writeFile(path.join(dst, 'strip.json'), JSON.stringify(strip, null, 1) + '\n');
  await fs.writeFile(path.join(dst, 'uses.json'), JSON.stringify({...parentUses, pands: parentUses.pands.filter((p: any) => ids.includes(p.pandId))}, null, 1) + '\n');
  const i0 = parentDiscovery.members.indexOf(ids[0]), i1 = parentDiscovery.members.indexOf(ids.at(-1));
  await fs.writeFile(path.join(dst, 'discovery.json'), JSON.stringify({...parentDiscovery, members: ids, pands: (parentDiscovery.pands ?? []).filter((p: any) => ids.includes(p.pandId)), runOf: parent,
    ends: [{side: 'left', reason: i0 > 0 ? `run of ${parent}: ${parentDiscovery.members[i0 - 1].slice(-6)} held (auto-place.json)` : parentDiscovery.ends[0].reason},
      {side: 'right', reason: i1 < parentDiscovery.members.length - 1 ? `run of ${parent}: ${parentDiscovery.members[i1 + 1].slice(-6)} held (auto-place.json)` : parentDiscovery.ends[1].reason}]}, null, 1) + '\n');
}

/** Debug: the photo mask (at the best shift) beside the model mask, staging/block-face/<run>/likeness/<pand>.png. */
async function debugMasks(runId: string, pand: string, photo: any, model: any, L: LikenessResult) {
  const {cols, rows} = model, pad = Math.round(PAD_M / photo.cell), du = Math.round(L.shift.uM / photo.cell), dv = Math.round(L.shift.vM / photo.cell);
  const col = (m: number) => m === 0 ? [150, 110, 90] : m === 1 ? [40, 90, 200] : m === 2 ? [240, 200, 60] : m === 3 ? [90, 160, 240] : [200, 200, 200];
  const img = Buffer.alloc((cols * 2 + 2) * rows * 3, 255);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const pi = i + pad + du, pj = j + pad - dv, pm = pi >= 0 && pj >= 0 && pi < photo.cols && pj < photo.rows ? photo.mask[pj * photo.cols + pi] : 255;
    img.set(col(pm), (j * (cols * 2 + 2) + i) * 3); img.set(col(model.mask[j * cols + i]), (j * (cols * 2 + 2) + cols + 2 + i) * 3);
  }
  await fs.mkdir(path.join('staging/buurt/likeness', runId), {recursive: true});
  await sharp(img, {raw: {width: cols * 2 + 2, height: rows, channels: 3}}).resize({width: (cols * 2 + 2) * 4, kernel: 'nearest'}).png().toFile(path.join('staging/buurt/likeness', runId, `${pand}.png`));
}

export interface PandLikeness { pandId: string; ncc: number | null; nccRaw: number; shiftM: [number, number]; usable: number; abstain: string | null;
  /** buildingRecipe/likeness.ts on the same span: reported, not gated (its colour clustering fails on dark overcast strips). */
  verdict: LikenessResult['verdict']; reasons: string[]; wall: {photo: string; model: string | null; dL: number | null}; glazing: {photo: number; model: number}; columns: {photo: number | null; model: number | null}; iou: number | null }

/** Likeness of each pand of a compiled run face: the strip span vs the model elevation of the chunk (buildingRecipe/likeness.ts). */
export async function runLikeness(runId: string): Promise<PandLikeness[]> {
  const strip = await readJson(path.join(FACES, runId, 'strip.json')), report = await readJson(path.join(STAGING, runId, 'report.json'));
  const raw = await stripRaw(strip.image), soup = await loadMaterialSoup(path.join(STAGING, runId, 'chunk.glb'));
  // The model at the strip's frame and scale (as review.ts renders it).
  const {width: W, height: H, x0M, x1M, heightM: top} = strip;
  const [png] = await renderModels([{file: path.join(STAGING, runId, 'chunk.glb')}], [{eye: [(x0M + x1M) / 2, top / 2, 200], target: [(x0M + x1M) / 2, top / 2, 0], fov: 30, width: W, height: H,
    ortho: [-(x1M - x0M) / 2, (x1M - x0M) / 2, top / 2, -top / 2], background: '#9fb8cf', noGround: true}]);
  const modelRgb = new Uint8Array(await sharp(png).resize(W, H, {fit: 'fill'}).removeAlpha().raw().toBuffer());
  const P = soup.positions;
  return report.perPand.map((pp: any, i: number) => {
    const s = strip.spans[i], w = (s.px[1] - s.px[0]) / strip.pixelsPerMetre, x0 = s.x0M;
    // the front plane: the 98th percentile of z of the vertices over the span
    const zs: number[] = [];
    for (let v = 0; v < P.length / 3; v++) if (P[v * 3] >= x0 + 0.2 && P[v * 3] <= x0 + w - 0.2 && P[v * 3 + 1] > 3) zs.push(P[v * 3 + 2]);
    zs.sort((a, b) => a - b);
    const zFront = zs.length ? zs[Math.floor(zs.length * 0.98)] : 0;
    const heights: number[] = pp.storeyHeightsM, lines = [0]; for (const h of heights) lines.push(r2(lines.at(-1)! + h));
    const box = {u0: 0, u1: w, v0: 0, v1: pp.eavesM};
    const image = spanImage(raw, s.px, strip.pixelsPerMetre, strip.heightM, PAD_M);
    const photo = measureFacade({image, box: {u0: 0, u1: w + 2 * PAD_M, v0: -PAD_M, v1: pp.eavesM + PAD_M}, lines});
    const model = modelElevation(soup, {o: [x0, 0, zFront - 1], r: [1, 0, 0], n: [0, 0, 1], uMin: 0, uMax: w}, box, lines, 0.1);
    const L = compareLikeness({photo, padCells: Math.round(PAD_M / photo.cell), model, lines});
    if (process.env.AUTO_PLACE_DEBUG) debugMasks(runId, pp.pand, photo, model, L);
    const sl = spanLikeness({photoRgb: raw.rgb, modelRgb, width: W, height: H, px: s.px, eavesM: pp.eavesM, pixelsPerMetre: strip.pixelsPerMetre});
    return {pandId: pp.pand, ncc: sl.ncc, nccRaw: sl.nccRaw ?? 0, shiftM: [sl.dx, sl.dy], usable: sl.usable, abstain: sl.abstain, verdict: L.verdict, reasons: L.reasons, wall: {photo: L.wall.photo, model: L.wall.model, dL: L.wall.dL}, glazing: {photo: r2(L.glazing.photoMean), model: r2(L.glazing.modelMean)}, columns: {photo: L.columns.photo, model: L.columns.model}, iou: L.iou};
  });
}

if (process.argv[1]?.endsWith('block-face/auto-place.ts')) {
  const buurt = arg('buurt') ?? 'bellamybuurt-zuid', district = arg('district') ?? 'bellamy', only = arg('only')?.split(',');
  // --photo-decides (Rivierenbuurt, 2026-10-16): where facts and strip readings cannot tell two types of one row apart
  // (Boterdiepstraat's flat and erker fronts share year, width, eaves and roof; the sunlit strip reads no door or accent
  // side), the edge NCC of every candidate (type x mirroring) decides instead of holding the pand.
  const photoDecides = process.argv.includes('--photo-decides');
  // --row-exposure: one trim-normalisation gain per face (autoPlace.ts rowExposure) instead of one per pand; =date: one per strip date.
  const rowExposureOn = process.argv.some(a => a === '--row-exposure' || a === '--row-exposure=date');
  const variantKey = (d: Placed) => `${d.typeId}${d.house.type?.mirror ? '~m' : ''}`;
  const doc = await readJson(path.join('scripts/block-face/buurten', `${buurt}.json`));
  let types = await loadTypes(district);
  // Calibration: every pand placed as one type, no vetoes, no gate (--force-type=<id> --no-gate); output under staging/buurt/calibrate.
  const forced = arg('force-type');
  if (forced) types = types.filter(t => t.id === forced).map(t => ({...t, fit: undefined, match: {years: [0, 9999], eavesM: looseEaves(t), ...(t.match?.crowns ? {crowns: t.match.crowns} : {}), ...(t.match?.mirrorForAccent ? {mirrorForAccent: t.match.mirrorForAccent} : {}), ...(t.match?.baysByWidth ? {baysByWidth: t.match.baysByWidth} : {})}} as MatchableType));
  const typeIds = types.map(t => t.id);
  // Pands held after a review of their run's strip sheet (scripts/block-face/buurten/<buurt>-review-holds.json).
  const holdsFile = path.join('scripts/block-face/buurten', `${buurt}-review-holds.json`);
  const reviewHolds = new Map<string, string>(existsSync(holdsFile) ? (await readJson(holdsFile)).holds.map((h: {pandId: string; reason: string}) => [h.pandId, h.reason]) : []);
  // Crowns a reviewer pinned after reading the strip (blockFace/reviewCrowns.ts): flat crowns the skyline cannot tell apart.
  const crownsFile = path.join('scripts/block-face/buurten', `${buurt}-review-crowns.json`);
  const crownPins: CrownPin[] = existsSync(crownsFile) ? (await readJson(crownsFile)).pins : [];
  const pinProblems = crownPinProblems(crownPins, types);
  if (pinProblems.length) throw Error(`${crownsFile}: ${pinProblems.join('; ')}`);
  // Types a reviewer restricted a face to (blockFace/reviewCrowns.ts typesForFace): rows the facts and edges cannot settle.
  const typesFile = path.join('scripts/block-face/buurten', `${buurt}-review-types.json`);
  const typesDoc = existsSync(typesFile) ? await readJson(typesFile) : {};
  const typePins: TypePin[] = typesDoc.pins ?? [], mirrorPins: MirrorPin[] = typesDoc.mirrors ?? [];
  const typePinErrs = [...typePinProblems(typePins, types), ...mirrorPinProblems(mirrorPins, types)];
  if (typePinErrs.length) throw Error(`${typesFile}: ${typePinErrs.join('; ')}`);
  const library = types;
  // Door sides a reviewer pinned where the strip's door was not read (blockFace/reviewDoors.ts).
  const doorsFile = path.join('scripts/block-face/buurten', `${buurt}-review-doors.json`);
  const doorPins: DoorPin[] = existsSync(doorsFile) ? (await readJson(doorsFile)).pins : [];
  const doorPinErrors = doorPinProblems(doorPins, types);
  if (doorPinErrors.length) throw Error(`${doorsFile}: ${doorPinErrors.join('; ')}`);
  // Palettes a reviewer re-measured where the strip misread the wall (blockFace/reviewPalettes.ts).
  const palettesFile = path.join('scripts/block-face/buurten', `${buurt}-review-palettes.json`);
  const palettePins: PalettePin[] = existsSync(palettesFile) ? (await readJson(palettesFile)).pins : [];
  const palettePinErrors = palettePinProblems(palettePins, types);
  if (palettePinErrors.length) throw Error(`${palettesFile}: ${palettePinErrors.join('; ')}`);
  // Gate floors a reviewer set after judging a sheet on a hazy strip (blockFace/reviewPalettes.ts).
  const acceptsFile = path.join('scripts/block-face/buurten', `${buurt}-review-accepts.json`);
  const acceptPins: AcceptPin[] = existsSync(acceptsFile) ? (await readJson(acceptsFile)).pins : [];
  const acceptPinErrors = acceptPinProblems(acceptPins, types);
  if (acceptPinErrors.length) throw Error(`${acceptsFile}: ${acceptPinErrors.join('; ')}`);
  const {compileFace} = await import('./compile.ts');
  const {reviewFace} = process.argv.includes('--review') ? await import('./review.ts') : {reviewFace: null};
  const summary: any[] = [];
  const t0 = performance.now();
  // --row-exposure=date: the trim gains of every face of this run, pooled per strip date, before any face is placed.
  const dateGains = new Map<string, number[][]>();
  if (process.argv.includes('--row-exposure=date')) for (const f of doc.faces) {
    if ((only && !only.includes(f.id)) || !existsSync(path.join(FACES, f.id, 'strip.json')) || !existsSync(path.join(STAGING, f.id, 'strip.jpg'))) continue;
    const {strip, evs} = await faceEvidence(f.id);
    dateGains.set(strip.date, [...(dateGains.get(strip.date) ?? []), ...trimGains(evs)]);
  }
  for (const f of doc.faces) {
    // This face's library: every type, or the ones a reviewer pinned it to (the run intents still list the whole library).
    const types = typesForFace(f.id, library, typePins);
    // `covered` by an authored face; a face this buurt generated itself (the face or its runs) is not a cover.
    const coverIntent = f.covered && existsSync(path.join(FACES, f.covered, 'intent.json')) ? await readJson(path.join(FACES, f.covered, 'intent.json')) : null;
    const coveredByOther = !!coverIntent && !String(coverIntent.authoring?.author ?? '').startsWith('auto-place');
    if (coveredByOther || (only && !only.includes(f.id))) continue;
    if (!existsSync(path.join(FACES, f.id, 'strip.json')) || !existsSync(path.join(STAGING, f.id, 'strip.jpg'))) { summary.push({face: f.id, status: 'no intake'}); continue; }
    const tf = performance.now();
    if (types !== library) console.log(`${f.id}: types pinned to ${types.map(t => t.id).join(', ')}`);
    const {discovery, strip, uses, evs} = await faceEvidence(f.id);
    if (rowExposureOn) {
      const pooled = dateGains.get(strip.date), g = rowExposure(evs, pooled && pooled.length >= 8 ? medianGain(pooled) : undefined);
      if (g) console.log(`${f.id}: row exposure gain ${g.join('/')} over ${evs.filter(e => e.strip?.wallOwnGain).length} pands${pooled ? ` (pooled over ${pooled.length} pands of ${strip.date})` : ''}`);
    }
    // Pass 1: match. Pass 2+: compile the runs, hold the pands that fail the likeness gate, repeat until stable.
    const decisions: Decision[] = evs.map(ev => {
      const hold = reviewHolds.get(ev.pandId);
      if (hold) return {kind: 'held', pandId: ev.pandId, address: ev.address, stage: 'review', reason: `review: ${hold}`};
      return decidePand(typesForPand(f.id, ev.pandId, library, typePins), ev, `${f.id.split('-')[0]}-${ev.pandId.slice(-6)}`, strip.date);
    });
    if (crownPins.length) { const pinned = applyCrownPins(f.id, decisions, crownPins, types); if (pinned.length) console.log(`${f.id}: crown pinned on ${pinned.length} pand(s)`); }
    if (doorPins.length) { const pinned = applyDoorPins(decisions, doorPins, types); if (pinned.length) console.log(`${f.id}: door pinned on ${pinned.length} pand(s)`); }
    if (palettePins.length) { const pinned = applyPalettePins(decisions, palettePins); if (pinned.length) console.log(`${f.id}: palette pinned on ${pinned.length} pand(s)`); }
    fillPairs(decisions, types);
    if (mirrorPins.length) { const pinned = applyMirrorPins(decisions, mirrorPins); if (pinned.length) console.log(`${f.id}: side pinned on ${pinned.length} pand(s)`); }
    const rowSet = rowCoherence(decisions, types, evs, strip.date);
    const ribbonHeld = ribbonRowHolds(decisions, types, evs);
    if (ribbonHeld.length) console.log(`${f.id}: era guard held ${ribbonHeld.length} pand(s) of a ribbon-window row`);
    const challengers = new Map<string, Record<string, number | null>>(), switched = new Set<string>();
    const likeness = new Map<string, PandLikeness>(), compiled = new Map<string, {passed: boolean; triangles: number}>();
    let runFaces: {id: string; ids: string[]}[] = [];
    for (let pass = 0; pass < 3; pass++) {
      const {runs, orphans} = placedRuns(decisions);
      for (const o of orphans) { const k = decisions.findIndex(d => d.pandId === o.pandId); decisions[k] = {kind: 'held', ...o}; }
      runFaces = runs.map((run, k) => ({id: runs.length === 1 && run.length === discovery.members.length ? f.id : `${f.id}-r${k + 1}`, ids: run.map(p => p.pandId)}));
      for (const [k, rf] of runFaces.entries()) {
        if (rf.id !== f.id) await writeRunFace(f.id, rf.id, rf.ids, strip, uses, discovery);
        const intent = withPhotoEaves(runIntent({id: rf.id, street: f.street, stripDate: strip.date, stripImage: rf.id === f.id ? strip.image : path.join(STAGING, rf.id, 'strip.jpg'), types: typeIds, run: runs[k],
          note: `auto-placed from the ${district} library (buurt ${doc.buurt}); scores and holds in scripts/block-face/faces/${f.id}/auto-place.json`}), types, evs, strip);
        await fs.writeFile(path.join(FACES, rf.id, 'intent.json'), JSON.stringify(intent, null, 1) + '\n');
      }
      if (process.argv.includes('--no-compile')) break;
      let changed = false;
      for (const [k, rf] of runFaces.entries()) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const {report} = await compileFace(rf.id);
            compiled.set(rf.id, {passed: report.passed, triangles: report.triangles.chunk});
            for (const l of await runLikeness(rf.id)) likeness.set(l.pandId, l);
            break;
          } catch (e) {
            const msg = (e as Error).message.slice(0, 300);
            // A skyline-picked crown that the kit cannot fit on this pand (Hasebroekstraat 52-54: "Dormer escapes surveyed
            // footprint") falls back to the type's default crown once; a second failure holds the run.
            // The fallback crown: the type's first crown without dormers (a dormer that will not fit the pand's footprint is
            // the common failure), else the type default.
            const fallback = (p: Placed) => { const t = types.find(x => x.id === p.typeId)!; return Object.entries(t.crowns).find(([, c]) => !(c as {dormers?: number}).dormers)?.[0]; };
            const crownOf = (p: Placed) => p.house.type?.crown ?? Object.keys(types.find(x => x.id === p.typeId)!.crowns)[0];
            const picked = runs[k].filter(p => fallback(p) !== undefined && crownOf(p) !== fallback(p));
            if (attempt === 0 && picked.length) {
              console.log(`${rf.id}: COMPILE FAILED ${msg}; retrying with dormer-free crowns on ${picked.length} pand(s)`);
              for (const p of picked) { p.notes.push(`crown ${crownOf(p)} -> ${fallback(p)}: the run did not compile with it (${msg.slice(0, 80)})`); p.house.type!.crown = fallback(p); }
              const intent = withPhotoEaves(runIntent({id: rf.id, street: f.street, stripDate: strip.date, stripImage: rf.id === f.id ? strip.image : path.join(STAGING, rf.id, 'strip.jpg'), types: typeIds, run: runs[k],
                note: `auto-placed from the ${district} library (buurt ${doc.buurt}); scores and holds in scripts/block-face/faces/${f.id}/auto-place.json`}), types, evs, strip);
              await fs.writeFile(path.join(FACES, rf.id, 'intent.json'), JSON.stringify(intent, null, 1) + '\n');
              continue;
            }
            console.log(`${rf.id}: COMPILE FAILED ${msg}`); compiled.set(rf.id, {passed: false, triangles: 0}); for (const id of rf.ids) likeness.delete(id);
            break;
          }
        }
      }
      if (process.argv.includes('--no-gate')) break;
      // Challengers (first pass): every other library type placed on the same runs, without vetoes. The photo must not
      // prefer one of them over the placed type by more than `challengeMargin` (blockFace/stripLikeness.ts).
      // --photo-decides: each placement's own NCC is a candidate too, keyed by type and mirroring (`<type>~m` = mirrored).
      if (pass === 0 && photoDecides) for (const d of decisions) if (d.kind === 'placed' && likeness.has(d.pandId)) challengers.set(d.pandId, {...challengers.get(d.pandId), [variantKey(d)]: likeness.get(d.pandId)!.ncc});
      // With --photo-decides a type that mirrors (match.mirrorForDoor / mirrorForAccent) is also tried flipped, on every
      // placed pand, its own included: a row whose door and accent sides do not read (sunlit or washed-out strips) is
      // mirrored by what the edges of the photo prefer.
      const variants = types.flatMap((ct, ci) => [{ct, ci, flip: false}, ...(photoDecides && (ct.match?.mirrorForDoor || ct.match?.mirrorForAccent) ? [{ct, ci, flip: true}] : [])]);
      if (pass === 0 && !forced && !process.argv.includes('--no-challenge')) for (const {ct, ci, flip} of variants) {
        const loose = {...ct, fit: undefined, match: {years: [0, 9999] as [number, number], eavesM: looseEaves(ct), ...(ct.match?.crowns ? {crowns: ct.match.crowns} : {}), ...(ct.match?.baysByWidth ? {baysByWidth: ct.match.baysByWidth} : {}), ...(ct.match?.mirrorForDoor ? {mirrorForDoor: ct.match.mirrorForDoor} : {}), ...(ct.match?.mirrorForAccent ? {mirrorForAccent: ct.match.mirrorForAccent} : {})}} as MatchableType;
        const cd: Decision[] = decisions.map((d, k) => d.kind !== 'placed' || (d.typeId === ct.id && !flip) ? d : d.typeId === ct.id ? structuredClone(d) : decidePand([loose], {...evs[k], strip: evs[k].strip && {...evs[k].strip!, accentSide: evs[k].strip!.accentSide ?? 'right'}}, d.house.slug, strip.date));
        if (process.env.AUTO_PLACE_DEBUG) for (const [k, d] of cd.entries()) if (d.kind === 'held' && decisions[k].kind === 'placed') console.log(`  challenger ${ct.id}${flip ? '~m' : ''} on ${d.pandId.slice(-6)}: held, ${d.reason}`);
        if (!cd.some((d, k) => d.kind === 'placed' && decisions[k].kind === 'placed' && ((decisions[k] as Placed).typeId !== ct.id || flip))) continue;
        fillPairs(cd, [loose]);
        if (flip) for (const d of cd) if (d.kind === 'placed' && d.typeId === ct.id) { if (d.house.type!.mirror) delete d.house.type!.mirror; else d.house.type!.mirror = true; }
        const {runs} = placedRuns(cd);
        for (const [k, run] of runs.entries()) {
          const id = `${f.id}-x${ci + 1}${flip ? 'm' : ''}${k + 1}`;
          await writeRunFace(f.id, id, run.map(p => p.pandId), strip, uses, discovery);
          await fs.writeFile(path.join(FACES, id, 'intent.json'), JSON.stringify(runIntent({id, street: f.street, stripDate: strip.date, stripImage: path.join(STAGING, id, 'strip.jpg'), types: typeIds, run, note: `challenger ${ct.id}${flip ? ' (mirrored)' : ''}`}), null, 1) + '\n');
          try {
            await compileFace(id);
            for (const l of await runLikeness(id)) {
              const own = decisions.find(d => d.pandId === l.pandId) as Placed | undefined, mine = run.find(p => p.pandId === l.pandId);
              if (photoDecides && mine) challengers.set(l.pandId, {...challengers.get(l.pandId), [variantKey(mine)]: l.ncc});
              else if (own?.typeId !== ct.id) challengers.set(l.pandId, {...challengers.get(l.pandId), [ct.id]: l.ncc});
            }
          } catch (e) { console.log(`${id}: challenger ${ct.id} did not compile: ${(e as Error).message.slice(0, 160)}`); }
          await fs.rm(path.join(FACES, id), {recursive: true}); await fs.rm(path.join(STAGING, id), {recursive: true, force: true});
        }
      }
      // A pand a reviewer pinned to some types: only those types challenge it.
      if (pass === 0) for (const ev of evs) {
        const own = typesForPand(f.id, ev.pandId, types, typePins), c = challengers.get(ev.pandId);
        if (own !== types && c) challengers.set(ev.pandId, Object.fromEntries(Object.entries(c).filter(([key]) => own.some(t => t.id === key.split('~')[0]))));
      }
      // --photo-decides: a placement whose candidate (another plausible type, or the same type mirrored) the photo's edges
      // prefer by more than the challenge margin is switched to it, once per pand; the next pass compiles and gates it.
      if (photoDecides && pass === 0) for (const [k, d] of decisions.entries()) {
        if (d.kind !== 'placed' || switched.has(d.pandId) || rowSet.includes(d.pandId)) continue; // row coherence decided these
        const l = likeness.get(d.pandId), own = variantKey(d);
        if (!l || l.ncc === null) continue;
        // A side the evidence set (door or accent read, BAG bay, a paired neighbour's door) is not reopened by a same-type flip.
        const sideKnown = d.notes.some(n => /^(door|accent) (left|right)|paired with|the opposite of|^door reviewer pin/.test(n));
        // Where BAG draws the pand's erker, its place in the outline is fact and the edges are not: a candidate type whose
        // `bagBay` criterion disagrees is no candidate (Boterdiepstraat 40: the strip sits 0.4 m off the BAG party lines,
        // so the edges preferred an erker against the party wall to BAG's erker 1 m from it, 0.48 vs 0.35).
        // Without a BAG bay the edges may move an erker but not add or remove one (Boterdiepstraat 52 read closer to the odd
        // side's erker type than to its own flat front, 0.44 vs 0.35): rowCoherence's rhythm rule does that from BAG anchors.
        const bagAgrees = (t: MatchableType) => evs[k].bagBay ? (scoreType(t, evs[k]).criteria.find(c => c.key === 'bag-bay')?.score ?? 1) === 1
          : !!t.match?.bagBay === !!types.find(x => x.id === d.typeId)?.match?.bagBay;
        const best = Object.entries(challengers.get(d.pandId) ?? {}).filter(([key, v]) => key !== own && !(sideKnown && key.split('~')[0] === d.typeId) && v !== null && scoreType(types.find(t => t.id === key.split('~')[0])!, evs[k]).veto.length === 0 && bagAgrees(types.find(t => t.id === key.split('~')[0])!))
          .sort((a, b) => b[1]! - a[1]!)[0];
        if (!best || best[1]! <= l.ncc + STRIP_LIKENESS.challengeMargin) continue;
        const [typeId, m] = best[0].split('~'), t = types.find(x => x.id === typeId)!;
        const loose = {...t, match: {...t.match!, years: [0, 9999] as [number, number]}} as MatchableType;
        const nd = decidePand([loose], evs[k], d.house.slug, strip.date);
        if (nd.kind !== 'placed') continue;
        nd.typeId = t.id; nd.house.type!.type = t.id;
        if (m) nd.house.type!.mirror = true; else delete nd.house.type!.mirror;
        nd.notes = [...nd.notes.filter(x => !/^(accent|door) /.test(x)), `photo decides: ${best[0]} edge NCC ${best[1]} vs ${own} ${l.ncc}`];
        decisions[k] = nd; switched.add(d.pandId); changed = true;
      }
      // The gate: FAIL holds; NO EVIDENCE holds unless a same-type neighbour in the run passes (row evidence).
      for (const [k, d] of decisions.entries()) {
        if (d.kind !== 'placed') continue;
        // Switched this pass: its likeness is the old placement's; the next pass compiles and gates the new one.
        if (pass === 0 && switched.has(d.pandId)) continue;
        const l = likeness.get(d.pandId);
        if (!l) { decisions[k] = {kind: 'held', pandId: d.pandId, address: d.house.address, stage: 'likeness', reason: 'run did not compile'}; changed = true; continue; }
        const floor = acceptFloorFor(d.pandId, d.typeId, acceptPins);
        const g = placementGate({ncc: l.ncc, abstain: l.abstain}, floor);
        if (floor !== undefined && g.gate === 'pass' && l.ncc !== null && l.ncc < STRIP_LIKENESS.minNcc) d.notes.push(`edge NCC ${l.ncc} passed on the reviewer floor ${floor}`);
        // A challenger holds the placement only when it is a plausible alternative (no year/frontage veto of its own);
        // an implausible type that reads closer is noted (the edge NCC differences are 0.05-0.15, the facts are not).
        // --photo-decides: candidates were already weighed (a switched pand's own variant and its old one are in the map);
        // a placement is never held for a rival here, only switched once above.
        const better = photoDecides ? [] : Object.entries(challengers.get(d.pandId) ?? {}).filter(([, v]) => v !== null && l.ncc !== null && v > l.ncc + STRIP_LIKENESS.challengeMargin).sort((a, b) => b[1]! - a[1]!);
        const plausible = (id: string) => scoreType(types.find(t => t.id === id)!, evs[k]).veto.length === 0;
        const rival = better.find(([id]) => plausible(id));
        for (const [id, v] of better) if (!plausible(id)) d.notes.push(`the edges read closer to ${id} (${v} vs ${l.ncc}), vetoed by its facts`);
        if (g.gate === 'pass' && rival) { decisions[k] = {kind: 'held', pandId: d.pandId, address: d.house.address, stage: 'likeness', reason: `the photo prefers ${rival[0]} (edge NCC ${rival[1]} vs ${l.ncc} for ${d.typeId})`}; changed = true; }
        else if (g.gate === 'hold') { decisions[k] = {kind: 'held', pandId: d.pandId, address: d.house.address, stage: 'likeness', reason: `edge NCC ${l.ncc} < ${STRIP_LIKENESS.minNcc} (photo vs model body; likeness.ts ${l.verdict}${l.reasons.length ? ': ' + l.reasons.join('; ') : ''})`}; changed = true; }
        else if (g.gate === 'no-evidence') {
          const mates = [decisions[k - 1], decisions[k + 1]].filter(x => x?.kind === 'placed' && x.typeId === d.typeId && likeness.get(x.pandId) !== undefined && placementGate({ncc: likeness.get(x.pandId)!.ncc, abstain: likeness.get(x.pandId)!.abstain}).gate === 'pass');
          if (!mates.length) { decisions[k] = {kind: 'held', pandId: d.pandId, address: d.house.address, stage: 'likeness', reason: `no photo evidence (${l.abstain}) and no passing same-type neighbour`}; changed = true; }
          else d.notes.push(`no photo evidence of its own (${l.abstain}); placed on row evidence from ${mates.map(m => m!.pandId.slice(-6)).join(', ')}`);
        }
      }
      if (!changed) break;
      // Stale run directories of this pass are rewritten next pass; remove those that no longer exist at the end.
    }
    // Remove run directories of earlier passes that are no longer runs.
    const keep = new Set(runFaces.map(r => r.id));
    for (const d of (await fs.readdir(FACES)).filter(d => d.startsWith(`${f.id}-r`) && !keep.has(d))) { await fs.rm(path.join(FACES, d), {recursive: true}); await fs.rm(path.join(STAGING, d), {recursive: true, force: true}); }
    if (!keep.has(f.id)) await fs.rm(path.join(FACES, f.id, 'intent.json'), {force: true});
    if (reviewFace) for (const rf of runFaces) if (compiled.get(rf.id)) { try { await reviewFace(rf.id); } catch (e) { console.log(`${rf.id}: review failed ${(e as Error).message.slice(0, 200)}`); } }
    const out = {face: f.id, street: f.street, library: district, stripDate: strip.date, seconds: r2((performance.now() - tf) / 1000), thresholds: AUTO_PLACE,
      runs: runFaces.map(r => ({face: r.id, pands: r.ids, ...compiled.get(r.id)})),
      pands: decisions.map((d, k) => {
        const ev = evs[k], l = likeness.get(d.pandId), base = {pandId: d.pandId, address: ev.address, builtYear: ev.builtYear, widthM: ev.widthM, eavesM: ev.eavesM, storeys3dbag: ev.storeys3dbag, bagBay: ev.bagBay ?? null,
          strip: ev.strip ? {wall: ev.strip.wall, wallRaw: ev.strip.palette.wall, skyline: ev.strip.skyline, stucco: ev.strip.palette.stucco, bands: ev.strip.palette.bandRunsM.length, columns: ev.strip.columns, frontClass: ev.strip.frontClass ?? null, doorSide: ev.strip.doorSide, accentSide: ev.strip.accentSide, accentShare: ev.strip.accentShare,
            structure: ev.strip.structure ? {bayWidthM: ev.strip.structure.bayWidthM, bayCentre: ev.strip.structure.bayCentre, balconies: ev.strip.structure.balconies, why: ev.strip.structure.balconyWhy, openAxes: ev.strip.structure.openAxes, slabs: ev.strip.structure.slabs} : null, voidShare: ev.strip.voidShare, foliageShare: ev.strip.foliageShare} : null};
        return d.kind === 'placed' ? {...base, status: 'placed', type: d.typeId, score: d.score, runnerUp: d.runnerUp, placement: d.house.type, notes: d.notes, likeness: l ?? null, challengers: challengers.get(d.pandId) ?? {}}
          : {...base, status: 'held', stage: d.stage, reason: d.reason, ...(d.best ? {best: {type: d.best.typeId, score: d.best.score, veto: d.best.veto, criteria: d.best.criteria}} : {}), likeness: l ?? null, challengers: challengers.get(d.pandId) ?? {}};
      })};
    if (forced) { await fs.mkdir('staging/buurt/calibrate', {recursive: true}); await fs.writeFile(path.join('staging/buurt/calibrate', `${f.id}--${forced}.json`), JSON.stringify(out, null, 1) + '\n'); }
    else await fs.writeFile(path.join(FACES, f.id, 'auto-place.json'), JSON.stringify(out, null, 1) + '\n');
    const placed = out.pands.filter((p: any) => p.status === 'placed').length;
    console.log(`${f.id}: ${placed}/${out.pands.length} placed in ${runFaces.length} run(s) ${runFaces.map(r => r.id).join(' ')} (${out.seconds} s)`);
    for (const p of out.pands as any[]) console.log(`  ${p.pandId.slice(-6)} ${String(p.address).padEnd(26)} ${p.status === 'placed' ? `${p.type} ${p.score} | NCC ${p.likeness?.ncc ?? '-'} (raw ${p.likeness?.nccRaw ?? '-'}) ${p.notes?.join('; ') ?? ''}` : `HELD ${p.stage}: ${p.reason}`}`.slice(0, 260));
    summary.push({face: f.id, street: f.street, pands: out.pands.length, placed, held: out.pands.length - placed, runs: out.runs, seconds: out.seconds,
      byType: Object.fromEntries([...new Set(out.pands.filter((p: any) => p.type).map((p: any) => p.type))].map(t => [t, out.pands.filter((p: any) => p.type === t).length])),
      holds: Object.fromEntries(['evidence', 'match', 'likeness', 'run', 'review'].map(s => [s, out.pands.filter((p: any) => p.stage === s).length]))});
  }
  const file = path.join('scripts/block-face/buurten', `${buurt}-placement.json`);
  const prev = existsSync(file) ? await readJson(file) : {faces: []};
  const faces = [...prev.faces.filter((x: any) => !summary.some(s => s.face === x.face)), ...summary].sort((a, b) => a.face.localeCompare(b.face));
  await fs.writeFile(file, JSON.stringify({buurt, library: district, generatedAt: new Date().toISOString(), seconds: r2((performance.now() - t0) / 1000),
    totals: {faces: faces.filter((x: any) => x.pands).length, pands: faces.reduce((a: number, x: any) => a + (x.pands ?? 0), 0), placed: faces.reduce((a: number, x: any) => a + (x.placed ?? 0), 0)}, faces}, null, 1) + '\n');
  console.log(`${file}: ${summary.length} faces this run`);
  await closeRenderer();
}
