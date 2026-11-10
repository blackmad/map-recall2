/**
 * New-build census (lane/newbuild-kit-20261110, feedback 1c694c0d / 2c486751 / 75242f30).
 *
 * Runs every building tile through the game's decoration chain (galleryPipeline.gameDecorator, as
 * scripts/large-tier/audit.ts does) and meshBuildingFor in the photo and storybook looks, then counts:
 *   (a) BAG pands built 2000 on, per buurt (coverage-v1 polygons): modelled (a GLB, chunk or building type covers
 *       them), else what the grammar draws (archetype x preset, wall lightness), plus the undated OSM-only outlines
 *       in the same buurten (new builds the BAG/3DBAG tiles lack, drawn as undated 1860-1914 houses);
 *   (b) roof canopies drawn as floating slabs (an untagged OSM `building=roof` at the 9 m default height);
 *   (c) windowless: footprint >= 300 m2 and >= 2 storeys (>= 6 m) drawn with no window cells, by cause.
 *
 *   node --import tsx scripts/newbuild/census.ts [--out=artifacts/newbuild/census.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { gameDecorator, type Feature } from '../../src/canalRecall/galleryPipeline.ts';
import { meshBuildingFor } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { footprintAreaM2 } from '../../src/canalRecall/genericFacades.ts';
import { shortBuildingId, plausibleYear } from '../../src/canalRecall/buildingFacts.ts';
import { largeTierReason } from '../../src/canalRecall/largeBuildingTier.ts';
import { BAY_ENTRIES } from '../../src/canalRecall/bayLook.ts';
import { KIT_HIDE_IDS, KIT_PART_IDS } from '../../src/canalRecall/landmarkKits.ts';
import { isRoofCanopySlab } from '../../src/canalRecall/osmMinHeight.ts';
import { hexToRgb } from '../../src/canalRecall/look/palette.ts';
import { rgbToLab } from '../../src/canalRecall/look/brickTone.ts';

const arg = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const OUT = arg('out', 'artifacts/newbuild/census.json');
const EX = 'public/data/extracts/amsterdam';
const gz = (f: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());

const landmarkIds = new Set<string>();
for (const l of Object.values(JSON.parse(fs.readFileSync(`${EX}/landmark-buildings.json`, 'utf8')).buildings as Record<string, string[]>)) for (const id of l) landmarkIds.add(String(id));
const gables = JSON.parse(fs.readFileSync(`${EX}/monument-gables.json`, 'utf8'));
const decorate = gameDecorator({ landmarkIds, listed: new Set(gables.listedLandmarks ?? []), gables: new Map(Object.entries(gables.buildings ?? {})) as never });

// What a model draws instead of the grammar: covers.json (GLBs, chunks) and building-type instances.
const covers = JSON.parse(fs.readFileSync('public/canal-drive/models/covers.json', 'utf8')) as { models: Record<string, { p: string[]; o?: string[] }>; buildingTypes: string[] };
const modelled = new Set<string>([...covers.buildingTypes]);
for (const m of Object.values(covers.models)) { for (const p of m.p) modelled.add(p); for (const o of m.o ?? []) modelled.add(o); }
const kitHidden = new Set<string>([...KIT_HIDE_IDS, ...KIT_PART_IDS]);

// Buurten: coverage-v1 polygons with a bbox prefilter.
type Buurt = { name: string; ring: number[][]; box: [number, number, number, number] };
const buurten: Buurt[] = (JSON.parse(fs.readFileSync(`${EX}/coverage-v1/buurten.json`, 'utf8')).features as { properties: { name: string }; geometry: { type: string; coordinates: number[][][] } }[])
  .filter(f => f.geometry?.type === 'Polygon').map(f => { const ring = f.geometry.coordinates[0], xs = ring.map(p => p[0]), ys = ring.map(p => p[1]); return { name: f.properties.name, ring, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }; });
const inRing = (x: number, y: number, r: number[][]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
const buurtAt = (x: number, y: number) => buurten.find(b => x >= b.box[0] && x <= b.box[2] && y >= b.box[1] && y <= b.box[3] && inRing(x, y, b.ring))?.name ?? '(none)';

/** The lane's new-build areas (Houthaven, IJburg, Zeeburgereiland, Sluisbuurt, Overhoeks, Westpoort offices). */
export const AREAS: Record<string, RegExp> = {
  Houthaven: /^Houthavens/,
  IJburg: /^(Steigereiland|Rieteiland|Rieteilanden|Centrumeiland|Havenkwartier IJburg|Haveneiland|Strandeiland|IJburg)/,
  Zeeburgereiland: /^(Oostpunt Zeeburgereiland|Zeeburgereiland|Sportheldenbuurt|Bedrijvengebied Zeeburgerkade)/,
  Sluisbuurt: /^Sluisbuurt/,
  Overhoeks: /^Overhoeks/,
  'Westpoort offices': /^(Sloterdijk|Westpoort|Bedrijventerrein Sloterdijk|Houthavens)/,
};
const areaOf = (buurt: string) => Object.entries(AREAS).filter(([, re]) => re.test(buurt)).map(([k]) => k);

