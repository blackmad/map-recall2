import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { StreetFeature } from '../types';
import type { ReviewState } from '../spacedRepetition';
import { PostcardHeader } from './PostcardHeader';
import { PostcardExport } from './PostcardExport';
import { postcardCityName, postcardPhotosFor } from '../mapRecall/postcardPhotos';
import { extractCityById } from '../mapRecall/cityExtracts';
import { fetchQuizFeatures } from '../dataSources/featureProvider';
import { earnedAreas } from '../mapRecall/progress';

const PLACEHOLDERS = 3;
/** Cards shown on the desktop vista panel before "Show all" (two rows; the phone strip scrolls instead). */
const DESKTOP_COLLAPSED = 10;
const DESKTOP_QUERY = '(min-width: 1024px)'; // Tailwind `lg`, where the setup rail gains its side plane.

function useDesktop(): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(DESKTOP_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia?.(DESKTOP_QUERY);
    if (!query) return;
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return matches;
}

const nameKey = (name: string) => name.trim().toLowerCase();

interface RackCard {
  key: string;
  name: string;
  photos: string[];
}

/** The postcard-shaped slot a card sits in, so the strip does not jump while the frame is composed. */
const CardFrame: React.FC<{ children: React.ReactNode; muted?: boolean }> = ({ children, muted }) =>
  <div
    className={`relative w-full overflow-hidden rounded-md border border-white/15 ${muted ? 'bg-white/5' : 'bg-[#efe7d8]'}`}
    style={{ aspectRatio: '640 / 400' }}
  >
    <div className="absolute inset-0">{children}</div>
  </div>;

/**
 * Earned "Greetings from" postcards: one per neighbourhood answered well in any
 * mode (src/mapRecall/progress.ts `earnedAreas`), newest first, followed by a
 * few greyed blanks showing there is more to collect. Names and photographs
 * come from the city's extract, fetched lazily; until it arrives the earned
 * cards render typography-only from the review store's snapshots.
 */
