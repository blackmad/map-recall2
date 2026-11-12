#!/usr/bin/env tsx
/**
 * Turn tree-silhouette-survey.ts reports into the measured priors of `?treeShape=1`
 * (src/canalRecall/trees/treeShapeMeasured.ts).
 */
const HELP = `tree-shape-priors: survey.json reports → src/canalRecall/trees/treeShapeMeasured.ts

  npx tsx scripts/trees/tree-shape-priors.ts SURVEY.json [MORE.json ...] [--write]

  - Species width/height: the panorama median when >= 3 trees were measured (the photo is the acceptance bar);
    otherwise the leaf-on orthophoto median times the panorama/ortho ratio over species with both (>= 8 ortho trees).
  - Archetype width/height: the median of its measured species.
  - Crown base by height class: panorama medians (uncensored), held flat from 12 m up (street clearance).
  - Species base factor: its uncensored panorama base over its classes' base, kept when >= 3 trees and outside ±15 %.
  - Archetype corrections: ARCHETYPE_FIXES below, each with its evidence.
  Without --write it prints the table.`;
import fs from 'node:fs';
import path from 'node:path';
// @ts-expect-error Shared inventory typology is a browser JS module.
import { treeTypology } from '../../public/canal-drive/da-costa-block/tree-typology.js';
import { heightClassRange } from '../../src/canalRecall/trees/treeShape';

const args = process.argv.slice(2);
if (args.includes('--help') || !args.some(a => a.endsWith('.json'))) { console.log(HELP); process.exit(0); }
const ROOT = path.resolve(import.meta.dirname, '../..');

/** Priors the photos contradict. Evidence: survey outline votes + the frames in the T-shape sheet (#371). */
const ARCHETYPE_FIXES: Record<string, { archetype: string; evidence: string }> = {
  "populus canadensis 'robusta'": { archetype: 'airy-oval', evidence: 'panorama outlines rounded/ovoid, W/H ~0.75, crown base ~3 m; nursery "pyramidal" describes young trees (user 2026-11-10, Piet Kranenbergpad)' },
  'populus canadensis': { archetype: 'airy-oval', evidence: 'the same hybrid poplar without a cultivar; panorama outlines ovoid/rounded 5 of 8, W/H 0.45 (survey-pyramidal.json); the fallback was rounded' },
};

interface Rec { species: string; heightClass: string; base: number; baseCensored: boolean; widthRatio: number; widthCapped: boolean; }
interface Summary { species: string; photo: { n: number; widthRatio: number | null }; canopy: { n: number; widthRatio: number | null } }
const reports = args.filter(a => a.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const records: Rec[] = reports.flatMap(r => r.records);
const summary = new Map<string, Summary>();
for (const r of reports) for (const s of r.summary as Summary[]) if (!summary.has(s.species) || s.photo.n > summary.get(s.species)!.photo.n) summary.set(s.species, s);
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b), k = s.length >> 1; return s.length ? (s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2) : NaN; };
const r3 = (v: number) => +v.toFixed(3);

// Crown base by class (lower bound of the class range).
const byClass = new Map<number, number[]>();
for (const r of records) { const c = heightClassRange(r.heightClass); if (c && !r.baseCensored) (byClass.get(c[0]) ?? byClass.set(c[0], []).get(c[0])!).push(r.base); }
const crownBaseByClass: Record<string, number> = {};
let flat = NaN;
for (const k of [...byClass.keys()].sort((a, b) => a - b)) {
  const m = median(byClass.get(k)!);
  if (k >= 12) { if (Number.isNaN(flat)) flat = median([...byClass].filter(([c]) => c >= 12).flatMap(([, v]) => v)); crownBaseByClass[k] = r3(flat); }
  else crownBaseByClass[k] = r3(m);
}
const classBase = (hc: string) => { const c = heightClassRange(hc); return c ? crownBaseByClass[c[0]] : NaN; };

// Species width ratios.
const both = [...summary.values()].filter(s => s.photo.n >= 3 && s.canopy.n >= 8 && s.photo.widthRatio && s.canopy.widthRatio);
const k = median(both.map(s => s.photo.widthRatio! / s.canopy.widthRatio!));
const speciesWidthRatio: Record<string, number> = {}, source: Record<string, string> = {};
for (const s of summary.values()) {
  if (s.photo.n >= 3 && s.photo.widthRatio) { speciesWidthRatio[s.species] = r3(s.photo.widthRatio); source[s.species] = `panorama n=${s.photo.n}`; }
  else if (s.canopy.n >= 8 && s.canopy.widthRatio) { speciesWidthRatio[s.species] = r3(s.canopy.widthRatio * k); source[s.species] = `ortho n=${s.canopy.n} × ${k.toFixed(2)}`; }
}
// Archetype medians (after the fixes).
const archOf = (sp: string) => ARCHETYPE_FIXES[sp]?.archetype ?? treeTypology({ id: 1, position: [0, 0], height: 12, heightClass: 'c. 9 tot 12 m.', species: sp, type: 'Boom niet vrij uitgroeiend' })?.archetype;
const perArch = new Map<string, number[]>();
for (const [sp, w] of Object.entries(speciesWidthRatio)) { const a = archOf(sp); if (a) (perArch.get(a) ?? perArch.set(a, []).get(a)!).push(w); }
const widthRatio: Record<string, number> = {};
for (const [a, v] of perArch) widthRatio[a] = r3(median(v));

// Species base factors.
const speciesBaseFactor: Record<string, number> = {};
for (const sp of summary.keys()) {
  const rs = records.filter(r => r.species === sp && !r.baseCensored && Number.isFinite(classBase(r.heightClass)));
  if (rs.length < 3) continue;
  const f = median(rs.map(r => r.base / classBase(r.heightClass)));
  if (Math.abs(f - 1) > 0.15) speciesBaseFactor[sp] = r3(Math.min(1.6, Math.max(0.5, f)));
}

const table = { speciesArchetype: ARCHETYPE_FIXES, widthRatio, speciesWidthRatio, crownBaseByClass, speciesBaseFactor };
const body = `/**
 * Measured crown priors for \`?treeShape=1\` (lane T-shape #371). GENERATED by scripts/trees/tree-shape-priors.ts from
 * ${args.filter(a => a.endsWith('.json')).map(f => path.relative(ROOT, path.resolve(f))).join(', ')}; do not edit by hand.
 * Width sources: ${Object.entries(source).map(([s, v]) => `${s}: ${v}`).join('; ')}.
 */
export interface TreeShapeMeasured {
  /** Archetype corrections: the inventory prior contradicted by the panoramas. */
  speciesArchetype: Record<string, { archetype: string; evidence: string }>;
  /** Crown width / tree height, by archetype (median of the measured species in it). */
  widthRatio: Record<string, number>;
  /** Crown width / tree height per measured species. */
  speciesWidthRatio: Record<string, number>;
  /** Crown base (m) by the lower bound of the inventory height class. */
  crownBaseByClass: Record<string, number>;
  /** Species crown base relative to its class's base. */
  speciesBaseFactor: Record<string, number>;
}

export const TREE_SHAPE_MEASURED: TreeShapeMeasured = ${JSON.stringify(table, null, 2)};
`;
if (args.includes('--write')) { fs.writeFileSync(path.join(ROOT, 'src/canalRecall/trees/treeShapeMeasured.ts'), body); console.log('wrote src/canalRecall/trees/treeShapeMeasured.ts'); }
else console.log(body);
console.error(`panorama/ortho width ratio k=${k.toFixed(3)} over ${both.length} species`);
