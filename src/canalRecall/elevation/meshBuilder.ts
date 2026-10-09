// Tiny flat-shaded mesh accumulator for the elevation layer.
//
// Faces carry a baked colour (base × fixed sun) so the layer can draw with an
// unlit material: no lights, no normals on the GPU. Every face is wound from
// the normal its caller states, so callers never reason about winding.

export type V3 = [number, number, number];
export type RGB = [number, number, number];

/** Light from the south-west and high, like the building layers' sun. */
const SUN: V3 = normalise([-0.45, -0.35, 0.82]);

export function normalise(v: V3): V3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

export function hexToRgb(hex: string): RGB {
  const value = parseInt(hex.replace('#', ''), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function shade(colour: RGB, normal: V3, ambient = 0.62): RGB {
  const n = normalise(normal);
  const light = ambient + (1 - ambient) * Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]);
  return [colour[0] * light, colour[1] * light, colour[2] * light];
}

function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export class MeshBuilder {
  positions: number[] = [];
  colors: number[] = [];
  indices: number[] = [];

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  private vertex(p: V3, colour: RGB): number {
    this.positions.push(p[0], p[1], p[2]);
    this.colors.push(colour[0], colour[1], colour[2]);
    return this.vertexCount - 1;
  }

  /** Triangle facing `normal` (counter-clockwise seen from that side). */
  triangle(a: V3, b: V3, c: V3, normal: V3, colour: RGB, lit = true): void {
    const face = cross(sub(b, a), sub(c, a));
    if (Math.hypot(face[0], face[1], face[2]) < 1e-9) return;
    const flip = face[0] * normal[0] + face[1] * normal[1] + face[2] * normal[2] < 0;
    const tint = lit ? shade(colour, normal) : colour;
    const ia = this.vertex(a, tint), ib = this.vertex(flip ? c : b, tint), ic = this.vertex(flip ? b : c, tint);
    this.indices.push(ia, ib, ic);
  }

  /** Quad a-b-c-d (in order around its edge) facing `normal`. */
  quad(a: V3, b: V3, c: V3, d: V3, normal: V3, colour: RGB, lit = true): void {
    this.triangle(a, b, c, normal, colour, lit);
    this.triangle(a, c, d, normal, colour, lit);
  }

  /** A vertical wall strip from (x0,y0) to (x1,y1) between per-end top and bottom heights. */
  wall(x0: number, y0: number, x1: number, y1: number, top0: number, bottom0: number, top1: number, bottom1: number, normal: V3, colour: RGB): void {
    if (top0 - bottom0 < 1e-3 && top1 - bottom1 < 1e-3) return;
    this.quad([x0, y0, top0], [x1, y1, top1], [x1, y1, bottom1], [x0, y0, bottom0], normal, colour);
  }

  /** Indexed triangles from an earcut result over flat 2D coordinates at one height. */
  flat(coords: ArrayLike<number>, triangles: ArrayLike<number>, z: number, normal: V3, colour: RGB, lit = true): void {
    for (let i = 0; i < triangles.length; i += 3) {
      const p = (k: number): V3 => [coords[triangles[i + k] * 2], coords[triangles[i + k] * 2 + 1], z];
      this.triangle(p(0), p(1), p(2), normal, colour, lit);
    }
  }

  build(): { positions: Float32Array; colors: Float32Array; indices: Uint32Array } {
    return { positions: new Float32Array(this.positions), colors: new Float32Array(this.colors), indices: new Uint32Array(this.indices) };
  }
}

export type MeshData = ReturnType<MeshBuilder['build']>;
