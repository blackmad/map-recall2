/** Geometry suggests a review order; only recorded visual evidence approves a faster treatment. */
export type FidelityReview = {
  treatment: 'standard' | 'landmark'; reviewedOn: string; sourceUrls: string[];
  referenceImage: string; reason: string;
  checks: { ordinarySilhouette: boolean; repetitiveFacade: boolean; noDefiningDetailsLost: boolean; openSpacesUnderstood: boolean };
};
export type TriageInput = { heightMetres: number; holes: number; outlines: number;
  vertices: number; raisedParts: boolean; roofShape: string; poiNames: string[] };
export function triageDominantBuilding(b: TriageInput, review?: FidelityReview) {
  const blockers: string[] = [];
  if (b.poiNames.length) blockers.push(`Mapped POI: ${b.poiNames.join(', ')}`);
  if (b.heightMetres >= 60) blockers.push('Tall skyline building');
  if (b.holes) blockers.push('Courtyard/open-space geometry');
  if (b.raisedParts) blockers.push('Raised parts or underpass risk');
  if (b.outlines > 1 || b.vertices > 16) blockers.push('Complex footprint');
  if (b.roofShape && !['flat', 'gabled', 'hipped'].includes(b.roofShape)) blockers.push(`Unusual mapped roof: ${b.roofShape}`);
  if (review) {
    const documented = !!review.reviewedOn && !!review.referenceImage && !!review.reason
      && review.sourceUrls.length > 0 && review.sourceUrls.every(url => url.startsWith('https://'));
    if (!documented) throw Error('Fidelity review requires a dated reason, reference image and source URLs');
    if (review.treatment === 'standard') {
      if (!Object.values(review.checks).every(Boolean)) throw Error('Standard treatment requires all visual recognition/open-space checks');
      // A quicker treatment cannot silently demote a mapped POI or uncertain open structure.
      if (b.poiNames.length || b.raisedParts) throw Error('Mapped POIs and raised structures require landmark review');
    }
    return { treatment: review.treatment, workflow: review.treatment === 'standard' ? 'standard-building' : 'full-landmark',
      state: 'reviewed', reasons: [review.reason], review };
  }
  return { treatment: 'unreviewed', workflow: blockers.length ? 'recognition-review' : 'standard-eligibility-review',
    state: 'suggested', reasons: blockers.length ? blockers : ['Simple mapped massing; facade and recognition still need visual review'] };
}
