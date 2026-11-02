/**
 * Street-furniture placement (lane #170): extract records → model instances. Pure; the ride adapter
 * (public/canal-drive/js/street-furniture-source.js) projects lng/lat and fills the instanced meshes.
 *
 * Yaw: radians about +z in the scene frame (x east, y north). A model's +y (its front) points at compass bearing f
 * when yaw = -f. Containers turn their insert away from the street (toward the pavement) and lie along their
 * cluster's own row; lamps reach their arm toward the street; abris open toward it; columns turn by a hash.
 */
import { STREET_FURNITURE_TONES as T } from '../look/palette.js';
import type { FurnitureRecord } from './extract.js';
import { DIMENSIONS, lampHeight, type FurnitureModelId } from './models.js';

export type FurnitureInstance = { model: FurnitureModelId; id: string; lng: number; lat: number; yaw: number; scale: number; slotHex: string | null };

/** Hoops per BGT rack point and their spacing along the kerb. */
export const HOOPS_PER_RACK = 5, HOOP_SPACING_M = 0.9;
const RAD = Math.PI / 180;

export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

/** Bearing (deg) the front faces: toward the street, or away from it. Absent orientation: a stable hash. */
function frontBearing(r: FurnitureRecord, awayFromStreet: boolean): number {
  if (Number.isFinite(r.facing)) return ((r.facing as number) + (awayFromStreet ? 180 : 0)) % 360;
  if (Number.isFinite(r.heading)) return ((r.heading as number) + 90) % 360;
  return hash01(r.id) * 360;
}

/** Containers: +x along the row (`heading`), +y the side away from the street. */
export function containerYaw(r: FurnitureRecord): number {
  const front = frontBearing(r, true);
  if (!Number.isFinite(r.heading)) return -front * RAD;
  // The two fronts perpendicular to the row; keep the one nearer the away-from-street bearing.
  const a = ((r.heading as number) + 90) % 360, b = (a + 180) % 360;
  const diff = (x: number) => Math.abs(((x - front + 540) % 360) - 180);
  return -(diff(a) <= diff(b) ? a : b) * RAD;
}

export function fractionHex(subtype: string): string { return T.fraction[subtype] ?? T.fraction.unknown; }
export function posterHex(id: string): string { return T.posters[Math.floor(hash01(`${id}:poster`) * T.posters.length)]; }

const KX = (lat: number) => 111320 * Math.cos(lat * RAD), KY = 110540;

export function instancesOf(r: FurnitureRecord): FurnitureInstance[] {
  switch (r.kind) {
    case 'container': return [{ model: 'container', id: r.id, lng: r.lng, lat: r.lat, yaw: containerYaw(r), scale: 1, slotHex: fractionHex(r.subtype) }];
    case 'lamp':
      if (r.subtype === 'lantern') return [{ model: 'lamp-lantern', id: r.id, lng: r.lng, lat: r.lat, yaw: -frontBearing(r, false) * RAD, scale: 1, slotHex: null }];
      return [{ model: 'lamp-pole', id: r.id, lng: r.lng, lat: r.lat, yaw: -frontBearing(r, false) * RAD, scale: lampHeight(r.road) / DIMENSIONS.pole.height, slotHex: null }];
    case 'abri': return [{ model: 'abri', id: r.id, lng: r.lng, lat: r.lat, yaw: -frontBearing(r, false) * RAD, scale: 1, slotHex: posterHex(r.id) }];
    case 'ad-column': return [{ model: 'ad-column', id: r.id, lng: r.lng, lat: r.lat, yaw: hash01(r.id) * 2 * Math.PI, scale: 1, slotHex: posterHex(r.id) }];
    case 'bin': return [{ model: 'bin', id: r.id, lng: r.lng, lat: r.lat, yaw: -frontBearing(r, false) * RAD, scale: 1, slotHex: null }];
    case 'bike-rack': {
      const front = frontBearing(r, false), yaw = -front * RAD, along = (front + 90) * RAD; // +x bearing
      const out: FurnitureInstance[] = [];
      for (let i = 0; i < HOOPS_PER_RACK; i++) {
        const o = (i - (HOOPS_PER_RACK - 1) / 2) * HOOP_SPACING_M;
        out.push({ model: 'bike-rack', id: `${r.id}#${i}`, lng: r.lng + o * Math.sin(along) / KX(r.lat), lat: r.lat + o * Math.cos(along) / KY, yaw, scale: 1, slotHex: null });
      }
      return out;
    }
  }
}
