/**
 * Derive the per-buurt facade profiles (src/canalRecall/buurtProfiles/profiles.ts) from measured data (GitHub #102).
 *
 *   node --import tsx scripts/buurt-profiles/derive.ts [--walls=<source-data>/pand-reference-walls] [--publish]
 *     -> staging/buurt-profiles/buurt-profiles.json, staging/buurt-profiles/report.md (sample size and confidence)
 *     --publish also copies the set to src/canalRecall/buurtProfiles/buurt-profiles.json (then rebuild the bundles).
 *
 * Sources, every sample located by its BAG pand (bag-tiles z14 centroid, BAG construction year):
 *  - archived panorama walls (map-recall2-source-data pand-reference-walls, CC BY 4.0 Gemeente Amsterdam): per pand
 *    the best rectified street wall, white-balanced on its light trim (facade/cropWallColour.ts), brick tone
 *    (look/brickTone.ts), masonry family (painted/rendered vs brick) and the share of pale trim pixels;
 *  - the block-face houses (scripts/block-face/faces/<face>/intent.json) through their district house types
 *    (scripts/block-face/types/<district>/): measured brick, frames, white accents, window kind and head, crown, use;
 *  - the BAG year mix of every pand in the area.
 * Areas are the Gemeente Amsterdam gebieden (CC0): a buurt keeps its own profile with >= MIN_N measured fronts, else
 * its wijk's pooled profile with >= MIN_N, else none (city default). Per era likewise (>= MIN_ERA_N fronts).
 * Measured colours come from overcast and sunlit photos alike and read darker than the city palette; every source is
 * brought onto the panorama thumbnails' frame by the offset measured on pands both cover, then one city-wide
 * transform moves that frame to the city palette's (PERIOD_WALLS photo) brick median (buurtProfiles/exposure.ts,
 * #118), so a buurt keeps its measured lightness, hue and painted share relative to the city.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { measureBrickTone, rgbToLab, labToRgb } from '../../src/canalRecall/look/brickTone.ts';
import { cropNormaliser, masonryFamily, lch } from '../../src/canalRecall/facade/cropWallColour.ts';
import { PERIOD_WALLS, periodForYear, type Period } from '../../src/canalRecall/look/palette.ts';
import { fitExposure, applyExposure, median, hueMedian, hueOf, chromaOf } from '../../src/canalRecall/buurtProfiles/exposure.ts';
import { validateProfileSet, type BuurtProfile, type BuurtProfileSet, type EraProfile, type WeightedHex } from '../../src/canalRecall/buurtProfiles/profiles.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const WALLS = arg('walls') ?? path.join(process.env.HOME ?? '', 'Code/map-recall2-source-data/pand-reference-walls');
const OUT = path.resolve(arg('out') ?? 'staging/buurt-profiles');
const CACHE = path.resolve('.cache/buurt-profiles');
/**
 * Brick chroma target as a share of the city palette's median (first sheet, 2026-10-29: at the full median, Saenredam-
 * and Stalpertstraat's measured dark red-brown drew as saturated pink-red and Jan Steenstraat's brown as ochre beside
 * photos of purple-brown and dark brown brick). 
 */
const BRICK_CHROMA_SHARE = 0.75;
/**
 * Share of the reference frame's lightness gap to the city palette (thumbnail brick median L* 35 vs palette 43) that
 * every buurt is lifted by. 0 (#118, user 2026-10-29 "if it's darker let it be darker"): a buurt keeps the L* its
 * photos measure; on the 12-spot sheet the unlifted brick sat closer to the panoramas (Ten Kate-, Kerk-, Runstraat)
 * than the +8 L* lift. --lift-share=1 restores the #102 city level for comparison.
 */
const CITY_LIFT_SHARE = 0;
const MIN_N = 12, MIN_ERA_N = 8, SWATCHES = 10, CELL_M = 40;
const BBOX = { west: 4.80, east: 4.98, south: 4.0 + 48.32, north: 52.42 };
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(CACHE, { recursive: true });

