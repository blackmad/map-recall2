// Simulates first-launch home destination picks from the real Amsterdam POI list.
import fs from 'node:fs';
import { CANAL_CITIES } from '../src/canalRecall/game/cities.ts';
import * as R from '../src/canalRecall/game/routeSelection.ts';

const city = CANAL_CITIES.amsterdam;
const features = R.mergeManualPoiFeatures(
  JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/landmarks.json', 'utf8')), 'amsterdam');
const curated: R.RoutePoi[] = (city.curatedPois || []).map((p: R.RoutePoi) => ({ ...p }));
const seen = new Set(curated.map(p => p.name.toLowerCase()));
const extras: R.RoutePoi[] = [];
for (const f of features as any[]) {
  const c = f.routeCenter || f.center;
  if (!c || !f.name || !R.isTeachableRouteDestination(f)) continue;
  if (seen.has(f.name.toLowerCase())) continue;
  const poi = { id: `lm-${f.id}`, name: f.name, lat: c[0], lng: c[1] };
  if (!f.manualPoi && R.kmBetween(poi, city.center) > 4) continue;
  seen.add(f.name.toLowerCase());
  extras.push(poi);
}
const pois = [...curated, ...extras];
const home = { lat: 52.3728, lng: 4.8737 };
const tally = (samples: R.MasterySample[], n = 2000) => {
  const t = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const p = R.pickHomeDestination(pois, home, samples);
    if (p) t.set(p.poi.name, (t.get(p.poi.name) || 0) + 1);
  }
  return [...t.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${(100 * v / n).toFixed(1)}%`);
};
console.log('pois', pois.length, 'in 1km', pois.filter(p => R.kmBetween(p, home) <= 1.15).length);
console.log('empty', tally([]));
const d = pois.find(p => /Dolphijn/.test(p.name));
console.log('Dolphijn', d, d && R.kmBetween(d, home));
// realistic history: the player has practised ~60% of the local streets
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const hist: R.MasterySample[] = [];
for (let i = 0; i < 400; i++) {
  const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 2.2;
  hist.push({ lat: home.lat + (r * Math.sin(a)) / 111, lng: home.lng + (r * Math.cos(a)) / 68, mastery: rnd() < 0.6 ? 1 : 0.33 });
}
console.log('history', tally(hist));
for (const [label, s] of [['empty', [] as R.MasterySample[]], ['history', hist]] as const) {
  let recent: string[] = []; const names: string[] = [];
  for (let i = 0; i < 20; i++) {
    const p = R.pickHomeDestination(pois, home, s, undefined, null, recent)!;
    names.push(p.poi.name); recent = R.rememberDestination(recent, p.poi.id);
  }
  console.log(label, 'sequence distinct', new Set(names).size, '/20');
}
