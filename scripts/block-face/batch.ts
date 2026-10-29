/**
 * Unattended block-face batch installer (#103). For each face of a buurt (or a face list), ranked by ride visibility,
 * with no human or agent edits:
 *   1. intake (buurt faces without one), then the strip-quality check (blockFace/stripQuality.ts); a blown-out or
 *      colour-cast strip is re-stripped from the next fallback dates (blockFace/batchInstall.ts restripDates; #98 had to
 *      re-strip Kinkerstraat 56-84 from 2024-11-29 to 2023-01-10 by hand);
 *   2. type assignment: an authored intent is kept as it is; a face without one is auto-placed from the district library
 *      (auto-place.ts: build year, width, eaves/storeys, crown, strip evidence, the per-pand likeness gate);
 *   3. wall palette: every brick pand whose review wall check fails is refitted through the city tint
 *      (fit-wall-palette.ts fitWallBrick) and the face recompiled;
 *   4. compile, the gates, the GLB audit (compile.ts), the per-pand edge-NCC likeness (auto-place.ts runLikeness) and
 *      stripOverDrawn (look/face-wall-exposure.ts);
 *   5. install only when everything passes and stripOverDrawn is within 0.8-1.25 (batchInstall.ts installVerdict);
 *      otherwise the face stays generic and the reasons are logged.
 * Corner pands that an installed chunk already owns are never taken: the face is trimmed to the run between them
 * (`<face>-t`), or not installed when the shared pand sits inside it (batchInstall.ts trimShared).
 *
 *   node --import tsx scripts/block-face/batch.ts --name=<batch> (--buurt=<slug> --district=<library> | --faces=<id>,...)
 *        [--install] [--ride[=<routes>]] [--limit=<n>] [--skip=<id>,...] [--strip-cache=<worktree>,...] [--redo] [--no-restrip]
 *        [--intake-only]   only intake + strip checks (network; safe beside a placing run: no browser, no manifest writes)
 *
 * --strip-cache: other checkouts whose staging/block-face/<face>/strip.jpg may be reused when its size matches the
 *   committed strip.json (strip images are untracked). Without one the strip is re-taken from the panoramas.
 * Writes scripts/block-face/batch/<name>.json and .csv (every face tried: installed, or failed with reasons; resumable:
 * faces already in the report are skipped unless --redo) and staging/block-face/batch/<name>/contact.jpg, review sheets
 * of a seeded random 10 % of the installs at thumbnail size.
 */
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {FACES, STAGING, intake} from './intake.ts';
import {compileFace, installFace} from './compile.ts';
import {reviewFace} from './review.ts';
import {runLikeness, writeRunFace} from './auto-place.ts';
import {fitWallBrick} from './fit-wall-palette.ts';
import {faceWallExposure} from '../look/face-wall-exposure.ts';
import {closeRenderer} from '../building-recipes/render.ts';
import {houseIntents, validateBlockFace} from '../../src/canalRecall/blockFace/intent.ts';
import {fileTypeLoader} from '../../src/canalRecall/blockFace/typeLibrary.ts';
import {toHex} from '../../src/canalRecall/blockFace/wallColour.ts';
import {spanQuality, stripQuality, type StripQualityVerdict} from '../../src/canalRecall/blockFace/stripQuality.ts';
import {BATCH_GATES, coveredElsewhere, facingsToHousePalette, installVerdict, restripDates, sampleShare, trimShared} from '../../src/canalRecall/blockFace/batchInstall.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const flag = (n: string) => process.argv.includes(`--${n}`);
const readJson = async (f: string) => JSON.parse(await fs.readFile(f, 'utf8'));
const writeJson = (f: string, v: unknown) => fs.writeFile(f, JSON.stringify(v, null, 1) + '\n');
const MANIFEST = 'public/canal-drive/ordinary-buildings-data/chunks.json';
const med = (a: number[]) => { const s = a.filter(Number.isFinite).sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; };

interface Row {
  face: string; run: string; street: string; pands: number; mode: 'authored' | 'auto-place'; ride: number | null;
  stripDate: string | null; restriped: string | null; stripQuality: {badShare: number; reasons: string[]} | null;
  status: 'installed' | 'passed (not installed: no --install)' | 'failed' | 'skipped'; reasons: string[];
  nccMin: number | null; nccMedian: number | null; stripOverDrawn: number | null; wallFits: number; droppedCorners: string[];
  triangles: number | null; sheet: string | null; seconds: number;
}

