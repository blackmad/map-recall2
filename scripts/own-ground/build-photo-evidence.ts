// Photo evidence for tag-driven road paint (lane roads-lanes 2026-10-23; src/canalRecall/ownGround/photoEvidence.ts).
//
//   npx tsx scripts/own-ground/build-photo-evidence.ts [--count] [--spots] [--only=key,key] [--out=public/data/extracts/amsterdam/staging/photo-evidence.json]
//
// For every roads-v1 cell, from the PDOK 8 cm orthophoto (ortho.ts, cached under .cache/pdok-ortho-8cm):
//   lanes   covered carriageways with `cycleway=lane` (the ribbon streets.ts laneRibbon draws): at 1 m stations along
//           each side's lane, nine texels across and along the lane on the rijbaan polygon (not green, not paint-white);
//           a station is red when RED_STATION of them read red (r ≥ 1.08·max(g, b), render-road-sources' test); runs
//           of red stations (gaps ≤ 3 m closed, ≥ 6 m long) are the lane's evidence.
//   centre  two-way carriageways the centre dashes are drawn on (surveyMarkings): the measured middle every metre
//           (as surveyMarkings computes it); along it, every 0.1 m, the texel is a line when its luma beats the mean
//           of the texels 0.6–1.0 m to either side by LINE_DELTA (paint is the brightest thing locally, in sun and
//           in a facade's shadow); a station shows a line when ≥ LINE_SHARE of the 9 m (one dash period) around it
//           does. Runs (gaps ≤ 9 m closed, ≥ 9 m long) are the evidence.
//   greyFiets  rijbaan sections the extract paints red as a fietsstraat: interior texels on a 0.5 m grid; the section
//           stays red when its red share is at least FIETS_KEEP of the cell's fietspad red share (and ≥ FIETS_MIN).
// --count: only report how many orthophoto tiles are needed and how many are not cached yet.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { ROAD_SPOTS } from '../../src/canalRecall/ownGround/roadRegressions.ts';
import { prepareWays, resolvePriorSidewalks, type LocalWay } from '../../src/canalRecall/ownGround/streets.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { SurveyMarker, planCrossings, crossingStripPoints, CENTRE_MIN_WIDTH_M, NODE_ON_WAY_M, SegGrid } from '../../src/canalRecall/ownGround/surveyMarkings.ts';
import { rankOf } from '../../src/canalRecall/ownGround/roadMarkings.ts';
import { pointAt, stations } from '../../src/canalRecall/ownGround/drape.ts';
import { encodeRuns, flagRuns, PHOTO_EVIDENCE_VERSION, ZEBRA_DROP, type PhotoEvidenceFile } from '../../src/canalRecall/ownGround/photoEvidence.ts';
import type { Vec2 } from '../../src/canalRecall/ownGround/surface.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from './ortho.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = arg('out', 'public/data/extracts/amsterdam/staging/photo-evidence.json');
const ONLY = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
const COUNT = process.argv.includes('--count');
const ROOT = 'public/data/extracts/amsterdam';
const bytes = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };

export const RULES = { RED_MIN: 1.08, RED_STATION: 0.45, LANE_BRIDGE_M: 3, LANE_MIN_M: 6, LINE_DELTA: 22, LINE_SHARE: 0.12, LINE_MAX_SHARE: 0.85, CENTRE_BRIDGE_M: 9, CENTRE_MIN_M: 9, FIETS_KEEP: 0.65, FIETS_MIN: 0.2, ZEBRA_SEARCH_M: 6, ZEBRA_SCORE: 0.07, ZEBRA_MOVE_M: 0.5 };
const isRed = (c: readonly number[]) => c[0] >= 30 && c[0] >= RULES.RED_MIN * Math.max(c[1], c[2]);
const isGreen = (c: readonly number[]) => c[1] > c[0] + 4 && c[1] > c[2] + 4;
const isWhite = (c: readonly number[]) => Math.min(c[0], c[1], c[2]) > 195;
const luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const left = (d: Vec2): Vec2 => [-d[1], d[0]];
const unit = (v: Vec2): Vec2 => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const isCarriage = (w: LocalWay) => w.section.bands[0]?.kind === 'carriageway' && !(w.tags.bridge && w.tags.bridge !== 'no');
const twoWay = (w: LocalWay) => !['yes', 'true', '1', '-1'].includes(w.tags.oneway);

