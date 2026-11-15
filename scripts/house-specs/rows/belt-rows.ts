/**
 * belt-rows (lane D, canal belt as rows): row definitions for canal-belt runs that have no block-face intent or street
 * survey, built from what the belt D1 tranche already holds (no downloads):
 *   belt-select.json   pand, BAG year, house numbers, centroid  (artifacts/describer-d1/belt-20261114/)
 *   cuts/cuts.json     the reader's cut: wall segment length (the front width) and height
 *   answers-kept/      the kept v4.3 reads (answers-held/ are outline-off reads: listed, not used)
 *
 *   node --import tsx scripts/house-specs/rows/belt-rows.ts --street Herengracht --runs 2-24,26-46,1-23 [--write]
 *
 * A run `a-b` takes every selected pand on that side (a's parity) whose lowest house number lies in [a, b], in
 * number order. Without --write it prints the members and what each lacks (no cut, held read); --write merges the
 * rows into scripts/house-specs/rows/rows.json (existing ids are replaced, others kept).
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO, type RowMemberDef } from './rowDefs.ts';

const BELT = 'belt-20261114';
const ROWS = path.join(REPO, 'scripts/house-specs/rows/rows.json');

interface SelectRow { pandId: string; street: string; number: number; addresses: string[]; year: number; height: number; areaM2: number; picked: boolean }
interface CutRow { pandId: string; wallLenM?: number; wall?: { heightM: number }; skip?: string }

/** Numbers stated by a pand's addresses on the street ("Herengracht 46D" -> 46). */
export function numbersOf(addresses: readonly string[], street: string): number[] {
  const re = new RegExp(`^${street} (\\d+)`);
  return [...new Set(addresses.map(a => re.exec(a)?.[1]).filter((x): x is string => !!x).map(Number))].sort((a, b) => a - b);
}

/** One member per pand of the run: width from the cut's wall segment, else the BAG area over a typical 15 m depth. */
export function beltMembers(rows: readonly SelectRow[], cuts: ReadonlyMap<string, CutRow>, street: string, a: number, b: number): RowMemberDef[] {
  const parity = a % 2;
  return rows
    .filter(r => r.street === street && r.number % 2 === parity && r.number >= a && r.number <= b)
    // Left to right as seen from the street: on the even side of the canal the numbers fall (the October strips:
    // herengracht-84-148 reads 116C, 114, 112 ...), on the odd side they rise.
    .sort((x, y) => (parity === 0 ? y.number - x.number : x.number - y.number) || x.pandId.localeCompare(y.pandId))
    .map(r => {
      const nums = numbersOf(r.addresses, street).filter(n => n % 2 === parity);
      const cut = cuts.get(r.pandId);
      const w = cut?.wallLenM;
      const label = nums.length > 1 ? `${nums[0]}–${nums[nums.length - 1]}` : String(nums[0] ?? r.number);
      return {
        pandId: r.pandId, label, widthM: w ? +w.toFixed(2) : +Math.min(12, Math.max(3.5, r.areaM2 / 15)).toFixed(2),
        widthSource: w ? 'cut wall segment' : 'BAG area / 15 m (no cut)', numbers: nums.length ? nums : [r.number], built: r.year,
        side: parity === 0 ? 'even' as const : 'odd' as const, ...(r.height ? { heightM: r.height } : {}),
      };
    });
}

const FACES = path.join(REPO, 'scripts/block-face/faces');

/** An October block face with an intent on this street whose houses fall in the run: its id and the houses the belt
 *  selection lacks, as members (width from the strip span, year and height from the face's 3DBAG facts). */
