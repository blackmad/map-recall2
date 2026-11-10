/**
 * Review list for the houseLine flip (lane H2e, #352): the street-facing groups of installed large houses whose verdict is FAIL
 * under houseLine and was not under installGate. A review list only: never an uninstall, a hold or a stale-install failure.
 *
 *   node --import tsx scripts/house-preview/houseline-new-fails.ts <installGate.json> <houseLine.json> [--out=artifacts/house-line/houseline-new-fails.json]
 *
 * Inputs are `likeness-replay.ts --replay` outputs of the same dump, one per profile.
 */
import fs from 'node:fs';
import path from 'node:path';

const HELP = `Usage: houseline-new-fails.ts <installGate.json> <houseLine.json> [--out=<file>]
Lists groups whose verdict became FAIL under houseLine (review list, never an uninstall or hold).`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.length < 2) { console.log(HELP); process.exit(args.includes('--help') ? 0 : 1); }
const [a, b] = args.filter(x => !x.startsWith('--'));
const out = args.find(x => x.startsWith('--out='))?.slice(6) ?? 'artifacts/house-line/houseline-new-fails.json';
type Row = {street: boolean; verdict: string; reasons: string[]};
const A: Record<string, Row> = JSON.parse(fs.readFileSync(a, 'utf8')), B: Record<string, Row> = JSON.parse(fs.readFileSync(b, 'utf8'));
const list = Object.entries(B).filter(([k, y]) => A[k] && y.verdict === 'FAIL' && A[k].verdict !== 'FAIL').map(([k, y]) => {
  const m = /^(.*) walls\[(\d+)\]$/.exec(k)!;
  return {pand: /(\d{5,})$/.exec(m[1])?.[1] ?? null, model: m[1], group: Number(m[2]), street: y.street, oldVerdict: A[k].verdict, newVerdict: y.verdict, oldReasons: A[k].reasons, reason: y.reasons.join('; ')};
});
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, JSON.stringify({generated: 'houseline-new-fails.ts', note: 'review list: a new FAIL on an installed house is never an uninstall, hold or stale-install failure', count: list.length, streetFacing: list.filter(r => r.street).length, list}, null, 1) + '\n');
console.log(`${list.length} new FAILs (${list.filter(r => r.street).length} street-facing) -> ${out}`);
