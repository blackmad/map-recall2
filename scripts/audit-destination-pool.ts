// Audit of the ride's destination pool: sizes at each stage, the fame tiers,
// the duplicates folded at build time, near-duplicates that survive (for a
// human to judge), the well-known places a visitor expects, and simulated
// pick odds from Vijzelstraat for a new rider.
//
//   node --import tsx scripts/audit-destination-pool.ts [landmarks.json] [--picks=20000]
import fs from 'node:fs';
import { CANAL_CITIES } from '../src/canalRecall/game/cities.ts';
import { mergeManualPoiFeatures } from '../src/canalRecall/game/manualPoiCatalog.ts';
import * as R from '../src/canalRecall/game/routeSelection.ts';
import { pickNextStop } from '../src/canalRecall/game/chainedRun.ts';
import { isAList, notabilityScore } from '../src/canalRecall/game/poiNotability.ts';
import { isTeachableRouteDestination } from '../src/canalRecall/game/routeDestinationContent.ts';
import { buildRouteDestinationPool } from '../src/canalRecall/game/routeDestinationPool.ts';
import { nearDuplicates } from '../src/canalRecall/game/destinationDedupe.ts';

const file = process.argv.slice(2).find(arg => !arg.startsWith('--')) || 'public/data/extracts/amsterdam/landmarks.json';
const picks = Number(process.argv.find(arg => arg.startsWith('--picks='))?.slice(8) || 20000);
const city = CANAL_CITIES.amsterdam;
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const merged = mergeManualPoiFeatures(raw, 'amsterdam');
const teachable = merged.filter(f => (f.routeCenter || f.center) && f.name && isTeachableRouteDestination(f));
const built = buildRouteDestinationPool(merged, city.curatedPois.map(p => ({ ...p })), { center: city.center, cityId: 'amsterdam' });
const pool = built.pois;
const scores = pool.map(p => notabilityScore(p));
console.log(`pool: raw ${raw.length}, merged ${merged.length}, teachable ${teachable.length}, `
  + `in range after dedupe ${pool.length} (${built.curatedCount} curated + ${built.extrasCount} extract)`);
console.log(`tiers: >=${R.FAMOUS_TIER_SCORE} famous ${scores.filter(s => s >= R.FAMOUS_TIER_SCORE).length}, `
  + `6-8 ${scores.filter(s => s >= 6 && s < 8).length}, <6 ${scores.filter(s => s < 6).length}, A-list in pool ${pool.filter(p => isAList(p)).length}`);
console.log(`\nduplicates folded (${built.removed.length}):`);
for (const r of built.removed) console.log(`  ${r.reason.padEnd(14)} ${r.removedName} [${r.removedId}] -> ${r.keptName} [${r.keptId}]`);
const near = nearDuplicates(pool);
console.log(`\nnear-duplicates left in the pool (${near.length}; judge by hand):`);
for (const { a, b, km } of near) console.log(`  ${(km * 1000).toFixed(0).padStart(4)} m  ${a.name}  ~  ${b.name}`);

const EXPECTED = ['Rijksmuseum', 'Westerkerk', 'Anne Frank', 'Royal Palace', 'Magere Brug', 'Bloemenmarkt', "Weepers' Tower", 'Schreierstoren',
  "H’ART", 'Stopera', 'Opera', 'Leidseplein', 'Museumplein', 'Dam Square', 'Bijbels', 'Bible', "Berlage", 'Wereldmuseum', 'Tropenmuseum',
  'Krasnapolsky', 'A’DAM', "A'DAM"];
console.log('\nwell-known places:');
for (const name of EXPECTED) {
  const hit = pool.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
  if (hit) console.log(`  ${name}: ${hit.name} (${notabilityScore(hit).toFixed(1)})`);
  else console.log(`  ${name}: not a destination`);
}

const show = ['Westerkerk', 'El Tawheed', 'Meerpadkerk', 'Rijksmuseum'];
const at = (name: string) => pool.findIndex(p => p.name === name);
const byScore = pool.slice().sort((a, b) => notabilityScore(b) - notabilityScore(a));
console.log('\nranks by notability:', show.map(n => `${n} #${byScore.findIndex(p => p.name === n) + 1}/${pool.length} (${at(n) >= 0 ? notabilityScore(pool[at(n)]).toFixed(1) : '-'})`).join(', '));

let seed = 12345;
const unit = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const index = (n: number) => Math.floor(unit() * n);
const VIJZELSTRAAT = { id: 'start', name: 'Vijzelstraat', lat: 52.364, lng: 4.8915 };
function odds(label: string, pick: () => R.RoutePoi | null | undefined, draws = picks): void {
  const tally = new Map<string, number>();
  for (let i = 0; i < draws; i += 1) {
    const p = pick();
    if (p) tally.set(p.name, (tally.get(p.name) || 0) + 1);
  }
  const pct = (n: string) => `${(100 * (tally.get(n) || 0) / draws).toFixed(2)}%`;
  const top = [...tally].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => `${n} ${(100 * c / draws).toFixed(1)}%`);
  const tail = [...tally].filter(([n]) => { const p = pool.find(x => x.name === n); return p && notabilityScore(p) < R.FAMOUS_TIER_SCORE; })
    .reduce((s, [, c]) => s + c, 0);
  console.log(`  ${label.padEnd(10)} Westerkerk ${pct('Westerkerk')}, El Tawheed ${pct('El Tawheed')}, Meerpadkerk ${pct('Meerpadkerk')}; `
    + `tail ${(100 * tail / draws).toFixed(1)}%; top ${top.join(', ')}`);
}
// Due names for the review ride: street centres round the start, as an early rider's misses would be.
const streets = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets.json', 'utf8')) as Array<{ name: string; center: [number, number] }>;
const due = streets.filter(s => R.kmBetween({ lat: s.center[0], lng: s.center[1] }, VIJZELSTRAAT) <= 2.5).slice(0, 40);
console.log(`\npick odds from Vijzelstraat, new rider (${picks} draws; ${due.length} due names for review):`);
odds('start', () => R.pickSurpriseStart(pool, [], unit));
odds('surprise', () => R.pickDestinationNear(pool, VIJZELSTRAAT, unit));
odds('home', () => R.pickHomeDestination(pool, VIJZELSTRAAT, [], unit)?.poi);
odds('next stop', () => pickNextStop(pool, VIJZELSTRAAT, { chooseUnit: unit }));
odds('review', () => R.pickReviewRoute({ pois: pool, due, from: { ...VIJZELSTRAAT }, chooseIndex: index })?.to, Math.min(picks, 2000));
