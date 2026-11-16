// Chains with their own fronts (lane retail-real-20261115): every chain with 3+ Amsterdam shop POIs, counted from the
// template Overpass answer by scripts/retail-real/fetch-chain-logos.ts and tabled by build-chain-logos.ts in
// retailChains.gen.ts (key, names, brand:wikidata, the shop type's template, fascia and letter colours). Round 6's ten
// chain templates (ah, jumbo, ...) keep theirs; every other chain draws its type's template (supermarket aisles, a
// fast-food counter, a clothes shop's mannequins) under its own board, logo and colours. The template extract carries
// the chain as the word '@<key>' (build-templates.ts), so its row format is unchanged. Pure.
import { RETAIL_CHAINS_GEN } from './retailChains.gen.js';
import type { RetailTemplate } from './retailTemplates.js';

export type RetailChain = { name: string; word: string; wikidata?: string; names: string[]; template: RetailTemplate; fascia: string; letters: string; pois: number };
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
