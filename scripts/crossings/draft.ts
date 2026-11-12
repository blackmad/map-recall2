// Draft crossing records for one area of the register (lane G3, 2026-11-10; src/canalRecall/ownGround/crossings.ts).
//
//   npx tsx scripts/crossings/draft.ts --area named|ring-rail|a10|tunnels [--game] [--out artifacts/crossings/drafts]
//   npx tsx scripts/crossings/draft.ts --help
//
// Drafts are guesses: every one is reviewed by eye (scripts/crossings/review-sheet.ts) before it is copied into
// data/crossings/<area>.json with `reviewed` set. The draft never writes the register itself.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import { AREAS, areaBoxes, type Area } from './areas.ts';
import { ahn, ahnMedian, bgt, overpassWays, type BgtFeature, type LngLat, type OsmWayFull } from './sources.ts';
import type { Carries, CrossingKind, CrossingRecord } from '../../src/canalRecall/ownGround/crossings.ts';
import { insideRing } from '../../src/canalRecall/ownGround/crossings.ts';

export const HELP = `crossings:draft — draft crossing records for one register area from open data.

  npx tsx scripts/crossings/draft.ts --area <id> [--game] [--out <dir>]

  --area   one of ${Object.keys(AREAS).join(', ')} (scripts/crossings/areas.ts)
  --game   also list what the game infers there (tunnels.ts cuts, railSpans.ts spans) and flag inference no survey
           structure backs (slow: builds the cells in Node)
  --out    output directory (default artifacts/crossings/drafts); writes <area>.json and <area>-report.json

Sources (cached under artifacts/crossings/raw): BGT overbruggingsdeel, tunneldeel, kunstwerkdeel_vlak, spoor,
wegdeel, waterdeel and scheiding_lijn (PDOK OGC API, CC0); OSM highways from own-ground-osm-v1 and railways from
Overpass (ODbL); AHN4 dtm_05m / dsm_05m (PDOK WCS, CC0).

A candidate is a cluster of touching BGT deck polygons (overbruggingsdeel other than pijler and landhoofd) or of
tunnel parts (tunneldeel). It is classified by what runs over it (OSM bridge ways, BGT spoor at hoogteligging >= 1)
and under it (OSM ways at grade, BGT spoor at 0); decks over water with nothing else under them are canal bridges
and are counted, not drafted. Disagreements between tags, the survey and the terrain are listed per record and in
the report: untagged decks, OSM bridges over land with no BGT deck, OSM tunnels with no structure, and (--game)
cuts and spans the survey does not back.`;

const args = process.argv.slice(2);
const argOf = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const KX = 111320 * Math.cos((52.37 * Math.PI) / 180), KY = 110540;
type P = [number, number];
const toM = (p: LngLat, o: LngLat): P => [(p[0] - o[0]) * KX, (p[1] - o[1]) * KY];
const toLL = (p: P, o: LngLat): LngLat => [+(o[0] + p[0] / KX).toFixed(7), +(o[1] + p[1] / KY).toFixed(7)];
const round = (v: number, d = 2) => +v.toFixed(d);
const median = (v: number[]) => { const s = v.filter(x => x === x).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };

const OSM_ROOT = 'public/data/extracts/amsterdam/own-ground-osm-v1';
function osmHighways(boxes: readonly number[][]): OsmWayFull[] {
  const cells = JSON.parse(readFileSync(join(OSM_ROOT, 'cells.json'), 'utf8')) as { cellSizeM: number; cells: string[] };
  const out = new Map<number, OsmWayFull>();
  // The extract's cells are keyed in the game's local frame (groundStore toLocal, origin 4.9, 52.37).
  const size = cells.cellSizeM;
  const want = new Set<string>();
  for (const b of boxes) {
    const x0 = (b[0] - 4.9) * KX, x1 = (b[2] - 4.9) * KX, y0 = (b[1] - 52.37) * KY, y1 = (b[3] - 52.37) * KY;
    for (let i = Math.floor(x0 / size); i <= Math.floor(x1 / size); i++) for (let j = Math.floor(y0 / size); j <= Math.floor(y1 / size); j++) want.add(`${i}_${j}`);
  }
  for (const k of want) {
    if (!cells.cells.includes(k)) continue;
    const b = readFileSync(join(OSM_ROOT, 'cells', `${k}.json.gz`));
    const j = JSON.parse(gunzipSync(b).toString()) as { ways: OsmWayFull[] };
    for (const w of j.ways) if (w.tags.highway) out.set(w.id, w);
  }
  return [...out.values()];
}

