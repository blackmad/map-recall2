// Describer D1 twin truth v2, source 2: "similar" party-wall pairs (lane PR1, scripts/house-line/structure/neighbours.ts on
// lane/structure-priors-20261113), kept only where both pands' hand readings agree on every structure field.
//
// Copied from PR1 (not imported, the branch is not merged): party walls = footprints sharing >= PARTY_MIN_M of boundary
// within PARTY_TOL_M (sharedM); similar = built within 3 years, street-run width within 0.3 m, exposed height within 0.8 m,
// from PR1's probe records (year, drawn.runM, drawn.exposedM, footprint ring; artifacts/structure-priors/probe-cache.json).
// Readings (PR1 dataset.ts, trimmed to the structure fields): benchmark-v1 labels, hand set v1, then author hand specs
// whose fields carry a read provenance (author, reviewed, streetlevel-measured, vision-judge; never default/register).
// A pair compares within one source (vocabularies differ), the first source both pands carry, in that order.
import fs from 'node:fs';
import path from 'node:path';
import { frontBays } from '../../../src/canalRecall/houseSpec/spec.ts';

export const PARTY_MIN_M = 2, PARTY_TOL_M = 0.35;
export const SIMILAR = { yearY: 3, widthM: 0.3, heightM: 0.8 };
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;

export type Probe = { pandId: string; year: number | null; at?: [number, number]; ring?: number[][]; drawn?: { runM: number; exposedM: number } | null };
export type Reading = { pandId: string; source: 'benchmark' | 'hand-set' | 'spec'; storeys?: number; columns?: number; windowKind?: string; windowHead?: string; bands?: boolean; surrounds?: boolean; crown?: string; finish?: string };
/** Structure fields (PR1 FIELDS without tone and storeyH: colour may differ between twins; storey height is not read). */
export const STRUCTURE = ['storeys', 'columns', 'windowKind', 'windowHead', 'bands', 'surrounds', 'crown', 'finish'] as const;
/** A pair is "clearly different" when one of these differs. */
export const CORE = ['storeys', 'columns', 'crown'] as const;

/** Boundary length of `a` within PARTY_TOL_M of `b` (metres, sampled every 0.25 m; lng/lat rings). PR1 sharedM. */
export function sharedM(a: number[][], b: number[][], origin: readonly [number, number]): number {
  const xy = (q: number[]) => [(q[0] - origin[0]) * KX, (q[1] - origin[1]) * KY];
  const A = a.map(xy), B = b.map(xy);
  const dist = (p: number[]) => {
    let best = Infinity;
    for (let i = 0; i + 1 < B.length; i++) {
      const [x0, y0] = B[i], [x1, y1] = B[i + 1], dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy;
      const t = l ? Math.max(0, Math.min(1, ((p[0] - x0) * dx + (p[1] - y0) * dy) / l)) : 0;
      best = Math.min(best, Math.hypot(p[0] - x0 - t * dx, p[1] - y0 - t * dy));
    }
    return best;
  };
  let shared = 0;
  for (let i = 0; i + 1 < A.length; i++) {
    const len = Math.hypot(A[i + 1][0] - A[i][0], A[i + 1][1] - A[i][1]), n = Math.max(1, Math.ceil(len / 0.25));
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; if (dist([A[i][0] + t * (A[i + 1][0] - A[i][0]), A[i][1] + t * (A[i + 1][1] - A[i][1])]) <= PARTY_TOL_M) shared += len / n; }
  }
  return shared;
}

/** PR1 `similar`: year within 3, drawn street-run width within 0.3 m and exposed height within 0.8 m. */
export function similar(pa: Probe, pb: Probe): boolean {
  return pa.year !== null && pb.year !== null && Math.abs(pa.year - pb.year) <= SIMILAR.yearY
    && !!pa.drawn && !!pb.drawn && Math.abs(pa.drawn.runM - pb.drawn.runM) <= SIMILAR.widthM && Math.abs(pa.drawn.exposedM - pb.drawn.exposedM) <= SIMILAR.heightM;
}

/** Same-source comparison: 'same' when every structure field both carry agrees and the core fields are all carried;
 *  'different' when a core field differs; null otherwise (too little read to say). */
export function labelVerdict(a: Reading, b: Reading): 'same' | 'different' | null {
  if (a.source !== b.source) return null;
  if (CORE.some(f => a[f] !== undefined && b[f] !== undefined && a[f] !== b[f])) return 'different';
  if (!CORE.every(f => a[f] !== undefined && b[f] !== undefined)) return null;
  return STRUCTURE.every(f => a[f] === undefined || b[f] === undefined || a[f] === b[f]) ? 'same' : null;
}

/** PR1 labels.ts upperColumns: the modal column count of the upper storeys. */
export function upperColumns(columns: readonly number[] | undefined): number | undefined {
  if (!columns || columns.length < 2) return undefined;
  const up = columns.slice(1).filter(n => Number.isInteger(n) && n > 0);
  if (!up.length) return undefined;
  const count = new Map<number, number>();
  for (const n of up) count.set(n, (count.get(n) ?? 0) + 1);
  let best = up[up.length - 1], bestN = 0;
  for (const n of [...up].reverse()) if ((count.get(n) ?? 0) > bestN) { best = n; bestN = count.get(n)!; }
  return best;
}

const known = (v: unknown) => (typeof v === 'string' && v !== 'unknown' && v !== 'not-visible' ? v : undefined);

