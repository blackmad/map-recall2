/**
 * Build one block's worth of façade records — the one-block demo's input.
 *
 * Routed through the same record path as everything else — buildRecordFromRecon,
 * then applyHeritageEvidence, then applyStreetLevelEvidence, then auditHouse —
 * rather than writing its own shape. The first version of this script forked
 * the schema, and that is precisely the path the brief warns about: the
 * discipline stops applying in the one place labelled "demo", and a template
 * leak arrives wearing a source label.
 *
 * Two things it therefore no longer does. It does not infer roof material from
 * bouwjaar — that was a prior supplying a value, and it read the 215
 * unknown-year buildings as medieval besides; roof material stays `default`
 * until RECON-5 measures it from the ortho. And it does not invent heights when
 * the massing model is silent or self-contradictory; `resolveHeights` decides
 * what the model can honestly say.
 *
 * Usage: npx tsx scripts/facade-twin/build-block.ts [--canal=Keizersgracht] [--from=100] [--to=180]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { buildElevations, inFrontOf, obliquityDeg, standoffM } from '../../src/canalRecall/facade/elevations.ts';
import { applyHeritageEvidence, buildRecordFromRecon, type SourceDescriptor } from '../../src/canalRecall/facade/buildRecord.ts';
import { auditHouse, validateHouse } from '../../src/canalRecall/facade/houseRecord.ts';
import { summariseCoverage, wasObserved } from '../../src/canalRecall/facade/evidence.ts';
import { applyStreetLevelEvidence, wallMaterialOf } from '../../src/canalRecall/facade/streetLevelEvidence.ts';
import { measureFacade, STRIP_BASE_BELOW_GROUND_M } from '../../src/canalRecall/facade/measure.ts';
import { rectifyFacade } from '../../src/canalRecall/facade/rectify.ts';
import { GEOID_SEPARATION_M, isLeafOff } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);

const CANAL = arg('canal') ?? 'Keizersgracht';
const FROM = Number(arg('from') ?? 100);
const TO = Number(arg('to') ?? 180);

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const views = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[];
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, any>(recon.massing.map((m: any) => [m.buildingId, m]));
const plotWidths = new Map<string, number>(recon.buildings.map((b: any) => [b.buildingId, b.plotWidthM]));
const years = new Map<string, number | null>(recon.buildings.map((b: any) => [b.buildingId, b.constructionYear]));
const heritage = new Map<string, any>();
for (const h of recon.heritage) if (h.buildingId && h.description) heritage.set(h.buildingId, h);

const footprints = new Map<string, ProjectedPoint[]>();
for (const entry of registry) {
  if (!footprints.has(entry.buildingId)) footprints.set(entry.buildingId, entry.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));
}
const posed = views.map(view => ({ view, point: RD_NEW.fromLngLat(view.lngLat) }));

/** Address the block by street and house-number range, via PDOK. */
async function blockBuildings(): Promise<Array<{ buildingId: string; address: string; number: number }>> {
  const found = new Map<string, { buildingId: string; address: string; number: number }>();
  for (let number = FROM; number <= TO; number++) {
    const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=*:*&rows=1&fq=type:adres`
      + `&fq=woonplaatsnaam:Amsterdam&fq=straatnaam:%22${encodeURIComponent(CANAL)}%22&fq=huisnummer:${number}&fl=weergavenaam,centroide_rd`;
    const payload = await (await fetch(url)).json() as any;
    const doc = payload.response?.docs?.[0];
    if (!doc) continue;
    const match = doc.centroide_rd.match(/([-\d.]+) ([-\d.]+)/);
    const point = { x: Number(match[1]), y: Number(match[2]) };
    for (const [buildingId, ring] of footprints) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        if (ring[i].y > point.y !== ring[j].y > point.y
          && point.x < ((ring[j].x - ring[i].x) * (point.y - ring[i].y)) / (ring[j].y - ring[i].y) + ring[i].x) inside = !inside;
      }
      if (!inside) continue;
      if (!found.has(buildingId)) found.set(buildingId, { buildingId, address: doc.weergavenaam, number });
      break;
    }
  }
  return [...found.values()];
}

function frontage(buildingId: string) {
  const walls = buildElevations(footprints.get(buildingId)!);
  const plotWidthM = plotWidths.get(buildingId) ?? 0;
  if (!plotWidthM) return null;
  let front: { wall: typeof walls[number]; exposure: number } | null = null;
  for (const wall of walls) {
    if (Math.abs(wall.lengthM - plotWidthM) / plotWidthM > 0.35) continue;
    let exposure = 0;
    for (const pose of posed) {
      if (Math.abs(pose.point.x - wall.midpoint.x) > 35 || Math.abs(pose.point.y - wall.midpoint.y) > 35) continue;
      if (!inFrontOf(wall, pose.point)) continue;
      const standoff = standoffM(wall, pose.point);
      if (standoff < 3 || standoff > 35 || obliquityDeg(wall, pose.point) > 60) continue;
      exposure++;
    }
    if (!front || exposure > front.exposure) front = { wall, exposure };
  }
  if (!front) return null;
  const wall = front.wall;
  let best: { pose: typeof posed[number]; standoff: number; obliquity: number; score: number } | null = null;
  for (const pose of posed) {
    if (!inFrontOf(wall, pose.point)) continue;
    const standoff = standoffM(wall, pose.point);
    const obliquity = obliquityDeg(wall, pose.point);
    if (standoff < Math.max(8, wall.lengthM * 1.5) || standoff > 48 || obliquity > 20) continue;
    if (!isLeafOff(pose.view.capturedAt)) continue;
    const score = obliquity * 0.8 - 1250 / standoff;
    if (!best || score < best.score) best = { pose, standoff, obliquity, score };
  }
  return best ? { wall, ...best } : null;
}

async function panorama(view: PanoramaView) {
  const file = path.join(CACHE, 'panoramas', `${view.panoramaId}.jpg`);
  let bytes: Buffer;
  try { bytes = await readFile(file); } catch {
    const response = await fetch(view.imageUrl, { headers: { 'User-Agent': 'MapRecallFacadeTwin/1.0' }, signal: AbortSignal.timeout(120_000) });
    if (!response.ok) return null;
    bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return { width: decoded.width, height: decoded.height, data: decoded.data };
}

/**
 * Wall colour, sampled away from the openings.
 *
 * The mean of everything is a blend of brick, glass, sky reflection and shadow,
 * and lands on a grey that matches nothing on the building. But the median is
 * too dark as well, and that turned out to matter: measured across a block it
 * put the median wall at luma 89, where real Dutch brick sits around 120–150.
 * A winter panorama of a north-facing canal façade is genuinely dark, and a
 * dark sample loses chroma, so brick reads as low-saturation grey and lands on
 * black paint. Twenty-four of fifty-six buildings came out `painted-black`.
 *
 * So take an upper percentile: the lit brick between the windows rather than
 * the average of lit brick and the shadow beside it. Shadow is a property of
 * the morning the van drove past, not of the building.
 */
function sampleWall(rect: { width: number; height: number; data: Uint8ClampedArray }, openings: Array<{ xM: number; yM: number; widthM: number; heightM: number }>, ppm: number): [number, number, number] {
  const blocked = new Uint8Array(rect.width * rect.height);
  for (const o of openings) {
    const x0 = Math.max(0, Math.round((o.xM - 0.25) * ppm)), x1 = Math.min(rect.width - 1, Math.round((o.xM + o.widthM + 0.25) * ppm));
    const y1 = Math.min(rect.height - 1, Math.round(rect.height - (o.yM - 0.25) * ppm));
    const y0 = Math.max(0, Math.round(rect.height - (o.yM + o.heightM + 0.25) * ppm));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blocked[y * rect.width + x] = 1;
  }
  const channels: number[][] = [[], [], []];
  // Skip the top and bottom eighths: roof above, pavement and parked cars below.
  for (let y = Math.floor(rect.height * 0.12); y < rect.height * 0.88; y++) {
    for (let x = 0; x < rect.width; x++) {
      if (blocked[y * rect.width + x]) continue;
      const i = (y * rect.width + x) * 4;
      channels[0].push(rect.data[i]); channels[1].push(rect.data[i + 1]); channels[2].push(rect.data[i + 2]);
    }
  }
  return channels.map(values => {
    if (!values.length) return 128;
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length * 0.72)];
  }) as [number, number, number];
}

console.log(`Resolving ${CANAL} ${FROM}–${TO}…`);
const block = await blockBuildings();
console.log(`${block.length} distinct buildings\n`);

const REGISTRY: SourceDescriptor = {
  id: 'bag', license: 'CC0 1.0 — Kadaster',
  vintage: 'PDOK Kadaster BAG OGC API Features v2',
  recordUrlTemplate: 'https://bag.basisregistraties.overheid.nl/bag/id/pand/{id}',
};
const MASSING_SOURCE: SourceDescriptor = {
  id: '3dbag', license: 'CC BY 4.0 — 3DBAG, TU Delft',
  vintage: recon.metadata?.sources?.massing?.vintage ?? 'api.3dbag.nl collection pand',
  recordUrlTemplate: null,
};
const HERITAGE_SOURCE: SourceDescriptor = {
  id: 'rijksmonumenten', license: 'CC0 / CC BY — RCE',
  vintage: 'RCE WFS + linked-data SPARQL',
  recordUrlTemplate: 'https://monumentenregister.cultureelerfgoed.nl/monumenten/{id}',
};
const PANORAMA_LICENSE = 'CC BY 4.0 — Gemeente Amsterdam';
const readAt = new Date().toISOString().slice(0, 10);

const registryById = new Map(registry.map(entry => [entry.buildingId, entry]));
const records = [];
const allNotes: string[] = [];
let violations = 0;

for (const entry of block) {
  const source = registryById.get(entry.buildingId);
  if (!source) continue;

  // 1. The registry and massing model, through the shared constructor. This is
  //    what applies resolveHeights, so an eaves-above-ridge pair is caught here
  //    rather than shipped.
  const built = buildRecordFromRecon({
    building: {
      buildingId: entry.buildingId,
      constructionYear: years.get(entry.buildingId) ?? null,
      status: 'Pand in gebruik', active: true, uses: [], dwellings: 0,
      footprintLngLat: source.footprintLngLat,
    },
    massing: massing.get(entry.buildingId),
    registryReadAt: readAt,
    registry: REGISTRY,
    massingSource: MASSING_SOURCE,
  });
  const house = built.house;
  const observations = [...built.observations];
  const notes = [...built.notes];

  // 2. The monument description, through the shared parser — which strips rear
  //    and side clauses and resolves "tot puntgevel gewijzigde trapgevel" to the
  //    current gable. Three ad-hoc regex copies of this used to exist.
  const listing = heritage.get(entry.buildingId);
  if (listing) {
    const applied = applyHeritageEvidence(house, [listing], readAt, HERITAGE_SOURCE);
    observations.push(...applied.observations);
    notes.push(...applied.notes);
  }

  // 3. The street-level measurement, capped below auto-accept because the
  //    registration check is still red and no field has been validated.
  let measuredOpenings: Array<{ xM: number; yM: number; widthM: number; heightM: number }> = [];
  const found = frontage(entry.buildingId);
  if (found) {
    const image = await panorama(found.pose.view);
    if (image) {
      const base = massing.get(entry.buildingId)?.groundLevel ?? null;
      const eavesNap = massing.get(entry.buildingId)?.eavesHeight ?? null;
      if (base !== null && eavesNap !== null && eavesNap > base) {
        const ppm = Math.min(60, Math.max(24, 1250 / found.standoff));
        const rect = rectifyFacade(image, {
          x: found.pose.point.x, y: found.pose.point.y, z: found.pose.view.cameraHeight - GEOID_SEPARATION_M,
          headingDeg: found.pose.view.headingDeg, pitchDeg: found.pose.view.pitchDeg, rollDeg: found.pose.view.rollDeg,
        }, { start: found.wall.start, end: found.wall.end, baseZ: base - STRIP_BASE_BELOW_GROUND_M, topZ: eavesNap + 0.3 }, { pixelsPerMetre: ppm });
        const measurement = measureFacade(rect, { pixelsPerMetre: rect.pixelsPerMetre });
        // Kept for the renderer. Each rectangle is one opening found in this
        // building's own photograph; drawing a grid rebuilt from bay and storey
        // *counts* would be inventing geometry the detector never saw.
        measuredOpenings = measurement.openings.map(o => ({
          xM: Number(o.xM.toFixed(2)), yM: Number(o.yM.toFixed(2)),
          widthM: Number(o.widthM.toFixed(2)), heightM: Number(o.heightM.toFixed(2)),
        }));
        const applied = applyStreetLevelEvidence(house, {
          view: found.pose.view, standoffM: found.standoff, obliquityDeg: found.obliquity,
          measurement, wallRgb: sampleWall(rect, measurement.openings, rect.pixelsPerMetre),
          wallWidthM: found.wall.lengthM,
        }, PANORAMA_LICENSE);
        observations.push(...applied.observations);
        notes.push(...applied.notes);
      } else {
        notes.push('no usable ground or eaves height, so no rectified strip was cut');
      }
    }
  } else {
    notes.push('no square-on leaf-off view of the frontage');
  }

  // 4. Audit. A record that violates the ledger is reported, not published as if
  //    it were clean.
  const byId = new Map(observations.map(observation => [observation.id, observation]));
  const evidenceViolations = auditHouse(house, byId, readAt);
  const valueViolations = validateHouse(house);
  violations += evidenceViolations.length + valueViolations.length;

  const wall = wallMaterialOf(house);
  records.push({
    house,
    observations,
    address: entry.address,
    houseNumber: entry.number,
    footprintRd: footprints.get(entry.buildingId)!.map(p => [Number(p.x.toFixed(2)), Number(p.y.toFixed(2))]),
    frontWall: found ? { start: [found.wall.start.x, found.wall.start.y], end: [found.wall.end.x, found.wall.end.y], widthM: Number(found.wall.lengthM.toFixed(2)) } : null,
    groundLevelNap: massing.get(entry.buildingId)?.groundLevel ?? null,
    roofForm: massing.get(entry.buildingId)?.roofForm ?? 'unknown',
    measuredOpenings,
    render: {
      wallMaterial: wall.id,
      wallSource: wall.source,
      // Roof material is NOT inferred. RECON-5 measures it from the PDOK
      // orthophoto; until then a renderer may pick a fallback and must not
      // report it as anything but a default.
      roofMaterial: null,
      roofSource: 'default',
    },
    notes,
    violations: [...evidenceViolations, ...valueViolations].map(v => `${v.field}: ${v.code} — ${v.detail}`),
  });
  allNotes.push(...notes);

  const h = house;
  console.log(`${entry.address.replace(/,.*$/, '').padEnd(24)} ${String(found ? found.wall.lengthM.toFixed(2) : '—').padStart(5)} m  `
    + `${String(h.storeys.value ?? '—').padStart(2)}${wasObserved(h.storeys) ? '' : '·'} storeys  `
    + `${String(h.bays.value ?? '—').padStart(2)}${wasObserved(h.bays) ? '' : '·'} bays  `
    + `${wall.id.padEnd(18)} ${wasObserved(h.gable) ? h.gable.value : '—'}`);
}

await mkdir(STAGING, { recursive: true });
const file = path.join(STAGING, 'block.json');
await writeFile(file, JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-block.ts',
    block: `${CANAL} ${FROM}–${TO}`,
    attribution: '© Gemeente Amsterdam, Kernregistratie Panoramabeelden (CC BY 4.0); BAG, Kadaster CC0; 3DBAG, TU Delft CC BY 4.0; Rijksmonumentenregister, RCE',
    localOrigin: AREA.localOrigin,
    buildings: records.length,
    evidenceViolations: violations,
    caveat: 'Street-level fields are capped below auto-accept confidence. The registration check is red and no field has been checked against a hand-labelled building, so storeys, bays and wall colour here are hypotheses with provenance, not settled measurements. Roof material is default: RECON-5 has not run.',
  },
  buildings: records,
}, null, 2));

const houses = records.map(r => r.house);
const coverage = summariseCoverage(houses);
console.log(`\n${records.length} buildings, ${violations} evidence/value violations`);
console.log('\nField coverage — observed vs defaulted');
for (const field of coverage.filter(f => f.measured > 0).sort((a, b) => b.measured - a.measured)) {
  const sources = Object.entries(field.bySource).filter(([source]) => source !== 'default')
    .map(([source, n]) => `${source} ${n}`).join(', ');
  console.log(`  ${field.field.padEnd(15)} ${String(field.measured).padStart(3)}/${records.length}`
    + `  conf ${field.meanConfidence.toFixed(2)}  ${sources}`);
}
const capped = houses.filter(h => h.storeys.source === 'streetlevel-measured').length;
console.log(`\n${capped} buildings carry street-level storeys, all at confidence ≤ 0.4 — unvalidated by design.`);
if (allNotes.length) {
  const counts = new Map<string, number>();
  for (const note of allNotes) {
    const key = note.replace(/\d+(\.\d+)?/g, 'N');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  console.log('\nWhy fields were withheld');
  for (const [note, n] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${String(n).padStart(3)}  ${note}`);
}
console.log(`\nwrote ${path.relative(process.cwd(), file)}`);