const centroid = (g: unknown): [number, number] => {
  const geom = g as { type: string; coordinates: number[][][] | number[][][][] };
  const ring = geom.type === 'Polygon' ? (geom.coordinates as number[][][])[0] : (geom.coordinates as number[][][][])[0][0];
  let x = 0, y = 0; for (const p of ring) { x += p[0]; y += p[1]; } return [x / ring.length, y / ring.length];
};
const lightness = (hex: string) => rgbToLab(hexToRgb(hex) as [number, number, number])[0];
const tone = (hex: string) => { const l = lightness(hex); return l >= 80 ? 'white/pale (L>=80)' : l >= 62 ? 'light (62-80)' : l >= 45 ? 'mid (45-62)' : 'dark (<45)'; };
const presetOf = (layer: number | undefined) => { const e = layer === undefined ? null : BAY_ENTRIES[layer]; return e ? `${e.archetype}#${e.style}` : 'none'; };

type Tally = Record<string, number>;
const bump = (t: Tally, k: string, n = 1) => { t[k] = (t[k] ?? 0) + n; };
const newBuild: Record<string, { pands: number; areaM2: number; modelled: number; generic: number; draws: Tally; tones: Tally; storybookDraws: Tally; storybookTones: Tally; osmUndated: number; osmUndatedAreaM2: number; osmDraws: Tally }> = {};
const areaRow = (k: string) => newBuild[k] ??= { pands: 0, areaM2: 0, modelled: 0, generic: 0, draws: {}, tones: {}, storybookDraws: {}, storybookTones: {}, osmUndated: 0, osmUndatedAreaM2: 0, osmDraws: {} };
const cityByYear: Tally = {};
const slabs: { id: string; heightM: number; minHeightM: number; areaM2: number; at: [number, number]; buurt: string }[] = [];
const windowless: Tally = {}, windowlessArea: Tally = {};
const windowlessRows: { id: string; why: string; areaM2: number; heightM: number; year: number | null; at: [number, number]; buurt: string }[] = [];
const windowlessNew: Tally = {};
let scanned = 0;

