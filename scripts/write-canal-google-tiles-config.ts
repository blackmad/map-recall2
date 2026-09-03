/**
 * Emit public/canal-drive/google-tiles-config.json from env.
 *
 * Canal Recall is a static page outside the Vite build, so it cannot read
 * import.meta.env. It fetches this file at runtime and leaves photoreal off
 * when the file is absent. The file is gitignored: the Map Tiles browser key
 * is origin-restricted, but it still must not live in the committed source or
 * the generated google-tiles.bundle.js.
 *
 * Rotate with `gcloud services api-keys create` / `delete` in project
 * `map-cms-amsterdam-v1` (Map Tiles + HTTP referrers), put the new value in
 * `.env.local` as `VITE_GOOGLE_MAP_TILES_API_KEY`, then run
 * `npm run canal:google-tiles-config`. Soft-delete the old key after deploy.
 */
import { writeFile, rm } from 'fs/promises';
import path from 'path';
import { config as loadEnv } from 'dotenv';

for (const file of ['.env.local', '.env']) loadEnv({ path: file, override: false });

const apiKey = process.env.VITE_GOOGLE_MAP_TILES_API_KEY
  || process.env.GOOGLE_MAP_TILES_API_KEY
  || '';

const target = path.join('public', 'canal-drive', 'google-tiles-config.json');

if (!apiKey) {
  await rm(target, { force: true });
  console.log('No Google Map Tiles API key found — photoreal stays off.');
} else {
  await writeFile(target, JSON.stringify({ apiKey }, null, 2) + '\n');
  console.log(`Wrote ${target}`);
}