const isBridge = (t: Record<string, string>) => !!t.bridge && t.bridge !== 'no';
const isTunnel = (t: Record<string, string>) => !!t.tunnel && t.tunnel !== 'no' && t.tunnel !== 'building_passage' && t.tunnel !== 'culvert';
const layer = (t: Record<string, string>) => Number(t.layer ?? 0) || 0;
const carriesOf = (t: Record<string, string>): Carries => {
  if (t.railway) return t.railway === 'subway' ? 'metro' : t.railway === 'tram' ? 'tram' : 'rail';
  if (/^motorway|^trunk/.test(t.highway ?? '')) return 'motorway';
  if (t.highway === 'cycleway') return 'cycle';
  if (['footway', 'path', 'steps', 'pedestrian'].includes(t.highway ?? '')) return 'foot';
  return 'road';
};

/** Segment ab crosses segment cd. */
function segCross(a: P, b: P, c: P, d: P): boolean {
  const o = (p: P, q: P, r: P) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
function lineMeetsRing(line: P[], ring: P[]): boolean {
  if (line.some(p => insideRing(ring, p[0], p[1]))) return true;
  for (let i = 0; i + 1 < line.length; i++) for (let j = 0; j < ring.length; j++) if (segCross(line[i], line[i + 1], ring[j], ring[(j + 1) % ring.length])) return true;
  return false;
}
/** Share of a polyline's length (sampled every metre) inside a ring. */
function shareInside(line: P[], ring: P[]): { share: number; inside: number } {
  let n = 0, k = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const L = Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]);
    for (let t = 0; t < L; t += 1) { n++; const x = line[i][0] + (line[i + 1][0] - line[i][0]) * t / L, y = line[i][1] + (line[i + 1][1] - line[i][1]) * t / L; if (insideRing(ring, x, y)) k++; }
  }
  return { share: n ? k / n : 0, inside: k };
}
const ringArea = (r: P[]) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
const ringDist = (r: P[], p: P) => { let d = Infinity; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); d = Math.min(d, Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1])); } return insideRing(r, p[0], p[1]) ? 0 : d; };

/** Convex hull (monotone chain). */
function hull(pts: P[]): P[] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: P[] = [], hi: P[] = [];
  for (const p of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of s.reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
/** A ring grown by `m` metres (hull of the ring's points offset in 8 directions). */
function grow(r: P[], m: number): P[] {
  const pts: P[] = [];
  for (const p of r) for (let k = 0; k < 8; k++) pts.push([p[0] + Math.cos(k * Math.PI / 4) * m, p[1] + Math.sin(k * Math.PI / 4) * m]);
  return hull(pts);
}
/** Douglas-Peucker on a closed ring (metres). */
function simplify(r: P[], tol: number): P[] {
  if (r.length <= 8) return r;
  const dp = (pts: P[]): P[] => {
    if (pts.length < 3) return pts;
    const a = pts[0], b = pts[pts.length - 1];
    let worst = 0, k = 0;
    for (let i = 1; i + 1 < pts.length; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1); if (d > worst) { worst = d; k = i; } }
    return worst > tol ? dp(pts.slice(0, k + 1)).slice(0, -1).concat(dp(pts.slice(k))) : [a, b];
  };
  const h = r.length >> 1;
  return dp(r.slice(0, h + 1)).slice(0, -1).concat(dp(r.slice(h).concat([r[0]])).slice(0, -1));
}

export interface DraftReport {
  area: string;
  generated: string;
  counts: Record<string, number>;
  disagreements: { at: LngLat; kind: string; note: string }[];
}

interface Candidate { id: string; ring: P[]; members: BgtFeature[]; source: 'deck' | 'tunnel' }

