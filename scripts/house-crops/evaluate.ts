/**
 * Flag precision and recall against hand labels (H4b). Labels: scripts/house-crops/labels/<code>.json
 *   { "<pandId>": { "label": "good" | "marginal" | "bad", "panoIds": [...], "by": "...", "note"?: "..." } }
 * A label counts only while the crop is the one that was labelled (same panoIds as the current manifest entry).
 *   node --import tsx --test ... no; run: node --import tsx scripts/house-crops/evaluate.ts --buurt AB07 [--sweep]
 * Positive class = good. marginal counts as not good (a crop H5 should not trust).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { manifestPath, type Manifest } from './manifest.ts';
import { usability, THRESHOLDS } from './flags.ts';

export type Label = { label: 'good' | 'marginal' | 'bad'; panoIds: string[]; by?: string; note?: string };
export const labelsPath = (code: string) => path.resolve('scripts/house-crops/labels', `${code}.json`);

const wilson = (k: number, n: number) => { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), a = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - a) / d, (c + a) / d]; };
const pct = (v: number) => (100 * v).toFixed(1) + ' %';

export function evaluate(m: Manifest, labels: Record<string, Label>) {
  const rows = Object.entries(labels).flatMap(([id, l]) => {
    const e = m.pands[id];
    if (!e || e.status !== 'ok' || JSON.stringify(e.panoIds) !== JSON.stringify(l.panoIds)) return [];
    return [{ id, good: l.label === 'good', label: l.label, e, reasons: usability(e.flags!).reasons }];
  });
  const n = rows.length, good = rows.filter(r => r.good).length, usable = rows.filter(r => r.reasons.length === 0), tp = usable.filter(r => r.good).length;
  const out = [`labelled crops matching the current manifest: ${n} (good ${good}, marginal ${rows.filter(r => r.label === 'marginal').length}, bad ${rows.filter(r => r.label === 'bad').length})`,
    `true good rate (human): ${pct(good / n)}  95 % CI ${wilson(good, n).map(pct).join(' .. ')}`,
    `usable flag: ${usable.length} flagged usable (${pct(usable.length / n)}), precision for good ${pct(tp / Math.max(1, usable.length))} (${tp}/${usable.length}), recall ${pct(tp / Math.max(1, good))} (${tp}/${good})`, '',
    '| reject reason | fired | of which bad/marginal (precision as a defect detector) | bad/marginal caught (recall) | good thrown away |', '|---|---|---|---|---|'];
  const notGood = n - good;
  for (const reason of ['void', 'foliage', 'washed-out', 'occluder', 'oblique', 'distance', 'blocked', 'narrow', 'short', 'blank']) {
    const fired = rows.filter(r => r.reasons.includes(reason)), bad = fired.filter(r => !r.good).length;
    out.push(`| ${reason} | ${fired.length} | ${bad} (${pct(bad / Math.max(1, fired.length))}) | ${bad}/${notGood} (${pct(bad / Math.max(1, notGood))}) | ${fired.length - bad} |`);
  }
  return { n, good, usable: usable.length, tp, text: out.join('\n'), rows };
}

function quantile(v: number[], q: number) { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; }
export function sweep(rows: ReturnType<typeof evaluate>['rows']) {
  const out: string[] = ['| flag | good p10 / p50 / p90 | not-good p10 / p50 / p90 |', '|---|---|---|'];
  for (const k of ['foliage', 'foliagePlain', 'washedOut', 'voidShare', 'occluderShare', 'obliquity', 'cameraDistance', 'wallWidthM', 'heightCover', 'edgeDensity', 'seamStep'] as const) {
    const f = (g: boolean) => [0.1, 0.5, 0.9].map(q => quantile(rows.filter(r => r.good === g).map(r => (r.e.flags as any)[k] as number), q).toFixed(3)).join(' / ');
    out.push(`| ${k} | ${f(true)} | ${f(false)} |`);
  }
  return out.join('\n');
}

if (process.argv[1]?.endsWith('house-crops/evaluate.ts')) {
  const i = process.argv.indexOf('--buurt'), code = process.argv[i + 1];
  const m: Manifest = JSON.parse(await fs.readFile(manifestPath(code), 'utf8')), labels = JSON.parse(await fs.readFile(labelsPath(code), 'utf8'));
  const r = evaluate(m, labels);
  console.log(r.text);
  if (process.argv.includes('--sweep')) console.log('\n' + sweep(r.rows));
  console.log(`\nthresholds: ${JSON.stringify(THRESHOLDS)}`);
}
