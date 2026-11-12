// City-wide ground defect audit (lane G0 of the Ground v2 plan, 2026-11-10). See HELP.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type CellInput } from '../../src/canalRecall/ownGround/groundCell.ts';
import { decodeLine } from '../../src/canalRecall/ownGround/parks.ts';
import { concentration, weightField, RIDEABLE_HIGHWAYS, ringSegments, segmentsOf, type Seg } from '../../src/canalRecall/ownGround/groundVisibility.ts';
import { auditCell, ringBox, tallyJson, addDefects, emptyDefects, DEFECTS, type CellAudit, type OpenRing, type Window, type Tally, AUDIT } from '../../src/canalRecall/ownGround/groundAudit.ts';
import { GROUND_SPOTS, GROUND_SPOT_RADIUS_M } from '../../src/canalRecall/ownGround/groundRegressions.ts';
import { isRidePriority } from '../../src/canalRecall/ridePriority.ts';

export const HELP = `ground:audit — city-wide ground defect audit (lane G0, Ground v2 plan 2026-11-10)

Builds every ground cell in Node (the worker's code path, buildCell, from the published extracts; no browser) and measures
slivers, poke-through, z-fight, cracks, float, T-junction cracks and the tunnel portals per cell and per 125 m tile.

  npm run ground:audit -- --city                 every cell (~25 min), writes <out>/baseline.json (G2's baseline)
  npm run ground:audit -- --named                the named places: audit, rank gate, A/B by layer; writes <out>/named.json
  npm run ground:audit -- --near 4.851,52.344    one place (--radius m, default ${GROUND_SPOT_RADIUS_M}); prints its numbers
  npm run ground:audit -- --cells=-4_-3,-3_-4    chosen cells
  npm run ground:audit -- --help

Options:
  --out <dir>      output directory (default artifacts/ground-audit)
  --res <m>        raster step in metres (default ${AUDIT.resM})
  --no-tj          skip the T-junction pass
  --spots          the A/B alone on the named places' cells (no ranking gate; no baseline needed); --variants=a,b picks variants, --tag=x names the file spots-x.json
  --no-ab          with --named: skip the layer A/B
  --lod 0|1        cell level (default 0, the near build)

Definitions: sliver = aspect > ${AUDIT.sliverAspect} and area > ${AUDIT.sliverMinM2} m2; poke = lower-precedence layer above a higher one by more than
${AUDIT.pokeM * 1000} mm (up to ${AUDIT.pokeMaxM} m); z-fight = two layers within ${AUDIT.zfightM * 1000} mm; crack = raster sample under no layer; float = natural ground more than
${AUDIT.floatM} m over the DTM; shard area = flagged samples + sliver area. The ranking weights a cell by the ride-priority share (ridePriority.ts).
Exit code 1 when --named fails the gate (at least 7 of the 9 named places in the top 50 tiles by the visibility score).
`;

const arg = (n: string) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); if (a) return a.slice(n.length + 3); const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : undefined; };
const has = (n: string) => process.argv.some(x => x === `--${n}` || x.startsWith(`--${n}=`));
if (has('help') || has('h') || process.argv.length <= 2) { console.log(HELP); process.exit(0); }

const ROOT = 'public/data/extracts/amsterdam';
const OUT = arg('out') ?? 'artifacts/ground-audit';
const RES = Number(arg('res') ?? AUDIT.resM), LOD = (Number(arg('lod') ?? 0) as 0 | 1), NO_TJ = has('no-tj');
const read = async (path: string) => {
  const file = join(ROOT, path);
  if (!existsSync(file)) throw new Error(`${path}: missing`);
  const bytes = readFileSync(file);
  return new Uint8Array(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);
};

