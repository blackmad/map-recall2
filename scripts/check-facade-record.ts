/**
 * Pin the façade twin's evidence discipline.
 *
 * `AMSTERDAM_FACADE_TWIN.md` makes scope discipline and evidence discipline
 * pass/fail at 10/10: "a single façade rendered from a neighbour's
 * measurements, or a `default` shipped as though it were measured, fails the
 * milestone outright." A rule with that much weight on it needs a test, not a
 * convention, so every case below is one of the ways the pipeline could quietly
 * start inventing buildings.
 */
import assert from 'node:assert/strict';
import {
  auditFields, defaulted, isStrongerSource, measured, observedValue, resolveField,
  summariseCoverage, wasObserved, type Observation,
} from '../src/canalRecall/facade/evidence.ts';
import {
  CANAL_HOUSE_FIELDS, fieldsOf, unobservedHouse, validateHouse, type CanalHouse,
} from '../src/canalRecall/facade/houseRecord.ts';
import {
  classifyObservationTier, drawsOpenings, evidenceCeiling, resolveFidelityTier,
  silhouetteChanges, type FidelityTier, type TierInput,
} from '../src/canalRecall/facade/observationTier.ts';

const PAND = '0363100012164995';       // Prinsengracht 263, the Anne Frank Huis group
const NEIGHBOUR = '0363100012165023';  // a different pand entirely

const observation = (id: string, pandId: string, overrides: Partial<Observation> = {}): Observation => ({
  id, pandId,
  kind: 'street-panorama',
  elevation: 'front',
  capturedAt: '2024-03-11',
  sourceUrl: 'https://api.data.amsterdam.nl/panorama/panoramas/TMX0000/',
  license: 'CC BY 4.0',
  ...overrides,
});

const registry = (...items: Observation[]) => new Map(items.map(item => [item.id, item]));

// ---------------------------------------------------------------------------
// The evidence ledger

{
  const front = observation('pano-1', PAND);
  const house = unobservedHouse(PAND);
  house.gable = measured('klok', 'streetlevel-measured', 0.86, front);

  assert.deepEqual(auditFields(PAND, fieldsOf(house), registry(front)), [],
    'a value measured from an observation of this pand is clean');
  assert.equal(observedValue(house.gable), 'klok');
  assert.equal(observedValue(house.bays), null, 'an unmeasured field reads as nothing, not as its placeholder');
}

// The party-wall rule. This is the failure the whole module exists to catch:
// a gable read off the house next door, which is invisible in the render and
// obvious in the ledger.
{
  const neighboursView = observation('pano-2', NEIGHBOUR);
  const house = unobservedHouse(PAND);
  house.gable = measured('trap', 'streetlevel-measured', 0.91, neighboursView);

  const violations = auditFields(PAND, fieldsOf(house), registry(neighboursView));
  assert.equal(violations.length, 1);
  assert.equal(violations[0].code, 'foreign-observation');
  assert.equal(violations[0].field, 'gable');
  assert.match(violations[0].detail, new RegExp(NEIGHBOUR), 'the report names the pand it actually came from');
}

// A default laundered into a measurement: the source says it was observed and
// no observation exists. High confidence makes it worse, not better.
{
  const house = unobservedHouse(PAND);
  house.windowType = { value: 'schuifraam-8', source: 'streetlevel-measured', confidence: 0.99, observationId: null, measuredAt: '2024-03-11' };

  const violations = auditFields(PAND, fieldsOf(house), registry());
  assert.equal(violations.length, 1);
  assert.equal(violations[0].code, 'laundered-default');
}

// A field citing an observation that is not published with the extract cannot
// be traced by QA-EVIDENCE, so it is not evidence.
{
  const house = unobservedHouse(PAND);
  house.bays = measured(3, 'streetlevel-measured', 0.8, observation('pano-missing', PAND));
  const violations = auditFields(PAND, fieldsOf(house), registry());
  assert.equal(violations[0]?.code, 'missing-observation');
}

