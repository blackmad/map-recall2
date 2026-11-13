// scan:targets — the list behind /scan.html: street art and memorials the game has no 3D model of yet, for
// David to LiDAR-scan on his phone. Reads the street-art extract and the explorer index (installed models with
// a position), drops murals (flat), and marks a piece "modelled" when a free-standing model (no pand) stands
// within MODELLED_METRES or shares its name.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { scanTargets, type ArtPoint, type ModelPoint } from '../../src/canalRecall/scanFinder/targets.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const art = JSON.parse(readFileSync(path.join(ROOT, 'public/data/extracts/amsterdam/street-art.json'), 'utf8')) as { points: ArtPoint[] };
const index = JSON.parse(readFileSync(path.join(ROOT, 'public/data/extracts/amsterdam/explorer-index.json'), 'utf8')) as {
  models: { id: string; name?: string; lngLat?: [number, number]; pandIds?: string[] }[];
};
const models: ModelPoint[] = index.models
  .filter((m) => m.lngLat && (m.pandIds?.length ?? 0) === 0)
  .map((m) => ({ id: m.id, name: m.name ?? m.id, lng: m.lngLat![0], lat: m.lngLat![1] }));

const out = scanTargets(art.points, models);
const file = path.join(ROOT, 'public/canal-drive/scan-targets.json');
writeFileSync(file, JSON.stringify({ version: 1, source: 'street-art.json + explorer-index.json', targets: out }) + '\n');
const todo = out.filter((t) => !t.m).length;
console.log(`scan-targets.json: ${out.length} pieces, ${out.length - todo} modelled, ${todo} to scan`);
