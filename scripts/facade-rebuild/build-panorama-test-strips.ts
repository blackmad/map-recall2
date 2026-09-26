/**
 * Build a varied, pose-bound façade development set from Amsterdam panoramas.
 *
 * Selection uses only registry/massing/panorama metadata and line-of-sight
 * geometry. It never uses detector output or cross-view pixel agreement.
 * Output runs are immutable and remain unaccepted development evidence.
 *
 * Usage:
 *   npx tsx scripts/facade-rebuild/build-panorama-test-strips.ts \
 *     --count=12 --out=public/canal-drive/facade-photo-review/local/city-variety-01
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { buildElevations, inFrontOf, obliquityDeg, standoffM, type Elevation } from '../../src/canalRecall/facade/elevations.ts';
import { rectifyFacade, type EquirectangularImage } from '../../src/canalRecall/facade/rectify.ts';
import { GEOID_SEPARATION_M, isLeafOff } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('raw') ?? '.cache/facade-rebuild/raw/v1');
const out = path.resolve(arg('out') ?? 'public/canal-drive/facade-photo-review/local/city-variety-01');
const count = Math.max(1, Number(arg('count') ?? 12));
const explicitlyExcludedIds = new Set((arg('exclude-pand') ?? '').split(',').map(value => value.trim()).filter(Boolean));
const panoramaCache = path.resolve('.cache/facade-rebuild/panorama-test-strips/panoramas');
const sha = (bytes: Uint8Array | Buffer) => createHash('sha256').update(bytes).digest('hex');
const cellSizeM = 50;
const cellKey = (x: number, y: number) => `${Math.floor(x / cellSizeM)}:${Math.floor(y / cellSizeM)}`;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

type Ring = ProjectedPoint[];
type Registry = { buildingId: string; constructionYear: number | null; active: boolean; uses: string[]; footprintLngLat: [number, number][] };
type Massing = { buildingId: string; storeys: number | null; roofForm: string; groundLevel: number; eavesHeight: number; ridgeHeight: number; reconstructionError: number; geometryValid: boolean; insufficientInput: boolean; groundArea: number };
type Panorama = { panoramaId: string; lngLat: [number, number]; cameraHeight: number; headingDeg: number; pitchDeg: number; rollDeg: number; capturedAt: string; imageUrl: string };
type PositionedPanorama = Panorama & { point: ProjectedPoint };
type Candidate = {
  registry: Registry; mass: Massing; wall: Elevation; view: PositionedPanorama;
  standoffM: number; obliquityDeg: number; blockedFraction: number;
  sourcePixelsPerMetre: number; cameraAboveGroundM: number; score: number;
  traits: string[]; midpoint: ProjectedPoint;
};

const [registryBytes, panoramaMetadataBytes, massingBytes, semanticBytes, generatorBytes] = await Promise.all([
  readFile(path.join(root, 'amsterdam-grachtengordel-west-registry.json')),
  readFile(path.join(root, 'amsterdam-grachtengordel-west-panoramas.json')),
  readFile(path.join(root, 'amsterdam-grachtengordel-west-massing.json')),
  readFile(path.join(root, 'amsterdam-grachtengordel-west-semantics.json')),
  readFile(fileURLToPath(import.meta.url)),
]);
const registry = JSON.parse(registryBytes.toString()).data as Registry[];
const panoramas = JSON.parse(panoramaMetadataBytes.toString()).data as Panorama[];
const masses = new Map((JSON.parse(massingBytes.toString()).data as Massing[]).map(entry => [entry.buildingId, entry]));
const semantics = new Map((JSON.parse(semanticBytes.toString()).data as Array<{ buildingId: string; name: string | null }>).map(entry => [entry.buildingId, entry]));

const priorIds = new Set<string>();
for (const name of ['pilot-01', 'expansion-01']) {
  try {
    const run = JSON.parse(await readFile(path.resolve(`public/canal-drive/facade-photo-review/local/${name}/manifest.json`), 'utf8'));
    for (const record of run.records ?? []) priorIds.add(record.source?.pandId);
  } catch { /* the generator also works before the earlier development runs exist */ }
}
for (const id of explicitlyExcludedIds) priorIds.add(id);

const rings = new Map<string, Ring>();
const footprintGrid = new Map<string, Set<string>>();
for (const entry of registry) {
  const ring = entry.footprintLngLat.map(point => RD_NEW.fromLngLat(point));
  rings.set(entry.buildingId, ring);
  const xs = ring.map(point => point.x), ys = ring.map(point => point.y);
  for (let cx = Math.floor(Math.min(...xs) / cellSizeM); cx <= Math.floor(Math.max(...xs) / cellSizeM); cx++) {
    for (let cy = Math.floor(Math.min(...ys) / cellSizeM); cy <= Math.floor(Math.max(...ys) / cellSizeM); cy++) {
      const key = `${cx}:${cy}`;
      (footprintGrid.get(key) ?? footprintGrid.set(key, new Set()).get(key)!).add(entry.buildingId);
    }
  }
}

