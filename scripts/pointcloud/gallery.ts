import { compileFacade } from '../../src/canalRecall/facade/facadeMeshCompiler.ts';
import { MINIMUM_POINTS_PER_CELL } from './measure-tile.ts';
import type { WallMeasurement } from './measure-tile.ts';

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A contact sheet of measured façades: one cell per wall, drawn to its own
 * scale, with the detected openings, the gable polygon and the measured
 * roofline. The quickest way to see how many rooflines the cloud resolved.
 */
export const buildGallerySvg = (
  measurements: readonly WallMeasurement[],
  options: { columns?: number; cellWidth?: number; cellHeight?: number; title?: string } = {},
): string => {
  const columns = options.columns ?? 8;
  const cellWidth = options.cellWidth ?? 150;
  const cellHeight = options.cellHeight ?? 200;
  const rows = Math.max(1, Math.ceil(measurements.length / columns));
  const header = 34;
  const width = columns * cellWidth;
  const height = header + rows * cellHeight;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#0b0f14"/>`,
    `<text x="12" y="22" fill="#e8edf2" font-family="monospace" font-size="14">${escape(options.title ?? 'measured façades')} — ${measurements.length} walls, drawn to scale</text>`,
  ];
  measurements.forEach((measurement, index) => {
    const mesh = compileFacade(measurement.raster, measurement.measured, { minimumPointsPerCell: MINIMUM_POINTS_PER_CELL });
    const cellX = (index % columns) * cellWidth;
    const cellY = header + Math.floor(index / columns) * cellHeight;
    const spanX = Math.max(0.1, mesh.width);
    const spanY = Math.max(0.1, mesh.height + Math.max(mesh.gableRise, 0.5));
    const scale = Math.min((cellWidth - 18) / spanX, (cellHeight - 44) / spanY);
    const drawWidth = spanX * scale;
    const drawHeight = spanY * scale;
    const originX = cellX + (cellWidth - drawWidth) / 2;
    const originY = cellY + 22 + (cellHeight - 44 - drawHeight) / 2;
    const toX = (along: number) => (originX + (along - measurement.raster.frame.minAlong) * scale).toFixed(1);
    const toY = (up: number) => (originY + drawHeight - (up - mesh.baseUp) * scale).toFixed(1);
    parts.push(`<rect x="${cellX + 3}" y="${cellY + 3}" width="${cellWidth - 6}" height="${cellHeight - 6}" fill="none" stroke="#1c2530"/>`);
    for (const panel of mesh.panels) {
      parts.push(`<rect x="${toX(panel.along)}" y="${toY(panel.up + panel.height)}" width="${(panel.width * scale).toFixed(1)}" height="${(panel.height * scale).toFixed(1)}" fill="#d7d0c7"/>`);
    }
    for (const opening of mesh.openings) {
      parts.push(`<rect x="${toX(opening.along)}" y="${toY(opening.up + opening.height)}" width="${(opening.width * scale).toFixed(1)}" height="${(opening.height * scale).toFixed(1)}" fill="#1d2b3a" stroke="#4da3ff" stroke-width="0.6"/>`);
    }
    if (mesh.gable) {
      parts.push(`<polygon points="${mesh.gable.map(([along, up]) => `${toX(along)},${toY(up)}`).join(' ')}" fill="#d7d0c7" stroke="#ffd166" stroke-width="1.2"/>`);
    }
    parts.push(`<polyline points="${measurement.measured.simplified.map(([along, up]) => `${toX(along)},${toY(up)}`).join(' ')}" fill="none" stroke="#ffd166" stroke-width="1.4"/>`);
    parts.push(`<text x="${cellX + 7}" y="${cellY + 16}" fill="#93a1b1" font-family="monospace" font-size="9">${escape(measurement.buildingId.replace('bag:', '').slice(-6))} ${measurement.rooflineShape} ${measurement.rooflineRange.toFixed(1)}m</text>`);
  });
  parts.push('</svg>');
  return parts.join('\n');
};
