import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import specs from './amstel-towers-specs.json';
import sources from './amstel-towers-footprints.json';

/** Three original, native-scale towers: granite Art Deco crown, curved glass
 * corporate complex, and offset glass bays beside a solid central slab. */
export function buildAmstelTowerLandmark(id: string, _width: number, _depth: number, b: BuildingTools): void {
  type P = [number, number]; type C = Parameters<BuildingTools['add']>[1];
  const spec = specs.find(s => s.id === id), source = sources.find(s => s.id === id);
  if (!spec || !source) throw new Error(`No Amstel tower source for ${id}`);
  const [lng, lat] = spec.surveyed.anchor, heading = 69.7 * Math.PI / 180;
  const local = ([x, y]: number[]): P => {
    const e = (x - lng) * 111320 * Math.cos(lat * Math.PI / 180), n = (y - lat) * 110540;
    return [e * Math.sin(heading) + n * Math.cos(heading), e * Math.cos(heading) - n * Math.sin(heading)];
  };
  // Drop only redundant sub-decimetre survey vertices; retain curved outlines
  // and courtyard holes, rather than replacing the parent by its bounding box.
  function simplify(ring: P[]): P[] {
    let r = ring.slice();
    if (r.length > 1 && Math.hypot(r[0][0] - r.at(-1)![0], r[0][1] - r.at(-1)![1]) < .001) r.pop();
    let changed = true;
    while (changed && r.length > 4) {
      changed = false;
      for (let i = 0; i < r.length; i++) {
        const a = r[(i + r.length - 1) % r.length], q = r[i], c = r[(i + 1) % r.length];
        const length = Math.hypot(c[0] - a[0], c[1] - a[1]);
        const distance = length ? Math.abs((q[0] - a[0]) * (c[1] - a[1]) - (q[1] - a[1]) * (c[0] - a[0])) / length : 0;
        if (distance < .075 && Math.hypot(q[0] - a[0], q[1] - a[1]) + Math.hypot(q[0] - c[0], q[1] - c[1]) < length + .08) {
          r.splice(i, 1); changed = true; break;
        }
      }
    }
    return r;
  }
  const polygons = source.geometry.coordinates.map(poly => poly.map(r => simplify(r.map(local))));
  const clip = (r: P[], axis: 0 | 1, at: number, above: boolean): P[] => {
    const out: P[] = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[i], q = r[(i + 1) % r.length], ia = above ? a[axis] >= at : a[axis] <= at, iq = above ? q[axis] >= at : q[axis] <= at;
      if (ia) out.push(a);
      if (ia !== iq) { const t = (at - a[axis]) / (q[axis] - a[axis]); out.push([a[0] + (q[0] - a[0]) * t, a[1] + (q[1] - a[1]) * t]); }
    }
    return out;
  };
  const section = (r: P[], x0: number, x1: number, z0: number, z1: number) => clip(clip(clip(clip(r, 0, x0, true), 0, x1, false), 1, z0, true), 1, z1, false);
  function part(x0: number, x1: number, z0: number, z1: number, base: number, top: number, colour: C): P[][] {
    const walls: P[][] = [];
    for (const polygon of polygons) {
      const rings = polygon.map(r => section(r, x0, x1, z0, z1));
      if (rings[0].length < 3) continue;
      walls.push(rings[0]);
      const shape = new T.Shape(rings[0].map(p => new T.Vector2(...p)));
      for (const hole of rings.slice(1)) if (hole.length >= 3) shape.holes.push(new T.Path(hole.map(p => new T.Vector2(...p))));
      const geometry = new T.ExtrudeGeometry(shape, { depth: top - base, bevelEnabled: false });
      geometry.rotateX(Math.PI / 2); b.add(geometry, colour, 0, top, 0);
    }
    return walls;
  }
  function glassGrid(rings: P[][], base: number, top: number, pitch = 3.45, mullion = 'stone' as C): void {
    for (const ring of rings) {
      const area = ring.reduce((a, p, i) => a + p[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * p[1], 0);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], q = ring[(i + 1) % ring.length], dx = q[0] - a[0], dz = q[1] - a[1], length = Math.hypot(dx, dz);
        if (length < 1) continue;
        const nx = (area > 0 ? dz : -dz) / length, nz = (area > 0 ? -dx : dx) / length;
        const x = (a[0] + q[0]) / 2 + nx * .06, z = (a[1] + q[1]) / 2 + nz * .06, angle = -Math.atan2(dz, dx);
        for (let y = base + .70; y + pitch * .77 < top - .30; y += pitch) b.box(x, y, z, length - .16, pitch * .72, .12, 'glass', angle);
        const count = Math.max(1, Math.round(length / 2.25));
        for (let j = 0; j <= count; j++) {
          const t = j / count;
          b.box(a[0] + dx * t + nx * .15, base, a[1] + dz * t + nz * .15, .24, top - base, .17, mullion, angle);
        }
      }
    }
  }
  const office = (x0: number, x1: number, z0: number, z1: number, base: number, top: number, colour: C = 'stone', pitch = 3.45, mullion: C = 'stone') => {
    const ring = part(x0, x1, z0, z1, base, top, colour); glassGrid(ring, base, top, pitch, mullion); return ring;
  };
  if (id === 'rembrandt-tower') {
    // The nine-storey stepped podium remains broad. Four glass corner oriels
    // rise past the twenty regular office floors into freestanding crowns.
    office(-100, 100, -100, 100, 0, 22.05, 'stone', 3.4);
    office(-18.7, 20.8, -16.9, 22.0, 22.05, 37.02, 'stone', 3.7);
    office(-15.4, 17.9, -13.6, 19.1, 37.02, 106.85, 'stone', 3.45);
    for (const x of [-14.0, 16.1]) for (const z of [-11.9, 17.2]) {
      const corners = part(x - 3.0, x + 3.0, z - 3.0, z + 3.0, 37.02, 120.47, 'glass');
      glassGrid(corners, 37.02, 120.47, 3.45, 'frame');
      b.box(x, 120.47, z, 6.0, .20, 6.0, 'frame');
    }
    office(-13.2, 16.1, -13.0, 17.6, 106.85, 110.1, 'stone', 3.25);
    office(-11.6, 14.1, -10.3, 14.8, 110.1, 120.5, 'stone', 3.45);
    office(-9.2, 12.3, -7.9, 13.1, 120.5, 132.4, 'stone', 3.8);
    // Recessed crown eyes and small mechanical centre, not a large pyramid.
    b.box(1.55, 132.4, 2.6, 7.0, 2.6, 6.8, 'stone');
    for (const z of [-1, 6.2]) b.box(1.55, 133.2, z, 4.8, 1.5, .12, 'dark');
    for (const y of [135, 136.2, 137.3]) b.add(new T.CylinderGeometry(1.4, 1.4, .33, 10), 'stone', 1.55, y, 2.6);
    b.add(new T.CylinderGeometry(.22, .42, 12.3, 8), 'white', 1.55, 143.65, 2.6);
    b.box(1.55, 149.7, 2.6, .48, .30, .48, 'gold');
    // Photographed south-facing entrance portico: visibly open columns.
    b.box(1.5, 4.8, 23.8, 25.4, .42, 5.5, 'stone');
    for (const x of [-10.5, -5, 1.5, 8, 13.5]) b.box(x, 0, 25.7, .40, 4.8, .40, 'stone');
    b.box(1.5, 5.2, 26.49, 12.4, 10.8, .13, 'glass');
    for (const x of [-4.6, 1.5, 7.6]) b.box(x, 5.2, 26.62, .23, 10.8, .15, 'frame');
  // POI identification uses the map label; nondefining name glyphs omitted.
  } else if (id === 'breitner-tower') {
    // One real physical parent: curved northern low-rise block, transparent
    // linking hall, and three stepped-height glass plates at the south end.
    office(-100, 100, -100, 13.0, 0, 16.55, 'white', 3.7, 'frame');
    part(-100, 100, -100, 13.0, 16.55, 16.85, 'slate');
    office(-13.5, 9.5, 13.0, 20.0, 0, 13.1, 'white', 4.0, 'frame');
    office(-13.5, -8.8, 13.0, 49.3, 0, 63.9, 'glass', 3.4, 'frame');
    office(-8.8, 6.1, 20.0, 53.7, 0, 93.45, 'glass', 3.4, 'frame');
    office(6.1, 16.0, 20.0, 53.7, 0, 82.6, 'glass', 3.4, 'frame');
    // Roof machinery cap is modest; official 95m height governs the silhouette.
    part(-3.4, 2.4, 39.5, 47.2, 93.45, 95.0, 'slate');
    b.box(-.5, 4.4, 16.3, 19.2, .27, 4.6, 'white');
    for (const x of [-8.6, 7.6]) b.box(x, 0, 17.8, .26, 4.4, .26, 'frame');
  } else if (id === 'mondriaan-tower') {
    // Solid spine with unequal-height volumes and offset transparent bays.
    office(-100, -14.7, -100, 100, 0, 11.35, 'stone', 3.55);
    // Three-storey entrance height below the thirty regular office floors.
    office(-14.7, 28.5, -5.65, 9.3, 0, 11.35, 'stone', 11.0);
    office(-14.7, -4.7, -5.65, 9.3, 11.35, 92.25, 'stone', 3.5);
    office(-4.7, 28.5, -5.65, 9.3, 11.35, 117.3, 'stone', 3.5);
    office(0, 17.0, -14.4, -5.65, 0, 11.35, 'glass', 11.0, 'frame');
    office(0, 22.0, 9.3, 15.0, 0, 11.35, 'glass', 11.0, 'frame');
    office(0, 17.0, -14.4, -5.65, 11.35, 106.5, 'glass', 3.5, 'frame');
    office(0, 22.0, 9.3, 15.0, 11.35, 106.5, 'glass', 3.5, 'frame');
    // The architect's "crow's nest" is a glass cube near the upper floors.
    b.box(7.6, 106.5, -8.55, 14.7, 8.0, 6.0, 'glass');
    for (const x of [.5, 5.2, 10, 14.7]) b.box(x, 106.5, -11.63, .18, 8.1, .12, 'frame');
    for (const y of [106.5, 110.3, 114.5]) b.box(7.6, y, -11.63, 14.8, .13, .12, 'frame');
    part(.5, 27.5, -5.6, 9.2, 117.3, 119.0, 'stone');
    // Equipment measured above the architectural120m headline remains small.
    b.box(4.7, 119.0, .9, 5.6, 3.3, 4.8, 'slate');
    b.box(-24.5, 4.0, 8.7, 10.1, .28, 3.7, 'stone');
  // POI identification uses the map label; nondefining name glyphs omitted.
  } else throw new Error(`No Amstel tower builder for ${id}`);
}
