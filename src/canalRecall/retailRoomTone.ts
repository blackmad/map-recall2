// One room per shop.
//
// Round l (2026-11-20; David: "these now look like they are different stores due to differing ambient colors") tinted
// each filler tile to the signature's measured brightness. It did not fix the room: every goods cell (retailGoods.ts)
// and pane filler (retailPaneFillers.ts) still painted its own back wall, floor and lights, so one café's windows looked
// into a bottle-shelf room, a white poster wall with a plant, and a café with pendant lamps (David 2026-11-21, on
// Bagels & Beans, Coffee Company and IJscuypje: "these still look very inconsistent").
//
// Round m (lane shop-one-room-20261121): a real shop shows ONE room through all its windows. The goods kinds fall into a
// few room families (bright shop, cream takeaway, pastel sweets, warm wood, dark). With the shop-variety flag on, a
// signature cell paints on its family's room (retailGoods.ts paintGoods), and each filler is painted once per family on
// that same room (retailPaneFillers.ts), so a shop's panes share wall, floor, dado, ceiling lights and the glass's
// light level exactly, and differ only in what stands in the room. No tint: the tile keeps its own colours.
import type { GoodsKind } from './retailGoods.js';
import type { FillerKind } from './retailPaneFillers.js';

export const ROOM_FAMILIES = ['shop', 'takeaway', 'sweet', 'warm', 'dark'] as const;
export type RoomFamily = (typeof ROOM_FAMILIES)[number];

/** A family's room: back wall, floor, a dado band along the lower wall (the line that runs on through every pane),
 *  ceiling light colour and count, and how lit the room reads through the glass (retailGoods glassOver). */
export type RoomSpec = { wall: string; floor: string; dado: string; light: string; lights: number; lit: number };

/** Each family's room, from the signature painters' own rooms (retailGoods.ts room() calls) at the family's middle. */
export const FAMILY_ROOMS: Readonly<Record<RoomFamily, RoomSpec>> = {
  // Supermarket, chemist, phones, clothes, souvenirs: white walls under strip lights, pale floor.
  shop: { wall: '#eeebe4', floor: '#c4bdb2', dado: '#e2ded6', light: '255,252,242', lights: 2, lit: 0.85 },
  // Doner, frites, pizza, toko: cream walls, a darker tiled floor, warm white strips.
  takeaway: { wall: '#f1e6cf', floor: '#9a8a70', dado: '#e4d6ba', light: '255,240,210', lights: 2, lit: 0.72 },
  // Ijssalon, waffles: a pink-white room.
  sweet: { wall: '#f8e6ec', floor: '#c8a8b2', dado: '#efd4de', light: '255,246,250', lights: 2, lit: 0.78 },
  // Café, bakery, pancakes, cheese, books, greengrocer, florist: warm plaster over wood panelling, wood floor.
  warm: { wall: '#c49a70', floor: '#6a4a30', dado: '#8a6440', light: '255,214,150', lights: 3, lit: 0.58 },
  // Brown bar, coffeeshop, smartshop, tattoo, tobacco, liquor, hair, cosmetics: dark wood, warm low light.
  dark: { wall: '#33281f', floor: '#1e1712', dado: '#24190f', light: '255,200,140', lights: 2, lit: 0.3 },
};

/** Each goods kind's room family. Absent (automatiek, redWindow): the front is its own window, no fillers. */
export const ROOM_FAMILY_OF: Readonly<Partial<Record<GoodsKind, RoomFamily>>> = {
  aisles: 'shop', drugstore: 'shop', pharmacy: 'shop', phones: 'shop', magazines: 'shop', souvenirs: 'shop', optician: 'shop',
  clothing: 'shop', shoes: 'shop', exchange: 'shop', bikes: 'shop', butcher: 'shop', jars: 'shop', ducks: 'shop',
  doner: 'takeaway', frites: 'takeaway', fastfood: 'takeaway', pizza: 'takeaway', bainMarie: 'takeaway', bowls: 'takeaway', deli: 'takeaway',
  gelato: 'sweet', waffles: 'sweet',
  cafe: 'warm', pancakes: 'warm', bread: 'warm', cheese: 'warm', produce: 'warm', flowers: 'warm', books: 'warm',
  brownBar: 'dark', coffeeshop: 'dark', smartshop: 'dark', tattoo: 'dark', hair: 'dark', cosmetics: 'dark', tobacco: 'dark', liquor: 'dark',
};

/** The fillers painted on each family's room (one atlas cell each): only what suits that family's shops. */
export const FAMILY_FILLERS: Readonly<Record<RoomFamily, readonly FillerKind[]>> = {
  shop: ['promoPoster', 'counterTill', 'plinthDisplay', 'drinksFridge', 'blind'],
  takeaway: ['tablesBright', 'drinksFridge', 'menuPoster', 'windowBar'],
  sweet: ['tablesBright', 'windowBar', 'menuPoster'],
  warm: ['tablesWarm', 'counterTill', 'wallShelves', 'lamps', 'windowBar', 'plinthDisplay', 'plantGlass'],
  dark: ['lounge', 'lamps', 'counterTill', 'promoPoster', 'plinthDisplay'],
};

/** A goods kind's family room, if it has one. */
export function roomOf(kind: GoodsKind): RoomSpec | undefined {
  const f = ROOM_FAMILY_OF[kind];
  return f ? FAMILY_ROOMS[f] : undefined;
}
