/**
 * Oud-West / De Baarsjes period-palette measurement (lane #373, 2026-11-10). Node only, no browser.
 *
 * The judgement session's finding: whole 1875-1910 rows whose panoramas read dark purple-brown brick draw bright
 * orange-red. This tool measures it: ~30 plain-brick pands of the area, the wall colour of an overcast winter panorama
 * (blockFace/stripPalette.ts measureStripWallFit: windows, foliage and light trim masked, white balance as wallFit uses),
 * and what the game draws for the same pand, from the SAME typed functions the runtime calls (bayLook.ts bayLookFor with
 * the buurt profile, look/cityLook.ts cityLookTint, look/chunkWallExposure.ts photoMatchedWallTint). Nothing is
 * re-implemented, and no default is changed: the proposal is data in this file, applied by `proposedWall` only here.
 *
 *   node --import tsx scripts/house-specs/oudwest-palette.ts select  [--n=48] [--seed=373]
 *   node --import tsx scripts/house-specs/oudwest-palette.ts measure [--want=30] [--budget-mb=1500]
 *   node --import tsx scripts/house-specs/oudwest-palette-report.ts report
 *   node --import tsx scripts/house-specs/oudwest-palette-report.ts pairs [--out=<dir>]
 *
 * Stages read and write staging/oudwest-palette/ (gitignored). Panorama responses are cached by scripts/pand-reference
 * (set PAND_REFERENCE_CACHE to share a cache); `measure` stops at --budget-mb of NEW network bytes.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { loadTile, neighbourhood, http, type Footprint } from '../pand-reference/core.ts';
import { pickWall, listPanos, rankPanos, type PanoPick, type Wall } from '../pand-reference/select.ts';
import { loadPano, rectifyWall, aimedThumbnail, foliageFraction, washedOutFraction } from '../pand-reference/rectify.ts';
import { measureStripWallFit } from '../../src/canalRecall/blockFace/stripPalette.ts';
import { labHueChroma, rgbToLab } from '../../src/canalRecall/look/brickTone.ts';
import { bayLookFor } from '../../src/canalRecall/bayLook.ts';
import { buurtProfileAt } from '../../src/canalRecall/buurtProfiles/data.ts';
import { brickLiftOn } from '../../src/canalRecall/look/brickLift.ts';
import { cityLookTint } from '../../src/canalRecall/look/cityLook.ts';
import { photoMatchedWallTint } from '../../src/canalRecall/look/chunkWallExposure.ts';
import { PERIOD_WALLS, hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from '../../src/canalRecall/look/palette.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXT = path.join(ROOT, 'public/data/extracts/amsterdam');
const STAGE = path.join(ROOT, 'staging/oudwest-palette');
const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const readGz = (f: string) => { const b = fs.readFileSync(f); return (b[0] === 0x1f ? zlib.gunzipSync(b) : b).toString('utf8'); };
const readJson = (f: string) => JSON.parse(f.endsWith('.gz') ? readGz(f) : fs.readFileSync(f, 'utf8'));
const AREA = 'Oud-West, De Baarsjes';
const WINTER = new Set([11, 12, 1, 2, 3]);
function mulberry32(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- the drawn colour: the runtime's own functions ------------------------------------------------------------

export interface Drawn { archetype: string; periodHex: string; periodDrawn: string; profileHex: string | null; wallHex: string; tint: string; drawn: string }
/** What the game draws for a generic pand under the flag state of the process (BRICK_LIFT=v2: the v2 lift; else today) (no recipe, kit or measured wall): the period palette pick, or the buurt profile's wall, then the city look's tint and the sunny exposure gain. */
export function drawnToday(pandId: string, year: number, heightM: number, lng: number, lat: number): Drawn {
  const id = pandId.startsWith('NL.IMBAG.Pand.') ? pandId : `NL.IMBAG.Pand.${pandId}`;
  const profile = buurtProfileAt(lng, lat);
  const plain = bayLookFor(id, year, heightM, 'photo', 'quiet', undefined, undefined, null);
  const withProfile = bayLookFor(id, year, heightM, 'photo', 'quiet', undefined, undefined, profile);
  const wall = withProfile.wallHex;
  const tint = cityLookTint('brick', wall, undefined, undefined, undefined, brickLiftOn());
  return { archetype: withProfile.archetype, periodHex: plain.wallHex, periodDrawn: photoMatchedWallTint('brick', cityLookTint('brick', plain.wallHex, undefined, undefined, undefined, brickLiftOn()), null, null), profileHex: withProfile.profileWall ?? null, wallHex: wall, tint, drawn: photoMatchedWallTint('brick', tint, null, null) };
}

