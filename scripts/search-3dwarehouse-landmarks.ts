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
const EXTRACT_DIRECTORY = path.join(REPOSITORY_ROOT, 'public', 'data', 'extracts');
const API = 'https://3dwarehouse.sketchup.com/warehouse/v1.0';

/** Anything further than this is a different building with a similar name. */
const MAX_MATCH_METRES = 150;

interface ExtractLandmark {
  id: string;
  name: string;
  center: LatLng;
  prominenceScore?: number;
  /** e.g. `nl:Koninklijk Concertgebouw`. 676 of the 1,680 landmarks across the
   *  four cities carry one, and on a site this Dutch it is the better query. */
  wikipedia?: string;
}

interface Candidate {
  city: string;
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

/**
 * One request, retried, because a few hundred landmarks is enough traffic for
 * 3D Warehouse to start dropping connections and a single ETIMEDOUT should not
 * throw away a run that is twenty minutes in.
 */
async function get(url: string, attempts = 4): Promise<Response | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (response.ok) return response;
      // 429 and 5xx are worth waiting out; a 404 is not.
      if (response.status < 429) return null;
    } catch {
      // fall through to the backoff
    }
    await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
  }
  return null;
}

async function search(term: string): Promise<{ id: string; title: string; creator: string }[]> {
  const url = `${API}/entities?q=${encodeURIComponent(term)}&contentType=3dw&count=10`;
  const response = await get(url);
  if (!response) return [];
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
  const response = await get(`${API}/entities/${id}`);
  if (!response) return null;
  return (await response.json()) as never;
}

async function main(): Promise<void> {
  const limit = Number(argument('limit') ?? 40);
  const city = argument('city') ?? 'amsterdam';
  const cityLabel = city === 'den-haag' ? 'Den Haag' : city[0].toUpperCase() + city.slice(1);
  const extractPath = path.join(EXTRACT_DIRECTORY, city, 'landmarks.json');
  const landmarks = (JSON.parse(fs.readFileSync(extractPath, 'utf8')) as ExtractLandmark[])
    .filter(landmark => landmark.center && landmark.name)
    .sort((a, b) => (b.prominenceScore ?? 0) - (a.prominenceScore ?? 0))
    .slice(0, limit);

  console.log(`searching for the ${landmarks.length} most prominent ${cityLabel} landmarks\n`);
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  for (const landmark of landmarks) {
    // Three queries, because the obvious one is the weakest. The extract's
    // English name is a translation the modeller never used — nobody uploads
    // "Old Church" — so the Dutch Wikipedia title is searched too, and the
    // city is appended because "Westerkerk" also finds Haarlem's and "Nemo" on
    // its own finds submarines.
    const dutch = (landmark.wikipedia ?? '').startsWith('nl:')
      ? landmark.wikipedia!.slice(3).replace(/\s*\(.*?\)\s*$/, '')
      : null;
    const terms = [landmark.name, `${landmark.name} ${cityLabel}`, ...(dutch ? [dutch] : [])];
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
        city,
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

  const outPath = argument('out') ?? path.join(REPOSITORY_ROOT, '.cache', '3dwarehouse', `search-${city}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(candidates, null, 2)}\n`);
  console.log(`wrote ${path.relative(REPOSITORY_ROOT, outPath)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
