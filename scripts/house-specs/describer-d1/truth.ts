// Describer D1 truth: the three truth sets normalised to describerScore.ts `Reading`s.
//   benchmark  scripts/house-line/benchmark/benchmark-v1.json labels (read from the round-0 pose photo, labels.md convention)
//   hand-set   data/house-line/hand-set-v1.json reader A (docs/house-line.md §4c convention, read from the describe crops)
//   hand-spec  author-written HouseSpecs under scripts/house-specs/ (belt lanes, pilot, specs/); only fields whose receipt is
//              `author` or `reviewed`. Absent intent keys read as the intent default where the recipe draws that default
//              (bands none, shopfront none, basement none); windowHead only when stated (an absent head is not a reading).
import fs from 'node:fs';
import path from 'node:path';
import { frontBays, provenanceOf, type HouseSpec } from '../../../src/canalRecall/houseSpec/spec.ts';
import { hasSurround, windowFamily, type Reading } from '../../../src/canalRecall/houseSpec/describerScore.ts';

const json = <T = any>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8'));

/** Every author-written spec file under scripts/house-specs (not generated/; a spec whose receipts are all register/measured/default is skipped). */
export function handSpecFiles(root: string): { file: string; spec: HouseSpec }[] {
  const base = path.join(root, 'scripts/house-specs'), out: { file: string; spec: HouseSpec }[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'generated' && e.name !== 'node_modules') walk(p); continue; }
      if (!e.name.endsWith('.json')) continue;
      let s: any; try { s = json(p); } catch { continue; }
      if (s?.schemaVersion !== 1 || !s.design || !s.pandId) continue;
      if (!Object.values<any>(s.provenance ?? {}).some(v => v?.source === 'author' || v?.source === 'reviewed')) continue;
      out.push({ file: p, spec: s });
    }
  };
  walk(base);
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

const WALL_BENCH: Record<string, string[]> = {
  'red-brown': ['red-brown'], 'dark-brown': ['brown', 'dark'], 'orange-red': ['orange', 'red'], grey: ['grey'],
  'near-black': ['dark'], 'white-cream': ['white'], 'yellow-buff': ['buff'],
};

/** A benchmark-v1 label record as a Reading. */
export function benchmarkReading(p: any): Reading {
  const L = p.labels ?? {}, r: Reading = { pandId: p.pandId, scorable: !!p.readable };
  if (!p.readable) return r;
  const known = (v: unknown) => v !== undefined && v !== null && v !== 'unknown';
  if (known(L.storeys)) r.storeys = L.storeys;
  if (Array.isArray(L.columns) && L.columns.length > 1) r.bays = Math.max(...L.columns.slice(1));
  if (['sash', 'T-window', 'casement', 'large-pane'].includes(L.windowKind)) r.windowFamily = L.windowKind;
  if (known(L.windowHead)) r.head = L.windowHead;
  if (L.whiteAccents) { r.bands = !!L.whiteAccents.bands; r.surrounds = !!(L.whiteAccents.surrounds || L.whiteAccents.keystones); }
  if (known(L.doorBay)) r.doorBay = L.doorBay;
  if (typeof L.shopfront === 'boolean') r.shop = L.shopfront;
  if (known(L.crown) && L.crown !== 'other') r.crown = L.crown;
  if (L.cornice === 'timber' || L.cornice === 'stone') r.cornice = ['simple', 'bracketed', 'heavy', 'frieze'];
  else if (L.cornice === 'parapet' || L.cornice === 'none') r.cornice = ['none'];
  if (L.wallTone?.family && WALL_BENCH[L.wallTone.family]) r.wallFamily = WALL_BENCH[L.wallTone.family];
  if (L.finish === 'render') r.finish = 'stucco'; else if (['brick', 'painted-brick', 'stone'].includes(L.finish)) r.finish = L.finish;
  return r;
}

/** A hand set v1 record (reader A) as a Reading. */
export function handSetReading(p: any): Reading {
  const r: Reading = { pandId: p.pandId, scorable: !!p.readable && p.extent !== 'multi' };
  const f = p.fields ?? {}, v = (k: string) => { const x = f[k]?.value; return x === undefined || x === null || x === 'unknown' ? undefined : x; };
  if (v('axes') !== undefined) r.bays = v('axes');
  if (v('storeys') !== undefined) r.storeys = v('storeys');
  if (v('gable') !== undefined) r.crown = v('gable');
  if (v('finish') !== undefined) r.finish = v('finish');
  if (v('wall') !== undefined) r.wallFamily = v('wall');
  if (v('pui') !== undefined) r.shop = v('pui') === 'shop';
  return r;
}

