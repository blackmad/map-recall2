// Pick the strip houses (register-recipes lane): per buurt, canal houses whose register facts differ most from what the
// chain drew without them, each with a street-facing camera. Writes <out>.json = [{ slug, name, lng, lat, eye, target, bearing, facts }].
//   nice -n 19 npx tsx scripts/register-facts/pick-strip-spots.ts <out.json>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { EXTRACT, gameChain, loadTile, readJson } from '../world/pipeline.ts';

const BUURTEN = ['Felix Meritisbuurt', 'Vijzelstraatbuurt', 'Langestraat e.o.'];
const PER = 4;
const facts: Record<string, any> = readJson(`${EXTRACT}/staging/monument-facts.json`).buildings;
const buurten = readJson(`${EXTRACT}/coverage-v1/buurten.json`).features as any[];
type Ring = number[][];
const inside = ([x, y]: number[], ring: Ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; return c; };
const polys = (g: any): Ring[][] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const buurtAt = (p: number[]) => buurten.find(b => polys(b.geometry).some(poly => inside(p, poly[0])))?.properties?.name as string | undefined;
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;
const chain = gameChain({ registerFacts: null });
const all: Array<{ id: string; ring: Ring; c: number[]; area: number; p: any }> = [];
const base = `${EXTRACT}/building-tiles/14`;
const seen = new Set<string>();
for (const x of readdirSync(base)) for (const f of readdirSync(`${base}/${x}`)) {
  for (const row of await loadTile(`${x}/${f.replace('.geojson.gz', '')}`, chain)) {
    const id = String(row.raw.properties.id); if (seen.has(id)) continue; seen.add(id);
    const g = row.raw.geometry, ring = (g.type === 'Polygon' ? g.coordinates : g.coordinates[0])[0] as Ring;
    const c = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
    if (!BUURTEN.includes(buurtAt(c) ?? '') && !(Math.abs(c[0] - 4.9004) < 0.0009 && Math.abs(c[1] - 52.3725) < 0.0007)) continue;
    let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] * KX) * (ring[i][1] * KY) - (ring[i][0] * KX) * (ring[j][1] * KY);
    all.push({ id, ring, c, area: Math.abs(a) / 2, p: row.styled.properties });
  }
}
const free = (c: number[], bearing: number, d: number) => { const q = [c[0] + Math.sin(bearing) * d / KX, c[1] + Math.cos(bearing) * d / KY]; return !all.some(b => inside(q, b.ring)); };
const out: any[] = [];
const score = (a: typeof all[number]) => {
  const f = facts[a.id]; if (!f) return -1;
  const y = f.facadeDate ? (f.facadeDate.from + f.facadeDate.to) / 2 : f.coreDate && !f.altered ? (f.coreDate.from + f.coreDate.to) / 2 : null;
  const bag = Number(a.p.constructionYear);
  let s = 0;
  if (y !== null && y < 1860 && bag >= 1860) s += 3;
  if (f.finish === 'plaster' || f.finish === 'painted') s += 2;
  s += Math.min(3, (f.elements ?? []).filter((e: any) => ['hoistBeam', 'stoop', 'crownCornice', 'corniceConsoles', 'doorSurround', 'gablestone'].includes(e.key)).length);
  if (f.stoneBands) s += 1;
  if (f.gable && f.gable !== 'plain') s += 1;
  if (a.area < 35 || a.area > 200 || a.p.height < 8 || a.p.height > 20) s -= 6;
  if (a.p.facade === 'kit' || a.p.kitRoof) s -= 9;
  return s;
};
for (const buurt of BUURTEN) {
  const pool = all.filter(a => buurtAt(a.c) === buurt).map(a => ({ a, s: score(a) })).filter(x => x.s >= 3).sort((x, y) => y.s - x.s || x.a.id.localeCompare(y.a.id));
  const picked: typeof pool = [];
  for (const cand of pool) {
    if (picked.length >= PER) break;
    // Spread: not within 60 m of one already picked in this buurt.
    if (picked.some(q => Math.hypot((q.a.c[0] - cand.a.c[0]) * KX, (q.a.c[1] - cand.a.c[1]) * KY) < 35)) continue;
    // Camera: the free direction that reaches farthest (the street or canal in front), eye 15 m out at that bearing.
    let best = { b: 0, d: 0 };
    for (let k = 0; k < 24; k++) { const b = k * Math.PI / 12; let d = 0; while (d < 30 && free(cand.a.c, b, d + 3)) d += 3; if (d > best.d) best = { b, d }; }
    if (best.d < 9) continue;
    picked.push(cand);
    const f = facts[cand.a.id], bearing = (best.b * 180 / Math.PI + 180) % 360, eyeD = Math.min(15, best.d - 1);
    const eye = [cand.a.c[0] + Math.sin(best.b) * eyeD / KX, cand.a.c[1] + Math.cos(best.b) * eyeD / KY];
    out.push({ slug: `${buurt.split(' ')[0].toLowerCase()}-${cand.a.id.slice(-6)}`, name: `${buurt} ${cand.a.id.slice(-6)}`, id: cand.a.id, lng: cand.a.c[0], lat: cand.a.c[1], eye, bearing, score: cand.s, bagYear: cand.a.p.constructionYear ?? null, drawnStyle: cand.a.p.facadeStyle, facts: { fd: f.facadeDate?.term, cd: f.coreDate?.term, gable: f.gable, finish: f.finish, el: (f.elements ?? []).map((e: any) => e.key), bands: f.stoneBands, text: String(f.sourceText).slice(0, 160) } });
  }
}
// Nieuwmarkt 4-22 (the user's pinned row): the six pands of the regression, camera across the square.
const ROW: Record<string, string> = { '0363100012171851': 'Nieuwmarkt 6', '0363100012171854': 'Nieuwmarkt 8', '0363100012182849': 'Nieuwmarkt 10-12', '0363100012182848': 'Nieuwmarkt 14', '0363100012182847': 'Nieuwmarkt 16', '0363100012182857': 'Nieuwmarkt 20-22', '0363100012182858': 'Nieuwmarkt 18' };
const rowPands = all.filter(a => ROW[a.id.replace('NL.IMBAG.Pand.', '')]);
if (rowPands.length) {
  const cx = rowPands.reduce((s, a) => s + a.c[0], 0) / rowPands.length, cy = rowPands.reduce((s, a) => s + a.c[1], 0) / rowPands.length;
  const eye = [cx - 0.00060, cy + 0.00006];
  out.push({ slug: 'nieuwmarkt-4-22', name: 'Nieuwmarkt 4-22 (row by the Waag)', id: rowPands.map(a => a.id).join(','), lng: cx, lat: cy, eye, bearing: 90, score: 99, facts: { row: rowPands.map(a => ROW[a.id.replace('NL.IMBAG.Pand.', '')] + ':' + (facts[a.id]?.gable ?? '-')) } });
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(out.map(o => `${o.slug} score ${o.score} bag ${o.bagYear} ${o.drawnStyle} ${JSON.stringify(o.facts).slice(0, 150)}`).join('\n'));