const positioned = panoramas
  .filter(view => view.imageUrl && Number.isFinite(view.cameraHeight) && Number.isFinite(view.headingDeg))
  .map(view => ({ ...view, point: RD_NEW.fromLngLat(view.lngLat) }));
const panoramaGrid = new Map<string, PositionedPanorama[]>();
for (const view of positioned) (panoramaGrid.get(cellKey(view.point.x, view.point.y))
  ?? panoramaGrid.set(cellKey(view.point.x, view.point.y), []).get(cellKey(view.point.x, view.point.y))!).push(view);

function near(point: ProjectedPoint, radiusM = 48): PositionedPanorama[] {
  const reach = Math.ceil(radiusM / cellSizeM), cx = Math.floor(point.x / cellSizeM), cy = Math.floor(point.y / cellSizeM);
  const found: PositionedPanorama[] = [];
  for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++)
    found.push(...(panoramaGrid.get(`${cx + dx}:${cy + dy}`) ?? []));
  return found;
}

function crossing(a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint, d: ProjectedPoint): number | null {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-9) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denominator;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denominator;
  return u > 1e-7 && u < 1 - 1e-7 ? t : null;
}

function possibleBlockers(from: ProjectedPoint, to: ProjectedPoint): Set<string> {
  const result = new Set<string>();
  const minX = Math.min(from.x, to.x), maxX = Math.max(from.x, to.x);
  const minY = Math.min(from.y, to.y), maxY = Math.max(from.y, to.y);
  for (let cx = Math.floor(minX / cellSizeM); cx <= Math.floor(maxX / cellSizeM); cx++)
    for (let cy = Math.floor(minY / cellSizeM); cy <= Math.floor(maxY / cellSizeM); cy++)
      for (const id of footprintGrid.get(`${cx}:${cy}`) ?? []) result.add(id);
  return result;
}

function blocked(from: ProjectedPoint, to: ProjectedPoint, targetId: string): boolean {
  for (const id of possibleBlockers(from, to)) {
    if (id === targetId) continue;
    const ring = rings.get(id)!;
    for (let index = 0; index < ring.length; index++) {
      const t = crossing(from, to, ring[index], ring[(index + 1) % ring.length]);
      if (t !== null && t > .025 && t < .94) return true;
    }
  }
  return false;
}

function hiddenShare(wall: Elevation, camera: ProjectedPoint, targetId: string): number {
  let hidden = 0;
  for (let index = 0; index < 7; index++) {
    const t = (index + .5) / 7;
    const target = { x: wall.start.x + (wall.end.x - wall.start.x) * t, y: wall.start.y + (wall.end.y - wall.start.y) * t };
    if (blocked(camera, target, targetId)) hidden++;
  }
  return hidden / 7;
}

function sampling(standoff: number, obliquity: number, heightAboveLens: number) {
  const vertical = (4000 / Math.PI) * standoff / (standoff * standoff + heightAboveLens * heightAboveLens);
  const horizontal = (8000 / (2 * Math.PI)) * Math.cos(obliquity * Math.PI / 180) / standoff;
  return Math.min(vertical, horizontal);
}

function traits(entry: Registry, mass: Massing, wall: Elevation): string[] {
  const year = entry.constructionYear ?? 0;
  const era = year && year < 1700 ? 'era:pre-1700' : year < 1800 ? 'era:1700s' : year < 1900 ? 'era:1800s'
    : year < 1946 ? 'era:1900-1945' : year < 1990 ? 'era:postwar' : 'era:contemporary';
  const width = wall.lengthM < 7 ? 'width:narrow' : wall.lengthM < 12 ? 'width:medium' : 'width:wide';
  const heightM = mass.ridgeHeight - mass.groundLevel;
  const height = heightM < 11 ? 'height:low' : heightM < 19 ? 'height:medium' : 'height:tall';
  const use = entry.uses.some(value => /winkel|bijeenkomst|kantoor|logies/.test(value)) ? 'use:mixed-or-commercial' : 'use:residential-or-other';
  return [era, `roof:${mass.roofForm}`, width, height, use];
}

