import type { BagAddress } from './bagIdentity.ts';
import { buildElevations, type Elevation } from './elevations.ts';
import type { PanoramaView, ProjectedPoint } from './sources.ts';

export type RegistrationAnchorKind = 'wall-left' | 'wall-right' | 'ground' | 'eaves' | 'roofline';

export interface RegistrationAnchor {
  anchorId: string;
  kind: RegistrationAnchorKind;
  pixel: { x: number; y: number };
  note: string;
  /** Pixel-only marks remain useful for identity review, but are not metric anchors. */
  world?: ProjectedPoint & { z: number; datum: string };
  provenance?: string;
  uncertaintyM?: number;
}

export interface RegistrationReviewPass {
  passId: string;
  reviewer: string;
  reviewedAt: string;
  identityVerdict: 'accepted' | 'rejected' | 'uncertain';
  elevationVerdict: 'accepted' | 'rejected' | 'uncertain';
  note: string;
  /** Missing on historical reviews: those reviews cannot accept a current observation. */
  observationHash?: string;
}

export interface RegistrationGoldFixture {
  fixtureId: string;
  status: 'candidate' | 'anchored' | 'accepted' | 'rejected' | 'stale';
  pandId: string;
  label: string;
  rationale: string;
  intendedCoverage: string[];
  addresses: BagAddress[];
  footprintRd: ProjectedPoint[];
  elevations: Elevation[];
  selectedElevationId: string | null;
  elevationSelectionBasis: string | null;
  panorama: (PanoramaView & { mission: string | null; localImageUrl: string | null; cameraRd: ProjectedPoint }) | null;
  sourceQuad: Array<{ x: number; y: number }> | null;
  rectifiedPreviewUrl: string | null;
  anchors: RegistrationAnchor[];
  reviewPasses: RegistrationReviewPass[];
  sourceVersion?: { sha256: string; width: number; height: number; schema: string };
  identityVersion?: string;
  /** An unresolved model is allowed for identity review, never metric certification. */
  cameraModelVersion?: string | null;
}

/** Deterministic JSON for dependency hashes; object insertion order is immaterial. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

export async function dependencyHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export const validReviewTime = (value: string): boolean => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));

/** Hash evidence, not approval, output URLs or detector versions. */
export function registrationObservationHash(fixture: RegistrationGoldFixture): Promise<string> {
  const { fixtureId, pandId, label, addresses, identityVersion, footprintRd, elevations,
    selectedElevationId, panorama, sourceVersion, cameraModelVersion, sourceQuad, anchors } = fixture;
  return dependencyHash({ schema: 'facade-observation/v2', fixtureId, pandId, label, addresses,
    identityVersion, footprintRd, elevations, selectedElevationId,
    panorama: panorama ? { ...panorama, localImageUrl: undefined } : null,
    sourceVersion, cameraModelVersion, sourceQuad, anchors });
}

/** Latest explicit decision wins, including rejection, uncertainty and stale decisions. */
export async function registrationFixtureIsReviewed(fixture: RegistrationGoldFixture): Promise<boolean> {
  const source = fixture.sourceVersion;
  const panorama = fixture.panorama;
  if (fixture.status === 'rejected' || fixture.status === 'stale'
    || !/^\d{16}$/.test(fixture.pandId) || !fixture.identityVersion?.trim()
    || !fixture.selectedElevationId
    || fixture.elevations?.filter(wall => wall.elevationId === fixture.selectedElevationId).length !== 1
    || !panorama?.panoramaId?.trim() || !panorama.imageUrl?.trim() || !validReviewTime(panorama.capturedAt)
    || !source || !/^[a-f0-9]{64}$/.test(source.sha256) || !source.schema?.trim()
    || !Number.isInteger(source.width) || source.width <= 0 || !Number.isInteger(source.height) || source.height <= 0
    || !fixture.reviewPasses?.length) return false;
  const wall = fixture.elevations.find(item => item.elevationId === fixture.selectedElevationId)!;
  const rebuilt = buildElevations(fixture.footprintRd, { pandId: fixture.pandId })
    .find(item => item.elevationId === fixture.selectedElevationId);
  if (!rebuilt || canonicalJson(wall) !== canonicalJson(rebuilt)) return false;
  // Do not discard malformed later entries and accidentally resurrect an acceptance.
  if (fixture.reviewPasses.some(pass => !pass.reviewer?.trim() || !pass.passId?.trim() || !validReviewTime(pass.reviewedAt))) return false;
  const latestTime = Math.max(...fixture.reviewPasses.map(pass => Date.parse(pass.reviewedAt)));
  const latest = fixture.reviewPasses.filter(pass => Date.parse(pass.reviewedAt) === latestTime);
  const hash = await registrationObservationHash(fixture);
  // Contradictory equal-time imports cannot be resolved by array ordering.
  return latest.every(pass => pass.identityVerdict === 'accepted' && pass.elevationVerdict === 'accepted'
    && pass.observationHash === hash);
}

/** Merge decisions onto current source data; browser drafts cannot replace source geometry. */
export function mergeRegistrationDraft(current: RegistrationGoldFixture, draft: RegistrationGoldFixture): RegistrationGoldFixture {
  if (draft.fixtureId !== current.fixtureId || draft.pandId !== current.pandId) return current;
  const metadata = (fixture: RegistrationGoldFixture) => fixture.panorama ? { ...fixture.panorama, localImageUrl: undefined } : null;
  const sameSource = canonicalJson({ identity: current.identityVersion, source: current.sourceVersion, panorama: metadata(current),
    footprint: current.footprintRd, walls: current.elevations, camera: current.cameraModelVersion }) === canonicalJson({
    identity: draft.identityVersion, source: draft.sourceVersion, panorama: metadata(draft),
    footprint: draft.footprintRd, walls: draft.elevations, camera: draft.cameraModelVersion });
  const history = [...current.reviewPasses, ...(draft.reviewPasses ?? [])];
  return { ...current, reviewPasses: history.filter((pass, index) => history.findIndex(other => canonicalJson(other) === canonicalJson(pass)) === index),
    ...(sameSource ? { selectedElevationId: draft.selectedElevationId, anchors: draft.anchors,
      status: draft.status, elevationSelectionBasis: draft.elevationSelectionBasis } : { status: 'stale' as const }) };
}

/** Compatibility alias for checkpoint consumers created before solo review was adopted. */
export const registrationFixtureIsAgreed = registrationFixtureIsReviewed;
