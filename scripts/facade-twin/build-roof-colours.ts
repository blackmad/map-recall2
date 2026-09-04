/**
 * RECON-5 — measured roof colour from PDOK orthophotos, for the pilot boundary.
 *
 * The generic sampler (`scripts/build-roof-color-observations.ts`) already
 * solved tiling, masking and rejection against the A10 pilot, and this script
 * reuses that approach rather than re-deriving it: cache `Actueel_orthoHR` WMS
 * tiles at 128 m / 1024 px (12.5 cm/pixel), rasterise each footprint into the
 * tile, erode the mask by one pixel so a mixed edge pixel never contaminates
 * the sample, and reject shadow, vegetation and blown-highlight pixels before
 * taking a per-channel median. What is new here is specific to this fabric,
 * not to roof colour in general:
 *
 * 1. A pitched roof shows two slopes at very different illumination. A single
 *    median over the footprint blends a sunlit slope with a shaded one into a
 *    colour that belongs to neither. So accepted pixels are tested for
 *    bimodality in lightness (Otsu's threshold plus an effect-size gate on the
 *    resulting split) before they are collapsed into one number. When the
 *    split is real, `measuredRgb` comes from the *larger* of the two clusters
 *    — a real, coherent slope reading — and both clusters are reported in
 *    `slopes` so nothing is silently averaged away.
 * 2. The pilot is dense: 82 m² at the median, and plenty of plots are well
 *    under that. `tooSmallFootprint` flags anything under `TOO_SMALL_AREA_M2`
 *    so the coverage report can say, honestly, how much of the rejection rate
 *    is geometry rather than weather.
 *
 * Roof material is never inferred from `bouwjaar` or from roof form — only
 * from the measured colour, via `nearestRoof`. A footprint that does not yield
 * enough valid pixels is rejected with a reason, never given a colour.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/build-roof-colours.ts --area=amsterdam-grachtengordel-west --limit=300
 *   npx tsx scripts/facade-twin/build-roof-colours.ts --limit=300 --fresh
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { findArea } from '../../src/canalRecall/facade/areas.ts';
import { nearestRoof, type MaterialId } from '../../src/canalRecall/facade/materials.ts';
import type { LngLat, MassingRecord } from '../../src/canalRecall/facade/sources.ts';

// ---------------------------------------------------------------------------
// Arguments and paths

const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const areaId = arg('area') || 'amsterdam-grachtengordel-west';
const area = findArea(areaId);
const limit = Math.max(1, Number(arg('limit') || 300));
const fresh = process.argv.includes('--fresh');

const CACHE = path.resolve('.cache/facade-twin');
const TILE_DIRECTORY = path.join(CACHE, 'roof-colour-tiles');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', areaId);
const OUTPUT_FILE = path.join(STAGING, 'roof-colours.json');
await mkdir(TILE_DIRECTORY, { recursive: true });

// ---------------------------------------------------------------------------
// Inputs: the registry cache recon.ts already wrote (footprints), and
// recon.json (which buildings are in the boundary, and their roof form).

interface RegistryRow {
  buildingId: string;
  footprintLngLat: LngLat[];
}
interface ReconBuilding {
  buildingId: string;
  areaM2: number;
}
interface ReconFile {
  buildings: ReconBuilding[];
  massing: MassingRecord[];
}

const registry = (JSON.parse(await readFile(path.join(CACHE, `${areaId}-registry.json`), 'utf8')) as { data: RegistryRow[] }).data;
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8')) as ReconFile;

const footprintById = new Map(registry.map(row => [row.buildingId, row.footprintLngLat]));
const areaById = new Map(recon.buildings.map(row => [row.buildingId, row.areaM2]));
const roofFormById = new Map(recon.massing.map(row => [row.buildingId, row.roofForm]));

/**
 * A bounded run must sample the *boundary*, not a corner of it.
 *
 * Sorting by buildingId and taking the first N is reproducible and completely
 * unrepresentative: BAG pand ids are issued in registration order, so a lexical
 * prefix is a block of buildings registered together, which means a block of
 * buildings standing together. A 250-building run selected that way reported
 * 76% slate and 1.6% pantile across the canal ring — a distribution the
 * orthophoto plainly contradicts, since whole terraces of orange pantile are
 * visible in it. That was a measurement of one street, not of the boundary.
 *
 * Deterministic *and* spread: order by id, then take every kth building, so a
 * limited run walks the whole area and a rerun draws the same set.
 */
