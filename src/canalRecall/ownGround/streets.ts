// Street bands draped on the riding surface (pure).
//
// Each OSM way becomes its cross-section's bands (osmGround.ts). Raised bands
// (sidewalks, cycle tracks) are cut back where another carriageway leaves the
// junction on their side, so a kerb never runs across a side street; the
// carriageways themselves get a draped disc at every shared or end node.

import { crossSection, type Band, type CrossSection, type OsmWay, type Surface } from './osmGround.js';
import { cutIntervals, disc, edgeWall, emptyMesh, endCap, ribbon, stations, triangleCount, type MeshArrays } from './drape.js';
import type { HeightFn, Vec2 } from './surface.js';

/** Height above the relief per layer (metres): later layers win the depth test. */
export const LIFT = {
  area: 0.015,
  crossing: 0.025,
  carriageway: 0.03,
  cycleLane: 0.036,
  path: 0.04,
  paint: 0.046,
  raisedBase: 0.03,
  route: 0.07,
} as const;

export type StreetLayer = Surface | 'paint' | 'kerb';
export type StreetMeshes = Record<StreetLayer, MeshArrays> & {
  stats: { ways: number; bands: number; metres: number; widthFromTags: number; sidewalkFromTags: number; trims: number };
};

export interface LocalWay { id: number; tags: Record<string, string>; points: Vec2[]; section: CrossSection }

const key = (p: Vec2) => `${Math.round(p[0] * 10)}:${Math.round(p[1] * 10)}`;
const isCarriage = (w: LocalWay) => w.section.bands[0]?.kind === 'carriageway';
/** A way that is (part of) a bridge: drawn over water, so never cut by the water mask. */
export const isBridgeWay = (w: LocalWay) => !!w.tags.bridge && w.tags.bridge !== 'no';

export function prepareWays(ways: readonly OsmWay[], project: (lngLat: [number, number]) => Vec2): LocalWay[] {
  const out: LocalWay[] = [];
  for (const w of ways) {
    const section = crossSection(w.tags);
    if (!section || w.g.length < 2) continue;
    out.push({ id: w.id, tags: w.tags, points: w.g.map(project), section });
  }
  return out;
}

interface Branch { dir: Vec2; half: number }

/** For every node, the carriageway branches leaving it (direction and carriageway half width). */
function nodeBranches(ways: readonly LocalWay[]): Map<string, { ways: Set<number>; branches: (Branch & { way: number })[] }> {
  const nodes = new Map<string, { ways: Set<number>; branches: (Branch & { way: number })[] }>();
  for (const w of ways) {
    w.points.forEach((p, i) => {
      const k = key(p);
      const node = nodes.get(k) ?? nodes.set(k, { ways: new Set(), branches: [] }).get(k)!;
      node.ways.add(w.id);
      if (!isCarriage(w)) return;
      for (const j of [i - 1, i + 1]) {
        if (j < 0 || j >= w.points.length) continue;
        const dx = w.points[j][0] - p[0], dy = w.points[j][1] - p[1], l = Math.hypot(dx, dy);
        if (l > 1e-3) node.branches.push({ dir: [dx / l, dy / l], half: w.section.coreHalfWidth, way: w.id });
      }
    });
  }
  return nodes;
}

/**
 * Station intervals along `w` to leave out of a band on `side` (+1 left, −1
 * right, 0 both): around every node where another carriageway leaves at more
 * than ~30° toward that side, as far as that carriageway's half width plus the
 * band's own distance from the centreline.
 */
