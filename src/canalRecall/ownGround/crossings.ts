// The crossing register (lane G3, 2026-11-10): evidenced records for every vertical crossing, which the ground treats
// as truth where inference from tags and terrain has failed (pure, no DOM).
//
// User 2026-11-10, on the ring corridor ("I think you need to make some larger manual changes to the source data to
// model this correctly, yes?"): crossings guessed from OSM tags and the 2 m DTM drew a false 73 m rail span over the
// Piet Kranenbergpad, tunnel-portal boxes standing on grass at the Overschiestraat and Anthony Fokkerweg, and saddles
// under every deck. railViaducts.ts already carried one authored record (the Droogbak, BGT + AHN + panoramas); this
// generalises it: one record per vertical crossing in `data/crossings/<area>.json`, drafted from BGT, OSM and AHN by
// `scripts/crossings/draft.ts` and reviewed by eye against the PDOK orthophoto and a city panorama
// (`scripts/crossings/review-sheet.ts`), with the source ids and image ids kept as evidence.
//
// What the game takes from a record (`crossingIndex`, behind `?crossings=0`; byte-identical where no record lies):
//
//   spans    railSpans.ts infers a deck where a street passes under a track off the bridges. Inside a record's zone the
//            inferred spans go; the record's decks that carry rail, metro or tram become the spans instead (the track's
//            stretch inside such a deck polygon; a road deck with a tram on it, Delflandlaan over the Cornelis Lelylaan,
//            carries 'tram'). A `level`, `none` or `road-under` record makes none: the track stays on the ground.
//   cuts     tunnels.ts infers ramps and slots from OSM tunnel ways and a DTM scan. A record with `game.cuts: 'none'`
//            removes the cut stations inside its zone (a cut wholly inside goes); `'keep'` leaves them.
//   portals  `game.portals: 'listed'` keeps only the inferred mouths within PORTAL_MATCH_M of a listed portal, `'none'`
//            drops every mouth in the zone (the open sides of a slot stay open), `'keep'` leaves them.
//   caps     `heights.streetUnder` (NAP) with the deck polygons is the floor G1's deck caps flatten the relief to
//            (`floorCaps`); the runtime here does not cap (the relief is the published ground-height extract).
//   grade    `heights.gradeSides` is the rail or road level on each side (NAP), for railProfile.ts to follow (`OPEN`:
//            a1's rails lane owns the profile; the record carries the numbers).
//
// Heights are NAP metres (scene z = NAP − the relief's sceneDatumNAP). Coordinates are WGS84 [lng, lat].

import type { Vec2 } from './surface.js';
import { cutBox, type Cut } from './tunnels.js';
import type { RailSpan } from './railSpans.js';
import NAMED from '../../../data/crossings/named.json';
import RING_RAIL from '../../../data/crossings/ring-rail.json';
import A10 from '../../../data/crossings/a10.json';
import TUNNELS from '../../../data/crossings/tunnels.json';

export type LngLat = [number, number];

/**
 * rail-over-road   a rail (train, metro, tram) deck over a street, path or water-and-street passage
 * road-over-road   a road or path deck over another street or path
 * road-over-rail   a road or path deck over track (the track runs on the ground under it)
 * road-under       a street or path that dives under an embankment or a deck in a slot or tunnel (walls, portals)
 * level            the ways meet at the same level (a level crossing, a path beside a deck at grade)
 * none             no crossing at all: inference drew one that the photos show is not there
 */
export type CrossingKind = 'rail-over-road' | 'road-over-road' | 'road-over-rail' | 'road-under' | 'level' | 'none';
export const CROSSING_KINDS: readonly CrossingKind[] = ['rail-over-road', 'road-over-road', 'road-over-rail', 'road-under', 'level', 'none'];
export type Carries = 'rail' | 'metro' | 'tram' | 'road' | 'motorway' | 'cycle' | 'foot';

export interface CrossingDeck {
  ring: LngLat[];
  carries: Carries;
  /**
   * The carried way's heading over the deck, degrees clockwise from north, 0..180 (a line, not a direction). A track
   * becomes a span on a rail deck only where it runs within AXIS_TOL_DEG of this: a track crossing under the deck (the
   * museum tram under the ring decks at the Piet Kranenbergpad) lies inside the polygon in plan but is not on it.
   */
  axisDeg?: number;
  /** BGT overbruggingsdeel lokaal_ids the ring is the union of. */
  bgt?: string[];
}
export interface CrossingPortal { at: LngLat; /** Heading into the tunnel, degrees clockwise from north. */ headingDeg: number; /** A slot's open end: a headwall, no dark mouth. */ open?: boolean }

