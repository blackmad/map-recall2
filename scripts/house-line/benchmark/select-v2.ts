/**
 * Wall-colour benchmark v2 (lane W3, 2026-11-12): an unbiased draw of generic-path pre-1945 street walls, for judging
 * wall-colour rules (the measured wall pool and its variety draw) without F4 v1's selection: v1's wall-colour pairs were
 * picked where the game drew pale over dark brick, so they reward the median.
 *
 *   node --import tsx scripts/house-line/benchmark/select-v2.ts [--n 360] [--seed 20261112] [--out staging/benchmark-v2/candidates.json]
 *
 * Population: every pand of the game chain in the ride-priority gebieden (src/canalRecall/ridePriority.ts) that the generic
 * path draws with a pre-1945 archetype (canal, c19, school), without a photo reading (no houseSpec wallHex: the settings
 * under test only differ there), not hidden by an installed model or kit (covers.json), 6 m tall or more.
 * Weights: Centrum-West and Centrum-Oost (the canal belt) 2, the inner-ring gebieden 1. A weighted draw without
 * replacement (Efraimidis-Spirakis keys from a seeded hash), so a rerun with the same seed is the same list.
 * Nothing about the game's current colour enters. The pose filter (winter, a capture within 30 deg, no relaxed pick) and the
 * otherBuilding re-pick are applied after `house:frames --prep-only`, by finalize-v2.ts; the pale share is reported there.
 */
import '../../world/useBrowserMath.js';
import fs from 'node:fs';
import path from 'node:path';
import { EXTRACT, ROOT, gameChain, loadTile, readJson } from '../../world/pipeline.ts';
import { asPolygons } from '../../../src/canalRecall/threeBuildingFeatures.ts';
import { archetypeFor } from '../../../src/canalRecall/bayTextures.ts';
import { RIDE_PRIORITY_GEBIEDEN } from '../../../src/canalRecall/ridePriority.ts';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const N = Number(arg('n') ?? 360), SEED = Number(arg('seed') ?? 20261112), OUT = path.resolve(arg('out') ?? 'staging/benchmark-v2/candidates.json');
const BELT = new Set(['Centrum-West', 'Centrum-Oost']);

type Ring = number[][];
const polys = (g: any): Ring[][] => g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
const inside = (p: number[], ring: Ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const buurten = (readJson(path.join(EXTRACT, 'coverage-v1/buurten.json')).features as any[]).filter(b => RIDE_PRIORITY_GEBIEDEN.has(b.properties.gebied));
const bbox = buurten.flatMap(b => polys(b.geometry).flatMap(p => p[0])).reduce((a, [x, y]) => [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)], [180, 90, -180, -90]);
const tileX = (lng: number) => Math.floor(((lng + 180) / 360) * 2 ** 14);
const tileY = (lat: number) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** 14); };
const tiles: string[] = [];
for (let x = tileX(bbox[0]); x <= tileX(bbox[2]); x++) for (let y = tileY(bbox[3]); y <= tileY(bbox[1]); y++) if (fs.existsSync(path.join(EXTRACT, `building-tiles/14/${x}/${y}.geojson.gz`))) tiles.push(`${x}/${y}`);

const covers = readJson(path.join(ROOT, 'public/canal-drive/models/covers.json'));
const hidden = new Set<string>([...Object.values<any>(covers.models).flatMap(m => m.p ?? []), ...covers.buildingTypes].map(String));
// A seeded hash in [0, 1): FNV-1a of seed and id.
const unit = (id: string) => { let h = 2166136261 ^ SEED; for (const ch of id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) + 0.5) / 2 ** 32; };
process.env.HOUSE_SPECS = '1'; // stamp the photo readings, so measured pands are excluded
const chain = gameChain();
const pool: Array<{ pandId: string; gebied: string; buurt: string; archetype: string; year: number | null; heightM: number; at: [number, number]; key: number }> = [];
const counts = { tiles: tiles.length, rows: 0, outside: 0, notGeneric: 0, modern: 0, measured: 0, hidden: 0, low: 0 };
for (const tile of tiles) for (const r of await loadTile(tile, chain)) {
  counts.rows++;
  const p = r.styled.properties as Record<string, any>, id = String(p.id).slice(-16);
  const ring = asPolygons(r.styled.geometry)[0]?.[0] ?? [];
  if (!ring.length) continue;
  const c: [number, number] = [ring.reduce((s, q) => s + q[0], 0) / ring.length, ring.reduce((s, q) => s + q[1], 0) / ring.length];
  const b = buurten.find(bu => polys(bu.geometry).some(pp => inside(c, pp[0])));
  if (!b) { counts.outside++; continue; }
  if (typeof p.facade !== 'string' || !p.facadeStyle || p.largeTier || p.kitWall || p.frontCarrier) { counts.notGeneric++; continue; }
  if (hidden.has(id)) { counts.hidden++; continue; }
  if ((r.raw.properties as any).houseSpec?.wallHex || (p.houseSpec as any)?.wallHex || p.specRecipe?.wallHex || p.specRecipe?.heldBrick) { counts.measured++; continue; }
  const heightM = Number(p.height) || 0;
  if (heightM < 6) { counts.low++; continue; }
  const year = p.constructionYear == null || !Number.isFinite(Number(p.constructionYear)) ? null : Number(p.constructionYear);
  const archetype = archetypeFor(String(p.id), year, heightM);
  if (archetype === 'modern') { counts.modern++; continue; }
  const w = BELT.has(b.properties.gebied) ? 2 : 1;
  pool.push({ pandId: id, gebied: b.properties.gebied, buurt: b.properties.code ?? b.properties.naam, archetype, year, heightM, at: c, key: Math.log(unit(id)) / w });
}
pool.sort((a, b) => b.key - a.key || a.pandId.localeCompare(b.pandId));
const pick = pool.slice(0, N);
const by = (k: 'gebied' | 'archetype') => Object.fromEntries([...new Set(pool.map(p => p[k]))].map(v => [v, { population: pool.filter(p => p[k] === v).length, drawn: pick.filter(p => p[k] === v).length }]));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ v: 2, seed: SEED, n: pick.length, population: pool.length, counts, byGebied: by('gebied'), byArchetype: by('archetype'), pands: pick.map(({ key, ...p }) => p) }, null, 1));
fs.writeFileSync(OUT.replace(/\.json$/, '.frames.json'), JSON.stringify(pick.map(p => ({ pandId: p.pandId, key: p.pandId, maxDistM: 35 })), null, 1));
console.log(JSON.stringify({ population: pool.length, drawn: pick.length, counts, byGebied: by('gebied') }));
