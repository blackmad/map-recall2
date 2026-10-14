// Audit of the own ground over the canal belt, the Jordaan and Oud-West: every measured deck and every shore in the box,
// from the published extracts through the worker's code path (same GroundStore / buildCell as the game).
//
//   npx tsx scripts/own-ground/audit-belt.ts [--box=w,s,e,n] [--probe] [--json=out.json]
//
// Checks (exit 1 on a failure that is not in KNOWN, with the reason beside it):
//   deck continuity   largest 0.5 m step along the axis: fails at 0.40 m (arch) / 0.25 m (others), listed as steep from 0.36 / 0.15
//   deck ends         the profile starts and ends on the relief (approach ramps are relief)
//   deck over water   lowest riding surface over the span sits >= 0.6 m above the water under it
//   deck top (--probe) the topmost unmasked layer across the carriageway is a street band (BRU0067 read as deck grey)
//   quay vs water     ground at each shore sample (not under a deck) is 0.25..3.5 m above that shore's water level
// Named locations (id, lng, lat) of every failure are printed so they can be pinned as regressions.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal, toLocal, WATER_Z } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, compareHits, layersAt, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { GroundSurface } from '../../src/canalRecall/ownGround/surface.ts';
import { deckStreetTop } from '../../src/canalRecall/ownGround/roadRegressions.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const [W, S, E, N] = (flag('box') ?? '4.855,52.355,4.915,52.385').split(',').map(Number);
const probe = process.argv.includes('--probe');
const store = new GroundStore(async path => {
  const file = join(ROOT, path);
  if (!existsSync(file)) throw new Error(`${path}: missing`);
  const bytes = readFileSync(file);
  return new Uint8Array(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);
});
const inBox = (x: number, y: number) => { const [lng, lat] = fromLocal(x, y); return lng >= W && lng <= E && lat >= S && lat <= N; };
const at = (x: number, y: number) => { const [lng, lat] = fromLocal(x, y); return `${lng.toFixed(5)},${lat.toFixed(5)}`; };
const inRing = (ring: [number, number][], x: number, y: number) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

type Failure = { kind: string; id: string; where: string; detail: string };
const failures: Failure[] = [], steep: string[] = [];
/** Reviewed findings, 2026-10-13 (docs/elevation.md, own-ground ride review). A new failure is not in this list and fails the audit. */
const KNOWN: Record<string, string> = {
  'deck-continuity:BRU0077': 'Henrick de Keijserbrug: AHN hump of 1.7 m over a 6.7 m span (57% grade at s 31-34 m), implausible; a DSM artefact (canopy or vehicle) is likely, not verified. Re-measure from the raw AHN rasters.',
  'deck-seam:BRU0031': 'masonry arch: the band inside the span at its end sits 0.29 m above the deck surface (0.25 m tear, was 0.23 with centre-and-rim discs at 0.59 m before); the steepest ramp in the box',
  'deck-top:BRU2275': 'De Ruijterkade cycle bridge (2026-10-14): the measured road deck BRU0147 beside it is 29.4 m wide (half-width 14.7 m), so its footprint reaches 0.75 m from the cycle deck axis and its parapet (z 2.517) stands 0.14 m over the cycle band on the higher cycle hump (1.2 m vs 0.8 m). Overlapping measured footprints need clipping at the midline (decks.ts), not the bands',
  'deck-top:BRU0313': 'quay coping at the bridge end sits 1 mm above the klinker band (z 2.136 vs 2.135): the water polygon ends at the bridge, its shore wall crosses the road',
  'quay-flooded:4.86232,52.37057': 'Westerpark: the -1.77 plane (default or boezem level; the join was not verified) stands 1.08 m above the ground',
  'quay-flooded:4.90719,52.38449': 'IJ-side docks: default -1.77 plane over ground 0.6 m lower',
  'quay-flooded:4.90905,52.38494': 'IJ-side docks: default plane 0.4 m over the ground',
  'quay-flooded:4.87420,52.36047': 'Postjeskade polder (-3.47): ground 0.29 m under the plane',
  'quay-flooded:4.87340,52.36003': 'Postjeskade polder (-3.47): ground 0.27 m under the plane',
};
const fail = (kind: string, id: string, where: string, detail: string) => failures.push({ kind, id, where, detail });

await store.init();
const cells = [...store.osmCells].filter(k => store.covers(k)).filter(k => { const [x0, y0, x1, y1] = store.cellRect(k); return inBox((x0 + x1) / 2, (y0 + y1) / 2) || inBox(x0, y0) || inBox(x1, y1); }).sort();
console.log(`${cells.length} cells in the box`);
for (const k of cells) await store.prepareCell(k);
const built = new Map<string, BuiltCell>();
const cellBuild = async (k: string): Promise<BuiltCell | null> => { if (!store.covers(k)) return null; if (!built.has(k)) built.set(k, buildCell(await store.cellInput(k, 0))); return built.get(k)!; };