const candidates: Candidate[] = [];
for (const entry of registry) {
  const mass = masses.get(entry.buildingId), ring = rings.get(entry.buildingId);
  if (!entry.active || priorIds.has(entry.buildingId) || !mass || !ring || mass.insufficientInput || !mass.geometryValid) continue;
  const heightM = mass.ridgeHeight - mass.groundLevel;
  if (!(heightM >= 7 && heightM <= 30 && mass.groundArea >= 18 && mass.groundArea <= 650 && mass.reconstructionError <= 1.5)) continue;
  let best: Candidate | null = null;
  for (const wall of buildElevations(ring, { pandId: entry.buildingId, minLengthM: 3.5 }).filter(value => value.lengthM <= 22)) {
    const views = near(wall.midpoint).map(view => {
      if (!inFrontOf(wall, view.point)) return null;
      const distance = standoffM(wall, view.point), angle = obliquityDeg(wall, view.point);
      const cameraAboveGroundM = view.cameraHeight - GEOID_SEPARATION_M - mass.groundLevel;
      if (distance < 9 || distance > 45 || angle > 24 || cameraAboveGroundM < .5 || cameraAboveGroundM > 4) return null;
      const blockedFraction = hiddenShare(wall, view.point, entry.buildingId);
      if (blockedFraction > .28) return null;
      const sourcePixelsPerMetre = sampling(distance, angle, heightM + 1 - cameraAboveGroundM) * (1 - blockedFraction);
      if (sourcePixelsPerMetre < 34) return null;
      const score = sourcePixelsPerMetre - angle * .35 - blockedFraction * 35 + (isLeafOff(view.capturedAt) ? 4 : 0);
      return { registry: entry, mass, wall, view, standoffM: distance, obliquityDeg: angle, blockedFraction,
        sourcePixelsPerMetre, cameraAboveGroundM, score, traits: traits(entry, mass, wall), midpoint: wall.midpoint } satisfies Candidate;
    }).filter((value): value is Candidate => value !== null).sort((left, right) => right.score - left.score);
    if (views[0] && (!best || views[0].score > best.score)) best = views[0];
  }
  if (best) candidates.push(best);
}

const traitOrder = ['era:pre-1700', 'era:1700s', 'era:1800s', 'era:1900-1945', 'era:postwar', 'era:contemporary',
  'roof:flat', 'roof:pitched', 'width:narrow', 'width:wide', 'height:low', 'height:tall', 'use:mixed-or-commercial'];
const selected: Candidate[] = [];
const available = [...candidates];
const farEnough = (candidate: Candidate) => selected.every(other => Math.hypot(candidate.midpoint.x - other.midpoint.x, candidate.midpoint.y - other.midpoint.y) >= 28);
for (const trait of traitOrder) {
  if (selected.length >= count || selected.some(candidate => candidate.traits.includes(trait))) continue;
  const next = available.filter(candidate => candidate.traits.includes(trait) && farEnough(candidate))
    .sort((left, right) => right.score - left.score)[0];
  if (next) selected.push(next);
}
while (selected.length < count) {
  const seen = new Set(selected.flatMap(candidate => candidate.traits));
  const next = available.filter(candidate => !selected.includes(candidate) && farEnough(candidate))
    .sort((left, right) => {
      const novelty = (candidate: Candidate) => candidate.traits.filter(trait => !seen.has(trait)).length;
      return novelty(right) - novelty(left) || right.score - left.score;
    })[0];
  if (!next) break;
  selected.push(next);
}
if (selected.length < count) throw new Error(`Only ${selected.length} spatially varied candidates met the gates; requested ${count}`);

