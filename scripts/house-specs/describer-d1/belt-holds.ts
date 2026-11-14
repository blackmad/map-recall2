// D1 belt tranche holds (2026-11-14): which answers stage and which are held, by cause, before stage.ts runs.
// Held: rear/side cuts (rear-check.ts), any cut the cutter flagged (cuts.json `fallback`: oblique > 30 deg, clipped sides or
// bottom, game lens clipped), reads whose outline did not sit on one front (notes start `OUTLINE-OFF:`, or the outline
// triage of the reads made before the token existed says `off`), and `extent: multi`. Unreadable fronts stage nothing either
// way (stage.ts drops their fields) and are counted, not held. Writes <out>/holds.json and two answer dirs of symlinks:
// <out>/answers-kept and <out>/answers-held, for stage.ts.
//
//   node --import tsx scripts/house-specs/describer-d1/belt-holds.ts --dir artifacts/describer-d1/belt-20261114
import fs from 'node:fs';
import path from 'node:path';

export type HoldCause = 'rear-or-side wall' | 'cutter flag' | 'outline off the front' | 'two fronts (extent multi)';

/** The hold causes of one answer (empty: it stages). */
export function holdCauses(a: { readable?: boolean; extent?: string; notes?: string }, cut: { fallback?: { oblique?: boolean; clipped?: string[]; gameLensClipped?: string[] } } | undefined,
  rear: boolean, triage: string | undefined): HoldCause[] {
  const out: HoldCause[] = [];
  if (rear) out.push('rear-or-side wall');
  const f = cut?.fallback;
  if (f && (f.oblique || f.clipped?.length || f.gameLensClipped?.length)) out.push('cutter flag');
  const notes = String(a.notes ?? '').trim();
  // the triage (reads made before the token rule settled) decides where it ran; otherwise the reader's token
  if (triage ? triage === 'off' : notes.startsWith('OUTLINE-OFF')) out.push('outline off the front');
  if (a.readable && a.extent === 'multi') out.push('two fronts (extent multi)');
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const dir = path.resolve(opt('dir')!);
  const cuts = new Map((JSON.parse(fs.readFileSync(path.join(dir, 'cuts/cuts.json'), 'utf8')).rows as any[]).map(r => [r.pandId, r]));
  const rear = JSON.parse(fs.readFileSync(path.join(dir, 'rear-check.json'), 'utf8')).held as Record<string, string>;
  const triage = new Map<string, string>();
  const tsv = path.join(dir, 'outline-triage.tsv');
  if (fs.existsSync(tsv)) for (const line of fs.readFileSync(tsv, 'utf8').split('\n')) { const [id, w] = line.split('\t'); if (/^\d{16}$/.test(id ?? '')) triage.set(id, (w ?? '').trim()); }
  const kept = path.join(dir, 'answers-kept'), heldDir = path.join(dir, 'answers-held');
  for (const d of [kept, heldDir]) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d); }
  const held: Record<string, HoldCause[]> = {}, byCause: Record<string, number> = {};
  let answers = 0, unreadable = 0, shift = 0;
  for (const f of fs.readdirSync(path.join(dir, 'answers')).filter(x => x.endsWith('.json'))) {
    const id = f.replace('.json', ''), a = JSON.parse(fs.readFileSync(path.join(dir, 'answers', f), 'utf8'));
    answers++;
    if (!a.readable) unreadable++;
    if (triage.has(id) ? triage.get(id) === 'shift' : String(a.notes ?? '').startsWith('OUTLINE-SHIFT')) shift++;
    const causes = holdCauses(a, cuts.get(id), id in rear, triage.get(id));
    if (causes.length) { held[id] = causes; for (const c of causes) byCause[c] = (byCause[c] ?? 0) + 1; }
    fs.symlinkSync(path.join(dir, 'answers', f), path.join(causes.length ? heldDir : kept, f));
  }
  const report = { v: 1, answers, unreadable, outlineShiftKept: shift, held: Object.keys(held).length, byCause, rearReasons: rear, pands: held };
  fs.writeFileSync(path.join(dir, 'holds.json'), `${JSON.stringify(report, null, 1)}\n`);
  console.log(JSON.stringify({ answers, unreadable, outlineShiftKept: shift, held: report.held, byCause }));
}
