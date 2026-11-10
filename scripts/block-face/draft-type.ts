/**
 * Type drafter CLI (city-coverage plan C2 row 2). Turns a family cluster of a buurt's pre-war row into a drafted house
 * type with measured medians (src/canalRecall/blockFace/typeDraft.ts), for a review turn to edit instead of author.
 *
 *   node --import tsx scripts/block-face/draft-type.ts --buurt=timorpleinbuurt-noord --list [--before=1945]
 *       families of the buurt survey (build-year bin x storeys x width band): pands, faces, which faces have a strip
 *   node --import tsx scripts/block-face/draft-type.ts --buurt=... --family=1910-1914:5:4.9-6.4 --intake [--faces=6] [--only=<face>,...]
 *       strips (scripts/block-face/intake.ts) for the family's richest faces that have none (network + panorama cache)
 *   node --import tsx scripts/block-face/draft-type.ts --buurt=... --family=... --district=<dir> --id=<type id> [--faces=8] [--root=<worktree>]
 *       measure every family pand on those faces' strips, draft the type -> scripts/block-face/drafts/<district>/<id>.json
 *       (never into types/: a draft is not installed), measures cached in staging/type-draft/<buurt>/<face>.measures.json
 *   node --import tsx scripts/block-face/draft-type.ts --self-type=kinker-1890-plain-brick [--dump=<fixture.json>]
 *       measure the pands an authored type is placed on and draft from them (the deltas test in typeDraft.test.ts)
 *
 * --root=<dir> reads faces/ and staging/ from another worktree (a sibling lane's intake), read-only.
 * Never tunes for one face: the drafter refuses a family under 8 measured pands or 3 block faces.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {isOpeningCell, measureFacade, type FacadeImage} from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import {classifyPixel, measureStripPalette} from '../../src/canalRecall/blockFace/stripPalette.ts';
import {measureSkyline} from '../../src/canalRecall/blockFace/stripSkyline.ts';
import {clusterFamilies, DRAFT, draftType, DraftRefused, inFamily, parseFamilyId, splitByWall, stat, storeyProfile, type PandMeasure, type PandRecord} from '../../src/canalRecall/blockFace/typeDraft.ts';
import {intake} from './intake.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const has = (n: string) => process.argv.includes(`--${n}`);
const r2 = (v: number) => +v.toFixed(2);
const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const ROOT = arg('root') ? path.resolve(arg('root')!) : process.cwd();
const FACES = path.join(ROOT, 'scripts/block-face/faces'), STAGING = path.join(ROOT, 'staging/block-face');
const MEASURES = (buurt: string) => path.join('staging/type-draft', buurt);

type Raw = {rgb: Uint8Array; width: number; height: number};
async function stripRaw(file: string): Promise<Raw> {
  const {data, info} = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true});
  return {rgb: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height};
}
function spanImage(raw: Raw, px: [number, number], ppm: number, heightM: number): FacadeImage {
  const width = px[1] - px[0], height = raw.height, rgb = new Uint8Array(width * height * 3), valid = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * raw.width + px[0] + x) * 3, o = y * width + x, p: [number, number, number] = [raw.rgb[i], raw.rgb[i + 1], raw.rgb[i + 2]];
    if (classifyPixel(p) === 'void') continue;
    valid[o] = 255; rgb.set(p, o * 3);
  }
  return {width, height, rgb, valid, ppm, topM: heightM};
}

/** Window columns on an opening mask: runs of columns whose opening share over the window storeys is above the midpoint of its p10..p90. */
function windowColumns(a: {mask: Uint8Array; cols: number; rows: number; cell: number; topM: number; fromM: number; toM: number}): {count: number; widthM: number | null} | null {
  const {cols, rows, cell} = a, share: number[] = [];
  for (let i = 0; i < cols; i++) {
    let o = 0, u = 0;
    for (let j = 0; j < rows; j++) { const v = a.topM - (j + 0.5) * cell; if (v < a.fromM || v > a.toM) continue; const m = a.mask[j * cols + i]; if (m === 255) continue; u++; if (isOpeningCell(m)) o++; }
    share.push(u >= 5 ? o / u : NaN);
  }
  const ok = share.filter(v => !Number.isNaN(v)).sort((x, y) => x - y);
  if (ok.length < cols * 0.5) return null;
  const lo = ok[Math.floor(ok.length * 0.1)], hi = ok[Math.floor(ok.length * 0.9)];
  if (hi - lo < 0.15) return null;
  const thr = (lo + hi) / 2, runs: [number, number][] = [];
  let s = -1;
  for (let i = 0; i <= cols; i++) {
    const on = i < cols && share[i] > thr;
    if (on && s < 0) s = i;
    if (!on && s >= 0) { if (runs.length && s - runs[runs.length - 1][1] < 0.25 / cell) runs[runs.length - 1][1] = i; else runs.push([s, i]); s = -1; }
  }
  const real = runs.filter(r => (r[1] - r[0]) * cell >= 0.35);
  const widths = real.map(r => (r[1] - r[0]) * cell).sort((x, y) => x - y);
  return {count: real.length, widthM: widths.length ? r2(widths[Math.floor(widths.length / 2)]) : null};
}