export interface CrossingRecord {
  id: string;
  label: string;
  /** The register file it lives in (data/crossings/<area>.json). */
  area: string;
  kind: CrossingKind;
  /** The crossing's centre (where the ways cross). */
  at: LngLat;
  /** The region the record governs: inferred spans, cuts and portals inside it are replaced by the record. */
  zone: LngLat[];
  plan: {
    decks: CrossingDeck[];
    /** Piers and columns (BGT overbruggingsdeel pijler, kunstwerkdeel), polygons. */
    piers?: { ring: LngLat[]; bgt?: string }[];
    /** Retaining and wing walls not at a deck end (BGT scheiding_lijn muur), lines. */
    walls?: { line: LngLat[]; bgt?: string }[];
    /**
     * The deck's abutments: where the embankment or approach ends at the deck. A `line` is the wall face (BGT
     * scheiding_lijn muur) with the street on the deck's side; a `ring` is the abutment body (BGT overbruggingsdeel at
     * hoogteligging 0 beside the deck, or landhoofd). G1's caps stop at them; G2c makes each a step breakline
     * (high: `heights.gradeSides`, low: `heights.streetUnder`).
     */
    abutments?: { line?: LngLat[]; ring?: LngLat[]; bgt?: string }[];
    /** Tunnel parts (BGT tunneldeel, kunstwerkdeel), polygons. */
    tunnels?: { ring: LngLat[]; bgt?: string }[];
    portals?: CrossingPortal[];
  };
  /** NAP metres; absent: not measured (AHN has no data there or it is not meaningful for the kind). */
  heights: {
    /** The street or path level under the deck (AHN DTM just outside the open sides). */
    streetUnder?: number;
    /** The underside of the deck: estimated as deckTop − deckDepth where no measurement exists (`soffitEstimated`). */
    soffit?: number;
    soffitEstimated?: boolean;
    /** The deck's top (AHN DSM on the deck, rail or road surface). */
    deckTop?: number;
    /** The carried way's level just past each end (AHN DTM/DSM on the bed or the road). */
    gradeSides?: { at: LngLat; z: number }[];
  };
  /** OSM way ids over and under the crossing, and every BGT id the record rests on. */
  binds: { over: number[]; under: number[]; bgt: string[] };
  /** How the game treats inference in the zone (defaults by kind: `gameDefaults`). */
  game?: { cuts?: 'keep' | 'none'; portals?: 'keep' | 'listed' | 'none' };
  evidence: {
    /** Source descriptions with ids (BGT, OSM, AHN requests). */
    sources: string[];
    /** Orthophoto crops checked (scripts/crossings/review-sheet.ts output names, PDOK Actueel_orthoHR). */
    ortho: string[];
    /** City panorama ids checked (api.data.amsterdam.nl/panorama). */
    panoramas: string[];
    /** What the photos show, and why the record says what it says. */
    notes: string;
  };
  /** Where tags, the survey and the terrain disagree (from the draft), and how the review settled it. */
  disagreements?: string[];
  reviewed: { by: string; on: string; verdict: 'confirmed' | 'corrected' } | null;
}

export interface CrossingFile { version: 1; area: string; description: string; records: CrossingRecord[] }

/** An inferred mouth within this of a listed portal is the record's portal, metres. */
export const PORTAL_MATCH_M = 15;
/** A record-made span reaches this far past the rail deck's polygon at each end (the fascia, the abutment's face), metres. */
export const RECORD_SPAN_PAD_M = 0;
/** A track within this of a rail deck's axis runs on the deck, degrees. */
export const AXIS_TOL_DEG = 30;
/** A cut with at least this share of its stations inside a `cuts: 'none'` zone goes whole. */
export const CUT_DROP_SHARE = 0.5;

export function gameDefaults(kind: CrossingKind): { cuts: 'keep' | 'none'; portals: 'keep' | 'listed' | 'none' } {
  switch (kind) {
    case 'road-under': return { cuts: 'keep', portals: 'listed' };
    case 'level': case 'none': return { cuts: 'none', portals: 'none' };
    // Under a deck a street runs on at grade: a cut there is the DTM's hole under the deck, not a trench.
    default: return { cuts: 'none', portals: 'none' };
  }
}

