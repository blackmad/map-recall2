/**
 * Judged wall colour on the held D1 fronts (lane d1-colour-judged, 2026-11-14; src/canalRecall/houseSpec/judgedColour.ts,
 * docs/house-line.md §16). Every held front keeps the fields of its best staged variant (wall-colour v3 for the belt and
 * AH07, the no-brick variant for the ring) and takes a judged wall family, decided in street order with its neighbours.
 * Writes, per pand: <out>/specs/<pandId>.json (plain spec, for build-house-specs --extra-specs) and the staged file
 * artifacts/house-specs/staging/<pandId>.json (makeStaged, receipt none with the row-sheet reason), plus <out>/judged.json
 * (one record per pand), <out>/pages.json (page -> pands, the sheet units) and <out>/lists/<page>.json (house:frames lists).
 * Stage only: never publishes.
 *
 *   node --import tsx scripts/house-specs/judged-colour/restage.ts [--out artifacts/d1-colour-judged] [--no-stage]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { judgeRow, JUDGED_PALETTE, withJudgedWall, withoutSampledWall, type JudgedInput, type Judgement } from '../../../src/canalRecall/houseSpec/judgedColour.ts';
import { specStrength, validateSpec, type HouseSpec, type SpecSource } from '../../../src/canalRecall/houseSpec/spec.ts';
import { makeStaged, type Receipt } from '../../../src/canalRecall/houseSpec/staged.ts';
import { alongOrder, bearingOf, slug } from '../describer-d1/ring-frame-lists.ts';
import { wallOf } from '../describer-d1/stage.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const W = '/Users/blackmad/Code/map-recall2-worktrees';
const PRUNED = `${W}/_pruned-sheets`;
const BELT = `${PRUNED}/d1-belt-20261114/belt-20261114`;
const BELT_CUTS = `${W}/d1-tranche-belt-20261114/artifacts/describer-d1/belt-20261114/cuts/cuts.json`;
const SHEET_DIR = 'ui/2026-11-14-d1-colour-judged';
const AT = '2026-11-14';
/** scripts/house-specs/stage.ts STAGING_DIR: where house:publish reads staged specs. */
const STAGING_DIR = path.join(ROOT, 'artifacts/house-specs/staging');

const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const answersOf = (dir: string) => new Map<string, any>(fs.readdirSync(dir).filter(f => /^\d{16}\.json$/.test(f)).map(f => { const a = readJson(path.join(dir, f)); return [a.pandId, a]; }));
const specsOf = (dir: string) => new Map<string, HouseSpec>(fs.readdirSync(dir).filter(f => /^\d{16}\.json$/.test(f)).map(f => { const s = readJson(path.join(dir, f)); return [s.pandId ?? s.spec?.pandId, s.spec ?? s]; }));
const cutsOf = (f: string) => new Map<string, any>(readJson(f).rows.map((r: any) => [r.pandId, r]));

