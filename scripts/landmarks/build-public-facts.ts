/**
 * Per-school facts for the generic school kit (publicBuildings.ts publicKit): BAG year, the 3DBAG roof type, eaves
 * and ridge, and the wall colour measured from the school's own panorama crops.
 *
 *   node --import tsx scripts/landmarks/build-public-facts.ts [--walls=artifacts/strips/kit-walls,<dir>...] [--publish]
 *
 * Why (kit review 1, 2026-10-24, docs/handoffs/kit-gaps.md "Landmark kits (review 1)"): every post-1960 school was one
 * fixed beige whatever the photo (16 of 40 reviewed; 10 photos red/brown brick), and pre-war schools whose 3DBAG roof
 * is slanted stood flat-roofed.
 *
 * Sources: the BAG tiles (public/data/extracts/amsterdam/bag-tiles/14, properties `year eaves ridge roof`, 3DBAG
 * b3_dak_type: 3 = slanted), and the rectified wall crops `all-walls.ts` writes (`<walls>/<pand digits>/walls.json`
 * plus `<tag>.jpg`; kit-sheets.ts caches them under artifacts/strips/kit-walls). Colour per crop:
 * facade/dominantWallColour.ts (the largest coherent colour cluster; glass, trim and sky dropped) over the crop's middle
 * band with sky and leaf pixels masked (look/brickTone.ts pixelKind, plus dark olive foliage), kept when the cluster is
 * reliable and holds a real share of the crop, white-balanced on the crop's own neutral trim; crops combined with
 * combineBrickTones (median L*, chroma and hue).
 * brickTone.ts measureBrickTone was tried first and read hedges and trunks into the wall (olive #393423 on a brown
 * brick front). A school with no usable crop gets no measured colour and the kit falls back to the BAG year's period
 * palette. The raw panorama reading is stored; publicBuildings.ts lifts it into the city's display range.
 *
 * Round 3 (GitHub #36, 2026-10-24): the same crops are read for the generic cinema and worship kits (wall colour,
 * window rows or a blank wall, frame colour), and every pand gets its roof form from its LoD2.2 planes
 * (tmp/public/kit-roof-pitch.json, scripts/landmarks/kit-roof-pitch.ts: run it first) and its measured pitched-roof
 * tint from the roof-facts sidecar (PDOK orthophoto). Schools alone feed the period fallback palettes.
 *
 * Writes the staging report tmp/public/public-facts.json (per pand: every crop's reading and why it was dropped) and,
 * with --publish, src/canalRecall/publicBuildingFacts.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { WORSHIP_BUILDINGS } from '../../src/canalRecall/worshipBuildingData.ts';
import { decodeRoofFactTile, roofSlotHex, type RoofFact } from '../../src/canalRecall/roofs/roofSlots.ts';
import { worshipKit } from '../../src/canalRecall/worshipBuildings.ts';
import { publicKit, schoolFacts } from '../../src/canalRecall/publicBuildings.ts';
import type { RoofPitch } from '../../src/canalRecall/facade/roofPitch.ts';
import { PUBLIC_BUILDINGS } from '../../src/canalRecall/publicBuildingData.ts';
import { combineBrickTones, pixelKind } from '../../src/canalRecall/look/brickTone.ts';
import { cropNormaliser, glazingProfile, isOliveShade, masonryFamily, type GlazingProfile } from '../../src/canalRecall/facade/cropWallColour.ts';
import { dominantWallColour } from '../../src/canalRecall/facade/dominantWallColour.ts';
import { periodForYear, rgbToHex, type Period } from '../../src/canalRecall/look/palette.ts';
import { shortBuildingId } from '../../src/canalRecall/buildingFacts.ts';
import { hipAround } from '../../src/canalRecall/landmarkKits.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const wallsRoots = arg('walls', 'artifacts/strips/kit-walls').split(',').filter(Boolean).map(p => path.resolve(ROOT, p));
const STAGING = path.join(ROOT, 'tmp/public/public-facts.json'), PUBLISHED = path.join(ROOT, 'src/canalRecall/publicBuildingFacts.ts');
/** A crop counts when its winning cluster holds this share of the usable (unmasked, not glass/trim) pixels. */
const MIN_WALL_SHARE = 0.3;
/** Crops this leafy (all-walls' own foliage estimate) show the tree, not the school. */
const MAX_FOLIAGE = 0.6;
/** Rows of the crop measured: the top is sky and roof edge, the bottom fences, bikes and cars. */
const BAND: [number, number] = [0.12, 0.8];
/** A crop's glazing verdict counts when it read this many 0.1 m rows of the wall. */
const MIN_GLAZING_ROWS = 15;
/** The wall cluster's share of the whole measured band (masked pixels included). */
const MIN_BAND_SHARE = 0.06;

