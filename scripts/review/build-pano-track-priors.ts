/** Build coarse boresight priors for every cached Amsterdam panorama.
 *
 * Reads the cached pano lists for one area, derives the GPS track bearing from
 * same-track neighbours, and writes the per-panorama prior used to constrain
 * the boresight search. See `src/canalRecall/facade/panoTrackPrior.ts`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackPriorFor, type PanoFix, type TrackPrior } from '../../src/canalRecall/facade/panoTrackPrior.ts';

const RAW_DIR = '.cache/city-appearance/areas/da-costabuurt-v1/raw';
const OUT = 'review-data/pano-track-priors.json';
const PANO_FILE = /^panoramas-\d+\.json$/;
/** Neighbours each side for the track fit. A longer baseline (3) made things
 * worse here: the road curves, so the wider chord is not the local travel
 * direction. Window 1 is the best measured setting. */
const WINDOW = 1;

interface RawPanorama {
  pano_id?: string;
  geometry?: { coordinates?: [number, number, number] };
  heading?: number | null;
}

interface RawList {
  _embedded?: { panoramas?: RawPanorama[] };
}

async function loadFixes(): Promise<PanoFix[]> {
  const entries = await fs.readdir(RAW_DIR);
  const files = entries.filter((name) => PANO_FILE.test(name)).sort();
  const byId = new Map<string, PanoFix>();
  for (const file of files) {
    const raw = JSON.parse(await fs.readFile(path.join(RAW_DIR, file), 'utf8')) as RawList;
    for (const pano of raw._embedded?.panoramas ?? []) {
      const id = pano.pano_id;
      const coordinates = pano.geometry?.coordinates;
      const heading = pano.heading;
      if (!id || !coordinates || typeof heading !== 'number' || !Number.isFinite(heading)) continue;
      byId.set(id, { panoramaId: id, lngLat: [coordinates[0], coordinates[1]], headingDeg: heading });
    }
  }
  return [...byId.values()];
}

async function build() {
  const fixes = await loadFixes();
  const priors: TrackPrior[] = fixes.map((fix) => trackPriorFor(fix.panoramaId, fixes, { window: WINDOW }));
  const counts = { high: 0, low: 0, none: 0 };
  for (const prior of priors) counts[prior.confidence] += 1;

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(priors, null, 2) + '\n');
  console.log(
    `pano track priors: ${priors.length} panos (high ${counts.high}, low ${counts.low}, none ${counts.none}) -> ${OUT}`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