export const lch = (hex: string) => { const { L, chroma, hue } = labHueChroma(hexToRgb(hex)); return { L, C: chroma, h: hue }; };
const dHue = (a: number, b: number) => ((a - b + 540) % 360) - 180;

// ---- select -----------------------------------------------------------------------------------------------------

type Stated = 'spec-brick' | 'register-brick' | 'register-light' | 'none';
interface Cand { stated: Stated; pandId: string; buurt: string; year: number; heightM: number; eavesM: number; lng: number; lat: number; tile: [number, number] }
function inPoly(p: [number, number], rings: number[][][]) {
  let yes = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) yes = !yes;
  return yes;
}
function candidates(): Cand[] {
  const buurten = (readJson(path.join(EXT, 'coverage-v1/buurten.json')).features as any[]).filter(f => f.properties.gebied === AREA)
    .map(f => ({ name: f.properties.name as string, polys: (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][] }));
  const covers = readJson(path.join(ROOT, 'public/canal-drive/models/covers.json'));
  const excluded = new Set<string>(covers.buildingTypes);
  for (const m of Object.values<any>(covers.models)) for (const p of m.p) excluded.add(p);
  for (const k of Object.values<any>(readJson(path.join(EXT, 'kit-pands.json')).ids)) if (k.pand) excluded.add(k.pand);
  const register = readJson(path.join(EXT, 'monument-facts.json')).buildings as Record<string, { finish?: string }>;
  const out: Cand[] = [];
  const root = path.join(EXT, 'bag-tiles/14');
  for (const xd of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, xd))) {
    const y = Number(f.split('.')[0]), x = Number(xd), feats = readJson(path.join(root, xd, f)).features as any[];
    const bf = path.join(EXT, 'building-facts/14', xd, `${y}.json.gz`), factsT = fs.existsSync(bf) ? readJson(bf).buildings : {};
    const af = path.join(EXT, 'bag-facts/14', xd, `${y}.json.gz`), arch = fs.existsSync(af) ? readJson(af) : null;
    const specF = path.join(EXT, 'house-specs/14', xd, `${y}.json.gz`), specs = fs.existsSync(specF) ? readJson(specF).buildings : {};
    for (const ft of feats) {
      const p = ft.properties, id: string = p.id;
      if (!id.startsWith('NL.IMBAG.Pand.')) continue;
      const bare = id.slice(14), year = factsT[`P${bare}`]?.[0] ?? p.year;
      if (!(year >= 1875 && year <= 1910) || !(p.year >= 1875 && p.year <= 1910) || excluded.has(bare) || !(p.height >= 9)) continue;
      const a = arch?.archetypes?.[arch.pands?.[bare]?.[0]];
      if (a !== 'c19-terrace' && a !== 'c19-house') continue;
      const spec = specs[id], wm = spec?.d?.palette?.wallMaterial;
      if (wm && wm !== 'brick') continue;
      const fin = register[id]?.finish;
      const stated: Stated = wm === 'brick' ? 'spec-brick' : fin ? (fin === 'brick' || fin === 'ornamentalBrick' ? 'register-brick' : 'register-light') : 'none';
      if (stated === 'register-light') continue;
      const ring = ft.geometry.type === 'Polygon' ? ft.geometry.coordinates[0] : ft.geometry.coordinates[0][0];
      const c: [number, number] = [ring.reduce((s: number, q: number[]) => s + q[0], 0) / ring.length, ring.reduce((s: number, q: number[]) => s + q[1], 0) / ring.length];
      const b = buurten.find(bu => bu.polys.some(poly => inPoly(c, poly)));
      if (!b) continue;
      out.push({ stated, pandId: bare, buurt: b.name, year, heightM: p.height, eavesM: p.eaves ?? p.height * 0.85, lng: c[0], lat: c[1], tile: [x, y] });
    }
  }
  return out;
}

