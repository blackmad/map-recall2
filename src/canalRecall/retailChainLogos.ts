// Chain logos beyond round 6's ten (lane retail-real-20261115; David 2026-11-15: web sources allowed, with source URL
// and fetch date in provenance.json). scripts/retail-real/build-chain-logos.ts fetches each chain's logo, trims it,
// shelf-packs the logos by aspect onto 512 px pages (public/canal-drive/materials/retail-logos/chains-<n>.png) on the
// chain's fascia colour, and writes their rects to retailChainLogos.gen.ts. Pure: the mesh worker reads it.
import { CHAIN_LOGO_PACK } from './retailChainLogos.gen.js';

export const CHAIN_LOGO_PAGES: number = CHAIN_LOGO_PACK.pages;
export const chainLogoPath = (page: number) => `materials/retail-logos/chains-${page + 1}.png`;
/** A chain's logo: its page (0-based among the chain pages), uv rect (u0, v0, u1, v1; v up) and aspect. */
export function chainLogo(key: string): { page: number; rect: [number, number, number, number]; aspect: number } | null {
  const l = CHAIN_LOGO_PACK.logos[key];
  if (!l) return null;
  const [page, x, y, w, h] = l, P = CHAIN_LOGO_PACK.size;
  return { page, rect: [x / P, 1 - (y + h) / P, (x + w) / P, 1 - y / P], aspect: w / h };
}
/** Lane retail-real: round-6 templates that draw a chain-page logo in place of theirs (Albert Heijn's full lockup)
 *  or where they had none (FEBO, Stach, SLA lettered before), when that logo is on the pages. */
export const TEMPLATE_CHAIN_LOGO: Readonly<Record<string, string>> = { ah: 'ah-wordmark', febo: 'febo', stach: 'stach', sla: 'sla' };