function trimIntervals(w: LocalWay, band: Band, nodes: ReturnType<typeof nodeBranches>, side: 1 | -1 | 0): [number, number][] {
  const st = stations(w.points), cuts: [number, number][] = [];
  w.points.forEach((p, i) => {
    const node = nodes.get(key(p));
    if (!node) return;
    const a = w.points[Math.max(0, i - 1)], b = w.points[Math.min(w.points.length - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    let reach = 0;
    for (const br of node.branches) {
      if (br.way === w.id) continue;
      const cross = (tx * br.dir[1] - ty * br.dir[0]) / tl; // > 0: branch to the left
      if (Math.abs(cross) < 0.5) continue; // a continuation, not a side street
      if (side !== 0 && Math.sign(cross) !== side) continue;
      reach = Math.max(reach, br.half + 0.4);
    }
    if (reach > 0) {
      // Reach the band's outer edge, where it meets the side street's carriageway edge.
      const r = reach + (side === 0 ? band.width / 2 : 0);
      cuts.push([st[i] - r, st[i] + r]);
    }
  });
  return cuts;
}

/**
 * `only` limits which ways emit geometry while the junction graph still sees
 * all of them (the prototype builds bridge ways separately, uncut by the water mask).
 */
export function buildStreets(ways: readonly LocalWay[], height: HeightFn, opts: { step?: number; only?: (w: LocalWay) => boolean } = {}): StreetMeshes {
  const step = opts.step ?? 3;
  const out = { asphalt: emptyMesh(), klinker: emptyMesh(), cycle: emptyMesh(), paving: emptyMesh(), gravel: emptyMesh(), paint: emptyMesh(), kerb: emptyMesh(), stats: { ways: 0, bands: 0, metres: 0, widthFromTags: 0, sidewalkFromTags: 0, trims: 0 } } as StreetMeshes;
  const nodes = nodeBranches(ways);
  const discDone = new Set<string>();
  for (const w of ways) {
    if (opts.only && !opts.only(w)) continue;
    out.stats.ways++;
    if (w.section.source.width !== 'prior') out.stats.widthFromTags++;
    if (w.section.source.sidewalk === 'tag') out.stats.sidewalkFromTags++;
    const st = stations(w.points);
    out.stats.metres += st[st.length - 1];
    // A footway crossing a road is the road's surface plus paint, not a paved strip over it.
    const crossing = w.tags.footway === 'crossing';
    for (const band of w.section.bands) {
      if (crossing) break;
      out.stats.bands++;
      const m = out[band.surface];
      if (band.raised > 0) {
        const side = band.kerb === 'both' ? 0 : band.offset > 0 ? 1 : -1;
        const cuts = trimIntervals(w, band, nodes, side);
        out.stats.trims += cuts.length;
        const top = LIFT.raisedBase + band.raised;
        for (const piece of cutIntervals(w.points, cuts)) {
          ribbon(m, piece, band.offset, band.width, height, top, { step });
          // Kerb face toward the carriageway (both sides for a mapped sidewalk).
          const inner = band.offset - Math.sign(band.offset || 1) * band.width / 2;
          if (band.kerb === 'both') {
            edgeWall(out.kerb, piece, band.width / 2, height, top, 0, 1, { step });
            edgeWall(out.kerb, piece, -band.width / 2, height, top, 0, -1, { step });
          } else edgeWall(out.kerb, piece, inner, height, top, 0, band.offset > 0 ? -1 : 1, { step });
          const n = piece.length, d0 = dirOf(piece[0], piece[1]), d1 = dirOf(piece[n - 2], piece[n - 1]);
          endCap(out.kerb, piece[0], d0, band.offset, band.width, height, top, 0, false);
          endCap(out.kerb, piece[n - 1], d1, band.offset, band.width, height, top, 0, true);
        }
        continue;
      }
      const lift = band.kind === 'carriageway' ? LIFT.carriageway : band.kind === 'cycle_lane' ? LIFT.cycleLane : crossing ? LIFT.crossing : LIFT.path;
      ribbon(m, w.points, band.offset, band.width, height, lift, { step });
      if (band.kind === 'carriageway' || band.offset === 0) {
        // Round ends / junction fills on the core band.
        for (const p of [w.points[0], w.points[w.points.length - 1], ...w.points.filter(p => (nodes.get(key(p))?.ways.size ?? 0) > 1)]) {
          const k = `${key(p)}:${band.surface}:${band.width.toFixed(1)}`;
          if (discDone.has(k)) continue;
          discDone.add(k);
          disc(m, p, band.width / 2, height, lift - 0.001, 14);
        }
      }
    }
    for (const line of w.section.paint) {
      // Paint stops short of junctions with other carriageways.
      const cuts = crossing ? [] : trimIntervals(w, { kind: 'carriageway', surface: 'asphalt', offset: line.offset, width: 0, raised: 0, kerb: 'none' }, nodes, 0);
      for (const piece of cutIntervals(w.points, cuts)) dashed(out.paint, piece, line.offset, line.width, line.dash, height, LIFT.paint);
    }
  }
  return out;
}

const dirOf = (a: Vec2, b: Vec2): Vec2 => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };

/** Dashes (or a solid line when `dash` is null) along a polyline. */
export function dashed(m: MeshArrays, pts: readonly Vec2[], offset: number, width: number, dash: [number, number] | null, height: HeightFn, lift: number): void {
  if (!dash) { ribbon(m, pts, offset, width, height, lift, { step: 3 }); return; }
  const st = stations(pts), total = st[st.length - 1], [on, off] = dash;
  const cuts: [number, number][] = [];
  for (let s = on; s < total; s += on + off) cuts.push([s, s + off]);
  for (const piece of cutIntervals(pts, cuts)) ribbon(m, piece, offset, width, height, lift, { step: 3 });
}

/** A draped route (or highlighted street) ribbon. */
export function routeRibbon(pts: readonly Vec2[], height: HeightFn, width = 1.4, lift: number = LIFT.route): MeshArrays {
  const m = emptyMesh();
  ribbon(m, pts, 0, width, height, lift, { step: 1.5 });
  return m;
}

export const streetTriangles = (s: StreetMeshes) => (['asphalt', 'klinker', 'cycle', 'paving', 'gravel', 'paint', 'kerb'] as const).reduce((n, k) => n + triangleCount(s[k]), 0);