/** Problems with a record (empty: valid). */
export function validateRecord(r: CrossingRecord): string[] {
  const e: string[] = [];
  const ll = (p: unknown) => Array.isArray(p) && p.length === 2 && p.every(v => typeof v === 'number' && Number.isFinite(v)) && (p as number[])[0] > 4.6 && (p as number[])[0] < 5.2 && (p as number[])[1] > 52.2 && (p as number[])[1] < 52.5;
  const ring = (rg: unknown, min = 3) => Array.isArray(rg) && rg.length >= min && rg.every(ll);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(r.id)) e.push(`${r.id}: id must be kebab-case`);
  if (!CROSSING_KINDS.includes(r.kind)) e.push(`${r.id}: unknown kind ${r.kind}`);
  if (!ll(r.at)) e.push(`${r.id}: at is not an Amsterdam [lng, lat]`);
  if (!ring(r.zone)) e.push(`${r.id}: zone needs at least 3 [lng, lat] points`);
  else if (!insideRing(r.zone.map(p => [p[0], p[1]] as Vec2), r.at[0], r.at[1])) e.push(`${r.id}: at lies outside its zone`);
  for (const d of r.plan.decks) { if (!ring(d.ring)) e.push(`${r.id}: a deck ring is not a polygon`); }
  for (const a of r.plan.abutments ?? []) if (!(a.line ? a.line.length >= 2 && a.line.every(ll) : a.ring ? ring(a.ring) : false)) e.push(`${r.id}: an abutment needs a line or a ring`);
  for (const p of r.plan.portals ?? []) if (!ll(p.at) || !(p.headingDeg >= 0 && p.headingDeg < 360)) e.push(`${r.id}: bad portal`);
  if ((r.kind === 'rail-over-road') && !r.plan.decks.some(d => d.carries === 'rail' || d.carries === 'metro' || d.carries === 'tram')) e.push(`${r.id}: a rail-over-road record needs a deck that carries rail`);
  for (const d of r.plan.decks) if ((d.carries === 'rail' || d.carries === 'metro' || d.carries === 'tram') && !(d.axisDeg !== undefined && d.axisDeg >= 0 && d.axisDeg < 180)) e.push(`${r.id}: a deck carrying ${d.carries} needs axisDeg (0..180)`);
  if ((r.kind === 'road-over-road' || r.kind === 'road-over-rail') && !r.plan.decks.length) e.push(`${r.id}: a ${r.kind} record needs its deck`);
  const h = r.heights;
  for (const [k, v] of Object.entries(h)) if (typeof v === 'number' && !(v > -20 && v < 40)) e.push(`${r.id}: heights.${k} ${v} is not a NAP level here`);
  if (h.soffit !== undefined && h.deckTop !== undefined && !(h.soffit < h.deckTop)) e.push(`${r.id}: soffit above the deck top`);
  if (h.soffit !== undefined && h.streetUnder !== undefined && !(h.soffit > h.streetUnder)) e.push(`${r.id}: soffit under the street`);
  if (!r.evidence?.sources?.length) e.push(`${r.id}: no evidence sources`);
  if (r.reviewed && (!r.evidence.ortho.length || !r.evidence.panoramas.length)) e.push(`${r.id}: reviewed without an orthophoto and a panorama`);
  if (r.reviewed && !/^\d{4}-\d{2}-\d{2}$/.test(r.reviewed.on)) e.push(`${r.id}: reviewed.on must be YYYY-MM-DD`);
  return e;
}

export function validateFile(f: CrossingFile): string[] {
  const e: string[] = [];
  if (f.version !== 1) e.push(`${f.area}: version must be 1`);
  const ids = new Set<string>();
  for (const r of f.records) {
    if (ids.has(r.id)) e.push(`${r.id}: duplicate id`);
    ids.add(r.id);
    if (r.area !== f.area) e.push(`${r.id}: area ${r.area} in file ${f.area}`);
    e.push(...validateRecord(r));
  }
  return e;
}

/** Every register file the game reads (reviewed records only take effect: `crossingIndex`). */
// JSON imports widen tuples to number[]; validateFile (crossings.test.ts) checks the shape.
export const CROSSING_FILES: readonly CrossingFile[] = [NAMED, RING_RAIL, A10, TUNNELS] as unknown as CrossingFile[];
export const CROSSINGS: readonly CrossingRecord[] = CROSSING_FILES.flatMap(f => f.records);

/** Two line headings (0..180) within AXIS_TOL_DEG. */
const alongAxis = (a: number, b: number) => { const d = Math.abs(a - b) % 180; return Math.min(d, 180 - d) <= AXIS_TOL_DEG; };

