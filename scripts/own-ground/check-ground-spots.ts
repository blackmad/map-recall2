// Ground pins for the named places (lane G1 of the Ground v2 plan, issue #376): every G0 named place
// (groundRegressions.ts GROUND_SPOTS) keeps its shard area under the ceiling G1 measured (+5 %), the Kranenbergpad
// window keeps its ground (float and > 5 cm poke) bounded, Overschiestraat's three tunnel ways stay one slot, and no
// closed tunnel mouth stands without a tunnel way ahead in G0's cells (portal sanity). Node only, the worker's build path
// (GroundStore.cellInput + buildCell, production defaults), about two minutes.
//
//   node --import tsx scripts/own-ground/check-ground-spots.ts           exit 1 on a failed pin
//   node --import tsx scripts/own-ground/check-ground-spots.ts --help
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { auditCell } from '../../src/canalRecall/ownGround/groundAudit.ts';
import { GROUND_SPOTS, GROUND_SPOT_RADIUS_M } from '../../src/canalRecall/ownGround/groundRegressions.ts';
import { R2_GROUND_PROBES, R2_GROUND_SPOTS, R2_ROAD_PROBES, R2_ZFIGHT_M2 } from '../../src/canalRecall/ownGround/r2GroundRegressions.ts';
import { OPEN_GROUND_LAYER } from '../../src/canalRecall/ownGround/groundSurface.ts';
import { layersAt } from '../../src/canalRecall/ownGround/groundCell.ts';
import { bridgeFeedbackRegressions } from './bridge-feedback-pins.ts';

const HELP = `check-ground-spots — G1 pins on the G0 named ground places (issue #376)

  node --import tsx scripts/own-ground/check-ground-spots.ts

Pins (ceilings are G1's measured values + 5 %, m2 within ${GROUND_SPOT_RADIUS_M} m of each place, 0.5 m raster):
  shard area per named place; Kranenbergpad float and > 5 cm poke; Overschiestraat one slot over its three tunnel ways;
  no closed mouth without a tunnel-tagged way within 25 m in cells 2_3 and -4_-4; the named building fronts (lane F4,
  frontRegressions.ts) not buried by the street under the base rule; the bridge feedback pins of
  bridge-feedback-pins.ts (Muntplein railings, survey caps, Lelylaan). Exit 1 on a failure.`;
if (process.argv.includes('--help')) { console.log(HELP); process.exit(0); }

const ROOT = 'public/data/extracts/amsterdam';
const read = async (p: string) => { const f = join(ROOT, p); if (!existsSync(f)) throw new Error(`${p}: missing`); const b = readFileSync(f); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };

/** G1's shard area per place (all fixes on, 2026-11-12, b4f5ffdcd); the pin is this + 5 %. G0's before in the comment. */
export const SPOT_SHARD_M2: Record<string, number> = {
  'piet-kranenbergpad': 7913, // G0 9,950
  'anthony-fokkerweg': 7017, // 10,391
  'vlaardingenlaan-naaldwijkstraat': 6142, // 7,082
  'amstelveenseweg-viaduct': 3794, // 4,139
  'schinkel-jachthavenweg': 8027, // 10,009
  overschiestraat: 2557, // 3,986
  sportparklaan: 4858, // 7,151
  'lelylaan-delflandlaan': 4394, // 5,657
  'radarweg-south-abutment': 8494, // 9,303
};
/** Kranenbergpad's ground under the ring and rail decks (G0: float 2,041, poke > 5 cm 93 at the best tile). */
const KRANENBERG = { floatM2: 400, pokeSevereM2: 900 };
const SLACK = 1.05;

let failed = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

