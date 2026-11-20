// Window variety across a shop's panes (lane shop-variety-20261120; David 2026-11-20: "can we work on less repeats in
// shopfronts? like this place wouldn't have four doners, this wouldn't have gelato in every window").
//
// A template's goods cell (retailGoods.ts) is its signature display. Before this lane every pane tile of a front showed
// it (four doner spits, gelato in every window). Now the signature takes the window it belongs in, the tile beside the
// door (or, without a door or one time in four, the middle of the widest bay), and the other tiles take that kind of
// shop's pane set (retailPaneFillers.ts): seating and diners, a menu poster, a fridge, a dim room with lamps, a promo
// poster, the counter and till, shelving, a plant against the glass, a half-drawn blind. A shop whose stock really does
// fill every window (a supermarket, a bookshop, a florist) keeps the signature on most tiles ('most') with a filler or
// two among them; a counter shop shows it once ('once'). Seeded by the pand, so neighbours of one template differ.
//
// Pure planning: no triangles. retailFront.ts draws the same tiles and swaps a filler tile's layer and uv, so a front's
// triangle count is unchanged.
import { hash01 } from './shopProps/kit.js';
import type { GoodsKind } from './retailGoods.js';
import type { FillerKind } from './retailPaneFillers.js';
import { toneDistance, toneFits } from './retailRoomTone.js';

type G = { location?: { search?: string }; process?: { env?: Record<string, string | undefined> }; __canalRecallShopVariety?: boolean };
/** Default on since its blind A/B (2026-11-20, one opus judge, photo | A | B at the panorama poses, sides shuffled):
 *  round 1 15-0 with two regressions flagged (a bottle-wall fridge in doner windows, gelato diluted), fixed; round 2
 *  15-2, both losses the bottle shelving in souvenir windows, fixed; round 3 on the re-framed gelato and souvenir fronts
 *  6-0, no regression flagged. `?shopVariety=0` (SHOP_VARIETY=0) turns it off. */
export const SHOP_VARIETY_DEFAULT = true;
export function shopVarietyEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]shopVariety=([01])\b/.exec(search)?.[1] : undefined;
  const v = q ?? (env === '0' || env === '1' ? env : undefined);
  return v === undefined ? SHOP_VARIETY_DEFAULT : v === '1';
}
let cached: boolean | undefined;
/** The flag for this page or worker (engine/workerPool.ts forwards it) or process; a test sets `__canalRecallShopVariety`. */
export function shopVarietyOn(): boolean {
  const g = globalThis as G;
  if (typeof g.__canalRecallShopVariety === 'boolean') return g.__canalRecallShopVariety;
  return (cached ??= shopVarietyEnabled(g.location?.search ?? null, g.process?.env?.SHOP_VARIETY ?? null));
}

/** A goods kind's pane set: how often the signature shows ('once': one tile; 'most': the door's tile and about
 *  `share` of the rest) and the fillers its other tiles draw from. Absent: every tile the signature (exempt). */
export type PaneSet = { signature: 'once' | 'most'; share?: number; /** 'most': at most this share of the tiles (rounded, at least one). */ maxShare?: number; fillers: readonly FillerKind[] };

/** Every goods kind's pane set. Exempt: automatiek (FEBO's wall of hatches is the whole front) and redWindow (lane R's
 *  window front draws its own panes). */
