// Road continuity across every bridge (lane road-bridge-gaps 2026-11-01, issue #178; user: "there are probably some
// systemic issues with gaps in drawing roads, especially across bridges"). For every OSM highway bridge way (not steps)
// in the own-ground cells, built as the game builds them (roads-v1 on, LOD 0), samples every 0.5 m along the way and
// APPROACH_M past each end, on the centreline and at ±0.45/±0.85 of the carriageway half-width, what a camera straight
// above sees (src/canalRecall/ownGround/bridgeGaps.ts): road, the bare deck, land, a hole or the bridge body; for every
// non-road sample why (no road triangle, one buried under another surface, one the water mask discards) and whether it
// lies on a deck. Per way: centreline gap metres, longest gap, carriageway gap m², coplanar ties, the largest step of
// the drawn top between neighbouring samples, and the drawn top against the riding surface.
//
//   npx tsx scripts/roads/probe-bridge-gaps.ts [--label=before] [--shard=0/4] [--cells=-2_0,-2_-1] [--no-bridge-gaps]
//   npx tsx scripts/roads/probe-bridge-gaps.ts --report [--label=before] [--compare=before]
//
// Shards write artifacts/roads/bridge-gaps/<label>/shard-<i>.json; --report merges them into <label>/table.csv,
// <label>/summary.json (histograms, top 20, pattern counts) and prints the table head.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { isBridgeWay, prepareWays } from '../../src/canalRecall/ownGround/streets.ts';
import { carrierKind, deckRelation, HitIndex, histogram, probeWay, summarise, APPROACH_M, type Sample, type WayGapSummary } from '../../src/canalRecall/ownGround/bridgeGaps.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { registerHint } from '../../src/canalRecall/ownGround/bridgeKit.ts';

const ROOT = 'public/data/extracts/amsterdam';
const OUT = 'artifacts/roads/bridge-gaps';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const read = async (path: string) => {
  const file = join(ROOT, path);
  if (!existsSync(file)) throw new Error(`${path}: missing`);
  const b = readFileSync(file);
  return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b);
};

export type WayGroup = 'street' | 'cycle' | 'foot' | 'motor' | 'other';
export function wayGroup(highway: string): WayGroup {
  if (/^(primary|secondary|tertiary|unclassified|residential|living_street|service|busway|bus_guideway|road)(_link)?$/.test(highway)) return 'street';
  if (/^(motorway|trunk)(_link)?$/.test(highway)) return 'motor';
  if (highway === 'cycleway') return 'cycle';
  if (/^(footway|path|pedestrian|bridleway|track|corridor)$/.test(highway)) return 'foot';
  return 'other';
}

export interface WayRow extends WayGapSummary {
  id: number; name: string; highway: string; group: WayGroup; lng: number; lat: number; cell: string;
  lengthM: number; halfWidthM: number;
  /** The deck carrying the way's middle: a measured BRU id, `way:<id>` (wayDecks.ts), `flat` (an unmeasured footprint) or null. */
  deck: string | null; deckName: string; movable: boolean | null;
  /** Where the non-road centreline/carriageway samples sit: on the way (between its ends) or on an approach. */
  gapInWay: number; gapApproach: number;
  /** The worst non-road stretch's position along the way, m (negative: before its start). */
  worstAt: number | null;
}

