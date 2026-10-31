// Railway infrastructure registered as buildings (lane rail-look round 3, 2026-10-31). Pure, no DOM.
//
// User reports at Amsterdam Amstel (build of 2026-10-31): "that big flat white thing is weird" (one OSM roof outline
// over all the platforms east of the hall, drawn as a pale slab one storey up with the tracks running out from under
// it) and "the houses under the tracks here are probably wrong" (a BAG pand under the elevated tracks, drawn by the
// generic house generator as a long low brick house with doors and windows).
//
// One rule from both, from data (never from names):
//   viaduct  a building standing on the ground (minHeight under FLOAT_M) whose footprint lies mostly under railway
//            track (COVER_VIADUCT of its area within TRACK_HALF_M of a heavy-rail, metro or light-rail centreline or
//            on a railway=platform), no taller than VIADUCT_MAX_M: the track's own structure (railBridge.ts piers and
//            slab, railTracks.ts raised slab) draws it, so the house is dropped. A pand with live verblijfsobjecten
//            used as shop, office, catering or meeting place (BAG gebruiksdoel) keeps its building: the shops under a
//            viaduct are real.
//   canopy   a building floating over the ground (minHeight at least FLOAT_M) or an OSM building=roof, at most
//            CANOPY_MAX_THICK_M thick, whose footprint lies mostly over track and platforms (COVER_CANOPY): drawn as
//            open canopies over the platforms only (the outline intersected with the platform rings), the tracks
//            between them open to the sky. With no platform under it, it is dropped.
//   A station hall (taller, or with much of its footprint off the tracks: the concourse) is never matched.
//
// The table is built offline (scripts/own-ground/build-rail-infra-buildings.ts, staged then published as
// rail-infra-buildings.json); the runtime enricher (railInfraEnricher) applies it per building tile.

export type Vec2 = [number, number];
export type RailInfraKind = 'viaduct' | 'canopy';

/** Footprint shares, 0..1, sampled on a grid inside the outline. */
export interface InfraShares {
  /** Within TRACK_HALF_M of a heavy-rail / metro / light-rail centreline, or on a platform. */
  cover: number;
  /** On a railway=platform ring. */
  platform: number;
  /** Under an OSM roof outline over the tracks (a canopy the table already draws), when measured. */
  roofed?: number;
  samples: number;
}

/** OSM tags where the outline is OSM's: `building`, `building:part`, `roof:shape`. */
export interface InfraCandidate { id: string; minHeight: number; height: number; osmBuilding?: string; osmPart?: string; roofShape?: string }
/** BAG pand use: live verblijfsobjecten' floor area by gebruiksdoel (scripts/landmarks/fetch-kit-pand-uses.ts format). */
export interface PandUse { status: string; vbos: number; area: Record<string, number> }

export const TRACK_HALF_M = 3.0;
export const FLOAT_M = 2.5;
export const COVER_VIADUCT = 0.7;
export const COVER_CANOPY = 0.6;
export const VIADUCT_MAX_M = 10;
export const CANOPY_MAX_THICK_M = 3.5;
/** Uses that mean people work or shop in the pand (BAG gebruiksdoel): such a pand keeps its building. */
export const LIVE_USES: readonly string[] = ['winkelfunctie', 'kantoorfunctie', 'bijeenkomstfunctie', 'woonfunctie', 'onderwijsfunctie', 'gezondheidszorgfunctie', 'logiesfunctie', 'industriefunctie', 'sportfunctie'];
/** A standing pand this much on platforms (and COVER_STANDING_CANOPY over track and platforms) is a platform canopy 3DBAG measured from the street, at most this tall. */
export const PLATFORM_CANOPY = { platform: 0.5, cover: 0.85, maxM: 20 } as const;
/** A pand's live use of at least this floor area keeps it, m². */
export const LIVE_USE_MIN_M2 = 15;

