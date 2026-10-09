// Street ribbons and lane paint for the own-renderer spike (pure, no three).
//
// The game never had road geometry of its own: MapLibre paints OpenFreeMap's
// road lines. Our extract (`streets-routing.json`) only carries centrelines
// and an OSM `highway` class, so widths and surfaces here are class priors,
// not surveyed carriageways. Coordinates are local metres (x east, y north).

export type Vec2 = [number, number];
export type StreetWay = { highway: string; points: Vec2[] };

export type Surface = 'asphalt' | 'klinker' | 'cycle' | 'paving';
type ClassStyle = { width: number; surface: Surface; rank: number; centreDash?: boolean; edgeLines?: boolean };

/** Width (m) and surface per OSM class: Amsterdam priors, documented as such. */
export const STREET_CLASSES: Record<string, ClassStyle> = {
  primary: { width: 10, surface: 'asphalt', rank: 6, centreDash: true, edgeLines: true },
  secondary: { width: 9, surface: 'asphalt', rank: 6, centreDash: true, edgeLines: true },
  tertiary: { width: 7.5, surface: 'asphalt', rank: 5, centreDash: true },
  unclassified: { width: 6, surface: 'klinker', rank: 4 },
  residential: { width: 6, surface: 'klinker', rank: 4 },
  living_street: { width: 5.5, surface: 'klinker', rank: 4 },
  service: { width: 4, surface: 'klinker', rank: 3 },
  pedestrian: { width: 6, surface: 'paving', rank: 2 },
  cycleway: { width: 2.6, surface: 'cycle', rank: 7, edgeLines: true },
  footway: { width: 2, surface: 'paving', rank: 1 },
  path: { width: 2, surface: 'paving', rank: 1 },
  steps: { width: 2, surface: 'paving', rank: 1 },
};

export type MeshArrays = { positions: number[]; normals: number[]; uvs: number[]; indices: number[] };
const empty = (): MeshArrays => ({ positions: [], normals: [], uvs: [], indices: [] });

/** A flat vertex at height z; uv is world metres so tiled textures stay put. */
function vertex(m: MeshArrays, x: number, y: number, z: number): number {
  m.positions.push(x, y, z);
  m.normals.push(0, 0, 1);
  m.uvs.push(x, y);
  return m.positions.length / 3 - 1;
}

function quad(m: MeshArrays, a: Vec2, b: Vec2, c: Vec2, d: Vec2, z: number): void {
  const i = vertex(m, a[0], a[1], z), j = vertex(m, b[0], b[1], z), k = vertex(m, c[0], c[1], z), l = vertex(m, d[0], d[1], z);
  m.indices.push(i, j, k, i, k, l);
}

function disc(m: MeshArrays, c: Vec2, r: number, z: number, sides = 10): void {
  const centre = vertex(m, c[0], c[1], z);
  const first = m.positions.length / 3;
  for (let s = 0; s < sides; s++) {
    const t = (s / sides) * Math.PI * 2;
    vertex(m, c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r, z);
  }
  for (let s = 0; s < sides; s++) m.indices.push(centre, first + s, first + ((s + 1) % sides));
}

/** One straight strip of half-width `h` from a to b, offset sideways by `off`, CCW seen from above. */
function strip(m: MeshArrays, a: Vec2, b: Vec2, h: number, z: number, off = 0): void {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  if (len < 1e-3) return;
  const nx = -dy / len, ny = dx / len; // left normal
  const lx = nx * (off + h), ly = ny * (off + h), rx = nx * (off - h), ry = ny * (off - h);
  quad(m, [a[0] + rx, a[1] + ry], [b[0] + rx, b[1] + ry], [b[0] + lx, b[1] + ly], [a[0] + lx, a[1] + ly], z);
}

/** Dashes along a polyline (dash `on` metres, gap `off`), carried across vertices. */
function dashes(m: MeshArrays, pts: Vec2[], halfWidth: number, z: number, on: number, off: number, offset = 0): void {
  let phase = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-3) continue;
    let s = 0;
    while (s < len) {
      const period = on + off, inPeriod = phase % period;
      const drawing = inPeriod < on;
      const step = Math.min(len - s, drawing ? on - inPeriod : period - inPeriod);
      if (drawing && step > 0.05) {
        const t0 = s / len, t1 = (s + step) / len;
        strip(m, [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1], halfWidth, z, offset);
      }
      s += step; phase += step;
    }
  }
}

export type StreetMeshes = Record<Surface, MeshArrays> & { paint: MeshArrays; stats: { ways: number; metres: number } };

/**
 * Surfaces grouped by material (one draw call each) and one paint mesh.
 * Higher-rank classes sit a few millimetres higher, so a cycle track over a
 * residential street wins the depth test instead of z-fighting with it.
 */
export function buildStreetMeshes(ways: readonly StreetWay[]): StreetMeshes {
  const out = { asphalt: empty(), klinker: empty(), cycle: empty(), paving: empty(), paint: empty(), stats: { ways: 0, metres: 0 } } as StreetMeshes;
  for (const way of ways) {
    const style = STREET_CLASSES[way.highway];
    if (!style || way.points.length < 2) continue;
    out.stats.ways++;
    const m = out[style.surface], h = style.width / 2, z = 0.02 + style.rank * 0.004;
    for (let i = 0; i + 1 < way.points.length; i++) {
      strip(m, way.points[i], way.points[i + 1], h, z);
      out.stats.metres += Math.hypot(way.points[i + 1][0] - way.points[i][0], way.points[i + 1][1] - way.points[i][1]);
    }
    // Round joins fill the wedge gaps at bends and junctions.
    for (const p of way.points) disc(m, p, h, z);
    const pz = z + 0.012;
    if (style.centreDash) dashes(out.paint, way.points, 0.06, pz, 3, 5);
    if (style.edgeLines) {
      const inset = h - 0.25;
      if (style.surface === 'cycle') { dashes(out.paint, way.points, 0.05, pz, 1, 1, inset); dashes(out.paint, way.points, 0.05, pz, 1, 1, -inset); }
      else { dashes(out.paint, way.points, 0.07, pz, 1e9, 0, inset); dashes(out.paint, way.points, 0.07, pz, 1e9, 0, -inset); }
    }
  }
  return out;
}
