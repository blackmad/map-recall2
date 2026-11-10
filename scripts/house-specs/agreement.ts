// Writer-vs-hand agreement (house line H5): the generated specs of a buurt (scripts/house-specs/generated/<code>/) against the hand
// intents of the same pands (a1's block-face intents, hand canal-house recipe intents), per field and per writer and merged.
import fs from 'node:fs';
import path from 'node:path';
import { validateBlockFace } from '../../src/canalRecall/blockFace/intent.ts';
import { fromBlockFace, fromRecipeIntent } from '../../src/canalRecall/houseSpec/adapters.ts';
import { frontBays, specField, type HouseSpec } from '../../src/canalRecall/houseSpec/spec.ts';
import { SWATCHES } from '../../src/canalRecall/buildingRecipe/intent.ts';
import { rgbToHsl } from '../../src/canalRecall/blockFace/wallColour.ts';
import type { Envelope } from './describe.ts';

export const HELP = `agreement: writer-vs-hand table for a buurt's generated specs.

  node --import tsx scripts/house-specs/agreement.ts --buurt <code> [--out <file.json>] [--worst <n>] [--dir <generated dir>]

Hand truth: the block-face intents (scripts/block-face/faces/*/intent.json, authored and auto-placed) and the canal-house recipe intents
(scripts/building-recipes/houses/*/intent.json) of the buurt's pands. Fields: bays, gable, finish (palette.wallMaterial), storeys, pui
(ground floor use) and wall colour (agree = HSL lightness within 0.12, the likeness wall tolerance). Per writer and merged:
  hand      pands with a hand value for the field
  written   of those, pands where the writer stated the field
  agree     of those, the same value
  precision agree / written        recall agree / hand

The photo-read hand set (data/house-line/hand-set-v1.json, docs/house-line.md §4c) is the gate set since H5h: score the writers
against it with --hand-set (runs scripts/house-specs/hand-set/score.ts: reader ceiling, per-field gates = blind reader ceiling - 0.1
(GATE_MARGIN), Wilson 95 % intervals; a writer fails only when the top of its interval is below the gate; gable needs n >= 60, MIN_N).

  node --import tsx scripts/house-specs/agreement.ts --hand-set [--out data/house-line/hand-set-v1.scores.json]`;

/**
 * Writer gates against the photo-read hand set (judgement rulings on H5h #351, docs/house-line.md §4c): per field, the gate is the
 * blind reader ceiling minus 0.1, computed from the ceiling each time it is re-measured (round 3: the round-2 floors came from the
 * first ceiling and are gone). A writer FAILS only when the top of its Wilson 95 % interval is below the gate (a small n cannot
 * fail a writer that might be good); it PASSES when the bottom is at or above the gate; otherwise the verdict is OPEN. A field
 * with a MIN_N gives no pass or fail verdict under that n (gable: 60 stated pands).
 */
export const GATE_FIELDS = ['bays', 'storeys', 'gable', 'finish', 'pui', 'wallTone', 'wallFamily'] as const;
export type GateField = (typeof GATE_FIELDS)[number];
export const GATE_MARGIN = 0.1;
export const MIN_N: Partial<Record<GateField, number>> = { gable: 60 };
export const gateFor = (ceiling: number) => +(ceiling - GATE_MARGIN).toFixed(3);
/** Wilson score interval for k successes of n (z 1.96). */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [+Math.max(0, (c - r) / d).toFixed(3), +Math.min(1, (c + r) / d).toFixed(3)];
}
export type Verdict = 'pass' | 'open' | 'fail' | 'n/a';
export function verdict(k: number, n: number, gate: number, minN = 0): { lo: number; hi: number; verdict: Verdict } {
  if (!n) return { lo: 0, hi: 1, verdict: 'n/a' };
  const [lo, hi] = wilson(k, n);
  return { lo, hi, verdict: n < minN ? 'open' : hi < gate ? 'fail' : lo >= gate ? 'pass' : 'open' };
}

export const WALL_L = 0.12;
const FIELDS = ['bays', 'gable', 'finish', 'storeys', 'pui', 'wall'] as const;
export type Field = (typeof FIELDS)[number];
const lightness = (v: string) => { const hex = (SWATCHES as Record<string, string>)[v] ?? v; const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return null; const n = parseInt(m[1], 16); return rgbToHsl([(n >> 16) & 255, (n >> 8) & 255, n & 255])[2]; };

