// Bridge feedback pins (lane fb-bridges, feedback round 2026-11-13). Shared by check-ground-cells (default run and
// --bridge-feedback) and check-ground-spots, which runs in check:canal:rest so these pins gate integration.
//
//   node --import tsx scripts/own-ground/check-ground-cells.ts --bridge-feedback
import { GroundStore, toLocal, waterTest } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { kitTrace, parapetTrace } from '../../src/canalRecall/ownGround/bridgeKit.ts';
import { parapetCrossings, type ParapetPoint } from '../../src/canalRecall/ownGround/railingRuns.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { GroundSurface } from '../../src/canalRecall/ownGround/surface.ts';
import { crossingDips } from './crossing-dip.ts';

type Read = (path: string) => Promise<Uint8Array>;
type Check = (ok: boolean, what: string) => void;

/**
 * Bridge feedback 2026-11-13 (lane fb-bridges; notes c7a55085, 8b91c88c, c5313f12). Each with the fix's flag off as
 * the live pin.
 *  - Muntplein (c7a55085, "what are these gates about?"): the Muntsluis BRU0001 and the way decks inside the plein over
 *    the Singel drew railing stubs across the tram tracks and the cycle path (groundCell `plein`, railingRuns pL/pR):
 *    under 0.5 m of their parapet lies inside a carriageway or cycle polygon; `pleinRails: false` puts it back.
 *  - Rijckerbrug BRU0167 (8b91c88c, "is this extra extrusion real?") and Machineslootbrug BRU0358 (c5313f12, "weird
 *    protrusion?"): the profile's half-width ran 5-6 m past the survey's deck polygons over the canal and drew a grey
 *    slab with a brick face beside the railing (bridgeGaps.ts surveyDeckCaps): the kit's widest edge on that side stays
 *    within `maxM` of the road line; `surveyCaps: false` puts the slab back.
 */
const PLEIN_RAILS = { at: [4.89361, 52.36707] as [number, number], ids: ['BRU0001', 'OSM1171248755', 'OSM311941852', 'OSM1171248758'], maxInsideM: 0.5, pinMinM: 5 };
const SURVEY_CAPS: readonly { id: string; label: string; at: [number, number]; side: 1 | -1; maxM: number; pinMinM: number }[] = [
  { id: 'BRU0167', label: 'Rijckerbrug, Rozengracht over the Lijnbaansgracht (south side)', at: [4.87453, 52.37182], side: -1, maxM: 7.5, pinMinM: 11 },
  { id: 'BRU0358', label: 'Machineslootbrug, Postjesweg (north side)', at: [4.85810, 52.36479], side: -1, maxM: 10.5, pinMinM: 13.5 },
];
export async function bridgeFeedbackRegressions(readExtract: Read, check: Check): Promise<void> {
  const build = async (opts: Record<string, boolean>, at: [number, number], fn: (input: Awaited<ReturnType<GroundStore['cellInput']>>) => void) => {
    const st = new GroundStore(readExtract, { roads: true, ...opts });
    await st.init();
    const [x, y] = toLocal(at[0], at[1]), key = st.cellAt(x, y);
    await st.prepareCell(key);
    fn(await st.cellInput(key, 0));
  };
  // Muntplein railings.
  const inside = async (opts: Record<string, boolean>) => {
    let total = 0;
    await build(opts, PLEIN_RAILS.at, input => {
      const lines = new Map<string, { level: number; pieces: ParapetPoint[][] }>();
      parapetTrace.fn = (bid, side, line, at) => {
        if (!PLEIN_RAILS.ids.includes(bid)) return;
        const k = `${bid}|${side}`, t = lines.get(k);
        if (!t || at.level > t.level || (at.level === t.level && at.piece === 0)) lines.set(k, { level: at.level, pieces: [line] });
        else if (at.level === t.level) t.pieces.push(line);
      };
      try { buildCell(input); } finally { parapetTrace.fn = null; }
      const index = new RoadIndex([input.roads ?? null, ...(input.roadsAround ?? [])]);
      const traffic = (qx: number, qy: number) => { const c = index.classAt(qx, qy, true); return c === 'carriage' || c === 'cycle'; };
      total = [...lines.values()].flatMap(l => l.pieces).reduce((a, l) => a + parapetCrossings(l, traffic).insideM, 0);
    });
    return total;
  };
  const on = await inside({}), off = await inside({ pleinRails: false });
  check(on < PLEIN_RAILS.maxInsideM, `muntplein-rails: ${on.toFixed(1)} m of the plein decks' parapet inside carriageway or cycle polygons (< ${PLEIN_RAILS.maxInsideM})`);
  check(off >= PLEIN_RAILS.pinMinM, `muntplein-rails: without the plein rule ${off.toFixed(1)} m inside (>= ${PLEIN_RAILS.pinMinM}, the pin is live)`);
  // Survey caps.
  for (const reg of SURVEY_CAPS) {
    const widest = async (opts: Record<string, boolean>) => {
      let w = -1;
      await build(opts, reg.at, input => {
        kitTrace.input = k => {
          if (k.id !== reg.id || k.lod !== 0) return;
          for (const r of k.rows) { const e = reg.side > 0 ? r.L : r.R; w = Math.max(w, Math.hypot(e[0] - r.c[0], e[1] - r.c[1])); }
        };
        try { buildCell(input); } finally { kitTrace.input = null; }
      });
      return w;
    };
    const capped = await widest({}), was = await widest({ surveyCaps: false });
    check(capped > 0 && capped <= reg.maxM, `${reg.id} (${reg.label}): kit edge reaches ${capped.toFixed(1)} m from the road line (<= ${reg.maxM})`);
    check(was >= reg.pinMinM, `${reg.id}: without the survey caps ${was.toFixed(1)} m (>= ${reg.pinMinM}, the pin is live)`);
  }
  await lelylaanRegressions(readExtract, check);
  await f1bRegressions(readExtract, check);
  await holeJunctionRegressions(readExtract, check);
  await bankDipRegressions(readExtract, check);
}

