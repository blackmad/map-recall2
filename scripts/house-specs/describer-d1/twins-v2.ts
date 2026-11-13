// Describer D1 twin truth v2 (prompt v2 `sameAs` / `mirrored`): twins known from design, not from hand specs agreeing.
//
//   node --import tsx scripts/house-specs/describer-d1/twins-v2.ts sample [--per-face 3] [--probe-cache <file>]
//   node --import tsx scripts/house-specs/describer-d1/twins.ts score --truth artifacts/describer-d1/twins-v2.json --answers <dir>
//
// Source 1, designed block faces (scripts/block-face/faces/<id>/intent.json, author not auto-place/review, no auto-place.json,
// not a `_demo`): two pands adjacent in the face's strip (strip.json spans, gap < 1 m) are twins when they share one module
// (the same house type id + crown, or one `sameAs` chain, or one `continuity.identical` group), their fronts as the game
// resolves them (houseSpec/adapters.ts fromBlockFace) agree on storeys, upper bays, gable, windows, head, cornice, dormers,
// bands, surround and balconies, neither pand carries several modules (a multi-front pand), and their strip widths agree
// within 0.5 m. Clearly different: storeys, upper bays, gable or window kind differ. Anything else is not scored (null).
// Mirrored: door indices symmetric on equal ground counts (twins.ts mirroredOf on the resolved fronts); null when the door
// is centred or unstated. Row image: the face's strip (archived block-face-strips/<id>/strip.jpg) cut at the spans.
//
// Source 2, lane PR1 party-wall pairs (partyPairs.ts): similar (year ±3, width ±0.3 m, height ±0.8 m) and every structure
// label agreeing = twin; a core label (storeys, columns, crown) differing = clearly different. Row image: archived pand
// crops (pand-crops/<id>/front.jpg), neighbours from crop walls as in twins.ts.
//
// Output: artifacts/describer-d1/twins-v2.json, twin-images-v2/<pandId>.jpg, twins-v2-ids.txt (one pandId per line).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { frontBays } from '../../../src/canalRecall/houseSpec/spec.ts';
import { fromBlockFace } from '../../../src/canalRecall/houseSpec/adapters.ts';
import { validateBlockFace } from '../../../src/canalRecall/blockFace/intent.ts';
import { adjacent, mirroredOf, sideOf } from './twins.ts';
import { benchmarkReadings, handSetReadings, labelledPartyPairs, specReadings, type Probe, type Reading } from './partyPairs.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const OUT = path.join(ROOT, 'artifacts/describer-d1');
const CACHE = path.join(OUT, 'cache/src');
const SOURCE_DATA = process.env.D1_SOURCE_DATA ?? '/Users/blackmad/Code/map-recall2-source-data';
const CROP_DIRS = [...(process.env.D1_CROP_DIRS ?? ['/Users/blackmad/Code/map-recall2-source-data-h5h', '/Users/blackmad/Code/map-recall2-source-data-belt-nieuwmarkt-build-20261110', '/Users/blackmad/Code/map-recall2-source-data-belt-burgwallen-oz-build-20261110'].join(':')).split(':'), CACHE];
const PROBE_CACHE = '/Users/blackmad/Code/map-recall2-worktrees/structure-priors-20261113/artifacts/structure-priors/probe-cache.json';

export type Verdict = boolean | null;
export type SideTruth = { id: string; twin: Verdict; why: string } | null;
export type TwinRowV2 = { pandId: string; source: 'block-face' | 'party-pair'; face?: string; left: SideTruth; right: SideTruth; mirrored: boolean | null; image: string };

// --- Source 1: designed block faces ------------------------------------------------------------------------------------
type FaceHouse = { pandId: string; module: string | null; multi: boolean; front: any; widthM: number; px: [number, number] };

/** The structure a describer can see on the upper front (no colour, no ground floor). */
export const upperKey = (f: any): string => JSON.stringify([f?.storeys, frontBays(f), f?.gable ?? null, f?.windows ?? null, f?.windowHead?.kind ?? f?.windowHead ?? null,
  f?.cornice ?? null, f?.dormers ?? null, f?.bands ?? null, f?.windowSurround ?? null, !!f?.balconies]);

