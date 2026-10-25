// Build streamed own-ground cells offline (the worker's code path, from the
// published extracts) and report coverage, sizes and timings, plus the named
// regressions in their streamed cells:
//
//   npx tsx scripts/own-ground/check-ground-cells.ts            # cells around BRU0166 + BRU0044, both LODs
//   npx tsx scripts/own-ground/check-ground-cells.ts --all      # every cell of the OSM cell manifest (LOD 0)
//   npx tsx scripts/own-ground/check-ground-cells.ts --road-regressions  # only the roads-v1 named regressions
//   npx tsx scripts/own-ground/check-ground-cells.ts --relief   # only the relief regressions (reliefRegressions.ts)
//   npx tsx scripts/own-ground/check-ground-cells.ts --parapets # the canal-mouth parapet regressions alone
//   npx tsx scripts/own-ground/check-ground-cells.ts --roads    # roads-v1 cells: before/after table (triangles, build ms, gz) against the budgets
//   npx tsx scripts/own-ground/check-ground-cells.ts --bare-land --label=before   # city-wide bare land within 6 m of a carriageway (roads lane R1)
//
// Exit code 1 on a failed check.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, compareHits, layersAt, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { GroundSurface } from '../../src/canalRecall/ownGround/surface.ts';
import { buildFarBlock, farBlockOf, FAR_BLOCK_BUDGET } from '../../src/canalRecall/ownGround/farRing.ts';
import { bridgeFacts, flatHintAt, kitTrace, KIT_BUDGET, parapetTrace, registerHint, type KitInput, type KitRow } from '../../src/canalRecall/ownGround/bridgeKit.ts';
import { parapetCrossings, type ParapetPoint } from '../../src/canalRecall/ownGround/railingRuns.ts';
// Named canal-belt bridges (bridgeHints BRIDGE_FACTS, lane bridge-fidelity 2026-10-14) take the named tier.
const budgetOf = (id: string) => (bridgeFacts(id)?.named ? { near: KIT_BUDGET.named, far: KIT_BUDGET.namedFar } : { near: KIT_BUDGET.near, far: KIT_BUDGET.far });
import { prepareWays, resolvePriorSidewalks } from '../../src/canalRecall/ownGround/streets.ts';
import { bandCoverage, deckEndMisses, deckSlabOnLand, deckStreetTop, DECK_ENDS, junctionCoverage, strayHits, surveyedCoverage, wayStrayHits, zebraOffRoad, gapLand, surveyPaint, DE_CLERCQSTRAAT, JUNCTIONS, ROAD_JUNCTIONS, ROAD_SPOTS, ROAD_WAY_STRAYS, STRAYS, SURVEY_GAPS, SURVEY_PAINT, ZEBRAS } from '../../src/canalRecall/ownGround/roadRegressions.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { RELIEF_SPOTS, reliefSpread } from '../../src/canalRecall/ownGround/reliefRegressions.ts';
import { auditBridgeSurfaces } from './audit-bridge-surfaces.ts';
import { ROAD_CELL_BUDGET_GZ } from '../../src/canalRecall/ownGround/roadCells.ts';
import { existsSync, statSync } from 'node:fs';
import { probeSpot } from './probe-doubled-lanes.ts';
import { writeVsOrtho } from './road-vs-ortho.ts';
import { OrthoTiles } from './ortho.ts';
import { bareLandCell } from './render-road-sources.ts';

const ROOT = 'public/data/extracts/amsterdam';
const readExtract = async (path: string) => {
  const file = join(ROOT, path);
  if (!existsSync(file)) throw new Error(`${path}: missing`);
  const bytes = readFileSync(file);
  return new Uint8Array(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);
};
const store = new GroundStore(readExtract);
/** The same ground without parks-v1 (the parks regressions compare against it: streets must not change). */
const noParks = new GroundStore(readExtract, { parks: false });
/** The same ground without water opened under footbridges (the openings regressions show the pin is live). */
const noOpenings = new GroundStore(readExtract, { openings: false });
/** The same ground without the fixed spans beside movable leaves (the approaches regression shows the pin is live). */
const noApproaches = new GroundStore(readExtract, { approaches: false });
/** The ground with the roads-v1 partition (`?roads=bgt`, phase 1 opt-in); `store` is its before. */
const roadsStore = new GroundStore(readExtract, { roads: true });
/** roads-v1 budgets against the same cell without roads: triangles and build time (the extract's gz budget is ROAD_CELL_BUDGET_GZ). */
const ROADS_TRIANGLE_RATIO_MAX = 1.15, ROADS_BUILD_MS_RATIO_MAX = 1.3;
/** The same ground without courtyards-v1 (the J4 courtyard regression's before). */
const noCourtyards = new GroundStore(readExtract, { courtyards: false });

let failed = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

async function build(key: string, lod: 0 | 1): Promise<BuiltCell> {
  return buildCell(await store.cellInput(key, lod));
}

const summary = (c: BuiltCell) => ({ key: c.key, lod: c.lod, triangles: c.stats.triangles, MB: +(c.stats.bytes / 1048576).toFixed(1), buildMs: c.stats.buildMs, ways: c.stats.ways, areas: c.stats.areas, decks: c.stats.decks, flatDecks: c.stats.flatDecks, mask: c.mask ? `${c.mask.width}x${c.mask.height}@${c.mask.res}m` : null });

/** Every vertex of `layer` inside the deck span footprint, sitting on the riding surface (not under the deck). */
function bandOnDeck(cell: BuiltCell, deckId: string, layers: string[]): { n: number; worstBelow: number } {
  const deck = store.surface.decks.find(d => d.profile.id === deckId)!;
  const ring = GroundSurface.footprint(deck);
  const inside = (x: number, y: number) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  let n = 0, worstBelow = 0;
  for (const layer of layers) {
    const m = (cell.layers as Record<string, { positions: Float32Array }>)[layer];
    if (!m) continue;
    for (let i = 0; i < m.positions.length; i += 3) {
      const x = m.positions[i], y = m.positions[i + 1], z = m.positions[i + 2];
      if (!inside(x, y)) continue;
      n++;
      worstBelow = Math.max(worstBelow, store.surface.height(x, y) - z);
    }
  }
  return { n, worstBelow };
}

/** The relief stays level where the street is (Stationsplein's stairwells, Centraal's IJ side; issue #53). */
async function reliefRegressions(): Promise<void> {
  for (const spot of RELIEF_SPOTS) {
    const c = toLocal(spot.at[0], spot.at[1]);
    await store.ensureRelief([c[0] - spot.radiusM - 10, c[1] - spot.radiusM - 10, c[0] + spot.radiusM + 10, c[1] + spot.radiusM + 10]);
    const r = reliefSpread(store.surface.ground, c, spot.radiusM);
    check(r.spread <= spot.maxSpreadM, `relief ${spot.id}: 2–98 % spread ${r.spread} m (≤ ${spot.maxSpreadM}) within ${spot.radiusM} m — ${spot.label}`);
  }
}

