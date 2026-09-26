import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type Typology = 'retail' | 'residential' | 'mixed' | 'unknown';

type DevelopmentCase = {
  caseId: string;
  address: string;
  owner: { id: string };
  source: Record<string, { sha256: string; captureDate: string }>;
};

type SourceAssertion = {
  typology: Exclude<Typology, 'unknown'>;
  sourceDocument: string;
  sourceTier: 'full' | 'ground' | 'panorama';
  sourceHash: string;
  evidence: string;
  recess: boolean;
  awning: boolean;
  sign: boolean;
};

const DEVELOPMENT_ASSERTIONS: Record<string, SourceAssertion> = {
  'case-03': {
    typology: 'retail', sourceDocument: 'scripts/review/retail-priority-source-review.json', sourceTier: 'ground',
    sourceHash: 'a2cc557bfd294d5df1152174cb360c89868ebd5fb386cea435307c17ec038758',
    evidence: 'Agent source review identifies the key-color / het Fotolab fascia, FUJIFILM mark, scalloped dark awning and broad retail glazing.', recess: false, awning: true, sign: true,
  },
  'case-05': {
    typology: 'residential', sourceDocument: 'scripts/review/spatial-source-corrections.json', sourceTier: 'ground',
    sourceHash: '9cf6eb7e4114fcb745b4b8bc5c2f08b19a5704f48b5e22dd3c5927daaf18ddcf',
    evidence: 'Agent inspection identifies a residential door behind recessed jambs with a stepped approach.', recess: true, awning: false, sign: false,
  },
  'case-13': {
    typology: 'retail', sourceDocument: 'scripts/review/next-stage-source-review.json', sourceTier: 'full',
    sourceHash: '1b487142a5367681040c06dae3c6f3ae75f2db1e73a65badd1199b171f27474c',
    evidence: 'Agent source review records repeated upper windows and a lower entrance/shop zone.', recess: false, awning: false, sign: false,
  },
  'case-17': {
    typology: 'retail', sourceDocument: 'scripts/review/next-stage-source-review.json', sourceTier: 'ground',
    sourceHash: '844bcc9aff1b0b876646f3ea4bf5b2825b3cf581cf01e9a1d6b83f5d6fb40071',
    evidence: 'Agent source review records upper façade rows and a ground shopfront with display, recessed door and fascia/awning band.', recess: true, awning: true, sign: false,
  },
  'case-20': {
    typology: 'retail', sourceDocument: 'scripts/review/next-stage-source-review.json', sourceTier: 'ground',
    sourceHash: '26e259aebbfed207e7d9f02e6379d61e1c792e142806f88122e267eec660e119',
    evidence: 'Agent source review records upper windows and balconies above a ground shop window flanked by doors.', recess: false, awning: false, sign: false,
  },
  'case-21': {
    typology: 'retail', sourceDocument: 'scripts/review/next-stage-source-review.json', sourceTier: 'ground',
    sourceHash: '9658823697aedc0a7554101ef617d14a3330481b10250a8b4035fb23f3b16ab9',
    evidence: 'Agent source review identifies the recessed De Fietsenmaker storefront, projecting sign and upper window rows.', recess: true, awning: false, sign: true,
  },
  'case-24': {
    typology: 'retail', sourceDocument: 'scripts/review/next-stage-source-review.json', sourceTier: 'ground',
    sourceHash: '59c9babb71a3b4d4f71b4b752efbe0bfe0aff091b0fd22186c9e4ee78571c3f0',
    evidence: 'Agent source review records upper windows over a shop display bay flanked by two doors.', recess: false, awning: false, sign: false,
  },
  'case-29': {
    typology: 'retail', sourceDocument: 'scripts/review/retail-priority-source-review.json', sourceTier: 'ground',
    sourceHash: '788c84eae23e26305288ef67492c5095ee2f540151b4971c1b9473cd38127f49',
    evidence: 'Agent source review identifies the DORUS retail frontage, extended striped awning, display and separate side entrances.', recess: true, awning: true, sign: true,
  },
};