// ---- decks
const seen = new Set<string>();
let decks = 0, probes = 0, seams = 0;
const gaps: string[] = [], seamWarn: string[] = [];
for (const k of cells) for (const deck of store.decks(k)) {
  const p = deck.profile, id = p.id;
  if (seen.has(id)) continue; seen.add(id);
  const mid = Math.floor(p.x.length / 2);
  if (!inBox(p.x[mid], p.y[mid])) continue;
  decks++;
  const h = (i: number) => store.surface.height(p.x[i], p.y[i]);
  let worst = 0, worstI = 0;
  for (let i = 1; i < p.x.length; i++) { const d = Math.abs(h(i) - h(i - 1)); if (d > worst) { worst = d; worstI = i; } }
  const warn = p.family === 'masonry-arch' ? 0.36 : 0.15, limit = p.family === 'masonry-arch' ? 0.4 : 0.25;
  if (worst >= limit) fail('deck-continuity', id, at(p.x[worstI], p.y[worstI]), `0.5 m step ${worst.toFixed(3)} m (limit ${limit}, ${p.family})`);
  else if (worst >= warn) steep.push(`${id} @ ${at(p.x[worstI], p.y[worstI])}: ${worst.toFixed(3)} m per 0.5 m (${p.family})`);
  const last = p.x.length - 1;
  for (const [i, label] of [[0, 'start'], [last, 'end']] as const) {
    const e = Math.abs(h(i) - store.surface.ground(p.x[i], p.y[i]));
    if (e > 0.05) fail('deck-ends', id, at(p.x[i], p.y[i]), `${label} ${e.toFixed(3)} m off the relief`);
  }
  await store.waterCell(k);
  let lo = Infinity;
  for (let i = 0; i < p.x.length; i++) if (p.s[i] >= p.deck[0] && p.s[i] <= p.deck[1]) lo = Math.min(lo, h(i));
  const water = store.waterZ(p.x[mid], p.y[mid]);
  if (Number.isFinite(lo) && lo - water < 0.6) fail('deck-over-water', id, at(p.x[mid], p.y[mid]), `lowest riding surface ${lo.toFixed(2)} vs water ${water.toFixed(2)} (clearance ${(lo - water).toFixed(2)} m)`);
  if (probe) {
    const near: BuiltCell[] = [];
    for (const n of GroundStore.neighbours(k)) { const b = await cellBuild(n); if (b) near.push(b); }
    const bad: string[] = [];
    for (const f of [0.3, 0.5, 0.7]) {
      const i = p.s.findIndex(s => s >= p.deck[0] + (p.deck[1] - p.deck[0]) * f), a = Math.max(0, i - 1), b = Math.min(last, i + 1);
      const dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy) || 1;
      for (let o = -0.75; o <= 0.75; o += 0.75) {
        const qx = p.x[i] - dy / l * o, qy = p.y[i] + dx / l * o;
        // Topmost uncut, non-water hit over every neighbouring cell (a band may live in the neighbour of the deck's own cell).
        // Ties within 2 cm go to the higher draw rank (the polygon offsets on screen), as layersAt does inside one cell.
        const hits = near.flatMap(c => layersAt(c, qx, qy).hits).filter(h => !h.cut && h.layer !== 'water').sort(compareHits);
        probes++;
        if (!deckStreetTop(hits)) bad.push(`${f}/${o}:${hits.slice(0, 3).map(h => `${h.layer}@${h.z}`).join(">")}`);
      }
    }
    if (bad.length) fail('deck-top', id, at(p.x[mid], p.y[mid]), `topmost layer not a street band at ${bad.length} probes (${bad.slice(0, 4).join(' ')})`);
    // Seam: the street band 1 m before the span and 0.5 m inside it, on the axis, at both ends: the road must not step (tear) where it meets the deck.
    const topZ = (qx: number, qy: number): number | null => {
      const hits = near.flatMap(c => layersAt(c, qx, qy).hits).filter(h => !h.cut && ['asphalt', 'klinker'].includes(h.layer)).sort((a, b) => b.z - a.z);
      return hits.length ? hits[0].z : null;
    };
    for (const [edge, dir, label] of [[p.deck[0], -1, 'start'], [p.deck[1], 1, 'end']] as const) {
      const i = p.s.findIndex(s => s >= edge);
      if (i < 1) continue;
      const a = Math.max(0, i - 1), b = Math.min(last, i + 1), dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      // Height of the band above the riding surface under it (the band's own lift is a few cm); a tear is that offset changing across the seam.
      const rise = (qx: number, qy: number): number | null => { const z = topZ(qx, qy); return z === null ? null : z - store.surface.height(qx, qy); };
      const out = rise(p.x[i] + dir * ux, p.y[i] + dir * uy), inn = rise(p.x[i] - dir * ux * 0.5, p.y[i] - dir * uy * 0.5);
      seams++;
      if (out === null || inn === null) { gaps.push(`${id} ${label}: ${out === null ? 'no band outside' : 'no band inside'}`); continue; }
      const tear = Math.abs(out - inn), detail = `${label}: band sits ${out.toFixed(2)} m above the surface outside the span and ${inn.toFixed(2)} m inside (tear ${(inn - out).toFixed(2)} m)`;
      // 56 of 365 deck ends tore by more than 0.10 m (up to 0.29) while junction discs were centre-and-rim fans; with 1 m rings 16 do (max 0.20).
      if (tear > 0.25) fail('deck-seam', id, at(p.x[i], p.y[i]), detail);
      else if (tear > 0.10) seamWarn.push(`${id} @ ${at(p.x[i], p.y[i])}: ${detail}`);
    }
  }
}
console.log(`decks audited: ${decks}${probe ? `, ${probes} deck-top probes, ${seams} deck ends compared to the road band outside them (${gaps.length} with no band on one side, not failures)` : ''}`);