/** `top`: a canopy's roof stands at the pand's top (a standing pand measured to its canopy roof), not on its minHeight. */
export interface InfraVerdict { kind: RailInfraKind | null; why: string; top?: boolean }

/** Live use under this share of the footprint is the station complex's VBO registered on every pand, not a building in use. */
export const LIVE_USE_MIN_SHARE = 0.25;

/** `footprintM2`: the outline's area (the live-use share); omitted, any live use keeps the building. */
export function classifyRailInfra(c: InfraCandidate, s: InfraShares, use?: PandUse | null, footprintM2?: number): InfraVerdict {
  if (s.samples < 4) return { kind: null, why: 'too small to judge' };
  const thick = c.height - c.minHeight;
  // An arched roof over the tracks is a train shed (Centraal's Zuidkap, Middenkap and Noordkap): a hall, kept.
  if (c.roofShape === 'round' || c.roofShape === 'gambrel' || c.roofShape === 'barrel') return { kind: null, why: `train shed roof (roof:shape=${c.roofShape})` };
  // A building part that is not a roof (Centraal's hotel and signal box over the platforms) is a building.
  if (c.osmPart && c.osmPart !== 'roof') return { kind: null, why: `building:part=${c.osmPart}` };
  const floating = c.minHeight >= FLOAT_M || c.osmBuilding === 'roof' || c.osmPart === 'roof';
  if (floating) {
    if (thick <= CANOPY_MAX_THICK_M && s.cover >= COVER_CANOPY) return { kind: 'canopy', why: `floating ${c.minHeight}-${c.height} m, ${(s.cover * 100).toFixed(0)} % over track and platforms` };
    return { kind: null, why: 'floating, not over the tracks' };
  }
  if (s.cover < COVER_VIADUCT) return { kind: null, why: `${(s.cover * 100).toFixed(0)} % under track` };
  if (c.osmBuilding === 'train_station') return { kind: null, why: 'mapped as the station building' };
  // On the platforms under an OSM canopy outline: the station's deck under its canopies, 3DBAG-measured from the street
  // to the canopy roofs (Amstel: the station pand's part under the platforms and two pavilions on them, which the house
  // generator drew as long brick houses with a white slab on top). Its BAG use is the station's: not a house.
  if ((s.roofed ?? 0) >= 0.5 && s.platform >= 0.5 && c.height <= PLATFORM_CANOPY.maxM) return { kind: 'viaduct', why: `on the platforms, ${((s.roofed ?? 0) * 100).toFixed(0)} % under an OSM canopy` };
  // People shop, work or meet there (a station hall's shops, the workshops in a viaduct's arches): a building.
  const live = use ? Object.entries(use.area).filter(([k, a]) => LIVE_USES.includes(k) && a >= LIVE_USE_MIN_M2) : [];
  const liveM2 = live.reduce((t, [, a]) => t + a, 0);
  if (live.length && (!footprintM2 || liveM2 >= LIVE_USE_MIN_SHARE * footprintM2)) return { kind: null, why: `in use: ${live.map(([k, a]) => `${k} ${Math.round(a)} m²`).join(', ')}` };
  // Mostly on platforms: the platform canopies, measured by 3DBAG from the street to their roof.
  if (s.platform >= PLATFORM_CANOPY.platform && s.cover >= PLATFORM_CANOPY.cover && c.height <= PLATFORM_CANOPY.maxM) return { kind: 'canopy', top: true, why: `standing, ${(s.platform * 100).toFixed(0)} % on platforms, roof at ${c.height} m` };
  if (c.height > VIADUCT_MAX_M) return { kind: null, why: `${c.height} m: taller than a viaduct (a station hall)` };
  return { kind: 'viaduct', why: `${(s.cover * 100).toFixed(0)} % under track, ${c.height} m` };
}

