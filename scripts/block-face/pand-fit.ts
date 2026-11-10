/**
 * Per-pand batch fit for canal-belt one-offs (pilot, Nieuwmarkt/Lastage 2026-11-10; blockFace/pandFit.ts). For every pand of
 * the given faces: measure its strip span (draft-type.ts measureFace: storey rows, window columns, skyline eaves and crown,
 * palette), the door side and ground-storey whiteness on the photo, the register gable (monument-facts.json) and the BAG
 * ground use; draft its own house type; write runs of two or more drafted neighbours as run faces `<face>-pf<k>`; compile
 * them (GLB audit and gates) and score each pand's edge-NCC likeness against the strip; pands failing a gate drop out and
 * the rest re-run once. Never installs: install a run you have looked at with `compile.ts --face=<run> --install`.
 *
 *   node --import tsx scripts/block-face/pand-fit.ts --buurt=<slug> --faces=<face>,... [--name=<batch>] [--skip=<pand6>,...]
 *
 * Writes the run faces (scripts/block-face/faces/<face>-pf<k>/), their sheets (staging/block-face/<run>/review/strip-sheet.png)
 * and staging/pand-fit/<name>.{csv,json}: pand -> measured fields -> drafted gable/bays/storeys -> gate result.
 */
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {FACES, STAGING} from './intake.ts';
import {measureFace} from './draft-type.ts';
import {doorSide, stripRaw, writeRunFace, runLikeness} from './auto-place.ts';
import {compileFace} from './compile.ts';
import {reviewFace} from './review.ts';
import {classifyPixel} from '../../src/canalRecall/blockFace/stripPalette.ts';
import {STRIP_LIKENESS} from '../../src/canalRecall/blockFace/stripLikeness.ts';
import {draftPandType, PAND_FIT, type PandFitResult, type RegisterGable} from '../../src/canalRecall/blockFace/pandFit.ts';
import type {PandRecord} from '../../src/canalRecall/blockFace/typeDraft.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const readJson = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const buurt = arg('buurt'), faces = (arg('faces') ?? '').split(',').filter(Boolean), name = arg('name') ?? `pand-fit-${buurt}`;
const skip = new Set((arg('skip') ?? '').split(',').filter(Boolean));
if (!buurt || !faces.length) throw Error('pand-fit: --buurt=<slug> --faces=<face>,...');

const survey = readJson(`scripts/block-face/buurten/${buurt}.json`);
const record = new Map<string, PandRecord>(survey.pands.map((p: any) => [p.pandId, {pandId: p.pandId, face: null, builtYear: p.builtYear ?? null, storeys3dbag: p.storeys3dbag ?? null, frontWidthM: p.frontWidthM ?? null, eavesM: p.eavesM ?? null}]));
const register = readJson('public/data/extracts/amsterdam/monument-facts.json').buildings as Record<string, {gable?: {key?: string} | string}>;
const registerGable = (id: string): RegisterGable => { const g = register[`NL.IMBAG.Pand.${id}`]?.gable; const k = typeof g === 'string' ? g : g?.key; return (['cornice', 'bell', 'neck', 'step', 'plain', 'spout'].includes(k ?? '') ? k : null) as RegisterGable; };

type Row = PandFitResult['measured'] & {face: string; run: string | null; result: string; ncc: number | null; seconds: number};
const rows: Row[] = [];
const t0 = performance.now();

/** Share of light accent pixels in the ground band of a span. */
function groundAccent(raw: {rgb: Uint8Array; width: number; height: number}, px: [number, number], ppm: number): number {
  const [a, b] = PAND_FIT.groundBandM, y0 = Math.round(raw.height - b * ppm), y1 = Math.round(raw.height - a * ppm);
  let acc = 0, n = 0;
  for (let y = Math.max(0, y0); y < y1; y++) for (let x = px[0]; x < px[1]; x++) {
    const i = (y * raw.width + x) * 3, c = classifyPixel([raw.rgb[i], raw.rgb[i + 1], raw.rgb[i + 2]]);
    if (c === 'void') continue; n++; if (c === 'accent') acc++;
  }
  return n ? acc / n : 0;
}

/** Consecutive runs (strip order) of at least two drafted pands. */
const runsOf = (order: string[], ok: Set<string>) => {
  const runs: string[][] = []; let cur: string[] = [];
  // A run of one is a lone-pand face (continuity.lonePand): a one-off between held neighbours is the belt's usual case.
  for (const id of order) { if (ok.has(id)) cur.push(id); else { if (cur.length) runs.push(cur); cur = []; } }
  if (cur.length) runs.push(cur);
  return runs;
};

