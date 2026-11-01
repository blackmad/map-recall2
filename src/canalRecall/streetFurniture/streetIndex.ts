/** Nearest street centreline for a point (street-furniture orientation prior). Pure; metres in a local frame. */
export type StreetLine = { highway?: string; path?: [number, number][]; paths?: [number, number][][] };
export type NearestStreet = { distanceM: number; highway: string; axisDeg: number; towardDeg: number };

/** Ways furniture stands beside (no motorways, rail or steps; footways and cycleways count: parks have lamps). */
export const ORIENTING_HIGHWAYS: ReadonlySet<string> = new Set([
  'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential',
  'living_street', 'pedestrian', 'service', 'cycleway', 'footway', 'path', 'track', 'busway',
]);

/** Streets a car drives: what sets a lamp's height and a container's kerb. */
export const CARRIAGEWAY_HIGHWAYS: ReadonlySet<string> = new Set([
  'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service', 'busway',
]);

const LAT0 = 52.37, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 110540, CELL = 50;

export class StreetIndex {
  private readonly segs: Float64Array;
  private readonly cls: string[] = [];
  private readonly grid = new Map<string, number[]>();
  constructor(lines: readonly StreetLine[], keep: ReadonlySet<string> = ORIENTING_HIGHWAYS) {
    const flat: number[] = [];
    for (const l of lines) {
      if (!l.highway || !keep.has(l.highway)) continue;
      for (const path of l.paths ?? (l.path ? [l.path] : [])) for (let i = 1; i < path.length; i++) {
        const [a, b] = [path[i - 1], path[i]];
        const ax = (a[1] - 4.9) * KX, ay = (a[0] - LAT0) * KY, bx = (b[1] - 4.9) * KX, by = (b[0] - LAT0) * KY;
        const s = flat.length / 4; flat.push(ax, ay, bx, by); this.cls.push(l.highway);
        const x0 = Math.floor(Math.min(ax, bx) / CELL), x1 = Math.floor(Math.max(ax, bx) / CELL), y0 = Math.floor(Math.min(ay, by) / CELL), y1 = Math.floor(Math.max(ay, by) / CELL);
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = `${x},${y}`; (this.grid.get(k) ?? this.grid.set(k, []).get(k)!).push(s); }
      }
    }
    this.segs = Float64Array.from(flat);
  }
  nearest(lng: number, lat: number, reachM: number): NearestStreet | null {
    const px = (lng - 4.9) * KX, py = (lat - LAT0) * KY, r = Math.ceil(reachM / CELL);
    const gx = Math.floor(px / CELL), gy = Math.floor(py / CELL);
    let best = Infinity, bi = -1, bqx = 0, bqy = 0;
    const seen = new Set<number>();
    for (let x = gx - r; x <= gx + r; x++) for (let y = gy - r; y <= gy + r; y++) for (const s of this.grid.get(`${x},${y}`) ?? []) {
      if (seen.has(s)) continue; seen.add(s);
      const ax = this.segs[s * 4], ay = this.segs[s * 4 + 1], dx = this.segs[s * 4 + 2] - ax, dy = this.segs[s * 4 + 3] - ay, l2 = dx * dx + dy * dy;
      const u = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0, qx = ax + u * dx, qy = ay + u * dy, d = Math.hypot(px - qx, py - qy);
      if (d < best) { best = d; bi = s; bqx = qx; bqy = qy; }
    }
    if (bi < 0 || best > reachM) return null;
    const dx = this.segs[bi * 4 + 2] - this.segs[bi * 4], dy = this.segs[bi * 4 + 3] - this.segs[bi * 4 + 1];
    const axis = ((Math.atan2(dx, dy) * 180 / Math.PI) % 180 + 180) % 180;
    const toward = best > 1e-6 ? ((Math.atan2(bqx - px, bqy - py) * 180 / Math.PI) + 360) % 360 : (axis + 90) % 360;
    return { distanceM: best, highway: this.cls[bi], axisDeg: axis, towardDeg: toward };
  }
}
