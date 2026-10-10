// The game's map overlays, as data the own map draws: transit corridors,
// ferry lines and terminals, branded POIs and the answered-street lettering.
// Pure (no three.js, no DOM): each function reuses the game's own rule or
// style object and converts it into local-metre geometry plus a paint spec,
// so the own renderer cannot drift from what MapLibre draws today.
//
// Sources (unchanged, imported):
//  - transit corridors: `adaptTransitNetwork` + `transitOverlayCollection` and
//    the MapLibre layer objects of src/canalRecall/transit/overlayStyle.ts,
//    composed as vector-map.js `setTransitNetwork` does (:377);
//  - ferry terminals: vector-map.js `setFerryTerminals` (:2146) paint;
//  - branded POIs: vector-map.js `setBrandedPois` / `_ensurePlaceLayers`
//    (:1601, :1456-1460) with `thinOrientationPois`;
//  - answered street: streetOverlayStyle.ts `answeredStreetNameLayer` (:536)
//    and `pointsAheadOnChains` (:575).

import { toLocal, type Vec2 } from './frame';
import type { Stops } from './style';
import { adaptTransitNetwork } from '../transit/segments';
import { transitOverlayAboveBuildingLayers, transitOverlayCollection, transitOverlayUnderBuildingLayers, type TransitOverlayLine } from '../transit/overlayStyle';
import type { TransitNetwork } from '../transit/network';
import { thinOrientationPois } from '../orientationPois';
import { ANSWERED_STREET_AHEAD, answeredStreetNameLayer, pointsAheadOnChains } from '../streetOverlayStyle';

/** The game's world units per metre (PIXELS_PER_METER in the legacy globals). */
const GAME_PX_PER_M = 3;

// --- MapLibre expression helpers ------------------------------------------------

/** `['interpolate', [kind], ['zoom'], z0, v0, z1, v1, …]` → stops (+ whether linear). */
export function zoomStops(expr: unknown): { stops: Stops; linear: boolean } | null {
  if (typeof expr === 'number') return { stops: [[0, expr]], linear: true };
  if (!Array.isArray(expr) || expr[0] !== 'interpolate') return null;
  const kind = expr[1] as unknown[];
  const stops: Array<[number, number]> = [];
  for (let i = 3; i + 1 < expr.length; i += 2) stops.push([Number(expr[i]), Number(expr[i + 1])]);
  return { stops, linear: kind?.[0] === 'linear' };
}

/** Linear interpolation between stops (MapLibre `['linear']`). */
export function interpolateLinear(stops: Stops, zoom: number): number {
  if (zoom <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [z1, v1] = stops[i];
    if (zoom <= z1) { const [z0, v0] = stops[i - 1]; return v0 + (v1 - v0) * (zoom - z0) / (z1 - z0); }
  }
  return stops[stops.length - 1][1];
}

// --- Transit ---------------------------------------------------------------------

export interface OverlayLineSpec {
  id: string;
  /** Fixed colour, or null: per-line colour from the data. */
  color: string | null;
  width: Stops;
  /** Linear (MapLibre `['linear']`) rather than exponential width interpolation. */
  linear: boolean;
  opacity: number;
  /** MapLibre line-dasharray, in line widths. */
  dash: [number, number] | null;
  /** Drawn above buildings (the game's tunnel callouts). */
  above: boolean;
}

export interface OverlayLineSet { spec: OverlayLineSpec; lines: Array<{ color: string; points: Vec2[] }> }

