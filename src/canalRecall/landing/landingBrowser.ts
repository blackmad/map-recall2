// Landing page adapter (G2, #272): a returning player gets Today's ride,
// Continue and Free Ride above the hero, drawn from localStorage only.
// A first-time visitor, blocked storage or `?landing=0` leave the page as authored.
// Bundled to public/canal-drive/js/landing.bundle.js (see the hand-back).

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
