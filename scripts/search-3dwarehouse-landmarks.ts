// Looks for a model of every landmark the game already knows about.
//
// The municipal account was found by being handed a link, and covering nine
// buildings from it is not the same as having looked. This drives the search
// from the other end: take the Amsterdam extract's own landmarks, ordered by
// how prominent the game thinks they are, and ask 3D Warehouse whether anybody
// has modelled each one.
//
// A hit is only useful if it is downloadable *and* geolocated. Without a
// published coordinate a model has to be fitted to a footprint, which is the
// weaker path — it is what produced a Palace 24.5 m deep against a 65.5 m plot.
// So the report separates the two, and ranks by how close the model's own
// coordinate lands to the landmark the game holds.
//
//   npx tsx scripts/search-3dwarehouse-landmarks.ts [--limit=40] [--out=<file>]

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { metresBetween, type LatLng } from '../src/canalRecall/landmarks/signaturePlacement';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..');
const EXTRACT_PATH = path.join(REPOSITORY_ROOT, 'public', 'data', 'extracts', 'amsterdam', 'landmarks.json');
const API = 'https://3dwarehouse.sketchup.com/warehouse/v1.0';

/** Anything further than this is a different building with a similar name. */
const MAX_MATCH_METRES = 150;

interface ExtractLandmark {
  id: string;
  name: string;
  center: LatLng;
  prominenceScore?: number;
}

interface Candidate {
  landmark: string;
  landmarkId: string;
  title: string;
  creator: string;
  warehouseId: string;
  hasGlb: boolean;
  metres: number | null;
  downloads: number;
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
}

async function search(term: string): Promise<{ id: string; title: string; creator: string }[]> {
  const url = `${API}/entities?q=${encodeURIComponent(term)}&contentType=3dw&count=10`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const body = (await response.json()) as {
    entries?: { id: string; title?: string; creator?: { displayName?: string } }[];
  };
  return (body.entries ?? []).map(entry => ({
    id: entry.id,
    title: entry.title ?? '(untitled)',
    creator: entry.creator?.displayName ?? '(unknown)',
  }));
}

async function detail(id: string): Promise<{
  location?: { latitude: number; longitude: number };
  binaryNames?: string[];
  downloads?: number;
} | null> {
  const response = await fetch(`${API}/entities/${id}`);
  if (!response.ok) return null;
  return (await response.json()) as never;
}

async function main(): Promise<void> {
  const limit = Number(argument('limit') ?? 40);
  const landmarks = (JSON.parse(fs.readFileSync(EXTRACT_PATH, 'utf8')) as ExtractLandmark[])
    .filter(landmark => landmark.center && landmark.name)
    .sort((a, b) => (b.prominenceScore ?? 0) - (a.prominenceScore ?? 0))
    .slice(0, limit);

  console.log(`searching for the ${landmarks.length} most prominent Amsterdam landmarks\n`);
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  for (const landmark of landmarks) {
    // Both the game's name and the name with the city appended: "Westerkerk"
    // finds Haarlem's too, and "Nemo" on its own finds submarines.
    const terms = [landmark.name, `${landmark.name} Amsterdam`];
    const hits = (await Promise.all(terms.map(search))).flat();
    const found: Candidate[] = [];
    for (const hit of hits) {
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      const info = await detail(hit.id);
      if (!info) continue;
      const metres = info.location
        ? metresBetween([info.location.latitude, info.location.longitude], landmark.center)
        : null;
      if (metres !== null && metres > MAX_MATCH_METRES) continue;
      // No coordinate at all is still worth reporting; it just costs a manual
      // placement rather than a published one.
      found.push({
        landmark: landmark.name,
        landmarkId: landmark.id,
        title: hit.title,
        creator: hit.creator,
        warehouseId: hit.id,
        hasGlb: (info.binaryNames ?? []).includes('glb'),
        metres: metres === null ? null : Number(metres.toFixed(0)),
        downloads: info.downloads ?? 0,
      });
    }
    const geolocated = found.filter(c => c.metres !== null && c.hasGlb);
    if (geolocated.length) {
      console.log(`${landmark.name}`);
      for (const c of geolocated.sort((a, b) => (a.metres ?? 0) - (b.metres ?? 0))) {
        console.log(`  ✓ ${c.title.slice(0, 40).padEnd(42)} ${String(c.metres).padStart(4)} m  by ${c.creator.slice(0, 24)}`);
      }
    }
    candidates.push(...found);
  }

  const usable = candidates.filter(c => c.hasGlb && c.metres !== null);
  console.log(`\n${usable.length} geolocated, downloadable candidates across ${new Set(usable.map(c => c.landmark)).size} landmarks`);
  console.log(`${candidates.filter(c => c.hasGlb && c.metres === null).length} downloadable but not geolocated (would need manual placement)`);

  const outPath = argument('out') ?? path.join(REPOSITORY_ROOT, '.cache', '3dwarehouse', 'search.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(candidates, null, 2)}\n`);
  console.log(`wrote ${path.relative(REPOSITORY_ROOT, outPath)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