/** One MapLibre line layer of overlayStyle.ts → our spec, plus its `grade` filter. */
/** What MapLibre's colour parser accepts from the GTFS extract (GTFS hex comes without '#', which MapLibre rejects). */
const isCssColour = (c: unknown): c is string => typeof c === 'string' && /^(#([0-9a-f]{3}|[0-9a-f]{6})|rgba?\(.*\))$/i.test(c);

function specOf(layer: Record<string, unknown>, above: boolean): { spec: OverlayLineSpec; grade: string; fallback: string | null } {
  const paint = layer.paint as Record<string, unknown>;
  const filter = layer.filter as unknown[];
  const w = zoomStops(paint['line-width'])!;
  const colour = paint['line-color'];
  // ['coalesce', ['get', 'color'], fallback]: MapLibre skips a value that is not a colour.
  const fallback = Array.isArray(colour) ? String(colour[2]) : null;
  return {
    fallback,
    grade: String(filter?.[2] ?? ''),
    spec: {
      id: String(layer.id), above,
      // ['coalesce', ['get', 'color'], fallback] → per-line colour.
      color: typeof colour === 'string' ? colour.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]*\)/, 'rgb($1,$2,$3)') : null,
      width: w.stops, linear: w.linear,
      // An rgba() colour's alpha multiplies the layer opacity (three's Color drops alpha).
      opacity: Number(paint['line-opacity'] ?? 1) * (typeof colour === 'string' ? Number(/rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(colour)?.[1] ?? 1) : 1),
      dash: Array.isArray(paint['line-dasharray']) ? [Number(paint['line-dasharray'][0]), Number(paint['line-dasharray'][1])] : null,
    },
  };
}

/**
 * The game's transit corridor overlay (shown while riding transit): every
 * playable tram/metro line, metro as a dashed tunnel. `playableRefs` as the
 * game passes to `adaptTransitNetwork` (empty = every line).
 */
export function transitOverlay(network: TransitNetwork, opts: { playableRefs?: string[]; modes?: Array<'tram' | 'metro'> } = {}): OverlayLineSet[] {
  const load = adaptTransitNetwork(network, { playableRefs: opts.playableRefs ?? [], playableModes: opts.modes ?? ['tram', 'metro'] });
  // As vector-map.js setTransitNetwork builds its `lines`.
  const lines: TransitOverlayLine[] = load.ways.map(way => {
    const meta = way.tags?.name ? load.featureMeta.get(way.tags.name) : undefined;
    return { name: way.tags?.name || way.id, mode: way.highway || meta?.mode || 'tram', color: meta?.color, coordinates: way.nodes.map(n => [n.lon, n.lat] as [number, number]) };
  });
  const features = transitOverlayCollection(lines).features as Array<{ properties: { grade: string; color: string }; geometry: { coordinates: [number, number][] } }>;
  const layers = [
    ...transitOverlayUnderBuildingLayers().map(l => specOf(l as Record<string, unknown>, false)),
    ...transitOverlayAboveBuildingLayers().map(l => specOf(l as Record<string, unknown>, true)),
  ];
  return layers.map(({ spec, grade, fallback }) => ({
    spec,
    lines: features.filter(f => f.properties.grade === grade).map(f => ({
      color: spec.color ?? (isCssColour(f.properties.color) ? f.properties.color : fallback ?? '#E11D48'),
      points: f.geometry.coordinates.map(([lng, lat]) => toLocal(lng, lat)),
    })),
  }));
}

// --- Ferries ---------------------------------------------------------------------

/** Ferry crossings drawn as the basemap's dashed ferry lines. */
export const FERRY_LINE_SPEC: OverlayLineSpec = { id: 'ferry-lines', color: '#5b8fbf', width: [[11, 0.8], [14, 1.4], [18, 2.4]], linear: true, opacity: 0.85, dash: [2.5, 2], above: false };

/** Ferry terminal pin + label paint: vector-map.js setFerryTerminals (:2161-2166). */
export const FERRY_TERMINAL_PAINT = { radius: 6, fill: '#008bce', stroke: '#f2f0e7', strokeWidth: 2, textSize: 12, textColor: '#153c54', halo: '#f2f0e7', haloWidth: 2, offsetEm: 1.4 } as const;

export interface FerryTerminal { id: string; name: string; at: Vec2 }

/** Every GVB ferry line's path and its terminals (stops of ferry-mode lines). */
export function ferryOverlay(network: TransitNetwork): { lines: Vec2[][]; terminals: FerryTerminal[] } {
  const lines: Vec2[][] = [];
  const terminals = new Map<string, FerryTerminal>();
  for (const line of network.lines) {
    if (line.mode !== 'ferry') continue;
    if (line.path && line.path.length > 1) lines.push(line.path.map(([lat, lng]) => toLocal(lng, lat)));
    for (const id of line.stopIds) {
      const s = network.stops[id];
      if (!s?.center) continue;
      const name = s.name.replace(/^Amsterdam,\s*/i, '').trim() || s.name;
      // One terminal per name: a pier with two platforms is one place.
      if (![...terminals.values()].some(t => t.name === name)) terminals.set(id, { id, name, at: toLocal(s.center[1], s.center[0]) });
    }
  }
  return { lines, terminals: [...terminals.values()] };
}

