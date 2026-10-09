// Canal water surfaces, openings and quay walls for one extract cell.
//
// The flat MapLibre water stays as it is. This layer draws, through a stencil
// "opening" the shape of the water at street level, the sunken scene below it:
// a water plane `freeboard` metres down and the quay walls that face into the
// canal. See elevationBrowser.ts for the pass order and docs/elevation.md.

import earcut from 'earcut';
import type { WaterCell } from './elevationData.js';
import { MeshBuilder, hexToRgb, type MeshData, type RGB } from './meshBuilder.js';

/** Natural-stone coping, then brick, then the dark algae band at the waterline. */
export const QUAY_COLOURS = {
  coping: hexToRgb('#a29c90'),
  brick: hexToRgb('#7b5a4a'),
  waterline: hexToRgb('#3d4a3f'),
};
const COPING_DEPTH_M = 0.25;
const ALGAE_BAND_M = 0.35;
/** Walls run a little under the water plane so no crack shows at grazing views. */
const WALL_SKIRT_M = 0.25;

type ToScene = (x: number, y: number) => [number, number];

function ringCoords(ring: number[], origin: [number, number], quant: number, toScene: ToScene): number[] {
  const out: number[] = new Array(ring.length);
  for (let i = 0; i < ring.length; i += 2) {
    const [x, y] = toScene(origin[0] + ring[i] * quant, origin[1] + ring[i + 1] * quant);
    out[i] = x;
    out[i + 1] = y;
  }
  return out;
}

/** Triangulate a cell's water at height `z` (the opening at 0, the surface at −freeboard). */
export function waterSurface(cell: WaterCell, cellSizeM: number, quant: number, z: number, colour: RGB, toScene: ToScene = (x, y) => [x, y]): MeshData {
  const mesh = new MeshBuilder();
  const origin: [number, number] = [cell.cell[0] * cellSizeM, cell.cell[1] * cellSizeM];
  for (const polygon of cell.water) {
    const coords: number[] = [];
    const holes: number[] = [];
    polygon.forEach((ring, i) => {
      if (i > 0) holes.push(coords.length / 2);
      coords.push(...ringCoords(ring, origin, quant, toScene));
    });
    mesh.flat(coords, earcut(coords, holes, 2), z, [0, 0, 1], colour, false);
  }
  return mesh.build();
}

/**
 * Quay walls along every true shoreline. A segment a→b has the water on its
 * left, so the wall faces left (into the canal) and runs from street level down
 * past the water plane.
 */
export function quayWalls(cell: WaterCell, cellSizeM: number, quant: number, freeboard: number, toScene: ToScene = (x, y) => [x, y]): MeshData {
  const mesh = new MeshBuilder();
  const origin: [number, number] = [cell.cell[0] * cellSizeM, cell.cell[1] * cellSizeM];
  const rows = [0, -COPING_DEPTH_M, -(freeboard - ALGAE_BAND_M), -(freeboard + WALL_SKIRT_M)];
  const colours = [QUAY_COLOURS.coping, QUAY_COLOURS.brick, QUAY_COLOURS.waterline];
  for (const line of cell.shore) {
    const pts = ringCoords(line, origin, quant, toScene);
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
      const length = Math.hypot(x1 - x0, y1 - y0);
      if (length < 1e-3) continue;
      // Left of a→b, i.e. into the water.
      const normal: [number, number, number] = [-(y1 - y0) / length, (x1 - x0) / length, 0];
      for (let r = 0; r < colours.length; r++) {
        mesh.wall(x0, y0, x1, y1, rows[r], rows[r + 1], rows[r], rows[r + 1], normal, colours[r]);
      }
    }
  }
  return mesh.build();
}

/** Shoreline length in metres (for coverage reporting and tests). */
export function shoreLength(cell: WaterCell, quant: number): number {
  let total = 0;
  for (const line of cell.shore) {
    for (let i = 0; i + 3 < line.length; i += 2) total += Math.hypot(line[i + 2] - line[i], line[i + 3] - line[i + 1]) * quant;
  }
  return total;
}
