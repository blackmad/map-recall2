/**
 * Belt review (R3): up to 6 rectified photo candidates per pand of one block face, for stage 1 of the loop (David picks the
 * right crop per house). Reuses the house:crops route: pickWall, rankPanos, yearCandidates, rectifyWall / wallCrop at 50 px/m
 * for the calibrated flags, stripCrop (planStrip) for the narrow-street fallback, usability / hardPass, the Jev judge and
 * pick.ts `choose` for the automatic pick.
 *
 *   PAND_REFERENCE_CACHE=~/Code/map-recall2/.cache/pand-reference \
 *   node --import tsx scripts/belt-review/prepare.ts --face <faceId> --archive <source-data checkout> [--judge] [--budget 0.5]
 *        [--prompt v1|v2] [--max 6] [--pand id,id] [--offline] [--rate-ms 500]
 *
 * Reads review-data/belt-review/<faceId>/face.json (scripts/belt-review/face.ts). Writes the images to
 * <archive>/belt-review/<faceId>/<pandId>/<candidateId>.jpg with a provenance copy of candidates.json beside them, and
 * review-data/belt-review/<faceId>/candidates.json + report.md in the game repo. The display image is rectified at the
 * panorama's native resolution at the wall (50-100 px/m); the flags are measured on the 50 px/m crop house:crops calibrated.
 * --judge asks Jev (TYPESAFE_API_KEY, run through zsh -lic) for each hard-passing candidate not judged before; $0.0001 a crop.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { http, neighbourhood, findPands, CACHE_DIR, lngLatToRd, type Footprint } from '../pand-reference/core.ts';
import { pickWall, rankPanos, options as selectOptions, type Wall, type PanoPick } from '../pand-reference/select.ts';
import jpeg from 'jpeg-js';
import { loadPano, rectifyWall, wallHeight, FALLBACK_GROUND_NAP } from '../pand-reference/rectify.ts';
import { panosNear, wallCrop, stripCrop, flagsFor, leafOff, type Made } from '../house-crops/crops.ts';
import { usability, rayBlocked, groupFaces, diskGate, DISK_FLOOR_BYTES, type WallRef } from '../house-crops/flags.ts';
import { centroid } from '../house-crops/buurt.ts';
import os from 'node:os';
import sharp from 'sharp';
import { ask, judgeSize, parseAnswers, quality, MODEL, USD_PER_TOKEN, type PromptVersion } from '../house-crops/judge.ts';
import { planWallPicks, stripYears, wantsStrips, finalCandidates, autoPick, reviewHardPass, MAX_CANDIDATES, type PoolPick } from './candidates.ts';
import { USER_AGENT, faceDir } from './face.ts';
import type { Candidate, CandidatesFile, FaceFile, PandCandidates } from './faceModel.ts';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const has = (n: string) => process.argv.includes(`--${n}`);
const r1 = (v: number) => +v.toFixed(1);
const ATTRIBUTION = 'Gemeente Amsterdam, Panoramabeelden (CC BY 4.0; faces and number plates blurred by the publisher)';
/** Display scale: the panorama's native resolution on the wall at three-quarter height (equirectangular width / (2 pi r), r the
 *  camera's distance to that point, camera 2.44 m up), clamped to 50-100 px/m in 5 px/m steps. A close camera is sharp at the
 *  door but not at the cornice, so the upper wall decides. */