/**
 * Lelylaan (07ec0473 "I thought we fixed this?????", a5806a8e the junction's bridge ends, 2026-11-13): the Ringweg-West
 * slip OSM 7382983 spans the Slotervaart and a cycle underpass; its deck stopped half-way up the north bank's climb and
 * dived 2.3 m to its end before the street climbed back, a slanted slab with the road torn round it (wayDecks.ts
 * HOLE_CLIMB_GRADE). The pin: the deck's notch, the deepest station under the lower of the highest deck z before it and
 * after it, from the deck start to the profile's end, stays under `maxDipM`; `holeClimb: false` puts the notch back.
 */
export const LELYLAAN_DECKS: readonly { id: string; label: string; at: [number, number]; maxDipM: number; pinMinM?: number }[] = [
  { id: 'OSM7382983', label: 'Ringweg-West slip over the Slotervaart, Lelylaan (07ec0473)', at: [4.842788, 52.356045], maxDipM: 0.3, pinMinM: 2 },
  // a5806a8e: the Ringweg-West main deck beside it ends at the water's north abutment with the relief still in the
  // canal-side dip (0.69 m notch, not fixed in this lane: the bank climbs at ~10 %, an approach grade): a ceiling.
  { id: 'OSM7382981', label: 'Ringweg-West over the Slotervaart, Lelylaan junction (a5806a8e), ceiling only', at: [4.842788, 52.356045], maxDipM: 0.75 },
];
/** The notch depth of a placed deck (see LELYLAAN_DECKS), metres; null when the deck is not placed. */
export function deckNotch(st: GroundStore, id: string): number | null {
  const d = st.surface.decks.find(q => q.profile.id === id);
  if (!d) return null;
  const s = d.profile.s, i0 = Math.max(0, s.findIndex(v => v >= d.span[0])), n = s.length;
  const before = new Float64Array(n), after = new Float64Array(n);
  for (let i = i0; i < n; i++) before[i] = Math.max(i > i0 ? before[i - 1] : -Infinity, d.z[i]);
  for (let i = n - 1; i >= i0; i--) after[i] = Math.max(i < n - 1 ? after[i + 1] : -Infinity, d.z[i]);
  let dip = 0;
  for (let i = i0; i < n; i++) dip = Math.max(dip, Math.min(before[i], after[i]) - d.z[i]);
  return dip;
}
export async function lelylaanRegressions(readExtract: Read, check: Check): Promise<void> {
  for (const reg of LELYLAAN_DECKS) {
    const notch = async (opts: Record<string, boolean>) => {
      const st = new GroundStore(readExtract, { roads: true, ...opts });
      await st.init();
      const [x, y] = toLocal(reg.at[0], reg.at[1]);
      await st.prepareCell(st.cellAt(x, y));
      return deckNotch(st, reg.id);
    };
    const on = await notch({});
    check(on !== null && on <= reg.maxDipM, `${reg.id} (${reg.label}): deck notch ${on?.toFixed(2)} m (<= ${reg.maxDipM})`);
    if (reg.pinMinM === undefined) continue;
    // bankClimb (lane f1b-jagged) also runs the deck up that climb: off too, for the hole climb's own before.
    const off = await notch({ holeClimb: false, bankClimb: false });
    check(off !== null && off >= reg.pinMinM, `${reg.id}: without the hole climb ${off?.toFixed(2)} m (>= ${reg.pinMinM}, the pin is live)`);
  }
}

