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

/** Default on since 2026-11-15 (round n); `?retailGround=0` / RETAIL_GROUND=0 turn it off. */
import type { GoodsKind } from './retailGoods.js';
import type { TypeFace } from './retailTypeFaces.js';
import { retailRealAllOn, retailRealOn } from './retailPages.js';

export const RETAIL_GROUND_DEFAULT = true;
export function retailGroundEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]retailGround=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? RETAIL_GROUND_DEFAULT : v === '1';
}
/** Templates held back while the look is on: their fronts draw as before (the flag-off cell and no template mesh)
 *  until they win a blind photo review. brownBar: café Hendrix (feedback 7be6c55a) drew as an opaque dark box with a row
 *  of lit dots, worse than the glazed brown-café cell (round n, 2026-11-15, artifacts/round-n/hendrix-on). */
export const RETAIL_HELD: readonly string[] = ['brownBar'];
/** Bay kinds whose cell keeps the flag-off painter while the look is on (the brownBar template's cell kind). */
export const RETAIL_HELD_KINDS: readonly string[] = ['shopBar'];
let cached: boolean | undefined;
/** The flag for this page or process (a test may set `__canalRecallRetailGround`). */
export function retailGroundOn(): boolean {
  const g = globalThis as { __canalRecallRetailGround?: boolean; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  if (typeof g.__canalRecallRetailGround === 'boolean') return g.__canalRecallRetailGround;
  return (cached ??= retailGroundEnabled(g.location?.search ?? null, g.process?.env?.RETAIL_GROUND ?? null));
}

/** Measured pui proportions as fractions of the ground cell (width = one bay, height = the ground storey). */
export const PUI = {
  /** Glass share of the cell's width (Haarlemmerdijk median 0.63 of the whole front, door and posts included; a cell is
   *  one bay of it, and the bay's glass runs nearly post to post: round 3 raised it from 0.74, whose painted surrounds
   *  between the panes read as a pale wall with windows in it). */
  glassShare: 0.9,
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
 * Round 3c (lane retail-look-20261114): the uv rect (v up) of a puiAt cell's glass below its transom bar (bayTextures.ts
 * puiAt: the bar 27 % down the glass, 12 px with its shadow at 340 px). A template pane's interior is one quad of it,
 * in place of its flat-colour goods.
 */
export function puiInteriorUv(): [number, number, number, number] {
  const glassH = 1 - PUI.riser - PUI.glassTop, below = PUI.glassTop + glassH * 0.27 + 12 / 340, x = (1 - PUI.glassShare) / 2 + 0.03;
  return [x, PUI.riser + 0.005, 1 - x, 1 - below];
}

/**
 * The templates in priority order: a pand with several POIs takes the earliest (a chain over a type). Tiers (David,
 * 2026-11-14): chains, coffeeshops, smart/headshops, brown cafes and bike shops first; then food types; then the
 * tourist tier; gelato and exchange last.
 */
export const RETAIL_TEMPLATES = [
  'ah', 'jumbo', 'dirk', 'etos', 'hema', 'action', 'febo', 'stach', 'sla', 'bruna', 'bestseller', 'duck', 'moneyTransfer',
  'gallgall', 'mcdonalds', 'kruidvat',
  'coffeeshop', 'smartshop', 'brownBar', 'bike', 'redLight',
  'doner', 'toko', 'butcher', 'greengrocer', 'florist', 'apotheek', 'hairdresser', 'turkishBakery', 'bakery', 'nuts', 'frites', 'cheese', 'waffle', 'pancake',
  'souvenir', 'books', 'tobacco', 'phone', 'gelato', 'exchange',
  // Lane retail-real: the shop types other chains draw under their own board (retailChains.ts); only a chain is given
  // one, and only with retailReal on.
  'supermarket', 'chemist', 'fastFood', 'pizza', 'restaurant', 'cafe', 'clothes', 'shoes', 'optician', 'telecom', 'cosmetics', 'liquor', 'variety',
  // Lane retail-real (coordinator 2026-11-15, De Wallen): tattoo studios and snack bars, by type; only with retailReal on.
  'tattoo', 'snackbar',
] as const;
/** The chain-type templates (lane retail-real): drawn only for a chain, only with retailReal on. */
export const CHAIN_TYPE_TEMPLATES: readonly RetailTemplate[] = ['supermarket', 'chemist', 'fastFood', 'pizza', 'restaurant', 'cafe', 'clothes', 'shoes', 'optician', 'telecom', 'cosmetics', 'liquor', 'variety'];
/** Templates that exist only with retailReal on (`?retailReal=0` draws those pands as round n did: no template). */
export const REAL_ONLY_TEMPLATES: readonly RetailTemplate[] = [...CHAIN_TYPE_TEMPLATES, 'tattoo', 'snackbar'];
export type RetailTemplate = (typeof RETAIL_TEMPLATES)[number];
export const CHAIN_TEMPLATES: readonly RetailTemplate[] = ['ah', 'jumbo', 'dirk', 'etos', 'hema', 'action', 'febo', 'stach', 'sla', 'bruna', 'bestseller', 'duck', 'moneyTransfer', 'gallgall', 'mcdonalds', 'kruidvat'];

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
  [/^gall ?& ?gall\b/, 'gallgall'], [/^mcdonald'?s\b/, 'mcdonalds'], [/^kruidvat\b/, 'kruidvat'],
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
  // A bloemist (round 6): shop=florist, or a named garden shop selling flowers.
  if (shop === 'florist' || shop === 'garden_centre' && /bloem|flower|fleur|plant/.test(name)) return 'florist';
  // Round 6b: an apotheek (amenity=pharmacy; a drugstore chain is matched above) and a kapper or barber.
  if (amenity === 'pharmacy') return 'apotheek';
  if (shop === 'hairdresser') return 'hairdresser';
  if (shop === 'bakery' && (has(cuisine, /^turkish$/) || /f[ıi]r[ıi]n|bakkerij (öz|oz|ay|yil|yıl|kar|ist)|turk|pide|simit|baklava/.test(name))) return 'turkishBakery';
  if (amenity && FOOD.has(amenity) && has(cuisine, /^(friture|fries|chips)$/)) return 'frites';
  // Lane retail-real: a snack bar (cafetaria, snackbar, frituur by name) and a tattoo studio; only with retailReal on.
  if (retailRealOn() && amenity === 'fast_food' && /snack|cafetaria|frituur|friterie|patat|eethuis/.test(name)) return 'snackbar';
  if (retailRealOn() && shop === 'tattoo') return 'tattoo';
  if (shop === 'cheese') return 'cheese';
  if (/waffle|wafel|nutella/.test(name)) return 'waffle';
  // A Dutch bakker or banketbakker (Bakkerij Bart, Vlaamsch Broodhuys, Le Fournil, Hartering, Hartog: name lettering).
  if (shop === 'bakery' || shop === 'pastry') return 'bakery';
  // A notenbar: shop=nuts, a 'noten' name, or a confectionery (Jamin and the like).
  if (shop === 'nuts' || /noten/.test(name) || shop === 'confectionery') return 'nuts';
  if (has(cuisine, /^pancakes?$/)) return 'pancake';
  if (shop === 'gift' || shop === 'souvenir') return 'souvenir';
  if (shop === 'books' || shop === 'newsagent' && /boek|book|athenaeum/.test(name)) return 'books';
  // A sigarenwinkel (David, round 2): shop=tobacco; a newsagent that is not a station chain, bookshop or Bestseller
  // (Primera, Cigo and the independents sell tobacco and lottery); a kiosk named for tobacco or lottery.
  if (shop === 'tobacco' || shop === 'newsagent' && !/relay|whsmith|athenaeum|boek|book|bestseller|ako\b/.test(name)
    || shop === 'kiosk' && /tabak|tobac|sigar|primera|cigo|vivant|lotto/.test(name)) return 'tobacco';
  if (shop === 'mobile_phone') return 'phone';
  if (amenity === 'ice_cream' || shop === 'ice_cream') return 'gelato';
  if (amenity === 'bureau_de_change') return 'exchange';
  return null;
}

/** Window content the front builder draws behind (or in front of) the glass. */
export type Content = 'shelves' | 'salon' | 'barGlow' | 'menu' | 'bainMarie' | 'meat' | 'produce' | 'bread' | 'automatiek' | 'deli' | 'bowls'
  | 'books' | 'magazines' | 'placards' | 'ducks' | 'souvenirs' | 'cheese' | 'frosted' | 'neon' | 'bikes' | 'redGlow' | 'counter' | 'stickers' | 'waffles' | 'curtains' | 'jars';
/** What a template draws. Colours are house colours or measured street colours; chains with a sourced logo also draw it
 *  from the logo layer (retailLogos.ts). */
export type TemplateLook = {
  /** Lane retail-real: the window-goods cell its panes show (retailGoods.ts), in place of the building's shop cell. */
  goods?: GoodsKind;
  /** Lane retail-real: the lettering face for its word (retailTypeFaces.ts); absent: round 3c's bold sans. */
  face?: TypeFace;
  fascia: string; letters: string;
  /** The word on the fascia; `name` uses the POI's name (staged with the extract), else no lettering. */
  word?: string | 'name';
  content: Content;
  /** Lit interior: the content draws in lit (unshaded) colours. */
  lit: boolean;
  /** A straight awning over the window, in this colour. */
  awning?: string;
  /** Round 6: the pavement racks' colour (Kruidvat's red); absent: the template's blue. */
  rack?: string;
  /** What stands on the pavement in front (crates, racks, bikes in a row). */
  pavement?: 'crates' | 'racks' | 'promo' | 'bikes' | 'boards' | 'flowers';
  /** Tube light round the window (red-light rows), and the glow colour. */
  tube?: string;
  /** A hanging blade sign in this colour (brown cafes, pancake houses). */
  blade?: string;
  /** The door's width (m) when narrower than FRONT.doorM (a sigarenwinkel's narrow door). */
  doorM?: number;
  /** Window frame and door colour (round 2); absent: a dark grey-brown. */
  frame?: string;
  /** The whole front under the fascia in this colour (a brown cafe's dark timber), over the cell's painted surround. */
  surround?: string;
  /** Round 3: panes at most this wide (m) where the front is small-paned (a cafe's), with glazing bars in the transom
   *  lights; absent: FRONT.paneMaxM, plain transom lights. */
  paneM?: number;
  /** Round 3: the fascia's cornice cap colour; absent: the fascia a step darker. */
  cap?: string;
  /** Round 7 (retailBrandStyles.ts): `wall` puts the letters straight on the building's wall, with no fascia board or
   *  cap (FEBO's red channel letters on stone); absent: the board. */
  mount?: 'wall';
  /** Round 7: the blade sign's glyph (FEBO's F) and its ink, on both faces; absent: a plain box. */
  bladeGlyph?: string;
  bladeInk?: string;
  /** Round 7: `plate` glazes the panes as dark reflective plate glass, with no goods (the interior is the shop-interiors
   *  lane's); absent: goods or the template's content. */
  window?: 'plate';
};
const LOOKS_N: Record<RetailTemplate, TemplateLook> = {
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
  // Round 6, measured on open panoramas (data/retail-ground/template-samples.json chains): Gall & Gall, Utrechtsestraat
  // and three more: a near-black board (#282221) and front (#140e0f) with off-white letters (#d6d4c8); one historic
  // branch is cream (held as the exception). McDonald's: charcoal or dark burgundy bands with white letters (Damrak
  // McCafe, Leidsestraat, Ferdinand Bolstraat); its golden M wants the second logo layer (not drawn yet).
  // Round 6b: both draw their Commons logo from the second logo page (retailLogos.ts LOGOS_2); the glyph cell has & and '.
  gallgall: { fascia: '#282221', letters: '#e6e3d6', word: 'GALL & GALL', content: 'shelves', lit: true, frame: '#2a2321' },
  mcdonalds: { fascia: '#2b2422', letters: '#ffffff', word: "McDONALD'S", content: 'counter', lit: true, frame: '#3a3533' },
  // Round 6b, from the fixed sampler's cuts (Ferdinand Bolstraat, Overtoom area, Javastraat, Bos en Lommerweg): red
  // window frames (measured #95090d and #852629, drawn #a4201c by retailPuiPaint.ts drawnPaint), red decals, a red
  // logo box over the door and red product racks out front. The board takes the brand red of its Commons logo
  // (#e3061f, David 2026-11-15: a chain's sign colour may come from its logo; frames stay measured).
  kruidvat: { fascia: '#e3061f', letters: '#ffffff', word: 'KRUIDVAT', content: 'shelves', lit: true, frame: '#a4201c', pavement: 'promo', rack: '#c8102e' },
  coffeeshop: { fascia: '#1f5a2e', letters: '#e8f0d8', word: 'name', content: 'frosted', lit: false },
  smartshop: { fascia: '#2a1640', letters: '#ff4fd8', word: 'name', content: 'neon', lit: true },
  brownBar: { fascia: '#24160e', letters: '#e2c48a', word: 'name', content: 'barGlow', lit: false, blade: '#7a1f12', frame: '#2a1a10', surround: '#2e1c12', paneM: 1.3 },
  bike: { fascia: '#22313a', letters: '#ffffff', word: 'name', content: 'bikes', lit: false, pavement: 'bikes' },
  redLight: { fascia: '#2a0a12', letters: '#2a0a12', content: 'redGlow', lit: true, tube: '#ff2a3a' },
  doner: { fascia: '#d42a1e', letters: '#ffffff', word: 'name', content: 'menu', lit: true },
  toko: { fascia: '#f3e7c9', letters: '#7a1f12', word: 'name', content: 'bainMarie', lit: true },
  butcher: { fascia: '#b3121b', letters: '#ffffff', word: 'SLAGERIJ', content: 'meat', lit: true },
  greengrocer: { fascia: '#2f6b2a', letters: '#ffffff', word: 'name', content: 'produce', lit: false, awning: '#2f6b2a', pavement: 'crates' },
  // Round 6, from open panoramas (scripts/retail-ground/front-photos.ts, data/retail-ground/template-samples.json):
  // Het Groene Paradijs (green awnings, plant tables), Hugo's (green awnings, plant racks), Sevgi bloemhuis (green and
  // white awning, white board, green letters, buckets out front), Arjan bloemen (dark grey awnings, a plant table and
  // potted olives), Fleurmonde (dark board, white script). The pavement display is the signature; the awning green.
  // Round 6b, from the fixed sampler's cuts (data/retail-ground/template-samples.json): De Ruyter Apotheek (white board,
  // blue-grey 'apotheek', a green cross; board #909697 in shade, letters #4f5b68, cross #325649, drawn by
  // retailPuiPaint.ts drawnPaint), Ferdinand Bol Apotheek (white board, blue letters, red doors), Transvaal Alphega
  // (green signs, white frames). The cross hangs as a blade.
  apotheek: { fascia: '#dfe6e7', letters: '#5c6875', word: 'APOTHEEK', content: 'shelves', lit: true, frame: '#dfe6e7', blade: '#3e6254' },
  // Barbershop (black front, off-white letters: band #2b2825, letters #a0a59d), Hofman Kappers (black awnings, white
  // letters), a barber's grey glass band with white letters: a dark band, pale letters; frames vary (left to the cell).
  hairdresser: { fascia: '#403c39', letters: '#e1e6de', word: 'name', content: 'salon', lit: false },
  florist: { fascia: '#24382c', letters: '#f4f1ea', word: 'name', content: 'produce', lit: false, awning: '#2f5d3f', pavement: 'flowers' },
  turkishBakery: { fascia: '#f2b01e', letters: '#7a1f12', word: 'name', content: 'bread', lit: true },
  bakery: { fascia: '#f3e7c9', letters: '#6b3a1e', word: 'name', content: 'bread', lit: true },
  nuts: { fascia: '#f2b01e', letters: '#1d1d1b', word: 'name', content: 'jars', lit: true },
  frites: { fascia: '#f7c600', letters: '#c4161c', word: 'FRITES', content: 'counter', lit: true },
  cheese: { fascia: '#f2c230', letters: '#3b2a12', word: 'KAAS', content: 'cheese', lit: true },
  waffle: { fascia: '#ff6fa8', letters: '#ffffff', word: 'name', content: 'waffles', lit: true },
  pancake: { fascia: '#7a1f12', letters: '#f3e7c9', word: 'name', content: 'curtains', lit: true, blade: '#c9a227', paneM: 1.2 },
  souvenir: { fascia: '#c4161c', letters: '#ffffff', word: 'SOUVENIRS', content: 'souvenirs', lit: true, pavement: 'racks' },
  books: { fascia: '#1f2a24', letters: '#d9b765', word: 'name', content: 'books', lit: true, pavement: 'boards' },
  tobacco: { fascia: '#6e1216', letters: '#ffd200', word: 'TABAK LOTTO', content: 'placards', lit: true, blade: '#1a3a8f', doorM: 0.8, frame: '#2a2420' },
  phone: { fascia: '#1d1d1b', letters: '#ffdd00', word: 'PHONE', content: 'stickers', lit: true },
  gelato: { fascia: '#f6b6c8', letters: '#5a2340', word: 'GELATO', content: 'counter', lit: true },
  exchange: { fascia: '#0a3d91', letters: '#ffffff', word: 'EXCHANGE', content: 'stickers', lit: true },
  // Lane retail-real chain types: the chain's own colours replace fascia and letters (retailFront.ts input.chain).
  supermarket: { fascia: '#ffffff', letters: '#1d1d1b', content: 'shelves', lit: true },
  chemist: { fascia: '#ffffff', letters: '#1d1d1b', content: 'shelves', lit: true },
  fastFood: { fascia: '#2b2422', letters: '#ffffff', content: 'counter', lit: true },
  pizza: { fascia: '#c4161c', letters: '#ffffff', content: 'counter', lit: true },
  restaurant: { fascia: '#2b2422', letters: '#ffffff', content: 'counter', lit: false },
  cafe: { fascia: '#2b2422', letters: '#ffffff', content: 'counter', lit: false },
  clothes: { fascia: '#1d1d1b', letters: '#ffffff', content: 'shelves', lit: true },
  shoes: { fascia: '#1d1d1b', letters: '#ffffff', content: 'shelves', lit: true },
  optician: { fascia: '#ffffff', letters: '#1d1d1b', content: 'shelves', lit: true },
  telecom: { fascia: '#1d1d1b', letters: '#ffffff', content: 'stickers', lit: true },
  cosmetics: { fascia: '#1d1d1b', letters: '#ffffff', content: 'shelves', lit: true },
  liquor: { fascia: '#282221', letters: '#ffffff', content: 'shelves', lit: true },
  variety: { fascia: '#ffffff', letters: '#1d1d1b', content: 'shelves', lit: true },
  tattoo: { fascia: '#1d1d1b', letters: '#e8dcc0', word: 'name', content: 'neon', lit: false },
  snackbar: { fascia: '#1d1d1b', letters: '#f2d16b', word: 'name', content: 'counter', lit: true },
};

/** Lane retail-real (2026-11-15): what each template's window shows and the face its name is lettered in. Blind round 1
 *  (held-out fronts, r1): butcher 0-1-0 and hairdresser 0-1-1 lost with goods (a busy display where the photo's glass is
 *  dark), so they are not accepted (REAL_ACCEPTED); round 4 re-judges them with a lit room (hairdresser lit). Snackbar
 *  0-2-0 lost on an invented red fascia (now dark). */
export const TEMPLATE_REAL: Record<RetailTemplate, Partial<Pick<TemplateLook, 'goods' | 'face' | 'lit'>>> = {
  ah: { goods: 'aisles' }, jumbo: { goods: 'aisles' }, dirk: { goods: 'aisles' }, etos: { goods: 'drugstore' }, hema: { goods: 'drugstore' },
  action: { goods: 'aisles' }, febo: { goods: 'automatiek' }, stach: { goods: 'deli' }, sla: { goods: 'bowls' }, bruna: { goods: 'magazines' },
  bestseller: { goods: 'magazines' }, duck: { goods: 'ducks' }, moneyTransfer: { goods: 'exchange', face: 'condensed' }, gallgall: { goods: 'liquor' },
  mcdonalds: { goods: 'fastfood' }, kruidvat: { goods: 'drugstore' },
  coffeeshop: { goods: 'coffeeshop', face: 'script' }, smartshop: { goods: 'smartshop', face: 'condensed' }, brownBar: { goods: 'brownBar', face: 'serif' },
  bike: { goods: 'bikes', face: 'condensed' }, redLight: { goods: 'redWindow' },
  doner: { goods: 'doner', face: 'condensed' }, toko: { goods: 'bainMarie', face: 'condensed' }, butcher: { goods: 'butcher', face: 'serif' },
  greengrocer: { goods: 'produce', face: 'condensed' }, florist: { goods: 'flowers', face: 'script' }, apotheek: { goods: 'pharmacy' },
  hairdresser: { goods: 'hair', face: 'serif', lit: true }, turkishBakery: { goods: 'bread', face: 'condensed' }, bakery: { goods: 'bread', face: 'script' },
  nuts: { goods: 'jars', face: 'script' }, frites: { goods: 'frites', face: 'condensed' }, cheese: { goods: 'cheese', face: 'serif' },
  waffle: { goods: 'waffles', face: 'script' }, pancake: { goods: 'pancakes', face: 'serif' }, souvenir: { goods: 'souvenirs', face: 'condensed' },
  books: { goods: 'books', face: 'serif' }, tobacco: { goods: 'tobacco', face: 'serif' }, phone: { goods: 'phones', face: 'condensed' },
  gelato: { goods: 'gelato', face: 'script' }, exchange: { goods: 'exchange', face: 'condensed' },
  supermarket: { goods: 'aisles' }, chemist: { goods: 'drugstore' }, fastFood: { goods: 'fastfood' }, pizza: { goods: 'pizza' },
  restaurant: { goods: 'cafe' }, cafe: { goods: 'cafe' }, clothes: { goods: 'clothing' }, shoes: { goods: 'shoes' }, optician: { goods: 'optician' },
  telecom: { goods: 'phones' }, cosmetics: { goods: 'cosmetics' }, liquor: { goods: 'liquor' }, variety: { goods: 'aisles' },
  tattoo: { goods: 'tattoo', face: 'serif' }, snackbar: { goods: 'frites', face: 'condensed' },
};
/**
 * The templates whose retail-real look won its blind photo A/B on held-out fronts (lane retail-real, 2026-11-16: r1 37
 * fronts, r2 38; wins-losses-ties real vs round n). Every other template keeps round n's look under retailReal, and a
 * real-only template (CHAIN_TYPE_TEMPLATES, tattoo, snackbar) not listed is not drawn. `?retailRealAll=1` lifts this for
 * candidate frames.
 */
export const REAL_ACCEPTED: ReadonlySet<RetailTemplate> = new Set<RetailTemplate>([
  'redLight', // 3-0-3, and lane R's part (2-0 in its own review)
  'brownBar', // 5-0-2 with Hendrix (feedback 7be6c55a) a win
  'coffeeshop', 'souvenir', 'cheese', 'smartshop', 'tobacco', 'doner', 'bakery', 'books', 'phone', 'gelato', // each a net win, no loss
  'snackbar', // 0-2-0 with the red board, 2-0-1 with the dark one
  'tattoo', // 2-1-2
  'shoes', 'supermarket', 'clothes', 'cafe', 'chemist', 'cosmetics', // chain types, each a net win
]);
/**
 * Round 4 (lane retail-real, after the r1/r2 judges' notes): template parts the photos show and the fronts lacked, drawn
 * only with `?retailParts=1` (retailPages.ts) until a blind win. `shutter`: the roller-shutter box under the fascia and
 * its guide rails (the shutter itself stays up: an open shop); `neon`: a lit sign hung in the pane by the door; `glass`:
 * the name (or a word) lettered on the glass in white, in the template's face.
 */
export type TemplateParts = { shutter?: boolean; neon?: { text: string; hex: string }; glass?: 'name' | string };
export const TEMPLATE_PARTS: Partial<Record<RetailTemplate, TemplateParts>> = {
  phone: { shutter: true, neon: { text: 'OPEN', hex: '#ff4f7a' } }, telecom: { shutter: true },
  tobacco: { shutter: true }, souvenir: { shutter: true }, exchange: { shutter: true, neon: { text: 'EXCHANGE', hex: '#3fe0ff' } },
  moneyTransfer: { shutter: true }, toko: { shutter: true }, doner: { shutter: true, neon: { text: 'OPEN', hex: '#ff4f7a' } },
  smartshop: { shutter: true, neon: { text: 'OPEN', hex: '#ff4f7a' } }, coffeeshop: { neon: { text: 'OPEN', hex: '#57ff6a' } },
  snackbar: { neon: { text: 'OPEN', hex: '#ff4f7a' } }, tattoo: { neon: { text: 'TATTOO', hex: '#ff3b3b' } },
  // Glass lettering only over a dark room: a letter quad is opaque (its board colour fills round the glyph), so on a
  // lit room it reads as a dark plate (bakery, butcher, cheese tried in the Node sheet, 2026-11-16, and dropped).
  brownBar: { neon: { text: 'HEINEKEN', hex: '#ff3b3b' }, glass: 'name' },
};
export const realAccepted = (t: string): boolean => retailRealAllOn() || REAL_ACCEPTED.has(t as RetailTemplate);
const LOOKS_REAL = Object.fromEntries(Object.entries(LOOKS_N).map(([k, v]) => [k, { ...v, ...TEMPLATE_REAL[k as RetailTemplate] }])) as Record<RetailTemplate, TemplateLook>;
/** The templates' looks: with retailReal (retailPages.ts) the goods and faces are added; `?retailReal=0` is round n's. */
export const TEMPLATE_LOOKS: Record<RetailTemplate, TemplateLook> = new Proxy(LOOKS_N, { get: (_, k: string) => (retailRealOn() && realAccepted(k) ? LOOKS_REAL : LOOKS_N)[k as RetailTemplate] });

export const TRADE_WORDS = /^(BAKKERIJ|BAKKER|WARME|BANKETBAKKERIJ|KEURSLAGERIJ|SLAGERIJ|SLAGER|GROENTE|FRUIT|GROENTEN|RESTAURANT|SNACKBAR|SIGARENMAGAZIJN|TABAK|KAAS|KAASHANDEL)$/;
/** A name's words with trade words dropped when the business's own name remains; the trade alone otherwise. */
export const ownWords = (all: string[]): string[] => { const own = all.filter(w => !TRADE_WORDS.test(w)); return own.length ? own : all; };
/** The fascia text for a staged word: drops a trade word when the own name is also staged. A row staged before round 3b
 *  that kept only the trade ('BAKKERIJ' for Bakkerij Verhagen, the name cut at 14 chars) needs a re-stage to recover it. */
export const signText = (word: string): string => ownWords(word.split(/\s+/).filter(Boolean)).join(' ');
/** The lettering for a POI's name on a fascia: the block-letter alphabet's characters only (A-Z, 0-9, space), accents
 *  folded, generic words ("Coffeeshop", "Café") dropped, at most 14 characters; '' when nothing is left. */
export function signWord(name: string): string {
  const folded = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ');
  const all = folded.split(/\s+/).filter(w => w && !/^(COFFEESHOP|COFFEE|SHOP|CAFE|EETCAFE|AMSTERDAM|BV|THE|DE|HET)$/.test(w));
  // Round 3b: a trade word (Bakkerij Verhagen, Keurslagerij Pouw) gives way to the business's own name when there is one;
  // a name that is only the trade keeps it.
  const words = ownWords(all);
  let out = '';
  for (const w of words) { const next = out ? `${out} ${w}` : w; if (next.length > 14) break; out = next; }
  return out || (words[0] ?? '').slice(0, 14);
}

