// Street faces city-wide (lane FD, 2026-11-13); definition and tolerances in src/canalRecall/streetFaces/faces.ts.
//   node --import tsx scripts/street-faces/build-faces.ts [--out=artifacts/street-faces] [--quick]
// Generic pands = bag-tiles pands no coverage tier claims (loadCity.claimedPandIds mirrors scripts/coverage/build-coverage.ts).
// Writes <out>/faces.json (strict faces) and <out>/summary.json (distributions, sensitivity, reliability); prints tables.
import fs from 'node:fs';
import path from 'node:path';
import { claimedPandIds, loadBuurtLocator, loadPands, EXTRACT, ROOT } from './loadCity.ts';
import { FRONT_HIGHWAYS } from '../../src/canalRecall/streetFronts.ts';
import { StreetGrid, buildFaces, singleReasons, distribution, frontageAxis, projector, signatureOf, streetFront, type Face, type FacePand, type MatchMode, type Segment } from '../../src/canalRecall/streetFaces/faces.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const flag = (n: string) => process.argv.includes(`--${n}`);
const out = path.resolve(ROOT, arg('out') ?? 'artifacts/street-faces');
const proj = projector(52.37);
const { pands, features } = loadPands();
const claimed = await claimedPandIds(features);
const industrial = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'industrial-buildings.json'), 'utf8')).ids as Record<string, string>;
const { locate } = loadBuurtLocator();
console.log(`bag-tiles pands ${pands.size}, claimed by a non-generic tier ${[...claimed].filter(id => pands.has(id)).length}`);

// streets
const routing = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'streets-routing.json'), 'utf8')) as { name: string; highway: string; path?: [number, number][]; paths?: [number, number][][] }[];
const segs: Segment[] = [];
for (const w of routing) {
  if (!w.name || !FRONT_HIGHWAYS.has(w.highway)) continue;
  for (const pth of w.paths ?? (w.path ? [w.path] : [])) for (let i = 1; i < pth.length; i++) {
    const a = proj(pth[i - 1][1], pth[i - 1][0]), b = proj(pth[i][1], pth[i][0]);
    segs.push({ name: w.name, x0: a[0], y0: a[1], x1: b[0], y1: b[1] });
  }
}
const grid = new StreetGrid(segs);
console.log(`named front streets: ${segs.length} segments`);

interface Info { fp: FacePand; buurt: string; buurtName: string; stadsdeel: string; belt: boolean; corner: boolean; areaM2: number; industrial: boolean; frontM: number }
const info = new Map<string, Info>();
let noStreet = 0, generic = 0;
const fixed: FacePand[] = [];
let outsideBuurten = 0;
for (const p of pands.values()) {
  const b = locate(p.centroid);
  if (!b) { outsideBuurten++; continue; }
  if (claimed.has(p.id)) {
    const r = p.ring.map(([x, y]) => proj(x, y)), f = streetFront(r, grid);
    fixed.push({ id: p.id, ring: r, year: p.year, street: f?.street ?? null, side: f?.side ?? null, sig: signatureOf(r, frontageAxis(r, f?.dir ?? [1, 0])) });
    continue;
  }
  generic++;
  const ring = p.ring.map(([x, y]) => proj(x, y));
  const f = streetFront(ring, grid);
  if (!f) noStreet++;
  const sig = signatureOf(ring, frontageAxis(ring, f?.dir ?? [1, 0]));
  info.set(p.id, { fp: { id: p.id, ring, year: p.year, street: f?.street ?? null, side: f?.side ?? null, sig }, buurt: b?.code ?? '', buurtName: b?.name ?? '', stadsdeel: b?.stadsdeel ?? 'outside', belt: /^A[A-P]\d/.test(b?.code ?? ''), corner: !!f?.corner, areaM2: p.areaM2, industrial: !!industrial[p.id] && ['works', 'shed'].includes(industrial[p.id]), frontM: sig.frontM });
}
console.log(`pands outside every buurt (neighbouring municipalities, dropped) ${outsideBuurten}; generic pands in Amsterdam ${generic}; no named street within reach ${noStreet}`);

// A pand with no street joins nothing: it stays a face of one.
const run = (subset: Info[], mode: MatchMode): Face[] => {
  const withStreet = subset.filter(i => i.fp.street !== null).map(i => i.fp);
  const alone = subset.filter(i => i.fp.street === null).map(i => ({ street: null, side: null, pands: [i.fp.id], frontageM: +i.frontM.toFixed(1), year: i.fp.year, yearMin: i.fp.year, yearMax: i.fp.year, signature: '' }) as Face);
  return [...buildFaces(withStreet, mode), ...alone];
};
const all = [...info.values()];
const main = all.filter(i => i.areaM2 >= 40 && !i.industrial);
const groupBy = <T>(xs: T[], k: (x: T) => string) => { const m = new Map<string, T[]>(); for (const x of xs) { const key = k(x); const l = m.get(key); if (l) l.push(x); else m.set(key, [x]); } return m; };
const fmt = (d: ReturnType<typeof distribution>) => `${d.pands} pands, ${d.faces} faces | faces for 50/80/95 % of pands ${d.facesFor.p50}/${d.facesFor.p80}/${d.facesFor.p95}, of frontage ${d.facesForFrontage.p50}/${d.facesForFrontage.p80}/${d.facesForFrontage.p95} | mean ${d.meanSize.toFixed(2)} median ${d.medianSize} max ${d.maxSize} | single-pand faces ${(d.singleFaceShare * 100).toFixed(1)} % (${(d.pandsInSingleShare * 100).toFixed(1)} % of pands) | ${d.frontageM} m frontage`;