// ---- quays
const footprints: { ring: [number, number][]; box: [number, number, number, number] }[] = [];
for (const k of cells) for (const d of store.decks(k)) { const ring = GroundSurface.footprint(d) as [number, number][]; const xs = ring.map(r => r[0]), ys = ring.map(r => r[1]); footprints.push({ ring, box: [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1] }); }
const underDeck = (x: number, y: number) => footprints.some(f => x >= f.box[0] && x <= f.box[2] && y >= f.box[1] && y <= f.box[3] && inRing(f.ring, x, y));
let samples = 0, flush = 0;
type Q = { gap: number; x: number; y: number; level: number };
const flooded: Q[] = [], cliffs: Q[] = [];
for (const k of cells) {
  const geo = await store.waterCell(k);
  if (!geo) continue;
  geo.shores.forEach((line, si) => {
    const level = geo.shoreLevels?.[si] ?? WATER_Z;
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.floor(len / 5));
      for (let t = 0; t < n; t++) {
        const x = ax + (bx - ax) * t / n, y = ay + (by - ay) * t / n;
        if (!inBox(x, y) || underDeck(x, y)) continue;
        const gap = store.surface.height(x, y) - level;
        samples++;
        if (gap < -0.25) flooded.push({ gap, x, y, level }); else if (gap < 0.25) flush++; else if (gap > 3.5) cliffs.push({ gap, x, y, level });
      }
    }
  });
}
console.log(`quay samples ${samples}: ${flooded.length} flooded (ground more than 0.25 m below its own water plane), ${flush} flush (within 0.25 m), ${cliffs.length} cliffs (over 3.5 m above the water)`);
// Cluster samples into 40 m spots so each is one named location.
const cluster = (list: Q[], sign: number) => {
  const spots: { x: number; y: number; n: number; worst: number; level: number }[] = [];
  for (const q of [...list].sort((a, b) => sign * (b.gap - a.gap))) {
    const s = spots.find(c => Math.hypot(c.x - q.x, c.y - q.y) < 40);
    if (s) s.n++; else spots.push({ x: q.x, y: q.y, n: 1, worst: q.gap, level: q.level });
  }
  return spots;
};
const floodSpots = cluster(flooded, -1), cliffSpots = cluster(cliffs, 1);
for (const s of floodSpots.slice(0, 15)) { console.log(`  flooded quay ${at(s.x, s.y)}: ${s.n} samples, ground ${s.worst.toFixed(2)} m vs water ${s.level.toFixed(2)}`); fail('quay-flooded', at(s.x, s.y), at(s.x, s.y), `${s.n} samples, worst ground ${s.worst.toFixed(2)} m relative to water ${s.level.toFixed(2)}`); }
for (const s of cliffSpots.slice(0, 8)) console.log(`  cliff quay ${at(s.x, s.y)}: ${s.n} samples, ${s.worst.toFixed(2)} m above water ${s.level.toFixed(2)} (railway / dike embankments read as walls)`);
if (seamWarn.length) { console.log(`deck ends with a band offset change of 0.10-0.25 m (not failing): ${seamWarn.length}`); for (const t of seamWarn.slice(0, 8)) console.log("  " + t); }
if (steep.length) { console.log(`steep decks (not failing): ${steep.length}`); for (const t of steep.slice(0, 12)) console.log('  ' + t); }

