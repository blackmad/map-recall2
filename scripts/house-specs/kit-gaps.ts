// The kit-gap queue (house line H6, docs/house-line.md §5): reads every schemaLimits line the house line already holds,
// classifies each to {component, what} (kitGapVocabulary.ts), and writes artifacts/kit-gaps/queue.json,
// artifacts/kit-gaps/sources.json and the generated docs/handoffs/kit-gaps.md.
//
//   sources: public/data/extracts/amsterdam/house-specs/14/**  (spec records; `l` = schemaLimits, face limits included)
//            scripts/block-face/faces/*/intent.json             (house -> block-face type, face date, strip photo)
//            scripts/block-face/types/**/*.json                 (type schemaLimits, applied to each house that uses the type)
//   pand -> gebied: the building-tile footprint centroid inside coverage-v1/buurten.json (as build-house-specs does)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { isRidePriority } from '../../src/canalRecall/ridePriority.ts';
import { buildKitGapQueue, GENERATED_MARK, KIT_GAP_THRESHOLD, normalizeGap, notesOf, RIDE_PRIORITY_WEIGHT, renderKitGapsDoc, type GapSighting, type QueueEntry } from '../../src/canalRecall/houseSpec/kitGaps.ts';
import { classifyLimit, type KitComponent, KIT_COMPONENTS } from './kitGapVocabulary.ts';

export const HELP = `kit-gaps: the kit-gap queue from every schemaLimits line (house line H6, docs/house-line.md §5).

  npm run house:kit-gaps          classify every limit, rank the gaps, and write
                                  artifacts/kit-gaps/queue.json (the ranked queue), artifacts/kit-gaps/sources.json
                                  (counts, before/after classification, the unmapped list), and regenerate
                                  docs/handoffs/kit-gaps.md (its Notes section is kept)
  --help                          this text

Each line is classified by scripts/house-specs/kitGapVocabulary.ts (ordered Dutch/English keyword rules, no model) to one
of the kit's components (${KIT_COMPONENTS.join(', ')}) and a canonical wording. A line no rule names is \`other\`, keeps its
normalised text, and is listed as unmapped. A pand counts once per gap. Weight ${RIDE_PRIORITY_WEIGHT} for a pand inside a ride-priority
gebied (src/canalRecall/ridePriority.ts), else 1. A gap at or over ${KIT_GAP_THRESHOLD} weighted goes to a kit lane.`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const SPECS = path.join(EXTRACT, 'house-specs/14');
const FACES = path.join(ROOT, 'scripts/block-face/faces');
const TYPES = path.join(ROOT, 'scripts/block-face/types');
const OUT = path.join(ROOT, 'artifacts/kit-gaps');
const DOC = path.join(ROOT, 'docs/handoffs/kit-gaps.md');
const UNMAPPED_SHOWN = 80;

const args = process.argv.slice(2);
if (args.includes('--help')) { console.log(HELP); process.exit(0); }

const rel = (p: string) => path.relative(ROOT, p);
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const walk = (dir: string, keep: (f: string) => boolean): string[] => existsSync(dir)
  ? readdirSync(dir, { withFileTypes: true }).flatMap(d => (d.isDirectory() ? walk(path.join(dir, d.name), keep) : keep(d.name) ? [path.join(dir, d.name)] : [])).sort()
  : [];
const digitsOf = (feature: string) => /(\d{16})$/.exec(feature)?.[1] ?? feature;

// --- 1. block faces: pand -> face, type, photo, date ---------------------------------------------------------------
interface FaceHouse { intentPath: string; cropPath: string | null; date: string | null; type: string | null }
const faceOf = new Map<string, FaceHouse>();
for (const file of walk(FACES, f => f === 'intent.json')) {
  const face = json(file);
  const dates = (face.sources ?? []).map((s: { capturedAt?: string }) => s.capturedAt).filter(Boolean).sort();
  const strip = path.join(path.dirname(file), 'strip.json');
  const cropPath = existsSync(strip) && json(strip).image ? String(json(strip).image) : null;
  for (const h of face.houses ?? []) {
    const type = typeof h.type === 'string' ? h.type : h.type?.type ?? null;
    faceOf.set(String(h.pandId), { intentPath: rel(file), cropPath, date: dates[dates.length - 1] ?? null, type });
  }
}

