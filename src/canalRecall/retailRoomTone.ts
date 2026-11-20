// One room per shop (David 2026-11-20, on the Shopfronts page after shop-variety: "these now look like they are
// different stores due to differing ambient colors"). Every goods cell (retailGoods.ts) and pane filler
// (retailPaneFillers.ts) paints its own room. Beside a cafe's warm brown room, a white-tiled seating filler and a dark
// reflecting plant window read as three shops. The filler panes of a front now take the signature's room: each filler
// tile is tinted by the per-channel ratio of the two cells' mean colours (the filler pages carry a full tint mask, so
// the tile's colour multiplies the texture and can only darken it), and a filler much darker than the signature (it
// cannot be brightened to match) leaves that shop's deck.
//
// The table is measured from the painters (scripts/retail-real/room-tones.ts --write); retailRoomTone.test.ts fails when
// a repainted cell leaves it stale.
import type { GoodsKind } from './retailGoods.js';
import type { FillerKind } from './retailPaneFillers.js';

// <room-tones>
/** Each goods cell's mean colour as painted. */
export const GOODS_ROOM_TONE: Readonly<Record<GoodsKind, string>> = {
  aisles: '#968b79', drugstore: '#b2acaf', bread: '#8f7558', butcher: '#a29d9b', cheese: '#695036', produce: '#614d3e',
  flowers: '#57584e', books: '#56483e', phones: '#838481', gelato: '#a79f9f', waffles: '#ad9396', doner: '#8c7e70',
  souvenirs: '#91877f', tobacco: '#5c5243', exchange: '#4d5052', bikes: '#7c7e7e', coffeeshop: '#33352a',
  smartshop: '#44414b', clothing: '#887c74', magazines: '#938b83', ducks: '#b5a97e', deli: '#918c80', bowls: '#a5a596',
  automatiek: '#a88c6c', fastfood: '#7c7265', bainMarie: '#988f82', jars: '#93887a', liquor: '#564c42',
  hair: '#4d4e4d', pharmacy: '#a7abac', frites: '#a09371', cafe: '#796853', optician: '#a9a7a5', shoes: '#958f88',
  cosmetics: '#756e67', pancakes: '#7a4331', brownBar: '#3e3227', pizza: '#746a5a', redWindow: '#752434',
  tattoo: '#4b4745',
};
/** Each pane filler's mean colour as painted. */
export const FILLER_ROOM_TONE: Readonly<Record<FillerKind, string>> = {
  tablesBright: '#9f9892', tablesWarm: '#7e6956', windowBar: '#92897e', drinksFridge: '#99979a', menuPoster: '#807163',
  lamps: '#534535', promoPoster: '#a2786e', plinthDisplay: '#8d877c', counterTill: '#857669', wallShelves: '#6e5d49',
  plantGlass: '#797468', blind: '#888073', lounge: '#3a322c',
};
// </room-tones>

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const lum = ([r, g, b]: readonly number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** A filler whose mean is under this share of the signature's luminance cannot be tinted to match and is left out. */
export const TONE_MIN_LUM = 0.7;
/** The darkest a tint channel goes (a bright filler beside a near-black signature stays legible). */
export const TONE_MIN_CHANNEL = 0.3;

/** Whether a filler's room can be tinted to the signature's (not much darker than it). */
export function toneFits(kind: GoodsKind, filler: FillerKind): boolean {
  return lum(rgb(FILLER_ROOM_TONE[filler])) >= TONE_MIN_LUM * lum(rgb(GOODS_ROOM_TONE[kind]));
}

/** The colour a filler tile is multiplied by so its room takes the signature's: per channel signature / filler mean,
 *  clamped to [TONE_MIN_CHANNEL, 1]. '#ffffff' when the filler is already no brighter in any channel. */
export function toneTint(kind: GoodsKind, filler: FillerKind): string {
  const s = rgb(GOODS_ROOM_TONE[kind]), f = rgb(FILLER_ROOM_TONE[filler]);
  return '#' + s.map((c, i) => Math.round(255 * Math.max(TONE_MIN_CHANNEL, Math.min(1, c / Math.max(1, f[i])))).toString(16).padStart(2, '0')).join('');
}
