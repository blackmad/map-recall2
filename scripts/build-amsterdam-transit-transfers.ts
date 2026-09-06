/**
 * Publish Amsterdam transit transfer edges for Phase E.
 *
 * Derives walk transfers from the committed `transit-network.json` (parent
 * stations + proximity). When a local GTFS zip is present, GTFS `transfers.txt`
 * rows that touch GVB stops are preferred and merged in.
 *
 *   npm run build:amsterdam-transit-transfers
 */
import { access, mkdir, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGtfsCsv } from './lib/gtfs-csv.ts';
import type { TransitNetwork } from '../src/canalRecall/transit/network.ts';
import { TRANSIT_DRIVEABLE_MODES } from '../src/canalRecall/transit/segments.ts';
import {
  deriveTransfersFromNetwork,
  summarizeTransferEdges,
  transfersFromGtfsRows,
  type TransitTransferEdge,
  type TransitTransfers,
} from '../src/canalRecall/transit/transfers.ts';
import { readFileSync } from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NETWORK_PATH = path.join(ROOT, 'public/data/extracts/amsterdam/transit-network.json');
const OUT_PATH = path.join(ROOT, 'public/data/extracts/amsterdam/transit-transfers.json');
const GTFS_TRANSFERS = path.join(ROOT, '.cache/transit/gtfs-nl/transfers.txt');

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const networkPath = path.resolve(argument('network') || NETWORK_PATH);
  const outPath = path.resolve(argument('out') || OUT_PATH);
  const network = JSON.parse(readFileSync(networkPath, 'utf8')) as TransitNetwork;

  const derived = deriveTransfersFromNetwork(network, {
    modes: TRANSIT_DRIVEABLE_MODES,
    proximityM: 90,
  });

  let edges: TransitTransferEdge[] = [...derived.transfers];
  let source = derived.source;
  let note = derived.generatedNote;

  if (await exists(GTFS_TRANSFERS)) {
    const known = new Set(Object.keys(network.stops));
    const gtfsEdges = await (async () => {
      const rows: Array<{ from_stop_id?: string; to_stop_id?: string; min_transfer_time?: string }> = [];
      for await (const row of readGtfsCsv(GTFS_TRANSFERS)) rows.push(row);
      return transfersFromGtfsRows(rows, known);
    })();
    if (gtfsEdges.length) {
      const seen = new Set(gtfsEdges.map((e) => `${e.fromStopId}\0${e.toStopId}`));
      const merged = [...gtfsEdges];
      for (const edge of derived.transfers) {
        const key = `${edge.fromStopId}\0${edge.toStopId}`;
        const rev = `${edge.toStopId}\0${edge.fromStopId}`;
        if (seen.has(key) || seen.has(rev)) continue;
        merged.push(edge);
        seen.add(key);
      }
      edges = merged;
      source = 'OVapi GTFS transfers.txt + derived parent/proximity fill';
      note = `${gtfsEdges.length} GTFS edges; ${merged.length - gtfsEdges.length} derived fill`;
    }
  }

  const payload: TransitTransfers = {
    cityId: 'amsterdam',
    source,
    generatedNote: note,
    counts: summarizeTransferEdges(edges),
    transfers: edges,
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(payload)}\n`);
  process.stdout.write(`${JSON.stringify(payload.counts, null, 2)}\n`);
  process.stdout.write(`wrote ${outPath} (${statSync(outPath).size} bytes)`
    + `${existsSync(GTFS_TRANSFERS) ? '' : ' (no local GTFS transfers.txt — derived only)'}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