/** The label the game draws for a terminal (`${t.name} ⛴`). */
export const ferryTerminalLabel = (name: string) => `${name} ⛴`;

// --- Branded POIs ------------------------------------------------------------------

export interface BrandedPoi { id: string; name: string; kind: string; center: [number, number]; icon?: string; orientationScore?: number; brand?: string }

/**
 * Branded POIs as the game hands them to MapLibre: spoilers out, then thinned
 * (`setBrandedPois`). The icon is the game's own local disc for the kind
 * (`brand-icons/albert-heijn.svg`, `_loadBrandIcon`), never the feature's
 * `iconUrl` (Wikimedia): no third-party image at runtime.
 */
export function brandedPoiOverlay(pois: readonly BrandedPoi[], spoils: (name: string) => boolean): Array<BrandedPoi & { at: Vec2 }> {
  const safe = pois.filter(p => !spoils(p.name));
  return thinOrientationPois(safe as Array<BrandedPoi & { kind: string }>).map(p => ({ ...p, at: toLocal(p.center[1], p.center[0]) }));
}

/** Local icon per brand kind (public/canal-drive/brand-icons/). */
export const BRAND_ICON_URLS: Record<string, string> = { 'albert-heijn': 'brand-icons/albert-heijn.svg' };

// --- Answered street lettering ------------------------------------------------------

/** World-metre height of the lettering: the layer's size stops are px at
 *  zoom with `text-pitch-alignment: map`, i.e. a constant ground size
 *  (6 px @ z15 = 48 px @ z18 = 192 px @ z20 ≈ 17.5 m at 52.37°N). */
export function answeredLetterHeightMetres(lat = 52.37): number {
  const layer = answeredStreetNameLayer() as { layout: Record<string, unknown> };
  const size = zoomStops(layer.layout['text-size'])!.stops;
  const [z, px] = size[1];
  const mpp = (2 * Math.PI * 6371008.8 * Math.cos(lat * Math.PI / 180)) / (512 * 2 ** z);
  return px * mpp;
}

export const ANSWERED_PAINT = (() => {
  const paint = (answeredStreetNameLayer() as { paint: Record<string, unknown> }).paint;
  const halo = paint['text-halo-color'] as unknown[];
  return { fill: String(paint['text-color']), opacity: Number(paint['text-opacity']), correct: String(halo[2]), wrong: String(halo[3]), letterSpacingEm: 0.1 };
})();

export interface AnsweredPlacement { at: Vec2; /** Direction of travel, degrees clockwise from north. */ bearing: number }

/**
 * Where the just-answered name is painted: `pointsAheadOnChains` on the
 * street's lines, ahead of the rider (local metres, y north; the helper works
 * in the game's y-down world, so y is flipped in and out).
 */
export function answeredStreetPlacement(chains: readonly (readonly Vec2[])[], rider: { at: Vec2; bearing: number }, distanceM = ANSWERED_STREET_AHEAD[0] / GAME_PX_PER_M): AnsweredPlacement[] {
  const toWorld = (p: Vec2) => ({ x: p[0], y: -p[1] });
  const b = rider.bearing * Math.PI / 180;
  // World angle (y down) of a compass bearing: east = 0, south = +90°.
  const angle = Math.atan2(-Math.cos(b), Math.sin(b));
  const pts = pointsAheadOnChains(chains.map(c => c.map(toWorld)), { x: rider.at[0], y: -rider.at[1], angle }, [distanceM]);
  return pts.map(p => ({ at: [p.x, -p.y] as Vec2, bearing: (Math.atan2(Math.cos(p.angle), -Math.sin(p.angle)) * 180 / Math.PI + 360) % 360 }));
}