type Ring = number[][]; type Poly = Ring[];
type Area = { code: string; name: string; wijk?: string; polys: Poly[]; bbox: [number, number, number, number] };
async function gebieden(kind: 'buurten' | 'wijken'): Promise<Area[]> {
  const file = path.join(CACHE, `${kind}.geojson`);
  if (!fs.existsSync(file)) {
    const r = await fetch(`https://api.data.amsterdam.nl/v1/gebieden/${kind}/?_format=geojson&_pageSize=1000&eindGeldigheid[isnull]=true`);
    if (!r.ok) throw Error(`gebieden ${kind} ${r.status}`);
    fs.writeFileSync(file, await r.text());
  }
  const wijkById = new Map<string, string>();
  if (kind === 'buurten') for (const w of JSON.parse(fs.readFileSync(path.join(CACHE, 'wijken.geojson'), 'utf8')).features) wijkById.set(w.properties.identificatie, w.properties.code);
  return JSON.parse(fs.readFileSync(file, 'utf8')).features.map((f: any) => {
    const polys: Poly[] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const xs = polys.flatMap(p => p[0].map(c => c[0])), ys = polys.flatMap(p => p[0].map(c => c[1]));
    return { code: f.properties.code, name: f.properties.naam, wijk: wijkById.get(f.properties.ligtInWijkId), polys, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  });
}
const inRing = (x: number, y: number, ring: Ring) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
const inArea = (x: number, y: number, a: Area) => x >= a.bbox[0] && x <= a.bbox[2] && y >= a.bbox[1] && y <= a.bbox[3] && a.polys.some(p => inRing(x, y, p[0]) && !p.slice(1).some(h => inRing(x, y, h)));

// BAG pands: centroid and year.
type Pand = { lng: number; lat: number; year: number | null };
const pands = new Map<string, Pand>();
const tileRoot = 'public/data/extracts/amsterdam/bag-tiles/14';
for (const x of fs.readdirSync(tileRoot)) for (const f of fs.readdirSync(path.join(tileRoot, x))) {
  if (!f.endsWith('.geojson.gz')) continue;
  const fc = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(tileRoot, x, f))).toString());
  for (const feat of fc.features ?? []) {
    const id = String(feat.properties?.id ?? '').replace('NL.IMBAG.Pand.', '');
    if (!/^\d{16}$/.test(id) || pands.has(id)) continue;
    const g = feat.geometry, ring: Ring = g?.type === 'Polygon' ? g.coordinates[0] : g?.type === 'MultiPolygon' ? g.coordinates[0][0] : null;
    if (!ring?.length) continue;
    const y = Number(feat.properties.year);
    pands.set(id, { lng: ring.reduce((s, c) => s + c[0], 0) / ring.length, lat: ring.reduce((s, c) => s + c[1], 0) / ring.length, year: Number.isFinite(y) && y > 1200 && y < 2100 ? y : null });
  }
}
console.log('pands', pands.size);

const buurten = await gebieden('wijken').then(() => gebieden('buurten')), wijken = await gebieden('wijken');
const buurtOf = (lng: number, lat: number) => buurten.find(a => inArea(lng, lat, a)) ?? null;

type Sample = { pand: string; source: 'pano' | 'thumb' | 'blockface'; era: Period | null; /** From the --modern pass: feeds only the modern era. */ modernPass?: true; lab?: number[]; painted?: boolean; pale?: boolean; dark?: boolean; arch?: boolean; tall?: boolean; crown?: 'cornice' | 'flat' | 'gable' | 'dormer'; shop?: boolean };
const samples: Sample[] = [];
const eraOf = (p: Pand | undefined) => p?.year ? periodForYear(p.year) : null;

