import React from 'react';
import { StreetFeature, TriviaText } from '../types';
import { FACT_KIND_LABELS } from '../canalRecall/facts/factTypes';
import { triviaForRound } from '../mapRecall/localFacts';
import { descriptionWithoutOrigin } from '../mapRecall/trivia';

const Source: React.FC<{ href?: string; children: React.ReactNode }> = ({ href, children }) => href
  ? <a href={href} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-[11px] font-bold text-white/60 hover:text-white">{children} ↗</a>
  : <span className="mt-0.5 inline-block text-[11px] font-bold text-white/60">{children}</span>;

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="enamel-chip mr-1.5 inline-block px-1.5 py-0.5 align-[1px] text-[10px] font-black uppercase tracking-wide text-[#8a4a18]">{children}</span>
);

/**
 * What the answer teaches beyond its position: why it is called this, a
 * reviewed fact or the encyclopedia lede, and (for neighbourhoods) a short
 * history. Every line names and links its source.
 */
export const WikipediaCard: React.FC<{ feature: StreetFeature; factSeed?: number; roundIndex?: number }> = ({ feature, factSeed = 0, roundIndex = 0 }) => {
  const trivia = triviaForRound(feature.localFacts, factSeed, roundIndex);
  const origin: TriviaText | undefined = feature.nameOrigin;
  const description = trivia ? undefined : descriptionWithoutOrigin(feature.wikipediaExtract, origin?.text);
  const history = feature.history;
  if (!origin && !trivia && !description && !history && !feature.wikipediaImageUrl) return null;
  return <div className="answer-detail-card flex gap-3 p-3 text-left" data-testid="answer-trivia">
    {feature.wikipediaImageUrl && <img src={feature.wikipediaImageUrl} referrerPolicy="no-referrer" alt="" className="h-12 w-16 flex-none rounded-md object-cover sm:h-16 sm:w-20" />}
    <div className="min-w-0 space-y-1.5">
      {origin && <p className="text-xs leading-relaxed text-white" data-testid="answer-name-origin">
        <Chip>Name</Chip>{origin.text}{' '}<Source href={origin.sourceUrl}>{origin.sourceLabel}</Source>
      </p>}
      {trivia && <p className="text-xs leading-relaxed text-white">
        <Chip>{FACT_KIND_LABELS[trivia.kind]}</Chip>“{trivia.text}”{' '}<Source href={trivia.sourceUrl}>Reviewed Wikipedia fact · {trivia.license}</Source>
      </p>}
      {description && <p className="text-xs leading-relaxed text-white">
        <span className={origin || history ? 'line-clamp-2' : 'line-clamp-3'}>“{description}”</span>
        <Source href={feature.wikipediaUrl}>{feature.wikipediaUrl?.includes('nl.wikipedia') ? 'Wikipedia (translated from Dutch)' : 'From Wikipedia'}</Source>
      </p>}
      {!description && !trivia && !origin && feature.wikipediaUrl && <Source href={feature.wikipediaUrl}>View photo on Wikipedia</Source>}
      {history && <details className="text-xs leading-relaxed text-white" data-testid="answer-history">
        <summary className="cursor-pointer font-bold text-white/80">History</summary>
        <p className="mt-1">{history.text}</p>
        <Source href={history.sourceUrl}>{history.sourceLabel}</Source>
      </details>}
    </div>
  </div>;
};
