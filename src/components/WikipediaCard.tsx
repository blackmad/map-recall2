import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StreetFeature, TriviaText } from '../types';
import { FACT_KIND_LABELS } from '../canalRecall/facts/factTypes';
import { neighborhoodFactForRound } from '../mapRecall/neighborhoodStories';
import { triviaForRound } from '../mapRecall/localFacts';
import { descriptionWithoutOrigin, featureDescription, triviaText } from '../mapRecall/trivia';
import { PostcardHeader } from './PostcardHeader';
import { PostcardExport } from './PostcardExport';
import { postcardCaptionFor, postcardPhotosFor } from '../mapRecall/postcardPhotos';
import { historyHeading, ledeHeading, withNamedSubject } from '../mapRecall/answerText';
import { whereItIs } from '../mapRecall/answerPlace';
import { useAnswerHints } from '../mapRecall/useAnswerHints';

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

/** The encyclopedia lede, three lines until the player asks for the rest. */
const Lede: React.FC<{ text: string; source: { href?: string; label: string }; heading?: string }> = ({ text, source, heading }) => {
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => setOpen(false), [text]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || open) return;
    const check = () => setClamped(element.scrollHeight > element.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, open]);
  return <p className="text-xs leading-relaxed text-white" data-testid="answer-lede">
    {heading && <span className="block font-bold text-white/80" data-testid="answer-lede-heading">{heading}</span>}
    <span ref={ref} className={open ? 'block' : 'line-clamp-3'}>“{text}”</span>
    {clamped && !open && <button type="button" onClick={() => setOpen(true)} className="mr-2 text-[11px] font-bold text-[#8a4a18] hover:underline" data-testid="answer-lede-more">more</button>}
    <Source href={source.href}>{source.label}</Source>
  </p>;
};

/**
 * What the answer teaches beyond its position, in reading order: why it is called this, what a
 * local would tell you, where it is, every reviewed fact, the encyclopedia lede, its history and
 * the places in it. Every line names and links its source; photo credits close the card.
 */
