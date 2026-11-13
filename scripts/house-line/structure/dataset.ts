/**
 * Lane PR1: the structure readings the priors are fitted on and the neighbour table is measured on, in one shape.
 *
 * Sources (docs/house-line.md):
 *  - block-face houses: every house of scripts/block-face/faces/<run>/intent.json (runs starting `_` are demos), through
 *    the game's own adapter (houseSpec/adapters.ts fromBlockFace). A pand in several runs takes the last run in name
 *    order (`-r2` after `-r1` after the first run). `typed` = placed as a building type (auto-place / type id), whose
 *    fields are the type's, not a read of this front.
 *  - belt, pilot and hand specs: scripts/house-specs/{specs,belt*\/specs,pilot-20261110/specs}/*.json; a field counts
 *    only when its provenance is a read (author, reviewed, streetlevel-measured, vision-judge), never `default` or
 *    `register`; a spec with none of storeys, bays or gable from a read is skipped (register-only).
 *  - the facade benchmark's hand labels (benchmark-v1.json), for the neighbour table only (held out of every fit).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fromBlockFace } from '../../../src/canalRecall/houseSpec/adapters.ts';
import { validateBlockFace } from '../../../src/canalRecall/blockFace/intent.ts';
import { upperColumns } from './labels.ts';

export type Source = 'face-design' | 'face-type' | 'spec' | 'benchmark';
/** Normalised structure fields. Vocabularies differ between the intent world and the benchmark labels: compare a field
 *  only between two records of the same `vocab`. */
export type Reading = {
  pandId: string; source: Source; vocab: 'intent' | 'label'; run?: string; typeId?: string;
  storeys?: number; columns?: number; storeyH?: number; windowKind?: string; windowHead?: string;
  bands?: boolean; surrounds?: boolean; crown?: string; finish?: string; tone?: string; toneHex?: string;
  oneFront?: boolean;
};
export const FIELDS = ['storeys', 'columns', 'storeyH', 'windowKind', 'windowHead', 'bands', 'surrounds', 'crown', 'finish', 'tone'] as const;
export type Field = typeof FIELDS[number];

const READ_SOURCES = new Set(['author', 'reviewed', 'streetlevel-measured', 'vision-judge']);

const windowKindOf = (w: unknown): string | undefined => {
  if (typeof w !== 'string') return undefined;
  if (w.startsWith('sash') || w === 'arched') return 'sash';
  if (w.startsWith('casement') || w === 'cross' || w === 'two-light' || w === 'six-pane') return 'casement';
  if (w === 't-window') return 'T-window';
  if (w === 'ladder' || w === 'plain' || w === 'ribbon' || w === 'large-pane') return 'large-pane';
  return 'other';
};
const headOf = (f: Record<string, any>): string => {
  const h = f.windowHead;
  if (h && typeof h === 'object' && typeof h.kind === 'string') return h.kind === 'relieving' ? 'segmental' : h.kind;
  if (typeof h === 'string') return h;
  if (f.windows === 'arched' || (Array.isArray(f.archedStoreys) && f.archedStoreys.length)) return 'round';
  if (f.archRings) return 'segmental';
  return 'flat';
};
const bandsOf = (f: Record<string, any>) => (typeof f.bands === 'string' && f.bands !== 'none') || (!!f.speklagen && typeof f.speklagen === 'object');
const surroundsOf = (f: Record<string, any>) => typeof f.windowSurround === 'string' && !['sill', 'none'].includes(f.windowSurround);
const finishOf = (m: unknown) => m === 'stucco' ? 'render' : typeof m === 'string' ? m : undefined;
const upperMean = (h: unknown): number | undefined => {
  if (!Array.isArray(h) || h.length < 2) return undefined;
  const up = h.slice(1).filter(x => typeof x === 'number' && x > 1.5 && x < 6);
  return up.length ? +(up.reduce((s, x) => s + x, 0) / up.length).toFixed(2) : undefined;
};
const columnsOf = (b: unknown): number | undefined => typeof b === 'number' && b > 0 ? b : Array.isArray(b) ? upperColumns(b as number[]) ?? undefined : undefined;