/** Store options per A/B variant: the game's defaults, then one layer or fix toggled. */
const BASE = { parks: true, roads: true, rails: true } as const;
export const VARIANTS: Record<string, Record<string, unknown>> = {
  default: {},
  'openGround=0': { openGround: false },
  'parks=0': { parks: false },
  'courtyards=0': { courtyards: false },
  'roads=0': { roads: false },
  'rails=0': { rails: false },
  'tunnels=0': { tunnels: false },
  'portalEnds=0': { portalEnds: false },
  'portalClip=0': { portalClip: false },
  'dryWayDecks=1': { dryWayDecks: true },
  /** lane rails-uncover (a1): dry way decks for bridges over a track; the options exist on that branch only. */
  'railDecks=0': { railDecks: false },
};

async function openStore(variant: string): Promise<GroundStore> {
  const s = new GroundStore(read, { ...BASE, ...VARIANTS[variant] } as never);
  await s.init();
  return s;
}

// Ride priority per cell: share of a 100 m sample grid inside a ride-priority buurt.
type Poly = { bb: [number, number, number, number]; rings: [number, number][][]; priority: boolean };
let buurten: Poly[] | null = null;
function loadBuurten(): Poly[] {
  if (buurten) return buurten;
  const j = JSON.parse(readFileSync(join(ROOT, 'coverage-v1/buurten.json'), 'utf8')) as { features: { properties: { gebied?: string }; geometry: { type: string; coordinates: any } }[] };
  buurten = j.features.flatMap(f => {
    const polys: [number, number][][][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    return polys.map(p => ({ rings: p as [number, number][][], bb: ringBox(p[0] as [number, number][]), priority: isRidePriority(f.properties) })) as unknown as Poly[];
  });
  return buurten;
}
const inRing = (x: number, y: number, ring: readonly [number, number][]) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
function priorityShare(rect: [number, number, number, number]): number {
  const bs = loadBuurten(); let n = 0, hit = 0;
  for (let x = rect[0] + 50; x < rect[2]; x += 100) for (let y = rect[1] + 50; y < rect[3]; y += 100) {
    n++;
    const [lng, lat] = fromLocal(x, y);
    for (const b of bs) { if (lng < b.bb[0] || lng > b.bb[2] || lat < b.bb[1] || lat > b.bb[3]) continue; if (inRing(lng, lat, b.rings[0]) && !b.rings.slice(1).some(h => inRing(lng, lat, h))) { if (b.priority) hit++; break; } }
  }
  return n ? hit / n : 0;
}

interface PortalRow { id: string; way: number; kind: string; motor: boolean; closedMouths: number; openPortals: number; tunnelWay: boolean; /** Closed mouths with no tunnel-tagged OSM way having a vertex within TUNNEL_NEAR_M of the portal: a dark mouth with no tunnel there. */ unsupportedMouths: number }
const TUNNEL_NEAR_M = 25;
function portals(input: CellInput): PortalRow[] {
  const tunnels = new Set<number>(), pts: [number, number][] = [];
  for (const o of [input.osm, ...input.osmAround]) for (const w of o?.ways ?? []) if (w.tags.tunnel && w.tags.tunnel !== 'no') { tunnels.add(w.id); for (const g of w.g) pts.push(toLocal(g[0], g[1])); }
  const [x0, y0, x1, y1] = input.rect;
  return (input.cuts ?? []).filter(c => { const cx = (c.bbox[0] + c.bbox[2]) / 2, cy = (c.bbox[1] + c.bbox[3]) / 2; return cx >= x0 && cx < x1 && cy >= y0 && cy < y1; }).map(c => ({
    id: c.id, way: c.way, kind: c.kind, motor: c.motor, closedMouths: c.portals.filter(p => !p.open).length, openPortals: c.portals.filter(p => p.open).length, tunnelWay: tunnels.has(c.way),
    unsupportedMouths: c.portals.filter(p => !p.open && !pts.some(q => Math.hypot(q[0] - c.x[p.at], q[1] - c.y[p.at]) <= TUNNEL_NEAR_M)).length,
  }));
}

/** Rideable-way and structure segments around a cell, as a weight-field factory (groundVisibility.ts). */
function weightsOf(input: CellInput) {
  const ways: Seg[] = [], structs: Seg[] = [];
  for (const o of [input.osm, ...input.osmAround]) for (const w of o?.ways ?? []) if (RIDEABLE_HIGHWAYS.has(w.tags.highway) && !(w.tags.tunnel && w.tags.tunnel !== 'no' && w.tags.highway !== 'cycleway')) segmentsOf(w.g.map(g => toLocal(g[0], g[1])), ways);
  for (const ring of input.deckRingsAround) ringSegments(ring, structs);
  for (const c of input.cuts ?? []) { segmentsOf(c.x.map((x, i) => [x, c.y[i]] as [number, number]), structs); for (const p of c.portals) structs.push([c.x[p.at], c.y[p.at], c.x[p.at], c.y[p.at]]); }
  for (const r of [...(input.rails ?? [])]) if (!r.service) segmentsOf(r.points, structs);
  return (x0: number, y0: number, size: number) => weightField(ways, structs, x0, y0, size);
}

async function auditKey(store: GroundStore, key: string, windows: Window[] = []): Promise<{ audit: CellAudit; input: CellInput; buildMs: number; auditMs: number; triangles: number }> {
  const input = await store.cellInput(key, LOD);
  const cell = buildCell(input);
  const openRings: OpenRing[] = [input.openGround, ...(input.openGroundAround ?? [])].filter((c, i, all): c is NonNullable<typeof c> => !!c && all.indexOf(c) === i)
    .flatMap(c => c.areas.map(a => { const r = a.r.map(decodeLine); return { pts: r[0], holes: r.slice(1), bb: ringBox(r[0]) }; })).filter(r => r.pts.length >= 3);
  const t0 = Date.now();
  const audit = auditCell({ cell, dtm: store.surface.relief, windows, openRings, resM: RES, noTJunctions: NO_TJ, weights: weightsOf(input) });
  return { audit, input, buildMs: cell.stats.buildMs, auditMs: Date.now() - t0, triangles: cell.stats.triangles };
}

const spotLocal = (s: { lng: number; lat: number }) => toLocal(s.lng, s.lat);
const windowsFor = (store: GroundStore, key: string): Window[] => GROUND_SPOTS.filter(s => store.cellAt(...spotLocal(s)) === key).map(s => { const [x, y] = spotLocal(s); return { id: s.id, x, y, r: GROUND_SPOT_RADIUS_M }; });
const fmt = (t: Tally) => `shard ${t.d.shardM2.toFixed(0)} m2 (sliver ${t.d.sliverM2.toFixed(0)}/${t.d.sliverN} thin ${t.d.thinM2.toFixed(0)}, poke ${t.d.pokeM2.toFixed(0)}, zfight ${t.d.zfightM2.toFixed(0)}, crack ${t.d.crackM2.toFixed(0)} void ${t.d.voidM2.toFixed(0)}, float ${t.d.floatM2.toFixed(0)}), in open ground ${t.openGroundShardM2.toFixed(0)}`;
const save = (name: string, v: unknown) => { mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, name), JSON.stringify(v) + '\n'); console.log(`wrote ${join(OUT, name)}`); };

