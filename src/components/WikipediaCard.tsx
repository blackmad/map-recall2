import React from 'react';
import { StreetFeature, TriviaText } from '../types';
import { FACT_KIND_LABELS } from '../canalRecall/facts/factTypes';
import { triviaForRound } from '../mapRecall/localFacts';
import { descriptionWithoutOrigin } from '../mapRecall/trivia';
import { CITIES } from '../data/cities';
import { PostcardHeader } from './PostcardHeader';

const Source: React.FC<{ href?: string; children: React.ReactNode }> = ({ href, children }) => href
  ? <a href={href} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-[11px] font-bold text-white/60 hover:text-white">{children} ↗</a>
  : <span className="mt-0.5 inline-block text-[11px] font-bold text-white/60">{children}</span>;

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="enamel-chip mr-1.5 inline-block px-1.5 py-0.5 align-[1px] text-[10px] font-black uppercase tracking-wide text-[#8a4a18]">{children}</span>
);

/**
 * "Around here": the neighbourhood's best-known places. Those with a Commons photograph show it
 * (up to three, each credited and linked); the rest are listed by name. Shown after the answer,
 * so it can name places freely; the clue dots on the map are what difficulty gates.
 */
const PlacesHere: React.FC<{ places?: StreetFeature['notablePlaces']; showPhotos?: boolean }> = ({ places, showPhotos = true }) => {
  if (!places?.length) return null;
  const withPhoto = showPhotos ? places.filter((place) => place.photo).slice(0, 3) : [];
  const rest = places.filter((place) => !withPhoto.includes(place));
  return <div className="space-y-1" data-testid="answer-places">
    <div className="text-[10px] font-black uppercase tracking-wide text-[#8a4a18]">Around here</div>
    {withPhoto.length > 0 && <div className="grid grid-cols-3 gap-1.5" data-testid="answer-place-photos">
      {withPhoto.map((place) => <a key={place.name} href={place.photo!.sourceUrl} target="_blank" rel="noreferrer" title={`${place.name} · ${place.photo!.imageAttribution}`} className="block min-w-0">
        <img src={place.photo!.imageUrl} referrerPolicy="no-referrer" loading="lazy" alt="" className="h-14 w-full rounded-md object-cover sm:h-16" />
        <span className="mt-0.5 block truncate text-[10px] font-bold text-white/80">{place.name}</span>
      </a>)}
    </div>}
    {rest.length > 0 && <p className="text-[11px] leading-snug text-white/80">{withPhoto.length ? 'Also: ' : ''}{rest.map((place) => place.name).join(' · ')}</p>}
  </div>;
};

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
  // The line under the description names where it really came from and links there: the article for
  // Wikipedia text, the data's own source for text composed from the map.
  const extractSource = feature.wikipediaExtractSource;
  const descriptionSource = extractSource
    ? { href: extractSource.sourceUrl, label: extractSource.sourceLabel === 'Wikipedia' ? 'From Wikipedia' : extractSource.sourceLabel }
    : { href: feature.wikipediaUrl, label: feature.wikipediaUrl?.includes('nl.wikipedia') ? 'Wikipedia (translated from Dutch)' : 'From Wikipedia' };
  if (!origin && !trivia && !description && !history && !feature.wikipediaImageUrl) return null;
  // Neighbourhoods open with a postcard cut from their own photographs and those of the places in them.
  const postcardPhotos = feature.type === 'neighborhood'
    ? [feature.wikipediaImageUrl, ...(feature.areaPhotos ?? []).map((place) => place.photo.imageUrl)].filter((url): url is string => !!url).slice(0, 5)
    : [];
  return <div className="answer-detail-card flex flex-col gap-2 p-3 text-left" data-testid="answer-trivia">
    {postcardPhotos.length >= 2 && <PostcardHeader name={feature.name} cityName={CITIES.find((city) => city.id === feature.cityId)?.name} photos={postcardPhotos} />}
    <div className="flex gap-3">
    {feature.wikipediaImageUrl && postcardPhotos.length < 2 && <img src={feature.wikipediaImageUrl} referrerPolicy="no-referrer" alt="" className="h-12 w-16 flex-none rounded-md object-cover sm:h-16 sm:w-20" />}
    <div className="min-w-0 space-y-1.5">
      {origin && <p className="text-xs leading-relaxed text-white" data-testid="answer-name-origin">
        <Chip>Name</Chip>{origin.text}{' '}<Source href={origin.sourceUrl}>{origin.sourceLabel}</Source>
      </p>}
      {trivia && <p className="text-xs leading-relaxed text-white">
        <Chip>{FACT_KIND_LABELS[trivia.kind]}</Chip>“{trivia.text}”{' '}<Source href={trivia.sourceUrl}>Reviewed Wikipedia fact · {trivia.license}</Source>
      </p>}
      {description && <p className="text-xs leading-relaxed text-white">
        <span className={origin || history ? 'line-clamp-2' : 'line-clamp-3'}>“{description}”</span>
        <Source href={descriptionSource.href}>{descriptionSource.label}</Source>
      </p>}
      {!description && !trivia && !origin && feature.wikipediaUrl && <Source href={feature.wikipediaUrl}>View photo on Wikipedia</Source>}
      {history && <details open className="text-xs leading-relaxed text-white" data-testid="answer-history">
        <summary className="cursor-pointer font-bold text-white/80">History</summary>
        <p className="mt-1">{history.text}</p>
        <Source href={history.sourceUrl}>{history.sourceLabel}</Source>
      </details>}
      <PlacesHere places={feature.notablePlaces} showPhotos={postcardPhotos.length < 2} />
    </div>
    </div>
  </div>;
};
