// The returning player's landing cards as HTML (G2, #272). Pure: model in,
// markup out, so Storybook, the spec and the landing page draw the same thing.
// Styles: public/canal-drive/css/landing-cards.css.
//
// Copy is the plaque voice: nouns and figures, no exclamation marks. Nothing
// here names a street, so nothing can answer a question the ride will ask.
// Today's ride's card is drawn by landingDaily.ts and passed in when
// DAILY_RIDE_ON_LANDING is on (off since 2026-11-09, F1 #311).

import { LANDING_RIDE_QUERY, type LandingModel } from './landingModel';

export const escapeHtml = (text: string): string => text
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "8 Nov" for a `YYYY-MM-DD` day. */
export function boardDayLabel(date: string): string {
  const at = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(at.getTime())) return date;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(at);
}

/** The header line: place streak and passport stamps. Empty parts are left out. */
export function landingHeaderText(model: LandingModel): string {
  const parts: string[] = [];
  if (model.header.streakDays > 0) parts.push(model.header.streakDays === 1 ? 'Streak · 1 day' : `Streak · ${model.header.streakDays} days`);
  parts.push(`Passport · ${plural(model.header.stamps, 'stamp')}`);
  return parts.join('   ');
}

/** "7 names due · 12 min", or the quiet line when nothing is due. */
export function dueLine(model: LandingModel): string {
  const { names, minutes } = model.due;
  return names > 0 ? `${plural(names, 'name')} due · ${minutes} min` : 'Nothing due';
}

function dueDetail(model: LandingModel): string {
  if (model.due.names > 0) return 'A route that passes them';
  const days = model.due.nextDueDays;
  if (days === null) return 'A new route, new names';
  return days === 1 ? 'Next name due tomorrow' : `Next name due in ${days} days`;
}

export interface LandingHrefs {
  /** The ride page (`/ride` on the site, `./` in dev). */
  ride: string;
}

/** Today's ride's card and the route attributes it puts on the section (landingDaily.ts). */
export interface LandingDailyParts {
  card: string;
  routeId: string;
  title: string;
}

export function landingCardHtml(id: string, kicker: string, title: string, detail: string, href: string, cta: string, extra = ''): string {
  return `<article class="landing-card landing-card-${id}" data-landing-card="${id}">
  <p class="landing-card-kicker">${escapeHtml(kicker)}</p>
  <h3 class="landing-card-title">${escapeHtml(title)}</h3>
  <p class="landing-card-detail">${escapeHtml(detail)}</p>${extra}
  <a class="landing-card-go${id === 'daily' ? ' stamp' : ' quiet'}" href="${escapeHtml(href)}" data-landing-go="${id}">${escapeHtml(cta)}</a>
</article>`;
}

/** The cards and the header line, or '' for a first-time visitor. Two cards
 *  (Continue, Free Ride) unless Today's ride's parts are passed in. */
export function landingCardsHtml(model: LandingModel, hrefs: LandingHrefs, daily: LandingDailyParts | null = null): string {
  if (!model.returning) return '';
  const ride = (id: keyof typeof LANDING_RIDE_QUERY) => `${hrefs.ride}${LANDING_RIDE_QUERY[id]}`;
  const review = landingCardHtml('review', 'Continue', dueLine(model), dueDetail(model), ride('review'), model.due.names > 0 ? 'Review on a ride' : 'New route');
  const free = landingCardHtml('free', 'Free Ride', 'Anywhere in the city', 'No questions. Tap a marker for its story.', ride('free'), 'Free ride');
  const cards = daily ? [daily.card, review, free] : [review, free];
  const route = daily ? ` data-daily-route="${escapeHtml(daily.routeId)}"${daily.title ? ` title="${escapeHtml(daily.title)}"` : ''}` : '';
  return `<section class="landing-returning" aria-labelledby="landing-returning-title"${route}>
  <div class="landing-returning-head">
    <h2 id="landing-returning-title">Welcome back</h2>
    <p class="landing-returning-stats" data-landing-stats>${escapeHtml(landingHeaderText(model))}</p>
  </div>
  <div class="landing-cards${daily ? '' : ' landing-cards-two'}">
${cards.join('\n')}
  </div>
</section>`;
}
