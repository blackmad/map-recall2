// Today's ride on the returning landing (G2, #272; buurt pool #279): the
// model and the card. Off since 2026-11-09 (user: "no daily ride";
// DAILY_RIDE_ON_LANDING in featureFlags.ts, F1 #311); kept so the card comes
// back by flipping that flag. The ride itself still opens from `?ride=daily`.
// Pure: no DOM.

import { CANAL_CITIES } from '../game/cities';
import {
  dailyRideBoard,
  dailyRideDateKey,
  dailyRideDistance,
  dailyRideLabel,
  dailyRidePair,
  formatRideTime,
  type DailyRideDay,
} from '../game/dailyRide';
import type { RoutePoi } from '../game/surprisePick';
import { loadRouteHistory } from '../routeHistory';
import { LANDING_RIDE_QUERY, type LandingDaily, type LandingModel } from './landingModel';
import { boardDayLabel, escapeHtml, landingCardHtml, type LandingDailyParts, type LandingHrefs } from './landingView';

type ReadStore = Pick<Storage, 'getItem' | 'setItem'>;

/** The curated landmarks today's ride is drawn from: static, so the same everywhere. */
export function dailyRideCandidates(cityId = 'amsterdam'): RoutePoi[] {
  const city = CANAL_CITIES[cityId as keyof typeof CANAL_CITIES] ?? CANAL_CITIES.amsterdam;
  return city.curatedPois.map(poi => ({ ...poi }));
}

export function buildLandingDaily(storage: ReadStore, now = Date.now(), cityId = 'amsterdam'): LandingDaily {
  const candidates = dailyRideCandidates(cityId);
  const date = dailyRideDateKey(now);
  const pair = dailyRidePair(date, candidates);
  const history = loadRouteHistory(storage).filter(ride => ride.cityId === cityId);
  const days = dailyRideBoard(history, candidates, { limit: 6 });
  const today = days.find(day => day.date === date) ?? null;
  const board = days.filter(day => day.date !== date).slice(0, 5);
  return { pair, today, board };
}

function recallText(day: DailyRideDay): string {
  return day.recall === null ? 'no questions' : `${day.recall} % named`;
}

function boardHtml(daily: LandingDaily): string {
  const rows = daily.board;
  if (!rows.length) return '<p class="landing-board-empty">Your days on this card start today.</p>';
  return `<ol class="landing-board" aria-label="Your past days">${rows.map(day => `
    <li${day.fastest ? ' class="fastest"' : ''}><span class="d">${escapeHtml(boardDayLabel(day.date))}</span><span class="t">${escapeHtml(formatRideTime(day.seconds))}</span><span class="r">${escapeHtml(recallText(day))}</span>${day.fastest ? '<span class="b">fastest</span>' : ''}</li>`).join('')}
  </ol>`;
}

/** Today's ride card and the section's route attributes, or null without daily figures.
 *  Names only landmarks/buurts (start and finish), never a street. */
export function landingDailyParts(model: LandingModel, hrefs: LandingHrefs): LandingDailyParts | null {
  const daily = model.daily;
  if (!daily) return null;
  const { pair, today } = daily;
  const dailyTitle = pair ? `${pair.from.name} → ${pair.to.name}` : 'Today’s ride';
  const dailyDetail = today
    ? `Ridden today · ${formatRideTime(today.seconds)} · ${recallText(today)}`
    : pair ? `${dailyRideDistance(pair)} · the same route for everyone today` : '';
  return {
    card: landingCardHtml('daily', 'Today’s ride', dailyTitle, dailyDetail, `${hrefs.ride}${LANDING_RIDE_QUERY.daily}`,
      today ? 'Ride it again' : 'Ride today’s route', boardHtml(daily)),
    routeId: pair?.id ?? '',
    title: pair ? dailyRideLabel(pair) : '',
  };
}
