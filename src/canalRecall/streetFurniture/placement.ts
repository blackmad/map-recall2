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
/** Two krullen at one register point stand this far apart, centre to centre (the pad is 2.1 m long). */
export const URINAL_PAIR_M = 2.4;
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

/**
 * Share of rest columns with the drum top (2026-11-07): 6 of 20 readable random rest panoramas; the other 14 had the
 * plain flap. The register's containertype names the bin underground, not the column, so no field picks it: a cluster
 * gets one top for all its rest columns (rows in the panoramas match), by a stable hash of the cluster.
 */
export const CONTAINER_DRUM_SHARE = 0.3;

/** The register's fraction picks the insert (CONTAINER_INSERT): glass's round hole, paper's slot; rest the drum or the flap. */
export function containerModelId(subtype: string, cluster?: string | null, form?: 'above'): FurnitureModelId {
  if (form === 'above') return 'container-bg';
  if (subtype === 'glas') return 'container-glas';
  if (subtype === 'papier') return 'container-papier';
  if (subtype !== 'rest' || !cluster) return 'container';
  return hash01(`${cluster}:top`) < CONTAINER_DRUM_SHARE ? 'container' : 'container-rest';
}

export function fractionHex(subtype: string): string { return T.fraction[subtype] ?? T.fraction.unknown; }
export function posterHex(id: string): string { return T.posters[Math.floor(hash01(`${id}:poster`) * T.posters.length)]; }

const KX = (lat: number) => 111320 * Math.cos(lat * RAD), KY = 110540;

/** Container rows: one register cluster stands in a straight line along the kerb, its plates nearly touching. */
export const ROW_PITCH_MIN_M = 1.7, ROW_SPLIT_M = 1.0;
/** An above-ground box is 2.16 m long on its frame: its neighbours keep 0.1 m clear of it. */
export const ROW_PITCH_ABOVE_M = 2.26;
const rowLength = (r: FurnitureRecord) => r.form === 'above' ? ROW_PITCH_ABOVE_M : ROW_PITCH_MIN_M;

/**
 * Line up each container cluster (2026-11-07, user: "they almost always sit in a straight line"). The register's
 * points scatter around the row (the Pijp cluster 121618.639|485569.861 puts its paper container 1.0 m off the line
 * and 0.8 m from the next plate). Per cluster: the row axis is its `heading`; points within ROW_SPLIT_M of each other
 * across the axis share one row and snap to its median line (a cluster more than that apart keeps two rows, e.g. both
 * sides of a square); along the row the order is kept and neighbours are pushed to at least ROW_PITCH_MIN_M, centred
 * on the original mean; every member takes the cluster's mean `facing`, so the fronts all face one way.
 * Non-containers and lone containers pass through unchanged.
 */
