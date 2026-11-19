// Bridge feedback pins (lane fb-bridges, feedback round 2026-11-13). Shared by check-ground-cells (default run and
// --bridge-feedback) and check-ground-spots, which runs in check:canal:rest so these pins gate integration.
//
//   node --import tsx scripts/own-ground/check-ground-cells.ts --bridge-feedback
import { GroundStore, toLocal, waterTest } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, layersAt } from '../../src/canalRecall/ownGround/groundCell.ts';
import { prepareWays, isBridgeWay } from '../../src/canalRecall/ownGround/streets.ts';
import { planRailCentres, shiftedLine, stationOffsets } from '../../src/canalRecall/ownGround/railCentre.ts';
import { ringSamples } from '../../src/canalRecall/ownGround/pandAbutments.ts';
import { kitTrace, parapetTrace } from '../../src/canalRecall/ownGround/bridgeKit.ts';
import { parapetCrossings, type ParapetPoint } from '../../src/canalRecall/ownGround/railingRuns.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { GroundSurface, type Vec2 } from '../../src/canalRecall/ownGround/surface.ts';
import { HOLE_CARRY_CROSS_M, holeCrossStations } from '../../src/canalRecall/ownGround/bridgeGaps.ts';
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
  await round396Regressions(readExtract, check);
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
const RINGWEG_NOORD = { id: 'OSM7376770', at: [4.899239, 52.423753] as [number, number], maxMedianM: 2, maxInsideM: 15, pinMinM: 40 };
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
    // The median: a parapet between deck-level carriageways (or cycle paths) on both sides (lane crossing-grade 2026-11-14:
    // the bank climb raised this deck's hole end 0.5-0.8 m, and the hole-drop rule, decks.ts HOLE_DROP_PROBE_M, now rails
    // 5 m of its north edge over the cycle-path underpass where the orthophoto shows the noise barrier, beside a ground-level
    // carriageway polygon: an outer edge, not the median).
    const deckTraffic = (qx: number, qy: number) => traffic(qx, qy) && index.onDeck(qx, qy);
    const pieces = [...lines.values()].flatMap(l => l.pieces);
    return { all: pieces.reduce((a, l) => a + parapetCrossings(l, traffic).insideM, 0), median: pieces.reduce((a, l) => a + parapetCrossings(l, deckTraffic).insideM, 0) };
  };
  const on = await inside({}), off = await inside({ medianEdges: false });
  check(on.median < RINGWEG_NOORD.maxMedianM, `${RINGWEG_NOORD.id} (Ringweg-Noord, A10 median): ${on.median.toFixed(1)} m of parapet inside deck-level carriageway or cycle polygons (< ${RINGWEG_NOORD.maxMedianM})`);
  check(on.all < RINGWEG_NOORD.maxInsideM, `${RINGWEG_NOORD.id}: ${on.all.toFixed(1)} m of parapet inside any carriageway or cycle polygon (< ${RINGWEG_NOORD.maxInsideM})`);
  check(off.median >= RINGWEG_NOORD.pinMinM, `${RINGWEG_NOORD.id}: without medianEdges ${off.median.toFixed(1)} m inside deck-level traffic (>= ${RINGWEG_NOORD.pinMinM}, the pin is live)`);
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
 * (main before this lane) puts the shard back. The zone stops HOLE_CARRY_CROSS_M short of a street that crosses under
 * the deck (Coentunnelcircuit: the Meteorenweg under both carriageways at station 18.8), which holeCarry leaves draped.
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
export function junctionSunk(st: GroundStore, cell: ReturnType<typeof buildCell>, index: RoadIndex, d: GroundStore['surface']['decks'][number], crossS: readonly number[] = []): { n: number; maxM: number; areaM2: number } {
  const p = d.profile, [bx0, by0, bx1, by1] = p.bbox;
  // The first JUNCTION_M of each hole range from its deck-end side (the deck may run on past it), short of a street that
  // crosses under the deck there (crossS, bridgeGaps.ts holeCrossStations: that street lies under the deck, not at its end).
  const zones = (p.under ?? []).map(([a, b]): [number, number] => {
    const near = crossS.filter(v => v >= a - HOLE_CARRY_CROSS_M && v <= b + HOLE_CARRY_CROSS_M);
    return Math.abs(a - p.deck[0]) <= Math.abs(b - p.deck[1]) ? [a, Math.min(a + JUNCTION_M, ...near.map(v => v - HOLE_CARRY_CROSS_M))] : [Math.max(b - JUNCTION_M, ...near.map(v => v + HOLE_CARRY_CROSS_M)), b];
  });
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
  if (!d) return null;
  const [x, y] = toLocal(reg.at[0], reg.at[1]), seen = new Set<number>(), lines: Vec2[][] = [];
  for (const k of GroundStore.neighbours(st.cellAt(x, y))) for (const w of (await st.osmCell(k))?.ways ?? []) {
    if (seen.has(w.id) || !(w.tags.highway || w.tags.railway) || (w.tags.bridge && w.tags.bridge !== 'no')) continue;
    seen.add(w.id); lines.push(w.g.map(q => toLocal(q[0], q[1])));
  }
  return junctionSunk(st, cell, index, d, holeCrossStations(d.profile, lines));
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
 * Crossing dips (lanes f1b-jagged and crossing-grade 2026-11-14; the user on the Lelylaan: "these roads should probably
 * figure out 'I don't dip down'"): a road carried across water holds its approach grade across the crossing. The
 * elevation model is interpolated under abutments, so way decks stopped a metre onto the embankment's slope and the road
 * came down it into the crossing and up again (wayDecks.ts BANK_CLIMB_MAX_M). Across the water the riding surface lies at
 * most `maxDipM` under the straight line between the bank tops (crossing-dip.ts); `?bankClimb=0` (the before) dips at
 * least `pinMinM`. City survey: probe-crossing-dips.ts.
 */
export const BANK_DIPS: readonly { way: number; label: string; at: [number, number]; maxDipM: number; pinMinM: number; /** The pin's before (default `{ bankClimb: false }`). */ off?: Record<string, boolean> }[] = [
  { way: 7382983, label: 'Ringweg-West slip over the Slotervaart, Lelylaan (user 2026-11-14)', at: [4.84294, 52.35607], maxDipM: 0.3, pinMinM: 2.5 },
  // The bundled dual carriageway beside it (wayDecks.ts groupWayDecks): it climbs its banks as one deck.
  { way: 7382981, label: 'Ringweg-West over the Slotervaart, Lelylaan (bundle)', at: [4.84244, 52.35604], maxDipM: 0.3, pinMinM: 2 },
  { way: 499557561, label: 'Gaasperdammerweg viaduct', at: [4.99773, 52.31769], maxDipM: 0.35, pinMinM: 2.5 },
  { way: 7382973, label: 'Ringweg-West, the crossing south of the Lelylaan (bundle)', at: [4.84251, 52.35227], maxDipM: 0.3, pinMinM: 1.4 },
  // Lane dips-deck-ends 2026-11-14 (wayDecks.ts WAY_END_DIP_M): the four crossings still dipping over 1 m after bankClimb.
  // A flat register footprint (BRU0095) over 50 m of relief filtered under the viaduct: an overFlat deck to the way's ends.
  { way: 7376117, label: 'Haarlemmer Houttuinen viaduct under BRU0095', at: [4.89017, 52.38213], maxDipM: 0.3, pinMinM: 2.5, off: { wayEnds: false } },
  // 150 m flyovers over the polder: the dual carriageway's deck runs on to its way's end nodes.
  { way: 424283770, label: 'Amsterdamse Baan link (bundle with 424283771)', at: [4.7565, 52.34344], maxDipM: 0.3, pinMinM: 2.3, off: { wayEnds: false } },
  { way: 1251743255, label: 'Van der Madeweg (bundle with 1339616201)', at: [4.93744, 52.32953], maxDipM: 0.3, pinMinM: 1.2, off: { wayEnds: false } },
  // The Kabouterbrug (BRU0360, flat): the relief over the water lies at the canal bed; the overFlat deck spans the water.
  { way: 38282903, label: 'Schinkelhavenstraat cycleway, Kabouterbrug BRU0360', at: [4.85372, 52.35476], maxDipM: 0.45, pinMinM: 1, off: { wayEnds: false } },
];
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
    const off = reg.off ?? { bankClimb: false }, d = await wayDip(readExtract, {}, reg), was = await wayDip(readExtract, off, reg);
    check(d !== null && d <= reg.maxDipM, `OSM ${reg.way} (${reg.label}): the crossing dips ${d?.toFixed(2) ?? 'n/a'} m under the bank tops' line (<= ${reg.maxDipM})`);
    check(was !== null && was >= reg.pinMinM, `OSM ${reg.way}: without ${Object.keys(off).join(', ')} ${was?.toFixed(2) ?? 'n/a'} m (>= ${reg.pinMinM}, the pin is live)`);
  }
}
/**
 * Bridge feedback round #396 (lane fb-bridges-20261119), each with its fix's flag off as the live pin.
 *  - Vijzelstraat (62d5a35f, "why are the rails slightly off-center?"): the tram rails drawn on the OSM way sat
 *    0.45-0.75 m to one side of the surveyed carriageway (railCentre.ts). With the plan's moved line, the median of
 *    (carriageway centre − rails' centre) along each named way is within `maxM`; on the way's own line it is >= `pinMinM`.
 *  - Torensluis (c16d3403) and Doelensluis (4c1344ce): water slits beside the deck, and De Clercqstraat (3b8ca68b) and
 *    the Oost-Indische Huisbrug (935a6807): deck grey showing through the road. Top-layer counts on a 0.5 m raster in a
 *    small box (layersAt): the bad layer's samples <= `max`; with the flag off >= `pinMin`.
 */
