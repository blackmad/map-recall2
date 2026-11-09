// The knowledge map's slim outline file: the buurts and water the map draws,
// simplified (Douglas-Peucker) and packed as Google-style encoded polylines at
// 1e-5 degrees, so the first open on a cold cache loads ~100 kB instead of the
// 1 MB boundaries.json + water.json extracts (#297). The generator is
// scripts/knowledge-map/build-outline.ts; the runtime decodes here.

import { buurtFrame, type BuurtShape, type KnowledgeMapGeometry, type LatLng } from './knowledgeMap.ts';

export const KNOWLEDGE_MAP_OUTLINE_VERSION = 1;

export interface KnowledgeMapOutlineBuurt {
  n: string;
  k: string;
  /** Encoded rings. */
  r: string[];
}

export interface KnowledgeMapOutline {
  version: number;
  buurts: KnowledgeMapOutlineBuurt[];
  /** Encoded water lines. */
  water: string[];
}

export function encodePolyline(points: readonly LatLng[]): string {
  let out = '';
  let prevLat = 0;
  let prevLng = 0;
  const put = (value: number): void => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  for (const [lat, lng] of points) {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    put(la - prevLat);
    put(ln - prevLng);
    prevLat = la;
    prevLng = ln;
  }
  return out;
}

export function decodePolyline(text: string): LatLng[] {
  const out: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const get = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = text.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index <= text.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < text.length) {
    lat += get();
    lng += get();
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

/** Perpendicular-distance simplification in metres (equirectangular at ~52.4N). */
export function simplifyLine(points: readonly LatLng[], toleranceM: number): LatLng[] {
  if (points.length < 3) return points.slice();
  const kx = 111320 * Math.cos((52.37 * Math.PI) / 180);
  const ky = 111320;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = points[a][1] * kx, ay = points[a][0] * ky;
    const dx = points[b][1] * kx - ax, dy = points[b][0] * ky - ay;
    const len2 = dx * dx + dy * dy;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const px = points[i][1] * kx - ax, py = points[i][0] * ky - ay;
      const t = len2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
      const d = Math.hypot(px - t * dx, py - t * dy);
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > toleranceM && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

export function outlineFromGeometry(geometry: KnowledgeMapGeometry, toleranceM = 6, waterToleranceM = 10): KnowledgeMapOutline {
  return {
    version: KNOWLEDGE_MAP_OUTLINE_VERSION,
    buurts: geometry.buurts.map(buurt => ({
      n: buurt.name,
      k: buurt.kind,
      r: buurt.rings.map(ring => encodePolyline(simplifyLine(ring, toleranceM))),
    })),
    water: geometry.water.map(line => encodePolyline(simplifyLine(line, waterToleranceM))),
  };
}

export function geometryFromOutline(outline: KnowledgeMapOutline, ranks: Readonly<Record<string, number>>): KnowledgeMapGeometry {
  const buurts: BuurtShape[] = [];
  for (const entry of outline.buurts) {
    const rank = ranks[entry.k];
    if (!rank) continue;
    const rings = entry.r.map(decodePolyline).filter(ring => ring.length > 2);
    if (!rings.length) continue;
    let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
    let area = 0;
    for (const ring of rings) {
      for (const [lat, lng] of ring) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
      let twice = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) twice += ring[j][1] * ring[i][0] - ring[i][1] * ring[j][0];
      area += Math.abs(twice) / 2;
    }
    buurts.push({ name: entry.n, kind: entry.k, rank, rings, bbox: { minLat, minLng, maxLat, maxLng }, area });
  }
  buurts.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  const water = outline.water.map(decodePolyline).filter(line => line.length > 1);
  return { buurts, water, frame: buurtFrame(buurts) };
}
