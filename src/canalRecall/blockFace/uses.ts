/**
 * Ground-floor use evidence per pand: BAG verblijfsobjecten (address and
 * gebruiksdoel: woonfunctie, winkelfunctie, bijeenkomstfunctie, ...) and OSM
 * businesses (shop/amenity/craft/office). BAG says what a unit is allowed to be
 * and where its address point is; OSM says who trades there and when it was
 * last mapped; the facade strip photo (dated) decides what is actually there.
 * The intent author reconciles the three; this module only gathers them.
 */
import {pointInRing, type FrontFacts, type RD} from '../buildingRecipe/facts.ts';

export interface BagUnit { id: string; rd: number[]; use: string; street: string; number: number; letter: string | null; suffix: string | null; areaM2: number; status?: string }
export interface OsmBusiness { type: string; id: number; lngLat: number[]; tags: Record<string, string>; fetchedAt?: string }
export interface PandUses {
  pandId: string;
  /** Distinct addresses on the street, e.g. "Bilderdijkstraat 128". */
  addresses: string[];
  /** Units at street level: toevoeging H/huis/0 or none, or a non-residential use on a multi-unit address. */
  groundUnits: {address: string; use: string; areaM2: number; bagId: string}[];
  units: number;
  osm: (OsmBusiness & {match: 'inside' | 'frontage' | 'address'; distanceM: number})[];
}

const GROUND_SUFFIX = /^(h|hs|huis|0|bg|a)$/i;
const addressOf = (u: BagUnit) => `${u.street} ${u.number}${u.letter ?? ''}`;

function frontDistance(front: FrontFacts, p: RD) {
  const [a, b] = front.endpointsRD, dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
}

export function assignUses(pands: {pandId: string; rings: RD[][]; front: FrontFacts}[], units: BagUnit[], osm: (OsmBusiness & {rd: RD})[], street: string): PandUses[] {
  const inside = (p: number[], rings: RD[][]) => rings.some(r => pointInRing(p, r));
  const result = pands.map(({pandId, rings, front}): PandUses => {
    const mine = units.filter(u => inside(u.rd, rings));
    const addresses = [...new Set(mine.filter(u => u.street?.toLowerCase() === street.toLowerCase()).map(addressOf))].sort((a, b) => parseInt(a.replace(/\D+/g, '')) - parseInt(b.replace(/\D+/g, '')));
    const byAddress = new Map<string, BagUnit[]>();
    for (const u of mine) byAddress.set(addressOf(u), [...(byAddress.get(addressOf(u)) ?? []), u]);
    const groundUnits = mine.filter(u => (u.suffix === null && (byAddress.get(addressOf(u))?.length ?? 0) === 1) || GROUND_SUFFIX.test(u.suffix ?? '') || (u.use !== 'woonfunctie' && (byAddress.get(addressOf(u))?.length ?? 0) > 1))
      .map(u => ({address: `${addressOf(u)}${u.suffix ? '-' + u.suffix : ''}`, use: u.use, areaM2: u.areaM2, bagId: u.id}));
    const numbers = new Set(mine.map(u => `${u.number}${u.letter ?? ''}`));
    type Match = PandUses['osm'][number] & {rd: RD};
    const matched: PandUses['osm'] = osm.flatMap((b): Match[] => {
      if (inside(b.rd, rings)) return [{...b, match: 'inside' as const, distanceM: 0}];
      const d = frontDistance(front, b.rd);
      if (d <= 8) return [{...b, match: 'frontage' as const, distanceM: +d.toFixed(1)}];
      const n = b.tags['addr:housenumber'], s = b.tags['addr:street'];
      if (n && s?.toLowerCase() === street.toLowerCase() && numbers.has(n)) return [{...b, match: 'address' as const, distanceM: +d.toFixed(1)}];
      return [];
    }).map(({rd: _rd, ...rest}) => rest);
    return {pandId, addresses, groundUnits, units: mine.length, osm: matched};
  });
  // A business near a party wall can be within 8 m of two frontages: keep it on the best match only.
  const rank = (m: PandUses['osm'][number]) => (m.match === 'inside' ? 0 : m.match === 'address' ? 1 : 2) * 100 + m.distanceM;
  for (const r of result) r.osm = r.osm.filter(b => result.every(o => o === r || !o.osm.some(x => x.id === b.id && rank(x) < rank(b))));
  return result;
}
