// Compose a register file from reviewed decisions (lane G3): data/crossings/review/<area>.json names, per record, the
// drafts it rests on (scripts/crossings/draft.ts output, by id), its kind, portals, game overrides and what the
// photos showed; this writes data/crossings/<area>.json with the drafts' geometry, BGT/OSM ids and AHN heights merged
// and each rail deck's axis measured from the OSM railway over it.
//
//   npx tsx scripts/crossings/compose.ts --area named [--drafts artifacts/crossings/drafts] [--review artifacts/crossings/review]
//
// The review decisions file is the hand-edited input; the register is regenerated from it (and from the drafts, which
// are cached) so a correction is one edit and a re-run. --review points at the review-sheet output, whose <id>.json
// gives the orthophoto crop and panorama ids the record was checked against.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CrossingFile, CrossingKind, CrossingPortal, CrossingRecord, LngLat } from '../../src/canalRecall/ownGround/crossings.ts';
import { runtimeOf, validateFile } from '../../src/canalRecall/ownGround/crossings.ts';
import { RUNTIME_AREAS } from '../../src/canalRecall/ownGround/crossingFiles.ts';
import { overpassWays } from './sources.ts';

export const HELP = `crossings:compose — build data/crossings/<area>.json from review decisions and drafts.

  npx tsx scripts/crossings/compose.ts --area <id> [--drafts <dir>] [--review <dir>]
  npx tsx scripts/crossings/compose.ts --runtime        (only rewrite the runtime extract)

Input:  data/crossings/review/<area>.json  { area, description, reviewer, on, records: Decision[] }
        Decision: { id, label, kind, drafts: [draft ids], decks? (replace the drafts' decks), abutments?, at?, zone? (replaces the merged zone), zoneExtra? (polygon added),
                    portals?, game?, heights? (overrides), carries? ({draftId: carries}), verdict, notes, disagreements? }
Output: data/crossings/<area>.json (validated; exit 1 on an invalid record), then data/crossings/runtime.json: the
        compact extract the game reads (crossings.ts runtimeOf over every area in crossingFiles.ts RUNTIME_AREAS).`;

/** Rewrite data/crossings/runtime.json from the authored area files; one record per line. Returns its size in bytes. */
export function writeRuntime(): number {
  const records = RUNTIME_AREAS.flatMap(a => (JSON.parse(readFileSync(join('data/crossings', `${a}.json`), 'utf8')) as CrossingFile).records);
  const rt = runtimeOf(records);
  const text = `{"version":1,"records":[\n${rt.records.map(r => JSON.stringify(r)).join(',\n')}\n]}\n`;
  writeFileSync('data/crossings/runtime.json', text);
  console.log(`wrote data/crossings/runtime.json: ${rt.records.length} records, ${text.length} bytes`);
  return text.length;
}

const args = process.argv.slice(2);
const argOf = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const KX = 111320 * Math.cos((52.37 * Math.PI) / 180), KY = 110540;

interface Decision {
  id: string; label: string; kind: CrossingKind; drafts: string[];
  at?: LngLat; zone?: LngLat[]; zoneExtra?: LngLat[];
  portals?: CrossingPortal[]; game?: CrossingRecord['game']; heights?: Partial<CrossingRecord['heights']>;
  carries?: Record<string, CrossingRecord['plan']['decks'][number]['carries']>;
  /** Replace the drafts' deck polygons (a draft's cluster can include its abutment bodies), and the abutments. */
  decks?: CrossingRecord['plan']['decks']; abutments?: NonNullable<CrossingRecord['plan']['abutments']>;
  verdict: 'confirmed' | 'corrected'; notes: string; disagreements?: string[]; binds?: Partial<CrossingRecord['binds']>; sources?: string[];
}
interface ReviewFile { area: string; description: string; reviewer: string; on: string; records: Decision[] }

