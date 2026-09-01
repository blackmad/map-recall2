import React from 'react';
import { StreetFeature } from '../types';
import { FACT_KIND_LABELS } from '../canalRecall/facts/factTypes';
import { triviaForRound } from '../mapRecall/localFacts';

export const WikipediaCard: React.FC<{ feature: StreetFeature; factSeed?: number; roundIndex?: number }> = ({ feature, factSeed = 0, roundIndex = 0 }) => {
  const trivia = triviaForRound(feature.localFacts, factSeed, roundIndex);
  if (trivia) return <a href={trivia.sourceUrl} target="_blank" rel="noreferrer" className="answer-detail-card flex gap-3 p-3 text-left transition hover:brightness-95">
    {feature.wikipediaImageUrl && <img src={feature.wikipediaImageUrl} referrerPolicy="no-referrer" alt="" className="h-16 w-20 flex-none rounded-lg object-cover" />}
    <span className="min-w-0">
      <span className="mb-1 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-violet-800">{FACT_KIND_LABELS[trivia.kind]}</span>
      <span className="block text-xs leading-relaxed text-slate-700">“{trivia.text}”</span>
      <span className="mt-1 block text-[10px] font-bold text-emerald-800">Reviewed Wikipedia fact · {trivia.license} ↗</span>
    </span>
  </a>;
  if ((!feature.wikipediaExtract && !feature.wikipediaImageUrl) || !feature.wikipediaUrl) return null;
  return <a href={feature.wikipediaUrl} target="_blank" rel="noreferrer" className="answer-detail-card flex gap-3 p-3 text-left transition hover:brightness-95">
    {feature.wikipediaImageUrl && <img src={feature.wikipediaImageUrl} referrerPolicy="no-referrer" alt="" className="h-16 w-20 flex-none rounded-lg object-cover" />}
    <span className="min-w-0">{feature.wikipediaExtract && <span className="line-clamp-3 text-xs leading-relaxed text-slate-600">“{feature.wikipediaExtract}”</span>}<span className="mt-1 block text-[10px] font-bold text-emerald-800">{feature.wikipediaExtract ? 'From Wikipedia' : 'View photo on Wikipedia'} ↗</span></span>
  </a>;
};
