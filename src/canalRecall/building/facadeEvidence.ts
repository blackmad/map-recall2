export interface FacadeSourceItem {
  buildingId: string;
  bagId?: string;
}

export interface FacadeCropEvidence {
  buildingId: string;
  panoId: string | null;
  observedAt: string | null;
  image: string;
}

export interface FacadeViewLabel {
  buildingId: string;
  quality: 'full' | 'partial' | 'unusable' | 'unreviewed';
  selectedPanoId: string | null;
  selectedImage?: string | null;
  reviewedAt?: string;
}

export interface ReviewedFacadeInput extends FacadeCropEvidence {
  bagId: string | null;
  viewQuality: 'full' | 'partial';
  viewReviewedAt: string | null;
}

export interface FacadeEvidenceSelection {
  inputs: ReviewedFacadeInput[];
  rejected: Array<{ buildingId: string; reason: string }>;
}

/** Join human view choices back to the exact cached crop and BAG identity. */
export function selectReviewedFacadeInputs(
  sourceItems: readonly FacadeSourceItem[],
  crops: readonly FacadeCropEvidence[],
  labels: readonly FacadeViewLabel[],
): FacadeEvidenceSelection {
  const sourceByBuilding = new Map(sourceItems.map((item) => [item.buildingId, item]));
  const cropByIdentity = new Map(crops.map((crop) => [`${crop.buildingId}|${crop.panoId}`, crop]));
  const inputs: ReviewedFacadeInput[] = [];
  const rejected: Array<{ buildingId: string; reason: string }> = [];
  const seen = new Set<string>();
  for (const label of labels) {
    if (seen.has(label.buildingId)) {
      rejected.push({ buildingId: label.buildingId, reason: 'duplicate-human-view-label' });
      continue;
    }
    seen.add(label.buildingId);
    if (label.quality !== 'full' && label.quality !== 'partial' && label.quality !== 'unusable') {
      rejected.push({ buildingId: label.buildingId, reason: 'invalid-or-unreviewed-quality' });
      continue;
    }
    if (label.quality === 'unusable') {
      rejected.push({ buildingId: label.buildingId, reason: 'human-marked-no-usable-view' });
      continue;
    }
    if (!label.selectedPanoId) {
      rejected.push({ buildingId: label.buildingId, reason: 'usable-label-has-no-selected-panorama' });
      continue;
    }
    const source = sourceByBuilding.get(label.buildingId);
    if (!source) {
      rejected.push({ buildingId: label.buildingId, reason: 'building-not-in-source-manifest' });
      continue;
    }
    const crop = cropByIdentity.get(`${label.buildingId}|${label.selectedPanoId}`);
    if (!crop) {
      rejected.push({ buildingId: label.buildingId, reason: 'selected-panorama-not-in-crop-manifest' });
      continue;
    }
    if (label.selectedImage && label.selectedImage !== crop.image) {
      rejected.push({ buildingId: label.buildingId, reason: 'selected-image-does-not-match-panorama' });
      continue;
    }
    inputs.push({
      ...crop,
      bagId: source.bagId || null,
      viewQuality: label.quality,
      viewReviewedAt: label.reviewedAt || null,
    });
  }
  return { inputs, rejected };
}
