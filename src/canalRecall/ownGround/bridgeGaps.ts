// Road continuity across bridges (lane road-bridge-gaps 2026-11-01, issue #178; user: "there are probably some systemic
// issues with gaps in drawing roads, especially across bridges"). What a camera straight above sees along an OSM bridge
// way and its approaches, sampled on the centreline and across the carriageway, read against the riding surface:
// where the road colour stops (and why: no road triangle there, a road triangle under another surface, or one the
// water mask discards), where the deck or the land shows instead, coplanar ties, and steps in the drawn surface.
//
// Pure measurement over built cells (groundCell.ts buildCell); scripts/roads/probe-bridge-gaps.ts walks the city.
import { CUT_CHANNEL, DRAW_RANK, maskChannelAt, type BuiltCell, type GroundLayer } from './groundCell.js';
import type { DeckSurface, Vec2 } from './surface.js';
import type { DeckProfile } from '../elevation/bridgeDeck.js';

/** Layers that read as road from above (the surfaces a rider expects under the wheels; paint and rails on top of one). */
export const ROAD_LAYERS: ReadonlySet<GroundLayer> = new Set<GroundLayer>(['asphalt', 'klinker', 'brick', 'cycle', 'paving', 'gravel', 'kerb', 'paint', 'tram', 'parkPath', 'parkGravel', 'track']);
/** What the top of a sample is: road, the bare deck top, a grey patch (land, square, parking, green), a hole (water, quay, nothing), the bridge body (parapet, abutment). */
export type TopClass = 'road' | 'deck' | 'land' | 'hole' | 'body';
export function topClass(layer: GroundLayer | null): TopClass {
  if (!layer || layer === 'water' || layer === 'quay') return 'hole';
  if (ROAD_LAYERS.has(layer)) return 'road';
  if (layer === 'deckTop') return 'deck';
  if (layer === 'deckBody') return 'body';
  return 'land';
}
/** Why a non-road sample is not road: no road triangle under it at all, one buried under another surface, or one the water mask discards. */
export type GapCause = 'missing' | 'buried' | 'masked';

export interface Hit { layer: GroundLayer; z: number; cut: boolean }

/** Triangles of a set of built cells binned on a grid, so a probe reads the hits under a point without walking every triangle (groundCell.ts layersAt). */
export class HitIndex {
  private readonly bins = new Map<number, number[]>();
  /** Per triangle: cell index, layer index, triangle offset. */
  private readonly tris: number[] = [];
  constructor(private readonly cells: readonly BuiltCell[], private readonly bin = 2, layers: readonly GroundLayer[] = ALL_LAYERS, box?: readonly [number, number, number, number]) {
    for (let ci = 0; ci < cells.length; ci++) {
      for (let li = 0; li < layers.length; li++) {
        const m = cells[ci].layers[layers[li]];
        if (!m) continue;
        const pos = m.positions, idx = m.indices;
        for (let t = 0; t < idx.length; t += 3) {
          const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
          const x0 = Math.min(pos[a], pos[b], pos[c]), x1 = Math.max(pos[a], pos[b], pos[c]), y0 = Math.min(pos[a + 1], pos[b + 1], pos[c + 1]), y1 = Math.max(pos[a + 1], pos[b + 1], pos[c + 1]);
          if (box && (x1 < box[0] || x0 > box[2] || y1 < box[1] || y0 > box[3])) continue;
          const id = this.tris.length / 3;
          this.tris.push(ci, li, t);
          for (let i = Math.floor(x0 / bin); i <= Math.floor(x1 / bin); i++) for (let j = Math.floor(y0 / bin); j <= Math.floor(y1 / bin); j++) {
            const k = HitIndex.key(i, j);
            let list = this.bins.get(k);
            if (!list) this.bins.set(k, list = []);
            list.push(id);
          }
        }
      }
    }
    this.layers = layers;
  }
  private readonly layers: readonly GroundLayer[];
  private static key(i: number, j: number): number { return (i + 50000) * 100000 + (j + 50000); }