/** Is (x, y) inside the ring (even-odd)? */
export function inRing(r: readonly Vec2[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
}

/**
 * Footprint shares on a `step` metre grid (local metres): `polygons` the outline (outer rings and holes, even-odd),
 * `tracks` the centrelines, `platforms` the platform rings.
 */
export function infraShares(polygons: readonly (readonly Vec2[])[], tracks: readonly (readonly Vec2[])[], platforms: readonly (readonly Vec2[])[], step = 1): InfraShares {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of polygons) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const segs: [Vec2, Vec2][] = [];
  for (const t of tracks) for (let i = 0; i + 1 < t.length; i++) {
    const a = t[i], b = t[i + 1];
    if (Math.max(a[0], b[0]) < x0 - TRACK_HALF_M || Math.min(a[0], b[0]) > x1 + TRACK_HALF_M || Math.max(a[1], b[1]) < y0 - TRACK_HALF_M || Math.min(a[1], b[1]) > y1 + TRACK_HALF_M) continue;
    segs.push([a, b]);
  }
  // Rings whose bounding box meets the outline's (a long platform's vertices may all lie far from it).
  const plats = platforms.filter(r => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of r) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return a <= x1 && c >= x0 && b <= y1 && d >= y0; });
  let n = 0, cover = 0, platform = 0;
  for (let x = x0 + step / 2; x < x1; x += step) for (let y = y0 + step / 2; y < y1; y += step) {
    let inside = false;
    for (const r of polygons) if (inRing(r, x, y)) inside = !inside;
    if (!inside) continue;
    n++;
    const onPlat = plats.some(r => inRing(r, x, y));
    if (onPlat) platform++;
    if (onPlat || segs.some(([a, b]) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0; return Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y) <= TRACK_HALF_M; })) cover++;
  }
  return { cover: n ? cover / n : 0, platform: n ? platform / n : 0, samples: n };
}

// ------------------------------------------------------------------ the published table and the runtime enricher

/** A canopy piece: one polygon (lng/lat outer ring), at the source building's minHeight. */
export interface CanopyPiece { ring: Vec2[] }
export interface RailInfraTable {
  version: 1;
  source: string;
  /** Building id → kind. */
  ids: Record<string, RailInfraKind>;
  /** Canopy id → its pieces over the platforms (absent or empty: dropped). */
  canopies: Record<string, CanopyPiece[]>;
  /** Canopy id → the roof's underside, metres over the ground, where it is not the source's minHeight (a standing pand measured to its roof). */
  canopyBase?: Record<string, number>;
}
export const RAIL_INFRA_FILE = 'rail-infra-buildings.json';
/** Canopy look: a thin light metal roof, dark fascia. */
export const CANOPY = { thickM: 0.45, roofHex: '#cfcdc8', fasciaHex: '#6e7275' } as const;

export const isRailInfraTable = (t: unknown): t is RailInfraTable => !!t && typeof t === 'object' && (t as RailInfraTable).version === 1 && typeof (t as RailInfraTable).ids === 'object';

interface Feature { type?: string; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } | null }

/**
 * Apply the table to one tile's features in place: a viaduct is removed, a canopy replaced by its pieces over the
 * platforms (thin, flat, on the source's minHeight). Returns the counts.
 */
export function applyRailInfra(features: Feature[], table: RailInfraTable): { viaducts: number; canopies: number; pieces: number } {
  const out = { viaducts: 0, canopies: 0, pieces: 0 };
  for (let i = features.length - 1; i >= 0; i--) {
    const f = features[i], id = String(f.properties?.id ?? ''), kind = table.ids[id];
    if (!kind) continue;
    features.splice(i, 1);
    if (kind === 'viaduct') { out.viaducts++; continue; }
    out.canopies++;
    const base = table.canopyBase?.[id] ?? (Number(f.properties.minHeight) || 0);
    (table.canopies[id] ?? []).forEach((piece, k) => {
      out.pieces++;
      features.push({
        type: 'Feature',
        properties: { id: `${id}:canopy:${k}`, tier: f.properties.tier, minHeight: base, height: +(base + CANOPY.thickM).toFixed(2), railInfra: 'canopy', kitWall: 'flat', kitWallHex: CANOPY.fasciaHex, roofColour: CANOPY.roofHex, colour: CANOPY.fasciaHex },
        geometry: { type: 'Polygon', coordinates: [[...piece.ring, piece.ring[0]]] },
      });
    });
  }
  return out;
}