export const displayPpm = (panoWidth: number, distM: number, wallHeightM = 16) => { const r = Math.hypot(Math.max(distM, 1), Math.max(0, wallHeightM * 0.75 - 2.44)); const n = panoWidth / (2 * Math.PI * r); return { native: r1(n), ppm: Math.min(100, Math.max(50, Math.floor(n / 5) * 5)) }; };
const bearing = (w: { nx: number; ny: number }) => (Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360;
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const shortPano = (id: string) => id.replace(/[^A-Za-z0-9_-]+/g, '');

/** Extra height of the display crop over the flags crop (house:crops covers the tile height + 1.5 m). */
export const DISPLAY_EXTRA_M = 3;

type Ctx = { faceId: string; root: string; maxCands: number };

async function candidatesFor(fp: Footprint, wall: Wall, face: WallRef[], ctx: Ctx): Promise<Omit<PandCandidates, 'pandId' | 'address' | 'order' | 'autoPick' | 'autoPickWhy'>> {
  const panos = await panosNear(wall.mid);
  const others = (await neighbourhood(centroid(fp.ring))).filter(o => o.id !== fp.id).map(o => o.ring);
  const camRd = (rec: any) => lngLatToRd([rec.geometry.coordinates[0], rec.geometry.coordinates[1]]);
  const isBlocked = (rec: any) => rayBlocked(camRd(rec), wall.mid, [wall.nx, wall.ny], others);
  const ranked = rankPanos(wall, panos);
  const wallInfo = { lenM: +wall.len.toFixed(2), bearingDeg: Math.round(bearing(wall)), note: '' };
  if (!ranked.length) return { wall: wallInfo, status: 'no-pano', note: `no panorama 5-35 m from the wall within 55 deg (${panos.length} listed)`, candidates: [] };
  const pool: PoolPick[] = ranked.map(p => ({ ...p, blocked: isBlocked(p.record), cam: camRd(p.record) }));
  // A boat panorama (surface W) sits ~2.5 m below the street, so "camera height - 2.44 m" puts the crop's foot in the canal and
  // cuts the roof off: rectify it on the street ground measured by the land panoramas instead.
  const ground = landGround(panos);
  const dir = path.join(ctx.root, 'belt-review', ctx.faceId, idOf(fp.id));
  await fs.mkdir(dir, { recursive: true });
  const out: Candidate[] = [];
  const emit = async (made: Made, pick: PanoPick, source: 'wall' | 'strip', img: { jpeg: Buffer; ppm: number; width: number; height: number; native: number }, note: string[]) => {
    const u = usability(made.flags), date = pick.timestamp.slice(0, 10), year = Number(date.slice(0, 4));
    const id = `${source === 'wall' ? 'w' : 's'}-${date}-${shortPano(pick.panoId)}`;
    const file = `${idOf(fp.id)}/${id}.jpg`;
    await fs.writeFile(path.join(ctx.root, 'belt-review', ctx.faceId, file), img.jpeg);
    if (img.ppm < 50) note.push(`${img.ppm} px/m: the wall is too large for the pixel budget`);
    if (img.native < 50) note.push(`the panorama gives only ${img.native} px/m at this distance (upsampled to ${img.ppm})`);
    out.push({
      id, file, year, month: Number(date.slice(5, 7)), distM: r1(pick.distM), obliquityDeg: r1(pick.obliquityDeg), source, flags: made.flags, reasons: u.reasons, hardPass: reviewHardPass(u.reasons, made.flags.wallWidthM), usable: u.usable,
      pano: { id: pick.panoId, date, surface: pick.surface === 'W' ? 'water' : 'land',...(made.picks.length > 1 ? { ids: made.picks.map(p => p.panoId) } : {}) }, leafOff: leafOff(pick.timestamp), rayBlocked: made.flags.rayBlocked,
      ppm: r1(img.ppm), nativePpm: img.native, width: img.width, height: img.height, ...(note.length ? { note: note.join('; ') } : {}),
    });
  };

  // Wall route: straight views across years and positions.
  const wallPicks = planWallPicks(pool, ctx.maxCands);
  for (const pick of wallPicks) {
    let made: Made | null = null;
    const baseZ = pick.surface === 'W' ? ground : undefined;
    try { made = baseZ === undefined ? await wallCrop(fp, wall, pick, pick.blocked) : await wallCropOn(fp, wall, pick, pick.blocked, baseZ); } catch (e: any) { if (!http.offline) throw e; }
    if (!made) continue;
    const pano = await loadPano(pick);
    const { native, ppm } = displayPpm(pano!.img.width, pick.distM, wallHeight(fp.height + DISPLAY_EXTRA_M));
    let img = { jpeg: made.jpeg, ppm: made.ppm, width: made.width, height: made.height, native };
    // The display crop reaches DISPLAY_EXTRA_M higher than the flags crop: the tile height + 1.5 m cuts step and neck gables off.
    {
      const big = rectifyWall(pano!.img, pick, wall, fp.height + DISPLAY_EXTRA_M, ppm, baseZ);
      if (big) img = { jpeg: big.jpeg, ppm: big.ppm, width: big.width, height: big.height, native };
    }
    const note: string[] = [];
    if (pick.blocked) note.push('camera ray crosses another building');
    if (pick.distM < 8) note.push('camera under 8 m from the wall: the cornice is seen steeply');
    if (baseZ !== undefined) note.push(`from a boat on the canal; ground set to the street (${baseZ.toFixed(2)} m NAP)`);
    await emit(made, pick, 'wall', img, note);
  }

  // Strip fallback (planStrip, one capture day, up to 3 panoramas median-fused) for narrow walls, oblique-only views or too few good walls.
  const goodWalls = out.filter(c => c.hardPass).length;
  if (wantsStrips(wall.len, wallPicks.length, goodWalls)) {
    for (const year of stripYears(pool)) {
      const yearAll = panos.filter(p => Number(p.mission_year ?? String(p.timestamp).slice(0, 4)) === year);
      // The strip fuses on one ground: keep the land panoramas when the year has any (boat captures sit below the street).
      const yearPanos = yearAll.some(p => p.surface_type !== 'W') ? yearAll.filter(p => p.surface_type !== 'W') : yearAll;
      let made: Made | 'no-pano' | null = null;
      try { made = await stripCrop(fp, wall, face, yearPanos, isBlocked, 50); } catch (e: any) { if (!http.offline) throw e; }
      if (!made || made === 'no-pano') continue;
      const best = [...made.picks].sort((a, b) => a.obliquityDeg - b.obliquityDeg)[0];
      const pano = await loadPano(best);
      const native = displayPpm(pano?.img.width ?? 8000, best.distM, wallHeight(fp.height)).native;
      await emit(made, { ...best, timestamp: best.timestamp } as PanoPick, 'strip', { jpeg: made.jpeg, ppm: made.ppm, width: made.width, height: made.height, native },
        [`strip slice: ${made.picks.length} panoramas median-fused over the face, weaker evidence`]);
    }
  }
  if (wall.len < 4) wallInfo.note = `narrow wall (${wall.len.toFixed(1)} m)`;
  const kept = finalCandidates(out, ctx.maxCands);
  // Images past the cap (and from earlier runs) are removed, so the archive holds exactly the candidates listed.
  const keep = new Set(kept.map(c => path.basename(c.file)));
  for (const f of await fs.readdir(dir)) if (f.endsWith('.jpg') && !keep.has(f)) await fs.rm(path.join(dir, f));
  return { wall: wallInfo, status: out.length ? 'ok' : 'error', ...(out.length ? {} : { note: 'no panorama could be decoded or rectified' }), candidates: kept };
}

/** The footprint's longest edge (>= 2.5 m) whose outward normal lies within 30 degrees of `bearingDeg`, as a Wall; null without one. */
export function frontEdge(ring: { x: number; y: number }[], bearingDeg: number): Wall | null {
  let area = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += ring[j].x * ring[i].y - ring[i].x * ring[j].y;
  const r = area > 0 ? ring : [...ring].reverse();
  let best: Wall | null = null;
  for (let i = 0; i + 1 < r.length; i++) {
    const a = r[i], b = r[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 2.5) continue;
    const nx = (b.y - a.y) / len, ny = -(b.x - a.x) / len;
    if (angDiff(bearing({ nx, ny }), bearingDeg) > 30 || (best && best.len >= len)) continue;
    best = { a, b, len, nx, ny, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, roadDistM: NaN, facing: 1 };
  }
  return best;
}

/** Street ground (NAP) from the land panoramas' published camera heights (camera 2.44 m up), median; FALLBACK_GROUND_NAP without any. */
export function landGround(panos: any[]): number {
  const g = panos.filter(p => p.surface_type !== 'W').map(p => Number(p.geometry?.coordinates?.[2]) - 43.5 - 2.44).filter(z => z > -2.5 && z < 3).sort((a, b) => a - b);
  return g.length ? g[g.length >> 1] : FALLBACK_GROUND_NAP;
}

/** wallCrop (house:crops, 50 px/m, the calibrated flags) on a given ground height. */
async function wallCropOn(fp: Footprint, wall: Wall, pick: PanoPick, blocked: boolean, baseZ: number): Promise<Made | null> {
  const pano = await loadPano(pick);
  if (!pano) return null;
  const crop = rectifyWall(pano.img, pick, wall, fp.height, 50, baseZ);
  if (!crop) return null;
  const d = jpeg.decode(crop.jpeg, { useTArray: true });
  return { jpeg: crop.jpeg, width: crop.width, height: crop.height, ppm: r1(crop.ppm), flags: flagsFor(d.data, crop.alpha, crop.width, crop.height, pick, { blocked, wallWidthM: wall.len, strip: false }), method: 'wall', picks: [pick],
    wallWidthM: +crop.wallWidthM.toFixed(2), wallHeightM: +crop.wallHeightM.toFixed(2), baseZ: +crop.baseZ.toFixed(3), groundSource: `street ground from the land panoramas (${baseZ.toFixed(2)} m NAP)` };
}
const idOf = (fpId: string) => fpId.replace('NL.IMBAG.Pand.', '');

async function judgeAll(file: CandidatesFile, prior: Map<string, Candidate>, prompt: PromptVersion, budget: number): Promise<{ asked: number; spent: number }> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) { console.error('--judge: TYPESAFE_API_KEY is not set (run through zsh -lic); skipping the judge'); return { asked: 0, spent: 0 }; }
  let spent = 0, asked = 0;
  for (const p of file.pands) for (const c of p.candidates) {
    const was = prior.get(`${p.pandId}/${c.id}`);
    if (was?.judge && was.pano.id === c.pano.id && was.width === c.width && was.height === c.height) { c.judge = was.judge; continue; }
    if (!c.hardPass) continue;
    if (spent >= budget) { console.error('judge budget reached'); return { asked, spent }; }
    // Jev needs both sides >= 280 px after a resize to <= 1400 px: a tall narrow front (aspect over ~5, Herengracht 6 and 62) is
    // padded with grey sides for the judge only.
    let img = path.join(file.imageRoot, c.file);
    if (!judgeSize(c.width, c.height)) {
      const w = Math.ceil(c.height / 4.5), side = Math.ceil((w - c.width) / 2);
      img = path.join(os.tmpdir(), `belt-review-judge-${process.pid}.jpg`);
      await sharp(path.join(file.imageRoot, c.file)).extend({ left: side, right: side, background: { r: 128, g: 128, b: 128 } }).jpeg({ quality: 90 }).toFile(img);
    }
    let r = await ask(key, img, prompt);
    // A network error (status 0, e.g. a DNS blip) is retried twice after a pause; the judge costs nothing when it fails.
    for (let i = 0; i < 2 && r.status === 0 && String(r.body?.error ?? '').startsWith('network'); i++) { await new Promise(res => setTimeout(res, 3000 * (i + 1))); r = await ask(key, img, prompt); }
    if (r.status === 401 || r.status === 403) { console.error(`judge auth error ${r.status}; stopping (fail closed)`); return { asked, spent }; }
    try {
      if (r.status !== 200) throw new Error(`HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 100)}`);
      const a = parseAnswers(r.body); spent += a.tokens * USD_PER_TOKEN; asked++;
      c.judge = { quality: quality(a), score: +a.score.toFixed(3), occluded: +a.occluded.toFixed(3), closeUp: +a.closeUp.toFixed(3), model: `${MODEL}/${prompt}` };
    } catch (e: any) { console.error(`${p.pandId} ${c.id}: ${e.message}`); }
  }
  return { asked, spent };
}

