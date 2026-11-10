// R3-A (#307): how many landmark arrival cards speak Dutch in the Dutch game,
// and which landmarks have no Dutch sentence at all (for a content lane).
//
//   npx tsx scripts/measure-dutch-ledes.ts [--json=<path>]
//
// It runs the game's own code: buildLandmarks (the card's lede) and
// finishBlurb (the ARRIVED card's paragraph, fresh fact rotation) with the
// interface language set to Dutch, over every landmark in facts.json's
// `landmarks` collection (the 289 fact sets) and over the whole catalogue.
// A paragraph counts as Dutch when it is a Dutch source sentence: a fact's
// `textNl` / `openingNl`, or the lede's `wikipediaExtractOriginal` (nl).
//
// The no-Dutch report ranks landmarks by a ride-frequency proxy: tour stops
// (tours.json, the daily pool's tour places) and how many of the next 365
// daily rides (dailyPoolPair) pass within 400 m of the landmark on the straight
// line between their ends. It is a proxy, not a routed count.
import fs from 'node:fs';
import { setLanguage } from '../src/i18n/index.ts';
import { buildLandmarks, splitDetail } from '../src/canalRecall/game/landmarkData.ts';
import { finishBlurb } from '../src/canalRecall/game/finishBlurb.ts';
import { buildFactIndex } from '../src/canalRecall/facts/factStore.ts';
import { emptyRotationState } from '../src/canalRecall/facts/factRotation.ts';
import type { FactsFile } from '../src/canalRecall/facts/factTypes.ts';
import { dailyPoolPair } from '../src/canalRecall/game/dailyRide.ts';

const DIR = 'public/data/extracts/amsterdam';
const read = <T>(name: string): T => JSON.parse(fs.readFileSync(`${DIR}/${name}`, 'utf8')) as T;
type Feature = Parameters<typeof buildLandmarks>[0][number] & { wikipediaExtractOriginal?: string; wikipediaExtractOriginalLang?: string; wikipediaPageviews60d?: number };
const features = read<Feature[]>('landmarks.json');
const factsFile = read<FactsFile>('facts.json');
const facts = buildFactIndex(factsFile);
const factSets = factsFile.features.filter(f => (f as { collection?: string }).collection === 'landmarks');

setLanguage('nl', { persist: false });
const placed = buildLandmarks(features, (lat, lng) => ({ x: lng, y: lat }));
const byId = new Map(placed.map(l => [l.id, l]));
const featureById = new Map(features.map(f => [f.id, f]));

function dutchSources(id: string): string[] {
  const out: string[] = [];
  const entry = facts.get(id);
  if (entry?.openingNl) out.push(entry.openingNl);
  for (const fact of entry?.facts ?? []) if (fact.textNl) out.push(fact.textNl);
  const f = featureById.get(id);
  if (f?.wikipediaExtractOriginal && f.wikipediaExtractOriginalLang === 'nl') {
    const { detail, longDetail } = splitDetail(f.wikipediaExtractOriginal);
    out.push(detail, longDetail);
  }
  return out.filter(Boolean);
}
const isDutch = (id: string, text: string) => !!text && dutchSources(id).some(source => text.includes(source) || source === text);

function arrival(id: string): { text: string; dutch: boolean } {
  const lm = byId.get(id);
  if (!lm) return { text: '', dutch: false };
  const { text } = finishBlurb(lm, facts, emptyRotationState(), '');
  return { text, dutch: isDutch(id, text) };
}

const setIds = factSets.map(f => f.id);
const setDutch = setIds.filter(id => arrival(id).dutch);
const allDutch = placed.filter(l => arrival(l.id).dutch);
const ledeDutch = placed.filter(l => isDutch(l.id, l.longDetail || l.detail));
const noDutchSentence = setIds.filter(id => dutchSources(id).length === 0);