const ordered = recon.buildings
  .map(b => b.buildingId)
  .filter(id => footprintById.has(id))
  .sort();
const stride = Math.max(1, Math.floor(ordered.length / limit));
const candidates = limit >= ordered.length
  ? ordered
  : Array.from({ length: limit }, (_, i) => ordered[i * stride]).filter(Boolean);

// ---------------------------------------------------------------------------
// Web Mercator projection and tiling — same grid and resolution as the
// existing sampler: 128 m tiles at 1024 px, i.e. 12.5 cm/pixel.

type Point = [number, number];
const EARTH_RADIUS = 6378137;
const TILE_METRES = 128;
const TILE_PIXELS = 1024;
const METRES_PER_PIXEL = TILE_METRES / TILE_PIXELS;
const toMercator = ([lon, lat]: Point): Point => [
  (lon * Math.PI / 180) * EARTH_RADIUS,
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * EARTH_RADIUS,
];

const insideRing = (x: number, y: number, ring: Point[]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Fetch (or read from cache) one 128 m tile, decoded to raw RGBA. */
async function tile(tileX: number, tileY: number): Promise<jpeg.UintArrRet> {
  const file = path.join(TILE_DIRECTORY, `${tileX}_${tileY}.jpg`);
  try {
    return jpeg.decode(await readFile(file), { useTArray: true });
  } catch {
    // Fall through to fetch. `readFile` failing for any reason other than a
    // missing cache entry surfaces below as a fetch failure anyway.
  }
  const minX = tileX * TILE_METRES, minY = tileY * TILE_METRES;
  const url = new URL('https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0');
  url.search = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap', LAYERS: 'Actueel_orthoHR', STYLES: '',
    CRS: 'EPSG:3857', BBOX: `${minX},${minY},${minX + TILE_METRES},${minY + TILE_METRES}`,
    WIDTH: String(TILE_PIXELS), HEIGHT: String(TILE_PIXELS), FORMAT: 'image/jpeg',
  }).toString();
  let error: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'MapRecallFacadeTwinRoofColour/1.0' } });
      if (response.ok) {
        const bytes = Buffer.from(await response.arrayBuffer());
        await writeFile(file, bytes);
        // Be polite to PDOK: a short pause after every real fetch (never after
        // a cache hit), so a wide run does not hammer the WMS back to back.
        await wait(120);
        return jpeg.decode(bytes, { useTArray: true });
      }
      error = new Error(`HTTP ${response.status}`);
    } catch (caught) {
      error = caught;
    }
    await wait(400 * 2 ** attempt);
  }
  throw error;
}

// ---------------------------------------------------------------------------
// Sample every candidate footprint out of the tiles it overlaps.

interface Sample {
  r: number[];
  g: number[];
  b: number[];
  footprintPixels: number;
  shadow: number;
  vegetation: number;
  glare: number;
  tiles: Set<string>;
}

const projected = candidates.map(id => footprintById.get(id)!.map(toMercator));
const byTile = new Map<string, number[]>();
for (let i = 0; i < projected.length; i++) {
  const ring = projected[i];
  const minX = Math.min(...ring.map(p => p[0])), maxX = Math.max(...ring.map(p => p[0]));
  const minY = Math.min(...ring.map(p => p[1])), maxY = Math.max(...ring.map(p => p[1]));
  for (let ty = Math.floor(minY / TILE_METRES); ty <= Math.floor(maxY / TILE_METRES); ty++) {
    for (let tx = Math.floor(minX / TILE_METRES); tx <= Math.floor(maxX / TILE_METRES); tx++) {
      const key = `${tx},${ty}`;
      (byTile.get(key) ?? byTile.set(key, []).get(key)!).push(i);
    }
  }
}

const samples: Sample[] = candidates.map(() => ({ r: [], g: [], b: [], footprintPixels: 0, shadow: 0, vegetation: 0, glare: 0, tiles: new Set() }));

