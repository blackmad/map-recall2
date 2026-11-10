/**
 * Jev facade spike (lane J1, #326): build the truth set. For every archived block-face strip, resolve each house's
 * hand-authored design (houseIntents) into the twelve answers the spike asks, join the RCE register facts for listed
 * pands, and crop the pand's span out of the rectified strip (no new fetches).
 *
 *   MAP_RECALL_SOURCE_DATA=<checkout> node --import tsx scripts/jev/build-set.ts [--out=.cache/jev-facades] [--pick=50]
 *
 * Writes <out>/candidates.json (all usable houses), <out>/set.json (the picked set) and <out>/crops/<pand>.jpg.
 * Crops stay outside the repo (panorama-derived; the archive holds the strips).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {houseIntents} from '../../src/canalRecall/blockFace/intent.ts';

const arg = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const ARCHIVE = process.env.MAP_RECALL_SOURCE_DATA ?? '/Users/blackmad/Code/map-recall2-source-data';
const OUT = path.resolve(arg('out', '.cache/jev-facades')), PICK = +arg('pick', '50');
const STRIPS = path.join(ARCHIVE, 'block-face-strips'), FACES = 'scripts/block-face/faces';
const register = JSON.parse(await fs.readFile('public/data/extracts/amsterdam/monument-facts.json', 'utf8')).buildings as Record<string, any>;

export const GABLE_MAP: Record<string, string> = {spout: 'spout', neck: 'neck', 'raised-neck': 'neck', shouldered: 'neck', bell: 'bell', step: 'step', point: 'plain', cornice: 'cornice', flat: 'cornice'};
const REG_GABLE: Record<string, string> = {spout: 'spout', neck: 'neck', raisedNeck: 'neck', bell: 'bell', step: 'step', plain: 'plain', cornice: 'cornice'};
const REG_FINISH: Record<string, string> = {brick: 'brick', ornamentalBrick: 'brick', plaster: 'plaster', stone: 'stone', painted: 'painted brick'};

/** White-ish frame: a named white/cream paint, or a measured hex that is light and nearly grey. */
export function whiteFrame(frame: unknown): boolean | null {
  if (typeof frame !== 'string') return null;
  if (/white|cream|ivory/i.test(frame)) return true;
  const m = /^#([0-9a-f]{6})$/i.exec(frame);
  if (!m) return false;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return (r + g + b) / 3 >= 0.6 && max - min <= 0.12;
}
const upperBays = (bays: unknown): number | null => Array.isArray(bays) ? Math.max(...bays.slice(1).length ? bays.slice(1) : bays) : typeof bays === 'number' ? bays : null;