const schools = PUBLIC_BUILDINGS.filter(e => e[1] === 's').map(e => e[0]);
const schoolSet = new Set(schools);
// Round 3: cinemas and worship buildings are measured the same way; schools stay first so their rows read as before.
const pands = [...schools, ...PUBLIC_BUILDINGS.filter(e => e[1] === 'c').map(e => e[0]), ...WORSHIP_BUILDINGS.map(e => e[0])].filter((id, i, a) => a.indexOf(id) === i);
const want = new Set(pands);

// --- BAG tile facts ----------------------------------------------------------------------------------------------
type TileFacts = { year: number | null; roof: number; eaves: number | null; ridge: number | null };
const rings = new Map<string, [number, number][]>();
const facts = new Map<string, TileFacts>();
const tiles = path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles/14');
for (const x of fs.readdirSync(tiles).filter(n => /^\d+$/.test(n))) {
  for (const file of fs.readdirSync(path.join(tiles, x)).filter(n => n.endsWith('.geojson.gz'))) {
    for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(tiles, x, file))).toString('utf8')).features) {
      const p = f.properties, id = String(p.id);
      if (!want.has(id) || facts.has(id)) continue;
      const g = f.geometry, outer: number[][] | undefined = g?.type === 'Polygon' ? g.coordinates[0] : g?.coordinates?.[0]?.[0];
      if (outer?.length) {
        const kx = 111_320 * Math.cos((outer[0][1] * Math.PI) / 180);
        rings.set(id, outer.map(([lng, lat]) => [(lng - outer[0][0]) * kx, (lat - outer[0][1]) * 110_540]));
      }
      facts.set(id, { year: typeof p.year === 'number' ? p.year : null, roof: Number(p.roof) || 0, eaves: typeof p.eaves === 'number' ? p.eaves : null, ridge: typeof p.ridge === 'number' ? p.ridge : null });
    }
  }
}

// An OSM-only school footprint (w..., r...) has no BAG year in its tile row: the year comes from the building facts, as
// scripts/build-public-buildings.ts takes it.
const factRoot = path.join(ROOT, 'public/data/extracts/amsterdam/building-facts/14');
for (const x of fs.readdirSync(factRoot)) for (const file of fs.readdirSync(path.join(factRoot, x))) {
  const bytes = fs.readFileSync(path.join(factRoot, x, file));
  const rows = JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString()).buildings as Record<string, number[]>;
  for (const id of pands) {
    const row = rows[shortBuildingId(id)], known = facts.get(id);
    if (!row || row[0] < 1200 || row[0] > 2030 || (known && known.year !== null)) continue;
    facts.set(id, { ...(known ?? { roof: 0, eaves: null, ridge: null }), year: row[0] });
  }
}