let tileIndex = 0;
for (const [key, members] of byTile) {
  const [tx, ty] = key.split(',').map(Number);
  const image = await tile(tx, ty);
  const originX = tx * TILE_METRES, originY = ty * TILE_METRES;
  tileIndex++;

  for (const index of members) {
    const ring = projected[index].map(([x, y]) => [(x - originX) / METRES_PER_PIXEL, TILE_PIXELS - (y - originY) / METRES_PER_PIXEL] as Point);
    const minX = Math.max(1, Math.floor(Math.min(...ring.map(p => p[0]))));
    const maxX = Math.min(TILE_PIXELS - 2, Math.ceil(Math.max(...ring.map(p => p[0]))));
    const minY = Math.max(1, Math.floor(Math.min(...ring.map(p => p[1]))));
    const maxY = Math.min(TILE_PIXELS - 2, Math.ceil(Math.max(...ring.map(p => p[1]))));
    const sample = samples[index];
    sample.tiles.add(key);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!insideRing(x + .5, y + .5, ring)) continue;
        // Erode by one pixel: a mixed edge pixel — party wall, gutter, dormer
        // shadow spilling over the eave — must not vote on the roof colour.
        if (!insideRing(x - .5, y + .5, ring) || !insideRing(x + 1.5, y + .5, ring) ||
            !insideRing(x + .5, y - .5, ring) || !insideRing(x + .5, y + 1.5, ring)) continue;
        sample.footprintPixels++;
        const offset = (y * image.width + x) * 4;
        const r = image.data[offset], g = image.data[offset + 1], b = image.data[offset + 2];
        const light = .2126 * r + .7152 * g + .0722 * b;
        if (light < 38) { sample.shadow++; continue; }
        if (r > 247 && g > 247 && b > 247) { sample.glare++; continue; }
        if (g > r * 1.10 && g > b * 1.08 && g - Math.min(r, b) > 16) { sample.vegetation++; continue; }
        sample.r.push(r); sample.g.push(g); sample.b.push(b);
      }
    }
  }
  if (tileIndex % 25 === 0) process.stdout.write(`${tileIndex}/${byTile.size} orthophoto tiles\n`);
}

// ---------------------------------------------------------------------------
// Per-building analysis: median colour, material snap, bimodality.

const percentile = (a: number[], p: number) => {
  const sorted = [...a].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};
const median3 = (r: number[], g: number[], b: number[]): [number, number, number] =>
  [percentile(r, .5), percentile(g, .5), percentile(b, .5)];
const hex = (rgb: readonly number[]) => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Discipline pinned by the generic sampler: below these, colour is a guess. */
const FOOTPRINT_MIN_PIXELS = 20;
const ACCEPTED_MIN_PIXELS = 12;
/**
 * The brief's own framing of this fabric — "82 m² at the median and many are
 * under 50 m²" — so 50 m² is the reporting line for "too small to sample
 * reliably", not a number picked to hit a target rejection rate.
 */
const TOO_SMALL_AREA_M2 = 50;

/**
 * Otsu's threshold on lightness, then an effect-size gate.
 *
 * Otsu alone always returns *a* split — every histogram has a
 * variance-maximising threshold, even a genuinely unimodal one. The gate is
 * what turns "a threshold exists" into "this roof actually has two distinct
 * illuminated faces": both sides must hold a real share of the pixels, and the
 * gap between their means must be large relative to their spread. A roof that
 * fails the gate is reported as unimodal even though Otsu still finds a split.
 */
function splitBimodal(light: number[]): { thresholdIndex: number; darkMean: number; litMean: number } | null {
  if (light.length < 24) return null;
  const sorted = [...light].sort((a, b) => a - b);
  const total = sorted.length;
  const sumAll = sorted.reduce((s, v) => s + v, 0);

  let bestVariance = -1, bestIndex = -1;
  let sumBelow = 0;
  for (let i = 1; i < total; i++) {
    sumBelow += sorted[i - 1];
    const nBelow = i, nAbove = total - i;
    const meanBelow = sumBelow / nBelow, meanAbove = (sumAll - sumBelow) / nAbove;
    const variance = nBelow * nAbove * (meanBelow - meanAbove) ** 2;
    if (variance > bestVariance) { bestVariance = variance; bestIndex = i; }
  }
  if (bestIndex < 0) return null;

  const below = sorted.slice(0, bestIndex), above = sorted.slice(bestIndex);
  const shareBelow = below.length / total, shareAbove = above.length / total;
  if (Math.min(shareBelow, shareAbove) < 0.15 || Math.min(below.length, above.length) < 8) return null;

  const meanBelow = below.reduce((s, v) => s + v, 0) / below.length;
  const meanAbove = above.reduce((s, v) => s + v, 0) / above.length;
  const spread = (values: number[], mean: number) => Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) || 1;
  const pooledStd = (spread(below, meanBelow) * below.length + spread(above, meanAbove) * above.length) / total;
  // Cohen's-d-like effect size: the gap between the two means against their
  // pooled spread. Below 1, the "split" is noise inside one broad lobe rather
  // than two real illumination classes.
  const effectSize = (meanAbove - meanBelow) / pooledStd;
  if (effectSize < 1.0) return null;

  return { thresholdIndex: bestIndex, darkMean: meanBelow, litMean: meanAbove };
}

