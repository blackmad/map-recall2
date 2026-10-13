// Measure a width for every way of own-ground-osm-v1 on BGT road surfaces
// (lane task 2, 2026-10-13). Reads the cache that fetch-bgt.ts fills.
//
//   npx tsx scripts/own-ground/fetch-bgt.ts
//   npx tsx scripts/own-ground/build-bgt-widths.ts
//   # review artifacts/own-ground/staging/own-ground-osm-v1/report-bgt.json, then publish:
//   cp artifacts/own-ground/staging/own-ground-osm-v1/cells/* public/data/extracts/amsterdam/own-ground-osm-v1/cells/
//   cp artifacts/own-ground/staging/own-ground-osm-v1/bgt-way-widths.json public/data/extracts/amsterdam/own-ground-osm-v1/
//
// Output, per way: `bw: [widthDm, sidewalkDm, cycleDm]` (own surface, footpath
// per side, cycle path per side; 0 = none found) written into the cell files.
// Ways without a BGT measurement get no `bw` (prior/tag widths stay).
// Also `bgt-way-widths.json` { "<osm way id>": widthM } and
// `bgt-width-by-class.json` for the 2D physics ROAD_WIDTHS reader.
//
// Source: BGT wegdeel, Kadaster via PDOK OGC API, CC0 1.0.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { cellBounds, elevationIndex } from './game-cells.ts';
import { BGT_CACHE, type BgtFeature } from './fetch-bgt.ts';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { crossSection, type OsmGroundExtract } from '../../src/canalRecall/ownGround/osmGround.ts';
import { BgtIndex, classOf, fallbackClasses, ownClasses, polygonBox, toDm, wayWidths, type BgtPolygon, type Vec2 } from '../../src/canalRecall/ownGround/bgtWidth.ts';

const SRC = 'public/data/extracts/amsterdam/own-ground-osm-v1';
const OUT = 'artifacts/own-ground/staging/own-ground-osm-v1';

const tileCache = new Map<string, BgtPolygon[]>();
function tilePolys(file: string): BgtPolygon[] {
  let p = tileCache.get(file);
  if (!p) {
    p = [];
    if (existsSync(file)) for (const f of JSON.parse(gunzipSync(readFileSync(file)).toString()) as BgtFeature[]) {
      const rings = f.r.map(r => r.map(([x, y]) => toLocal(x, y)));
      p.push({ cls: classOf(f.f), h: f.h, rings, bbox: polygonBox(rings) });
    }
    tileCache.set(file, p);
  }
  return p;
}

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const pct = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null; };
const r1 = (v: number | null) => v === null ? null : Math.round(v * 10) / 10;

interface Row { hw: string; n: number; withSection: number; bgt: number[]; prior: number[]; tagged: number[]; tagDiff: number[]; sidewalk: number[]; cycle: number[] }

