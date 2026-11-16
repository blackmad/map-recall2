/**
 * De Wallen (Burgwallen-Oude Zijde, AE) against two comparison wijken (centrum-looks lane, 2026-11-15, for the
 * integrator's question "what would it take"): street fronts on alleys, panorama reach, narrow and out-of-line fronts,
 * register depth and the red-light ground floors. Node; the panorama probe fetches one API search per sampled front
 * (data.amsterdam.nl, 600 ms apart, repo URL as contact) unless --no-pano.
 *
 *   node --import tsx scripts/centrum-looks/wallen.ts [--sample=150] [--no-pano] [--out=artifacts/centrum-looks/wallen.json]
 */
import fs from 'node:fs';
import { districtPands, namedStreets } from '../buurt-generators/generate.ts';
import { districtRows } from '../../src/canalRecall/buurtGenerator/rows.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const EXTRACT = 'public/data/extracts/amsterdam';
const WIJKEN: Record<string, string[]> = {
  'Burgwallen-Oude Zijde': ['AE01', 'AE02', 'AE03', 'AE04', 'AE05'],
  Jordaan: ['AB01', 'AB02', 'AB03', 'AB04', 'AB05', 'AB06', 'AB07', 'AB08', 'AB09', 'AB10', 'AB11'],
  'Grachtengordel-West': ['AC01', 'AC02', 'AC03', 'AC04'],
};
/** Alley names: steeg, gang, sloop, pijp, poort, and the Wallen's 'Stoofsteeg'-type lanes. */
const ALLEY = /(steeg|gang|sloop|pijp|poort|steegje)$/i;
const norm = (s: string) => s.replace(/^NL\.IMBAG\.Pand\./, '');
const h = (s: string) => { let x = 0x811c9dc5; for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 0x01000193) >>> 0; } return x; };

const ways = JSON.parse(fs.readFileSync(`${EXTRACT}/streets-routing.json`, 'utf8')) as Array<{ name?: string; highway?: string }>;
const classOf = new Map<string, string>();
for (const w of ways) if (w.name && !classOf.has(w.name)) classOf.set(w.name, w.highway ?? '');
const facts = new Map(Object.entries(JSON.parse(fs.readFileSync(`${EXTRACT}/monument-facts.json`, 'utf8')).buildings as Record<string, any>).map(([k, v]) => [norm(k), v]));
const shopT = JSON.parse(fs.readFileSync(`${EXTRACT}/shop-templates.json`, 'utf8'));
const rl = shopT.templates.indexOf('redLight');
const redLight = new Set(Object.entries(shopT.buildings as Record<string, [number, ...unknown[]]>).filter(([, v]) => v[0] === rl).map(([k]) => norm(k)));
const streets = namedStreets();
const out: Record<string, unknown> = {};

