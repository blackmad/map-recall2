/**
 * Round 2 (lane postwar-kit-r2-20261121, item 2): balconies on pands nobody read, from a read sibling in the same complex.
 *
 * BAG splits one post-war complex into several pands. A pand inherits a read sibling's balconies (projecting, round or
 * band, and their tone) only when all of these hold:
 *   - it has the read pand's exact construction year (BAG), 1965 or later;
 *   - its footprint touches the read pand's, or touches a pand that does, chained at most MAX_HOPS times, all of that year
 *     and within MAX_DIST_M of the read pand's centroid;
 *   - its height is within HEIGHT_TOL_M of the read pand's (same street-wall geometry: storeys and eaves line);
 *   - it was not itself read (its own read, or its own high-confidence "no balcony", always wins);
 *   - no pand of the complex was read with no balconies, and no two reads in it disagree (a mixed complex infers nothing).
 * The runtime still requires a dated 1965+ housing pand (kit.ts). Ordekaart polygons cover 15 of the 541 cluster members
 * (centrum/ring layers; docs/reports/ordinary-backlog-20261120.json `ordekaart`), so they are not used here.
 *   node --import tsx scripts/postwar-kit/siblings.ts [--publish]
 */
import fs from 'node:fs';
import path from 'node:path';
import { measuredFront, MEASURED_FRONTS } from '../../src/canalRecall/postwarKit/facts.ts';
const { gameChain, loadTile } = await import('../world/pipeline.ts');
export const MAX_HOPS = 3, MAX_DIST_M = 150, HEIGHT_TOL_M = 1.5, TOUCH_M = 0.5;
const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'artifacts/postwar-kit');
const FEAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/postwarKit/feature-reads.json'), 'utf8')).features as Record<string, any>;
const sample = JSON.parse(fs.readFileSync(path.join(OUT, 'sample-all.json'), 'utf8')) as Record<string, any>;
const readNone = new Set(JSON.parse(fs.readFileSync(path.join(OUT, 'read-none.json'), 'utf8')) as string[]);
const BAL = new Set(['projecting', 'round', 'band']);
// Every read: the round-1 eye reads first, then the feature reads.
type Read = { balcony: string; tone: string };
const reads = new Map<string, Read | null>();
for (const r of MEASURED_FRONTS) reads.set(r.id, BAL.has(r.balcony) ? { balcony: r.balcony, tone: r.balconyTone ?? 'white' } : null);
for (const id of readNone) if (!reads.has(id)) reads.set(id, null);
for (const [id, f] of Object.entries(FEAT)) if (!reads.has(id)) reads.set(id, f.balcony ? { balcony: f.balcony, tone: f.balconyTone } : null);
// Any sampled pand read at all (usable), so its own read wins even when it says nothing drawable.
const parts = [1, 2, 3, 4].flatMap(i => JSON.parse(fs.readFileSync(path.join(OUT, `feature-reads/part-${i}.json`), 'utf8')) as any[]);
const anyRead = new Set([...parts.filter(r => r.usable).map(r => r.id), ...MEASURED_FRONTS.map(r => r.id)]);

