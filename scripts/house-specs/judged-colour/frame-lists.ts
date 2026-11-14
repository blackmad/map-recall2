/**
 * house:frames lists for the judged-colour row sheets (lane d1-colour-judged, 2026-11-14): one list per page (a publish
 * unit), the poses the belt and ring lanes framed, restricted to rows that hold a judged front.
 *  - belt: the belt lane's frames-lists/<side>.json entries (one per row group) whose group holds a judged front; the page
 *          is the belt verdict unit most of the group's pands belong to.
 *  - ring: frame-lists4/<row>.json of each row with a judged front, every `--ring-every`th entry (default 2).
 *  - AH07: the restage's wall chains (seqs.json `ah07-N`) with at least `--ah07-min` judged fronts, every 3rd front, the cut
 *          wall's outward bearing.
 * Writes <out>/lists/<page>.json, <out>/lists/index.json ({page, set, list, poses, keys: {key: [pandIds]}}).
 *
 *   node --import tsx scripts/house-specs/judged-colour/frame-lists.ts [--out artifacts/d1-colour-judged] [--ring-every 2]
 */
import fs from 'node:fs';
import path from 'node:path';
import { bearingOf } from '../describer-d1/ring-frame-lists.ts';
import { wallOf } from '../describer-d1/stage.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const BELT = '/Users/blackmad/Code/map-recall2-worktrees/_pruned-sheets/d1-belt-20261114/belt-20261114';
const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));

function main() {
  const argv = process.argv.slice(2), opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const out = path.resolve(ROOT, opt('out') ?? 'artifacts/d1-colour-judged'), ringEvery = Number(opt('ring-every') ?? 2), ahMin = Number(opt('ah07-min') ?? 4);
  const judged = readJson(path.join(out, 'judged.json')).pands as Record<string, { set: string; page: string; row: string }>;
  const lists = path.join(out, 'lists');
  fs.rmSync(lists, { recursive: true, force: true });
  fs.mkdirSync(lists, { recursive: true });
  const index: Array<{ page: string; set: string; list: string; poses: number; keys: Record<string, string[]> }> = [];
  const put = (page: string, set: string, entries: any[], keys: Record<string, string[]>) => {
    if (!entries.length) return;
    const list = path.join(lists, `${page}.json`);
    fs.writeFileSync(list, `${JSON.stringify(entries, null, 1)}\n`);
    index.push({ page, set, list: path.relative(ROOT, list), poses: entries.length, keys });
  };

  // belt
  const groups = readJson(`${BELT}/row-groups.json`) as Record<string, Array<{ key: string; pands: Array<{ pandId: string; number: number }> }>>;
  const verdicts = readJson(`${BELT}/verdicts.json`), unitOf = new Map<string, string>();
  for (const u of verdicts.units) for (const id of [...u.hold, ...u.dropped, ...u.publish]) unitOf.set(id, u.unit);
  const beltPages = new Map<string, { entries: any[]; keys: Record<string, string[]> }>();
  for (const [side, rows] of Object.entries(groups)) {
    const entries = readJson(`${BELT}/frames-lists/${side}.json`) as Array<{ key: string }>;
    for (const e of entries) {
      const g = rows.find(r => r.key === e.key);
      if (!g || !g.pands.some(p => judged[p.pandId]?.set === 'belt')) continue;
      const tally = new Map<string, number>();
      for (const p of g.pands) { const u = unitOf.get(p.pandId); if (u) tally.set(u, (tally.get(u) ?? 0) + 1); }
      const page = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const pg = beltPages.get(page) ?? beltPages.set(page, { entries: [], keys: {} }).get(page)!;
      pg.entries.push(e); pg.keys[e.key] = g.pands.map(p => p.pandId);
    }
  }
  for (const [page, pg] of [...beltPages.entries()].sort()) put(page, 'belt', pg.entries, pg.keys);

  // ring
  const RING = path.join(ROOT, 'artifacts/describer-d1/ring-20261114');
  const ringPages = new Set(Object.values(judged).filter(r => r.set === 'ring').map(r => r.page));
  for (const page of [...ringPages].sort()) {
    const f = path.join(RING, 'frame-lists4', `${page}.json`);
    if (!fs.existsSync(f)) continue;
    const entries = (readJson(f) as any[]).filter((_, i) => i % ringEvery === 0);
    put(page, 'ring', entries, Object.fromEntries(entries.map(e => [e.key, [e.pandId]])));
  }

  // AH07
  const cuts = new Map<string, any>(readJson(path.join(ROOT, 'artifacts/describer-d1/cuts-ah07/cuts.json')).rows.map((r: any) => [r.pandId, r]));
  const seqs = readJson(path.join(out, 'seqs.json')) as Array<{ set: string; key: string; ids: string[] }>;
  for (const s of seqs.filter(q => q.set === 'ah07')) {
    if (s.ids.filter(id => judged[id]).length < ahMin) continue;
    const entries = s.ids.filter((_, i) => i % 3 === 1 || s.ids.length < 3).map(id => {
      const w = wallOf(cuts.get(id));
      return { pandId: id, key: id, ...(w ? { bearing: Math.round(bearingOf(w.normal)) } : {}) };
    });
    // each pose stands for the fronts around it in the chain
    const keys: Record<string, string[]> = {};
    for (const e of entries) { const i = s.ids.indexOf(e.pandId); keys[e.key] = s.ids.slice(Math.max(0, i - 1), i + 2); }
    put(s.key, 'ah07', entries, keys);
  }
  fs.writeFileSync(path.join(lists, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);
  const by = (set: string) => index.filter(i => i.set === set);
  for (const set of ['belt', 'ring', 'ah07']) console.log(`${set}: ${by(set).length} pages, ${by(set).reduce((n, i) => n + i.poses, 0)} poses`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
