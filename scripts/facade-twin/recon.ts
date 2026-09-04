/**
 * Façade reconnaissance for any declared survey area.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/recon.ts                                  # all areas
 *   npx tsx scripts/facade-twin/recon.ts --area=utrecht-binnenstad-north
 *   npx tsx scripts/facade-twin/recon.ts --refresh                        # bypass caches
 *
 * One driver, three stages — inventory, massing, heritage — each of which asks
 * a city's declared sources rather than a hardcoded endpoint. Everything lands
 * in staging, per the working agreement; nothing is published to a versioned
 * extract without review.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { findArea, SURVEY_AREAS } from '../../src/canalRecall/facade/areas.ts';
import { dutchSources } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { CitySources, HeritageRecord, LngLat, MassingRecord, ProjectedPoint, RegistryBuilding, SemanticsRecord } from '../../src/canalRecall/facade/sources.ts';
import { containsPoint, intersectsArea, resolveArea, type NamedWay, type ResolvedArea, type SurveyArea } from '../../src/canalRecall/facade/surveyArea.ts';
import { loadNamedWays } from './fetch-area-features.ts';

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const refresh = process.argv.includes('--refresh');
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin');

/** Which sources answer for a city. Adding a non-Dutch city means adding a case. */
function sourcesFor(cityId: string): CitySources {
  const dutch = ['amsterdam', 'utrecht', 'rotterdam', 'den-haag', 'haarlem', 'leiden', 'delft'];
  if (dutch.includes(cityId)) return dutchSources(cityId);
  throw new Error(`no source adapters registered for city '${cityId}'`);
}

async function cached<T>(name: string, produce: () => Promise<T>): Promise<T> {
  const file = path.join(CACHE, name);
  if (!refresh) {
    try { return JSON.parse(await readFile(file, 'utf8')).data as T; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const data = await produce();
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify({ retrieved: new Date().toISOString(), data }));
  return data;
}

const shoelaceArea = (ring: ProjectedPoint[]) => {
  let total = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) total += ring[j].x * ring[i].y - ring[i].x * ring[j].y;
  return Math.abs(total / 2);
};

/**
 * Plot width: the shorter side of the minimum-area enclosing rectangle.
 *
 * For a terraced house on a narrow deep plot that is the façade width, which is
 * the one dimension every later façade measurement scales from.
 */
export function minimumRectangle(ring: ProjectedPoint[]): { widthM: number; depthM: number; bearingDeg: number } {
  let best = { widthM: Infinity, depthM: Infinity, bearingDeg: 0, area: Infinity };
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1e-6) continue;
    const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of ring) {
      const u = p.x * ux + p.y * uy, v = -p.x * uy + p.y * ux;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
      minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    const side1 = maxU - minU, side2 = maxV - minV, area = side1 * side2;
    if (area < best.area) best = { widthM: Math.min(side1, side2), depthM: Math.max(side1, side2), bearingDeg: (Math.atan2(uy, ux) * 180) / Math.PI, area };
  }
  return { widthM: best.widthM, depthM: best.depthM, bearingDeg: best.bearingDeg };
}

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