function fromDesign(pandId: string, source: Source, design: any, ok: (field: string) => boolean): Reading {
  const f = (design?.fronts ?? [{}])[0] ?? {}, pal = design?.palette ?? {};
  const r: Reading = { pandId, source, vocab: 'intent' };
  if (ok('storeys') && Number.isInteger(f.storeys) && f.storeys > 0) r.storeys = f.storeys;
  if (ok('bays')) { const c = columnsOf(f.bays); if (c) r.columns = c; }
  if (ok('storeyHeights')) { const h = upperMean(f.storeyHeights); if (h) r.storeyH = h; }
  if (ok('windows')) { const k = windowKindOf(f.windows); if (k) { r.windowKind = k; r.windowHead = headOf(f); } }
  if (ok('bands')) r.bands = bandsOf(f);
  if (ok('windowSurround')) r.surrounds = surroundsOf(f);
  if (ok('gable') && typeof f.gable === 'string') r.crown = f.gable;
  if (ok('wallMaterial')) { const m = finishOf(pal.wallMaterial); if (m) r.finish = m; }
  if (ok('brick') && typeof pal.brick === 'string' && /^#[0-9a-f]{6}$/i.test(pal.brick)) r.toneHex = pal.brick.toLowerCase();
  return r;
}

export function faceReadings(root: string): Reading[] {
  const dir = path.join(root, 'scripts/block-face/faces'), byPand = new Map<string, Reading>();
  for (const id of fs.readdirSync(dir).sort()) {
    if (id.startsWith('_')) continue;
    const file = path.join(dir, id, 'intent.json');
    if (!fs.existsSync(file)) continue;
    let face;
    try { face = validateBlockFace(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { continue; }
    for (const h of face.houses) {
      let spec;
      try { spec = fromBlockFace(face, h.pandId, path.join(dir, id, 'strip.json')); } catch { spec = null; }
      if (!spec) continue;
      const typed = !!(h as any).type, r = fromDesign(h.pandId, typed ? 'face-type' : 'face-design', spec.design, () => true);
      r.run = id; if (typed) r.typeId = (h as any).type.type;
      // A face house without an explicit wallMaterial reads as brick only when it says nothing else; leave it unset.
      byPand.set(h.pandId, r);
    }
  }
  return [...byPand.values()];
}

export function specReadings(root: string): Reading[] {
  const dirs = ['scripts/house-specs/specs', 'scripts/house-specs/pilot-20261110/specs', ...fs.readdirSync(path.join(root, 'scripts/house-specs')).filter(d => d.startsWith('belt')).map(d => `scripts/house-specs/${d}/specs`)];
  const out = new Map<string, Reading>();
  for (const d of dirs) {
    const abs = path.join(root, d);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter(x => x.endsWith('.json')).sort()) {
      const s = JSON.parse(fs.readFileSync(path.join(abs, f), 'utf8'));
      if (!s.pandId || !s.design) continue;
      const prov = s.provenance ?? {};
      const whole = prov['']?.source;
      const srcOf = (k: string) => prov[`fronts/0/${k}`]?.source ?? prov[`palette/${k}`]?.source ?? prov[k]?.source ?? whole;
      // A field with no provenance at all counts as the author's (hand specs written without a provenance map).
      const ok = (k: string) => { const s2 = srcOf(k); return s2 === undefined ? true : READ_SOURCES.has(s2); };
      if (!['storeys', 'bays', 'gable'].some(k => (s.design.fronts?.[0]?.[k] !== undefined) && ok(k))) continue;
      const r = fromDesign(String(s.pandId), 'spec', s.design, ok);
      r.run = d;
      out.set(r.pandId, r);
    }
  }
  return [...out.values()];
}

export function benchmarkReadings(root: string, file = 'scripts/house-line/benchmark/benchmark-v1.json'): Reading[] {
  const d = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  return (d.pands as any[]).filter(p => p.readable && p.labels).map(p => {
    const l = p.labels, w = l.whiteAccents ?? {};
    const r: Reading = { pandId: String(p.pandId), source: 'benchmark', vocab: 'label', run: p.group, oneFront: l.oneFront !== false };
    const known = (v: unknown) => typeof v === 'string' && v !== 'unknown' ? v : undefined;
    if (Number.isInteger(l.storeys)) r.storeys = l.storeys;
    const c = upperColumns(l.columns); if (c) r.columns = c;
    r.windowKind = known(l.windowKind); r.windowHead = known(l.windowHead);
    if (typeof w.bands === 'boolean') r.bands = w.bands;
    if (typeof w.surrounds === 'boolean') r.surrounds = w.surrounds;
    r.crown = known(l.crown) === 'other' ? undefined : known(l.crown);
    r.finish = known(l.finish);
    if (l.wallTone?.family && l.wallTone?.darkness) r.tone = `${l.wallTone.family}/${l.wallTone.darkness}`;
    return r;
  });
}

// --- OKLab for the tone comparison ------------------------------------------------------------------------------------
const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function oklab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
/** Two hex walls agree when their OKLab distance is under this (about one wall-colour benchmark step). */
export const TONE_DE = 0.05;
/** Two upper storey heights agree within this (m). */
export const STOREY_H_TOL = 0.25;
export function agree(field: Field, a: Reading, b: Reading): boolean | null {
  if (a.vocab !== b.vocab) return null;
  if (field === 'tone') {
    if (a.tone !== undefined && b.tone !== undefined) return a.tone === b.tone;
    if (a.toneHex && b.toneHex) { const p = oklab(a.toneHex), q = oklab(b.toneHex); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < TONE_DE; }
    return null;
  }
  const x = a[field], y = b[field];
  if (x === undefined || y === undefined) return null;
  if (field === 'storeyH') return Math.abs((x as number) - (y as number)) <= STOREY_H_TOL;
  return x === y;
}
