/**
 * OpenStreetMap as the hand-mapped-semantics source.
 *
 * Unlike the Dutch registers this one is global, so it is the adapter a city
 * anywhere starts from. Its job here is narrow and specific: find out what
 * people have *deliberately* mapped about each building, so an automated
 * reconstruction cannot flatten it.
 *
 * The subtlety that makes this worth its own adapter is provenance. Large parts
 * of Dutch OSM are a bulk import of BAG, with heights copied from 3DBAG. Those
 * tags look like independent corroboration and are nothing of the kind — if the
 * pipeline counts them as a second opinion it is simply agreeing with itself.
 * So every record says whether it was imported, and lists which tags a person
 * added on top.
 */
import type { BboxLngLat, SemanticsRecord, SemanticsSource } from '../sources.ts';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

/** Tags that only ever arrive from a bulk import, and so prove nothing on their own. */
const IMPORTED_TAGS = new Set([
  'building', 'ref:bag', 'source', 'source:date', 'source:height', 'source:height:date',
  'height', 'start_date', 'building:levels:source', 'addr:city', 'addr:street',
  'addr:housenumber', 'addr:postcode', 'addr:country', 'addr:province',
]);

const number = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const openStreetMapSemantics: SemanticsSource = {
  id: 'osm',
  name: 'OpenStreetMap (Overpass)',
  license: 'ODbL 1.0 — © OpenStreetMap contributors',

  async fetchSemantics(bbox: BboxLngLat): Promise<SemanticsRecord[]> {
    const [west, south, east, north] = bbox;
    // Buildings and building:parts together, with parts' geometry so a part can
    // be attributed to the building that encloses it.
    const query = `[out:json][timeout:180];
(
  way["building"](${south},${west},${north},${east});
  relation["building"](${south},${west},${north},${east});
  way["building:part"](${south},${west},${north},${east});
  relation["building:part"](${south},${west},${north},${east});
);
out tags center;`;

    const response = await fetch(OVERPASS, {
      method: 'POST',
      body: query,
      headers: { 'User-Agent': 'MapRecallFacadeTwin/1.0', 'Content-Type': 'text/plain' },
      signal: AbortSignal.timeout(240_000),
    });
    if (!response.ok) throw new Error(`Overpass: HTTP ${response.status}`);
    const payload = await response.json() as {
      elements: Array<{ type: string; id: number; tags?: Record<string, string>; center?: { lat: number; lon: number } }>;
    };

    const buildings = payload.elements.filter(element => element.tags?.building);
    const parts = payload.elements.filter(element => element.tags?.['building:part'] && !element.tags.building);

    /**
     * Attribute each hand-mapped part to a building.
     *
     * `ref:bag` when the part carries one; otherwise the nearest building
     * centre within 40 m. That is a coarse rule and deliberately so — the
     * number that matters is "does this building have a mapped composition at
     * all", not which storey each part belongs to.
     */
    const partsByBuilding = new Map<string, number>();
    const centres = buildings
      .filter(building => building.center && building.tags?.['ref:bag'])
      .map(building => ({ ref: building.tags!['ref:bag'], lat: building.center!.lat, lon: building.center!.lon }));
    for (const part of parts) {
      const direct = part.tags?.['ref:bag'];
      if (direct) {
        partsByBuilding.set(direct, (partsByBuilding.get(direct) ?? 0) + 1);
        continue;
      }
      if (!part.center) continue;
      let best: { ref: string; distance: number } | null = null;
      for (const centre of centres) {
        const dLat = (centre.lat - part.center.lat) * 111_320;
        const dLon = (centre.lon - part.center.lon) * 111_320 * Math.cos((part.center.lat * Math.PI) / 180);
        const distance = Math.hypot(dLat, dLon);
        if (distance < 40 && (!best || distance < best.distance)) best = { ref: centre.ref, distance };
      }
      if (best) partsByBuilding.set(best.ref, (partsByBuilding.get(best.ref) ?? 0) + 1);
    }

    const records: SemanticsRecord[] = [];
    for (const building of buildings) {
      const tags = building.tags!;
      const buildingId = tags['ref:bag'];
      if (!buildingId) continue;
      const manualTags = Object.keys(tags).filter(key => !IMPORTED_TAGS.has(key));
      const importSource = tags.source ?? null;
      records.push({
        buildingId,
        featureId: `${building.type}/${building.id}`,
        name: tags.name ?? null,
        levels: number(tags['building:levels']),
        roofLevels: number(tags['roof:levels']),
        roofShape: tags['roof:shape'] ?? null,
        height: number(tags.height),
        material: tags['building:material'] ?? tags.material ?? null,
        colour: tags['building:colour'] ?? tags['building:color'] ?? null,
        startDate: tags.start_date ?? null,
        partCount: partsByBuilding.get(buildingId) ?? 0,
        // `building` alone is not authorship; a record is imported unless a
        // person added something beyond the import's own vocabulary.
        imported: manualTags.length <= 1 && /BAG/i.test(importSource ?? ''),
        importSource,
        manualTags: manualTags.filter(tag => tag !== 'building'),
      });
    }
    return records;
  },
};