async function reconnoitre(area: SurveyArea) {
  const sources = sourcesFor(area.cityId);
  const ways: NamedWay[] = area.shape.kind === 'corridor'
    ? await loadNamedWays(area, { refresh })
    : [];
  const resolved: ResolvedArea = resolveArea(area, sources.crs, ways);

  console.log(`\n${'='.repeat(72)}\n${area.name}  [${area.areaId}]`);
  console.log(`${'='.repeat(72)}`);
  console.log(`  ${resolved.areaKm2.toFixed(3)} km², ${resolved.ring.length} vertices, ${sources.crs.id} / ${sources.crs.verticalDatum}`);
  if (resolved.legs.length) {
    for (const { edge, lengthM, vertexCount } of resolved.legs) {
      console.log(`  ${edge.feature.padEnd(16)} ${String(Math.round(lengthM)).padStart(5)} m  ${String(vertexCount).padStart(3)} vertices  offset ${edge.outwardOffsetM} m`);
    }
  }

  // ---- Stage 1: building inventory -------------------------------------
  const all = await cached(`${area.areaId}-registry.json`, () => sources.registry.fetchBuildings(resolved.bboxLngLat));
  const inside = all.filter((b: RegistryBuilding) => intersectsArea(resolved.ring, b.footprintLngLat.map(p => sources.crs.fromLngLat(p))));
  const measured = inside.map((b: RegistryBuilding) => {
    const projected = b.footprintLngLat.map(p => sources.crs.fromLngLat(p));
    return { ...b, areaM2: shoelaceArea(projected), ...minimumRectangle(projected) };
  });
  const active = measured.filter(b => b.active);
  const widths = measured.map(b => b.widthM);

  console.log(`\n  ${sources.registry.name}`);
  console.log(`    ${all.length} in the bounding box → ${inside.length} intersect the area, ${active.length} active`);
  console.log(`    plot width  p25 ${percentile(widths, 0.25).toFixed(1)} m   p50 ${percentile(widths, 0.5).toFixed(1)} m   p75 ${percentile(widths, 0.75).toFixed(1)} m`);
  const noYear = measured.filter(b => b.constructionYear === null).length;
  console.log(`    ${noYear} with no known construction year (${(100 * noYear / measured.length).toFixed(1)}%)`);
  const terraced = measured.filter(b => b.widthM >= 3.5 && b.widthM <= 9).length;
  console.log(`    ${terraced} on terraced-house plots, 3.5–9 m wide (${(100 * terraced / measured.length).toFixed(0)}%)`);

  // ---- Stage 2: massing -------------------------------------------------
  const ids = new Set(measured.map(b => b.buildingId));
  let massingRecords: MassingRecord[] = [];
  if (sources.massing) {
    const fetched = await cached(`${area.areaId}-massing.json`, () => sources.massing!.fetchMassing(resolved.bboxLngLat, sources.crs));
    massingRecords = fetched.filter((m: MassingRecord) => ids.has(m.buildingId));
    const byForm = (form: string) => massingRecords.filter(m => m.roofForm === form);
    const errorsOf = (rows: MassingRecord[]) => rows.map(m => m.reconstructionError).filter((v): v is number => v !== null);
    const pitched = byForm('pitched'), flat = byForm('flat');

    console.log(`\n  ${sources.massing.name}`);
    console.log(`    ${massingRecords.length}/${measured.length} matched by building id (${(100 * massingRecords.length / measured.length).toFixed(1)}%)`);
    console.log(`    roof form: ${pitched.length} pitched, ${flat.length} flat, ${byForm('mixed').length} mixed, ${byForm('unknown').length} unknown`);
    const sound = massingRecords.filter(m => m.geometryValid !== false && m.insufficientInput !== true && m.sourceQualityFlag !== false);
    console.log(`    ${sound.length} structurally sound (${(100 * sound.length / Math.max(1, massingRecords.length)).toFixed(1)}%)`);
    // Reported per roof form on purpose: a single threshold measures roof
    // complexity, not reconstruction failure.
    for (const [label, rows] of [['pitched', pitched], ['flat', flat]] as const) {
      const errors = errorsOf(rows);
      if (errors.length) console.log(`    reconstruction error, ${label.padEnd(7)} median ${percentile(errors, 0.5).toFixed(2)} m   within 0.5 m: ${(100 * errors.filter(e => e <= 0.5).length / errors.length).toFixed(0)}%`);
    }
    const heights = massingRecords.filter(m => m.ridgeHeight !== null && m.groundLevel !== null).map(m => m.ridgeHeight! - m.groundLevel!);
    if (heights.length) console.log(`    ridge above ground  p25 ${percentile(heights, 0.25).toFixed(1)} m   p50 ${percentile(heights, 0.5).toFixed(1)} m   p75 ${percentile(heights, 0.75).toFixed(1)} m`);
  }

  // ---- Stage 3: heritage text -------------------------------------------
  let heritage: HeritageRecord[] = [];
  if (sources.heritage) {
    const fetched = await cached(`${area.areaId}-heritage.json`, () => sources.heritage!.fetchHeritage(resolved.bboxLngLat));
    heritage = fetched.filter((h: HeritageRecord) => containsPoint(resolved.ring, sources.crs.fromLngLat(h.lngLat)));

    // Resolve each listing to the building its point falls inside. Listings and
    // buildings are not one-to-one: one house can carry several, and a listing
    // point can miss every footprint, so counting listings overstates reach.
    const CELL_M = 60;
    const grid = new Map<string, typeof measured>();
    for (const building of measured) {
      const projected = building.footprintLngLat.map(p => sources.crs.fromLngLat(p));
      const cx = Math.floor(projected.reduce((s, p) => s + p.x, 0) / projected.length / CELL_M);
      const cy = Math.floor(projected.reduce((s, p) => s + p.y, 0) / projected.length / CELL_M);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        (grid.get(key) ?? grid.set(key, []).get(key)!).push(building);
      }
    }
    const inRing = (ring: LngLat[], [x, y]: LngLat) => {
      let hit = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };
    for (const record of heritage) {
      const p = sources.crs.fromLngLat(record.lngLat);
      const key = `${Math.floor(p.x / CELL_M)},${Math.floor(p.y / CELL_M)}`;
      record.buildingId = (grid.get(key) ?? []).find(b => inRing(b.footprintLngLat, record.lngLat))?.buildingId ?? null;
    }

    const described = heritage.filter(h => h.description);
    const withBuilding = new Set(heritage.map(h => h.buildingId).filter((v): v is string => !!v));
    console.log(`\n  ${sources.heritage.name}`);
    console.log(`    ${heritage.length} listings, ${described.length} with a description (${(100 * described.length / Math.max(1, heritage.length)).toFixed(1)}%)`);
    console.log(`    resolved to ${withBuilding.size} distinct buildings (${(100 * withBuilding.size / measured.length).toFixed(1)}% of the area)`);
    if (described.length) {
      const lengths = described.map(h => h.description!.length);
      console.log(`    description length: median ${percentile(lengths, 0.5)} characters, p90 ${percentile(lengths, 0.9)}`);
    }
  }

  // ---- Stage 4: hand-mapped semantics -----------------------------------
  let semantics: SemanticsRecord[] = [];
  if (sources.semantics) {
    const fetched = await cached(`${area.areaId}-semantics.json`, () => sources.semantics!.fetchSemantics(resolved.bboxLngLat));
    semantics = fetched.filter((r: SemanticsRecord) => ids.has(r.buildingId));
    const authored = semantics.filter(r => !r.imported);
    const composed = semantics.filter(r => r.partCount > 1);

    console.log(`\n  ${sources.semantics.name}`);
    console.log(`    ${semantics.length}/${measured.length} buildings matched by registry id (${(100 * semantics.length / measured.length).toFixed(1)}%)`);
    console.log(`    ${authored.length} carry hand-authored tags beyond the bulk import (${(100 * authored.length / Math.max(1, semantics.length)).toFixed(1)}%)`);
    console.log(`    ${composed.length} have a mapped multi-part composition an automated rebuild would flatten`);

    const tagCounts = new Map<string, number>();
    for (const record of semantics) for (const tag of record.manualTags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    const interesting = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    if (interesting.length) {
      console.log('    hand-added tags worth preserving:');
      for (const [tag, count] of interesting) console.log(`      ${tag.padEnd(24)} ${count}`);
    }

    /**
     * Where OSM's storey count and the measured massing disagree.
     *
     * The build prompt flags this as a signal rather than an error: on a canal
     * house a levels/height mismatch usually means a *souterrain*, a raised
     * *bel-étage* or a rear annex — exactly the features that decide where the
     * front door sits and how the ground floor reads. Reported, never resolved
     * automatically.
     */
    if (massingRecords.length) {
      const byId = new Map(massingRecords.map(m => [m.buildingId, m]));
      const comparable = semantics
        .filter(r => r.levels !== null && byId.get(r.buildingId)?.storeys != null)
        .map(r => ({ id: r.buildingId, osm: r.levels!, measured: byId.get(r.buildingId)!.storeys! }));
      const disagree = comparable.filter(c => c.osm !== c.measured);
      console.log(`    storey count: ${comparable.length} buildings carry both an OSM level count and a measured one`);
      if (comparable.length) {
        const osmLower = disagree.filter(c => c.osm < c.measured).length;
        console.log(`      ${disagree.length} disagree — ${osmLower} where OSM counts fewer (a souterrain or bel-étage signal), ${disagree.length - osmLower} where it counts more`);
      }
    }
  }

  const directory = path.join(STAGING, area.areaId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'recon.json'), JSON.stringify({
    metadata: {
      generatedAt: new Date().toISOString(),
      generator: 'scripts/facade-twin/recon.ts',
      area: { ...area, shape: area.shape.kind },
      crs: { id: sources.crs.id, verticalDatum: sources.crs.verticalDatum },
      sources: {
        registry: { id: sources.registry.id, name: sources.registry.name, license: sources.registry.license },
        massing: sources.massing && { id: sources.massing.id, name: sources.massing.name, license: sources.massing.license, vintage: sources.massing.vintage },
        heritage: sources.heritage && { id: sources.heritage.id, name: sources.heritage.name, license: sources.heritage.license },
        semantics: sources.semantics && { id: sources.semantics.id, name: sources.semantics.name, license: sources.semantics.license },
      },
      areaKm2: Number(resolved.areaKm2.toFixed(4)),
      bboxLngLat: resolved.bboxLngLat,
      buildingsInArea: measured.length,
      activeBuildings: active.length,
      massingMatched: massingRecords.length,
      heritageListings: heritage.length,
      semanticsRecords: semantics.length,
      handAuthoredSemantics: semantics.filter(r => !r.imported).length,
      mappedCompositions: semantics.filter(r => r.partCount > 1).length,
    },
    boundary: { ringLngLat: resolved.ringLngLat, legs: resolved.legs, junctions: resolved.junctions },
    buildings: measured.map(b => ({
      buildingId: b.buildingId,
      constructionYear: b.constructionYear,
      status: b.status,
      active: b.active,
      uses: b.uses,
      dwellings: b.dwellings,
      areaM2: Number(b.areaM2.toFixed(1)),
      plotWidthM: Number(b.widthM.toFixed(2)),
      plotDepthM: Number(b.depthM.toFixed(2)),
      frontBearingDeg: Number(b.bearingDeg.toFixed(1)),
    })),
    massing: massingRecords,
    heritage,
    semantics,
  }));
  // The boundary also ships as plain GeoJSON, so it can be dropped straight
  // onto a map without parsing the recon payload.
  await writeFile(path.join(directory, 'boundary.geojson'), JSON.stringify({
    type: 'FeatureCollection',
    metadata: {
      name: area.name,
      description: area.description,
      areaId: area.areaId,
      cityId: area.cityId,
      crs: sources.crs.id,
      areaKm2: Number(resolved.areaKm2.toFixed(4)),
      localOrigin: area.localOrigin,
      localOriginLngLat: sources.crs.toLngLat(area.localOrigin),
      localOriginNote: area.localOriginNote,
      legs: resolved.legs.map(({ edge, lengthM }) => ({ ...edge, lengthM: Math.round(lengthM) })),
      junctions: resolved.junctions,
    },
    features: [
      { type: 'Feature', properties: { role: 'boundary' }, geometry: { type: 'Polygon', coordinates: [[...resolved.ringLngLat, resolved.ringLngLat[0]]] } },
      ...(resolved.centreline.length
        ? [{ type: 'Feature', properties: { role: 'centreline-ring' }, geometry: { type: 'LineString', coordinates: [...resolved.centreline.map(p => sources.crs.toLngLat(p)), sources.crs.toLngLat(resolved.centreline[0])] } }]
        : []),
    ],
  }, null, 2) + '\n');
  console.log(`\n  wrote ${path.relative(process.cwd(), directory)}/{recon.json,boundary.geojson}`);
  return { area, resolved, buildings: measured.length, massing: massingRecords.length, heritage: heritage.length, semantics: semantics.length };
}

const requested = arg('area');
const areas = requested ? [findArea(requested)] : [...SURVEY_AREAS];
const summaries = [];
for (const area of areas) summaries.push(await reconnoitre(area));

console.log(`\n${'='.repeat(72)}\nSummary`);
for (const s of summaries) {
  console.log(`  ${s.area.areaId.padEnd(34)} ${String(s.buildings).padStart(5)} buildings  ${String(s.massing).padStart(5)} massing  ${String(s.heritage).padStart(5)} listings  ${String(s.semantics).padStart(5)} osm  ${s.resolved.areaKm2.toFixed(3)} km²`);
}
