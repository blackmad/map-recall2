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
  } else { console.log('photo-reads.ts ask|assemble ...'); process.exit(2); }
}
if (process.argv[1]?.endsWith('centrum-looks/photo-reads.ts')) main(process.argv.slice(2));
