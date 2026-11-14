// Retail ground floors (lane retail-ground-20261114, `?retailGround=1`, RETAIL_GROUND=1 in Node; default off).
//
// Two halves, both read by the generic shopfront path only when the flag is on:
//   1. The measured shopfront ("pui") every shop cell draws: one wide pane over a stall riser, a fascia band above, a
//      thin frame, no painted props. The figures are Haarlemmerdijk's 66 traced shop fronts
//      (data/front-records/haarlemmerdijk-traces.json, lane 1): the glass takes a median 63 % of the front's width
//      (p10 38 %, p90 92 %), one pane in most (no muntins), the head stands about 0.7 m under the fascia top, an
//      awning on 3 of 66, the fascia pale or dark in about equal shares.
//   2. Shopfront templates from OSM tags (David, 2026-11-14): chains (Albert Heijn, Jumbo, Dirk, Etos, HEMA, Action,
//      FEBO) and types (brown cafe, doner, toko takeaway, butcher, greengrocer, Turkish bakery). `templateForTags`
//      is the one classifier; scripts/retail-ground/build-templates.ts hosts the POIs on pands and stages the extract.
//
// Off: nothing here is called and every cell, layer and feature is as before.

/** Default off; the URL flag or the env switch turns it on (`retailGround=0` / RETAIL_GROUND=0 force it off). */
export const RETAIL_GROUND_DEFAULT = false;
export function retailGroundEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]retailGround=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? RETAIL_GROUND_DEFAULT : v === '1';
}
let cached: boolean | undefined;
/** The flag for this page or process (a test may set `__canalRecallRetailGround`). */
export function retailGroundOn(): boolean {
  const g = globalThis as { __canalRecallRetailGround?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallRetailGround === 'boolean') return g.__canalRecallRetailGround;
  return (cached ??= retailGroundEnabled(g.location?.search ?? null, g.process?.env?.RETAIL_GROUND ?? null));
}

/** Measured pui proportions as fractions of the ground cell (width = one bay, height = the ground storey). */
export const PUI = {
  /** Glass share of the cell's width (Haarlemmerdijk median 0.63 of the whole front; a cell is one bay of it). */
  glassShare: 0.74,
  /** Stall riser: the glass's sill over the pavement, as a share of the storey (0.45-0.6 m of 3.3-4 m). */
  riser: 0.15,
  /** The fascia band: its top and bottom as shares of the storey from the top. */
  fasciaTop: 0.06,
  fasciaBottom: 0.2,
  /** The glass head: just under the fascia, with a transom bar on some. */
  glassTop: 0.24,
  /** Frame width in px at 520 px a bay. */
  framePx: 9,
} as const;

/**
 * The templates in priority order: a pand with several POIs takes the earliest (a chain over a type). Tiers (David,
 * 2026-11-14): chains, coffeeshops, smart/headshops, brown cafes and bike shops first; then food types; then the
 * tourist tier; gelato and exchange last.
 */
export const RETAIL_TEMPLATES = [
  'ah', 'jumbo', 'dirk', 'etos', 'hema', 'action', 'febo', 'stach', 'sla', 'bruna', 'bestseller', 'duck', 'moneyTransfer',
  'coffeeshop', 'smartshop', 'brownBar', 'bike', 'redLight',
  'doner', 'toko', 'butcher', 'greengrocer', 'turkishBakery', 'bakery', 'nuts', 'frites', 'cheese', 'waffle', 'pancake',
  'souvenir', 'books', 'phone', 'gelato', 'exchange',
] as const;
export type RetailTemplate = (typeof RETAIL_TEMPLATES)[number];
export const CHAIN_TEMPLATES: readonly RetailTemplate[] = ['ah', 'jumbo', 'dirk', 'etos', 'hema', 'action', 'febo', 'stach', 'sla', 'bruna', 'bestseller', 'duck', 'moneyTransfer'];

