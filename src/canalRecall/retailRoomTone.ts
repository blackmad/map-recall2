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

/** A filler fits a shop when its mean luminance is within this band of the signature's: much darker cannot be
 *  brightened to match, much brighter goes murky when darkened (blind round 1, 2026-11-20: 8-6-2, the losses a bright
 *  room darkened to mud and a pane swapped for a brighter one). */
export const TONE_LUM_BAND: readonly [number, number] = [0.7, 1.35];
/** How far the tint may move hue per channel. Zero: a brightness match only (blind round 1: a full per-channel ratio
 *  turned a pink poster cyan; round 2 at 0.12 still cast posters cyan, 4 of its 5 losses). */
export const TONE_HUE_SLACK = 0;
/** The darkest the brightness match goes. */
export const TONE_MIN_SCALE = 0.62;

const lumRatio = (kind: GoodsKind, filler: FillerKind) => lum(rgb(GOODS_ROOM_TONE[kind])) / Math.max(1, lum(rgb(FILLER_ROOM_TONE[filler])));

/** Whether a filler's room can be brought to the signature's (TONE_LUM_BAND). */
export function toneFits(kind: GoodsKind, filler: FillerKind): boolean {
  const r = lumRatio(kind, filler);
  return r >= 1 / TONE_LUM_BAND[1] && r <= 1 / TONE_LUM_BAND[0];
}

/** How far a filler is from the band (0 inside it): picks the nearest when no filler of a set fits. */
export function toneDistance(kind: GoodsKind, filler: FillerKind): number {
  const r = Math.log(lumRatio(kind, filler));
  return Math.max(0, Math.log(1 / TONE_LUM_BAND[1]) - r, r - Math.log(1 / TONE_LUM_BAND[0]));
}

/** The colour a filler tile is multiplied by so its room takes the signature's: the luminance ratio (never above 1,
 *  never under TONE_MIN_SCALE) times each channel's chroma ratio held within 1 ± TONE_HUE_SLACK. */
export function toneTint(kind: GoodsKind, filler: FillerKind): string {
  const s = rgb(GOODS_ROOM_TONE[kind]), f = rgb(FILLER_ROOM_TONE[filler]), ls = Math.max(1, lum(s)), lf = Math.max(1, lum(f));
  const scale = Math.max(TONE_MIN_SCALE, Math.min(1, ls / lf));
  const ch = s.map((c, i) => Math.max(1 - TONE_HUE_SLACK, Math.min(1 + TONE_HUE_SLACK, (c / ls) / (Math.max(1, f[i]) / lf))));
  const top = Math.max(...ch.map(c => c * scale));
  return '#' + ch.map(c => Math.round(255 * c * scale / Math.max(1, top)).toString(16).padStart(2, '0')).join('');
}
