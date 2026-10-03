import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { StreetFeature } from '../types';
import { answerTeaser } from '../mapRecall/answerSummary';
import { postcardCityName, postcardPhotosFor } from '../mapRecall/postcardPhotos';
import { preparePostcard } from '../mapRecall/livePostcard';
import { WikipediaCard } from './WikipediaCard';
import { LookAroundLink } from './LookAroundLink';
import { PostcardHeader } from './PostcardHeader';

/**
 * Start the round's postcard while the player is still guessing: its frame is composed and its
 * photographs requested, so the answer card shows it the moment it opens. Called by the quiz
 * overlays on every new round. Nothing is shown, so the answer is not revealed.
 */
export function usePreparePostcard(feature: StreetFeature) {
  const photos = postcardPhotosFor(feature);
  const key = photos.join('|');
  useEffect(() => {
    if (photos.length) void preparePostcard(feature.name, postcardCityName(feature.cityId), photos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature.id, key]);
}

/**
 * What the answer teaches, folded to one line so the map keeps the answer in view: a thumbnail
 * (the postcard when the area has one), the opening line, and "More" for the full card with the
 * postcard, history, places and Street View. Folded again on every new round.
 */
export const AnswerDetails: React.FC<{ feature: StreetFeature; factSeed: number; roundIndex: number }> = ({ feature, factSeed, roundIndex }) => {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [feature.id]);

  const teaser = answerTeaser(feature, factSeed, roundIndex);
  const postcardPhotos = postcardPhotosFor(feature);
  const thumbnail = feature.wikipediaImageUrl ?? postcardPhotos[0];
  if (!teaser && !thumbnail) return <LookAroundLink feature={feature} />;

  if (expanded) return <div className="space-y-2" data-testid="answer-details" data-expanded="yes">
    <button
      type="button"
      onClick={() => setExpanded(false)}
      aria-expanded="true"
      className="flex w-full items-center justify-end gap-1 text-[11px] font-bold text-white/70 hover:text-white"
    >
      Less <ChevronUp className="h-3.5 w-3.5" />
    </button>
    <WikipediaCard feature={feature} factSeed={factSeed} roundIndex={roundIndex} />
    <LookAroundLink feature={feature} />
  </div>;

  return <button
    type="button"
    onClick={() => setExpanded(true)}
    aria-expanded="false"
    data-testid="answer-details"
    data-expanded="no"
    className="answer-detail-card flex w-full items-center gap-2.5 p-2 text-left"
  >
    {postcardPhotos.length
      ? <PostcardHeader thumbnail name={feature.name} cityName={postcardCityName(feature.cityId)} photos={postcardPhotos} className="w-[77px] flex-none rounded-md shadow-sm sm:w-[90px]" />
      : thumbnail && <img src={thumbnail} referrerPolicy="no-referrer" alt="" className="h-12 w-[77px] flex-none rounded-md object-cover shadow-sm sm:h-14 sm:w-[90px]" />}
    <span className="min-w-0 flex-1 text-xs leading-snug text-white line-clamp-2">{teaser ?? `More about ${feature.name}`}</span>
    <span className="flex flex-none items-center gap-0.5 text-[11px] font-bold text-[#8a4a18]">
      More <ChevronDown className="h-3.5 w-3.5" />
    </span>
  </button>;
};
