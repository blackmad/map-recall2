import React from 'react';
import { StreetFeature } from '../types';
import { FACT_KIND_LABELS } from '../canalRecall/facts/factTypes';
import { triviaForRound } from '../mapRecall/localFacts';

export const WikipediaCard: React.FC<{ feature: StreetFeature; factSeed?: number; roundIndex?: number }> = ({ feature, factSeed = 0, roundIndex = 0 }) => {
  const trivia = triviaForRound(feature.localFacts, factSeed, roundIndex);
  if (trivia) return <a href={trivia.sourceUrl} target="_blank" rel="noreferrer" className="answer-detail-card flex gap-3 p-3 text-left transition">
    {feature.wikipediaImageUrl && <img src={feature.wikipediaImageUrl} referrerPolicy="no-referrer" alt="" className="h-16 w-20 flex-none rounded-md object-cover" />}
    <span className="min-w-0">
      <span className="enamel-chip mb-1 inline-block px-2 py-0.5 text-xs font-black uppercase tracking-wide text-[#e2c98a]">{FACT_KIND_LABELS[trivia.kind]}</span>
      <span className="block text-xs leading-relaxed text-white">“{trivia.text}”</span>
      <span className="mt-1 block text-xs font-bold text-white/70">Reviewed Wikipedia fact · {trivia.license} ↗</span>
    </span>
  </a>;
  if ((!feature.wikipediaExtract && !feature.wikipediaImageUrl) || !feature.wikipediaUrl) return null;
  return <a href={feature.wikipediaUrl} target="_blank" rel="noreferrer" className="answer-detail-card flex gap-3 p-3 text-left transition">
    {feature.wikipediaImageUrl && <img src={feature.wikipediaImageUrl} referrerPolicy="no-referrer" alt="" className="h-16 w-20 flex-none rounded-md object-cover" />}
    <span className="min-w-0">{feature.wikipediaExtract && <span className="line-clamp-3 text-xs leading-relaxed text-white">“{feature.wikipediaExtract}”</span>}<span className="mt-1 block text-xs font-bold text-white/70">{feature.wikipediaExtract ? 'From Wikipedia' : 'View photo on Wikipedia'} ↗</span></span>
  </a>;
};
