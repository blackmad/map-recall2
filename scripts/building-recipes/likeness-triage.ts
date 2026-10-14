/**
 * Triage of the installed `kind: large` houses against their photos (plan "Large tier to photo likeness", Part 1 lane D).
 *
 *   node --import tsx scripts/building-recipes/likeness-triage.ts --review [--houses=a,b] [--chunk=4]
 *   node --import tsx scripts/building-recipes/likeness-triage.ts --report
 *
 * Inputs per house: `houses/<id>/measured.json` (measure.ts), `houses/<id>/intent.json` (street-facing groups as the
 * install gate reads them, likenessGate.ts `streetFacing`) and the reviewer's verdicts in
 * `scripts/building-recipes/likeness-triage.json` ({<id>: {look, outcome, system?, note?}}).
 *
 * --review composes, per house, the likeness row (photo | model elevation | overlay) and the swatch row of every
 * street-facing group's three-row contact sheet (large.ts) into `artifacts/building-recipes/likeness/review/`, several
 * houses per image, for the reviewer to judge at gallery size.
 * --report writes `artifacts/building-recipes/likeness/report.md`, ranked worst-first by the worst street-facing group.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {streetFacing} from '../../src/canalRecall/buildingRecipe/likenessGate.ts';

const HOUSES = 'scripts/building-recipes/houses', ART = 'artifacts/building-recipes', OUT = path.join(ART, 'likeness');
const VERDICTS = 'scripts/building-recipes/likeness-triage.json';
export type Outcome = 'keep' | 'refit' | 'refit-system' | 'uninstall' | 'inferred' | 'refit-done' | 'uninstalled';
export interface Verdict {look: string; outcome: Outcome; system?: string; note?: string; was?: string}
const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));

/** Severity of a group verdict: higher is worse. FAIL above the abstentions (a wrong model is worse than an unjudged one). */
export function groupSeverity(g: any): number {
  const v = g.verdict as string, L = g.likeness;
  if (v === 'FAIL') return 3 + Math.min(1, Math.abs(L?.wall?.dL ?? 0) * 3 + (L?.glazing?.meanDiff ?? 0) * 2 + (L?.wall?.pass === false ? 0.3 : 0)) ;
  if (v === 'NO EVIDENCE') return 2.5;
  if (v === 'NO PHOTO') return 2;
  if (v === 'WARN') return 1;
  return 0;
}

export function houseRow(id: string) {
  const intent = readJson(path.join(HOUSES, id, 'intent.json'));
  const mfile = path.join(HOUSES, id, 'measured.json');
  const measured = fs.existsSync(mfile) ? readJson(mfile) : null;
  const groups: any[] = measured?.groups ?? [];
  const facing = new Set(streetFacing(intent.walls.map((w: any, i: number) => ({group: i, system: w.system, street: w.street}))));
  const street = groups.filter(g => facing.has(g.group));
  const worst = street.length ? Math.max(...street.map(groupSeverity)) : (groups.length ? -1 : 2);
  return {id, intent, measured, groups, facing, street, worst};
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '-' : (v * 100).toFixed(0));
const sgn = (v: number | null | undefined) => (v === null || v === undefined ? '-' : (v > 0 ? '+' : '') + v.toFixed(2));

export function groupLine(g: any, intent: any, facing: Set<number>): string {
  const w = intent.walls[g.group], where = facing.has(g.group) ? `street${w.street ? ' ' + w.street : ''}` : 'hidden';
  const head = `walls[${g.group}] ${w.system} (${where}): **${g.verdict}**`;
  if (g.verdict === 'NO PHOTO') return `${head}; no archived crop covers panel ${g.panel} (coverage ${pct(g.coverage)} %)`;
  const L = g.likeness, m = g.measured, ev = L.evidence;
  const bands = (a: (number | null)[]) => a.slice(1).map(pct).join('/');
  const parts = [
    `wall photo ${L.wall.photo} (${L.wall.photoFamily}) vs authored ${L.wall.model} (${L.wall.modelFamily ?? '-'}), ΔL ${sgn(L.wall.dL)}`,
    `glazing ${pct(L.glazing.photoMean)} vs ${pct(L.glazing.modelMean)} % (bands ${bands(L.glazing.photo)} | ${bands(L.glazing.model)})`,
    `columns ${L.columns.photo ?? '-'} vs ${L.columns.model ?? '-'}`,
    `shape ${L.shape.photo ?? '-'} vs ${L.shape.model ?? '-'}, class ${L.classes.photo} vs ${L.classes.model}`,
    `crop ${g.crop.ref.split('/').pop()} ${g.crop.capturedAt}`,
    `usable ${pct(ev.usable)} %, foliage ${pct(ev.foliage)} %, washed ${pct(ev.washedOut)} %`,
  ];
  if (m?.split) parts.push(`split ${m.split.left} | ${m.split.right} at ${pct(m.split.at)} %`);
  const why = g.reasons?.length ? ` — ${g.reasons.join('; ')}` : '';
  return `${head}${why}. ${parts.join('; ')}`;
}