  /** Every triangle under (x, y), mask discard applied as the shader does, topmost first (groundCell.ts compareHits). */
  at(x: number, y: number): Hit[] {
    const list = this.bins.get(HitIndex.key(Math.floor(x / this.bin), Math.floor(y / this.bin)));
    const hits: (Hit & { rank: number })[] = [];
    for (const id of list ?? []) {
      const cell = this.cells[this.tris[id * 3]], layer = this.layers[this.tris[id * 3 + 1]], t = this.tris[id * 3 + 2];
      const m = cell.layers[layer]!, pos = m.positions, idx = m.indices;
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const d = (pos[b + 1] - pos[c + 1]) * (pos[a] - pos[c]) + (pos[c] - pos[b]) * (pos[a + 1] - pos[c + 1]);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((pos[b + 1] - pos[c + 1]) * (x - pos[c]) + (pos[c] - pos[b]) * (y - pos[c + 1])) / d;
      const v = ((pos[c + 1] - pos[a + 1]) * (x - pos[c]) + (pos[a] - pos[c]) * (y - pos[c + 1])) / d;
      if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue;
      const ch = CUT_CHANNEL[layer];
      const cut = ch !== undefined && !!cell.mask && maskChannelAt(cell.mask, x, y, ch) < 0.5;
      hits.push({ layer, z: u * pos[a + 2] + v * pos[b + 2] + (1 - u - v) * pos[c + 2], cut, rank: DRAW_RANK[layer] ?? 0 });
    }
    hits.sort((p, q) => Math.abs(p.z - q.z) > 0.02 ? q.z - p.z : q.rank - p.rank);
    return hits.map(({ layer, z, cut }) => ({ layer, z, cut }));
  }
}

/** Layers a camera above can see a road through or instead of (vertical-only layers are left out: bollards, furniture, hedges). */
const ALL_LAYERS: readonly GroundLayer[] = ['land', 'park', 'wood', 'square', 'parking', 'lawn', 'bed', 'shrub', 'bark', 'sand', 'parkGravel', 'parkPath', 'pond', 'garden', 'asphalt', 'klinker', 'brick', 'cycle', 'paving', 'gravel', 'kerb', 'paint', 'tram', 'water', 'quay', 'deckBody', 'deckTop', 'ballast', 'track'];

/** One probe point. */
export interface Sample { s: number; lateral: number; x: number; y: number; top: GroundLayer | null; topZ: number; cls: TopClass; cause: GapCause | null; ride: number; /** Second visible hit is a different layer within 5 mm at the same draw rank: the GPU picks per pixel. */ tie: boolean; deck: string | null; /** The road survey under the point (roads-v1): a deck-level polygon (h ≥ 1), a ground one, or none. */ survey: 'deck' | 'ground' | null }

export interface WayProbeOptions {
  /** Metres probed past each end of the bridge way, along its end segment (the abutment and the approach). */
  approachM?: number;
  stepM?: number;
  /** Lateral offsets as fractions of the carriageway half-width (0 = centreline). */
  lateral?: readonly number[];
}
export const APPROACH_M = 8, STEP_M = 0.5, LATERAL: readonly number[] = [-0.85, -0.45, 0, 0.45, 0.85];

/** Stations along a polyline extended `approach` metres past both ends: s from −approach (start) to length + approach. */
export function stations(points: readonly Vec2[], step: number, approach: number): { s: number; x: number; y: number; nx: number; ny: number; inWay: boolean }[] {
  const out: { s: number; x: number; y: number; nx: number; ny: number; inWay: boolean }[] = [];
  const segs: { ax: number; ay: number; ux: number; uy: number; l: number; s0: number }[] = [];
  let len = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = points[i], [bx, by] = points[i + 1], l = Math.hypot(bx - ax, by - ay);
    if (l < 1e-6) continue;
    segs.push({ ax, ay, ux: (bx - ax) / l, uy: (by - ay) / l, l, s0: len });
    len += l;
  }
  if (!segs.length) return out;
  const n = Math.round((len + 2 * approach) / step);
  for (let k = 0; k <= n; k++) {
    const s = -approach + (len + 2 * approach) * k / n;
    let g = segs[0];
    for (const q of segs) if (s >= q.s0) g = q;
    const t = s - g.s0;
    out.push({ s, x: g.ax + g.ux * t, y: g.ay + g.uy * t, nx: -g.uy, ny: g.ux, inWay: s >= 0 && s <= len });
  }
  return out;
}

/** The non-road cause of a sample from its sorted hits: a road triangle under it (buried), one cut by the mask (masked), or none (missing). */
export function gapCause(hits: readonly Hit[]): GapCause {
  if (hits.some(h => !h.cut && ROAD_LAYERS.has(h.layer))) return 'buried';
  if (hits.some(h => h.cut && ROAD_LAYERS.has(h.layer))) return 'masked';
  return 'missing';
}

