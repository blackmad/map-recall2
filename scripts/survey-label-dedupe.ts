// Survey: which POI label candidates the overlay's dedupe (src/canalRecall/labels/labelDedupe.ts)
// drops on the Amsterdam extract, so the tolerances are judged on the real data.
//   npx tsx scripts/survey-label-dedupe.ts [--all]
import { readFileSync } from 'node:fs';
import { ownPoiFeatures } from '../src/canalRecall/ownPois';
import { categoryClass, type LabelCandidate } from '../src/canalRecall/labels/labelPlan';
import { HEIGHT_BAND_METRES, type HeightBand } from '../src/canalRecall/poiCatalog';
import { dedupeLabelCandidates } from '../src/canalRecall/labels/labelDedupe';

const dir = 'public/data/extracts/amsterdam';
const own = ownPoiFeatures(JSON.parse(readFileSync(`${dir}/orientation-pois.json`, 'utf8')), () => false);
const landmarks = JSON.parse(readFileSync(`${dir}/landmarks.json`, 'utf8')) as any[];
const out: LabelCandidate[] = [];
const footprints = new Map<string, unknown>();
for (const f of own.features as any[]) {
  const [lng, lat] = f.geometry.coordinates, p = f.properties;
  out.push({ id: `own:${p.name}:${lng.toFixed(5)}`, name: p.name, lng, lat, heightM: HEIGHT_BAND_METRES[p.band as HeightBand] ?? 0, cls: categoryClass(p.category), rank: p.rank || 0 });
}
for (const item of landmarks) {
  if (!item.center || !(item.manualPoi || item.nativeKitPoi || (item.prominenceScore || 0) >= 220 || process.argv.includes('--all'))) continue;
  const building = Array.isArray(item.path) && item.path.length >= 3;
  out.push({ id: String(item.id), name: item.name, lng: item.center[1], lat: item.center[0], heightM: 0, cls: 'landmark', rank: Math.min(999, (item.prominenceScore || 0) / 2) });
  if (building) footprints.set(String(item.id), { type: 'Polygon', coordinates: [item.path.map(([lat, lng]: number[]) => [lng, lat])] });
}
const t0 = performance.now();
const { kept, dropped } = dedupeLabelCandidates(out, footprints);
const ms = performance.now() - t0;
const byId = new Map(out.map(c => [c.id, c]));
console.log(`candidates ${out.length}, kept ${kept.length}, dropped ${dropped.length} in ${ms.toFixed(1)} ms`);
const counts: Record<string, number> = {};
for (const d of dropped) counts[d.reason] = (counts[d.reason] || 0) + 1;
console.log(counts);
for (const d of dropped) {
  const w = byId.get(d.keptId)!;
  const m = Math.hypot((w.lng - d.dropped.lng) * 111320 * Math.cos(52.37 * Math.PI / 180), (w.lat - d.dropped.lat) * 111320);
  console.log(`${d.reason.padEnd(15)} ${d.dropped.cls.padEnd(8)} ${JSON.stringify(d.dropped.name).padEnd(44)} -> ${w.cls.padEnd(8)} ${JSON.stringify(w.name)} ${m.toFixed(0)} m`);
}
