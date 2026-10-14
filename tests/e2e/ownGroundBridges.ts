import { readFileSync } from 'node:fs';

// Bridge centres and axes from the elevation extract, shared by the own-ground bridge specs.
export type Bridge = { id: string; label: string; measured: boolean; lng: number; lat: number; bearing: number; lengthM: number; movable: boolean };

/** Centre and axis of a named bridge from the extract (measured: its stations; fallback: the footprint's long axis). */
export function bridgesFromExtract(ids: string[]): Bridge[] {
  const extract = JSON.parse(readFileSync('public/data/extracts/amsterdam/elevation-v1/bridges.json', 'utf8'));
  const index = JSON.parse(readFileSync('public/data/extracts/amsterdam/elevation-v1/index.json', 'utf8'));
  const [olng, olat] = index.origin, [mx, my] = index.metresPerDegree, q = index.quantization.xy;
  const toLngLat = (x: number, y: number) => [olng + x * q / mx, olat + y * q / my];
  return ids.map(id => {
    const m = extract.measured.find((b: any) => b.id === id);
    if (m) {
      const p = m.p, n = p.length / 4, a = [p[0], p[1]], b = [p[(n - 1) * 4], p[(n - 1) * 4 + 1]];
      // Centre on the deck span's middle station (the profile runs past it onto both approaches).
      const sMid = (m.deck[0] + m.deck[1]) / 2 * 100;
      let mid = 0; for (let i = 0; i < n; i++) if (Math.abs(p[i * 4 + 2] - sMid) < Math.abs(p[mid * 4 + 2] - sMid)) mid = i;
      const [lng, lat] = toLngLat(p[mid * 4], p[mid * 4 + 1]);
      return { id, label: m.name, measured: true, lng, lat, bearing: (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI + 360) % 360, lengthM: m.deck[1] - m.deck[0], movable: false };
    }
    const f = extract.fallback.find((b: any) => b.id === id);
    if (!f) throw new Error(`${id} not in bridges.json`);
    const r = f.ring as number[], pts: number[][] = [];
    for (let i = 0; i < r.length; i += 2) pts.push([r[i], r[i + 1]]);
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    // Long axis of the footprint (second moments).
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of pts) { sxx += (x - cx) ** 2; syy += (y - cy) ** 2; sxy += (x - cx) * (y - cy); }
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(theta), uy = Math.sin(theta);
    let lo = Infinity, hi = -Infinity;
    for (const [x, y] of pts) { const t = (x - cx) * ux + (y - cy) * uy; lo = Math.min(lo, t); hi = Math.max(hi, t); }
    const [lng, lat] = toLngLat(cx, cy);
    return { id, label: f.name, measured: false, lng, lat, bearing: (Math.atan2(ux, uy) * 180 / Math.PI + 360) % 360, lengthM: (hi - lo) * q, movable: f.type === 'Beweegbare brug' };
  });
}
