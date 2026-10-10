/**
 * Street-survey catalogue: block faces, per-house recipes and the street pand table,
 * with small committed thumbnails (strip photo vs model ortho), for street-surveys.html.
 *
 *   node --import tsx scripts/street-surveys/build.ts [--review-out=artifacts/street-surveys]
 *
 * Reads:
 *   scripts/block-face/faces/<face>/{intent,discovery,strip}.json     face, houses, shops, schema limits
 *   staging/block-face/<face>/{strip.jpg,report.json,chunk.glb}       strip photo; compile report (rears); held-face GLB
 *     (strip.jpg from scripts/block-face/intake.ts, report/chunk from scripts/block-face/compile.ts without --install)
 *   staging/pand-reference/<pand>/front.jpg                           per-house reference photo (npm run pand-reference)
 *   public/canal-drive/ordinary-buildings-data/{catalogue,chunks}.json what is installed
 *   scripts/street-surveys/streets/<street>.json                      every BAG pand on the street (street-pands.ts)
 *   scripts/street-surveys/reviews/<street>.json                      LOOKED-at render-vs-photo defects
 * Writes public/canal-drive/street-surveys-data/{surveys.json,thumbs/*.webp}; with --review-out also
 * full-width photo-over-model review images (untracked) for a person or agent to look at.
 */
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {renderModels, closeRenderer, type RenderView} from '../building-recipes/render.ts';
import {addressRange, pandRows, recipeStatus, type ChunkRef, type FaceRef, type RecipeRef} from '../../src/canalRecall/streetSurveys/classify.ts';
import type {FaceStatus, StreetSurvey, StreetSurveyData, SurveyFace, SurveyHouse, SurveyRecipeHouse, Thumb} from '../../src/canalRecall/streetSurveys/types.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const RENDER = true; // thumbnails are part of the output; there is no data-only mode
const REVIEW_OUT = arg('review-out');
const FACES = 'scripts/block-face/faces', STAGING = 'staging/block-face', PANDREF = 'staging/pand-reference';
const DATA = 'public/canal-drive/ordinary-buildings-data', OUT = 'public/canal-drive/street-surveys-data', THUMBS = path.join(OUT, 'thumbs');
const THUMB_W = 760, HOUSE_H = 420, QUALITY = 58, SKY = '#9fb8cf';

/** Why a compiled face is not installed. Source: HISTORY.md "Bilderdijkstraat even side 72–166 installed" (2026-10-10). */
const HOLD_REASONS: Record<string, string> = {
  'bilder-161281-157756': 'Held: a street tree hides the fronts of nos. 113–115 on the photo strip, so the intent is not evidenced. Gates pass.',
  'bilder-157757-164549': 'Held: 3DBAG reads a dormer/tower top as the eaves, ~3.4 m above the photo cornice — more than a photo-trusted cornice group may bridge (2.5 m). Gates pass.',
  'bilder-236022-167243': 'Held: 3DBAG reads a dormer/tower top as the eaves, ~3.4 m above the photo cornice — more than a photo-trusted cornice group may bridge (2.5 m). Gates pass.',
};
/** Pands outside the survey programme on purpose. Source: TODO.md "Bilderdijkstraat faces". */
const PAND_NOTES: Record<string, string> = {
  '0363100012236799': 'Nos. 155–167: large-building tier (generic facade system), not a canal-house survey.',
  '0363100012152566': 'No. 169 (1979, with Kinkerstraat 76–84): large-building tier, not a canal-house survey.',
  '0363100012167348': 'Nos. 66–70: not yet authored as a face (TODO).',
};

const readJson = async <T = any>(file: string): Promise<T> => JSON.parse(await fs.readFile(file, 'utf8'));
const maybeJson = async <T = any>(file: string): Promise<T | undefined> => existsSync(file) ? readJson<T>(file) : undefined;

async function writeThumb(input: Buffer, name: string, width?: number, height?: number): Promise<Thumb & {buffer: Buffer}> {
  const img = sharp(input).resize(width ?? null, height ?? null, {fit: 'inside', withoutEnlargement: true});
  const buffer = await img.webp({quality: QUALITY, effort: 6}).toBuffer();
  const meta = await sharp(buffer).metadata();
  await fs.writeFile(path.join(THUMBS, name), buffer);
  return {src: `./street-surveys-data/thumbs/${name}`, width: meta.width!, height: meta.height!, caption: '', buffer};
}

async function reviewImage(photo: Buffer, model: Buffer, name: string, width = 1400) {
  if (!REVIEW_OUT) return;
  await fs.mkdir(REVIEW_OUT, {recursive: true});
  const a = await sharp(photo).resize(width).png().toBuffer(), b = await sharp(model).resize(width).png().toBuffer();
  const ha = (await sharp(a).metadata()).height!, hb = (await sharp(b).metadata()).height!;
  await sharp({create: {width, height: ha + hb + 8, channels: 3, background: '#ffffff'}})
    .composite([{input: a, top: 0, left: 0}, {input: b, top: ha + 8, left: 0}]).png().toFile(path.join(REVIEW_OUT, `${name}.png`));
}

