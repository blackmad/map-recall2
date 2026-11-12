/**
 * house:critic (lane F4, #379): the blind critic loop over the facade benchmark.
 *
 *   prepare  --frames <house:frames out dir> --round N [--seed S] [--band 1.5] [--chunks 4] [--per-sheet 2]
 *            masked, side-shuffled pair images, critic sheets, one prompt per chunk; the key goes to artifacts/critic/keys/
 *   score    --round N           parse round-N/raw/*.txt into answers.json, histogram.json, fooled-rate.json; plot all rounds
 *   plot                         re-draw artifacts/critic/fooled-rate.{svg,png} from every scored round
 *
 * A round: run house:frames on the benchmark list (one run), `prepare`, spawn one fresh Claude opus agent per chunk with
 * round-N/prompts/chunk-K.md as its whole prompt (no specs, no history, no other files), let each write its raw answers to
 * round-N/raw/chunk-K.txt, then `score`. The ranked histogram is the kit-gap queue (scripts/house-line/kit-gaps.ts).
 * Stop rule: when the fooled-rate is flat for two rounds (|change| < 0.03 twice), restart with a fresh critic prompt
 * (new seed, new chunking) before reading more into the curve. Docs: docs/house-line.md §9.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { cropBox, outlineSvg } from '../house-frames/frames.ts';
import { frameFor, wallPoint, type FramePose, type WallQuad } from '../house-frames/pose.ts';
import { bandLine, maskPair, type Rgb8 } from '../../src/canalRecall/houseSpec/critic/mask.ts';
import { gameSides, presentationOrder } from '../../src/canalRecall/houseSpec/critic/shuffle.ts';
import { flatForTwoRounds, parseAnswers, scoreRound, type KeyEntry, type RoundScore } from '../../src/canalRecall/houseSpec/critic/score.ts';
import { vocabularyLines } from '../../src/canalRecall/houseSpec/critic/vocabulary.ts';

export const CRITIC_DIR = path.resolve('artifacts/critic');
const BENCHMARK = 'scripts/house-line/benchmark/benchmark-v1.json';
const HALF = 640;
const arg = (argv: string[], n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const roundDir = (n: number) => path.join(CRITIC_DIR, `round-${n}`);
const keyFile = (n: number) => path.join(CRITIC_DIR, 'keys', `round-${n}.json`);

type Prepared = { pandId: string; key: string; street: string; wall: WallQuad; pose: FramePose; route: string; pick: { panoId: string; timestamp: string; obliquityDeg: number; distM: number } };

async function readRgb(file: string, w: number, h: number): Promise<Rgb8> {
  const { data, info } = await sharp(file).removeAlpha().resize(w, h, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

/** One masked half pair (photo, game), cropped like house:frames' pair, both HALF x HALF. */
async function maskedHalves(dir: string, p: Prepared, bandM: number): Promise<{ photo: Buffer; game: Buffer; stats: ReturnType<typeof maskPair> }> {
  const { pose, wall } = p, box = cropBox(pose, wall), f = frameFor(pose), s = HALF / Math.max(box.width, box.height);
  const ox = (HALF - box.width * s) / 2, oy = (HALF - box.height * s) / 2; // fit 'contain' offsets
  const toHalf = (q: { x: number; y: number }) => ({ x: (q.x - box.left) * s + ox, y: (q.y - box.top) * s + oy });
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y), along = (v: number) => Array.from({ length: 9 }, (_, i) => wallPoint(f, pose, wall, len * i / 8, v)).filter(q => q.depth > 0).map(toHalf);
  const halfOf = async (file: string) => {
    const base = await sharp(file).resize(pose.width, pose.height, { fit: 'fill' }).png().toBuffer();
    const { data, info } = await sharp(base).extract(box).resize(HALF, HALF, { fit: 'contain', background: '#808080' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data: new Uint8Array(data) } as Rgb8;
  };
  const photo = await halfOf(path.join(dir, 'photo.jpg')), game = await halfOf(path.join(dir, 'game.png'));
  const stats = maskPair(photo, game, { bandY: bandLine(HALF, along(bandM)), skyStopY: bandLine(HALF, along(wall.heightM * 0.5)), leafDilate: 3 });
  // The wall outline (cyan) on both, after masking, so the critic knows which building is meant.
  const outline = await sharp(Buffer.from(outlineSvg(pose, wall))).resize(pose.width, pose.height).png().toBuffer();
  const ol = await sharp(outline).extract(box).resize(HALF, HALF, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const enc = (img: Rgb8) => sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 3 } }).composite([{ input: ol }]).png().toBuffer();
  return { photo: await enc(photo), game: await enc(game), stats };
}

