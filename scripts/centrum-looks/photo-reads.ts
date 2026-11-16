/**
 * The Centrum photo colour reader (centrum-looks round 4, 2026-11-16): lane D's belt finish reader
 * (scripts/belt-look/photo-reads.ts, opus on each front's panorama cut) extended to the wall's colour family, for the
 * Jordaan and Nieuwmarkt/Lastage looks. The family is read, not sampled: the cuts are often winter shade or summer glare,
 * which is what made the absolute samples read dark (round 1) and the judges' pale fronts read grey.
 *
 *   node --import tsx scripts/centrum-looks/photo-reads.ts ask <cutDir> <outDir> [--per 25]
 *       batch list files (<outDir>/ask-NNN.txt, "<pandId> <jpg>") for opus readers given
 *       scripts/centrum-looks/photo-reader-prompt.md; each writes <outDir>/read-NNN.txt
 *   node --import tsx scripts/centrum-looks/photo-reads.ts assemble <outDir> <out.json>
 *       one record per pand {finish, family, confidence, reader} from every read-*.txt line
 *       "<pandId> <brick|paint|stucco|unclear> <family> <confidence>"
 *
 * Calibration (38 Centrum cuts labelled from the round-2/3 blind judges' words, grouped dark / brown / red / pale):
 * 17 of 22 at confidence >= 0.7 (24 of 37 at any confidence). Of the five misses, one label was wrong on the cut
 * (Bloemgracht 173055: the judge's "pale" is its white neighbour; the cut shows red-brown brick). The generator uses a
 * read only at confidence >= 0.7 and where the register is silent (generate.ts photoFamily).
 *
 * Round 5 (2026-11-16: the judges' grey-brown fronts drawn red-brown): a contrastive reader, v2
 * (scripts/centrum-looks/photo-reader-prompt-v2.md with the swatch card scripts/centrum-looks/swatch-card.ts), that also
 * reads the crown, cornice and storeys in lane D's crown reader's vocabulary (scripts/belt-look/photo-reads.ts crowns):
 *   node --import tsx scripts/centrum-looks/photo-reads.ts assemble2 <v2Dir> <out.json> [--v1 <photo-reads.json>] [--second <dir>]
 *       lines "<pandId> <finish> <family> <cf> <crown> <cornice> <full|nv> <y|n|nv> <cc> <sc>"; the colour by mergeColour
 *       (v1 kept as `v1`); a second capture's lines (--second) by mergeSecond; the crown fields as lane D's PhotoCrown.
 * Calibration, 60 labels (the 38 plus 22 the lane labelled on the cuts, 19 of them grey-brown), at >= 0.7: v1 27/39,
 * v2 34/46. v2 cured the bias and overshot: of 12 labelled fronts v1 read red-brown and v2 brown, 7 are brown and 5 red,
 * so that disagreement is left unstated (mergeColour); where v1 and v2 both read red-brown, 2/2 are red.
 */
import fs from 'node:fs';
import path from 'node:path';

const LINE = /^(\d{16})\s+(brick|paint|stucco|unclear)\s+([a-z-]+)\s+([\d.]+)/;
export interface CentrumPhotoRead { finish: string; family: string; confidence: number; reader: string }
export function parseReads(text: string): Map<string, CentrumPhotoRead> {
  const out = new Map<string, CentrumPhotoRead>();
  for (const l of text.split('\n')) { const m = l.trim().match(LINE); if (m) out.set(m[1], { finish: m[2], family: m[3], confidence: +m[4], reader: 'opus (cut, colour family)' }); }
  return out;
}