/** Probe one way: samples on the stations × lateral offsets. `deckAt` names the deck carrying a point (null: none). */
export function probeWay(index: HitIndex, points: readonly Vec2[], halfWidth: number, ride: (x: number, y: number) => number, deckAt: (x: number, y: number) => string | null, opts: WayProbeOptions = {}, surveyAt: (x: number, y: number) => 'deck' | 'ground' | null = () => null): { length: number; samples: Sample[] } {
  const step = opts.stepM ?? STEP_M, approach = opts.approachM ?? APPROACH_M, lateral = opts.lateral ?? LATERAL;
  const st = stations(points, step, approach), samples: Sample[] = [];
  for (const p of st) for (const f of lateral) {
    const x = p.x + p.nx * f * halfWidth, y = p.y + p.ny * f * halfWidth;
    const hits = index.at(x, y).filter(h => !h.cut || ROAD_LAYERS.has(h.layer));
    const visible = hits.filter(h => !h.cut), top = visible[0] ?? null, cls = topClass(top?.layer ?? null);
    const second = visible[1];
    const tie = !!top && !!second && second.layer !== top.layer && Math.abs(second.z - top.z) < 0.005 && (DRAW_RANK[second.layer] ?? 0) === (DRAW_RANK[top.layer] ?? 0) && topClass(second.layer) !== topClass(top.layer);
    samples.push({ s: p.s, lateral: f, x, y, top: top?.layer ?? null, topZ: top ? top.z : NaN, cls, cause: cls === 'road' ? null : gapCause(hits), ride: ride(x, y), tie, deck: deckAt(x, y), survey: surveyAt(x, y) });
  }
  return { length: st.length ? st[st.length - 1].s - approach : 0, samples };
}

/** Per-way summary (one table row). */
export interface WayGapSummary {
  /** Total centreline metres whose top is not road. */
  centreGapM: number;
  /** Longest run of non-road centreline samples, metres. */
  longestGapM: number;
  /** Carriageway area (all lateral samples, each standing for its share of the width) whose top is not road, m². */
  bandGapM2: number;
  /** Non-road samples by what shows: the deck top, land/grey, a hole, the bridge body. */
  shows: Record<Exclude<TopClass, 'road'>, number>;
  /** Non-road samples by cause. */
  causes: Record<GapCause, number>;
  /** Non-road samples on a deck / off any deck (the deck narrower or shorter than the road). */
  onDeck: number; offDeck: number;
  /** Non-road samples by what carries them (deckRelation's kind: measured, side, claim, way, flat, none). */
  carriers: Record<string, number>;
  /** Non-road samples by carrier kind and survey level (`<kind>/<deck|ground|none>`): a deck-level survey polygon there that was not drawn is the survey's bridge dropped. */
  bySurvey: Record<string, number>;
  /** Samples where the top is a coplanar tie between different classes at the same draw rank (z-fight). */
  ties: number;
  /** Largest jump of the drawn top between neighbouring centreline samples, m (an abutment step), and where (s, m from the way's start). */
  maxStepM: number; maxStepAt: number;
  /** Largest gap between the drawn top and the riding surface on the centreline, m (positive: drawn above the wheels). */
  maxRideOffM: number;
  samples: number;
}

export function summarise(samples: readonly Sample[], halfWidth: number, step = STEP_M, lateral: readonly number[] = LATERAL): WayGapSummary {
  const shows = { deck: 0, land: 0, hole: 0, body: 0 }, causes = { missing: 0, buried: 0, masked: 0 };
  let onDeck = 0, offDeck = 0, ties = 0, bandGapM2 = 0;
  const carriers: Record<string, number> = {}, bySurvey: Record<string, number> = {};
  const share = (2 * halfWidth) / lateral.length;
  for (const q of samples) {
    if (q.tie) ties++;
    if (q.cls === 'road') continue;
    shows[q.cls]++;
    causes[q.cause!]++;
    if (q.deck && !/^(side|claim):/.test(q.deck)) onDeck++; else offDeck++;
    const kind = carrierKind(q.deck);
    carriers[kind] = (carriers[kind] ?? 0) + 1;
    const sk = `${kind}/${q.survey ?? 'none'}`;
    bySurvey[sk] = (bySurvey[sk] ?? 0) + 1;
    bandGapM2 += step * share;
  }
  const centre = samples.filter(q => q.lateral === 0);
  let centreGapM = 0, run = 0, longestGapM = 0, maxStepM = 0, maxStepAt = 0, maxRideOffM = 0;
  for (let i = 0; i < centre.length; i++) {
    const q = centre[i];
    if (q.cls !== 'road') { centreGapM += step; run += step; longestGapM = Math.max(longestGapM, run); } else run = 0;
    if (q.cls !== 'hole' && Number.isFinite(q.topZ) && Math.abs(q.topZ - q.ride) > Math.abs(maxRideOffM)) maxRideOffM = q.topZ - q.ride;
    const p = centre[i - 1];
    if (p && Number.isFinite(p.topZ) && Number.isFinite(q.topZ) && p.cls !== 'hole' && q.cls !== 'hole') {
      const d = Math.abs(q.topZ - p.topZ);
      if (d > maxStepM) { maxStepM = d; maxStepAt = q.s; }
    }
  }
  return { centreGapM, longestGapM, bandGapM2: +bandGapM2.toFixed(1), shows, causes, onDeck, offDeck, carriers, bySurvey, ties, maxStepM: +maxStepM.toFixed(3), maxStepAt: +maxStepAt.toFixed(1), maxRideOffM: +maxRideOffM.toFixed(3), samples: samples.length };
}

