/**
 * The roof-facts sidecar at runtime: a tile enricher for `BuildingTileStreamer.setTileEnricher`
 * (fetched in parallel with each z14 building tile, like the building-facts years) that stamps
 * the measured roof onto each BAG pand's feature:
 *
 *   roofSlot        the slot (`look/palette.ts` ROOF_SLOTS)
 *   roofMeasured    the measured colour, cast removed ('#rrggbb')
 *   roofSolar       solar share 0..1 (only when > 0)
 *   roofTerrace     true for a roof terrace
 *   roofFurniture   encoded placements (`encodeFurniture`, comma-joined), offsets from the outline's first vertex
 *
 * `?roofFacts=0` turns it off. A missing or unreadable tile leaves the priors in place.
 */
import { decodeRoofFactTile, encodeFurniture, ROOF_SLOTS, type RoofFact, type RoofFactTile, type RoofSlot } from './roofSlots.js';
import { rgbToHex } from '../look/palette.js';

type Feature = { properties: Record<string, unknown> };
export const ROOF_FACTS_ZOOM = 14;
const PAND_PREFIX = 'NL.IMBAG.Pand.';

export function roofFactsEnabled(search: string = typeof location !== 'undefined' ? location.search : ''): boolean {
  return new URLSearchParams(search).get('roofFacts') !== '0';
}

async function readJson(response: Response): Promise<unknown> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('gzip roof facts need DecompressionStream');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Stamp one fact onto a feature's properties (pure; exported for tests and the gallery). */
export function applyRoofFact(properties: Record<string, unknown>, fact: RoofFact): void {
  properties.roofSlot = fact.slot;
  properties.roofMeasured = rgbToHex(fact.rgb);
  if (fact.solarShare > 0) properties.roofSolar = fact.solarShare;
  if (fact.terrace) properties.roofTerrace = true;
  // A string, not an array: the same properties go into the MapLibre source, which wants primitives.
  if (fact.furniture.length) properties.roofFurniture = encodeFurniture(fact.furniture).join(',');
}

export function roofFactsEnricher(baseUrl: string, fetchImpl: typeof fetch = (...args) => fetch(...args)) {
  const root = baseUrl.replace(/\/$/, '');
  return async (tile: { z: number; x: number; y: number }, signal?: AbortSignal) => {
    if (tile.z !== ROOF_FACTS_ZOOM) return (_features: Feature[]) => {};
    let facts: Map<string, RoofFact> | null = null;
    try {
      const response = await fetchImpl(`${root}/roof-facts/${tile.z}/${tile.x}/${tile.y}.json.gz`, { signal });
      if (response.ok) facts = decodeRoofFactTile(await readJson(response) as RoofFactTile);
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
    }
    return (features: Feature[]) => {
      if (!facts?.size) return;
      for (const feature of features) {
        const id = String(feature.properties?.id ?? '');
        if (!id.startsWith(PAND_PREFIX)) continue;
        const fact = facts.get(id.slice(PAND_PREFIX.length));
        if (fact) applyRoofFact(feature.properties, fact);
      }
    };
  };
}

type Enricher = (tile: { z: number; x: number; y: number }, signal: AbortSignal) => Promise<((features: any[]) => void) | undefined | void>;
/** Several enrichers as one: all fetch in parallel; each applies in order; one failing does not stop the others. */
export function composeEnrichers(...enrichers: Array<Enricher | undefined | null>): Enricher {
  const list = enrichers.filter((e): e is Enricher => !!e);
  return async (tile, signal) => {
    const applies = await Promise.all(list.map(e => e(tile, signal).catch(error => { if ((error as Error)?.name === 'AbortError') throw error; return undefined; })));
    return (features: any[]) => { for (const apply of applies) { try { if (apply) apply(features); } catch (error) { console.warn('Tile enricher failed', error); } } };
  };
}

export const isRoofSlot = (value: unknown): value is RoofSlot => typeof value === 'string' && (ROOF_SLOTS as readonly string[]).includes(value);
