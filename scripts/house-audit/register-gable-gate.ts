// Register gable gate audit (lane H5h round 4, #351): which live houses change crown when the register's gable is gated
// (houseSpec/decorate.ts withHouseSpecCrown, modes drawn | gated | hint), through the game's own decorator chain and roof
// planner (scripts/world/pipeline.ts gameChain, roofMesh roofPlanForFeature), and how the drawn crown agrees with the
// photo-read hand set (data/house-line/hand-set-v1.json AB07 rows and the gable-only rows hand-set-v1.gable-b2.json).
//
//   HOUSE_SPECS_DIR=staging/house-specs node --import tsx scripts/house-audit/register-gable-gate.ts [--out <file.json>]
//
// The drawn crown of a feature: the planner's gable shape when its roof kind is `gable`, else the roof kind (pitched,
// mansard, hipped...), else `flat` (no planned roof). Against a hand reading, a raised gable (step, neck, bell, spout, point)
// must match exactly; a hand cornice or flat front matches any crown that is not a raised gable.
import fs from 'node:fs';
import path from 'node:path';
import { gameChain, loadTile } from '../world/pipeline.ts';
import { roofPlanForFeature } from '../../src/canalRecall/roofMesh.ts';
import { setRegisterGableMode, type RegisterGableMode } from '../../src/canalRecall/houseSpec/decorate.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const MODES: RegisterGableMode[] = ['drawn', 'gated', 'hint'];
const RAISED = new Set(['step', 'neck', 'raised-neck', 'bell', 'spout', 'point']);
const TO_INTENT: Record<string, string> = { step: 'step', neck: 'neck', raisedNeck: 'raised-neck', bell: 'bell', clock: 'bell', spout: 'spout', plain: 'point', cornice: 'cornice' };

const crownOf = (f: any): string => { const p = roofPlanForFeature(f); return !p ? 'flat' : p.kind === 'gable' ? (TO_INTENT[p.gable] ?? p.gable) : p.kind; };
const agrees = (hand: string, drawn: string) => (RAISED.has(hand) ? hand === drawn : !RAISED.has(drawn));

async function main() {
  const argv = process.argv.slice(2);
  const oi = argv.indexOf('--out'); const out = oi >= 0 ? argv[oi + 1] : path.join(ROOT, 'artifacts/house-audit/register-gable-gate.json');
  const json = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const gables = json(path.join(EXTRACT, 'monument-gables.json')).buildings as Record<string, string>;
  const facts = json(path.join(EXTRACT, 'monument-facts.json')).buildings as Record<string, { gable?: string }>;
  const reg = new Set([...Object.keys(gables), ...Object.keys(facts).filter(k => facts[k].gable)]);
  // hand readings: reader A on AB07 (single front, readable, not unknown) and B2 on the gable rows
  const hand = new Map<string, string>();
  for (const p of json(path.join(ROOT, 'data/house-line/hand-set-v1.json')).pands) if (p.group === 'ab07' && p.readable && p.extent === 'single' && p.fields.gable.value !== 'unknown') hand.set(`NL.IMBAG.Pand.${p.pandId}`, p.fields.gable.value);
  for (const r of json(path.join(ROOT, 'data/house-line/hand-set-v1.gable-b2.json')).rows) if (r.gable.value !== 'unknown') hand.set(`NL.IMBAG.Pand.${r.pandId}`, r.gable.value);
  const chain = gameChain();
  const tiles = fs.readdirSync(path.join(EXTRACT, 'building-tiles/14')).filter(x => /^\d+$/.test(x)).flatMap(x => fs.readdirSync(path.join(EXTRACT, 'building-tiles/14', x)).filter(f => f.endsWith('.geojson.gz')).map(f => `${x}/${f.replace('.geojson.gz', '')}`)).sort();
  type Row = { id: string; register: string; crown: Record<RegisterGableMode, string>; historic?: string; hand?: string; source: string };
  const rows: Row[] = [];
  let n = 0;
  for (const t of tiles) {
    setRegisterGableMode('drawn');
    const loaded = await loadTile(t, chain);
    for (const r of loaded) {
      const id = String(r.raw.properties.id ?? '');
      if (!reg.has(id)) continue;
      const crown = {} as Record<RegisterGableMode, string>; let historic: string | undefined, src = '';
      for (const m of MODES) {
        setRegisterGableMode(m);
        const styled = m === 'drawn' ? r.styled : chain.decorate(r.raw);
        crown[m] = crownOf(styled);
        if (m === 'gated') { historic = styled.properties.historicGable as string | undefined; src = String((r.raw.properties.houseSpec as any)?.src?.gable ?? ''); }
      }
      rows.push({ id, register: TO_INTENT[gables[id] ?? facts[id]?.gable ?? ''] ?? String(gables[id] ?? facts[id]?.gable), crown, ...(historic ? { historic } : {}), ...(hand.has(id) ? { hand: hand.get(id) } : {}), source: src });
    }
    if (++n % 50 === 0) console.error(`${n}/${tiles.length} tiles, ${rows.length} register pands`);
  }
  setRegisterGableMode('gated');
  const changed = (a: RegisterGableMode, b: RegisterGableMode) => rows.filter(r => r.crown[a] !== r.crown[b]);
  const tally = (list: Row[], a: RegisterGableMode, b: RegisterGableMode) => list.reduce((m: Record<string, number>, r) => { const k = `${r.crown[a]} -> ${r.crown[b]}`; m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const top = (m: Record<string, number>, k = 12) => Object.fromEntries(Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, k));
  const handRows = rows.filter(r => r.hand);
  const score = Object.fromEntries(MODES.map(m => [m, { agree: handRows.filter(r => agrees(r.hand!, r.crown[m])).length, n: handRows.length }]));
  const byHandRaised = Object.fromEntries(MODES.map(m => [m, { raisedHandAgree: handRows.filter(r => RAISED.has(r.hand!) && agrees(r.hand!, r.crown[m])).length, raisedHand: handRows.filter(r => RAISED.has(r.hand!)).length, flatHandAgree: handRows.filter(r => !RAISED.has(r.hand!) && agrees(r.hand!, r.crown[m])).length, flatHand: handRows.filter(r => !RAISED.has(r.hand!)).length }]));
  const report = {
    registerPands: rows.length, liveRegisterPands: rows.length,
    changedGated: changed('drawn', 'gated').length, changedHint: changed('drawn', 'hint').length,
    heldGated: rows.filter(r => r.historic).length,
    gatedTransitions: top(tally(changed('drawn', 'gated'), 'drawn', 'gated')), hintTransitions: top(tally(changed('drawn', 'hint'), 'drawn', 'hint')),
    handSet: { rows: handRows.length, score, byHandRaised, changedGated: handRows.filter(r => r.crown.drawn !== r.crown.gated).map(r => ({ id: r.id.slice(-16), hand: r.hand, ...r.crown })) },
    rows,
  };
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 1) + '\n');
  const { rows: _r, ...summary } = report;
  console.log(JSON.stringify(summary, null, 1));
}
await main();