// --- 2. block-face types: id -> limit lines (a string, or {component, what, prose} once classified) -----------------
interface TypeLine { text: string; structured?: string }
const typeLines = new Map<string, TypeLine[]>();
for (const file of walk(TYPES, f => f.endsWith('.json'))) {
  const t = json(file);
  if (!t.id) continue;
  typeLines.set(t.id, ((t.schemaLimits ?? []) as Array<string | { component?: string; what?: string; prose?: string }>).map(e =>
    typeof e === 'string' ? { text: e } : { text: e.prose ?? e.what ?? '', structured: e.component }).filter(l => l.text.trim()));
}

// --- 3. sightings: each line classified, and the same line raw for the before count -------------------------------
interface Raw { sighting: GapSighting; rawWhat: string }
const lines: Raw[] = [];
const stats = { specPands: 0, specLines: 0, specPandsInFaces: 0, faceHousesWithType: 0, typeLinesApplied: 0, typeUnmatched: 0, typeHouses: 0 };
const add = (pandId: string, text: string, structured: string | undefined, source: GapSighting['source'], intentPath: string, cropPath: string | null, date: string | null) => {
  const c = classifyLimit(text, structured);
  lines.push({ rawWhat: text, sighting: { pandId, limit: { component: c.component, what: c.what }, source, intentPath, cropPath, date } });
};
for (const file of walk(SPECS, f => f.endsWith('.json.gz'))) {
  const tile = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));
  for (const [feature, rec] of Object.entries<any>(tile.buildings ?? {})) {
    const specLines = ((rec.l ?? []) as Array<{ component?: string; what?: string }>).filter(l => typeof l?.what === 'string' && l.what.trim());
    if (!specLines.length) continue;
    const pandId = digitsOf(feature);
    const face = faceOf.get(pandId);
    stats.specPands++;
    if (face) stats.specPandsInFaces++;
    for (const l of specLines) {
      stats.specLines++;
      add(pandId, l.what!, l.component, 'spec', face?.intentPath ?? rel(file), face?.cropPath ?? null, face?.date ?? null);
    }
  }
}
for (const [pandId, face] of faceOf) {
  if (!face.type) continue;
  stats.typeHouses++;
  const typed = typeLines.get(face.type);
  if (typed === undefined) { stats.typeUnmatched++; continue; }
  stats.faceHousesWithType++;
  for (const l of typed) {
    stats.typeLinesApplied++;
    add(pandId, l.text, l.structured, 'type', face.intentPath, face.cropPath, face.date);
  }
}
const sightings = lines.map(l => l.sighting);

