import type { FacadeWallPlane, RoofPlane } from '../../src/canalRecall/building/facadePointCloud.ts';
import { compileFacade } from '../../src/canalRecall/facade/facadeMeshCompiler.ts';
import type { WallMeasurement } from './measure-tile.ts';

export interface SceneColours {
  [group: string]: string;
}

export interface SceneObj {
  obj: string;
  colours: SceneColours;
  groups: { measured: number; massing: number; roofs: number };
}

const groupName = (surfaceId: string) => surfaceId.replace(/[^A-Za-z0-9]+/g, '_');

/** Median wall colour from the cloud's own RGB, over cells near the wall plane. */
export const wallColour = (measurement: WallMeasurement): string | null => {
  const planes = measurement.raster.cells.filter((cell) => cell.count >= 3 && Math.abs(cell.meanDepth) <= 0.12 && cell.rgb);
  if (!planes.length) return null;
  const channel = (index: number) => {
    const values = planes.map((cell) => cell.rgb![index]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  const rgb = [channel(0), channel(1), channel(2)];
  return `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
};

/**
 * Build one OBJ of the measured facades in true RD/NAP, every other exterior
 * wall as grey massing, and the measured buildings' 3DBAG roofs. Groups are
 * named by surface id so a viewer can colour each from `colours`.
 */
export const buildSceneObj = (
  measurements: readonly WallMeasurement[],
  roofs: readonly RoofPlane[],
  walls: readonly FacadeWallPlane[],
): SceneObj => {
  const lines = ['# measured facades, massing and 3DBAG roofs in RD/NAP (EPSG:7415)'];
  const colours: SceneColours = {};
  let vertexCount = 0;
  let measuredGroups = 0;

  const vertex = (x: number, y: number, z: number) => {
    lines.push(`v ${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);
    vertexCount += 1;
    return vertexCount;
  };

  for (const measurement of measurements) {
    const { frame } = measurement.raster;
    const mesh = compileFacade(measurement.raster, measurement.measured, { minimumPointsPerCell: 3 });
    const world = (along: number, up: number, depth: number) => [
      frame.origin[0] + frame.u[0] * along + frame.v[0] * up + frame.n[0] * depth,
      frame.origin[1] + frame.u[1] * along + frame.v[1] * up + frame.n[1] * depth,
      frame.origin[2] + frame.u[2] * along + frame.v[2] * up + frame.n[2] * depth,
    ];
    const name = groupName(measurement.surfaceId);
    lines.push(`g ${name}`);
    measuredGroups += 1;
    const faces: string[] = [];
    const add = (along: number, up: number, depth: number) => vertex(...world(along, up, depth));
    for (const panel of mesh.panels) {
      const p = [add(panel.along, panel.up, 0), add(panel.along + panel.width, panel.up, 0), add(panel.along + panel.width, panel.up + panel.height, 0), add(panel.along, panel.up + panel.height, 0)];
      faces.push(`f ${p[0]} ${p[1]} ${p[2]} ${p[3]}`);
    }
    if (mesh.gable) {
      const indices = mesh.gable.map(([along, up]) => add(along, up, 0));
      faces.push(`f ${indices.join(' ')}`);
    }
    lines.push(...faces);
    const colour = wallColour(measurement);
    if (colour) colours[name] = colour;

    // Openings get their own group so a viewer can read them as glazing.
    const openingName = `${name}__openings`;
    lines.push(`g ${openingName}`);
    const openingFaces: string[] = [];
    for (const opening of mesh.openings) {
      const x0 = opening.along; const x1 = x0 + opening.width; const y0 = opening.up; const y1 = y0 + opening.height; const d = -0.2;
      const bl = add(x0, y0, d); const br = add(x1, y0, d); const tr = add(x1, y1, d); const tl = add(x0, y1, d);
      const bl0 = add(x0, y0, 0); const br0 = add(x1, y0, 0); const tr0 = add(x1, y1, 0); const tl0 = add(x0, y1, 0);
      openingFaces.push(`f ${bl} ${br} ${tr} ${tl}`);
      openingFaces.push(`f ${bl0} ${bl} ${tl} ${tl0}`);
      openingFaces.push(`f ${br0} ${tr0} ${tr} ${br}`);
      openingFaces.push(`f ${bl0} ${br0} ${br} ${bl}`);
      openingFaces.push(`f ${tl0} ${tl} ${tr} ${tr0}`);
    }
    lines.push(...openingFaces);
    colours[openingName] = '#22303f';

    // The measured roofline as a thin strip so the gable reads at a glance.
    const rooflineName = `${name}__roofline`;
    lines.push(`g ${rooflineName}`);
    const rooflineFaces: string[] = [];
    const profile = measurement.measured.simplified;
    const thickness = 0.12;
    for (let index = 1; index < profile.length; index += 1) {
      const [a0, a1] = [profile[index - 1], profile[index]];
      const p = [
        add(a0[0], a0[1] - thickness, 0.03),
        add(a1[0], a1[1] - thickness, 0.03),
        add(a1[0], a1[1] + thickness, 0.03),
        add(a0[0], a0[1] + thickness, 0.03),
      ];
      rooflineFaces.push(`f ${p[0]} ${p[1]} ${p[2]} ${p[3]}`);
    }
    lines.push(...rooflineFaces);
    colours[rooflineName] = '#ffd166';
  }

  const measuredBuildings = new Set(measurements.map((measurement) => measurement.buildingId));
  lines.push('g 3dbag_roofs');
  let roofGroups = 0;
  const roofFaces: string[] = [];
  for (const roof of roofs) {
    if (roof.vertices.length < 3 || !measuredBuildings.has(roof.buildingId)) continue;
    roofGroups += 1;
    roofFaces.push(`f ${roof.vertices.map((point) => vertex(point[0], point[1], point[2])).join(' ')}`);
  }
  lines.push(...roofFaces);
  colours['3dbag_roofs'] = '#8a4b3a';

  lines.push('g massing');
  const measuredSurfaces = new Set(measurements.map((measurement) => measurement.surfaceId));
  let massingGroups = 0;
  const massingFaces: string[] = [];
  for (const wall of walls) {
    if (wall.vertices.length < 3 || measuredSurfaces.has(wall.surfaceId)) continue;
    massingGroups += 1;
    massingFaces.push(`f ${wall.vertices.map((point) => vertex(point[0], point[1], point[2])).join(' ')}`);
  }
  lines.push(...massingFaces);
  colours['massing'] = '#3a434f';

  return { obj: lines.join('\n') + '\n', colours, groups: { measured: measuredGroups, massing: massingGroups, roofs: roofGroups } };
};
