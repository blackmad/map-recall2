/**
 * Lane retail-real round 5: why a templated pand may carry the wrong shop. Reads a hosting trace
 * (build-templates.ts --trace=<file>) and flags every placed pand with the systematic causes we can test in Node:
 *
 *   closed     an Overture place of the same name within MATCH_M is permanently_closed and none is open
 *   unlisted   no Overture place of the same name within MATCH_M (Overture lists ~60k open places in the box)
 *   other      an open Overture place (confidence >= 0.7) stands inside the host pand and none of those shares the name
 *   noShop     the host pand has no BAG shop or horeca space (homes, offices only)
 *   homes      an Amsterdam (0363) host pand missing from the BAG uses table (non-residential VBOs in use): homes only
 *   noBag      a host pand outside Amsterdam municipality (the table does not cover it)
 *   level      the node carries level < 0 or a multi-level value
 *   outside    the node lies in no footprint (hosted from the pavement)
 *   moved      hosted on another pand than the one its point lies in (spill, address, second source, pavement)
 *   multi      more than one template POI hosted on the pand (the winner is RETAIL_TEMPLATES order)
 *   party      the node lies within PARTY_M of a wall it shares with another footprint
 *   noName     the winning node has no name
 *
 *   node --import tsx scripts/retail-ground/audit-assignment.ts --trace=<file> [--out=<json>] [--sample=<n per flag>]
 *
 * Writes the per-pand flags and counts; with --sample, a stratified sample (n per flag plus n unflagged controls) as a
 * node list and a hosts file for front-photos.ts --hosts.
 */
import fs from 'node:fs';
import { sameName, MATCH_M } from '../../src/canalRecall/retailSources.ts';
import { insideRing, ringEdges, segDist } from '../../src/canalRecall/retailHosting.ts';
import { insideCentre } from '../../src/canalRecall/retailArea.ts';
import { local, near, bagUses, bagKey, KX, KY } from './city.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
export type TraceRow = { node: number; t: string; chain: string | null; tags: Record<string, string>; lon: number; lat: number; inPand: string | null; plain: string | null; host: string | null; front: string | null; distM: number | null; won: boolean };
const trace = JSON.parse(fs.readFileSync(arg('trace')!, 'utf8')) as TraceRow[];
const OUT = arg('out') ?? 'artifacts/retail-real/r5/audit.json';
const PARTY_M = 1.0, OTHER_CONF = 0.7;

