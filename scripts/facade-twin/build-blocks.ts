/**
 * Step 1 of global anchoring: cut the city into blocks.
 *
 * A block is a maximal run of panden that front the same street on the same side
 * and physically touch, in order. Everything downstream stands on it — a shift is
 * fitted per block, a lock propagates along a block, and a reading is evidence
 * about a block rather than about one wall.
 *
 * The ordering comes from party walls, not from projection. Amsterdam canal
 * houses are terraced: consecutive houses share a wall, so footprint adjacency
 * already *is* the sequence, and the median pand has exactly two touching
 * neighbours. That matters because the alternative — projecting a street onto an
 * axis and sorting — is what produced the 78–95% monotonicity claim that §23 had
 * to retract. A gracht is a horseshoe with no single axis; a chain of party walls
 * follows it without needing one, and stops at a corner by itself.
 *
 * Three rules keep a chain honest, each answering a mechanism §23 named:
 *
 *   - Two panden are linked only if both front the same street. A corner pand
 *     touches neighbours on both streets, and without this the Herengracht chain
 *     leaks around the corner into Wolvenstraat.
 *   - Odd and even never join. They are separate sequences with water or a
 *     carriageway between them; adjacency would not link them anyway, but saying
 *     so makes the rule visible rather than incidental.
 *   - A square is never one block. Westermarkt is four runs meeting at corners,
 *     and because a corner breaks the party-wall chain that falls out for free —
 *     there is no "group by street" step left to relax.
 *
 * The report is the point. Blocks are built from geometry alone, so comparing the
 * chain order against BAG's house numbers is a real test rather than a
 * restatement: if adjacency and numbering agree, a number read off a door is a
 * position in a sequence we can trust, which is the premise the anchoring plan
 * rests on.
 *
 * Usage: npx tsx scripts/facade-twin/build-blocks.ts [--write]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const WRITE = process.argv.includes('--write');

// Two footprints "touch" when a vertex of one lands within this of a vertex of
// the other. BAG draws a party wall as coincident edges, so the true figure is
// millimetres; 30 cm absorbs digitising slop without reaching across the
// narrowest alley in the boundary (Torensteeg, about 2 m).
const TOUCH_M = 0.30;
// A chain that walks further than this between neighbours is not a terrace.
const MAX_STEP_M = 40;
// A block is the front row and nothing else. Party-wall adjacency on its own will
// walk a chain up the street, turn into a courtyard and come back along the rear
// row. Willemsstraat odd did exactly that: 139 to 165 at 6.0-6.3 m from the
// centreline, then 165 back down to 151 at 12 to 28 m, which is where the doubled
// 163/163, 161/161, 159/159 in a single "block" came from. Measured from the
// nearest footprint vertex, so a deep house is judged by its front wall and every
// house on a side sits at nearly the same distance; the step up to the second row
// was 6 m or more everywhere it was checked.
const FRONT_ROW_TOLERANCE_M = 8;

type Pand = {
  id: string;
  ring: Array<{ x: number; y: number }>;
  centre: { x: number; y: number };
  bb: [number, number, number, number];
  streets: Map<string, number[]>;
};

// OSM centrelines, used only to decide which row of a block faces the street --
// never to order anything. Ordering is the party-wall chain's job, and projecting
// onto a street axis is the mistake section 23 records.
const routing = JSON.parse(await readFile(path.resolve('public/data/extracts/amsterdam/streets-routing.json'), 'utf8')) as
  Array<{ name?: string; path?: Array<[number, number]>; paths?: Array<Array<[number, number]>> }>;
type Seg = [{ x: number; y: number }, { x: number; y: number }];
const centrelines = new Map<string, Seg[]>();
for (const way of routing) {
  if (!way.name) continue;
  const segs = centrelines.get(way.name) ?? centrelines.set(way.name, []).get(way.name)!;
  for (const line of way.paths ?? (way.path ? [way.path] : [])) {
    // routing paths are [lat, lng]; RD_NEW takes [lng, lat].
    for (let i = 1; i < line.length; i++) {
      segs.push([RD_NEW.fromLngLat([line[i - 1][1], line[i - 1][0]]), RD_NEW.fromLngLat([line[i][1], line[i][0]])]);
    }
  }
}
const distToSegment = (p: { x: number; y: number }, [a, b]: Seg) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

const panden = JSON.parse(await readFile(path.join(CACHE, 'bag-panden.json'), 'utf8')).panden as
  Array<{ pandId: string; footprintLngLat: LngLat[] }>;
const addresses = JSON.parse(await readFile(path.join(CACHE, 'address-points.json'), 'utf8')).addresses as
  Array<{ street: string; houseNumber: number; pandId: string | null }>;

const numbersOf = new Map<string, Map<string, number[]>>();
for (const a of addresses) {
  if (!a.pandId) continue;
  const byStreet = numbersOf.get(a.pandId) ?? numbersOf.set(a.pandId, new Map()).get(a.pandId)!;
  (byStreet.get(a.street) ?? byStreet.set(a.street, []).get(a.street)!).push(a.houseNumber);
}

const all: Pand[] = [];
for (const p of panden) {
  if (!p.footprintLngLat || p.footprintLngLat.length < 3) continue;
  const ring = p.footprintLngLat.map(ll => RD_NEW.fromLngLat(ll));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of ring) { minX = Math.min(minX, v.x); minY = Math.min(minY, v.y); maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y); }
  all.push({
    id: p.pandId, ring,
    centre: { x: ring.reduce((s, v) => s + v.x, 0) / ring.length, y: ring.reduce((s, v) => s + v.y, 0) / ring.length },
    bb: [minX, minY, maxX, maxY],
    streets: numbersOf.get(p.pandId) ?? new Map(),
  });
}

const CELL = 40;
const grid = new Map<string, Pand[]>();
for (const p of all) {
  for (let gx = Math.floor(p.bb[0] / CELL); gx <= Math.floor(p.bb[2] / CELL); gx++)
    for (let gy = Math.floor(p.bb[1] / CELL); gy <= Math.floor(p.bb[3] / CELL); gy++) {
      const k = `${gx},${gy}`;
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(p);
    }
}
const touches = (a: Pand, b: Pand) => {
  const t2 = TOUCH_M * TOUCH_M;
  for (const u of a.ring) for (const v of b.ring) {
    const dx = u.x - v.x, dy = u.y - v.y;
    if (dx * dx + dy * dy < t2) return true;
  }
  return false;
};
const neighbours = new Map<string, Set<string>>(all.map(p => [p.id, new Set<string>()]));
for (const p of all) {
  const seen = new Set<string>();
  for (let gx = Math.floor(p.bb[0] / CELL); gx <= Math.floor(p.bb[2] / CELL); gx++)
    for (let gy = Math.floor(p.bb[1] / CELL); gy <= Math.floor(p.bb[3] / CELL); gy++)
      for (const q of grid.get(`${gx},${gy}`) ?? []) {
        if (q.id === p.id || seen.has(q.id)) continue;
        seen.add(q.id);
        if (touches(p, q)) { neighbours.get(p.id)!.add(q.id); neighbours.get(q.id)!.add(p.id); }
      }
}

type Block = {
  blockId: string; street: string; parity: 'odd' | 'even';
  members: Array<{ pandId: string; numbers: number[]; alongM: number }>;
  lengthM: number;
};

// Keyed by street and parity together. The value carries both fields rather than
// the key being taken apart again: a street name contains spaces -- "Nieuwe
// Leliestraat" -- so splitting a joined key back up is a bug waiting to happen.
const groups = new Map<string, { street: string; parity: 'odd' | 'even'; members: Pand[] }>();
for (const p of all) {
  for (const [street, nums] of p.streets) {
    for (const parity of ['odd', 'even'] as const) {
      if (!nums.some(n => (parity === 'odd' ? n % 2 === 1 : n % 2 === 0))) continue;
      const k = `${street}\u0000${parity}`;
      (groups.get(k) ?? groups.set(k, { street, parity, members: [] }).get(k)!).members.push(p);
    }
  }
}

/** Walk each connected component as a path, starting from its least-connected member. */
function chainsOf(members: Pand[], linked: (a: Pand, b: Pand) => boolean): Pand[][] {
  const set = new Map(members.map(p => [p.id, p]));
  const adj = new Map<string, string[]>();
  for (const p of members) {
    adj.set(p.id, [...(neighbours.get(p.id) ?? [])].filter(id => set.has(id) && linked(p, set.get(id)!)));
  }
  const out: Pand[][] = [];
  const seen = new Set<string>();
  for (const start of members) {
    if (seen.has(start.id)) continue;
    const comp: string[] = [];
    const stack = [start.id];
    seen.add(start.id);
    while (stack.length) {
      const id = stack.pop()!;
      comp.push(id);
      for (const n of adj.get(id) ?? []) if (!seen.has(n)) { seen.add(n); stack.push(n); }
    }
    // An endpoint has one neighbour inside the component; a clean terrace has two
    // of them. A component with none is a ring, one with many is a cluster —
    // starting from the least-connected member yields an ordered run either way
    // rather than dropping the component.
    const deg = (id: string) => (adj.get(id) ?? []).length;
    const from = comp.reduce((a, b) => (deg(b) < deg(a) ? b : a), comp[0]);
    const order: string[] = [];
    const walked = new Set<string>();
    let cur: string | null = from;
    while (cur) {
      order.push(cur);
      walked.add(cur);
      const next = (adj.get(cur) ?? []).filter(id => !walked.has(id));
      if (!next.length) break;
      const prev = order.length > 1 ? set.get(order[order.length - 2])!.centre : null;
      const here = set.get(cur)!.centre;
      // Prefer the neighbour that continues in the same direction, so a branch
      // into a courtyard does not derail the run along the street.
      const score = (cand: string) => {
        const c = set.get(cand)!.centre;
        const step = Math.hypot(c.x - here.x, c.y - here.y);
        if (step > MAX_STEP_M) return -Infinity;
        if (!prev) return -step;
        const ax = here.x - prev.x, ay = here.y - prev.y;
        const bx = c.x - here.x, by = c.y - here.y;
        const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1);
        return cos * 100 - step;
      };
      const best = next.reduce((a, b) => (score(b) > score(a) ? b : a), next[0]);
      cur = score(best) === -Infinity ? null : best;
    }
    if (order.length) out.push(order.map(id => set.get(id)!));
    const missed = comp.filter(id => !walked.has(id)).map(id => set.get(id)!);
    if (missed.length) for (const run of chainsOf(missed, linked)) out.push(run);
  }
  return out;
}

