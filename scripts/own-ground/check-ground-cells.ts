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
import { buildCell, layersAt, type BuiltCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { GroundSurface } from '../../src/canalRecall/ownGround/surface.ts';

const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async path => {
  const file = join(ROOT, path);
  if (!existsSync(file)) throw new Error(`${path}: missing`);
  const bytes = readFileSync(file);
  return new Uint8Array(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);
});

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
    console.log(JSON.stringify({ cells: rows.length, trianglesPerCell: Math.round(t / rows.length), MBPerCell: +(mb / rows.length).toFixed(1), buildMsMedian: ms[ms.length >> 1], buildMsMax: ms[ms.length - 1] }));
    return;
  }
  for (const [id, lng, lat, label] of [['BRU0166', 4.87445, 52.37286, 'Nassaukade / Bilderdijkgracht mouth'], ['BRU0044', 4.8875, 52.3665, 'Leidsegracht arch'], ['BRU0067', 4.882711, 52.366289, 'Angenietje Swarthofbrug, Leidsegracht / Prinsengracht']] as const) {
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
    // A masonry arch is steep (BRU0044: 1.5 m over a few metres); 0.35 m per 0.5 m is the prototype's own surface.
    check(worst < (p.family === 'masonry-arch' ? 0.35 : 0.15), `${id}: deck axis continuous (largest 0.5 m step ${worst.toFixed(3)} m)`);
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
    {
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
    check(!!near.layers.deckBody && (near.layers.deckBody.indices.length > 0), `${id}: deck body built`);
    check(!!near.layers.quay && !!near.layers.water, `${id}: quay walls and water in the cell`);
    check(near.lod === 0 && far.stats.triangles < near.stats.triangles * 0.6, `${id}: LOD 1 is lighter (${far.stats.triangles} vs ${near.stats.triangles} triangles)`);
  }
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

main().catch(e => { console.error(e); process.exit(1); });
