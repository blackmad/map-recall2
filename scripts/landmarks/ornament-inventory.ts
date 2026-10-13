/**
 * Retro-fit signature-ornament survey of existing bespoke landmarks (docs/buildings-pipeline.md, "Bespoke landmark lane").
 *
 *   node --import tsx scripts/landmarks/ornament-inventory.ts --select [--top=60]        # writes artifacts/ornament-inventory/targets.json
 *   node --import tsx scripts/landmarks/ornament-inventory.ts --render [--ids=a,b] [--walls=4] [--concurrency=3]
 *   node --import tsx scripts/landmarks/ornament-inventory.ts --table                    # ranked miss table from ornament-inventory.json
 *
 * --select: the manual-catalogue landmarks whose POI card cites Wikipedia (the destinations riders read about), topped up
 * to --top with the most recently first-exported landmarks; landmarks owned by other lanes (EXCLUDE) are left out.
 * --render: per landmark, the per-wall review sheet (review-sheet.ts: panorama photo | camera-matched render | overlay;
 * every exposed wall of its BAG pand, longest first, --walls) into artifacts/ornament-inventory/<id>/sheet/ and a
 * reduced photo|render strip `review.jpg` for judging. Judgement is human/agent work: per wall, what a rider notices at
 * 1.7 m or on a gallery card, and whether the render has it. It goes into scripts/landmarks/ornament-inventory.json
 * (`{landmarks: {[id]: LandmarkInventory}}`, schema src/canalRecall/landmarks/ornamentInventory.ts; retro-fit items may
 * be `skipped` with `needs-modeller`, the splat/impostor track).
 * --table: the misses (open, or skipped needs-modeller) ranked by `missScore` (size, kind, signature), as markdown in
 * artifacts/ornament-inventory/misses.md.
 */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {missScore, type LandmarkInventory} from '../../src/canalRecall/landmarks/ornamentInventory';
import {firstExportDates} from './landmark-inventory-gate';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'artifacts/ornament-inventory');
const SURVEY = path.join(ROOT, 'scripts/landmarks/ornament-inventory.json');
const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const flag = (n: string) => process.argv.includes(`--${n}`);
/** Owned by the Hoofdbureau lane and the cleanup batch-3 lane (handoff 2026-10-13). */
export const EXCLUDE = new Set(['hoofdbureau-elandsgracht', 'haparandaweg-2-4', 'petrus-en-paulus-kerk', 'opstandingskerk', 'rialto', 'valley', 'felix-meritis', 'jodenbreestraat-11', 'hotel-de-l-europe', 'mountain-network', 'palace-on-the-dam']);

interface Entry {id: string; name: string; suppressOsmIds?: string[]; status?: string}
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/landmarks/manualCatalogue.json'), 'utf8')) as Entry[];
const bagOf = (e: Entry) => e.suppressOsmIds?.find(s => s.includes('IMBAG.Pand'));
fs.mkdirSync(OUT, {recursive: true});

function select(top: number) {
  const poi = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/game/manual-poi-data.json'), 'utf8')) as {modelId?: string; sourceUrl?: string; additionalSources?: string[]}[];
  const wiki = new Set(poi.filter(p => [p.sourceUrl, ...(p.additionalSources ?? [])].some(u => /wikipedia\.org/.test(u ?? ''))).map(p => p.modelId));
  const ok = catalogue.filter(e => !EXCLUDE.has(e.id) && bagOf(e) && e.status !== 'held');
  const first = firstExportDates();
  const picked = ok.filter(e => wiki.has(e.id)).map(e => ({id: e.id, name: e.name, bag: bagOf(e)!, why: 'wikipedia POI card', firstExported: first.get(e.id)}));
  const recent = ok.filter(e => !wiki.has(e.id)).sort((a, b) => (first.get(b.id) ?? '').localeCompare(first.get(a.id) ?? ''));
  for (const e of recent) { if (picked.length >= top) break; picked.push({id: e.id, name: e.name, bag: bagOf(e)!, why: 'recent bespoke build', firstExported: first.get(e.id)}); }
  fs.writeFileSync(path.join(OUT, 'targets.json'), JSON.stringify(picked, null, 1) + '\n');
  console.log(`${picked.length} targets -> ${path.relative(ROOT, OUT)}/targets.json`);
}

