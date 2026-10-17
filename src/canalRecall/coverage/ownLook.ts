/**
 * "Own look": a buurt whose buildings the game draws from kit made for that district — block-face house types
 * (scripts/block-face/types/<district>), measured block faces installed as chunks, and the Nieuw-West building-type
 * designs — rather than from the city-wide generic extrusion. Pure; scripts/coverage/build-coverage.ts gathers the
 * per-buurt tallies and coverage.html colours, lists and explains them.
 *
 * A pand counts once, under the tier the coverage map already gave it (TIERS precedence): `chunk` pands are
 * block-face chunks, `buildingType` pands are design instances. Within the chunk pands the per-house intent says
 * which house type drew it; a house with no type is a measured one-off ("face").
 */
import type { Tally } from './coverage';

export type LookStatus = 'drawn' | 'authored' | 'none';
/** Ride share link for index.html: [lat, lng, startLat, startLng, finishLat, finishLng]. */
export type Ride = [number, number, number, number, number, number];

export type OwnLook = {
  status: LookStatus;
  /** Pands drawn by this buurt's own kit (block-face chunks + building-type instances). */
  pands: number;
  /** `pands` over all pands of the buurt. */
  share: number;
  /** Drawn pands per house type, design family and measured face (houses without a type), most first. */
  types: Tally[];
  designs: Tally[];
  faces: Tally[];
  /** Districts whose kit draws here, display names, most pands first. */
  districts: string[];
  /** Where to ride past an example: keys `type:<id>`, `design:<family>`, `face:<id>`. */
  rides: Record<string, Ride>;
};

export const DISTRICT_LABEL: Record<string, string> = {
  'oud-west': 'Oud-West house types',
  bellamy: 'Bellamybuurt house types',
  'de-baarsjes': 'De Baarsjes house types',
  'indische-buurt': 'Indische Buurt house types',
  spaarndammerbuurt: 'Spaarndammerbuurt house types',
  'nieuw-west': 'Nieuw-West building types',
  face: 'measured street faces',
};

const sorted = (m: ReadonlyMap<string, number>): Tally[] => [...m].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

export type OwnLookInput = {
  pands: number;
  /** Tier counts of the buurt (chunk and buildingType are read). */
  chunk: number;
  buildingType: number;
  types: ReadonlyMap<string, number>;
  designs: ReadonlyMap<string, number>;
  faces: ReadonlyMap<string, number>;
  /** District of each type id; design families are Nieuw-West. Unknown types count as a face's own type. */
  typeDistrict: (id: string) => string | undefined;
  /** Whether type libraries or block faces are authored here at all (drawn or not). */
  authored: boolean;
  rides?: Record<string, Ride>;
};

export function ownLookOf(i: OwnLookInput): OwnLook {
  const pands = i.chunk + i.buildingType;
  const types = sorted(i.types), designs = sorted(i.designs), faces = sorted(i.faces);
  const byDistrict = new Map<string, number>();
  const add = (d: string, n: number) => byDistrict.set(d, (byDistrict.get(d) ?? 0) + n);
  for (const [id, n] of types) add(i.typeDistrict(id) ?? 'face', n);
  for (const [, n] of designs) add('nieuw-west', n);
  for (const [, n] of faces) add('face', n);
  const districts = sorted(byDistrict).map(([d]) => DISTRICT_LABEL[d] ?? d);
  const status: LookStatus = pands > 0 ? 'drawn' : i.authored ? 'authored' : 'none';
  return { status, pands, share: i.pands ? Math.round(1e4 * pands / i.pands) / 1e4 : 0, types, designs, faces, districts, rides: i.rides ?? {} };
}

export const noLook = (): OwnLook => ({ status: 'none', pands: 0, share: 0, types: [], designs: [], faces: [], districts: [], rides: {} });

/** Map colour bin for the own-look metric: 0 none, 1 authored but not drawn, 2–6 drawn share bands. */
export const LOOK_BINS = [0, 0.02, 0.05, 0.15, 0.3] as const;
export function lookBin(look: Pick<OwnLook, 'status' | 'share'>): number {
  if (look.status === 'none') return 0;
  if (look.status === 'authored') return 1;
  let b = 2;
  for (let i = 1; i < LOOK_BINS.length; i++) if (look.share >= LOOK_BINS[i]) b = i + 2;
  return Math.min(b, 6);
}
export const LOOK_LEGEND = ['no own look', 'authored, not drawn', '< 2%', '2–5%', '5–15%', '15–30%', '≥ 30%'];

const M_PER_DEG = 111_320;
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
/** Offset a lat/lng by metres east/north. */
function offset(lat: number, lng: number, east: number, north: number): [number, number] {
  return [lat + north / M_PER_DEG, lng + east / (M_PER_DEG * Math.cos(lat * Math.PI / 180))];
}

/**
 * Ride past a block-face chunk (port of street-chunks.html gameLink): start and finish 45 m beyond each end of the
 * face along the street, 8 m out in front of it. `anchor` is the chunk's [lng, lat], `northOffsetDegrees` its
 * instance rotation, `min`/`max` its local x bounds.
 */
export function chunkRide(anchor: [number, number], northOffsetDegrees: number, minX: number, maxX: number): Ride {
  const [lng, lat] = anchor;
  const b = (90 + northOffsetDegrees) * Math.PI / 180, half = (maxX - minX) / 2 + 45, road = 8;
  const at = (along: number, out: number) => offset(lat, lng, Math.sin(b) * along + Math.cos(b) * out, Math.cos(b) * along - Math.sin(b) * out);
  const [sLat, sLng] = at(-half, road), [fLat, fLng] = at(half, road);
  return [lat, lng, sLat, sLng, fLat, fLng].map(round6) as Ride;
}

/**
 * Ride past one pand: 70 m either side of its centroid along the footprint's longest edge (a slab or row runs
 * along its street), 12 m out; the game snaps start and finish to the nearest road.
 */
export function pandRide(centroid: [number, number], ring: readonly [number, number][]): Ride {
  const [lng, lat] = centroid;
  const kx = M_PER_DEG * Math.cos(lat * Math.PI / 180);
  let ux = 1, uy = 0, best = 0;
  for (let i = 0; i + 1 < ring.length; i++) {
    const dx = (ring[i + 1][0] - ring[i][0]) * kx, dy = (ring[i + 1][1] - ring[i][1]) * M_PER_DEG, len = Math.hypot(dx, dy);
    if (len > best) { best = len; ux = dx / len; uy = dy / len; }
  }
  const along = 70, out = 12;
  const [sLat, sLng] = offset(lat, lng, -ux * along - uy * out, -uy * along + ux * out);
  const [fLat, fLng] = offset(lat, lng, ux * along - uy * out, uy * along + ux * out);
  return [lat, lng, sLat, sLng, fLat, fLng].map(round6) as Ride;
}

/** index.html link for a ride (relative to public/canal-drive/). */
export const rideHref = (r: Ride): string => `./index.html?travel=car#race=${r.map(v => v.toFixed(6)).join(',')}`;
