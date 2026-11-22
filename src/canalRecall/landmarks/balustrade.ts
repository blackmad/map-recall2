/**
 * Layout of a stone balustrade: a plinth, a row of turned balusters between end posts (and optional intermediate posts),
 * and a handrail on top.
 *
 * Why (2026-11-22, landmark lane r10-C, muziekschool-jacob-van-campen): the former Openbare Muziekschool on the Eerste
 * Jacob van Campenstraat (Publieke Werken, 1882; gemeentelijk monument) has "een natuurstenen balustrade boven de ingang"
 * under the first-floor window of the middle axis: five fat balusters between two square posts on a stone plinth, with a
 * moulded rail (panoramas TMX7316010203-002115_pano_0000_002717 and TMX7316010203-002455_pano_0001_000826). Builders drew
 * balustrades by hand with a loop of boxes at a guessed pitch (Academie van Bouwkunst, Carre, De Roos ...), so the count
 * drifted with the width and the last baluster could touch a post. This says "n balusters evenly spaced in the clear
 * span" once. Pure layout, no three.js; nothing changes for models that do not call it.
 *
 * Coordinates: x across the balustrade, 0 at its centre line, negative to the viewer's left; y up from its foot.
 */
export interface BalustradeOptions {
  /** Overall width, post faces included (m). */
  width: number;
  /** Overall height, plinth to the top of the rail (m). */
  height: number;
  /** End post width (m). */
  post: number;
  /** Plinth (base course) height (m). */
  plinth: number;
  /** Handrail height (m). */
  rail: number;
  /** Baluster width at its widest (m). */
  baluster: number;
  /** Target centre-to-centre spacing of the balusters (m); the count is the nearest that fits, the spacing then exact. */
  pitch: number;
  /** Intermediate posts dividing the span into this many equal bays (default 1: end posts only). */
  bays?: number;
}

export interface BalustradeLayout {
  plinth: {x0: number; x1: number; y: number; h: number};
  rail: {x0: number; x1: number; y: number; h: number};
  posts: {x: number; w: number; y: number; h: number}[];
  balusters: {x: number; w: number; y: number; h: number}[];
}

export function balustrade(o: BalustradeOptions): BalustradeLayout {
  const {width: W, height: H, post: P, plinth: pl, rail: r, baluster: bw, pitch} = o;
  const bays = o.bays ?? 1;
  if (!(W > 0 && H > 0 && P > 0 && pl >= 0 && r > 0 && bw > 0 && pitch > 0)) throw Error('balustrade: positive sizes required');
  if (!(Number.isInteger(bays) && bays >= 1)) throw Error('balustrade: bays must be a positive integer');
  const shaftY = pl, shaftH = H - pl - r;
  if (!(shaftH > 0)) throw Error('balustrade: plinth and rail leave no height for the balusters');
  const clearTotal = W - P * (bays + 1);
  if (!(clearTotal > 0)) throw Error('balustrade: posts fill the whole width');
  const clear = clearTotal / bays;
  if (bw > clear) throw Error('balustrade: a baluster is wider than a bay');
  const posts: BalustradeLayout['posts'] = [];
  const balusters: BalustradeLayout['balusters'] = [];
  for (let i = 0; i <= bays; i++) posts.push({x: -W / 2 + P / 2 + i * (P + clear), w: P, y: 0, h: H});
  for (let i = 0; i < bays; i++) {
    const a = -W / 2 + P + i * (P + clear);
    // n balusters at spacing s = clear / n, each centred in its slot: the gap to a post is half a spacing
    const n = Math.max(1, Math.round(clear / pitch));
    const s = clear / n;
    for (let j = 0; j < n; j++) balusters.push({x: a + s * (j + 0.5), w: Math.min(bw, s * 0.9), y: shaftY, h: shaftH});
  }
  return {plinth: {x0: -W / 2, x1: W / 2, y: 0, h: pl}, rail: {x0: -W / 2, x1: W / 2, y: H - r, h: r}, posts, balusters};
}