export async function measureFace(face: string, ids: Set<string>, record: Map<string, PandRecord>, opts: {brightSky?: boolean} = {}): Promise<PandMeasure[]> {
  const dir = path.join(FACES, face), strip = readJson(path.join(dir, 'strip.json'));
  const jpg = fs.existsSync(path.join(STAGING, face, 'strip.jpg')) ? path.join(STAGING, face, 'strip.jpg') : path.resolve(ROOT, strip.image);
  const raw = await stripRaw(jpg), out: PandMeasure[] = [];
  for (const span of strip.spans as any[]) {
    if (!ids.has(span.pandId)) continue;
    const rec = record.get(span.pandId)!, facts = readJson(path.join(dir, 'pands', span.pandId, 'facts.json'));
    const f0 = facts.fronts[0], bagEaves = f0.eavesM >= 6 ? f0.eavesM : facts.heights.dak70pM;
    const storeys: number = facts.heights.storeys ?? rec.storeys3dbag ?? Math.max(2, Math.round(bagEaves / 3.1));
    const px: [number, number] = [Math.max(0, span.px[0]), Math.min(raw.width, span.px[1])], ppm = strip.pixelsPerMetre;
    const sky = measureSkyline({rgb: raw.rgb, width: raw.width, height: raw.height, x0: px[0], x1: px[1], pixelsPerMetre: ppm, brightSky: opts.brightSky});
    const skyOk = !!sky && sky.confidence >= 0.6 && sky.eavesM > 6;
    // The facade is read up to the lower of the 3DBAG and the photographed eaves (a gable's shoulder is no wall).
    const eavesM = skyOk ? Math.min(bagEaves, sky!.eavesM) : bagEaves;
    const palette = measureStripPalette({rgb: raw.rgb, width: raw.width, height: raw.height, x0: px[0], x1: px[1], pixelsPerMetre: ppm, eavesM});
    let windowCols: number | null = null, pitchColumns: number | null = null, windowWidthM: number | null = null, glazing: number | null = null, profile = null as PandMeasure['storey'];
    try {
      const lines = Array.from({length: storeys + 1}, (_, k) => r2(k * eavesM / storeys)), widthM = (px[1] - px[0]) / ppm;
      const m = measureFacade({image: spanImage(raw, px, ppm, strip.heightM), box: {u0: 0, u1: widthM, v0: 0, v1: eavesM}, lines});
      pitchColumns = m.columns; glazing = r2(m.glazing);
      const wc = windowColumns({mask: m.mask, cols: m.cols, rows: m.rows, cell: m.cell, topM: eavesM, fromM: 4.4, toM: eavesM - 0.4});
      if (wc) { windowCols = wc.count; windowWidthM = wc.widthM; }
      const diag: {why?: string} = {};
      profile = storeyProfile({mask: m.mask, cols: m.cols, rows: m.rows, cell: m.cell, topM: eavesM, eavesM, isOpen: isOpeningCell, diag});
      if (!profile && process.env.DRAFT_DEBUG) console.log(`  ${face} ${span.pandId.slice(-6)} profile: ${diag.why}`);
    } catch { /* unread */ }
    out.push({
      pandId: span.pandId, face, builtYear: rec.builtYear, storeys: profile ? profile.sillM.length + 1 : storeys, storeys3dbag: rec.storeys3dbag ?? facts.heights.storeys ?? null, widthM: r2(f0.widthM), eavesM: r2(bagEaves),
      skylineEavesM: skyOk ? r2(sky!.eavesM) : null, crown: skyOk && sky!.crown ? {widthM: r2(sky!.crown.widthM), riseM: r2(sky!.crown.riseM)} : null,
      windowCols, pitchColumns, windowWidthM, storey: profile, glazing,
      palette: {wall: palette.wall, accent: palette.accent, frame: palette.frame, band: palette.band, cornice: palette.cornice, stucco: palette.stucco},
      bandRunsM: palette.bandRunsM.map(r => [r2(r[0]), r2(r[1])] as [number, number]),
      roofType: facts.attributes?.b3_dak_type ?? null,
    });
  }
  return out;
}

