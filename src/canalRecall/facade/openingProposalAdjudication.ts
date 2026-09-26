/**
 * A review-only alternative to D1's union. Nothing calls this from the existing
 * merge or publisher; callers must explicitly choose evidence-aware mode.
 */
import {mergeOpenings, type MergedBox, type OpeningKind, type WallRect} from './openingMerge.ts';

export type EvidenceType = 'source-observed' | 'model-proposal' | 'procedural-inference';
export interface OpeningCandidate extends WallRect {
  id: string;
  kind: OpeningKind;
  /** A score is retained for review, never compared across model lanes. */
  score?: number;
  evidence: EvidenceType;
  /** SHA of the crop on which this candidate was made, when recorded. */
  cropSha256?: string;
  observationId?: string;
}
export interface OpeningLane { name: string; candidates: readonly OpeningCandidate[] }
export interface OpeningWall { widthM: number; heightM: number; cropSha256?: string }
export interface SourceCandidate extends OpeningCandidate { lane: string }
export interface OpeningProposal {
  id: string;
  kind: 'window' | 'door';
  box: WallRect;
  evidence: EvidenceType;
  sources: SourceCandidate[];
  status: 'proposed' | 'needs-review';
  reasons: string[];
}
export interface OpeningRejection { source: SourceCandidate; reason: string }
export interface OpeningConflict { kind: 'door-window'; doorId: string; windowId: string; iou: number; windowOverlap: number }
export interface Adjudication {
  mode: 'legacy-union' | 'evidence-aware';
  /** Exact D1 output only in the default mode. */
  legacyUnion?: MergedBox[];
  proposals: OpeningProposal[];
  rejected: OpeningRejection[];
  conflicts: OpeningConflict[];
}

const shaPattern = /^[a-f0-9]{64}$/;
const numericBox = (box: WallRect) => [box.along, box.up, box.width, box.height].every(Number.isFinite) &&
  box.width > 0 && box.height > 0;
const area = (box: WallRect) => box.width * box.height;
const intersection = (a: WallRect, b: WallRect) => {
  const width = Math.min(a.along + a.width, b.along + b.width) - Math.max(a.along, b.along);
  const height = Math.min(a.up + a.height, b.up + b.height) - Math.max(a.up, b.up);
  return Math.max(0, width) * Math.max(0, height);
};
const iou = (a: WallRect, b: WallRect) => {
  const shared = intersection(a, b);
  return shared / (area(a) + area(b) - shared);
};
const evidenceRank: Record<EvidenceType, number> = {
  'source-observed': 0, 'model-proposal': 1, 'procedural-inference': 2,
};
const sorted = (a: SourceCandidate, b: SourceCandidate) =>
  evidenceRank[a.evidence] - evidenceRank[b.evidence] || a.lane.localeCompare(b.lane) || a.id.localeCompare(b.id);

function rejectReason(candidate: SourceCandidate, wall: OpeningWall): string | null {
  if (!candidate.id || !candidate.lane) return 'missing-identity';
  if (!['window', 'door'].includes(candidate.kind)) return 'non-opening-class';
  if (!['source-observed', 'model-proposal', 'procedural-inference'].includes(candidate.evidence)) return 'unknown-evidence-type';
  if (!numericBox(candidate)) return 'invalid-box';
  if (candidate.along < 0 || candidate.up < 0 ||
      candidate.along + candidate.width > wall.widthM ||
      candidate.up + candidate.height > wall.heightM) return 'outside-wall';
  if (candidate.score !== undefined && (!Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 1))
    return 'invalid-score';
  if (candidate.cropSha256 !== undefined && !shaPattern.test(candidate.cropSha256)) return 'invalid-crop-sha';
  if (wall.cropSha256 && candidate.cropSha256 && wall.cropSha256 !== candidate.cropSha256) return 'different-source-crop';
  if (candidate.evidence === 'source-observed' && (!candidate.cropSha256 || !candidate.observationId))
    return 'unbound-observation';
  return null;
}