const tileOf = (lng: number, lat: number) => { const n = 2 ** 14; return `${Math.floor((lng + 180) / 360 * n)}/${Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n)}`; };
const seeds = [...reads.keys()].filter(id => sample[id]?.centroid);
const tiles = new Set<string>();
for (const id of seeds) { const [lng, lat] = sample[id].centroid; for (const dx of [-0.003, 0, 0.003]) for (const dy of [-0.002, 0, 0.002]) tiles.add(tileOf(lng + dx, lat + dy)); }
type P = { id: string; year: number | null; h: number; ring: Array<[number, number]>; c: [number, number] };
const K_LAT = 110_540, K_LNG = 111_320 * Math.cos(52.37 * Math.PI / 180);
const pands = new Map<string, P>();
const chain = gameChain();
for (const t of tiles) for (const row of await loadTile(t, chain)) {
  const f = row.styled, id = String(f.properties.id ?? '').replace('NL.IMBAG.Pand.', '');
  if (!/^\d{16}$/.test(id) || pands.has(id)) continue;
  const g = f.geometry, ring = (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]).map(([x, y]: number[]) => [x * K_LNG, y * K_LAT] as [number, number]);
  const c: [number, number] = [ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length, ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length];
  pands.set(id, { id, year: Number(f.properties.constructionYear) || null, h: Number(f.properties.height) || 0, ring, c });
}
const segDist = (p: [number, number], a: [number, number], b: [number, number]) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const touches = (p: P, q: P) => Math.hypot(p.c[0] - q.c[0], p.c[1] - q.c[1]) < 400 && (p.ring.some(v => q.ring.some((a, i) => i && segDist(v, q.ring[i - 1], a) < TOUCH_M)) || q.ring.some(v => p.ring.some((a, i) => i && segDist(v, p.ring[i - 1], a) < TOUCH_M)));
const grid = new Map<string, P[]>();
const cell = (x: number, y: number) => `${Math.floor(x / 100)},${Math.floor(y / 100)}`;
for (const p of pands.values()) { const k = cell(p.c[0], p.c[1]); grid.set(k, [...(grid.get(k) ?? []), p]); }
const near = (p: P) => { const out: P[] = []; const [cx, cy] = [Math.floor(p.c[0] / 100), Math.floor(p.c[1] / 100)]; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) out.push(...(grid.get(`${cx + i},${cy + j}`) ?? [])); return out; };

const inferred: Record<string, any> = {}, conflicts: Record<string, string[]> = {};
const complexes: Array<{ seed: string; members: string[]; verdict: string }> = [];
for (const seed of seeds) {
  const s = pands.get(seed), read = reads.get(seed);
  if (!s || !s.year || s.year < 1965 || !read) continue;
  // The complex: same year, touching, chained, near, same height.
  const members = new Set([seed]); let frontier = [s];
  for (let hop = 0; hop < MAX_HOPS && frontier.length; hop++) {
    const next: P[] = [];
    for (const p of frontier) for (const q of near(p)) if (!members.has(q.id) && q.year === s.year && Math.abs(q.h - s.h) <= HEIGHT_TOL_M && Math.hypot(q.c[0] - s.c[0], q.c[1] - s.c[1]) <= MAX_DIST_M && touches(p, q)) { members.add(q.id); next.push(q); }
    frontier = next;
  }
  const others = [...members].filter(id => id !== seed);
  const readOthers = others.filter(id => reads.has(id) || anyRead.has(id));
  const disagree = readOthers.filter(id => { const r = reads.get(id); return !r || r.balcony !== read.balcony; });
  let verdict = 'ok';
  if (disagree.length) { verdict = `mixed: ${disagree.join(',')}`; conflicts[seed] = disagree; }
  complexes.push({ seed, members: others, verdict });
  if (verdict !== 'ok') continue;
  for (const id of others) if (!anyRead.has(id) && !reads.has(id)) {
    if (inferred[id] && inferred[id].balcony !== read.balcony) { inferred[id] = { conflict: true }; continue; }
    inferred[id] ??= { balcony: read.balcony, balconyTone: read.tone, from: seed };
  }
}
for (const id of Object.keys(inferred)) if (inferred[id].conflict) delete inferred[id];
fs.writeFileSync(path.join(OUT, 'siblings.json'), JSON.stringify({ complexes, inferred }, null, 1));
console.log(`seeds with balconies ${complexes.length}; complexes with siblings ${complexes.filter(c => c.members.length).length}; mixed ${Object.keys(conflicts).length}; inferred ${Object.keys(inferred).length}`);
if (process.argv.includes('--publish')) fs.writeFileSync(path.join(ROOT, 'src/canalRecall/postwarKit/sibling-features.json'), JSON.stringify({ schemaVersion: 1, revision: 'postwar-siblings/v1 2026-11-21',
  method: 'scripts/postwar-kit/siblings.ts: same BAG year, touching footprints (<= 3 hops, <= 150 m), height within 1.5 m, no disagreeing read in the complex', siblings: Object.fromEntries(Object.entries(inferred).sort(([a], [b]) => a.localeCompare(b))) }, null, 1) + '\n');