function survey(slug: string) {
  const d = readJson(`scripts/block-face/buurten/${slug}.json`);
  const face = new Map<string, string>();
  for (const f of d.faces) for (const m of f.members) face.set(m, f.id);
  const pands: PandRecord[] = d.pands.map((p: any) => ({pandId: p.pandId, face: face.get(p.pandId) ?? p.face ?? null, builtYear: p.builtYear ?? null, storeys3dbag: p.storeys3dbag ?? null, frontWidthM: p.frontWidthM ?? null, eavesM: p.eavesM ?? null}));
  return {doc: d, pands, record: new Map(pands.map(p => [p.pandId, p]))};
}
const hasStrip = (face: string) => fs.existsSync(path.join(FACES, face, 'strip.json')) && (fs.existsSync(path.join(STAGING, face, 'strip.jpg')) || fs.existsSync(path.resolve(ROOT, readJson(path.join(FACES, face, 'strip.json')).image)));

/** The family's faces by member count (the richest first). */
function richFaces(fam: {pands: PandRecord[]}): [string, number][] {
  const n = new Map<string, number>();
  for (const p of fam.pands) n.set(p.face!, (n.get(p.face!) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

async function main() {
  const selfType = arg('self-type');
  if (selfType) return selfTypeRun(selfType);
  const slug = arg('buurt');
  if (!slug) throw Error('Use --buurt=<slug> (a survey in scripts/block-face/buurten/)');
  const {doc, pands, record} = survey(slug);
  const before = arg('before') ? Number(arg('before')) : 1945;
  const fams = clusterFamilies(pands, {before});
  if (has('list')) {
    console.log(`${doc.buurt}: ${pands.length} pands, ${fams.reduce((s, f) => s + f.pands.length, 0)} on a face and built before ${before}`);
    for (const f of fams.filter(f => f.pands.length >= DRAFT.minSamples).slice(0, +(arg('top') ?? 14)))
      console.log(`  ${f.id.padEnd(22)} ${String(f.pands.length).padStart(4)} pands ${String(f.faces.length).padStart(3)} faces, eaves ${f.eavesM} m; faces with strips: ${f.faces.filter(hasStrip).length}; richest ${richFaces(f).slice(0, 6).map(([x, n]) => `${x}(${n})`).join(' ')}`);
    return;
  }
  const famId = arg('family');
  if (!famId) throw Error('Use --list, or --family=<yearFrom>-<yearTo>:<storeys>:<width band>');
  const key = parseFamilyId(famId), members = pands.filter(p => inFamily(p, key) && p.face);
  const fam = {pands: members};
  const nFaces = +(arg('faces') ?? 8), only = arg('only')?.split(',');
  const faces = (only ?? richFaces(fam).slice(0, nFaces).map(f => f[0]));
  console.log(`${doc.buurt} ${famId}: ${members.length} pands on ${new Set(members.map(p => p.face)).size} faces; using ${faces.length}: ${faces.join(' ')}`);
  if (has('intake')) {
    for (const f of doc.faces.filter((f: any) => faces.includes(f.id))) {
      if (hasStrip(f.id) && !has('force')) { console.log(`${f.id}: strip exists`); continue; }
      const run = (from: string, to: string) => intake({face: f.id, street: f.street, seed: f.seed, from, to});
      try {
        try { await run(f.members[0], f.members.at(-1)); }
        catch (e) {
          const m = /not on the face \(([^)]*)\)/.exec((e as Error).message);
          if (!m) throw e;
          const found = new Set(m[1].split(' ')), kept = f.members.filter((id: string) => found.has(id.slice(-6)));
          if (kept.length < 2) throw e;
          await run(kept[0], kept.at(-1));
        }
      } catch (e) { console.log(`${f.id}: INTAKE FAILED ${(e as Error).message.slice(0, 200)}`); }
    }
    return;
  }
  const id = arg('id'), district = arg('district');
  if (!id || !district) throw Error('Use --id=<type id> --district=<dir> to draft');
  const samples: PandMeasure[] = [];
  fs.mkdirSync(MEASURES(slug), {recursive: true});
  for (const face of faces) {
    if (!hasStrip(face)) { console.log(`${face}: no strip (run --intake, or --root=<worktree with one>)`); continue; }
    const cache = path.join(MEASURES(slug), `${face}.measures.json`);
    const ids = new Set(members.filter(p => p.face === face).map(p => p.pandId));
    let ms: PandMeasure[] = fs.existsSync(cache) && !has('remeasure') ? readJson(cache) : await measureFace(face, new Set(pands.filter(p => p.face === face).map(p => p.pandId)), record);
    fs.writeFileSync(cache, JSON.stringify(ms) + '\n');
    ms = ms.filter(m => ids.has(m.pandId));
    console.log(`${face}: ${ms.length} family pands measured, window columns ${ms.map(m => m.windowCols ?? '-').join(',')}`);
    samples.push(...ms);
  }
  const write = (ss: PandMeasure[], tid: string) => {
    const type = draftType(ss, {id: tid, district, buurt: doc.buurt, family: key});
    const out = path.join('scripts/block-face/drafts', district, `${tid}.json`);
    fs.mkdirSync(path.dirname(out), {recursive: true});
    fs.writeFileSync(out, JSON.stringify(type, null, 1) + '\n');
    // the measures behind the draft, so the numbers can be re-drafted without strips
    fs.writeFileSync(path.join('scripts/block-face/drafts', district, `${tid}.measures.json`), JSON.stringify({family: famId, buurt: slug, measures: ss}) + '\n');
    console.log(`drafted ${out}: ${type.draft.n} pands on ${Object.keys(type.draft.faces).length} faces; omitted ${Object.keys(type.draft.omitted).join(', ') || 'none'}`);
  };
  try { write(samples, id); }
  catch (e) {
    if (!(e instanceof DraftRefused)) throw e;
    console.log(`REFUSED ${famId}: ${e.reasons.join('; ')}`);
    if (e.code !== 'wall' || has('no-split')) { process.exitCode = 2; return; }
    // two wall colours in one family: each colour is a family of its own, drafted only if it passes every rule itself
    const sp = splitByWall(samples);
    if (!sp) { process.exitCode = 2; return; }
    for (const [name, part] of [['dark', sp.dark], ['light', sp.light]] as const) {
      try { write(part, `${id}-${name}`); } catch (e2) { if (e2 instanceof DraftRefused) console.log(`  ${name} wall: ${part.length} pands: REFUSED ${e2.reasons.join('; ')}`); else throw e2; }
    }
  }
}

/** Measure the pands an authored type is placed on (face intents' houses) and draft from them. */
async function selfTypeRun(typeId: string) {
  const placed = new Map<string, {pandId: string; face: string}[]>();
  for (const f of fs.readdirSync(FACES)) {
    const ip = path.join(FACES, f, 'intent.json');
    if (!fs.existsSync(ip)) continue;
    for (const h of readJson(ip).houses ?? []) { const t = typeof h.type === 'string' ? h.type : h.type?.type; if (t === typeId) (placed.get(f) ?? placed.set(f, []).get(f)!).push({pandId: h.pandId, face: f}); }
  }
  const all: PandMeasure[] = [];
  for (const [face, hs] of placed) {
    if (!hasStrip(face)) continue;
    const rec = new Map<string, PandRecord>();
    for (const h of hs) { const facts = readJson(path.join(FACES, face, 'pands', h.pandId, 'facts.json')); rec.set(h.pandId, {pandId: h.pandId, face, builtYear: facts.heights.builtYear ?? null, storeys3dbag: facts.heights.storeys ?? null, frontWidthM: facts.fronts[0].widthM, eavesM: facts.fronts[0].eavesM}); }
    const ms = await measureFace(face, new Set(hs.map(h => h.pandId)), rec);
    console.log(`${face}: ${ms.length}/${hs.length} measured`);
    all.push(...ms);
  }
  console.log(`${typeId}: ${all.length} pands on ${new Set(all.map(m => m.face)).size} faces; windowCols ${JSON.stringify(stat(all.map(m => m.windowCols)))}`);
  if (arg('dump')) { fs.mkdirSync(path.dirname(arg('dump')!), {recursive: true}); fs.writeFileSync(arg('dump')!, JSON.stringify({typeId, measures: all}) + '\n'); console.log(`wrote ${arg('dump')}`); }
}

if (process.argv[1]?.endsWith('draft-type.ts')) await main();