/**
 * Lane F1b (2026-11-14), the regressions and leftovers of lane F1. Each with its fix's flag off as the live pin.
 *  - Ringweg-Noord OSM 7376770 (medianEdges): the bundled way deck lies on the A10's 4 m median; the survey edge walk
 *    stopped there, so the south side kept the 15.7 m half-width and its parapet stood 2 m inside the hard shoulder over
 *    the whole deck (F1's hole climb ran it on from 13.8 to 56.6 m city-wide). The parapet metres inside a carriageway or
 *    cycle polygon in its cell stay under `maxInsideM`.
 *  - Survey-cap railing steps (capSmooth): BRU0407 (Ruysdaelkade lamp piers, the cap 9.0 / 10.5 / 9.0 m) and BRU0415
 *    (a narrowing 14.4 to 12.5 m) turned their railing across the deck; no turn now.
 *  - Lelylaan (07ec0473, holeStreets): the streets and cycle paths under the Ringweg-West decks' hole ranges (OSM
 *    7382981, 7382983) drape on the relief: none of their vertices stands more than 0.5 m over it (before: 120+, up to
 *    3.5 m, climbing to the deck edge in torn sheets).
 */
const RINGWEG_NOORD = { id: 'OSM7376770', at: [4.899239, 52.423753] as [number, number], maxInsideM: 10, pinMinM: 40 };
const CAP_STEPS: readonly { id: string; at: [number, number]; pinMinM: number }[] = [
  { id: 'BRU0407', at: [4.878785, 52.35112], pinMinM: 2.5 },
  { id: 'BRU0415', at: [4.868152, 52.344118], pinMinM: 1.5 },
];
const LELYLAAN_STREETS = { at: [4.842788, 52.356045] as [number, number], ids: ['OSM7382981', 'OSM7382983'], highM: 0.5, maxHigh: 0, pinMin: 50 };
/** A cell's parapet lines per `${id}|${side}` (the level buildKit drew), the cell's input and its road index. */
export async function parapetLines(readExtract: Read, opts: Record<string, boolean>, at: [number, number], ids: readonly string[]) {
  const st = new GroundStore(readExtract, { roads: true, ...opts });
  await st.init();
  const [x, y] = toLocal(at[0], at[1]), key = st.cellAt(x, y);
  await st.prepareCell(key);
  const input = await st.cellInput(key, 0);
  const lines = new Map<string, { level: number; pieces: ParapetPoint[][] }>();
  parapetTrace.fn = (bid, side, line, lv) => {
    if (!ids.includes(bid)) return;
    const k = `${bid}|${side}`, t = lines.get(k);
    if (!t || lv.level > t.level || (lv.level === t.level && lv.piece === 0)) lines.set(k, { level: lv.level, pieces: [line] });
    else if (lv.level === t.level) t.pieces.push(line);
  };
  let cell;
  try { cell = buildCell(input); } finally { parapetTrace.fn = null; }
  return { st, input, cell, lines, index: new RoadIndex([input.roads ?? null, ...(input.roadsAround ?? [])]) };
}
export async function f1bRegressions(readExtract: Read, check: Check): Promise<void> {
  // Ringweg-Noord parapet in the traffic lanes.
  const inside = async (opts: Record<string, boolean>) => {
    const { lines, index } = await parapetLines(readExtract, opts, RINGWEG_NOORD.at, [RINGWEG_NOORD.id]);
    const traffic = (qx: number, qy: number) => { const c = index.classAt(qx, qy, true); return c === 'carriage' || c === 'cycle'; };
    return [...lines.values()].flatMap(l => l.pieces).reduce((a, l) => a + parapetCrossings(l, traffic).insideM, 0);
  };
  const on = await inside({}), off = await inside({ medianEdges: false });
  check(on < RINGWEG_NOORD.maxInsideM, `${RINGWEG_NOORD.id} (Ringweg-Noord, A10 median): ${on.toFixed(1)} m of parapet inside carriageway or cycle polygons (< ${RINGWEG_NOORD.maxInsideM})`);
  check(off >= RINGWEG_NOORD.pinMinM, `${RINGWEG_NOORD.id}: without medianEdges ${off.toFixed(1)} m inside (>= ${RINGWEG_NOORD.pinMinM}, the pin is live)`);
  // Survey-cap railing steps.
  for (const reg of CAP_STEPS) {
    const turns = async (opts: Record<string, boolean>) => {
      const { lines } = await parapetLines(readExtract, opts, reg.at, [reg.id]);
      return [...lines.values()].flatMap(l => l.pieces).reduce((a, l) => a + parapetCrossings(l, () => false).turnM, 0);
    };
    const t = await turns({}), was = await turns({ capSmooth: false });
    check(t === 0, `${reg.id} (survey caps smoothed): railing turns ${t.toFixed(1)} m (0)`);
    check(was >= reg.pinMinM, `${reg.id}: without capSmooth ${was.toFixed(1)} m of turns (>= ${reg.pinMinM}, the pin is live)`);
  }
  // Lelylaan streets under the hole ranges.
  const high = async (opts: Record<string, boolean>) => {
    const { st, cell, index } = await parapetLines(readExtract, opts, LELYLAAN_STREETS.at, []);
    let n = 0;
    for (const d of st.surface.decks.filter(q => LELYLAAN_STREETS.ids.includes(q.profile.id) && q.profile.under)) {
      const p = d.profile, [bx0, by0, bx1, by1] = p.bbox;
      for (const layer of ['cycle', 'asphalt', 'paving', 'klinker', 'brick'] as const) {
        const pos = cell.layers[layer]?.positions;
        if (!pos) continue;
        for (let i = 0; i < pos.length; i += 3) {
          const vx = pos[i], vy = pos[i + 1];
          if (vx < bx0 - 3 || vx > bx1 + 3 || vy < by0 - 3 || vy > by1 + 3) continue;
          const at = GroundSurface.locate(d, vx, vy);
          // inUnderStreets: the deck's own road carried on from its end at ground level is not under (holeCarried).
          if (!GroundSurface.inUnderStreets(d, at.s, vx, vy) || at.lateral > at.halfWidth + 3) continue;
          // Ground streets only: 0.3 m clear of every deck-level survey polygon (their own vertices lie on the outline).
          if ([[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].some(([ox, oy]) => index.onDeck(vx + ox, vy + oy))) continue;
          if (pos[i + 2] - st.surface.ground(vx, vy) > LELYLAAN_STREETS.highM) n++;
        }
      }
    }
    return n;
  };
  const h = await high({}), hBefore = await high({ holeStreets: false, bankClimb: false });
  check(h <= LELYLAAN_STREETS.maxHigh, `Lelylaan streets under the Ringweg-West hole ranges (07ec0473): ${h} vertices more than ${LELYLAAN_STREETS.highM} m over the relief (<= ${LELYLAAN_STREETS.maxHigh})`);
  check(hBefore >= LELYLAAN_STREETS.pinMin, `Lelylaan: without holeStreets (and bankClimb, which moves the deck ends) ${hBefore} vertices (>= ${LELYLAAN_STREETS.pinMin}, the pin is live)`);
}

/**
 * Hole-deck junctions (lane f1b-jagged 2026-11-14; the user on F1b's Ringweg-Noord frame: "this is almost worse - before
 * there was just a seam line, now there's jagged texture"). holeStreets draped every ground-level survey polygon in a way
 * deck's hole range on the relief, the deck's own carriageway too where the survey draws it at ground level over the
 * hole: it sank 2-5 m and the pale deck top showed through in a ragged shard at the deck end (bridgeGaps.ts
 * holeCarry). Within the first JUNCTION_M of a hole range from its deck-end side, inside the deck's footprint (0.5 m in
 * from its edge), clear of every deck-level survey polygon and off a median berm, at most `maxSunk` road-surface vertices
 * lie more than JUNCTION_SUNK_M under the riding surface (the junction is continuous with the deck); `holeCarried: false`
 * (main before this lane) puts the shard back.
 */
// OSM7376770 (the user's frame) carries no pinMin: its shard is a few long triangles that this metric reads as 1 vertex
// and 0 m2 with or without holeCarried; its liveness is the frame pair (tests/e2e/f1b-jagged-frames.spec.ts).
export const HOLE_JUNCTIONS: readonly { id: string; label: string; at: [number, number]; maxSunk: number; pinMin?: number; maxAreaM2?: number; pinMinAreaM2?: number }[] = [
  { id: 'OSM7376770', label: 'Ringweg-Noord over the Noordhollandsch Kanaal, east deck end (user 2026-11-14)', at: [4.89927, 52.42386], maxSunk: 1 },
  { id: 'OSM7376548', label: 'Ringweg-Noord, the next deck east (F1b frame)', at: [4.90762, 52.42066], maxSunk: 0, pinMin: 1, maxAreaM2: 25, pinMinAreaM2: 50 },
  { id: 'OSM7377715', label: 'Coentunnelcircuit', at: [4.87538, 52.4176], maxSunk: 2, pinMin: 10 },
  { id: 'OSM323258135', label: 'Jan Evertsenstraat over the Ringweg-West', at: [4.84791, 52.36977], maxSunk: 0, pinMin: 100 },
];
export const JUNCTION_M = 12, JUNCTION_SUNK_M = 0.3;
const JUNCTION_LAYERS = ['asphalt', 'paving', 'klinker', 'brick', 'cycle', 'square'] as const;
/** Road-surface vertices of a built cell sunk under the riding surface at a hole deck's junction (see HOLE_JUNCTIONS). */
export function junctionSunk(st: GroundStore, cell: ReturnType<typeof buildCell>, index: RoadIndex, d: GroundStore['surface']['decks'][number]): { n: number; maxM: number; areaM2: number } {
  const p = d.profile, [bx0, by0, bx1, by1] = p.bbox;
  // The first JUNCTION_M of each hole range from its deck-end side (the deck may run on past it).
  const zones = (p.under ?? []).map(([a, b]): [number, number] => (Math.abs(a - p.deck[0]) <= Math.abs(b - p.deck[1]) ? [a, a + JUNCTION_M] : [b - JUNCTION_M, b]));
  // In the junction zone, inside the footprint, off deck-level polygons and median berms, sunk more than JUNCTION_SUNK_M.
  const sunkAt = (x: number, y: number, z: number, probe: boolean): number => {
    if (x < bx0 || x > bx1 || y < by0 || y > by1) return 0;
    const at = GroundSurface.locate(d, x, y);
    if (!zones.some(([a, b]) => at.s >= a && at.s <= b) || at.lateral > at.halfWidth - 0.5) return 0;
    if ((probe ? [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]] : [[0, 0]]).some(([ox, oy]) => index.onDeck(x + ox, y + oy))) return 0;
    // A median berm between a bundled deck's carriageways lies under the deck top (medianEdges): not the junction.
    if (index.classAt(x, y) === 'berm') return 0;
    const sunk = st.surface.height(x, y) - z;
    return sunk > JUNCTION_SUNK_M ? sunk : 0;
  };
  let n = 0, maxM = 0, areaM2 = 0;
  for (const layer of JUNCTION_LAYERS) {
    const g = cell.layers[layer], pos = g?.positions, ix = g?.indices;
    if (!pos) continue;
    for (let i = 0; i < pos.length; i += 3) {
      const sunk = sunkAt(pos[i], pos[i + 1], pos[i + 2], true);
      if (sunk) { n++; maxM = Math.max(maxM, sunk); }
    }
    // The shard is a few long triangles: their area, sampled at the centroid, reads it where a vertex count does not.
    if (ix) for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      if (!sunkAt((pos[a] + pos[b] + pos[c]) / 3, (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3, false)) continue;
      areaM2 += Math.abs((pos[b] - pos[a]) * (pos[c + 1] - pos[a + 1]) - (pos[c] - pos[a]) * (pos[b + 1] - pos[a + 1])) / 2;
    }
  }
  return { n, maxM, areaM2 };
}
/** junctionSunk at a pinned deck, in a store with `opts`; null: no such deck. */
export async function holeJunctionSunk(readExtract: Read, opts: Record<string, boolean>, reg: (typeof HOLE_JUNCTIONS)[number]): Promise<{ n: number; maxM: number; areaM2: number } | null> {
  const { st, cell, index } = await parapetLines(readExtract, opts, reg.at, []);
  const d = st.surface.decks.find(q => q.profile.id === reg.id && q.profile.under);
  return d ? junctionSunk(st, cell, index, d) : null;
}
export async function holeJunctionRegressions(readExtract: Read, check: Check): Promise<void> {
  for (const reg of HOLE_JUNCTIONS) {
    const r = await holeJunctionSunk(readExtract, {}, reg);
    if (!r) { check(false, `${reg.id} (${reg.label}): no hole deck placed`); continue; }
    check(r.n <= reg.maxSunk, `${reg.id} (${reg.label}): ${r.n} road vertices within ${JUNCTION_M} m of the deck end more than ${JUNCTION_SUNK_M} m under the deck (<= ${reg.maxSunk}${r.n ? `, worst ${r.maxM.toFixed(2)} m` : ''})`);
    if (reg.maxAreaM2 !== undefined) check(r.areaM2 <= reg.maxAreaM2, `${reg.id}: ${r.areaM2.toFixed(1)} m2 of sunk road triangles at the junction (<= ${reg.maxAreaM2})`);
    if (reg.pinMin !== undefined || reg.pinMinAreaM2 !== undefined) {
      const was = await holeJunctionSunk(readExtract, { holeCarried: false }, reg);
      if (reg.pinMin !== undefined) check(!!was && was.n >= reg.pinMin, `${reg.id}: without holeCarried ${was?.n ?? 'no deck'} vertices${was?.n ? ` (worst ${was.maxM.toFixed(2)} m)` : ''} (>= ${reg.pinMin}, the pin is live)`);
      if (reg.pinMinAreaM2 !== undefined) check(!!was && was.areaM2 >= reg.pinMinAreaM2, `${reg.id}: without holeCarried ${was?.areaM2.toFixed(1)} m2 (>= ${reg.pinMinAreaM2}, the pin is live)`);
    }
  }
}
/**
 * Crossing dips (lane f1b-jagged 2026-11-14; the user on the Lelylaan: "these roads should probably figure out 'I don't
 * dip down'"): the Ringweg-West and its slip over the Slotervaart came down the embankment's interpolated slope into the
 * crossing and up again on the deck (wayDecks.ts BANK_CLIMB_MAX_M). Across the water the riding surface lies at most
 * `maxDipM` under the straight line between the bank tops (crossing-dip.ts) with the trial on; the default (off) has the dip.
 */