// ---- named locations reported by ride review (2026-10-13). Each is pinned: a failure here is a regression of that place.
console.log('named locations:');
{
  // Westerkerk bridge (Rozengracht over the Prinsengracht = Nieuwe-Wercksbrug): the deck was audited, seams included.
  if (!seen.has('BRU0063')) fail('named', 'westerkerk-bridge', '4.8830,52.3742', 'BRU0063 Nieuwe-Wercksbrug was not found among the decks in the box');
  else console.log('  westerkerk-bridge: BRU0063 audited (continuity, ends, clearance, deck top, seams)');
  // Rozengracht x Marnixstraat x Lijnbaansgracht junction (fire station): bridge ways BRU-less (Rozengracht bridges 65421584/87 are unmeasured, flat decks); pinned by its cell.
  const [jx, jy] = toLocal(4.8760, 52.3722), jk = store.cellAt(jx, jy);
  if (!store.covers(jk)) fail('named', 'rozengracht-marnixstraat', '4.8760,52.3722', `cell ${jk} is not covered`);
  else console.log(`  rozengracht-marnixstraat: cell ${jk} covered, ${(await store.osmCell(jk))?.ways.filter(w => /Rozengracht|Marnixstraat|Lijnbaansgracht/.test(w.tags.name ?? '')).length ?? 0} named ways in the cell`);
  // Ryckerbrug / De Clercqstraat: no measured deck (flat deck over the Kostverlorenvaart); the street continues as OSM area:highway polygons.
  const [rx, ry] = toLocal(4.8705, 52.3709), rk = store.cellAt(rx, ry), rOsm = await store.osmCell(rk);
  const paved = (rOsm?.areas ?? []).filter(a => a.kind === 'paved' && /Cler[c]?qstraat/i.test(a.name ?? '')).map(a => a.id);
  console.log(`  ryckerbrug / De Clercqstraat: cell ${rk}, paved areas named De Clerqstraat: ${paved.join(' ') || 'none'} (drawn as square paving, not asphalt)`);
  if (!paved.length) fail('named', 'declercq-plaza', '4.8705,52.3709', 'the paved De Clercqstraat areas are gone from the cell data');
  // Allotments (Westerpark / Sloterdijkermeer): an allotment polygon's interior is the park (green) layer, not the dark land layer.
  const [ax, ay] = toLocal(4.8590, 52.3860), ak = store.cellAt(ax, ay);
  const aCell = await cellBuild(ak), aOsm = await store.osmCell(ak);
  const allot = (aOsm?.areas ?? []).filter(a => /^a\d+$/.test(a.id) && a.kind === 'park').sort((a, b) => b.rings[0].length - a.rings[0].length)[0];
  if (!aCell || !allot) fail('named', 'allotments-westerpark', '4.8590,52.3860', `no allotment park area in cell ${ak}`);
  else {
    const ring = allot.rings[0].map(([lng, lat]) => toLocal(lng, lat)), cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const top = layersAt(aCell, cx, cy).hits.filter(h => !h.cut && h.layer !== 'water')[0]?.layer;
    console.log(`  allotments-westerpark: area ${allot.id} ${allot.name ?? ''} centroid top layer ${top}`);
    if (inRing(ring as [number, number][], cx, cy) && top !== 'park') fail('named', 'allotments-westerpark', at(cx, cy), `allotment interior is ${top}, not park`);
  }
}

const byKind = new Map<string, Failure[]>();
for (const f of failures) byKind.set(f.kind, [...(byKind.get(f.kind) ?? []), f]);
const isKnown = (f: Failure) => `${f.kind}:${f.id}` in KNOWN;
for (const [kind, list] of byKind) { console.log(`${kind}: ${list.length} (${list.filter(isKnown).length} known)`); for (const f of list.slice(0, 15)) console.log(`  ${isKnown(f) ? 'known' : 'NEW  '} ${f.id} @ ${f.where}: ${f.detail}`); }
if (flag('json')) writeFileSync(flag('json')!, JSON.stringify({ box: [W, S, E, N], decks, samples, flush, flooded: floodSpots.slice(0, 40).map(s => ({ at: at(s.x, s.y), ...s })), cliffs: cliffSpots.slice(0, 40).map(s => ({ at: at(s.x, s.y), ...s })), steep, failures }, null, 1));
const fresh = failures.filter(f => !isKnown(f));
console.log(fresh.length ? `FAILED: ${fresh.length} new finding(s)` : `ok: ${failures.length} findings, all reviewed (KNOWN)`);
process.exitCode = fresh.length ? 1 : 0;