async function select() {
  const n = Number(arg('n', '48')), rnd = mulberry32(Number(arg('seed', '373')));
  const all = candidates();
  console.log(`candidates: ${all.length} generic c19 brick pands 1875-1910 in ${AREA}`);
  const byBuurt = new Map<string, Cand[]>();
  for (const c of all.map(c => ({ c, r: rnd() })).sort((a, b) => a.r - b.r).map(x => x.c)) (byBuurt.get(c.buurt) ?? byBuurt.set(c.buurt, []).get(c.buurt)!).push(c);
  const inc = arg('include', '0363100012160809,0363100012096181').split(',').filter(Boolean);
  const named = all.filter(c => inc.includes(c.pandId));
  console.log(`named examples in the candidate set: ${named.map(c => c.pandId).join(',') || 'none (year, finish or tier filter)'}`);
  const queues = [named, ...byBuurt.values()], picked: any[] = [];
  let tried = 0;
  for (let round = 0; picked.length < n && round < 40; round++) for (const q of queues) {
    if (picked.length >= n) break;
    const c = q[round]; if (!c) continue;
    tried++;
    const tile = await loadTile(c.tile[0], c.tile[1]), fp: Footprint | undefined = tile.find(f => f.id === `NL.IMBAG.Pand.${c.pandId}`);
    if (!fp) { if (inc.includes(c.pandId)) console.log(`named ${c.pandId}: footprint not in building tile ${c.tile}`); continue; }
    const centre = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
    const { wall } = await pickWall(fp, await neighbourhood(centre));
    if (!wall || wall.len < (inc.includes(c.pandId) ? 3.5 : 5)) { if (inc.includes(c.pandId)) console.log(`named ${c.pandId}: no usable wall (${wall?.len ?? 'none'})`); continue; }
    const relaxed = inc.includes(c.pandId);
    // Named examples take a relaxed pick (any season, obliquity under 40 degrees), flagged in the output.
    const ranked = rankPanos(wall, await listPanos(wall.mid), { minD: 6, maxD: 30, strict: [8, 25], maxObliquityDeg: relaxed ? 40 : 30 })
      .filter(p => relaxed || WINTER.has(Number(String(p.timestamp).slice(5, 7))));
    if (!ranked.length) { if (inc.includes(c.pandId)) console.log(`named ${c.pandId}: no panorama`); continue; }
    const pick = ranked[0];
    picked.push({ ...c, relaxed, wall, pick: { panoId: pick.panoId, timestamp: pick.timestamp, distM: +pick.distM.toFixed(1), obliquityDeg: +pick.obliquityDeg.toFixed(1), missionType: pick.missionType } });
    console.log(`${picked.length}/${n} ${c.pandId} ${c.buurt} ${c.year} ${pick.timestamp.slice(0, 10)} obl ${pick.obliquityDeg.toFixed(0)} (tried ${tried})`);
  }
  fs.mkdirSync(STAGE, { recursive: true });
  fs.writeFileSync(path.join(STAGE, 'selection.json'), JSON.stringify({ area: AREA, candidates: all.length, picked }, null, 1));
  console.log(`wrote ${picked.length} picks; network ${(http.bytes / 1e6).toFixed(0)} MB, ${http.requests} requests`);
}

// ---- measure ------------------------------------------------------------------------------------------------------

