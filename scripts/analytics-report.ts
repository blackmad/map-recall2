/**
 * Print the last N days of consent-free gameplay analytics counters (#115).
 *
 *   tsx scripts/analytics-report.ts [--days 7] [--project map-recall2-blackmad]
 *                                   [--buurt-json artifacts/analytics/buurt-rides.json] [--json]
 *
 * Reads analytics_daily/{day}/analytics_shards with the operator's gcloud
 * account (IAM; the Firestore rules deny every browser). Under
 * FIRESTORE_EMULATOR_HOST it reads the emulator instead.
 *
 * `--buurt-json` writes buurt ride counts, most ridden first, keyed by the
 * coverage-v1 `code`: the input a buurt-priority-by-ride ranking reads.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ANALYTICS_COLLECTION, SHARD_COLLECTION, dayKey, sumShards } from '../src/canalRecall/analytics/aggregate';
import { buurtRides, dayRange, mergeDays, summariseDay, tally, type DayCounters } from '../src/canalRecall/analytics/report';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const days = Math.max(1, Math.min(366, Number(option('--days', '7')) || 7));
const project = option('--project', process.env.FIRESTORE_EMULATOR_HOST ? 'demo-canal-analytics' : 'map-recall2-blackmad');
if (!/^[a-z0-9-]+$/.test(project)) throw new Error('Invalid project');
const buurtJson = option('--buurt-json', '');
const asJson = args.includes('--json');

type FirestoreValue = { integerValue?: string; doubleValue?: number; mapValue?: { fields?: Record<string, FirestoreValue> } };

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const base = emulator
  ? `http://${emulator}/v1/projects/${project}/databases/(default)/documents`
  : `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const headers: Record<string, string> = emulator
  ? { Authorization: 'Bearer owner' }
  : {
    // The operator's account; never printed or written.
    Authorization: `Bearer ${execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()}`,
    'x-goog-user-project': project,
  };

async function readDay(day: string): Promise<DayCounters> {
  const shards: Array<Record<string, number>> = [];
  let pageToken = '';
  do {
    const url = `${base}/${ANALYTICS_COLLECTION}/${day}/${SHARD_COLLECTION}?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`${day}: ${r.status} ${await r.text()}`);
    const body = await r.json() as { documents?: Array<{ fields?: Record<string, FirestoreValue> }>; nextPageToken?: string };
    for (const doc of body.documents ?? []) {
      const fields = doc.fields?.c?.mapValue?.fields ?? {};
      shards.push(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, Number(v.integerValue ?? v.doubleValue ?? 0)])));
    }
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return { day, counters: sumShards(shards) };
}

function buurtNames(): Map<string, string> {
  try {
    const fc = JSON.parse(readFileSync(path.join(ROOT, 'public/data/extracts/amsterdam/coverage-v1/buurten.json'), 'utf8')) as
      { features: Array<{ properties: { code: string; name: string } }> };
    return new Map(fc.features.map(f => [f.properties.code, f.properties.name]));
  } catch {
    return new Map();
  }
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–');
function table(title: string, rows: Record<string, number>): void {
  const entries = Object.entries(rows).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return;
  console.log(`\n${title}`);
  for (const [key, n] of entries) console.log(`  ${String(n).padStart(6)}  ${key}`);
}

const range = dayRange(dayKey(new Date()), days);
const perDay = [];
for (const day of range) perDay.push(await readDay(day));
const total = mergeDays(perDay);
const names = buurtNames();
const buurten = buurtRides(total, names);

if (buurtJson) {
  const out = path.resolve(ROOT, buurtJson);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify({
    version: 1,
    source: `${ANALYTICS_COLLECTION} counters, project ${project}`,
    from: range[0], to: range[range.length - 1], days,
    method: 'rides that entered each buurt (once per ride), consent-free analytics #115',
    buurten,
  }, null, 2)}\n`);
  console.error(`Wrote ${path.relative(ROOT, out)} (${buurten.length} buurten)`);
}

if (asJson) {
  console.log(JSON.stringify({ project, days: perDay, buurten }, null, 2));
} else {
  console.log(`Analytics ${range[0]} … ${range[range.length - 1]} (${project})`);
  console.log('\n  day         sessions  starts  finished  abandoned  completion  answers  correct');
  for (const d of perDay.map(summariseDay)) {
    console.log(`  ${d.day}  ${String(d.sessions).padStart(8)}  ${String(d.rideStarts).padStart(6)}  ${String(d.finished).padStart(8)}  ${String(d.abandoned).padStart(9)}  ${(d.completion === null ? '–' : pct(d.finished, d.rideStarts)).padStart(10)}  ${String(d.answers).padStart(7)}  ${pct(d.correct, d.answers).padStart(7)}`);
  }
  table('Sessions by device', tally(total, 'session', ['device']));
  table('Ride starts by mode, entry', tally(total, 'ride_start', ['mode', 'entry']));
  table('Ride starts by city, ride number', tally(total, 'ride_start', ['city', 'seq']));
  table('Ride ends by mode, outcome, step', tally(total, 'ride_end', ['mode', 'outcome', 'step']));
  table('Abandoned rides by progress', Object.fromEntries(Object.entries(tally(total, 'ride_end', ['outcome', 'progress'])).filter(([k]) => k.startsWith('abandoned')).map(([k, n]) => [k.replace('abandoned ', ''), n])));
  table('Questions answered per ride', tally(total, 'ride_end', ['answered']));
  const accuracy: Record<string, number> = {};
  const byKind = tally(total, 'answer', ['mode', 'kind', 'outcome']);
  table('Answers by mode, kind, outcome', byKind);
  for (const [key, n] of Object.entries(tally(total, 'answer', ['kind', 'input']))) {
    const [kind, input] = key.split(' ');
    const correct = tally(total, 'answer', ['kind', 'input', 'outcome'])[`${kind} ${input} correct`] ?? 0;
    accuracy[`${kind} ${input} ${pct(correct, n)} correct`] = n;
  }
  table('Answer accuracy by kind, input (n answers)', accuracy);
  table('Ride length (minutes)', tally(total, 'ride_length', ['mode', 'minutes']));
  table('Ride length (distance)', tally(total, 'ride_length', ['mode', 'distance']));
  table('Performance tier by device', tally(total, 'perf', ['device', 'tier']));
  table('Graphics failures', tally(total, 'graphics_failure', ['device', 'kind']));
  table('Endpoint', Object.fromEntries(Object.entries(total).filter(([k]) => k.startsWith('_meta|'))));
  console.log('\nBuurten ridden (rides entering each, top 30)');
  for (const row of buurten.slice(0, 30)) console.log(`  ${String(row.rides).padStart(6)}  ${row.code}  ${row.name}  ${JSON.stringify(row.byMode)}`);
}
