// Chains with their own fronts (lane retail-real-20261115): every chain with 3+ Amsterdam shop POIs, counted from the
// template Overpass answer by scripts/retail-real/fetch-chain-logos.ts and tabled by build-chain-logos.ts in
// retailChains.gen.ts (key, names, brand:wikidata, the shop type's template, fascia and letter colours). Round 6's ten
// chain templates (ah, jumbo, ...) keep theirs; every other chain draws its type's template (supermarket aisles, a
// fast-food counter, a clothes shop's mannequins) under its own board, logo and colours. The template extract carries
// the chain as the word '@<key>' (build-templates.ts), so its row format is unchanged. Pure.
import { RETAIL_CHAINS_GEN } from './retailChains.gen.js';
import type { RetailTemplate } from './retailTemplates.js';

export type RetailChain = {
  name: string; word: string; wikidata?: string; names: string[]; template: RetailTemplate; fascia: string; letters: string; pois: number;
  /** Lane chain-logos2-20261120: the chain's own pui frame and awning colours (chain-overrides.json), drawn wherever the
   *  pand has no measured frame or awning of its own (Simon Meijssen's amber-glazed pilasters and brown awning). */
  frame?: string; awning?: string;
  /** Lane chain-logos2 (Lidl, "make sign fit"): the logo is a square lightbox panel of this colour at the front's end,
   *  flush with the board's top and hanging over the transom (about 1 m), on a plain board, as on Lidl's fronts. */
  logoPanel?: string;
};
export const RETAIL_CHAINS: Record<string, RetailChain> = RETAIL_CHAINS_GEN as Record<string, RetailChain>;
const byWikidata = new Map<string, string>(), byName = new Map<string, string>();
for (const [k, c] of Object.entries(RETAIL_CHAINS)) { if (c.wikidata) byWikidata.set(c.wikidata, k); for (const n of c.names) byName.set(n.toLowerCase(), k); }
/** The chain an OSM node's tags name (brand:wikidata, then brand or name exactly), or null. */
export function chainForTags(tags: Record<string, string>): string | null {
  const id = tags['brand:wikidata']; if (id && byWikidata.has(id)) return byWikidata.get(id)!;
  for (const v of [tags.brand, tags.name]) { const k = v && byName.get(v.trim().toLowerCase()); if (k) return k; }
  return null;
}
/** The chain key a staged template word names ('@lidl'), or null. */
export const chainOfWord = (word: string | undefined): string | null => (word && word.startsWith('@') ? word.slice(1) : null);
/** Lane chain-logos-20261116 (David 2026-11-16, "BENU has specific branding we are missing"): chains that draw their own
 *  board, letters and logo under their type's template even where that template's real look has not won its blind
 *  (Benu's pands are apotheek fronts, which otherwise letter APOTHEEK), and even where that template is real-only
 *  (lane chain-logos2). Its goods still follow the template. */
export const CHAINS_OWN_FRONT: ReadonlySet<string> = new Set(['benu',
  // Lane chain-logos2-20261120 (David's Shopfronts notes of 2026-11-20, "find logo"): chains of a real-only type template
  // that has not won its blind (fast food, restaurant, optician, telecom, liquor, variety) drew no front at all; these
  // draw it under their own board and logo (round n's window, not the type's goods).
  'new-york-pizza', 'domino-s', 'subway', 'de-pizzabakkers', 'pearle', 'odido', 'grapedistrict', 'gamma', 'blokker']);
export const chainOwnFront = (key: string): boolean => CHAINS_OWN_FRONT.has(key);
