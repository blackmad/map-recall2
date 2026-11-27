// The tree wood geometry (inventory trees: trunks and the forks to offset crowns, one instanced draw). A trunk stands
// 5 cm into the relief and a fork's lower end sits inside its trunk, so the cylinder's bottom cap is never seen: it
// faces down, under the ground or inside wood. Leaving it out drops 7 of the 28 triangles per instance (#129).

/** A seven-sided tapered cylinder along +z, centred on the origin, 1 m long; without its bottom (−z) cap unless asked. */
export function trunkGeometry(THREE: any, options: { bottomCap?: boolean } = {}): any {
  const g = new THREE.CylinderGeometry(0.22, 0.28, 1, 7);
  if (!options.bottomCap) {
    // three's cylinder: group 0 the sides, 1 the top cap, 2 the bottom cap (−y), in index order.
    const bottom = g.groups[2];
    g.setIndex(new THREE.BufferAttribute(g.index.array.slice(0, bottom.start), 1));
  }
  g.clearGroups();
  return g.rotateX(Math.PI / 2);
}
