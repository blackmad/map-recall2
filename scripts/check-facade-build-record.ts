/**
 * Pin the reconnaissance → CanalHouse constructor.
 *
 * Two kinds of case here. The first is the rule the whole schema exists for:
 * a registry and a roof reconstruction must produce a building with no façade,
 * however much metadata they carry. The second is the set of source
 * inconsistencies a real run over the pilot boundary actually turned up —
 * heights that contradict themselves — pinned so the handling cannot quietly
 * change back into shipping them.
 */
import assert from 'node:assert/strict';
import {
  buildRecordFromRecon, declaredExtent, footprintExtent, massingConfidence,
  reconObservations, resolveHeights, summariseReconBuild,
  type BuildRecordInput, type SourceDescriptor,
} from '../src/canalRecall/facade/buildRecord.ts';
import { wasObserved } from '../src/canalRecall/facade/evidence.ts';
import { CANAL_HOUSE_FIELDS, auditHouse, validateHouse } from '../src/canalRecall/facade/houseRecord.ts';
import { classifyObservationTier, drawsOpenings, evidenceCeiling } from '../src/canalRecall/facade/observationTier.ts';
import type { MassingRecord, RegistryBuilding } from '../src/canalRecall/facade/sources.ts';

const BUILDING = '0363100012164995';

const registrySource: SourceDescriptor = {
  id: 'bag', license: 'CC0 1.0', vintage: '2026-09',
  recordUrlTemplate: 'https://example.invalid/pand/{id}',
};
const massingSource: SourceDescriptor = {
  id: '3dbag', license: 'CC BY 4.0', vintage: 'v20250903',
  recordUrlTemplate: 'https://example.invalid/3dbag/{id}',
};

const building = (overrides: Partial<RegistryBuilding> = {}): RegistryBuilding => ({
  buildingId: BUILDING,
  constructionYear: 1739,
  status: 'Pand in gebruik',
  active: true,
  uses: ['woonfunctie'],
  dwellings: 3,
  footprintLngLat: [],
  ...overrides,
} as RegistryBuilding);

const massing = (overrides: Partial<MassingRecord> = {}): MassingRecord => ({
  buildingId: BUILDING,
  storeys: 4,
  roofForm: 'pitched',
  roofFormRaw: 'slanted',
  groundLevel: 1.0,
  eavesHeight: 15.0,
  ridgeHeight: 19.0,
  reconstructionError: 0.3,
  geometryValid: true,
  sourceQualityFlag: true,
  surveyCampaign: 'ahn4',
  surveyYear: 2020,
  insufficientInput: false,
  groundArea: 120,
  exteriorWallArea: 400,
  partyWallArea: 300,
  ...overrides,
});

