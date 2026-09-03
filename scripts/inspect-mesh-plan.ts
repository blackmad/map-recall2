// Prints a top-down occupancy plot of a mesh, so a downloaded model can be
// compared against the footprint it is supposed to fill without opening a
// model viewer. Used to work out how much of a building a source asset
// actually covers — a "whole building" download is often only its street range.
//
//   npx tsx scripts/inspect-mesh-plan.ts <file.glb>

import process from 'node:process';

import { NodeIO, type Document, type Node as GltfNode } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a: number[], b: number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      for (let k = 0; k < 4; k += 1) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
  }
  return out;
}

function worldPositions(document: Document): [number, number, number][] {
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  const points: [number, number, number][] = [];
  const visit = (node: GltfNode, parentMatrix: number[]): void => {
    const matrix = multiply(parentMatrix, node.getMatrix() as number[]);
    const mesh = node.getMesh();
    if (mesh) {
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute('POSITION');
        if (!position) continue;
        const element: [number, number, number] = [0, 0, 0];
        for (let index = 0; index < position.getCount(); index += 1) {
          position.getElement(index, element);
          const [x, y, z] = element;
          points.push([
            matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
            matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
            matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
          ]);
        }
      }
    }
    for (const child of node.listChildren()) visit(child, matrix);
  };
  for (const node of scene.listChildren()) visit(node, IDENTITY);
  return points;
}

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: inspect-mesh-plan.ts <file.glb>');
  const document = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(source);
  const points = worldPositions(document);

  // Spread-into-Math.min would overflow the call stack: this mesh has 346,000
  // vertices and the argument limit is far below that.
  const axes = [0, 1, 2].map(axis => {
    let min = Infinity;
    let max = -Infinity;
    for (const point of points) {
      if (point[axis] < min) min = point[axis];
      if (point[axis] > max) max = point[axis];
    }
    return { min, max };
  });
  console.log(
    'extent X/Y/Z:',
    axes.map(a => (a.max - a.min).toFixed(3)).join(' × '),
    '(Y is up)',
  );

  // Plan view: X across, Z down, occupancy by vertex count.
  const columns = 72;
  const rows = 30;
  const grid: number[][] = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));
  for (const [x, , z] of points) {
    const column = Math.min(columns - 1, Math.floor(((x - axes[0].min) / (axes[0].max - axes[0].min)) * columns));
    const row = Math.min(rows - 1, Math.floor(((z - axes[2].min) / (axes[2].max - axes[2].min)) * rows));
    grid[row][column] += 1;
  }
  const peak = grid.flat().reduce((a, b) => (b > a ? b : a), 0);
  const ramp = ' .:-=+*#%@';
  console.log(`\nplan view (X → across, Z → down), peak ${peak} vertices/cell:`);
  for (const row of grid) {
    console.log(row.map(count => ramp[Math.min(ramp.length - 1, Math.ceil((count / peak) * (ramp.length - 1)))]).join(''));
  }

  // Elevation: X across, Y up.
  const elevationRows = 20;
  const elevation: number[][] = Array.from({ length: elevationRows }, () => new Array<number>(columns).fill(0));
  for (const [x, y] of points) {
    const column = Math.min(columns - 1, Math.floor(((x - axes[0].min) / (axes[0].max - axes[0].min)) * columns));
    const row = Math.min(
      elevationRows - 1,
      Math.floor(((axes[1].max - y) / (axes[1].max - axes[1].min)) * elevationRows),
    );
    elevation[row][column] += 1;
  }
  const elevationPeak = elevation.flat().reduce((a, b) => (b > a ? b : a), 0);
  console.log(`\nelevation (X → across, Y up), peak ${elevationPeak} vertices/cell:`);
  for (const row of elevation) {
    console.log(
      row.map(count => ramp[Math.min(ramp.length - 1, Math.ceil((count / elevationPeak) * (ramp.length - 1)))]).join(''),
    );
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
