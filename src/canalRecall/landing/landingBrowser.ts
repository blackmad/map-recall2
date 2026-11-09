// Landing page adapter (G2, #272): a returning player gets Continue and Free
// Ride above the hero, drawn from localStorage only.
// A first-time visitor, blocked storage or `?landing=0` leave the page as authored.
// Bundled to public/canal-drive/js/landing.bundle.js (see the hand-back).
//
// Today's ride is off (user 2026-11-09, "no daily ride"; DAILY_RIDE_ON_LANDING
// in featureFlags.ts, F1 #311). esbuild cannot tree-shake a branch behind an
// imported constant, so this adapter does not import landingDaily.ts while the
// flag is off: the landing bundle drops the daily pool (~35 kB). To bring the
// card back, set DAILY_RIDE_ON_LANDING = true and restore these lines
// (landingBrowser.test.ts fails until both agree):
//   import { buildLandingDaily, landingDailyParts } from './landingDaily';
//   const daily = buildLandingDaily(storage);
//   ...buildLandingModel(storage, Date.now(), 'amsterdam', daily) and
//   landingCardsHtml(model, hrefs, landingDailyParts(model, hrefs))

import { canalPageLinks } from '../../siteLinks';
import { buildLandingModel, landingCardsEnabled } from './landingModel';
import { landingCardsHtml } from './landingView';

function mount(): void {
  if (!landingCardsEnabled(location.search)) return;
  let storage: Storage;
  try { storage = window.localStorage; } catch { return; }
  const model = buildLandingModel(storage);
  const html = landingCardsHtml(model, { ride: canalPageLinks(location.pathname).ride });
  const slot = document.getElementById('landing-returning-slot');
  if (!html || !slot) return;
  slot.innerHTML = html;
  slot.hidden = false;
  document.documentElement.classList.add('landing-returning-on');
}

try { mount(); } catch (error) {
  // The static page stands on its own; a broken card must not take it down.
  console.warn('landing cards', error);
}