/** The kind of a deckRelation value: measured, side, claim, way, flat or none. */
export const carrierKind = (deck: string | null): string => !deck ? 'none' : deck === 'flat' ? 'flat' : /^BRU|^[^:]+$/.test(deck) ? 'measured' : deck.split(':')[0];

/** Counts of values in [edges[i], edges[i+1]); the last bin is open-ended. */
export function histogram(values: readonly number[], edges: readonly number[]): { from: number; to: number | null; count: number }[] {
  const bins = edges.map((e, i) => ({ from: e, to: i + 1 < edges.length ? edges[i + 1] : null, count: 0 }));
  for (const v of values) {
    for (let i = bins.length - 1; i >= 0; i--) if (v >= bins[i].from) { bins[i].count++; break; }
  }
  return bins;
}

/** The claim zone past a measured deck's widest side within which no way deck is placed (groundStore.ts claimedBy, wayDecks.ts WAY_DECK_CLEAR_M). */
export const CLAIM_CLEAR_M = 4;

/**
 * What carries a point, for the probe: a measured deck's id within its riding half-width over its span; `side:<id>` within
 * the outline's wider side (DeckProfile.sides) but past the riding half-width; `claim:<id>` within the zone where that
 * deck keeps a way deck out (its widest side + CLAIM_CLEAR_M) but outside the outline; `way:<id>` a way deck; `flat` an
 * unmeasured footprint; null nothing.
 */
export function deckRelation(decks: readonly DeckSurface[], flats: readonly (readonly Vec2[])[], x: number, y: number): string | null {
  let side: string | null = null, claim: string | null = null;
  for (const d of decks) {
    const p = d.profile, [x0, y0, x1, y1] = p.bbox, reach = Math.max(...(p.sides ?? [0])) + CLAIM_CLEAR_M + 1;
    if (x < x0 - reach || x > x1 + reach || y < y0 - reach || y > y1 + reach) continue;
    const at = signedLocate(d, x, y);
    if (at.s < d.span[0] - 1 || at.s > d.span[1] + 1) continue;
    const id = p.family === 'way-deck' ? `way:${p.id}` : p.id, hw = at.halfWidth, abs = Math.abs(at.lateral);
    if (abs <= hw && at.s >= d.span[0] && at.s <= d.span[1]) return id;
    const sideHw = p.sides ? p.sides[at.lateral >= 0 ? 0 : 1] : hw;
    if (abs <= Math.max(hw, sideHw)) side ??= `side:${id}`;
    else if (p.family !== 'way-deck' && abs <= Math.max(hw, ...(p.sides ?? [])) + CLAIM_CLEAR_M) claim ??= `claim:${id}`;
  }
  for (const r of flats) if (inRing(r, x, y)) return 'flat';
  return side ?? claim;
}

/** GroundSurface.locate with the lateral signed: positive to the left of the deck line (the +normal, DeckProfile.sides[0]). */
export function signedLocate(deck: DeckSurface, x: number, y: number): { s: number; lateral: number; halfWidth: number } {
  const p = deck.profile, n = p.x.length;
  let best = Infinity, bi = 0, bt = 0;
  for (let i = 0; i + 1 < n; i++) {
    const ax = p.x[i], ay = p.y[i], dx = p.x[i + 1] - ax, dy = p.y[i + 1] - ay, len2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const ex = ax + dx * t - x, ey = ay + dy * t - y, d2 = ex * ex + ey * ey;
    if (d2 < best) { best = d2; bi = i; bt = t; }
  }
  const j = Math.min(n - 1, bi + 1), dx = p.x[j] - p.x[bi], dy = p.y[j] - p.y[bi];
  const sign = dx * (y - p.y[bi]) - dy * (x - p.x[bi]) >= 0 ? 1 : -1;
  return { s: p.s[bi] + (p.s[j] - p.s[bi]) * bt, lateral: sign * Math.sqrt(best), halfWidth: p.halfWidth[bi] + (p.halfWidth[j] - p.halfWidth[bi]) * bt };
}

