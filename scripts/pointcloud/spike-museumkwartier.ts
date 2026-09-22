/**
 * Museumkwartier point-cloud façade spike.
 *
 * Measures, for every exterior 3DBAG wall in one 50 x 50 m municipal MLS tile,
 * whether the point cloud resolves a shaped roofline (a gable 3DBAG does not
 * carry) and where the openings and protrusions are. Writes an SVG elevation
 * per well-scanned wall plus a plan view, and a summary JSON.
 *
 * Usage:
 *   npx tsx scripts/pointcloud/spike-museumkwartier.ts [--tile=<path>] [--top=6]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FacadeWallPlane, RoofPlane } from '../../src/canalRecall/building/facadePointCloud.ts';
import { compileFacade, type FacadeMesh } from '../../src/canalRecall/facade/facadeMeshCompiler.ts';
import {
  CELL_SIZE,
  GABLE_MARGIN,
  MINIMUM_POINTS_PER_CELL,
  UPWARD_SEARCH,
  isWellScanned,
  measureTile,
  median,
  type WallMeasurement,
} from './measure-tile.ts';
import { buildSceneObj } from './scene-obj.ts';
import { renderFacadeImage } from './facade-image.ts';

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const tilePath = path.resolve(argument('tile') || '.cache/pointcloud/filtered_2397_9705.laz');
const topCount = Number(argument('top') || 6);
const outputDir = path.resolve(argument('out') || '.cache/pointcloud/spike');

const writeDiagnosticSvg = (measurement: WallMeasurement, mesh: FacadeMesh, scale = 46) => {
  const { raster, measured } = measurement;
  const bottom = raster.frame.minUp - 0.3;
  const top = raster.frame.maxUp + UPWARD_SEARCH;
  const width = raster.frame.maxAlong - raster.frame.minAlong;
  const px = (along: number) => ((along - raster.frame.minAlong) * scale).toFixed(1);
  const py = (up: number) => ((top - up) * scale).toFixed(1);
  const outline = (rect: { along: number; up: number; width: number; height: number }, stroke: string, dash: string) =>
    `<rect x="${px(rect.along)}" y="${py(rect.up + rect.height)}" width="${(rect.width * scale).toFixed(1)}" height="${(rect.height * scale).toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="1.5"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${(width * scale).toFixed(0)}" height="${((top - bottom) * scale).toFixed(0)}" viewBox="0 0 ${(width * scale).toFixed(0)} ${((top - bottom) * scale).toFixed(0)}">`,
    `<rect width="100%" height="100%" fill="#101418"/>`,
  ];
  for (const cell of raster.cells) {
    if (cell.count < MINIMUM_POINTS_PER_CELL) continue;
    const along = (cell.column + 0.5) * raster.cellSize + raster.frame.minAlong;
    const up = (cell.row + 0.5) * raster.cellSize + raster.bottomUp;
    parts.push(`<rect x="${px(along)}" y="${py(up + CELL_SIZE)}" width="${(CELL_SIZE * scale).toFixed(1)}" height="${(CELL_SIZE * scale).toFixed(1)}" fill="${depthColour(cell.meanDepth)}"/>`);
  }
  for (const rect of mesh.protrusions) parts.push(outline(rect, '#ffb347', ''));
  for (const rect of mesh.openings) parts.push(outline(rect, '#33e0ff', ''));
  parts.push(`<rect x="0" y="${py(raster.frame.maxUp)}" width="${(width * scale).toFixed(0)}" height="${((raster.frame.maxUp - bottom) * scale).toFixed(0)}" fill="none" stroke="#4da3ff" stroke-width="1.5" stroke-dasharray="6 4"/>`);
  if (measured.simplified.length >= 2) {
    parts.push(`<polyline points="${measured.simplified.map(([along, up]) => `${px(along)},${py(up)}`).join(' ')}" fill="none" stroke="#ffd166" stroke-width="2"/>`);
  }
  parts.push(`<text x="8" y="18" fill="#e8e8e8" font-family="monospace" font-size="12">${measurement.surfaceId}</text>`);
  parts.push(`<text x="8" y="34" fill="#e8e8e8" font-family="monospace" font-size="12">cyan = detected opening · orange = protrusion · yellow = roofline · dashed = 3DBAG wall top</text>`);
  parts.push('</svg>');
  return parts.join('\n');
};

const writeCompiledSvg = (measurement: WallMeasurement, mesh: FacadeMesh, scale = 46) => {
  const width = mesh.width;
  const top = mesh.wallTop + Math.max(mesh.gableRise, 1) + 0.5;
  const bottom = mesh.baseUp - 0.3;
  const px = (along: number) => ((along - measurement.raster.frame.minAlong) * scale).toFixed(1);
  const py = (up: number) => ((top - up) * scale).toFixed(1);
  const rect = (x: number, y: number, w: number, h: number, fill: string, stroke = 'none') =>
    `<rect x="${px(x)}" y="${py(y + h)}" width="${(w * scale).toFixed(1)}" height="${(h * scale).toFixed(1)}" fill="${fill}"${stroke === 'none' ? '' : ` stroke="${stroke}" stroke-width="1"`}/>`;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${(width * scale).toFixed(0)}" height="${((top - bottom) * scale).toFixed(0)}" viewBox="0 0 ${(width * scale).toFixed(0)} ${((top - bottom) * scale).toFixed(0)}">`,
    `<rect width="100%" height="100%" fill="#101418"/>`,
  ];
  for (const panel of mesh.panels) parts.push(rect(panel.along, panel.up, panel.width, panel.height, '#d7d0c7', '#3b4550'));
  for (const opening of mesh.openings) parts.push(rect(opening.along, opening.up, opening.width, opening.height, '#1d2b3a', '#4da3ff'));
  for (const protrusion of mesh.protrusions) parts.push(rect(protrusion.along, protrusion.up, protrusion.width, protrusion.height, '#b5651d', '#ffb347'));
  if (mesh.gable) {
    const polygon = mesh.gable.map(([along, up]) => `${px(along)},${py(up)}`).join(' ');
    parts.push(`<polygon points="${polygon}" fill="#d7d0c7" stroke="#ffd166" stroke-width="2"/>`);
  }
  parts.push(`<text x="8" y="18" fill="#e8e8e8" font-family="monospace" font-size="12">${measurement.buildingId} ${measurement.surfaceId}</text>`);
  parts.push(`<text x="8" y="34" fill="#e8e8e8" font-family="monospace" font-size="12">compiled: ${mesh.panels.length} panels · ${mesh.openings.length} openings · ${mesh.protrusions.length} protrusions · gable ${mesh.gableRise.toFixed(2)} m</text>`);
  parts.push('</svg>');
  return parts.join('\n');
};

const writeObj = (measurement: WallMeasurement, mesh: FacadeMesh) => {
  const { frame } = measurement.raster;
  const along0 = frame.minAlong;
  const up0 = mesh.baseUp;
  const lines = ['# measured facade mesh in the wall metric frame: x=along, y=up (NAP), z=outward'];
  const vertices: string[] = [];
  const add = (along: number, up: number, depth: number) => {
    vertices.push(`v ${(along - along0).toFixed(4)} ${(up - up0).toFixed(4)} ${depth.toFixed(4)}`);
    return vertices.length;
  };
  const faces: string[] = [];
  for (const panel of mesh.panels) {
    const x0 = panel.along - along0; const x1 = x0 + panel.width; const y0 = panel.up; const y1 = y0 + panel.height;
    const p = [add(x0, y0, 0), add(x1, y0, 0), add(x1, y1, 0), add(x0, y1, 0)];
    faces.push(`f ${p[0]} ${p[1]} ${p[2]} ${p[3]}`);
  }
  for (const opening of mesh.openings) {
    const x0 = opening.along - along0; const x1 = x0 + opening.width; const y0 = opening.up; const y1 = y0 + opening.height;
    const d = -0.15;
    const bl = add(x0, y0, d); const br = add(x1, y0, d); const tr = add(x1, y1, d); const tl = add(x0, y1, d);
    const bl0 = add(x0, y0, 0); const br0 = add(x1, y0, 0); const tr0 = add(x1, y1, 0); const tl0 = add(x0, y1, 0);
    faces.push(`f ${bl} ${br} ${tr} ${tl}`);
    faces.push(`f ${bl0} ${bl} ${tl} ${tl0}`);
    faces.push(`f ${br0} ${tr0} ${tr} ${br}`);
    faces.push(`f ${bl0} ${br0} ${br} ${bl}`);
    faces.push(`f ${tl0} ${tl} ${tr} ${tr0}`);
  }
  if (mesh.gable) {
    const indices = mesh.gable.map(([along, up]) => add(along - along0, up, 0));
    faces.push(`f ${indices.join(' ')}`);
  }
  return [...lines, ...vertices, ...faces].join('\n') + '\n';
};

const depthColour = (depth: number) => {
  const clamped = Math.max(-0.3, Math.min(0.3, depth));
  if (clamped < 0) {
    const t = -clamped / 0.3;
    return `rgb(${Math.round(120 - 60 * t)},${Math.round(150 - 40 * t)},${Math.round(200 + 40 * t)})`;
  }
  const t = clamped / 0.3;
  return `rgb(${Math.round(190 + 50 * t)},${Math.round(120 - 40 * t)},${Math.round(90 - 40 * t)})`;
};

const writeElevationSvg = (measurement: WallMeasurement, scale = 46) => {
  const { raster, measured } = measurement;
  const originNAP = raster.frame.origin[2];
  const bottom = raster.frame.minUp - 0.3;
  const top = raster.frame.maxUp + UPWARD_SEARCH;
  const width = raster.frame.maxAlong - raster.frame.minAlong;
  const px = (along: number) => ((along - raster.frame.minAlong) * scale).toFixed(1);
  const py = (up: number) => ((top - up) * scale).toFixed(1);
  const napLine = (nap: number, colour: string, label: string) => {
    const up = nap - originNAP;
    if (up < bottom || up > top) return '';
    return `<line x1="0" y1="${py(up)}" x2="${(width * scale).toFixed(0)}" y2="${py(up)}" stroke="${colour}" stroke-width="1.5"/><text x="${(width * scale - 6).toFixed(0)}" y="${(Number(py(up)) - 4).toFixed(0)}" text-anchor="end" fill="${colour}" font-family="monospace" font-size="11">${label}</text>`;
  };
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${(width * scale).toFixed(0)}" height="${((top - bottom) * scale).toFixed(0)}" viewBox="0 0 ${(width * scale).toFixed(0)} ${((top - bottom) * scale).toFixed(0)}">`,
    `<rect width="100%" height="100%" fill="#101418"/>`,
  ];
  for (const cell of raster.cells) {
    if (cell.count < MINIMUM_POINTS_PER_CELL) continue;
    const along = (cell.column + 0.5) * raster.cellSize + raster.frame.minAlong;
    const up = (cell.row + 0.5) * raster.cellSize + raster.bottomUp;
    parts.push(`<rect x="${px(along)}" y="${py(up + CELL_SIZE)}" width="${(CELL_SIZE * scale).toFixed(1)}" height="${(CELL_SIZE * scale).toFixed(1)}" fill="${depthColour(cell.meanDepth)}"/>`);
  }
  parts.push(`<rect x="0" y="${py(raster.frame.maxUp)}" width="${(width * scale).toFixed(0)}" height="${((raster.frame.maxUp - bottom) * scale).toFixed(0)}" fill="none" stroke="#4da3ff" stroke-width="1.5" stroke-dasharray="6 4"/>`);
  if (measurement.declaredRoofNAP != null) parts.push(napLine(measurement.declaredRoofNAP, '#9be564', `3DBAG roof p50 ${measurement.declaredRoofNAP.toFixed(2)}`));
  if (measurement.declaredRoofMaxNAP != null) parts.push(napLine(measurement.declaredRoofMaxNAP, '#f4978e', `3DBAG roof max ${measurement.declaredRoofMaxNAP.toFixed(2)}`));
  if (measured.simplified.length >= 2) {
    const polyline = measured.simplified.map(([along, up]) => `${px(along)},${py(up)}`).join(' ');
    parts.push(`<polyline points="${polyline}" fill="none" stroke="#ffd166" stroke-width="2"/>`);
  }
  parts.push(`<text x="8" y="18" fill="#e8e8e8" font-family="monospace" font-size="12">${measurement.buildingId} ${measurement.surfaceId}</text>`);
  parts.push(`<text x="8" y="34" fill="#e8e8e8" font-family="monospace" font-size="12">roofline ${measurement.rooflineNAP.toFixed(2)} NAP · range ${measurement.rooflineRange.toFixed(2)} m · cover ${(measurement.coverage * 100).toFixed(0)}%</text>`);
  parts.push('</svg>');
  return parts.join('\n');
};

const writePlanSvg = (measurements: WallMeasurement[], tileBounds: { minX: number; minY: number; maxX: number; maxY: number }, positions: Float64Array, count: number, scale = 8) => {
  const width = tileBounds.maxX - tileBounds.minX;
  const height = tileBounds.maxY - tileBounds.minY;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${(width * scale).toFixed(0)}" height="${(height * scale).toFixed(0)}" viewBox="0 0 ${(width * scale).toFixed(0)} ${((height) * scale).toFixed(0)}">`,
    `<rect width="100%" height="100%" fill="#101418"/>`,
  ];
  const step = Math.max(1, Math.floor(count / 60_000));
  for (let index = 0; index < count; index += step) {
    const x = positions[index * 3];
    const y = positions[index * 3 + 1];
    const z = positions[index * 3 + 2];
    const t = Math.max(0, Math.min(1, (z + 3) / 20));
    parts.push(`<rect x="${((x - tileBounds.minX) * scale).toFixed(1)}" y="${((tileBounds.maxY - y) * scale).toFixed(1)}" width="1.4" height="1.4" fill="rgb(${Math.round(40 + 180 * t)},${Math.round(90 + 60 * t)},${Math.round(200 - 120 * t)})"/>`);
  }
  for (const measurement of measurements) {
    const frame = measurement.raster.frame;
    const half = measurement.width / 2;
    const x1 = frame.origin[0] - frame.u[0] * half;
    const y1 = frame.origin[1] - frame.u[1] * half;
    const x2 = frame.origin[0] + frame.u[0] * half;
    const y2 = frame.origin[1] + frame.u[1] * half;
    parts.push(`<line x1="${((x1 - tileBounds.minX) * scale).toFixed(1)}" y1="${((tileBounds.maxY - y1) * scale).toFixed(1)}" x2="${((x2 - tileBounds.minX) * scale).toFixed(1)}" y2="${((tileBounds.maxY - y2) * scale).toFixed(1)}" stroke="#ffd166" stroke-width="3"/>`);
  }
  parts.push('</svg>');
  return parts.join('\n');
};

const { tile, buildings, exteriorWalls, eligibleWalls, walls, roofs, measurements, threeDBag } = await measureTile(tilePath);
const scanned = measurements.filter(isWellScanned);
const comparable = scanned.filter((measurement) => measurement.riseAboveDeclaredRoofMax != null);
const gables = comparable.filter((measurement) => (measurement.riseAboveDeclaredRoofMax as number) > GABLE_MARGIN);
const shaped = scanned.filter((measurement) => measurement.shapedRoofline);
const sloped = scanned.filter((measurement) => measurement.rooflineShape === 'sloped');
const flat = scanned.filter((measurement) => measurement.rooflineShape === 'flat');
const compiled = scanned.map((measurement) => compileFacade(measurement.raster, measurement.measured, { minimumPointsPerCell: 3 }));
const withOpenings = compiled.filter((mesh) => mesh.openings.length > 0);

const summary = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  tile: { path: tilePath, sha256: tile.sha256, bytes: tile.bytes, points: tile.count, bounds: tile.bounds },
  source: {
    name: 'Gemeente Amsterdam puntenwolk (UPCP demo tile)',
    licence: 'open data (Gemeente Amsterdam)',
    geometry: '3DBAG LoD2.2 WallSurface and RoofSurface',
    geometryLicence: 'CC BY 4.0 — 3DBAG, TU Delft',
    crs: 'EPSG:7415 / NAP',
  },
  threeDBag,
  buildings,
  exteriorWalls,
  eligibleWalls,
  measuredWalls: measurements.length,
  scannedWalls: scanned.length,
  wallsWithShapedRoofline: shaped.length,
  wallsWithSlopedRoofline: sloped.length,
  wallsWithFlatRoofline: flat.length,
  wallsWithGeometryAboveDeclaredRoofMax: gables.length,
  medianCoverageScanned: median(scanned.map((measurement) => measurement.coverage)),
  medianRooflineRange: median(shaped.map((measurement) => measurement.rooflineRange)),
  medianStoreys: median(withOpenings.map((mesh) => mesh.storeyCount)),
  medianBays: median(withOpenings.map((mesh) => mesh.bayCount)),
  totalOpenings: compiled.reduce((sum, mesh) => sum + mesh.openings.length, 0),
  totalGables: compiled.filter((mesh) => mesh.gable).length,
  coplanarNeighbours: measurements.reduce((sum, measurement) => sum + measurement.coplanarNeighbours.length, 0),
  wallsWithCoplanarNeighbours: measurements.filter((measurement) => measurement.coplanarNeighbours.length > 0).length,
  medianRiseAboveDeclaredRoofMax: median(gables.map((measurement) => measurement.riseAboveDeclaredRoofMax as number)),
  walls: measurements.map(({ raster, measured, ...rest }) => rest),
};

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'museumkwartier-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

const top = [...scanned].sort((a, b) => b.pointCount - a.pointCount).slice(0, topCount);
for (const measurement of top) {
  const name = `${measurement.buildingId.replace(/[^0-9]/g, '')}-${measurement.surfaceId.replace(/[^0-9]/g, '')}`;
  const mesh = compileFacade(measurement.raster, measurement.measured, { minimumPointsPerCell: 3 });
  await writeFile(path.join(outputDir, `elevation-${name}.svg`), writeElevationSvg(measurement));
  await writeFile(path.join(outputDir, `compiled-${name}.svg`), writeCompiledSvg(measurement, mesh));
  await writeFile(path.join(outputDir, `diagnostic-${name}.svg`), writeDiagnosticSvg(measurement, mesh));
  await writeFile(path.join(outputDir, `facade-${name}.png`), renderFacadeImage(measurement).png);
  await writeFile(path.join(outputDir, `facade-${name}.obj`), writeObj(measurement, mesh));
}
await writeFile(path.join(outputDir, 'plan.svg'), writePlanSvg(top, tile.bounds, tile.positions, tile.count));

const scene = buildSceneObj(scanned, roofs, walls);
await writeFile(path.join(outputDir, 'scene.obj'), scene.obj);
await writeFile(path.join(outputDir, 'scene-colours.json'), `${JSON.stringify(scene.colours, null, 2)}\n`);
await writeFile(path.join(outputDir, 'scene-bounds.json'), `${JSON.stringify(tile.bounds, null, 2)}\n`);

process.stdout.write([
  `tile ${tile.count} points over ${(tile.bounds.maxX - tile.bounds.minX).toFixed(0)}x${(tile.bounds.maxY - tile.bounds.minY).toFixed(0)} m`,
  `${buildings} buildings, ${exteriorWalls} exterior walls, ${eligibleWalls} eligible`,
  `${measurements.length} measured, ${scanned.length} well-scanned (coverage + density)`,
  `${shaped.length}/${scanned.length} well-scanned walls have a shaped (non-monotonic) roofline, ${sloped.length} sloped, ${flat.length} flat; median shaped range ${summary.medianRooflineRange.toFixed(2)} m`,
  `of those, ${gables.length}/${comparable.length} rise >${GABLE_MARGIN} m above 3DBAG's own maximum roof height`,
  `compiled ${compiled.length} walls: ${summary.totalOpenings} openings, ${summary.totalGables} gables, median ${summary.medianStoreys} storeys x ${summary.medianBays} bays`,
  `coplanar neighbour walls: ${summary.coplanarNeighbours} across ${summary.wallsWithCoplanarNeighbours} measured walls`,
  `median coverage ${(summary.medianCoverageScanned * 100).toFixed(0)}%`,
  `wrote ${outputDir}`,
].join('\n') + '\n');
