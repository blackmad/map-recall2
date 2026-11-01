// World matrices for what a pass can draw (#129 hand-back 17).
//
// three's renderer calls scene.updateMatrixWorld() on every render: every node, drawn or not, recomposed and
// multiplied by its parent's world. The shared frame renders the same scene in two passes (main, overlay) and the
// eye-relative participant wrappers change every frame, so every resident node (hidden landmark LODs, the other
// pass's participants) was multiplied twice a frame: updateMatrixWorld + multiplyMatrices were ~10.7 s of an 85 s
// 4x Jordaan profile. Nothing invisible is drawn (projectObject and the shadow map skip an invisible object and its
// children), so this is three's update with the invisible subtrees left out: the same matrices for every node that
// draws. A node keeps the matrix it last drew with while hidden; skipped under a changed parent it is marked
// matrixWorldNeedsUpdate, so the frame it shows again it and its subtree are refreshed.

export interface WorldNode {
  visible: boolean;
  matrixAutoUpdate: boolean;
  matrixWorldAutoUpdate: boolean;
  matrixWorldNeedsUpdate: boolean;
  parent: WorldNode | null;
  children: WorldNode[];
  matrix: unknown;
  matrixWorld: { copy(m: unknown): unknown; multiplyMatrices(a: unknown, b: unknown): unknown };
  updateMatrix(): void;
}

/** three's Object3D.updateMatrixWorld(force) for `node`, skipping invisible children. Returns nodes visited. */
export function updateDrawnWorld(node: WorldNode, force = false): number {
  if (node.matrixAutoUpdate) node.updateMatrix();
  if (node.matrixWorldNeedsUpdate || force) {
    if (node.matrixWorldAutoUpdate === true) {
      if (node.parent === null) node.matrixWorld.copy(node.matrix);
      else node.matrixWorld.multiplyMatrices(node.parent.matrixWorld, node.matrix);
    }
    node.matrixWorldNeedsUpdate = false;
    force = true;
  }
  let visited = 1;
  const children = node.children;
  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i];
    if (child.visible) visited += updateDrawnWorld(child, force);
    // Skipped under a changed parent: it (and so its subtree) updates the frame it shows, whoever forces then.
    else if (force) child.matrixWorldNeedsUpdate = true;
  }
  return visited;
}