async function probe(): Promise<void> {
  const label = flag('label') ?? 'before';
  const store = new GroundStore(read, { roads: true, ...(process.argv.includes('--no-bridge-gaps') ? { bridgeGaps: false } : {}), ...(process.argv.includes('--no-dry-way-decks') ? { dryWayDecks: false } : {}) });
  await store.init();
  const [si, sn] = (flag('shard') ?? '0/1').split('/').map(Number);
  const all = flag('cells')?.split(',') ?? [...store.osmCells].sort();
  const keys = all.filter((_, i) => i % sn === si);
  const cache = new Map<string, BuiltCell>();
  const cell = async (k: string) => {
    let c = cache.get(k);
    if (!c) { c = buildCell(await store.cellInput(k, 0)); cache.set(k, c); while (cache.size > 12) cache.delete(cache.keys().next().value!); }
    else { cache.delete(k); cache.set(k, c); }
    return c;
  };
  const rows: WayRow[] = [];
  const t0 = Date.now();
  for (const [ki, key] of keys.entries()) {
    const got = await probeCell(store, key, cell);
    rows.push(...got);
    if (got.length) console.error(`[${si}/${sn}] ${ki + 1}/${keys.length} ${key}: ${got.length} ways, ${rows.length} total, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  const dir = join(OUT, label);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `shard-${si}.json`), JSON.stringify({ shard: [si, sn], cells: keys.length, rows }));
}

/**
 * The bridge ways whose middle lies in `key` (optionally only `only`), probed in the cell and its neighbours as built
 * by `cell` (a cache over buildCell). One row per way.
 */
export async function probeCell(store: GroundStore, key: string, cell: (k: string) => Promise<BuiltCell>, only?: ReadonlySet<number>): Promise<WayRow[]> {
    const rows: WayRow[] = [];
    if (!store.covers(key)) return rows;
    const input = await store.cellInput(key, 0), [x0, y0, x1, y1] = input.rect;
    const ways = (input.osm ? prepareWays(input.osm.ways, input.project) : []).filter(w => {
      if (only && !only.has(w.id)) return false;
      if (!isBridgeWay(w) || !w.tags.highway || w.tags.highway === 'steps' || w.tags.tunnel) return false;
      const mid = w.points[w.points.length >> 1];
      return mid[0] >= x0 && mid[0] < x1 && mid[1] >= y0 && mid[1] < y1; // each way once, in its middle's cell
    });
    if (!ways.length) return rows;
    const near: BuiltCell[] = [];
    for (const k of GroundStore.neighbours(key)) if (store.covers(k)) near.push(await cell(k));
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const w of ways) for (const [x, y] of w.points) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
    const pad = APPROACH_M + 30;
    const index = new HitIndex(near, 2, undefined, [bx0 - pad, by0 - pad, bx1 + pad, by1 + pad]);
    const decks = GroundStore.neighbours(key).flatMap(k => store.decks(k));
    const flats = GroundStore.neighbours(key).flatMap(k => store.flatDecks(k));
    const deckAt = (x: number, y: number) => deckRelation(decks, flats, x, y);
    const roadIndex = new RoadIndex([null, ...await Promise.all(GroundStore.neighbours(key).map(k => store.roadCell(k)))], [bx0 - pad, by0 - pad, bx1 + pad, by1 + pad]);
    const surveyAt = (x: number, y: number): 'deck' | 'ground' | null => { const all = roadIndex.findAll(x, y); return !all.length ? null : all.some(k => roadIndex.records[k].h >= 1) ? 'deck' : 'ground'; };
    for (const w of ways) {
      const half = Math.max(0.75, w.section.coreHalfWidth);
      const { length, samples } = probeWay(index, w.points, half, (x, y) => store.surface.height(x, y), deckAt, {}, surveyAt);
      const sum = summarise(samples, half);
      const mid = w.points[w.points.length >> 1], [lng, lat] = fromLocal(mid[0], mid[1]);
      const votes = new Map<string, number>();
      for (const q of samples) if (q.lateral === 0 && q.s >= 0 && q.s <= length && q.deck) votes.set(q.deck, (votes.get(q.deck) ?? 0) + 1);
      const deck = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null, baseId = deck?.replace(/^(side|claim):/, '') ?? null;
      const deckName = baseId && /^BRU/.test(baseId) ? decks.find(d => d.profile.id === baseId)?.profile.name ?? '' : '';
      const hint = baseId && /^BRU/.test(baseId) ? registerHint(baseId) : null;
      const bad = samples.filter(q => q.cls !== 'road');
      const worst = worstStretch(samples);
      rows.push({
        id: w.id, name: w.tags.name ?? '', highway: w.tags.highway, group: wayGroup(w.tags.highway), lng: +lng.toFixed(5), lat: +lat.toFixed(5), cell: key,
        lengthM: +length.toFixed(1), halfWidthM: +half.toFixed(2), deck, deckName, movable: hint ? hint.movable : null,
        gapInWay: bad.filter(q => q.s >= 0 && q.s <= length).length, gapApproach: bad.filter(q => q.s < 0 || q.s > length).length,
        worstAt: worst, ...sum,
      });
    }
    return rows;
}

/** Middle of the longest non-road centreline run, m along the way (null: none). */
function worstStretch(samples: readonly Sample[]): number | null {
  const c = samples.filter(q => q.lateral === 0);
  let best = 0, at: number | null = null, run = 0, start = 0;
  for (const q of c) {
    if (q.cls !== 'road') { if (!run) start = q.s; run++; if (run > best) { best = run; at = (start + q.s) / 2; } } else run = 0;
  }
  return at === null ? null : +at.toFixed(1);
}

const csvCell = (v: unknown) => typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v ?? '');

function report(): void {
  const label = flag('label') ?? 'before', dir = join(OUT, label);
  const rows: WayRow[] = readdirSync(dir).filter(f => /^shard-\d+\.json$/.test(f)).flatMap(f => JSON.parse(readFileSync(join(dir, f), 'utf8')).rows);
  rows.sort((a, b) => b.bandGapM2 - a.bandGapM2 || b.centreGapM - a.centreGapM);
  const cols: (keyof WayRow)[] = ['id', 'name', 'highway', 'group', 'lng', 'lat', 'cell', 'deck', 'deckName', 'movable', 'lengthM', 'halfWidthM', 'centreGapM', 'longestGapM', 'bandGapM2', 'worstAt', 'gapInWay', 'gapApproach', 'onDeck', 'offDeck', 'ties', 'maxStepM', 'maxStepAt', 'maxRideOffM'];
  const lines = [[...cols, 'showsDeck', 'showsLand', 'showsHole', 'showsBody', 'missing', 'buried', 'masked', 'carriers', 'bySurvey'].join(',')];
  for (const r of rows) lines.push([...cols.map(c => csvCell(r[c])), r.shows.deck, r.shows.land, r.shows.hole, r.shows.body, r.causes.missing, r.causes.buried, r.causes.masked, csvCell(Object.entries(r.carriers).map(([k, v]) => `${k}:${v}`).join(' ')), csvCell(Object.entries(r.bySurvey ?? {}).map(([k, v]) => `${k}:${v}`).join(' '))].join(','));
  writeFileSync(join(dir, 'table.csv'), lines.join('\n') + '\n');
  const roadish = rows.filter(r => r.group === 'street' || r.group === 'cycle' || r.group === 'motor');
  const edges = [0, 0.5, 1, 2, 4, 8, 16, 32];
  const areaEdges = [0, 1, 5, 10, 25, 50, 100, 200];
  const sum = (f: (r: WayRow) => number, rs = roadish) => rs.reduce((a, r) => a + f(r), 0);
  const top20 = roadish.slice(0, 20).map(r => ({ id: r.id, name: r.name, highway: r.highway, deck: r.deck, deckName: r.deckName, lng: r.lng, lat: r.lat, bandGapM2: r.bandGapM2, centreGapM: r.centreGapM, longestGapM: r.longestGapM, shows: r.shows, causes: r.causes, carriers: r.carriers, onDeck: r.onDeck, offDeck: r.offDeck, maxStepM: r.maxStepM, maxRideOffM: r.maxRideOffM, worstAt: r.worstAt, lengthM: r.lengthM }));
  const byDeck = (pred: (r: WayRow) => boolean) => { const rs = roadish.filter(pred); return { ways: rs.length, withGap: rs.filter(r => r.bandGapM2 >= 5).length, gapM2: +sum(r => r.bandGapM2, rs).toFixed(0) }; };
  const summary = {
    label, ways: rows.length, roadWays: roadish.length,
    histogramCentreGapM: histogram(roadish.map(r => r.centreGapM), edges),
    histogramBandGapM2: histogram(roadish.map(r => r.bandGapM2), areaEdges),
    histogramMaxStepM: histogram(roadish.map(r => r.maxStepM), [0, 0.05, 0.1, 0.2, 0.4, 0.8]),
    totals: {
      bandGapM2: +sum(r => r.bandGapM2).toFixed(0), centreGapM: +sum(r => r.centreGapM).toFixed(0),
      shows: { deck: sum(r => r.shows.deck), land: sum(r => r.shows.land), hole: sum(r => r.shows.hole), body: sum(r => r.shows.body) },
      causes: { missing: sum(r => r.causes.missing), buried: sum(r => r.causes.buried), masked: sum(r => r.causes.masked) },
      onDeck: sum(r => r.onDeck), offDeck: sum(r => r.offDeck), carriers: Object.fromEntries(['measured', 'side', 'claim', 'way', 'flat', 'none'].map(k => [k, sum(r => r.carriers[k] ?? 0)])),
      bySurvey: Object.fromEntries([...new Set(roadish.flatMap(r => Object.keys(r.bySurvey ?? {})))].sort().map(k => [k, sum(r => r.bySurvey?.[k] ?? 0)])), ties: sum(r => r.ties), gapInWay: sum(r => r.gapInWay), gapApproach: sum(r => r.gapApproach),
    },
    byDeck: { ...Object.fromEntries(['measured', 'side', 'claim', 'way', 'flat', 'none'].map(k => [k, byDeck(r => carrierKind(r.deck) === k)])), movable: byDeck(r => r.movable === true) },
    byGroup: Object.fromEntries((['street', 'cycle', 'motor', 'foot'] as const).map(g => { const rs = rows.filter(r => r.group === g); return [g, { ways: rs.length, withGap: rs.filter(r => r.bandGapM2 >= 5).length, gapM2: +sum(r => r.bandGapM2, rs).toFixed(0) }]; })),
    top20,
  };
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify({ ...summary, top20: undefined }, null, 1));
  for (const r of top20) console.log(`${r.id} ${r.highway} "${r.name}" ${r.deck ?? '-'} ${r.lng},${r.lat} gap ${r.bandGapM2} m² centre ${r.centreGapM} m (longest ${r.longestGapM} at ${r.worstAt}) shows ${JSON.stringify(r.shows)} causes ${JSON.stringify(r.causes)} carriers ${JSON.stringify(r.carriers)} on/off deck ${r.onDeck}/${r.offDeck} step ${r.maxStepM}`);
}

/** Bar chart PNG of the summary's histograms (one series, or before | after with --compare=<label>). */
async function histogramPng(dir: string, label: string, compare?: string): Promise<void> {
  const sharp = (await import('sharp')).default;
  const load = (l: string) => JSON.parse(readFileSync(join(OUT, l, 'summary.json'), 'utf8')) as Record<string, { from: number; to: number | null; count: number }[]>;
  const series = compare ? [[compare, load(compare)], [label, load(label)]] as const : [[label, load(label)]] as const;
  const colours = ['#8a8f98', '#2f6fd0'];
  const charts = [['histogramCentreGapM', 'centreline gap per bridge way, m'], ['histogramBandGapM2', 'carriageway gap per bridge way, m²']] as const;
  const W = 760, H = 300, pad = 46;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H * charts.length + 30}"><rect width="100%" height="100%" fill="#fff"/>`;
  svg += `<text x="${pad}" y="20" font-family="Helvetica" font-size="13" fill="#222">${(series[series.length - 1][1] as unknown as { roadWays: number }).roadWays} street, cycle and motorway bridge ways (footways excluded)${series.map(([l], i) => ` <tspan fill="${colours[compare ? i : 1]}">■ ${l}</tspan>`).join('')}</text>`;
  charts.forEach(([key, title], c) => {
    const y0 = 30 + c * H, bins = series[0][1][key], max = Math.max(...series.flatMap(([, s]) => s[key].map(b => b.count)), 1);
    const bw = (W - 2 * pad) / bins.length, inner = H - 80;
    svg += `<text x="${pad}" y="${y0 + 18}" font-family="Helvetica" font-size="13" fill="#222">${title}</text>`;
    bins.forEach((b, i) => {
      series.forEach(([, s], k) => {
        const n = s[key][i].count, h = inner * n / max, w = (bw - 8) / series.length, x = pad + i * bw + 4 + k * w, y = y0 + 30 + inner - h;
        svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(w - 2).toFixed(1)}" height="${h.toFixed(1)}" fill="${colours[compare ? k : 1]}"/><text x="${(x + w / 2 - 1).toFixed(1)}" y="${(y - 3).toFixed(1)}" font-family="Helvetica" font-size="10" fill="#444" text-anchor="middle">${n}</text>`;
      });
      svg += `<text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${y0 + 30 + inner + 15}" font-family="Helvetica" font-size="11" fill="#444" text-anchor="middle">${b.to === null ? `≥ ${b.from}` : `${b.from}–${b.to}`}</text>`;
    });
  });
  svg += '</svg>';
  await sharp(Buffer.from(svg)).png().toFile(join(dir, compare ? `histogram-${compare}-vs-${label}.png` : 'histogram.png'));
}

if (!process.argv[1]?.endsWith('probe-bridge-gaps.ts')) { /* imported */ }
else if (process.argv.includes('--report')) { report(); await histogramPng(join(OUT, flag('label') ?? 'before'), flag('label') ?? 'before', flag('compare')); }
else await probe();
