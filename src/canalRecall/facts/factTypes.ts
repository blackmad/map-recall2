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
import { language } from '../../i18n/index.ts';

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

const FACT_KIND_LABELS_NL: Readonly<Record<FactKind, string>> = {
  naming: 'Naam',
  history: 'Geschiedenis',
  people: 'Mensen',
  design: 'Ontwerp',
  culture: 'Cultuur',
  surprise: 'Weetje',
};

/** The kind chip in the interface's language. */
export function factKindLabel(kind: FactKind): string {
  return language() === 'nl' ? FACT_KIND_LABELS_NL[kind] : FACT_KIND_LABELS[kind];
}

/**
 * The sentence a card prints. Dutch only when the catalog has the Dutch
 * article's own sentence; an English fact stays English rather than being
 * machine-translated into a language its evidence is not in.
 */
export function factText(fact: Pick<Fact, 'text' | 'textNl'>): string {
  return language() === 'nl' && fact.textNl ? fact.textNl : fact.text;
}

/** Attribution that names the language of the sentence shown. */
export function factSourceLabel(fact: Pick<Fact, 'textNl'>): string {
  return language() === 'nl' && fact.textNl ? 'Wikipedia (Nederlands)' : 'Wikipedia · CC BY-SA 4.0';
}

export interface Fact {
  /** One self-contained sentence, display length, no markup (English). */
  text: string;
  /**
   * The same claim in the source article's own Dutch sentence, when the article
   * was Dutch (`scripts/add-dutch-facts.ts`). Dutch mode prints this instead of
   * `text`; it is a quote, not a translation of the English summary.
   */
  textNl?: string;
  kind: FactKind;
  /** Article heading the source passage came from; `''` for the lede. */
  section: string;
  /** Exact Wikipedia passage that supports the locally written fact. */
  sourceQuote: string;
  /** English translation used for summarization; identical for English sources. */
  sourceQuoteEnglish?: string;
  /** Article URL, so the card's "read more" points at the actual claim. */
  sourceUrl: string;
  /** Licence of the source text, carried per statement and never merged away. */
  license: string;
  /** ISO date the source article was retrieved. */
  retrievedAt: string;
  /** Language of the exact evidence. `text` is English; `textNl` quotes Dutch evidence. */
  sourceLanguage?: 'en' | 'nl';
  /** Local translation tool used before summarization, for Dutch evidence. */
  translator?: string;
  /** `ollama:gemma3:4b` — which local model wrote this sentence. */
  model: string;
  /** A second, isolated local-model pass that checked entailment. */
  verifierModel?: string;
  /** Only an explicit grounded verdict may cross the publication boundary. */
  verification?: 'grounded';
}

/** Every fact known for one feature, as published in `facts.json`. */
export interface FeatureFacts {
  id: string;
  name: string;
  /** Which extract file the feature lives in: `landmarks`, `bridges`, … */
  collection: string;
  /**
   * Opening sentence from the same Wikipedia article (who / what this is).
   * Shown ahead of a rotated trivia sentence so a people or history punchline
   * is not orphaned — e.g. who Nicolaas Beems was, then a second detail from
   * the article. Optional on older catalogs; the runtime falls back to the
   * feature's published encyclopedia lede when this is absent.
   */
  opening?: string;
  /** The Dutch article's first lede sentence, when there is a Dutch fact. */
  openingNl?: string;
  facts: Fact[];
}

export interface FactsFile {
  cityId: string;
  /** Bumped when the prompt or the editorial gate changes what is generated. */
  generatorVersion: string;
  generatedAt: string;
  features: FeatureFacts[];
}
