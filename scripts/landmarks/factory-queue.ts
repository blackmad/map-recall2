/**
 * The landmark factory queue (plan `docs/plans/thousand-buildings-20261023.md`, lane F): which pands the factory
 * works through, in what order, and what happened to each.
 *
 *   node --import tsx scripts/landmarks/factory-queue.ts [--write] [--limit=600] [--queue=public/canal-drive/landmark-factory-queue.json]
 *
 * Rows come from two backlogs: named POIs still pending a building (`landmark-backlog.json`, treatment building |
 * review, with BAG pand ids) first, then ride-visible dominant buildings (`dominant-building-backlog.json`,
 * `rideVisibility.score` > 0, best first; the top 250 hold 92 % of all route visibility). Pands a model already draws
 * are left out: covers.json, the ordinary catalogue, manualCatalogue suppress ids, building-type instances.
 * A refresh keeps every existing row's status, owner, house, report and verdict; new rows start `queued`.
 * Statuses: queued -> crops -> facts -> drafted -> measured -> compiled -> reviewed-pass | reviewed-fix | held |
 * no-evidence | error -> installed. The review turn writes `verdict` and the status; nothing else edits verdicts.
 */
import fs from 'node:fs';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
export const QUEUE_FILE = 'public/canal-drive/landmark-factory-queue.json';
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));

export type QueueStatus = 'queued' | 'needs-pand' | 'crops' | 'facts' | 'drafted' | 'measured' | 'compiled' | 'reviewed-pass' | 'reviewed-fix' | 'held' | 'no-evidence' | 'error' | 'installed';
export interface QueueItem {
  id: string; pand: string; name: string | null; source: 'poi' | 'dominant'; poiId?: string; type?: string;
  rideVisibility: {score: number; rank: number} | null; footprintM2?: number; heightM?: number; center: [number, number] | null;
  status: QueueStatus; house?: string; owner?: string; model?: string; turns?: number; claimedAt?: string; updatedAt?: string;
  report?: Record<string, unknown>; sheets?: string[]; verdict?: {outcome: 'pass' | 'fix' | 'hold' | 'no-evidence'; note?: string; fix?: Record<string, unknown>; reviewer?: string; date?: string; strip?: string};
  notes?: string[];
}
export interface Queue { version: 1; generatedAt: string; method: string; items: QueueItem[] }

const pandOf = (s: unknown): string | null => { const m = /(\d{16})/.exec(String(s ?? '')); return m ? m[1] : null; };

/** Every pand some placed model, chunk, recipe or instance already draws. */
export function coveredPands(): Set<string> {
  const out = new Set<string>();
  const covers = read('public/canal-drive/models/covers.json');
  for (const m of Object.values(covers.models as Record<string, {p?: string[]}>)) for (const p of m.p ?? []) { const id = pandOf(p); if (id) out.add(id); }
  for (const m of read('public/canal-drive/ordinary-buildings-data/catalogue.json').models) { const id = pandOf(m.buildingId); if (id) out.add(id); for (const s of m.suppress ?? []) { const q = pandOf(s); if (q) out.add(q); } }
  for (const e of read('src/canalRecall/landmarks/manualCatalogue.json')) for (const s of e.suppressOsmIds ?? []) { const id = pandOf(s); if (id) out.add(id); }
  try { for (const i of read('public/canal-drive/building-types/instances.json').instances ?? []) { const id = pandOf(i.pand); if (id) out.add(id); } } catch { /* no instances file */ }
  return out;
}

/** Recipes already authored under scripts/building-recipes/houses (installed or not), by pand: the factory keeps their intent. */
export function authoredHouses(): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of fs.readdirSync('scripts/building-recipes/houses')) {
    try { const i = read(`scripts/building-recipes/houses/${d}/intent.json`); const p = pandOf(i.pandId); if (p && !out.has(p)) out.set(p, d); } catch { /* no intent */ }
  }
  return out;
}