async function main(): Promise<void> {
  await store.init();
  console.log(JSON.stringify({ osmCells: store.osmCells.size, reliefTiles: store.relief.tiles.length }));
  if (process.argv.includes('--roads')) { await roadsTable(); return; }
  if (process.argv.includes('--bare-land')) { await bareLandCity(); if (failed) process.exit(1); return; }
  if (process.argv.includes('--road-regressions')) { await roadRegressions(); if (failed) process.exit(1); return; }
  if (process.argv.includes('--relief')) { await reliefRegressions(); if (failed) process.exit(1); return; }
  if (process.argv.includes('--parapets')) { await parapetRegressions(); await bridgeSurfaceRegressions(); await wayDeckHoleRegressions(); await wayDeckCarriageRegressions(); process.exitCode = failed ? 1 : 0; return; }
  if (process.argv.includes('--all')) {
    const rows = [];
    for (const key of [...store.osmCells].sort()) {
      if (!store.covers(key)) { console.log(`skip ${key} (no relief)`); continue; }
      const c = await build(key, 0);
      rows.push(summary(c));
      console.log(JSON.stringify(summary(c)));
    }
    const t = rows.reduce((s, r) => s + r.triangles, 0), mb = rows.reduce((s, r) => s + r.MB, 0), ms = rows.map(r => r.buildMs).sort((a, b) => a - b);
    console.log(JSON.stringify({ cells: rows.length, fullyMeasured: [...store.osmCells].filter(k => store.fullyCovered(k)).length, extendedTiles: store.synthesised.size, trianglesPerCell: Math.round(t / rows.length), MBPerCell: +(mb / rows.length).toFixed(1), buildMsMedian: ms[ms.length >> 1], buildMsMax: ms[ms.length - 1] }));
    return;
  }
  await reliefRegressions();
  // Named bridges (lane bridges-elevation 2026-10-13): the user's Westerkerk bridge (Nieuwe-Wercksbrug, Rozengracht
  // over the Prinsengracht), Rijckerbrug, the Blauwbrug, plus the earlier three. Crown rise over the approaches
  // (our relief + the AHN profile, ±0.15 m), and the deck attached: its top fills the footprint out to the railings.
  const RISE: Record<string, number> = { BRU0063: 0.75, BRU0167: 0.6, BRU0236: 1.21, BRU0166: 0.81, BRU0044: 1.51, BRU0067: 1.08 };
  for (const [id, lng, lat, label] of [['BRU0166', 4.87445, 52.37286, 'Nassaukade / Bilderdijkgracht mouth'], ['BRU0044', 4.8875, 52.3665, 'Leidsegracht arch'], ['BRU0067', 4.882711, 52.366289, 'Angenietje Swarthofbrug, Leidsegracht / Prinsengracht'],
    ['BRU0063', 4.88305, 52.374002, 'Nieuwe-Wercksbrug, Rozengracht / Prinsengracht (Westerkerk)'], ['BRU0167', 4.8745, 52.37187, 'Rijckerbrug, Singelgracht'], ['BRU0236', 4.90088, 52.36636, 'Blauwbrug, Amstel']] as const) {
    const [x, y] = toLocal(lng, lat), key = store.cellAt(x, y);
    // The deck may belong to a neighbour cell: find the cell whose build carries it.
    let near: BuiltCell | null = null, owner = '';
    for (const k of GroundStore.neighbours(key)) {
      if (!store.osmCells.has(k)) continue;
      await store.prepareCell(k);
      if (store.decks(k).some(d => d.profile.id === id)) { owner = k; break; }
    }
    check(!!owner, `${id} (${label}) is placed in a streamed cell (${owner || 'none'})`);
    if (!owner) continue;
    near = await build(owner, 0);
    const far = await build(owner, 1);
    console.log('     ', JSON.stringify(summary(near)));
    console.log('     ', JSON.stringify(summary(far)));
    const deck = store.surface.decks.find(d => d.profile.id === id)!;
    const p = deck.profile;
    let crown = -Infinity, worst = 0, worstAt = 0;
    for (let i = 0; i < p.x.length; i++) {
      crown = Math.max(crown, store.surface.height(p.x[i], p.y[i]));
      const d = i ? Math.abs(store.surface.height(p.x[i], p.y[i]) - store.surface.height(p.x[i - 1], p.y[i - 1])) : 0;
      if (d > worst) { worst = d; worstAt = p.s[i]; }
    }
    if (process.argv.includes('--verbose')) console.log(`      ${id}: worst step at s=${worstAt.toFixed(2)} (deck ${p.deck.map(v => v.toFixed(2))}, stations ${p.s.length})`);
    // A masonry arch is steep (BRU0044: 1.5 m over a few metres): 0.324 m per 0.5 m on the west build,
    // 0.350 on the city build (the pull-push fill under the arch sees a wider band); the rider eases it per frame.
    check(worst < (p.family === 'masonry-arch' ? 0.36 : 0.15), `${id}: deck axis continuous (largest 0.5 m step ${worst.toFixed(3)} m)`);
    check(crown - Math.max(deck.ends[0], deck.ends[1]) > 0.4, `${id}: crown ${crown.toFixed(2)} rises over the approaches (${deck.ends.map(e => e.toFixed(2)).join(', ')})`);
    // Street bands cross the deck on the deck (route continuity), not under it.
    // The bridge way may belong to a neighbour (a way lives in the cell of its midpoint).
    const on = { n: 0, worstBelow: 0 };
    for (const k of GroundStore.neighbours(owner)) {
      if (!store.covers(k)) continue;
      const r = bandOnDeck(k === owner ? near : await build(k, 0), id, ['asphalt', 'klinker', 'paving', 'cycle']);
      on.n += r.n; on.worstBelow = Math.max(on.worstBelow, r.worstBelow);
    }
    check(on.n >= Math.max(8, deck.span[1] - deck.span[0]) && on.worstBelow < 0.02, `${id}: ${on.n} street-band vertices on the ${(deck.span[1] - deck.span[0]).toFixed(1)} m deck span, worst ${on.worstBelow.toFixed(3)} m below the surface`);
    // What the rider sees on the deck top (BRU0067 read as deck grey): across the carriageway
    // (±2 m of the axis) at 30/50/70 % of the span, the topmost unmasked layer is a street band.
    // (BRU0063 has a strip between its two carriageways where the deck top shows, as it should.)
    if (['BRU0166', 'BRU0044', 'BRU0067'].includes(id)) {
      const built: BuiltCell[] = [];
      for (const k of GroundStore.neighbours(owner)) if (store.covers(k)) built.push(k === owner ? near : await build(k, 0));
      const bad: string[] = [];
      let probes = 0;
      for (const f of [0.3, 0.5, 0.7]) {
        const i = p.s.findIndex(s => s >= p.deck[0] + (p.deck[1] - p.deck[0]) * f), a = Math.max(0, i - 1), b = Math.min(p.s.length - 1, i + 1);
        const dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy);
        for (let o = -2; o <= 2; o += 0.5) {
          const qx = p.x[i] - dy / l * o, qy = p.y[i] + dx / l * o;
          const tops = built.map(c => layersAt(c, qx, qy)).filter(r => r.hits.length);
          const top = tops.map(t => t.top).find(Boolean) ?? null;
          probes++;
          if (!top || !['asphalt', 'klinker', 'brick', 'paving', 'cycle', 'paint', 'kerb'].includes(top)) bad.push(`${f}/${o}:${top}`);
        }
      }
      check(!bad.length, `${id}: deck top is a street band at ${probes - bad.length}/${probes} probes${bad.length ? ` (${bad.slice(0, 6).join(' ')})` : ''}`);
    }
    const rise = crown - Math.max(deck.ends[0], deck.ends[1]);
    if (RISE[id] !== undefined) check(Math.abs(rise - RISE[id]) < 0.15, `${id}: crown ${rise.toFixed(2)} m over the approaches (pinned ${RISE[id]} ± 0.15)`);
    // Attachment: edge to edge across the deck (inside the railing plinths) at 25/50/75 % of the span,
    // nothing shows water; the deck top is under every probe.
    {
      const bad: string[] = [];
      let probes = 0;
      for (const f of [0.25, 0.5, 0.75]) {
        const i = p.s.findIndex(s => s >= p.deck[0] + (p.deck[1] - p.deck[0]) * f), a = Math.max(0, i - 1), b = Math.min(p.s.length - 1, i + 1);
        const dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy), hw = p.halfWidth[i] - 0.35;
        for (let o = -hw; o <= hw + 1e-6; o += Math.max(0.25, hw / 8)) {
          const qx = p.x[i] - dy / l * o, qy = p.y[i] + dx / l * o;
          const r = layersAt(near, qx, qy);
          probes++;
          if (!r.hits.some(h => h.layer === 'deckTop') || r.top === 'water' || r.top === null) bad.push(`${f}/${o.toFixed(1)}:${r.top}`);
        }
      }
      check(!bad.length, `${id}: deck top under ${probes - bad.length}/${probes} probes edge to edge${bad.length ? ` (${bad.slice(0, 6).join(' ')})` : ''}`);
    }
    {
      // The bridge kit (lane bridge-kit 2026-10-13): these are all canal-belt arch bridges (masonry, or pre-1940 humped iron
      // decks behind brick arch faces), each within the kit's budget at both rings, pillars and railing on both edges.
      const info = near.stats.bridges.decks.find(d => d.id === id), farInfo = far.stats.bridges.decks.find(d => d.id === id);
      check(!!info && info.kind === 'arch' && info.arches >= 1, `${id}: drawn as an arch bridge (${info?.kind}, ${info?.arches} arches)`);
      const B = budgetOf(id);
      check(!!info && info.triangles <= B.near && !!farInfo && farInfo.triangles <= B.far, `${id}: ${info?.triangles} triangles near (≤ ${B.near}), ${farInfo?.triangles} far (≤ ${B.far})`);
      check(!!info && info.railingPosts >= 4, `${id}: railings on both edges (${info?.railingPosts} posts, want ≥ 4)`);
      check(!!info && info.abutments >= 2, `${id}: abutments at both banks (${info?.abutments})`);
      const waterM = p.water ? p.water[1] - p.water[0] : 0;
      // Measured openings (panorama facts) replace the rule by water width.
      const f = bridgeFacts(id);
      if (f?.arches) check(!!info && info.arches === f.arches, `${id}: ${info?.arches} openings (measured ${f.arches})`);
      else check(!!info && (waterM > 13 ? info.piers >= 1 : waterM < 11 ? info.piers === 0 : true), `${id}: ${info?.piers} piers for ${waterM.toFixed(1)} m of water`);
    }
    check(!!near.layers.deckBody && (near.layers.deckBody.indices.length > 0), `${id}: deck body built`);
    check(!!near.layers.quay && !!near.layers.water, `${id}: quay walls and water in the cell`);
    check(near.lod === 0 && far.stats.triangles < near.stats.triangles * 0.6, `${id}: LOD 1 is lighter (${far.stats.triangles} vs ${near.stats.triangles} triangles)`);
  }
  // Unmeasured (flat) decks: the Magere Brug (movable, Amstel, a double bascule). Raampoort (BRU0165) and the Torensluis
  // (BRU0009) are measured since the flat-deck recovery (2026-10-14).
  for (const id of ['BRU0165', 'BRU0009']) check(store.surface.decks.some(d => d.profile.id === id), `${id}: measured deck (flat-deck recovery)`);
  for (const [id, lng, lat, frames] of [['BRU0242', 4.90237, 52.36358, 2]] as const) {
    const [x, y] = toLocal(lng, lat);
    let owner = '';
    for (const k of GroundStore.neighbours(store.cellAt(x, y))) if (store.flatDeckMeta(k).some(f => f.id === id)) { owner = k; break; }
    check(!!owner, `${id}: flat deck in a streamed cell (${owner || 'none'})`);
    if (!owner) continue;
    const cell = await build(owner, 0);
    const k = store.flatDeckMeta(owner).findIndex(f => f.id === id), ring = store.flatDecks(owner)[k];
    const cx = ring.reduce((s, q) => s + q[0], 0) / ring.length, cy = ring.reduce((s, q) => s + q[1], 0) / ring.length;
    const r = layersAt(cell, cx, cy), info = cell.stats.bridges.flat.find(f => f.id === id);
    check(r.hits.some(h => h.layer === 'deckTop') && r.top !== 'water', `${id}: deck top at the footprint centre (top ${r.top})`);
    check(!!info && info.railingPosts >= 8, `${id}: railings along the water (${info?.railingPosts} posts)`);
    check(!!info && info.frames === frames, `${id}: ${info?.frames} movable-bridge frame units (want ${frames})`);
  }
  // Bridge kit (lane bridge-kit 2026-10-13): the user's spots. Shot 1, a Prinsengracht-class bridge (Reesluis); shot 2, the
  // Brouwersgracht/Herengracht junction: the West-Indische Huisbrug and the Melkmeisjesbrug footbridge beside it, whose
  // water polygon stops at the bridge (it used to draw as a brick causeway). Type, an opening over the water, budget.
  for (const [id, lng, lat, kind] of [['BRU0064', 4.88292, 52.37242, 'arch'], ['BRU0017', 4.89167, 52.37919, 'arch'], ['BRU0016', 4.89226, 52.37917, 'footbridge']] as const) {
    const [x, y] = toLocal(lng, lat);
    let owner = '';
    for (const k of GroundStore.neighbours(store.cellAt(x, y))) { if (!store.osmCells.has(k)) continue; await store.prepareCell(k); if (store.decks(k).some(d => d.profile.id === id)) { owner = k; break; } }
    check(!!owner, `${id}: placed in a streamed cell (${owner || 'none'})`);
    if (!owner) continue;
    const near = await build(owner, 0), far = await build(owner, 1);
    const info = near.stats.bridges.decks.find(d => d.id === id), farInfo = far.stats.bridges.decks.find(d => d.id === id);
    check(!!info && info.kind === kind && (kind !== 'arch' || info.arches >= 1) && (kind !== 'footbridge' || info.railingPosts >= 8), `${id}: ${info?.kind} (want ${kind}), ${info?.arches} arches, ${info?.railingPosts} posts`);
    check(!!info && info.triangles <= budgetOf(id).near && !!farInfo && farInfo.triangles <= budgetOf(id).far, `${id}: ${info?.triangles} triangles near, ${farInfo?.triangles} far`);
    // An opening, not a causeway: at the deck's middle, the side faces end under the deck, above the relief's buried wall.
    const deck = store.surface.decks.find(d => d.profile.id === id)!, p = deck.profile, i = p.s.findIndex(s => s >= (p.deck[0] + p.deck[1]) / 2);
    const body = near.layers.deckBody!, pos = body.positions, dx = p.x[i + 1] - p.x[i - 1], dy = p.y[i + 1] - p.y[i - 1], dl = Math.hypot(dx, dy);
    let lowest = Infinity;
    for (let v = 0; v < pos.length; v += 3) {
      const along = ((pos[v] - p.x[i]) * dx + (pos[v + 1] - p.y[i]) * dy) / dl, across = Math.abs((pos[v + 1] - p.y[i]) * dx - (pos[v] - p.x[i]) * dy) / dl;
      if (Math.abs(along) < 1.5 && Math.abs(across - p.halfWidth[i]) < 0.3) lowest = Math.min(lowest, pos[v + 2]);
    }
    check(kind === 'arch' || lowest > store.surface.ground(p.x[i], p.y[i]) - 0.3, `${id}: open under its middle (body bottom ${lowest.toFixed(2)}, relief ${store.surface.ground(p.x[i], p.y[i]).toFixed(2)})`);
  }
  // The register types the unmeasured footprints: the Torensluis is masonry (arches), the Magere Brug a timber bascule (white).
  check(registerHint('BRU0009')?.material === 'masonry', 'BRU0009: the Torensluis is masonry in the register');
  for (const [id, want] of [['BRU0242', 'wood']] as const) {
    const ring = [...store.osmCells].flatMap(k => store.flatDeckMeta(k).map((f, j) => (f.id === id ? store.flatDecks(k)[j] : null))).find(r => r);
    const hit = ring ? flatHintAt(ring.reduce((s, q) => s + q[0], 0) / ring.length, ring.reduce((s, q) => s + q[1], 0) / ring.length) : null;
    check(hit?.id === id && hit.hint.material === want, `${id}: register hint found at its footprint (${hit?.id} ${hit?.hint.material})`);
  }
  await deckTopRegressions();
  await railingRegressions();
  await pocketRegressions();
  await openingRegressions();
  await approachRegressions();
  await deckSlabRegressions();
  await parapetRegressions();
  await bridgeSurfaceRegressions();
  await wayDeckHoleRegressions();
  await wayDeckCarriageRegressions();
  await zooRegressions();
  await courtyardRegressions();
  await parkFillRegressions();
  await farRingRegressions();
  // Named road regressions: every band of the listed ways reads as street at both LODs.
  for (const reg of [DE_CLERCQSTRAAT]) {
    const [x, y] = toLocal(reg.at[0], reg.at[1]), key = store.cellAt(x, y);
    const keys = GroundStore.neighbours(key).filter(k => store.covers(k));
    const input = await store.cellInput(key, 0);
    const ids = new Set(reg.ways), seen = new Set<number>();
    // As the cell builds them: every way of the 3×3, prior sidewalks resolved against their neighbours.
    const ways = resolvePriorSidewalks([input.osm, ...input.osmAround].flatMap(e => (e ? prepareWays(e.ways, input.project) : [])).filter(w => !seen.has(w.id) && seen.add(w.id))).filter(w => ids.has(w.id));
    check(ways.length === reg.ways.length, `${reg.id}: ${ways.length}/${reg.ways.length} ways found`);
    for (const lod of [0, 1] as const) {
      const cells: BuiltCell[] = [];
      for (const k of keys) cells.push(await build(k, lod));
      const r = bandCoverage(cells, ways, reg.fractions);
      check(r.share >= reg.minShare, `${reg.id} LOD ${lod}: ${r.street}/${r.probes} band probes read as street (${(100 * r.share).toFixed(1)} %)${r.misses.length ? ` misses ${JSON.stringify(r.misses.slice(0, 4))}` : ''}`);
    }
  }
  for (const reg of STRAYS) {
    const [x, y] = toLocal(reg.at[0], reg.at[1]), keys = GroundStore.neighbours(store.cellAt(x, y)).filter(k => store.covers(k));
    for (const lod of [0, 1] as const) {
      const cells: BuiltCell[] = [];
      for (const k of keys) cells.push(await build(k, lod));
      const hits = strayHits(cells, [x, y], reg);
      check(hits.length === 0, `${reg.id} LOD ${lod}: ${reg.probes.length - hits.length}/${reg.probes.length} fragment probes clean${hits.length ? ` ${JSON.stringify(hits)}` : ''}`);
    }
  }
  for (const j of JUNCTIONS) {
    const [x, y] = toLocal(j.at[0], j.at[1]), keys = GroundStore.neighbours(store.cellAt(x, y)).filter(k => store.covers(k));
    for (const lod of [0, 1] as const) {
      const cells: BuiltCell[] = [];
      for (const k of keys) cells.push(await build(k, lod));
      const r = junctionCoverage(cells, [x, y], j.radiusM, j.surface);
      check(r.share >= j.minShare, `${j.id} LOD ${lod}: junction interior ${r.ok}/${r.probes} ${j.surface} (${JSON.stringify(r.tops)})`);
    }
  }
  await parkRegressions();
  await roadRegressions();
  // Seams: two neighbouring cells' land grids meet at the same heights (one height function, shared grid lines).
  const [ax, ay] = toLocal(4.8875, 52.3665), a = store.cellAt(ax, ay), [cx, cy] = a.split('_').map(Number), b = `${cx + 1}_${cy}`;
  if (store.covers(a) && store.covers(b)) {
    const A = await build(a, 0), B = await build(b, 0), edge = store.cellRect(a)[2];
    const zs = (c: BuiltCell) => { const m = new Map<string, number>(); const p = c.layers.land!.positions; for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i] - Math.round(p[i] / 5) * 5) < 1e-3 && Math.abs(p[i] - edge) < 5.01) m.set(`${p[i].toFixed(2)}:${p[i + 1].toFixed(2)}`, p[i + 2]); return m; };
    const za = zs(A), zb = zs(B);
    let shared = 0, worst = 0;
    for (const [k, z] of za) if (zb.has(k)) { shared++; worst = Math.max(worst, Math.abs(z - zb.get(k)!)); }
    check(shared > 20 && worst < 1e-4, `seam ${a}|${b}: ${shared} shared land vertices, worst mismatch ${worst.toExponential(1)} m`);
  }
  process.exitCode = failed ? 1 : 0;
}