interface Task { tiles: Set<string>; run: () => void }

async function main(): Promise<void> {
  const store = new GroundStore(bytes, { roads: true });
  await store.init();
  const ortho = new OrthoTiles();
  const out: PhotoEvidenceFile = { version: PHOTO_EVIDENCE_VERSION, source: ORTHO_ATTRIBUTION, built: new Date().toISOString().slice(0, 10), lanes: {}, centre: {}, zebras: [], greyFiets: [], sampled: { laneWays: 0, centreWays: 0, fietsSections: 0, cells: 0, zebras: 0 }, rules: RULES };
  // --spots: the cells under the roadRegressions ROAD_SPOTS crops (tuning before the city-wide run).
  const spotCells = process.argv.includes('--spots') ? new Set(ROAD_SPOTS.flatMap(s => { const [x, y] = toLocal(s.at[0], s.at[1]); return [-1, 1].flatMap(dx => [-1, 1].map(dy => store.cellAt(x + dx * (s.halfM + 20), y + dy * (s.halfM + 20)))); })) : null;
  const keys = [...store.roadCells].filter(k => (!ONLY || ONLY.includes(k)) && (!spotCells || spotCells.has(k))).sort();
  const need = new Set<string>();
  const report: Record<string, unknown>[] = [];
  let i = 0;
  for (const key of keys) {
    i++;
    if (!store.osmCells.has(key)) continue;
    const t0 = Date.now();
    const input = await store.cellInput(key, 0);
    const seen = new Set<number>(input.dropWays ?? []), all: LocalWay[] = [];
    for (const e of [input.osm, ...input.osmAround]) if (e) for (const w of prepareWays(e.ways, input.project)) if (!seen.has(w.id)) { seen.add(w.id); all.push(w); }
    const ways = resolvePriorSidewalks(all), own = new Set((input.osm?.ways ?? []).map(w => w.id)), covered = new Set(input.coverWays ?? []);
    const index = new RoadIndex([input.roads, ...(input.roadsAround ?? [])]);
    const mk = new SurveyMarker({ ways, marks: [], ownsWay: () => true, ownsPoint: () => true, index, height: () => 0, lift: { paint: 0, red: 0 } });
    const tileOf = (p: Vec2) => ortho.tilesUnder(p[0], p[1], p[0], p[1])[0];
    const tasks: Task[] = [];

    // ---- lanes
    for (const w of ways) {
      if (!own.has(w.id) || !covered.has(w.id) || !isCarriage(w)) continue;
      const lanes = w.section.bands.filter(b => b.kind === 'cycle_lane');
      if (!lanes.length) continue;
      const st = stations(w.points), total = st[st.length - 1], tiles = new Set<string>();
      for (let s = 0; s <= total; s += 4) tiles.add(tileOf(pointAt(w.points, st, s)));
      tiles.add(tileOf(pointAt(w.points, st, total)));
      out.sampled!.laneWays++;
      tasks.push({ tiles, run: () => {
        const list: number[] = [];
        for (const band of lanes) {
          const side = band.offset > 0 ? 1 : -1, flags: (boolean | null)[] = [];
          for (let s = 0; s <= total; s += 1) {
            const p = pointAt(w.points, st, s), n = left(unit([pointAt(w.points, st, Math.min(total, s + 0.5))[0] - pointAt(w.points, st, Math.max(0, s - 0.5))[0], pointAt(w.points, st, Math.min(total, s + 0.5))[1] - pointAt(w.points, st, Math.max(0, s - 0.5))[1]]));
            const t: Vec2 = [-n[1], n[0]];
            let k = 0, red = 0;
            for (const a of [-0.3, 0, 0.3]) for (const b of [-0.35, 0, 0.35]) {
              const q: Vec2 = [p[0] + n[0] * (band.offset + a * band.width) + t[0] * b, p[1] + n[1] * (band.offset + a * band.width) + t[1] * b];
              if (!index.onRoad(q[0], q[1])) continue;
              const c = ortho.rgbAt(q[0], q[1]);
              if (!c || isGreen(c) || isWhite(c)) continue;
              k++; if (isRed(c)) red++;
            }
            flags.push(k >= 4 ? red / k >= RULES.RED_STATION : null);
          }
          for (const [a, b] of flagRuns(flags, RULES.LANE_BRIDGE_M, RULES.LANE_MIN_M)) list.push(side, Math.round(a * 10), Math.round(b * 10));
        }
        if (list.length) out.lanes[w.id] = list;
      } });
    }

    // ---- centre lines (the ways surveyMarkings would dash)
    for (const w of ways) {
      if (!own.has(w.id) || !isCarriage(w) || !twoWay(w) || rankOf(w.tags.highway) < 1) continue;
      if (w.tags.cyclestreet === 'yes' || w.tags.bicycle_road === 'yes' || w.tags.junction === 'roundabout') continue;
      const st = stations(w.points), total = st[st.length - 1];
      if (total < 3 + 16) continue;
      const mids: (Vec2 | null)[] = [], dirs: Vec2[] = [];
      for (let s = 0; s <= total; s += 1) {
        const p = pointAt(w.points, st, s), q = pointAt(w.points, st, Math.min(total, s + 0.5)), r = pointAt(w.points, st, Math.max(0, s - 0.5));
        const d = unit([q[0] - r[0], q[1] - r[1]]), n = left(d);
        dirs.push(d);
        if (!mk.onCarriage(p[0], p[1])) { mids.push(null); continue; }
        const a = mk.reach(p, n), b = mk.reach(p, [-n[0], -n[1]]);
        mids.push(a + b >= CENTRE_MIN_WIDTH_M && a < 14 && b < 14 ? [p[0] + n[0] * (a - b) / 2, p[1] + n[1] * (a - b) / 2] : null);
      }
      if (!mids.some(Boolean)) continue;
      const tiles = new Set<string>();
      for (const m of mids) if (m) tiles.add(tileOf(m));
      out.sampled!.centreWays++;
      tasks.push({ tiles, run: () => {
        // Line texels along the middle, per 0.1 m: centre luma over the mean 0.6–1.0 m either side.
        const line: (boolean | null)[] = [];
        for (let s = 0; s < mids.length; s++) {
          const m = mids[s];
          for (let j = 0; j < 10; j++) {
            if (!m) { line.push(null); continue; }
            const d = dirs[s], n = left(d), c: Vec2 = [m[0] + d[0] * (j / 10 - 0.5), m[1] + d[1] * (j / 10 - 0.5)];
            const at = ortho.rgbAt(c[0], c[1]);
            if (!at) { line.push(null); continue; }
            let sum = 0, k = 0;
            for (const o of [0.6, 0.8, 1.0, -0.6, -0.8, -1.0]) { const x = ortho.rgbAt(c[0] + n[0] * o, c[1] + n[1] * o); if (x) { sum += luma(x); k++; } }
            line.push(k ? luma(at) > sum / k + RULES.LINE_DELTA : null);
          }
        }
        const flags: (boolean | null)[] = [];
        for (let s = 0; s < mids.length; s++) {
          let on = 0, k = 0;
          for (let j = Math.max(0, (s - 4) * 10); j < Math.min(line.length, (s + 5) * 10); j++) { if (line[j] === null) continue; k++; if (line[j]) on++; }
          // A dashed or solid line: some of the period bright; all of it bright is a white car or a light kerb.
          flags.push(k >= 40 ? on / k >= RULES.LINE_SHARE && on / k <= RULES.LINE_MAX_SHARE : null);
        }
        const runs = flagRuns(flags, RULES.CENTRE_BRIDGE_M, RULES.CENTRE_MIN_M);
        if (runs.length) out.centre[w.id] = encodeRuns(runs);
      } });
    }

    // ---- zebras: the crossings surveyMarkings plans (as groundCell builds them: same index, same box), each looked for
    // in the photo along its road: at offset u along r, the luma profile across the row (along n) every 0.1 m, averaged
    // over ±0.5 m along r; its strongest Fourier amplitude at a stripe pitch of 0.8–1.3 m over its mean is the zebra score. Smoothed over the stripe
    // length, the best u within ±ZEBRA_SEARCH_M is where the photo's zebra is; under ZEBRA_SCORE it shows none.
    {
      const [x0, y0, x1, y1] = input.rect;
      let rb: [number, number, number, number] = [x0 - 60, y0 - 60, x1 + 60, y1 + 60];
      for (const w of ways) if (own.has(w.id)) for (const p of w.points) rb = [Math.min(rb[0], p[0] - 10), Math.min(rb[1], p[1] - 10), Math.max(rb[2], p[0] + 10), Math.max(rb[3], p[1] + 10)];
      const zi = new RoadIndex([input.roads, ...(input.roadsAround ?? [])], rb);
      zi.parkingIslands();
      zi.crossingStrips(crossingStripPoints(ways, input.marks ?? []));
      const inCell = (p: Vec2) => p[0] >= x0 && p[0] < x1 && p[1] >= y0 && p[1] < y1;
      const zin = { ways, marks: input.marks ?? [], ownsWay: (w: LocalWay) => own.has(w.id), ownsPoint: inCell, box: [rb[0] - 30, rb[1] - 30, rb[2] + 30, rb[3] + 30] as const, index: zi, height: () => 0, lift: { paint: 0, red: 0 } };
      const zmk = new SurveyMarker(zin);
      const cyc = new SegGrid<true>(8);
      for (const w of ways) if (w.tags.highway === 'cycleway' || (w.tags.highway === 'path' && w.tags.bicycle === 'designated')) for (const p of w.points) cyc.add(p, p, true, 1);
      const plans = planCrossings(zmk, zin, p => cyc.near(p).some(q => Math.hypot(q.a[0] - p[0], q.a[1] - p[1]) <= NODE_ON_WAY_M)).filter(c => c.owned && c.kind === 'zebra');
      if (plans.length) {
        const tiles = new Set<string>();
        for (const c of plans) for (const u of [-RULES.ZEBRA_SEARCH_M - 2, 0, RULES.ZEBRA_SEARCH_M + 2]) for (const v of [c.from, c.to]) tiles.add(tileOf([c.centre[0] + c.r[0] * u - c.r[1] * v, c.centre[1] + c.r[1] * u + c.r[0] * v]));
        out.sampled!.zebras! += plans.length;
        tasks.push({ tiles, run: () => {
          for (const c of plans) {
            const n = left(c.r), us: number[] = [], score: number[] = [];
            for (let u = -RULES.ZEBRA_SEARCH_M - 1.5; u <= RULES.ZEBRA_SEARCH_M + 1.5 + 1e-6; u += 0.25) {
              const vs: number[] = [], ls: number[] = [];
              for (let v = c.from; v <= c.to; v += 0.05) {
                let l = 0, m = 0;
                for (const a of [-0.5, 0, 0.5]) { const q = ortho.rgbAt(c.centre[0] + c.r[0] * (u + a) + n[0] * v, c.centre[1] + c.r[1] * (u + a) + n[1] * v); if (q) { l += luma(q); m++; } }
                if (m) { vs.push(v); ls.push(l / m); }
              }
              // Periodogram over the stripe pitches painted (0.8–1.3 m), the strongest.
              let amp = 0;
              const k = ls.length, mean = ls.reduce((a, b) => a + b, 0) / Math.max(1, k);
              if (k >= 40) for (let period = 0.8; period <= 1.3 + 1e-6; period += 0.05) {
                let re = 0, im = 0;
                for (let i = 0; i < k; i++) { re += (ls[i] - mean) * Math.cos(2 * Math.PI * vs[i] / period); im += (ls[i] - mean) * Math.sin(2 * Math.PI * vs[i] / period); }
                amp = Math.max(amp, 2 * Math.hypot(re, im) / k);
              }
              us.push(u); score.push(amp / (mean + 10));
            }
            // Smoothed over the 3 m stripe length (±1.25 m), the best position within the search.
            let best = -1, bu = 0;
            for (let i = 0; i < us.length; i++) {
              if (Math.abs(us[i]) > RULES.ZEBRA_SEARCH_M) continue;
              let t = 0, k = 0;
              for (let j = 0; j < us.length; j++) if (Math.abs(us[j] - us[i]) <= 1.25) { t += score[j]; k++; }
              if (k && t / k > best) { best = t / k; bu = us[i]; }
            }
            const du = best < RULES.ZEBRA_SCORE ? ZEBRA_DROP : Math.abs(bu) < RULES.ZEBRA_MOVE_M ? 0 : Math.round(bu * 10);
            out.zebras!.push(Math.round(c.centre[0] * 10), Math.round(c.centre[1] * 10), du);
            report.push({ cell: key, zebra: c.centre.map(v => +v.toFixed(1)), score: +best.toFixed(3), farScore: +Math.min(score[0], score[score.length - 1]).toFixed(3), du: du === ZEBRA_DROP ? 'drop' : du / 10 });
          }
        } });
      }
    }

    // ---- fietsstraat sections
    const ownIndex = new RoadIndex([input.roads]);
    const fiets: number[] = [], cycles: number[] = [];
    for (let k = 0; k < ownIndex.records.length; k++) {
      const r = ownIndex.records[k];
      if (r.h !== 0) continue;
      if (r.c === 'carriage' && r.k === 'cycle') fiets.push(k); else if (r.c === 'cycle') cycles.push(k);
    }
    const gridOf = (k: number, step: number): Vec2[] => {
      const ring = ownIndex.ringsOf(k)[0] ?? [], xs = ring.map(p => p[0]), ys = ring.map(p => p[1]), pts: Vec2[] = [];
      for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step) for (let y = Math.min(...ys) + step / 2; y < Math.max(...ys); y += step) if (ownIndex.findAtLevel(x, y, false) === k) pts.push([x, y]);
      return pts;
    };
    if (fiets.length) {
      const fp = fiets.map(k => gridOf(k, 0.5)), cp = cycles.map(k => gridOf(k, 1.5)).flat();
      const tiles = new Set<string>([...fp.flat(), ...cp].map(tileOf));
      out.sampled!.fietsSections += fiets.length;
      tasks.push({ tiles, run: () => {
        const share = (pts: Vec2[]) => { let k = 0, red = 0; for (const p of pts) { const c = ortho.rgbAt(p[0], p[1]); if (!c || isGreen(c) || isWhite(c)) continue; k++; if (isRed(c)) red++; } return k >= 20 ? red / k : null; };
        const base = share(cp);
        fiets.forEach((k, j) => {
          const s = share(fp[j]);
          if (s === null) return;
          const keep = s >= RULES.FIETS_MIN && (base === null || base < 0.3 || s >= RULES.FIETS_KEEP * base);
          const pts = fp[j], mid = pts[pts.length >> 1];
          report.push({ cell: key, section: k, redShare: +s.toFixed(2), cellFietspad: base === null ? null : +base.toFixed(2), keep, at: mid.map(v => +v.toFixed(1)) });
          if (!keep && mid) out.greyFiets.push(Math.round(mid[0] * 10), Math.round(mid[1] * 10));
        });
      } });
    }

    const tiles = new Set(tasks.flatMap(t => [...t.tiles]));
    for (const t of tiles) need.add(t);
    if (COUNT) { process.stdout.write(`${key}:${tiles.size} `); continue; }
    await ortho.hold(tiles);
    for (const t of tasks) t.run();
    ortho.release();
    out.sampled!.cells++;
    console.log(`${i}/${keys.length} ${key}: ${tasks.length} tasks, ${tiles.size} tiles, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  if (COUNT) { const missing = [...need].filter(k => !ortho.cached(k)).length; console.log(`\ntiles needed ${need.size}, not cached ${missing}`); return; }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  writeFileSync(OUT.replace(/\.json$/, '.report.json'), JSON.stringify({ sampled: out.sampled, lanesWithRed: Object.keys(out.lanes).length, centreWays: Object.keys(out.centre).length, greyFiets: out.greyFiets.length / 2, zebras: out.zebras!.length / 3, zebrasDropped: report.filter(r => r.du === 'drop').length, rows: report }, null, 1));
  console.log(JSON.stringify({ out: OUT, sampled: out.sampled, lanesWithRed: Object.keys(out.lanes).length, centreWays: Object.keys(out.centre).length, greyFiets: out.greyFiets.length / 2, zebrasDropped: report.filter(r => r.du === 'drop').length, zebrasMoved: report.filter(r => typeof r.du === 'number' && r.du !== 0).length }));
}

if (process.argv[1]?.endsWith('build-photo-evidence.ts')) main().catch(e => { console.error(e); process.exit(1); });
void existsSync;