// --- Wall colour from the crops ----------------------------------------------------------------------------------
type CropReading = {
  file: string; tag: string; foliage: number | null; wallShare?: number; bandShare?: number; brick?: string; family?: string | null;
  norm?: { ref: number[] | null; gain: number; wb: number[] }; glazing?: GlazingProfile; used: boolean; why?: string;
};
type PandReading = { hex: string | null; crops: CropReading[]; glazing: 0 | 1 | 2 | 3; topBandHex: string | null; frameHex: string | null };
async function measure(pand: string): Promise<PandReading> {
  const digits = pand.replace('NL.IMBAG.Pand.', ''), crops: CropReading[] = [], tones: number[][] = [];
  for (const root of wallsRoots) {
    const json = path.join(root, digits, 'walls.json');
    if (!fs.existsSync(json)) continue;
    for (const w of JSON.parse(fs.readFileSync(json, 'utf8')).walls ?? []) {
      const file = path.join(root, digits, `${w.tag}.jpg`);
      if (!fs.existsSync(file)) continue;
      const reading: CropReading = { file: path.relative(ROOT, file), tag: w.tag, foliage: typeof w.foliage === 'number' ? w.foliage : null, used: false };
      crops.push(reading);
      if (reading.foliage !== null && reading.foliage > MAX_FOLIAGE) { reading.why = `foliage ${reading.foliage.toFixed(2)}`; continue; }
      const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const ch = info.channels, ppm = typeof w.ppm === 'number' ? w.ppm : info.width / (w.wallWidthM ?? info.width / 50);
      const y0 = Math.floor(info.height * BAND[0]), y1 = Math.ceil(info.height * BAND[1]);
      // 1. Exposure and white balance from the crop's light trim (measureFacade's rule), applied before measuring.
      const norm = cropNormaliser(data, info.width, info.height, ch, ppm, [y0, y1]);
      reading.norm = { ref: norm.ref ? norm.ref.map(Math.round) : null, gain: +norm.gain.toFixed(3), wb: norm.wb.map(v => +v.toFixed(3)) };
      const width = info.width, height = y1 - y0, band = new Uint8Array(width * height * 3), mask = new Uint8Array(width * height);
      for (let i = 0; i < mask.length; i++) {
        const o = (y0 * width + i) * ch, r = data[o], g = data[o + 1], b = data[o + 2], c = norm.apply([r, g, b]);
        band[i * 3] = c[0]; band[i * 3 + 1] = c[1]; band[i * 3 + 2] = c[2];
        // 2. pixelKind drops sky, leaves and burnt-out pixels; isOliveShade the shaded and autumn leaves it lets through.
        mask[i] = pixelKind(r, g, b) === 'candidate' && !isOliveShade(c[0], c[1], c[2]) ? 1 : 0;
      }
      const wall = dominantWallColour({ data: band, width, height, channels: 3 }, mask);
      if (!wall) { reading.why = 'no wall pixels'; continue; }
      reading.brick = wall.hex;
      reading.wallShare = Math.round(wall.fraction * 1000) / 1000;
      reading.family = masonryFamily(wall.rgb);
      if (!wall.reliable) { reading.why = `unreliable: ${wall.review.join('; ')}`; continue; }
      if (reading.wallShare < MIN_WALL_SHARE) { reading.why = `wall share ${reading.wallShare}`; continue; }
      // 3. Brick, buff brick, render or concrete, or not this school's wall: a mural (sheet row 35, #f7c386), painted
      // cladding, glass, a hedge read as wall (row 3's shaded brick under blue zinc, row 23's olive).
      if (!reading.family) { reading.why = `no masonry family ${wall.hex}`; continue; }
      // Brick, concrete and render in daylight read warm or neutral; a cluster bluer than it is red is glass, a
      // shadowed recess or the panorama's cast (sheet rows 34 and 40: blue-grey on a brick and a pale-brick front).
      if (wall.rgb[2] > wall.rgb[0]) { reading.why = `cool cast ${wall.hex}`; continue; }
      // Green at or over red is a hedge or its shade, not masonry (sheet row 1: #393a34 olive on a red-brown front).
      if (wall.rgb[1] >= wall.rgb[0]) { reading.why = `green cast ${wall.hex}`; continue; }
      // The wall must be a real part of the crop, not a strip of shaded brick under blue cladding (row 3's w02).
      reading.bandShare = Math.round(wall.pixels / (width * height) * 1000) / 1000;
      if (reading.bandShare < MIN_BAND_SHARE) { reading.why = `band share ${reading.bandShare}`; continue; }
      // 4. Ribbon windows and a pale band under the eaves, read row by row against this wall colour.
      const eaves = typeof w.height === 'number' ? w.height : info.height / ppm;
      reading.glazing = glazingProfile({ data, width: info.width, height: info.height, channels: ch, ppm, topM: info.height / ppm, eavesM: eaves, wall: wall.rgb, norm: norm.apply });
      reading.used = true;
      tones.push(wall.rgb);
    }
    if (crops.length) break; // the first walls root that has this pand is its source
  }
  // Glazing: ribbon when most crops that read enough rows found a ribbon band, punched when most did not.
  const read = crops.filter(c => c.used && c.glazing && c.glazing.rowsRead >= MIN_GLAZING_ROWS);
  const ribbon = read.filter(c => c.glazing!.ribbons.length).length;
  let glazing: 0 | 1 | 2 | 3 = !read.length ? 0 : ribbon * 2 > read.length ? 2 : ribbon * 2 < read.length ? 1 : 0;
  const bands = read.map(c => c.glazing!.topBandHex).filter((h): h is string => !!h);
  // Round 3, cinema and worship only (a school's code stays as kit colour round 2 read it): windowed when at least half
  // the crops read window rows (a tie leans to windows: the holds were windowless shells), ribbon when most of those
  // read a ribbon, else punched; blank (3) when most crops read none.
  if (!schoolSet.has(pand) && read.length) {
    const windowed = read.filter(c => c.glazing!.windowBands?.length || c.glazing!.ribbons.length);
    glazing = windowed.length * 2 < read.length ? 3 : windowed.filter(c => c.glazing!.ribbons.length).length * 2 > windowed.length ? 2 : 1;
  }
  // Frames: the median pale frame colour when most crops that read window rows show pale frames.
  const windowed = read.filter(c => c.glazing!.windowBands?.length), frames = windowed.map(c => c.glazing!.frameHex).filter((h): h is string => !!h);
  const frameHex = windowed.length && frames.length * 2 >= windowed.length ? frames.sort()[frames.length >> 1] : null;
  return { hex: tones.length ? rgbToHex(combineBrickTones(tones) as [number, number, number]) : null, crops, glazing, topBandHex: bands.length * 2 > read.length ? bands.sort()[bands.length >> 1] : null, frameHex };
}