export function faceForRun(street: string, a: number, b: number, have: ReadonlySet<string>): { id: string; extra: RowMemberDef[] } | null {
  const parity = a % 2;
  for (const id of fs.existsSync(FACES) ? fs.readdirSync(FACES).sort() : []) {
    const f = path.join(FACES, id, 'intent.json');
    if (!fs.existsSync(f)) continue;
    const intent = JSON.parse(fs.readFileSync(f, 'utf8')) as { street?: string; houses: Array<{ pandId: string; address?: string }> };
    if (intent.street !== street) continue;
    const inRun = intent.houses.map(h => ({ h, n: numbersOf([h.address ?? ''], street)[0] })).filter(x => x.n !== undefined && x.n % 2 === parity && x.n >= a && x.n <= b);
    if (!inRun.length) continue;
    const strip = JSON.parse(fs.readFileSync(path.join(FACES, id, 'strip.json'), 'utf8')) as { spans: Array<{ pandId: string; x0M: number; x1M: number }> };
    const extra = inRun.filter(x => !have.has(x.h.pandId)).map(({ h, n }) => {
      const span = strip.spans.find(s => s.pandId.endsWith(h.pandId));
      const facts = path.join(FACES, id, 'pands', h.pandId, 'facts.json');
      const at = fs.existsSync(facts) ? (JSON.parse(fs.readFileSync(facts, 'utf8')).attributes as Record<string, number>) : null;
      return { pandId: h.pandId, label: (h.address ?? '').replace(`${street} `, ''), widthM: span ? +(span.x1M - span.x0M).toFixed(2) : 6,
        widthSource: span ? `face ${id} strip span` : 'default 6 m (no span)', numbers: [n!], built: at?.oorspronkelijkbouwjaar ?? 1700,
        side: parity === 0 ? 'even' as const : 'odd' as const, ...(at ? { heightM: +(at.b3_h_dak_70p - at.b3_h_maaiveld).toFixed(2) } : {}) } satisfies RowMemberDef;
    });
    return { id, extra };
  }
  return null;
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const rowsJson = JSON.parse(fs.readFileSync(ROWS, 'utf8'));
  const root = process.env.ROW_D1_ROOT ?? rowsJson.d1Root;
  const street = arg('street') ?? 'Herengracht';
  const runs = (arg('runs') ?? '').split(',').filter(Boolean).map(s => s.split('-').map(Number) as [number, number]);
  if (!runs.length) { console.error('usage: belt-rows.ts --street Herengracht --runs 2-24,1-23 [--write]'); process.exit(2); }
  const sel = JSON.parse(fs.readFileSync(path.join(root, BELT, 'belt-select.json'), 'utf8')).rows as SelectRow[];
  const cuts = new Map<string, CutRow>((JSON.parse(fs.readFileSync(path.join(root, BELT, 'cuts/cuts.json'), 'utf8')).rows as CutRow[]).map(c => [c.pandId, c]));
  const has = (dir: string, pid: string, ext: string) => fs.existsSync(path.join(root, BELT, dir, `${pid}.${ext}`));
  const slug = street.toLowerCase().replace(/\s+/g, '-');
  const out: Record<string, unknown> = {};
  for (const [a, b] of runs) {
    const belt = beltMembers(sel, cuts, street, a, b);
    const face = faceForRun(street, a, b, new Set(belt.map(m => m.pandId)));
    const key = (m: RowMemberDef) => m.numbers?.[0] ?? 0;
    const members = [...belt, ...(face?.extra ?? [])].sort((x, y) => (a % 2 === 0 ? key(y) - key(x) : key(x) - key(y)));
    const id = `${slug}-${a}-${b}`;
    const lacks = members.map(m => ({ m, cut: has('cuts', m.pandId, 'jpg'), read: has('answers-kept', m.pandId, 'json'), held: has('answers-held', m.pandId, 'json') }));
    console.log(`${id}: ${members.length} pands`);
    for (const x of lacks) console.log(`  ${x.m.label.padEnd(8)} ${x.m.pandId} ${x.m.built} ${String(x.m.widthM).padStart(5)} m${x.cut ? '' : '  NO CUT'}${x.read ? '' : x.held ? '  read held (outline off)' : '  no read'}${cuts.get(x.m.pandId)?.skip ? `  (${cuts.get(x.m.pandId)!.skip})` : ''}`);
    out[id] = {
      title: `${street} ${a}-${b} (${a % 2 ? 'odd' : 'even'} side, ${Math.min(...members.map(m => m.built!))}-${Math.max(...members.map(m => m.built!))})`,
      members, cuts: path.relative(rowsJson.d1Root, path.join(root, BELT, 'cuts')), answers: path.relative(rowsJson.d1Root, path.join(root, BELT, 'answers-kept')),
      staged: path.relative(rowsJson.d1Root, path.join(root, 'staged-belt-20261114')),
      wallFromCuts: true,
      ...(face ? { face: face.id } : {}),
      note: face ? `canal belt as rows: the October face ${face.id} for its houses (${face.extra.map(m => m.label).join(', ') || 'all in the belt tranche'} added from it), the belt D1 tranche for the rest (belt-rows.ts)`
        : `canal belt as rows: no block-face intent; members, widths and years from the belt D1 tranche (belt-rows.ts)`,
    };
  }
  if (argv.includes('--write')) {
    rowsJson.rows = { ...rowsJson.rows, ...out };
    fs.writeFileSync(ROWS, JSON.stringify(rowsJson, null, 2) + '\n');
    console.log(`wrote ${Object.keys(out).length} rows to ${path.relative(REPO, ROWS)}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