/** BAG build year per pand from the building-facts tiles (the first value of each record). */
function loadYears(): Map<string, number> {
  const m = new Map<string, number>(), dir = path.join(ROOT, 'public/data/extracts/amsterdam/building-facts/14');
  for (const x of fs.readdirSync(dir)) for (const f of fs.readdirSync(path.join(dir, x))) {
    const buf = fs.readFileSync(path.join(dir, x, f)), d = JSON.parse((f.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8'));
    for (const [k, v] of Object.entries(d.buildings ?? {})) { const y = (v as number[])[0]; if (Number.isFinite(y) && y > 1200) m.set(k.replace(/^P/, ''), y); }
  }
  return m;
}

type Seq = { set: 'belt' | 'ah07' | 'ring'; key: string; ids: string[] };
type Front = { id: string; spec: HouseSpec | null; answer: any; sample: string | null; held: boolean; ref: string };

function main() {
  const argv = process.argv.slice(2), opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const out = path.resolve(ROOT, opt('out') ?? 'artifacts/d1-colour-judged'), stage = !argv.includes('--no-stage');
  const published = new Set(Object.keys(readJson(`${PRUNED}/d1-streets-1.sources.json`)));
  const years = loadYears();
  // the published extract's winning wall source per pand: a stronger one than a judgement (a block face's street-level
  // measurement, an author) keeps its colour; the judged colour defers
  const strongerWall = new Map<string, string>();
  const pubDir = path.join(ROOT, 'public/data/extracts/amsterdam/house-specs/14');
  for (const x of fs.readdirSync(pubDir)) for (const f of fs.readdirSync(path.join(pubDir, x))) {
    const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(pubDir, x, f))).toString('utf8'));
    for (const [k, r] of Object.entries<any>(d.buildings ?? {})) {
      const src = r.s?.['palette/brick'] as SpecSource | undefined;
      if (src && specStrength(src) > specStrength('vision-judge')) strongerWall.set(k.replace('NL.IMBAG.Pand.', ''), src);
    }
  }

  // --- belt: the verdicts' hold and dropped lists, v3 specs, the belt answers, rows from row-groups (street order per side)
  const verdicts = readJson(`${BELT}/verdicts.json`), beltGroups = readJson(`${BELT}/row-groups.json`) as Record<string, Array<{ key: string; pands: Array<{ pandId: string; number: number }> }>>;
  const beltHeld = new Set<string>();
  const beltPage = new Map<string, string>();
  for (const u of verdicts.units) for (const id of [...u.hold, ...u.dropped]) if (!published.has(id)) beltHeld.add(id);
  for (const u of verdicts.units) for (const id of [...u.hold, ...u.dropped, ...u.publish]) beltPage.set(id, u.unit);
  const beltSpecs = specsOf(path.join(ROOT, 'artifacts/d1-wall-colour/staged-belt-v3')), beltAnswers = answersOf(`${BELT}/answers`);
  const seqs: Seq[] = [];
  for (const [side, rows] of Object.entries(beltGroups)) {
    const ids: string[] = [];
    for (const r of rows) for (const p of r.pands) if (!ids.includes(p.pandId)) ids.push(p.pandId);
    seqs.push({ set: 'belt', key: side, ids });
  }

  // --- AH07: v3 specs, answers-ah07; rows = chains of adjacent cut walls (no street names in the cut set)
  const ahSpecs = specsOf(path.join(ROOT, 'artifacts/d1-wall-colour/staged-ah07-v3')), ahAnswers = answersOf(path.join(ROOT, 'artifacts/describer-d1/answers-ah07'));
  const ahCuts = cutsOf(path.join(ROOT, 'artifacts/describer-d1/cuts-ah07/cuts.json'));
  const ahHeld = new Set([...ahSpecs.keys()].filter(id => !published.has(id)));
  seqs.push(...wallChains([...ahSpecs.keys()].filter(id => ahCuts.has(id)), ahCuts).map((ids, i) => ({ set: 'ah07' as const, key: `ah07-${i + 1}`, ids })));

  // --- ring: no-brick specs, ring answers, ring candidate rows split by side (cut wall bearing), in street order
  const RING = path.join(ROOT, 'artifacts/describer-d1/ring-20261114');
  const ringSpecs = specsOf(path.join(ROOT, 'artifacts/describer-d1/staged-ring-20261114-nobrick')), ringAnswers = answersOf(path.join(RING, 'answers'));
  const ringCuts = cutsOf(path.join(RING, 'cuts-w1.json'));
  const ringHeld = new Set([...ringSpecs.keys()].filter(id => !published.has(id)));
  const cand = readJson(path.join(RING, 'ring-candidates.json'));
  const ringRowOf = new Map<string, string>();
  for (const row of cand.rows.filter((r: any) => r.taken)) {
    const fronts = row.fronts.filter((f: any) => ringSpecs.has(f.id));
    for (const f of fronts) { ringRowOf.set(f.id, row.key); if (f.year && !years.has(f.id)) years.set(f.id, f.year); }
    const bySide = new Map<string, any[]>();
    const b0 = fronts.map((f: any) => wallOf(ringCuts.get(f.id))).find(Boolean);
    for (const f of fronts) {
      const w = wallOf(ringCuts.get(f.id)), b = w && b0 ? bearingOf(w.normal) : null, ref = b0 ? bearingOf(b0.normal) : 0;
      const s = b === null ? 'a' : Math.abs(((b - ref + 540) % 360) - 180) < 90 ? 'a' : 'b';
      (bySide.get(s) ?? bySide.set(s, []).get(s)!).push(f);
    }
    for (const [s, fs_] of bySide) seqs.push({ set: 'ring', key: `${row.key} #${s}`, ids: alongOrder(fs_, (f: any) => f.at as [number, number]).map((f: any) => f.id) });
  }

  const sampleOf = (set: Seq['set'], id: string, spec: HouseSpec | null): string | null => {
    const ws = (spec?.facts as any)?.wallSample;
    if (set !== 'ring' && ws) return ws.estimate ?? ws.raw ?? null;
    const c = (set === 'ring' ? ringCuts : set === 'ah07' ? ahCuts : null)?.get(id);
    return c?.w1?.hex ?? c?.wallHex ?? null;
  };
  const sources = { belt: { specs: beltSpecs, answers: beltAnswers, held: beltHeld }, ah07: { specs: ahSpecs, answers: ahAnswers, held: ahHeld }, ring: { specs: ringSpecs, answers: ringAnswers, held: ringHeld } };

  fs.rmSync(path.join(out, 'specs'), { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'specs'), { recursive: true });
  if (stage) fs.mkdirSync(STAGING_DIR, { recursive: true });
  const records: Record<string, any> = {}, done = new Set<string>();
  for (const seq of seqs) {
    const src = sources[seq.set];
    const fronts: Front[] = seq.ids.map(id => {
      const spec = src.specs.get(id) ?? null, answer = src.answers.get(id) ?? null;
      return { id, spec, answer, sample: sampleOf(seq.set, id, spec), held: src.held.has(id), ref: answer?.image?.ref ?? `d1:${seq.set}:${id}` };
    }).filter(f => f.answer || f.spec);
    const inputs: JudgedInput[] = fronts.map(f => ({
      pandId: f.id, readable: f.answer?.readable !== false, finish: f.answer?.finish ?? null, pale: typeof f.answer?.pale === 'boolean' ? f.answer.pale : null,
      notes: f.answer?.notes ?? null, year: years.get(f.id) ?? null, sample: f.sample,
    }));
    const judged = judgeRow(inputs, { window: 5 });
    fronts.forEach((f, i) => {
      if (!f.held || !f.spec || done.has(f.id)) return;
      done.add(f.id);
      const j: Judgement = judged[i];
      const deferTo = strongerWall.get(f.id);
      const spec = validateSpec(deferTo ? withoutSampledWall(f.spec) : withJudgedWall(f.spec, j, { ref: f.ref, at: AT, sample: f.sample, year: years.get(f.id) ?? null }));
      const page = seq.set === 'belt' ? beltPage.get(f.id)! : seq.set === 'ring' ? slug(ringRowOf.get(f.id)!) : seq.key;
      records[f.id] = { set: seq.set, row: seq.key, page, family: j.family, by: j.by, why: j.why, hex: spec.design.palette?.brick ?? null, ...(deferTo ? { deferredTo: deferTo } : {}), year: years.get(f.id) ?? null, sample: f.sample, finish: inputs[i].finish, pale: inputs[i].pale };
      fs.writeFileSync(path.join(out, 'specs', `${f.id}.json`), `${JSON.stringify(spec, null, 1)}\n`);
      if (stage) {
        const reason = `judged wall colour (user ruling 2026-11-14: colour from neighbours and brick knowledge, not exact samples) on the D1 ${seq.set} shapes; the house:preview cannot judge a colour family: the row sheet ${SHEET_DIR}/${page}.jpg (photo | today | judged, rule 10) stands in`;
        const staged = makeStaged({ spec, by: 'lane d1-colour-judged-20261114', note: `D1 ${seq.set} ${page}: ${deferTo ? `wall colour deferred to ${deferTo}` : `${JUDGED_PALETTE[j.family].label} (${j.by})`}`, receipt: { kind: 'none', reason } as Receipt });
        fs.writeFileSync(path.join(STAGING_DIR, `${f.id}.json`), `${JSON.stringify(staged, null, 1)}\n`);
      }
    });
  }
  const missing = [...beltHeld, ...ahHeld, ...ringHeld].filter(id => !done.has(id));
  // pages: page -> pands in order; counts
  const pages: Record<string, string[]> = {};
  for (const [id, r] of Object.entries(records)) (pages[r.page] ??= []).push(id);
  const count = (k: string, set?: string) => Object.values(records).filter((r: any) => !set || r.set === set).reduce((m: Record<string, number>, r: any) => { m[r[k]] = (m[r[k]] ?? 0) + 1; return m; }, {});
  const summary = {
    v: 1, at: AT, restaged: Object.keys(records).length,
    held: { belt: beltHeld.size, ah07: ahHeld.size, ring: ringHeld.size }, missing,
    deferred: Object.values(records).filter((r: any) => r.deferredTo).length,
    families: count('family'), by: count('by'),
    perSet: Object.fromEntries((['belt', 'ah07', 'ring'] as const).map(s => [s, count('family', s)])),
  };
  fs.writeFileSync(path.join(out, 'judged.json'), `${JSON.stringify({ ...summary, pands: records }, null, 1)}\n`);
  fs.writeFileSync(path.join(out, 'pages.json'), `${JSON.stringify(pages, null, 1)}\n`);
  fs.writeFileSync(path.join(out, 'seqs.json'), `${JSON.stringify(seqs, null, 1)}\n`);
  console.log(JSON.stringify(summary, null, 1));
}