/**
 * Painted or rendered, read off a photo wall colour. Panorama brick is low in chroma (overcast light, haze: the
 * thumbnails' brick median is C* ~6-10), so cropWallColour's C* < 8 render test would call most brick painted; paint
 * is either light and near-neutral (white and cream render, L* >= 62, C* < 14) or a mid cool grey-green (hue 100-250,
 * C* < 12, L* >= 40). Dark neutral walls are NOT called paint: in the thumbnails they are mostly brick in shade (a first
 * pass that called C* < 4 paint gave the Museumkwartier 76 % "painted" fronts in near-black greys); the city palette's
 * canal period keeps its own black and green paints.
 */
const photoPainted = (rgb: readonly number[]) => { const c = lch(rgb); return (c.L >= 62 && c.C < 14) || (c.L >= 40 && c.h > 100 && c.h < 250 && c.C < 12); };

// 1. Archived panorama walls.
let panoSeen = 0, panoUsed = 0;
if (fs.existsSync(WALLS)) for (const dir of fs.readdirSync(WALLS)) {
  const file = path.join(WALLS, dir, 'walls.json');
  if (!fs.existsSync(file)) continue;
  panoSeen++;
  const pand = pands.get(dir);
  if (!pand) continue;
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const wall = (doc.walls as any[]).filter(w => w.crop && !w.washedOut && (w.foliage ?? 0) < 0.3 && (w.missingFraction ?? 0) < 0.3 && w.ppm && fs.existsSync(path.join(WALLS, dir, `${w.tag}.jpg`)))
    .sort((a, b) => (a.obliquityDeg ?? 0) - (b.obliquityDeg ?? 0) || b.lengthM - a.lengthM)[0];
  if (!wall) continue;
  const width = 240, img = sharp(path.join(WALLS, dir, `${wall.tag}.jpg`)).resize({ width });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const maskFile = path.join(WALLS, dir, `${wall.tag}.mask.png`);
  const mask = fs.existsSync(maskFile) ? (await sharp(maskFile).resize(info.width, info.height, { kernel: 'nearest' }).greyscale().raw().toBuffer()) : null;
  const norm = cropNormaliser(data, info.width, info.height, info.channels, wall.ppm * info.width / wall.widthPx);
  const px: number[] = [];
  let pale = 0, valid = 0;
  for (let i = 0, k = 0; i < data.length; i += info.channels, k++) {
    if (mask && mask[k] < 128) continue;
    const rgb = norm.apply([data[i], data[i + 1], data[i + 2]]);
    px.push(rgb[0], rgb[1], rgb[2]);
    const c = lch(rgb); if (c.L > 20 && !(rgb[2] > rgb[0] + 6)) { valid++; if (c.L > 74 && c.C < 12) pale++; }
  }
  const tone = measureBrickTone(px, 3);
  if (!tone) continue;
  if (!masonryFamily(tone.wall) && !photoPainted(tone.wall)) continue;
  const painted = photoPainted(tone.wall);
  panoUsed++;
  samples.push({ pand: dir, source: 'pano', era: eraOf(pand), lab: rgbToLab(painted ? tone.wall : tone.brick), painted, pale: painted ? undefined : valid > 0 && pale / valid >= 0.05 });
}
console.log('pano walls', panoSeen, 'used', panoUsed);

// 1b. Panorama thumbnails at the street front (sample-panos.ts).
let thumbUsed = 0;
// pano-samples-modern.json (sample-panos.ts --modern, #117): the same measure on BAG year >= 1945 pands, for the modern era.
const THUMBS = ['staging/buurt-profiles/pano-samples.json', 'staging/buurt-profiles/pano-samples-modern.json'];
for (const file of THUMBS) if (fs.existsSync(file)) for (const r of JSON.parse(fs.readFileSync(file, 'utf8')).samples as any[]) {
  const pand = pands.get(r.pand);
  if (r.skipped || !pand || !r.wall) continue;
  // Modern pass: a light front (L >= 66 in the thumbnail) is render, white panels or pale buff brick, and is kept
  // as paint (half its tint); the brick calibration's chroma lift turned those peach (review 2026-10-30).
  const painted = photoPainted(r.wall) || (file.endsWith('-modern.json') && lch(r.wall).L >= 66);
  if (!painted && !masonryFamily(r.brick) && lch(r.brick).C >= 4) continue;
  // The modern pass only ever adds to the modern era: it does not move the calibration, a profile's level, n or older eras.
  const modernPass = file.endsWith('-modern.json') ? { modernPass: true as const } : {};
  if (modernPass.modernPass && eraOf(pand) !== 'modern') continue;
  samples.push({ pand: r.pand, source: 'thumb', era: eraOf(pand), lab: rgbToLab(painted ? r.wall : r.brick), painted, pale: painted ? undefined : r.paleShare >= 0.06, ...modernPass });
  thumbUsed++;
}
console.log('panorama thumbnails used', thumbUsed);