/**
 * Default mode delegates byte-for-byte geometry decisions to D1. Opt-in mode
 * validates candidates, keeps source evidence, and exposes unresolved conflicts.
 */
export function adjudicateOpeningProposals(
  wall: OpeningWall, lanes: readonly OpeningLane[], options: {mode?: 'legacy-union' | 'evidence-aware'} = {},
): Adjudication {
  if (!Number.isFinite(wall.widthM) || !Number.isFinite(wall.heightM) || wall.widthM <= 0 || wall.heightM <= 0)
    throw Error('Invalid wall dimensions');
  if (wall.cropSha256 !== undefined && !shaPattern.test(wall.cropSha256)) throw Error('Invalid wall crop SHA');
  if ((options.mode ?? 'legacy-union') === 'legacy-union') {
    const legacyUnion = mergeOpenings(lanes.map(lane => ({name: lane.name, boxes: lane.candidates.map(candidate => ({
      along: candidate.along, up: candidate.up, width: candidate.width, height: candidate.height,
      kind: candidate.kind, score: candidate.score,
    }))})));
    return {mode: 'legacy-union', legacyUnion, proposals: [], rejected: [], conflicts: []};
  }

  const rejected: OpeningRejection[] = [], valid: SourceCandidate[] = [], identities = new Set<string>();
  for (const lane of lanes) for (const candidate of lane.candidates) {
    const source = {...candidate, lane: lane.name};
    const identity = `${lane.name}\0${candidate.id}`;
    const reason = identities.has(identity) ? 'duplicate-source-id' : rejectReason(source, wall);
    identities.add(identity);
    if (reason) rejected.push({source, reason}); else valid.push(source);
  }

  // Connected components of matching same-kind boxes. Scores are deliberately
  // absent from the representative selection: model confidences are uncalibrated.
  const components: SourceCandidate[][] = [];
  for (const candidate of [...valid].sort(sorted)) {
    const matches = components.filter(component => component.some(member => member.kind === candidate.kind && iou(member, candidate) >= .5));
    if (!matches.length) components.push([candidate]);
    else {
      matches[0].push(candidate);
      for (const other of matches.slice(1)) {
        matches[0].push(...other);
        components.splice(components.indexOf(other), 1);
      }
    }
  }
  const proposals: OpeningProposal[] = components.map((component): OpeningProposal => {
    const sources = component.sort(sorted);
    const representative = sources[0];
    return {id: `${representative.lane}:${representative.id}`, kind: representative.kind as 'window' | 'door',
      box: {along: representative.along, up: representative.up, width: representative.width, height: representative.height},
      evidence: representative.evidence, sources, status: 'proposed',
      reasons: !wall.cropSha256 ? ['wall-crop-unverified'] :
        sources.some(source => !source.cropSha256) ? ['source-crop-unverified'] : []};
  }).sort((a, b) => a.kind.localeCompare(b.kind) || a.box.along - b.box.along || a.box.up - b.box.up || a.id.localeCompare(b.id));

  const conflicts: OpeningConflict[] = [];
  for (const door of proposals.filter(proposal => proposal.kind === 'door')) {
    for (const window of proposals.filter(proposal => proposal.kind === 'window')) {
      const shared = intersection(door.box, window.box);
      const overlap = shared / area(window.box), combined = iou(door.box, window.box);
      if (combined < .3 && overlap < .6) continue;
      door.status = window.status = 'needs-review';
      if (!door.reasons.includes('door-window-conflict')) door.reasons.push('door-window-conflict');
      if (!window.reasons.includes('door-window-conflict')) window.reasons.push('door-window-conflict');
      conflicts.push({kind: 'door-window', doorId: door.id, windowId: window.id, iou: combined, windowOverlap: overlap});
    }
  }
  return {mode: 'evidence-aware', proposals, rejected, conflicts};
}