// A default dressed up with confidence, or with a receipt it should not have.
{
  const front = observation('pano-1', PAND);
  const house = unobservedHouse(PAND);
  house.leanDeg = { value: 1.8, source: 'default', confidence: 0.7, observationId: 'pano-1', measuredAt: null };
  const codes = auditFields(PAND, fieldsOf(house), registry(front)).map(violation => violation.code).sort();
  assert.deepEqual(codes, ['default-claims-confidence', 'default-claims-observation']);
}

// Evidence dated after the run is a clock or a pipeline bug, not an observation.
{
  const future = observation('pano-future', PAND, { capturedAt: '2999-01-01' });
  const house = unobservedHouse(PAND);
  house.storeys = measured(4, 'streetlevel-measured', 0.7, future);
  assert.equal(auditFields(PAND, fieldsOf(house), registry(future), '2026-09-03')[0]?.code, 'stale-measurement-date');
}

// A wholly unobserved building is *not* a violation. It is a gap, and the doc
// prefers the gap every time. Coverage reports it; the audit stays quiet.
assert.deepEqual(auditFields(PAND, fieldsOf(unobservedHouse(PAND)), registry()), [],
  'an honestly unobserved building is clean, not broken');

// ---------------------------------------------------------------------------
// Source resolution

{
  assert.equal(isStrongerSource('reviewed', 'streetlevel-measured'), true, 'a human who looked outranks the extractor');
  assert.equal(isStrongerSource('osm', 'default'), true);
  assert.equal(isStrongerSource('3dbag', 'monument-text'), false, 'a monument description of a façade beats a roof reconstruction');

  const front = observation('pano-1', PAND);
  const reviewed = observation('review-1', PAND, { kind: 'human-review', capturedAt: '2026-01-20' });
  const fromImage = measured('klok', 'streetlevel-measured', 0.95, front);
  const fromHuman = measured('hals', 'reviewed', 0.6, reviewed);
  assert.equal(resolveField(fromImage, fromHuman).value, 'hals', 'the review wins even at lower confidence');
  assert.equal(resolveField(fromHuman, fromImage).value, 'hals', 'and the argument order does not decide it');

  // Same source, same confidence: the more recent evidence wins, because the
  // older one is likelier to predate an alteration.
  const older = measured(3, 'streetlevel-measured', 0.8, observation('pano-old', PAND, { capturedAt: '2017-05-02' }));
  const newer = measured(4, 'streetlevel-measured', 0.8, observation('pano-new', PAND, { capturedAt: '2024-03-11' }));
  assert.equal(resolveField(older, newer).value, 4);
  assert.equal(resolveField(newer, older).value, 4);
}

// ---------------------------------------------------------------------------
// Observation tiers

{
  const front = observation('pano-1', PAND);
  const nadir = observation('ortho-1', PAND, { kind: 'ortho-nadir', elevation: 'roof' });
  const monument = observation('rce-1', PAND, { kind: 'monument-record', elevation: 'front' });
  const oblique = observation('obl-1', PAND, { kind: 'oblique-aerial' });

  assert.equal(classifyObservationTier([front], 'front'), 'frontal');
  assert.equal(classifyObservationTier([front], 'rear'), 'none',
    'a view of the canal front says nothing about the achterhuis');
  assert.equal(classifyObservationTier([nadir], 'front'), 'aerial-only');
  assert.equal(classifyObservationTier([nadir], 'roof'), 'aerial-only');
  assert.equal(classifyObservationTier([monument], 'front'), 'oblique',
    'monument text is a second measurement of some fields, not a view of the elevation');
  assert.equal(classifyObservationTier([oblique, nadir], 'front'), 'oblique', 'the best observation decides');
  assert.equal(classifyObservationTier([nadir, front], 'front'), 'frontal');
  assert.equal(classifyObservationTier([], 'front'), 'none');

  // BAG and 3DBAG records measure massing and roof. They never see a façade,
  // however authoritative they are about the footprint.
  assert.equal(classifyObservationTier([observation('bag-1', PAND, { kind: 'registry-record' })], 'front'), 'aerial-only');
}

// ---------------------------------------------------------------------------
// The evidence ceiling — the rule that cannot be bought with a faster GPU

