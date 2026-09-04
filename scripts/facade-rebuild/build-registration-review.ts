import { link, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchBagBuildingIdentities, formatBagAddress } from '../../src/canalRecall/facade/bagIdentity.ts';
import { buildElevations, inFrontOf, obliquityDeg, standoffM } from '../../src/canalRecall/facade/elevations.ts';
import type { RegistrationGoldFixture } from '../../src/canalRecall/facade/registrationGold.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { PanoramaView } from '../../src/canalRecall/facade/sources.ts';

const rawRoot = path.resolve('.cache/facade-rebuild/raw/v1');
const localRoot = path.resolve('public/canal-drive/facade-registration-review/local');
const reportRoot = path.resolve('.cache/facade-rebuild/reports');
const candidates = JSON.parse(await readFile('src/canalRecall/facade/fixtures/registration-gold-candidates.json', 'utf8')) as {
  candidates: Array<{ pandId: string; label: string; rationale: string; intendedCoverage: string[] }>;
};
const registryCache = JSON.parse(await readFile(path.join(rawRoot, 'amsterdam-grachtengordel-west-registry.json'), 'utf8')) as {
  data: Array<{ buildingId: string; footprintLngLat: [number, number][] }>;
};
const candidateIds = new Set(candidates.candidates.map(candidate => candidate.pandId));
const cachedCandidates = registryCache.data.filter(building => candidateIds.has(building.buildingId));
if (cachedCandidates.length !== candidates.candidates.length) throw new Error(`Raw BAG cache resolves ${cachedCandidates.length}/${candidates.candidates.length} candidates`);
const points = cachedCandidates.flatMap(building => building.footprintLngLat);
const padding = 0.0003;
const bbox = [
  Math.min(...points.map(point => point[0])) - padding,
  Math.min(...points.map(point => point[1])) - padding,
  Math.max(...points.map(point => point[0])) + padding,
  Math.max(...points.map(point => point[1])) + padding,
] as const;

console.log(`Fetching canonical BAG identity graph for ${candidates.candidates.length} fixtures…`);
const identities = await fetchBagBuildingIdentities(bbox);
const identityByPand = new Map(identities.map(identity => [identity.pandId, identity]));
const missing = candidates.candidates.filter(candidate => !identityByPand.has(candidate.pandId));
if (missing.length) throw new Error(`Current BAG response does not contain: ${missing.map(candidate => candidate.pandId).join(', ')}`);

const panoramaPayload = JSON.parse(await readFile(path.join(rawRoot, 'amsterdam-grachtengordel-west-panoramas.json'), 'utf8')) as { data: PanoramaView[] };
const regressionPanoramaId = 'TMX7316010203-001543_pano_0000_003628';
const regressionPanorama = panoramaPayload.data.find(view => view.panoramaId === regressionPanoramaId);
if (!regressionPanorama) throw new Error(`Missing panorama metadata ${regressionPanoramaId}`);

await mkdir(localRoot, { recursive: true });
const panoramaSource = path.join(rawRoot, 'panoramas', `${regressionPanoramaId}.jpg`);
const panoramaTarget = path.join(localRoot, `${regressionPanoramaId}.jpg`);
try { await link(panoramaSource, panoramaTarget); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }

const fixtures: RegistrationGoldFixture[] = candidates.candidates.map((candidate, index) => {
  const identity = identityByPand.get(candidate.pandId)!;
  const footprintRd = identity.footprintLngLat.map(point => RD_NEW.fromLngLat(point));
  const elevations = buildElevations(footprintRd, { pandId: identity.pandId });
  let selectedElevationId: string | null = null;
  let elevationSelectionBasis: string | null = null;
  let panorama: RegistrationGoldFixture['panorama'] = null;
  if (candidate.pandId === '0363100012164989') {
    const camera = RD_NEW.fromLngLat(regressionPanorama.lngLat);
    const compatible = elevations.filter(elevation => inFrontOf(elevation, camera));
    const selected = compatible.sort((left, right) => {
      const error = (elevation: typeof left) => Math.abs(standoffM(elevation, camera) - 38.6) + Math.abs(obliquityDeg(elevation, camera) - 3.3);
      return error(left) - error(right);
    })[0];
    if (!selected || Math.abs(standoffM(selected, camera) - 38.6) > 1 || Math.abs(obliquityDeg(selected, camera) - 3.3) > 1) {
      throw new Error('Herengracht 270 does not reproduce the approved wall geometry');
    }
    selectedElevationId = selected.elevationId;
    elevationSelectionBasis = `Recorded regression observation: ${standoffM(selected, camera).toFixed(1)} m standoff, ${obliquityDeg(selected, camera).toFixed(1)}° off square. No image-yaw claim.`;
    panorama = { ...regressionPanorama, mission: regressionPanorama.missionYear, localImageUrl: `local/${regressionPanoramaId}.jpg` };
  }
  return {
    fixtureId: `ams-reg-${String(index + 1).padStart(2, '0')}`,
    status: 'candidate', pandId: identity.pandId, label: candidate.label, rationale: candidate.rationale,
    intendedCoverage: candidate.intendedCoverage, addresses: identity.addresses, footprintRd, elevations,
    selectedElevationId, elevationSelectionBasis, panorama, sourceQuad: null, rectifiedPreviewUrl: null, anchors: [], reviewPasses: [],
  };
});

await writeFile(path.join(localRoot, 'fixtures.json'), `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), fixtures }, null, 2)}\n`);
await mkdir(reportRoot, { recursive: true });
const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), bbox,
  source: identities[0]?.sourceVersions,
  candidates: fixtures.map(fixture => ({
    pandId: fixture.pandId, label: fixture.label, addresses: fixture.addresses.map(formatBagAddress),
    vboCount: identityByPand.get(fixture.pandId)!.vbos.length, elevationCount: fixture.elevations.length,
    selectedElevationId: fixture.selectedElevationId,
  })),
};
await writeFile(path.join(reportRoot, 'bag-address-pand-inspection.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Built ${fixtures.length} review fixtures; ${fixtures.filter(fixture => fixture.addresses.length > 1).length} carry multiple BAG addresses.`);
console.log(`Review data: ${path.join(localRoot, 'fixtures.json')}`);
console.log(`Identity report: ${path.join(reportRoot, 'bag-address-pand-inspection.json')}`);