export const PANE_SETS: Readonly<Partial<Record<GoodsKind, PaneSet>>> = {
  // Takeaway and sit-down food: the counter display once, the room's other windows show tables, fridges and posters.
  doner: { signature: 'once', fillers: ['tablesBright', 'drinksFridge', 'menuPoster', 'windowBar'] },
  frites: { signature: 'once', fillers: ['tablesBright', 'menuPoster', 'drinksFridge', 'windowBar'] },
  fastfood: { signature: 'most', share: 0.4, fillers: ['tablesBright', 'menuPoster', 'windowBar'] },
  pizza: { signature: 'once', fillers: ['tablesWarm', 'tablesBright', 'drinksFridge', 'menuPoster'] },
  bainMarie: { signature: 'once', fillers: ['tablesBright', 'drinksFridge', 'wallShelves', 'menuPoster'] },
  bowls: { signature: 'once', fillers: ['tablesBright', 'windowBar', 'plantGlass', 'lamps'] },
  deli: { signature: 'once', fillers: ['tablesWarm', 'windowBar', 'drinksFridge', 'wallShelves'] },
  // Blind round 1: one case in four panes diluted the ijssalon; the counter shows on about half the panes.
  gelato: { signature: 'most', share: 0.35, maxShare: 0.5, fillers: ['tablesWarm', 'tablesBright', 'windowBar', 'menuPoster'] },
  waffles: { signature: 'once', fillers: ['tablesBright', 'menuPoster', 'windowBar', 'lamps'] },
  pancakes: { signature: 'once', fillers: ['tablesWarm', 'lamps', 'plantGlass', 'blind'] },
  // Cafés and bars: tables are the signature, so it may repeat; the quieter windows break the run.
  cafe: { signature: 'most', share: 0.45, fillers: ['lamps', 'windowBar', 'plantGlass', 'blind'] },
  // The dark rooms keep dark fillers (a lit filler beside a dark signature read as another shop).
  brownBar: { signature: 'most', share: 0.45, fillers: ['lamps', 'blind', 'lounge'] },
  coffeeshop: { signature: 'once', fillers: ['lounge', 'lamps', 'blind'] },
  // Food shops: a bakery's and a butcher's counter once; a cheese shop, greengrocer, florist stock every window.
  bread: { signature: 'once', fillers: ['counterTill', 'tablesWarm', 'plinthDisplay'] },
  butcher: { signature: 'once', fillers: ['counterTill', 'drinksFridge', 'wallShelves', 'promoPoster'] },
  cheese: { signature: 'most', share: 0.7, fillers: ['counterTill', 'wallShelves', 'plinthDisplay'] },
  produce: { signature: 'most', share: 0.6, fillers: ['counterTill', 'wallShelves'] },
  flowers: { signature: 'most', share: 0.6, fillers: ['counterTill', 'plantGlass'] },
  jars: { signature: 'most', share: 0.55, fillers: ['counterTill', 'wallShelves', 'plinthDisplay'] },
  liquor: { signature: 'most', share: 0.55, fillers: ['counterTill', 'promoPoster', 'wallShelves'] },
  ducks: { signature: 'most', share: 0.7, fillers: ['plinthDisplay', 'counterTill'] },
  // Stock shops: shelves and racks in most windows, a campaign poster, the till or a dressed plinth among them.
  aisles: { signature: 'most', share: 0.6, fillers: ['promoPoster', 'counterTill', 'drinksFridge'] },
  drugstore: { signature: 'most', share: 0.55, fillers: ['promoPoster', 'counterTill', 'plinthDisplay'] },
  pharmacy: { signature: 'most', share: 0.5, fillers: ['promoPoster', 'counterTill', 'plinthDisplay'] },
  cosmetics: { signature: 'most', share: 0.5, fillers: ['promoPoster', 'plinthDisplay', 'counterTill'] },
  books: { signature: 'most', share: 0.6, fillers: ['plinthDisplay', 'counterTill', 'lamps'] },
  magazines: { signature: 'most', share: 0.55, fillers: ['promoPoster', 'counterTill', 'drinksFridge'] },
  clothing: { signature: 'most', share: 0.5, fillers: ['plinthDisplay', 'promoPoster', 'counterTill', 'plantGlass'] },
  shoes: { signature: 'most', share: 0.5, fillers: ['plinthDisplay', 'promoPoster', 'counterTill'] },
  optician: { signature: 'most', share: 0.45, fillers: ['plinthDisplay', 'promoPoster', 'counterTill'] },
  phones: { signature: 'most', share: 0.45, fillers: ['promoPoster', 'counterTill', 'plinthDisplay'] },
  // Blind round 2: wall shelving (bottles) read as a liquor shop in a souvenir window.
  souvenirs: { signature: 'most', share: 0.6, fillers: ['promoPoster', 'counterTill', 'plinthDisplay'] },
  tobacco: { signature: 'most', share: 0.5, fillers: ['promoPoster', 'counterTill', 'drinksFridge'] },
  smartshop: { signature: 'once', fillers: ['lounge', 'lamps', 'blind'] },
  // Services: one display (the rate board, a tattoo flash wall), the rest posters, blinds and the room.
  exchange: { signature: 'once', fillers: ['promoPoster', 'blind', 'plantGlass'] },
  hair: { signature: 'most', share: 0.5, fillers: ['lamps', 'plantGlass', 'promoPoster', 'counterTill'] },
  tattoo: { signature: 'once', fillers: ['lounge', 'lamps', 'blind'] },
  bikes: { signature: 'most', share: 0.6, fillers: ['counterTill', 'promoPoster'] },
};