{
  assert.equal(evidenceCeiling('frontal', true), 'lod3');
  assert.equal(evidenceCeiling('oblique', true), 'lod3');
  assert.equal(evidenceCeiling('aerial-only', true), 'lod2.2-measured');
  assert.equal(evidenceCeiling('aerial-only', false), 'lod2.2');
  assert.equal(evidenceCeiling('none', true), 'lod1');

  assert.equal(drawsOpenings('lod2.2-measured'), false, 'measured colour is not permission to invent windows');
  assert.equal(drawsOpenings('lod3'), true);
}

const tier = (overrides: Partial<TierInput> = {}): FidelityTier => resolveFidelityTier({
  observation: 'frontal',
  hasMeasuredAppearance: true,
  signatureModelReady: false,
  distanceM: 40,
  current: null,
  insideBoundary: true,
  ...overrides,
});

{
  assert.equal(tier(), 'lod3', 'a frontally observed building close to the camera gets its façade');

  // The headline rule, stated three ways because it is the one that fails silently.
  assert.equal(tier({ observation: 'aerial-only' }), 'lod2.2-measured');
  assert.equal(drawsOpenings(tier({ observation: 'aerial-only' })), false,
    'a building whose façade has never been observed does not get a façade');
  assert.equal(tier({ observation: 'none', hasMeasuredAppearance: false }), 'lod1');

  // Distance is a second ceiling, never a promotion.
  assert.equal(tier({ distanceM: 400 }), 'lod2.2-measured', 'far away, the façade detail is not worth drawing');
  assert.equal(tier({ distanceM: 2000 }), 'lod1');
  assert.equal(tier({ observation: 'none', hasMeasuredAppearance: false, distanceM: 5 }), 'lod1',
    'standing right in front of an unobserved building does not conjure evidence');

  // Hysteresis: a building held at a near-constant distance must not flip.
  assert.equal(tier({ distanceM: 160, current: null }), 'lod2.2-measured', 'promotes only inside the near band');
  assert.equal(tier({ distanceM: 160, current: 'lod3' }), 'lod3', 'and releases only outside the far one');

  // Outside the boundary the 3DBAG baseline keeps serving every building. The
  // pilot changes fidelity within its boundary; it never removes coverage.
  assert.equal(tier({ insideBoundary: false }), 'lod2.2-measured');
  assert.equal(tier({ insideBoundary: false, hasMeasuredAppearance: false }), 'lod2.2');

  // A hero model outranks the façade ceiling — it is authored from its own
  // evidence — but only once it has actually loaded.
  assert.equal(tier({ signatureModelReady: true, observation: 'aerial-only' }), 'signature');
  assert.equal(tier({ signatureModelReady: false, observation: 'aerial-only' }), 'lod2.2-measured');

  // Leaving the boundary must not pop the silhouette.
  assert.equal(silhouetteChanges('lod3', 'lod2.2-measured'), false);
  assert.equal(silhouetteChanges('lod2.2-measured', 'lod2.2'), false);
  assert.equal(silhouetteChanges('lod2.2', 'lod1'), true, 'a flat extrusion is a different outline and must be flagged');
}

// ---------------------------------------------------------------------------
// Record validation: measurements that are internally impossible