const svgText = (w: number, h: number, items: Array<{ x: number; y: number; t: string; size: number }>) =>
  Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${items.map(i => `<text x="${i.x}" y="${i.y}" font-family="Helvetica, Arial, sans-serif" font-size="${i.size}" font-weight="bold" fill="#fff" stroke="#000" stroke-width="1">${i.t}</text>`).join('')}</svg>`);

async function pairImage(id: string, left: Buffer, right: Buffer): Promise<Buffer> {
  const gap = 10, head = 34, W = HALF * 2 + gap;
  return sharp({ create: { width: W, height: HALF + head, channels: 3, background: '#202020' } })
    .composite([{ input: left, left: 0, top: head }, { input: right, left: HALF + gap, top: head },
      { input: svgText(W, HALF + head, [{ x: 8, y: 25, t: `${id}   A (left)`, size: 22 }, { x: HALF + gap + 8, y: 25, t: 'B (right)', size: 22 }]), left: 0, top: 0 }])
    .jpeg({ quality: 86 }).toBuffer();
}

function promptFor(round: number, chunk: number, chunks: number, sheets: string[], pairIds: string[], rawFile: string): string {
  return `# Blind facade critic — round ${round}, chunk ${chunk + 1} of ${chunks}

You are a careful architectural reviewer who knows Amsterdam street fronts. You will look at ${pairIds.length} image pairs.
Each pair shows the same building front from the same camera position twice, side by side: **A (left)** and **B (right)**.
One half is a photograph of the real street. The other half is a render of the same place from a 3D city game. Which half
is which differs from pair to pair, at random.

Both halves have been treated the same way before you see them:
- everything under about 1.5 m above the pavement (cars, bikes, people, the street) is painted flat grey;
- trees and leaves (in either half) are painted flat grey in both halves;
- the sky in each half is painted one flat pale colour;
- a thin cyan line outlines the building wall under review (the footprint edge up to the registered height).

## What to do for every pair
1. Say which half is the **game** render: A or B. Always choose one, even if unsure, and give your confidence (low, med, high).
2. Name the **single biggest difference** between the two halves *in the outlined building*: the one thing that would most
   make someone who knows this street say the game drew the wrong house. Choose **exactly one** term from this closed list,
   spelled as written:
${vocabularyLines().map(l => '   ' + l).join('\n')}
3. Give its severity: 1 = minor (a local would still say it is the same house), 2 = clearly different, 3 = the wrong kind of
   house. With "none: can't tell" write severity "-".

Judge the building inside the cyan outline; the neighbours are context only. Ignore rendering style (noise, lighting,
sharpness, texture detail): name what is drawn differently, not how it is drawn. Do not name the masks.

## Rules
- Open **only** these image files, with the Read tool, in this order (each holds up to two pairs, stacked):
${sheets.map(s => `  - ${s}`).join('\n')}
- Do not open, list or search any other file or directory. You have no specs, labels or earlier answers, and you must not look for them.
- Answer every pair id exactly once: ${pairIds.join(', ')}.

## Output
Write your answers with the Write tool to \`${rawFile}\`, one line per pair, nothing else on those lines, in this exact form:

\`\`\`
P001 | game: B | gap: window kind | severity: 2 | confidence: med | note: casement windows drawn as plain sashes
P002 | game: A | gap: none: can't tell | severity: - | confidence: low | note:
\`\`\`

The note is at most 15 words and says what differs. When the file is written, reply with "done" and the number of lines.
`;
}

