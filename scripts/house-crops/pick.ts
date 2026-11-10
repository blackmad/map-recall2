/**
 * H4c: per pand, pick the best mission year by Jev quality among the crops that pass the hard flags.
 * Reads the per-year crops written by `crops.ts --all-years` (<scratch archive>/pand-crops/<id>/years/<year>.jpg + front.json),
 * judges each hard-passing one (cached on disk by panorama ids), writes scripts/house-crops/judge/<code>-picks.json and copies
 * the year crops into the real archive.
 *
 *   zsh -lic 'node --import tsx scripts/house-crops/pick.ts --buurt AB07 --from <scratch archive> --archive <source-data> [--budget 2]'
 *
 * H5 step 0b: `--prompt v2` re-judges with another prompt version and writes <code>-picks.v2.json / <code>-years.v2.json beside the v1
 * files. With `--prompt` and no `--from` the candidates come from the existing <code>-picks.json (their hard flags are final) and the
 * year crops from `--archive` (<archive>/pand-crops/<id>/years/<year>.jpg), so a new prompt re-picks with 0 panorama requests and no
 * re-rectification.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { USD_PER_TOKEN, MODEL, ask, parseAnswers, quality, type PromptVersion } from './judge.ts';
import { usability, hardPass, type CropFlags } from './flags.ts';

export type Cand = { year: number; panoIds: string[]; file: string; reasons: string[]; hard: boolean; score?: number; occluded?: number; quality?: number };
export type Pick = { pandId: string; cands: Cand[]; first?: Cand; best?: Cand };

/** Best = highest quality among hard-passing judged candidates; ties go to the newer year. `first` = the first year tried, the one-year baseline. */
export function choose(cands: Cand[]): { first?: Cand; best?: Cand } {
  const judged = cands.filter(c => c.hard && c.quality !== undefined);
  const best = [...judged].sort((a, b) => b.quality! - a.quality! || b.year - a.year)[0];
  return { first: cands[0], best };
}

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
if (process.argv[1]?.endsWith('house-crops/pick.ts')) {
  const code = arg('buurt'), root = arg('archive') ?? process.env.HOUSE_CROPS_ARCHIVE, budget = Number(arg('budget') ?? 2), prompt = (arg('prompt') ?? 'v1') as PromptVersion;
  const sfx = prompt === 'v1' ? '' : `.${prompt}`, reuse = !arg('from') && prompt !== 'v1', from = arg('from') ?? (reuse ? root : undefined);
  if (!code || !from) { console.error('usage: pick.ts --buurt <code> --from <scratch archive> [--archive <dir>] [--budget usd] [--prompt v1|v2 (without --from: re-judge the existing picks.json candidates from --archive)]'); process.exit(2); }
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) { console.error('TYPESAFE_API_KEY is not set in this process (run through zsh -lic); stopping.'); process.exit(2); }
  const outFile = path.resolve('scripts/house-crops/judge', `${code}-picks${sfx}.json`), cacheFile = path.resolve('scripts/house-crops/judge', `${code}-years${sfx}.json`);
  const cache: Record<string, { score: number; occluded: number; tokens: number }> = await fs.readFile(cacheFile, 'utf8').then(JSON.parse).catch(() => ({}));
  const prior: Pick[] = reuse ? JSON.parse(await fs.readFile(path.resolve('scripts/house-crops/judge', `${code}-picks.json`), 'utf8')).picks : [];
  const ids = reuse ? prior.map(p => p.pandId) : (await fs.readdir(path.join(from, 'pand-crops'))).sort();
  const picks: Pick[] = [], jobs: { id: string; c: Cand; k: string }[] = [];
  for (const id of ids) {
    let cands: Cand[];
    if (reuse) cands = prior.find(p => p.pandId === id)!.cands.map(c => ({ year: c.year, panoIds: c.panoIds, file: `years/${c.year}.jpg`, reasons: c.reasons, hard: c.hard }));
    else {
      const fj = await fs.readFile(path.join(from, 'pand-crops', id, 'front.json'), 'utf8').then(JSON.parse).catch(() => null);
      if (!fj) continue;
      cands = (fj.candidates as any[]).filter(t => t.file).map(t => { const reasons = usability(t.flags as CropFlags).reasons; return { year: t.year, panoIds: t.panoIds, file: t.file, reasons, hard: hardPass(reasons) }; });
    }
    picks.push({ pandId: id, cands });
    for (const c of cands) { const k = `${id}/${c.year}/${c.panoIds.join('+')}`; if (c.hard && !cache[k]) jobs.push({ id, c, k }); }
  }
  console.log(`${picks.length} pands, ${picks.reduce((n, p) => n + p.cands.length, 0)} year crops, ${jobs.length} to judge, budget $${budget}`);
  let spent = 0, done = 0, stop = false;
  const queue = [...jobs];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length && !stop) {
      if (spent >= budget) { stop = true; console.error('budget reached; stopping'); break; }
      const { id, c, k } = queue.shift()!;
      const r = await ask(key, path.join(from, 'pand-crops', id, c.file), prompt);
      if (r.status === 401 || r.status === 403) { stop = true; console.error(`auth error ${r.status}; stopping (fail closed)`); break; }
      try { if (r.status !== 200) throw new Error(`HTTP ${r.status}`); const p = parseAnswers(r.body); spent += p.tokens * USD_PER_TOKEN; cache[k] = { score: +p.score.toFixed(3), occluded: +p.occluded.toFixed(3), tokens: p.tokens }; done++; } catch (e: any) { console.error(`${k}: ${e.message}`); }
    }
  }));
  await fs.writeFile(cacheFile, JSON.stringify(cache, null, 1) + '\n');
  for (const p of picks) {
    for (const c of p.cands) { const j = cache[`${p.pandId}/${c.year}/${c.panoIds.join('+')}`]; if (j) { c.score = j.score; c.occluded = j.occluded; c.quality = quality(j); } }
    Object.assign(p, choose(p.cands));
    if (root && !reuse) for (const c of p.cands) { const d = path.join(root, 'pand-crops', p.pandId, 'years'); await fs.mkdir(d, { recursive: true }); await fs.copyFile(path.join(from, 'pand-crops', p.pandId, c.file), path.join(d, `${c.year}.jpg`)); }
  }
  await fs.writeFile(outFile, JSON.stringify({ model: MODEL, picks }, null, 1) + '\n');
  console.log(`judged ${done}; Jev spend this run $${spent.toFixed(4)} (budget $${budget}); wrote ${outFile}`);
  if (stop) process.exit(3);
}