// --- LoD2.2 roof form and the orthophoto roof tint --------------------------------------------------------------
const PITCH_FILE = path.join(ROOT, 'tmp/public/kit-roof-pitch.json');
if (!fs.existsSync(PITCH_FILE)) throw Error('run scripts/landmarks/kit-roof-pitch.ts first');
const pitchOf = JSON.parse(fs.readFileSync(PITCH_FILE, 'utf8')).pands as Record<string, RoofPitch | { missing: string }>;
const FORM_CODE = { flat: 1, mixed: 2, pitched: 3 } as const;
const pitchCode = (p: RoofPitch | { missing: string } | undefined): 0 | 1 | 2 | 3 | 4 => (!p || 'missing' in p ? 0 : p.form === 'pitched' && p.mono ? 4 : FORM_CODE[p.form]);
const roofFacts = new Map<string, RoofFact>();
const roofRoot = path.join(ROOT, 'public/data/extracts/amsterdam/roof-facts/14');
for (const x of fs.readdirSync(roofRoot).filter(n => /^\d+$/.test(n))) for (const file of fs.readdirSync(path.join(roofRoot, x))) {
  for (const [k, v] of decodeRoofFactTile(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(roofRoot, x, file))).toString()))) roofFacts.set(String(k), v);
}
/**
 * A pitched roof slot read with this confidence gives the roof its measured tint (roofs/roofSlots.ts roofSlotHex, which
 * keeps it in the slot's band). The orthophoto sees a roof sunlit from straight above; from the street a pitched roof
 * reads darker (the r4 sheet's first pass drew the reviewed dark slate roofs, rows 115, 125, 285, pale grey), so the
 * reading is taken at STREET_ROOF_SHADE of its brightness before it is placed in its slot.
 */
const PITCHED_SLOTS = new Set(['pantile-red', 'pantile-dark', 'slate', 'zinc']), MIN_ROOF_CONFIDENCE = 0.6, STREET_ROOF_SHADE = 0.7;
function roofTint(id: string): string | null {
  const f = roofFacts.get(id.replace('NL.IMBAG.Pand.', ''));
  return f && PITCHED_SLOTS.has(f.slot) && f.confidence >= MIN_ROOF_CONFIDENCE ? roofSlotHex(f.slot, f.rgb.map(v => v * STREET_ROOF_SHADE) as [number, number, number]) : null;
}