// 2. Block-face houses through their types.
const types = new Map<string, any>();
for (const d of fs.readdirSync('scripts/block-face/types')) for (const f of fs.readdirSync(path.join('scripts/block-face/types', d))) if (f.endsWith('.json')) { const t = JSON.parse(fs.readFileSync(path.join('scripts/block-face/types', d, f), 'utf8')); types.set(t.id, t); }
const hexLab = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? rgbToLab([parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)]) : null;
const TALL = new Set(['t-window', 'two-light', 'cross', 'cross-transom', 'arched', 'sash', 'sash-small-panes', 'ladder']);
let bfHouses = 0, bfUsed = 0;
for (const face of fs.readdirSync('scripts/block-face/faces')) {
  const file = path.join('scripts/block-face/faces', face, 'intent.json');
  if (!fs.existsSync(file)) continue;
  for (const h of JSON.parse(fs.readFileSync(file, 'utf8')).houses ?? []) {
    bfHouses++;
    if (/synthetic/.test(h.address ?? '')) continue;
    const pand = pands.get(String(h.pandId));
    if (!pand) continue;
    const t = h.type?.type ? types.get(h.type.type) : null;
    let palette: any = null, body: any = null, crown: any = null, windows: string | undefined;
    if (t) {
      palette = { ...(t.palettes?.[h.type.palette] ?? Object.values(t.palettes ?? {})[0] ?? {}), ...(h.type.paletteOverrides ?? {}) };
      body = t.body; windows = body?.windows; crown = t.crowns?.[h.type.crown] ?? Object.values(t.crowns ?? {})[0];
    } else if (h.design) {
      palette = h.design.palette; const fr = h.design.fronts?.[0] ?? {}; windows = fr.windows; body = fr; crown = { gable: fr.gable, dormers: fr.dormers };
    } else continue;
    const brick = hexLab(palette?.brick);
    const use = h.groundFloor?.use;
    const stone = hexLab(palette?.stone), frame = hexLab(palette?.frame);
    const frameName = typeof palette?.frame === 'string' && !palette.frame.startsWith('#') ? palette.frame : '';
    const s: Sample = { pand: String(h.pandId), source: 'blockface', era: eraOf(pand), shop: use ? ['shop', 'restaurant', 'cafe', 'bar', 'services'].includes(use) : undefined };
    if (brick) { s.lab = brick; s.painted = palette.wallMaterial === 'painted-brick' || palette.wallMaterial === 'stucco' || lch(labToRgb(brick)).C < 8; }
    if (body) {
      const accents = !!(body.windowSurround || body.bands || body.entablature || body.speklagen || body.archRings || body.bandLines || (body.cornice && body.cornice !== 'none'));
      s.pale = accents && (!stone || stone[0] > 70);
      s.arch = windows === 'arched' || ['segmental', 'relieving'].includes(body.windowHead?.kind);
      s.tall = windows ? TALL.has(windows) : undefined;
    }
    if (frame || frameName) s.dark = frame ? frame[0] < 45 : /dark|black|brown|green|oxblood|blue/.test(frameName);
    if (crown) s.crown = (crown.dormers ?? 0) > 0 ? 'dormer' : ['step', 'neck', 'point', 'bell', 'spout'].includes(crown.gable) ? 'gable' : crown.gable === 'flat' || crown.gable === 'none' ? 'flat' : 'cornice';
    samples.push(s); bfUsed++;
  }
}
console.log('block-face houses', bfHouses, 'used', bfUsed);