/** brand:wikidata ids (checked against the 2026-11-14 Overpass answer: brand + wikidata pairs per name). */
const WIKIDATA: Record<string, RetailTemplate> = {
  Q1653985: 'ah', Q77971185: 'ah', Q78163765: 'ah',
  Q2262314: 'jumbo', Q124846605: 'jumbo', Q124846526: 'jumbo',
  Q17502722: 'dirk', Q2609459: 'etos', Q903805: 'hema', Q2634111: 'action', Q582245: 'febo', Q124807442: 'stach', Q3317555: 'bruna',
};
const NAMES: Array<[RegExp, RetailTemplate]> = [
  [/^(albert heijn|ah to go|ah\b)/, 'ah'], [/^jumbo( city| foodmarkt)?$/, 'jumbo'], [/^dirk( van den broek| vd broek)?$/, 'dirk'],
  [/^etos\b/, 'etos'], [/^hema$/, 'hema'], [/^action$/, 'action'], [/^febo\b/, 'febo'], [/^stach\b/, 'stach'], [/^sla$/, 'sla'],
  [/^bruna\b/, 'bruna'], [/^bestsellers?( amsterdam)?$/, 'bestseller'], [/duck(s)? store/, 'duck'],
  [/western union|^ria\b|moneygram/, 'moneyTransfer'],
];
const has = (list: string | undefined, re: RegExp) => !!list && list.toLowerCase().split(/[;,]/).some(v => re.test(v.trim()));
const FOOD = new Set(['fast_food', 'restaurant']);

/**
 * The template an OSM shop or amenity's tags ask for, or null (the plain measured pui). Chains first (brand:wikidata,
 * then brand or name), then the types. Upper-floor businesses are the caller's to drop (`level` > 0).
 */