export function benchmarkReadings(root: string): Reading[] {
  const d = JSON.parse(fs.readFileSync(path.join(root, 'scripts/house-line/benchmark/benchmark-v1.json'), 'utf8'));
  return (d.pands as any[]).filter(p => p.readable && p.labels && p.labels.oneFront !== false).map(p => {
    const l = p.labels, w = l.whiteAccents ?? {};
    return {
      pandId: String(p.pandId), source: 'benchmark' as const, storeys: Number.isInteger(l.storeys) ? l.storeys : undefined, columns: upperColumns(l.columns),
      windowKind: known(l.windowKind), windowHead: known(l.windowHead), bands: typeof w.bands === 'boolean' ? w.bands : undefined,
      surrounds: typeof w.surrounds === 'boolean' ? w.surrounds : undefined, crown: known(l.crown) === 'other' ? undefined : known(l.crown), finish: known(l.finish),
    };
  });
}

export function handSetReadings(root: string): Reading[] {
  const d = JSON.parse(fs.readFileSync(path.join(root, 'data/house-line/hand-set-v1.json'), 'utf8'));
  return (d.pands as any[]).filter(p => p.readable && p.extent !== 'multi').map(p => {
    const v = (k: string) => p.fields?.[k]?.value;
    const n = (k: string) => (Number.isInteger(v(k)) ? v(k) : undefined);
    return { pandId: String(p.pandId), source: 'hand-set' as const, storeys: n('storeys'), columns: n('axes'), crown: known(v('gable')), finish: known(v('finish')) };
  });
}

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

/** PR1 specReadings: belt, pilot and hand specs, read-provenance fields only; a spec with none of storeys/bays/gable read is skipped. */
export function specReadings(root: string): Reading[] {
  const base = path.join(root, 'scripts/house-specs');
  const dirs = ['specs', 'pilot-20261110/specs', ...fs.readdirSync(base).filter(d => d.startsWith('belt')).map(d => `${d}/specs`)];
  const out = new Map<string, Reading>();
  for (const d of dirs) {
    const abs = path.join(base, d);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter(x => x.endsWith('.json')).sort()) {
      const s = JSON.parse(fs.readFileSync(path.join(abs, f), 'utf8'));
      if (!s.pandId || !s.design || (s.design.fronts?.length ?? 0) !== 1) continue;
      const prov = s.provenance ?? {}, whole = prov['']?.source;
      const srcOf = (k: string) => prov[`fronts/0/${k}`]?.source ?? prov[`palette/${k}`]?.source ?? prov[k]?.source ?? whole;
      const ok = (k: string) => { const s2 = srcOf(k); return s2 === undefined ? true : READ_SOURCES.has(s2); };
      const fr = s.design.fronts[0], pal = s.design.palette ?? {};
      if (!['storeys', 'bays', 'gable'].some(k => fr[k] !== undefined && ok(k))) continue;
      const r: Reading = { pandId: String(s.pandId), source: 'spec' };
      if (ok('storeys') && Number.isInteger(fr.storeys) && fr.storeys > 0) r.storeys = fr.storeys;
      if (ok('bays')) r.columns = frontBays(fr);
      if (ok('windows')) { const k = windowKindOf(fr.windows); if (k) { r.windowKind = k; r.windowHead = headOf(fr); } }
      if (ok('bands')) r.bands = (typeof fr.bands === 'string' && fr.bands !== 'none') || (!!fr.speklagen && typeof fr.speklagen === 'object');
      if (ok('windowSurround')) r.surrounds = typeof fr.windowSurround === 'string' && !['sill', 'none'].includes(fr.windowSurround);
      if (ok('gable') && typeof fr.gable === 'string') r.crown = fr.gable;
      if (ok('wallMaterial') && typeof pal.wallMaterial === 'string') r.finish = pal.wallMaterial === 'stucco' ? 'render' : pal.wallMaterial;
      out.set(r.pandId, r);
    }
  }
  return [...out.values()];
}

export type PartyPair = { a: string; b: string; source: Reading['source']; similar: boolean; sharedM: number; verdict: 'same' | 'different' };
/** Party-wall pairs among `ids` (probe footprints) with a same-source label verdict. */
export function labelledPartyPairs(ids: string[], probes: Map<string, Probe>, readings: Map<string, Reading[]>): PartyPair[] {
  const items = ids.map(id => probes.get(id)).filter((p): p is Probe => !!p?.ring?.length && !!p.at);
  const out: PartyPair[] = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const pa = items[i], pb = items[j];
    if (Math.abs(pa.at![0] - pb.at![0]) * KX > 60 || Math.abs(pa.at![1] - pb.at![1]) * KY > 60) continue;
    const s = sharedM(pa.ring!, pb.ring!, pa.at!);
    if (s < PARTY_MIN_M) continue;
    const ra = readings.get(pa.pandId) ?? [], rb = readings.get(pb.pandId) ?? [];
    const src = (['benchmark', 'hand-set', 'spec'] as const).find(k => ra.some(r => r.source === k) && rb.some(r => r.source === k));
    if (!src) continue;
    const v = labelVerdict(ra.find(r => r.source === src)!, rb.find(r => r.source === src)!);
    if (v) out.push({ a: pa.pandId, b: pb.pandId, source: src, similar: similar(pa, pb), sharedM: +s.toFixed(2), verdict: v });
  }
  return out;
}