/** Twin verdict for two adjacent designed-face houses (see the header). */
export function faceVerdict(a: Pick<FaceHouse, 'module' | 'multi' | 'front' | 'widthM'>, b: Pick<FaceHouse, 'module' | 'multi' | 'front' | 'widthM'>): { twin: Verdict; why: string } {
  const fa = a.front, fb = b.front;
  const diff = (['storeys', 'gable', 'windows'] as const).filter(k => fa?.[k] !== undefined && fb?.[k] !== undefined && fa[k] !== fb[k]);
  if (frontBays(fa) !== undefined && frontBays(fb) !== undefined && frontBays(fa) !== frontBays(fb)) diff.push('bays' as any);
  if (diff.length) return { twin: false, why: `differ: ${diff.join(', ')}` };
  if (a.multi || b.multi) return { twin: null, why: 'multi-front pand' };
  if (!a.module || a.module !== b.module) return { twin: null, why: 'different modules, same core' };
  if (upperKey(fa) !== upperKey(fb)) return { twin: null, why: 'same module, resolved fronts differ' };
  if (Math.abs(a.widthM - b.widthM) > 0.5) return { twin: null, why: 'same module, widths differ > 0.5 m' };
  return { twin: true, why: `module ${a.module}` };
}

/** Door asymmetry: mirroredOf on the resolved fronts, null when the door is centred (copy and mirror look alike) or unstated. */
export function faceMirrored(fa: any, fb: any): boolean | null {
  const n = Array.isArray(fa?.bays) ? fa.bays[0] : fa?.bays;
  if (Number.isInteger(fa?.doorBay) && Number.isInteger(n) && fa.doorBay * 2 === n - 1) return null;
  return mirroredOf(fa, fb) ?? null;
}

function designedFaces(): string[] {
  const dir = path.join(ROOT, 'scripts/block-face/faces');
  return fs.readdirSync(dir).sort().filter(id => {
    if (id.startsWith('_') || !fs.existsSync(path.join(dir, id, 'intent.json')) || fs.existsSync(path.join(dir, id, 'auto-place.json'))) return false;
    const a = JSON.parse(fs.readFileSync(path.join(dir, id, 'intent.json'), 'utf8')).authoring?.author ?? '';
    return !/^(auto-place|review)/.test(a);
  });
}

function stripFile(face: string): string | null {
  const f = path.join(CACHE, 'block-face-strips', face, 'strip.jpg');
  if (fs.existsSync(f)) return f;
  try {
    const buf = execFileSync('/usr/bin/git', ['-C', SOURCE_DATA, 'show', `origin/main:block-face-strips/${face}/strip.jpg`], { maxBuffer: 1 << 28 });
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); return f;
  } catch { return null; }
}