export function buildQueue(existing: Queue | null, limit: number): {queue: Queue; added: number; kept: number; skippedCovered: number; authored: number} {
  const covered = coveredPands(), authored = authoredHouses();
  const prev = new Map((existing?.items ?? []).map(i => [i.id, i]));
  const items: QueueItem[] = [];
  const seen = new Set<string>();
  let skippedCovered = 0, authoredCount = 0;
  const push = (item: QueueItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    const old = prev.get(item.id);
    const house = authored.get(item.pand);
    if (house && !old?.house) { item.house = house; item.notes = [`authored recipe houses/${house} exists and is not installed: the factory keeps its intent, measures and compiles it`]; authoredCount++; }
    items.push(old ? {...item, ...old, name: old.name ?? item.name, rideVisibility: item.rideVisibility ?? old.rideVisibility} : item);
  };
  // 1. named POIs pending a building
  const backlog = read('public/canal-drive/landmark-backlog.json');
  const pois = (Array.isArray(backlog) ? backlog : backlog.destinations ?? Object.values(backlog)) as any[];
  for (const d of pois.filter(d => d.status === 'pending' && ['building', 'review'].includes(d.treatment)).sort((a, b) => (a.queueRank ?? 1e9) - (b.queueRank ?? 1e9))) {
    const pands: string[] = (d.pandIds ?? []).map(pandOf).filter(Boolean);
    if (!pands.length) { push({id: `poi:${d.id}`, pand: '', name: d.name, source: 'poi', poiId: d.id, type: d.type, rideVisibility: null, center: [d.lng, d.lat], status: 'needs-pand'}); continue; }
    for (const pand of pands) {
      if (covered.has(pand)) { skippedCovered++; continue; }
      push({id: pand, pand, name: d.name, source: 'poi', poiId: d.id, type: d.type, rideVisibility: null, center: [d.lng, d.lat], status: 'queued'});
    }
  }
  // 2. ride-visible dominant buildings, best first
  const dom = read('public/canal-drive/dominant-building-backlog.json');
  const cands = (Array.isArray(dom) ? dom : dom.candidates ?? Object.values(dom)) as any[];
  for (const c of cands.filter(c => c.rideVisibility?.score > 0).sort((a, b) => b.rideVisibility.score - a.rideVisibility.score)) {
    const pand = pandOf(c.id);
    if (!pand) continue;
    if (covered.has(pand)) { skippedCovered++; continue; }
    push({id: pand, pand, name: c.name ?? null, source: 'dominant', rideVisibility: {score: c.rideVisibility.score, rank: c.rideVisibility.rank}, footprintM2: c.footprintSquareMetres, heightM: c.heightMetres, center: c.center ?? null, status: 'queued'});
    if (items.length >= limit) break;
  }
  const added = items.filter(i => !prev.has(i.id)).length;
  return {queue: {version: 1, generatedAt: new Date().toISOString(), method: 'factory-queue.ts: landmark-backlog pending building|review (by queueRank), then dominant-building-backlog by rideVisibility.score; pands drawn by covers.json, the ordinary catalogue, manualCatalogue suppress ids or building-type instances left out; authored recipes keep their house', items}, added, kept: items.length - added, skippedCovered, authored: authoredCount};
}

if (process.argv[1]?.endsWith('landmarks/factory-queue.ts')) {
  const file = arg('queue', QUEUE_FILE), limit = Number(arg('limit', '600'));
  const existing: Queue | null = fs.existsSync(file) ? read(file) : null;
  const {queue, added, kept, skippedCovered, authored} = buildQueue(existing, limit);
  const byStatus: Record<string, number> = {}, bySource: Record<string, number> = {};
  for (const i of queue.items) { byStatus[i.status] = (byStatus[i.status] ?? 0) + 1; bySource[i.source] = (bySource[i.source] ?? 0) + 1; }
  console.log(`queue: ${queue.items.length} items (${added} new, ${kept} kept; ${skippedCovered} already-covered pands left out; ${authored} with an authored recipe)`);
  console.log(`  by source ${JSON.stringify(bySource)}; by status ${JSON.stringify(byStatus)}`);
  for (const i of queue.items.slice(0, 10)) console.log(`  ${i.id.padEnd(18)} ${(i.name ?? '-').slice(0, 36).padEnd(36)} ${i.source.padEnd(8)} ${i.rideVisibility ? `rank ${i.rideVisibility.rank}` : ''} ${i.status}`);
  if (process.argv.includes('--write')) { fs.writeFileSync(file, JSON.stringify(queue, null, 1) + '\n'); console.log(`wrote ${file}`); }
  else console.log('(dry run: --write to save)');
}