/** Even-odd point in polygon. */
export function insideRing(ring: readonly Vec2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const RAIL_CARRIES: ReadonlySet<Carries> = new Set(['rail', 'metro', 'tram']);

interface Placed { r: CrossingRecord; zone: Vec2[]; box: [number, number, number, number]; railDecks: { ring: Vec2[]; axis: number }[]; portals: Vec2[]; game: { cuts: 'keep' | 'none'; portals: 'keep' | 'listed' | 'none' } }

export interface CrossingIndex {
  /** Records placed (reviewed ones; `drafts` adds the rest, for diagnostics). */
  readonly size: number;
  /** The record whose zone holds (x, y), local frame. */
  at(x: number, y: number): CrossingRecord | null;
  /**
   * The spans of one track: inferred spans whose trigger lies in a zone go, and a rail-over-road record's rail decks
   * the track runs through become spans (s along the track's points, `clear` from the record's heights or the
   * inferred span it replaces). `points` is the track's polyline in the local frame.
   */
  spans(points: readonly Vec2[], inferred: readonly RailSpan[], bridge: boolean): RailSpan[];
  /** The cuts with the records applied (zones with `cuts: 'none'` cut out, portals filtered). Stats in `stats`. */
  cuts(cuts: readonly Cut[], stats?: CrossingCutStats): Cut[];
}
export interface CrossingCutStats { dropped: number; sliced: number; portalsDropped: number }

/**
 * Place the records in the local frame (`project`). Only reviewed records act unless `drafts` (a draft is a guess like
 * the inference it would replace). An empty index changes nothing: `spans` and `cuts` return their input.
 */
export function crossingIndex(records: readonly CrossingRecord[], project: (p: LngLat) => Vec2, opts: { drafts?: boolean } = {}): CrossingIndex {
  const placed: Placed[] = records.filter(r => opts.drafts || r.reviewed).map(r => {
    const zone = r.zone.map(project), xs = zone.map(p => p[0]), ys = zone.map(p => p[1]);
    return {
      r, zone, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      railDecks: r.kind !== 'level' && r.kind !== 'none' && r.kind !== 'road-under' ? r.plan.decks.filter(d => RAIL_CARRIES.has(d.carries) && d.axisDeg !== undefined).map(d => ({ ring: d.ring.map(project), axis: d.axisDeg! })) : [],
      portals: (r.plan.portals ?? []).map(p => project(p.at)),
      game: { ...gameDefaults(r.kind), ...(r.game ?? {}) },
    };
  });
  const find = (x: number, y: number): Placed | null => placed.find(p => x >= p.box[0] && x <= p.box[2] && y >= p.box[1] && y <= p.box[3] && insideRing(p.zone, x, y)) ?? null;
  return {
    size: placed.length,
    at(x, y) { return find(x, y)?.r ?? null; },
    spans(points, inferred, bridge) {
      if (!placed.length || points.length < 2) return inferred.slice();
      const kept = inferred.filter(sp => !find(sp.at[0], sp.at[1]));
      if (bridge) return kept;
      // The track's stretch inside each rail deck: stations every metre, runs of inside stations.
      const cum = [0];
      for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
      const total = cum[cum.length - 1];
      const at = (s: number): Vec2 => {
        let i = 0;
        while (i + 2 < points.length && cum[i + 1] < s) i++;
        const a = points[i], b = points[i + 1], f = Math.max(0, Math.min(1, (s - cum[i]) / (cum[i + 1] - cum[i] || 1)));
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      };
      // The track's heading at s (degrees clockwise from north, a line: 0..180), in the local frame (x east, y north).
      const headingAt = (s: number) => {
        let i = 0;
        while (i + 2 < points.length && cum[i + 1] < s) i++;
        const dx = points[i + 1][0] - points[i][0], dy = points[i + 1][1] - points[i][1];
        return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 180;
      };
      const made: RailSpan[] = [];
      for (const p of placed) {
        if (!p.railDecks.length) continue;
        let run: [number, number] | null = null;
        const close = () => {
          if (!run) return;
          const [s0, s1] = run, mid = at((s0 + s1) / 2), h = p.r.heights;
          const clear = h.deckTop !== undefined && h.streetUnder !== undefined ? +(h.deckTop - h.streetUnder).toFixed(2) : (inferred.find(sp => find(sp.at[0], sp.at[1]) === p)?.clear ?? 0);
          if (s1 - s0 >= 2) made.push({ s0: Math.max(0, s0 - RECORD_SPAN_PAD_M), s1: Math.min(total, s1 + RECORD_SPAN_PAD_M), clear, at: mid });
          run = null;
        };
        for (let s = 0; s <= total + 1e-9; s += 1) {
          const q = at(Math.min(s, total));
          const inside = q[0] >= p.box[0] && q[0] <= p.box[2] && q[1] >= p.box[1] && q[1] <= p.box[3] && p.railDecks.some(d => insideRing(d.ring, q[0], q[1]) && alongAxis(headingAt(Math.min(s, total)), d.axis));
          if (inside) run = run ? [run[0], Math.min(s, total)] : [Math.min(s, total), Math.min(s, total)];
          else close();
        }
        close();
      }
      return [...kept, ...made].sort((a, b) => a.s0 - b.s0);
    },
    cuts(cuts, stats) {
      if (!placed.length) return cuts.slice();
      const out: Cut[] = [];
      for (const c of cuts) {
        const box = c.bbox, near = placed.filter(p => p.box[0] <= box[2] && box[0] <= p.box[2] && p.box[1] <= box[3] && box[1] <= p.box[3]);
        if (!near.length) { out.push(c); continue; }
        const zoneOf = (i: number) => near.find(p => insideRing(p.zone, c.x[i], c.y[i])) ?? null;
        const zones = c.x.map((_, i) => zoneOf(i));
        const cutOut = zones.map(z => !!z && z.game.cuts === 'none');
        const n = cutOut.filter(Boolean).length;
        let pieces: Cut[];
        if (!n) pieces = [c];
        else if (n >= CUT_DROP_SHARE * c.x.length) { if (stats) stats.dropped++; continue; }
        else {
          pieces = [];
          for (let i = 0; i < cutOut.length;) {
            if (cutOut[i]) { i++; continue; }
            let j = i;
            while (j + 1 < cutOut.length && !cutOut[j + 1]) j++;
            if (j > i) pieces.push(slice(c, i, j));
            i = j + 1;
          }
          if (stats) stats.sliced++;
        }
        for (const piece of pieces) {
          const keepPortal = (pt: Cut['portals'][number]) => {
            const x = piece.x[pt.at], y = piece.y[pt.at], z = near.find(p => insideRing(p.zone, x, y));
            if (!z || z.game.portals === 'keep') return true;
            if (z.game.portals === 'none') return false;
            return z.portals.some(q => Math.hypot(q[0] - x, q[1] - y) <= PORTAL_MATCH_M);
          };
          const portals = piece.portals.filter(keepPortal);
          if (stats) stats.portalsDropped += piece.portals.length - portals.length;
          out.push(portals.length === piece.portals.length ? piece : { ...piece, portals });
        }
      }
      return out;
    },
  };
}

/** A cut's stations [i, j] as its own cut (tunnels.ts sliceCut, plus the median arrays). */
function slice(c: Cut, i: number, j: number): Cut {
  const pick = <T>(a: T[]) => a.slice(i, j + 1);
  const out: Cut = {
    ...c, id: `${c.id}/x${i}`, x: pick(c.x), y: pick(c.y), s: pick(c.s).map(v => v - c.s[i]), floor: pick(c.floor), left: pick(c.left), right: pick(c.right),
    wallL: pick(c.wallL), wallR: pick(c.wallR), rimL: pick(c.rimL), rimR: pick(c.rimR),
    ...(c.gapL ? { gapL: pick(c.gapL), gapR: pick(c.gapR!), nfL: pick(c.nfL!), nfR: pick(c.nfR!) } : {}),
    ...(c.medL ? { medL: pick(c.medL), medR: pick(c.medR!) } : {}),
    portals: c.portals.filter(p => p.at >= i && p.at <= j).map(p => ({ ...p, at: p.at - i })),
  };
  out.bbox = cutBox(out);
  return out;
}

/**
 * The floor caps a record implies (G1 item 1 reads these): each deck polygon over land with the street level under it.
 * Planar rings in `project`'s frame, NAP levels. Records without a measured street level give none.
 */
export function floorCaps(records: readonly CrossingRecord[], project: (p: LngLat) => Vec2): { id: string; rings: Vec2[][]; streetNAP: number }[] {
  return records.filter(r => r.reviewed && r.heights.streetUnder !== undefined && r.plan.decks.length && r.kind !== 'level' && r.kind !== 'none')
    .map(r => ({ id: r.id, rings: r.plan.decks.map(d => d.ring.map(project)), streetNAP: r.heights.streetUnder! }));
}
