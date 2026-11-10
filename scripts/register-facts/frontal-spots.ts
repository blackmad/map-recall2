// Frontal review spots for the register-recipes verdict (2026-11-10): register pands in three buurten (plus the
// Nieuwmarkt 6-22 row) that state several drawable elements, each with its street wall and the straightest Gemeente
// Amsterdam panorama (CC BY 4.0) of that wall. The camera of the render stands where the panorama stands.
//   npx tsx scripts/register-facts/frontal-spots.ts <out.json> [perBuurt=8]
// Writes [{ slug, id, buurt, score, facts, wall, pano: { id, lng, lat, date, distM, obliquityDeg, heading } }].
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadTile, rdToLngLat, type Footprint } from '../pand-reference/core.ts';
import { selectPands } from '../pand-reference/select.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
const [outFile, perArg] = process.argv.slice(2);
const PER = Number(perArg) || 8;
const facts: Record<string, any> = JSON.parse(readFileSync(`${EXTRACT}/staging/monument-facts.json`, 'utf8')).buildings;
const buurten = JSON.parse(readFileSync(`${EXTRACT}/coverage-v1/buurten.json`, 'utf8')).features as any[];
const BUURTEN = ['Felix Meritisbuurt', 'Vijzelstraatbuurt', 'Langestraat e.o.'];
const ROW = ['0363100012171851', '0363100012171854', '0363100012182849', '0363100012182848', '0363100012182847', '0363100012182858', '0363100012182857'].map(n => `NL.IMBAG.Pand.${n}`);
type Ring = number[][];
const inside = ([x, y]: number[], ring: Ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; return c; };
const polys = (g: any): Ring[][] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const buurtAt = (p: number[]) => buurten.filter(b => BUURTEN.includes(b.properties?.name)).find(b => polys(b.geometry).some(poly => inside(p, poly[0])))?.properties?.name as string | undefined;

// Footprints of every register pand.
const fps = new Map<string, Footprint>();
const root = path.join(EXTRACT, 'building-tiles/14');
for (const x of readdirSync(root)) for (const f of readdirSync(path.join(root, x))) for (const fp of await loadTile(Number(x), Number(f.split('.')[0]))) if (facts[fp.id] && !fps.has(fp.id)) fps.set(fp.id, fp);

const DRAWN = new Set(['hoistBeam', 'stoop', 'crownCornice', 'corniceConsoles', 'doorSurround', 'balcony', 'shutters', 'anchors', 'gablestone', 'bayWindow', 'cellarEntrance', 'pilasters', 'dormer']);
const RARE = new Set(['shutters', 'balcony', 'bayWindow', 'hoistBeam', 'gablestone', 'anchors']);
const score = (f: any) => {
  const els = (f.elements ?? []).map((e: any) => e.key).filter((k: string) => DRAWN.has(k));
  return els.length + els.filter((k: string) => RARE.has(k)).length * 0.5 + (f.stoneBands ? 1 : 0) + (f.finish ? 1 : 0) + (f.facadeDate ? 0.5 : 0);
};
const area = (fp: Footprint) => { let a = 0; const r = fp.ring; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j].x * r[i].y - r[i].x * r[j].y; return Math.abs(a) / 2; };
const pool: Array<{ id: string; buurt: string; s: number }> = [];
for (const [id, fp] of fps) {
  const c = fp.ring.reduce((a, p) => ({ x: a.x + p.x / fp.ring.length, y: a.y + p.y / fp.ring.length }), { x: 0, y: 0 });
  const ll = rdToLngLat(c);
  const buurt = ROW.includes(id) ? 'Nieuwmarkt' : buurtAt(ll);
  if (!buurt) continue;
  const a = area(fp);
  if (!ROW.includes(id) && (a < 35 || a > 260 || fp.height < 8 || fp.height > 24)) continue;
  pool.push({ id, buurt, s: ROW.includes(id) ? 99 : score(facts[id]) });
}
const out: any[] = [];
for (const buurt of [...BUURTEN, 'Nieuwmarkt']) {
  const cands = pool.filter(p => p.buurt === buurt).sort((a, b) => b.s - a.s || a.id.localeCompare(b.id)).slice(0, buurt === 'Nieuwmarkt' ? 7 : PER * 3);
  let kept = 0;
  for (const sel of await selectPands(cands.map(c => c.id))) {
    if (kept >= (buurt === 'Nieuwmarkt' ? 7 : PER)) break;
    const p = sel.primary, w = sel.wall;
    if (!p || !w || p.obliquityDeg > 35) continue;
    const [plng, plat] = p.record.geometry.coordinates;
    const [mlng, mlat] = rdToLngLat(w.mid);
    const pr = { x: 0, y: 0 }; void pr;
    const f = facts[sel.pandId];
    out.push({
      slug: `${buurt.split(' ')[0].toLowerCase()}-${sel.pandId.slice(-6)}`, id: sel.pandId, buurt, score: cands.find(c => c.id === sel.pandId)!.s,
      facts: { fd: f.facadeDate?.term, cd: f.coreDate?.term, gable: f.gable, finish: f.finish, el: (f.elements ?? []).map((e: any) => e.key), bands: f.stoneBands, text: String(f.sourceText ?? '').slice(0, 400) },
      wall: { mid: [mlng, mlat], len: Math.round(w.len * 10) / 10, normalBearing: Math.round((Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360) },
      pano: { id: p.panoId, lng: plng, lat: plat, date: String(p.timestamp).slice(0, 10), distM: Math.round(p.distM * 10) / 10, obliquityDeg: Math.round(p.obliquityDeg) },
    });
    kept++;
  }
}
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(out.map(o => `${o.slug} s${o.score} pano ${o.pano.distM} m obl ${o.pano.obliquityDeg} ${JSON.stringify(o.facts).slice(0, 140)}`).join('\n'));