function faceRows(): { rows: TwinRowV2[]; strips: Map<string, { file: string; houses: Map<string, FaceHouse> }> } {
  const dir = path.join(ROOT, 'scripts/block-face/faces'), rows: TwinRowV2[] = [], strips = new Map<string, { file: string; houses: Map<string, FaceHouse> }>();
  for (const id of designedFaces()) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, id, 'intent.json'), 'utf8'));
    const strip = JSON.parse(fs.readFileSync(path.join(dir, id, 'strip.json'), 'utf8'));
    const file = stripFile(id);
    if (!file) { console.warn(`no strip image for ${id}`); continue; }
    let face; try { face = validateBlockFace(raw); } catch (e) { console.warn(`${id}: ${(e as Error).message.split('\n')[0]}`); continue; }
    const byId = new Map<string, any>(raw.houses.map((h: any) => [h.pandId, h]));
    const root = (pid: string): string => { let p = pid, n = 0; while (byId.get(p)?.sameAs && n++ < 10) p = byId.get(p).sameAs; return p; };
    const referenced = new Set(raw.houses.filter((h: any) => h.sameAs).map((h: any) => root(h.pandId)));
    const ident = new Map<string, string>();
    (raw.continuity?.identical ?? []).forEach((g: any, i: number) => g.pands.forEach((p: string) => ident.set(p, `${id}:identical-${i}`)));
    const moduleOf = (h: any): string | null => {
      if (h.type) return `type:${h.type.type}|crown:${h.type.crown ?? ''}|storeys:${h.type.storeys ?? ''}`;
      if (h.sameAs || referenced.has(h.pandId)) return `design:${id}:${root(h.pandId)}`;
      return ident.get(h.pandId) ?? null;
    };
    const houses = new Map<string, FaceHouse>();
    for (const s of strip.spans as any[]) {
      const h = byId.get(s.pandId); if (!h) continue;
      let spec; try { spec = fromBlockFace(face, s.pandId); } catch { spec = null; }
      const front = spec?.design.fronts?.[0]; if (!front) continue;
      const multi = (spec!.design.fronts!.length > 1) || (Array.isArray(h.type?.modules) && h.type.modules.length > 1) || (Array.isArray(h.modules) && h.modules.length > 1);
      houses.set(s.pandId, { pandId: s.pandId, module: moduleOf(h), multi, front, widthM: s.x1M - s.x0M, px: s.px });
    }
    strips.set(id, { file, houses });
    const spans = (strip.spans as any[]).filter(s => houses.has(s.pandId)).sort((a, b) => a.x0M - b.x0M);
    for (let i = 0; i < spans.length; i++) {
      const me = houses.get(spans[i].pandId)!;
      const side = (j: number): SideTruth => {
        const s = spans[j]; if (!s || Math.max(s.x0M - spans[i].x1M, spans[i].x0M - s.x1M) > 1) return null;
        const v = faceVerdict(me, houses.get(s.pandId)!); return { id: s.pandId, ...v };
      };
      const left = side(i - 1), right = side(i + 1);
      if (!left && !right) continue;
      const twins = [left, right].filter(x => x?.twin === true).map(x => houses.get(x!.id)!);
      const m = twins.map(t => faceMirrored(me.front, t.front)).filter(x => x !== null);
      rows.push({ pandId: me.pandId, source: 'block-face', face: id, left, right, mirrored: m.length ? m.some(Boolean) : null, image: path.join(OUT, 'twin-images-v2', `${me.pandId}.jpg`) });
    }
  }
  return { rows, strips };
}

// --- Source 2: PR1 party-wall pairs on archived crops ------------------------------------------------------------------
type Wall = { a: [number, number]; b: [number, number]; normal: [number, number] };
function cropDir(id: string): string | null { for (const d of CROP_DIRS) { const p = path.join(d, 'pand-crops', id); if (fs.existsSync(path.join(p, 'front.json')) && fs.existsSync(path.join(p, 'front.jpg'))) return p; } return null; }
function cropIds(): string[] { const s = new Set<string>(); for (const d of CROP_DIRS) { const p = path.join(d, 'pand-crops'); if (fs.existsSync(p)) for (const id of fs.readdirSync(p)) if (/^\d{16}$/.test(id) && cropDir(id)) s.add(id); } return [...s].sort(); }