interface RoofColourRecord {
  buildingId: string;
  areaM2: number;
  roofForm: MassingRecord['roofForm'] | null;
  tooSmallFootprint: boolean;
  measuredRgb: [number, number, number];
  measuredHex: string;
  snappedMaterial: MaterialId;
  snapDistance: number;
  bimodal: boolean;
  slopes: null | {
    shaded: { rgb: [number, number, number]; hex: string; pixelCount: number; snappedMaterial: MaterialId };
    sunlit: { rgb: [number, number, number]; hex: string; pixelCount: number; snappedMaterial: MaterialId };
    lightGap: number;
  };
  pixels: { footprint: number; accepted: number; shadow: number; vegetation: number; glare: number };
  confidence: number;
  method: string;
  bimodalityMethod: string;
  tileKeys: string[];
}
interface Rejection {
  buildingId: string;
  areaM2: number;
  roofForm: MassingRecord['roofForm'] | null;
  tooSmallFootprint: boolean;
  reason: string;
  footprintPixels: number;
  acceptedPixels: number;
}

const observations: RoofColourRecord[] = [];
const rejections: Rejection[] = [];

for (let i = 0; i < candidates.length; i++) {
  const buildingId = candidates[i];
  const s = samples[i];
  const areaM2 = areaById.get(buildingId) ?? 0;
  const roofForm = roofFormById.get(buildingId) ?? null;
  const tooSmallFootprint = areaM2 > 0 && areaM2 < TOO_SMALL_AREA_M2;
  const accepted = s.r.length;
  const rejected = s.shadow + s.vegetation + s.glare;

  if (s.footprintPixels < FOOTPRINT_MIN_PIXELS || accepted < ACCEPTED_MIN_PIXELS) {
    rejections.push({
      buildingId, areaM2, roofForm, tooSmallFootprint,
      reason: s.footprintPixels < FOOTPRINT_MIN_PIXELS ? 'footprint-too-small-for-pixel-grid' : 'too-few-valid-pixels',
      footprintPixels: s.footprintPixels, acceptedPixels: accepted,
    });
    continue;
  }

  const overallMedian = median3(s.r, s.g, s.b);
  const light = s.r.map((r, idx) => .2126 * r + .7152 * s.g[idx] + .0722 * s.b[idx]);
  const split = roofForm === 'flat' ? null : splitBimodal(light);

  let measuredRgb = overallMedian;
  let slopes: RoofColourRecord['slopes'] = null;
  if (split) {
    // Pair each pixel's light value back to its own r/g/b so the two clusters
    // are split on the same basis they were tested on, not re-derived.
    const order = light.map((v, idx) => idx).sort((a, b) => light[a] - light[b]);
    const darkIdx = order.slice(0, split.thresholdIndex), litIdx = order.slice(split.thresholdIndex);
    const darkRgb = median3(darkIdx.map(idx => s.r[idx]), darkIdx.map(idx => s.g[idx]), darkIdx.map(idx => s.b[idx]));
    const litRgb = median3(litIdx.map(idx => s.r[idx]), litIdx.map(idx => s.g[idx]), litIdx.map(idx => s.b[idx]));
    slopes = {
      shaded: { rgb: darkRgb, hex: hex(darkRgb), pixelCount: darkIdx.length, snappedMaterial: nearestRoof(darkRgb).material.id },
      sunlit: { rgb: litRgb, hex: hex(litRgb), pixelCount: litIdx.length, snappedMaterial: nearestRoof(litRgb).material.id },
      lightGap: Number((split.litMean - split.darkMean).toFixed(1)),
    };
    /**
     * The *sunlit* slope decides the material, not the larger one.
     *
     * Taking the bigger cluster was right about one thing — the median of both
     * slopes is a colour neither slope has — and wrong about which slope to
     * believe. On a pitched roof the shaded side is darker and markedly bluer
     * because it is lit by sky rather than sun, and that is a fact about the
     * hour the plane flew, not about the roof. Whichever slope happens to face
     * away is then larger about half the time, so the material came out as a
     * coin flip weighted toward shade.
     *
     * Measured: taking the larger cluster put 82% of the canal ring on slate
     * and 2% on pantile, against an orthophoto showing whole terraces of orange
     * tile. The sunlit slope is the one that shows what the roof is covered in.
     */
    measuredRgb = litRgb;
  }

  const snap = nearestRoof(measuredRgb);
  const iqr = Math.max(
    percentile(s.r, .75) - percentile(s.r, .25),
    percentile(s.g, .75) - percentile(s.g, .25),
    percentile(s.b, .75) - percentile(s.b, .25),
  );
  const validRatio = accepted / Math.max(1, accepted + rejected);
  let confidence = validRatio * (1 - Math.min(iqr, 100) / 125) * Math.min(1, accepted / 150);
  // A confirmed bimodal split means the single measuredRgb is one slope's
  // truth, not the whole roof's — reported honestly, but at reduced confidence
  // because a consumer reading only `measuredRgb` sees half the roof.
  if (split) confidence *= 0.75;
  if (tooSmallFootprint) confidence *= 0.85;
  confidence = Math.max(.05, Math.min(.99, confidence));

  observations.push({
    buildingId, areaM2, roofForm, tooSmallFootprint,
    measuredRgb, measuredHex: hex(measuredRgb),
    snappedMaterial: snap.material.id, snapDistance: Number(snap.distance.toFixed(2)),
    bimodal: !!split, slopes,
    pixels: { footprint: s.footprintPixels, accepted, shadow: s.shadow, vegetation: s.vegetation, glare: s.glare },
    confidence: Number(confidence.toFixed(3)),
    method: 'eroded-bag-footprint-rgb-median-v1',
    bimodalityMethod: 'otsu-1d-lightness-with-effect-size-gate-v1',
    tileKeys: [...s.tiles],
  });
}

