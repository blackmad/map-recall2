/**
 * Shopfront templates (lane retail-ground-20261114): host every OSM shop/amenity node that asks for a template
 * (src/canalRecall/retailTemplates.ts templateForTags) on its pand, as build-shopfronts.ts hosts shops
 * (shopGate.ts hostForPoi, the BAG gate), count each template city-wide, in the centre (inside the Singelgracht
 * polygon below) and in the ring (within RING_KM of the Dam), and stage the extract.
 *
 *   node --import tsx scripts/retail-ground/build-templates.ts [--cache=.cache/retail-ground/overpass.json] [--samples=10]
 *   [--publish]
 *
 * Output: data/retail-ground/shop-templates.json (staged, reviewed) and, with --publish (the integrator's), the
 * browser copy public/data/extracts/amsterdam/shop-templates.json. Without --cache it fetches Overpass (the request
 * names the repo URL as contact) and writes the answer to .cache/retail-ground/overpass.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { hostForPoi, type BagUsesTable } from '../../src/canalRecall/shopGate.ts';
import { hostOnFront, ringEdges, insideRing as insideRingOf } from '../../src/canalRecall/retailHosting.ts';
import { FRONT_HIGHWAYS, SegmentGrid, streetDistance } from '../../src/canalRecall/streetFronts.ts';
import { CHAIN_TEMPLATES, RETAIL_TEMPLATES, TEMPLATE_LOOKS, signWord, templateForTags as typeForTags, type RetailTemplate } from '../../src/canalRecall/retailTemplates.ts';
import { RETAIL_CHAINS, chainForTags } from '../../src/canalRecall/retailChains.ts';
import { retailRealOn } from '../../src/canalRecall/retailPages.ts';
// Lane retail-real: a chain round 6 does not template (retailChains.ts) takes its type's template and the word '@<key>';
// RETAIL_REAL=0 stages round n's extract.
const chainOf = (tags: Record<string, string>): string | null => { if (!retailRealOn()) return null; const t = typeForTags(tags); return t && CHAIN_TEMPLATES.includes(t) ? null : chainForTags(tags); };
const templateForTags = (tags: Record<string, string>): RetailTemplate | null => { const c = chainOf(tags); return c ? RETAIL_CHAINS[c].template : typeForTags(tags); };
import { insideCentre, RING_KM, DAM } from '../../src/canalRecall/retailArea.ts';
import { streetPriors, type StreetRead } from '../../src/canalRecall/retailPuiPaint.ts';
import { bikeShopClass, bikeCode } from '../../src/canalRecall/retailBikes.ts';
import { addressPand, atOnStreetWall, matchAddress, type Vbo } from '../../src/canalRecall/retailAddress.ts';

import { CACHE, nodes, LAT0, KX, KY, local, grid, streets, walls, facing, open, near, bagUses, bagKey, namedSegs, lngLatOf, type Building, type Node } from './city.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const STAGING = 'data/retail-ground/shop-templates.json', PUBLISHED = 'public/data/extracts/amsterdam/shop-templates.json';

// `--explain=<osm node id>,...`: every footprint within 30 m of the node, with its distance, BAG uses and the host picked.
const explain = new Set((arg('explain') ?? '').split(',').filter(Boolean));
const placed = new Map<string, { chain?: string; t: RetailTemplate; at: [number, number]; front: 'street' | 'nearest'; name: string; tags: string; centre: boolean; ring: boolean; bike?: ReturnType<typeof bikeShopClass> }>();
const pois: Record<string, number> = {}, unhosted: Record<string, number> = {}, moved = { host: 0, nearest: 0, lost: 0, gained: 0 };
// Round 5: the pands some template POI sits on by the plain rules; a POI moves to a bigger shop next door
// (retailHosting.ts SPILL) only when no other POI holds it.
// Round 7: the address hosts staged by --addresses (retailAddress.ts): a node whose BAG address lies in another pand
// than its geometry picks is hosted on the address's pand, from the matching VBO's point.
const ADDRESS_HOSTS = 'data/retail-ground/address-hosts.json';
// Then the second sources' moves (second-sources.ts --apply, source-hosts.json); an address host outranks them. Its
// adds (businesses OSM lacks) join the OSM nodes.
const SOURCE_HOSTS = 'data/retail-ground/source-hosts.json';
const sourceHosts = (fs.existsSync(SOURCE_HOSTS) ? JSON.parse(fs.readFileSync(SOURCE_HOSTS, 'utf8')) : { hosts: {}, adds: [] }) as { hosts: Record<string, { pand: string; at: [number, number] }>; adds: Array<{ id: string; lon: number; lat: number; tags: Record<string, string> }> };
const addressHosts = new Map<string, { pand: string; at: [number, number] }>([...Object.entries(sourceHosts.hosts), ...(fs.existsSync(ADDRESS_HOSTS) ? Object.entries((JSON.parse(fs.readFileSync(ADDRESS_HOSTS, 'utf8')) as { hosts: Record<string, { pand: string; at: [number, number] }> }).hosts) : [])]);
const sourceAdds: Node[] = sourceHosts.adds.map((a, i) => ({ id: -(i + 1), lat: a.lat, lon: a.lon, tags: { ...a.tags, 'source:retail': a.id } }));
const allNodes = [...await nodes(), ...sourceAdds];
let addressed = 0;
const byAddress = (n: Node) => {
  const a = addressHosts.get(String(n.id)); if (!a) return null;
  const [x, y] = local(a.at[0], a.at[1]), pand = near(x, y).find(c => bagKey(c.id) === a.pand);
  return pand ? hostOnFront([pand], x, y, id => bagUses[bagKey(id)], facing, open) : null;
};
const occupied = new Set<string>();
for (const n of allNodes) {
  const tags = n.tags ?? {};
  if (Number(tags.level) > 0 || !templateForTags(tags)) continue;
  const [x, y] = local(n.lon, n.lat), h = byAddress(n) ?? hostOnFront(near(x, y), x, y, id => bagUses[bagKey(id)], facing, open);
  if (h) occupied.add(h.id);
}
let spilled = 0, added = 0, onStreet = 0;
const records: { n: Node; t: RetailTemplate; hit: ReturnType<typeof hostOnFront>; plain: ReturnType<typeof hostOnFront> }[] = [];
for (const n of allNodes) {
  const tags = n.tags ?? {};
  if (Number(tags.level) > 0) continue;
  const t = templateForTags(tags);
  if (t && n.id < 0) added++;
  if (!t) continue;
  pois[t] = (pois[t] ?? 0) + 1;
  const [x, y] = local(n.lon, n.lat);
  const plain = hostOnFront(near(x, y), x, y, id => bagUses[bagKey(id)], facing, open), moved1 = t !== 'redLight' ? hostOnFront(near(x, y), x, y, id => bagUses[bagKey(id)], facing, open, true) : plain;
  const addr = byAddress(n); if (addr) addressed++;
  const hit = addr ?? (moved1 && plain && moved1.id !== plain.id && occupied.has(moved1.id) ? plain : moved1);
  records.push({ n, t, hit, plain });
  if (hit && plain && hit.id !== plain.id) { spilled++; if (explain.size) console.log(`spill ${n.id} ${tags.name ?? ''}: ${bagKey(plain.id)} -> ${bagKey(hit.id)}`); }
  if (explain.has(String(n.id))) {
    console.log(`explain ${n.id} ${tags.name ?? ''} -> ${t} host ${hit ? `${bagKey(hit.id)} ${hit.inside ? 'inside' : 'outside'}, ${hit.front} front ${hit.distanceM.toFixed(1)} m` : 'none'}`);
    for (const c of near(x, y).map(c => ({ c, d: edgeDistM(c.ring, x, y) })).filter(v => v.d < 30).sort((a, b) => a.d - b.d)) {
      console.log(`  ${bagKey(c.c.id)} ${c.d.toFixed(1)} m ${JSON.stringify(bagUses[bagKey(c.c.id)] ?? null)}`);
      if (c.d < 8) for (const e of ringEdges(c.c.ring)) { const d = Math.hypot(...[0, 0]) + edgeDistM([[e.x0, e.y0], [e.x1, e.y1]], x, y); if (d < 12) console.log(`    wall ${e.len.toFixed(1)} m at ${d.toFixed(1)} m: street ${facing(c.c, e)} open ${open(c.c, e)}`); }
    }
  }
  const old = hostForPoi(near(x, y), x, y, id => bagUses[bagKey(id)]);
  if (old && !hit) moved.lost++; else if (!old && hit) moved.gained++; else if (old && hit && old.id !== hit.id) moved.host++;
  if (hit?.front === 'nearest') moved.nearest++;
  if (!hit) { unhosted[t] = (unhosted[t] ?? 0) + 1; continue; }
  // A chain outranks a type on one pand (an AH with a bar upstairs mapped at street level stays the AH).
  const held = placed.get(hit.id);
  if (held && RETAIL_TEMPLATES.indexOf(held.t) <= RETAIL_TEMPLATES.indexOf(t)) continue;
  const ring = Math.hypot((n.lon - DAM[0]) * KX, (n.lat - DAM[1]) * KY) / 1000 <= RING_KM;
  // Round 8: on a corner pand, the front goes on the wall facing the node's addr:street (retailAddress.ts atOnStreetWall).
  let at: [number, number] = [n.lon, n.lat];
  const pand = tags['addr:street'] && hit.front === 'street' ? near(x, y).find(c => c.id === hit.id) : undefined;
  if (pand) { const p = atOnStreetWall(pand.ring, x, y, tags['addr:street'], namedSegs.filter(s => Math.abs(s.x0 - x) < 80 && Math.abs(s.y0 - y) < 80)); if (p && Math.hypot(p[0] - x, p[1] - y) > 0.5) { at = lngLatOf(p[0], p[1]); onStreet++; } }
  placed.set(hit.id, { ...(chainOf(tags) ? { chain: chainOf(tags)! } : {}), t, at: [Math.round(at[0] * 1e6) / 1e6, Math.round(at[1] * 1e6) / 1e6], front: hit.front, name: tags.name ?? '', tags: Object.entries(tags).filter(([k]) => /^(shop|amenity|cuisine|brand|name|addr:street|addr:housenumber|bar|origin)$/.test(k)).map(([k, v]) => `${k}=${v}`).join(' '), centre: insideCentre(n.lon, n.lat), ring, ...(t === 'bike' ? { bike: bikeShopClass(tags) } : {}) });
}

const rows = RETAIL_TEMPLATES.map(t => {
  const all = [...placed.values()].filter(p => p.t === t);
  return { t, pois: pois[t] ?? 0, unhosted: unhosted[t] ?? 0, pands: all.length, ring: all.filter(p => p.ring).length, centre: all.filter(p => p.centre).length };
});
console.log('template        POIs  unhosted  pands  ring(<=' + RING_KM + 'km Dam)  centre(Singelgracht)');
for (const r of rows) console.log(`${r.t.padEnd(14)} ${String(r.pois).padStart(5)} ${String(r.unhosted).padStart(9)} ${String(r.pands).padStart(6)} ${String(r.ring).padStart(8)} ${String(r.centre).padStart(8)}`);
// The named hosting regressions (retailGround.test.ts): each node's candidates within 30 m, rings in local metres
// around the node, and each wall's street/open reading, so the test runs hostOnFront without the city.
const REGRESSIONS: Record<string, string> = { '2809217417': 'Kinkerstraat 252-H, MapFour (bike)', '2809219299': 'Kinkerstraat 288, Cycle (bike)', '5198582619': 'Nieuwe Hemweg 11, AH to go at a BP station: its front, not the car wash', '10829630288': 'Haarlemmerdijk 95, Keurslagerij Pouw: the 15 m white shopfront next door (349 m2 shop), not the 23 m2 unit its node falls in' };
if (process.argv.includes('--fixture')) {
  const cases = [];
  for (const n of await nodes()) {
    if (!REGRESSIONS[String(n.id)]) continue;
    const [x, y] = local(n.lon, n.lat), cands = near(x, y).filter(c => edgeDistM(c.ring, x, y) < 30 || insideRingOf(c.ring, x, y));
    const hit = hostOnFront(cands, x, y, id => bagUses[bagKey(id)], facing, open, true);
    cases.push({ node: n.id, what: REGRESSIONS[String(n.id)], expect: hit && { pand: bagKey(hit.id), front: hit.front },
      candidates: cands.map(c => ({ id: bagKey(c.id), uses: bagUses[bagKey(c.id)] ?? null, ring: c.ring.map(([px, py]) => [+(px - x).toFixed(2), +(py - y).toFixed(2)]), street: ringEdges(c.ring).map(e => facing(c, e)), open: ringEdges(c.ring).map(e => open(c, e)) })) });
  }
  fs.writeFileSync('data/retail-ground/hosting-regressions.json', JSON.stringify({ note: 'scripts/retail-ground/build-templates.ts --fixture; node at the origin, metres east/north', cases }, null, 1));
  console.log(`fixture: ${cases.length} regressions -> data/retail-ground/hosting-regressions.json`);
}
console.log(`hosting vs shopGate.hostForPoi: ${moved.host} on another pand, ${moved.lost} dropped, ${moved.gained} gained; ${moved.nearest} fronts on the node's nearest open wall (no street wall within ${6} m)`);
const samples = Number(arg('samples') ?? 0);
if (samples) {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (const t of RETAIL_TEMPLATES) {
    const all = [...placed].filter(([, p]) => p.t === t), pick = all.map(v => [rnd(), v] as const).sort((a, b) => a[0] - b[0]).slice(0, samples).map(v => v[1]);
    for (const [id, p] of pick) console.log(`sample ${t} ${bagKey(id)} ${p.at.join(',')} ${p.tags}`);
  }
}
const out = { version: 1, source: '© OpenStreetMap contributors (ODbL), Overpass ' + new Date(fs.statSync(CACHE).mtime).toISOString().slice(0, 10), templates: [...RETAIL_TEMPLATES], buildings: Object.fromEntries([...placed].sort().map(([id, p]) => [id, [RETAIL_TEMPLATES.indexOf(p.t), p.at[0], p.at[1], ...(p.chain ? [`@${p.chain}`] : TEMPLATE_LOOKS[p.t].word === 'name' && signWord(p.name) ? [signWord(p.name)] : p.front === 'nearest' ? [''] : []), ...(p.front === 'nearest' ? [1] : [])]])) };
// Lane retail-real (coordinator 2026-11-16): lane R's De Wallen audit (data/retail-ground/dewallen-redlight-audit.json,
// from 394d2f52b, used as data). The 27 window rows carry their measured window front as the row's sixth field
// ({s: [lng0, lat0, lng1, lat1] the span on the front line, d doors, t tube, c curtains, f frame hex}); the 18 closed or
// not-a-window pands and the 3 read-not-drawn ones lose the redLight template under retailReal ({x: 1}); the 21 with no
// view keep it.
const AUDIT = 'data/retail-ground/dewallen-redlight-audit.json';
if (fs.existsSync(AUDIT)) {
  type WF = { a0: number; a1: number; doors?: number; tube?: string; curtains?: string; frameHex?: string };
  const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8')) as { fronts: Array<{ pandId: string; frontLine: [[number, number], [number, number]]; windowFront: WF }>; notWindow: Array<{ pandId: string }>; readNotDrawn: Array<{ pandId: string }> };
  const rows = out.buildings as Record<string, unknown[]>, red = RETAIL_TEMPLATES.indexOf('redLight');
  const key = (id: string) => (rows[id] ? id : rows[`NL.IMBAG.Pand.${id}`] ? `NL.IMBAG.Pand.${id}` : null);
  let drawn = 0, dropped = 0;
  for (const f of audit.fronts) {
    const k = key(f.pandId); if (!k || rows[k][0] !== red) continue;
    const [[x0, y0], [x1, y1]] = f.frontLine, w = f.windowFront, at = (t: number) => [+(x0 + (x1 - x0) * t).toFixed(7), +(y0 + (y1 - y0) * t).toFixed(7)];
    const [ax, ay] = at(w.a0), [bx, by] = at(w.a1), mid = at((w.a0 + w.a1) / 2);
    rows[k] = [red, mid[0], mid[1], '', 0, { s: [ax, ay, bx, by], ...(w.doors ? { d: w.doors } : {}), ...(w.tube ? { t: w.tube } : {}), ...(w.curtains ? { c: w.curtains } : {}), ...(w.frameHex ? { f: w.frameHex } : {}) }];
    drawn++;
  }
  // Marked {x: 1} rather than deleted, so `?retailReal=0` still draws round n's front there.
  for (const f of [...audit.notWindow, ...audit.readNotDrawn]) { const k = key(f.pandId); if (k && rows[k][0] === red) { const r = rows[k]; rows[k] = [r[0], r[1], r[2], r[3] ?? '', r[4] ?? 0, { x: 1 }]; dropped++; } }
  console.log(`De Wallen audit: ${drawn} measured window fronts, ${dropped} redLight templates dropped (closed, not a window, or read not drawn)`);
}
// Round 4: the pui paint measured on street panoramas (measure-pui.ts; receipts stay in its file), for any shop pand.
const PUI = 'data/retail-ground/pui-paint.json';
if (fs.existsSync(PUI)) {
  const pui = JSON.parse(fs.readFileSync(PUI, 'utf8')) as { buildings: Record<string, { paint?: string }> };
  const paint = Object.fromEntries(Object.entries(pui.buildings).filter(([, v]) => typeof v.paint === 'string').map(([id, v]) => [id, v.paint!]).sort((a, b) => a[0] < b[0] ? -1 : 1));
  Object.assign(out, { paint });
  // Round 5b: which readings were dark (only a pale guess gives way to them: retailPuiPaint.ts paintOverGuess).
  Object.assign(out, { dark: Object.entries(pui.buildings as Record<string, { cls?: string }>).filter(([id, v]) => v.cls === 'dark' && paint[id]).map(([id]) => id).sort() });
  console.log(`pui paint: ${Object.keys(paint).length} pands (${Object.keys(paint).filter(id => out.buildings[id]).length} with a template)`);
  // Round 5: the street prior for unmeasured plain shops (retailPuiPaint.ts streetPriors). A pand's street is the named
  // street way nearest its centroid within PRIOR_STREET_M.
  const PRIOR_STREET_M = 30;
  const named: { name: string; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (const w of JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as Array<{ name?: string; highway?: string; path: [number, number][] }>) {
    if (!w.name || (w.highway && !FRONT_HIGHWAYS.has(w.highway))) continue;
    for (let i = 1; i < w.path.length; i++) { const a = local(w.path[i - 1][1], w.path[i - 1][0]), b = local(w.path[i][1], w.path[i][0]); named.push({ name: w.name, x0: a[0], y0: a[1], x1: b[0], y1: b[1] }); }
  }
  const namedGrid = new SegmentGrid(Float32Array.from(named.flatMap(n => [n.x0, n.y0, n.x1, n.y1])));
  const byId = new Map<string, Building>(); for (const list of grid.values()) for (const b of list) byId.set(b.id, b);
  const streetOf = (id: string): string => {
    const b = byId.get(id); if (!b) return '';
    let best = '', bd = PRIOR_STREET_M;
    for (const i of namedGrid.near(b.cx - PRIOR_STREET_M, b.cy - PRIOR_STREET_M, b.cx + PRIOR_STREET_M, b.cy + PRIOR_STREET_M)) { const n = named[i], d = edgeDistM([[n.x0, n.y0], [n.x1, n.y1]], b.cx, b.cy); if (d < bd) { bd = d; best = n.name; } }
    return best;
  };
  const reads: StreetRead[] = Object.entries(pui.buildings as Record<string, { paint?: string; cls?: StreetRead['cls'] }>).filter(([, v]) => v.paint && v.cls).map(([id, v]) => ({ street: streetOf(id), cls: v.cls!, paint: v.paint! }));
  const priors = streetPriors(reads);
  const plainShops = Object.keys((JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/shopfronts.json', 'utf8')) as { buildings: Record<string, number> }).buildings).filter(id => !out.buildings[id] && !paint[id]);
  const prior: Record<string, string> = {};
  for (const id of plainShops.sort()) { const p = priors.get(streetOf(id)); if (p) prior[id] = p.paint; }
  Object.assign(out, { prior });
  const cls = [...priors.values()].reduce((m, p) => (m[p.cls] = (m[p.cls] ?? 0) + 1, m), {} as Record<string, number>);
  console.log(`street priors: ${priors.size} streets (${JSON.stringify(cls)}); ${Object.keys(prior).length} of ${plainShops.length} unmeasured plain shops take one`);
}
// Round 7: the awnings measured on panoramas (measure-awning.ts), for template pands.
{
  const AWN = 'data/retail-ground/awnings.json';
  if (fs.existsSync(AWN)) {
    const a = (JSON.parse(fs.readFileSync(AWN, 'utf8')) as { buildings: Record<string, { hex: string }> }).buildings;
    const awnings = Object.fromEntries(Object.entries(a).map(([k, v]) => [`NL.IMBAG.Pand.${k}`, v.hex] as const).filter(([id]) => out.buildings[id]).sort((p, q) => p[0] < q[0] ? -1 : 1));
    if (Object.keys(awnings).length) Object.assign(out, { awnings });
    console.log(`awnings: ${Object.keys(awnings).length} of ${Object.keys(a).length} measured pands have a template`);
  }
}
// Round 6: each bike shop's class (retailBikes.ts BIKE_RULE: used, premium or rental), which decides what stands outside
// and in the window; the rule, the counts per class and step, and the panorama spot check go to bike-classes.json.
{
  const bikes = [...placed].filter(([, p]) => p.bike).sort((a, b) => a[0] < b[0] ? -1 : 1);
  Object.assign(out, { bikes: Object.fromEntries(bikes.map(([id, p]) => [id, bikeCode(p.bike!)])) });
  const count = (f: (b: ReturnType<typeof bikeShopClass>) => string) => bikes.reduce((m, [, p]) => (m[f(p.bike!)] = (m[f(p.bike!)] ?? 0) + 1, m), {} as Record<string, number>);
  const BIKES = 'data/retail-ground/bike-classes.json', prev = fs.existsSync(BIKES) ? JSON.parse(fs.readFileSync(BIKES, 'utf8')) : {};
  fs.writeFileSync(BIKES, JSON.stringify({ ...prev, rule: 'src/canalRecall/retailBikes.ts BIKE_RULE (header comment), first match wins', classes: count(b => b.cls), steps: count(b => `${b.step} ${b.cls}: ${b.why}`), ringByClass: bikes.filter(([, p]) => p.ring).reduce((m, [, p]) => (m[p.bike!.cls] = (m[p.bike!.cls] ?? 0) + 1, m), {} as Record<string, number>) }, null, 1));
  console.log(`bike classes: ${JSON.stringify(count(b => b.cls))} (ring ${bikes.filter(([, p]) => p.ring).length}) -> ${BIKES}`);
}
if (process.argv.includes('--addresses')) await auditAddresses();
console.log(`address and source hosts (${ADDRESS_HOSTS}, ${SOURCE_HOSTS}): ${addressed} POIs hosted by an address or second source; ${added} template POIs added by a second source`);
fs.mkdirSync(path.dirname(STAGING), { recursive: true });
fs.writeFileSync(STAGING, JSON.stringify(out));
console.log(`fronts moved onto the wall facing addr:street (atOnStreetWall): ${onStreet}`);
console.log(`spill (retailHosting.ts SPILL): ${spilled} POIs moved to a much bigger shop next door`);
console.log(`staged ${placed.size} pands -> ${STAGING} (${(fs.statSync(STAGING).size / 1024).toFixed(0)} KB)`);
if (process.argv.includes('--publish')) { fs.copyFileSync(STAGING, PUBLISHED); console.log(`published -> ${PUBLISHED}`); }

function edgeDistM(ring: [number, number][], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < ring.length; i++) { const [ax, ay] = ring[i], [bx, by] = ring[i + 1], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0; best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t)); }
  return best;
}

// Round 7 audit (--addresses): every bike shop, every POI sharing its host pand with another POI and every POI
// within AUDIT_NEIGHBOUR_M of another POI hosted elsewhere. For each with addr:street + addr:housenumber, fetch the BAG
// VBOs within VBO_BOX_M (PDOK BAG OGC v2, cached per node), find the pand holding the address and compare it with the
// geometric host. Writes data/retail-ground/hosting-audit.json and stages the differing ones in address-hosts.json.
async function auditAddresses() {
  const AUDIT_NEIGHBOUR_M = 12, VBO_BOX_M = 30, DIR = '.cache/retail-ground/vbo';
  fs.mkdirSync(DIR, { recursive: true });
  const byHost = new Map<string, number>(); for (const r of records) if (r.hit) byHost.set(r.hit.id, (byHost.get(r.hit.id) ?? 0) + 1);
  const pts = records.map(r => local(r.n.lon, r.n.lat));
  const why = (i: number): string => {
    const r = records[i];
    if (r.t === 'bike') return 'bike';
    if (r.hit && byHost.get(r.hit.id)! > 1) return 'shared';
    for (let j = 0; j < records.length; j++) if (j !== i && Math.abs(pts[j][0] - pts[i][0]) < AUDIT_NEIGHBOUR_M && Math.abs(pts[j][1] - pts[i][1]) < AUDIT_NEIGHBOUR_M && Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]) < AUDIT_NEIGHBOUR_M && records[j].hit?.id !== r.hit?.id) return 'neighbour';
    return '';
  };
  const audit: Array<{ node: number; name: string; t: string; why: string; addr: string; status: string; host: string | null; address: string | null; vbo?: [number, number] }> = [];
  const dLat = VBO_BOX_M / KY, dLon = VBO_BOX_M / KX;
  let fetched = 0;
  for (let i = 0; i < records.length; i++) {
    const w = why(i); if (!w) continue;
    const { n, t, hit } = records[i], tags = n.tags ?? {}, addr = `${tags['addr:street'] ?? ''} ${tags['addr:housenumber'] ?? ''}`.trim();
    const row = { node: n.id, name: tags.name ?? '', t, why: w, addr, status: 'no-address', host: hit ? bagKey(hit.id) : null, address: null as string | null } as (typeof audit)[number];
    audit.push(row);
    if (!tags['addr:street'] || !tags['addr:housenumber']) continue;
    const file = path.join(DIR, `${n.id}.json`);
    if (!fs.existsSync(file)) {
      const url = `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?f=json&limit=1000&bbox=${(n.lon - dLon).toFixed(6)},${(n.lat - dLat).toFixed(6)},${(n.lon + dLon).toFixed(6)},${(n.lat + dLat).toFixed(6)}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)' } });
      if (!res.ok) { row.status = `fetch ${res.status}`; continue; }
      const j = await res.json() as { features: Array<{ properties: Record<string, unknown>; geometry: { coordinates: [number, number] } }> };
      const slim: Vbo[] = j.features.map(f => ({ street: String(f.properties.openbare_ruimte_naam ?? ''), short: String(f.properties.openbare_ruimte_naam_kort ?? ''), nr: Number(f.properties.huisnummer), letter: (f.properties.huisletter as string | null) ?? null, add: (f.properties.toevoeging as string | null) ?? null, use: String(f.properties.gebruiksdoel ?? ''), m2: Number(f.properties.oppervlakte ?? 0), at: [+f.geometry.coordinates[0].toFixed(7), +f.geometry.coordinates[1].toFixed(7)] }));
      fs.writeFileSync(file, JSON.stringify({ url, fetched: new Date().toISOString().slice(0, 10), vbos: slim }));
      fetched++;
    }
    const vbos = (JSON.parse(fs.readFileSync(file, 'utf8')) as { vbos: Vbo[] }).vbos;
    const hits = matchAddress(tags['addr:street'], tags['addr:housenumber'], vbos);
    if (!hits.length) { row.status = 'no-match'; continue; }
    const [x, y] = local(n.lon, n.lat);
    const local1 = hits.map(v => ({ ...v, at: local(v.at[0], v.at[1]) }));
    const pand = addressPand(local1, near(x, y), insideRingOf);
    if (!pand) { row.status = 'no-pand'; continue; }
    row.address = bagKey(pand.id);
    const best = hits.find(v => insideRingOf(pand.ring, ...local(v.at[0], v.at[1])))!;
    row.vbo = best.at;
    row.status = row.address === row.host ? 'match' : 'moved';
  }
  const count = (k: 'status' | 'why') => audit.reduce((m, r) => (m[r[k]] = (m[r[k]] ?? 0) + 1, m), {} as Record<string, number>);
  const byWhy: Record<string, Record<string, number>> = {};
  for (const r of audit) { byWhy[r.why] ??= {}; byWhy[r.why][r.status] = (byWhy[r.why][r.status] ?? 0) + 1; }
  fs.writeFileSync('data/retail-ground/hosting-audit.json', JSON.stringify({ rule: 'src/canalRecall/retailAddress.ts; build-templates.ts auditAddresses', date: new Date().toISOString().slice(0, 10), source: 'BAG verblijfsobject, PDOK OGC API v2 (CC0)', status: count('status'), byWhy, moved: audit.filter(r => r.status === 'moved'), rows: audit }));
  const hosts = Object.fromEntries(audit.filter(r => r.status === 'moved').map(r => [String(r.node), { pand: r.address!, at: r.vbo!, addr: r.addr, name: r.name, was: r.host }]));
  fs.writeFileSync(ADDRESS_HOSTS, JSON.stringify({ note: 'build-templates.ts --addresses: OSM nodes whose BAG address lies in another pand than the geometric host; the build hosts them here', hosts }, null, 1));
  console.log(`address audit: ${audit.length} POIs (${JSON.stringify(count('why'))}), ${fetched} fetched; ${JSON.stringify(count('status'))} -> data/retail-ground/hosting-audit.json, ${ADDRESS_HOSTS}`);
}