/** Per-span facade boxes of a face strip, measured for quality. */
async function measureStrip(face: string): Promise<StripQualityVerdict | null> {
  const dir = path.join(FACES, face), strip = await readJson(path.join(dir, 'strip.json'));
  const jpg = path.join(STAGING, face, 'strip.jpg');
  if (!existsSync(jpg)) return null;
  const {data, info} = await sharp(jpg).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const ppm = strip.pixelsPerMetre, H = info.height;
  const spans = await Promise.all(strip.spans.map(async (s: any) => {
    const f = path.join(dir, 'pands', s.pandId, 'facts.json'), h = existsSync(f) ? (await readJson(f)).heights : null;
    const top = h?.roofMaxM ?? h?.eavesM ?? 12;
    return {widthPx: s.px[1] - s.px[0], quality: spanQuality(data, info.width, {x0: s.px[0] + 8, x1: s.px[1] - 8, y0: Math.max(0, Math.round(H - top * ppm)), y1: Math.round(H - 3.8 * ppm)})};
  }));
  return stripQuality(spans);
}

/** A strip image for a face whose strip.json is committed but whose (untracked) image is not here. */
async function ensureStripImage(face: string, caches: string[]): Promise<string> {
  const jpg = path.join(STAGING, face, 'strip.jpg');
  if (existsSync(jpg)) return 'present';
  const strip = await readJson(path.join(FACES, face, 'strip.json'));
  for (const c of caches) {
    const src = path.join(c, STAGING, face, 'strip.jpg'), sj = path.join(c, FACES, face, 'strip.json');
    if (!existsSync(src) || !existsSync(sj)) continue;
    const other = await readJson(sj), meta = await sharp(src).metadata();
    if (other.date !== strip.date || meta.width !== strip.width || meta.height !== strip.height) continue;
    await fs.mkdir(path.dirname(jpg), {recursive: true});
    await fs.copyFile(src, jpg);
    return `copied from ${c}`;
  }
  // Re-take it on the committed date (same members, same frame).
  const d = await readJson(path.join(FACES, face, 'discovery.json'));
  if (d.runOf) {
    const parent = d.runOf;
    await ensureStripImage(parent, caches);
    const ps = await readJson(path.join(FACES, parent, 'strip.json')), px = strip.croppedFrom?.px ?? [0, ps.width];
    await fs.mkdir(path.dirname(jpg), {recursive: true});
    await sharp(path.join(STAGING, parent, 'strip.jpg')).extract({left: px[0], top: 0, width: px[1] - px[0], height: ps.height}).jpeg({quality: 90}).toFile(jpg);
    return `cropped from ${parent}`;
  }
  const r = await restrip(face, strip.date);
  if (!r.ok) throw Error(`strip image missing and re-take failed: ${r.why}`);
  return `re-taken ${strip.date}`;
}

/**
 * Re-strip a face on another date without touching its facts or intent: intake into a temporary face, check it found
 * the same members, then take only its strip (strip.json, strip.jpg, strip-labelled.png).
 */
async function restrip(face: string, date: string): Promise<{ok: true} | {ok: false; why: string}> {
  const d = await readJson(path.join(FACES, face, 'discovery.json')), tmp = `_batch-restrip-${face}`;
  const cacheDir = path.join('.cache/block-face', face), tmpCache = path.join('.cache/block-face', tmp);
  if (existsSync(path.join(cacheDir, 'overpass.json'))) { await fs.mkdir(tmpCache, {recursive: true}); await fs.copyFile(path.join(cacheDir, 'overpass.json'), path.join(tmpCache, 'overpass.json')); }
  const old = await readJson(path.join(FACES, face, 'strip.json')).catch(() => null);
  try {
    await quiet(() => intake({face: tmp, street: d.street, seed: d.seed ?? d.members[0], from: d.members[0], to: d.members.at(-1), date, ...(old?.cameraHeightM !== undefined ? {cameraHeight: old.cameraHeightM} : {})}));
    const t = await readJson(path.join(FACES, tmp, 'discovery.json'));
    if (t.members.join() !== d.members.join()) return {ok: false, why: `re-intake found other members (${t.members.length} vs ${d.members.length})`};
    const s = await readJson(path.join(FACES, tmp, 'strip.json'));
    await fs.mkdir(path.join(STAGING, face), {recursive: true});
    for (const f of ['strip.jpg', 'strip-labelled.png']) await fs.copyFile(path.join(STAGING, tmp, f), path.join(STAGING, face, f));
    await writeJson(path.join(FACES, face, 'strip.json'), {...s, face, image: path.join(STAGING, face, 'strip.jpg'), ...(old && old.date !== date ? {restripped: {from: old.date, by: 'scripts/block-face/batch.ts (strip quality)'}} : {})});
    return {ok: true};
  } catch (e) { return {ok: false, why: (e as Error).message.slice(0, 160)}; }
  finally { for (const p of [path.join(FACES, tmp), path.join(STAGING, tmp), tmpCache]) await fs.rm(p, {recursive: true, force: true}); }
}

