import React from 'react';
import { StreetFeature } from '../types';

export const WikipediaCard: React.FC<{ feature: StreetFeature }> = ({ feature }) => {
  if ((!feature.wikipediaExtract && !feature.wikipediaImageUrl) || !feature.wikipediaUrl) return null;
  return <a href={feature.wikipediaUrl} target="_blank" rel="noreferrer" className="answer-detail-card flex gap-3 p-3 text-left transition hover:brightness-95">
    {feature.wikipediaImageUrl && <img src={feature.wikipediaImageUrl} referrerPolicy="no-referrer" alt="" className="h-16 w-20 flex-none rounded-lg object-cover" />}
    <span className="min-w-0">{feature.wikipediaExtract && <span className="line-clamp-3 text-xs leading-relaxed text-slate-600">“{feature.wikipediaExtract}”</span>}<span className="mt-1 block text-[10px] font-bold text-emerald-800">{feature.wikipediaExtract ? 'From Wikipedia' : 'View photo on Wikipedia'} ↗</span></span>
  </a>;
};