export function report(face: FaceFile, file: CandidatesFile, extra: string[]): string {
  const n = file.pands.length;
  const withHard = file.pands.filter(p => p.candidates.some(c => c.hardPass));
  const wallHard = withHard.filter(p => p.candidates.some(c => c.hardPass && c.source === 'wall'));
  const stripOnly = withHard.length - wallHard.length;
  const none = n - withHard.length;
  const judged = file.pands.flatMap(p => p.candidates).filter(c => c.judge);
  const judgedGood = file.pands.filter(p => p.candidates.some(c => c.hardPass && (c.judge?.quality ?? 0) >= 0.5));
  const reasons = new Map<string, number>(), primary = new Map<string, number>();
  for (const p of file.pands) for (const c of p.candidates) { for (const r of c.reasons) reasons.set(r, (reasons.get(r) ?? 0) + 1); }
  for (const p of file.pands.filter(p => !p.candidates.some(c => c.hardPass))) {
    const why = p.candidates.length ? [...new Set(p.candidates.flatMap(c => c.reasons))].join('+') : p.status + (p.note ? `: ${p.note}` : '');
    primary.set(why, (primary.get(why) ?? 0) + 1);
  }
  const all = file.pands.flatMap(p => p.candidates);
  const lowRes = all.filter(c => c.nativePpm < 50).length, small = all.filter(c => c.ppm < 50).length;
  const pct = (a: number) => `${Math.round(100 * a / Math.max(1, n))} %`;
  const L = [
    `# Belt review candidates: ${face.street} ${face.from}-${face.to} (${face.side} side)`, '',
    `Face \`${file.faceId}\`, generated ${file.generatedAt.slice(0, 16).replace('T', ' ')} by \`scripts/belt-review/prepare.ts\`. Images: \`${file.archivePath}\` in map-recall2-source-data.`, '',
    '| | pands | share |', '|---|---:|---:|',
    `| pands on the face | ${n} | |`,
    `| with at least one hard-pass candidate | ${withHard.length} | ${pct(withHard.length)} |`,
    `| ... of which a wall crop passes | ${wallHard.length} | ${pct(wallHard.length)} |`,
    `| strip-only (only a strip slice passes) | ${stripOnly} | ${pct(stripOnly)} |`,
    `| none (no candidate passes the hard flags) | ${none} | ${pct(none)} |`,
    `| judged good (hard pass and Jev quality >= 0.5) | ${judgedGood.length} | ${pct(judgedGood.length)} |`, '',
    `Candidates: ${all.length} (${all.filter(c => c.source === 'wall').length} wall, ${all.filter(c => c.source === 'strip').length} strip), ${(all.length / Math.max(1, n)).toFixed(1)} per pand; ${all.filter(c => c.hardPass).length} pass the hard flags, ${all.filter(c => c.usable).length} pass every flag; ${all.filter(c => c.leafOff).length} leaf-off; ${judged.length} judged.`,
    `Distinct capture years per pand: median ${median(file.pands.map(p => new Set(p.candidates.map(c => c.year)).size))}.`,
    `Resolution: display images are ${Math.min(...all.map(c => c.ppm))}-${Math.max(...all.map(c => c.ppm))} px/m (median ${median(all.map(c => c.ppm))}); ${small} below 50 px/m (pixel budget on a wide wall), ${lowRes} where the panorama itself gives under 50 px/m (camera over ~25 m away, upsampled).`, '',
    '## Failure reasons', '', 'Every broken flag over all candidates (a candidate can break several):', '',
    '| reason | candidates |', '|---|---:|', ...[...reasons].sort((a, b) => b[1] - a[1]).map(([r, k]) => `| ${r} | ${k} |`), '',
    'Pands with no hard-passing candidate, by the reasons their candidates broke:', '',
    '| reasons | pands |', '|---|---:|', ...[...primary].sort((a, b) => b[1] - a[1]).map(([r, k]) => `| ${r} | ${k} |`), '',
    '## Per pand', '', '| # | address | wall m | cands | hard | strip | auto-pick | why |', '|---:|---|---:|---:|---:|---:|---|---|',
    ...file.pands.map(p => `| ${p.order} | ${p.address} | ${p.wall?.lenM ?? '-'} | ${p.candidates.length} | ${p.candidates.filter(c => c.hardPass).length} | ${p.candidates.filter(c => c.source === 'strip').length} | ${p.autoPick ?? '-'} | ${p.autoPickWhy ?? p.note ?? ''} |`),
    '', ...extra,
  ];
  return L.join('\n') + '\n';
}
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };

async function main() {
  const faceId = arg('face');
  const archive = arg('archive') ?? process.env.HOUSE_CROPS_ARCHIVE;
  if (!faceId || !archive) { console.error('usage: prepare.ts --face <faceId> --archive <source-data checkout> [--judge] [--budget usd] [--prompt v1|v2] [--max 6] [--pand a,b] [--offline] [--rate-ms 500]'); process.exit(2); }
  const face: FaceFile = JSON.parse(await fs.readFile(path.join(faceDir(faceId), 'face.json'), 'utf8'));
  const root = path.resolve(archive), maxCands = Number(arg('max') ?? MAX_CANDIDATES);
  http.minGapMs = Math.max(500, Number(arg('rate-ms') ?? 500)); http.maxAttempts = 6; http.userAgent = USER_AGENT; http.offline = has('offline');
  if (!http.offline) {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const st = await fs.statfs(CACHE_DIR), gate = diskGate(st.bavail * st.bsize, face.pands.length * 6);
    console.log(`disk: ${(st.bavail * st.bsize / 1024 ** 3).toFixed(1)} GB free; ~${(gate.estimatedBytes / 1024 ** 3).toFixed(1)} GB of panoramas at most (floor ${DISK_FLOOR_BYTES / 1024 ** 3} GB); cache ${CACHE_DIR}`);
    if (!gate.ok) { console.error('refusing to start: under 15 GB would remain'); process.exit(4); }
  }
  const only = arg('pand') ? new Set(arg('pand')!.split(',')) : null;
  const pands = face.pands.filter(p => !only || only.has(p.pandId));
  // Walls of the whole face (no network), so a --pand run sees the same face bearing as a full run.
  const fps = await findPands(face.pands.map(p => p.pandId));

  // Walls first: pickWall per pand; a pand whose wall faces away from the face's common bearing (a side or back wall) is re-picked toward it.
  const walls = new Map<string, Wall>(), notes = new Map<string, string>();
  for (const p of face.pands) {
    const fp = fps.get(`NL.IMBAG.Pand.${p.pandId}`); if (!fp) { notes.set(p.pandId, 'pand not in the building tiles'); continue; }
    const { wall, note } = await pickWall(fp, await neighbourhood(centroid(fp.ring)));
    if (wall) walls.set(p.pandId, wall); else notes.set(p.pandId, note);
  }
  const bs = [...walls.values()].map(bearing), sx = bs.reduce((s, b) => s + Math.sin(b * Math.PI / 180), 0), sy = bs.reduce((s, b) => s + Math.cos(b * Math.PI / 180), 0);
  const faceBearing = Math.round((Math.atan2(sx, sy) * 180 / Math.PI + 360) % 360);
  const repicked: string[] = [];
  for (const [id, w] of walls) if (angDiff(bearing(w), faceBearing) > 50) {
    selectOptions.preferBearingDeg = faceBearing;
    const fp = fps.get(`NL.IMBAG.Pand.${id}`)!;
    const { wall, note } = await pickWall(fp, await neighbourhood(centroid(fp.ring)));
    selectOptions.preferBearingDeg = undefined;
    if (wall && angDiff(bearing(wall), faceBearing) <= 50) { walls.set(id, wall); notes.set(id, `re-picked toward the face bearing ${faceBearing}: ${note}`); repicked.push(id); }
    else {
      // No exposed wall toward the face (a neighbour's stoop or overhang touches the probe points): take the footprint's
      // longest edge facing the face bearing rather than offer the back wall.
      const front = frontEdge(fp.ring, faceBearing);
      if (front) { walls.set(id, front); notes.set(id, `front edge forced toward the face bearing ${faceBearing} (no exposed wall there; pickWall gave ${Math.round(bearing(w))} deg)`); repicked.push(id); }
      else { walls.delete(id); notes.set(id, `wall faces ${Math.round(bearing(w))} deg, the face ${faceBearing}; no footprint edge toward the face`); }
    }
  }
  const refs: WallRef[] = [...walls].map(([id, w]) => ({ id: `NL.IMBAG.Pand.${id}`, a: w.a, b: w.b, nx: w.nx, ny: w.ny }));
  const faceOf = new Map<string, WallRef[]>();
  for (const g of groupFaces(refs)) for (const w of g) faceOf.set(w.id, g);
  console.log(`${face.street} ${face.from}-${face.to}: ${pands.length} pands, ${walls.size} walls, face bearing ${faceBearing} deg, ${repicked.length} re-picked toward it`);

  const outFile = path.join(faceDir(faceId), 'candidates.json');
  const prev: CandidatesFile | null = await fs.readFile(outFile, 'utf8').then(JSON.parse).catch(() => null);
  const prior = new Map<string, Candidate>((prev?.pands ?? []).flatMap(p => p.candidates.map(c => [`${p.pandId}/${c.id}`, c] as [string, Candidate])));
  const file: CandidatesFile = { faceId, imageRoot: path.join(root, 'belt-review', faceId), archivePath: `belt-review/${faceId}`, generatedAt: new Date().toISOString(), pands: [] };
  const ctx: Ctx = { faceId, root, maxCands };
  const t0 = Date.now();
  for (const p of pands) {
    const fp = fps.get(`NL.IMBAG.Pand.${p.pandId}`), wall = walls.get(p.pandId);
    let entry: PandCandidates;
    if (!fp || !wall) entry = { pandId: p.pandId, address: p.address, order: p.order, wall: null, status: 'no-wall', note: notes.get(p.pandId), candidates: [], autoPick: null };
    else {
      try { entry = { pandId: p.pandId, address: p.address, order: p.order, ...(await candidatesFor(fp, wall, faceOf.get(fp.id) ?? [], ctx)), autoPick: null }; }
      catch (e: any) { entry = { pandId: p.pandId, address: p.address, order: p.order, wall: null, status: 'error', note: String(e?.message ?? e).slice(0, 200), candidates: [], autoPick: null }; }
      if (notes.has(p.pandId) && entry.wall) entry.wall.note = [entry.wall.note, notes.get(p.pandId)].filter(Boolean).join('; ');
    }
    file.pands.push(entry);
    const c = entry.candidates;
    console.log(`${String(p.order).padStart(3)} ${p.address.padEnd(22)} ${entry.status} ${c.length} cands (${c.filter(x => x.hardPass).length} hard-pass, ${c.filter(x => x.source === 'strip').length} strip) [${http.requests} req, ${http.status429} x429, ${Math.round((Date.now() - t0) / 1000)} s]`);
  }
  // A --pand run keeps the other pands of the previous run (merged before the judge, so their missing scores are filled too).
  if (only && prev) file.pands = [...prev.pands.filter(p => !only.has(p.pandId)), ...file.pands].sort((a, b) => a.order - b.order);
  let judgeLine = 'Not judged (run with --judge).';
  if (has('judge')) {
    const prompt = (arg('prompt') ?? 'v1') as PromptVersion;
    const j = await judgeAll(file, prior, prompt, Number(arg('budget') ?? 0.5));
    file.judgeModel = `${MODEL}/${prompt}`;
    judgeLine = `Judged with ${MODEL} prompt ${prompt}: ${j.asked} new requests, $${j.spent.toFixed(4)}.`;
  } else for (const p of file.pands) for (const c of p.candidates) { const was = prior.get(`${p.pandId}/${c.id}`); if (was?.judge && was.pano.id === c.pano.id && was.width === c.width && was.height === c.height) c.judge = was.judge; }
  for (const p of file.pands) { const a = autoPick(p.candidates); p.autoPick = a.id; p.autoPickWhy = a.why; }
  await fs.writeFile(outFile, JSON.stringify(file, null, 1) + '\n');
  await fs.writeFile(path.join(file.imageRoot, 'candidates.json'), JSON.stringify({ ...file, attribution: ATTRIBUTION, sourceUrl: 'https://api.data.amsterdam.nl/panorama/panoramas/<pano id>/' }, null, 1) + '\n');
  const extra = [`## Run`, '', `${judgeLine} Panorama API: ${http.requests} requests, ${(http.bytes / 1024 ** 2).toFixed(0)} MB, ${http.retries} retries, ${http.status429} x 429; ${Math.round((Date.now() - t0) / 1000)} s.`,
    `Walls re-picked toward the face bearing (${faceBearing} deg): ${repicked.length ? repicked.join(', ') : 'none'}.`, `Attribution: ${ATTRIBUTION}.`];
  await fs.writeFile(path.join(faceDir(faceId), 'report.md'), report(face, file, extra));
  console.log(report(face, file, extra).split('\n').slice(0, 14).join('\n'));
}

if (process.argv[1]?.endsWith('belt-review/prepare.ts')) await main();