export function templateForTags(tags: Record<string, string>): RetailTemplate | null {
  const name = (tags.name ?? '').trim().toLowerCase(), label = (tags.brand ?? tags.name ?? '').trim().toLowerCase();
  const { amenity, shop } = tags, cuisine = tags.cuisine;
  // A chain's pick-up point or restaurant (HEMA restaurant, Jumbo Pick Up Point, Chinees restaurant Jumbo) is not its front.
  const notFront = /pick ?up|restaurant|e-store|chinees/.test(name);
  if (!notFront) {
    const byId = WIKIDATA[tags['brand:wikidata'] ?? ''];
    if (byId) return byId;
    const hit = NAMES.find(([re]) => re.test(label) || re.test(name));
    // Western Union and friends also on brand:wikidata-less agents; a plain amenity=money_transfer too.
    if (hit) return hit[1];
  }
  if (amenity === 'money_transfer') return 'moneyTransfer';
  if (shop === 'cannabis' && !/head ?shop/.test(name)) return 'coffeeshop';
  if (/coffee ?shop/.test(name) && amenity === 'bar') return 'coffeeshop';
  if (shop === 'smartshop' || shop === 'head_shop' || /smart ?shop|head ?shop/.test(name)) return 'smartshop';
  if (amenity === 'pub') return 'brownBar';
  if (amenity === 'bar' && !/cocktail|lounge|club|wine|sky|rooftop|hotel|barney/.test(name) && tags.bar !== 'cocktail') return 'brownBar';
  if (amenity === 'cafe' && /^(caf[eé]|eetcaf[eé]|proeflokaal|tapperij|bodega)(?=[\s']|$)/.test(name) && !has(cuisine, /coffee_shop/)) return 'brownBar';
  if (shop === 'bicycle' || amenity === 'bicycle_rental' && !!name) return 'bike';
  // Window brothels: unnamed (or name:signed=no) amenity=brothel nodes; named clubs are not window rows.
  if (amenity === 'brothel' && (!tags.name || tags['name:signed'] === 'no')) return 'redLight';
  if (amenity && FOOD.has(amenity) && (has(cuisine, /^(kebab|doner|döner|shawarma|turkish)$/) || /d[oö]ner|kebab|shoarma|shawarma/.test(name))) return 'doner';
  if (amenity && FOOD.has(amenity) && (has(cuisine, /^(indonesian|surinamese|chinese_indonesian)$/) || /\btoko\b|roti/.test(name))) return 'toko';
  if (/\btoko\b/.test(name) && (shop || amenity)) return 'toko';
  if (shop === 'butcher') return 'butcher';
  if (shop === 'greengrocer') return 'greengrocer';
  if (shop === 'convenience' && (has(tags.produce, /./) || /groente|fruit|verse|agf/.test(name))) return 'greengrocer';
  if (shop === 'bakery' && (has(cuisine, /^turkish$/) || /f[ıi]r[ıi]n|bakkerij (öz|oz|ay|yil|yıl|kar|ist)|turk|pide|simit|baklava/.test(name))) return 'turkishBakery';
  if (amenity && FOOD.has(amenity) && has(cuisine, /^(friture|fries|chips)$/)) return 'frites';
  if (shop === 'cheese') return 'cheese';
  if (/waffle|wafel|nutella/.test(name)) return 'waffle';
  // A Dutch bakker or banketbakker (Bakkerij Bart, Vlaamsch Broodhuys, Le Fournil, Hartering, Hartog: name lettering).
  if (shop === 'bakery' || shop === 'pastry') return 'bakery';
  // A notenbar: shop=nuts, a 'noten' name, or a confectionery (Jamin and the like).
  if (shop === 'nuts' || /noten/.test(name) || shop === 'confectionery') return 'nuts';
  if (has(cuisine, /^pancakes?$/)) return 'pancake';
  if (shop === 'gift' || shop === 'souvenir') return 'souvenir';
  if (shop === 'books' || shop === 'newsagent' && /boek|book|athenaeum/.test(name)) return 'books';
  if (shop === 'mobile_phone') return 'phone';
  if (amenity === 'ice_cream' || shop === 'ice_cream') return 'gelato';
  if (amenity === 'bureau_de_change') return 'exchange';
  return null;
}

/** Window content the front builder draws behind (or in front of) the glass. */
export type Content = 'shelves' | 'barGlow' | 'menu' | 'bainMarie' | 'meat' | 'produce' | 'bread' | 'automatiek' | 'deli' | 'bowls'
  | 'books' | 'magazines' | 'ducks' | 'souvenirs' | 'cheese' | 'frosted' | 'neon' | 'bikes' | 'redGlow' | 'counter' | 'stickers' | 'waffles' | 'curtains' | 'jars';
/** What a template draws. Colours are house colours or measured street colours; chains with a sourced logo also draw it
 *  from the logo layer (retailLogos.ts). */
export type TemplateLook = {
  fascia: string; letters: string;
  /** The word on the fascia; `name` uses the POI's name (staged with the extract), else no lettering. */
  word?: string | 'name';
  content: Content;
  /** Lit interior: the content draws in lit (unshaded) colours. */
  lit: boolean;
  /** A straight awning over the window, in this colour. */
  awning?: string;
  /** What stands on the pavement in front (crates, racks, bikes in a row). */
  pavement?: 'crates' | 'racks' | 'bikes' | 'boards';
  /** Tube light round the window (red-light rows), and the glow colour. */
  tube?: string;
  /** A hanging blade sign in this colour (brown cafes, pancake houses). */
  blade?: string;
  /** Window frame and door colour (round 2); absent: a dark grey-brown. */
  frame?: string;
  /** The whole front under the fascia in this colour (a brown cafe's dark timber), over the cell's painted surround. */
  surround?: string;
};
export const TEMPLATE_LOOKS: Record<RetailTemplate, TemplateLook> = {
  ah: { fascia: '#00a0e2', letters: '#ffffff', word: 'ALBERT HEIJN', content: 'shelves', lit: true },
  jumbo: { fascia: '#ffcc00', letters: '#1d1d1b', word: 'JUMBO', content: 'shelves', lit: true },
  dirk: { fascia: '#e30613', letters: '#ffffff', word: 'DIRK', content: 'shelves', lit: true },
  etos: { fascia: '#f4f4f4', letters: '#0b4f9c', word: 'ETOS', content: 'shelves', lit: true },
  hema: { fascia: '#e2001a', letters: '#ffffff', word: 'HEMA', content: 'shelves', lit: true },
  action: { fascia: '#f4f4f4', letters: '#0a58a8', word: 'ACTION', content: 'shelves', lit: true },
  febo: { fascia: '#f6d300', letters: '#d0101b', word: 'FEBO', content: 'automatiek', lit: true },
  stach: { fascia: '#f3efe6', letters: '#1d1d1b', word: 'STACH', content: 'deli', lit: true },
  sla: { fascia: '#ffffff', letters: '#2f7d32', word: 'SLA', content: 'bowls', lit: true },
  bruna: { fascia: '#0a3d91', letters: '#ffd200', word: 'BRUNA', content: 'magazines', lit: true },
  bestseller: { fascia: '#1d1d1b', letters: '#ffffff', word: 'BESTSELLER', content: 'magazines', lit: true, pavement: 'racks' },
  duck: { fascia: '#ffd400', letters: '#1d1d1b', word: 'DUCK STORE', content: 'ducks', lit: true },
  moneyTransfer: { fascia: '#ffdd00', letters: '#1d1d1b', word: 'MONEY TRANSFER', content: 'stickers', lit: true },
  coffeeshop: { fascia: '#1f5a2e', letters: '#e8f0d8', word: 'name', content: 'frosted', lit: false },
  smartshop: { fascia: '#2a1640', letters: '#ff4fd8', word: 'name', content: 'neon', lit: true },
  brownBar: { fascia: '#24160e', letters: '#e2c48a', word: 'name', content: 'barGlow', lit: false, blade: '#7a1f12', frame: '#2a1a10', surround: '#2e1c12' },
  bike: { fascia: '#22313a', letters: '#ffffff', word: 'name', content: 'bikes', lit: false, pavement: 'bikes' },
  redLight: { fascia: '#2a0a12', letters: '#2a0a12', content: 'redGlow', lit: true, tube: '#ff2a3a' },
  doner: { fascia: '#d42a1e', letters: '#ffffff', word: 'name', content: 'menu', lit: true },
  toko: { fascia: '#f3e7c9', letters: '#7a1f12', word: 'name', content: 'bainMarie', lit: true },
  butcher: { fascia: '#b3121b', letters: '#ffffff', word: 'SLAGERIJ', content: 'meat', lit: true },
  greengrocer: { fascia: '#2f6b2a', letters: '#ffffff', word: 'name', content: 'produce', lit: false, awning: '#2f6b2a', pavement: 'crates' },
  turkishBakery: { fascia: '#f2b01e', letters: '#7a1f12', word: 'name', content: 'bread', lit: true },
  bakery: { fascia: '#f3e7c9', letters: '#6b3a1e', word: 'name', content: 'bread', lit: true },
  nuts: { fascia: '#f2b01e', letters: '#1d1d1b', word: 'name', content: 'jars', lit: true },
  frites: { fascia: '#f7c600', letters: '#c4161c', word: 'FRITES', content: 'counter', lit: true },
  cheese: { fascia: '#f2c230', letters: '#3b2a12', word: 'KAAS', content: 'cheese', lit: true },
  waffle: { fascia: '#ff6fa8', letters: '#ffffff', word: 'name', content: 'waffles', lit: true },
  pancake: { fascia: '#7a1f12', letters: '#f3e7c9', word: 'name', content: 'curtains', lit: true, blade: '#c9a227' },
  souvenir: { fascia: '#c4161c', letters: '#ffffff', word: 'SOUVENIRS', content: 'souvenirs', lit: true, pavement: 'racks' },
  books: { fascia: '#1f2a24', letters: '#d9b765', word: 'name', content: 'books', lit: true, pavement: 'boards' },
  phone: { fascia: '#1d1d1b', letters: '#ffdd00', word: 'PHONE', content: 'stickers', lit: true },
  gelato: { fascia: '#f6b6c8', letters: '#5a2340', word: 'GELATO', content: 'counter', lit: true },
  exchange: { fascia: '#0a3d91', letters: '#ffffff', word: 'EXCHANGE', content: 'stickers', lit: true },
};

/** The lettering for a POI's name on a fascia: the block-letter alphabet's characters only (A-Z, 0-9, space), accents
 *  folded, generic words ("Coffeeshop", "Café") dropped, at most 14 characters; '' when nothing is left. */
export function signWord(name: string): string {
  const folded = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ');
  const words = folded.split(/\s+/).filter(w => w && !/^(COFFEESHOP|COFFEE|SHOP|CAFE|EETCAFE|AMSTERDAM|BV|THE|DE|HET)$/.test(w));
  let out = '';
  for (const w of words) { const next = out ? `${out} ${w}` : w; if (next.length > 14) break; out = next; }
  return out || (words[0] ?? '').slice(0, 14);
}