export function valueOf(spec: HouseSpec | null | undefined, f: Field): unknown {
  if (!spec) return undefined;
  switch (f) {
    case 'bays': return frontBays(spec.design.fronts?.[0]);
    case 'gable': return specField(spec, 'fronts/0/gable');
    case 'finish': return specField(spec, 'palette/wallMaterial');
    case 'storeys': return specField(spec, 'fronts/0/storeys');
    case 'pui': return specField(spec, 'facts/pui');
    case 'wall': return specField(spec, 'palette/brick');
  }
}
/** Same value; the wall colour agrees within `WALL_L` HSL lightness. */
export function agrees(f: Field, hand: unknown, got: unknown): boolean {
  if (f === 'wall') { const a = lightness(String(hand)), b = lightness(String(got)); return a !== null && b !== null && Math.abs(a - b) <= WALL_L; }
  return hand === got;
}

export type Row = { hand: number; written: number; agree: number; precision: number | null; recall: number | null; medianDL?: number };
export function tabulate(pairs: { hand: HouseSpec; writers: Record<string, HouseSpec | null>; merged: HouseSpec | null }[]): Record<string, Record<Field, Row>> {
  const names = ['register', 'bag', 'pixel', 'jev', 'merged'];
  const out: Record<string, Record<Field, Row>> = {};
  for (const w of names) {
    out[w] = {} as Record<Field, Row>;
    for (const f of FIELDS) {
      let hand = 0, written = 0, agree = 0; const dl: number[] = [];
      for (const p of pairs) {
        const h = valueOf(p.hand, f);
        if (h === undefined) continue;
        hand++;
        const g = valueOf(w === 'merged' ? p.merged : p.writers[w], f);
        if (g === undefined) continue;
        written++;
        if (agrees(f, h, g)) agree++;
        if (f === 'wall') { const a = lightness(String(h)), b = lightness(String(g)); if (a !== null && b !== null) dl.push(Math.abs(a - b)); }
      }
      dl.sort((a, b) => a - b);
      out[w][f] = { hand, written, agree, precision: written ? +(agree / written).toFixed(3) : null, recall: hand ? +(agree / hand).toFixed(3) : null, ...(f === 'wall' && dl.length ? { medianDL: +dl[Math.floor(dl.length / 2)].toFixed(3) } : {}) };
    }
  }
  return out;
}

/** Hand specs of the pands in `ids`: block faces (all, authored and auto-placed) and canal-house recipe intents; a recipe intent wins over a face. */
export function handSpecs(ids: Set<string>, root = path.resolve('.')): Map<string, HouseSpec & { handKind: string }> {
  const out = new Map<string, HouseSpec & { handKind: string }>();
  const faces = path.join(root, 'scripts/block-face/faces');
  for (const d of fs.readdirSync(faces)) {
    const f = path.join(faces, d, 'intent.json'); if (!fs.existsSync(f)) continue;
    let face; try { face = validateBlockFace(JSON.parse(fs.readFileSync(f, 'utf8'))); } catch { continue; }
    for (const h of face.houses) if (ids.has(h.pandId)) { const s = fromBlockFace(face, h.pandId); if (s) out.set(h.pandId, Object.assign(s, { handKind: /^auto-place/.test(face.authoring?.author ?? '') ? 'block-face (auto-placed)' : 'block-face (authored)' })); }
  }
  const houses = path.join(root, 'scripts/building-recipes/houses');
  for (const d of fs.readdirSync(houses)) {
    const f = path.join(houses, d, 'intent.json'); if (!fs.existsSync(f)) continue;
    const intent = JSON.parse(fs.readFileSync(f, 'utf8')); const id = String(intent.pandId ?? '').replace(/^NL\.IMBAG\.Pand\./, '');
    if (!ids.has(id)) continue;
    const s = fromRecipeIntent(intent, path.relative(root, f)); if (s) out.set(id, Object.assign(s, { handKind: 'recipe intent' }));
  }
  return out;
}

const pct = (v: number | null) => (v === null ? '  -  ' : v.toFixed(2));
export function printTable(t: Record<string, Record<Field, Row>>) {
  console.log('| field | hand | ' + Object.keys(t).map(w => `${w} written / agree / P / R`).join(' | ') + ' |');
  console.log('|---|---|' + Object.keys(t).map(() => '---').join('|') + '|');
  for (const f of FIELDS) console.log(`| ${f} | ${t.merged[f].hand} | ` + Object.keys(t).map(w => { const r = t[w][f]; return `${r.written} / ${r.agree} / ${pct(r.precision)} / ${pct(r.recall)}${r.medianDL !== undefined ? ` (median dL ${r.medianDL})` : ''}`; }).join(' | ') + ' |');
}