for (const [wijk, buurten] of Object.entries(WIJKEN)) {
  const pands = districtPands({ buurten } as never);
  const res = districtRows(pands, streets, { singles: true });
  const fronts = res.rows.flatMap(r => r.members.map(m => ({ row: r, m })));
  const n = fronts.length, unplaced: Record<string, number> = {};
  for (const u of res.unplaced) unplaced[u.reason] = (unplaced[u.reason] ?? 0) + 1;
  const alley = fronts.filter(f => ALLEY.test(f.m.front.street));
  const narrow = fronts.filter(f => f.m.front.lengthM < 5);
  // Out of line: districtRows already breaks a row where a front jogs (JOIN_M, JOIN_DEG), so a jogged front shows as a
  // short row: fronts in rows of 1 or 2 against rows of 3+ (rowSizes). Inside rows of 3+ a member whose front midpoint
  // stands > 0.75 m off the row's line (first a to last b) or turns > 12 deg from it is counted too.
  const rowSizes = { single: 0, pair: 0, three: 0 };
  for (const r of res.rows) { const k = r.members.length === 1 ? 'single' : r.members.length === 2 ? 'pair' : 'three'; rowSizes[k] += r.members.length; }
  let inRows = 0, offLine = 0;
  for (const r of res.rows) {
    if (r.members.length < 3) continue;
    const A = r.members[0].front.a, B = r.members[r.members.length - 1].front.b, L = Math.hypot(B.x - A.x, B.y - A.y);
    if (L < 1) continue;
    const ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;
    for (const m of r.members) {
      inRows++;
      const mx = (m.front.a.x + m.front.b.x) / 2, my = (m.front.a.y + m.front.b.y) / 2, off = Math.abs((mx - A.x) * uy - (my - A.y) * ux);
      const fx = m.front.b.x - m.front.a.x, fy = m.front.b.y - m.front.a.y, ang = Math.acos(Math.min(1, Math.abs((fx * ux + fy * uy) / Math.max(1e-6, Math.hypot(fx, fy))))) * 180 / Math.PI;
      if (off > 0.75 || ang > 12) offLine++;
    }
  }
  const ids = pands.map(p => norm(p.id));
  const reg = ids.filter(id => facts.has(id));
  const score = (id: string) => { const f = facts.get(id); return [f.gable && f.gable !== 'plain', Number.isInteger(f.storeys), typeof f.finish === 'string', f.facadeDate || f.coreDate, (f.elements ?? []).length >= 2].filter(Boolean).length; };
  const regWell = reg.filter(id => score(id) >= 4), regFair = reg.filter(id => score(id) >= 3), regGable = reg.filter(id => { const g = facts.get(id).gable; return g && g !== 'plain'; });
  const rlIds = ids.filter(id => redLight.has(id));
  // Panorama probe: a seeded sample of fronts; the probe point stands on the street side of the front (outward normal,
  // the street centre distance capped at 6 m); a panorama within 10 m of it counts as usable reach.
  let pano: Record<string, unknown> | null = null;
  if (!process.argv.includes('--no-pano')) {
    const sample = [...fronts].sort((a, b) => h(norm(a.m.pand.id)) - h(norm(b.m.pand.id))).slice(0, Number(arg('sample') ?? 150));
    let hit = 0, alleyN = 0, alleyHit = 0;
    for (const f of sample) {
      const fr = f.m.front, mid = [(fr.aLngLat[0] + fr.bLngLat[0]) / 2, (fr.aLngLat[1] + fr.bLngLat[1]) / 2], d = Math.min(6, fr.streetM);
      const lat = mid[1] + fr.n.y * d / 110540, lng = mid[0] + fr.n.x * d / (111320 * Math.cos(mid[1] * Math.PI / 180));
      const url = `https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng.toFixed(6)},${lat.toFixed(6)}&radius=10&srid=4326&page_size=1`;
      let c = 0;
      try { c = ((await (await fetch(url, { headers: { 'User-Agent': 'map-recall2 (https://github.com/blackmad/map-recall2)' } })).json()) as { count?: number }).count ?? 0; } catch { c = -1; }
      if (c > 0) hit++;
      if (ALLEY.test(fr.street)) { alleyN++; if (c > 0) alleyHit++; }
      await new Promise(r => setTimeout(r, 600));
    }
    pano = { sampled: sample.length, within10m: hit, alleySampled: alleyN, alleyWithin10m: alleyHit };
  }
  out[wijk] = {
    pands: pands.length, fronts: n, unplaced, alleyFronts: alley.length, alleyShare: +(alley.length / n).toFixed(3),
    alleyStreets: [...new Set(alley.map(f => f.m.front.street))].length,
    narrowUnder5: narrow.length, narrowShare: +(narrow.length / n).toFixed(3), medianFrontM: +[...fronts.map(f => f.m.front.lengthM)].sort((a, b) => a - b)[Math.floor(n / 2)].toFixed(2),
    rowSizes, shortRowShare: +((rowSizes.single + rowSizes.pair) / Math.max(1, n)).toFixed(3), rowMembers3plus: inRows, offLine, offLineShare: +(offLine / Math.max(1, inRows)).toFixed(3),
    register: reg.length, registerShare: +(reg.length / pands.length).toFixed(3), registerWell4of5: regWell.length, registerFair3of5: regFair.length, registerGable: regGable.length,
    redLight: rlIds.length, pano,
    frontStreetClasses: Object.fromEntries(Object.entries(fronts.reduce((o: Record<string, number>, f) => { const c = classOf.get(f.m.front.street) ?? '?'; o[c] = (o[c] ?? 0) + 1; return o; }, {})).sort((a, b) => b[1] - a[1])),
  };
  console.log(wijk, JSON.stringify(out[wijk]));
}
fs.mkdirSync('artifacts/centrum-looks', { recursive: true });
fs.writeFileSync(arg('out') ?? 'artifacts/centrum-looks/wallen.json', JSON.stringify(out, null, 1));