for (const face of faces) {
  const dir = path.join(FACES, face), strip = readJson(path.join(dir, 'strip.json')), uses = readJson(path.join(dir, 'uses.json')), discovery = readJson(path.join(dir, 'discovery.json'));
  const raw = await stripRaw(path.join(STAGING, face, 'strip.jpg')), ppm = strip.pixelsPerMetre;
  const order: string[] = strip.spans.map((s: any) => s.pandId);
  const tFace = performance.now();
  const measures = await measureFace(face, new Set(order), record, {brightSky: true, groundFirst: true});
  const drafts = new Map<string, PandFitResult>();
  for (const s of strip.spans as any[]) {
    const m = measures.find(x => x.pandId === s.pandId), u = uses.pands.find((p: any) => p.pandId === s.pandId);
    const groundUses: string[] = (u?.groundUnits ?? []).map((g: any) => g.use);
    const trading = groundUses.some(g => /winkel|bijeenkomst|horeca/.test(g)) || (u?.osm ?? []).some((o: any) => /^(shop|amenity)=/.test(o.category ?? ''));
    const address = u?.addresses?.[0] ?? `pand ${s.pandId.slice(-6)}`;
    const px: [number, number] = [Math.max(0, s.px[0]), Math.min(raw.width, s.px[1])];
    let d: PandFitResult;
    if (skip.has(s.pandId.slice(-6))) d = {type: null, placement: null, hold: 'skipped (installed or drawn by another tier)', measured: {pand: s.pandId, address}, crownFromPhoto: false};
    else if (!m) d = {type: null, placement: null, hold: 'not measured (no facts or no strip span)', measured: {pand: s.pandId, address}, crownFromPhoto: false};
    else d = draftPandType({pandId: s.pandId, address, face, stripDate: strip.date ?? null, widthM: m.widthM, eavesM: m.eavesM, skylineEavesM: m.skylineEavesM, crown: m.crown, storey: m.storey, windowCols: m.windowCols, windowWidthM: m.windowWidthM,
      palette: {wall: m.palette.wall, frame: m.palette.frame, stucco: m.palette.stucco}, doorSide: doorSide(raw, px, ppm), groundAccent: groundAccent(raw, px, ppm), trading, registerGable: registerGable(s.pandId), groundTopM: m.groundTopM, alignment: m.alignment});
    drafts.set(s.pandId, d);
  }
  const perPand = (performance.now() - tFace) / 1000 / Math.max(1, order.length);
  // Two passes: compile the runs, drop the pands that fail a gate or the likeness, re-run the rest once.
  let ok = new Set([...drafts].filter(([, d]) => d.type).map(([id]) => id));
  const result = new Map<string, {result: string; ncc: number | null; run: string | null}>();
  for (const [id, d] of drafts) if (!d.type) result.set(id, {result: `held: ${d.hold}`, ncc: null, run: null});
  for (let pass = 1; pass <= 2; pass++) {
    const runs = runsOf(order, ok), failed = new Set<string>();
    for (const id of ok) if (!runs.some(r => r.includes(id))) { result.set(id, {result: 'held: run of one (a block face needs two houses)', ncc: null, run: null}); }
    for (const [k, ids] of runs.entries()) {
      const runId = `${face}-pf${k + 1}`;
      await writeRunFace(face, runId, ids, strip, uses, discovery);
      const intent = {
        schemaVersion: 1, kind: 'block-face', id: runId, street: discovery.street ?? uses.street,
        sources: [{id: `strip-${strip.date}`, kind: 'street-panorama', capturedAt: strip.date, image: `staging/block-face/${runId}/strip.jpg`, license: 'Gemeente Amsterdam panorama, CC BY 4.0'}],
        authoring: {author: 'pand-fit (blockFace/pandFit.ts)', passes: pass, note: `one drafted type per pand from its own strip span; batch ${name}`},
        types: ids.map(id => drafts.get(id)!.type),
        houses: ids.map(id => { const u = uses.pands.find((p: any) => p.pandId === id), bag = (u?.groundUnits ?? []).map((g: any) => g.use);
          return {pandId: id, slug: `${face}-${id.slice(-6)}`, address: drafts.get(id)!.measured.address, type: drafts.get(id)!.placement,
            groundFloor: {use: bag.some((g: string) => /winkel|horeca|bijeenkomst/.test(g)) ? 'shop' : bag.some((g: string) => /kantoor/.test(g)) ? 'office' : 'residential', bag, photoDate: strip.date, agreement: 'bag-only', note: 'pand-fit: BAG gebruiksdoel, not read off the photo'},
            rhythm: {citation: `pand-fit: ${drafts.get(id)!.measured.gableSource}; strip ${strip.date}`}}; }),
        continuity: {streetLevel: 'shared', corniceGroups: [], identical: [], partyClip: true,
          ...(ids.length === 1 ? {lonePand: {evidence: `pand-fit: a one-off front between held or other-tier neighbours`}} : {}),
          roof: {source: 'recipe', pitchDeg: 30, evidence: 'pand-fit: a low roof behind the drawn eaves'},
          ...(ids.some(id => drafts.get(id)!.measured.skylineEavesM !== null) ? {measuredEaves: ids.filter(id => drafts.get(id)!.measured.skylineEavesM !== null).map(id => ({pand: id, stripRow: Math.round(strip.height - (drafts.get(id)!.measured.skylineEavesM as number) * ppm), evidence: `pand-fit: strip skyline eaves ${drafts.get(id)!.measured.skylineEavesM} m (3DBAG ${drafts.get(id)!.measured.bagEavesM} m)`}))} : {}),
          ...(ids.some(id => drafts.get(id)!.crownFromPhoto) ? {crownFromPhoto: ids.filter(id => drafts.get(id)!.crownFromPhoto).map(id => ({pand: id, evidence: `pand-fit: ${drafts.get(id)!.measured.gableSource}; outline from the strip`}))} : {})},
      };
      await fs.writeFile(path.join(FACES, runId, 'intent.json'), JSON.stringify(intent, null, 1) + '\n');
      let report: any;
      try { await compileFace(runId); report = readJson(path.join(STAGING, runId, 'report.json')); }
      catch (e) { for (const id of ids) { failed.add(id); result.set(id, {result: `held: compile failed (${(e as Error).message.split('\n').slice(0, 3).join(' ').slice(0, 160)})`, ncc: null, run: runId}); } continue; }
      const gateFails = new Map<string, string>();
      // compile.ts gates carry the 6-digit pand id; a failed GLB audit or interference check fails the whole run.
      for (const g of report.gates ?? []) if (g.pass === false) gateFails.set(String(g.pand), `${gateFails.get(String(g.pand)) ? gateFails.get(String(g.pand)) + '; ' : ''}${g.id}`);
      const auditFail = report.audit?.exit !== 0 || (report.passed === false && !gateFails.size);
      const like = await runLikeness(runId);
      for (const l of like) {
        const gate = gateFails.get(l.pandId.slice(-6)), weak = l.ncc === null || l.ncc < STRIP_LIKENESS.minNcc;
        const why = gate ? `gate ${gate}` : auditFail ? 'GLB audit' : weak ? `likeness ${l.abstain ?? `edge NCC ${l.ncc} < ${STRIP_LIKENESS.minNcc}`}` : null;
        if (why) failed.add(l.pandId);
        result.set(l.pandId, {result: why ? `held: ${why}` : 'pass', ncc: l.ncc, run: runId});
      }
      // Colour gate (round 2): the review's wall-colour check (wallColour.ts: model vs photo on the same pixels).
      const rev = await reviewFace(runId).catch(e => { console.log(`${runId}: sheet failed ${(e as Error).message}`); return null; });
      for (const f of rev?.fc ?? []) {
        const r = result.get(f.pand);
        if (!r || r.result !== 'pass' || !f.wallColour || f.wallColour.pass) continue;
        failed.add(f.pand);
        result.set(f.pand, {...r, result: `held: wall colour ${f.wallColour.note}`});
      }
      console.log(`${runId}: ${ids.length} pands, ${ids.filter(id => !failed.has(id)).length} pass`);
    }
    if (!failed.size) break;
    ok = new Set([...ok].filter(id => !failed.has(id)));
    if (pass === 2) break;
  }
  for (const id of order) { const d = drafts.get(id)!, r = result.get(id) ?? {result: 'held: dropped in pass 1', ncc: null, run: null}; rows.push({...d.measured, face, run: r.run, result: r.result, ncc: r.ncc, seconds: +perPand.toFixed(2)} as Row); }
  console.log(`${face}: ${order.length} pands, ${rows.filter(r => r.face === face && r.result === 'pass').length} pass`);
}

await fs.mkdir('staging/pand-fit', {recursive: true});
const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
const esc = (v: unknown) => v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
await fs.writeFile(`staging/pand-fit/${name}.csv`, [cols.join(','), ...rows.map(r => cols.map(c => esc((r as any)[c])).join(','))].join('\n') + '\n');
await fs.writeFile(`staging/pand-fit/${name}.json`, JSON.stringify({name, buurt, faces, seconds: +((performance.now() - t0) / 1000).toFixed(1), rows}, null, 1) + '\n');
const pass = rows.filter(r => r.result === 'pass').length;
console.log(`${name}: ${rows.length} pands, ${pass} pass the gates (${Math.round(100 * pass / Math.max(1, rows.length))} %), ${((performance.now() - t0) / 1000 / Math.max(1, rows.length)).toFixed(1)} s per pand -> staging/pand-fit/${name}.csv`);
process.exit(0);