// ---------------------------------------------------------------------------
// Report and write.

const materialCounts = new Map<string, number>();
for (const o of observations) materialCounts.set(o.snappedMaterial, (materialCounts.get(o.snappedMaterial) ?? 0) + 1);

const smallCandidates = candidates.filter(id => (areaById.get(id) ?? 0) > 0 && (areaById.get(id) ?? 0) < TOO_SMALL_AREA_M2);
const smallRejected = rejections.filter(r => r.tooSmallFootprint).length;
const smallObserved = observations.filter(o => o.tooSmallFootprint).length;

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  generator: 'scripts/facade-twin/build-roof-colours.ts',
  area: { areaId, name: area.name },
  imagery: { service: 'PDOK luchtfoto RGB WMS', layer: 'Actueel_orthoHR', requestedResolutionMetres: METRES_PER_PIXEL },
  selection: { attemptedThisRun: candidates.length, tilesUsed: byTile.size },
  thresholds: { footprintMinPixels: FOOTPRINT_MIN_PIXELS, acceptedMinPixels: ACCEPTED_MIN_PIXELS, tooSmallAreaM2: TOO_SMALL_AREA_M2 },
  summary: {
    attempted: candidates.length,
    observed: observations.length,
    rejected: rejections.length,
    bimodal: observations.filter(o => o.bimodal).length,
    materialCounts: Object.fromEntries(materialCounts),
    tooSmallFootprint: { total: smallCandidates.length, rejected: smallRejected, observedAnyway: smallObserved },
  },
  observations,
  rejections,
};

const temporary = `${OUTPUT_FILE}.tmp`;
await writeFile(temporary, JSON.stringify(output, null, 2));
await import('node:fs/promises').then(fs => fs.rename(temporary, OUTPUT_FILE));

process.stdout.write(`Roof colour: ${observations.length} observed, ${rejections.length} rejected, of ${candidates.length} attempted (${byTile.size} tiles).\n`);
process.stdout.write(`  bimodal (two slopes reported separately): ${output.summary.bimodal}\n`);
process.stdout.write(`  materials: ${JSON.stringify(output.summary.materialCounts)}\n`);
process.stdout.write(`  under ${TOO_SMALL_AREA_M2} m²: ${smallCandidates.length} of ${candidates.length}; ${smallRejected} rejected, ${smallObserved} observed anyway\n`);
process.stdout.write(`Wrote ${path.relative(process.cwd(), OUTPUT_FILE)}\n`);
