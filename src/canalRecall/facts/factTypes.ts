// The shape of a generated fact, and what has to travel with it.
//
// `FACT_PIPELINE.md` sets the rule this file exists to enforce: every
// displayed statement keeps statement-level provenance. A fact is therefore
// never a bare string — it carries the section it was drawn from, the article
// it came from, the licence of that article, and the model that wrote it, so
// that a wrong card can be traced to a passage and a prompt rather than
// guessed at.

/**
 * What sort of thing the fact tells you. This is the axis the runtime rotates
 * along: showing a player the naming story on one pass and a construction
 * detail on the next teaches more than showing two dates.
 */
export type FactKind =
  /** Where the name comes from, and what it means. */
  | 'naming'
  /** An event, a date, a change of use. */
  | 'history'
  /** Who built it, lived there, or it is named after. */
  | 'people'
  /** Architecture, engineering, dimensions, materials. */
  | 'design'
  /** Films, books, customs, festivals, local habits. */
  | 'culture'
  /** Something genuinely unexpected that fits no other kind. */
  | 'surprise';

export const FACT_KINDS: readonly FactKind[] = [
  'naming', 'history', 'people', 'design', 'culture', 'surprise',
];

/** Human-readable label for the card's kind chip. */
export const FACT_KIND_LABELS: Readonly<Record<FactKind, string>> = {
  naming: 'Name',
  history: 'History',
  people: 'People',
  design: 'Design',
  culture: 'Culture',
  surprise: 'Curiosity',
};

export interface Fact {
  /** One self-contained sentence, display length, no markup. */
  text: string;
  kind: FactKind;
  /** Article heading the source passage came from; `''` for the lede. */
  section: string;
  /** Article URL, so the card's "read more" points at the actual claim. */
  sourceUrl: string;
  /** Licence of the source text, carried per statement and never merged away. */
  license: string;
  /** ISO date the source article was retrieved. */
  retrievedAt: string;
  /** `ollama:gemma3:4b` — which local model wrote this sentence. */
  model: string;
}

/** Every fact known for one feature, as published in `facts.json`. */
export interface FeatureFacts {
  id: string;
  name: string;
  /** Which extract file the feature lives in: `landmarks`, `bridges`, … */
  collection: string;
  facts: Fact[];
}

export interface FactsFile {
  cityId: string;
  /** Bumped when the prompt or the editorial gate changes what is generated. */
  generatorVersion: string;
  generatedAt: string;
  features: FeatureFacts[];
}