/**
 * Deck tops from the belt audit (lane own-ground belt audit 2026-10-14): at 30/50/70 % of the span and
 * 0, ±0.75 m off the axis, the topmost layer is a street band (or a tram rail lying on one, `deckStreetTop`).
 * Bands narrower than the mapped carriageway were draped with vertices on their two edges only, so where the
 * deck is narrower than the band they spanned from the relief beside the deck and sagged under the deck top
 * (BRU0292 Schottenburchsbrug 0.15 m, BRU0293 0.10 m, BRU0052 0.05 m); the tram bridges read rail-on-asphalt.
 */
const DECK_TOPS: [string, number, number, string][] = [
  ['BRU0292', 4.90252, 52.37201, 'Schottenburchsbrug, Kromboomssloot'],
  ['BRU0293', 4.90234, 52.37149, 'Kromboomssloot, Koningsstraat'],
  ['BRU0052', 4.88571, 52.37547, 'Prinsengracht, Bloemgracht'],
  ['BRU0030', 4.89282, 52.36517, 'tram bridge, Reguliersgracht / Utrechtsestraat'],
  ['BRU0285', 4.90221, 52.37720, 'tram bridge, Prins Hendrikkade'],
];
async function deckTopRegressions(): Promise<void> {
  const cache = new Map<string, BuiltCell>();
  const cell = async (k: string) => { if (!cache.has(k)) cache.set(k, await build(k, 0)); return cache.get(k)!; };
  for (const [id, lng, lat, label] of DECK_TOPS) {
    const [x, y] = toLocal(lng, lat);
    let owner = '';
    for (const k of GroundStore.neighbours(store.cellAt(x, y))) { if (!store.osmCells.has(k)) continue; await store.prepareCell(k); if (store.decks(k).some(d => d.profile.id === id)) { owner = k; break; } }
    check(!!owner, `${id} (${label}): placed in a streamed cell (${owner || 'none'})`);
    if (!owner) continue;
    const near: BuiltCell[] = [];
    for (const k of GroundStore.neighbours(owner)) if (store.covers(k)) near.push(await cell(k));
    const p = store.surface.decks.find(d => d.profile.id === id)!.profile, last = p.x.length - 1;
    const bad: string[] = [];
    let probes = 0;
    for (const f of [0.3, 0.5, 0.7]) {
      const i = p.s.findIndex(s => s >= p.deck[0] + (p.deck[1] - p.deck[0]) * f), a = Math.max(0, i - 1), b = Math.min(last, i + 1);
      const dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy) || 1;
      for (const o of [-0.75, 0, 0.75]) {
        const qx = p.x[i] - dy / l * o, qy = p.y[i] + dx / l * o;
        const hits = near.flatMap(c => layersAt(c, qx, qy).hits).filter(h => !h.cut && h.layer !== 'water').sort(compareHits);
        probes++;
        if (!deckStreetTop(hits)) bad.push(`${f}/${o}:${hits.slice(0, 2).map(h => `${h.layer}@${h.z}`).join('>')}`);
      }
    }
    check(!bad.length, `${id} (${label}): deck top is a street band at ${probes - bad.length}/${probes} probes${bad.length ? ` (${bad.slice(0, 4).join(' ')})` : ''}`);
  }
}

/**
 * Railings across the road (user 2026-10-16, "why do the gates dip into the road?"; railingRuns.ts railRuns,
 * scripts/own-ground/audit-bridge-railings.ts): each side's parapet runs along the deck's water-side edge and stops on
 * the abutment. BRU0166 (Nassaukade over the Bilderdijkgracht mouth, cycle lanes both sides: the parapet turned in
 * over both cycle lanes and ran on along them), the Nieuwe-Wercksbrug BRU0063 (Rozengracht, the south parapet turned
 * across the cycle lane and footway at the east abutment), BRU0257 (the deck span's end between a road-width and a
 * 19 m outline station: a 19 m return along the bank at each corner). Built with the roads-v1 partition as the game
 * draws it: no stretch steeper than 45 deg over TURN_M (a gate), under 0.5 m of parapet inside a carriageway or
 * cycle-lane polygon, both sides drawn.
 */
const RAILINGS: readonly (readonly [string, number, number, string])[] = [
  ['BRU0166', 4.874789, 52.373236, 'Nassaukade, Bilderdijkgracht mouth'],
  ['BRU0063', 4.883208, 52.3739, 'Nieuwe-Wercksbrug, Rozengracht / Prinsengracht'],
  ['BRU0257', 4.907198, 52.362504, 'a span end between road and outline widths'],
];
async function railingRegressions(): Promise<void> {
  // Its own store: preparing cells evicts others' state, and the roads-v1 pin below counts the decks the roads store holds.
  const railStore = new GroundStore(readExtract, { roads: true });
  await railStore.init();
  for (const [id, lng, lat, label] of RAILINGS) {
    const [x, y] = toLocal(lng, lat);
    let owner = '';
    for (const k of GroundStore.neighbours(railStore.cellAt(x, y))) { if (!railStore.osmCells.has(k)) continue; await railStore.prepareCell(k); if (railStore.decks(k).some(d => d.profile.id === id)) { owner = k; break; } }
    check(!!owner, `${id} (${label}): placed in a streamed cell (${owner || 'none'})`);
    if (!owner) continue;
    // The pieces of the level buildKit drew (its last, highest attempt).
    const input = await railStore.cellInput(owner, 0), lines = new Map<number, { level: number; pieces: ParapetPoint[][] }>();
    parapetTrace.fn = (bid, side, line, at) => {
      if (bid !== id) return;
      const t = lines.get(side);
      if (!t || at.level > t.level || (at.level === t.level && at.piece === 0)) lines.set(side, { level: at.level, pieces: [line] });
      else if (at.level === t.level) t.pieces.push(line);
    };
    try { buildCell(input); } finally { parapetTrace.fn = null; }
    const index = input.roads || input.roadsAround?.some(Boolean) ? new RoadIndex([input.roads ?? null, ...(input.roadsAround ?? [])]) : null;
    const traffic = (qx: number, qy: number) => { const c = index?.classAt(qx, qy, true); return c === 'carriage' || c === 'cycle'; };
    const m = [...lines.values()].flatMap(l => l.pieces).map(l => parapetCrossings(l, traffic));
    check(lines.size === 2, `${id} (${label}): parapet on both sides (${lines.size})`);
    check(m.every(r => r.turns === 0), `${id}: no parapet turns across the deck (${m.map(r => `${r.turns} turns ${r.turnM.toFixed(1)} m`).join(', ')})`);
    check(m.every(r => r.insideM < 0.5), `${id}: parapet off the carriageway and cycle lanes (${m.map(r => r.insideM.toFixed(1)).join(', ')} m inside)`);
  }
}

