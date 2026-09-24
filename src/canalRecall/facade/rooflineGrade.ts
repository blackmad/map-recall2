/**
 * Owner grading state for the photo-roofline review desk (roofline plan A6).
 *
 * The grade is bound to `profileSha256`, the hash of the profile's content, not
 * to a filename or a load order. A stored or imported grade whose hash no longer
 * matches the current profile is rejected rather than silently applied, so a
 * profile that changed after it was graded can never inherit an old verdict.
 *
 * This module is the single definition of the grade state, the export envelope
 * and the hash. The review page is plain JavaScript (no bundle is committed, see
 * the plan's "don't edit bundles" rule) and mirrors these rules; the tests here
 * pin the behaviour that page implements and that the data builder computes.
 */
import { canonicalJson, dependencyHash } from './registrationGold.ts';

export type RooflineGradeValue = 1 | 2 | 3 | 4;

/** 1 right · 2 close · 3 wrong · 4 can't tell (roofline plan A6). */
export const ROOFLINE_GRADE_LABELS: Record<RooflineGradeValue, string> = {
  1: 'right',
  2: 'close',
  3: 'wrong',
  4: "can't tell",
};

export const ROOFLINE_GRADE_VALUES: RooflineGradeValue[] = [1, 2, 3, 4];

export type RooflineWrongReason = 'clipped' | 'tree' | 'neighbour' | 'set back' | 'other';

export const ROOFLINE_WRONG_REASONS: RooflineWrongReason[] = ['clipped', 'tree', 'neighbour', 'set back', 'other'];

export interface RooflineProfileView {
  /** Strip filename as produced by the A0 cutter. */
  file: string;
  panoramaId: string;
  capturedAt: string;
  /** Per strip column: coarse sky/building boundary in image pixels, or null. */
  coarsePx: Array<number | null>;
  /** Per strip column: boundary after ±8 px edge snapping, or null. */
  snappedPx: Array<number | null>;
  /** Resampled to 0.10 m: [along M, NAP M | null]. */
  profile: Array<[number, number | null]>;
  /**
   * The final consensus (post bias-alignment), converted back into this
   * view's own pixel rows so the review page can draw it directly on this
   * photo without doing any metre/pixel conversion client-side — "the pixel
   * rows already in the data". Parallel to `coarsePx`/`snappedPx`; null
   * where the consensus itself is null at that column's `along` position.
   * Materialisation-only: derived from `consensus` + this view's own frame,
   * not an independent measurement, so it is never hashed.
   */
  consensusPx?: Array<number | null>;
  /**
   * Parallel to `consensusPx`: for each drawn column, `'own'` when this
   * view's own (gated, pre-alignment) profile resolved it itself, `'filled'`
   * when the drawn value came only from another view (including the
   * single-view carve-out), or `null` when nothing is drawn there at all
   * (`consensusPx` is also null). Without this, a `'filled'` column looks
   * identical to an `'own'` one on this view's own photo — the review page
   * draws `'own'` solid and `'filled'` dashed/faint so a grader is never
   * shown a line this view never actually confirmed. See
   * `consensusProvenancePx` in `stripRoofline.ts`. Materialisation-only.
   */
  consensusProvenancePx?: Array<'own' | 'filled' | null>;
  /**
   * Fraction of this view's DRAWN consensus columns that are `'filled'`
   * rather than `'own'` — see `consensusProvenancePx`. Null when nothing is
   * drawn for this view. Materialisation-only.
   */
  unresolvedFraction?: number | null;
  /**
   * This view's own vertical offset from the wall's reference view, in
   * metres, estimated *before* consensus (see `estimateViewBias` in
   * `stripRoofline.ts`) — positive means this view read higher than the
   * reference. 0 for the reference view itself. Materialisation-only.
   */
  viewBiasM?: number;
  /** Fraction of this view's mask pixels the sky rescue pass relabelled to sky. Materialisation-only. */
  rescuedSkyFraction?: number;
}

