import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import sources from './memorial-footprints.json';
import specs from './memorial-specs.json';

/**
 * Homomonument (Karin Daan, 1987), Westermarkt: three equilateral pink-granite triangles of 10 m sides, laid so their tips are the
 * corners of a 36 m triangle (en.wikipedia.org/wiki/Homomonument; nl: Rosa Porrino granite). Which triangle is which, from the
 * sources and the RCE overhead photograph (map-recall2-source-data/models/homomonument/files/homomonument-rce-overhead.jpg):
 *  - the northern tip (towards the Anne Frank Huis, Prinsengracht): the triangle "of the past", flush with the paving, the
 *    De Haan line engraved round it; here 2 cm proud of the square;
 *  - the south-western tip (towards the COC's old house at Rozenstraat, in front of the Westerkerk): "the future", a podium
 *    0.60 m above the square (people sit on its edge in every panorama);
 *  - the eastern tip (towards the Dam): "the present", on the Keizersgracht quay, four tapering steps down from the pavement to
 *    a platform resting on the water, its tip over the canal (four pontoons fend boats off it).
 * The quay wall crosses that triangle 12.56 m east of the centroid on the tip's axis (BGT waterdeel, api.pdok.nl/lv/bgt, 2026-10-16;
 * the tip is 20.5 m out): 0.7 m of the triangle lies on the pavement, the steps start at the quay line, the platform floats
 * 0.30 m above the game's canal (ownGround WATER_Z = -1.77 m). The stepped triangle is built as stacked solid prisms down to below
 * the water, so its sides are real granite walls meeting the quay wall and nothing hovers; ownGround/landedPlatforms.ts leaves
 * the municipal quay wall out across it. Thin granite lines join the three stones along the big triangle's edges, stopping short
 * of the stones so the three remain separate parts (check-manual-landmarks pins three stones and four risers).
 */
export const HOMOMONUMENT = {
  /** Quay line on the stepped triangle's axis, metres from its base line (BGT: 12.56 m from the centroid; base at 20.51 - 8.66). */
  quayFromBaseM: 0.71,
  /** Four risers from the pavement (2 cm proud) to the platform, treads 0.5 m deep. */
  risers: 4, treadM: 0.5,
  /** ownGround WATER_Z (-1.77) + 0.30: the platform rests on the water. */
  platformY: -1.47,
  /** The stones' solid bottom, below the water plane. */
  bottomY: -2.1,
  podiumY: 0.60, flushY: 0.02, stripWidthM: 0.18, stripGapM: 0.15,
} as const;

export interface MemorialStats { stones: number; risers: number; strips: number }

/** Each stone's tip and its two base corners (local metres: x east, y south of the anchor), in the source's corner order N, E, SW. */
export function homomonumentStones(): {tip: T.Vector2; left: T.Vector2; right: T.Vector2}[] {
  const source = sources.find(s => s.id === 'homomonument')!, spec = specs.find(s => s.id === 'homomonument')!, anchor = spec.surveyed.anchor;
  const points = source.corners.map(([lng, lat]) => new T.Vector2((lng - anchor[0]) * 111320 * Math.cos(anchor[1] * Math.PI / 180), (anchor[1] - lat) * 111320));
  return points.map((tip, i) => ({tip, left: tip.clone().lerp(points[(i + 1) % 3], 10 / tip.distanceTo(points[(i + 1) % 3])), right: tip.clone().lerp(points[(i + 2) % 3], 10 / tip.distanceTo(points[(i + 2) % 3]))}));
}

/** Ground-level landmarks: only stonework, never a replacement building box. */
export function buildMemorialLandmark(id: string, _w: number, _d: number, b: BuildingTools, stats: MemorialStats = {stones: 0, risers: 0, strips: 0}) {
  if (id !== 'homomonument') throw new Error(`Unknown memorial ${id}`);
  const H = HOMOMONUMENT;
  function slab(ring: T.Vector2[], top: number, depth: number) {
    const g = new T.ExtrudeGeometry(new T.Shape(ring), {depth, bevelEnabled: false});
    g.rotateX(Math.PI / 2); g.translate(0, top, 0); b.add(g, 'pink');
  }
  const [north, east, southWest] = homomonumentStones();
  // The past: flush with the paving. The future: the podium, its riser from the square.
  slab([north.tip, north.left, north.right], H.flushY, H.flushY + 0.3); stats.stones++;
  slab([southWest.tip, southWest.left, southWest.right], H.podiumY, H.podiumY + 0.3); stats.stones++;
  // The present: the quay-level strip, four tapering treads and the platform, each a solid prism down to below the water.
  {
    const {tip, left, right} = east, base = left.clone().lerp(right, 0.5), height = tip.distanceTo(base);
    const at = (s: number): [T.Vector2, T.Vector2] => [left.clone().lerp(tip, s / height), right.clone().lerp(tip, s / height)];
    const band = (s0: number, s1: number, top: number) => {
      const [l0, r0] = at(s0), [l1, r1] = at(s1);
      slab(s1 >= height - 1e-6 ? [l0, tip, r0] : [l0, l1, r1, r0], top, top - H.bottomY);
    };
    const drop = (H.flushY - H.platformY) / H.risers;
    band(0, H.quayFromBaseM, H.flushY);
    for (let k = 1; k < H.risers; k++) { band(H.quayFromBaseM + (k - 1) * H.treadM, H.quayFromBaseM + k * H.treadM, H.flushY - k * drop); stats.risers++; }
    band(H.quayFromBaseM + (H.risers - 1) * H.treadM, height, H.platformY); stats.risers++;
    stats.stones++;
  }
  // Thin granite lines join the stones along the big triangle's edges; they stop short so the stones stay separate parts.
  const stones = [north, east, southWest];
  for (let i = 0; i < 3; i++) {
    const a = stones[i].left, q = stones[(i + 1) % 3].right, delta = q.clone().sub(a), len = delta.length(), dir = delta.clone().divideScalar(len);
    const start = a.clone().add(dir.clone().multiplyScalar(H.stripGapM)), end = q.clone().sub(dir.clone().multiplyScalar(H.stripGapM));
    const normal = new T.Vector2(-dir.y, dir.x).multiplyScalar(H.stripWidthM / 2);
    slab([start.clone().add(normal), end.clone().add(normal), end.clone().sub(normal), start.clone().sub(normal)], 0.055, 0.055 + 0.2); stats.strips++;
  }
}

/** The stepped stone's outline padded outward (metres), lng/lat, for ownGround's quay wall to leave out (landedPlatforms.ts). */
export function homomonumentQuayPlatformRing(padM = 0.8): [number, number][] {
  const spec = specs.find(s => s.id === 'homomonument')!, anchor = spec.surveyed.anchor, sx = 111320 * Math.cos(anchor[1] * Math.PI / 180);
  const {tip, left, right} = homomonumentStones()[1];
  const centre = tip.clone().add(left).add(right).divideScalar(3);
  return [tip, left, right].map(p => { const d = p.clone().sub(centre), r = d.length(); return d.multiplyScalar((r + padM * 2) / r).add(centre); })
    .map(p => [anchor[0] + p.x / sx, anchor[1] - p.y / 111320] as [number, number]);
}
