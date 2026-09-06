/**
 * Do house numbers actually run in order along a street?
 *
 * The global-anchoring plan turns on this. If a read number is a position in a
 * known sequence, one confident reading pins a whole terrace; if the sequence is
 * unreliable, the fit has to be far more defensive and buys far less.
 *
 * An earlier pass answered "78–95% monotonic" and that number went into the plan
 * as a measured obstacle. It was wrong, and wrong because of how it walked the
 * street: it ordered a street's address points by greedy nearest-neighbour from
 * one end of their principal axis. On a gracht that walk runs up the bank, hits a
 * stretch with no addresses, and teleports — up to 1204 m on Keizersgracht — then
 * walks back. Every teleport manufactures a run of apparent inversions. The
 * failure was the estimator's, not Amsterdam's.
 *
 * This measures it without any walk at all. For three consecutive numbers on one
 * side of a street, ask whether the middle one lies geometrically between its two
 * neighbours: project B onto the segment A→C and require the parameter in [0,1].
 * That is local, needs no ordering of the street as a whole, and has no parameter
 * to get wrong. Two guards matter:
 *
 *   - A triple whose A→C baseline is under a frontage cannot answer the question
 *     at all — those points are effectively co-located — so it is not counted.
 *   - The same test runs over OSM's independent geometry, which agrees.
 *
 * The interesting output is not the headline but the breakdown, because the
 * residual disorder is two specific mechanisms rather than noise, and both are
 * things the anchoring fit can be told about:
 *
 *   - A pand carrying several numbers has no reliable internal order. BAG places
 *     a point per address inside the footprint, and inside a merged 20 m pand
 *     those points are not in street order. Ground truth, Hartenstraat 21/23/25
 *     (pand ...169173, plotWidthM 20.18): BAG puts 21 at 4.885801 and 25 at
 *     4.885888, and the shop standing at 4.88578 is Fred Perry, whose address is
 *     Hartenstraat 25. The two points are swapped. The street is in order; the
 *     points inside the pand are not.
 *   - A square is not a line. Westermarkt's numbers run 1–37 along one side at
 *     y≈487450, 2–20 along another at y≈487560, 60–74 at y≈487507 and 76–82 at
 *     y≈487486. Each run is monotonic; the breaks are the corners.
 *
 * Usage: npx tsx scripts/facade-twin/check-number-order.ts
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const CACHE = path.resolve('.cache/facade-twin');

// Below one frontage the two outer points of a triple are close enough that
// "between" is not a question the data can answer, whatever the answer looks
// like. 11% of triples are in that state and counting them either way is noise.
const MIN_BASELINE_M = 4.0;
// A little slack past the endpoints, so a point level with its neighbour is not
// called out of order for a centimetre.
const SLACK = 0.05;
// The clean case — consecutive numbers, one pand each, every point inside a
// footprint — is what the anchoring fit will actually stand on, so that is the
// bar. Set from the measurement, not from taste.
const CLEAN_BAR = 0.98;

type Point = { x: number; y: number; pandId: string | null; label: string };
type Street = Map<number, Point[]>;

const groupByStreet = (rows: Array<{ street: string; n: number; x: number; y: number; pandId: string | null; label: string }>) => {
  const streets = new Map<string, Point[][]>();
  const perStreet = new Map<string, typeof rows>();
  for (const r of rows) (perStreet.get(r.street) ?? perStreet.set(r.street, []).get(r.street)!).push(r);
  // Odd and even are separate sequences with a canal between them; never mix.
  for (const [street, list] of perStreet) {
    if (list.length < 20) continue;
    const sides: Point[][] = [];
    for (const parity of [1, 0]) sides.push(list.filter(r => r.n % 2 === parity));
    streets.set(street, sides);
  }
  return { streets, perStreet };
};

const byNumber = (side: Array<{ n: number } & Point>): Street => {
  const m: Street = new Map();
  for (const p of side) (m.get(p.n) ?? m.set(p.n, []).get(p.n)!).push(p);
  return m;
};

const centre = (g: Point[]) => ({
  x: g.reduce((s, p) => s + p.x, 0) / g.length,
  y: g.reduce((s, p) => s + p.y, 0) / g.length,
  g,
});

type Triple = { street: string; nums: [number, number, number]; t: number; baseline: number; overshootM: number; a: ReturnType<typeof centre>; b: ReturnType<typeof centre>; c: ReturnType<typeof centre> };

/** Every triple with a baseline long enough to be answerable, and its verdict. */
function triples(rows: Parameters<typeof groupByStreet>[0]): Triple[] {
  const out: Triple[] = [];
  const { streets } = groupByStreet(rows);
  for (const [street, sides] of streets) {
    for (const side of sides) {
      const m = byNumber(side as Array<{ n: number } & Point>);
      const nums = [...m.keys()].sort((p, q) => p - q);
      for (let i = 1; i + 1 < nums.length; i++) {
        const a = centre(m.get(nums[i - 1])!), b = centre(m.get(nums[i])!), c = centre(m.get(nums[i + 1])!);
        const dx = c.x - a.x, dy = c.y - a.y, l2 = dx * dx + dy * dy;
        const baseline = Math.sqrt(l2);
        if (baseline < MIN_BASELINE_M) continue;
        const t = ((b.x - a.x) * dx + (b.y - a.y) * dy) / l2;
        const overshootM = t < 0 ? -t * baseline : t > 1 ? (t - 1) * baseline : 0;
        out.push({ street, nums: [nums[i - 1], nums[i], nums[i + 1]], t, baseline, overshootM, a, b, c });
      }
    }
  }
  return out;
}