/** Door position words for an index into `n` ground openings (intent doorBay). */
export function doorPosition(index: number | null | undefined, n: number | undefined, several = false): string | undefined {
  if (several) return 'several';
  if (index === null) return 'none';
  if (index === undefined || !n || n < 1) return undefined;
  if (n === 1) return 'centre';
  if (index <= 0) return 'left';
  if (index >= n - 1) return 'right';
  const mid = (n - 1) / 2;
  return Math.abs(index - mid) < 0.5 ? 'centre' : index < mid ? 'left' : 'right';
}

/** An author HouseSpec as a Reading (fields with an author/reviewed receipt only). */
export function handSpecReading(s: HouseSpec): Reading {
  const fronts = s.design.fronts ?? [], f0: any = fronts[0] ?? {};
  const r: Reading = { pandId: s.pandId, scorable: fronts.length === 1 };
  const own = (p: string) => { const src = provenanceOf(s, p)?.source; return src === 'author' || src === 'reviewed'; };
  const F = (k: string) => (own(`fronts/0/${k}`) ? f0[k] : undefined);
  if (F('storeys') !== undefined) r.storeys = F('storeys');
  if (own('fronts/0/bays') || own('fronts/0/axisGrid')) { const b = frontBays(f0); if (b) r.bays = b; }
  if (F('windows')) { r.windows = F('windows'); r.windowFamily = windowFamily(F('windows')); }
  if (F('windowHead')?.kind) r.head = F('windowHead').kind === 'relieving' ? 'flat' : F('windowHead').kind;
  if (own('fronts/0/gable')) {
    const bands = f0.bands && f0.bands !== 'none' ? f0.bands : f0.speklagen ? 'speklagen' : 'none';
    r.bands = bands !== 'none'; r.bandKind = bands;
  }
  if (F('windowSurround')) { r.windowSurround = F('windowSurround'); r.surrounds = hasSurround(F('windowSurround')); }
  if (F('windowSills') === 'consoles') r.sills = 'consoles'; else if (F('windowSurround') === 'sill') r.sills = ['stone', 'consoles'];
  if (own('fronts/0/doorBay') && 'doorBay' in f0) {
    const ground = Array.isArray(f0.bays) ? f0.bays[0] : f0.bays;
    const pos = doorPosition(f0.doorBay, ground, !!(f0.extraDoorBays?.length || f0.doorRow));
    if (pos) r.doorBay = pos;
  }
  if (own('fronts/0/gable')) r.shop = !!f0.shopfront || s.facts?.pui === 'shop';
  else if (s.facts?.pui) r.shop = s.facts.pui === 'shop';
  if (F('basement')) r.basement = F('basement') !== 'none' || !!f0.souterrain;
  if (F('gable')) r.crown = f0.roofFront === 'mansard' ? 'mansard' : F('gable');
  if (F('cornice')) r.cornice = F('cornice');
  if (s.facts?.wallFamily && own('facts/wallFamily')) r.wallFamily = s.facts.wallFamily;
  if (s.design.palette?.wallMaterial && own('palette/wallMaterial')) r.finish = s.design.palette.wallMaterial;
  return r;
}

/** Every truth Reading by pand and set (a pand may have several sets). */
export function loadTruth(root: string): Map<string, Map<string, Reading>> {
  const out = new Map<string, Map<string, Reading>>();
  const put = (set: string, r: Reading) => { const m = out.get(r.pandId) ?? out.set(r.pandId, new Map()).get(r.pandId)!; if (!m.has(set)) m.set(set, r); };
  for (const p of json(path.join(root, 'scripts/house-line/benchmark/benchmark-v1.json')).pands) put('benchmark', benchmarkReading(p));
  for (const p of json(path.join(root, 'data/house-line/hand-set-v1.json')).pands) put('hand-set', handSetReading(p));
  for (const { spec } of handSpecFiles(root)) put('hand-spec', handSpecReading(spec));
  return out;
}