/**
 * Land pockets (lane belt audit 2026-10-14, the Rozengracht corners): at Rozengracht × Marnixstraat the sidewalks of
 * the dual carriageways and a separately mapped footway stop short of each other, so a 4 × 5 m patch of bare land
 * showed on the north-east corner the BGT surveys as voetpad. With the pocket fill (pockets.ts) every probe is street;
 * without it the same probes read land (the pin is live).
 */
const POCKETS: [string, number, number][] = [['rozengracht-marnixstraat-ne', 4.875994, 52.37239]];
async function pocketRegressions(): Promise<void> {
  for (const [id, lng, lat] of POCKETS) {
    const [x, y] = toLocal(lng, lat), keys = GroundStore.neighbours(store.cellAt(x, y)).filter(k => store.covers(k));
    const tops = async (pockets: boolean) => {
      const cells: BuiltCell[] = [];
      for (const k of keys) cells.push(buildCell({ ...(await store.cellInput(k, 0)), pockets }));
      const out: string[] = [];
      for (let dx = -1; dx <= 1; dx += 0.5) for (let dy = -1; dy <= 1; dy += 0.5) out.push(cells.map(c => layersAt(c, x + dx, y + dy)).find(r => r.top)?.top ?? 'none');
      return out;
    };
    const on = await tops(true), off = await tops(false);
    const street = on.filter(t => ['asphalt', 'klinker', 'brick', 'paving', 'cycle', 'kerb', 'paint'].includes(t)).length;
    check(street === on.length, `${id}: ${street}/${on.length} probes are street with the pocket fill (${[...new Set(on)].join(', ')})`);
    check(off.includes('land'), `${id}: without it ${off.filter(t => t === 'land').length}/${off.length} probes read land (the pin is live)`);
  }
}

/**
 * Water under footbridges (lane belt audit 2026-10-14): the Melkmeisjesbrug's water polygon stops at both deck edges,
 * so a land strip and two quay walls crossed the Brouwersgracht under it. Along the middle half of the span, on the
 * axis and 0.5 m either side of it, nothing but the deck lies over the water: no uncut land, no quay wall.
 */
const OPENINGS: [string, number, number, string][] = [['BRU0016', 4.89226, 52.37917, 'Melkmeisjesbrug, Brouwersgracht']];
async function openingRegressions(): Promise<void> {
  await noOpenings.init();
  for (const [id, lng, lat, label] of OPENINGS) {
    const [x, y] = toLocal(lng, lat);
    let owner = '';
    for (const k of GroundStore.neighbours(store.cellAt(x, y))) { if (!store.osmCells.has(k)) continue; await store.prepareCell(k); if (store.decks(k).some(d => d.profile.id === id)) { owner = k; break; } }
    if (!owner) { check(false, `${id}: placed in a streamed cell`); continue; }
    const p = store.surface.decks.find(d => d.profile.id === id)!.profile, last = p.x.length - 1;
    const keys = GroundStore.neighbours(owner).filter(k => store.covers(k));
    const under = async (s: GroundStore) => {
      const cells: BuiltCell[] = [];
      for (const k of keys) cells.push(buildCell(await s.cellInput(k, 0)));
      const bad: string[] = [];
      let probes = 0;
      for (const f of [0.3, 0.4, 0.5, 0.6, 0.7]) {
        const i = p.s.findIndex(q => q >= p.deck[0] + (p.deck[1] - p.deck[0]) * f), a = Math.max(0, i - 1), b = Math.min(last, i + 1);
        const dx = p.x[b] - p.x[a], dy = p.y[b] - p.y[a], l = Math.hypot(dx, dy) || 1;
        for (const o of [-0.5, 0, 0.5]) {
          const qx = p.x[i] - dy / l * o, qy = p.y[i] + dx / l * o;
          const hits = cells.flatMap(c => layersAt(c, qx, qy).hits).filter(h => !h.cut && (h.layer === 'land' || h.layer === 'quay'));
          probes++;
          if (hits.length) bad.push(`${f}/${o}:${hits.map(h => `${h.layer}@${h.z}`).join(',')}`);
        }
      }
      return { probes, bad };
    };
    const on = await under(store), off = await under(noOpenings);
    check(!on.bad.length && (store.openedDecks.get(owner) ?? [...store.openedDecks.values()].flat()).includes(id), `${id} (${label}): water opened under it, ${on.probes - on.bad.length}/${on.probes} probes free of land and quay walls${on.bad.length ? ` (${on.bad.slice(0, 4).join(' ')})` : ''}`);
    check(off.bad.length > 0, `${id}: without the opening ${off.bad.length}/${off.probes} probes hit land or a quay wall (the pin is live)`);
  }
}

/**
 * Fixed spans beside movable leaves (ride review 2026-10-14): the Nijlpaardenbrug's register footprint is its ~10 m
 * leaf, its OSM way (31485502) runs 36 m quay to quay over the Entrepotdok, and the leaf floated mid-canal. On the
 * way's axis between the leaf and each quay (0.2/0.3 and 0.7/0.8 of the way), a deck top is drawn and the cycleway's
 * band is not cut away by the water; without the approaches neither holds.
 */
const APPROACHES: [string, number, number, number, number, string][] = [['BRU1907', 4.913675, 52.368474, 4.913939, 52.368754, 'Nijlpaardenbrug, Entrepotdok']];
async function approachRegressions(): Promise<void> {
  await noApproaches.init();
  for (const [id, lng0, lat0, lng1, lat1, label] of APPROACHES) {
    const [x0, y0] = toLocal(lng0, lat0), [x1, y1] = toLocal(lng1, lat1);
    const probe = async (s: GroundStore) => {
      const keys = GroundStore.neighbours(s.cellAt((x0 + x1) / 2, (y0 + y1) / 2)).filter(k => s.covers(k));
      const cells: BuiltCell[] = [];
      for (const k of keys) cells.push(buildCell(await s.cellInput(k, 0)));
      const out: string[] = [];
      for (const f of [0.2, 0.3, 0.7, 0.8]) {
        const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, hits = cells.flatMap(c => layersAt(c, x, y).hits);
        const deck = hits.some(h => h.layer === 'deckTop'), band = hits.some(h => h.layer === 'cycle' && !h.cut);
        out.push(`${f}:${deck ? 'deck' : '-'}${band ? '+band' : ''}`);
      }
      return out;
    };
    const on = await probe(store), off = await probe(noApproaches);
    check(on.every(p => p.endsWith('deck+band')), `${id} (${label}): deck top and cycle band from the leaf to both quays (${on.join(' ')})`);
    check(off.filter(p => p.endsWith('deck+band')).length === 0, `${id}: without the approaches the leaf floats (${off.join(' ')}) (the pin is live)`);
  }
}

/**
 * Zoos are green ground (ride review 2026-10-14): Artis (tourism=zoo, OSM a8733446) was missing from the extract, so
 * its grounds drew as bare land, a sand plaza from the Entrepotdok and the Plantage Middenlaan. A 12 × 12 grid of
 * probes inside its outline: at most 5 % may read bare land (10 % in its own cell or in the neighbour holding its west third)
 * (the land grid poked through the 8 m fill in hollows: 14 % before groundCell's underGreen cull, 54 % in the
 * neighbour); with the area dropped from the cell's input the land share is back over half (the pin is live).
 */
const ZOOS: [string, string][] = [['a8733446', 'Artis']];
async function zooRegressions(): Promise<void> {
  for (const [id, label] of ZOOS) {
    let found: { key: string; ring: [number, number][] } | null = null;
    for (const k of store.osmCells) {
      const cell = await store.osmCell(k);
      const a = cell?.areas.find(x => x.id === id);
      if (a) { found = { key: k, ring: a.rings[0].map(([lng, lat]) => toLocal(lng, lat)) }; break; }
    }
    if (!found) { check(false, `${id} (${label}): in the OSM cells`); continue; }
    const { key, ring } = found;
    const inside = (x: number, y: number) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]), probes: [number, number][] = [];
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
      const x = Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) * (i + 0.5) / 12, y = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * (j + 0.5) / 12;
      if (inside(x, y)) probes.push([x, y]);
    }
    const share = async (drop: boolean) => {
      const cells: BuiltCell[] = [];
      for (const k of GroundStore.neighbours(key).filter(n => store.covers(n))) {
        const input = await store.cellInput(k, 0);
        cells.push(buildCell(drop && input.osm ? { ...input, osm: { ...input.osm, areas: input.osm.areas.filter(a => a.id !== id) } } : input));
      }
      // The land is culled under the fill in the owner cell and its neighbours (groundCell underGreen): report both.
      const [r0, r1, r2, r3] = store.cellRect(key), own = (x: number, y: number) => x >= r0 && x < r2 && y >= r1 && y < r3;
      const tops = probes.map(([x, y]) => cells.map(c => layersAt(c, x, y)).find(r => r.top)?.top ?? 'none');
      const land = (sel: boolean) => { const i = probes.map((q, k) => k).filter(k => own(probes[k][0], probes[k][1]) === sel); return i.filter(k => tops[k] === 'land').length / Math.max(1, i.length); };
      return { own: land(true), neighbour: land(false), all: tops.filter(t => t === 'land').length / Math.max(1, tops.length) };
    };
    const on = await share(false), off = await share(true);
    check(on.all <= 0.05 && on.own <= 0.1 && on.neighbour <= 0.1, `${id} (${label}): ${(on.all * 100).toFixed(0)} % of ${probes.length} probes inside it read bare land (${(on.own * 100).toFixed(0)} % in its own cell, ${(on.neighbour * 100).toFixed(0)} % in the neighbour's)`);
    check(off.all > 0.5, `${id}: without the zoo area ${(off.all * 100).toFixed(0)} % read bare land (the pin is live)`);
  }
}