type Cand = Record<string, any>;
const cands: Cand[] = [];
// Strip images live in the archive as <face>/strip.jpg or <buurt-round>/strip-<face>.jpg; strip.json lives with the intent.
const images = new Map<string, string>();
for (const dir of await fs.readdir(STRIPS)) {
  const files = await fs.readdir(path.join(STRIPS, dir)).catch(() => [] as string[]);
  for (const f of files) {
    if (f === 'strip.jpg') images.set(dir, path.join(STRIPS, dir, f));
    const m = /^strip-(.+)\.jpg$/.exec(f);
    if (m && !images.has(m[1])) images.set(m[1], path.join(STRIPS, dir, f));
  }
}
let dimMismatch = 0;
for (const face of [...images.keys()].sort()) {
  const ip = path.join(FACES, face, 'intent.json'), sp = path.join(FACES, face, 'strip.json'), jpg = images.get(face)!;
  try { await fs.access(ip); await fs.access(sp); } catch { continue; }
  const intent = JSON.parse(await fs.readFile(ip, 'utf8')), strip = JSON.parse(await fs.readFile(sp, 'utf8'));
  const meta = await sharp(jpg).metadata();
  if (meta.width !== strip.width || meta.height !== strip.height) { dimMismatch++; continue; }
  let houses;
  try { houses = houseIntents(intent); } catch (e) { console.warn(`${face}: ${(e as Error).message.slice(0, 120)}`); continue; }
  for (const [i, h] of houses.entries()) {
    const span = strip.spans?.find((s: any) => s.pandId === h.pandId);
    if (!span || span.fallbackDate) continue;
    const fronts = h.fronts.filter((f: any) => f.street === intent.street);
    if (!fronts.length) continue;
    const f0: any = fronts[0], pal: any = h.palette ?? {};
    const reg = register[`NL.IMBAG.Pand.${h.pandId}`];
    const kitGable = GABLE_MAP[f0.gable] ?? null;
    const regGable = reg?.gable ? REG_GABLE[reg.gable] ?? null : null;
    const finishKit = pal.wallMaterial === 'stucco' ? 'plaster' : pal.wallMaterial === 'painted-brick' ? 'painted brick' : 'brick';
    const bays = fronts.reduce((s: number, f: any) => s + (upperBays(f.bays) ?? 0), 0);
    const px = [Math.max(0, Math.round(span.px[0])), Math.min(strip.width, Math.round(span.px[1]))], widthPx = px[1] - px[0];
    const doorBays = f0.doorBay === null || f0.doorBay === undefined ? null : f0.doorBay;
    cands.push({
      pandId: h.pandId, face, image: jpg, address: intent.houses[i].address, street: intent.street, widthPx, heightPx: strip.height, px, coverage: strip.coverage ?? null,
      panoDate: span.date, panoIds: (span.panoramas ?? []).map((p: any) => p.panoId).slice(0, 3),
      registerNr: reg?.nr ?? null, builtYearRegister: reg?.coreDate?.from ?? reg?.facadeDate?.from ?? null,
      truth: {
        gable: regGable ?? kitGable, gableSource: regGable ? 'register' : 'kit', gableKit: kitGable, gableRegister: regGable,
        finish: reg?.finish ? REG_FINISH[reg.finish] : finishKit, finishSource: reg?.finish ? 'register' : 'kit', finishKit,
        whiteFrames: whiteFrame(pal.frame), frameValue: pal.frame ?? null,
        stoneBands: reg?.stoneBands === true ? true : fronts.some((f: any) => f.bands && f.bands !== 'none'),
        shopfront: fronts.some((f: any) => !!f.shopfront),
        basementEntrance: fronts.some((f: any) => f.basement && f.basement !== 'none') || fronts.some((f: any) => !!f.souterrain),
        dormer: fronts.some((f: any) => (f.dormers ?? 0) > 0 || !!f.tower) || !!reg?.elements?.some((e: any) => e.key === 'dormer'),
        bays, modules: fronts.length, doorBay: fronts.length === 1 ? doorBays : null,
      },
    });
  }
}
await fs.mkdir(path.join(OUT, 'crops'), {recursive: true});
await fs.writeFile(path.join(OUT, 'candidates.json'), JSON.stringify(cands, null, 1));

// Listed canal houses: the archived per-wall panorama crops (pand-reference-walls) joined to the register only.
// The front is the cropped wall seen most squarely and least behind trees; kit-only answers stay null (unscored).
const WALLS = path.join(ARCHIVE, 'pand-reference-walls');
const walls: Cand[] = [];
for (const pand of (await fs.readdir(WALLS)).sort()) {
  const reg = register[`NL.IMBAG.Pand.${pand}`];
  if (!reg?.gable || !REG_GABLE[reg.gable]) continue;
  const w = JSON.parse(await fs.readFile(path.join(WALLS, pand, 'walls.json'), 'utf8').catch(() => '{"walls":[]}'));
  const ok = [];
  for (const x of w.walls) if (x.crop && x.widthPx >= 200) { try { await fs.access(path.join(WALLS, pand, `${x.tag}.jpg`)); ok.push(x); } catch { /* not archived */ } }
  if (!ok.length) continue;
  const x = ok.sort((p: any, q: any) => (p.obliquityDeg + 60 * (p.foliage ?? 0)) - (q.obliquityDeg + 60 * (q.foliage ?? 0)))[0];
  walls.push({
    pandId: pand, face: `walls:${pand}`, image: path.join(WALLS, pand, `${x.tag}.jpg`), address: null, street: null, widthPx: x.widthPx, heightPx: x.heightPx,
    px: [0, x.widthPx], panoDate: x.capturedAt, panoIds: [x.panoId], wallTag: x.tag, wallWidthM: x.wallWidthM, registerNr: reg.nr, builtYearRegister: reg.coreDate?.from ?? reg.facadeDate?.from ?? null,
    truth: {
      gable: REG_GABLE[reg.gable], gableSource: 'register', gableKit: null, gableRegister: REG_GABLE[reg.gable],
      finish: reg.finish ? REG_FINISH[reg.finish] : null, finishSource: reg.finish ? 'register' : null, finishKit: null,
      whiteFrames: null, frameValue: null, stoneBands: reg.stoneBands === true ? true : null, shopfront: null,
      basementEntrance: reg.basement === true ? true : null, dormer: reg.elements?.some((e: any) => e.key === 'dormer') ? true : null,
      bays: null, modules: 1, doorBay: null,
    },
  });
}
await fs.writeFile(path.join(OUT, 'candidates-walls.json'), JSON.stringify(walls, null, 1));

