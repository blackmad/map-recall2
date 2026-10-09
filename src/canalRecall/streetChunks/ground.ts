/**
 * One street level and one cornice line across a block face.
 *
 * 3DBAG heights are relative to a per-pand ground estimate (`b3_h_maaiveld`)
 * that wobbles by up to a metre between neighbours of one flat street. Two
 * houses with the same real cornice then fit eaves 0.6 m apart. Absolute
 * (NAP) eaves are far tighter (Bilderdijkstraat 156286/156287/155418: 0.08 m),
 * so the chunk re-grounds every house on the median ground height before the
 * fit, then snaps neighbouring eaves that are within a small step to one line.
 */
import type {BuildingFacts} from '../buildingRecipe/facts.ts';

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const cm = (v: number) => Math.round(v * 100) / 100;

/** Shift every height in `facts` by `delta` metres (roofs stay in absolute NAP; the ground reference moves). */
export function shiftFactsHeights(facts: BuildingFacts, delta: number, newGroundNap: number): BuildingFacts {
  const h = facts.heights as unknown as Record<string, number>;
  const heights = {...facts.heights} as unknown as Record<string, number>;
  for (const key of ['roofMinM', 'roofMaxM', 'ridgeM', 'dak50pM', 'dak70pM', 'surveyRoofMaxM']) if (typeof h[key] === 'number') heights[key] = h[key] + delta;
  heights.groundNAP = newGroundNap;
  return {
    ...facts,
    attributes: {...facts.attributes, b3_h_maaiveld: newGroundNap},
    heights: heights as unknown as BuildingFacts['heights'],
    fronts: facts.fronts.map(f => ({...f, eavesM: f.eavesM + delta, topM: f.topM + delta, topProfile: f.topProfile.map(p => ({...p, heightM: p.heightM + delta}))})),
  };
}

/** Eaves the fit will derive for the first front: 10th percentile of the top profile, in centimetres. */
export function fitEaves(facts: BuildingFacts): number {
  const along = facts.fronts[0].topProfile.map(p => p.heightM).sort((a, b) => a - b);
  return cm(along[Math.floor(along.length * 0.1)]);
}

export interface GroundPlan {
  sharedNapM: number;
  /** Per house (street order): ground shift applied to heights (0 when skipped). */
  shiftsM: number[];
  /** Facts to compile, after re-grounding and eaves snapping. */
  facts: BuildingFacts[];
  eavesBefore: number[];
  eavesAfter: number[];
  /** Clusters of house indices that share one cornice line. */
  clusters: number[][];
}

/**
 * `facts` in street order. `adjacent[i]` = house i and i+1 share a party wall.
 * Re-ground when a house's shift is within `maxRegroundM`; snap runs of
 * adjacent houses whose consecutive eaves differ by at most `snapStepM` and
 * whose overall spread stays within `snapSpanM`.
 */
export function planGround(facts: BuildingFacts[], adjacent: boolean[], maxRegroundM = 1, snapStepM = 0.25, snapSpanM = 0.45): GroundPlan {
  const sharedNapM = cm(median(facts.map(f => f.heights.groundNAP)));
  const shiftsM = facts.map(f => { const d = f.heights.groundNAP - sharedNapM; return maxRegroundM > 0 && Math.abs(d) <= maxRegroundM ? cm(d) : 0; });
  const grounded = facts.map((f, i) => shiftsM[i] ? shiftFactsHeights(f, shiftsM[i], sharedNapM) : f);
  const eavesBefore = grounded.map(fitEaves);
  const eavesAfter = [...eavesBefore];
  const clusters: number[][] = [];
  if (snapStepM > 0) {
    let run = [0];
    const close = () => {
      // Split a run whose spread is too wide at its widest consecutive step until every piece fits.
      const pieces: number[][] = [run];
      for (let p = 0; p < pieces.length; p++) {
        const piece = pieces[p], vals = piece.map(i => eavesBefore[i]);
        if (Math.max(...vals) - Math.min(...vals) <= snapSpanM || piece.length < 2) continue;
        let cut = 1, widest = -1;
        for (let k = 1; k < piece.length; k++) { const d = Math.abs(vals[k] - vals[k - 1]); if (d > widest) { widest = d; cut = k; } }
        pieces.splice(p, 1, piece.slice(0, cut), piece.slice(cut)); p--;
      }
      for (const piece of pieces) if (piece.length > 1) clusters.push(piece);
    };
    for (let i = 1; i < facts.length; i++) {
      if (adjacent[i - 1] && Math.abs(eavesBefore[i] - eavesBefore[i - 1]) <= snapStepM) run.push(i);
      else { close(); run = [i]; }
    }
    close();
    for (const c of clusters) { const target = cm(median(c.map(i => eavesBefore[i]))); for (const i of c) eavesAfter[i] = target; }
  }
  const final = grounded.map((f, i) => {
    const d = eavesAfter[i] - eavesBefore[i];
    if (!d) return f;
    // Only the front profile moves: the roof keeps its measured planes, the cornice lands on the shared line.
    return {...f, fronts: f.fronts.map(fr => ({...fr, eavesM: fr.eavesM + d, topProfile: fr.topProfile.map(p => ({...p, heightM: p.heightM + d}))}))};
  });
  return {sharedNapM, shiftsM, facts: final, eavesBefore, eavesAfter, clusters};
}
