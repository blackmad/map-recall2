/**
 * Facade benchmark (lane F4, #379): merge select.ts's candidates into benchmark-v1.json (keeping every label already
 * there) and write the house:frames list benchmark-v1.frames.json from it.
 *
 *   node --import tsx scripts/house-line/benchmark/build.ts [--candidates artifacts/critic/benchmark-candidates.json]
 *
 * Wall overrides (`frame`) are per pand: a bearing or point for walls pickWall gets wrong, `notPanos` for a pose
 * flagged otherBuilding (re-pick), Nassaukade 146's bay front as the chord house:frames §7 documents.
 */
import fs from 'node:fs';
import type { Candidate } from './select.ts';

export const BENCHMARK_FILE = 'scripts/house-line/benchmark/benchmark-v1.json';
export const FRAMES_LIST = 'scripts/house-line/benchmark/benchmark-v1.frames.json';
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };

export type Frame = { bearing?: number; at?: [number, number]; chord?: [[number, number], [number, number]]; notPanos?: string[] };
export type BenchPand = Candidate & { key: string; frame?: Frame; photo?: Record<string, unknown>; labels?: Record<string, unknown>; readable?: boolean; notes?: string };

/** Walls the default pick gets wrong (house-line.md §7): the Nassaukade 506 row faces the water at ~85 deg. */
const FRAME_OVERRIDES: Record<string, Frame> = {
  '0363100012160704': { bearing: 96, at: [4.87384, 52.37225] },
  '0363100012116526': { bearing: 80 },
  '0363100012164843': { bearing: 85 }, '0363100012161422': { bearing: 85 }, '0363100012157426': { bearing: 85 },
  '0363100012160273': { bearing: 85 }, '0363100012159694': { bearing: 85 },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const cands: Candidate[] = JSON.parse(fs.readFileSync(arg('candidates') ?? 'artifacts/critic/benchmark-candidates.json', 'utf8'));
  const old = fs.existsSync(BENCHMARK_FILE) ? JSON.parse(fs.readFileSync(BENCHMARK_FILE, 'utf8')) : null;
  const prev = new Map<string, BenchPand>((old?.pands ?? []).map((p: BenchPand) => [p.pandId, p]));
  const pands: BenchPand[] = cands.map(c => ({ ...c, key: c.pandId, ...(FRAME_OVERRIDES[c.pandId] ? { frame: FRAME_OVERRIDES[c.pandId] } : {}), ...(prev.get(c.pandId) ? { frame: prev.get(c.pandId)!.frame, photo: prev.get(c.pandId)!.photo, readable: prev.get(c.pandId)!.readable, labels: prev.get(c.pandId)!.labels, notes: prev.get(c.pandId)!.notes } : {}) }));
  const groups = JSON.parse(fs.readFileSync('scripts/house-line/benchmark/groups-v1.json', 'utf8')).groups;
  const doc = {
    version: 1,
    lane: 'F4 facade benchmark and blind critic (#379), 2026-11-12',
    about: 'The fixed facade benchmark: contiguous blocks, one entry per pand, hand labels read from the round-0 pose photo (labels.md has the convention). The critic (scripts/house-line/critic.ts) scores the game against these poses; the labels say what the photo shows when the critic names a gap.',
    groups, pands,
  };
  fs.writeFileSync(BENCHMARK_FILE, JSON.stringify(doc, null, 1) + '\n');
  // Canal fronts are framed from the far quay (40-50 m: the near quay is 5 m off and clips the crown); streets keep 35 m.
  const far = new Set(groups.filter((g: any) => g.kind === 'canal belt' || g.kind === 'kit standard').map((g: any) => g.id));
  const list = pands.map(p => ({ pandId: p.pandId, key: p.key, ...(far.has(p.group) ? { maxDistM: 60 } : {}), ...(p.frame ?? {}) }));
  fs.writeFileSync(FRAMES_LIST, JSON.stringify(list, null, 1) + '\n');
  const by = new Map<string, number>(); for (const p of pands) by.set(p.group, (by.get(p.group) ?? 0) + 1);
  console.log(`${pands.length} pands (${[...by].map(([g, n]) => `${g} ${n}`).join(', ')}); labelled ${pands.filter(p => p.labels).length} -> ${BENCHMARK_FILE}, ${FRAMES_LIST}`);
}