/**
 * Courtyards are their real cover (ride review 2026-10-14 row J4, the Jordaan from Egelantiersstraat at the Prinsengracht,
 * 4.88513 52.37724 bearing 209): the inner gardens drew as bare sand land, so closed blocks read as public squares.
 * courtyards-v1 (add-bgt-courtyards.ts) draws the BGT terrain of block interiors, erf (yards) by the PDOK infrared aerial.
 * Probes: j4-courtyard-probes.json, a 4 m grid from Bloemgracht to Tuinstraat and Lijnbaansgracht to Keizersgracht (the
 * Jordaan blocks and the canal-belt block the J4 frame looks into), kept
 * on open BGT terrain inside a block (the extractor's ray test). Over 40 % of them read vegetated (lawn, bed, shrub,
 * bark, OSM park/wood) with the extract, under 5 % without it (the pin is live).
 */
const VEGETATED_LAYERS = new Set(['lawn', 'bed', 'shrub', 'bark', 'park', 'wood']);
async function courtyardRegressions(): Promise<void> {
  const fixture = JSON.parse(readFileSync('scripts/own-ground/j4-courtyard-probes.json', 'utf8')) as { probes: [number, number][] };
  const probes = fixture.probes.map(([x, y]) => [x / 10, y / 10] as [number, number]);
  const share = async (s: GroundStore) => {
    const keys = [...new Set(probes.map(([x, y]) => s.cellAt(x, y)))];
    const cells: BuiltCell[] = [];
    for (const k of keys) cells.push(buildCell({ ...(await s.cellInput(k, 0)), pockets: false }));
    const tops = probes.map(([x, y]) => {
      const hits = cells.flatMap(c => layersAt(c, x, y).hits).filter(h => !h.cut && h.layer !== 'water').sort(compareHits);
      return hits[0]?.layer ?? 'none';
    });
    const count = (t: string) => tops.filter(x => x === t).length;
    return { veg: tops.filter(t => VEGETATED_LAYERS.has(t)).length / Math.max(1, tops.length), land: count('land') / Math.max(1, tops.length), paving: count('paving') / Math.max(1, tops.length) };
  };
  await noCourtyards.init();
  const on = await share(store), off = await share(noCourtyards);
  const pct = (v: number) => `${(v * 100).toFixed(0)} %`;
  check(probes.length > 500 && on.veg > 0.4, `J4 Jordaan courtyards: ${pct(on.veg)} of ${probes.length} block-interior probes vegetated, ${pct(on.paving)} paving, ${pct(on.land)} bare land (want > 40 % vegetated)`);
  check(off.veg < 0.05, `J4: without courtyards-v1 ${pct(off.veg)} vegetated, ${pct(off.land)} bare land (want < 5 %: the pin is live)`);
}

/**
 * The far ring (lane belt audit 2026-10-14): the aerial views over Nieuw-West and Noord that ended in an edge. Each
 * named block builds all four parts with land, water, green and streets, within FAR_BLOCK_BUDGET and without dropping
 * a street tier (measured 6.6k-11.7k triangles, 0.4-0.75 MB, 4-14 ms).
 */
async function farRingRegressions(): Promise<void> {
  for (const [label, lng, lat] of [['Nieuw-West (Osdorpplein)', 4.8020, 52.3590], ['Noord (Buikslotermeerplein)', 4.9380, 52.4000], ['Noord (NDSM)', 4.8960, 52.4010]] as const) {
    const [x, y] = toLocal(lng, lat), key = farBlockOf(store.cellAt(x, y)), input = await store.farInput(key);
    if (!input) { check(false, `far ring ${label}: block ${key} has no input`); continue; }
    const b = buildFarBlock(input), L = b.stats.byLayer;
    check(b.parts.length === 4 && L.land > 0 && L.water > 0 && L.green > 0 && L.street > 0 && b.stats.tiers === 4 && b.stats.triangles <= FAR_BLOCK_BUDGET,
      `far ring ${label} (block ${key}): ${b.parts.length} parts, ${b.stats.triangles} triangles (land ${L.land}, water ${L.water}, green ${L.green}, street ${L.street}), ${(b.stats.bytes / 1048576).toFixed(2)} MB, ${b.stats.buildMs} ms, street tiers ${b.stats.tiers}/4 (want <= ${FAR_BLOCK_BUDGET}, all layers)`);
  }
}

/**
 * The OSM park fill under the BGT surfaces (lane belt audit 2026-10-14): fill triangles and land quads wholly inside
 * one surface are not drawn. Pinned: the Cremerplein and Vondelpark cells lose at least 10k triangles each, and a
 * Vondelpark hollow where the 8 m lawn drape sags 3.6 cm under the 5 m land grid shows lawn, not land (it showed
 * land when only the fill was culled).
 */
async function parkFillRegressions(): Promise<void> {
  for (const [label, key, minCulled] of [['Cremerplein', '-3_-2', 10000], ['Vondelpark', '-2_-2', 10000]] as const) {
    const c = buildCell({ ...(await store.cellInput(key, 0)), pockets: false }), p = c.stats.parks;
    const saved = (p?.fillCulled ?? 0) + 2 * (p?.landCulled ?? 0);
    check(saved >= minCulled, `park fill ${label} (${key}): ${p?.fillCulled} fill triangles and ${p?.landCulled} land quads under the BGT surfaces not drawn (${saved} triangles, want >= ${minCulled})`);
  }
  const [x, y] = toLocal(4.86793, 52.35712), cell = buildCell({ ...(await store.cellInput(store.cellAt(x, y), 0)), pockets: false });
  const top = layersAt(cell, x, y).top;
  check(top === 'lawn', `park fill Vondelpark hollow (4.86793,52.35712): top ${top} (want lawn: no land over the sagging lawn)`);
}

/**
 * Parks (lane parks 2026-10-13, the user's Cremerplein screenshot: one flat green with trees around a dark box).
 * Per named park, a grid of probes over its box, built with and without parks-v1:
 *  - streets untouched: every probe whose top was a street band still is (dropped park paths excepted, they are
 *    replaced by the BGT path polygon under them);
 *  - the OSM park fill is replaced by surveyed surfaces at ≥ `minPark` of its probes;
 *  - the building in the park keeps its footprint: no park surface, hedge or furniture vertex inside it.
 */
const PARKS: { id: string; at: [number, number]; half: number; minPark: number; minSurfaces: string[]; building?: { pand: string; ring: [number, number][] } }[] = [
  { id: 'J.J. Cremerplein', at: [4.8582, 52.3595], half: 70, minPark: 0.7, minSurfaces: ['lawn', 'sand', 'parkPath', 'furniture'],
    // Buurtcentrum Cremerplein, BAG pand 0363100012215668 (bag-tiles 14/8413/5385), 13 vertices.
    building: { pand: '0363100012215668', ring: [[4.858071, 52.35959], [4.85811, 52.359578], [4.858114, 52.359582], [4.858287, 52.359529], [4.858412, 52.359683], [4.858287, 52.359721], [4.858297, 52.359733], [4.858258, 52.359745], [4.858248, 52.359733], [4.858207, 52.359746], [4.858098, 52.359611], [4.858091, 52.359614], [4.858071, 52.35959]] } },
  { id: 'Bellamyplein', at: [4.8677, 52.36795], half: 40, minPark: 0.6, minSurfaces: ['lawn'] },
  { id: 'Sarphatipark', at: [4.8963, 52.3544], half: 110, minPark: 0.7, minSurfaces: ['lawn', 'shrub', 'furniture', 'hedge'] },
];
const STREET_TOPS = new Set(['asphalt', 'klinker', 'brick', 'cycle', 'paving', 'kerb', 'paint', 'tram', 'bollard', 'gravel']);
const PARK_TOPS = new Set(['lawn', 'bed', 'shrub', 'bark', 'sand', 'parkGravel', 'parkPath', 'pond', 'hedge', 'furniture', 'paving', 'cycle']);
async function parkRegressions(): Promise<void> {
  await noParks.init();
  check(store.parkCells.size > 0, `parks-v1: ${store.parkCells.size} park cells in the manifest`);
  for (const reg of PARKS) {
    const [x, y] = toLocal(reg.at[0], reg.at[1]), h = reg.half;
    const keys = GroundStore.neighbours(store.cellAt(x, y)).filter(k => {
      if (!store.covers(k)) return false;
      const r = store.cellRect(k);
      return !(r[2] < x - h || r[0] > x + h || r[3] < y - h || r[1] > y + h);
    });
    const on: BuiltCell[] = [], off: BuiltCell[] = [];
    const dropped = new Set<number>();
    for (const k of keys) {
      const input = await store.cellInput(k, 0);
      (input.dropWays ?? []).forEach(id => dropped.add(id));
      on.push(buildCell(input));
      off.push(buildCell(await noParks.cellInput(k, 0)));
    }
    // Dropped path ways near the box, with their drawn half-width (a probe on one may legitimately change).
    const input = await store.cellInput(keys[0], 0);
    const droppedWays = [input.osm, ...input.osmAround].flatMap(e => (e ? prepareWays(e.ways.filter(w => dropped.has(w.id)), input.project) : []));
    const onDropped = (px: number, py: number) => droppedWays.some(w => w.points.some((q, i) => {
      if (!i) return false;
      const a = w.points[i - 1], dx = q[0] - a[0], dy = q[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0;
      return Math.hypot(a[0] + t * dx - px, a[1] + t * dy - py) <= w.section.halfWidth + 0.6;
    }));
    const top = (cells: BuiltCell[], px: number, py: number) => cells.map(c => layersAt(c, px, py)).find(r => r.top)?.top ?? null;
    let probes = 0, streets = 0, streetLost = 0, parkFill = 0, parkDrawn = 0;
    const lost: string[] = [];
    const step = h / 10;
    for (let py = y - h; py <= y + h + 1e-6; py += step) for (let px = x - h; px <= x + h + 1e-6; px += step) {
      probes++;
      const before = top(off, px, py), after = top(on, px, py);
      if (before && STREET_TOPS.has(before) && !onDropped(px, py)) {
        streets++;
        if (!after || !STREET_TOPS.has(after)) { streetLost++; lost.push(`${(px - x).toFixed(0)},${(py - y).toFixed(0)}:${before}->${after}`); }
      }
      if (before === 'park' || before === 'wood') { parkFill++; if (after && PARK_TOPS.has(after)) parkDrawn++; }
    }
    check(streetLost === 0, `${reg.id}: ${streets - streetLost}/${streets} street probes unchanged by the park${lost.length ? ` (${lost.slice(0, 6).join(' ')})` : ''}`);
    check(parkFill > 0 && parkDrawn / parkFill >= reg.minPark, `${reg.id}: ${parkDrawn}/${parkFill} probes of the flat park fill now surveyed surfaces (want ≥ ${reg.minPark * 100} %)`);
    const layers = new Set(on.flatMap(c => Object.keys(c.layers)));
    const missing = reg.minSurfaces.filter(l => !layers.has(l));
    check(!missing.length, `${reg.id}: layers ${reg.minSurfaces.join(', ')} built${missing.length ? ` (missing ${missing.join(', ')})` : ''}`);
    const parkStats = on.map(c => c.stats.parks).filter(Boolean);
    console.log('     ', JSON.stringify({ park: reg.id, cells: keys, trianglesOn: on.reduce((t, c) => t + c.stats.triangles, 0), trianglesOff: off.reduce((t, c) => t + c.stats.triangles, 0), parks: parkStats }));
    if (reg.building) {
      const ring = reg.building.ring.map(q => toLocal(q[0], q[1]));
      const inside = (px: number, py: number) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; };
      // 0.3 m inside the footprint (BGT polygons share the pand's edge).
      const deep = (px: number, py: number) => inside(px, py) && ring.every((q, i) => { if (!i) return true; const a = ring[i - 1], dx = q[0] - a[0], dy = q[1] - a[1], l2 = dx * dx + dy * dy, t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)); return Math.hypot(a[0] + t * dx - px, a[1] + t * dy - py) > 0.3; });
      let n = 0;
      for (const c of on) for (const l of ['lawn', 'bed', 'shrub', 'bark', 'sand', 'parkGravel', 'parkPath', 'pond', 'hedge', 'furniture'] as const) {
        const m = c.layers[l];
        if (m) for (let i = 0; i < m.positions.length; i += 3) if (deep(m.positions[i], m.positions[i + 1])) n++;
      }
      check(n === 0, `${reg.id}: BAG pand ${reg.building.pand} keeps its footprint (${n} park vertices inside)`);
    }
  }
}

