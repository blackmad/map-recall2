// Build streamed own-ground cells offline (the worker's code path, from the
// published extracts) and report coverage, sizes and timings, plus the named
// regressions in their streamed cells:
//
//   npx tsx scripts/own-ground/check-ground-cells.ts            # cells around BRU0166 + BRU0044, both LODs
//   npx tsx scripts/own-ground/check-ground-cells.ts --all      # every cell of the OSM cell manifest (LOD 0)
//
// Exit code 1 on a failed check.
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, compareHits, layersAt, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { GroundSurface } from '../../src/canalRecall/ownGround/surface.ts';
import { buildFarBlock, farBlockOf, FAR_BLOCK_BUDGET } from '../../src/canalRecall/ownGround/farRing.ts';
import { bridgeFacts, flatHintAt, KIT_BUDGET, registerHint } from '../../src/canalRecall/ownGround/bridgeKit.ts';
// Named canal-belt bridges (bridgeHints BRIDGE_FACTS, lane bridge-fidelity 2026-10-14) take the named tier.
const budgetOf = (id: string) => (bridgeFacts(id)?.named ? { near: KIT_BUDGET.named, far: KIT_BUDGET.namedFar } : { near: KIT_BUDGET.near, far: KIT_BUDGET.far });
import { prepareWays, resolvePriorSidewalks } from '../../src/canalRecall/ownGround/streets.ts';
import { bandCoverage, deckSlabOnLand, deckStreetTop, junctionCoverage, strayHits, DE_CLERCQSTRAAT, JUNCTIONS, STRAYS } from '../../src/canalRecall/ownGround/roadRegressions.ts';

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

async function main(): Promise<void> {
  await store.init();
  console.log(JSON.stringify({ osmCells: store.osmCells.size, reliefTiles: store.relief.tiles.length }));
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
          if (!top || !['asphalt', 'klinker', 'paving', 'cycle', 'paint', 'kerb'].includes(top)) bad.push(`${f}/${o}:${top}`);
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
  await pocketRegressions();
  await openingRegressions();
  await approachRegressions();
  await deckSlabRegressions();
  await zooRegressions();
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
    const street = on.filter(t => ['asphalt', 'klinker', 'paving', 'cycle', 'kerb', 'paint'].includes(t)).length;
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
const STREET_TOPS = new Set(['asphalt', 'klinker', 'cycle', 'paving', 'kerb', 'paint', 'tram', 'bollard', 'gravel']);
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

main().catch(e => { console.error(e); process.exit(1); });