export interface RooflineProfile {
  pandId: string;
  address: string;
  wall: { start: [number, number]; end: [number, number] };
  views: RooflineProfileView[];
  consensus: Array<[number, number | null]>;
  /** flat | sloped | shaped, the manifest's rule (peak ≥ 0.5 m above both ends). */
  shape: string;
  /** SHA-256 over the documented content, see `profileContentHash`. */
  profileSha256: string;
  /** Optional G2 fitted gable outline: [along M, NAP M]. */
  gable?: { type: string; points: Array<[number, number]> } | null;
  /**
   * Parallel to `consensus`: true where exactly one non-underexposed view
   * resolved that sample (kept rather than discarded — see A2's consensus
   * rule). Materialisation-only, like `imageUrl`/`fixture` below: not hashed,
   * so a change to this diagnostic alone doesn't invalidate an owner grade.
   */
  consensusSingleView?: boolean[];
  /**
   * Largest |viewBiasM| among this wall's views (0 for a single-view wall).
   * A wall-level flag for "these views disagree about height, not shape" —
   * see the distribution reported by `extract-strip-rooflines.ts`.
   */
  maxViewBiasM?: number;
  /**
   * Median of (consensus `up` − pand's own 3DBAG `b3_h_dak_max`), post
   * bias-alignment, over resolved columns: how far this wall's roofline
   * reads above the airborne-lidar roof max. A large, consistently positive
   * value across many walls is a calibration finding; a lumpy one on a few
   * walls is more likely set-back objects the `above-3dbag-max` gate should
   * already have removed most of. Null when nothing resolved.
   */
  medianOffsetVs3dbagMaxM?: number | null;
  /**
   * Largest per-view `unresolvedFraction` among this wall's views — the
   * worst case of "this view's drawn line is mostly filled from another
   * view, not its own detection". Null when nothing is drawn on any view.
   * See the distribution reported by `extract-strip-rooflines.ts`.
   */
  maxUnresolvedFraction?: number | null;
  /**
   * States which view's absolute NAP `consensus` is expressed in, so nobody
   * mistakes the aligned consensus for a new, invented datum: alignment only
   * ever shifts other views onto one view's own scale.
   */
  alignmentNote?: string;
  /** A one-line, human-readable reason for the wall's grading queue — see `reasonSummary` in `extract-strip-rooflines.ts`. */
  reasonSummary?: string;
  /** Materialisation-only extras, never hashed. */
  imageUrl?: string;
  fixture?: boolean;
}

/** The fields that define a profile's identity. Extra plumbing is not hashed. */
export function profileContent(profile: RooflineProfile) {
  return {
    schema: 'roofline-profile/v1',
    pandId: profile.pandId,
    address: profile.address,
    wall: profile.wall,
    views: profile.views.map(view => ({
      file: view.file,
      panoramaId: view.panoramaId,
      capturedAt: view.capturedAt,
      coarsePx: view.coarsePx,
      snappedPx: view.snappedPx,
      profile: view.profile,
    })),
    consensus: profile.consensus,
    shape: profile.shape,
  };
}

/** Stable content hash; independent of key order and of image URLs. */
export function profileContentHash(profile: RooflineProfile): Promise<string> {
  return dependencyHash(profileContent(profile));
}

export interface RooflineGradeRecord {
  pandId: string;
  profileSha256: string;
  grade: RooflineGradeValue;
  wrongReason: RooflineWrongReason | null;
  note: string;
  gradedAt: string;
}

export interface RooflineGradeExport {
  schemaVersion: 1;
  kind: 'roofline-grades';
  exportedAt: string;
  grades: RooflineGradeRecord[];
}

export const isRooflineGradeValue = (value: unknown): value is RooflineGradeValue =>
  value === 1 || value === 2 || value === 3 || value === 4;

const WRONG_REASON_SET = new Set<string>(ROOFLINE_WRONG_REASONS);

export const isRooflineWrongReason = (value: unknown): value is RooflineWrongReason =>
  typeof value === 'string' && WRONG_REASON_SET.has(value);

export function isRooflineGradeRecord(value: unknown): value is RooflineGradeRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (typeof record.pandId !== 'string' || !record.pandId.trim()) return false;
  if (typeof record.profileSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.profileSha256)) return false;
  if (!isRooflineGradeValue(record.grade)) return false;
  if (record.wrongReason !== null && !isRooflineWrongReason(record.wrongReason)) return false;
  if (typeof record.note !== 'string') return false;
  if (typeof record.gradedAt !== 'string' || !Number.isFinite(Date.parse(record.gradedAt))) return false;
  return true;
}

