import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import spec from './piramides-spec.json';
import source from './piramides-footprints.json';

/** Original twin stepped towers. Each surveyed tier supplies only its visible
 * vertical section; the upper notch and roof terraces remain genuinely open. */
export function buildPiramides(_width: number, _depth: number, b: BuildingTools): void {
  type P = [number, number];
  const [lng, lat] = spec.surveyed.anchor, h = 81.5 * Math.PI / 180;
  function local([x, y]: number[]): P {
    const e = (x - lng) * 111320 * Math.cos(lat * Math.PI / 180), n = (y - lat) * 110540;
    return [e * Math.sin(h) + n * Math.cos(h), e * Math.cos(h) - n * Math.sin(h)];
  }
  function simplify(points: P[]): P[] {
    const ring = points.slice(); ring.pop();
    let again = true;
    while (again && ring.length > 4) {
      again = false;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[(i + ring.length - 1) % ring.length], p = ring[i], q = ring[(i + 1) % ring.length];
        const length = Math.hypot(q[0] - a[0], q[1] - a[1]);
        const deviation = length ? Math.abs((p[0] - a[0]) * (q[1] - a[1]) - (p[1] - a[1]) * (q[0] - a[0])) / length : 0;
        if (deviation < .095 && Math.hypot(p[0] - a[0], p[1] - a[1]) + Math.hypot(p[0] - q[0], p[1] - q[1]) < length + .08) {
          ring.splice(i, 1); again = true; break;
        }
      }
    }
    return ring;
  }
  for (const part of source.parts) {
    for (const polygon of part.geometry.coordinates) {
      const ring = simplify(polygon[0].map(local));
      const shape = new T.Shape(ring.map(p => new T.Vector2(...p)));
      const wall = new T.ExtrudeGeometry(shape, { depth: part.height - part.base, bevelEnabled: false });
      wall.rotateX(Math.PI / 2); b.add(wall, 'brick', 0, part.height, 0);
      // Thin flat roofing follows the tier outline without filling the gap
      // between the two crowns or turning the raised public square into a box.
      const roof = new T.ShapeGeometry(shape); roof.rotateX(Math.PI / 2);
      const indices = roof.index!;
      for (let j = 0; j < indices.count; j += 3) { const a = indices.getX(j); indices.setX(j, indices.getX(j + 2)); indices.setX(j + 2, a); }
      roof.computeVertexNormals();
      b.add(roof, 'slate', 0, part.height + .012, 0);
      const area = ring.reduce((sum, p, i) => sum + p[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * p[1], 0);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], q = ring[(i + 1) % ring.length], dx = q[0] - a[0], dz = q[1] - a[1], length = Math.hypot(dx, dz);
        if (length < .8) continue;
        const nx = (area > 0 ? dz : -dz) / length, nz = (area > 0 ? -dx : dx) / length, angle = -Math.atan2(dz, dx);
        // The busier north elevation has fewer windows; the south courtyard
        // faces carry the larger white-framed openings seen in primary photos.
        const count = Math.max(1, Math.floor(length / (nz < -.7 ? 3.0 : 2.4)));
        const floors = part.base === 0 ? [1.2] : [part.base + .65, part.base + 3.40];
        for (const y of floors) {
          if (y + 1.92 > part.height - .1) continue;
          for (let j = 0; j < count; j++) {
            const t = (j + .5) / count, x = a[0] + dx * t, z = a[1] + dz * t;
            b.box(x + nx * .045, y, z + nz * .045, 1.22, 1.90, .11, 'white', angle);
            b.box(x + nx * .115, y + .15, z + nz * .115, .95, 1.57, .085, 'glass', angle);
          }
          // Masonry floor bands read at game scale without textures.
          b.box((a[0] + q[0]) / 2 + nx * .028, y - .36, (a[1] + q[1]) / 2 + nz * .028, length, .07, .06, 'red', angle);
        }
        // Low stepped terrace edge rather than a solid balcony parapet wall.
        if (part.height < 55 && Math.abs(nz) < .6) {
          b.box((a[0] + q[0]) / 2 + nx * .06, part.height + .53, (a[1] + q[1]) / 2 + nz * .06, length, .075, .075, 'frame', angle);
          const posts = Math.max(1, Math.ceil(length / 2));
          for (let j = 0; j <= posts; j++) b.box(a[0] + dx * j / posts + nx * .06, part.height, a[1] + dz * j / posts + nz * .06, .065, .58, .065, 'frame', angle);
        }
      }
    }
  }
  // The south-west tower's recessed balcony stack is an open white framework,
  // confined to the parent’s surveyed shallow entrance projection.
  for (let y = 5; y < 27; y += 2.75) {
    b.box(-13, y, 12.24, 7.1, .17, 1.55, 'stone');
    b.box(-13, y + .90, 13.0, 7.1, .085, .085, 'white');
    for (let x = -16.3; x <= -9.6; x += 1.12) b.box(x, y + .2, 13.0, .065, .78, .065, 'white');
  }
  for (const x of [-16.5, -13, -9.5]) b.box(x, 0, 13.0, .15, 27.7, .15, 'white');
  b.box(-13, 4.52, 12.22, 7.5, .28, 1.9, 'white');
  b.box(-13, 0, 11.62, 5.7, 4.45, .13, 'glass');
  b.sign('DE PIRAMIDES', -13, 4.64, 13.2, .13, 'dark');
}
