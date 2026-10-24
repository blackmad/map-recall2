/**
 * Census of modelled buildings against the 1000 definition (user, 2026-10-23): a **named POI or a ride-visible
 * dominant building** whose model passes the hard gates and has a **recorded photo-likeness review**.
 *
 *   node --import tsx scripts/landmarks/census.ts [--write] [--out=public/canal-drive/landmark-census.json]
 *
 * Rows: live bespoke landmarks (manualModels, held ones excluded), ordinary-catalogue models (hand-built and
 * `kind: large` recipes; street-survey rows are not landmarks), landmark kits (landmarkKits.ts, minus kits whose name a
 * bespoke model already carries), and factory-queue rows. Review kinds, strictest first:
 *   strip-review      a verdict in the factory queue or landmark-reviews.json (this programme's record)
 *   likeness-gate     installed through install-large.ts with reviewState likeness-pass | likeness-inferred
 *   legacy-gallery    bespoke landmarks and hand-built ordinary models installed after the integrator's gallery look
 *   none              kits and gates-pass recipes: modelled, never judged against a photo
 * The headline counts rows that are (named POI or ride-visible) and reviewed. `legacy-gallery` is grandfathered and
 * reported separately, so the strict number (strip-review + likeness-gate only) is in the file too.
 */
import fs from 'node:fs';
import {ALL_MANUAL_LANDMARKS} from '../../src/canalRecall/landmarks/manualModels.ts';
import {KITS, HAND_KITS, kitIds} from '../../src/canalRecall/landmarkKits.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const pandOf = (s: unknown): string | null => { const m = /(\d{16})/.exec(String(s ?? '')); return m ? m[1] : null; };
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export type ReviewKind = 'strip-review' | 'likeness-gate' | 'legacy-gallery' | 'none';
export interface CensusRow {
  key: string; name: string | null; tier: 'bespoke' | 'ordinary' | 'largeRecipe' | 'landmarkKit'; pands: string[];
  namedPoi: boolean; rideVisible: boolean; held: boolean; review: ReviewKind; reviewDate?: string; counts: boolean; countsStrict: boolean;
}