export function isRooflineGradeExport(value: unknown): value is RooflineGradeExport {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return payload.schemaVersion === 1 && payload.kind === 'roofline-grades'
    && typeof payload.exportedAt === 'string' && Number.isFinite(Date.parse(payload.exportedAt))
    && Array.isArray(payload.grades) && payload.grades.every(isRooflineGradeRecord);
}

/** Parse an exported file; throws a plain message the page can show. */
export function parseRooflineGrades(json: string): RooflineGradeExport {
  const payload = JSON.parse(json) as unknown;
  if (!isRooflineGradeExport(payload)) throw new Error('Not a roofline-grades export (schemaVersion 1).');
  return payload;
}

export function serializeRooflineGrades(payload: RooflineGradeExport): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/** A record only counts for a profile when the profile hash still matches. */
export function gradeMatchesProfile(record: RooflineGradeRecord, profile: Pick<RooflineProfile, 'profileSha256'>): boolean {
  return record.profileSha256 === profile.profileSha256;
}

export interface RooflineGradeRejection {
  pandId: string;
  profileSha256: string;
  reason: 'invalid' | 'unknown-profile' | 'hash-mismatch';
}

export interface RooflineGradeImportResult {
  grades: RooflineGradeRecord[];
  accepted: RooflineGradeRecord[];
  rejected: RooflineGradeRejection[];
}

/**
 * Merge an import onto the current grades. A record is only applied when the
 * current profile for its pand has the same `profileSha256`; otherwise it is
 * reported as a rejection and the current grade is left untouched.
 */
export function mergeRooflineGradeImport(
  current: RooflineGradeRecord[],
  payload: RooflineGradeExport,
  profiles: Array<Pick<RooflineProfile, 'pandId' | 'profileSha256'>>,
): RooflineGradeImportResult {
  const byPand = new Map(profiles.map(profile => [profile.pandId, profile]));
  const merged = new Map<string, RooflineGradeRecord>();
  for (const record of current) if (isRooflineGradeRecord(record)) merged.set(record.pandId, record);
  const accepted: RooflineGradeRecord[] = [];
  const rejected: RooflineGradeRejection[] = [];
  for (const candidate of payload.grades as unknown[]) {
    if (!isRooflineGradeRecord(candidate)) {
      const loose = (candidate ?? {}) as { pandId?: unknown; profileSha256?: unknown };
      rejected.push({ pandId: String(loose.pandId ?? ''), profileSha256: String(loose.profileSha256 ?? ''), reason: 'invalid' });
      continue;
    }
    const profile = byPand.get(candidate.pandId);
    if (!profile) { rejected.push({ pandId: candidate.pandId, profileSha256: candidate.profileSha256, reason: 'unknown-profile' }); continue; }
    if (candidate.profileSha256 !== profile.profileSha256) { rejected.push({ pandId: candidate.pandId, profileSha256: candidate.profileSha256, reason: 'hash-mismatch' }); continue; }
    merged.set(candidate.pandId, candidate);
    accepted.push(candidate);
  }
  return { grades: [...merged.values()], accepted, rejected };
}

export interface RooflineReviewProgress {
  graded: number;
  total: number;
  stale: number;
  byValue: Record<RooflineGradeValue, number>;
}

/** Counts for the header; grades whose hash no longer matches are `stale`, not graded. */
export function rooflineReviewProgress(
  profiles: Array<Pick<RooflineProfile, 'pandId' | 'profileSha256'>>,
  grades: RooflineGradeRecord[],
): RooflineReviewProgress {
  const byPand = new Map(profiles.map(profile => [profile.pandId, profile]));
  const byValue: Record<RooflineGradeValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let graded = 0;
  let stale = 0;
  for (const record of grades) {
    const profile = byPand.get(record.pandId);
    if (!profile) continue;
    if (!isRooflineGradeRecord(record) || record.profileSha256 !== profile.profileSha256) { stale += 1; continue; }
    graded += 1;
    byValue[record.grade] += 1;
  }
  return { graded, total: profiles.length, stale, byValue };
}

/** Canonical JSON is re-exported so the builder and page share one definition. */
export { canonicalJson };