/** The disagreements to look at: merged value against a hand value, the most confident first; then writer against writer. */
export function worst(envs: Envelope[], hands: Map<string, HouseSpec>, n: number) {
  const list: { pandId: string; field: string; kind: 'hand' | 'writers'; hand?: unknown; merged?: unknown; confidence: number; values?: Envelope['disagreements'][number]['values'] }[] = [];
  for (const e of envs) {
    const h = hands.get(e.pandId);
    for (const f of FIELDS) {
      const hv = valueOf(h, f), mv = valueOf(e.spec, f);
      if (hv === undefined || mv === undefined || agrees(f, hv, mv)) continue;
      const path = f === 'bays' ? 'fronts/0/bays' : f === 'gable' ? 'fronts/0/gable' : f === 'finish' ? 'palette/wallMaterial' : f === 'storeys' ? 'fronts/0/storeys' : f === 'pui' ? 'facts/pui' : 'palette/brick';
      list.push({ pandId: e.pandId, field: f, kind: 'hand', hand: hv, merged: mv, confidence: e.spec?.provenance[path]?.confidence ?? 0 });
    }
  }
  list.sort((a, b) => b.confidence - a.confidence);
  const seen = new Set(list.map(x => x.pandId));
  const rest: typeof list = [];
  for (const e of envs) for (const d of e.disagreements) {
    if (d.path === 'notes' || d.path === 'facts/facadeYear' || seen.has(e.pandId)) continue;
    rest.push({ pandId: e.pandId, field: d.path, kind: 'writers', confidence: Math.min(...d.values.map(v => v.confidence)), values: d.values });
  }
  rest.sort((a, b) => b.confidence - a.confidence);
  return [...list, ...rest].slice(0, n);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) { console.log(HELP); return; }
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  if (argv.includes('--hand-set')) { const { scoreHandSet } = await import('./hand-set/score.ts'); scoreHandSet({ out: opt('out') }); return; }
  const code = opt('buurt'); if (!code) { console.error('--buurt <code> required'); process.exit(2); }
  const dir = opt('dir') ?? path.resolve('scripts/house-specs/generated', code);
  const envs: Envelope[] = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const hands = handSpecs(new Set(envs.map(e => e.pandId)));
  const joined = envs.filter(e => hands.has(e.pandId)).map(e => ({ env: e, hand: hands.get(e.pandId)!, writers: e.writers, merged: e.spec }));
  const byKind = [...hands.values()].reduce((m: Record<string, number>, h) => ((m[h.handKind] = (m[h.handKind] ?? 0) + 1), m), {});
  const tiers = joined.reduce((m: Record<string, number>, p) => { const t = p.env.crop?.tier ?? 'no crop'; m[t] = (m[t] ?? 0) + 1; return m; }, {});
  console.log(`${code}: ${envs.length} generated specs; ${hands.size} hand pands (${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(', ')}); crop tiers of the hand pands: ${Object.entries(tiers).map(([k, n]) => `${k} ${n}`).join(', ')}`);
  console.log('NOTE: auto-placed block-face intents are type-library placements (gable, bays, colour from the type), not photo readings; the authored subset is the stricter truth.\n');
  const sets: [string, typeof joined][] = [['all hand pands', joined], ['authored only (recipe intents, authored faces)', joined.filter(p => !/auto-placed/.test((p.hand as any).handKind))], ['good-tier crops only', joined.filter(p => p.env.crop?.tier === 'good')]];
  const t = tabulate(joined);
  const tables: Record<string, ReturnType<typeof tabulate>> = {};
  for (const [name, set] of sets) { console.log(`### ${name} (${set.length} pands)`); const tt = tabulate(set); tables[name] = tt; printTable(tt); console.log(); }
  // Cross-check: the register (monument-text) as the reference for the pands it lists; only the Jev, pixel and bag columns carry information.
  const reg = envs.filter(e => e.writers.register).map(e => ({ hand: e.writers.register!, writers: e.writers, merged: e.spec }));
  console.log(`### register as reference (${reg.length} listed pands; the register column agrees with itself)`);
  const rt = tabulate(reg); tables['register as reference'] = rt; printTable(rt); console.log();
  const w = worst(envs, hands, Number(opt('worst') ?? 12));
  console.log(`\nworst ${w.length} disagreements:`);
  for (const x of w) console.log(`  ${x.pandId} ${x.field}: ${x.kind === 'hand' ? `hand ${JSON.stringify(x.hand)} vs merged ${JSON.stringify(x.merged)} (conf ${x.confidence})` : x.values!.map(v => `${v.writer} ${JSON.stringify(v.value)} (${v.confidence})`).join(' vs ')}`);
  const out = opt('out'); if (out) fs.writeFileSync(out, JSON.stringify({ code, tables, worst: w, handKinds: byKind, tiers }, null, 1) + '\n');
}
if (process.argv[1]?.endsWith('house-specs/agreement.ts')) await main();