export const RAIL_CENTRE_WAYS: readonly { way: number; label: string; at: [number, number]; maxM: number; pinMinM: number }[] = [
  // Measured 2026-11-19: on the way's own line 0.55, 0.52, 0.63, -0.58 m; moved 0.03, -0.02, 0.00, -0.02 m.
  { way: 862565692, label: 'Vijzelstraat at the Isa van Eeghenbrug (two tracks)', at: [4.89280, 52.36501], maxM: 0.15, pinMinM: 0.45 },
  { way: 862565697, label: 'Vijzelstraat (two tracks)', at: [4.89280, 52.36501], maxM: 0.15, pinMinM: 0.45 },
  { way: 988972498, label: 'Vijzelstraat (two tracks)', at: [4.89280, 52.36501], maxM: 0.15, pinMinM: 0.45 },
  { way: 862565693, label: 'Vijzelstraat (one track)', at: [4.89280, 52.36501], maxM: 0.15, pinMinM: 0.45 },
];
export async function railCentreOffsets(readExtract: Read, at: [number, number], ways: readonly number[]): Promise<Map<number, { before: number; after: number }>> {
  const st = new GroundStore(readExtract, { roads: true });
  await st.init();
  const [x, y] = toLocal(at[0], at[1]), key = st.cellAt(x, y);
  await st.prepareCell(key);
  const input = await st.cellInput(key, 0);
  const index = new RoadIndex([input.roads, ...(input.roadsAround ?? [])]);
  const all = prepareWays([...(input.osm?.ways ?? []), ...input.osmAround.flatMap(o => o?.ways ?? [])], input.project).filter(w => w.section.rails.length);
  const seen = new Set<number>(), rails = all.filter(w => !seen.has(w.id) && seen.add(w.id));
  const asIn = (w: (typeof rails)[number]) => ({ id: w.id, points: w.points, rails: w.section.rails, bridge: isBridgeWay(w), measured: !!w.tags['embedded_rails:offsets'] });
  const plan = planRailCentres(index, rails.map(asIn));
  const med = (xs: number[]) => { const a = [...xs].sort((p, q) => p - q); return a.length ? a[a.length >> 1] : NaN; };
  const out = new Map<number, { before: number; after: number }>();
  for (const id of ways) {
    const w = rails.find(r => r.id === id);
    if (!w) continue;
    const sh = plan.get(id), moved = sh ? { ...asIn(w), points: shiftedLine(w.points, sh) } : asIn(w);
    out.set(id, { before: med(stationOffsets(index, asIn(w)).at.map(a => a.off)), after: med(stationOffsets(index, moved).at.map(a => a.off)) });
  }
  return out;
}
export const TOP_LAYER_SPOTS: readonly { id: string; label: string; at: [number, number]; half: number; bad: readonly string[]; flag: string; max: number; pinMin: number }[] = [
  // The h0 foot polygons reach ~2 m over the Singel beside the deck polygon: too narrow for the inset, now grown from the deck.
  { id: 'BRU0009', label: 'Torensluis, the water slit east of the deck (c16d3403)', at: [4.889675, 52.374683], half: 1.5, bad: ['hole'], flag: 'wetNearDecks', max: 2, pinMin: 12 }, // measured 2026-11-19: 0 / 16
  { id: 'BRU0220', label: 'Doelensluis, the notch at the near-left abutment (4c1344ce)', at: [4.893858, 52.367682], half: 1.5, bad: ['hole'], flag: 'wetNearDecks', max: 15, pinMin: 35 }, // measured 2026-11-19: 13 / 41
  // The carriageway polygon crosses the deck's lateral blend; at a 3 m drape edge it lay 12-15 cm under the deck top.
  { id: 'BRU0108', label: 'De Clercqstraat, deck grey across the road at the deck side (3b8ca68b)', at: [4.872046, 52.371377], half: 2.5, bad: ['deckTop'], flag: 'deckSideFine', max: 2, pinMin: 10 }, // measured 2026-11-19: 0 / 13
  // Skewed asphalt deck polygon: the kit's pale top showed between it and the parapet.
  { id: 'BRU0223', label: 'Oost-Indische Huisbrug, the pale wedge beside the asphalt (935a6807)', at: [4.897653, 52.369923], half: 5, bad: ['deckTop'], flag: 'coveredTopTone', max: 2, pinMin: 9 }, // measured 2026-11-19: 0 / 12
];
/**
 * c361c8 ("the house that stands on a bridge"): the Kinkerbrug bridge-keeper's house, BAG pand 0363100012197936 (OSM
 * w276306000). Its BAG footprint lies on the abutment's ground (0 of its 0.5 m samples over the mapped water, its north
 * wall on the water's edge, as the 8 cm orthophoto shows); the ground under it must stay drawn.
 */
