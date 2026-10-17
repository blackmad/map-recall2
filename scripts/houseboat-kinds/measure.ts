// Houseboat kind evidence: per-boat footprint measurements in the boat frame, the
// waterway each boat lies on, and a stratified sample for orthophoto labelling.
//   npx tsx scripts/houseboat-kinds/measure.ts            -> artifacts/houseboat-kinds/features.json
//   npx tsx scripts/houseboat-kinds/measure.ts --sample   -> also (re)writes sample.json (seeded)
import fs from 'node:fs';
import { classifyHouseboatHull, houseboatFrame, type Houseboat } from '../../src/canalRecall/houseboats.ts';

const OUT = 'artifacts/houseboat-kinds';
fs.mkdirSync(OUT, { recursive: true });
const { boats }: { boats: Houseboat[] } = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/houseboats.json', 'utf8'));
type Water = { name: string; paths?: [number, number][][] };
const water: Water[] = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/water.json', 'utf8'));

const kx = 111320 * Math.cos(52.37 * Math.PI / 180), ky = 110540;
const segs: { name: string; a: [number, number]; b: [number, number] }[] = [];
for (const w of water) for (const path of w.paths ?? []) for (let i = 1; i < path.length; i++)
  segs.push({ name: w.name, a: [path[i - 1][1] * kx, path[i - 1][0] * ky], b: [path[i][1] * kx, path[i][0] * ky] });
const nearestWater = (lng: number, lat: number) => {
  const x = lng * kx, y = lat * ky;
  let best = '', bd = 250;
  for (const s of segs) {
    if (Math.abs(s.a[0] - x) > 3000 || Math.abs(s.a[1] - y) > 3000) continue;
    const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
    const t = Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (y - s.a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(s.a[0] + t * dx - x, s.a[1] + t * dy - y);
    if (d < bd) { bd = d; best = s.name; }
  }
  return best || 'other';
};
const region = (name: string) => {
  if (/Prinsengracht/.test(name)) return 'Prinsengracht';
  if (/Herengracht|Keizersgracht/.test(name)) return 'Heren/Keizersgracht';
  if (/Amstel/.test(name)) return 'Amstel';
  if (/^Singel$/.test(name)) return 'Singel';
  if (/Brouwersgracht/.test(name)) return 'Brouwersgracht';
  if (/Singelgracht|Lijnbaansgracht|Nassau|Schinkel|Kostverloren|Jordaan/.test(name)) return 'outer canals';
  if (/IJ|Westerdok|Houthaven|Oosterdok|Entrepot|Dok|haven/i.test(name)) return 'IJ/docks';
  return 'other';
};

const features = [];
for (const boat of boats) {
  const f = houseboatFrame(boat);
  if (!f) continue;
  const { local, length: L, width: W } = f;
  const kind = classifyHouseboatHull(local, L, W);
  const [lng, lat] = boat.ring.reduce((a, p) => [a[0] + p[0] / boat.ring.length, a[1] + p[1] / boat.ring.length], [0, 0]);
  const waterName = nearestWater(lng, lat);
  features.push({ id: boat.id, n: local.length, L: +L.toFixed(2), W: +W.toFixed(2), kind, rect: local.length === 4, water: waterName, region: region(waterName), lng: +lng.toFixed(6), lat: +lat.toFixed(6) });
}
fs.writeFileSync(`${OUT}/features.json`, JSON.stringify(features));
const tally = (key: (f: typeof features[number]) => string) => features.reduce((m, f) => (m[key(f)] = (m[key(f)] ?? 0) + 1, m), {} as Record<string, number>);
console.log('kinds', tally(f => f.kind), 'strata', tally(f => `${f.rect ? 'rect' : 'traced'}-${f.kind}`));
console.log('regions', tally(f => f.region));

if (process.argv.includes('--sample')) {
  // Seeded, stratified: per stratum, round-robin over regions.
  let seed = 20261016;
  const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296);
  const quota: Record<string, number> = { 'rect-ark': 36, 'traced-ark': 50, 'traced-barge': 74 };
  const sample: string[] = [];
  for (const [stratum, n] of Object.entries(quota)) {
    const pool = features.filter(f => `${f.rect ? 'rect' : 'traced'}-${f.kind}` === stratum);
    const byRegion = new Map<string, typeof pool>();
    for (const f of pool.map(f => ({ f, r: rnd() })).sort((a, b) => a.r - b.r).map(x => x.f)) {
      if (!byRegion.has(f.region)) byRegion.set(f.region, []);
      byRegion.get(f.region)!.push(f);
    }
    const lists = [...byRegion.values()];
    for (let k = 0, taken = 0; taken < n && lists.some(l => l.length); k++) {
      const l = lists[k % lists.length];
      if (l.length) { sample.push(l.shift()!.id); taken++; }
    }
  }
  fs.writeFileSync(`${OUT}/sample.json`, JSON.stringify(sample));
  console.log('sample', sample.length);
}