async function measure() {
  const want = Number(arg('want', '30')), budget = Number(arg('budget-mb', '1500')) * 1e6;
  const sel = JSON.parse(fs.readFileSync(path.join(STAGE, 'selection.json'), 'utf8')).picked as (Cand & { wall: Wall; pick: any; relaxed?: boolean })[];
  fs.mkdirSync(path.join(STAGE, 'crops'), { recursive: true });
  const rows: any[] = [], skipped: any[] = [];
  const records = new Map<string, any>();
  for (const s of sel) {
    if (rows.length >= want) break;
    if (http.bytes > budget) { console.log(`network budget ${budget / 1e6} MB reached`); break; }
    const ranked = rankPanos(s.wall, await listPanos(s.wall.mid), { minD: 6, maxD: 30, strict: [8, 25], maxObliquityDeg: 40 }).filter(p => p.panoId === s.pick.panoId);
    const pick: PanoPick | undefined = ranked[0];
    if (!pick) { skipped.push({ pandId: s.pandId, why: 'pano vanished' }); continue; }
    const pano = await loadPano(pick); if (!pano) { skipped.push({ pandId: s.pandId, why: 'pano load failed' }); continue; }
    const crop = rectifyWall(pano.img, pick, s.wall, s.heightM, 50); if (!crop) { skipped.push({ pandId: s.pandId, why: 'rectify failed' }); continue; }
    const { data, info } = await sharp(crop.jpeg).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const rgb = new Uint8Array(data.buffer, data.byteOffset, data.length);
    const fit = measureStripWallFit({ rgb, width: info.width, height: info.height, x0: 0, x1: info.width, pixelsPerMetre: crop.ppm, eavesM: s.eavesM });
    const why = !fit ? 'no wall pixels' : crop.missingFraction > 0.4 ? `missing ${crop.missingFraction.toFixed(2)}` : crop.foliage > 0.35 ? `foliage ${crop.foliage.toFixed(2)}` : crop.washedOut > 0.25 ? `washed out ${crop.washedOut.toFixed(2)}` : null;
    if (why || !fit) { skipped.push({ pandId: s.pandId, why }); console.log(`skip ${s.pandId}: ${why}`); continue; }
    const m = labHueChroma(hexToRgb(fit.hex));
    // plain brick only: a pale render or paint (L* >= 62) or a neutral grey is not what this audit is about
    if (m.L >= 62 || m.chroma < 4) { skipped.push({ pandId: s.pandId, stated: s.stated, why: 'not brick', measuredHex: fit.hex, L: +m.L.toFixed(1), C: +m.chroma.toFixed(1), kind: m.L >= 62 ? 'render-light' : 'render-grey' }); console.log(`skip ${s.pandId}: not brick`); continue; }
    fs.writeFileSync(path.join(STAGE, 'crops', `${s.pandId}.jpg`), crop.jpeg);
    const thumb = await aimedThumbnail(pick, s.wall, s.heightM).catch(() => null);
    if (thumb) fs.writeFileSync(path.join(STAGE, 'crops', `${s.pandId}-view.jpg`), thumb.jpeg);
    rows.push({ relaxed: !!s.relaxed, stated: s.stated, pandId: s.pandId, buurt: s.buurt, year: s.year, heightM: s.heightM, lng: s.lng, lat: s.lat, panoId: pick.panoId, date: pick.timestamp.slice(0, 10), obliquityDeg: +pick.obliquityDeg.toFixed(1), distM: +pick.distM.toFixed(1),
      measuredHex: fit.hex, fit: { pick: fit.pick, pixels: fit.pixels, foliage: fit.foliage, trim: fit.trim, brickSplit: fit.brickSplit }, crop: { foliage: +crop.foliage.toFixed(3), washedOut: +crop.washedOut.toFixed(3), missing: +crop.missingFraction.toFixed(3) } });
    console.log(`${rows.length}/${want} ${s.pandId} ${s.buurt} measured ${fit.hex} L ${m.L.toFixed(1)} h ${m.hue.toFixed(0)} C ${m.chroma.toFixed(1)} (net ${(http.bytes / 1e6).toFixed(0)} MB)`);
    records.set(s.pandId, 1);
  }
  fs.writeFileSync(path.join(STAGE, 'measured.json'), JSON.stringify({ rows, skipped, networkMB: +(http.bytes / 1e6).toFixed(1) }, null, 1));
  console.log(`measured ${rows.length}, skipped ${skipped.length}, network ${(http.bytes / 1e6).toFixed(0)} MB`);
}

// ---- proposal (data, not a default) -------------------------------------------------------------------------------

export const PROPOSAL: { setHsl?: never } = {};

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2];
  if (cmd === 'select') await select();
  else if (cmd === 'measure') await measure();
  else console.log('usage: oudwest-palette.ts select|measure (report and pairs: oudwest-palette-report.ts)');
}
void PERIOD_WALLS; void rgbToHex; void rgbToHsl; void hslToRgb; void rgbToLab; void foliageFraction; void washedOutFraction; void dHue;