export const WikipediaCard: React.FC<{ feature: StreetFeature; factSeed?: number; roundIndex?: number }> = ({ feature, factSeed = 0, roundIndex = 0 }) => {
  const hints = useAnswerHints(feature);
  const topFacts = feature.neighborhoodTopFacts;
  const storyFact = neighborhoodFactForRound(feature.neighborhoodRotatingFacts, factSeed, roundIndex);
  const hasStory = !!topFacts?.length;
  // Every reviewed fact; the round's own (the one the fold may have shown) first.
  const roundFact = triviaForRound(feature.localFacts, factSeed, roundIndex);
  const facts = roundFact ? [roundFact, ...(feature.localFacts ?? []).filter((fact) => fact !== roundFact)] : [];
  const origin: TriviaText | undefined = feature.nameOrigin;
  // Dutch mode reads the Dutch wording where the data has it; the source line
  // still names the article, so a card never pretends to be sourced in Dutch.
  const originBody = triviaText(origin);
  const originText = originBody ? withNamedSubject(feature.name, originBody) : undefined;
  const description = descriptionWithoutOrigin(featureDescription(feature), originBody);
  const history = feature.history;
  const localFact = hasStory ? undefined : feature.localFact;
  const where = hints ? whereItIs(hints, feature.name) : undefined;
  // The line under the description names where it really came from and links there: the article for
  // Wikipedia text, the data's own source for text composed from the map.
  // Some extracts carry a bare string here ("translated"); only an object names a source.
  const extractSource = typeof feature.wikipediaExtractSource === 'object' ? feature.wikipediaExtractSource : undefined;
  const descriptionSource = extractSource
    ? { href: extractSource.sourceUrl, label: extractSource.sourceLabel === 'Wikipedia' ? 'From Wikipedia' : extractSource.sourceLabel }
    : { href: feature.wikipediaUrl, label: feature.wikipediaUrl?.includes('nl.wikipedia') ? 'Wikipedia (translated from Dutch)' : 'From Wikipedia' };
  if (!hasStory && !localFact && !origin && !facts.length && !description && !history && !feature.wikipediaImageUrl) return null;
  // Neighbourhoods open with a postcard cut from their own photographs and those of the places in them.
  const postcardPhotos = postcardPhotosFor(feature);
  const caption = hints ? postcardCaptionFor(feature, hints) : undefined;
  return <div className="answer-detail-card flex flex-col gap-2 p-3 text-left" data-testid="answer-trivia">
    {feature.type === 'neighborhood' && hints && <>
      <PostcardHeader name={feature.name} cityName={caption} photos={postcardPhotos} className="mx-auto w-full max-w-[520px] rounded-lg shadow-md" />
      <PostcardExport name={feature.name} cityName={caption} photos={postcardPhotos} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-xs font-bold text-[#8a4a18] underline-offset-2 hover:underline disabled:opacity-60 cursor-pointer mx-auto" />
    </>}
    <div className="flex gap-3">
    {feature.wikipediaImageUrl && postcardPhotos.length < 2 && <img src={feature.wikipediaImageUrl} referrerPolicy="no-referrer" alt="" className="h-12 w-16 flex-none rounded-md object-cover sm:h-16 sm:w-20" />}
    <div className="min-w-0 flex-1 space-y-1.5">
      {origin && <p className="text-xs leading-relaxed text-white" data-testid="answer-name-origin">
        <Chip>Name</Chip>{originText}{' '}<Source href={origin.sourceUrl}>{origin.sourceLabel}</Source>
      </p>}
      {topFacts?.map((fact, i) => <p key={fact.text} className="text-xs font-semibold leading-relaxed text-white" data-testid="answer-top-fact">
        {i === 0 && <Chip>About here</Chip>}{fact.text}{' '}<Source href={fact.sourceUrl}>{fact.sourceLabel}</Source>
      </p>)}
      {storyFact && <p className="text-xs leading-relaxed text-white" data-testid="answer-rotating-fact">
        <Chip>Did you know</Chip>{storyFact.text}{' '}<Source href={storyFact.sourceUrl}>{storyFact.sourceLabel}</Source>
      </p>}
      {localFact && <p className="text-xs font-semibold leading-relaxed text-white" data-testid="answer-local-fact">
        <Chip>Local</Chip>{localFact.text}{' '}<Source href={localFact.sourceUrl}>{localFact.sourceLabel}</Source>
      </p>}
      {where && <p className="text-xs leading-relaxed text-white" data-testid="answer-where">
        <Chip>Where</Chip>{where}
      </p>}
      {facts.map((fact) => <p key={fact.text} className="text-xs leading-relaxed text-white" data-testid="answer-fact">
        <Chip>{FACT_KIND_LABELS[fact.kind]}</Chip>{fact.text}{' '}<Source href={fact.sourceUrl}>Wikipedia · {fact.license}</Source>
      </p>)}
      {description && <Lede text={description} source={descriptionSource} heading={ledeHeading(extractSource?.borrowedFrom)} />}
      {!description && !facts.length && !origin && feature.wikipediaUrl && <Source href={feature.wikipediaUrl}>View photo on Wikipedia</Source>}
      {history && <details open={!hasStory} className="text-xs leading-relaxed text-white" data-testid={hasStory ? 'answer-story-background' : 'answer-history'}>
        <summary className="cursor-pointer font-bold text-white/80">{historyHeading(history.borrowedFrom)}</summary>
        <p className="mt-1">{triviaText(history)}</p>
        <Source href={history.sourceUrl}>{history.sourceLabel}</Source>
      </details>}
      <PlacesHere places={feature.notablePlaces} showPhotos={postcardPhotos.length < 2} />
      {postcardPhotos.length >= 2 && (feature.areaPhotos?.length ?? 0) > 0 && <details className="text-[11px] leading-snug text-white/70" data-testid="postcard-credits">
        <summary className="cursor-pointer font-bold">Postcard photo credits</summary>
        <ul className="mt-1 space-y-0.5">
          {feature.areaPhotos!.slice(0, 8).map((entry) => <li key={entry.photo.imageUrl}>
            <a href={entry.photo.sourceUrl} target="_blank" rel="noreferrer" className="font-bold hover:text-white">{entry.name}</a> · {entry.photo.imageAttribution}
          </li>)}
        </ul>
      </details>}
    </div>
    </div>
  </div>;
};
