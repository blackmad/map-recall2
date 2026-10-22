import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { StreetFeature } from '../types';
import { answerTeaser } from '../mapRecall/answerSummary';
import { postcardCaptionFor, postcardPhotosFor } from '../mapRecall/postcardPhotos';
import { loadPostcardFaces, preparePostcard } from '../mapRecall/livePostcard';
import { answerHints, useAnswerHints } from '../mapRecall/useAnswerHints';
import { WikipediaCard } from './WikipediaCard';
import { LookAroundLink } from './LookAroundLink';
import { PostcardHeader } from './PostcardHeader';
import { useT } from '../i18n/useT';

/**
 * Start the round's postcard while the player is still guessing: its frame is composed (with the
 * district in its caption, from the locate hints) and its photographs requested, so the answer
 * card shows it the moment it opens. Called by the quiz overlays on every new round. Nothing is
 * shown, so the answer is not revealed.
 */
export function usePreparePostcard(feature: StreetFeature) {
  const photos = postcardPhotosFor(feature);
  const key = photos.join('|');
  useEffect(() => {
    if (feature.type !== 'neighborhood') return;
    void answerHints(feature).then((hints) => preparePostcard(feature.name, postcardCaptionFor(feature, hints), photos));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature.id, key]);
}

/**
 * Room for the full postcard in the fold: a card at least 480 px wide (the desktop/tablet card;
 * phones are narrower) on a window tall enough (800 px) that the folded card stays under half the
 * window with the postcard at a legible ~330 px wide or more; shorter windows get the strip. Measured on the card itself, so Storybook's phone-width frames match phones.
 */
const MIN_WIDE_CARD = 480;
const MIN_WIDE_WINDOW_HEIGHT = 800;
/**
 * Postcard width that keeps the folded card (result header ~106 px, opening line and padding
 * ~80 px) under half the window: past that the map can no longer fit the revealed area above
 * the card (MapComponent caps its padding at 60% of the map). At 900 px tall that is ~410 px wide.
 */
const FOLDED_POSTCARD_WIDTH = 'min(520px, calc((50dvh - 195px) * 1.6))';
/** The docked quiz card (index.css, >= 1100 px viewport): height is no longer the constraint. */
const DOCK_MIN_VIEWPORT = 1100;
function useWideCard(ref: React.RefObject<HTMLDivElement | null>): { wide: boolean; docked: boolean } {
  const [state, setState] = useState({ wide: true, docked: false });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const check = () => {
      const docked = window.innerWidth >= DOCK_MIN_VIEWPORT && !!element.closest('[data-quiz-dock]');
      const wide = docked || (element.clientWidth >= MIN_WIDE_CARD && window.innerHeight >= MIN_WIDE_WINDOW_HEIGHT);
      setState((previous) => (previous.wide === wide && previous.docked === docked ? previous : { wide, docked }));
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    window.addEventListener('resize', check);
    return () => { observer.disconnect(); window.removeEventListener('resize', check); };
  });
  return state;
}

/**
 * The phone fold's postcard: one line, "Greetings from" and the name in the postcard's own faces
 * over the area's first photograph. The full postcard reads only at card width, which a phone
 * cannot spare while the map shows the answer (review 2026-10-13).
 */
const PostcardStrip: React.FC<{ name: string; photo?: string; onOpen: () => void }> = ({ name, photo, onOpen }) => {
  const t = useT();
  useEffect(() => { void loadPostcardFaces().catch(() => undefined); }, []);
  return <button
    type="button"
    onClick={onOpen}
    aria-label={t('quiz.postcardOpen', { name })}
    data-testid="answer-postcard-strip"
    className="relative flex h-11 w-full items-center gap-2 overflow-hidden rounded-lg bg-[#f3e6c8] px-3 text-left shadow-md"
  >
    {photo && <img src={photo} referrerPolicy="no-referrer" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25" />}
    <span className="relative flex-none text-[15px] leading-none text-[#1f4f7a]" style={{ fontFamily: 'Pacifico, cursive' }}>{t('quiz.greetingsFrom')}</span>
    <span className="relative min-w-0 truncate text-[20px] uppercase leading-none tracking-wide text-[#b5441b]" style={{ fontFamily: 'Anton, Impact, sans-serif', WebkitTextStroke: '0.6px #2b1a0c' }}>{name}</span>
  </button>;
};

/**
 * What the answer teaches, folded so the map keeps the answer in view: for a neighbourhood its
 * postcard (card width from `sm` on a tall enough window, a one-line strip on phones and short windows), then two lines of the
 * opening text and "More" for the full card with history, places and Street View. Folded again
 * on every new round.
 */
export const AnswerDetails: React.FC<{ feature: StreetFeature; factSeed: number; roundIndex: number }> = ({ feature, factSeed, roundIndex }) => {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [feature.id]);
  const foldRef = useRef<HTMLDivElement>(null);
  const { wide, docked } = useWideCard(foldRef);
  const hints = useAnswerHints(feature);

  const teaser = answerTeaser(feature, factSeed, roundIndex);
  const postcardPhotos = postcardPhotosFor(feature);
  const thumbnail = feature.wikipediaImageUrl ?? postcardPhotos[0];
  const isNeighborhood = feature.type === 'neighborhood';
  if (!teaser && !thumbnail && !isNeighborhood) return <LookAroundLink feature={feature} />;

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

  return <div ref={foldRef} className="space-y-2">
    {isNeighborhood && (wide
      // The caption names the district, so the card waits for the (cached) hints rather than repaint.
      ? hints && <div role="presentation" onClick={() => setExpanded(true)} className="mx-auto w-full cursor-pointer" style={{ maxWidth: docked ? undefined : FOLDED_POSTCARD_WIDTH }}>
        <PostcardHeader name={feature.name} cityName={postcardCaptionFor(feature, hints)} photos={postcardPhotos} className="w-full rounded-lg shadow-md" />
      </div>
      : <PostcardStrip name={feature.name} photo={postcardPhotos[0]} onOpen={() => setExpanded(true)} />)}
    <button
    type="button"
    onClick={() => setExpanded(true)}
    aria-expanded="false"
    data-testid="answer-details"
    data-expanded="no"
    className="answer-detail-card flex w-full items-center gap-2.5 p-2 text-left"
  >
    {!isNeighborhood && thumbnail && <img src={thumbnail} referrerPolicy="no-referrer" alt="" className="h-12 w-[77px] flex-none rounded-md object-cover shadow-sm sm:h-14 sm:w-[90px]" />}
    <span data-testid={feature.nameOrigin ? 'answer-name-origin-summary' : undefined} className="line-clamp-2 min-w-0 flex-1 text-xs leading-snug text-white">{feature.nameOrigin && <strong>{t('quiz.nameLabel')} </strong>}{teaser ?? t('quiz.moreAbout', { name: feature.name })}</span>
    <span className="flex flex-none items-center gap-0.5 text-[11px] font-bold text-[#8a4a18]">
      More <ChevronDown className="h-3.5 w-3.5" />
    </span>
  </button></div>;
};
