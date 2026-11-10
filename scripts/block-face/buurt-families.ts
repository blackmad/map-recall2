/**
 * Buurt families: the measure-first table of a surveyed buurt (scripts/block-face/buurten/<slug>.json). Groups the
 * pre-1945 pands by build-year band x 3DBAG storeys x roof class (flat when ridge - eaves < 1 m), lists the proposed
 * faces with their build-year mode, and says which faces have a panorama strip and which library types the 3DBAG numbers
 * would let through the year/eaves/storey/roof veto (a null measurement, not a placement).
 *
 *   node --import tsx scripts/block-face/buurt-families.ts --buurt=timorpleinbuurt-noord --district=indische-buurt
 */
import fs from 'node:fs';
import path from 'node:path';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const FACES = 'scripts/block-face/faces';

type Pand = {pandId: string; street: string; numbers: number[]; builtYear: number | null; storeys3dbag: number | null; frontWidthM?: number; eavesM?: number; ridgeM?: number};
type Face = {id: string; street: string; members: string[]; covered?: string};

export const yearBand = (y: number | null) => y == null ? 'unknown' : y <= 1906 ? '1900-06' : y <= 1915 ? '1907-15' : y <= 1922 ? '1916-22' : y <= 1928 ? '1923-28' : y <= 1945 ? '1929-45' : 'post-war';
export const roofClass = (p: Pand) => p.eavesM != null && p.ridgeM != null && p.ridgeM - p.eavesM < 1 ? 'flat' : 'pitched';
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const mode = <T>(a: T[]) => { const m = new Map<T, number>(); for (const x of a) m.set(x, (m.get(x) ?? 0) + 1); return [...m.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null; };

if (process.argv[1]?.endsWith('buurt-families.ts')) {
  const slug = arg('buurt')!, district = arg('district');
  const TYPES = `scripts/block-face/types/${district}`;
  const doc = JSON.parse(fs.readFileSync(`scripts/block-face/buurten/${slug}.json`, 'utf8')) as {pands: Pand[]; faces: Face[]};
  const types = district && fs.existsSync(TYPES) ? fs.readdirSync(TYPES).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(TYPES, f), 'utf8'))) : [];
  const byId = new Map(doc.pands.map(p => [p.pandId, p]));
  const fits = (p: Pand) => types.filter(t => {
    const m = t.match ?? {};
    if (m.years && (p.builtYear == null || p.builtYear < m.years[0] - 2 || p.builtYear > m.years[1] + 2)) return false;
    if (m.eavesM && (p.eavesM == null || p.eavesM < m.eavesM[0] - 0.8 || p.eavesM > m.eavesM[1] + 0.8)) return false;
    if (m.storeys3dbag && p.storeys3dbag != null && !m.storeys3dbag.includes(p.storeys3dbag)) return false;
    if (m.roof && m.roof !== roofClass(p)) return false;
    return true;
  }).map(t => t.id);
  const old = doc.pands.filter(p => p.builtYear != null && p.builtYear <= 1945);
  console.log(`## ${slug}: ${doc.pands.length} pands, ${old.length} built by 1945, ${doc.faces.length} proposed faces\n`);
  console.log('| band | storeys | roof | pands | width med | eaves med | pass the library year/eaves/storey/roof veto |\n|---|---|---|---|---|---|---|');
  const groups = new Map<string, Pand[]>();
  for (const p of old) { const k = `${yearBand(p.builtYear)}|${p.storeys3dbag ?? '?'}|${roofClass(p)}`; groups.set(k, [...(groups.get(k) ?? []), p]); }
  for (const [k, v] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const [b, s, r] = k.split('|'), f = v.filter(p => fits(p).length).length;
    console.log(`| ${b} | ${s} | ${r} | ${v.length} | ${median(v.flatMap(p => p.frontWidthM ?? []))} | ${median(v.flatMap(p => p.eavesM ?? []))} | ${f} |`);
  }
  console.log('\n| face | street | pands | year mode | storeys | eaves med | width med | strip coverage | library types that pass |\n|---|---|---|---|---|---|---|---|---|');
  for (const f of doc.faces) {
    const ps = f.members.map(id => byId.get(id)!).filter(Boolean);
    const ym = mode(ps.map(p => p.builtYear));
    if (ym == null || ym > 1945 || ps.length < 2) continue;
    const sj = path.join(FACES, f.id, 'strip.json');
    const cov = fs.existsSync(sj) ? JSON.parse(fs.readFileSync(sj, 'utf8')).coverage : null;
    const fitIds = new Set(ps.flatMap(p => fits(p)));
    console.log(`| ${f.id} | ${f.street} | ${ps.length} | ${ym} | ${mode(ps.map(p => p.storeys3dbag))} | ${median(ps.flatMap(p => p.eavesM ?? []))} | ${median(ps.flatMap(p => p.frontWidthM ?? []))} | ${cov == null ? 'none' : cov} | ${[...fitIds].join(', ') || '-'} |`);
  }
}