const OUTCOME_TEXT: Record<Outcome, string> = {
  keep: 'keep', refit: 're-fit cheap', 'refit-system': 're-fit after new system', uninstall: 'uninstall', inferred: 'inferred',
  'refit-done': 're-fit cheap (done)', uninstalled: 'uninstall (done)',
};

function report(ids: string[], verdicts: Record<string, Verdict>) {
  const rows = ids.map(houseRow).sort((a, b) => b.worst - a.worst || a.id.localeCompare(b.id));
  const count: Record<string, number> = {};
  for (const r of rows) { const o = verdicts[r.id]?.outcome ?? 'unreviewed'; count[o] = (count[o] ?? 0) + 1; }
  const systems: Record<string, string[]> = {};
  for (const r of rows) { const v = verdicts[r.id]; if (v?.system) for (const s of v.system.split(/;\s*/)) (systems[s] ??= []).push(r.id); }
  const lines = [
    '# Large tier likeness triage (2026-10-14)',
    '',
    'Plan `docs/plans/large-tier-likeness-and-streets-20261014.md` Part 1 lane D. Every installed `kind: large` house beyond the five',
    'reconciled pilots: crops archived (`all-walls.ts --archive --min-len=8 --max=12`), measured (`measure.ts --debug`), likeness and',
    'three-row contact sheets (`large.ts`), judged at gallery size. Ranked worst-first by the worst street-facing group (FAIL by',
    'its colour and glazing error, then NO EVIDENCE, NO PHOTO, WARN, PASS). Street-facing as the install gate reads it',
    '(`likenessGate.ts streetFacing`: the groups with `street`, else every non-blank group). Generated by',
    '`scripts/building-recipes/likeness-triage.ts --report` from `measured.json` and `likeness-triage.json`.',
    '',
    `Outcomes: ${Object.entries(count).map(([k, n]) => `${OUTCOME_TEXT[k as Outcome] ?? k} ${n}`).join(', ')}.`,
    '',
    'Rule: all street-facing groups PASS or WARN and the sheet reads right → keep; FAIL on colour or glazing with the vocabulary',
    'present → re-fit cheap; FAIL needing a kit system that does not exist → re-fit after new system (named); ornament or',
    'irregular fenestration, or NO EVIDENCE / NO PHOTO on a ride-visible wall → uninstall; NO EVIDENCE only on hidden walls → inferred.',
    '',
  ];
  if (Object.keys(systems).length) {
    lines.push('## What the kit needs (re-fit after new system)', '');
    for (const [s, hs] of Object.entries(systems).sort((a, b) => b[1].length - a[1].length)) lines.push(`- **${s}** (${hs.length}): ${hs.join(', ')}`);
    lines.push('');
  }
  lines.push('## Houses', '');
  let rank = 0;
  for (const r of rows) {
    const v = verdicts[r.id];
    lines.push(`### ${++rank}. ${r.id} — ${v ? OUTCOME_TEXT[v.outcome] : 'unreviewed'}${v?.system ? ` (${v.system})` : ''}`, '');
    lines.push(`${r.intent.address ?? ''} · pand ${r.intent.pandId}${v?.was ? ` · ${v.was}` : ''}`, '');
    if (!r.measured) lines.push('- no measured.json (no archived crops)');
    for (const g of r.groups) lines.push(`- ${groupLine(g, r.intent, r.facing)}`);
    const unmeasured = r.intent.walls.map((w: any, i: number) => ({w, i})).filter(({w, i}: any) => w.system !== 'blank' && !r.groups.some(g => g.group === i));
    if (unmeasured.length) lines.push(`- not measured (no main panel or blank): ${unmeasured.map(({w, i}: any) => `walls[${i}] ${w.system}`).join(', ')}`);
    if (v) lines.push(`- **Gallery-size look:** ${v.look}`, ...(v.note ? [`- **Action:** ${v.note}`] : []));
    lines.push('');
  }
  fs.mkdirSync(OUT, {recursive: true});
  fs.writeFileSync(path.join(OUT, 'report.md'), lines.join('\n'));
  console.log(`${path.join(OUT, 'report.md')}: ${rows.length} houses; ${JSON.stringify(count)}`);
}

