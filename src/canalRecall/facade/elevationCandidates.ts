import type { Elevation } from './elevations.ts';

export interface ElevationEvidence {
  elevationId: string;
  addressSide: 'supports' | 'contradicts' | 'unknown';
  streetAdjacencyM: number | null;
  canalAdjacencyM: number | null;
  quayAdjacencyM: number | null;
  visiblePanoramaCount: number;
  bestPanoramaObliquityDeg: number | null;
  occludedFraction: number | null;
  /** Corroboration only; never sufficient to select a wall. */
  osmFrontage: boolean | null;
}

export interface ElevationCandidate {
  elevation: Elevation;
  evidence: ElevationEvidence;
  score: number;
  independentSupport: string[];
  concerns: string[];
}

export function generateElevationCandidates(elevations: readonly Elevation[], evidence: readonly ElevationEvidence[]): ElevationCandidate[] {
  const byId = new Map(evidence.map(entry => [entry.elevationId, entry]));
  return elevations.map(elevation => {
    const facts = byId.get(elevation.elevationId) ?? {
      elevationId: elevation.elevationId, addressSide: 'unknown' as const, streetAdjacencyM: null, canalAdjacencyM: null,
      quayAdjacencyM: null, visiblePanoramaCount: 0, bestPanoramaObliquityDeg: null, occludedFraction: null, osmFrontage: null,
    };
    let score = 0;
    const independentSupport: string[] = [];
    const concerns: string[] = [];
    if (facts.addressSide === 'supports') { score += 35; independentSupport.push('bag-address-side'); }
    if (facts.addressSide === 'contradicts') { score -= 45; concerns.push('bag-address-side-contradiction'); }
    const distances = [facts.streetAdjacencyM, facts.canalAdjacencyM, facts.quayAdjacencyM].filter((value): value is number => value !== null);
    const publicAdjacency = distances.length ? Math.min(...distances) : Infinity;
    if (publicAdjacency <= 4) { score += 25; independentSupport.push('public-space-adjacency'); }
    else if (publicAdjacency <= 10) { score += 12; independentSupport.push('near-public-space'); }
    else if (Number.isFinite(publicAdjacency)) concerns.push('no-close-public-space');
    if (facts.visiblePanoramaCount > 0) { score += Math.min(20, 8 + Math.log2(facts.visiblePanoramaCount + 1) * 4); independentSupport.push('panorama-visibility'); }
    if (facts.bestPanoramaObliquityDeg !== null) score += Math.max(0, 12 - facts.bestPanoramaObliquityDeg / 5);
    if (facts.occludedFraction !== null) { score -= facts.occludedFraction * 30; if (facts.occludedFraction > 0.5) concerns.push('mostly-occluded'); }
    if (facts.osmFrontage === true) score += 4;
    return { elevation, evidence: facts, score, independentSupport, concerns };
  }).sort((left, right) => right.score - left.score || left.elevation.elevationId.localeCompare(right.elevation.elevationId));
}

export type ElevationSelection =
  | { verdict: 'selected'; selected: ElevationCandidate[]; contenders: ElevationCandidate[]; reasons: string[] }
  | { verdict: 'ambiguous'; selected: []; contenders: ElevationCandidate[]; reasons: string[] }
  | { verdict: 'none'; selected: []; contenders: ElevationCandidate[]; reasons: string[] };

export function selectElevationCandidates(
  candidates: readonly ElevationCandidate[],
  { minimumScore = 45, ambiguityMargin = 8 }: { minimumScore?: number; ambiguityMargin?: number } = {},
): ElevationSelection {
  const viable = candidates.filter(candidate => candidate.score >= minimumScore && !candidate.concerns.includes('bag-address-side-contradiction'));
  if (!viable.length) return { verdict: 'none', selected: [], contenders: [...candidates], reasons: ['no elevation has enough independent evidence'] };
  const top = viable[0];
  const close = viable.filter(candidate => top.score - candidate.score <= ambiguityMargin);
  if (close.length === 1 && top.independentSupport.length >= 2) return { verdict: 'selected', selected: [top], contenders: [...viable], reasons: ['one elevation leads with at least two independent signals'] };
  const multiFront = close.length > 1 && close.every(candidate => candidate.independentSupport.includes('bag-address-side') && candidate.independentSupport.length >= 2);
  if (multiFront) return { verdict: 'selected', selected: close, contenders: [...viable], reasons: ['multiple address-supported frontages are independently visible'] };
  return { verdict: 'ambiguous', selected: [], contenders: close, reasons: ['competing elevations are not independently resolved'] };
}