const input = (overrides: Partial<BuildRecordInput> = {}): BuildRecordInput => ({
  building: building({ plotWidthM: 5.4, plotDepthM: 24.1 } as Partial<RegistryBuilding>),
  massing: massing(),
  registryReadAt: '2026-09-03',
  registry: registrySource,
  massingSource,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Footprint extent

{
  // The adapter already publishes the minimum-area rectangle's sides, so the
  // constructor uses them rather than recomputing a second opinion.
  assert.deepEqual(declaredExtent(building({ plotWidthM: 5.4, plotDepthM: 24.1 } as Partial<RegistryBuilding>)), { widthM: 5.4, depthM: 24.1 });

  // A swapped pair is normalised rather than trusted: plot width is the
  // dimension the whole façade grammar scales from, so getting it backwards
  // would silently rescale every later measurement.
  assert.deepEqual(declaredExtent(building({ plotWidthM: 24.1, plotDepthM: 5.4 } as Partial<RegistryBuilding>)), { widthM: 5.4, depthM: 24.1 });
  assert.equal(declaredExtent(building()), null, 'no declared extent when the adapter published none');
  assert.equal(declaredExtent(building({ plotWidthM: 0, plotDepthM: 24.1 } as Partial<RegistryBuilding>)), null);

  // The fallback, for a source that hands over the ring instead. A canal plot
  // runs at whatever bearing its canal does, so an axis-aligned box would
  // report neither the façade width nor the depth — this must be the
  // minimum-area rectangle.
  const angle = Math.PI / 4;
  const metresPerDegreeLat = 111_132;
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos((52.37 * Math.PI) / 180);
  const corner = (along: number, across: number): [number, number] => {
    const x = along * Math.cos(angle) - across * Math.sin(angle);
    const y = along * Math.sin(angle) + across * Math.cos(angle);
    return [4.88 + x / metresPerDegreeLng, 52.37 + y / metresPerDegreeLat];
  };
  const rotated = footprintExtent(building({
    footprintLngLat: [corner(0, 0), corner(24, 0), corner(24, 5.4), corner(0, 5.4), corner(0, 0)],
  }));
  assert.equal(Math.abs((rotated?.widthM ?? 0) - 5.4) < 0.05, true, `width was ${rotated?.widthM}`);
  assert.equal(Math.abs((rotated?.depthM ?? 0) - 24) < 0.05, true, `depth was ${rotated?.depthM}`);
  assert.equal(footprintExtent(building()), null);

  // When both routes are available the published extent wins. Recomputing an
  // answer the adapter already measured is only a second chance to disagree
  // with it, and the disagreement would land on plot width — the dimension
  // every later façade measurement is scaled from.
  const bothAvailable = buildRecordFromRecon(input({
    building: building({
      plotWidthM: 5.4, plotDepthM: 24.1,
      footprintLngLat: [corner(0, 0), corner(30, 0), corner(30, 9), corner(0, 9), corner(0, 0)],
    } as Partial<RegistryBuilding>),
  }));
  assert.equal(bothAvailable.house.plotWidthM.value, 5.4, 'the published extent is used, not a re-derived one');
  assert.equal(bothAvailable.house.depthM.value, 24.1);
}

// ---------------------------------------------------------------------------
// Heights, and the inconsistencies the real boundary contains

{
  const consistent = resolveHeights(massing());
  assert.deepEqual([consistent.eavesM, consistent.ridgeM, consistent.reason], [14, 18, 'ok']);
  assert.equal(consistent.confidenceFactor, 1);

  // 198 of 2,892 buildings in the pilot report a modelled ridge below their own
  // measured roof height, every one of them a pitched roof. The roof height is
  // an order statistic and cannot exceed the true ridge; the modelled ridge is
  // what fails on complex roofs. So the roof height survives as a ridge lower
  // bound, the eaves is dropped, and confidence is halved.
  const inverted = resolveHeights(massing({ eavesHeight: 19.0, ridgeHeight: 15.0 }));
  assert.equal(inverted.reason, 'inverted');
  assert.equal(inverted.eavesM, null, 'an eaves line above its own ridge is never shipped');
  assert.equal(inverted.ridgeM, 18, 'the measured roof height survives as a lower bound');
  assert.equal(inverted.confidenceFactor, 0.5);
  assert.match(inverted.note ?? '', /lower bound/);

  // A ridge at or below the building's own ground level is impossible rather
  // than low. Prefer the gap: five buildings in the pilot land here.
  const impossible = resolveHeights(massing({ eavesHeight: 0.5, ridgeHeight: 0.2 }));
  assert.equal(impossible.reason, 'impossible');
  assert.deepEqual([impossible.eavesM, impossible.ridgeM], [null, null]);

  const missing = resolveHeights(massing({ eavesHeight: null, ridgeHeight: null }));
  assert.equal(missing.reason, 'missing');
  assert.deepEqual([missing.eavesM, missing.ridgeM], [null, null]);
  // No ground level is the same problem: a height above nothing is not a height.
  assert.equal(resolveHeights(massing({ groundLevel: null })).reason, 'missing');
}

// ---------------------------------------------------------------------------
// Confidence follows the source's own metadata

{
  assert.equal(massingConfidence(massing({ reconstructionError: 0 })) > 0.85, true);

  // Reconstruction error tracks roof complexity rather than failure, so it
  // degrades confidence gently. A hard 0.5 m gate would reject 61% of the
  // pilot for being architecturally interesting.
  const clean = massingConfidence(massing({ reconstructionError: 0.1 }));
  const complex = massingConfidence(massing({ reconstructionError: 0.6 }));
  const messy = massingConfidence(massing({ reconstructionError: 2.4 }));
  assert.equal(clean > complex && complex > messy, true, 'more fit error, less confidence');
  assert.equal(complex > 0.4, true, `a complex roof is still a measured roof, got ${complex}`);
  assert.equal(messy > 0.05, true, 'and never falls to nothing');

  // The source's own verdicts are respected, and outrank a clean fit.
  assert.equal(massingConfidence(massing({ geometryValid: false, reconstructionError: 0 })), 0.2);
  assert.equal(massingConfidence(massing({ insufficientInput: true, reconstructionError: 0 })), 0.2);
  assert.equal(massingConfidence(massing({ sourceQualityFlag: false })) < massingConfidence(massing()), true);
}

// ---------------------------------------------------------------------------
// Observations carry the survey's vintage, not the pipeline's run date

{
  const observations = reconObservations(building(), massing({ surveyYear: 2014 }), '2026-09-03', registrySource, massingSource);
  assert.equal(observations.length, 2);
  assert.equal(observations[0].capturedAt, '2026-09-03', 'the registry was read today');
  assert.equal(observations[1].capturedAt, '2014-01-01',
    'a ridge from a 2014 survey is a 2014 measurement however often the extract is rebuilt');
  assert.equal(observations[1].license, 'CC BY 4.0');
  assert.match(observations[1].sourceUrl ?? '', new RegExp(BUILDING), 'the receipt points at this building');
  for (const observation of observations) {
    assert.equal(observation.pandId, BUILDING, 'every observation is of this building');
    assert.equal(observation.kind, 'registry-record');
  }
  assert.equal(reconObservations(building(), undefined, '2026-09-03', registrySource).length, 1);
}

// ---------------------------------------------------------------------------
// The headline rule: a registry and a roof model produce no façade

{
  const { house, observations, notes } = buildRecordFromRecon(input());
  const registry = new Map(observations.map(observation => [observation.id, observation]));

  assert.deepEqual(auditHouse(house, registry, '2026-09-03'), [], 'the constructor produces an auditable record');
  assert.deepEqual(validateHouse(house), []);
  assert.deepEqual(notes, []);

  // What it may populate.
  assert.deepEqual(
    CANAL_HOUSE_FIELDS.filter(field => wasObserved(house[field])).slice().sort(),
    ['depthM', 'eavesHeightM', 'plotWidthM', 'ridgeHeightM', 'storeys'],
    'reconnaissance measures footprint and massing, and nothing else',
  );

  // Everything a façade is made of stays unobserved, whatever the sources say.
  for (const field of ['gable', 'gableOrnament', 'bays', 'bayOffsetsM', 'windowType', 'doorPositionM', 'brick', 'puiType', 'corniceType', 'leanDeg'] as const) {
    assert.equal(wasObserved(house[field]), false, `${field} must not come from a registry or a roof model`);
  }

  // And the ladder agrees: this building may not draw a single opening.
  const tier = classifyObservationTier(observations, 'front');
  assert.equal(tier, 'aerial-only');
  assert.equal(drawsOpenings(evidenceCeiling(tier, false)), false);

  assert.equal(house.plotWidthM.value, 5.4);
  assert.equal(house.plotWidthM.source, 'bag');
  assert.equal(house.eavesHeightM.source, 'ahn', 'the survey measures the surface; the model only fits planes to it');
  assert.equal(house.storeys.source, '3dbag');
  assert.equal(house.storeys.confidence <= 0.75, true, 'a derived storey count is recorded below the height confidence');
}

// A building with no massing match keeps its footprint and admits the rest.
{
  const { house, notes, heightReason } = buildRecordFromRecon(input({ massing: undefined }));
  assert.equal(wasObserved(house.plotWidthM), true);
  assert.equal(wasObserved(house.ridgeHeightM), false);
  assert.equal(wasObserved(house.storeys), false);
  assert.equal(heightReason, null);
  assert.match(notes[0], /no massing match/);
}

// An inverted pair reaches the record as a ridge alone, at reduced confidence.
{
  const { house, notes, heightReason } = buildRecordFromRecon(input({ massing: massing({ eavesHeight: 19.0, ridgeHeight: 15.0 }) }));
  assert.equal(heightReason, 'inverted');
  assert.equal(wasObserved(house.eavesHeightM), false);
  assert.equal(wasObserved(house.ridgeHeightM), true);
  assert.equal(house.ridgeHeightM.confidence < massingConfidence(massing()), true);
  assert.deepEqual(validateHouse(house), [], 'and the record it produces is internally consistent');
  assert.equal(notes.length, 1);
}

// A storey count of zero or null is absence, not a measurement of zero storeys.
for (const storeys of [null, 0]) {
  const { house, notes } = buildRecordFromRecon(input({ massing: massing({ storeys }) }));
  assert.equal(wasObserved(house.storeys), false, `storeys ${storeys} must read as unobserved`);
  assert.match(notes.join(' '), /no storey count/);
}

// ---------------------------------------------------------------------------
// The summary counts the two height failures separately

{
  const rows = [
    input(),
    input({ massing: massing({ eavesHeight: 19.0, ridgeHeight: 15.0 }) }),
    input({ massing: massing({ eavesHeight: 0.5, ridgeHeight: 0.2 }) }),
    input({ massing: undefined }),
    input({ building: building({ constructionYear: null, plotWidthM: 5, plotDepthM: 20 } as Partial<RegistryBuilding>) }),
  ];
  const summary = summariseReconBuild(rows, rows.map(buildRecordFromRecon));
  assert.equal(summary.buildings, 5);
  assert.equal(summary.withMassing, 4);
  assert.equal(summary.withoutMassing, 1);
  assert.equal(summary.invertedHeights, 1);
  assert.equal(summary.impossibleHeights, 1, 'an impossible height is not filed as an inverted one');
  assert.equal(summary.withRidge, 3, 'ok + inverted lower bound + the dateless building');
  assert.equal(summary.withEaves, 2);
  assert.equal(summary.unknownConstructionYear, 1, 'a normalised null year is the honest signal');
  assert.equal(summary.meanHeightConfidence > 0 && summary.meanHeightConfidence <= 1, true);
}

console.log('All façade build-record checks passed.');