type Place = { name: string | null; status: string | null; confidence: number; cat: string | null; lng: number; lat: number };
const places = (JSON.parse(fs.readFileSync('.cache/retail-ground/overture/places-2026-10-21.0.json', 'utf8')) as { places: Place[] }).places.filter(p => p.name);
const CELL = 100, pgrid = new Map<string, Place[]>();
for (const p of places) { const [x, y] = local(p.lng, p.lat), k = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`; let l = pgrid.get(k); if (!l) pgrid.set(k, l = []); l.push(p); }
const placesNear = (x: number, y: number) => { const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL), out: Place[] = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(...(pgrid.get(`${gx + dx},${gy + dy}`) ?? [])); return out; };
const dist = (x: number, y: number, p: Place) => { const [px, py] = local(p.lng, p.lat); return Math.hypot(px - x, py - y); };

const byHost = new Map<string, TraceRow[]>();
for (const r of trace) if (r.host) { let l = byHost.get(r.host); if (!l) byHost.set(r.host, l = []); l.push(r); }
const shopM2 = (pand: string) => { const u = bagUses[pand]; return (u?.area.winkelfunctie ?? 0) + (u?.area.bijeenkomstfunctie ?? 0); };
const ringOf = (pand: string, x: number, y: number) => near(x, y).find(c => bagKey(c.id) === pand);

export type PandAudit = { pand: string; node: number; t: string; name: string; tags: string; centre: boolean; flags: string[]; others: string[]; overture: string[]; shopM2: number; lon: number; lat: number };
const rows: PandAudit[] = [];
for (const [pand, list] of byHost) {
  const w = list.find(r => r.won); if (!w) continue;
  const [x, y] = local(w.lon, w.lat), name = w.tags.name ?? w.tags.brand ?? '', flags: string[] = [];
  const pl = placesNear(x, y);
  if (name) {
    const same = pl.filter(p => dist(x, y, p) <= MATCH_M && sameName(name, p.name!));
    if (!same.length) flags.push('unlisted');
    else if (same.every(p => p.status === 'permanently_closed')) flags.push('closed');
  } else flags.push('noName');
  const host = ringOf(pand, x, y);
  const inHost = host ? pl.filter(p => p.status !== 'permanently_closed' && p.confidence >= OTHER_CONF && insideRing(host.ring, ...local(p.lng, p.lat))) : [];
  if (inHost.length && !inHost.some(p => sameName(name, p.name!))) flags.push('other');
  // The BAG uses table lists Amsterdam's (0363) pands with a non-residential VBO in use: missing there means homes only.
  if (!bagUses[pand]) flags.push(pand.startsWith('0363') ? 'homes' : 'noBag'); else if (shopM2(pand) === 0) flags.push('noShop');
  const lv = w.tags.level; if (lv !== undefined && !(Number(lv) === 0)) flags.push('level');
  if (!w.inPand) flags.push('outside');
  else if (w.inPand !== pand) flags.push('moved');
  if (list.length > 1) flags.push('multi');
  const own = w.inPand ? ringOf(w.inPand, x, y) : undefined;
  if (own) {
    const ids = near(x, y).filter(c => c !== own);
    for (const e of ringEdges(own.ring)) {
      if (segDist(e.x0, e.y0, e.x1, e.y1, x, y) > PARTY_M) continue;
      const mx = (e.x0 + e.x1) / 2, my = (e.y0 + e.y1) / 2;
      if (ids.some(c => ringEdges(c.ring).some(f => segDist(f.x0, f.y0, f.x1, f.y1, mx, my) < 0.3))) { flags.push('party'); break; }
    }
  }
  rows.push({ pand, node: w.node, t: w.t, name, tags: Object.entries(w.tags).filter(([k]) => /^(shop|amenity|cuisine|brand|name|level|addr:street|addr:housenumber|check_date|opening_hours)$/.test(k)).map(([k, v]) => `${k}=${v}`).join(' '), centre: insideCentre(w.lon, w.lat), flags,
    others: list.filter(r => r !== w).map(r => `${r.t}:${r.tags.name ?? ''}`), overture: inHost.slice(0, 4).map(p => `${p.name} (${p.cat ?? '?'})`), shopM2: shopM2(pand), lon: w.lon, lat: w.lat });
}
const count: Record<string, number> = {};
for (const r of rows) { for (const f of r.flags) count[f] = (count[f] ?? 0) + 1; if (!r.flags.length) count.clean = (count.clean ?? 0) + 1; }
const centreCount: Record<string, number> = {};
for (const r of rows.filter(r => r.centre)) { for (const f of r.flags) centreCount[f] = (centreCount[f] ?? 0) + 1; if (!r.flags.length) centreCount.clean = (centreCount.clean ?? 0) + 1; }
fs.writeFileSync(OUT, JSON.stringify({ trace: arg('trace'), pands: rows.length, count, centreCount, rows }, null, 0));
console.log(`${rows.length} pands; flags ${JSON.stringify(count)}; centre (${rows.filter(r => r.centre).length}) ${JSON.stringify(centreCount)} -> ${OUT}`);

const per = Number(arg('sample') ?? 0);
if (per) {
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const shuffled = rows.filter(r => r.node > 0).map(r => [rnd() - (r.centre ? 0.5 : 0), r] as const).sort((a, b) => a[0] - b[0]).map(v => v[1]);
  const pick = new Map<string, PandAudit & { stratum: string }>();
  for (const f of [...Object.keys(count).filter(f => f !== 'clean'), 'clean']) {
    let n = 0;
    for (const r of shuffled) { if (n >= per) break; if (pick.has(r.pand)) continue; if (f === 'clean' ? r.flags.length : !r.flags.includes(f)) continue; pick.set(r.pand, { ...r, stratum: f }); n++; }
  }
  const sample = [...pick.values()];
  fs.writeFileSync(OUT.replace(/\.json$/, '-sample.json'), JSON.stringify(sample, null, 1));
  fs.writeFileSync(OUT.replace(/\.json$/, '-hosts.json'), JSON.stringify(Object.fromEntries(sample.map(r => [r.node, { pand: r.pand }]))));
  console.log(`sample ${sample.length}: ${sample.map(r => r.node).join(',')}`);
}
void KX; void KY;