// Calibration (#118): every source onto the panorama thumbnails' frame by the offset on pands both cover, then ONE
// city-wide transform to the city palette's brick (src/canalRecall/buurtProfiles/exposure.ts). A buurt keeps its
// measured lightness difference from the city whichever source measured it.
const paletteBricks = (['canal', 'c19', 'school'] as const).flatMap(p => PERIOD_WALLS.photo[p] ?? []).map(h => hexLab(h)!).filter(l => masonryFamily(labToRgb(l)) === 'brick');
const ref = { L: median(paletteBricks.map(l => l[0])), C: median(paletteBricks.map(chromaOf)), h: hueMedian(paletteBricks.map(hueOf)) };
const exposure = fitExposure(samples.filter(s => !s.modernPass), ref, { reference: 'thumb', chromaShare: BRICK_CHROMA_SHARE, liftShare: Number(arg('lift-share') ?? CITY_LIFT_SHARE) });
/**
 * Post-war brick is browner and greyer than the city palette's 19th-century orange-red that sets the chroma lift:
 * the modern pass takes MODERN_BRICK_CHROMA of it (first run: Sarphatistrook's anthracite and Frederik Hendrik's
 * buff read saturated red-brown and peach).
 */
const MODERN_BRICK_CHROMA = 0.55;
const calibrate = (s: Sample): number[] => {
  const lab = applyExposure(exposure, s.source, s.lab!, s.painted);
  return s.modernPass && !s.painted ? [lab[0], lab[1] * MODERN_BRICK_CHROMA, lab[2] * MODERN_BRICK_CHROMA] : lab;
};
const toHex = (lab: number[]) => '#' + labToRgb(lab).map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** Ten quantile swatches over lightness, each the median a/b of its slice. */
function swatches(labs: number[][]): WeightedHex[] {
  const sorted = [...labs].sort((p, q) => p[0] - q[0]), k = Math.min(SWATCHES, sorted.length), out: WeightedHex[] = [];
  for (let i = 0; i < k; i++) {
    const slice = sorted.slice(Math.floor(i * sorted.length / k), Math.floor((i + 1) * sorted.length / k));
    out.push([toHex([median(slice.map(l => l[0])), median(slice.map(l => l[1])), median(slice.map(l => l[2]))]), slice.length]);
  }
  // Merge identical swatches.
  const merged = new Map<string, number>(); for (const [h, w] of out) merged.set(h, (merged.get(h) ?? 0) + w);
  return [...merged].map(([h, w]) => [h, w] as const);
}
const shareOf = (v: (boolean | undefined)[], min = 6) => { const d = v.filter(x => x !== undefined) as boolean[]; return d.length >= min ? Math.round(d.filter(Boolean).length / d.length * 100) / 100 : undefined; };

function eraProfile(list: Sample[]): EraProfile | undefined {
  if (list.length < MIN_ERA_N) return undefined;
  const coloured = list.filter(s => s.lab);
  const e: EraProfile = { n: list.length };
  if (coloured.length >= MIN_ERA_N) { e.walls = swatches(coloured.map(calibrate)); e.paintedShare = shareOf(coloured.map(s => s.painted)); }
  e.paleAccentShare = shareOf(list.map(s => s.pale)); e.darkFrameShare = shareOf(list.map(s => s.dark));
  e.archShare = shareOf(list.map(s => s.arch)); e.tallShare = shareOf(list.map(s => s.tall));
  for (const k of Object.keys(e) as (keyof EraProfile)[]) if (e[k] === undefined) delete e[k];
  return Object.keys(e).length > 1 ? e : undefined;
}

