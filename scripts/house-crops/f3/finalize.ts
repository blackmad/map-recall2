/**
 * F3 (#381): make the chosen candidate the pand's crop. After `house:crops --all-years --bearings` and `f3/gate.ts`, copies the gate's pick
 * (else the best by Jev quality, else the pixel-ranked pick, else today's default) to <pand>/front.jpg and rewrites the front.json fields that
 * describe the picture (chosenYear, missionDate, panoramas, flags, usable, rejectedBecause) plus an `f3` block recording how it was chosen.
 * The original default crop stays as front.default.jpg. Idempotent.
 *
 *   node --import tsx scripts/house-crops/f3/finalize.ts --archive <dir> --gate <gate-*.json> [--ids a,b]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { usability } from '../flags.ts';
import { defaultPick, rankedPick, type Tried } from './rank.ts';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
export type Source = 'gate-pass' | 'jev-best' | 'pixel' | 'default';
async function main() {
  const archive = arg('archive'), gateFile = arg('gate'); if (!archive) { console.error('usage: finalize.ts --archive <dir> [--gate f] [--ids a,b]'); process.exit(2); }
  const gate: Record<string, { chosen: string | null; best: string | null }> = gateFile ? JSON.parse(await fs.readFile(gateFile, 'utf8')) : {};
  const ids = arg('ids') ? arg('ids')!.split(',') : (await fs.readdir(path.join(archive, 'pand-crops'))).sort(), count: Record<string, number> = {};
  for (const id of ids) {
    const dir = path.join(archive, 'pand-crops', id), fj = await fs.readFile(path.join(dir, 'front.json'), 'utf8').then(JSON.parse).catch(() => null); if (!fj) continue;
    const tried: Tried[] = (fj.candidates as Tried[]).filter(t => t.file && t.flags), byFile = (f?: string | null) => tried.find(t => t.file === f);
    let pick = byFile(gate[id]?.chosen), source: Source = 'gate-pass';
    if (!pick) { pick = byFile(gate[id]?.best); source = 'jev-best'; }
    if (!pick) { pick = rankedPick(tried); source = 'pixel'; }
    if (!pick) { pick = defaultPick(tried); source = 'default'; }
    if (!pick) continue;
    count[source] = (count[source] ?? 0) + 1;
    if (fj.f3?.file === pick.file) continue;
    const orig = path.join(dir, 'front.default.jpg');
    if (!(await fs.access(orig).then(() => true, () => false))) await fs.copyFile(path.join(dir, 'front.jpg'), orig);
    await fs.copyFile(path.join(dir, pick.file!), path.join(dir, 'front.jpg'));
    const u = usability(pick.flags!);
    Object.assign(fj, { chosenYear: pick.year, missionDate: pick.date, panoramas: (pick.panoIds ?? [pick.panoId]).map(p => ({ panoId: p, timestamp: pick!.date, missionYear: pick!.year, sourceUrl: `https://api.data.amsterdam.nl/panorama/panoramas/${p}/` })), flags: pick.flags, usable: u.usable, rejectedBecause: u.reasons, f3: { file: pick.file, source, second: !!pick.second, bearingDeg: pick.bearingDeg ?? null, leafOff: !!pick.leafOff } });
    await fs.writeFile(path.join(dir, 'front.json'), JSON.stringify(fj, null, 1) + '\n');
  }
  console.log(JSON.stringify(count));
}
if (process.argv[1]?.endsWith('f3/finalize.ts')) await main();
