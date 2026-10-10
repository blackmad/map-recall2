// Usage: node scripts/landmarks/big-brick.mjs <rect.jpg> <ppm> <t0> <colPitchM> <firstColT> <nCols> <row0Y> <rowPitchM> <nRows> <imgHeightM>
// Prints mean brick luminance (0-255) in the pier between windows for each (row, column) of a rectified elevation, to read the dark/light brick steps.
import sharp from 'sharp';
const [file, ppm, t0, pitch, firstT, nCols, row0, rowPitch, nRows, hM] = process.argv.slice(2);
const {data, info} = await sharp(file).raw().toBuffer({resolveWithObject: true});
const lum = (x, y) => { if (x < 0 || y < 0 || x >= info.width || y >= info.height) return NaN; const i = (y * info.width + x) * info.channels; return 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]; };
for (let r = +nRows - 1; r >= 0; r--) {
  const y = +row0 + r * +rowPitch, py = Math.round(info.height - y * +ppm);
  const row = [];
  for (let c = 0; c <= +nCols; c++) {
    const t = +firstT + (c - 0.5) * +pitch, px = Math.round((t - +t0) * +ppm);
    let s = 0, n = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) { const v = lum(px + dx, py + dy); if (!Number.isNaN(v)) { s += v; n++; } }
    row.push(n ? Math.round(s / n) : '--');
  }
  console.log(`y ${y.toFixed(1)}`.padEnd(8), row.join(' ').padEnd(40));
}