await mkdir(path.dirname(out), { recursive: true });
await mkdir(out); // Immutable run: an existing directory is an error.
await mkdir(panoramaCache, { recursive: true });
const strips = [];
for (const candidate of selected) {
  const panoramaPath = path.join(panoramaCache, `${candidate.view.panoramaId}.jpg`);
  let panoramaBytes: Buffer;
  try { panoramaBytes = await readFile(panoramaPath); }
  catch {
    const response = await fetch(candidate.view.imageUrl, { headers: { 'User-Agent': 'MapRecallFacadeVariety/1.0' }, signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`${candidate.view.panoramaId}: HTTP ${response.status}`);
    panoramaBytes = Buffer.from(await response.arrayBuffer());
    if (panoramaBytes.byteLength < 100_000) throw new Error(`${candidate.view.panoramaId}: unexpectedly small panorama`);
    await writeFile(panoramaPath, panoramaBytes);
  }
  const decoded = jpeg.decode(panoramaBytes, { useTArray: true, formatAsRGBA: true });
  const image: EquirectangularImage = { width: decoded.width, height: decoded.height, data: decoded.data };
  const pixelsPerMetre = clamp(Math.floor(candidate.sourcePixelsPerMetre), 34, 70);
  const baseZ = candidate.mass.groundLevel - 1.2, topZ = candidate.mass.ridgeHeight + 1;
  const rectified = rectifyFacade(image, {
    x: candidate.view.point.x, y: candidate.view.point.y, z: candidate.view.cameraHeight - GEOID_SEPARATION_M,
    headingDeg: candidate.view.headingDeg, pitchDeg: candidate.view.pitchDeg, rollDeg: candidate.view.rollDeg,
  }, { start: candidate.wall.start, end: candidate.wall.end, baseZ, topZ }, { pixelsPerMetre, yaw: 'centre' });
  if (rectified.missingFraction > 0) throw new Error(`${candidate.registry.buildingId}: missing panorama pixels`);
  const encoded = jpeg.encode({ width: rectified.width, height: rectified.height, data: Buffer.from(rectified.data) }, 92).data;
  const step = Math.max(1, Math.floor(rectified.data.length / (4 * 20_000)));
  let sum = 0, squares = 0, samples = 0;
  for (let index = 0; index < rectified.data.length; index += 4 * step) {
    const grey = (rectified.data[index] + rectified.data[index + 1] + rectified.data[index + 2]) / 3;
    sum += grey; squares += grey * grey; samples++;
  }
  const deviation = Math.sqrt(Math.max(0, squares / samples - (sum / samples) ** 2));
  if (deviation < 8) throw new Error(`${candidate.registry.buildingId}: nearly uniform rectification`);
  const semanticName = semantics.get(candidate.registry.buildingId)?.name;
  const label = semanticName || `BAG ${candidate.registry.buildingId}`;
  const stem = `${label.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}__${candidate.registry.buildingId}__${candidate.view.capturedAt.slice(0, 10)}`;
  const file = `${stem}.jpg`;
  await writeFile(path.join(out, file), encoded);
  strips.push({ file, pandId: candidate.registry.buildingId, address: label, capturedAt: candidate.view.capturedAt.slice(0, 10),
    panoramaId: candidate.view.panoramaId, wallWidthM: Number(candidate.wall.lengthM.toFixed(3)), horizontalMargin: 1,
    wallFacingDeg: Number(candidate.wall.facingDeg.toFixed(2)), elevationId: candidate.wall.elevationId,
    standoffM: Number(candidate.standoffM.toFixed(2)), obliquityDeg: Number(candidate.obliquityDeg.toFixed(2)),
    blockedFraction: Number(candidate.blockedFraction.toFixed(3)), sourcePixelsPerMetre: Number(candidate.sourcePixelsPerMetre.toFixed(2)),
    renderedPixelsPerMetre: Number(rectified.pixelsPerMetre.toFixed(2)), leafOff: isLeafOff(candidate.view.capturedAt),
    groundZ: Number(candidate.mass.groundLevel.toFixed(3)), topZ: Number(candidate.mass.ridgeHeight.toFixed(3)),
    cropBaseNapM: Number(baseZ.toFixed(3)), cropTopNapM: Number(topZ.toFixed(3)), cameraAboveGroundM: Number(candidate.cameraAboveGroundM.toFixed(3)),
    constructionYear: candidate.registry.constructionYear, storeys: candidate.mass.storeys, roofForm: candidate.mass.roofForm,
    traits: candidate.traits, pixelStdDev: Number(deviation.toFixed(2)), size: `${rectified.width}x${rectified.height}`,
    sourceImageUrl: candidate.view.imageUrl, panoramaSha256: sha(panoramaBytes), sourceSha256: sha(encoded) });
  console.log(`${strips.length}/${count} ${label}: ${rectified.width}×${rectified.height}, ${candidate.traits.join(', ')}`);
}

await writeFile(path.join(out, 'manifest.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(), generator: 'scripts/facade-rebuild/build-panorama-test-strips.ts', generatorSha256: sha(generatorBytes),
    source: 'Kernregistratie Panoramabeelden, Gemeente Amsterdam', license: 'CC BY 4.0', cameraModel: 'amsterdam-world-aligned',
    inputs: { registrySha256: sha(registryBytes), panoramaMetadataSha256: sha(panoramaMetadataBytes), massingSha256: sha(massingBytes), semanticSha256: sha(semanticBytes) },
    gates: { standoffM: [9, 45], maxObliquityDeg: 24, maxBlockedFraction: .28, minSourcePixelsPerMetre: 34,
      cameraAboveGroundM: [.5, 4], wallWidthM: [3.5, 22], buildingHeightM: [7, 30], maxMassingErrorM: 1.5, minimumSpatialSeparationM: 28 },
    selection: { requested: count, eligible: candidates.length, excludedPandIds: [...priorIds].sort(),
      strategy: 'Greedy metadata diversity across era, roof form, frontage width, height and use; quality tie-break; no detector or pixel-agreement input.' },
    verticalCoverage: 'ground−1.2 m through 3DBAG ridge+1.0 m; includes roof and souterrain context when the published pose supports it.',
    acceptance: 'None. Unreviewed development strips; visibility, registration, identity and feature correctness require review.',
  },
  strips,
}, null, 2) + '\n');
console.log(out);