// Assign samples and pands to buurten.
const sampleBuurt = new Map<Sample, Area | null>();
for (const s of samples) { const p = pands.get(s.pand)!; sampleBuurt.set(s, buurtOf(p.lng, p.lat)); }
if (process.argv.includes('--dump-samples')) fs.writeFileSync(path.join(OUT, 'samples.json'), JSON.stringify(samples.map(s => ({ ...s, buurt: sampleBuurt.get(s)?.code, name: sampleBuurt.get(s)?.name, wijk: sampleBuurt.get(s)?.wijk, cal: s.lab ? calibrate(s) : undefined }))));
const yearMixOf = new Map<string, Partial<Record<Period, number>>>();
for (const p of pands.values()) {
  if (p.lng < BBOX.west || p.lng > BBOX.east || p.lat < BBOX.south || p.lat > BBOX.north || !p.year) continue;
  const b = buurtOf(p.lng, p.lat); if (!b) continue;
  for (const key of [b.code, b.wijk ?? '']) { const m = yearMixOf.get(key) ?? {}; const e = periodForYear(p.year); m[e] = (m[e] ?? 0) + 1; yearMixOf.set(key, m); }
}

function profileFor(code: string, name: string, level: 'buurt' | 'wijk', all: Sample[]): BuurtProfile | null {
  const list = all.filter(s => !s.modernPass);
  if (list.length < MIN_N) return null;
  const eras: BuurtProfile['eras'] = {};
  const older = list.filter(s => s.era && s.era !== 'modern');
  for (const era of ['canal', 'c19', 'school', 'modern'] as const) {
    // An era with too few fronts borrows the area's pre-1945 pool (walls and traits), never the modern blocks'.
    const own = eraProfile((era === 'modern' ? all : list).filter(s => s.era === era));
    const e = own ?? (era !== 'modern' ? eraProfile(older) : undefined);
    if (e) eras[era] = e;
  }
  const crowns: Record<string, number> = {}, withCrown = list.filter(s => s.crown);
  for (const s of withCrown) crowns[s.crown!] = (crowns[s.crown!] ?? 0) + 1;
  const mix = yearMixOf.get(code) ?? {};
  const dominant = (Object.entries(mix) as [Period, number][]).sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    code, name, level, n: list.length, confidence: list.length >= 60 ? 'high' : list.length >= 25 ? 'medium' : 'low', eras, yearMix: mix,
    ...(dominant ? { dominantEra: dominant } : {}), ...(shareOf(list.map(s => s.shop)) !== undefined ? { shopShare: shareOf(list.map(s => s.shop)) } : {}),
    ...(withCrown.length >= 6 ? { crowns: Object.fromEntries(Object.entries(crowns).map(([k, v]) => [k, Math.round(v / withCrown.length * 100) / 100])) } : {}),
  };
}
const profiles: BuurtProfile[] = [], profileOfBuurt = new Map<string, number>();
const wijkProfiles = new Map<string, number>();
for (const w of wijken) {
  const p = profileFor(w.code, w.name, 'wijk', samples.filter(s => sampleBuurt.get(s)?.wijk === w.code));
  if (p && Object.keys(p.eras).length) { profiles.push(p); wijkProfiles.set(w.code, profiles.length); }
}
for (const b of buurten) {
  const p = profileFor(b.code, b.name, 'buurt', samples.filter(s => sampleBuurt.get(s)?.code === b.code));
  if (p && Object.keys(p.eras).length) { profiles.push(p); profileOfBuurt.set(b.code, profiles.length); }
  else if (b.wijk && wijkProfiles.has(b.wijk)) profileOfBuurt.set(b.code, wijkProfiles.get(b.wijk)!);
}