const ACTIVE_PASS_IDS = ['case-03', 'case-21', 'case-29', 'case-18'] as const;
const FUTURE_CASE_PRIORITY_IDS = ['case-05'] as const;
const NAMED_COVERAGE_IDS = ['named:Fuoco Vivo', 'named:Engels Verf'] as const;

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function sha256File(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function classifyDevelopmentCase(record: DevelopmentCase, assertions = DEVELOPMENT_ASSERTIONS) {
  const assertion = assertions[record.caseId];
  const streetLabel = record.address;
  if (!assertion) {
    return {
      id: record.caseId,
      buildingIds: [record.owner.id],
      streetLabel,
      sourceInspectedTypology: 'unknown' as const,
      evidenceDisposition: 'no-explicit-source-typology-inspection',
      sourceEvidence: null,
      detailEvidence: { recess: false, awning: false, sign: false },
    };
  }
  const source = record.source[assertion.sourceTier];
  if (!source || source.sha256 !== assertion.sourceHash) throw new Error(`source-binding-mismatch:${record.caseId}:${assertion.sourceTier}`);
  return {
    id: record.caseId,
    buildingIds: [record.owner.id],
    streetLabel,
    sourceInspectedTypology: assertion.typology,
    evidenceDisposition: 'agent-inspected-source-bound',
    sourceEvidence: {
      document: assertion.sourceDocument,
      tier: assertion.sourceTier,
      cropSha256: assertion.sourceHash,
      captureDate: source.captureDate,
      finding: assertion.evidence,
    },
    detailEvidence: { recess: assertion.recess, awning: assertion.awning, sign: assertion.sign },
  };
}

export function buildSampleCompositionAudit(root = '.') {
  const resolve = (p: string) => path.resolve(root, p);
  const casePath = 'public/data/facade-repair-preview/cases.json';
  const namedPath = 'scripts/city-appearance/fidelity/named-compatibility.json';
  const heldoutPath = 'scripts/city-appearance/fidelity/heldout-source-inspection.json';
  const exclusionsPath = 'scripts/review/facade-regression-heldout-exclusions.json';
  const casesFile = readJson<{ cases: DevelopmentCase[] }>(resolve(casePath));
  const named = readJson<any[]>(resolve(namedPath));
  const heldout = readJson<{ certificationStatus: string; cases: Array<{ buildingId: string }> }>(resolve(heldoutPath));
  const exclusions = readJson<{ excludedBuildingIds: string[]; actualOverlaps: unknown[]; retainedHeldoutObservationIds: string[] }>(resolve(exclusionsPath));

  if (casesFile.cases.length !== 28) throw new Error(`development-case-count:${casesFile.cases.length}`);
  const entries: any[] = casesFile.cases.map((record) => classifyDevelopmentCase(record));
  for (const item of named) {
    const inspection = item.inspection;
    if (inspection?.disposition !== 'agent-inspected') throw new Error(`named-source-not-inspected:${item.name}`);
    const sourceHash = inspection.cropSha256 ?? item.legacySource?.imageSha256;
    if (!/^[a-f0-9]{64}$/.test(sourceHash ?? '')) throw new Error(`named-source-hash:${item.name}`);
    entries.push({
      id: `named:${item.name}`,
      buildingIds: item.buildingIds,
      streetLabel: item.name,
      sourceInspectedTypology: 'retail',
      evidenceDisposition: 'agent-inspected-source-bound',
      sourceEvidence: {
        document: namedPath,
        tier: inspection.cropSha256 ? 'ground' : 'panorama',
        cropSha256: sourceHash,
        captureDate: inspection.captureDate ?? item.legacySource.panorama.timestamp,
        finding: inspection.notes,
      },
      detailEvidence: {
        recess: false,
        awning: item.name === 'Fuoco Vivo',
        sign: true,
      },
    });
  }

  const counts = { retail: 0, residential: 0, mixed: 0, unknown: 0 };
  for (const entry of entries) counts[entry.sourceInspectedTypology as Typology]++;
  const heldoutIds = new Set(heldout.cases.map((item) => item.buildingId));
  const excludedIds = new Set(exclusions.excludedBuildingIds);
  const makeSelection = (ids: readonly string[]) => ids.map((id, index) => {
    const entry = entries.find((item) => item.id === id);
    if (!entry) throw new Error(`priority-missing:${id}`);
    return {
      rank: index + 1,
      id,
      typology: entry.sourceInspectedTypology,
      detailEvidence: entry.detailEvidence,
      buildingIds: entry.buildingIds,
      heldoutOverlap: entry.buildingIds.filter((buildingId: string) => heldoutIds.has(buildingId)),
      developmentExclusionAlreadyPresent: entry.buildingIds.every((buildingId: string) => excludedIds.has(buildingId)),
      action: id.startsWith('named:') ? 'add building IDs to development exclusions before any tuning' : 'continue source-bound development repair',
    };
  });
  const activePass = makeSelection(ACTIVE_PASS_IDS).map((item) => item.id === 'case-18' ? {
    ...item,
    targetLabel: 'raised residential entrance',
    typologyEvidenceStatus: 'unconfirmed',
    reason: 'The source proves a raised paired entrance and stair run, but the bound source review does not establish residential use.',
  } : { ...item, typologyEvidenceStatus: 'source-inspected' });
  const futureCasePriority = makeSelection(FUTURE_CASE_PRIORITY_IDS);
  const namedCoverage = makeSelection(NAMED_COVERAGE_IDS);
  const activeCounts = activePass.reduce((acc: Record<string, number>, item) => {
    acc[item.typology] = (acc[item.typology] ?? 0) + 1;
    return acc;
  }, {});
  const activeDetailCoverage = {
    recess: activePass.some((item) => item.detailEvidence.recess),
    awning: activePass.some((item) => item.detailEvidence.awning),
    sign: activePass.some((item) => item.detailEvidence.sign),
  };
  if ((activeCounts.retail ?? 0) + (activeCounts.mixed ?? 0) !== 3 || activeCounts.unknown !== 1) throw new Error('active-pass-composition');
  if (!Object.values(activeDetailCoverage).every(Boolean)) throw new Error('active-pass-detail-variety');

  return {
    version: 1,
    kind: 'facade-sample-composition-audit',
    generatedAt: '2026-09-13T00:00:00+02:00',
    mutationPolicy: 'read-only audit; frozen development and held-out sets unchanged',
    inputs: {
      developmentCases: { path: casePath, sha256: sha256File(resolve(casePath)) },
      namedCompatibility: { path: namedPath, sha256: sha256File(resolve(namedPath)) },
      heldoutCandidates: { path: heldoutPath, sha256: sha256File(resolve(heldoutPath)) },
      developmentExclusions: { path: exclusionsPath, sha256: sha256File(resolve(exclusionsPath)) },
      sourceReview: { path: 'scripts/review/next-stage-source-review.json', sha256: sha256File(resolve('scripts/review/next-stage-source-review.json')) },
      retailSourceReview: { path: 'scripts/review/retail-priority-source-review.json', sha256: sha256File(resolve('scripts/review/retail-priority-source-review.json')) },
      retailRegistration: { path: 'scripts/review/retail-registration.json', sha256: sha256File(resolve('scripts/review/retail-registration.json')) },
      spatialCorrections: { path: 'scripts/review/spatial-source-corrections.json', sha256: sha256File(resolve('scripts/review/spatial-source-corrections.json')) },
    },
    methodology: {
      sourceInspectedTypology: 'Assigned only where a bound agent-inspected source document explicitly supports a visible retail, residential, or mixed frontage. Mixed requires explicit evidence of both uses.',
      streetLabel: 'Copied for identification only; never used to infer typology.',
      unknown: 'Retained when the bound documents do not explicitly inspect use, even if an address, awning or generic opening suggests a use.',
    },
    composition: {
      totalEntries: entries.length,
      developmentEntries: casesFile.cases.length,
      namedCompatibilityEntries: named.length,
      sourceInspectedCounts: counts,
      knownRetailOrMixedShare: (counts.retail + counts.mixed) / entries.length,
      unknownShare: counts.unknown / entries.length,
      finding: 'The current evidence has explicit use inspection for only a minority of entries, so its apparent canal-house composition cannot be quantified reliably from street labels.',
    },
    entries,
    activeCurrentPass: {
      requestedComposition: 'three retail examples plus one raised-residential example',
      sourceInspectedCounts: activeCounts,
      compositionEvidenceComplete: false,
      detailCoverage: activeDetailCoverage,
      cases: activePass,
      finding: 'Cases 03, 21 and 29 are source-inspected retail frontages. Case 18 is source-inspected as a raised paired entrance with stairs, but residential use is not established and remains unknown.',
    },
    proposedFutureCasePriority: {
      purpose: 'Close the unverified residential slot with an explicitly source-inspected residential entrance.',
      cases: futureCasePriority,
    },
    namedCompatibilityCoverageChecks: {
      purpose: 'Retain Fuoco Vivo and Engels Verf as named retail compatibility checks; they are not substitutes for or exclusive owners of the active case priorities.',
      cases: namedCoverage,
    },
    heldoutRisk: {
      certificationStatus: heldout.certificationStatus,
      frozenCandidateCount: heldout.cases.length,
      priorReviewedBuildingOverlapCount: exclusions.actualOverlaps.length,
      retainedAfterExistingExclusions: exclusions.retainedHeldoutObservationIds.length,
      activeAndProposedHeldoutOverlapCount: [...activePass, ...futureCasePriority, ...namedCoverage].reduce((sum, item) => sum + item.heldoutOverlap.length, 0),
      namedBuildingIdsRequiringDevelopmentExclusionBeforeUse: namedCoverage.flatMap((item) => item.buildingIds.filter((id: string) => !excludedIds.has(id))),
      conclusion: 'No active or proposed case currently overlaps a held-out building, but named compatibility buildings must be added to development exclusions before tuning. The held-out set remains uncertified and one candidate short after the existing overlap removal.',
    },
    paidCalls: 0,
  };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const output = process.argv[2] ?? 'scripts/review/sample-composition-audit.json';
  fs.writeFileSync(output, `${JSON.stringify(buildSampleCompositionAudit(), null, 2)}\n`);
  console.log(`Wrote ${output}`);
}
