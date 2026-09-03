// Pulls the City of Amsterdam's survey models and matches them to the game's
// own landmarks.
//
// The municipality's Geo- en Vastgoedinformatie department publishes eleven
// buildings on 3D Warehouse. Each one arrives life-size, georeferenced, and
// with a street address and a paragraph of history attached — far better
// provenance than anything reconstructed from photographs, and the reason
// placement can trust the survey instead of fitting a mesh to a footprint.
//
// This writes to a staging directory and prints a report. It publishes
// nothing: the catalogue it emits is reviewed and the GLBs are built through
// `build-signature-landmark.ts --profile=sketchup` before anything reaches
// `public/canal-drive/models/`.
//
//   npx tsx scripts/fetch-3dwarehouse-landmarks.ts [--out=<dir>]
//
// LICENCE: these are used under the 3D Warehouse General Model License, which
// permits a Combined Work but not redistributing an asset library. That
// question is open and is recorded in NOTICE.md and TODO.md.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  fitOrientedFootprint,
  metresBetween,
  type LatLng,
  type OrientedFootprint,
} from '../src/canalRecall/landmarks/signaturePlacement';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..');
const EXTRACT_PATH = path.join(REPOSITORY_ROOT, 'public', 'data', 'extracts', 'amsterdam', 'landmarks.json');

/** The publisher. Everything under this account is a municipal survey model. */
const CREATOR_ID = '0604246304459959425732014';
const API = 'https://3dwarehouse.sketchup.com/warehouse/v1.0';

interface WarehouseEntity {
  id: string;
  title: string;
  creator?: { displayName?: string };
  description?: string;
  location?: { latitude: number; longitude: number; altitude: number };
  binaryNames?: string[];
  attributes?: { geo?: { address?: { value?: string } } };
}

interface ExtractLandmark {
  id: string;
  name: string;
  center: LatLng;
  path?: LatLng[];
  wikidata?: string;
  prominenceScore?: number;
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
}

async function listEntities(): Promise<WarehouseEntity[]> {
  const url = `${API}/entities?fq=creatorId%3D%3D${CREATOR_ID}&contentType=3dw&count=50`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`3D Warehouse listing failed: ${response.status}`);
  const body = (await response.json()) as { entries: WarehouseEntity[] };
  // Extra ids named on the command line, for landmarks the city never modelled.
  // `search-3dwarehouse-landmarks.ts` is what finds them.
  const extra = (argument('ids') ?? '').split(',').map(id => id.trim()).filter(Boolean);
  const extras = await Promise.all(extra.map(id => entityDetail(id)));
  return [...body.entries, ...extras];
}

async function entityDetail(id: string): Promise<WarehouseEntity> {
  const response = await fetch(`${API}/entities/${id}`);
  if (!response.ok) throw new Error(`3D Warehouse entity ${id} failed: ${response.status}`);
  return (await response.json()) as WarehouseEntity;
}

async function downloadGlb(id: string, destination: string): Promise<number> {
  const response = await fetch(`${API}/entities/${id}/binaries/glb?download=true`);
  if (!response.ok) throw new Error(`GLB download for ${id} failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destination, buffer);
  return buffer.byteLength;
}

/**
 * Finds the extract landmark a survey model represents.
 *
 * Matched on distance from the model's own published coordinate, not on name.
 * The two vocabularies do not agree — the extract calls it "Royal Palace" and
 * the city calls it "Palace on the Dam", and "Stadhuis (City hall)" is a
 * different building from the Palace that was once the city hall — so a name
 * match would be both lossy and occasionally confidently wrong. Position is
 * unambiguous.
 */
function matchLandmark(
  entity: WarehouseEntity,
  landmarks: ExtractLandmark[],
  maxMetres = 120,
): { landmark: ExtractLandmark; metres: number } | null {
  if (!entity.location) return null;
  const anchor: LatLng = [entity.location.latitude, entity.location.longitude];
  let best: { landmark: ExtractLandmark; metres: number } | null = null;
  for (const landmark of landmarks) {
    if (!landmark.center) continue;
    const metres = metresBetween(anchor, landmark.center);
    if (!best || metres < best.metres) best = { landmark, metres };
  }
  return best && best.metres <= maxMetres ? best : null;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main(): Promise<void> {
  const outDirectory = path.resolve(argument('out') ?? path.join(REPOSITORY_ROOT, '.cache', '3dwarehouse'));
  fs.mkdirSync(outDirectory, { recursive: true });
  const landmarks = JSON.parse(fs.readFileSync(EXTRACT_PATH, 'utf8')) as ExtractLandmark[];

  const entities = await listEntities();
  console.log(`${entities.length} models published by the City of Amsterdam\n`);

  const catalogue: unknown[] = [];
  for (const summary of entities) {
    const entity = await entityDetail(summary.id);
    const slug = slugify(entity.title);
    const hasGlb = (entity.binaryNames ?? []).includes('glb');
    const match = matchLandmark(entity, landmarks);
    const footprint: OrientedFootprint | null = match?.landmark.path?.length
      ? fitOrientedFootprint(match.landmark.path)
      : null;

    let bytes = 0;
    if (hasGlb) {
      const destination = path.join(outDirectory, `${slug}.glb`);
      bytes = fs.existsSync(destination)
        ? fs.statSync(destination).size
        : await downloadGlb(entity.id, destination);
    }

    console.log(`${entity.title}`);
    console.log(`  slug        ${slug}`);
    console.log(`  glb         ${hasGlb ? `${(bytes / 1e6).toFixed(2)} MB` : 'MISSING'}`);
    console.log(`  anchor      ${entity.location ? `${entity.location.latitude.toFixed(6)}, ${entity.location.longitude.toFixed(6)}` : 'MISSING'}`);
    console.log(`  author      ${entity.creator?.displayName ?? 'unknown'}`);
    console.log(`  matched     ${match ? `${match.landmark.name} (${match.metres.toFixed(0)} m, ${match.landmark.id})` : 'no landmark within 120 m'}`);
    console.log(`  footprint   ${footprint ? `${footprint.lengthMetres.toFixed(1)} × ${footprint.widthMetres.toFixed(1)} m, heading ${footprint.headingDegrees.toFixed(1)}°` : 'no ring in the extract'}`);
    console.log();

    catalogue.push({
      id: slug,
      name: entity.title,
      author: entity.creator?.displayName ?? 'unknown',
      warehouseId: entity.id,
      address: entity.attributes?.geo?.address?.value ?? null,
      description: entity.description ?? null,
      anchor: entity.location ? [entity.location.longitude, entity.location.latitude] : null,
      landmarkId: match?.landmark.id ?? null,
      landmarkName: match?.landmark.name ?? null,
      matchMetres: match ? Number(match.metres.toFixed(1)) : null,
      footprint,
      sourceBytes: bytes,
      hasGlb,
    });
  }

  const cataloguePath = path.join(outDirectory, 'catalogue.json');
  fs.writeFileSync(cataloguePath, `${JSON.stringify(catalogue, null, 2)}\n`);
  console.log(`wrote ${path.relative(REPOSITORY_ROOT, cataloguePath)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
