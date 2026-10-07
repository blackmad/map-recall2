import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import data from './amsta-de-poort-footprints.json';
type Colour = Parameters<BuildingTools['add']>[1];
/** Original care-home massing, calibrated to the current parent and large surveyed roof zones. */
export function buildAmstaDePoort(_id: string, _w: number, _d: number, b: BuildingTools) {
  const { add, box } = b, angle = data.authorHeadingDegrees * Math.PI / 180;
  const project = (p: number[]) => {
    const east = (p[0] - data.anchor[0]) * 111320 * Math.cos(data.anchor[1] * Math.PI / 180);
    const north = (p[1] - data.anchor[1]) * 110540;
    return new T.Vector2(east * Math.sin(angle) + north * Math.cos(angle), east * Math.cos(angle) - north * Math.sin(angle));
  };
  const outline = data.parent.geometry.coordinates[0].slice(0, -1).map(project);
  function volume(ring: T.Vector2[], bottom: number, top: number, colour: Colour = 'frame', keepTop = true) {
    const g = new T.ExtrudeGeometry(new T.Shape(ring), { depth: top - bottom, bevelEnabled: false });
    g.rotateX(Math.PI / 2); g.translate(0, top, 0);
    if (keepTop) { add(g, colour); return; }
    // Explicit slate roof panels own the top; a second gray cap causes depth flicker.
    const flat = g.index ? g.toNonIndexed() : g, positions = flat.getAttribute('position'), normals = flat.getAttribute('normal'), out: number[] = [];
    for (let i = 0; i < positions.count; i += 3) {
      if ([0, 1, 2].every(j => normals.getY(i + j) > .9)) continue;
      for (let j = 0; j < 3; j++) out.push(positions.getX(i + j), positions.getY(i + j), positions.getZ(i + j));
    }
    const shell = new T.BufferGeometry(); shell.setAttribute('position', new T.Float32BufferAttribute(out, 3)); shell.computeVertexNormals();
    if (flat !== g) flat.dispose(); g.dispose(); add(shell, colour);
  }
  function plane(x: number, y: number, z: number, w: number, h: number, colour: Colour, a = 0) {
    add(new T.PlaneGeometry(w, h), colour, x, y + h / 2, z, a);
  }
  function glazing(x: number, y: number, z: number, w: number, h: number, lights: number, a = 0, panel = true) {
    const nx = Math.sin(a), nz = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
    plane(x, y, z, w, h, 'white', a);
    plane(x + nx * .035, y + .10, z + nz * .035, w - .18, h - .20, 'glass', a);
    if (panel) plane(x + nx * .055, y + .10, z + nz * .055, w - .18, .32, 'gold', a);
    for (let i = 1; i < lights; i++) {
      const u = -w / 2 + w * i / lights;
      box(x + u * tx + nx * .07, y, z + u * tz + nz * .07, .07, h, .09, 'white', a);
    }
    box(x + nx * .075, y + h * .73, z + nz * .075, w, .065, .09, 'white', a);
  }
  // A real recessed ground storey supports the projecting residential strip above.
  volume(outline.map(p => new T.Vector2(p.x, Math.min(p.y, 20.25))), 0, 3.30, 'dark');
  // The separately calibrated rear/upper/front zones avoid a 31.7m block over the entire parent.
  for (const zone of data.roofZones) {
    const ring = zone.planMetres.map(p => new T.Vector2(p[0], p[1]));
    volume(ring, 3.30, zone.topMetres, 'frame', false);
    const lid = new T.ShapeGeometry(new T.Shape(ring)); lid.rotateX(Math.PI / 2);
    const index = lid.index!; for (let i = 0; i < index.count; i += 3) { const v = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, v); } lid.computeVertexNormals();
    add(lid, 'slate', 0, zone.topMetres + .035, 0);
  }
  const front = 22.94;
  for (let x = -35.9; x <= 23.3; x += 3.28) {
    box(x, 0, 21.55, .44, 3.36, .56, 'brick');
    glazing(x + 1.60, .28, 20.32, 2.74, 2.68, 2, 0, false);
  }
  box(-5.8, 3.15, 21.72, 61.0, .48, 2.58, 'white');
  const rows = [4.16, 7.38, 10.60, 13.82, 17.04, 20.26];
  // Alternating broad multi-light room strips and narrower paired windows follow the owner facade photograph.
  for (const y of rows) {
    for (let i = 0; i < 6; i++) {
      const x = -32.2 + i * 9.8;
      glazing(x, y, front, 5.35, 2.30, 6);
      glazing(x + 4.85, y + .02, front, 3.12, 2.27, 2, 0, false);
      box(x + 2.95, y - .12, front + .02, .28, 3.10, .18, 'dark');
    }
    box(-5.8, y - .15, front, 59.8, .15, .18, 'white');
  }
  // Two ochre-framed glass bays stand slightly proud of the lower room-strip facade.
  for (const x of [-5.2, 15.5]) {
    box(x, 4.01, front + .20, 3.55, .20, .56, 'white');
    for (const y of [4.20, 7.40]) glazing(x, y, front + .47, 3.22, 2.90, 4);
    for (const dx of [-1.67, 1.67]) box(x + dx, 4.12, front + .42, .12, 6.34, .18, 'gold');
    box(x, 10.47, front + .26, 3.57, .20, .67, 'white');
  }
  box(-5.8, 23.41, front - .06, 59.5, .25, .32, 'white');
  // Penthouse ribbon is set back from the six occupied rows; the right end remains the lower roof.
  for (let x = -26.5; x <= 12; x += 3.05) glazing(x, 24.36, 19.92, 2.83, 1.85, 2, 0, false);
  box(-7.3, 27.35, 19.98, 42.8, .39, .28, 'gold');
  for (const x of [-27.9, 14.0]) box(x, 23.75, 19.93, .20, 3.6, .26, 'white');
  // Small surveyed service core and sparse antenna masts do not raise every roof to their maximum.
  box(3.56, 27.50, 11.93, 3.3, 4.20, 2.31, 'frame');
  box(3.56, 31.69, 11.93, 3.43, .12, 2.43, 'slate');
  for (const x of [.2, 1.15]) { box(x, 27.6, 14.3, .10, 3.75, .10, 'dark'); box(x, 29.35, 14.3, .22, 1.48, .19, 'frame'); }
  // Rear and side windows are an illustrative rhythm, not a claim of surveyed window counts.
  // Only exposed roof-zone walls receive them; shared internal partitions remain undecorated.
  const inside = (x: number, z: number, ring: number[][]) => {
    let yes = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const p = ring[i], q = ring[j];
      if ((p[1] > z) !== (q[1] > z) && x < (q[0] - p[0]) * (z - p[1]) / (q[1] - p[1]) + p[0]) yes = !yes;
    }
    return yes;
  };
  for (const zone of data.roofZones) {
    const ring = zone.planMetres, vectors = ring.map(p => new T.Vector2(p[0], p[1]));
    const clockwise = T.ShapeUtils.area(vectors) < 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
      if (len < 4) continue;
      const nx = clockwise ? -dz / len : dz / len, nz = clockwise ? dx / len : -dx / len;
      const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
      if (mz > 17 && nz > .6) continue; // The source-backed canal front and upper ribbon already have their own detailed glazing.
      const adjacent = Math.max(3.3, ...data.roofZones.filter(other => other !== zone && inside(mx + nx * .18, mz + nz * .18, other.planMetres)).map(other => other.topMetres));
      const count = Math.max(1, Math.floor(len / 3.35)), a = Math.atan2(nx, nz);
      for (let j = 0; j < count; j++) {
        const t = (j + .5) / count, x = p[0] + dx * t + nx * .10, z = p[1] + dz * t + nz * .10;
        for (const y of [...rows, 24.36]) if (y > adjacent + .15 && y + 2.1 < zone.topMetres - .25) glazing(x, y, z, Math.min(2.62, len / count - .42), 2.10, 2, a, false);
      }
    }
  }
  plane(5.0, 3.82, front + .40, 8.8, .80, 'white');
  // POI identification uses the map label; nondefining name glyphs omitted.
}
