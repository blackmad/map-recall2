import type { BagAddress } from './bagIdentity.ts';
import type { Elevation } from './elevations.ts';
import type { PanoramaView, ProjectedPoint } from './sources.ts';

export type RegistrationAnchorKind = 'wall-left' | 'wall-right' | 'ground' | 'eaves' | 'roofline';

export interface RegistrationAnchor {
  anchorId: string;
  kind: RegistrationAnchorKind;
  pixel: { x: number; y: number };
  note: string;
}

export interface RegistrationReviewPass {
  passId: 'pass-1' | 'pass-2';
  reviewer: string;
  reviewedAt: string;
  identityVerdict: 'accepted' | 'rejected' | 'uncertain';
  elevationVerdict: 'accepted' | 'rejected' | 'uncertain';
  note: string;
}

export interface RegistrationGoldFixture {
  fixtureId: string;
  status: 'candidate' | 'anchored' | 'accepted' | 'rejected';
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
}

export const registrationFixtureIsReviewed = (fixture: RegistrationGoldFixture): boolean => fixture.selectedElevationId !== null
  && fixture.reviewPasses.some(pass => pass.identityVerdict === 'accepted' && pass.elevationVerdict === 'accepted');

/** Compatibility alias for checkpoint consumers created before solo review was adopted. */
export const registrationFixtureIsAgreed = registrationFixtureIsReviewed;