const root = `${EX}/building-tiles/14`;
for (const x of fs.readdirSync(root)) for (const file of fs.readdirSync(path.join(root, x))) {
  const y = file.replace('.geojson.gz', '');
  const fc = gz(path.join(root, x, file)) as { features: Feature[] };
  const factsFile = `${EX}/building-facts/14/${x}/${y}.json.gz`;
  const facts: Record<string, number[]> = fs.existsSync(factsFile) ? gz(factsFile).buildings ?? {} : {};
  for (const raw of fc.features) {
    scanned++;
    const p = { ...raw.properties }, id = String(p.id ?? ''), short = shortBuildingId(id);
    const row = facts[short];
    if (row && plausibleYear(row[0])) p.constructionYear = row[0];
    const area = footprintAreaM2(raw.geometry), at = centroid(raw.geometry);
    if (isRoofCanopySlab(p)) slabs.push({ id, heightM: Number(p.height), minHeightM: Number(p.minHeight), areaM2: Math.round(area), at: [+at[0].toFixed(6), +at[1].toFixed(6)], buurt: buurtAt(at[0], at[1]) });
    const year = typeof p.constructionYear === 'number' ? p.constructionYear : null;
    const isModelled = modelled.has(id.replace(/^NL\.IMBAG\.Pand\./, '')) || modelled.has(id) || kitHidden.has(id);
    const heightM = Number(p.height) || 0, isBag = id.startsWith('NL.IMBAG');
    const wantNew = area >= 40 && ((year !== null && year >= 2000) || (!isBag && year === null && Number(p.minHeight || 0) === 0));
    const wantWindowless = area >= 300 && heightM >= 6 && !isModelled && Number(p.minHeight || 0) < 3;
    if (!wantNew && !wantWindowless) continue;
    const feature = decorate({ ...raw, properties: p });
    const photo = meshBuildingFor(feature, 'photo'), story = meshBuildingFor(feature, 'storybook');
    if (!photo || !story) continue;
    const buurt = buurtAt(at[0], at[1]), areas = areaOf(buurt);
    const drawOf = (b: NonNullable<typeof photo>) => b.bare ? `bare:${feature.properties.gardenShed ? 'shed' : largeTierReason(feature.properties, feature.geometry)}` : feature.properties.kitWall ? `kit-${feature.properties.kitWall}` : feature.properties.largeTier ? `large-tier:${presetOf(b.layers?.upper)}` : presetOf(b.layers?.upper);
    if (year !== null && year >= 2000 && isBag) {
      bump(cityByYear, isModelled ? 'modelled' : 'generic');
      for (const k of [...areas, 'city']) {
        const r = areaRow(k); r.pands++; r.areaM2 += Math.round(area);
        if (isModelled) { r.modelled++; continue; }
        r.generic++; bump(r.draws, drawOf(photo)); bump(r.tones, tone(photo.wallHex)); bump(r.storybookDraws, drawOf(story)); bump(r.storybookTones, tone(story.wallHex));
      }
    } else if (!isBag && year === null && !isModelled && areas.length && area >= 60) {
      for (const k of areas) { const r = areaRow(k); r.osmUndated++; r.osmUndatedAreaM2 += Math.round(area); bump(r.osmDraws, drawOf(story)); }
    }
    if (wantWindowless) {
      const kitPlain = feature.properties.kitWall === 'plain' || feature.properties.kitWall === 'flat';
      if (photo.bare || kitPlain || feature.properties.gardenShed) {
        const why = photo.bare ? (landmarkIds.has(id) && !feature.properties.landmarkBare ? 'landmark-unmodelled' : largeTierReason(feature.properties, feature.geometry)) : kitPlain ? 'kit-plain' : 'garden-shed';
        bump(windowless, why); bump(windowlessArea, why, Math.round(area));
        if (year !== null && year >= 2000) bump(windowlessNew, why);
        windowlessRows.push({ id, why, areaM2: Math.round(area), heightM, year, at: [+at[0].toFixed(6), +at[1].toFixed(6)], buurt });
      }
    }
  }
}
windowlessRows.sort((a, b) => b.areaM2 - a.areaM2);
const summary = {
  generated: new Date().toISOString(), scanned,
  newBuildCity: cityByYear,
  newBuild,
  slabs: { count: slabs.length, attachedToTallerPand: 0, rows: slabs },
  windowless: { byCause: windowless, areaByCause: windowlessArea, builtFrom2000ByCause: windowlessNew, top: windowlessRows.slice(0, 40) },
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, slabs: { count: slabs.length, sample: slabs.slice(0, 5) }, windowless: { ...summary.windowless, top: windowlessRows.slice(0, 12) } }, null, 1));