/** Nearest-vertex distance from a pand to its street's centreline, null if that street has no geometry. */
const setbackOf = (p: Pand, street: string) => {
  const segs = centrelines.get(street);
  if (!segs?.length) return null;
  let best = Infinity;
  for (const v of p.ring) for (const s of segs) best = Math.min(best, distToSegment(v, s));
  return best;
};

const blocks: Block[] = [];
let droppedToRear = 0;
for (const { street, parity, members: rawMembers } of groups.values()) {
  // Front row only. With no centreline for this street the filter cannot be
  // applied, and the group passes through rather than being guessed at.
  const setbacks = new Map(rawMembers.map(p => [p.id, setbackOf(p, street)]));
  const known = [...setbacks.values()].filter((d): d is number => d != null);
  const frontEdge = known.length ? Math.min(...known) + FRONT_ROW_TOLERANCE_M : Infinity;
  const members = rawMembers.filter(p => (setbacks.get(p.id) ?? 0) <= frontEdge);
  droppedToRear += rawMembers.length - members.length;
  if (!members.length) continue;
  // Linked only if both front the same street: this is what stops a chain from
  // turning a corner into the next street's terrace.
  const linked = (a: Pand, b: Pand) => a.streets.has(street) && b.streets.has(street);
  for (const run of chainsOf(members, linked)) {
    let alongM = 0;
    const list = run.map((p, i) => {
      if (i) alongM += Math.hypot(p.centre.x - run[i - 1].centre.x, p.centre.y - run[i - 1].centre.y);
      const nums = (p.streets.get(street) ?? []).filter(n => (parity === 'odd' ? n % 2 === 1 : n % 2 === 0));
      return { pandId: p.id, numbers: [...new Set(nums)].sort((x, y) => x - y), alongM: +alongM.toFixed(2) };
    });
    blocks.push({
      blockId: `${street}/${parity}/${run[0].id.slice(-6)}`,
      street, parity, members: list, lengthM: +alongM.toFixed(1),
    });
  }
}
blocks.sort((a, b) => b.members.length - a.members.length);