async function city(keys?: string[]) {
  const store = await openStore('default');
  const sh = arg('shard')?.split('/').map(Number);
  const all = (keys ?? [...store.osmCells].sort()).filter(k => store.covers(k)).filter((_, i) => !sh || i % sh[1] === sh[0]);
  const rows: any[] = [], tiles: { cell: string; tile: string; x: number; y: number; weight: number; t: Tally }[] = [];
  const t0 = Date.now();
  for (const key of all) {
    const r = await auditKey(store, key, windowsFor(store, key));
    const w = priorityShare(r.input.rect), p = portals(r.input);
    const near = r.triangles > 0 && store.fullyCovered(key);
    rows.push({ key, rect: r.input.rect.map(v => Math.round(v)), triangles: r.triangles, buildMs: r.buildMs, auditMs: r.auditMs, priorityShare: +w.toFixed(3), nearCoverage: near, ...(tallyJson(r.audit.total) as object), tjunctions: { n: r.audit.tjunctions.n, lengthM: +r.audit.tjunctions.lengthM.toFixed(0), worstDzM: +r.audit.tjunctions.worstDzM.toFixed(3) }, portals: { cuts: p.length, closedMouths: p.reduce((s, c) => s + c.closedMouths, 0), mouthsWithoutTunnelWay: p.filter(c => c.closedMouths && !c.tunnelWay).reduce((s, c) => s + c.closedMouths, 0), unsupportedMouths: p.reduce((s, c) => s + c.unsupportedMouths, 0), rows: p.filter(c => c.closedMouths || c.openPortals) } });
    for (const [k, t] of r.audit.tiles) { const [i, j] = k.split('_').map(Number); tiles.push({ cell: key, tile: k, x: Math.round(r.input.rect[0] + (i + 0.5) * AUDIT.tileM), y: Math.round(r.input.rect[1] + (j + 0.5) * AUDIT.tileM), weight: w, t }); }
    console.log(`${key} ${((Date.now() - t0) / 1000).toFixed(0)}s tri ${r.triangles} build ${r.buildMs} ms audit ${r.auditMs} ms w ${w.toFixed(2)} ${fmt(r.audit.total)} tj ${r.audit.tjunctions.n}`);
    store.forgetCells(new Set(GroundStore.neighbours(key)));
  }
  return { store, rows, tiles };
}