/** Run fn with console.log silenced (the intake and compile logs go to the batch log only as summaries). */
async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const log = console.log; console.log = () => {};
  try { return await fn(); } finally { console.log = log; }
}

/** Strip check with fallback dates; returns the final verdict and the date it re-stripped to (if any). */
async function stripStep(face: string, noRestrip: boolean): Promise<{q: StripQualityVerdict | null; restriped: string | null; date: string}> {
  let q = await measureStrip(face), strip = await readJson(path.join(FACES, face, 'strip.json'));
  const original = strip.date;
  if (!q?.bad || noRestrip) return {q, restriped: null, date: strip.date};
  const tried: string[] = [];
  let best = {q, date: strip.date};
  for (const date of restripDates(strip.candidatesByDate ?? {}, strip.spans.length, strip.date, tried, 3)) {
    tried.push(date);
    const r = await restrip(face, date);
    if (!r.ok) { console.log(`  restrip ${date}: ${r.why}`); continue; }
    const q2 = await measureStrip(face);
    console.log(`  restrip ${date}: bad share ${q2?.badShare} ${q2?.reasons.join(', ')}`);
    if (q2 && q2.badShare < best.q.badShare) best = {q: q2, date};
    if (q2 && !q2.bad) break;
  }
  // Keep the best strip of the ones tried.
  if (best.date !== (await readJson(path.join(FACES, face, 'strip.json'))).date) await restrip(face, best.date);
  return {q: best.q, restriped: best.date !== original ? `${original} -> ${best.date}` : null, date: best.date};
}

/** Ride visibility per pand (ride-visibility.ts), summed per face; cached per batch. */
async function rideScores(name: string, pandIds: string[], routes: number): Promise<Map<string, number>> {
  const file = path.join(STAGING, 'batch', name, `ride-${routes}.json`);
  const cached: Record<string, number> = existsSync(file) ? await readJson(file) : {};
  const todo = pandIds.filter(p => !(p in cached));
  if (todo.length) {
    const rv = await import('../building-recipes/ride-visibility.ts');
    const fp = rv.loadFootprints(), samples = rv.sampleRoutes(routes, 7).samples, score = rv.scorer(samples, fp);
    for (const p of todo) cached[p] = score(`NL.IMBAG.Pand.${p}`)?.score ?? 0; // BAG tile ids carry the prefix
    await fs.mkdir(path.dirname(file), {recursive: true});
    await writeJson(file, cached);
  }
  return new Map(Object.entries(cached));
}

/** A copy of `face` without the dropped end pands: `<face>-t` (strip cropped, intent houses filtered). */
async function trimmedFace(face: string, keep: string[], dropped: string[]): Promise<string> {
  const id = `${face}-t`, dir = path.join(FACES, face);
  const [strip, uses, discovery, intent] = await Promise.all(['strip.json', 'uses.json', 'discovery.json', 'intent.json'].map(f => readJson(path.join(dir, f))));
  await writeRunFace(face, id, keep, strip, uses, discovery);
  const drop = (v: unknown) => dropped.some(p => JSON.stringify(v).includes(p));
  const continuity = Object.fromEntries(Object.entries(intent.continuity ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.filter(x => !drop(x)) : v]));
  await writeJson(path.join(FACES, id, 'intent.json'), {...intent, id, houses: intent.houses.filter((h: any) => keep.includes(h.pandId)), continuity,
    note: `${intent.note ?? ''} [batch.ts: trimmed to ${keep.length} pands; corner(s) ${dropped.map(p => p.slice(-6)).join(', ')} stay with their installed chunk]`.trim()});
  return id;
}