console.log('\nBlocks from party-wall chains\n');
const sizes = blocks.map(b => b.members.length).sort((a, b) => a - b);
const pct = (q: number) => sizes[Math.min(sizes.length - 1, Math.floor(q * sizes.length))];
console.log(`  ${all.length} panden, ${blocks.length} blocks`);
console.log(`  members per block: p10 ${pct(0.1)}, median ${pct(0.5)}, p90 ${pct(0.9)}, max ${sizes[sizes.length - 1]}`);
console.log(`  singletons: ${blocks.filter(b => b.members.length === 1).length}`);
console.log(`  memberships dropped as rear-row: ${droppedToRear}`);
console.log(`  panden in a block of 3 or more: ${blocks.filter(b => b.members.length >= 3).reduce((s, b) => s + b.members.length, 0)}`);

// The payoff. The chain order came from geometry; the numbers came from BAG.
// Agreement between them is the premise of the whole plan, so it is measured
// here rather than assumed.
let agree = 0, disagree = 0, untestable = 0;
const offenders: Array<{ block: string; a: number; b: number }> = [];
for (const b of blocks) {
  if (b.members.length < 3) continue;
  // A merged pand carries several numbers with no reliable internal order (§23),
  // so a member is represented by its lowest number and an unnumbered one is
  // skipped rather than guessed at.
  const seq = b.members.filter(m => m.numbers.length).map(m => Math.min(...m.numbers));
  if (seq.length < 3) { untestable++; continue; }
  const rising = seq.filter((n, i) => i && n > seq[i - 1]).length;
  const falling = seq.filter((n, i) => i && n < seq[i - 1]).length;
  if (!(rising + falling)) { untestable++; continue; }
  agree += Math.max(rising, falling);
  disagree += Math.min(rising, falling);
  if (Math.min(rising, falling) > 0) {
    const dir = rising >= falling ? 1 : -1;
    for (let i = 1; i < seq.length; i++) if ((seq[i] - seq[i - 1]) * dir < 0) offenders.push({ block: b.blockId, a: seq[i - 1], b: seq[i] });
  }
}
const orderRate = agree / (agree + disagree || 1);
console.log(`\n  chain order vs house numbers: ${agree} steps agree, ${disagree} disagree  ->  ${(100 * orderRate).toFixed(1)}%`);
console.log(`  blocks with too few numbered members to test: ${untestable}`);
if (offenders.length) {
  console.log('\n  where the chain and the numbers disagree:');
  for (const o of offenders.slice(0, 12)) console.log(`    ${o.block.padEnd(44)}${o.a} -> ${o.b}`);
}

