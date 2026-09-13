/**
 * Registration preparation deliberately stops before image interpretation.
 * A crop plane is a measured correspondence supplied by the source manifest;
 * this module only turns it into the pixel-edge -> wall transform used by the
 * extractor and refuses to certify incomplete evidence.
 */
export type ImageTier = 'full' | 'ground';
export type CropMarginsPx = { left: number; top: number; right: number; bottom: number };
export type CropPlane = {
  /** Pixel-edge rectangle in the actual decoded crop. */
  pixelEdges: [number, number, number, number];
  /** Signed wall-axis values at the left and right crop edges, in metres. */
  wallAlongM: [number, number];
  /** NAP heights at the upper and lower crop edges. */
  napAtTopBottomM: [number, number];
  /** NAP height represented by wall-height zero. */
  surfaceBaseNapM: number;
};
export type AlignmentEvidence = {
  wallIdentity: 'verified' | 'ambiguous' | 'failed';
  boundaryEvidence: boolean;
  rooflineEvidence: boolean;
  cameraHeightResolved: boolean;
  orientationVerified?: boolean;
  uncertaintyM: number;
};
export type RegistrationInput = {
  tier: ImageTier;
  cropSha256: string;
  actualDimensions: { width: number; height: number };
  declaredDimensions: { width: number; height: number };
  cropMarginsPx: CropMarginsPx;
  surfaceIndex: number;
  wallDirection: [number, number];
  plane: CropPlane;
  alignment: AlignmentEvidence;
};
export type PreparedRegistration = {
  status: 'registered' | 'ambiguous' | 'failed';
  uncertaintyM: number;
  imageToWall: number[];
  surfaceIndex: number;
  wallDirection: [number, number];
  sourceDatum: 'NAP';
  canonicalDatum: 'surface-base';
  pixelConvention: 'pixel-edge';
  cropMarginsPx: CropMarginsPx;
  alignment: AlignmentEvidence;
  abstention?: string;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const sha = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const matrix = (plane: CropPlane): number[] => {
  const [left, top, right, bottom] = plane.pixelEdges;
  const [alongLeft, alongRight] = plane.wallAlongM;
  const [napTop, napBottom] = plane.napAtTopBottomM;
  const sx = (alongRight - alongLeft) / (right - left);
  const sy = (napBottom - napTop) / (bottom - top);
  // The transform returns [signed wall-along metres, NAP - surfaceBaseNapM].
  return [sx, 0, alongLeft - sx * left, 0, sy, napTop - plane.surfaceBaseNapM - sy * top, 0, 0, 1];
};
function invalid(input: RegistrationInput, reason: string): PreparedRegistration {
  const alignment = input?.alignment && typeof input.alignment === 'object' ? input.alignment : { wallIdentity: 'ambiguous', boundaryEvidence: false, rooflineEvidence: false, cameraHeightResolved: false, uncertaintyM: NaN } as AlignmentEvidence;
  const margins = input?.cropMarginsPx && typeof input.cropMarginsPx === 'object' ? input.cropMarginsPx : { left: NaN, top: NaN, right: NaN, bottom: NaN };
  const direction = Array.isArray(input?.wallDirection) ? input.wallDirection as [number, number] : [NaN, NaN] as [number, number];
  return { status: alignment.wallIdentity === 'failed' ? 'failed' : 'ambiguous', uncertaintyM: alignment.uncertaintyM,
    imageToWall: [], surfaceIndex: input?.surfaceIndex, wallDirection: direction, sourceDatum: 'NAP', canonicalDatum: 'surface-base',
    pixelConvention: 'pixel-edge', cropMarginsPx: margins, alignment, abstention: reason };
}

/** Prepare one tier only. Callers must invoke it separately for full and ground. */
export function prepareRegistration(input: RegistrationInput): PreparedRegistration {
  if (!input || typeof input !== 'object' || !input.actualDimensions || !input.declaredDimensions || !input.cropMarginsPx || !input.plane || !input.alignment) return invalid(input, 'registration-input-incomplete');
  const { actualDimensions: actual, declaredDimensions: declared, cropMarginsPx: margins, plane, alignment } = input;
  if (!sha(input.cropSha256)) return invalid(input, 'invalid-crop-hash');
  if (![actual.width, actual.height, declared.width, declared.height, input.surfaceIndex, ...input.wallDirection].every(finite)
    || actual.width <= 0 || actual.height <= 0 || declared.width !== actual.width || declared.height !== actual.height || !Number.isInteger(input.surfaceIndex)) return invalid(input, 'image-dimensions-mismatch');
  if (![margins.left, margins.top, margins.right, margins.bottom].every(finite) || Math.min(margins.left, margins.top, margins.right, margins.bottom) < 0) return invalid(input, 'invalid-crop-margins');
  const [left, top, right, bottom] = plane.pixelEdges;
  if (![left, top, right, bottom, ...plane.wallAlongM, ...plane.napAtTopBottomM, plane.surfaceBaseNapM].every(finite)
    || left < 0 || top < 0 || right > actual.width || bottom > actual.height || right <= left || bottom <= top) return invalid(input, 'invalid-crop-plane');
  const directionLength = Math.hypot(...input.wallDirection);
  if (directionLength < .999 || directionLength > 1.001 || Math.abs(plane.wallAlongM[1] - plane.wallAlongM[0]) < .02) return invalid(input, 'signed-wall-direction-invalid');
  const imageToWall = matrix(plane);
  if (!imageToWall.every(finite)) return invalid(input, 'non-finite-transform');
  const candidate = { status: 'ambiguous' as const, uncertaintyM: alignment.uncertaintyM, imageToWall, surfaceIndex: input.surfaceIndex,
    wallDirection: input.wallDirection, sourceDatum: 'NAP' as const, canonicalDatum: 'surface-base' as const, pixelConvention: 'pixel-edge' as const, cropMarginsPx: margins, alignment };
  // Retain the derivation for review, but never promote it to rendering until
  // all alignment evidence is present and the uncertainty is bounded.
  if (!finite(alignment.uncertaintyM) || alignment.uncertaintyM < 0 || alignment.uncertaintyM > .15) return { ...candidate, abstention: 'registration-uncertainty' };
  if (alignment.wallIdentity !== 'verified') return { ...candidate, abstention: 'wall-identity-unverified' };
  if (!alignment.boundaryEvidence || !alignment.rooflineEvidence) return { ...candidate, abstention: 'alignment-evidence-incomplete' };
  if (!alignment.cameraHeightResolved) return { ...candidate, abstention: 'camera-height-unresolved' };
  if (alignment.orientationVerified !== true) return { ...candidate, abstention: 'wall-orientation-unverified' };
  return { status: 'registered', uncertaintyM: alignment.uncertaintyM, imageToWall, surfaceIndex: input.surfaceIndex,
    wallDirection: input.wallDirection, sourceDatum: 'NAP', canonicalDatum: 'surface-base', pixelConvention: 'pixel-edge', cropMarginsPx: margins, alignment };
}

export type GroundContact = {
  kind: 'pavement-base';
  tier: ImageTier;
  registration: PreparedRegistration;
  gapM: number;
  sourceSha256: string;
  captureDate: string;
  /** Door thresholds are observations, never a substitute for pavement contact. */
  thresholdHeightM?: number;
  baseCorrectionM?: number;
  correctionEvidence?: { sourceSha256: string; captureDate: string; reason: string };
};
export type ContactVerdict = { accepted: boolean; abstention?: string };
export function validateGroundContact(contact: GroundContact): ContactVerdict {
  if (contact.kind !== 'pavement-base' || contact.tier !== 'ground') return { accepted: false, abstention: 'pavement-base-ground-crop-required' };
  if (contact.registration.status !== 'registered' || contact.registration.uncertaintyM > .15) return { accepted: false, abstention: 'ground-registration-unavailable' };
  if (!sha(contact.sourceSha256) || !/^\d{4}-\d\d-\d\d/.test(contact.captureDate) || !finite(contact.gapM) || contact.gapM < 0) return { accepted: false, abstention: 'invalid-contact-measurement' };
  if (contact.gapM <= .05) return { accepted: true };
  const correction = contact.correctionEvidence;
  if (finite(contact.baseCorrectionM) && correction && correction.sourceSha256 === contact.sourceSha256
    && correction.captureDate === contact.captureDate && correction.reason.trim()) return { accepted: true };
  return { accepted: false, abstention: 'unexplained-pavement-base-gap' };
}