/** Convex hull (monotone chain) of lng/lat points in a metric frame. */
function hull(pts: LngLat[]): LngLat[] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: LngLat, a: LngLat, b: LngLat) => ((a[0] - o[0]) * KX) * ((b[1] - o[1]) * KY) - ((a[1] - o[1]) * KY) * ((b[0] - o[0]) * KX);
  const lo: LngLat[] = [], hi: LngLat[] = [];
  for (const p of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of s.reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
const inside = (ring: LngLat[], p: LngLat) => { let k = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > p[1]) !== (ring[j][1] > p[1]) && p[0] < ((ring[j][0] - ring[i][0]) * (p[1] - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) k = !k; return k; };

/** The heading (0..180, from north) of the railway ways in `ids` where they lie inside `ring`. */
async function railAxis(ring: LngLat[], ids: number[]): Promise<number | undefined> {
  // One query per 0.005° tile around the deck's centre (cached: the decks of a place share it).
  const G = 0.005, cx = Math.floor(ring.reduce((s, p) => s + p[0], 0) / ring.length / G) * G, cy = Math.floor(ring.reduce((s, p) => s + p[1], 0) / ring.length / G) * G;
  const ways = (await overpassWays([+(cx - G).toFixed(3), +(cy - G).toFixed(3), +(cx + 2 * G).toFixed(3), +(cy + 2 * G).toFixed(3)])).filter(w => ids.includes(w.id) && w.tags.railway);
  let sx = 0, sy = 0;
  for (const w of ways) for (let i = 0; i + 1 < w.g.length; i++) {
    const a = w.g[i], b = w.g[i + 1], mid: LngLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (!inside(ring, mid) && !inside(ring, a) && !inside(ring, b)) continue;
    const dx = (b[0] - a[0]) * KX, dy = (b[1] - a[1]) * KY, l = Math.hypot(dx, dy), t = Math.atan2(dx, dy) * 2; // doubled angle: lines, not directions
    sx += Math.cos(t) * l; sy += Math.sin(t) * l;
  }
  if (!sx && !sy) return undefined;
  return +((((Math.atan2(sy, sx) / 2) * 180) / Math.PI + 360) % 180).toFixed(1);
}

async function main(): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) { console.log(HELP); return; }
  if (args.includes('--runtime')) { writeRuntime(); return; }
  const area = argOf('--area') ?? 'named', draftsDir = argOf('--drafts') ?? 'artifacts/crossings/drafts', reviewDir = argOf('--review') ?? 'artifacts/crossings/review';
  const review = JSON.parse(readFileSync(join('data/crossings/review', `${area}.json`), 'utf8')) as ReviewFile;
  const drafts = new Map((JSON.parse(readFileSync(join(draftsDir, `${area}.json`), 'utf8')) as CrossingFile).records.map(r => [r.id, r]));
  const out: CrossingRecord[] = [];
  for (const d of review.records) {
    const from = d.drafts.map(id => { const r = drafts.get(id); if (!r) throw new Error(`${d.id}: no draft ${id}`); return r; });
    const decks: CrossingRecord['plan']['decks'] = [];
    for (const deck of d.decks ?? []) decks.push({ ...deck, ...(['rail', 'metro', 'tram'].includes(deck.carries) && deck.axisDeg === undefined ? { axisDeg: await railAxis(deck.ring, from.flatMap(r => r.binds.over)) } : {}) });
    if (!d.decks) for (const r of from) for (const deck of r.plan.decks) {
      const carries = d.carries?.[r.id] ?? deck.carries;
      const axisDeg = ['rail', 'metro', 'tram'].includes(carries) ? await railAxis(deck.ring, r.binds.over) : undefined;
      decks.push({ ring: deck.ring, carries, ...(axisDeg !== undefined ? { axisDeg } : {}), ...(deck.bgt ? { bgt: deck.bgt } : {}) });
    }
    const zone = d.zone ?? hull([...from.flatMap(r => r.zone), ...(d.zoneExtra ?? [])]).map(p => [+p[0].toFixed(7), +p[1].toFixed(7)] as LngLat);
    const at = d.at ?? (from.length ? ([+(from.reduce((s, r) => s + r.at[0], 0) / from.length).toFixed(7), +(from.reduce((s, r) => s + r.at[1], 0) / from.length).toFixed(7)] as LngLat) : zone[0]);
    // Heights: the lowest street under, the deck tops' median (a record over several decks reports the highest soffit
    // the street sees under the lowest deck: the clearance that matters), grade sides from every draft.
    const streets = from.map(r => r.heights.streetUnder).filter((v): v is number => v !== undefined);
    const tops = from.map(r => r.heights.deckTop).filter((v): v is number => v !== undefined).sort((a, b) => a - b);
    const soffits = from.map(r => r.heights.soffit).filter((v): v is number => v !== undefined);
    const heights: CrossingRecord['heights'] = {
      ...(streets.length ? { streetUnder: +(streets.reduce((s, v) => s + v, 0) / streets.length).toFixed(2) } : {}),
      ...(tops.length ? { deckTop: tops[0], soffit: Math.min(...soffits), soffitEstimated: true } : {}),
      ...(from.some(r => r.heights.gradeSides?.length) ? { gradeSides: from.flatMap(r => r.heights.gradeSides ?? []) } : {}),
      ...(d.heights ?? {}),
    };
    const sheet = join(reviewDir, `${d.id}.json`), seen = existsSync(sheet) ? JSON.parse(readFileSync(sheet, 'utf8')) as { ortho: string; panoramas: string[] } : null;
    const rec: CrossingRecord = {
      id: d.id, label: d.label, area, kind: d.kind, at, zone,
      plan: {
        decks,
        ...(from.some(r => r.plan.piers?.length) ? { piers: from.flatMap(r => r.plan.piers ?? []) } : {}),
        ...(from.some(r => r.plan.tunnels?.length) ? { tunnels: from.flatMap(r => r.plan.tunnels ?? []) } : {}),
        ...(d.portals ? { portals: d.portals } : {}),
        ...(d.abutments ? { abutments: d.abutments } : {}),
      },
      heights,
      binds: {
        over: [...new Set([...from.flatMap(r => r.binds.over), ...(d.binds?.over ?? [])])],
        under: [...new Set([...from.flatMap(r => r.binds.under), ...(d.binds?.under ?? [])])],
        bgt: [...new Set([...from.flatMap(r => r.binds.bgt), ...(d.binds?.bgt ?? [])])],
      },
      ...(d.game ? { game: d.game } : {}),
      evidence: {
        sources: [...from.flatMap(r => r.evidence.sources.filter(s => !s.startsWith('AHN'))), ...from.flatMap(r => r.evidence.sources.filter(s => s.startsWith('AHN'))).slice(0, 2), ...(d.sources ?? [])],
        ortho: seen ? [seen.ortho] : [],
        panoramas: seen?.panoramas ?? [],
        notes: d.notes,
      },
      ...((d.disagreements ?? from.flatMap(r => r.disagreements ?? [])).length ? { disagreements: d.disagreements ?? from.flatMap(r => r.disagreements ?? []) } : {}),
      reviewed: seen ? { by: review.reviewer, on: review.on, verdict: d.verdict } : null,
    };
    out.push(rec);
  }
  const file: CrossingFile = { version: 1, area, description: review.description, records: out };
  const errors = validateFile(file);
  for (const e of errors) console.log(`  INVALID ${e}`);
  writeFileSync(join('data/crossings', `${area}.json`), JSON.stringify(file, null, 1) + '\n');
  console.log(`wrote data/crossings/${area}.json: ${out.length} records, ${out.filter(r => r.reviewed).length} reviewed${errors.length ? `, ${errors.length} problems` : ''}`);
  if (errors.length) { process.exitCode = 1; return; }
  writeRuntime();
}

if (process.argv[1]?.endsWith('compose.ts')) await main();