// Pick: the reviewed listed canal houses, then block-face houses for the rest: usable
// width (>= 140 px at 40 px/m), bays 1-5 for the picture choice, rare gables and non-brick finishes first, at most
// three houses per face and at most 22 shopfronts so the yes/no questions are not one-sided.
const picked: Cand[] = [];
// Reviewed by eye on the 2026-11-10 contact sheet: only these crops show the whole front up to the gable top. The other
// listed walls are ground-floor close-ups, side walls, or large non-canal buildings, where a gable question has no answer.
const REVIEWED_WALLS = arg('walls', '0363100012172275,0363100012172288,0363100012174670,0363100012174673,0363100012174760,0363100012177491,0363100012179886,0363100012180437,0363100012181878').split(',');
picked.push(...walls.filter(w => REVIEWED_WALLS.includes(w.pandId)));
const usable = cands.filter(c => c.widthPx >= 140 && c.truth.bays >= 1 && c.truth.bays <= 5 && c.truth.gable);
const score = (c: Cand) => (c.registerNr ? 4 : 0) + ({step: 5, bell: 5, neck: 5, spout: 5, plain: 5, cornice: 0} as any)[c.truth.gable] + (c.truth.basementEntrance ? 1.5 : 0) + (c.truth.finish !== 'brick' ? 2 : 0) + (c.truth.whiteFrames === false ? 2 : 0) + (c.truth.doorBay !== null ? 1 : 0) + (c.truth.bays === 2 || c.truth.bays >= 4 ? 1 : 0);
const perFace = new Map<string, number>();
let shops = 0;
for (const c of [...usable].sort((a, b) => score(b) - score(a) || a.pandId.localeCompare(b.pandId))) {
  if (picked.length >= PICK) break;
  if ((perFace.get(c.face) ?? 0) >= 3 || (c.truth.shopfront && shops >= 22)) continue;
  perFace.set(c.face, (perFace.get(c.face) ?? 0) + 1); picked.push(c); if (c.truth.shopfront) shops++;
}
for (const c of picked) {
  const img = sharp(c.image).extract({left: c.px[0], top: 0, width: c.widthPx, height: c.heightPx});
  // Within Jev's 280..1568 px per side: scale so the short side is >= 320 and the long side <= 1400.
  const s = Math.min(1400 / Math.max(c.widthPx, c.heightPx), Math.max(1, 320 / Math.min(c.widthPx, c.heightPx)));
  const w = Math.round(c.widthPx * s), hgt = Math.round(c.heightPx * s);
  c.crop = {file: `crops/${c.pandId}.jpg`, width: w, height: hgt};
  await img.resize(w, hgt).jpeg({quality: 88}).toFile(path.join(OUT, c.crop.file));
}
await fs.writeFile(path.join(OUT, 'set.json'), JSON.stringify(picked, null, 1));
const tally = (k: string) => Object.entries(picked.reduce((m: any, c) => ((m[String(c.truth[k])] = (m[String(c.truth[k])] ?? 0) + 1), m), {})).map(([a, b]) => `${a}:${b}`).join(' ');
console.log(`faces with images ${images.size}, size mismatches ${dimMismatch}; candidates ${cands.length}, usable ${usable.length}, walls ${walls.length}, picked ${picked.length} (${perFace.size} faces), listed ${picked.filter(c => c.registerNr).length}`);
for (const k of ['gable', 'gableSource', 'finish', 'whiteFrames', 'stoneBands', 'shopfront', 'basementEntrance', 'dormer', 'bays', 'doorBay']) console.log(`  ${k}: ${tally(k)}`);