{
  const front = observation('pano-1', PAND);
  const house: CanalHouse = unobservedHouse(PAND);
  house.plotWidthM = measured(5.4, 'bag', 0.99, front);
  house.bays = measured(3, 'streetlevel-measured', 0.9, front);
  house.bayOffsetsM = measured([1.1, 2.7, 4.3], 'streetlevel-measured', 0.85, front);
  house.doorPositionM = measured(0.9, 'streetlevel-measured', 0.8, front);
  house.eavesHeightM = measured(14.2, 'ahn', 0.95, front);
  house.ridgeHeightM = measured(18.0, 'ahn', 0.95, front);
  house.storeys = measured(4, '3dbag', 0.8, front);
  house.storeyHeights = measured([3.6, 3.2, 2.9, 2.5], 'streetlevel-measured', 0.7, front);
  house.leanDeg = measured(1.6, 'streetlevel-measured', 0.6, front);
  house.brick = measured({ bond: 'kruisverband', colourHex: '#7a4436', painted: false, pointing: 'recessed' }, 'streetlevel-measured', 0.7, front);
  assert.deepEqual(validateHouse(house), [], 'a coherent measured house is clean');

  // A bay centre outside this plot is the signature of a rectification that
  // drifted onto the neighbour — the same failure as a foreign observation,
  // caught from the geometry side.
  const drifted = { ...house, bayOffsetsM: measured([1.1, 2.7, 7.9], 'streetlevel-measured', 0.85, front) };
  assert.equal(validateHouse(drifted).some(problem => problem.field === 'bayOffsetsM'), true);

  const inverted = { ...house, ridgeHeightM: measured(11.0, 'ahn', 0.9, front) };
  assert.equal(validateHouse(inverted).some(problem => problem.field === 'ridgeHeightM'), true, 'a ridge below the eaves is impossible');

  const miscounted = { ...house, bays: measured(4, 'streetlevel-measured', 0.9, front) };
  assert.equal(validateHouse(miscounted).some(problem => problem.field === 'bayOffsetsM'), true);

  const leaning = { ...house, leanDeg: measured(23, 'streetlevel-measured', 0.4, front) };
  assert.equal(validateHouse(leaning).some(problem => problem.field === 'leanDeg'), true);

  const badColour = { ...house, brick: measured({ bond: 'kruisverband' as const, colourHex: 'brown', painted: false, pointing: 'flush' as const }, 'streetlevel-measured', 0.7, front) };
  assert.equal(validateHouse(badColour).some(problem => problem.field === 'brick'), true);

  // An unobserved building must not trip the geometry validator: its gaps are
  // coverage, and drowning the real failures in them is how a report gets ignored.
  assert.deepEqual(validateHouse(unobservedHouse(PAND)), []);
}

// ---------------------------------------------------------------------------
// Coverage reporting: the honesty the QA report publishes beside every score

{
  const front = observation('pano-1', PAND);
  const observed = unobservedHouse(PAND);
  observed.gable = measured('klok', 'streetlevel-measured', 0.9, front);
  observed.plotWidthM = measured(5.4, 'bag', 1, front);

  const partial = unobservedHouse(NEIGHBOUR);
  partial.plotWidthM = measured(6.1, 'bag', 1, observation('bag-2', NEIGHBOUR, { kind: 'registry-record' }));

  const coverage = summariseCoverage([observed, partial].map(fieldsOf));
  const byField = new Map(coverage.map(entry => [entry.field, entry]));

  assert.equal(byField.get('plotWidthM')?.share, 1, 'BAG gives every building its plot width');
  assert.equal(byField.get('gable')?.measured, 1);
  assert.equal(byField.get('gable')?.defaulted, 1);
  assert.equal(byField.get('gable')?.share, 0.5);
  assert.equal(byField.get('bays')?.share, 0, 'nothing observed is reported as nothing observed');
  assert.equal(byField.get('bays')?.bySource.default, 2);
  assert.equal(coverage.length, CANAL_HOUSE_FIELDS.length, 'every field appears in the report, including the empty ones');
  assert.equal(coverage[0].share <= coverage.at(-1)!.share, true, 'worst-covered field first, so the gaps lead the report');
  assert.equal(byField.get('gable')?.meanConfidence, 0.9, 'confidence averages over measurements only, never diluted by defaults');
}

// Every field of the record is auditable. A field added to CanalHouse without
// being added to CANAL_HOUSE_FIELDS would render without ever being checked.
{
  const house = unobservedHouse(PAND) as unknown as Record<string, unknown>;
  const declared = new Set<string>(CANAL_HOUSE_FIELDS as readonly string[]);
  const actual = Object.keys(house).filter(key => key !== 'pandId');
  assert.deepEqual(actual.filter(key => !declared.has(key)), [], 'every CanalHouse field must be listed in CANAL_HOUSE_FIELDS');
  assert.deepEqual([...declared].filter(key => !actual.includes(key)), [], 'CANAL_HOUSE_FIELDS must not name fields that do not exist');
  for (const field of CANAL_HOUSE_FIELDS) {
    assert.equal(wasObserved(unobservedHouse(PAND)[field]), false, `${field} must start unobserved`);
  }
  assert.equal(defaulted(0).confidence, 0);
}

console.log(`All façade record checks passed (${CANAL_HOUSE_FIELDS.length} parameter fields audited).`);
