export interface WorkbenchRoofSource { sha256?: string; width?: number; height?: number; captureDate?: string; url?: string }
export interface WorkbenchRoofCase {
  caseId?: string; buildingId?: string; address?: string; status?: string;
  owner?: { id?: string; geometry?: { building?: { surfaces?: Array<{ type?: string; semantics?: { type?: string } }> } } };
  source?: { full?: WorkbenchRoofSource; ground?: WorkbenchRoofSource };
  roofReview?: { status?: string; uncertainty?: string };
  shapeFeatures?: { full?: { features?: Array<{ id?: string; kind?: string; disposition?: string }> } };
}
export type RoofPriority = 'critical' | 'high' | 'medium' | 'low';
export interface RoofSummary {
  caseId: string; buildingId: string | null; address: string | null; status: 'blocked' | 'unreviewed' | 'reviewed-with-limits' | 'reviewed';
  priority: { level: RoofPriority; rank: number }; reasons: string[];
  source: { full: 'available' | 'invalid-or-missing'; ground: 'available' | 'invalid-or-missing' };
  roof3D: { status: 'preserved-source-surfaces' | 'absent-or-unreported'; surfaceCount: number };
  frontalSilhouette: { status: 'agent-reviewed-source-outline' | 'not-reviewed' };
  dormers: { status: 'agent-reviewed-present' | 'unreviewed-candidate' | 'not-established'; count: number };
  occlusion: { status: 'limited' | 'not-recorded'; detail: string | null };
  checklist: string[];
}

const validSource = (source?: WorkbenchRoofSource) => Boolean(source && /^[a-f0-9]{64}$/.test(source.sha256 ?? '') && Number.isInteger(source.width) && source.width! > 0 && Number.isInteger(source.height) && source.height! > 0 && typeof source.url === 'string' && source.url.length > 0);
const roofLike = (feature: { id?: string }) => /roof|dormer|gable|turret/i.test(feature.id ?? '');

export function summarizeWorkbenchRoof(previewCase: WorkbenchRoofCase): RoofSummary {
  const caseId = typeof previewCase.caseId === 'string' && previewCase.caseId ? previewCase.caseId : 'unknown-case';
  const surfaces = previewCase.owner?.geometry?.building?.surfaces ?? [];
  const roofSurfaces = surfaces.filter(surface => (surface.type ?? surface.semantics?.type)?.toLowerCase().includes('roof'));
  const features = Array.isArray(previewCase.shapeFeatures?.full?.features) ? previewCase.shapeFeatures!.full!.features! : [];
  const roofFeatures = features.filter(roofLike);
  const reviewedFeatures = roofFeatures.filter(feature => feature.disposition === 'agent-inspected');
  const machineFeatures = roofFeatures.filter(feature => feature.disposition !== 'agent-inspected');
  const outlineReviewed = previewCase.roofReview?.status === 'source-outline-reviewed';
  const uncertainty = typeof previewCase.roofReview?.uncertainty === 'string' && previewCase.roofReview.uncertainty.trim() ? previewCase.roofReview.uncertainty.trim() : null;
  const fullAvailable = validSource(previewCase.source?.full), groundAvailable = validSource(previewCase.source?.ground);
  const identityBlocked = /identity unresolved/i.test(previewCase.status ?? '');
  const reasons: string[] = [];
  let level: RoofPriority, rank: number, status: RoofSummary['status'];
  if (identityBlocked || !fullAvailable || roofSurfaces.length === 0) {
    level = 'critical'; rank = identityBlocked ? 0 : !fullAvailable ? 5 : 10; status = 'blocked';
    if (identityBlocked) reasons.push('Source identity is unresolved, so roof review cannot be bound to this building.');
    if (!fullAvailable) reasons.push('Full-facade source is missing or lacks a valid hash, dimensions, and URL.');
    if (roofSurfaces.length === 0) reasons.push('No semantic 3D roof surface is present in this preview case.');
  } else if (!outlineReviewed) {
    level = 'high'; rank = 20; status = 'unreviewed'; reasons.push('Frontal roof silhouette has not been source-reviewed.');
  } else if (uncertainty) {
    level = 'medium'; rank = 30; status = 'reviewed-with-limits'; reasons.push('The reviewed source outline records occlusion or cropped geometry.');
  } else {
    level = 'low'; rank = 40; status = 'reviewed'; reasons.push('A source-pixel frontal outline is recorded; metric placement remains outside this review.');
  }
  if (machineFeatures.length) reasons.push(`${machineFeatures.length} roof-like machine feature${machineFeatures.length === 1 ? '' : 's'} remain unreviewed.`);
  const dormerReviewed = reviewedFeatures.filter(feature => feature.kind === 'window' && /dormer/i.test(feature.id ?? '')).length;
  const dormerMachine = machineFeatures.filter(feature => feature.kind === 'window' && /dormer/i.test(feature.id ?? '')).length;
  return {
    caseId, buildingId: previewCase.buildingId ?? previewCase.owner?.id ?? null, address: previewCase.address ?? null, status, priority: { level, rank }, reasons,
    source: { full: fullAvailable ? 'available' : 'invalid-or-missing', ground: groundAvailable ? 'available' : 'invalid-or-missing' },
    roof3D: { status: roofSurfaces.length ? 'preserved-source-surfaces' : 'absent-or-unreported', surfaceCount: roofSurfaces.length },
    frontalSilhouette: { status: outlineReviewed ? 'agent-reviewed-source-outline' : 'not-reviewed' },
    dormers: { status: dormerReviewed ? 'agent-reviewed-present' : dormerMachine ? 'unreviewed-candidate' : 'not-established', count: dormerReviewed || dormerMachine },
    occlusion: { status: uncertainty ? 'limited' : 'not-recorded', detail: uncertainty },
    checklist: [
      'Confirm the full source hash, date, crop bounds, and target building.',
      'Compare preserved 3D roof planes separately from the photographed frontal silhouette.',
      'Trace only visible eaves, gables, parapets, and dormer outlines; record cropped or occluded portions as unknown.',
      'Mark each dormer or roof opening as present, absent, or unscorable without inferring hidden geometry.',
      'Check the source-shape preview at gameplay scale; do not claim metric registration or release acceptance.',
    ],
  };
}

export function buildRoofReviewQueue(cases: WorkbenchRoofCase[]): RoofSummary[] {
  return cases.map(summarizeWorkbenchRoof).sort((a, b) => a.priority.rank - b.priority.rank || a.caseId.localeCompare(b.caseId));
}
