// The register's areas (G3 scope order, docs/handoffs/ground-v2-plan-20261110.md): the places a draft run scans.
// A corridor is a polyline with a half width; a place list is points with a radius. Coordinates WGS84 [lng, lat].
import type { LngLat } from './sources.ts';

export interface Area {
  id: string;
  description: string;
  /** Corridor polylines with their half width (metres). */
  corridors?: { line: LngLat[]; halfM: number }[];
  /** Named places with their radius (metres). */
  places?: { id: string; label: string; at: LngLat; r: number }[];
}

/**
 * The plan's eight named places (user shots on build 93440cb, 2026-11-10). Positions are the user's shot locations,
 * checked against the orthophoto; G0's groundRegressions.ts holds the same set for the audit.
 */
export const NAMED_PLACES: NonNullable<Area['places']> = [
  { id: 'piet-kranenbergpad', label: 'Piet Kranenbergpad under the ring (A10) and the Schiphol rail decks', at: [4.85323, 52.33879], r: 140 },
  { id: 'amstelveenseweg', label: 'Amstelveenseweg under the A10 and the ring railway', at: [4.8574, 52.3385], r: 140 },
  { id: 'schinkel-jachthavenweg', label: 'Schinkel bank by the Jachthavenweg, under the A10 and rail bridges', at: [4.8485, 52.3392], r: 160 },
  { id: 'overschiestraat', label: 'Overschiestraat under the ring railway and the A10', at: [4.8410, 52.34335], r: 140 },
  { id: 'sportparklaan', label: 'Sportparklaan beside the A10 (sports fields, no crossing)', at: [4.8394, 52.3420], r: 120 },
  { id: 'anthony-fokkerweg', label: 'Anthony Fokkerweg: the A10 link under the Nieuwe Haagseweg and the ring railway', at: [4.8420, 52.3388], r: 200 },
  { id: 'vlaardingenlaan-naaldwijkstraat', label: 'Vlaardingenlaan / Naaldwijkstraat (flat ground, no crossing)', at: [4.8422, 52.3469], r: 80 },
  { id: 'cornelis-lelylaan-delflandlaan', label: 'Cornelis Lelylaan / Delflandlaan', at: [4.8405, 52.3577], r: 140 },
];

export const AREAS: Record<string, Area> = {
  named: { id: 'named', description: "The plan's eight named places (user shots 2026-11-10).", places: NAMED_PLACES },
  'ring-rail': {
    id: 'ring-rail',
    description: 'The ring railway Sloterdijk – Lelylaan – Zuid – RAI (and the metro 50/51 beside it).',
    corridors: [{ line: [[4.8378, 52.3890], [4.8352, 52.3780], [4.8340, 52.3650], [4.8343, 52.3570], [4.8360, 52.3480], [4.8400, 52.3425], [4.8480, 52.3395], [4.8600, 52.3385], [4.8722, 52.3389], [4.8800, 52.3380], [4.8895, 52.3376], [4.8990, 52.3384]], halfM: 110 }],
  },
  a10: {
    id: 'a10',
    description: 'The A10 ring (Ringweg-Noord, -Oost, -Zuid, -West).',
    corridors: [{ line: [[4.8435, 52.3925], [4.8390, 52.3800], [4.8380, 52.3650], [4.8370, 52.3520], [4.8420, 52.3415], [4.8600, 52.3378], [4.8800, 52.3366], [4.9000, 52.3355], [4.9180, 52.3400], [4.9400, 52.3470], [4.9500, 52.3560], [4.9560, 52.3700], [4.9520, 52.3850], [4.9400, 52.3980], [4.9150, 52.4050], [4.8900, 52.4050], [4.8650, 52.4010], [4.8500, 52.3970], [4.8435, 52.3925]], halfM: 120 }],
  },
  tunnels: {
    id: 'tunnels',
    description: 'The IJ and Coen tunnel approaches (and the Piet Hein tunnel).',
    places: [
      { id: 'ijtunnel-south', label: 'IJtunnel south approach', at: [4.9110, 52.3720], r: 450 },
      { id: 'ijtunnel-north', label: 'IJtunnel north approach', at: [4.9230, 52.3880], r: 500 },
      { id: 'coentunnel-south', label: 'Coentunnel south approach', at: [4.8430, 52.3960], r: 500 },
      { id: 'piet-heintunnel-west', label: 'Piet Heintunnel west approach', at: [4.9350, 52.3725], r: 350 },
    ],
  },
};

const KX = 111320 * Math.cos((52.37 * Math.PI) / 180), KY = 110540;
/** The area as query boxes of at most `sizeM` (w, s, e, n), each with the test for "inside the area". */
export function areaBoxes(a: Area, sizeM = 700): { boxes: [number, number, number, number][]; inside: (p: LngLat) => boolean } {
  const boxes: [number, number, number, number][] = [];
  const seen = new Set<string>();
  const add = (lng: number, lat: number, r: number) => {
    // Snap to a grid so overlapping corridor boxes reuse cache entries.
    const gx = sizeM / KX, gy = sizeM / KY;
    for (let i = Math.floor((lng - r / KX) / gx); i <= Math.floor((lng + r / KX) / gx); i++) for (let j = Math.floor((lat - r / KY) / gy); j <= Math.floor((lat + r / KY) / gy); j++) {
      const k = `${i}_${j}`;
      if (seen.has(k)) continue;
      seen.add(k);
      boxes.push([i * gx, j * gy, (i + 1) * gx, (j + 1) * gy]);
    }
  };
  for (const p of a.places ?? []) add(p.at[0], p.at[1], p.r);
  for (const c of a.corridors ?? []) for (let i = 0; i + 1 < c.line.length; i++) {
    const [p, q] = [c.line[i], c.line[i + 1]], L = Math.hypot((q[0] - p[0]) * KX, (q[1] - p[1]) * KY);
    for (let t = 0; t <= L; t += 100) add(p[0] + ((q[0] - p[0]) * t) / L, p[1] + ((q[1] - p[1]) * t) / L, c.halfM);
  }
  const inside = (p: LngLat) => (a.places ?? []).some(q => Math.hypot((p[0] - q.at[0]) * KX, (p[1] - q.at[1]) * KY) <= q.r) || (a.corridors ?? []).some(c => c.line.some((q, i) => {
    if (i + 1 >= c.line.length) return false;
    const r = c.line[i + 1], ax = q[0] * KX, ay = q[1] * KY, bx = r[0] * KX, by = r[1] * KY, px = p[0] * KX, py = p[1] * KY;
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(ax + dx * t - px, ay + dy * t - py) <= c.halfM;
  }));
  return { boxes, inside };
}
