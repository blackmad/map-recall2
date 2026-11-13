// City-wide audit: ground above the building base along open walls (lane F4, feedback 2026-11-13). See HELP.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { GroundStore, toLocal, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { footprintBase, frontBase, drapeFoot, type Vec2 } from '../../src/canalRecall/ownGround/placement.ts';
import { FRONT_SPOTS } from '../../src/canalRecall/ownGround/frontRegressions.ts';

const HELP = `audit-building-fronts — ground above the building base along open walls (lane F4)

  node --import tsx scripts/own-ground/audit-building-fronts.ts [--out artifacts/f4/fronts.json] [--check]

For every ground-standing building (building-tiles z14, minHeight < 0.5 m) samples the relief ${'0.6'} m outside each open
wall (not inside another footprint) every metre, and compares it with the base under the old rule (the lowest relief
under the footprint) and the new one (placement.ts frontBase). A wall is buried where the ground stands more than
${'0.3'} m over the base; a building counts when at least 2 m of its open walls are. Also reports the plinth the new rule
shows (base above the draped wall foot) and the named fronts (frontRegressions.ts).
--named: only the buildings within 200 m of the named fronts (seconds, not minutes; the check:ground-spots pin).
--check: exit 1 when a named front stays buried under the new rule, or (whole city) the count rises above FRONTS_CEILING.`;
if (process.argv.includes('--help')) { console.log(HELP); process.exit(0); }
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const OUT = arg('out') ?? 'artifacts/f4/fronts.json', CHECK = process.argv.includes('--check'), NAMED = process.argv.includes('--named');
const ROOT = 'public/data/extracts/amsterdam';
const read = async (p: string) => { const f = join(ROOT, p); if (!existsSync(f)) throw new Error(`${p}: missing`); const b = readFileSync(f); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };

/** Buried: ground over the base by more than this, metres. */
const BURIED_M = 0.3;
/** A building counts as buried with at least this much of its open walls buried, metres (one sample a metre). */
const BURIED_WALL_M = 2;
const OUT_M = 0.6, STEP_M = 1;
/** Pinned ceiling for --check: buildings buried under the new rule (lane F4's measured count + 5 %). */
const CITY_BURIED_CEILING = Number(process.env.FRONTS_CEILING ?? 0);