function run(cmd: string, args: string[]): Promise<number> {
  return new Promise(res => { const p = spawn(cmd, args, {cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe']}); let log = ''; p.stdout.on('data', d => log += d); p.stderr.on('data', d => log += d); p.on('close', code => { if (code) console.log(log.split('\n').slice(-6).join('\n')); res(code ?? 1); }); });
}

async function render() {
  const targets = JSON.parse(fs.readFileSync(path.join(OUT, 'targets.json'), 'utf8')) as {id: string; bag: string}[];
  const ids = arg('ids') ? arg('ids').split(',') : targets.map(t => t.id);
  const queue = [...ids], walls = arg('walls', '4');
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      const dir = path.join(OUT, id, 'sheet');
      if (fs.existsSync(path.join(dir, 'sheet.png')) && !flag('force')) { console.log(`${id}: cached`); continue; }
      const bag = targets.find(t => t.id === id)?.bag ?? bagOf(catalogue.find(e => e.id === id)!);
      const code = await run('node', ['--import', 'tsx', 'scripts/landmarks/review-sheet.ts', `--id=${id}`, `--bag=${bag}`, '--no-game', `--walls=${walls}`, `--out=${path.relative(ROOT, dir)}`]);
      if (code || !fs.existsSync(path.join(dir, 'sheet.png'))) { console.log(`${id}: review sheet failed (${code})`); continue; }
      // photo | render columns only, reduced, for judging
      const meta = await sharp(path.join(dir, 'sheet.png')).metadata();
      const strip = await sharp(path.join(dir, 'sheet.png')).extract({left: 0, top: 0, width: Math.round(meta.width! * 2 / 3), height: meta.height!}).toBuffer();
      await sharp(strip).resize({width: 900}).jpeg({quality: 80}).toFile(path.join(OUT, id, 'review.jpg'));
      console.log(`${id}: ok`);
    }
  };
  await Promise.all(Array.from({length: Number(arg('concurrency', '3'))}, worker));
}

function table() {
  const doc = JSON.parse(fs.readFileSync(SURVEY, 'utf8')) as {landmarks: Record<string, LandmarkInventory>};
  const rows: {score: number; id: string; wall: string; item: string; kind: string; size: string; status: string; note: string; sig: boolean}[] = [];
  for (const [id, inv] of Object.entries(doc.landmarks)) {
    const sig = new Set(inv.signature);
    for (const w of inv.walls) for (const it of w.items) {
      if (it.plan !== 'open' && !(it.plan === 'skipped' && it.skip?.reason === 'needs-modeller')) continue;
      rows.push({score: missScore(it, sig.has(it.id)), id, wall: w.tag, item: it.where, kind: it.kind, size: `${it.approxSizeM[0]}x${it.approxSizeM[1]}`, status: it.plan === 'open' ? 'open' : 'needs-modeller', note: it.note ?? it.skip?.note ?? '', sig: sig.has(it.id)});
    }
  }
  rows.sort((a, b) => b.score - a.score);
  const n = Object.keys(doc.landmarks).length, items = Object.values(doc.landmarks).flatMap(l => l.walls.flatMap(w => w.items));
  const count = (p: string) => items.filter(i => i.plan === p).length;
  const md = [`# Signature-ornament misses (${n} landmarks, ${items.length} items: ${count('modelled')} modelled, ${count('simplified')} simplified, ${count('skipped')} skipped, ${count('open')} open)`, '',
    '| # | score | landmark | wall | kind | size m | status | where | note |', '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r, i) => `| ${i + 1} | ${r.score} | ${r.id}${r.sig ? ' *' : ''} | ${r.wall} | ${r.kind} | ${r.size} | ${r.status} | ${r.item} | ${r.note.replace(/\|/g, '/')} |`), '',
    '`*` signature item. Score = sqrt(area) x kind weight x 2 for signature (ornamentInventory.ts missScore).'];
  fs.writeFileSync(path.join(OUT, 'misses.md'), md.join('\n') + '\n');
  console.log(md.join('\n'));
}

if (flag('select')) select(Number(arg('top', '60')));
else if (flag('render')) await render();
else if (flag('table')) table();
else { console.error('one of --select, --render, --table'); process.exit(2); }
