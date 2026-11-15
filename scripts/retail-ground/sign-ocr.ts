/**
 * Round 7 (lane retail-look-20261114): read the fascia off our shopfront cuts (front-photos.ts output: <dir>/*.jpg and
 * receipts.json naming each cut's pand and shop) with the local tesseract binary (no npm package), and match the text to
 * the hosted shop's name (signRead.ts). A match confirms the host; a mismatch flags it for re-hosting.
 *   node --import tsx scripts/retail-ground/sign-ocr.ts --dirs=<dir,dir> [--out=data/retail-ground/sources/sign-ocr.json]
 * Each cut is read twice (as is and inverted, for light letters on a dark band), upper SIGN_BAND of the cut (the cut
 * spans the ground storey and fascia), 2x upscaled grey, tesseract --psm 11 (sparse text), eng+nld when installed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { signVerdict, type OcrWord } from '../../src/canalRecall/signRead.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const SIGN_BAND = 0.6, OUT = arg('out') ?? 'data/retail-ground/sources/sign-ocr.json';
const langs = spawnSync('tesseract', ['--list-langs'], { encoding: 'utf8' }).stdout;
const LANG = /\bnld\b/.test(langs) ? 'eng+nld' : 'eng';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sign-ocr-'));

async function read(file: string): Promise<OcrWord[]> {
  const meta = await sharp(file).metadata(), h = Math.round(meta.height! * SIGN_BAND), words: OcrWord[] = [];
  for (const neg of [false, true]) {
    const png = path.join(tmp, `${neg ? 'n' : 'p'}.png`);
    let img = sharp(file).extract({ left: 0, top: 0, width: meta.width!, height: h }).resize({ width: meta.width! * 2 }).grayscale();
    if (neg) img = img.negate();
    await img.png().toFile(png);
    const tsv = spawnSync('tesseract', [png, 'stdout', '-l', LANG, '--psm', '11', 'tsv'], { encoding: 'utf8' }).stdout ?? '';
    for (const line of tsv.split('\n').slice(1)) { const c = line.split('\t'); if (c.length >= 12 && c[11].trim() && Number(c[10]) >= 0) words.push({ text: c[11].trim(), conf: Number(c[10]) }); }
  }
  return words;
}

const rows: Array<{ file: string; pand: string; name: string; verdict: string; word?: string; words: string }> = [];
for (const dir of (arg('dirs') ?? '').split(',').filter(Boolean)) {
  type Receipt = { pand: string; name: string; file: string };
  const receipts = JSON.parse(fs.readFileSync(path.join(dir, 'receipts.json'), 'utf8')) as Receipt[] | Record<string, Receipt | Receipt[]>;
  for (const r of (Array.isArray(receipts) ? receipts : Object.values(receipts).flat()) as Receipt[]) {
    if (!r.file || !fs.existsSync(r.file)) continue;
    const words = await read(r.file), v = signVerdict(r.name, words);
    rows.push({ file: r.file, pand: r.pand.replace(/^NL\.IMBAG\.Pand\./, ''), name: r.name, verdict: v.verdict, ...(v.word ? { word: v.word } : {}), words: words.filter(w => w.conf >= 50 && w.text.length >= 3).map(w => `${w.text}:${Math.round(w.conf)}`).join(' ') });
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
const count = rows.reduce((m, r) => (m[r.verdict] = (m[r.verdict] ?? 0) + 1, m), {} as Record<string, number>);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ rule: 'src/canalRecall/signRead.ts', ocr: `tesseract ${spawnSync('tesseract', ['--version'], { encoding: 'utf8' }).stdout.split('\n')[0]}, ${LANG}, psm 11`, counts: count, rows }, null, 1));
console.log(`${rows.length} cuts: ${JSON.stringify(count)} -> ${OUT}`);
