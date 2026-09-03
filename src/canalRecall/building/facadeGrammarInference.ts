export type FacadeGrammarLabel = Record<string, unknown> & {
  targetVisible: boolean;
  visibilityConfidence: number;
};

export function normalizeFacadeGrammarLabel(
  value: unknown,
  enums: Record<string, readonly string[]>,
  requiredKeys: readonly string[],
): FacadeGrammarLabel {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('label is not an object');
  const label = { ...(value as Record<string, unknown>) };
  // Some nominally strict providers emit the word "unknown" for nullable counts.
  // It has exactly the same meaning as null, so normalize that one safe deviation.
  for (const key of ['visibleStoreys', 'bayCount']) if (label[key] === 'unknown') label[key] = null;
  const actualKeys = Object.keys(label).sort();
  const expectedKeys = [...requiredKeys].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) throw new Error('label fields do not match the grammar schema');
  if (typeof label.targetVisible !== 'boolean') throw new Error('targetVisible is not boolean');
  if (typeof label.visibilityConfidence !== 'number' || !Number.isFinite(label.visibilityConfidence)
    || label.visibilityConfidence < 0 || label.visibilityConfidence > 1) throw new Error('visibilityConfidence is outside 0..1');
  for (const key of ['visibleStoreys', 'bayCount']) {
    const count = label[key];
    if (count !== null && (!Number.isInteger(count) || Number(count) < 1 || Number(count) > 30)) throw new Error(`${key} is not null or an integer from 1..30`);
  }
  if (label.groundFloorDistinct !== null && typeof label.groundFloorDistinct !== 'boolean') throw new Error('groundFloorDistinct is not boolean or null');
  if (typeof label.rationale !== 'string' || label.rationale.length > 500) throw new Error('rationale is invalid');
  for (const [key, values] of Object.entries(enums)) if (!values.includes(String(label[key]))) throw new Error(`${key} is outside its controlled vocabulary`);
  return label as FacadeGrammarLabel;
}

export function exactConsensus(labels: FacadeGrammarLabel[], keys: readonly string[]): Record<string, unknown> {
  const agreed: Record<string, unknown> = {};
  if (labels.length < 2) return agreed;
  for (const key of keys) if (key !== 'rationale' && labels.every(label => JSON.stringify(label[key]) === JSON.stringify(labels[0][key]))) agreed[key] = labels[0][key];
  return agreed;
}

/**
 * The controlled vocabulary is the data contract shared by extraction, re-derivation
 * and review. It lives here so a re-measurement can never validate against a
 * different set of enums than the run it is measuring.
 */
export const FACADE_GRAMMAR_ENUMS = {
  windowPattern: ['narrow-vertical', 'regular-grid', 'wide-horizontal', 'curtain-wall', 'irregular', 'mostly-blank', 'unknown'],
  windowToWall: ['low', 'medium', 'high', 'unknown'],
  windowRecess: ['flush', 'shallow', 'deep', 'unknown'],
  groundFloorType: ['same-as-upper', 'residential-base', 'shopfront', 'commercial-glazing', 'arcade', 'garage-loading', 'mostly-blank', 'unknown'],
  entranceType: ['single-residential', 'shared-residential', 'multiple-doors', 'commercial', 'garage-loading', 'mixed', 'none-visible', 'unknown'],
  balconyType: ['none', 'projecting', 'recessed', 'gallery', 'mixed', 'not-visible', 'unknown'],
  facadeComposition: ['single-field', 'base-body', 'ground-floor-distinct', 'vertical-zones', 'mixed', 'unknown'],
  roofline: ['flat-parapet', 'stepped-gable', 'bell-gable', 'neck-gable', 'spout-gable', 'triangular-gable', 'mansard-eave', 'other', 'not-visible', 'unknown'],
  ornament: ['minimal', 'moderate', 'elaborate', 'unknown'],
  facadeMaterial: ['brick', 'painted-brick', 'glazed-brick', 'stone', 'plaster-stucco', 'concrete', 'glass-curtain-wall', 'metal-cladding', 'wood-cladding', 'ceramic-cladding', 'fiber-cement', 'composite-panel', 'mixed', 'other', 'not-visible', 'uncertain'],
  facadeColour: ['red', 'brown', 'yellow', 'cream', 'white', 'grey', 'black', 'blue', 'green', 'mixed', 'unknown'],
} as const;

/** `windowFrameColour` reuses the façade palette plus the one frame-specific value. */
export const FACADE_GRAMMAR_VALIDATION_ENUMS: Record<string, readonly string[]> = {
  ...FACADE_GRAMMAR_ENUMS,
  windowFrameColour: [...FACADE_GRAMMAR_ENUMS.facadeColour, 'natural-wood'],
};

/** Count fields are nullable integers, so they need ±1 tolerance reporting rather than an enum. */
export const FACADE_GRAMMAR_COUNT_FIELDS = ['visibleStoreys', 'bayCount'] as const;

export const FACADE_GRAMMAR_FIELDS: readonly string[] = [
  'targetVisible', 'visibilityConfidence', ...FACADE_GRAMMAR_COUNT_FIELDS,
  ...Object.keys(FACADE_GRAMMAR_ENUMS), 'groundFloorDistinct', 'windowFrameColour', 'rationale',
];

/** A field carries no information when every model abstained, whatever word it abstained with. */
export function isAbstention(value: unknown): boolean {
  return value === null || value === undefined || value === 'unknown' || value === 'not-visible' || value === 'uncertain';
}