// Grid: profile index per CELL_M cell over the profiled buurten.
const profiled = buurten.filter(b => profileOfBuurt.has(b.code));
const gb = { west: Math.min(...profiled.map(b => b.bbox[0])), south: Math.min(...profiled.map(b => b.bbox[1])), east: Math.max(...profiled.map(b => b.bbox[2])), north: Math.max(...profiled.map(b => b.bbox[3])) };
const lat0 = (gb.south + gb.north) / 2, dLng = +(CELL_M / (111320 * Math.cos(lat0 * Math.PI / 180))).toFixed(7), dLat = +(CELL_M / 110540).toFixed(7);
const cols = Math.ceil((gb.east - gb.west) / dLng), rows = Math.ceil((gb.north - gb.south) / dLat);
const runs: string[] = []; let last = -1, count = 0;
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const x = gb.west + (c + 0.5) * dLng, y = gb.south + (r + 0.5) * dLat;
  const b = profiled.find(a => inArea(x, y, a)), v = b ? profileOfBuurt.get(b.code)! : 0;
  if (v === last) count++; else { if (count) runs.push(`${count}:${last}`); last = v; count = 1; }
}
runs.push(`${count}:${last}`);
const body = { profiles, grid: { west: +gb.west.toFixed(6), south: +gb.south.toFixed(6), dLng, dLat, cols, rows, rle: runs.join(',') } };
const revision = (await import('node:crypto')).createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
const set: BuurtProfileSet = validateProfileSet({ schemaVersion: 1, revision, ...body });
fs.writeFileSync(path.join(OUT, 'buurt-profiles.json'), JSON.stringify(set));

// Report.
const lines = [`# Buurt profiles ${revision}`, '', `Samples: ${samples.length} (panorama walls ${panoUsed} of ${panoSeen} pands archived; panorama thumbnails ${thumbUsed}; block-face houses ${bfUsed} of ${bfHouses}).`,
  `Calibration (#118, one shared reference): city palette brick L ${ref.L.toFixed(1)} C ${ref.C.toFixed(1)} h ${ref.h.toFixed(0)}; reference ${exposure.reference} brick median L ${exposure.referenceMedian.L.toFixed(1)} C ${exposure.referenceMedian.C.toFixed(1)} h ${exposure.referenceMedian.h.toFixed(0)}; city transform L ${exposure.city.lift >= 0 ? '+' : ''}${exposure.city.lift.toFixed(1)}, C x${exposure.city.chroma.toFixed(2)}, h ${exposure.city.dh.toFixed(0)}; sources ${Object.entries(exposure.sources).map(([k, v]) => `${k} dL ${v.dL.toFixed(1)} C x${v.chroma.toFixed(2)} dh ${v.dh.toFixed(0)} (${v.via}, ${v.pairs} shared pands, n ${v.n})`).join('; ')}.`,
  `Grid ${cols} x ${rows} cells of ${CELL_M} m, ${runs.length} runs; ${profiled.length} buurten mapped to ${profiles.length} profiles (${profiles.filter(p => p.level === 'buurt').length} buurt-level, ${profiles.filter(p => p.level === 'wijk').length} wijk-level pools).`, '',
  '| code | name | level | n | confidence | eras (n) | painted | pale accents | arch | tall | dark frames | shop | walls (c19 or first era) |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const p of profiles) {
  const e = p.eras.c19 ?? Object.values(p.eras)[0]!;
  lines.push(`| ${p.code} | ${p.name} | ${p.level} | ${p.n} | ${p.confidence} | ${Object.entries(p.eras).map(([k, v]) => `${k} ${v!.n}`).join(', ')} | ${e.paintedShare ?? ''} | ${e.paleAccentShare ?? ''} | ${e.archShare ?? ''} | ${e.tallShare ?? ''} | ${e.darkFrameShare ?? ''} | ${p.shopShare ?? ''} | ${(e.walls ?? []).map(w => w[0]).join(' ')} |`);
}
fs.writeFileSync(path.join(OUT, 'report.md'), lines.join('\n') + '\n');
console.log(lines.slice(0, 6).join('\n'));
if (process.argv.includes('--publish')) { fs.copyFileSync(path.join(OUT, 'buurt-profiles.json'), 'src/canalRecall/buurtProfiles/buurt-profiles.json'); console.log('published src/canalRecall/buurtProfiles/buurt-profiles.json'); }
