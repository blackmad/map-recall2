import { Church, Coffee, Frame, IceCreamCone, Landmark, Pizza, ShoppingBasket, Star, type LucideIcon } from 'lucide-react';
import type { TourOption } from './store.ts';
import { useT } from '../../i18n/useT.ts';

/**
 * Tours as a row of cover cards under More options (G7, #277). The user took
 * the tour picker off the main setup path on 2026-10-22; tours kept working
 * only as `?tour=<id>` links, which nobody could find. Each card is that link.
 * The cover is the theme's enamel plate, never a stop's photo or name: a stop
 * could be the answer to a question on the way.
 */
const THEME_COVERS: Record<string, { icon: LucideIcon; tone: string }> = {
  history: { icon: Landmark, tone: '#8a5a3c' },
  architecture: { icon: Landmark, tone: '#6b4a3a' },
  art: { icon: Frame, tone: '#3f5f7a' },
  skyline: { icon: Church, tone: '#4f6470' },
  markets: { icon: ShoppingBasket, tone: '#6a7a3c' },
  food: { icon: IceCreamCone, tone: '#b0653f' },
  cafes: { icon: Coffee, tone: '#5c4433' },
};
const TOUR_ICONS: Record<string, LucideIcon> = { pizza: Pizza };

export function tourCover(tour: Pick<TourOption, 'id' | 'theme'>): { icon: LucideIcon; tone: string } {
  const cover = THEME_COVERS[tour.theme] ?? { icon: Star, tone: '#4a5a58' };
  return { ...cover, icon: TOUR_ICONS[tour.id] ?? cover.icon };
}

/** The ride's own `?tour=` deep link, on whatever page path the ride is served from. */
export function tourHref(id: string, pathname = typeof location === 'undefined' ? '/canal-drive/' : location.pathname): string {
  return `${pathname}?tour=${encodeURIComponent(id)}`;
}

const TOUR_CARD_CSS = `/* Injected by TourCards.tsx (G7): the setup styles live in index.html, the integrator's file. */
.setup-tours { margin: 4px 0 14px; }
.setup-tours-title { margin: 0 0 6px; font: 700 11px/1.2 var(--font-mono, ui-monospace, monospace); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-muted, #5f584d); }
.setup-tour-row { display: flex; gap: 10px; margin: 0; padding: 2px 2px 8px; list-style: none; overflow-x: auto; scroll-snap-type: x proximity; overscroll-behavior-x: contain; }
.setup-tour-row > li { flex: 0 0 132px; scroll-snap-align: start; }
.setup-tour-card { display: flex; flex-direction: column; gap: 3px; height: 100%; box-sizing: border-box; padding: 6px 6px 8px; border: 1px solid var(--day-line, rgba(40,36,30,.18)); border-radius: 10px; background: var(--day-paper-raised, #fbf8f2); color: inherit; text-decoration: none; }
.setup-tour-card:hover, .setup-tour-card:focus-visible { border-color: var(--day-line-strong, rgba(40,36,30,.4)); }
.setup-tour-cover { display: grid; place-items: center; height: 64px; border-radius: 7px; color: #f6efe2; box-shadow: inset 0 0 0 2px rgba(255,255,255,.18); }
.setup-tour-cover svg { width: 30px; height: 30px; }
.setup-tour-card strong { font-size: 13px; line-height: 1.2; }
.setup-tour-card small { font-size: 11px; line-height: 1.25; color: var(--ink-muted, #5f584d); }
`;

function ensureTourCardStyles(): void {
  if (typeof document === 'undefined' || document.getElementById('setup-tour-styles')) return;
  const style = document.createElement('style');
  style.id = 'setup-tour-styles';
  style.textContent = TOUR_CARD_CSS;
  document.head.append(style);
}

export function TourCards({ tours }: { tours: readonly TourOption[] }) {
  const t = useT();
  if (!tours.length) return null;
  ensureTourCardStyles();
  return (
    <section className="setup-tours" aria-labelledby="setup-tours-title">
      <p id="setup-tours-title" className="setup-tours-title">{t('setup.tours')}</p>
      <ul className="setup-tour-row">
        {tours.map(tour => {
          const { icon: Icon, tone } = tourCover(tour);
          return (
            <li key={tour.id}>
              <a className="setup-tour-card" href={tourHref(tour.id)} data-tour-id={tour.id}>
                <span className="setup-tour-cover" style={{ background: tone }} aria-hidden="true">
                  <Icon strokeWidth={2} />
                </span>
                <strong>{tour.title}</strong>
                <small>{t('setup.tours.cardStops', { count: tour.stopCount })}{tour.checked ? ` · ${tour.checked}` : ''}</small>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
