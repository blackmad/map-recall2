/**
 * F3 round 3: the gate on the CUT crop. Jev v2 quality first; Gemini occlusion (trunk, branches, van) only on crops that pass Jev, so the
 * free-tier Gemini quota is spent on the survivors. Cached beside the crop as front.gate.json (sha of the crop). Prints one JSON line:
 * {id: {pass, reasons, quality}} to --out. Keys from the login env only; no address to either backend; a 401/403 stops the run.
 *
 *   zsh -lic 'node --import tsx scripts/house-crops/f3/gate-final.ts --archive <dir> --ids a,b --out <f> [--concurrency 4] [--budget 1]'
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { gateOne, gateVerdict, type GateRecord } from './gate.ts';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
async function main() {
  const archive = arg('archive'), out = arg('out'); if (!archive || !out) { console.error('usage: gate-final.ts --archive <dir> --out <f> [--ids a,b]'); process.exit(2); }
  const jevKey = process.env.TYPESAFE_API_KEY, geminiKey = process.env.GEMINI_API_KEY;
  if (!jevKey || !geminiKey) { console.error('TYPESAFE_API_KEY and GEMINI_API_KEY must be set in this process (run through zsh -lic); stopping.'); process.exit(2); }
  const ids = arg('ids') ? arg('ids')!.split(',').filter(Boolean) : (await fs.readdir(path.join(archive, 'pand-crops'))).sort();
  const spend = { jev: 0, gemini: 0 }, stop = { v: false }, res: Record<string, { pass: boolean | null; reasons: string[]; quality: number | null; rec: GateRecord }> = {}, queue = ids.filter(Boolean), budget = Number(arg('budget') ?? 1);
  await Promise.all(Array.from({ length: Number(arg('concurrency') ?? 4) }, async () => { while (queue.length && !stop.v) {
    if (spend.jev > budget) { stop.v = true; console.error('jev budget reached; stopping'); break; }
    const id = queue.shift()!, file = path.join(archive, 'pand-crops', id, 'front.jpg');
    if (!(await fs.access(file).then(() => true, () => false))) continue;
    let rec = await gateOne(file, { jevKey, geminiKey, wantJev: true, wantGemini: false }, spend, stop);
    if (rec.jev && rec.jev.quality >= 0.5) rec = await gateOne(file, { jevKey, geminiKey, wantJev: false, wantGemini: true }, spend, stop);
    const v = gateVerdict(rec);
    res[id] = { pass: v.pass, reasons: v.reasons, quality: rec.jev?.quality ?? null, rec };
  } }));
  await fs.writeFile(out, JSON.stringify(res));
  console.log(`gated ${Object.keys(res).length}; pass ${Object.values(res).filter(r => r.pass).length}; Jev $${spend.jev.toFixed(4)} Gemini list $${spend.gemini.toFixed(4)}`);
  if (stop.v) process.exit(3);
}
if (process.argv[1]?.endsWith('f3/gate-final.ts')) await main();
