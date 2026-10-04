import * as T from 'three';

/** Native east/south footprint, glTF Y-up. Keep holes and let a separate roof own the top. */
export function openTopPrism(shape: T.Shape, bottom: number, top: number): T.BufferGeometry {
  const extrusion = new T.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false });
  extrusion.rotateX(Math.PI / 2); extrusion.translate(0, top, 0);
  const flat = extrusion.index ? extrusion.toNonIndexed() : extrusion;
  const p = flat.getAttribute('position'), n = flat.getAttribute('normal'), values: number[] = [];
  for (let i = 0; i < p.count; i += 3) {
    if ([0, 1, 2].every(j => n.getY(i + j) > .9)) continue;
    for (let j = 0; j < 3; j++) values.push(p.getX(i + j), p.getY(i + j), p.getZ(i + j));
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(values, 3)); geometry.computeVertexNormals();
  if (flat !== extrusion) flat.dispose(); extrusion.dispose();
  return geometry;
}

/** A roof in the same footprint coordinates, facing up rather than down after axis conversion. */
export function upwardRoofPlane(shape: T.Shape, height = 0): T.ShapeGeometry {
  const geometry = new T.ShapeGeometry(shape); geometry.rotateX(Math.PI / 2);
  const indices = geometry.index!;
  for (let i = 0; i < indices.count; i += 3) {
    const j = indices.getX(i + 1); indices.setX(i + 1, indices.getX(i + 2)); indices.setX(i + 2, j);
  }
  geometry.computeVertexNormals(); geometry.translate(0, height, 0);
  return geometry;
}