function inRing(ring: readonly Vec2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ------------------------------------------------------------------ the fix: one width per deck side (bridgeGaps)

/** Survey edge walk: step across, the largest gap between deck-level polygons crossed, the margin past the last hit. */
export const EDGE_STEP_M = 0.5, EDGE_GAP_M = 1.5;
/** A deck whose survey reaches less than this past its half-width on both sides keeps no edges (unchanged). */
export const EDGE_MIN_WIDEN_M = 0.3;
/** Without an outline side (DeckProfile.sides: the outline is not OUTLINE_WIDER_M wider), the survey may widen a side by at most this. */
export const EDGE_NO_OUTLINE_M = 2;
/** Along the deck a station takes the widest edge within this (one skewed polygon corner does not notch the parapet). */
export const EDGE_SPREAD_M = 1;

/**
 * The riding half-widths left and right of a deck's road line from the road survey's deck-level polygons (h ≥ 1,
 * `onDeckPoly`), per station over the deck span (issue #178): each side walks out from the line in EDGE_STEP_M steps,
 * across gaps of at most EDGE_GAP_M, to the last deck-level point, capped at the outline's side (DeckProfile.sides)
 * plus a step, or the half-width plus EDGE_NO_OUTLINE_M. Never narrower than the half-width; outside the span the
 * half-width. Null when no station widens by EDGE_MIN_WIDEN_M (the deck is left as it was).
 */
export function surveyDeckEdges(p: Pick<DeckProfile, 'x' | 'y' | 's' | 'halfWidth' | 'deck' | 'sides'>, onDeckPoly: (x: number, y: number) => boolean): { left: Float64Array; right: Float64Array } | null {
  const n = p.s.length, raw = [new Float64Array(n), new Float64Array(n)], hwMax = Math.max(...p.halfWidth);
  let widened = false;
  for (let i = 0; i < n; i++) {
    const hw = p.halfWidth[i];
    raw[0][i] = raw[1][i] = hw;
    if (p.s[i] < p.deck[0] || p.s[i] > p.deck[1]) continue;
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    for (const side of [0, 1] as const) {
      const sg = side === 0 ? 1 : -1, cap = p.sides ? Math.max(hw, p.sides[side]) + EDGE_STEP_M : hwMax + EDGE_NO_OUTLINE_M;
      let last = -1;
      for (let t = 0; t <= cap + 1e-9 && t - Math.max(0, last) <= EDGE_GAP_M; t += EDGE_STEP_M) if (onDeckPoly(p.x[i] + nx * sg * t, p.y[i] + ny * sg * t)) last = t;
      if (last >= 0) raw[side][i] = Math.max(hw, Math.min(cap, last + EDGE_STEP_M / 2));
    }
  }
  const out = [new Float64Array(n), new Float64Array(n)];
  for (const side of [0, 1] as const) for (let i = 0; i < n; i++) {
    let v = raw[side][i];
    if (p.s[i] >= p.deck[0] && p.s[i] <= p.deck[1]) {
      for (let j = i - 1; j >= 0 && p.s[i] - p.s[j] <= EDGE_SPREAD_M; j--) if (p.s[j] >= p.deck[0]) v = Math.max(v, raw[side][j]);
      for (let j = i + 1; j < n && p.s[j] - p.s[i] <= EDGE_SPREAD_M; j++) if (p.s[j] <= p.deck[1]) v = Math.max(v, raw[side][j]);
    }
    out[side][i] = v;
    if (v - p.halfWidth[i] >= EDGE_MIN_WIDEN_M) widened = true;
  }
  return widened ? { left: out[0], right: out[1] } : null;
}

/** A deck profile's box grown to its edges (DeckProfile.edges). */
export function edgesBox(p: Pick<DeckProfile, 'bbox' | 'halfWidth'>, edges: { left: Float64Array; right: Float64Array }): [number, number, number, number] {
  let r = 0;
  for (let i = 0; i < edges.left.length; i++) r = Math.max(r, edges.left[i] - p.halfWidth[i], edges.right[i] - p.halfWidth[i]);
  const [x0, y0, x1, y1] = p.bbox;
  return [x0 - r, y0 - r, x1 + r, y1 + r];
}
