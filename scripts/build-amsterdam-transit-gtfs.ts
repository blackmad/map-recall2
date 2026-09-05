/**
 * Build a compact Amsterdam GVB transit network from OVapi GTFS.
 *
 * Downloads (or reuses) the NL GTFS zip, keeps tram / metro / ferry for agency
 * GVB, and writes one representative trip + shape + stop sequence per line.
 *
 *   npm run build:amsterdam-transit-gtfs
 *   npx tsx scripts/build-amsterdam-transit-gtfs.ts --force-download
 */
import { execFile } from 'node:child_process';
import { createWriteStream, statSync } from 'node:fs';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { readGtfsCsv } from './lib/gtfs-csv.ts';
import {
  GVB_AGENCY_ID,
  GTFS_ROUTE_TYPE_TO_MODE,
  OVAPI_GTFS_NL_URL,
  inAmsterdamBbox,
  summarizeTransitNetwork,
  type TransitLine,
  type TransitNetwork,
  type TransitStop,
} from '../src/canalRecall/transit/network.ts';

const run = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'transit');
const DEFAULT_ZIP = path.join(CACHE_DIR, 'gtfs-nl.zip');
const DEFAULT_OUT = path.join(ROOT, 'public', 'data', 'extracts', 'amsterdam', 'transit-network.json');
const USER_AGENT = 'map-recall2-transit-spike/0.1 (github.com/blackmad/map-recall2; research)';

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureGtfs(zipPath: string, force: boolean): Promise<string> {
  if (!force && await exists(zipPath)) return zipPath;
  await mkdir(path.dirname(zipPath), { recursive: true });
  process.stdout.write(`downloading ${OVAPI_GTFS_NL_URL} → ${zipPath}\n`);
  const response = await fetch(OVAPI_GTFS_NL_URL, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' },
  });
  if (!response.ok || !response.body) {
    throw new Error(`GTFS download failed: ${response.status} ${response.statusText}`);
  }
  await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), createWriteStream(zipPath));
  process.stdout.write(`downloaded\n`);
  return zipPath;
}

async function extractZip(zipPath: string, dest: string): Promise<string> {
  if (await exists(path.join(dest, 'routes.txt')) && await exists(path.join(dest, 'stop_times.txt'))) {
    return dest;
  }
  await mkdir(dest, { recursive: true });
  process.stdout.write(`unzipping into ${dest}\n`);
  await run('unzip', ['-o', '-q', zipPath, '-d', dest]);
  return dest;
}