const LINE2 = /^(\d{16})\s+(brick|paint|stucco|unclear)\s+([a-z-]+)\s+([\d.]+)\s+([a-z-]+)\s+([a-z-]+)\s+(\d+|nv)\s+(y|n|nv)\s+([\d.]+)\s+([\d.]+)/;
export interface CentrumCrownRead { crown: string; cornice: string; full: number | null; souterrain: boolean | null; cc: number; sc: number }
export type CentrumRead2 = CentrumPhotoRead & CentrumCrownRead & { v1?: { family: string; confidence: number }; second?: CentrumPhotoRead & CentrumCrownRead; rule?: string };
/** v2 lines (colour plus crown). */
export function parseReads2(text: string): Map<string, CentrumPhotoRead & CentrumCrownRead> {
  const out = new Map<string, CentrumPhotoRead & CentrumCrownRead>();
  for (const l of text.split('\n')) {
    const m = l.trim().match(LINE2);
    if (m) out.set(m[1], { finish: m[2], family: m[3], confidence: +m[4], reader: 'opus v2 (cut, contrastive colour + crown)', crown: m[5], cornice: m[6],
      full: m[7] === 'nv' ? null : +m[7], souterrain: m[8] === 'nv' ? null : m[8] === 'y', cc: +m[9], sc: +m[10] });
  }
  return out;
}
/** Below the generator's bar (PHOTO_FINISH_MIN 0.7): a read kept for the record, not drawn. */
export const UNSTATED = 0.6;
const ok = (r: { confidence: number; family: string } | undefined) => !!r && r.confidence >= 0.7 && r.family !== 'unclear';
/**
 * The colour of two readers on one cut. v2 stands; where it is below the bar, a confident v1 stands (3/3 labelled right).
 * v1 red-brown against v2 brown is a coin toss on the labels (7 brown, 5 red): left unstated, so the run and street draw it.
 */
export function mergeColour<T extends { family: string; confidence: number }>(v1: T | undefined, v2: T | undefined): { pick: T | undefined; rule: string; confidence?: number } {
  if (ok(v1) && ok(v2) && v1!.family === 'red-brown-brick' && v2!.family === 'brown-brick') return { pick: v2, rule: 'v1 red-brown, v2 brown: unstated', confidence: UNSTATED };
  if (ok(v2)) return { pick: v2, rule: 'v2' };
  // Round 6: two weak readers that agree on the coarse group (dark / brown / red / pale) state v2's family (5 of 6 right
  // on the labels); a confident v1 red-brown over a weak v2 of another group is the v1 bias again, left unstated.
  const g1 = v1 && v1.confidence >= WEAK_MIN ? COARSE[v1.family] : undefined, g2 = v2 && v2.confidence >= WEAK_MIN ? COARSE[v2.family] : undefined;
  if (g1 && g1 === g2) return { pick: v2, rule: 'v1 and v2 agree weakly', confidence: 0.7 };
  if (ok(v1) && v1!.family === 'red-brown-brick' && g2 && g2 !== 'red') return { pick: v2, rule: 'v1 red-brown, weak v2 not red: unstated', confidence: UNSTATED };
  if (ok(v1)) return { pick: v1, rule: 'v1 (v2 below the bar)' };
  return { pick: v2 ?? v1, rule: 'below the bar' };
}
const WEAK_MIN = 0.55;
/** The calibration's coarse groups (artifacts/centrum-looks/photo/score.py). */
export const COARSE: Readonly<Record<string, 'dark' | 'brown' | 'red' | 'pale'>> = {
  'dark-grey-brick': 'dark', 'purple-brown-brick': 'dark', 'dark-paint': 'dark', 'brown-brick': 'brown', 'red-brown-brick': 'red',
  'orange-red-brick': 'red', 'buff-brick': 'pale', 'white-paint': 'pale', 'cream-paint': 'pale', 'pale-grey': 'pale',
};
/**
 * A second capture's read (another date) of a front the first left in doubt: a confident second read that agrees with
 * either first reader's family settles it; else the more confident read stands, and a confident disagreement stays unstated.
 */
export function mergeSecond(first: { family: string; confidence: number; v1Family?: string }, second: { family: string; confidence: number }): { family: string; confidence: number; rule: string } {
  if (!ok(second)) return { family: first.family, confidence: first.confidence, rule: 'second below the bar' };
  // The red/brown doubt: the second capture is read by v2, which leans brown, so only a red read there is news (189 of 190
  // second reads of the doubt said brown; the labels split 7 brown / 5 red). A brown second read leaves it unstated.
  if (first.confidence === UNSTATED && first.family === 'brown-brick' && first.v1Family === 'red-brown-brick')
    return second.family === 'red-brown-brick' ? { family: second.family, confidence: second.confidence, rule: 'second capture reads red' } : { family: first.family, confidence: UNSTATED, rule: 'second capture same reader: still unstated' };
  if (second.family === first.family || second.family === first.v1Family) return { family: second.family, confidence: Math.max(0.7, second.confidence), rule: 'second capture agrees' };
  if (!ok(first)) return { family: second.family, confidence: second.confidence, rule: 'second capture only confident read' };
  return { family: first.family, confidence: UNSTATED, rule: 'captures disagree: unstated' };
}