// --- Does the planned hipped roof fit the footprint? -------------------------------------------------------------
// The kits plan the hip from the facts alone; a footprint whose hip ring folds even at the narrowest inset
// (landmarkKits.ts hipAround) would be lowered to its eaves under a flat lid, so it keeps its flat roof instead.
const dm = (v: number | null | undefined) => (v === null || v === undefined ? 0 : Math.round(v * 10));
const publicOf = new Map(PUBLIC_BUILDINGS.map(e => [e[0], e])), worshipOf = new Map(WORSHIP_BUILDINGS.map(e => [e[0], e]));
type Entry = Parameters<typeof schoolFacts>[0];
function roofFits(id: string, entry: Entry): { fits: boolean; why?: string } {
  const facts = schoolFacts(entry), pub = publicOf.get(id), wor = worshipOf.get(id);
  const kit = pub ? publicKit(pub, facts) : wor ? worshipKit(wor, facts) : null;
  const hall = kit?.halls?.[0];
  if (!hall?.hip) return { fits: true };
  const ring = rings.get(id);
  if (!ring) return { fits: false, why: 'no footprint' };
  return hipAround(ring, hall.eavesM, hall.riseM) ? { fits: true } : { fits: false, why: 'hip ring folds' };
}
const entryFor = (id: string, f: TileFacts | null, r: PandReading, fits: 0 | 1): Entry => {
  const p = pitchOf[id], pr = p && !('missing' in p) ? p : null;
  return [id, f?.year ?? 0, (f?.roof ?? 0) as 0 | 1 | 2 | 3, dm(f?.eaves), dm(f?.ridge), r.hex, fits, r.glazing, r.topBandHex, pitchCode(p), dm(pr?.eavesM), dm(pr?.ridgeM), roofTint(id), r.frameHex];
};

const rows: ({ id: string; facts: TileFacts | null; roofFits: boolean; roofWhy?: string; entry: Entry } & PandReading)[] = [];
for (const id of pands) {
  const reading = await measure(id), f = facts.get(id) ?? null, fit = roofFits(id, entryFor(id, f, reading, 1));
  rows.push({ id, facts: f, roofFits: fit.fits, roofWhy: fit.why, entry: entryFor(id, f, reading, fit.fits ? 1 : 0), ...reading });
}
fs.mkdirSync(path.dirname(STAGING), { recursive: true });
fs.writeFileSync(STAGING, JSON.stringify({ generated: new Date().toISOString(), walls: wallsRoots.map(p => path.relative(ROOT, p) || p), rows }, null, 1) + '\n');
const schoolRows = rows.filter(r => schoolSet.has(r.id)), otherRows = rows.filter(r => !schoolSet.has(r.id));
const measured = schoolRows.filter(r => r.hex).length, withFacts = schoolRows.filter(r => r.facts).length;
const slanted = schoolRows.filter(r => r.facts?.roof === 3 && (r.facts.year ?? 9999) < 1940).length;
console.log(`hipped roofs that do not fit their footprint (kept flat): ${rows.filter(r => !r.roofFits).map(r => r.id.slice(-10)).join(' ') || 'none'}`);
console.log(`schools ${schoolRows.length}: BAG facts ${withFacts}, measured wall colour ${measured} (crops ${schoolRows.reduce((n, r) => n + r.crops.length, 0)}, used ${schoolRows.reduce((n, r) => n + r.crops.filter(c => c.used).length, 0)}), pre-1940 slanted roofs ${slanted}`);
console.log(`cinema and worship ${otherRows.length}: measured wall colour ${otherRows.filter(r => r.hex).length}, glazing ribbon ${otherRows.filter(r => r.glazing === 2).length} punched ${otherRows.filter(r => r.glazing === 1).length} blank ${otherRows.filter(r => r.glazing === 3).length}; frames ${rows.filter(r => r.frameHex).length} (schools ${schoolRows.filter(r => r.frameHex).length}); roof form pitched ${rows.filter(r => r.entry[9] >= 3).length} flat ${rows.filter(r => r.entry[9] === 1).length} unknown ${rows.filter(r => !r.entry[9]).length}; roof tint ${rows.filter(r => r.entry[12]).length}`);
console.log(`staging: ${path.relative(ROOT, STAGING)}`);