/**
 * Brick pands whose review wall check fails: refit their brick through the city tint (paletteOverrides.brick). With
 * `all` (the face's stripOverDrawn is out of range), every brick pand with a wall reading is refitted: a row can pass
 * the per-pand hue/saturation/lightness tolerance while drawing 0.7x the photo's linear wall light (Kinkerstraat
 * 109-161, 112-116, 120-138, 142-178 on the first batch run, #98's 56-84 at 0.705 before its bricks were fitted).
 */
async function fitWalls(run: string, fc: any[], all = false): Promise<number> {
  const file = path.join(FACES, run, 'intent.json'), intent = await readJson(file);
  const discovery = await readJson(path.join(FACES, run, 'discovery.json'));
  const resolved = houseIntents(validateBlockFace(intent, discovery.members, fileTypeLoader()));
  let n = 0;
  for (const f of fc) {
    const w = f.wallColour, h = intent.houses.find((x: any) => x.pandId === f.pand), r = resolved.find(x => x.pandId === f.pand);
    if (!w || (w.pass && !all) || !h?.type || !r || (r.palette.wallMaterial ?? 'brick') === 'stucco') continue;
    const brick = typeof r.palette.brick === 'string' ? r.palette.brick : null;
    if (!brick) continue;
    const fit = fitWallBrick(brick, toHex(w.model), toHex(w.photo));
    if (fit.brick === brick) continue;
    h.type.paletteOverrides = {...(h.type.paletteOverrides ?? {}), brick: fit.brick};
    n++;
  }
  if (n) await writeJson(file, intent);
  return n;
}

/** Compile, review, wall fit (+ recompile), likeness, stripOverDrawn, verdict. */
async function judgeRun(run: string, strip: {bad: boolean; reasons: string[]}) {
  let compiled: Awaited<ReturnType<typeof compileFace>> | null = null, error: string | undefined, sheet: string | null = null, wallFits = 0;
  const compileAndReview = async () => {
    compiled = await quiet(() => compileFace(run));
    const r = await quiet(() => reviewFace(run));
    sheet = r.sheet; return r.fc;
  };
  try {
    const fc = await compileAndReview();
    wallFits = await fitWalls(run, fc);
    let fc2 = fc;
    if (wallFits) fc2 = await compileAndReview();
    const e = await faceWallExposure(run).catch(() => null), [lo, hi] = BATCH_GATES.stripOverDrawn;
    if (e?.stripOverDrawn != null && (e.stripOverDrawn < lo || e.stripOverDrawn > hi)) {
      const n = await fitWalls(run, fc2, true);
      if (n) { wallFits += n; await compileAndReview(); }
    }
  } catch (e) { error = (e as Error).message; }
  const c = compiled as Awaited<ReturnType<typeof compileFace>> | null;
  const likeness = c && !error ? await quiet(() => runLikeness(run)).catch(() => []) : [];
  const exposure = c && !error ? await faceWallExposure(run).catch(() => null) : null;
  const report: any = c?.report;
  const verdict = installVerdict({strip, compile: {error, gatesFailed: (report?.gates ?? []).filter((g: any) => !g.pass).map((g: any) => `${String(g.pand).slice(-6)}/${g.id}`), auditPassed: !!report?.audit?.passWithPartyExemption},
    likeness, stripOverDrawn: exposure?.stripOverDrawn ?? null, brickPands: exposure?.brickPands ?? 0});
  const nccs = likeness.map(l => l.ncc).filter((v): v is number => v !== null);
  return {verdict, compiled: c, sheet, wallFits, nccMin: nccs.length ? Math.min(...nccs) : null, nccMedian: med(nccs), stripOverDrawn: exposure?.stripOverDrawn ?? null, triangles: report?.triangles?.chunk ?? null};
}

