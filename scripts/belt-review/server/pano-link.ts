/**
 * "Open in city panorama" (stage 1, key O): a data.amsterdam.nl geozoek URL that opens the panorama nearest a point,
 * facing a heading. The parameter set is copied from real geozoek URLs in this repo (docs/archive/amsterdam-panorama-
 * building-treatment-handoff.md, scripts/landmarks/*-research.json): center, locatie, heading, pitch, fov, lagen, zoom.
 *
 * Point and heading, best first: the picked candidate's camera position and heading when candidates.json carries them
 * (`pano.lat`/`pano.lng`, or `pano.location: [lng, lat]`; `pano.headingDeg`); else the pand's front midpoint (the footprint
 * edge matching lane B's `wall.bearingDeg`, else the longest edge) stepped 12 m out into the street, facing the wall.
 * Footprints come from the local building tiles, never a third-party API.
 */
import { findPands, rdToLngLat, type Footprint, type Rd } from '../../pand-reference/core.ts';

export interface PanoLink { url: string; from: 'camera' | 'front' | 'centroid'; lat: number; lng: number; heading: number | null }

export function geozoekUrl(lat: number, lng: number, heading: number | null): string {
  const u = new URL('https://data.amsterdam.nl/data/geozoek');
  const at = `${lat.toFixed(7)},${lng.toFixed(7)}`;
  const params: Record<string, string> = { center: at, fov: '90', lagen: 'pano-pano2025bi', locatie: at, pitch: '10', zoom: '14' };
  if (heading !== null) params.heading = String(Math.round(((heading % 360) + 360) % 360));
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.href;
}

const bearing = (a: Rd, b: Rd) => (Math.atan2(b.x - a.x, b.y - a.y) * 180 / Math.PI + 360) % 360;
const axisDiff = (x: number, y: number) => { const d = Math.abs(((x - y) % 180 + 180) % 180); return Math.min(d, 180 - d); };

/** The front point 12 m out from the wall, and the heading from there to the wall. */
export function frontView(fp: Footprint, wallBearingDeg?: number): { at: Rd; heading: number } | null {
  const ring = fp.ring.length > 1 && fp.ring[0].x === fp.ring.at(-1)!.x && fp.ring[0].y === fp.ring.at(-1)!.y ? fp.ring.slice(0, -1) : fp.ring;
  if (ring.length < 3) return null;
  const c = { x: ring.reduce((n, p) => n + p.x, 0) / ring.length, y: ring.reduce((n, p) => n + p.y, 0) / ring.length };
  const edges = ring.map((a, i) => { const b = ring[(i + 1) % ring.length]; return { a, b, len: Math.hypot(b.x - a.x, b.y - a.y) }; });
  const fits = wallBearingDeg === undefined ? edges : edges.filter(e => e.len > 1 && axisDiff(bearing(e.a, e.b), wallBearingDeg) < 15);
  const e = (fits.length ? fits : edges).reduce((m, x) => x.len > m.len ? x : m);
  const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
  let nx = -(e.b.y - e.a.y) / e.len, ny = (e.b.x - e.a.x) / e.len;
  if (nx * (mid.x - c.x) + ny * (mid.y - c.y) < 0) { nx = -nx; ny = -ny; }
  const at = { x: mid.x + nx * 12, y: mid.y + ny * 12 };
  return { at, heading: bearing(at, mid) };
}

const footprints = new Map<string, Footprint | null>();
export async function footprintsFor(ids: string[]): Promise<void> {
  const want = ids.filter(id => !footprints.has(id));
  if (!want.length) return;
  const found = await findPands(want);
  for (const id of want) footprints.set(id, found.get(`NL.IMBAG.Pand.${id}`) ?? null);
}

export async function panoLink(pandId: string, faceIds: string[], camera: { lat?: number; lng?: number; location?: [number, number]; headingDeg?: number } | null, wallBearingDeg?: number): Promise<PanoLink | null> {
  const lat = camera?.lat ?? camera?.location?.[1], lng = camera?.lng ?? camera?.location?.[0];
  if (typeof lat === 'number' && typeof lng === 'number') {
    const heading = typeof camera?.headingDeg === 'number' ? camera.headingDeg : null;
    return { url: geozoekUrl(lat, lng, heading), from: 'camera', lat, lng, heading };
  }
  await footprintsFor(faceIds.includes(pandId) ? faceIds : [...faceIds, pandId]);
  const fp = footprints.get(pandId);
  if (!fp) return null;
  const v = frontView(fp, wallBearingDeg);
  if (!v) return null;
  const [lng2, lat2] = rdToLngLat(v.at);
  return { url: geozoekUrl(lat2, lng2, v.heading), from: 'front', lat: lat2, lng: lng2, heading: v.heading };
}