function partyRows(probeCache: string): { rows: TwinRowV2[]; pairs: ReturnType<typeof labelledPartyPairs> } {
  const ids = cropIds();
  const walls = new Map<string, Wall>();
  for (const id of ids) { const w = JSON.parse(fs.readFileSync(path.join(cropDir(id)!, 'front.json'), 'utf8')).wall; if (w?.normal) walls.set(id, w); }
  const probesRaw = JSON.parse(fs.readFileSync(probeCache, 'utf8'));
  const probes = new Map<string, Probe>(Object.entries<any>(probesRaw).map(([k, v]) => [k, { pandId: k, year: v.year ?? null, at: v.at, ring: v.ring, drawn: v.drawn ?? null }]));
  const readings = new Map<string, Reading[]>();
  for (const r of [...benchmarkReadings(ROOT), ...handSetReadings(ROOT), ...specReadings(ROOT)]) readings.set(r.pandId, [...(readings.get(r.pandId) ?? []), r]);
  const pairs = labelledPartyPairs(ids.filter(i => walls.has(i)), probes, readings);
  const verdict = new Map<string, { twin: Verdict; why: string }>();
  for (const p of pairs) {
    const v = p.verdict === 'different' ? { twin: false, why: `${p.source} labels differ` } : p.similar ? { twin: true, why: `similar, ${p.source} labels agree` } : { twin: null, why: `${p.source} labels agree, not similar` };
    verdict.set(`${p.a}|${p.b}`, v); verdict.set(`${p.b}|${p.a}`, v);
  }
  const wallIds = [...walls.keys()];
  const rows: TwinRowV2[] = [];
  const targets = new Set(pairs.flatMap(p => [p.a, p.b]));
  for (const id of [...targets].sort()) {
    const nb: { left?: string; right?: string } = {};
    for (const j of wallIds) if (j !== id && adjacent(walls.get(id)!, walls.get(j)!)) nb[sideOf(walls.get(id)!, walls.get(j)!)] ??= j;
    // a known pair partner wins its side over another crop on that side
    for (const p of pairs) { const o = p.a === id ? p.b : p.b === id ? p.a : null; if (o && walls.has(o)) nb[sideOf(walls.get(id)!, walls.get(o)!)] = o; }
    const side = (j?: string): SideTruth => { if (!j) return null; const v = verdict.get(`${id}|${j}`); return { id: j, twin: v?.twin ?? null, why: v?.why ?? 'no labelled verdict' }; };
    const left = side(nb.left), right = side(nb.right);
    if (typeof left?.twin !== 'boolean' && typeof right?.twin !== 'boolean') continue;
    rows.push({ pandId: id, source: 'party-pair', left, right, mirrored: null, image: path.join(OUT, 'twin-images-v2', `${id}.jpg`) });
  }
  return { rows, pairs };
}

// --- Selection and images ----------------------------------------------------------------------------------------------
export const isPositive = (r: Pick<TwinRowV2, 'left' | 'right'>) => r.left?.twin === true || r.right?.twin === true;
export const isNegative = (r: Pick<TwinRowV2, 'left' | 'right'>) => !isPositive(r) && (r.left?.twin === false || r.right?.twin === false);

/** Spread selection: at most `perGroup` per group key, round-robin across groups, `n` in all; mirrored-known rows first. */
export function spreadPick<T>(rows: T[], group: (r: T) => string, n: number, perGroup: number, first: (r: T) => boolean = () => false): T[] {
  const groups = new Map<string, T[]>();
  for (const r of [...rows].sort((a, b) => Number(first(b)) - Number(first(a)))) groups.set(group(r), [...(groups.get(group(r)) ?? []), r]);
  const out: T[] = [];
  for (let round = 0; round < perGroup && out.length < n; round++) for (const g of [...groups.keys()].sort()) { const r = groups.get(g)![round]; if (r && out.length < n) out.push(r); }
  return out;
}

const GAP = 6, BAR = 14;
async function compose(parts: { input: Buffer | string; w: number; h: number; target: boolean }[], file: string) {
  const H = Math.max(...parts.map(p => p.h)) + BAR, W = parts.reduce((s, p) => s + p.w, 0) + GAP * (parts.length - 1);
  let x = 0;
  const comps: sharp.OverlayOptions[] = [];
  for (const p of parts) {
    comps.push({ input: p.input, left: x, top: H - p.h });
    if (p.target) comps.push({ input: { create: { width: p.w, height: BAR, channels: 3, background: { r: 255, g: 140, b: 0 } } }, left: x, top: 0 });
    x += p.w + GAP;
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 128, g: 128, b: 128 } } }).composite(comps).jpeg({ quality: 88 }).toFile(file);
}

async function stripRowImage(r: TwinRowV2, strip: { file: string; houses: Map<string, FaceHouse> }) {
  const meta = await sharp(strip.file).metadata();
  const parts = [];
  for (const id of [r.left?.id, r.pandId, r.right?.id]) {
    if (!id) continue;
    const h = strip.houses.get(id)!, x0 = Math.max(0, h.px[0]), w = Math.min(meta.width!, h.px[1]) - x0;
    parts.push({ input: await sharp(strip.file).extract({ left: x0, top: 0, width: w, height: meta.height! }).toBuffer(), w, h: meta.height!, target: id === r.pandId });
  }
  await compose(parts, r.image);
}

