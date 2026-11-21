/**
 * Belt review: does the facade run past the BAG pand span? A window-column check on a rectified crop with side margins.
 * Pure: unit-tested in candidates.test.ts.
 *
 * Window columns are found in the storey band (rows 20-80 % of the height above the ground line): per pixel column, the share
 * of rows that differ strongly from their row's median (glass, frames and reveals against brick or plaster), smoothed over
 * 0.2 m; runs above the midpoint between the 20th and 90th percentile and at least 0.35 m wide are columns.
 * The facade is taken to extend past a span edge when
 *  - a window column straddles the edge (at least 0.15 m of it on each side): the BAG line cuts through a window; or
 *  - the nearest column outside the edge, within the margin, continues the spacing of the columns inside (within 25 %).
 * A neighbour's windows can also line up with the spacing, so this is a flag for the reviewer, not a measurement.
 */

export type Column = { x0: number; x1: number; c: number };

export function windowColumns(gray: Uint8Array, width: number, height: number, ppm: number, groundPx = height): Column[] {
  const y0 = Math.round(groundPx * 0.2), y1 = Math.round(groundPx * 0.8);
  if (y1 - y0 < 4 || width < 4) return [];
  const frac = new Float64Array(width);
  const row = new Uint8Array(width);
  let rows = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = 0; x < width; x++) row[x] = gray[y * width + x];
    const med = [...row].sort((a, b) => a - b)[width >> 1];
    for (let x = 0; x < width; x++) if (Math.abs(row[x] - med) > 35) frac[x]++;
    rows++;
  }
  const r = Math.max(1, Math.round(0.1 * ppm)), sm = new Float64Array(width);
  for (let x = 0; x < width; x++) { let s = 0, n = 0; for (let k = Math.max(0, x - r); k <= Math.min(width - 1, x + r); k++) { s += frac[k]; n++; } sm[x] = s / n / rows; }
  const sorted = [...sm].sort((a, b) => a - b), t = (sorted[Math.floor(width * 0.2)] + sorted[Math.floor(width * 0.9)]) / 2;
  if (sorted[Math.floor(width * 0.9)] - sorted[Math.floor(width * 0.2)] < 0.08) return [];
  const out: Column[] = [];
  for (let x = 0; x < width;) {
    if (sm[x] <= t) { x++; continue; }
    let e = x; while (e < width && sm[e] > t) e++;
    if (e - x >= 0.35 * ppm) out.push({ x0: x, x1: e, c: (x + e) / 2 });
    x = e;
  }
  return out;
}

export function facadeExtension(cols: Column[], span: [number, number], ppm: number, marginM: number): { columnsInSpan: number; extendsLeft: boolean; extendsRight: boolean; why: string } {
  const inside = cols.filter(c => c.c >= span[0] && c.c < span[1]);
  const gaps = inside.slice(1).map((c, i) => c.c - inside[i].c).sort((a, b) => a - b);
  const pitch = gaps.length ? gaps[gaps.length >> 1] : null;
  const edge = 0.15 * ppm, why: string[] = [];
  const side = (left: boolean): boolean => {
    const e = left ? span[0] : span[1];
    const straddle = cols.find(c => c.x0 <= e - edge && c.x1 >= e + edge);
    if (straddle) { why.push(`${left ? 'left' : 'right'} edge cuts a window column`); return true; }
    const outside = cols.filter(c => (left ? c.c < span[0] : c.c >= span[1]) && Math.abs(c.c - e) <= marginM * ppm);
    const near = left ? outside[outside.length - 1] : outside[0];
    const last = left ? inside[0] : inside[inside.length - 1];
    if (near && last && pitch && Math.abs(Math.abs(last.c - near.c) - pitch) <= 0.25 * pitch) { why.push(`${left ? 'left' : 'right'}: a column ${((Math.abs(near.c - e)) / ppm).toFixed(1)} m outside continues the ${(pitch / ppm).toFixed(1)} m spacing`); return true; }
    return false;
  };
  const extendsLeft = side(true), extendsRight = side(false);
  return { columnsInSpan: inside.length, extendsLeft, extendsRight, why: why.join('; ') || `${inside.length} columns inside, none cut or continued past the span` };
}