/** Orthographic front of a GLB in a frontage/chunk frame (x along the face, y up, front facing +z). */
function frontOrtho(bounds: {min: number[]; max: number[]}, pxPerM: number): RenderView {
  const x0 = bounds.min[0] - 0.4, x1 = bounds.max[0] + 0.4, top = bounds.max[1] + 0.6, w = x1 - x0;
  return {eye: [(x0 + x1) / 2, top / 2, bounds.max[2] + 200], target: [(x0 + x1) / 2, top / 2, bounds.max[2] - 1], fov: 30,
    width: Math.round(w * pxPerM), height: Math.round(top * pxPerM), ortho: [-w / 2, w / 2, top / 2, -top / 2], background: SKY, noGround: true};
}

const catalogue = await readJson(`${DATA}/catalogue.json`);
const chunkManifest = await readJson(`${DATA}/chunks.json`);
const chunks: ChunkRef[] = chunkManifest.chunks.map((c: any) => ({id: c.id, pandIds: c.pands.map((p: any) => p.pandId)}));
const recipeEntries = catalogue.models.filter((m: any) => m.category === 'street-survey');
const recipes: RecipeRef[] = recipeEntries.map((m: any) => ({id: m.recipe?.id ?? m.id, pandId: m.buildingId.split('.').at(-1)}));

await fs.mkdir(THUMBS, {recursive: true});
const faceIds = (await fs.readdir(FACES)).filter(f => existsSync(path.join(FACES, f, 'discovery.json'))).sort();
const streets = new Map<string, StreetSurvey>();
const streetOf = (name: string) => { if (!streets.has(name)) streets.set(name, {street: name, faces: [], recipeHouses: []}); return streets.get(name)!; };
const faceRefs: FaceRef[] = [];

for (const id of faceIds) {
  const dir = path.join(FACES, id), stage = path.join(STAGING, id);
  const discovery = await readJson(path.join(dir, 'discovery.json'));
  const intent = await maybeJson(path.join(dir, 'intent.json'));
  const strip = await maybeJson(path.join(dir, 'strip.json'));
  const report = await maybeJson(path.join(stage, 'report.json'));
  const uses = await maybeJson(path.join(dir, 'uses.json'));
  const installed = chunkManifest.chunks.find((c: any) => c.id === `chunk-face-${id}`);
  const status: FaceStatus = installed ? 'installed' : intent ? 'held' : 'staged';
  const statusReason = installed ? `Drawn in game as ${installed.id} (${installed.pands.length} pands, ${installed.triangles.toLocaleString('en')} triangles).`
    : intent ? HOLD_REASONS[id] ?? 'Compiled but not installed; no hold reason recorded.'
      : `Staged: ${strip ? 'intake and photo strip' : 'discovery'} only — no intent authored yet.`;
  const street = intent?.street ?? discovery.street;
  const addresses = (pandId: string) => uses?.pands?.find((p: any) => p.pandId === pandId)?.addresses ?? [];
  const members: string[] = intent ? intent.houses.map((h: any) => h.pandId) : discovery.members;
  const houses: SurveyHouse[] = members.map(pandId => {
    const h = intent?.houses.find((x: any) => x.pandId === pandId);
    const rear = report?.rears?.find((r: any) => r.pandId === pandId);
    const gf = h?.groundFloor;
    return {
      pandId, address: h?.address ?? addresses(pandId)[0] ?? `pand ${pandId}`,
      ...(gf ? {shop: {use: String(gf.use ?? ''), ...(gf.name ? {name: gf.name} : {}), ...(gf.agreement ? {agreement: gf.agreement} : {})}} : {}),
      limits: h?.rhythm?.schemaLimits ?? [],
      ...(rear ? {rear: `${rear.source}: ${rear.edges.map((e: any) => `${e.windowsPerStorey}/storey on ${e.lengthM} m`).join(', ')}`} : {}),
    };
  });
  faceRefs.push({id, status, pandIds: members});
  const face: SurveyFace = {id, street, title: addressRange(street, houses.map(h => h.address)), status, statusReason,
    ...(installed ? {chunkId: installed.id, triangles: installed.triangles} : report ? {triangles: report.triangles?.chunk} : {}),
    ...(strip?.date ? {photoDate: strip.date} : {}), houses};
  const stripJpg = path.join(stage, 'strip.jpg');
  const glb = installed ? path.join('public/canal-drive', installed.modelUrl.split('?')[0]) : path.join(stage, 'chunk.glb');
  if (RENDER && strip && existsSync(stripJpg)) {
    const photo = await sharp(stripJpg).resize(strip.width, strip.height, {fit: 'fill'}).png().toBuffer();
    face.photo = {...(await writeThumb(photo, `${id}-photo.webp`, THUMB_W)), caption: `Rectified panorama strip, ${strip.date} (Gemeente Amsterdam, CC BY 4.0)`};
    delete (face.photo as any).buffer;
    if (existsSync(glb)) {
      const {width: W, height: H, x0M: x0, x1M: x1, heightM: top} = strip;
      const [model] = await renderModels([{file: glb}], [{eye: [(x0 + x1) / 2, top / 2, 200], target: [(x0 + x1) / 2, top / 2, 0], fov: 30, width: W, height: H,
        ortho: [-(x1 - x0) / 2, (x1 - x0) / 2, top / 2, -top / 2], background: SKY, noGround: true}]);
      const png = await sharp(model).resize(W, H, {fit: 'fill'}).png().toBuffer();
      face.model = {...(await writeThumb(png, `${id}-model.webp`, THUMB_W)), caption: `${installed ? 'Installed' : 'Compiled (not installed)'} model, orthographic, same scale as the strip`};
      delete (face.model as any).buffer;
      await reviewImage(photo, png, id);
    }
  }
  streetOf(street).faces.push(face);
}