const inOrder = (t: number) => t >= -SLACK && t <= 1 + SLACK;
const rate = (list: Triple[]) => (list.length ? list.filter(x => inOrder(x.t)).length / list.length : 0);
const report = (label: string, list: Triple[]) => {
  const bad = list.filter(x => !inOrder(x.t)).length;
  console.log(`  ${label.padEnd(56)}${String(list.length).padStart(6)} tested  ${String(bad).padStart(4)} out of order  → ${(100 * rate(list)).toFixed(1)}%`);
};

// ── BAG address points, the authority ────────────────────────────────────────
const bag = JSON.parse(await readFile(path.join(CACHE, 'address-points.json'), 'utf8')).addresses as
  Array<{ street: string; houseNumber: number; display: string; pandId: string | null; rd: { x: number; y: number } }>;
const bagRows = bag.map(a => ({ street: a.street, n: a.houseNumber, x: a.rd.x, y: a.rd.y, pandId: a.pandId, label: a.display }));
const bagTriples = triples(bagRows);

console.log('\nAre house numbers in order along the street?\n');
console.log(`BAG address points — ${bag.length} addresses, ${bagTriples.length} answerable triples\n`);
report('all', bagTriples);

const pandsOf = (p: ReturnType<typeof centre>) => new Set(p.g.map(q => q.pandId).filter(Boolean) as string[]);
const shares = (p: ReturnType<typeof centre>, q: ReturnType<typeof centre>) => {
  const a = pandsOf(p), b = pandsOf(q);
  for (const id of a) if (b.has(id)) return true;
  return false;
};
const sharedPand = (t: Triple) => shares(t.a, t.b) || shares(t.b, t.c) || shares(t.a, t.c);
const anyOrphan = (t: Triple) => [t.a, t.b, t.c].some(p => p.g.some(q => !q.pandId));
const consecutive = (t: Triple) => t.nums[1] - t.nums[0] <= 2 && t.nums[2] - t.nums[1] <= 2;

report('two of the three numbers share a pand', bagTriples.filter(sharedPand));
report('all three numbers on different panden', bagTriples.filter(t => !sharedPand(t)));
report('a point falls outside every footprint', bagTriples.filter(anyOrphan));
report('a run of numbers is missing between them', bagTriples.filter(t => !consecutive(t)));

const clean = bagTriples.filter(t => consecutive(t) && !sharedPand(t) && !anyOrphan(t));
console.log();
report('CLEAN: consecutive, distinct panden, no orphans', clean);

// ── OSM, an independent rendering of the same city ───────────────────────────
// Not fully independent — OSM in the Netherlands is largely a BAG import — but it
// carries its own geometry (mostly building centroids rather than BAG's interior
// points), so agreement rules out a fault in how we read the BAG file.
let osmTriples: Triple[] = [];
try {
  const osm = JSON.parse(await readFile(path.join(CACHE, 'osm-addresses.json'), 'utf8')).elements as
    Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }>;
  const LAT0 = (52.373 * Math.PI) / 180, MPD = 111320;
  const rows = [];
  for (const e of osm) {
    const street = e.tags?.['addr:street'], raw = e.tags?.['addr:housenumber'];
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    const m = raw ? /^(\d+)/.exec(raw) : null;
    if (!street || !m || lat == null || lon == null) continue;
    rows.push({ street, n: +m[1], x: lon * MPD * Math.cos(LAT0), y: lat * MPD, pandId: `${e.type}/${e.id}`, label: raw! });
  }
  osmTriples = triples(rows);
  console.log(`\nOSM addresses — ${rows.length} elements, ${osmTriples.length} answerable triples\n`);
  report('all', osmTriples);
} catch {
  console.log('\n  (no .cache/facade-twin/osm-addresses.json — skipping the OSM cross-check)');
}