async function prepare(argv: string[]) {
  const frames = path.resolve(arg(argv, 'frames') ?? 'artifacts/critic/frames-round-0');
  const round = Number(arg(argv, 'round') ?? 0), seed = Number(arg(argv, 'seed') ?? (20261112 + round * 7919));
  const bandM = Number(arg(argv, 'band') ?? 1.5), chunks = Number(arg(argv, 'chunks') ?? 4), perSheet = Number(arg(argv, 'per-sheet') ?? 2);
  const { prepared } = JSON.parse(fs.readFileSync(path.join(frames, 'prepared.json'), 'utf8')) as { prepared: Prepared[] };
  const bench = JSON.parse(fs.readFileSync(BENCHMARK, 'utf8')) as { pands: Array<{ pandId: string; key?: string; group: string; readable?: boolean }> };
  const groupOf = new Map(bench.pands.map(p => [p.key ?? p.pandId, p.group]));
  const framed = prepared.filter(p => fs.existsSync(path.join(frames, p.key, 'game.png')) && fs.existsSync(path.join(frames, p.key, 'photo.jpg')));
  const order = presentationOrder(framed, seed);
  const ids = order.map((_, i) => `P${String(i + 1).padStart(3, '0')}`), sides = gameSides(ids, seed);
  const out = roundDir(round);
  if (fs.existsSync(path.join(out, 'answers.json'))) throw new Error(`${out} is scored already; use a new round number`);
  for (const d of ['pairs', 'sheets', 'prompts', 'raw']) fs.mkdirSync(path.join(out, d), { recursive: true });
  fs.mkdirSync(path.dirname(keyFile(round)), { recursive: true });
  const key: Array<KeyEntry & { mask: ReturnType<typeof maskPair>; photo: Prepared['pick'] }> = [];
  for (let i = 0; i < order.length; i++) {
    const p = order[i], id = ids[i], dir = path.join(frames, p.key);
    const h = await maskedHalves(dir, p, bandM), game = sides[id];
    fs.writeFileSync(path.join(out, 'pairs', `${id}.jpg`), await pairImage(id, game === 'A' ? h.game : h.photo, game === 'A' ? h.photo : h.game));
    key.push({ pair: id, key: p.key, pandId: p.pandId, group: groupOf.get(p.key) ?? groupOf.get(p.pandId) ?? '?', route: p.route, game, mask: h.stats, photo: { panoId: p.pick.panoId, timestamp: p.pick.timestamp, obliquityDeg: p.pick.obliquityDeg, distM: p.pick.distM } });
  }
  // Sheets: perSheet pairs stacked; chunks of whole sheets.
  const sheets: Array<{ file: string; pairs: string[] }> = [];
  for (let s = 0; s * perSheet < ids.length; s++) {
    const slice = ids.slice(s * perSheet, (s + 1) * perSheet), file = path.join(out, 'sheets', `sheet-${String(s + 1).padStart(3, '0')}.jpg`);
    const tiles = slice.map(id => path.join(out, 'pairs', `${id}.jpg`)), th = HALF + 34, gap = 14;
    await sharp({ create: { width: HALF * 2 + 10, height: slice.length * th + (slice.length - 1) * gap, channels: 3, background: '#000' } })
      .composite(tiles.map((t, i) => ({ input: t, left: 0, top: i * (th + gap) }))).jpeg({ quality: 84 }).toFile(file);
    sheets.push({ file, pairs: slice });
  }
  const per = Math.ceil(sheets.length / chunks), prompts: string[] = [];
  for (let c = 0; c < chunks; c++) {
    const mine = sheets.slice(c * per, (c + 1) * per);
    if (!mine.length) continue;
    const file = path.join(out, 'prompts', `chunk-${c + 1}.md`);
    fs.writeFileSync(file, promptFor(round, c, chunks, mine.map(s => s.file), mine.flatMap(s => s.pairs), path.join(out, 'raw', `chunk-${c + 1}.txt`)));
    prompts.push(file);
  }
  fs.writeFileSync(keyFile(round), JSON.stringify({ round, seed, key }, null, 1));
  let commit = ''; try { commit = execFileSync('/usr/bin/git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }
  const meta = { round, seed, bandM, pairs: ids.length, skippedUnframed: prepared.length - framed.length, frames, commit, prompts, sheets: sheets.length, date: new Date().toISOString(), critic: 'a fresh Claude opus agent per chunk; prompt = prompts/chunk-K.md, nothing else', keyFile: path.relative(process.cwd(), keyFile(round)) };
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log(`round ${round}: ${ids.length} pairs (${prepared.length - framed.length} without a game frame skipped), ${sheets.length} sheets, ${prompts.length} critic prompts\n  ${prompts.join('\n  ')}\nkey (never give it to the critic): ${keyFile(round)}`);
}

function score(argv: string[]) {
  const round = Number(arg(argv, 'round') ?? 0), out = roundDir(round);
  const { key } = JSON.parse(fs.readFileSync(keyFile(round), 'utf8')) as { key: KeyEntry[] };
  const raws = fs.readdirSync(path.join(out, 'raw')).filter(f => f.endsWith('.txt')).sort();
  const parsed = parseAnswers(raws.map(f => fs.readFileSync(path.join(out, 'raw', f), 'utf8')).join('\n'));
  const s = scoreRound(round, key, parsed.answers);
  const byPair = new Map(key.map(k => [k.pair, k]));
  fs.writeFileSync(path.join(out, 'answers.json'), JSON.stringify(parsed.answers.map(a => ({ ...a, truth: byPair.get(a.pair)?.game, fooled: byPair.get(a.pair)?.game !== a.game, pandId: byPair.get(a.pair)?.pandId, key: byPair.get(a.pair)?.key, group: byPair.get(a.pair)?.group, route: byPair.get(a.pair)?.route })), null, 1));
  fs.writeFileSync(path.join(out, 'histogram.json'), JSON.stringify({ round, answered: s.answered, histogram: s.histogram }, null, 1));
  const { histogram, ...rate } = s;
  fs.writeFileSync(path.join(out, 'fooled-rate.json'), JSON.stringify(rate, null, 1));
  fs.writeFileSync(path.join(out, 'rejected.json'), JSON.stringify(parsed.rejected, null, 1));
  console.log(`round ${round}: ${s.answered}/${s.pairs} answered (${parsed.rejected.length} lines rejected), fooled ${s.fooled} = ${(s.fooledRate * 100).toFixed(1)} %`);
  for (const r of histogram) console.log(`  ${r.text.padEnd(24)} ${String(r.count).padStart(4)}  sev ${String(r.severitySum).padStart(4)}  ${Object.entries(r.byGroup).map(([g, n]) => `${g} ${n}`).join(', ')}`);
  plot();
}

function scoredRounds(): RoundScore[] {
  if (!fs.existsSync(CRITIC_DIR)) return [];
  return fs.readdirSync(CRITIC_DIR).filter(d => /^round-\d+$/.test(d) && fs.existsSync(path.join(CRITIC_DIR, d, 'fooled-rate.json')))
    .map(d => JSON.parse(fs.readFileSync(path.join(CRITIC_DIR, d, 'fooled-rate.json'), 'utf8')) as RoundScore).sort((a, b) => a.round - b.round);
}

/** fooled-rate over rounds: artifacts/critic/fooled-rate.{svg,png,json}, with the 0.5 chance line and the stop rule. */
export function plot() {
  const rounds = scoredRounds(), rates = rounds.map(r => r.fooledRate), stop = flatForTwoRounds(rates);
  const W = 720, H = 360, L = 60, R = 20, T = 40, B = 50, n = Math.max(rounds.length, 2);
  const x = (i: number) => L + (W - L - R) * (n === 1 ? 0.5 : i / (n - 1)), y = (v: number) => T + (H - T - B) * (1 - v / 0.6);
  const pts = rounds.map((r, i) => `${x(i).toFixed(1)},${y(r.fooledRate).toFixed(1)}`).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#fff"/>
<text x="${L}" y="24" font-size="15" fill="#111">Facade benchmark: critic fooled-rate per round${stop ? ' (flat two rounds: restart the critic)' : ''}</text>
${[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0.5 ? '#c44' : '#e3e3e3'}" stroke-dasharray="${v === 0.5 ? '5 4' : ''}"/><text x="${L - 8}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#555">${(v * 100).toFixed(0)}%</text>`).join('')}
<text x="${W - R}" y="${y(0.5) - 6}" font-size="11" text-anchor="end" fill="#c44">chance (cannot tell)</text>
${rounds.map((r, i) => `<text x="${x(i)}" y="${H - B + 18}" font-size="11" text-anchor="middle" fill="#555">round ${r.round}</text><circle cx="${x(i)}" cy="${y(r.fooledRate)}" r="4" fill="#1f5fae"/><text x="${x(i) + 6}" y="${y(r.fooledRate) - 8}" font-size="11" fill="#1f5fae">${(r.fooledRate * 100).toFixed(1)}% (${r.fooled}/${r.answered})</text>`).join('')}
${rounds.length > 1 ? `<polyline points="${pts}" fill="none" stroke="#1f5fae" stroke-width="2"/>` : ''}
</svg>`;
  fs.mkdirSync(CRITIC_DIR, { recursive: true });
  fs.writeFileSync(path.join(CRITIC_DIR, 'fooled-rate.svg'), svg);
  fs.writeFileSync(path.join(CRITIC_DIR, 'fooled-rate.json'), JSON.stringify({ rounds: rounds.map(r => ({ round: r.round, fooledRate: r.fooledRate, fooled: r.fooled, answered: r.answered })), stop }, null, 1));
  return sharp(Buffer.from(svg)).png().toFile(path.join(CRITIC_DIR, 'fooled-rate.png')).then(() => { if (stop) console.log('STOP RULE: the fooled-rate is flat for two rounds; restart with a fresh critic (new seed and chunking) before the next feature round.'); });
}

export async function main(argv = process.argv.slice(2)) {
  const cmd = argv[0];
  if (cmd === 'prepare') return prepare(argv);
  if (cmd === 'score') return score(argv);
  if (cmd === 'plot') return plot();
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*?/, '').replace(/^ \* ?/gm, ''));
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('scripts', 'house-line', 'critic.ts'))) {
  main().catch(e => { console.error(e instanceof Error ? e.stack : e); process.exit(1); });
}