export function census(): {headline: number; strict: number; rows: CensusRow[]; byTier: Record<string, {models: number; counts: number; strict: number; unreviewed: number}>; byReview: Record<string, number>} {
  const dominant = read('public/canal-drive/dominant-building-backlog.json');
  const dom = (Array.isArray(dominant) ? dominant : dominant.candidates ?? Object.values(dominant)) as any[];
  const visible = new Set(dom.filter(c => c.rideVisibility?.score > 0).map(c => pandOf(c.id)).filter(Boolean) as string[]);
  const covers = read('public/canal-drive/models/covers.json').models as Record<string, {p?: string[]}>;
  // this programme's review records: queue verdicts (by pand) and landmark-reviews.json (by key)
  const reviews = new Map<string, {outcome: string; date?: string}>();
  try { for (const i of read('public/canal-drive/landmark-factory-queue.json').items) if (i.verdict?.outcome === 'pass' || i.status === 'reviewed-pass' || i.status === 'installed') reviews.set(`pand:${i.pand}`, {outcome: 'pass', date: i.verdict?.date}); } catch { /* no queue yet */ }
  // the latest round decides: a kit that passed once and was held later does not count
  try {
    const latest = new Map<string, {verdict: string; date: string}>();
    for (const r of read('public/canal-drive/landmark-reviews.json').reviews ?? []) latest.set(r.key, r);
    for (const [key, r] of latest) if (r.verdict === 'pass') reviews.set(key, {outcome: 'pass', date: r.date});
  } catch { /* no reviews yet */ }
  const stripReviewed = (key: string, pands: string[]) => reviews.get(key) ?? pands.map(p => reviews.get(`pand:${p}`)).find(Boolean);

  const rows: CensusRow[] = [];
  const bespokeNames = new Set<string>();
  // 1. bespoke landmarks and hand-built manual ordinary models
  for (const spec of ALL_MANUAL_LANDMARKS as readonly any[]) {
    const held = spec.status === 'held';
    const pands = [...new Set([...(spec.suppressOsmIds ?? []).map(pandOf), ...((covers[spec.id]?.p ?? []).map(pandOf))].filter(Boolean) as string[])];
    const landmark = (spec.buildingCategory ?? 'landmark') === 'landmark';
    if (landmark) bespokeNames.add(norm(spec.name ?? spec.id));
    const sr = stripReviewed(`model:${spec.id}`, pands);
    const review: ReviewKind = sr ? 'strip-review' : 'legacy-gallery';
    const rideVisible = pands.some(p => visible.has(p));
    const counts = !held && (landmark || rideVisible) && review !== 'none', countsStrict = counts && review === 'strip-review';
    rows.push({key: `model:${spec.id}`, name: spec.name ?? spec.id, tier: landmark ? 'bespoke' : 'ordinary', pands, namedPoi: landmark, rideVisible, held, review, reviewDate: sr?.date, counts, countsStrict});
  }
  // 2. ordinary catalogue: hand-built one-offs and large recipes
  for (const m of read('public/canal-drive/ordinary-buildings-data/catalogue.json').models) {
    if (m.category === 'street-survey') continue;
    const pands = [...new Set([pandOf(m.buildingId), ...(m.suppress ?? []).map(pandOf)].filter(Boolean) as string[])];
    const large = m.source === 'building-recipes-large';
    const sr = stripReviewed(`model:${m.id}`, pands);
    const review: ReviewKind = sr ? 'strip-review' : large ? (/likeness-(pass|inferred)/.test(m.reviewState ?? '') ? 'likeness-gate' : 'none') : 'legacy-gallery';
    const rideVisible = pands.some(p => visible.has(p));
    // a large recipe with a POI name (police bureaus, libraries) is a named POI; an address is not
    const namedPoi = !!m.name && !/^\d|^ordinary-|straat \d|gracht \d|kade \d|weg \d|plein \d|laan \d/i.test(m.name) && /politie|bibliotheek|oba |school|lyceum|kerk|museum|theater|station|stadsloket|stadsdeel|brandweer|ziekenhuis|hotel/i.test(m.name);
    const counts = (namedPoi || rideVisible) && review !== 'none', countsStrict = counts && review !== 'legacy-gallery';
    rows.push({key: `model:${m.id}`, name: m.name ?? null, tier: large ? 'largeRecipe' : 'ordinary', pands, namedPoi, rideVisible, held: false, review, reviewDate: sr?.date, counts, countsStrict});
  }
  // 3. landmark kits: named landmarks (churches, towers, public buildings) drawn by the parametric kit in the worker
  const hand = new Set(HAND_KITS.map(k => k.name));
  // A kit whose every part a live bespoke model suppresses is only the stand-in until that model is resident (kit review
  // round 3, GitHub #37: Royal Palace / palace-on-the-dam, Waag, Centraal and 104 generic worship/public kits on Oude Kerk,
  // Nieuwe Kerk, Posthoornkerk, El Tawheed, Chassekerk, English Reformed Church... were sheeted as if they were the model).
  const bespokeSuppressed = new Set<string>();
  for (const spec of ALL_MANUAL_LANDMARKS as readonly any[]) if (spec.status !== 'held') for (const id of spec.suppressOsmIds ?? []) bespokeSuppressed.add(String(id));
  for (const k of KITS) {
    if (bespokeNames.has(norm(k.name))) continue; // the bespoke model wins; the kit adds no unit
    const ids = kitIds(k);
    if (ids.length && ids.every(id => bespokeSuppressed.has(id))) continue;
    const sr = reviews.get(`kit:${k.name}`);
    const review: ReviewKind = sr ? 'strip-review' : 'none';
    rows.push({key: `kit:${k.name}`, name: k.name, tier: 'landmarkKit', pands: [], namedPoi: true, rideVisible: false, held: false, review, reviewDate: sr?.date, counts: review !== 'none', countsStrict: review !== 'none', ...(hand.has(k.name) ? {} : {})});
  }
  const byTier: Record<string, {models: number; counts: number; strict: number; unreviewed: number}> = {};
  const byReview: Record<string, number> = {};
  for (const r of rows) {
    const t = byTier[r.tier] ??= {models: 0, counts: 0, strict: 0, unreviewed: 0};
    t.models++; if (r.counts) t.counts++; if (r.countsStrict) t.strict++; if (r.review === 'none' && !r.held) t.unreviewed++;
    byReview[r.review] = (byReview[r.review] ?? 0) + 1;
  }
  return {headline: rows.filter(r => r.counts).length, strict: rows.filter(r => r.countsStrict).length, rows, byTier, byReview};
}

if (process.argv[1]?.endsWith('landmarks/census.ts')) {
  const c = census();
  console.log(`census: ${c.headline} reviewed named-or-visible buildings (strict, this programme's reviews + likeness gate only: ${c.strict}); target 1000`);
  console.log('  tier          models  counts  strict  unreviewed');
  for (const [t, v] of Object.entries(c.byTier)) console.log(`  ${t.padEnd(13)} ${String(v.models).padStart(6)} ${String(v.counts).padStart(7)} ${String(v.strict).padStart(7)} ${String(v.unreviewed).padStart(11)}`);
  console.log(`  by review ${JSON.stringify(c.byReview)}`);
  const out = arg('out', 'public/canal-drive/landmark-census.json');
  if (process.argv.includes('--write')) {
    fs.writeFileSync(out, JSON.stringify({version: 1, generatedAt: new Date().toISOString(), definition: 'named POI or ride-visible dominant building, model passes audit:glb hard gates, photo-likeness review recorded (user, 2026-10-23)', target: 1000, headline: c.headline, strict: c.strict, byTier: c.byTier, byReview: c.byReview, rows: c.rows}, null, 1) + '\n');
    console.log(`wrote ${out}`);
  }
}
