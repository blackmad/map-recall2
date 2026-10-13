// A small top-down map of the same data around the rider: water, parks,
// streets by class, the route and the rider, heading-up. Canvas 2D; the
// overview's lines and polygons are bucketed once into 250 m cells so a frame
// draws only what is within reach. No names: the HUD must never show the
// street under question (CLAUDE.md), and a minimap has no room for earned
// labels anyway.
//
// (The game's current bottom-left map, cityOverview.ts, is already our own
// canvas and fixed to the whole city; this is the local, rotating companion
// the brief asks for, drawn from the overview extract instead of the track.)

import type { Vec2 } from './frame';
import type { OverviewData, StreetClass } from './overviewFormat';
import { STREET_STYLE, PALETTE } from './style';

const CELL = 250;
type Bucketed<T> = Map<string, T[]>;

function bucket<T>(items: readonly T[], box: (t: T) => [number, number, number, number]): Bucketed<T> {
  const out: Bucketed<T> = new Map();
  for (const it of items) {
    const [x0, y0, x1, y1] = box(it);
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++)
      for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) {
        const k = `${cx},${cy}`; const l = out.get(k); if (l) l.push(it); else out.set(k, [it]);
      }
  }
  return out;
}
const boxOfPts = (pts: readonly Vec2[]): [number, number, number, number] => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
};

/** Minimap pixel widths per class at its fixed scale. */
const MINI_WIDTH: Record<StreetClass, number> = { major: 3.2, secondary: 2.6, tertiary: 2, minor: 1.4, service: 0.8, cycle: 0.8, path: 0.6 };

export class Minimap {
  private streets: Bucketed<{ cls: StreetClass; points: Vec2[] }>;
  private water: Bucketed<Vec2[][]>;
  private parks: Bucketed<Vec2[][]>;
  constructor(data: OverviewData, readonly radiusM = 450) {
    this.streets = bucket(data.streets, s => boxOfPts(s.points));
    this.water = bucket(data.water, p => boxOfPts(p[0]));
    this.parks = bucket(data.parks.flatMap(p => p.rings.map(r => [r])), p => boxOfPts(p[0]));
  }

  private gather<T>(b: Bucketed<T>, cx: number, cy: number, r: number): Set<T> {
    const out = new Set<T>();
    for (let x = Math.floor((cx - r) / CELL); x <= Math.floor((cx + r) / CELL); x++)
      for (let y = Math.floor((cy - r) / CELL); y <= Math.floor((cy + r) / CELL); y++) for (const it of b.get(`${x},${y}`) ?? []) out.add(it);
    return out;
  }

  /** Draw into `ctx` (CSS px, caller's DPR transform). `headingDeg` clockwise from north. Returns items drawn. */
  draw(ctx: CanvasRenderingContext2D, size: number, rider: Vec2, headingDeg: number, route: readonly Vec2[] | null): number {
    const scale = size / 2 / this.radiusM;
    const r = this.radiusM * 1.45;
    ctx.save();
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = PALETTE.land; ctx.fillRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    ctx.rotate(-headingDeg * Math.PI / 180);
    ctx.scale(scale, -scale);
    ctx.translate(-rider[0], -rider[1]);
    let n = 0;
    const fillPolys = (polys: Set<Vec2[][]>, colour: string) => {
      ctx.fillStyle = colour; ctx.beginPath();
      for (const poly of polys) { for (const ring of poly) { ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); } n++; }
      ctx.fill('evenodd');
    };
    fillPolys(this.gather(this.parks, rider[0], rider[1], r), PALETTE.park);
    fillPolys(this.gather(this.water, rider[0], rider[1], r), PALETTE.water);
    const streets = [...this.gather(this.streets, rider[0], rider[1], r)].sort((a, b) => STREET_STYLE[a.cls].order - STREET_STYLE[b.cls].order);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pass of ['casing', 'fill'] as const) {
      let current = '';
      for (const s of streets) {
        const st = STREET_STYLE[s.cls];
        const colour = pass === 'casing' ? st.casing : st.fill;
        if (!colour) continue;
        const key = `${colour}|${s.cls}`;
        if (key !== current) {
          if (current) ctx.stroke();
          current = key; ctx.strokeStyle = colour; ctx.lineWidth = (MINI_WIDTH[s.cls] + (pass === 'casing' ? 1.2 : 0)) / scale; ctx.beginPath();
        }
        s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        n++;
      }
      if (current) ctx.stroke();
    }
    if (route && route.length > 1) {
      ctx.strokeStyle = PALETTE.routeCasing; ctx.lineWidth = 5 / scale; ctx.beginPath();
      route.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.strokeStyle = PALETTE.route; ctx.lineWidth = 3 / scale; ctx.stroke();
    }
    ctx.restore();
    // Rider: always centre, pointing up (heading-up map).
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.fillStyle = '#0f172a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6.5, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6.5, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(15,23,42,.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 0.75, 0, Math.PI * 2); ctx.stroke();
    return n;
  }
}
