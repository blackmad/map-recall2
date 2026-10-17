import { siteLinks, type SiteLinks } from './siteLinks';

/**
 * Map Quest's view of the site. `vite build --mode quiz` is the copy served at
 * `/quiz/` on the Canal Recall site, where the ride, the landing page and the
 * extracts sit at the root of the same origin. Every other build (dev server,
 * GitHub Pages) keeps Canal Recall in the `canal-drive/` tree beneath it.
 */
const onCanalSite = import.meta.env.MODE === 'quiz';
const base = siteLinks(onCanalSite ? 'canal-site' : 'dev', import.meta.env.BASE_URL);

export const mapQuestSite: SiteLinks = {
  ...base,
  // A split-origin build can still point the ride at another host.
  ride: (!onCanalSite && import.meta.env.VITE_CANAL_RECALL_URL) || base.ride,
};

/** A file inside the canal-drive tree (hoisted to the root on the Canal Recall site). */
export const canalAssetUrl = (path: string) => `${mapQuestSite.canal}${path}`;