async function main(): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) { console.log(HELP); return; }
  const areaId = argOf('--area') ?? 'named', area: Area | undefined = AREAS[areaId];
  if (!area) throw new Error(`unknown area ${areaId}; one of ${Object.keys(AREAS).join(', ')}`);
  const outDir = argOf('--out') ?? 'artifacts/crossings/drafts';
  const { boxes, inside } = areaBoxes(area);
  const origin: LngLat = [4.9, 52.37];
  const M = (p: LngLat) => toM(p, origin), L = (p: P) => toLL(p, origin);
  console.log(`${area.id}: ${boxes.length} query boxes`);

  // Sources, box by box (de-duplicated by id).
  const byId = new Map<string, BgtFeature>();
  const coll = ['overbruggingsdeel', 'tunneldeel', 'kunstwerkdeel_vlak', 'spoor', 'waterdeel'] as const;
  for (const [n, b] of boxes.entries()) {
    for (const c of coll) for (const f of await bgt(c, b)) byId.set(`${c}:${f.id}`, f);
    for (const h of ['1', '2', '-1', '-2']) for (const f of await bgt('wegdeel', b, { relatieve_hoogteligging: h })) byId.set(`wegdeel:${f.id}`, f);
    if ((n + 1) % 10 === 0) console.log(`  BGT ${n + 1}/${boxes.length}`);
  }
  const feats = [...byId.values()];
  const of = (c: string) => feats.filter(f => f.collection === c);
  const highways = osmHighways(boxes);
  const rails: OsmWayFull[] = [];
  {
    const seen = new Set<number>();
    for (const b of boxes) for (const w of await overpassWays(b)) if (w.tags.railway && !seen.has(w.id)) { seen.add(w.id); rails.push(w); }
  }
  const ways = [...highways, ...rails].map(w => ({ ...w, m: w.g.map(M) }));
  console.log(`  BGT ${feats.length} features; OSM ${highways.length} highways, ${rails.length} railways`);

  // Candidates: unions of touching deck polygons, and of tunnel parts.
  const cluster = (fs: BgtFeature[], source: Candidate['source']): Candidate[] => {
    const polys = fs.map(f => ({ f, ring: f.coords[0].map(M) })).filter(q => q.ring.length >= 3);
    if (!polys.length) return [];
    // Grow by 0.3 m so polygons that touch within survey precision merge.
    const grown: Polygon[] = polys.map(q => [grow(q.ring, 0.3)]);
    let u: MultiPolygon = [];
    for (const g of grown) u = polygonClipping.union(u, g);
    return u.map((poly, k) => {
      const ring = poly[0].slice(0, -1) as P[];
      const members = polys.filter(q => q.ring.some(p => insideRing(ring, p[0], p[1]))).map(q => q.f);
      return { id: `${source}-${k}`, ring: simplify(ring, 0.5), members, source };
    });
  };
  const deckParts = of('overbruggingsdeel').filter(f => !['pijler', 'landhoofd'].includes(String(f.props.type_overbruggingsdeel ?? '')));
  const cands = [...cluster(deckParts, 'deck'), ...cluster(of('tunneldeel'), 'tunnel')].filter(c => ringArea(c.ring) >= 15 && c.ring.some(p => inside(L(p))));
  const water = of('waterdeel').map(f => f.coords[0].map(M));
  const spoor = of('spoor').map(f => ({ f, m: f.coords[0].map(M), h: Number(f.props.relatieve_hoogteligging ?? 0), functie: String(f.props.functie ?? '') }));
  const counts: Record<string, number> = { candidates: cands.length, water: 0, noWayUnder: 0, drafted: 0 };
  const disagreements: DraftReport['disagreements'] = [];
  const records: CrossingRecord[] = [];

  for (const c of cands) {
    const ring = c.ring, area_ = ringArea(ring), centroid: P = [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
    // Over: ways whose length lies mostly in the deck (or bridge/layer>=1 ways that touch it). Under: ways at grade crossing it.
    // AHN first: an untagged way through the deck is over it or under it by its level just outside.
    const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]), pad = 30;
    const bb = [...L([Math.min(...xs) - pad, Math.min(...ys) - pad]), ...L([Math.max(...xs) + pad, Math.max(...ys) + pad])];
    let dtm: Awaited<ReturnType<typeof ahn>> | null = null, dsm: Awaited<ReturnType<typeof ahn>> | null = null;
    try { [dtm, dsm] = await Promise.all([ahn('dtm_05m', bb), ahn('dsm_05m', bb)]); } catch { /* reported below */ }
    const deckLevel = (() => {
      if (!dsm) return NaN;
      const v: number[] = [];
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += 2) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 2) if (ringDistInside(ring, [x, y]) <= -1.5) v.push(dsm.at(L([x, y])));
      return median(v);
    })();
    const outsideLevel = (m: P[]) => {
      const v: number[] = [];
      for (let i = 0; i + 1 < m.length; i++) { const a = m[i], b = m[i + 1], Lg = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let t = 0; t <= Lg; t += 1) { const p: P = [a[0] + (b[0] - a[0]) * t / Lg, a[1] + (b[1] - a[1]) * t / Lg], d = ringDist(ring, p); if (d >= 1.5 && d <= 10) v.push(dtm ? ahnMedian(dtm, L(p), 0.5) : NaN); } }
      return median(v);
    };
    const over: typeof ways = [], under: typeof ways = [];
    for (const w of ways) {
      if (!lineMeetsRing(w.m, ring)) continue;
      const t = w.tags, lay = layer(t), sh = shareInside(w.m, ring);
      if (isTunnel(t) || lay < 0) { under.push(w); continue; }
      if (c.source === 'deck' && (isBridge(t) || lay >= 1)) { if (sh.inside >= 3) over.push(w); continue; }
      if (c.source === 'tunnel') { if (sh.inside >= 3) over.push(w); continue; }
      if (sh.inside < 2 && sh.share < 0.05) continue;
      // Untagged: at the deck's level just outside it → it runs onto the deck; well under it → it passes beneath.
      const lv = outsideLevel(w.m);
      if (lv === lv && deckLevel === deckLevel && deckLevel - lv < 1.5) { if (sh.inside >= 3) over.push(w); }
      else under.push(w);
    }
    const spoorOver = spoor.filter(s => s.h >= 1 && shareInside(s.m, ring).inside >= 3), spoorUnder = spoor.filter(s => s.h <= 0 && lineMeetsRing(s.m, ring) && shareInside(s.m, ring).share < 0.9);
    const wet = water.some(w => w.some(p => insideRing(ring, p[0], p[1])) || ring.some(p => insideRing(w, p[0], p[1])));
    const railOver = over.some(w => w.tags.railway) || spoorOver.length > 0;
    const roadOver = over.some(w => w.tags.highway);
    const underRoads = under.filter(w => w.tags.highway && !['steps', 'elevator', 'construction', 'proposed'].includes(w.tags.highway));
    const underRail = under.some(w => w.tags.railway) || spoorUnder.length > 0;
    let kind: CrossingKind;
    if (c.source === 'tunnel') kind = 'road-under';
    else if (!underRoads.length && !underRail) { if (wet) counts.water++; else counts.noWayUnder++; continue; }
    else if (wet && !railOver && deckLevel - outsideLevel(underRoads[0].m) < 2) { counts.water++; continue; }
    else if (railOver && underRoads.length) kind = 'rail-over-road';
    else if (underRoads.length) kind = 'road-over-road';
    else kind = 'road-over-rail';
    const notes: string[] = [];
    const untagged = over.filter(w => !isBridge(w.tags) && layer(w.tags) < 1);
    for (const w of untagged) notes.push(`untagged: OSM way ${w.id} (${w.tags.railway ?? w.tags.highway}${w.tags.name ? ` ${w.tags.name}` : ''}) runs over the BGT deck without bridge=* or layer>=1 (railSpans infers its span)`);
    if (c.source === 'deck' && !over.length && !spoorOver.length) notes.push('no-way-over: no OSM way and no BGT spoor runs over the deck');
    if (railOver && !over.some(w => w.tags.railway)) notes.push('spoor-only: BGT spoor at hoogteligging >= 1 runs over the deck, no OSM railway does');
    if (c.source === 'tunnel' && !under.some(w => isTunnel(w.tags))) notes.push('no-osm-tunnel: BGT tunneldeel with no OSM tunnel way through it');

    // Heights (AHN 0.5 m): deck top on the over-ways inside the deck; street under at the under-ways just outside.
    let deckTop: number | undefined, streetUnder: number | undefined;
    const gradeSides: { at: LngLat; z: number }[] = [];
    const ahnUrls: string[] = [];
    try {
      if (!dtm || !dsm) throw new Error('AHN unavailable');
      ahnUrls.push(dtm.url, dsm.url);
      const onDeck: number[] = [];
      const overLines = [...over.map(w => w.m), ...spoorOver.map(s => s.m)];
      for (const m of overLines) for (let i = 0; i + 1 < m.length; i++) { const Lg = Math.hypot(m[i + 1][0] - m[i][0], m[i + 1][1] - m[i][1]); for (let t = 0; t < Lg; t += 2) { const p: P = [m[i][0] + (m[i + 1][0] - m[i][0]) * t / Lg, m[i][1] + (m[i + 1][1] - m[i][1]) * t / Lg]; if (ringDistInside(ring, p) <= -1.5) onDeck.push(ahnMedian(dsm, L(p), 1)); } }
      if (!onDeck.length) for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { const p: P = [centroid[0] + a, centroid[1] + b]; if (ringDistInside(ring, p) <= -1) onDeck.push(dsm.at(L(p))); }
      if (c.source === 'deck') { const v = median(onDeck); if (v === v) deckTop = round(v); }
      const street: number[] = [];
      for (const w of underRoads) for (let i = 0; i + 1 < w.m.length; i++) {
        const a = w.m[i], b = w.m[i + 1], Lg = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let t = 0; t <= Lg; t += 1) { const p: P = [a[0] + (b[0] - a[0]) * t / Lg, a[1] + (b[1] - a[1]) * t / Lg], d = ringDist(ring, p); if (d >= 1 && d <= 8) street.push(ahnMedian(dtm, L(p), 0.5)); }
      }
      { const v = median(street); if (v === v) streetUnder = round(v); }
      if (c.source === 'deck') for (const m of overLines.slice(0, 2)) for (const end of [m[0], m[m.length - 1]]) {
        if (ringDist(ring, end) < 3) continue;
        const z = ahnMedian(dsm, L(end), 1);
        if (z === z && !gradeSides.some(g => Math.hypot(M(g.at)[0] - end[0], M(g.at)[1] - end[1]) < 10)) gradeSides.push({ at: L(end), z: round(z) });
      }
    } catch (e) { notes.push(`ahn: ${String(e).slice(0, 120)}`); }
    if (c.source === 'deck' && deckTop !== undefined && streetUnder !== undefined && deckTop - streetUnder < 2.5) notes.push(`low-clearance: AHN deck top ${deckTop} only ${round(deckTop - streetUnder)} m over the street ${streetUnder}: a deck at grade, or a DSM sample off the deck`);
    const depth = railOver ? 1.1 : over.some(w => /^motorway|^trunk/.test(w.tags.highway ?? '')) ? 1.5 : 0.9;
    const carries: Carries = railOver ? (over.find(w => w.tags.railway) ? carriesOf(over.find(w => w.tags.railway)!.tags) : spoorOver.some(s => s.functie === 'trein') ? 'rail' : 'tram') : over.length ? carriesOf(over[0].tags) : 'road';
    const name = (ws: typeof ways) => [...new Set(ws.map(w => w.tags.name).filter(Boolean))].slice(0, 2).join(' / ');
    const overName = name(over) || (railOver ? 'rail' : 'deck'), underName = name(underRoads) || (underRail ? 'rail' : 'path');
    const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    const id = `${slug(underName)}-under-${slug(overName)}-${Math.round(centroid[0])}-${Math.round(centroid[1])}`.replace(/--+/g, '-');
    const rec: CrossingRecord = {
      id, label: `${underName} under ${overName}`, area: area.id, kind,
      at: L(centroid), zone: grow(ring, 6).map(L),
      plan: {
        decks: c.source === 'deck' ? [{ ring: ring.map(L), carries, bgt: c.members.map(f => f.id) }] : [],
        ...(c.source === 'tunnel' ? { tunnels: c.members.map(f => ({ ring: f.coords[0].map(p => [+p[0].toFixed(7), +p[1].toFixed(7)] as LngLat), bgt: f.id })) } : {}),
        piers: of('overbruggingsdeel').filter(f => f.props.type_overbruggingsdeel === 'pijler' && f.coords[0].some(p => insideRing(grow(ring, 2), ...M(p)))).map(f => ({ ring: f.coords[0].map(p => [+p[0].toFixed(7), +p[1].toFixed(7)] as LngLat), bgt: f.id })),
      },
      heights: { ...(streetUnder !== undefined ? { streetUnder } : {}), ...(deckTop !== undefined ? { deckTop, soffit: round(deckTop - depth), soffitEstimated: true } : {}), ...(gradeSides.length ? { gradeSides } : {}) },
      binds: { over: over.map(w => w.id), under: under.map(w => w.id), bgt: [...c.members.map(f => f.id), ...spoorOver.map(s => s.f.id)] },
      evidence: {
        sources: [
          `BGT ${c.source === 'deck' ? 'overbruggingsdeel' : 'tunneldeel'} ${c.members.map(f => `${f.id}${f.props.type_overbruggingsdeel ? ` (${f.props.type_overbruggingsdeel}, h ${f.props.relatieve_hoogteligging})` : ''}`).join(', ')}; ${round(area_, 0)} m²`,
          ...(spoorOver.length ? [`BGT spoor at hoogteligging >= 1: ${spoorOver.map(s => `${s.f.id} (${s.functie}, h ${s.h})`).join(', ')}`] : []),
          `OSM over: ${over.map(w => `${w.id} ${w.tags.railway ?? w.tags.highway}${w.tags.name ? ` "${w.tags.name}"` : ''}${isBridge(w.tags) ? ' bridge' : ''}${w.tags.layer ? ` layer ${w.tags.layer}` : ''}`).join('; ') || 'none'}`,
          `OSM under: ${under.map(w => `${w.id} ${w.tags.railway ?? w.tags.highway}${w.tags.name ? ` "${w.tags.name}"` : ''}${isTunnel(w.tags) ? ' tunnel' : ''}${w.tags.layer ? ` layer ${w.tags.layer}` : ''}`).join('; ') || 'none'}`,
          ...ahnUrls.map(u => `AHN ${u.includes('dsm') ? 'dsm_05m' : 'dtm_05m'} ${u}`),
        ],
        ortho: [], panoramas: [], notes: '',
      },
      ...(notes.length ? { disagreements: notes } : {}),
      reviewed: null,
    };
    if (!rec.plan.piers?.length) delete rec.plan.piers;
    records.push(rec);
    counts.drafted++;
    counts[kind] = (counts[kind] ?? 0) + 1;
    for (const n of notes) disagreements.push({ at: rec.at, kind: n.split(':')[0], note: `${rec.id}: ${n}` });
  }

  // OSM bridges over land with no BGT deck, OSM tunnels with no structure.
  const deckRings = cands.filter(c => c.source === 'deck').map(c => c.ring), tunnelRings = cands.filter(c => c.source === 'tunnel').map(c => c.ring);
  const allDecks = cluster(deckParts, 'deck').map(c => c.ring);
  for (const w of ways) {
    const t = w.tags, mid = w.m[w.m.length >> 1];
    if (!inside(w.g[w.g.length >> 1])) continue;
    if (isBridge(t) && t.highway && !allDecks.some(r => w.m.some(p => ringDist(r, p) < 3)) && !water.some(r => w.m.some(p => insideRing(r, p[0], p[1])))) {
      disagreements.push({ at: L(mid), kind: 'osm-bridge-no-deck', note: `OSM bridge way ${w.id} (${t.highway}${t.name ? ` ${t.name}` : ''}) over land has no BGT deck within 3 m` });
      counts.osmBridgeNoDeck = (counts.osmBridgeNoDeck ?? 0) + 1;
    }
    if (isTunnel(t) && (t.highway || t.railway) && !tunnelRings.some(r => w.m.some(p => ringDist(r, p) < 5)) && !deckRings.some(r => w.m.some(p => ringDist(r, p) < 5)) && !allDecks.some(r => w.m.some(p => ringDist(r, p) < 5))) {
      disagreements.push({ at: L(mid), kind: 'osm-tunnel-no-structure', note: `OSM tunnel way ${w.id} (${t.highway ?? t.railway}${t.name ? ` ${t.name}` : ''}) has no BGT tunneldeel or deck within 5 m` });
      counts.osmTunnelNoStructure = (counts.osmTunnelNoStructure ?? 0) + 1;
    }
  }

  if (args.includes('--game')) await gameInference(area, inside, deckRings.concat(tunnelRings), M, L, disagreements, counts);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${area.id}.json`), JSON.stringify({ version: 1, area: area.id, description: area.description, records }, null, 1));
  const report: DraftReport = { area: area.id, generated: new Date().toISOString(), counts, disagreements };
  writeFileSync(join(outDir, `${area.id}-report.json`), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(counts));
  const byKind: Record<string, number> = {};
  for (const d of disagreements) byKind[d.kind] = (byKind[d.kind] ?? 0) + 1;
  console.log('disagreements', JSON.stringify(byKind));
  console.log(`wrote ${join(outDir, `${area.id}.json`)} (${records.length} drafts) and the report`);
}

/** How deep inside the ring p lies (negative inside), metres. */
function ringDistInside(r: P[], p: P): number {
  let d = Infinity;
  for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); d = Math.min(d, Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1])); }
  return insideRing(r, p[0], p[1]) ? -d : d;
}

/** The game's inferred cuts and spans in the area, flagged where no survey structure backs them. */
async function gameInference(area: Area, inside: (p: LngLat) => boolean, structures: P[][], M: (p: LngLat) => P, L: (p: P) => LngLat, out: DraftReport['disagreements'], counts: Record<string, number>): Promise<void> {
  const { GroundStore, toLocal, fromLocal } = await import('../../src/canalRecall/ownGround/groundStore.ts');
  const { buildCell } = await import('../../src/canalRecall/ownGround/groundCell.ts');
  const ROOT = 'public/data/extracts/amsterdam';
  const fetchBytes = async (p: string) => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
  // The records are what the draft is checked against: inference before the register (`crossings: false`).
  const store = new GroundStore(fetchBytes, { crossings: false } as never);
  await store.init();
  const keys = new Set<string>();
  const { boxes } = areaBoxes(area, 400);
  for (const b of boxes) { const [x, y] = toLocal((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); if (inside(fromLocal(x, y) as LngLat)) keys.add(store.cellAt(x, y)); }
  const near = (p: LngLat, m: number) => structures.some(r => ringDist(r, M(p)) <= m);
  for (const k of keys) {
    if (!store.covers(k)) continue;
    await store.prepareCell(k);
    const cell = buildCell(await store.cellInput(k, 0));
    for (const sp of cell.stats.rails?.spanList ?? []) {
      const at = fromLocal(sp.at[0], sp.at[1]) as LngLat;
      if (!inside(at)) continue;
      counts.gameSpans = (counts.gameSpans ?? 0) + 1;
      if (!near(at, 5)) { out.push({ at: [+at[0].toFixed(6), +at[1].toFixed(6)], kind: 'span-no-deck', note: `railSpans infers a ${sp.length} m span (clear ${sp.clear} m) with no BGT deck within 5 m` }); counts.spanNoDeck = (counts.spanNoDeck ?? 0) + 1; }
    }
  }
  const seen = new Set<string>();
  for (const c of store.surface.cuts) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    const mid = fromLocal(c.x[c.x.length >> 1], c.y[c.y.length >> 1]) as LngLat;
    if (!inside(mid)) continue;
    counts.gameCuts = (counts.gameCuts ?? 0) + 1;
    counts.gamePortals = (counts.gamePortals ?? 0) + c.portals.length;
    const backed = c.x.some((x, i) => near(fromLocal(x, c.y[i]) as LngLat, 20));
    if (!backed) { out.push({ at: [+mid[0].toFixed(6), +mid[1].toFixed(6)], kind: 'cut-no-structure', note: `tunnels.ts ${c.kind} ${c.id} (way ${c.way}, ${c.portals.length} portals${c.portals.some(p => !p.open) ? ', a dark mouth' : ''}) has no BGT deck or tunneldeel within 20 m` }); counts.cutNoStructure = (counts.cutNoStructure ?? 0) + 1; }
  }
  void L;
}

if (process.argv[1]?.endsWith('draft.ts')) await main();
