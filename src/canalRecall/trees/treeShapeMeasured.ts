/**
 * Measured crown priors for `?treeShape=1` (lane T-shape #371). Generated from
 * docs/reports/trees-silhouette-20261110/survey.json by hand review; see that report for each number's sample.
 */
export interface TreeShapeMeasured {
  /** Archetype corrections: the inventory prior contradicted by the panoramas. */
  speciesArchetype: Record<string, { archetype: string; evidence: string }>;
  /** Crown width / tree height, by archetype (median of the measured species in it). */
  widthRatio: Record<string, number>;
  /** Crown width / tree height for species measured in >= 3 summer panoramas. */
  speciesWidthRatio: Record<string, number>;
  /** Crown base (m) by the lower bound of the inventory height class. */
  crownBaseByClass: Record<string, number>;
  /** Species crown base relative to its class's base. */
  speciesBaseFactor: Record<string, number>;
}

export const TREE_SHAPE_MEASURED: TreeShapeMeasured = {
  speciesArchetype: {},
  widthRatio: {},
  speciesWidthRatio: {},
  crownBaseByClass: {},
  speciesBaseFactor: {},
};