export const PostcardRack: React.FC<{
  /**
   * `rail`: a scroll-snap strip in the setup rail (phones and tablets);
   * `vista`: a wrapping panel over the desktop side plane. Each renders only at
   * its own width, so App can place both.
   */
  placement?: 'rail' | 'vista';
  cityId: string;
  cityCenter: [number, number];
  states: readonly ReviewState[];
  /** Neighbourhood features to use instead of fetching the extract (Storybook). */
  features?: StreetFeature[];
  /** Render regardless of window width (Storybook frames, My progress). */
  alwaysShow?: boolean;
  /** Omit the small "Postcards" label when the host page already titles the rack. */
  hideTitle?: boolean;
}> = ({ placement = 'rail', cityId, cityCenter, states, features: providedFeatures, alwaysShow = false, hideTitle = false }) => {
  const desktop = useDesktop();
  const visible = alwaysShow || (placement === 'vista') === desktop;
  const extractCity = visible ? extractCityById(cityId) : undefined;
  const [fetched, setFetched] = useState<StreetFeature[] | null>(null);
  const [open, setOpen] = useState<RackCard | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (providedFeatures || !extractCity) return;
    let cancelled = false;
    setFetched(null);
    fetchQuizFeatures({
      cityId, center: cityCenter, placeName: extractCity.name, category: 'neighborhoods', scope: 'city', radiusMeters: 50_000,
    }).then((features) => {
      if (!cancelled) setFetched(features.filter((feature) => feature.type === 'neighborhood'));
    }).catch((error) => console.warn('Postcard rack: neighbourhoods unavailable', error));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, providedFeatures, extractCity]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  const features = providedFeatures ?? fetched;
  const earned = useMemo(() => earnedAreas(states, cityId), [states, cityId]);
  const cards = useMemo<RackCard[]>(() => {
    const byName = new Map((features ?? []).map((feature) => [nameKey(feature.name), feature]));
    return earned.map((area) => {
      const feature = byName.get(nameKey(area.name));
      return { key: area.featureKey, name: feature?.name ?? area.name, photos: feature ? postcardPhotosFor(feature) : [] };
    });
  }, [earned, features]);

  if (!extractCity) return null;
  const total = features ? new Set(features.map((feature) => nameKey(feature.name))).size : null;
  const remaining = total === null ? PLACEHOLDERS : Math.max(0, total - cards.length);
  const placeholders = Math.min(PLACEHOLDERS, remaining);
  const cityName = postcardCityName(cityId) ?? extractCity.name;
  const slots = cards.length + placeholders;
  const vista = placement === 'vista';
  const collapsible = vista && slots > DESKTOP_COLLAPSED;
  const desktopHidden = (index: number) => collapsible && !expanded && index >= DESKTOP_COLLAPSED ? 'hidden' : '';
  const cardWidth = vista ? 'w-[150px]' : 'w-[150px] snap-start';

  return <div
    className={vista
      ? 'app-dialog absolute bottom-4 left-4 right-4 max-h-[calc(100%-2rem)] space-y-2 overflow-y-auto p-3 xl:right-auto xl:max-w-[808px]'
      : 'space-y-2'}
    data-testid="postcard-rack"
    data-placement={placement}
  >
    <div className="flex items-baseline justify-between gap-2">
      {hideTitle ? <span /> : <p className="enamel-brand text-sm text-white tracking-wide">Postcards</p>}
      <p className="text-xs text-white/55" data-testid="postcard-count">
        {total === null ? `${cards.length} collected` : `${cards.length} of ${total} postcards`}
      </p>
    </div>
    {cards.length === 0 && <p className="text-xs text-white/55 leading-relaxed">
      Place a neighbourhood correctly to collect its “Greetings from” card.
    </p>}
    <div className={vista
      ? 'flex flex-wrap gap-2'
      : 'mr-postcard-rack -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5'}>
      {cards.map((card, index) => <button
        key={card.key}
        type="button"
        onClick={() => setOpen(card)}
        aria-label={`Open postcard: ${card.name}`}
        data-testid="postcard-rack-card"
        className={`${cardWidth} shrink-0 cursor-pointer rounded-md transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#8a4a18] ${desktopHidden(index)}`}
      >
        <CardFrame>
          <PostcardHeader name={card.name} cityName={cityName} photos={card.photos} thumbnail className="h-full w-full" />
        </CardFrame>
      </button>)}
      {Array.from({ length: placeholders }, (_, index) => <div
        key={`blank-${index}`}
        aria-hidden="true"
        data-testid="postcard-rack-blank"
        className={`pointer-events-none ${cardWidth} shrink-0 opacity-45 grayscale ${desktopHidden(cards.length + index)}`}
      >
        <CardFrame muted>
          <PostcardHeader name="?" cityName={cityName} photos={[]} thumbnail className="h-full w-full" />
        </CardFrame>
      </div>)}
    </div>
    {collapsible && <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      className="w-full py-1 text-xs font-semibold text-white/55 hover:text-white cursor-pointer"
    >
      {expanded ? 'Show fewer' : `Show ${slots - DESKTOP_COLLAPSED} more`}
    </button>}

    {open && <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,24,18,0.45)] p-4 backdrop-blur-sm animate-fadeIn"
      onClick={() => setOpen(null)}
      data-testid="postcard-popover"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Postcard: ${open.name}`}
        className="app-dialog w-full max-w-xl space-y-3 p-3 sm:p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="enamel-brand min-w-0 truncate text-lg text-white">{open.name}</h2>
          <button type="button" onClick={() => setOpen(null)} aria-label="Close postcard" className="button-secondary shrink-0 p-1.5 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <CardFrame>
          <PostcardHeader name={open.name} cityName={cityName} photos={open.photos} className="h-full w-full" />
        </CardFrame>
        <PostcardExport name={open.name} cityName={cityName} photos={open.photos} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-xs font-bold text-[#8a4a18] underline-offset-2 hover:underline disabled:opacity-60 cursor-pointer" />
        <p className="text-xs text-white/55">Collected in {cityName}. Your postcards are shared with Canal Recall.</p>
      </div>
    </div>}
  </div>;
};