type B = { id: string; ring: Vec2[]; bb: [number, number, number, number]; height: number };
const buildings: B[] = [], seen = new Set<string>();
const zdir = join(ROOT, 'building-tiles/14');
for (const x of readdirSync(zdir).filter(n => /^\d+$/.test(n))) for (const f of readdirSync(join(zdir, x)).filter(n => n.endsWith('.geojson.gz'))) {
  const { features } = JSON.parse(gunzipSync(readFileSync(join(zdir, x, f))).toString()) as { features: { properties: Record<string, unknown>; geometry: { type: string; coordinates: any } }[] };
  for (const ft of features) {
    const id = String(ft.properties.id ?? ''); if (!id || seen.has(id)) continue; seen.add(id);
    if (Number(ft.properties.minHeight ?? 0) >= 0.5) continue;
    const r = ft.geometry.type === 'Polygon' ? ft.geometry.coordinates[0] : ft.geometry.type === 'MultiPolygon' ? ft.geometry.coordinates[0][0] : null;
    if (!r || r.length < 4) continue;
    const ring = (r as [number, number][]).map(q => toLocal(q[0], q[1]) as Vec2);
    if (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
    const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
    buildings.push({ id: id.replace('NL.IMBAG.Pand.', ''), ring, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], height: Number(ft.properties.height ?? 0) });
  }
}
const G = 25, grid = new Map<string, number[]>();
buildings.forEach((b, i) => { for (let gx = Math.floor(b.bb[0] / G); gx <= Math.floor(b.bb[2] / G); gx++) for (let gy = Math.floor(b.bb[1] / G); gy <= Math.floor(b.bb[3] / G); gy++) { const k = `${gx},${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); } });
const inRing = (x: number, y: number, ring: readonly Vec2[]) => { let o = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) o = !o; } return o; };
const insideOther = (x: number, y: number, self: number) => (grid.get(`${Math.floor(x / G)},${Math.floor(y / G)}`) ?? []).some(i => i !== self && x >= buildings[i].bb[0] && x <= buildings[i].bb[2] && y >= buildings[i].bb[1] && y <= buildings[i].bb[3] && inRing(x, y, buildings[i].ring));

const store = new GroundStore(read, { parks: true, roads: true, rails: true });
await store.init();
const all = buildings.reduce((m, b) => [Math.min(m[0], b.bb[0]), Math.min(m[1], b.bb[1]), Math.max(m[2], b.bb[2]), Math.max(m[3], b.bb[3])], [Infinity, Infinity, -Infinity, -Infinity]);
const spots = FRONT_SPOTS.map(s => toLocal(s.lng, s.lat));
const nearSpot = (b: B) => spots.some(([x, y]) => Math.hypot(b.bb[0] - x, b.bb[1] - y) < 200);
if (NAMED) for (const [x, y] of spots) await store.ensureRelief([x - 300, y - 300, x + 300, y + 300]);
// Relief in 2 km blocks (ensureRelief loads the RD tiles under a rect).
else for (let x = all[0]; x < all[2]; x += 2000) for (let y = all[1]; y < all[3]; y += 2000) await store.ensureRelief([x - 5, y - 5, x + 2005, y + 2005]);
const ground = (x: number, y: number) => (store.reliefCovered(x, y) && store.hasRelief(x, y) ? store.surface.ground(x, y) : NaN);

type Row = { id: string; lng: number; lat: number; oldBase: number; newBase: number; openM: number; buriedOldM: number; buriedNewM: number; maxOld: number; maxNew: number; plinthMax: number };
const rows: Row[] = [];
let covered = 0;
buildings.forEach((b, i) => {
  if (NAMED && !nearSpot(b)) return;
  const lo = footprintBase(b.ring, ground);
  if (!lo.samples || lo.samples < (b.ring.length * 2 + 1)) return; // outside the relief
  covered++;
  const fb = frontBase(b.ring, ground);
  let area = 0; for (let k = 0; k < b.ring.length; k++) { const p = b.ring[k], q = b.ring[(k + 1) % b.ring.length]; area += p[0] * q[1] - q[0] * p[1]; }
  const out = area > 0 ? 1 : -1;
  let openM = 0, buriedOldM = 0, buriedNewM = 0, maxOld = -Infinity, maxNew = -Infinity, plinthMax = 0;
  for (let k = 0; k < b.ring.length; k++) {
    const p = b.ring[k], q = b.ring[(k + 1) % b.ring.length], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len < 0.5) continue;
    const ux = (q[0] - p[0]) / len, uy = (q[1] - p[1]) / len, nx = uy * out, ny = -ux * out;
    const n = Math.max(1, Math.round(len / STEP_M));
    for (let s = 0; s < n; s++) {
      const t = (s + 0.5) / n, wx = p[0] + (q[0] - p[0]) * t, wy = p[1] + (q[1] - p[1]) * t, x = wx + nx * OUT_M, y = wy + ny * OUT_M;
      if (insideOther(x, y, i)) continue;
      const g = ground(x, y); if (!Number.isFinite(g)) continue;
      const m = len / n;
      openM += m;
      const eo = g - lo.base, en = g - fb.base;
      maxOld = Math.max(maxOld, eo); maxNew = Math.max(maxNew, en);
      if (eo > BURIED_M) buriedOldM += m;
      if (en > BURIED_M) buriedNewM += m;
      // The new rule's plinth: base over the draped foot at this wall point (what shows below the ground floor).
      plinthMax = Math.max(plinthMax, fb.base - Math.max(g, drapeFoot(wx, wy, fb.base, ground)));
    }
  }
  if (!openM) return;
  const [lng, lat] = fromLocal(b.ring[0][0], b.ring[0][1]);
  rows.push({ id: b.id, lng: +lng.toFixed(6), lat: +lat.toFixed(6), oldBase: +lo.base.toFixed(2), newBase: +fb.base.toFixed(2), openM: Math.round(openM), buriedOldM: Math.round(buriedOldM), buriedNewM: Math.round(buriedNewM), maxOld: +maxOld.toFixed(2), maxNew: +maxNew.toFixed(2), plinthMax: +plinthMax.toFixed(2) });
});

const buriedOld = rows.filter(r => r.buriedOldM >= BURIED_WALL_M), buriedNew = rows.filter(r => r.buriedNewM >= BURIED_WALL_M);
const hist = (f: (r: Row) => number, edges: number[]) => edges.map((e, k) => ({ from: e, to: edges[k + 1] ?? null, n: rows.filter(r => f(r) >= e && (edges[k + 1] === undefined || f(r) < edges[k + 1])).length }));
const top = (list: Row[], key: keyof Row) => [...list].sort((a, b) => (b[key] as number) - (a[key] as number)).slice(0, 20);
const raise = rows.map(r => r.newBase - r.oldBase);
const named = FRONT_SPOTS.map(s => {
  const r = rows.find(x => x.id === s.pand);
  return { ...s, row: r ?? null, ok: !!r && r.buriedNewM < BURIED_WALL_M && r.maxNew <= BURIED_M + 0.2 };
});
const report = {
  buildings: buildings.length, covered, measured: rows.length,
  buried: { old: buriedOld.length, new: buriedNew.length, rule: `>= ${BURIED_WALL_M} m of open wall with relief > ${BURIED_M} m over the base` },
  buriedWallM: { old: Math.round(rows.reduce((s, r) => s + r.buriedOldM, 0)), new: Math.round(rows.reduce((s, r) => s + r.buriedNewM, 0)) },
  raise: { mean: +(raise.reduce((s, v) => s + v, 0) / raise.length).toFixed(3), over03: raise.filter(v => v > 0.3).length, over1: raise.filter(v => v > 1).length, over2: raise.filter(v => v > 2).length, atCap: raise.filter(v => v > 2.99).length },
  plinth: hist(r => r.plinthMax, [0, 0.3, 1, 2, 3]),
  topOld: top(buriedOld, 'maxOld'), topNew: top(buriedNew, 'maxNew'), topPlinth: top(rows, 'plinthMax'),
  named,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ buildings: report.buildings, covered, measured: rows.length, buried: report.buried, buriedWallM: report.buriedWallM, raise: report.raise, plinth: report.plinth }, null, 1));
console.log('top 20 buried before (id lng,lat maxOld→maxNew buriedOld→New m, base old→new):');
for (const r of report.topOld) console.log(`  ${r.id} ${r.lng},${r.lat} ${r.maxOld}→${r.maxNew} ${r.buriedOldM}→${r.buriedNewM} m, base ${r.oldBase}→${r.newBase}`);
console.log('top 20 buried after:');
for (const r of report.topNew) console.log(`  ${r.id} ${r.lng},${r.lat} ${r.maxOld}→${r.maxNew} ${r.buriedOldM}→${r.buriedNewM} m, base ${r.oldBase}→${r.newBase}`);
console.log('named fronts:');
let failed = 0;
for (const s of named) { console.log(`  ${s.ok ? 'ok  ' : 'FAIL'} ${s.id} (${s.pand}): ${s.row ? `max ${s.row.maxOld}→${s.row.maxNew} m, buried ${s.row.buriedOldM}→${s.row.buriedNewM} m, base ${s.row.oldBase}→${s.row.newBase}` : 'not measured'}`); if (!s.ok) failed++; }
if (CHECK && !NAMED && CITY_BURIED_CEILING && buriedNew.length > CITY_BURIED_CEILING) { console.log(`FAIL city: ${buriedNew.length} buried > ${CITY_BURIED_CEILING}`); failed++; }
console.log(`wrote ${OUT}`);
if (CHECK && failed) process.exit(1);