async function main() {
  const name = arg('name'), buurt = arg('buurt'), district = arg('district');
  if (!name || (!buurt && !arg('faces'))) throw Error('Use --name=<batch> (--buurt=<slug> --district=<library> | --faces=<id>,...) [--install]');
  const caches = (arg('strip-cache') ?? '').split(',').filter(Boolean), skip = new Set((arg('skip') ?? '').split(',').filter(Boolean));
  const outDir = 'scripts/block-face/batch', reportFile = path.join(outDir, `${name}.json`);
  await fs.mkdir(outDir, {recursive: true}); await fs.mkdir(path.join(STAGING, 'batch', name), {recursive: true});
  const prev = existsSync(reportFile) ? await readJson(reportFile) : {rows: []};
  const rows: Row[] = flag('redo') ? prev.rows.filter((r: Row) => r.status === 'installed') : prev.rows; // --redo keeps the installs
  const done = new Set(rows.map(r => r.face));
  // The faces: a buurt's uncovered proposals of two or more pands, or the given list.
  const doc = buurt ? await readJson(path.join('scripts/block-face/buurten', `${buurt}.json`)) : null;
  let faces: {id: string; street: string; members: string[]; seed?: string}[] = doc
    ? doc.faces.filter((f: any) => !f.covered && f.members.length >= 2).map((f: any) => ({id: f.id, street: f.street, members: f.members, seed: f.seed}))
    : await Promise.all(arg('faces')!.split(',').map(async id => { const d = await readJson(path.join(FACES, id, 'discovery.json')); return {id, street: d.street, members: d.members}; }));
  const rideArg = process.argv.find(a => a.startsWith('--ride'));
  const ride = rideArg ? await rideScores(name, [...new Set(faces.flatMap(f => f.members))], Number(arg('ride') ?? 300)) : null;
  const faceRide = (f: {members: string[]}) => ride ? f.members.reduce((a, p) => a + (ride.get(p) ?? 0), 0) : null;
  if (ride) faces = [...faces].sort((a, b) => faceRide(b)! - faceRide(a)!);
  const limit = Number(arg('limit') ?? Infinity);
  let tried = 0;
  const save = async () => {
    const tally = (k: (r: Row) => string[]) => Object.fromEntries([...rows.flatMap(k).reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]));
    await writeJson(reportFile, {name, buurt: buurt ?? null, library: district ?? null, generatedAt: new Date().toISOString(), method: 'scripts/block-face/batch.ts',
      totals: {faces: new Set(rows.map(r => r.face)).size, runs: rows.length, installed: rows.filter(r => r.status === 'installed').length, installedPands: rows.filter(r => r.status === 'installed').reduce((a, r) => a + r.pands, 0),
        failed: rows.filter(r => r.status === 'failed').length, byReason: tally(r => r.reasons.map(x => x.split(':')[0]))}, rows});
    const cols: (keyof Row)[] = ['face', 'run', 'street', 'pands', 'mode', 'ride', 'stripDate', 'restriped', 'status', 'reasons', 'nccMin', 'nccMedian', 'stripOverDrawn', 'wallFits', 'droppedCorners', 'triangles', 'seconds'];
    const cell = (v: unknown) => { const s = Array.isArray(v) ? v.join(' | ') : v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    await fs.writeFile(reportFile.replace(/\.json$/, '.csv'), [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n') + '\n');
  };
  for (const f of faces) {
    if (tried >= limit) break;
    if (done.has(f.id) || skip.has(f.id)) continue;
    tried++;
    const t0 = performance.now(), secs = () => +((performance.now() - t0) / 1000).toFixed(1);
    const base = {face: f.id, street: f.street, ride: faceRide(f), restriped: null, stripQuality: null, nccMin: null, nccMedian: null, stripOverDrawn: null, wallFits: 0, droppedCorners: [], triangles: null, sheet: null};
    const fail = (run: string, mode: Row['mode'], reasons: string[], extra: Partial<Row> = {}) => { rows.push({...base, run, pands: f.members.length, mode, stripDate: null, status: 'failed', reasons, ...extra, seconds: secs()} as Row); };
    const manifest0 = await readJson(MANIFEST);
    if (flag('intake-only') && existsSync(path.join(FACES, f.id, 'strip.json')) && existsSync(path.join(STAGING, f.id, 'strip.jpg'))) continue;
    if (manifest0.chunks.some((c: any) => c.id === `chunk-face-${f.id}` || c.id.startsWith(`chunk-face-${f.id}-r`) || c.id === `chunk-face-${f.id}-t`)) { rows.push({...base, run: f.id, pands: f.members.length, mode: 'authored', stripDate: null, status: 'skipped', reasons: ['already-installed'], seconds: 0} as Row); await save(); continue; }
    console.log(`\n== ${f.id} (${f.street}, ${f.members.length} pands${base.ride !== null ? `, ride ${base.ride}` : ''})`);
    // 1. Intake / strip.
    try {
      if (!existsSync(path.join(FACES, f.id, 'strip.json'))) {
        if (!doc) { fail(f.id, 'authored', ['intake-missing: no strip.json and no buurt to intake from']); await save(); continue; }
        // As buurt-survey.ts --intake: discovery may drop an end pand the proposal kept; trim to the members it found.
        const run = (from: string, to: string) => quiet(() => intake({face: f.id, street: f.street, seed: f.seed!, from, to}));
        try { await run(f.members[0], f.members.at(-1)!); }
        catch (e) {
          const m = /not on the face \(([^)]*)\)/.exec((e as Error).message), found = new Set(m?.[1].split(' ') ?? []), kept = f.members.filter(id => found.has(id.slice(-6)));
          if (!m || kept.length < 2) throw e;
          await run(kept[0], kept.at(-1)!);
        }
      } else console.log(`  strip image: ${await ensureStripImage(f.id, caches)}`);
    } catch (e) { fail(f.id, 'auto-place', [`intake-failed: ${(e as Error).message.slice(0, 160)}`]); await save(); continue; }
    const st = await stripStep(f.id, flag('no-restrip'));
    const stripInfo = {stripDate: st.date, restriped: st.restriped, stripQuality: st.q ? {badShare: st.q.badShare, reasons: st.q.reasons} : null};
    console.log(`  strip ${st.date}: bad share ${st.q?.badShare} ${st.q?.reasons.join(', ') ?? ''}${st.restriped ? ` (restriped ${st.restriped})` : ''}`);
    const stripVerdict = {bad: !st.q || st.q.bad, reasons: st.q?.reasons ?? ['no strip image']};
    // --intake-only: network-bound intake and strip checks ahead of a placing run (no browser, no manifest writes).
    if (flag('intake-only')) continue;
    // 2. Type assignment.
    const intentFile = path.join(FACES, f.id, 'intent.json');
    const authored = existsSync(intentFile) && !String((await readJson(intentFile)).authoring?.author ?? '').startsWith('auto-place');
    const mode: Row['mode'] = authored ? 'authored' : 'auto-place';
    let runs: string[] = [];
    if (authored) runs = [f.id];
    else if (!doc || !district) { fail(f.id, mode, ['no-type: no authored intent and no --buurt/--district to auto-place from'], stripInfo); await save(); continue; }
    else {
      const log = path.join(STAGING, 'batch', name, `${f.id}-auto-place.log`);
      try { await fs.writeFile(log, execFileSync(process.execPath, ['--import', 'tsx', 'scripts/block-face/auto-place.ts', `--buurt=${buurt}`, `--district=${district}`, `--only=${f.id}`], {encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe']})); }
      catch (e: any) { await fs.writeFile(log, String(e.stdout ?? '') + String(e.stderr ?? '')); fail(f.id, mode, [`auto-place-error: ${String(e.stderr ?? e.message).trim().split('\n').at(-1)?.slice(0, 160)}`], stripInfo); await save(); continue; }
      const ap = await readJson(path.join(FACES, f.id, 'auto-place.json'));
      runs = ap.runs.map((r: any) => r.face);
      const held = ap.pands.filter((p: any) => p.status === 'held');
      if (!runs.length) {
        const why = Object.entries(held.reduce((m: Record<string, number>, p: any) => { const k = `${p.stage}: ${String(p.reason).replace(/[\d.]+/g, '#').slice(0, 70)}`; m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3);
        fail(f.id, mode, [`no-type: 0/${ap.pands.length} placed (${why.map(([k, n]) => `${n}x ${k}`).join('; ')})`], stripInfo); await save(); continue;
      }
      console.log(`  auto-place: ${ap.pands.length - held.length}/${ap.pands.length} placed in ${runs.join(' ')}`);
    }
    // 3-5. Each run: corners, compile, fit, judge, install.
    for (let run of runs) {
      const tr = performance.now();
      const d = await readJson(path.join(FACES, run, 'discovery.json'));
      const manifest = await readJson(MANIFEST);
      const shared = coveredElsewhere(d.members, manifest.chunks, new Set([`chunk-face-${run}`]));
      let dropped: string[] = [];
      if (shared.size) {
        const t = trimShared(d.members, new Set(shared.keys()));
        if ('error' in t) { rows.push({...base, ...stripInfo, run, pands: d.members.length, mode, status: 'failed', reasons: [`corner-shared: ${t.error} (owned by ${[...new Set(shared.values())].join(', ')})`], seconds: +((performance.now() - tr) / 1000).toFixed(1)} as Row); await save(); continue; }
        dropped = t.dropped;
        run = await trimmedFace(run, t.keep, t.dropped);
        console.log(`  ${run}: corners ${dropped.map(p => `${p.slice(-6)} (${shared.get(p)})`).join(', ')} stay with their installed chunk`);
      }
      const intentBefore = await fs.readFile(path.join(FACES, run, 'intent.json'), 'utf8');
      // Front facings -> house palette (batchInstall.ts facingsToHousePalette): the facing z-fights shop doors.
      const ij = JSON.parse(intentBefore), facings = facingsToHousePalette(ij);
      if (facings.length) { await writeJson(path.join(FACES, run, 'intent.json'), ij); console.log(`  ${run}: ${facings.length} front facing(s) -> house palette`); }
      const j = await judgeRun(run, stripVerdict);
      const pands = (await readJson(path.join(FACES, run, 'discovery.json'))).members.length;
      let status: Row['status'] = j.verdict.install ? (flag('install') ? 'installed' : 'passed (not installed: no --install)') : 'failed';
      if (j.verdict.install && flag('install') && j.compiled) await quiet(() => installFace(run, j.compiled!.entry, j.compiled!.glbPath));
      // Nothing installed: the face stays as it was (no wall-fit edits, no trimmed copy left behind).
      else if (dropped.length) await fs.rm(path.join(FACES, run), {recursive: true, force: true});
      else if (j.wallFits || facings.length) await fs.writeFile(path.join(FACES, run, 'intent.json'), intentBefore);
      rows.push({...base, ...stripInfo, run, pands, mode, status, reasons: j.verdict.reasons, nccMin: j.nccMin, nccMedian: j.nccMedian, stripOverDrawn: j.stripOverDrawn, wallFits: j.wallFits, droppedCorners: dropped, triangles: j.triangles, sheet: j.sheet, seconds: +((performance.now() - tr) / 1000).toFixed(1)});
      console.log(`  ${run}: ${status.toUpperCase()} ${pands} pands | NCC min ${j.nccMin} med ${j.nccMedian} | stripOverDrawn ${j.stripOverDrawn} | wall fits ${j.wallFits}${j.verdict.reasons.length ? ' | ' + j.verdict.reasons.join(' ; ') : ''}`);
      await save();
    }
  }
  if (flag('intake-only')) return;
  await save();
  // Contact sheet: a seeded 10 % of the installs, review sheets at thumbnail width.
  const installs = rows.filter(r => r.status === 'installed' && r.sheet && existsSync(r.sheet));
  const pick = sampleShare(installs, 0.1);
  if (pick.length) {
    const W = 1100, tiles = await Promise.all(pick.map(async r => {
      const img = await sharp(r.sheet!).resize({width: W}).jpeg().toBuffer(), meta = await sharp(img).metadata();
      const label = Buffer.from(`<svg width="${W}" height="26" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="26" fill="#1f2328"/><text x="8" y="18" font-family="sans-serif" font-size="15" fill="#fff">${r.run} (${r.street}, ${r.pands} pands) NCC ${r.nccMin}-${r.nccMedian} stripOverDrawn ${r.stripOverDrawn}</text></svg>`);
      return {img, label, h: meta.height! + 26};
    }));
    const H = tiles.reduce((a, t) => a + t.h, 0);
    let y = 0;
    const comps = tiles.flatMap(t => { const c = [{input: t.label, left: 0, top: y}, {input: t.img, left: 0, top: y + 26}]; y += t.h; return c; });
    const out = path.join(STAGING, 'batch', name, 'contact.jpg');
    await sharp({create: {width: W, height: H, channels: 3, background: '#1f2328'}}).composite(comps).jpeg({quality: 80}).toFile(out);
    console.log(`contact sheet (${pick.length} of ${installs.length} installs): ${out}`);
  }
  const rep = await readJson(reportFile);
  console.log(`${reportFile}: ${JSON.stringify(rep.totals)}`);
  await closeRenderer();
  // The sunny look needs an exposure entry per installed chunk (test:look); that data file is the integrator's.
  if (rows.some(r => r.status === 'installed')) console.log('integrator: npx tsx scripts/look/build-chunk-wall-exposure.ts --write; covers; bake-frontages; buurt pages; archive strips');
}

if (process.argv[1]?.endsWith('block-face/batch.ts')) await main();