export const BANK_DIPS: readonly { way: number; label: string; at: [number, number]; maxDipM: number; pinMinM: number }[] = [
  { way: 7382983, label: 'Ringweg-West slip over the Slotervaart, Lelylaan (user 2026-11-14)', at: [4.84294, 52.35607], maxDipM: 0.3, pinMinM: 2.5 },
];
// Not pinned: the Ringweg-West main deck beside it (OSM 7382981, 2.47 m) is a bundle (wayDecks.ts groupWayDecks), whose
// ends keep their place until a bank climb can follow the median's edges.
async function wayDip(readExtract: Read, opts: Record<string, boolean>, reg: (typeof BANK_DIPS)[number]): Promise<number | null> {
  const st = new GroundStore(readExtract, { roads: true, ...opts });
  await st.init();
  const [x, y] = toLocal(reg.at[0], reg.at[1]), key = st.cellAt(x, y);
  const around = GroundStore.neighbours(key);
  for (const k of around) await st.prepareCell(k);
  let way = null;
  for (const k of around) way ??= (await st.osmCell(k))?.ways.find(w => w.id === reg.way) ?? null;
  if (!way) return null;
  const wet = waterTest((await Promise.all(around.map(k => st.waterCell(k)))).flatMap(w => w?.polygons ?? []));
  const dips = crossingDips(st, way.g.map(([lng, lat]) => toLocal(lng, lat)), wet);
  return dips.length ? Math.max(...dips.map(d => d.dip)) : null;
}
export async function bankDipRegressions(readExtract: Read, check: Check): Promise<void> {
  for (const reg of BANK_DIPS) {
    // bankClimb is a trial (groundFixes.ts GROUND_TRIALS, default off): the pin holds the trial's fix, the default its before.
    const d = await wayDip(readExtract, { bankClimb: true }, reg), was = await wayDip(readExtract, {}, reg);
    check(d !== null && d <= reg.maxDipM, `OSM ${reg.way} (${reg.label}): with the bankClimb trial the crossing dips ${d?.toFixed(2) ?? 'n/a'} m under the bank tops' line (<= ${reg.maxDipM})`);
    check(was !== null && was >= reg.pinMinM, `OSM ${reg.way}: by default (bankClimb off) ${was?.toFixed(2) ?? 'n/a'} m (>= ${reg.pinMinM}, the pin is live)`);
  }
}
