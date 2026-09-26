import { validReviewTime } from './registrationGold.ts';

export type ExternalIdentityConclusion = 'supports' | 'contradicts' | 'insufficient';

export interface ExternalPhotoCandidate {
  pageId: number;
  title: string;
  description: string;
  licenseShortName: string;
  mime: string;
}

export interface ExternalIdentityAssessment {
  fixtureId: string;
  pandId: string;
  conclusion: ExternalIdentityConclusion;
  reviewer: string;
  reviewedAt: string;
  evidenceTitles: string[];
  rationale: string;
  correspondences: string[];
  observationHash: string;
  /** Cached bytes cited at review time, keyed by exact file title. */
  evidenceHashes: Record<string, string>;
}

export interface ExternalEvidenceContext {
  fixtureId: string;
  pandId: string;
  observationHash: string;
  evidence: Array<{ title: string; evidenceId: string; sha256: string; sourceSha1: string | null; licenseShortName: string }>;
}

// Exact supported declarations. Additional versions/ports require explicit review.
const reusableLicenses = new Set(['cc0 1.0', 'public domain',
  ...['1.0', '2.0', '2.5', '3.0', '4.0'].flatMap(version => [`cc by ${version}`, `cc by-sa ${version}`])]);

export const normalizeIdentityText = (value: string): string => value
  .normalize('NFKD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/^file:/, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export const externalPhotoLicenseIsReusable = (licenseShortName: string): boolean =>
  reusableLicenses.has(licenseShortName.trim().toLowerCase());

export function scoreExternalPhotoCandidate(candidate: ExternalPhotoCandidate, label: string): { score: number; reasons: string[] } {
  const target = normalizeIdentityText(label);
  const title = normalizeIdentityText(candidate.title);
  const description = normalizeIdentityText(candidate.description);
  let score = 0;
  const reasons: string[] = [];

  if (title === target || title.startsWith(`${target} `)) { score += 100; reasons.push('exact address in file title'); }
  else if (title.includes(target)) { score += 72; reasons.push('address contained in file title'); }
  if (description.includes(target)) { score += 35; reasons.push('address contained in description'); }
  if (/image\/jpe?g|image\/png|image\/webp/i.test(candidate.mime)) { score += 8; reasons.push('browser-viewable photograph'); }
  if (/interieur|interior|tekening|drawing|plattegrond|floor plan|kaart|map|prent|print/.test(`${title} ${description}`)) {
    score -= 70;
    reasons.push('likely interior, drawing, print, or map');
  }
  if (!externalPhotoLicenseIsReusable(candidate.licenseShortName)) {
    score -= 1_000;
    reasons.push('license is not in the reuse allowlist');
  }
  return { score, reasons };
}

export function externalAssessmentIsActionable(
  assessment: ExternalIdentityAssessment | undefined,
  context: ExternalEvidenceContext,
): boolean {
  if (!assessment || !['supports', 'contradicts'].includes(assessment.conclusion)
    || assessment.fixtureId !== context.fixtureId || assessment.pandId !== context.pandId
    || !/^[a-f0-9]{64}$/.test(assessment.observationHash) || assessment.observationHash !== context.observationHash
    || !assessment.reviewer?.trim() || !validReviewTime(assessment.reviewedAt)
    || !assessment.rationale?.trim() || assessment.rationale.trim().length < 24
    || !assessment.evidenceHashes || !Array.isArray(assessment.evidenceTitles) || assessment.evidenceTitles.length < 2
    || !Array.isArray(assessment.correspondences)
    || new Set(assessment.correspondences.map(value => value.trim()).filter(Boolean)).size < 2) return false;
  const cited = assessment.evidenceTitles.map(title => context.evidence.filter(item => item.title === title));
  if (cited.some(matches => matches.length !== 1)) return false;
  const evidence = cited.map(matches => matches[0]);
  return evidence.every(item => /^[a-f0-9]{64}$/.test(item.sha256)
    && item.sha256 === assessment.evidenceHashes[item.title]
    && Boolean(item.sourceSha1?.trim()) && externalPhotoLicenseIsReusable(item.licenseShortName))
    && [evidence.map(item => normalizeIdentityText(item.title)), evidence.map(item => item.evidenceId),
      evidence.map(item => item.sha256), evidence.map(item => item.sourceSha1)]
      .every(values => new Set(values).size === evidence.length);
}

export function externalIdentityDecision(
  assessment: ExternalIdentityAssessment | undefined,
  context: ExternalEvidenceContext,
): ExternalIdentityConclusion {
  return externalAssessmentIsActionable(assessment, context)
    ? assessment!.conclusion
    : 'insufficient';
}
