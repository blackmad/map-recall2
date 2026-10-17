/**
 * Where the three Map Recall surfaces live relative to each other.
 *
 * Two layouts exist:
 * - `canal-site`: the public site (canalrecall.blackmad.com). The landing page
 *   is the root, the ride is `/ride` (a Hosting rewrite onto `ride.html`, the
 *   hoisted Canal Recall page), Map Quest is `/quiz/`, and the extracts are
 *   `/data/`. Everything is one origin, so links are root-relative.
 * - `dev`: the dev server and the legacy one-origin build. Map Quest is the
 *   root, Canal Recall is `canal-drive/` beneath it, and the landing page is
 *   `canal-drive/landing.html`.
 *
 * The edumap host now redirects to `/quiz/` on the Canal Recall site, so there
 * is no third, split-origin layout left to support.
 */
export type SiteLayout = 'canal-site' | 'dev';

export interface SiteLinks {
  /** Landing page. Carries `?home` on the public site so it never forwards a returning player. */
  home: string;
  /** Canal Recall, the 3D ride. */
  ride: string;
  /** Map Quest, the 2D map quiz. */
  quiz: string;
  /** Root of the canal-drive tree (landmark gallery, credits, privacy live here). */
  canal: string;
  /** Root of the versioned extracts (`…/data/`). */
  data: string;
}

/** `prefix` is the path above the canal-drive tree in the dev layout (Vite's BASE_URL). */
export function siteLinks(layout: SiteLayout, prefix = '/'): SiteLinks {
  if (layout === 'canal-site') {
    return { home: '/?home', ride: '/ride', quiz: '/quiz/', canal: '/', data: '/data/' };
  }
  const base = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const canal = `${base}canal-drive/`;
  return { home: `${canal}landing.html`, ride: canal, quiz: base, canal, data: `${base}data/` };
}

/**
 * Layout of a page inside the canal-drive tree, judged from its own path: in the
 * dev layout every such page sits under `/…/canal-drive/`; on the public site
 * the tree is hoisted to the root and that segment is gone.
 */
export function canalPageLinks(pathname: string): SiteLinks {
  const marker = '/canal-drive/';
  const at = pathname.indexOf(marker);
  return at < 0 ? siteLinks('canal-site') : siteLinks('dev', pathname.slice(0, at + 1));
}

/** Set by the ride on load; the landing page forwards a returning player straight to it. */
export const RETURNING_PLAYER_KEY = 'canalRecall.returningPlayer.v1';

export function markReturningPlayer(storage: Pick<Storage, 'setItem'> | undefined): void {
  try {
    storage?.setItem(RETURNING_PLAYER_KEY, '1');
  } catch {
    // Private mode or blocked storage: the landing page simply shows again.
  }
}
