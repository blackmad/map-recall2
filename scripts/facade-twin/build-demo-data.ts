/**
 * Compile the reconnaissance into one small file a map can draw.
 *
 * The point of the demo is not that the pilot looks finished — it does not, and
 * nothing has been observed yet. The point is that what *is* known is known
 * per building, from a named source, and that the gaps are visible as gaps.
 * So every building carries its evidence, and "we have not looked at this one"
 * is a rendered state rather than an omission.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { HeritageRecord, LngLat, MassingRecord, SemanticsRecord } from '../../src/canalRecall/facade/sources.ts';
import { resolveArea } from '../../src/canalRecall/facade/surveyArea.ts';
import { loadNamedWays } from './fetch-area-features.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);

const cached = async <T>(name: string): Promise<T> =>
  JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-${name}.json`), 'utf8')).data as T;

/**
 * Gable vocabulary as the register writes it.
 *
 * This is a *reading of a written statement*, not a measurement of a building.
 * The matched phrase travels with the value so the reading can be checked, and
 * a description naming two gable types resolves to `null` rather than to
 * whichever pattern happened to match first.
 */
const GABLES: Array<[type: string, pattern: RegExp]> = [
  ['trapgevel', /\btrapgevel\w*/i],
  ['halsgevel', /\b(verhoogde\s+)?halsgevel\w*/i],
  ['klokgevel', /\bklokgevel\w*/i],
  ['tuitgevel', /\btuitgevel\w*/i],
  ['puntgevel', /\bpuntgevel\w*/i],
  ['lijstgevel', /\b(lijstgevel\w*|kroonlijst\w*|rechte lijst|triglyfenlijst\w*)/i],
];

function readGable(description: string | null): { type: string; phrase: string } | null {
  if (!description) return null;
  const hits = GABLES.filter(([, pattern]) => pattern.test(description));
  if (hits.length !== 1) return null; // ambiguous or absent: say nothing
  const [type, pattern] = hits[0];
  const match = description.match(pattern)!;
  const start = Math.max(0, match.index! - 40);
  return { type, phrase: description.slice(start, Math.min(description.length, match.index! + match[0].length + 40)).trim() };
}

const boundary = resolveArea(AREA, RD_NEW, await loadNamedWays(AREA));
const registry = await cached<Array<{ buildingId: string; constructionYear: number | null; active: boolean; footprintLngLat: LngLat[] }>>('registry');
const massing = await cached<MassingRecord[]>('massing');
// From recon.json, not the cache: the cache holds listings as fetched, before
// they are resolved to a building, so its buildingId is null for every record.

const semantics = await cached<SemanticsRecord[]>('semantics');

const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const heritage = recon.heritage as HeritageRecord[];
const inArea = new Set<string>(recon.buildings.map((b: { buildingId: string }) => b.buildingId));
const byId = new Map(recon.buildings.map((b: any) => [b.buildingId, b]));
const massingById = new Map(massing.map(m => [m.buildingId, m]));
const semanticsById = new Map(semantics.map(r => [r.buildingId, r]));

// A building can carry several listings; keep the one that actually says something.
const heritageById = new Map<string, HeritageRecord>();
for (const record of heritage) {
  if (!record.buildingId) continue;
  const existing = heritageById.get(record.buildingId);
  if (!existing || (record.description?.length ?? 0) > (existing.description?.length ?? 0)) heritageById.set(record.buildingId, record);
}

// Project to metres relative to the area's fixed local origin, so the page draws
// in real metres and never does trigonometry on degrees.
const origin = AREA.localOrigin;
const seen = new Set<string>();
const buildings = [];
for (const entry of registry) {
  if (!inArea.has(entry.buildingId) || seen.has(entry.buildingId)) continue;
  seen.add(entry.buildingId);
  const record = byId.get(entry.buildingId) as any;
  const mass = massingById.get(entry.buildingId);
  const listing = heritageById.get(entry.buildingId);
  const osm = semanticsById.get(entry.buildingId);
  const gable = readGable(listing?.description ?? null);

  const ring: number[] = [];
  for (const point of entry.footprintLngLat) {
    const p = RD_NEW.fromLngLat(point);
    ring.push(Math.round((p.x - origin.x) * 10) / 10, Math.round((p.y - origin.y) * 10) / 10);
  }

  buildings.push({
    id: entry.buildingId,
    ring,
    year: entry.constructionYear,
    width: record?.plotWidthM ?? null,
    active: entry.active,
    storeys: mass?.storeys ?? null,
    roof: mass?.roofForm ?? null,
    eaves: mass && mass.eavesHeight !== null && mass.groundLevel !== null ? Math.round((mass.eavesHeight - mass.groundLevel) * 10) / 10 : null,
    ridge: mass && mass.ridgeHeight !== null && mass.groundLevel !== null ? Math.round((mass.ridgeHeight - mass.groundLevel) * 10) / 10 : null,
    err: mass?.reconstructionError !== null && mass?.reconstructionError !== undefined ? Math.round(mass.reconstructionError * 100) / 100 : null,
    listed: !!listing,
    gable: gable?.type ?? null,
    phrase: gable?.phrase ?? null,
    roofShape: osm?.roofShape ?? null,
    osmLevels: osm?.levels ?? null,
    name: osm?.name ?? listing?.category ?? null,
  });
}

const ringLocal = boundary.ring.map(p => [Math.round((p.x - origin.x) * 10) / 10, Math.round((p.y - origin.y) * 10) / 10]);

await mkdir(STAGING, { recursive: true });
const payload = {
  area: { id: AREA.areaId, name: AREA.name, areaKm2: Number(boundary.areaKm2.toFixed(3)), origin, originNote: AREA.localOriginNote },
  generatedAt: new Date().toISOString(),
  boundary: ringLocal,
  legs: boundary.legs.map(l => ({ feature: l.edge.feature, lengthM: Math.round(l.lengthM), offsetM: l.edge.outwardOffsetM })),
  buildings,
};
const file = path.join(STAGING, 'demo-data.json');
await writeFile(file, JSON.stringify(payload));
const bytes = (await readFile(file)).length;

const count = (test: (b: typeof buildings[number]) => boolean) => buildings.filter(test).length;
console.log(`${buildings.length} buildings, ${(bytes / 1024).toFixed(0)} KB`);
console.log(`  with a stated gable type   ${count(b => !!b.gable)}`);
console.log(`  listed                     ${count(b => b.listed)}`);
console.log(`  with measured massing      ${count(b => b.ridge !== null)}`);
console.log(`  with an OSM roof:shape     ${count(b => !!b.roofShape)}`);
const gableCounts = new Map<string, number>();
for (const b of buildings) if (b.gable) gableCounts.set(b.gable, (gableCounts.get(b.gable) ?? 0) + 1);
console.log(`  gable mix: ${[...gableCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`wrote ${path.relative(process.cwd(), file)}`);
