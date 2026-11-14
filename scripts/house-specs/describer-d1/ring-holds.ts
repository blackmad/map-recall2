// Holds before staging (D1 ring tranche): splits the answers into the set stage.ts reads and the held fronts, by cause.
//   rear        the cut wall faces away from the pand's street (street-side.ts `rear`) or the reader wrote `REAR:` in notes
//   off-row     the cut wall faces a cross street (street-side.ts `cross`): a real front, but not on the street being published
//   unreadable  the reader answered readable: false (`WRONG-WALL:`, a tram or scaffold over the whole front)
//   multi-front the outline covers more than one front (`extent: multi`): one front's storeys and bays would be drawn over the
//               whole pand, and an offset outline reads a neighbour
//   no-cut      no panorama in 5-35 m (no cut, no answer)
//   unread      cut but no answer yet
// Writes <out>/answers/<pandId>.json (copies of the kept answers) and <out>/holds.json {cause: [pandId]}.
//
//   node --import tsx scripts/house-specs/describer-d1/ring-holds.ts --ids <ring-ids.txt> --answers <dir> --cuts <cuts.json> --side <street-side.json> --out <dir>
import fs from 'node:fs';
import path from 'node:path';

export type HoldCause = 'rear' | 'off-row' | 'unreadable' | 'multi-front' | 'no-cut' | 'unread';
export function holdCause(x: { cut: boolean; answer: { readable?: boolean; notes?: string; extent?: string } | null; side?: string | null }): HoldCause | null {
  if (!x.cut) return 'no-cut';
  if (!x.answer) return 'unread';
  const notes = String(x.answer.notes ?? '');
  if (x.side === 'rear' || /^REAR:/i.test(notes)) return 'rear';
  if (!x.answer.readable) return 'unreadable';
  if (x.side === 'cross') return 'off-row';
  if (x.answer.extent === 'multi') return 'multi-front';
  return null;
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const [idsF, ansD, cutsF, sideF, out] = ['ids', 'answers', 'cuts', 'side', 'out'].map(opt);
  if (!idsF || !ansD || !cutsF || !sideF || !out) { console.error('ring-holds.ts --ids --answers --cuts --side --out'); process.exit(2); }
  const ids = fs.readFileSync(idsF, 'utf8').split(/\s+/).filter(x => /^\d{16}$/.test(x));
  const cut = new Set((JSON.parse(fs.readFileSync(cutsF, 'utf8')).rows as { pandId: string }[]).map(r => r.pandId));
  const side = JSON.parse(fs.readFileSync(sideF, 'utf8')) as Record<string, { side?: string }>;
  fs.rmSync(path.join(out, 'answers'), { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'answers'), { recursive: true });
  const holds: Record<string, string[]> = { rear: [], 'off-row': [], 'unreadable': [], 'multi-front': [], 'no-cut': [], unread: [] };
  let kept = 0;
  for (const id of ids) {
    const f = path.join(ansD, `${id}.json`), answer = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
    const c = holdCause({ cut: cut.has(id), answer, side: side[id]?.side ?? null });
    if (c) { holds[c].push(id); continue; }
    fs.copyFileSync(f, path.join(out, 'answers', `${id}.json`));
    kept++;
  }
  fs.writeFileSync(path.join(out, 'holds.json'), `${JSON.stringify(holds, null, 1)}\n`);
  console.log(JSON.stringify({ ids: ids.length, kept, held: Object.fromEntries(Object.entries(holds).map(([k, v]) => [k, v.length])) }));
}
if (import.meta.url === `file://${process.argv[1]}`) main();