function main(): void {
  const index = elevationIndex();
  const manifest = JSON.parse(readFileSync(`${SRC}/cells.json`, 'utf8')) as { cells: string[] };
  mkdirSync(`${OUT}/cells`, { recursive: true });
  const rows = new Map<string, Row>();
  const wayWidthsOut: Record<string, number> = {};
  let ways = 0, drawable = 0, measured = 0, tilesMissing = 0;
  const bySource = { bgt: 0, tag: 0, lanes: 0, prior: 0 };
  const t0 = Date.now();
  for (const key of manifest.cells) {
    const [cx, cy] = key.split('_').map(Number);
    const polys: BgtPolygon[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let q = 0; q < 4; q++) polys.push(...tilePolys(`${BGT_CACHE}/${cx + dx}_${cy + dy}_${q}.json.gz`));
    for (let q = 0; q < 4; q++) if (!existsSync(`${BGT_CACHE}/${key}_${q}.json.gz`)) tilesMissing++;
    const idx = new BgtIndex(polys);
    const cell = JSON.parse(gunzipSync(readFileSync(`${SRC}/cells/${key}.json.gz`)).toString()) as OsmGroundExtract & { ways: (OsmGroundExtract['ways'][number] & { bw?: [number, number, number] })[] };
    void cellBounds; void index;
    for (const w of cell.ways) {
      ways++;
      delete w.bw;
      const section = crossSection(w.tags);
      if (!section) continue;
      drawable++;
      const hw = w.tags.highway;
      const row = rows.get(hw) ?? rows.set(hw, { hw, n: 0, withSection: 0, bgt: [], prior: [], tagged: [], tagDiff: [], sidewalk: [], cycle: [] }).get(hw)!;
      row.n++;
      const line: Vec2[] = w.g.map(([x, y]) => toLocal(x, y));
      const bridge = !!w.tags.bridge && w.tags.bridge !== 'no';
      const own = ownClasses(hw, w.tags);
      const measure = (classes: ReadonlySet<import('../../src/canalRecall/ownGround/bgtWidth.ts').SurfaceClass>) =>
        (bridge ? wayWidths(idx, line, classes, p => p.h >= 1) : null) ?? wayWidths(idx, line, classes, p => p.h === 0 && !bridge) ?? (bridge ? wayWidths(idx, line, classes, p => p.h === 0) : null);
      const alt = fallbackClasses(hw);
      const hit = measure(own) ?? (alt ? measure(alt) : null);
      const prior = section.bands[0].width;
      row.prior.push(prior);
      bySource[section.source.width === 'prior' ? 'prior' : section.source.width as 'tag' | 'lanes']++;
      if (!hit) continue;
      measured++; row.withSection++;
      const { widthM, sidewalkM, cycleM } = hit.widths;
      w.bw = [toDm(widthM), toDm(sidewalkM), toDm(cycleM)];
      wayWidthsOut[w.id] = Math.round(widthM * 10) / 10;
      row.bgt.push(widthM);
      if (sidewalkM > 0) row.sidewalk.push(sidewalkM);
      if (cycleM > 0) row.cycle.push(cycleM);
      if (section.source.width === 'tag') { row.tagged.push(prior); row.tagDiff.push(Math.abs(widthM - prior)); }
    }
    writeFileSync(`${OUT}/cells/${key}.json.gz`, gzipSync(JSON.stringify(cell)));
    if (tileCache.size > 60) tileCache.clear();
  }
  writeFileSync(`${OUT}/cells.json`, readFileSync(`${SRC}/cells.json`));
  writeFileSync(`${OUT}/bgt-way-widths.json`, JSON.stringify(wayWidthsOut));
  const byClass = [...rows.values()].sort((a, b) => b.n - a.n).map(r => ({
    highway: r.hw, ways: r.n, withBgt: r.withSection, pctBgt: +(100 * r.withSection / Math.max(1, r.n)).toFixed(1),
    bgtMedianM: r1(median(r.bgt)), bgtP10M: r1(pct(r.bgt, 0.1)), bgtP90M: r1(pct(r.bgt, 0.9)),
    priorMedianM: r1(median(r.prior)), sidewalkMedianM: r1(median(r.sidewalk)), waysWithSidewalk: r.sidewalk.length, cycleMedianM: r1(median(r.cycle)), waysWithCycle: r.cycle.length,
    taggedWithBgt: r.tagged.length, tagMeanAbsDiffM: r.tagDiff.length ? r1(r.tagDiff.reduce((s, v) => s + v, 0) / r.tagDiff.length) : null,
  }));
  writeFileSync(`${OUT}/bgt-width-by-class.json`, JSON.stringify({ unit: 'metres (full width of the way\'s own surface)', source: 'BGT wegdeel (PDOK)', classes: Object.fromEntries(byClass.filter(c => c.withBgt >= 20 && c.bgtMedianM !== null).map(c => [c.highway, { medianM: c.bgtMedianM, p10M: c.bgtP10M, p90M: c.bgtP90M, n: c.withBgt }])) }, null, 1));
  const report = {
    source: { name: 'BGT wegdeel', url: 'https://api.pdok.nl/lv/bgt/ogc/v1/collections/wegdeel', licence: 'CC0 1.0 (Kadaster, PDOK)', cache: BGT_CACHE },
    method: 'cross-line at 25/50/75 % of each way; own-surface run (carriageway / path class by highway) within 2.5 m of the centreline; footpath and cycle path summed outward per side; median over stations; bridge ways use h>=1 polygons first',
    cells: manifest.cells.length, tilesMissing, ways, drawableWays: drawable, withBgtWidth: measured, pctBgtOfDrawable: +(100 * measured / drawable).toFixed(1),
    widthSourceBefore: bySource, byClass, seconds: Math.round((Date.now() - t0) / 1000),
  };
  writeFileSync(`${OUT}/report-bgt.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ...report, byClass: report.byClass.slice(0, 14) }, null, 1));
}

main();
