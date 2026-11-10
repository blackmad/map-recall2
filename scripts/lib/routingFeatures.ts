// The street extract as the game loads it. The default is the compiled
// binary (roads-v2/streets-routing.bin.gz, decoded by the same
// loadRoadExtract the browser runs), so routing checks exercise the
// default path. ROADS=json reads streets-routing.json instead, matching
// the game's ?roads=json fallback.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadRoadExtract } from '../../src/canalRecall/routing/roadExtract.ts';

export type RoutingSource = 'bin' | 'json';

export function routingSource(): RoutingSource {
  return process.env.ROADS === 'json' ? 'json' : 'bin';
}

/**
 * `ROUTING_EXTRACT_DIR` points the routing checks at a staged extract (lane D2:
 * `ROADS=json ROUTING_EXTRACT_DIR=public/data/extracts/amsterdam/staging/d2-routing`).
 * It replaces the default Amsterdam directory only.
 */
export function routingDirectory(fallback = 'public/data/extracts/amsterdam'): string {
  return process.env.ROUTING_EXTRACT_DIR || fallback;
}

export async function loadRoutingFeatures<T = unknown>(directory = routingDirectory()): Promise<T[]> {
  if (routingSource() === 'json') {
    return JSON.parse(await readFile(path.join(directory, 'streets-routing.json'), 'utf8')) as T[];
  }
  const bytes = await readFile(path.join(directory, 'roads-v2', 'streets-routing.bin.gz'));
  const { features } = await loadRoadExtract(new Uint8Array(bytes));
  return features as unknown as T[];
}