// --- ride-frequency proxy -------------------------------------------------
const tours = read<{ tours: Array<{ stops: Array<{ landmarkId?: string }> }> }>('tours.json').tours;
const tourStops = new Map<string, number>();
for (const tour of tours) for (const stop of tour.stops) if (stop.landmarkId) tourStops.set(stop.landmarkId, (tourStops.get(stop.landmarkId) ?? 0) + 1);
const rides: Array<[number, number, number, number]> = [];
for (let d = 0; d < 365; d += 1) {
  const date = new Date(Date.UTC(2026, 10, 9) + d * 86400000).toISOString().slice(0, 10);
  const pair = dailyPoolPair(date);
  if (pair) rides.push([pair.from.lat, pair.from.lng, pair.to.lat, pair.to.lng]);
}
function nearRides(lat: number, lng: number): number {
  const k = 111320 * Math.cos(lat * Math.PI / 180);
  let n = 0;
  for (const [alat, alng, blat, blng] of rides) {
    const ax = (alng - lng) * k, ay = (alat - lat) * 111320, bx = (blng - lng) * k, by = (blat - lat) * 111320;
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
    if (Math.hypot(ax + t * dx, ay + t * dy) <= 400) n += 1;
  }
  return n;
}
// Buurt: the finest boundary polygon holding the centre (neighbourhood, then quarter, then suburb).
type Boundary = { name: string; kind: string; geometry?: Array<Array<Array<[number, number]>>> };
const KIND_RANK = ['neighbourhood', 'neighborhood', 'quarter', 'city_block', 'suburb', 'locality'];
const boundaries = read<Boundary[]>('boundaries.json').filter(b => KIND_RANK.includes(b.kind) && b.geometry);
function inRing(lat: number, lng: number, ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function buurtOf(lat: number, lng: number): string {
  const hits = boundaries.filter(b => b.geometry!.some(poly => poly[0] && inRing(lat, lng, poly[0])));
  hits.sort((a, b) => KIND_RANK.indexOf(a.kind) - KIND_RANK.indexOf(b.kind));
  return hits[0]?.name ?? '(outside)';
}
const report = noDutchSentence.map(id => {
  const f = featureById.get(id)!;
  const [lat, lng] = f.center ?? [0, 0];
  return { id, name: f.name ?? id, buurt: buurtOf(lat, lng), tourStops: tourStops.get(id) ?? 0, dailyRidesNear: nearRides(lat, lng), pageviews60d: f.wikipediaPageviews60d ?? 0, wikipedia: f.wikipedia ?? '', wikipediaUrl: f.wikipediaUrl ?? '' };
}).sort((a, b) => b.tourStops - a.tourStops || b.dailyRidesNear - a.dailyRidesNear || b.pageviews60d - a.pageviews60d);
const byBuurt = new Map<string, number>();
for (const row of report) byBuurt.set(row.buurt, (byBuurt.get(row.buurt) ?? 0) + 1);

console.log(`fact sets (landmarks): ${setIds.length}`);
console.log(`arrival paragraph Dutch (fact sets, fresh rotation): ${setDutch.length} / ${setIds.length}`);
console.log(`arrival paragraph Dutch (whole catalogue): ${allDutch.length} / ${placed.length}`);
console.log(`card lede Dutch before facts load (whole catalogue): ${ledeDutch.length} / ${placed.length}`);
console.log(`fact sets with no Dutch sentence: ${noDutchSentence.length}`);
console.log(`no-Dutch by buurt: ${[...byBuurt].sort((a, b) => b[1] - a[1]).map(([b, n]) => `${b} ${n}`).join(', ')}`);
console.log('top 20 by ride frequency (tour stops, daily rides within 400 m of 365, pageviews):');
for (const row of report.slice(0, 20)) console.log(`  ${row.name} | ${row.buurt} | tours ${row.tourStops} | rides ${row.dailyRidesNear} | pv ${row.pageviews60d} | ${row.wikipedia || '-'}`);
const json = process.argv.find(a => a.startsWith('--json='))?.slice(7);
if (json) fs.writeFileSync(json, JSON.stringify({ setTotal: setIds.length, setDutch: setDutch.length, catalogue: placed.length, catalogueDutch: allDutch.length, ledeDutch: ledeDutch.length, noDutch: report, byBuurt: Object.fromEntries(byBuurt) }, null, 2));