for (const m of recipeEntries) {
  const ref: RecipeRef = {id: m.recipe?.id ?? m.id, pandId: m.buildingId.split('.').at(-1)};
  const st = recipeStatus(ref, chunks);
  const street = String(m.name).split(' (')[0] || 'Unknown street';
  const house: SurveyRecipeHouse = {id: ref.id, pandId: ref.pandId, address: m.name.split(' (')[0], name: m.name, ...st, updatedAt: m.updatedAt, reviewState: m.reviewState};
  if (RENDER && st.status !== 'superseded') {
    const front = path.join(PANDREF, ref.pandId, 'front.jpg');
    let photo: Buffer | undefined;
    if (existsSync(front)) {
      photo = await sharp(front).png().toBuffer();
      house.photo = {...(await writeThumb(photo, `${ref.id}-photo.webp`, undefined, HOUSE_H)), caption: 'Rectified municipal panorama crop (Gemeente Amsterdam, CC BY 4.0)'};
      delete (house.photo as any).buffer;
    }
    // A post-hoc chunk draws the house: render the chunk (it is what the game shows).
    const chunk = st.status === 'chunk' ? chunkManifest.chunks.find((c: any) => c.id === st.drawnBy) : undefined;
    const glb = path.join('public/canal-drive', (chunk?.modelUrl ?? m.modelUrl).split('?')[0]);
    if (existsSync(glb)) {
      const [model] = await renderModels([{file: glb}], [frontOrtho(chunk?.bounds ?? m.bounds, 40)]);
      house.model = {...(await writeThumb(model, `${ref.id}-model.webp`, undefined, HOUSE_H)), caption: chunk ? `In game: ${chunk.id} (orthographic front)` : 'In game: this recipe model (orthographic front)'};
      delete (house.model as any).buffer;
      if (photo) await reviewImage(photo, model, ref.id, 700);
    }
  }
  streetOf(street).recipeHouses.push(house);
}
if (RENDER) await closeRenderer();

for (const survey of streets.values()) {
  const slug = survey.street.toLowerCase();
  const review = await maybeJson<{faces?: Record<string, string[]>; pands?: Record<string, string[]>}>(`scripts/street-surveys/reviews/${slug}.json`);
  for (const f of survey.faces) {
    if (review?.faces?.[f.id]) f.review = review.faces[f.id];
    for (const h of f.houses) if (review?.pands?.[h.pandId]) h.defects = review.pands[h.pandId];
  }
  for (const h of survey.recipeHouses) if (review?.pands?.[h.pandId] && h.status !== 'superseded') h.defects = review.pands[h.pandId];
  const list = await maybeJson(`scripts/street-surveys/streets/${slug}.json`);
  if (list) {
    // Recipe names are descriptive ("Bilderdijkstraat (1903 orange brick, …)"); give each its BAG address.
    for (const h of survey.recipeHouses) { const p = list.pands.find((x: any) => x.pandId === h.pandId); h.address = p ? p.label : `pand …${h.pandId.slice(-6)} (no ${survey.street} address in BAG)`; }
    const rows = pandRows(list.pands, chunks, recipes, faceRefs, PAND_NOTES);
    for (const r of rows) if (review?.pands?.[r.pandId]) r.defects = review.pands[r.pandId];
    survey.pandTable = {source: list.source, fetchedAt: list.fetchedAt, rows};
  }
  survey.faces.sort((a, b) => a.title.localeCompare(b.title, 'en', {numeric: true}));
  survey.recipeHouses.sort((a, b) => a.pandId.localeCompare(b.pandId));
}

const data: StreetSurveyData = {version: 1, generatedAt: new Date().toISOString(), streets: [...streets.values()].sort((a, b) => a.street.localeCompare(b.street))};
await fs.writeFile(path.join(OUT, 'surveys.json'), JSON.stringify(data, null, 1) + '\n');
const bytes = (await Promise.all((await fs.readdir(THUMBS)).map(f => fs.stat(path.join(THUMBS, f))))).reduce((s, st) => s + st.size, 0);
console.log(`${data.streets.length} streets, ${faceIds.length} faces, ${recipeEntries.length} recipe houses; thumbnails ${(bytes / 1024).toFixed(0)} KB in ${THUMBS}`);
