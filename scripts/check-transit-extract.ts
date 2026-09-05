/**
 * Named pins for the Amsterdam GVB transit staging extract (from OVapi GTFS).
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const extractPath = path.resolve(
  'public/data/extracts/amsterdam/transit-network.json',
);

assert.ok(existsSync(extractPath), `missing ${extractPath} — run scripts/build-amsterdam-transit-gtfs.py`);

const network = JSON.parse(readFileSync(extractPath, 'utf8')) as {
  counts: { lines: number; byMode: Record<string, number>; stops: number; linesWithPath: number };
  lines: Array<{ ref: string; mode: string; stopIds: string[]; path: number[][] | null }>;
  stops: Record<string, { name: string }>;
};

assert.equal(network.counts.byMode.tram, 17, 'GVB tram lines');
assert.equal(network.counts.byMode.metro, 5, 'GVB metro lines');
assert.equal(network.counts.byMode.ferry, 10, 'GVB ferry lines');
assert.equal(network.counts.lines, 32);
assert.equal(network.counts.linesWithPath, 32);
assert.ok(network.counts.stops >= 250, `enough stops (got ${network.counts.stops})`);

function lineHasStop(ref: string, needle: string): boolean {
  const line = network.lines.find((l) => l.ref === ref);
  assert.ok(line, `line ${ref} exists`);
  return line!.stopIds.some((id) => (network.stops[id]?.name || '').toLowerCase().includes(needle.toLowerCase()));
}

assert.ok(lineHasStop('2', 'Dam'), 'tram 2 stops at Dam');
assert.ok(lineHasStop('52', 'Noord'), 'metro 52 stops at Noord');
assert.ok(network.lines.some((l) => l.mode === 'ferry' && l.ref.startsWith('F')), 'ferry F-line present');

console.log(
  `Transit extract OK: ${network.counts.lines} lines `
  + `(${network.counts.byMode.tram} tram / ${network.counts.byMode.metro} metro / ${network.counts.byMode.ferry} ferry), `
  + `${network.counts.stops} stops.`,
);