/** Ranking scores over a defect total: `tear` (the gate's) is what the eye reads as torn ground; the others are reported beside it. */
/** What a score reads: the defect totals, the visibility-weighted defect and area (groundVisibility.ts), the ride-priority share. */
interface Scored { d: any; wDefectM2: number; wAreaM2: number; prio: number }
export const SCORES: Record<string, (x: Scored) => number> = {
  /** The gate (G0 r2): visibility- and crossing-weighted defect m2 per weighted hectare, times 1 + ride priority. */
  visibility: x => concentration(x.wDefectM2, x.wAreaM2, x.prio),
  shard: x => x.d.shardM2 * (1 + x.prio),
  tear: x => (x.d.pokeSevereM2 + x.d.crackM2 + 20 * (x.d.tjSevereN ?? 0)) * (1 + x.prio),
  severe: x => (x.d.pokeSevereM2 + x.d.floatSevereM2 + x.d.crackM2 + x.d.thinM2 + 20 * (x.d.tjSevereN ?? 0)) * (1 + x.prio),
  poke5cm: x => x.d.pokeSevereM2 * (1 + x.prio),
  poke5mm: x => x.d.pokeM2 * (1 + x.prio),
  thin: x => x.d.thinM2 * (1 + x.prio),
  float: x => x.d.floatM2 * (1 + x.prio),
  zfight: x => x.d.zfightM2 * (1 + x.prio),
};
const GATE_SCORE = 'visibility';
const GATE_MIN = 7, GATE_TOP = 50;
const ofRow = (r: any): Scored => ({ d: r, wDefectM2: r.wDefectM2 ?? 0, wAreaM2: r.wAreaM2 ?? 0, prio: r.priorityShare ?? 0 });
const ofTile = (t: { weight: number; t: Tally }): Scored => ({ d: t.t.d, wDefectM2: t.t.wDefectM2, wAreaM2: t.t.wAreaM2, prio: t.weight });
const score = (x: Scored, name = GATE_SCORE) => SCORES[name](x);

function rankings(rows: any[], tiles: { cell: string; tile: string; x: number; y: number; weight: number; t: Tally }[]) {
  const cellRank = [...rows].sort((a, b) => score(ofRow(b)) - score(ofRow(a))).map((r, i) => ({ rank: i + 1, key: r.key as string, score: +score(ofRow(r)).toFixed(1), shardM2: r.shardM2 as number }));
  const tileRank = [...tiles].sort((a, b) => score(ofTile(b)) - score(ofTile(a))).map((t, i) => ({ rank: i + 1, ...t }));
  // Where each named place stands (best tile within its radius) under every score, over all tiles.
  const spotRanks = GROUND_SPOTS.map(sp => {
    const [x, y] = toLocal(sp.lng, sp.lat), near = tiles.filter(t => Math.hypot(t.x - x, t.y - y) <= GROUND_SPOT_RADIUS_M);
    const ranks: Record<string, number> = {};
    for (const name of Object.keys(SCORES)) {
      const sorted = [...tiles].sort((a, b) => score(ofTile(b), name) - score(ofTile(a), name));
      const idx = new Map(sorted.map((t, i) => [t, i + 1]));
      ranks[name] = Math.min(...near.map(t => idx.get(t) ?? 1e9));
    }
    return { id: sp.id, tiles: near.length, ranks };
  });
  return { cellRank, tileRank, spotRanks };
}

