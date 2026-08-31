// How a finished trip is graded.
//
// Speed is deliberately not an input: a fast lap of the wrong canals must not
// outrank a deliberate, correctly named route. The three axes are what the
// game is actually trying to teach — naming what you drove past, navigating
// without aids, and not wasting distance.

/** Weight of each aid when scoring self-reliance. The route line removes the
 *  navigation problem entirely, so it costs the most. */
export const RIBBON_AID_COST = { line: 0.5, arrow: 0.25, minimap: 0.25 } as const;

export type RibbonAid = keyof typeof RIBBON_AID_COST;

export interface RibbonTier {
  id: string;
  label: string;
  /** Blended score the trip must clear. */
  min: number;
  /**
   * Recall gate, applied independently of the blended score. This is a recall
   * game: a spotless efficient run that never named a canal correctly must not
   * out-rank a slower player who knew where they were.
   */
  minRecall: number;
  color: string;
  dim: string;
}

/** Ordered best-first; the first tier the trip clears wins. */
export const ROUTE_RIBBON_TIERS: readonly RibbonTier[] = [
  { id: 'gold', label: 'GOLD RIBBON', min: 0.85, minRecall: 0.80, color: '#FACC15', dim: 'rgba(250,204,21,.16)' },
  { id: 'silver', label: 'SILVER RIBBON', min: 0.68, minRecall: 0.55, color: '#CBD5E1', dim: 'rgba(203,213,225,.14)' },
  { id: 'bronze', label: 'BRONZE RIBBON', min: 0.50, minRecall: 0.25, color: '#D8964A', dim: 'rgba(216,150,74,.16)' },
  { id: 'none', label: 'ROUTE COMPLETE', min: -Infinity, minRecall: -Infinity, color: '#7DD3FC', dim: 'rgba(56,189,248,.12)' },
];

/** Typing the name back is a harder recall task than picking from four
 *  options, so it buys back some of the aid cost. */
export const TYPING_SELF_RELIANCE_BONUS = 0.15;

/** Even a clean run overshoots the graph route slightly, so treat 90% of ideal
 *  as a full score and 55% as none. */
const EFFICIENCY_FULL = 0.90;
const EFFICIENCY_NONE = 0.55;

export interface RibbonAxis {
  id: 'recall' | 'aids' | 'efficiency';
  label: string;
  weight: number;
  score: number;
}

export interface RouteRibbon extends RibbonTier {
  score: number;
  axes: RibbonAxis[];
}

export interface RibbonInput {
  correct: number;
  attempts: number;
  aidsUsed: Partial<Record<RibbonAid, boolean>>;
  /** 'typing' is a harder task than picking from four options. */
  typedAnswers: boolean;
  /** Length of the route the game planned, in world px. */
  idealPx: number;
  /** How far the player actually travelled, in world px. */
  actualPx: number;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * The efficiency reference is the route planned at the *start*: the live line
 * is consumed as the player advances, so measuring it at the end would compare
 * the trip against whatever was left of it.
 */
export function idealRouteLength(
  plannedPx: number,
  routePath: readonly { x: number; y: number }[] | null | undefined,
): number {
  if (plannedPx > 0) return plannedPx;
  if (!routePath || routePath.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < routePath.length; i++) {
    total += Math.hypot(routePath[i].x - routePath[i - 1].x, routePath[i].y - routePath[i - 1].y);
  }
  return total;
}

export function computeRouteRibbon(input: RibbonInput): RouteRibbon {
  const axes: RibbonAxis[] = [];

  // A route with no turns to name scores zero recall rather than being
  // excluded, so it settles at ROUTE COMPLETE instead of a free gold.
  const recall = input.attempts > 0 ? input.correct / input.attempts : 0;
  axes.push({ id: 'recall', label: 'Recall', weight: 0.5, score: recall });

  let aidCost = 0;
  for (const [aid, cost] of Object.entries(RIBBON_AID_COST)) {
    if (input.aidsUsed[aid as RibbonAid]) aidCost += cost;
  }
  const selfReliance = 1 - aidCost + (input.typedAnswers ? TYPING_SELF_RELIANCE_BONUS : 0);
  axes.push({ id: 'aids', label: 'Unaided', weight: 0.25, score: clamp01(selfReliance) });

  if (input.idealPx > 0 && input.actualPx > 0) {
    const ratio = Math.min(1, input.idealPx / input.actualPx);
    axes.push({
      id: 'efficiency',
      label: 'Efficiency',
      weight: 0.25,
      score: clamp01((ratio - EFFICIENCY_NONE) / (EFFICIENCY_FULL - EFFICIENCY_NONE)),
    });
  }

  const totalWeight = axes.reduce((sum, axis) => sum + axis.weight, 0);
  const score = totalWeight > 0
    ? axes.reduce((sum, axis) => sum + axis.weight * axis.score, 0) / totalWeight
    : 0;
  // The last tier's thresholds are -Infinity, so this always matches.
  const tier = ROUTE_RIBBON_TIERS.find(entry => score >= entry.min && recall >= entry.minRecall)
    ?? ROUTE_RIBBON_TIERS[ROUTE_RIBBON_TIERS.length - 1];
  return { ...tier, score, axes };
}