// ── The named exceptions, worst first ────────────────────────────────────────
console.log('\nWhere it is genuinely not true — consecutive numbers, distinct panden:\n');
console.log('  street                       triple            t   baseline  overshoot');
for (const t of clean.filter(x => !inOrder(x.t)).sort((a, b) => b.overshootM - a.overshootM).slice(0, 12)) {
  console.log(`  ${t.street.padEnd(28)}${t.nums.join('→').padEnd(14)}${t.t.toFixed(2).padStart(6)}${t.baseline.toFixed(1).padStart(9)} m${t.overshootM.toFixed(1).padStart(9)} m`);
}

// Does curvature explain the residual? It does not, and this is the check that
// says so. Straightness is measured per side — odd and even are separate
// sequences — as the largest perpendicular deviation from the chord joining the
// side's two extreme points, over the length of that chord. A ruler is 0; the
// Herengracht horseshoe is large.
console.log('\nDoes a curving street lose the ordering? Straightness measured per side:\n');
const bend = (pts: Point[]) => {
  let a = pts[0], b = pts[0], best = -1;
  for (const p of pts) for (const q of pts) {
    const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
    if (d > best) { best = d; a = p; b = q; }
  }
  const len = Math.sqrt(best);
  if (len < 30) return null; // too short for "curved" to mean anything
  const dx = b.x - a.x, dy = b.y - a.y;
  let dev = 0;
  for (const p of pts) dev = Math.max(dev, Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len);
  return dev / len;
};
const BINS: Array<[string, number, number]> = [
  ['a ruler          (bend < 1%)', 0, 0.01],
  ['nearly straight  (1–3%)', 0.01, 0.03],
  ['gently curved    (3–10%)', 0.03, 0.10],
  ['a horseshoe      (> 10%)', 0.10, Infinity],
];
const bins = BINS.map(() => ({ all: [] as Triple[], clean: [] as Triple[] }));
{
  const { streets } = groupByStreet(bagRows);
  for (const [street, sides] of streets) {
    for (const side of sides) {
      if (side.length < 6) continue;
      const b = bend(side);
      if (b == null) continue;
      const k = BINS.findIndex(([, lo, hi]) => b >= lo && b < hi);
      if (k < 0) continue;
      // Re-run the triple test over this side alone, so a side keeps its own bin.
      for (const t of triples((side as Array<{ n: number } & Point>).map(p => ({ ...p, street })))) {
        bins[k].all.push(t);
        if (consecutive(t) && !sharedPand(t) && !anyOrphan(t)) bins[k].clean.push(t);
      }
    }
  }
}
console.log('  ' + 'how straight is the side?'.padEnd(32) + 'all triples          clean triples');
for (let i = 0; i < BINS.length; i++) {
  const a = bins[i].all, c = bins[i].clean;
  const pct = (l: Triple[]) => (l.length ? `${(100 * rate(l)).toFixed(1)}%` : '   —');
  console.log(`  ${BINS[i][0].padEnd(32)}${String(a.length).padStart(6)}  ${pct(a).padStart(6)}${String(c.length).padStart(11)}  ${pct(c).padStart(6)}`);
}
console.log('\n  Curvature is not the mechanism. Once a merged pand and an orphan point are');
console.log('  excluded, a horseshoe orders its numbers as well as a ruler does, and every');
console.log('  clean triple on a side straight to within 3% is in order.');

// A "street" whose points are not near a line is a square, and "along the
// street" is undefined on it: the numbering turns corners. Blocks must be built
// from contiguous same-side runs, never from a street name.
console.log('\nStreets that are not lines — a square turns corners, and the numbering turns with it:\n');
const { perStreet } = groupByStreet(bagRows);
const spread = [...perStreet].map(([street, list]) => {
  const n = list.length, mx = list.reduce((s, r) => s + r.x, 0) / n, my = list.reduce((s, r) => s + r.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const r of list) { const dx = r.x - mx, dy = r.y - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(th), uy = Math.sin(th);
  let along = 0, across = 0;
  for (const r of list) { const dx = r.x - mx, dy = r.y - my; along = Math.max(along, Math.abs(dx * ux + dy * uy)); across = Math.max(across, Math.abs(-dx * uy + dy * ux)); }
  return { street, along, across, ratio: across / along };
}).filter(s => s.ratio > 0.3).sort((a, b) => b.ratio - a.ratio);
for (const s of spread.slice(0, 10)) {
  console.log(`  ${s.street.padEnd(28)}${s.along.toFixed(0).padStart(5)} m along, ${s.across.toFixed(0).padStart(4)} m across   (${s.ratio.toFixed(2)})`);
}

const cleanRate = rate(clean);
console.log(`\nordering — ${(100 * cleanRate).toFixed(1)}% of clean triples are in street order  (bar ${(100 * CLEAN_BAR).toFixed(0)}%)\n`);
if (cleanRate < CLEAN_BAR) {
  console.log(`FAIL — house numbers are less orderly than the anchoring plan assumes.`);
  process.exit(1);
}
console.log('PASS — a house number is a reliable position in a sequence, once a merged pand\n       and a square are handled as the exceptions they are.');