const INSPECT = process.argv.find(a => a.startsWith('--inspect='))?.split('=')[1];
if (INSPECT) {
  for (const b of blocks.filter(x => x.blockId.includes(INSPECT))) {
    console.log(`\n  ${b.blockId}  ${b.members.length} panden, ${b.lengthM} m`);
    for (const m of b.members) console.log(`    ${m.alongM.toFixed(1).padStart(7)} m  ${m.pandId.slice(-6)}  ${m.numbers.join('/') || '-'}`);
  }
}

console.log('\n  longest blocks:');
for (const b of blocks.slice(0, 8)) {
  const nums = b.members.flatMap(m => m.numbers);
  console.log(`    ${b.blockId.padEnd(38)}${String(b.members.length).padStart(3)} panden  ${String(b.lengthM).padStart(6)} m  ${nums.length ? `${Math.min(...nums)}-${Math.max(...nums)}` : 'unnumbered'}`);
}

if (WRITE) {
  const out = path.join(STAGING, 'blocks.json');
  await writeFile(out, JSON.stringify({
    metadata: {
      generatedAt: new Date().toISOString(),
      generator: 'scripts/facade-twin/build-blocks.ts',
      touchM: TOUCH_M,
      note: 'A block is a maximal run of touching panden fronting one street on one side, ordered by party-wall adjacency rather than by projection onto a street axis. Order is geometric; house numbers are not used to build it, so comparing the two is a test rather than a restatement.',
      orderAgreement: +orderRate.toFixed(4),
    },
    blocks,
  }, null, 1));
  console.log(`\n  wrote ${path.relative(process.cwd(), out)}`);
} else {
  console.log('\n  (dry run - pass --write to publish blocks.json)');
}
console.log();