/** One pane tile of a front: its span along the wall (m) and its window bay (tiles of one bay share the glass). */
export type PlanTile = { a0: number; a1: number; bay: number };
/** What a tile shows: the signature goods cell, or a filler. */
export type PaneContent = { signature: true } | { signature: false; filler: FillerKind };

/** The tile the signature belongs in: beside the door (three times in four when there is one), else the middle of the
 *  widest bay. */
export function signatureTile(tiles: readonly PlanTile[], doors: ReadonlyArray<readonly [number, number]>, seed: string): number {
  if (!tiles.length) return -1;
  if (doors.length && hash01(`${seed}:sigDoor`) < 0.75) {
    let best = 0, bestD = Infinity;
    for (const [i, t] of tiles.entries()) for (const [d0, d1] of doors) {
      const d = Math.max(0, t.a0 - d1, d0 - t.a1);
      if (d < bestD - 1e-6) { bestD = d; best = i; }
    }
    return best;
  }
  const width = new Map<number, number>();
  for (const t of tiles) width.set(t.bay, (width.get(t.bay) ?? 0) + (t.a1 - t.a0));
  const bay = [...width.entries()].sort((p, q) => q[1] - p[1] || p[0] - q[0])[0][0];
  const own = tiles.map((t, i) => ({ t, i })).filter(x => x.t.bay === bay), mid = (own[0].t.a0 + own[own.length - 1].t.a1) / 2;
  return own.slice().sort((p, q) => Math.abs((p.t.a0 + p.t.a1) / 2 - mid) - Math.abs((q.t.a0 + q.t.a1) / 2 - mid) || p.i - q.i)[0].i;
}

/**
 * Each tile's content for a front of `kind` (tiles in order along the wall). Exempt kinds and one-tile fronts: all
 * signature. 'once': the signature tile only; 'most': the signature tile and about `share` of the rest, at least one
 * filler on three or more tiles. Fillers come from a seeded deck of the set (each used before any repeats), never the
 * same filler on two neighbouring tiles.
 */
export function planPanes(kind: GoodsKind, tiles: readonly PlanTile[], doors: ReadonlyArray<readonly [number, number]>, seed: string): PaneContent[] {
  const set = PANE_SETS[kind];
  if (!set || tiles.length <= 1) return tiles.map(() => ({ signature: true }));
  const sig = signatureTile(tiles, doors, seed);
  const isSig = tiles.map((_, i) => i === sig || (set.signature === 'most' && hash01(`${seed}:most${i}`) < (set.share ?? 0.5)));
  if (set.signature === 'most' && tiles.length >= 3 && isSig.every(Boolean)) {
    // At least one filler: the tile furthest from the signature.
    const far = tiles.map((_, i) => i).sort((p, q) => Math.abs(q - sig) - Math.abs(p - sig))[0];
    isSig[far] = false;
  }
  if (set.maxShare !== undefined) {
    // Over the cap: the signatures furthest from the signature tile become fillers.
    const cap = Math.max(1, Math.round(tiles.length * set.maxShare));
    const extra = tiles.map((_, i) => i).filter(i => isSig[i] && i !== sig).sort((p, q) => Math.abs(q - sig) - Math.abs(p - sig));
    const over = isSig.filter(Boolean).length - cap;
    for (let k = 0; k < over && k < extra.length; k++) isSig[extra[k]] = false;
  }
  // One room per shop (retailRoomTone.ts): fillers far from the signature's brightness leave the deck; the two nearest always stay (no repeats).
  const fits = set.fillers.filter(f => toneFits(kind, f));
  const fillers = fits.length >= 2 ? fits : set.fillers.slice().sort((p, q) => toneDistance(kind, p) - toneDistance(kind, q)).slice(0, 2);
  const deck: FillerKind[] = [];
  const refill = (k: number) => deck.push(...fillers.map((f, j) => ({ f, r: hash01(`${seed}:deck${k}:${j}`) })).sort((p, q) => p.r - q.r).map(x => x.f));
  const draw = (prev: FillerKind | undefined, k: number): FillerKind => {
    if (!deck.length) refill(k);
    let at = deck.findIndex(f => f !== prev);
    if (at < 0 && fillers.length > 1) { refill(k + 1000); at = deck.findIndex(f => f !== prev); }
    return deck.splice(Math.max(0, at), 1)[0];
  };
  let prev: FillerKind | undefined;
  return isSig.map((s, i) => {
    if (s) { prev = undefined; return { signature: true }; }
    const filler = draw(prev, i); prev = filler;
    return { signature: false, filler };
  });
}