// --- 4. ride priority by pand -> buurt ---------------------------------------------------------------------------
type Ring = number[][];
const polys = (g: any): Ring[][] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const inside = ([x, y]: number[], ring: Ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; return c; };
const centroid = (g: any) => { const r = polys(g)[0][0]; return [r.reduce((s: number, p: number[]) => s + p[0], 0) / r.length, r.reduce((s: number, p: number[]) => s + p[1], 0) / r.length]; };
const buurten = json(path.join(EXTRACT, 'coverage-v1/buurten.json')).features as Array<{ properties: Record<string, any>; geometry: any }>;
const needed = new Set(sightings.map(s => s.pandId));
const buurtOf = new Map<string, Record<string, any>>();
const tileList: string[] = json(path.join(EXTRACT, 'building-tiles/index-z14.json')).tileList.map((t: string) => t.replace(/^14\//, ''));
for (const tile of tileList) {
  const file = path.join(EXTRACT, `building-tiles/14/${tile}.geojson.gz`);
  if (!existsSync(file)) continue;
  for (const f of JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')).features ?? []) {
    const digits = digitsOf(String(f.properties?.id ?? ''));
    if (!needed.has(digits) || buurtOf.has(digits)) continue;
    const c = centroid(f.geometry);
    buurtOf.set(digits, buurten.find(b => polys(b.geometry).some(p => inside(c, p[0])))?.properties ?? {});
  }
}
const isPriority = (pandId: string) => isRidePriority(buurtOf.get(pandId));

// --- 5. queue, gate numbers and doc ------------------------------------------------------------------------------------
const queue: QueueEntry[] = buildKitGapQueue(sightings, isPriority);
const before: QueueEntry[] = buildKitGapQueue(lines.map(l => ({ ...l.sighting, limit: { component: 'facade', what: l.rawWhat } })), isPriority);
const unmappedLines = lines.filter(l => l.sighting.limit.component === 'other');
const unmappedCounts = new Map<string, number>();
for (const l of unmappedLines) unmappedCounts.set(normalizeGap(l.rawWhat), (unmappedCounts.get(normalizeGap(l.rawWhat)) ?? 0) + 1);
const byComponent: Record<string, number> = Object.fromEntries(KIT_COMPONENTS.map(c => [c, 0]));
for (const s of sightings) byComponent[s.limit.component as KitComponent]++;
const generated = new Date().toISOString().slice(0, 10);
const summary = {
  generated,
  threshold: KIT_GAP_THRESHOLD,
  ridePriorityWeight: RIDE_PRIORITY_WEIGHT,
  sightings: { total: sightings.length, spec: lines.filter(l => l.sighting.source === 'spec').length, type: lines.filter(l => l.sighting.source === 'type').length },
  unmapped: { sightings: unmappedLines.length, share: +(unmappedLines.length / sightings.length).toFixed(4), distinct: unmappedCounts.size },
  gaps: { beforeClassification: before.length, afterClassification: queue.length, afterOverThreshold: queue.filter(e => e.weightedCount >= KIT_GAP_THRESHOLD).length },
  pands: new Set(sightings.map(s => s.pandId)).size,
  pandsRidePriority: [...needed].filter(isPriority).length,
  pandsWithoutBuurt: [...needed].filter(p => !buurtOf.get(p)?.code).length,
  components: byComponent,
  unmappedList: [...unmappedCounts].sort((a, b) => b[1] - a[1]).map(([text, n]) => ({ text, n })),
  stats,
};

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'queue.json'), JSON.stringify(queue, null, 1) + '\n');
writeFileSync(path.join(OUT, 'sources.json'), JSON.stringify(summary, null, 1) + '\n');
const previous = existsSync(DOC) ? readFileSync(DOC, 'utf8') : '';
// A hand-written kit-gaps.md (no generated header, no Notes heading) holds prose this script would lose: move it under
// `## Notes` once by hand, then rerun.
if (previous.trim() && !previous.includes(GENERATED_MARK) && !notesOf(previous)) {
  console.error(`${rel(DOC)} is hand-written and has no "## Notes" heading; move its prose under one, then rerun`);
  process.exit(1);
}
writeFileSync(DOC, renderKitGapsDoc(queue, { generated, notes: notesOf(previous) }));

const pct = (n: number) => `${(100 * n / sightings.length).toFixed(1)}%`;
console.log(`kit gaps: ${sightings.length} sightings (spec ${summary.sightings.spec}, type ${summary.sightings.type}) on ${summary.pands} pands`);
console.log(`  gaps before classification (raw wording): ${before.length}; after: ${queue.length}; at or over ${KIT_GAP_THRESHOLD}: ${summary.gaps.afterOverThreshold}`);
console.log(`  unmapped (other): ${unmappedLines.length} sightings (${pct(unmappedLines.length)}), ${unmappedCounts.size} distinct wordings`);
console.log(`  components: ${Object.entries(byComponent).map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log(`  pands in a ride-priority gebied: ${summary.pandsRidePriority} of ${summary.pands}; with no buurt (weight 1): ${summary.pandsWithoutBuurt}`);
console.log(`  unmapped list (sightings, wording):`);
for (const { text, n } of summary.unmappedList.slice(0, UNMAPPED_SHOWN)) console.log(`    ${n}\t${text.slice(0, 120)}`);
if (summary.unmappedList.length > UNMAPPED_SHOWN) console.log(`    ... ${summary.unmappedList.length - UNMAPPED_SHOWN} more in sources.json`);
console.log(`  top ${Math.min(20, queue.length)} gaps (weighted / pands / ride-priority, 3 example pands):`);
queue.slice(0, 20).forEach((e, i) => console.log(`    ${i + 1}. ${e.weightedCount} / ${e.pandCount} / ${e.priorityPandCount}  [${e.component}] ${e.gap.slice(0, 90)}  e.g. ${e.examples.map(x => x.pandId).join(', ')}`));
console.log(`wrote ${rel(path.join(OUT, 'queue.json'))}, ${rel(path.join(OUT, 'sources.json'))}, ${rel(DOC)}`);
