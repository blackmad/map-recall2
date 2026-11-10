// Rail class probe (lane rails-class 2026-11-10): city-wide, per built cell with railway tracks, three defect classes at
// the rail/road/ground joins (user feedback 2026-11-09, Westpoort and Sloterdijk). Junction seams: probe-road-seams.ts.
//
//   npx tsx scripts/own-ground/probe-rails-class.ts [--lod=0|1] [--roads=0] [--cells=a,b] [--at=lng,lat,halfM] [--json=out.json]
//
//   crossing  rail-in-road: samples every 2 m along a track where a road surface lies at the bed (within HEIGHT_M
//             vertically; non-bridge tracks): the step between the bed top and the road top there. A crossing is a run of such samples;
//             it "tears" where the bed stands over / under the road by more than TEAR_M.
//   height    a road surface more than HEIGHT_M above or below the bed of a track with no deck structure between.
//   ramp      land / square / paving / gravel triangles within RAMP_REACH_M of a track, steeper than RAMP_DEG, bigger
//             than RAMP_M2 in plan: the beige ramps beside the bed (area summed per 20 m of track).
import { writeFileSync } from 'node:fs';
import { GroundStore, toLocal, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { insideCut, locateCut, type Cut } from '../../src/canalRecall/ownGround/tunnels.ts';
import { readExtract } from './probe-rails.ts';

export const TEAR_M = 0.12, HEIGHT_M = 0.6, RAMP_DEG = 25, RAMP_REACH_M = 8, RAMP_M2 = 0.3, SAMPLE_M = 2;
// Carriageway surfaces only: a bed on a paved tram reservation or beside a footway hides paving, it does not tear a road.
const ROAD = new Set<GroundLayer>(['asphalt', 'klinker', 'cycle']);
const GROUND = new Set<GroundLayer>(['land', 'square', 'paving', 'gravel']);
const BIN = 8;

export interface TriIndex { grid: Map<string, { layer: GroundLayer; a: number; b: number; c: number; pos: Float32Array }[]> }
export function triIndex(cell: BuiltCell, layers: ReadonlySet<GroundLayer>): TriIndex {
  const grid: TriIndex['grid'] = new Map();
  for (const [layer, m] of Object.entries(cell.layers) as [GroundLayer, NonNullable<BuiltCell['layers'][GroundLayer]>][]) {
    if (!m || !layers.has(layer)) continue;
    const p = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const x0 = Math.floor(Math.min(p[a], p[b], p[c]) / BIN), x1 = Math.floor(Math.max(p[a], p[b], p[c]) / BIN);
      const y0 = Math.floor(Math.min(p[a + 1], p[b + 1], p[c + 1]) / BIN), y1 = Math.floor(Math.max(p[a + 1], p[b + 1], p[c + 1]) / BIN);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 64) continue;
      for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const k = `${gx}:${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push({ layer, a, b, c, pos: p }); }
    }
  }
  return { grid };
}
export function hitsAt(ix: TriIndex, x: number, y: number): { layer: GroundLayer; z: number }[] {
  const out: { layer: GroundLayer; z: number }[] = [];
  for (const t of ix.grid.get(`${Math.floor(x / BIN)}:${Math.floor(y / BIN)}`) ?? []) {
    const p = t.pos, { a, b, c } = t;
    const d = (p[b + 1] - p[c + 1]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 1] - p[c + 1]);
    if (Math.abs(d) < 1e-12) continue;
    const u = ((p[b + 1] - p[c + 1]) * (x - p[c]) + (p[c] - p[b]) * (y - p[c + 1])) / d;
    const v = ((p[c + 1] - p[a + 1]) * (x - p[c]) + (p[a] - p[c]) * (y - p[c + 1])) / d;
    if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
    out.push({ layer: t.layer, z: u * p[a + 2] + v * p[b + 2] + (1 - u - v) * p[c + 2] });
  }
  return out;
}

export interface Finding { cls: 'crossing' | 'height' | 'ramp'; cell: string; at: [number, number]; lngLat?: [number, number]; kind: string; bridge: boolean; value: number; detail: string }
type Way = { kind: string; bridge: boolean; points: [number, number][] };

/** Class crossing/height per rail way of one built cell (samples inside the cell's rect only); class ramp per bed segment. */
export function scanCell(cell: BuiltCell, rails: readonly Way[], cuts: readonly Cut[] = []): Finding[] {
  const inCut = (x: number, y: number) => cuts.some(c => x >= c.bbox[0] && x <= c.bbox[2] && y >= c.bbox[1] && y <= c.bbox[3] && (() => { const h = locateCut(c, x, y); return !!h && insideCut(c, h); })());
  const ix = triIndex(cell, new Set<GroundLayer>([...ROAD, ...GROUND, 'ballast', 'deckBody', 'deckTop', 'track']));
  const [x0, y0, x1, y1] = cell.rect;
  const out: Finding[] = [];
  const inRect = (x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;
  for (const w of rails) {
    let run: { start: [number, number]; max: number; n: number } | null = null;
    let hrun: { start: [number, number]; max: number; n: number; kind: string } | null = null;
    const flush = () => { if (run && run.n >= 2 && Math.abs(run.max) > TEAR_M) out.push({ cls: 'crossing', cell: cell.key, at: run.start, kind: w.kind, bridge: w.bridge, value: +run.max.toFixed(2), detail: `${run.n} samples` }); run = null; };
    const hflush = () => { if (hrun && hrun.n >= 2) out.push({ cls: 'height', cell: cell.key, at: hrun.start, kind: w.kind, bridge: w.bridge, value: +hrun.max.toFixed(2), detail: `${hrun.kind} ${hrun.n} samples${inCut(hrun.start[0], hrun.start[1]) ? ' in-tunnel-cut' : ''}` }); hrun = null; };
    for (let i = 0; i + 1 < w.points.length; i++) {
      const [ax, ay] = w.points[i], [bx, by] = w.points[i + 1], len = Math.hypot(bx - ax, by - ay);
      for (let s = 0; s < len; s += SAMPLE_M) {
        const px = ax + (bx - ax) * s / len, py = ay + (by - ay) * s / len;
        if (!inRect(px, py)) { flush(); hflush(); continue; }
        const hits = hitsAt(ix, px, py);
        const bed = hits.filter(h => h.layer === 'ballast').reduce((m, h) => Math.max(m, h.z), -Infinity);
        if (!isFinite(bed)) { flush(); hflush(); continue; }
        const roads = hits.filter(h => ROAD.has(h.layer));
        const near = w.bridge ? [] : roads.filter(h => Math.abs(h.z - bed) <= HEIGHT_M);
        if (near.length) {
          const top = near.reduce((m, h) => (h.z > m.z ? h : m));
          const d = bed - top.z;
          if (!run) run = { start: [px, py], max: d, n: 0 };
          run.n++; if (Math.abs(d) > Math.abs(run.max)) run.max = d;
        } else flush();
        const far = roads.filter(h => Math.abs(h.z - bed) > HEIGHT_M && Math.abs(h.z - bed) < 12);
        const nearAny = roads.some(h => Math.abs(h.z - bed) <= HEIGHT_M);
        const deck = hits.some(h => (h.layer === 'deckBody' || h.layer === 'deckTop') && Math.abs(h.z - bed) < 12);
        if (far.length && !nearAny && !deck) {
          const f = far.reduce((m, h) => (Math.abs(h.z - bed) > Math.abs(m.z - bed) ? h : m));
          const kind = f.z > bed ? 'road-over-rail' : 'road-under-rail';
          if (!hrun || hrun.kind !== kind) { hflush(); hrun = { start: [px, py], max: f.z - bed, n: 0, kind }; }
          hrun.n++; if (Math.abs(f.z - bed) > Math.abs(hrun.max)) hrun.max = f.z - bed;
        } else hflush();
      }
    }
    flush(); hflush();
  }
  const bins = new Map<string, { area: number; at: [number, number]; kind: string; bridge: boolean; drop: number }>();
  const segs: { a: [number, number]; b: [number, number]; kind: string; bridge: boolean }[] = [];
  for (const w of rails) for (let i = 0; i + 1 < w.points.length; i++) segs.push({ a: w.points[i], b: w.points[i + 1], kind: w.kind, bridge: w.bridge });
  const grid = new Map<string, typeof segs>();
  for (const sg of segs) {
    const gx0 = Math.floor((Math.min(sg.a[0], sg.b[0]) - RAMP_REACH_M) / 16), gx1 = Math.floor((Math.max(sg.a[0], sg.b[0]) + RAMP_REACH_M) / 16);
    const gy0 = Math.floor((Math.min(sg.a[1], sg.b[1]) - RAMP_REACH_M) / 16), gy1 = Math.floor((Math.max(sg.a[1], sg.b[1]) + RAMP_REACH_M) / 16);
    for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) { const k = `${gx}:${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(sg); }
  }
  for (const layer of GROUND) {
    const m = cell.layers[layer];
    if (!m) continue;
    const p = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3;
      if (!inRect(cx, cy)) continue;
      const cand = grid.get(`${Math.floor(cx / 16)}:${Math.floor(cy / 16)}`);
      if (!cand) continue;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz) || 1;
      const plan = Math.abs(nz) / 2;
      if (plan < RAMP_M2 || Math.acos(Math.min(1, Math.abs(nz) / nl)) * 180 / Math.PI < RAMP_DEG) continue;
      let best = Infinity, hit: (typeof segs)[number] | null = null, at = 0;
      for (const sg of cand) {
        const dx = sg.b[0] - sg.a[0], dy = sg.b[1] - sg.a[1], L2 = dx * dx + dy * dy || 1e-9;
        const tt = Math.max(0, Math.min(1, ((cx - sg.a[0]) * dx + (cy - sg.a[1]) * dy) / L2)), d = Math.hypot(sg.a[0] + dx * tt - cx, sg.a[1] + dy * tt - cy);
        if (d < best) { best = d; hit = sg; at = tt; }
      }
      if (!hit || best > RAMP_REACH_M) continue;
      const key = `${Math.round(hit.a[0] / 20)}:${Math.round(hit.a[1] / 20)}`;
      const drop = Math.max(p[a + 2], p[b + 2], p[c + 2]) - Math.min(p[a + 2], p[b + 2], p[c + 2]);
      const e = bins.get(key) ?? { area: 0, at: [hit.a[0] + (hit.b[0] - hit.a[0]) * at, hit.a[1] + (hit.b[1] - hit.a[1]) * at], kind: hit.kind, bridge: hit.bridge, drop: 0 };
      e.area += plan; e.drop = Math.max(e.drop, drop); bins.set(key, e);
    }
  }
  for (const e of bins.values()) out.push({ cls: 'ramp', cell: cell.key, at: e.at, kind: e.kind, bridge: e.bridge, value: +e.area.toFixed(1), detail: `max drop ${e.drop.toFixed(1)} m` });
  return out;
}