type Enricher = (tile: { z: number; x: number; y: number }, signal: AbortSignal) => Promise<((features: Feature[]) => void) | undefined | void>;

/** The table, fetched once per extract path (missing or malformed: no change to any tile). */
export function railInfraEnricher(extractPath: string, fetchJson: (url: string) => Promise<unknown> = url => fetch(url).then(r => (r.ok ? r.json() : null))): Enricher {
  let table: Promise<RailInfraTable | null> | null = null;
  return async () => {
    table ??= fetchJson(`${extractPath.replace(/\/$/, '')}/${RAIL_INFRA_FILE}`).then(t => (isRailInfraTable(t) ? t : null)).catch(() => null);
    const t = await table;
    return t ? (features: Feature[]) => { applyRailInfra(features, t); } : undefined;
  };
}

/** Two enrichers in order (both fetched in parallel). */
export function composeTileEnrichers(a: Enricher | undefined, b: Enricher): Enricher {
  if (!a) return b;
  return async (tile, signal) => {
    const [fa, fb] = await Promise.all([a(tile, signal), b(tile, signal)]);
    return (features: Feature[]) => { if (fa) fa(features); if (fb) fb(features); };
  };
}

// ------------------------------------------------------------------ named regressions

/**
 * Pinned places (check-ground-cells.ts --rails): the table's verdict per building id, and for a canopy the share of
 * its outline its pieces may cover at most (the tracks between the platforms open). Live: without the table the
 * building tile draws every one of these ids as it is.
 */
export interface RailInfraSpot { id: string; label: string; note: string; tile: [number, number]; expect: Record<string, RailInfraKind | 'kept'>; canopyMaxShare?: number }
export const RAIL_INFRA_SPOTS: readonly RailInfraSpot[] = [
  {
    id: 'rail-infra-amstel', label: 'Amsterdam Amstel: the platform canopy outline and the station pand under the platforms', tile: [8415, 5386],
    note: 'user 2026-10-31 at Amstel: "that big flat white thing is weird" (w1302881959, one OSM roof over every platform) and "the houses under the tracks here are probably wrong" (the station pand\'s part under the platforms and two pavilions on them, drawn as brick houses)',
    expect: { w1302881959: 'canopy', 'part:NL.IMBAG.Pand.0363100012145715:0': 'viaduct', 'NL.IMBAG.Pand.0363100012252561': 'viaduct', 'NL.IMBAG.Pand.0363100012252562': 'viaduct', 'part:NL.IMBAG.Pand.0363100012145715:7': 'kept', 'part:NL.IMBAG.Pand.0363100012145715:3': 'kept' },
    canopyMaxShare: 0.7,
  },
  {
    id: 'rail-infra-centraal', label: 'Amsterdam Centraal: the train shed\'s arched roofs, the hotel and the signal box over the platforms stay', tile: [8415, 5383],
    note: 'the rule must not erase real station halls (brief, lane rail-look round 3)',
    expect: { w451533145: 'kept', w451533147: 'kept', w451533149: 'kept', w757595921: 'kept', w589499178: 'kept' },
  },
];

/** The share of a ring's area (lng/lat, small) its pieces cover, by planar area (pieces are disjoint). */
export function pieceShare(outline: readonly Vec2[], pieces: readonly CanopyPiece[]): number {
  const area = (r: readonly Vec2[]) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(a / 2); };
  const o = area(outline);
  return o > 0 ? pieces.reduce((t, p) => t + area(p.ring), 0) / o : 0;
}