// --- The fallback palette for schools with no usable crop ---------------------------------------------------------
// Kit review 1 fallback was look/palette.ts PERIOD_WALLS.photo (the city's period priors): its modern list holds
// #b05a40 orange (sheet row 1, a dark brown 1980 pavilion) and its c19 list buff (row 39, dark brick), while the
// measured schools of those years read dark brown to grey-brown. The fallback is now the measured schools' own walls
// per period: PALETTE_PICKS colours at evenly spaced lightness quantiles, raw like the measured walls (publicBuildings.ts
// lifts both the same way). A period with fewer than PALETTE_MIN measured schools has no list (the city prior stays).
const PALETTE_PICKS = 7, PALETTE_MIN = 8;
const lightness = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
const palettes: Partial<Record<Period, string[]>> = {};
for (const period of ['canal', 'c19', 'school', 'modern'] as Period[]) {
  const hexes = schoolRows.filter(r => r.hex && r.facts?.year && periodForYear(r.facts.year) === period).map(r => r.hex!).sort((p, q) => lightness(p) - lightness(q));
  if (hexes.length >= PALETTE_MIN) palettes[period] = Array.from({ length: PALETTE_PICKS }, (_, k) => hexes[Math.floor(((k + 0.5) / PALETTE_PICKS) * hexes.length)]);
}
console.log(`fallback palettes: ${Object.entries(palettes).map(([k, v]) => `${k} ${v!.join(' ')}`).join('; ')}`);
console.log(`school glazing: ribbon ${schoolRows.filter(r => r.glazing === 2).length}, punched ${schoolRows.filter(r => r.glazing === 1).length}, unknown ${schoolRows.filter(r => r.glazing === 0).length}; top band ${schoolRows.filter(r => r.topBandHex).length}`);

if (process.argv.includes('--publish')) {
  const q = (v: string | null) => (v ? `'${v}'` : 'null');
  const lines = rows.filter(r => r.facts || r.hex).sort((a, b) => a.id.localeCompare(b.id)).map(({ entry: e }) =>
    `  ['${e[0]}', ${e[1]}, ${e[2]}, ${e[3]}, ${e[4]}, ${q(e[5])}, ${e[6]}, ${e[7]}, ${q(e[8])}, ${e[9]}, ${e[10]}, ${e[11]}, ${q(e[12])}, ${q(e[13])}],`);
  const text = `// Generated by scripts/landmarks/build-public-facts.ts --publish. Do not edit by hand.
// Per-pand facts for the generic school, cinema and worship kits (kitFacts.ts): BAG year (0 unknown), the 3DBAG roof type
// (0 unknown, 1 flat, 2 several flats, 3 slanted), eaves and ridge in decimetres (0 unknown), and the wall colour
// measured from the school's own panorama crops (facade/dominantWallColour.ts per crop, look/brickTone.ts
// combineBrickTones over crops; the raw reading, before the display lift), or null with no usable crop; roofFits 0
// where the hipped roof publicBuildings.ts would plan folds on the footprint (landmarkKits.ts hipAround), else 1;
// glazing as the crops read it row by row (facade/cropWallColour.ts glazingProfile: 0 unknown, 1 punched, 2 ribbon);
// the pale band under the eaves (its colour, white-balanced) or null. Crops are white-balanced on their light trim
// and dark olive (leaf shade) pixels masked before the wall is measured; walls outside every masonry family dropped.
// Round 3 (GitHub #36): glazing 3 a blank wall (cinema and worship only); the LoD2.2 roof form (facade/roofPitch.ts:
// 0 unknown, 1 flat, 2 mixed, 3 pitched, 4 mono-pitch) with the pitched planes' median eaves and ridge in decimetres;
// the measured pitched-roof tint (roofs/roofSlots.ts roofSlotHex) or null; the pale window frame colour or null.
export type PublicFactsEntry = readonly [id: string, year: number, roof: 0 | 1 | 2 | 3, eavesDm: number, ridgeDm: number, wallHex: string | null, roofFits: 0 | 1, glazing: 0 | 1 | 2 | 3, topBandHex: string | null, pitch?: 0 | 1 | 2 | 3 | 4, pitchEavesDm?: number, pitchRidgeDm?: number, roofHex?: string | null, frameHex?: string | null];
/** The fallback for a school with no usable crop: measured school walls of its period, by lightness quantile (raw readings). */
export const SCHOOL_PERIOD_WALLS: Readonly<Partial<Record<'canal' | 'c19' | 'school' | 'modern', readonly string[]>>> = ${JSON.stringify(palettes)};
export const PUBLIC_FACTS: readonly PublicFactsEntry[] = [
${lines.join('\n')}
];
`;
  fs.writeFileSync(PUBLISHED, text);
  console.log(`published ${lines.length} rows to ${path.relative(ROOT, PUBLISHED)}`);
}
