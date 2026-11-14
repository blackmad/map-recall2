// Bridge feedback pins (lane fb-bridges, feedback round 2026-11-13). Shared by check-ground-cells (default run and
// --bridge-feedback) and check-ground-spots, which runs in check:canal:rest so these pins gate integration.
//
//   node --import tsx scripts/own-ground/check-ground-cells.ts --bridge-feedback
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { kitTrace, parapetTrace } from '../../src/canalRecall/ownGround/bridgeKit.ts';
import { parapetCrossings, type ParapetPoint } from '../../src/canalRecall/ownGround/railingRuns.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { GroundSurface } from '../../src/canalRecall/ownGround/surface.ts';

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
    const off = await notch({ holeClimb: false });
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
async function parapetLines(readExtract: Read, opts: Record<string, boolean>, at: [number, number], ids: readonly string[]) {
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
          if (!GroundSurface.inUnder(d, at.s) || at.lateral > at.halfWidth + 3) continue;
          // Ground streets only: 0.3 m clear of every deck-level survey polygon (their own vertices lie on the outline).
          if ([[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].some(([ox, oy]) => index.onDeck(vx + ox, vy + oy))) continue;
          if (pos[i + 2] - st.surface.ground(vx, vy) > LELYLAAN_STREETS.highM) n++;
        }
      }
    }
    return n;
  };
  const h = await high({}), hBefore = await high({ holeStreets: false });
  check(h <= LELYLAAN_STREETS.maxHigh, `Lelylaan streets under the Ringweg-West hole ranges (07ec0473): ${h} vertices more than ${LELYLAAN_STREETS.highM} m over the relief (<= ${LELYLAAN_STREETS.maxHigh})`);
  check(hBefore >= LELYLAAN_STREETS.pinMin, `Lelylaan: without holeStreets ${hBefore} vertices (>= ${LELYLAAN_STREETS.pinMin}, the pin is live)`);
}