export const PAND_ON_ABUTMENT = { id: '0363100012197936', label: 'Kinkerbrug bridge-keeper\'s house (c361c8)', ring: [[4.860262, 52.364694], [4.860234, 52.364662], [4.8603, 52.364634], [4.860315, 52.364646], [4.860322, 52.364653], [4.860327, 52.364661], [4.860337, 52.364675]] as [number, number][], maxHoles: 0 };
export async function pandHoles(readExtract: Read, ring: readonly [number, number][]): Promise<number> {
  const st = new GroundStore(readExtract, { roads: true });
  await st.init();
  const local = ring.map(([a, b]) => toLocal(a, b));
  const keys = new Set(local.map(([x, y]) => st.cellAt(x, y)));
  const cells: { cell: ReturnType<typeof buildCell>; rect: readonly number[] }[] = [];
  for (const k of keys) if (st.covers(k)) cells.push({ cell: buildCell(await st.cellInput(k, 0)), rect: st.cellRect(k) });
  let n = 0;
  for (const [x, y] of ringSamples(local, 0.5)) {
    const c = cells.find(c => x >= c.rect[0] && x < c.rect[2] && y >= c.rect[1] && y < c.rect[3]);
    if (!c || !layersAt(c.cell, x, y).top) n++;
  }
  return n;
}
export async function topLayerCount(readExtract: Read, opts: Record<string, boolean>, spot: (typeof TOP_LAYER_SPOTS)[number]): Promise<number> {
  const st = new GroundStore(readExtract, { roads: true, ...opts });
  await st.init();
  const [cx, cy] = toLocal(spot.at[0], spot.at[1]), keys = new Set<string>();
  for (const dx of [-spot.half, spot.half]) for (const dy of [-spot.half, spot.half]) keys.add(st.cellAt(cx + dx, cy + dy));
  const cells: { cell: ReturnType<typeof buildCell>; rect: readonly number[] }[] = [];
  for (const k of keys) if (st.covers(k)) cells.push({ cell: buildCell(await st.cellInput(k, 0)), rect: st.cellRect(k) });
  let n = 0;
  for (let y = cy - spot.half; y <= cy + spot.half; y += 0.5) for (let x = cx - spot.half; x <= cx + spot.half; x += 0.5) {
    const c = cells.find(c => x >= c.rect[0] && x < c.rect[2] && y >= c.rect[1] && y < c.rect[3]);
    // 'hole': nothing drawn over the water there (the mask cut the ground).
    const top = c ? layersAt(c.cell, x, y).top ?? 'hole' : null;
    if (top && spot.bad.includes(top)) n++;
  }
  return n;
}
export async function round396Regressions(readExtract: Read, check: Check): Promise<void> {
  for (const reg of RAIL_CENTRE_WAYS) {
    const r = (await railCentreOffsets(readExtract, reg.at, [reg.way])).get(reg.way);
    check(!!r && Math.abs(r.after) <= reg.maxM, `OSM ${reg.way} (${reg.label}): rails ${r?.after.toFixed(2)} m off the carriageway's centre (<= ${reg.maxM})`);
    check(!!r && Math.abs(r.before) >= reg.pinMinM, `OSM ${reg.way}: on the way's own line ${r?.before.toFixed(2)} m (>= ${reg.pinMinM}, the pin is live)`);
  }
  const holes = await pandHoles(readExtract, PAND_ON_ABUTMENT.ring);
  check(holes <= PAND_ON_ABUTMENT.maxHoles, `pand ${PAND_ON_ABUTMENT.id} (${PAND_ON_ABUTMENT.label}): ${holes} footprint samples with no ground drawn (<= ${PAND_ON_ABUTMENT.maxHoles})`);
  for (const spot of TOP_LAYER_SPOTS) {
    const n = await topLayerCount(readExtract, {}, spot), was = await topLayerCount(readExtract, { [spot.flag]: false }, spot);
    check(n <= spot.max, `${spot.id} (${spot.label}): ${n} samples of ${spot.bad.join('/')} on top (<= ${spot.max})`);
    check(was >= spot.pinMin, `${spot.id}: without ${spot.flag} ${was} (>= ${spot.pinMin}, the pin is live)`);
  }
}