async function main(): Promise<void> {
  const store = new GroundStore(read, { parks: true, roads: true, rails: true });
  await store.init();
  const byCell = new Map<string, typeof GROUND_SPOTS[number][]>();
  for (const s of GROUND_SPOTS) { const [x, y] = toLocal(s.lng, s.lat), k = store.cellAt(x, y); (byCell.get(k) ?? byCell.set(k, []).get(k)!).push(s); }
  for (const [key, spots] of byCell) {
    const input = await store.cellInput(key, 0), cell = buildCell(input);
    const audit = auditCell({ cell, dtm: store.surface.relief, windows: spots.map(s => { const [x, y] = toLocal(s.lng, s.lat); return { id: s.id, x, y, r: GROUND_SPOT_RADIUS_M }; }), noTJunctions: true });
    for (const s of spots) {
      const d = audit.windows[s.id].d, cap = SPOT_SHARD_M2[s.id] * SLACK;
      check(d.shardM2 <= cap, `${s.id}: shard ${d.shardM2.toFixed(0)} m2 <= ${cap.toFixed(0)} (float ${d.floatM2.toFixed(0)}, poke ${d.pokeM2.toFixed(0)}, z-fight ${d.zfightM2.toFixed(0)}, thin ${d.thinM2.toFixed(0)})`);
      if (s.id === 'piet-kranenbergpad') {
        check(d.floatM2 <= KRANENBERG.floatM2, `piet-kranenbergpad: ground float ${d.floatM2.toFixed(0)} m2 <= ${KRANENBERG.floatM2}`);
        check(d.pokeSevereM2 <= KRANENBERG.pokeSevereM2, `piet-kranenbergpad: poke > 5 cm ${d.pokeSevereM2.toFixed(0)} m2 <= ${KRANENBERG.pokeSevereM2}`);
      }
    }
    // Overschiestraat: one slot over the road, cycleway and footway tunnels.
    if (spots.some(s => s.id === 'overschiestraat')) {
      const [x, y] = toLocal(4.841, 52.34335);
      const slots = (input.cuts ?? []).filter(c => c.kind === 'slot' && Math.min(...c.x.map((cx, i) => Math.hypot(cx - x, c.y[i] - y))) < 15);
      check(slots.length === 1, `overschiestraat: ${slots.length} slot(s) at the underpass (one: portal sanity merges the parallel tunnel ways)`);
      if (slots[0]) check(slots[0].left[0] >= 6, `overschiestraat: the slot reaches ${slots[0].left[0].toFixed(1)} m each side (>= 6: the cycleway and footway inside)`);
    }
    store.forgetCells(new Set(GroundStore.neighbours(key)));
  }
  // Portal sanity: no dark mouth without a tunnel way ahead (G0: cells 2_3 and -4_-4, the Jachthavenweg ramp).
  for (const key of ['2_3', '-4_-4']) {
    const input = await store.cellInput(key, 0), pts: [number, number][] = [];
    for (const o of [input.osm, ...input.osmAround]) for (const w of o?.ways ?? []) if (w.tags.tunnel && w.tags.tunnel !== 'no') for (const g of w.g) pts.push(toLocal(g[0], g[1]));
    let bad = 0;
    for (const c of input.cuts ?? []) for (const p of c.portals) if (!p.open && !pts.some(q => Math.hypot(q[0] - c.x[p.at], q[1] - c.y[p.at]) <= 25)) bad++;
    check(bad === 0, `${key}: ${bad} closed mouth(s) with no tunnel way within 25 m`);
    store.forgetCells(new Set(GroundStore.neighbours(key)));
  }
  // Lane R2-D (feedback 762c6e04, b1e259b9, ab50459f, a5806a8e 2026-11-13): open ground no longer lies under the parks (the
  // Rembrandtpark shimmer was coplanar garden and shrub fills under the parks' lawn and shrub), and the Houthavens
  // building-site sand draws as bare earth, not as the park sand's yellow.
  const r2Cells = new Map<string, typeof R2_GROUND_SPOTS[number][]>();
  for (const s of R2_GROUND_SPOTS) { const [x, y] = toLocal(s.lng, s.lat), k = store.cellAt(x, y); (r2Cells.get(k) ?? r2Cells.set(k, []).get(k)!).push(s); }
  for (const [key, spots] of r2Cells) {
    const input = await store.cellInput(key, 0), cell = buildCell(input);
    const audit = auditCell({ cell, dtm: store.surface.relief, windows: spots.map(s => { const [x, y] = toLocal(s.lng, s.lat); return { id: s.name, x, y, r: s.r }; }), noTJunctions: true });
    for (const s of spots) {
      const w = audit.windows[s.name], cap = R2_ZFIGHT_M2[s.name], garden = w.byLayer?.garden?.zfight ?? 0;
      check(w.d.zfightM2 <= cap.total, `${s.name} (${s.feedback}): z-fight ${w.d.zfightM2.toFixed(0)} m2 <= ${cap.total}`);
      check(garden <= cap.garden, `${s.name} (${s.feedback}): garden z-fight ${garden.toFixed(0)} m2 <= ${cap.garden} (open-ground meadow under a parks lawn)`);
    }
    for (const p of R2_GROUND_PROBES) {
      const [x, y] = toLocal(p.lng, p.lat);
      if (store.cellAt(x, y) !== key) continue;
      const top = layersAt(cell, x, y).top;
      check(OPEN_GROUND_LAYER[p.cover] === p.layer && top === p.layer, `${p.spot} (${p.what}): drawn as ${top}, expected ${p.layer}`);
    }
    for (const p of R2_ROAD_PROBES) {
      const [x, y] = toLocal(p.lng, p.lat);
      if (store.cellAt(x, y) !== key) continue;
      const top = layersAt(cell, x, y).top;
      check(top === p.layer, `${p.spot} (${p.what}): drawn as ${top}, expected ${p.layer} (a big asphalt square is not pale paving)`);
    }
    store.forgetCells(new Set(GroundStore.neighbours(key)));
  }
  // Lane F4: the named building fronts the street must not bury (frontRegressions.ts, the Kinkerbrug approach).
  const fronts = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/own-ground/audit-building-fronts.ts', '--named', '--check', '--out', 'artifacts/ground-audit/fronts-named.json'], { encoding: 'utf8' });
  for (const line of (fronts.stdout ?? '').split('\n').filter(l => /^\s+(ok|FAIL) /.test(l))) console.log(line.trim().replace(/^(ok|FAIL)\s+/, (_, w) => `${w === 'ok' ? 'ok  ' : 'FAIL'} front `));
  check(fronts.status === 0, `named building fronts not buried by the street (audit-building-fronts --named)${fronts.status ? `: ${(fronts.stderr ?? '').slice(-400)}` : ''}`);
  // Bridge feedback pins (2026-11-13: Muntplein rails, Rijckerbrug/Machineslootbrug slabs, Lelylaan), here so they gate check:canal.
  await bridgeFeedbackRegressions(read, check);
  console.log(failed ? `${failed} ground spot pin(s) failed` : 'ground spot pins passed');
  if (failed) process.exitCode = 1;
}
await main();