async function main(): Promise<void> {
  const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const lod = arg('lod') === '1' ? 1 : 0;
  const store = new GroundStore(readExtract, { roads: arg('roads') !== '0', ...(arg('onStreet') === '0' ? { railOnStreet: false } : {}) });
  await store.init();
  let keys = [...store.railCells].filter(k => store.covers(k)).sort();
  const cellsArg = arg('cells');
  if (cellsArg) keys = cellsArg.split(',');
  const atArg = arg('at');
  if (atArg) {
    const [lng, lat, half] = atArg.split(',').map(Number), [x, y] = toLocal(lng, lat), set = new Set<string>();
    for (let dx = -half; dx <= half; dx += 50) for (let dy = -half; dy <= half; dy += 50) set.add(store.cellAt(x + dx, y + dy));
    keys = [...set].filter(k => store.covers(k));
  }
  const all: Finding[] = [];
  let n = 0;
  for (const k of keys) {
    const input = await store.cellInput(k, lod);
    if (!input.rails?.length) continue;
    all.push(...scanCell(buildCell(input), input.rails as never, input.cuts ?? []));
    if (++n % 10 === 0) console.error(`${n}/${keys.length} cells`);
  }
  for (const f of all) f.lngLat = fromLocal(f.at[0], f.at[1]).map(v => +v.toFixed(5)) as [number, number];
  const summary: Record<string, unknown> = { cells: n, lod };
  for (const cls of ['crossing', 'height', 'ramp'] as const) {
    const xs = all.filter(f => f.cls === cls).sort((p, q) => Math.abs(q.value) - Math.abs(p.value));
    summary[cls] = { count: xs.length, worst: xs.slice(0, 20) };
  }
  const out = arg('json');
  if (out) writeFileSync(out, JSON.stringify({ summary, all }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
}
if (process.argv[1]?.endsWith('probe-rails-class.ts')) main().catch(e => { console.error(e); process.exit(1); });