export function alignContainerRows(items: readonly FurnitureRecord[]): FurnitureRecord[] {
  const groups = new Map<string, number[]>();
  items.forEach((r, i) => { if (r.kind === 'container' && r.cluster) { const g = groups.get(r.cluster); g ? g.push(i) : groups.set(r.cluster, [i]); } });
  const out = items.slice();
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    const rs = idx.map(i => items[i]);
    const lat0 = rs[0].lat, lng0 = rs[0].lng, kx = KX(lat0);
    const heading = rs.find(r => Number.isFinite(r.heading))?.heading;
    const local = rs.map(r => [(r.lng - lng0) * kx, (r.lat - lat0) * KY] as const);
    let th: number;
    if (Number.isFinite(heading)) th = (heading as number) * RAD;
    else {
      const mx = local.reduce((a, p) => a + p[0], 0) / local.length, my = local.reduce((a, p) => a + p[1], 0) / local.length;
      let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of local) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
      th = Math.PI / 2 - 0.5 * Math.atan2(2 * sxy, sxx - syy); // compass bearing of the principal axis
    }
    const ux = Math.sin(th), uy = Math.cos(th); // along the row (east, north)
    const along = local.map(([x, y]) => x * ux + y * uy), across = local.map(([x, y]) => -x * uy + y * ux);
    // Rows: sort across, split where the gap exceeds ROW_SPLIT_M.
    const order = across.map((_, k) => k).sort((a, b) => across[a] - across[b]);
    const rows: number[][] = [];
    for (const k of order) { const row = rows[rows.length - 1]; if (row && across[k] - across[row[row.length - 1]] <= ROW_SPLIT_M) row.push(k); else rows.push([k]); }
    // Facing: the circular mean of the members' facings.
    const fs = rs.map(r => r.facing).filter((f): f is number => Number.isFinite(f));
    const facing = fs.length ? ((Math.atan2(fs.reduce((a, f) => a + Math.sin(f * RAD), 0), fs.reduce((a, f) => a + Math.cos(f * RAD), 0)) / RAD) + 360) % 360 : undefined;
    for (const row of rows) {
      const med = row.map(k => across[k]).sort((a, b) => a - b)[row.length >> 1];
      const byAlong = row.slice().sort((a, b) => along[a] - along[b] || rs[a].id.localeCompare(rs[b].id));
      const t = byAlong.map(k => along[k]);
      for (let j = 1; j < t.length; j++) t[j] = Math.max(t[j], t[j - 1] + (rowLength(rs[byAlong[j - 1]]) + rowLength(rs[byAlong[j]])) / 2);
      const shift = byAlong.reduce((a, k) => a + along[k], 0) / t.length - t.reduce((a, v) => a + v, 0) / t.length;
      byAlong.forEach((k, j) => {
        const a = t[j] + shift, x = a * ux - med * uy, y = a * uy + med * ux;
        out[idx[k]] = { ...rs[k], lng: lng0 + x / kx, lat: lat0 + y / KY, ...(facing === undefined ? {} : { facing }) };
      });
    }
  }
  return out;
}

export function instancesOf(r: FurnitureRecord): FurnitureInstance[] {
  switch (r.kind) {
    case 'container': return [{ model: containerModelId(r.subtype, r.cluster ?? r.id, r.form), id: r.id, lng: r.lng, lat: r.lat, yaw: containerYaw(r), scale: 1, slotHex: fractionHex(r.subtype) }];
    case 'lamp':
      if (r.subtype === 'lantern') return [{ model: 'lamp-lantern', id: r.id, lng: r.lng, lat: r.lat, yaw: -frontBearing(r, false) * RAD, scale: 1, slotHex: null }];
      return [{ model: 'lamp-pole', id: r.id, lng: r.lng, lat: r.lat, yaw: -frontBearing(r, false) * RAD, scale: lampHeight(r.road) / DIMENSIONS.pole.height, slotHex: null }];
    case 'abri': return [{ model: 'abri', id: r.id, lng: r.lng, lat: r.lat, yaw: -frontBearing(r, false) * RAD, scale: 1, slotHex: posterHex(r.id) }];
    case 'ad-column': return [{ model: 'ad-column', id: r.id, lng: r.lng, lat: r.lat, yaw: hash01(r.id) * 2 * Math.PI, scale: 1, slotHex: posterHex(r.id) }];
    case 'urinal': {
      // Entry away from the street (toward the quay or the square: a prior, the register has no orientation); a second
      // krul at the same point ("twee krullen") stands URINAL_PAIR_M along the kerb.
      const front = frontBearing(r, true), yaw = -front * RAD, along = (front + 90) * RAD, n = r.count ?? 1;
      return Array.from({ length: n }, (_, k) => {
        const o = (k - (n - 1) / 2) * URINAL_PAIR_M;
        return { model: 'urinal-krul' as const, id: n > 1 ? `${r.id}#${k}` : r.id, lng: r.lng + o * Math.sin(along) / KX(r.lat), lat: r.lat + o * Math.cos(along) / KY, yaw, scale: 1, slotHex: null };
      });
    }
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
