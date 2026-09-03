import type { Fact, FactsFile } from './factTypes.ts';

export interface ReviewFact extends Fact {
  featureId: string;
  featureName: string;
  collection: string;
}

export interface RejectedFact {
  featureId: string;
  featureName: string;
  collection: string;
  section: string;
  reason: string;
  text: string;
  detail?: string;
  sourceUrl: string;
  sourceLanguage: string;
  sourceQuote?: string;
  sourceQuoteEnglish?: string;
}

export interface Progress {
  cityId: string;
  generatorVersion: string;
  status: 'running' | 'complete';
  updatedAt: string;
  considered: number;
  featuresWithFacts: number;
  totalFacts: number;
  rejected: number;
  openRouterSpentUsd: number;
}

export function flattenFacts(file?: FactsFile | null): ReviewFact[] {
  return (file?.features || []).flatMap((feature) => feature.facts.map((fact) => ({
    ...fact,
    featureId: feature.id,
    featureName: feature.name,
    collection: feature.collection,
  })));
}

export function matchesReviewItem(
  item: ReviewFact | RejectedFact,
  query: string,
  collection: string,
  reason = '',
): boolean {
  const searchable = [item.featureName, item.text, item.section, item.collection,
    'sourceQuote' in item ? item.sourceQuote : '',
    'sourceQuoteEnglish' in item ? item.sourceQuoteEnglish : ''].join(' ').toLowerCase();
  return (!query || searchable.includes(query.toLowerCase()))
    && (!collection || item.collection === collection)
    && (!reason || ('reason' in item && item.reason === reason));
}