/** The likeness rows (title, row 1, the swatch part of row 2) of one contact sheet; null when the sheet has no likeness. */
async function likenessPart(file: string, g: any): Promise<Buffer | null> {
  if (!fs.existsSync(file) || !g.placement?.box) return null;
  const b = g.placement.box, W = b.u1 - b.u0, H = b.v1 - b.v0, S = Math.max(4, Math.min(30, 640 / W, 420 / H)), ph = Math.round(H * S);
  const meta = await sharp(file).metadata(), h = Math.min(meta.height!, 40 + ph + 26);
  return sharp(file).extract({left: 0, top: 0, width: meta.width!, height: h}).png().toBuffer();
}

async function review(ids: string[], chunk: number) {
  const dir = path.join(OUT, 'review');
  fs.mkdirSync(dir, {recursive: true});
  const rows = ids.map(houseRow);
  for (let k = 0; k < rows.length; k += chunk) {
    const parts: Buffer[] = [];
    for (const r of rows.slice(k, k + chunk)) {
      const shown = r.street.length ? r.street : r.groups;
      const label = `${r.id}: street ${[...r.facing].join(',') || '-'}; ${r.groups.map(g => `g${g.group} ${g.verdict}`).join(', ') || 'no measurement'}`;
      parts.push(await sharp(Buffer.from(`<svg width="1936" height="34"><rect width="100%" height="100%" fill="#0b3d91"/><text x="8" y="24" font-family="Helvetica" font-size="20" fill="#fff">${label.replace(/&/g, '&amp;')}</text></svg>`)).png().toBuffer());
      for (const g of shown) {
        if (g.verdict === 'NO PHOTO') continue;
        const p = await likenessPart(path.join(ART, r.id, `contact-walls-${g.group}.png`), g);
        if (!p) continue;
        const L = g.likeness, t = `g${g.group} ${g.verdict}: wall ${L.wall.photo} vs ${L.wall.model} dL ${L.wall.dL}; glazing ${pct(L.glazing.photoMean)} vs ${pct(L.glazing.modelMean)}; cols ${L.columns.photo} vs ${L.columns.model}; ${(g.reasons ?? []).join('; ')}`;
        parts.push(await sharp(Buffer.from(`<svg width="1936" height="30"><rect width="100%" height="100%" fill="#fff"/><text x="8" y="22" font-family="Helvetica" font-size="19" fill="#000">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`)).png().toBuffer(), p);
      }
    }
    const metas = await Promise.all(parts.map(p => sharp(p).metadata()));
    const W = Math.max(1936, ...metas.map(m => m.width!)), H = metas.reduce((s, m) => s + m.height!, 0);
    let y = 0;
    const comp = parts.map((p, i) => { const o = {input: p, left: 0, top: y}; y += metas[i].height!; return o; });
    const f = path.join(dir, `review-${rows[k].id}.jpg`);
    await sharp({create: {width: W, height: H, channels: 3, background: '#fff'}, limitInputPixels: false}).composite(comp).png().toBuffer().then(b => sharp(b, {limitInputPixels: false}).resize({width: Math.min(W, 1600)}).jpeg({quality: 80}).toFile(f));
    console.log(`${f}: ${rows.slice(k, k + chunk).map(r => r.id).join(', ')}`);
  }
}

if (process.argv[1]?.endsWith('likeness-triage.ts')) {
  const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const verdicts: Record<string, Verdict> = fs.existsSync(VERDICTS) ? readJson(VERDICTS) : {};
  const listed = arg('houses')?.split(',').filter(Boolean);
  const ids = listed ?? (fs.existsSync(path.join(OUT, 'houses.tsv')) ? fs.readFileSync(path.join(OUT, 'houses.tsv'), 'utf8').trim().split('\n').map(l => l.split('\t')[0]) : Object.keys(verdicts));
  if (process.argv.includes('--review')) await review(ids, Number(arg('chunk') ?? 4));
  if (process.argv.includes('--report')) report([...new Set([...ids, ...Object.keys(verdicts)])].filter(id => fs.existsSync(path.join(HOUSES, id, 'intent.json'))), verdicts);
}