/** AH07 rows: union of cut walls whose ends meet (1.5 m) and whose outward normals agree (40 deg), ordered along the row. */
function wallChains(ids: string[], cuts: Map<string, any>): string[][] {
  const walls = new Map(ids.map(id => [id, wallOf(cuts.get(id))]).filter(([, w]) => w) as Array<[string, NonNullable<ReturnType<typeof wallOf>>]>);
  const parent = new Map([...walls.keys()].map(k => [k, k]));
  const find = (k: string): string => (parent.get(k) === k ? k : (parent.set(k, find(parent.get(k)!)), parent.get(k)!));
  const list = [...walls.entries()];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const [ia, a] = list[i], [ib, b] = list[j];
    const near = [a.a, a.b].some(p => [b.a, b.b].some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1.5));
    const agree = (a.normal[0] * b.normal[0] + a.normal[1] * b.normal[1]) > Math.cos((40 * Math.PI) / 180);
    if (near && agree) parent.set(find(ia), find(ib));
  }
  const groups = new Map<string, string[]>();
  for (const k of walls.keys()) (groups.get(find(k)) ?? groups.set(find(k), []).get(find(k))!).push(k);
  return [...groups.values()].sort((x, y) => y.length - x.length).map(g => alongOrder(g, id => { const w = walls.get(id)!; return [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2]; }));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