function main(argv: string[]) {
  const [mode, a, b] = argv, per = Number(argv[argv.indexOf('--per') + 1] || 25);
  if (mode === 'ask') {
    const files = fs.readdirSync(a).filter(f => /^\d{16}\.jpg$/.test(f)).sort();
    fs.mkdirSync(b, { recursive: true });
    for (let i = 0, k = 0; i < files.length; i += per, k++)
      fs.writeFileSync(path.join(b, `ask-${String(k).padStart(3, '0')}.txt`), files.slice(i, i + per).map(f => `${f.slice(0, 16)} ${path.resolve(a, f)}`).join('\n') + '\n');
    console.log(`ask: ${files.length} cuts in ${Math.ceil(files.length / per)} batches`);
  } else if (mode === 'assemble') {
    const reads = new Map<string, CentrumPhotoRead>();
    for (const f of fs.readdirSync(a).filter(x => /^read-\d+\.txt$/.test(x)).sort()) for (const [k, v] of parseReads(fs.readFileSync(path.join(a, f), 'utf8'))) reads.set(k, v);
    const tally: Record<string, number> = {};
    for (const r of reads.values()) { const k = `${r.confidence >= 0.7 ? '' : 'low '}${r.family}`; tally[k] = (tally[k] ?? 0) + 1; }
    fs.mkdirSync(path.dirname(b), { recursive: true });
    fs.writeFileSync(b, JSON.stringify({ at: new Date().toISOString().slice(0, 10), ref: 'centrum-looks round 4: photo colour reader (scripts/centrum-looks/photo-reads.ts)', reads: Object.fromEntries([...reads].sort()) }, null, 1) + '\n');
    console.log(`assemble: ${reads.size} reads`, JSON.stringify(tally));
  } else if (mode === 'assemble2') {
    const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
    const readDir = (d: string) => { const m = new Map<string, CentrumPhotoRead & CentrumCrownRead>(); for (const f of fs.readdirSync(d).filter(x => /^read-\d+\.txt$/.test(x)).sort()) for (const [k, v] of parseReads2(fs.readFileSync(path.join(d, f), 'utf8'))) m.set(k, v); return m; };
    const v2 = readDir(a), v1f = opt('v1');
    // --second may repeat (round 6: a third capture, the sheet's summer recording, for weak pale reads); applied in order.
    const sds = argv.flatMap((x, i) => (x === '--second' && argv[i + 1] ? [argv[i + 1]] : []));
    const v1 = new Map<string, CentrumPhotoRead>(v1f ? Object.entries(JSON.parse(fs.readFileSync(v1f, 'utf8')).reads) : []);
    const seconds = sds.map(readDir);
    const out: Record<string, CentrumRead2> = {}, tally: Record<string, number> = {};
    for (const pid of [...new Set([...v2.keys(), ...v1.keys()])].sort()) {
      const b = v2.get(pid), o = v1.get(pid), m = mergeColour(o, b);
      if (!m.pick) continue;
      const base: CentrumRead2 = { ...(b ?? { crown: 'not-visible', cornice: 'not-visible', full: null, souterrain: null, cc: 0, sc: 0 }), finish: m.pick.finish, family: m.pick.family, confidence: m.confidence ?? m.pick.confidence, reader: m.pick.reader, rule: m.rule, ...(o ? { v1: { family: o.family, confidence: o.confidence } } : {}) };
      for (const [k, second] of seconds.entries()) {
        const s2 = second.get(pid);
        if (!s2) continue;
        const r = mergeSecond({ family: base.family, confidence: base.confidence, v1Family: o?.family }, s2);
        Object.assign(base, { family: r.family, confidence: r.confidence, rule: `${base.rule}; ${r.rule}`, [k ? `capture${k + 2}` : 'second']: s2 });
        if (r.family === s2.family && r.confidence >= 0.7) base.finish = s2.finish;
      }
      out[pid] = base;
      tally[base.rule!] = (tally[base.rule!] ?? 0) + 1;
    }
    fs.mkdirSync(path.dirname(b), { recursive: true });
    fs.writeFileSync(b, JSON.stringify({ at: new Date().toISOString().slice(0, 10), ref: 'centrum-looks round 5: contrastive colour + crown reader v2 over v1 (scripts/centrum-looks/photo-reads.ts assemble2)', reads: out }, null, 1) + '\n');
    console.log(`assemble2: ${Object.keys(out).length} reads`, JSON.stringify(tally));
  } else { console.log('photo-reads.ts ask|assemble|assemble2 ...'); process.exit(2); }
}
if (process.argv[1]?.endsWith('centrum-looks/photo-reads.ts')) main(process.argv.slice(2));
