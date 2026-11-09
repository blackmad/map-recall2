// The pool landmark spaced review works on (#300): landmarks that can be asked
// (worth a card through isWorthACard after buildLandmarks' mapping, and with a
// hand-built model), per buurt, for the buurten the daily ride starts/ends in.
//
//   npx tsx scripts/landmark-review/askable-pool.ts [--json]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isWorthACard } from '../../src/canalRecall/game/landmarkData.ts';
import { DAILY_RIDE_POOL } from '../../src/canalRecall/game/dailyRidePool.ts';
import { MANUAL_LANDMARKS } from '../../src/canalRecall/landmarks/manualModels.ts';

type LatLon = [number, number];
type Boundary = { id: string; name: string; kind: string; geometry: LatLon[][][] };
const BUURT_KINDS = new Set(['quarter', 'neighbourhood', 'neighborhood', 'city_block']);
const dir = path.resolve('public/data/extracts/amsterdam');
const read = <T>(file: string): T => JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as T;

const features = read<Array<Record<string, any>>>('landmarks.json');
const boundaries = read<Boundary[]>('boundaries.json').filter(b => BUURT_KINDS.has(b.kind));
const modelled = new Set((MANUAL_LANDMARKS as unknown as ReadonlyArray<{ landmarkId?: string }>).flatMap(s => (s.landmarkId ? [s.landmarkId] : [])));

function inRing([lat, lon]: LatLon, ring: LatLon[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i]!, [yj, xj] = ring[j]!;
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const area = (b: Boundary) => b.geometry.reduce((sum, poly) => {
  const ring = poly[0] || [];
  let a = 0;
  for (let i = 0; i < ring.length; i++) { const [y0, x0] = ring[i]!, [y1, x1] = ring[(i + 1) % ring.length]!; a += x0 * y1 - x1 * y0; }
  return sum + Math.abs(a / 2);
}, 0);
const inside = (p: LatLon, b: Boundary) => b.geometry.some(poly => poly[0] && inRing(p, poly[0]) && !poly.slice(1).some(h => inRing(p, h)));
const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Every buurt polygon (any level) a point lies in: a quarter key counts its neighbourhoods' landmarks. */
const containing = (p: LatLon) => boundaries.filter(b => inside(p, b)).sort((a, b) => area(a) - area(b));

const counts = new Map<string, { card: number; askable: number; names: string[] }>();
let card = 0, askable = 0;
for (const f of features) {
  const center = (f.center || f.path?.[0]) as LatLon | undefined;
  if (!center) continue;
  const worth = isWorthACard({
    detail: f.funFact || f.wikipediaExtract || '', imageUrl: f.wikipediaImageUrl || '', wikipediaUrl: f.wikipediaUrl || '',
  });
  if (!worth) continue;
  card++;
  const isAskable = modelled.has(f.id);
  if (isAskable) askable++;
  for (const key of new Set(containing(center).map(b => slug(b.name)))) {
    const row = counts.get(key) ?? { card: 0, askable: 0, names: [] };
    row.card++;
    if (isAskable) { row.askable++; row.names.push(f.name); }
    counts.set(key, row);
  }
}

const poolKeys = [...new Set(DAILY_RIDE_POOL.map(p => p.buurt))].sort();
const rows = poolKeys.map(key => ({ buurt: key, ...(counts.get(key) ?? { card: 0, askable: 0, names: [] }) }));
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ landmarks: features.length, worthACard: card, askable, rows }, null, 2));
} else {
  console.log(`landmarks.json ${features.length}; worth a card ${card}; askable (card + modelled) ${askable}`);
  console.log(`daily-ride buurt keys ${poolKeys.length}; with ≥1 askable ${rows.filter(r => r.askable).length}; askable in pool buurten (sum) ${rows.reduce((s, r) => s + r.askable, 0)}`);
  for (const r of rows.sort((a, b) => b.askable - a.askable || a.buurt.localeCompare(b.buurt))) {
    console.log(`${r.buurt.padEnd(32)} card ${String(r.card).padStart(3)}  askable ${String(r.askable).padStart(2)}  ${r.names.slice(0, 6).join('; ')}`);
  }
}