/**
 * Deck tops stay off the quays (ride review 2026-10-14, J6): the Nieuwe-Wercksbrug BRU0063 by the Westerkerk is
 * 17.2 m wide with an 18 m outline side, and its deck span [20.2, 53.9] runs 4–10 m past its water [24.3, 44.3]; the
 * widened deck top lay as grey slabs over the four corners, across the quay pavements and the cycle-lane ends.
 * decks.ts deckWidths clips the top to the water (+1 m onto the quay) and the bridge ways' street bands. The square
 * metres where the deck top is the topmost surface over land (roadRegressions deckSlabOnLand), with and without.
 */
const SLABS: [string, number, number, number, string][] = [['BRU0063', 4.88292, 52.37433, 40, 'Nieuwe-Wercksbrug, Raadhuisstraat']];
/** The 3×3 neighbourhood of the cell under (x, y) built from `s` at LOD 0, with the ways and the road index as the cell sees them. */
async function neighbourhood(s: GroundStore, x: number, y: number): Promise<{ key: string; cells: BuiltCell[]; ways: ReturnType<typeof resolvePriorSidewalks>; index: RoadIndex | null }> {
  const key = s.cellAt(x, y), keys = GroundStore.neighbours(key).filter(k => s.covers(k));
  const cells: BuiltCell[] = [];
  for (const k of keys) cells.push(buildCell(await s.cellInput(k, 0)));
  const input = await s.cellInput(key, 0), seen = new Set<number>();
  const ways = resolvePriorSidewalks([input.osm, ...input.osmAround].flatMap(e => (e ? prepareWays(e.ways, input.project) : [])).filter(w => !seen.has(w.id) && seen.add(w.id)));
  const index = input.roads || input.roadsAround?.some(Boolean) ? new RoadIndex([input.roads, ...(input.roadsAround ?? [])]) : null;
  return { key, cells, ways, index };
}
const cellCentre = (s: GroundStore, key: string): [number, number] => { const r = s.cellRect(key); return [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; };

/**
 * roads-v1 (lane roads-runtime 2026-10-16): with the partition on, the named junctions read as the surveyed surface,
 * the Da Costagracht deck as road, the Bilderdijkgracht zebras stop at the carriageway polygons; the earlier junction
 * and stray regressions still hold; and the pin is live (the same cell without roads draws no polygons).
 */
async function roadRegressions(): Promise<void> {
  await roadsStore.init();
  if (!roadsStore.roadCells.size) { console.log('skip roads-v1 regressions (no roads-v1 extract)'); return; }
  for (const j of [...ROAD_JUNCTIONS, ...JUNCTIONS]) {
    const [x, y] = toLocal(j.at[0], j.at[1]), n = await neighbourhood(roadsStore, x, y);
    if (!roadsStore.roadCells.has(n.key) || !n.index) { console.log(`skip ${j.id} roads (cell ${n.key} not in the roads-v1 pilot)`); continue; }
    const r = surveyedCoverage(n.cells, [x, y], j.radiusM, n.index);
    check(r.share >= j.minShare, `${j.id} roads-v1: junction interior ${r.ok}/${r.probes} read as the surveyed surface (${JSON.stringify(r.tops)})${r.misses.length ? ` misses ${JSON.stringify(r.misses.slice(0, 5))}` : ''}`);
  }
  for (const reg of STRAYS) {
    const [x, y] = toLocal(reg.at[0], reg.at[1]), n = await neighbourhood(roadsStore, x, y);
    if (!roadsStore.roadCells.has(n.key)) continue;
    const hits = strayHits(n.cells, [x, y], reg);
    check(hits.length === 0, `${reg.id} roads-v1: ${reg.probes.length - hits.length}/${reg.probes.length} fragment probes clean${hits.length ? ` ${JSON.stringify(hits)}` : ''}`);
  }
  for (const reg of ROAD_WAY_STRAYS) {
    let found = false;
    for (const key of [...roadsStore.roadCells].sort()) {
      const n = await neighbourhood(roadsStore, ...cellCentre(roadsStore, key)), way = n.ways.find(w => w.id === reg.way);
      if (!way || roadsStore.cellAt(way.points[0][0], way.points[0][1]) !== key) continue;
      found = true;
      const total = reg.fractions.length * reg.offsets.length, hits = wayStrayHits(n.cells, way, reg);
      check(hits.length === 0, `${reg.id} roads-v1: ${total - hits.length}/${total} probes clean${hits.length ? ` ${JSON.stringify(hits)}` : ''}`);
      break;
    }
    check(found, `${reg.id}: way ${reg.way} found in a roads-v1 cell`);
  }
  for (const reg of ZEBRAS) {
    let found = false;
    for (const key of [...roadsStore.roadCells].sort()) {
      const c = cellCentre(roadsStore, key), n = await neighbourhood(roadsStore, ...c), ways = n.ways.filter(w => reg.ways.includes(w.id));
      // The cell the crossings lie in (with every cell published, an earlier cell's 3×3 also holds the ways but not
      // all the polygons around them).
      if (ways.length < reg.ways.length || !n.index || roadsStore.cellAt(ways[0].points[0][0], ways[0].points[0][1]) !== key) continue;
      found = true;
      const index = n.index, onRoad = (x: number, y: number) => index.onRoad(x, y) || index.classAt(x, y) === null;
      const r = zebraOffRoad(n.cells, ways, reg, onRoad);
      check(r.off.length === 0, `${reg.id} roads-v1: ${r.dashes} paint triangles at the crossings, ${r.off.length} off the carriageway polygons${r.off.length ? ` ${JSON.stringify(r.off.slice(0, 6))}` : ''}`);
      const before = await neighbourhood(store, ...c), b = zebraOffRoad(before.cells, before.ways.filter(w => reg.ways.includes(w.id)), reg, onRoad);
      console.log(`      ${reg.id}: without roads-v1 ${b.off.length}/${b.dashes} dashes lie off the carriageway polygons`);
      break;
    }
    check(found, `${reg.id}: ways ${reg.ways.join(', ')} found in a roads-v1 cell`);
  }
  for (const reg of SURVEY_PAINT) {
    const [x, y] = toLocal(reg.at[0], reg.at[1]), n = await neighbourhood(roadsStore, x, y);
    if (!roadsStore.roadCells.has(n.key) || !n.index) { console.log(`skip ${reg.id} (cell ${n.key} not in roads-v1)`); continue; }
    const index = n.index, onCarriage = (px: number, py: number) => { const k = index.findAtLevel(px, py, false); return k >= 0 && index.records[k].h === 0 && index.drawClass(k) === 'carriage'; };
    const r = surveyPaint(n.cells, [x, y], reg.radiusM, onCarriage);
    check(r.off.length === 0 && r.paint >= reg.minPaint, `${reg.id} roads-v1: ${r.paint} paint triangles within ${reg.radiusM} m (≥ ${reg.minPaint}), ${r.off.length} off the carriageway polygons${r.off.length ? ` ${JSON.stringify(r.off.slice(0, 6))}` : ''}`);
  }
  for (const reg of SURVEY_GAPS) {
    // The cell alone, its neighbours' roads withheld: the extract's edge (where the pilot ended at the Nieuwmarkt).
    const [x, y] = toLocal(reg.at[0], reg.at[1]), key = roadsStore.cellAt(x, y);
    if (!roadsStore.roadCells.has(key)) { console.log(`skip ${reg.id} (cell ${key} not in roads-v1)`); continue; }
    const full = await roadsStore.cellInput(key, 0), roads = full.roads ?? null;
    const edge = { ...full, roadsAround: (full.roadsAround ?? []).map(r => (r === roads ? r : null)), coverWays: roads?.coverWays ?? [] };
    const index = new RoadIndex([roads]);
    const off = [buildCell(await store.cellInput(key, 0))];
    const r = gapLand([buildCell(edge)], off, [x, y], reg.radiusM, index), pin = gapLand([buildCell({ ...edge, surveyGaps: false })], off, [x, y], reg.radiusM, index);
    check(r.land <= reg.maxLandM2, `${reg.id} roads-v1 survey gap (extract edge): ${r.land} m² land of ${r.probes} m² the bands paved (≤ ${reg.maxLandM2}; without the gap pass ${pin.land})`);
    check(pin.land > reg.maxLandM2, `${reg.id}: without the survey-gap pass ${pin.land} m² land (the pin is live)`);
  }
  // Deck ends read as road (user 2026-10-16, Berensluis BRU0065: grey wedges where the bridge met the quays).
  const noEnds = new GroundStore(readExtract, { roads: true, deckEnds: false });
  await noEnds.init();
  for (const reg of DECK_ENDS) {
    const [x, y] = toLocal(reg.at[0], reg.at[1]), n = await neighbourhood(roadsStore, x, y), deck = roadsStore.surface.decks.find(d => d.profile.id === reg.id);
    check(!!deck, `${reg.id}: deck placed`);
    if (!deck) continue;
    const r = deckEndMisses(n.cells, deck);
    check(r.misses.length <= reg.maxMisses, `${reg.id} (${reg.label}) roads-v1: ${r.misses.length}/${r.probes} end probes show the deck top, water or nothing (≤ ${reg.maxMisses})${r.misses.length ? ` ${JSON.stringify(r.misses.slice(0, 6))}` : ''}`);
    if (reg.pinMin === undefined) continue;
    const off = await neighbourhood(noEnds, x, y), offDeck = noEnds.surface.decks.find(d => d.profile.id === reg.id)!;
    const p = deckEndMisses(off.cells, offDeck);
    check(p.misses.length >= reg.pinMin, `${reg.id}: without the deck-end fix ${p.misses.length} misses (≥ ${reg.pinMin}, the pin is live)`);
  }
  // Doubled lanes (lane roads-lanes 2026-10-23, R2) and the R4 artefact: at every ROAD_SPOTS crop no red lane ribbon
  // over a BGT cycle polygon and no OSM band surface over any BGT polygon; artifacts/roads/<spot>-vs-ortho.jpg written
  // (orthophoto | own ground top-down | the latest game frame from own-ground-roads.spec, when there is one).
  const ortho = new OrthoTiles();
  for (const s of ROAD_SPOTS) {
    const r = await probeSpot(roadsStore, s);
    check(r.ribbonOverCycle === 0 && r.bandOverSurvey === 0, `${s.id} roads-v1 doubled lanes: ${r.ribbonOverCycle}/${r.ribbons} lane-ribbon triangles over a cycle polygon, ${r.bandOverSurvey}/${r.bands} band triangles over a BGT polygon (both 0)${r.samples.length ? ` ${JSON.stringify(r.samples.slice(0, 4))}` : ''}`);
    let out = '';
    try { out = await writeVsOrtho(r.cells, s, ortho, { note: `${s.label} · doubled lanes ${r.ribbonOverCycle} / ${r.bandOverSurvey}` }); } catch (e) { console.log(`      ${s.id}: ${(e as Error).message}`); }
    check(!!out && existsSync(out), `${s.id}: ${out || 'vs-ortho image not written'}`);
  }
  // The pin is live: a pilot cell with roads draws polygons and culls land under them; without, no roads stats.
  const key = [...roadsStore.roadCells].sort()[0];
  const on = buildCell(await roadsStore.cellInput(key, 0)), off = buildCell(await store.cellInput(key, 0));
  check(!!on.stats.roads && on.stats.roads.drawn.carriage > 0 && on.stats.roads.landCulled > 0 && !off.stats.roads, `${key}: roads-v1 draws ${on.stats.roads?.drawn.carriage ?? 0} carriageway polygons, ${on.stats.roads?.kerbs ?? 0} kerb runs, culls ${on.stats.roads?.landCulled ?? 0} land squares; the plain store none`);
  check((on.stats.roads?.skippedHigh ?? 0) < 40, `${key}: ${on.stats.roads?.skippedHigh} deck polygons (h ≥ 1) over no deck skipped and counted`);
}

/**
 * City-wide bare land within 6 m of a carriageway (roads lane R1, 2026-10-23): every roads-v1 cell built with roads at
 * 0.5 m (render-road-sources bareLandCell), summed, written to artifacts/roads/gaps/bare-land-<label>.json (the per-spot
 * numbers are render-road-sources' table at 0.1 m). Printed per cell and in total.
 */
async function bareLandCity(): Promise<void> {
  await roadsStore.init();
  const label = process.argv.find(a => a.startsWith('--label='))?.slice(8) ?? 'run';
  const keys = [...roadsStore.roadCells].sort().filter(k => roadsStore.covers(k));
  const rows: { key: string; bareM2: number; carriageM2: number; cellM2: number; ms: number }[] = [];
  const t0 = Date.now();
  for (const key of keys) {
    const r = await bareLandCell(roadsStore, key, 0.5);
    rows.push({ key, ...r, bareM2: Math.round(r.bareM2), carriageM2: Math.round(r.carriageM2) });
    console.log(JSON.stringify({ key, bareM2: Math.round(r.bareM2), carriageM2: Math.round(r.carriageM2), ms: r.ms }));
  }
  const bare = rows.reduce((s, r) => s + r.bareM2, 0), car = rows.reduce((s, r) => s + r.carriageM2, 0), area = rows.reduce((s, r) => s + r.cellM2, 0);
  const total = { label, cells: rows.length, bareM2: bare, carriageM2: car, bareM2PerKm2: Math.round(bare / (area / 1e6)), seconds: Math.round((Date.now() - t0) / 1000) };
  mkdirSync('artifacts/roads/gaps', { recursive: true });
  writeFileSync(`artifacts/roads/gaps/bare-land-${label}.json`, JSON.stringify({ total, cells: rows }, null, 1));
  console.log(JSON.stringify(total));
}

/** roads-v1 before/after per pilot cell: triangles, build time (median of 3), gz bytes; against the lane's budgets. */
async function roadsTable(): Promise<void> {
  await roadsStore.init();
  const rows: { key: string; offTri: number; onTri: number; ratio: number; offMs: number; onMs: number; msRatio: number; gzKB: number; polys: number; skippedHigh: number; coveredWays: number; bandStations: number }[] = [];
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
  for (const key of [...roadsStore.roadCells].sort()) {
    if (!roadsStore.covers(key)) continue;
    const offIn = await store.cellInput(key, 0), onIn = await roadsStore.cellInput(key, 0);
    const offMs: number[] = [], onMs: number[] = [];
    let off!: BuiltCell, on!: BuiltCell;
    for (let i = 0; i < 3; i++) { off = buildCell(offIn); offMs.push(off.stats.buildMs); on = buildCell(onIn); onMs.push(on.stats.buildMs); }
    const r = on.stats.roads!, gz = statSync(join(ROOT, `roads-v1/cells/${key}.json.gz`)).size;
    const row = { key, offTri: off.stats.triangles, onTri: on.stats.triangles, ratio: +(on.stats.triangles / off.stats.triangles).toFixed(3), offMs: med(offMs), onMs: med(onMs), msRatio: +(med(onMs) / med(offMs)).toFixed(2), gzKB: +(gz / 1024).toFixed(0), polys: Object.values(r.drawn).reduce((a, b) => a + b, 0), skippedHigh: r.skippedHigh, coveredWays: r.coveredWays, bandStations: r.clipped?.bandStations ?? 0 };
    rows.push(row);
    console.log(JSON.stringify(row));
    check(gz <= ROAD_CELL_BUDGET_GZ, `${key}: roads-v1 gz ${row.gzKB} KB ≤ ${(ROAD_CELL_BUDGET_GZ / 1024).toFixed(0)} KB`);
  }
  const ratios = rows.map(r => r.ratio), msR = rows.reduce((a, r) => a + r.onMs, 0) / rows.reduce((a, r) => a + r.offMs, 0);
  console.log(JSON.stringify({ cells: rows.length, triangleRatioMax: Math.max(...ratios), triangleRatioMedian: med(ratios), buildMsRatio: +msR.toFixed(2), offMsMedian: med(rows.map(r => r.offMs)), onMsMedian: med(rows.map(r => r.onMs)) }));
  check(Math.max(...ratios) <= ROADS_TRIANGLE_RATIO_MAX, `roads-v1 triangles ≤ ${ROADS_TRIANGLE_RATIO_MAX}× in every pilot cell`);
  check(msR <= ROADS_BUILD_MS_RATIO_MAX, `roads-v1 build time ≤ ${ROADS_BUILD_MS_RATIO_MAX}× (summed medians)`);
  if (failed) process.exit(1);
}

async function deckSlabRegressions(): Promise<void> {
  const noClip = new GroundStore(readExtract, { clipDecks: false });
  await noClip.init();
  for (const [id, lng, lat, max, label] of SLABS) {
    const [x, y] = toLocal(lng, lat);
    const slab = async (s: GroundStore) => {
      const cells: BuiltCell[] = [];
      for (const k of GroundStore.neighbours(s.cellAt(x, y)).filter(k => s.covers(k))) cells.push(buildCell(await s.cellInput(k, 0)));
      return deckSlabOnLand(cells, s.surface.decks.find(d => d.profile.id === id)!);
    };
    const on = await slab(store), off = await slab(noClip);
    check(on.slabM2 <= max, `${id} (${label}): deck top over land ${on.slabM2} m² of ${on.deckM2} m² seen (at most ${max})`);
    check(off.slabM2 > 2 * max, `${id}: without the clip ${off.slabM2} m² (the pin is live)`);
  }
}

/**
 * Canal-mouth parapets (user 2026-10-16, Marnixstraat over the Bullebakssluis BRU0160, "no idea what this bridge is
 * trying to be"): two railing stubs turned in across the pavement and the cycle path at the slab's corners. Each side's
 * parapet now runs straight along the deck edge over the water from quay to quay (decks.ts parapetRuns): over its run the
 * edge never falls more than 1 m inside that side's widest and never reaches the carriageway (≥ 1 m past the road's
 * half-width), the run covers the water span, the deck under the parapets is not water, and the bridge is the
 * canal-mouth kind (decks.ts canalMouth: brick-rail parapet, a flat girder opening, no lamps). Both road modes.
 */
const PARAPETS: [string, number, number, string][] = [['BRU0160', 4.87615, 52.37375, 'Marnixstraat over the Bullebakssluis']];
async function parapetRegressions(): Promise<void> {
  for (const [id, lng, lat, label] of PARAPETS) for (const [mode, s] of [['osm', store], ['roads', roadsStore]] as const) {
    if (s === roadsStore) await roadsStore.init();
    const [x, y] = toLocal(lng, lat);
    let input: KitInput | null = null;
    kitTrace.input = k => { if (k.id === id && k.lod === 0) input = k; };
    const cells: BuiltCell[] = [];
    for (const k of GroundStore.neighbours(s.cellAt(x, y)).filter(k => s.covers(k))) cells.push(buildCell(await s.cellInput(k, 0)));
    kitTrace.input = null;
    const got = input as KitInput | null;
    check(!!got, `${id} (${label}, ${mode}): kit built`);
    if (!got) continue;
    const info = cells.flatMap(c => c.stats.bridges.decks).find(d => d.id === id);
    check(got.facts?.parapet === 'brick-rail' && !!info?.mouth && info.lamps === 0 && info.arches === 1, `${id} ${mode}: canal-mouth kind (parapet ${got.facts?.parapet}, mouth ${info?.mouth}, lamps ${info?.lamps}, openings ${info?.arches})`);
    const p = s.surface.decks.find(d => d.profile.id === id)!.profile, hw = [...p.halfWidth].sort((a, b) => a - b)[p.halfWidth.length >> 1], span = p.water ?? p.deck;
    const width = (r: KitRow, side: number) => Math.hypot((side ? r.R : r.L)[0] - r.c[0], (side ? r.R : r.L)[1] - r.c[1]);
    for (const side of [0, 1]) {
      const run = got.parapetSides?.[side] ?? got.parapet, on = got.rows.filter(r => r.s >= run[0] - 1e-6 && r.s <= run[1] + 1e-6), all = got.rows.filter(r => r.s >= got.parapet[0] && r.s <= got.parapet[1]);
      const w = on.map(r => width(r, side)), max = Math.max(...w), min = Math.min(...w), oldMin = Math.min(...all.map(r => width(r, side)));
      const name = side ? 'right' : 'left';
      check(min >= max - 1 && min >= hw + 1, `${id} ${mode} ${name} parapet: edge ${min.toFixed(1)}-${max.toFixed(1)} m off the axis over its run (carriageway half-width ${hw.toFixed(1)}; no stub turns in)`);
      check(run[1] - run[0] >= span[1] - span[0] - 0.6, `${id} ${mode} ${name} parapet runs ${(run[1] - run[0]).toFixed(1)} m over ${(span[1] - span[0]).toFixed(1)} m of water`);
      if (side === 0) check(oldMin < max - 2, `${id} ${mode}: over the whole deck span the left edge turns in to ${oldMin.toFixed(1)} m (the pin is live)`);
      // The deck within the parapet: 1 m inside it at mid-run, the top is no water.
      const mid = on[on.length >> 1], e = side ? mid.R : mid.L, n = side ? -1 : 1, qx = e[0] - mid.n[0] * n * 1, qy = e[1] - mid.n[1] * n * 1;
      const top = cells.flatMap(c => layersAt(c, qx, qy).hits).filter(h => !h.cut).sort(compareHits)[0];
      check(!!top && top.layer !== 'water', `${id} ${mode} ${name}: inside the parapet the top is ${top?.layer ?? 'nothing'}`);
    }
  }
}

/**
 * Bridges drawn (user 2026-10-16, "bridge missing entirely here": the Jan Evertsenstraat over the Erasmusgracht beside
 * the Erasmuspark ended at the quay wall, open water across the street, the far bank resuming). No measured deck or flat
 * footprint carried its bridge ways, so their bands draped on the canal bed under the water. The way decks (wayDecks.ts)
 * give them one: every named bridge way carries a drawn surface (audit-bridge-surfaces.ts), and without the way decks it
 * does not (the pin is live).
 */
const BRIDGE_SURFACES: [number, number, number, string][] = [[323258135, 4.84795, 52.36965, 'Jan Evertsenstraat over the Erasmusgracht']];
/**
 * Bridges mapped as consecutive OSM ways (lane bridge-decks-followups 2026-10-16, audit-bridge-surfaces --streets: 31 of
 * 1,294 street bridge ways had no surface). Each way alone ends over the water, so wayDeckProfile refused both halves;
 * joined end to end (wayDecks.ts joinChains) they carry one way deck. Without the join they do not (the pin is live).
 */
const CHAINED_BRIDGE_SURFACES: [number, number, number, string][] = [
  [24343390, 4.93743, 52.33298, 'Satellietbaan, first of two ways'],
  [1252138995, 4.93755, 52.33298, 'Satellietbaan, second of two ways'],
];
async function bridgeSurfaceRegressions(): Promise<void> {
  const off = new GroundStore(readExtract, { wayDecks: false });
  await off.init();
  for (const [id, lng, lat, label] of BRIDGE_SURFACES) {
    const [x, y] = toLocal(lng, lat), key = store.cellAt(x, y);
    const on = await auditBridgeSurfaces(store, [key]), was = await auditBridgeSurfaces(off, [key]);
    const miss = (r: typeof on) => r.missing.find(m => m.id === id);
    check(!miss(on), `bridge way ${id} (${label}): a surface along it${miss(on) ? ` (missing ${miss(on)!.missing}/${miss(on)!.stations})` : ''}; ${on.missing.length} of ${on.ways} bridge ways in ${key} missing`);
    check(!!miss(was), `bridge way ${id}: without the way decks ${miss(was)?.missing ?? 0}/${miss(was)?.stations ?? 0} stations missing (the pin is live)`);
  }
  const unjoined = new GroundStore(readExtract, { wayDeckChains: false });
  await unjoined.init();
  for (const [id, lng, lat, label] of CHAINED_BRIDGE_SURFACES) {
    const [x, y] = toLocal(lng, lat), key = store.cellAt(x, y);
    const on = await auditBridgeSurfaces(store, [key]), was = await auditBridgeSurfaces(unjoined, [key]);
    const miss = (r: typeof on) => r.missing.find(m => m.id === id);
    check(!miss(on), `bridge way ${id} (${label}): a surface along it${miss(on) ? ` (missing ${miss(on)!.missing}/${miss(on)!.stations})` : ''}`);
    check(!!miss(was), `bridge way ${id}: without joining consecutive ways ${miss(was)?.missing ?? 0}/${miss(was)?.stations ?? 0} stations missing (the pin is live)`);
  }
}

/**
 * Way decks over a hole (user 2026-10-16, "the railing runs diagonally across the cycle path" at the Jan Evertsenstraat
 * over the Erasmusgracht): the bridge spans the canal and the Rembrandtpark underpass beside it (OSM path 122525654,
 * municipal panorama TMX7316010203-002500_pano_0000_000916 under the deck), and the relief is interpolated low under the
 * whole structure. The way deck ended 1 m past the water, its approach landed in the underpass 1.8 m under the west
 * bank, the street sloped down into it and the south parapet ran 1.7 m down its ramp. Now (wayDecks.ts HOLE_M) the
 * deck runs on to the far bank: over the underpass the street stays within 0.6 m of the west bank, and each parapet
 * stays within 0.6 m of the deck level over its run, reaching past the underpass. Without the hole rule it does not
 * (the pin is live). Both road modes.
 */
const WAY_DECK_HOLES: [string, number, number, [number, number], string][] = [['OSM323258135', 4.84795, 52.36965, [4.84787, 52.36963], 'Jan Evertsenstraat over the Erasmusgracht and the Rembrandtpark underpass']];
async function wayDeckHoleRegressions(): Promise<void> {
  const noHoles = new GroundStore(readExtract, { wayDeckHoles: false });
  await noHoles.init();
  for (const [id, lng, lat, underpass, label] of WAY_DECK_HOLES) for (const [mode, s] of [['osm', store], ['roads', roadsStore], ['no-holes', noHoles]] as const) {
    await s.init();
    const [x, y] = toLocal(lng, lat), [ux, uy] = toLocal(underpass[0], underpass[1]);
    let input: KitInput | null = null;
    const drawn: [number, number][][] = [[], []];
    kitTrace.input = k => { if (k.id === id && k.lod === 0) input = k; };
    parapetTrace.fn = (pid, side, line, at) => { if (pid === id && at.level === 0) drawn[side > 0 ? 0 : 1].push([line[0].s, line[line.length - 1].s]); };
    for (const k of GroundStore.neighbours(s.cellAt(x, y)).filter(k => s.covers(k))) buildCell(await s.cellInput(k, 0));
    kitTrace.input = null; parapetTrace.fn = null;
    const got = input as KitInput | null;
    check(!!got, `${id} (${label}, ${mode}): kit built`);
    if (!got) continue;
    const bank = got.rows[0].z, over = s.surface.height(ux, uy);
    const live = mode === 'no-holes';
    const level = Math.abs(over - bank) <= 0.6;
    check(live ? !level : level, `${id} ${mode}: over the underpass the street at ${over.toFixed(2)} m, the west bank ${bank.toFixed(2)} m${live ? ' (without the hole rule it sinks: the pin is live)' : ''}`);
    if (live) continue;
    for (const side of [0, 1]) {
      const run = got.parapetSides?.[side] ?? got.parapet, on = got.rows.filter(r => r.s >= run[0] - 1e-6 && r.s <= run[1] + 1e-6);
      const drop = Math.max(...on.map(r => Math.abs((side ? r.zR : r.zL) - r.z)));
      // Past the underpass: the run's end station beyond the station nearest the path, plus its half-width (2.35 m).
      // The drawn parapet (railingRuns railRuns pieces) reaches past it too.
      const atPath = got.rows.reduce((m, r) => (Math.hypot(r.c[0] - ux, r.c[1] - uy) < Math.hypot(m.c[0] - ux, m.c[1] - uy) ? r : m));
      const end = Math.max(-Infinity, ...drawn[side].map(p => p[1])), reach = run[1] > atPath.s + 2.35 && end > atPath.s + 2.35;
      check(drop <= 0.6 && reach, `${id} ${mode} ${side ? 'right' : 'left'} parapet: within ${drop.toFixed(2)} m of the deck level over ${(run[1] - run[0]).toFixed(1)} m, drawn to s ${end.toFixed(1)}, ${reach ? 'past' : 'short of'} the underpass (s ${atPath.s.toFixed(1)})`);
    }
  }
}

/**
 * Way-deck parapets at the carriageway's edge (coordinator 2026-10-16, the motorway viaducts: the PDOK orthophoto puts
 * the railings at the outer edges of each carriageway, ours ran down the middle lanes at the OSM way's half-width).
 * roads-v1: the drawn parapet points (level 0) lie within CARRIAGE_EDGE_M of the carriageway polygon's outer edge
 * (carriageway CARRIAGE_EDGE_M inside the point, none CARRIAGE_EDGE_M outside it) at CARRIAGE_EDGE_SHARE of them at
 * least; with the way decks at the way's half-width (wayDeckCarriage: false) they do not (the pin is live).
 */
const CARRIAGE_EDGE_M = 0.5, CARRIAGE_EDGE_SHARE = 0.75;
const WAY_DECK_CARRIAGE: [string, number, number, string][] = [
  ['OSM7382983', 4.84286, 52.35607, 'motorway viaduct over the water and a cycle path, Nieuw-West'],
  ['OSM7041280', 4.95495, 52.40128, 'motorway viaduct over the water and a cycle path, Noord'],
];
async function wayDeckCarriageRegressions(): Promise<void> {
  const halfWidth = new GroundStore(readExtract, { roads: true, wayDeckCarriage: false });
  await halfWidth.init();
  await roadsStore.init();
  for (const [id, lng, lat, label] of WAY_DECK_CARRIAGE) for (const [mode, s] of [['roads', roadsStore], ['half-width', halfWidth]] as const) {
    const [x, y] = toLocal(lng, lat), around = GroundStore.neighbours(s.cellAt(x, y));
    const index = new RoadIndex(await Promise.all(around.map(k => s.roadCell(k))));
    // The road deck's own surface: the carriageway, and since roads-v2 (lane R1) the paved berm strip (verharde berm, the
    // hard shoulder) between it and the barrier. On OSM7382983 the survey puts a ~0.6 m deck-level berm outside the west
    // carriageway, so the parapet stands at the berm's outer edge, not the carriageway's (17 of 32 points read the berm
    // 0.5 m inside them; this failed on main before the #52 lane). A berm on the ground (h 0) beside the deck is not road deck.
    const carriage = (px: number, py: number) => { const k = index.findAtLevel(px, py, true); if (k < 0) return false; const c = index.drawClass(k); return c === 'carriage' || (c === 'berm' && index.records[k].h >= 1); };
    const pts: { p: [number, number]; out: [number, number] }[] = [];
    parapetTrace.fn = (pid, _side, line, at) => { if (pid === id && at.level === 0) for (const q of line) pts.push({ p: [q.p[0], q.p[1]], out: [q.out[0], q.out[1]] }); };
    for (const k of around.filter(k => s.covers(k))) buildCell(await s.cellInput(k, 0));
    parapetTrace.fn = null;
    const at = pts.filter(({ p, out }) => carriage(p[0] - out[0] * CARRIAGE_EDGE_M, p[1] - out[1] * CARRIAGE_EDGE_M) && !carriage(p[0] + out[0] * CARRIAGE_EDGE_M, p[1] + out[1] * CARRIAGE_EDGE_M)).length;
    const share = pts.length ? at / pts.length : 0, ok = share >= CARRIAGE_EDGE_SHARE, live = mode === 'half-width';
    check(pts.length > 0 && (live ? !ok : ok), `${id} (${label}, ${mode}): ${at} of ${pts.length} parapet points within ${CARRIAGE_EDGE_M} m of the carriageway's outer edge (${(share * 100).toFixed(0)}%)${live ? ' (at the way half-width: the pin is live)' : ''}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