const summary: any = { generatedAt: new Date().toISOString(), genericPands: generic, noStreet, industrialTaggedGeneric: all.filter(i => i.industrial).length, minor: all.filter(i => i.areaM2 < 40).length, cornerPands: all.filter(i => i.corner).length, noYear: all.filter(i => i.fp.year === null).length, sets: {} };
let strictAll: Face[] = [];
const modes: MatchMode[] = flag('quick') ? ['strict'] : ['strict', 'shape', 'year'];
for (const [setName, set] of [['allGeneric', all], ['mainBuildings', main]] as const) {
  summary.sets[setName] = {};
  for (const mode of modes) {
    const t0 = Date.now();
    const faces = run([...set], mode);
    const owner = (f: Face) => info.get(f.pands[0])!;
    const head = faces.filter(f => !owner(f).belt), belt = faces.filter(f => owner(f).belt);
    const per: Record<string, any> = {};
    for (const [sd, fs_] of groupBy(head, f => owner(f).stadsdeel)) per[sd] = distribution(fs_);
    summary.sets[setName][mode] = { headline: distribution(head), belt: distribution(belt), perStadsdeel: per };
    console.log(`\n== ${setName} / ${mode} (${((Date.now() - t0) / 1000).toFixed(0)} s)\nHEADLINE (outside the belt AA-AP): ${fmt(summary.sets[setName][mode].headline)}\nBELT (AA-AP):                      ${fmt(summary.sets[setName][mode].belt)}`);
    for (const [sd, d] of Object.entries(per).sort((a, b) => (b[1] as any).pands - (a[1] as any).pands)) console.log(`  ${sd.padEnd(11)} ${fmt(d as any)}`);
    if (setName === 'allGeneric' && mode === 'strict') strictAll = faces;
    if (setName === 'allGeneric' && mode === 'strict') {
      const fh = faces.filter(f => /Frederik Hendrik/i.test(owner(f).buurtName));
      summary.frederikHendrikbuurt = { distribution: distribution(fh), faces: fh.sort((a, b) => b.pands.length - a.pands.length).map(f => ({ ...f, buurt: owner(f).buurt })) };
      console.log(`\nFrederik Hendrikbuurt (strict, all generic): ${fmt(summary.frederikHendrikbuurt.distribution)}`);
      for (const f of fh.filter(f => f.pands.length > 1).slice(0, 40)) console.log(`   ${String(f.pands.length).padStart(2)} pands ${String(f.frontageM).padStart(6)} m  ${f.street} ${f.side}  ${f.year} (${f.yearMin}-${f.yearMax})  ${f.signature}`);
      console.log(`   plus ${fh.filter(f => f.pands.length === 1).length} single-pand faces`);
      const faceInfo = strictAll;
      // Why do pands stand alone? (headline set, all generic pands, strict)
      const why = singleReasons(all.map(i => i.fp), fixed, 'strict');
      for (const [label, pick] of [['headline', (i: Info) => !i.belt], ['belt', (i: Info) => i.belt]] as const) {
        const counts: Record<string, number> = {}; let tot = 0;
        for (const i of all.filter(pick)) { tot++; const r = why.get(i.fp.id) ?? 'in a multi-pand face'; counts[r] = (counts[r] ?? 0) + 1; }
        summary[`whySingle_${label}`] = counts;
        console.log(`\nwhy pands stand alone (${label}, strict, ${tot} generic pands):`, Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v} (${(100 * v / tot).toFixed(1)} %)`).join(', '));
      }
      summary.reliability = {
        facesWithYearSpreadOver3: faces.filter(f => f.yearMin !== null && f.yearMax! - f.yearMin > 3).length,
        facesWithCornerPand: faces.filter(f => f.pands.some(id => info.get(id)!.corner)).length,
        facesTotal: faceInfo.length,
        facesAcrossBuurten: faces.filter(f => new Set(f.pands.map(id => info.get(id)!.buurt)).size > 1).length,
      };
    }
  }
}
fs.mkdirSync(out, { recursive: true });
const sdOf = (f: Face) => info.get(f.pands[0])!;
fs.writeFileSync(path.join(out, 'faces.json'), JSON.stringify({ version: 1, generatedAt: summary.generatedAt, mode: 'strict', definition: 'src/canalRecall/streetFaces/faces.ts', faces: strictAll.map((f, i) => ({ id: `f${i}`, street: f.street, side: f.side, pands: f.pands.map(p => p.replace('NL.IMBAG.Pand.', '')), frontageM: f.frontageM, year: f.year, yearMin: f.yearMin, yearMax: f.yearMax, signature: f.signature, buurt: sdOf(f).buurt, stadsdeel: sdOf(f).stadsdeel, belt: sdOf(f).belt })) }));
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 1));
console.log('\nreliability', summary.reliability, `\ngeneric ${generic}, minor(<40 m2) ${summary.minor}, industrial-tagged ${summary.industrialTaggedGeneric}, corner pands ${summary.cornerPands}, no year ${summary.noYear}, no street ${noStreet}\nwrote ${out}`);