async function buildNetwork(gtfsDir: string): Promise<TransitNetwork> {
  const routes = new Map<string, Omit<TransitLine, 'tripId' | 'headsign' | 'directionId' | 'stopIds' | 'path'>>();

  for await (const row of readGtfsCsv(path.join(gtfsDir, 'routes.txt'))) {
    if (row.agency_id !== GVB_AGENCY_ID) continue;
    const mode = GTFS_ROUTE_TYPE_TO_MODE[row.route_type ?? ''];
    if (!mode) continue;
    routes.set(row.route_id!, {
      routeId: row.route_id!,
      ref: row.route_short_name || '',
      name: row.route_long_name || '',
      mode,
      color: (row.route_color || '').toUpperCase() || null,
      textColor: (row.route_text_color || '').toUpperCase() || null,
    });
  }

  const tripsByRoute = new Map<string, Record<string, string>[]>();
  for await (const row of readGtfsCsv(path.join(gtfsDir, 'trips.txt'))) {
    const routeId = row.route_id;
    if (!routeId || !routes.has(routeId)) continue;
    const list = tripsByRoute.get(routeId) ?? [];
    list.push(row);
    tripsByRoute.set(routeId, list);
  }

  const chosenTrip = new Map<string, Record<string, string>>();
  const shapeIds = new Set<string>();
  for (const [routeId, trips] of tripsByRoute) {
    const withShape = trips.find((t) => t.shape_id);
    const pick = withShape ?? trips[0];
    if (!pick) continue;
    chosenTrip.set(routeId, pick);
    if (pick.shape_id) shapeIds.add(pick.shape_id);
  }

  const shapes = new Map<string, Array<{ seq: number; lon: number; lat: number }>>();
  for await (const row of readGtfsCsv(path.join(gtfsDir, 'shapes.txt'))) {
    const shapeId = row.shape_id;
    if (!shapeId || !shapeIds.has(shapeId)) continue;
    const list = shapes.get(shapeId) ?? [];
    list.push({
      seq: Number(row.shape_pt_sequence),
      lon: Number(row.shape_pt_lon),
      lat: Number(row.shape_pt_lat),
    });
    shapes.set(shapeId, list);
  }
  for (const list of shapes.values()) list.sort((a, b) => a.seq - b.seq);

  const neededTrips = new Map<string, string>();
  for (const [routeId, trip] of chosenTrip) {
    if (trip.trip_id) neededTrips.set(trip.trip_id, routeId);
  }

  const stopSeq = new Map<string, Array<{ seq: number; stopId: string }>>();
  const neededStops = new Set<string>();
  for await (const row of readGtfsCsv(path.join(gtfsDir, 'stop_times.txt'))) {
    const routeId = neededTrips.get(row.trip_id ?? '');
    if (!routeId) continue;
    const stopId = row.stop_id;
    if (!stopId) continue;
    const list = stopSeq.get(routeId) ?? [];
    list.push({ seq: Number(row.stop_sequence), stopId });
    stopSeq.set(routeId, list);
    neededStops.add(stopId);
  }
  for (const list of stopSeq.values()) list.sort((a, b) => a.seq - b.seq);

  const stops: Record<string, TransitStop> = {};
  for await (const row of readGtfsCsv(path.join(gtfsDir, 'stops.txt'))) {
    const stopId = row.stop_id;
    if (!stopId || !neededStops.has(stopId)) continue;
    const lat = row.stop_lat ? Number(row.stop_lat) : NaN;
    const lon = row.stop_lon ? Number(row.stop_lon) : NaN;
    const hasCenter = Number.isFinite(lat) && Number.isFinite(lon);
    stops[stopId] = {
      stopId,
      name: row.stop_name || '',
      center: hasCenter ? [lat, lon] : null,
      parentStation: row.parent_station || null,
      inAmsterdamBbox: hasCenter ? inAmsterdamBbox(lat, lon) : false,
    };
  }

  const lines: TransitLine[] = [...routes.entries()]
    .sort((a, b) => a[1].mode.localeCompare(b[1].mode) || a[1].ref.localeCompare(b[1].ref, undefined, { numeric: true }))
    .flatMap(([routeId, meta]) => {
      const trip = chosenTrip.get(routeId);
      if (!trip) return [];
      const seq = (stopSeq.get(routeId) ?? [])
        .map((s) => s.stopId)
        .filter((id) => id in stops);
      const shapeId = trip.shape_id;
      const shape = shapeId ? shapes.get(shapeId) : undefined;
      const path: [number, number][] | null = shape
        ? shape.map((p) => [p.lat, p.lon])
        : null;
      return [{
        ...meta,
        tripId: trip.trip_id || '',
        headsign: trip.trip_headsign || '',
        directionId: trip.direction_id || '',
        stopIds: seq,
        path,
      }];
    });

  return {
    cityId: 'amsterdam',
    source: 'OVapi GTFS NL (agency GVB); tram/metro/ferry only',
    feed: OVAPI_GTFS_NL_URL,
    generatedNote: 'one representative trip + shape per route',
    counts: summarizeTransitNetwork(lines, stops),
    lines,
    stops,
  };
}

async function main(): Promise<void> {
  const zipPath = path.resolve(argument('gtfs') || DEFAULT_ZIP);
  const outPath = path.resolve(argument('out') || DEFAULT_OUT);
  const forceDownload = process.argv.includes('--force-download');

  await ensureGtfs(zipPath, forceDownload);
  const gtfsDir = await extractZip(zipPath, path.join(CACHE_DIR, 'gtfs-nl'));
  const network = await buildNetwork(gtfsDir);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(network));
  process.stdout.write(`${JSON.stringify(network.counts, null, 2)}\n`);
  process.stdout.write(`wrote ${outPath} (${statSync(outPath).size} bytes)\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
