// The returning player's landing cards as HTML (G2, #272). Pure: model in,
// markup out, so Storybook, the spec and the landing page draw the same thing.
// Styles: public/canal-drive/css/landing-cards.css.
//
// Copy is the plaque voice: nouns and figures, no exclamation marks. Today's
// ride names only landmarks (start and finish), never a street, so nothing
// here can answer a question the ride will ask.

import { dailyRideLabel, formatRideTime, type DailyRideDay } from '../game/dailyRide';
import { LANDING_RIDE_QUERY, type LandingModel } from './landingModel';

const escapeHtml = (text: string): string => text
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "8 Nov" for a `YYYY-MM-DD` day. */
export function boardDayLabel(date: string): string {
  const at = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(at.getTime())) return date;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(at);
}

function recallText(day: DailyRideDay): string {
  return day.recall === null ? 'no questions' : `${day.recall} % named`;
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

function card(id: string, kicker: string, title: string, detail: string, href: string, cta: string, extra = ''): string {
  return `<article class="landing-card landing-card-${id}" data-landing-card="${id}">
  <p class="landing-card-kicker">${escapeHtml(kicker)}</p>
  <h3 class="landing-card-title">${escapeHtml(title)}</h3>
  <p class="landing-card-detail">${escapeHtml(detail)}</p>${extra}
  <a class="landing-card-go${id === 'daily' ? ' stamp' : ' quiet'}" href="${escapeHtml(href)}" data-landing-go="${id}">${escapeHtml(cta)}</a>
</article>`;
}

function boardHtml(model: LandingModel): string {
  const rows = model.daily.board;
  if (!rows.length) return '<p class="landing-board-empty">Your days on this card start today.</p>';
  return `<ol class="landing-board" aria-label="Your past days">${rows.map(day => `
    <li${day.fastest ? ' class="fastest"' : ''}><span class="d">${escapeHtml(boardDayLabel(day.date))}</span><span class="t">${escapeHtml(formatRideTime(day.seconds))}</span><span class="r">${escapeHtml(recallText(day))}</span>${day.fastest ? '<span class="b">fastest</span>' : ''}</li>`).join('')}
  </ol>`;
}

/** The three cards and the header line, or '' for a first-time visitor. */
export function landingCardsHtml(model: LandingModel, hrefs: LandingHrefs): string {
  if (!model.returning) return '';
  const ride = (id: keyof typeof LANDING_RIDE_QUERY) => `${hrefs.ride}${LANDING_RIDE_QUERY[id]}`;
  const pair = model.daily.pair;
  const today = model.daily.today;
  const dailyTitle = pair ? `${pair.from.name} → ${pair.to.name}` : 'Today’s ride';
  const dailyDetail = today
    ? `Ridden today · ${formatRideTime(today.seconds)} · ${recallText(today)}`
    : pair ? `about ${pair.km.toFixed(1)} km · the same route for everyone today` : '';
  const daily = card('daily', 'Today’s ride', dailyTitle, dailyDetail, ride('daily'), today ? 'Ride it again' : 'Ride today’s route', boardHtml(model));
  const review = card('review', 'Continue', dueLine(model), dueDetail(model), ride('review'), model.due.names > 0 ? 'Review on a ride' : 'New route');
  const free = card('free', 'Free Ride', 'Anywhere in the city', 'No questions. Tap a marker for its story.', ride('free'), 'Free ride');
  return `<section class="landing-returning" aria-labelledby="landing-returning-title" data-daily-route="${escapeHtml(pair?.id ?? '')}"${pair ? ` title="${escapeHtml(dailyRideLabel(pair))}"` : ''}>
  <div class="landing-returning-head">
    <h2 id="landing-returning-title">Welcome back</h2>
    <p class="landing-returning-stats" data-landing-stats>${escapeHtml(landingHeaderText(model))}</p>
  </div>
  <div class="landing-cards">
${daily}
${review}
${free}
  </div>
</section>`;
}