async function cropRowImage(r: TwinRowV2) {
  const parts = [];
  for (const id of [r.left?.id, r.pandId, r.right?.id]) {
    if (!id) continue;
    const f = path.join(cropDir(id)!, 'front.jpg'), m = await sharp(f).metadata();
    parts.push({ input: f, w: m.width!, h: m.height!, target: id === r.pandId });
  }
  await compose(parts, r.image);
}

async function sample(perFace: number, probeCache: string) {
  const { rows: face, strips } = faceRows();
  const { rows: party, pairs } = partyRows(probeCache);
  const count = (rs: TwinRowV2[]) => `${rs.length} rows (positive ${rs.filter(isPositive).length}, of them mirrored known ${rs.filter(r => isPositive(r) && r.mirrored !== null).length} / true ${rs.filter(r => isPositive(r) && r.mirrored === true).length}; negative ${rs.filter(isNegative).length})`;
  console.log(`block-face candidates: ${count(face)}; party-pair candidates: ${count(party)} from ${pairs.length} labelled party pairs (${pairs.filter(p => p.similar && p.verdict === 'same').length} similar+same, ${pairs.filter(p => p.verdict === 'different').length} different)`);
  // every party-pair positive (scarce) and a third of the negatives from party pairs; negatives match the positives in number
  const partyPos = party.filter(isPositive), partyNeg = party.filter(isNegative);
  // every mirrored-known positive (scarce: most designed doors are centred or unstated), then positives spread across faces
  const mirrorKnown = face.filter(r => isPositive(r) && r.mirrored !== null).slice(0, 12);
  const facePos = [...mirrorKnown, ...spreadPick(face.filter(r => isPositive(r) && !mirrorKnown.includes(r)), r => r.face!, 30 - Math.min(partyPos.length, 10) - mirrorKnown.length, perFace)];
  const pos = [...partyPos.slice(0, 10), ...facePos];
  const nNeg = pos.length;
  const partyNegPick = partyNeg.slice(0, Math.min(partyNeg.length, Math.ceil(nNeg / 3)));
  const neg = [...partyNegPick, ...spreadPick(face.filter(isNegative), r => r.face!, nNeg - partyNegPick.length, perFace)];
  const rows = [...pos, ...neg];
  fs.mkdirSync(path.join(OUT, 'twin-images-v2'), { recursive: true });
  for (const r of rows) { if (r.source === 'block-face') await stripRowImage(r, strips.get(r.face!)!); else await cropRowImage(r); }
  const by = (src: string) => ({ rows: rows.filter(r => r.source === src).length, positive: rows.filter(r => r.source === src && isPositive(r)).length, negative: rows.filter(r => r.source === src && isNegative(r)).length });
  const summary = { 'block-face': by('block-face'), 'party-pair': by('party-pair'), mirroredKnown: rows.filter(r => isPositive(r) && r.mirrored !== null).length, mirroredTrue: rows.filter(r => isPositive(r) && r.mirrored === true).length };
  fs.writeFileSync(path.join(OUT, 'twins-v2.json'), `${JSON.stringify({ v: 2, about: 'twin truth v2: designed block-face modules + PR1 similar party pairs (twins-v2.ts header)', positives: pos.length, negatives: neg.length, summary, rows }, null, 1)}\n`);
  fs.writeFileSync(path.join(OUT, 'twins-v2-ids.txt'), `${rows.map(r => r.pandId).sort().join('\n')}\n`);
  console.log(`twins-v2: ${rows.length} rows, ${pos.length} positive, ${neg.length} negative; ${JSON.stringify(summary)}`);
}

async function main() {
  const [cmd] = process.argv.slice(2);
  const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
  if (cmd === 'sample') return sample(Number(opt('per-face') ?? 3), opt('probe-cache') ?? PROBE_CACHE);
  console.log('twins-v2.ts sample [--per-face 3] [--probe-cache <file>]');
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