const sumTallies = (ts: Tally[]) => { const o = { d: emptyDefects(), openGroundShardM2: 0 }; for (const t of ts) { o.d = addDefects(o.d, t.d); o.openGroundShardM2 += t.openGroundShardM2; } return o; };

async function main() {
  if (has('near')) {
    const [lng, lat] = arg('near')!.split(',').map(Number), r = Number(arg('radius') ?? GROUND_SPOT_RADIUS_M);
    const store = await openStore('default'), [x, y] = toLocal(lng, lat), key = store.cellAt(x, y);
    const res = await auditKey(store, key, [{ id: 'near', x, y, r }]);
    console.log(`cell ${key}: ${fmt(res.audit.total)}\nwithin ${r} m: ${fmt(res.audit.windows.near)}\nT-junctions ${JSON.stringify(res.audit.tjunctions)}`);
    return;
  }
  if (has('cells')) { const out = await city(arg('cells')!.split(',')); save('cells.json', { rows: out.rows, tiles: out.tiles.map(t => ({ cell: t.cell, tile: t.tile, x: t.x, y: t.y, weight: t.weight, tally: tallyJson(t.t) })) }); return; }
  if (has('city') && arg('shard')) {
    const { rows, tiles } = await city();
    save(`part${arg('shard')!.split('/')[0]}.json`, { rows, tiles: tiles.filter(t => t.t.d.shardM2 >= 1).map(t => ({ cell: t.cell, tile: t.tile, x: t.x, y: t.y, weight: t.weight, tally: tallyJson(t.t) })) });
    return;
  }
  if (has('city') || has('merge')) {
    let rows: any[], tiles: { cell: string; tile: string; x: number; y: number; weight: number; t: Tally }[];
    if (has('merge')) {
      const parts = [0, 1, 2, 3, 4, 5, 6, 7].map(i => join(OUT, `part${i}.json`)).filter(f => existsSync(f)).map(f => JSON.parse(readFileSync(f, 'utf8')));
      rows = parts.flatMap(p => p.rows);
      tiles = parts.flatMap(p => p.tiles.map((t: any) => ({ ...t, t: { d: t.tally, byLayer: t.tally.byLayer, openGroundShardM2: t.tally.openGroundShardM2, wDefectM2: t.tally.wDefectM2, wAreaM2: t.tally.wAreaM2 } })));
    } else ({ rows, tiles } = await city());
    const { cellRank, tileRank, spotRanks } = rankings(rows, tiles);
    const total = sumTallies(rows.map(r => ({ d: r as any, openGroundShardM2: r.openGroundShardM2 }) as Tally));
    const causes: Record<string, number> = {};
    for (const r of rows) for (const [l, row] of Object.entries(r.byLayer as Record<string, Record<string, number>>)) for (const [k, v] of Object.entries(row)) causes[`${k}:${l}`] = (causes[`${k}:${l}`] ?? 0) + v;
    save('baseline.json', { generated: new Date().toISOString().slice(0, 10), base: '34e809901', resM: RES, lod: LOD, thresholds: AUDIT, totals: { cells: rows.length, ...total.d, openGroundShardM2: Math.round(total.openGroundShardM2) }, causes: Object.fromEntries(Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v)])), gateScore: GATE_SCORE, tilesAudited: tiles.length, spotRanks, cellRank: cellRank.slice(0, 100), tileTop: tileRank.slice(0, 200).map(t => ({ rank: t.rank, cell: t.cell, tile: t.tile, x: t.x, y: t.y, w: +t.weight.toFixed(2), ...(tallyJson(t.t) as object) })), cells: rows });
    return;
  }
  if (has('named') || has('spots')) {
    // City rank first (the gate), from the baseline when present.
    const baselineFile = join(OUT, 'baseline.json');
    if (!has('spots') && !existsSync(baselineFile)) throw new Error('run --city first (the gate needs the ranking)');
    const base = has('spots') ? { cellRank: [], tileTop: [] } : JSON.parse(readFileSync(baselineFile, 'utf8'));
    const tileAll = base.tileTop as any[];
    const store0 = await openStore('default');
    const gate = GROUND_SPOTS.map(s => {
      const [x, y] = spotLocal(s), key = store0.cellAt(x, y), rect = store0.cellRect(key);
      const tile = `${Math.floor((x - rect[0]) / AUDIT.tileM)}_${Math.floor((y - rect[1]) / AUDIT.tileM)}`;
      const cr = (base.cellRank as any[]).find(c => c.key === key);
      const sr = (base.spotRanks as any[] | undefined)?.find(r => r.id === s.id);
      return { id: s.id, cell: key, cellRank: cr?.rank ?? null, tile, tileRank: sr?.ranks?.[GATE_SCORE] ?? null, ranks: sr?.ranks ?? null };
    });
    const keys = [...new Set(gate.map(g => g.cell))];
    // A/B: per variant, every distinct cell, window sums.
    const names = has('variants') ? arg('variants')!.split(',') : has('no-ab') ? ['default'] : Object.keys(VARIANTS);
    const ab: Record<string, { perSpot: Record<string, any>; sum: any }> = {};
    for (const v of names) {
      const store = await openStore(v), perSpot: Record<string, any> = {}, tallies: Tally[] = [];
      for (const key of keys) {
        const r = await auditKey(store, key, windowsFor(store, key));
        for (const [id, t] of Object.entries(r.audit.windows)) { perSpot[id] = tallyJson(t); tallies.push(t); }
        console.log(`${v} ${key}: ${fmt(r.audit.total)}`);
      }
      const s = sumTallies(tallies);
      ab[v] = { perSpot, sum: { ...s.d, openGroundShardM2: s.openGroundShardM2 } };
      console.log(`== ${v}: ${fmt({ ...s, byLayer: {} } as Tally)}`);
    }
    const dflt = ab.default.sum.shardM2;
    const shares = Object.fromEntries(names.filter(n => n !== 'default').map(n => [n, { shardM2: Math.round(ab[n].sum.shardM2), deltaM2: Math.round(dflt - ab[n].sum.shardM2), sharePct: +(((dflt - ab[n].sum.shardM2) / dflt) * 100).toFixed(1) }]));
    const ogDirect = ab.default.sum.openGroundShardM2;
    save(has('spots') ? `spots-${arg('tag') ?? 'x'}.json` : 'named.json', { generated: new Date().toISOString().slice(0, 10), radiusM: GROUND_SPOT_RADIUS_M, resM: RES, gate, gatePass: has('spots') ? null : gate.filter(g => (g.tileRank ?? 1e9) <= GATE_TOP).length >= GATE_MIN, gateInTop: gate.filter(g => (g.tileRank ?? 1e9) <= GATE_TOP).length, gateScore: GATE_SCORE, ab: Object.fromEntries(names.map(n => [n, ab[n]])), shares, openGroundDirect: { shardM2: Math.round(ogDirect), sharePct: +((ogDirect / dflt) * 100).toFixed(1) } });
    console.log(JSON.stringify({ gate, shares, openGroundDirect: ogDirect / dflt }, null, 1));
    if (!has('spots') && gate.filter(g => (g.tileRank ?? 1e9) <= GATE_TOP).length < GATE_MIN) process.exitCode = 1;
    return;
  }
  console.log(HELP);
}
void DEFECTS;
await main();
