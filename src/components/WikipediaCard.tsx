import React from 'react';
import { StreetFeature } from '../types';

export const WikipediaCard: React.FC<{ feature: StreetFeature }> = ({ feature }) => {
  if ((!feature.wikipediaExtract && !feature.wikipediaImageUrl) || !feature.wikipediaUrl) return null;
  return <a href={feature.wikipediaUrl} target="_blank" rel="noreferrer" className="flex gap-3 rounded-xl border border-slate-700/80 bg-slate-950/70 p-3 text-left transition hover:border-violet-400">
    {feature.wikipediaImageUrl && <img src={feature.wikipediaImageUrl} referrerPolicy="no-referrer" alt="" className="h-16 w-20 flex-none rounded-lg object-cover" />}
    <span className="min-w-0">{feature.wikipediaExtract && <span className="line-clamp-3 text-xs leading-relaxed text-slate-300">“{feature.wikipediaExtract}”</span>}<span className="mt-1 block text-[10px] font-bold text-violet-300">{feature.wikipediaExtract ? 'Wikipedia' : 'View photo on Wikipedia'} ↗</span></span>
  </a>;
};
