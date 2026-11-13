/**
 * hold-installs: hold or release installed ordinary GLBs (lane BA, 2026-11-13). The mechanism is
 * src/canalRecall/landmarks/ordinaryHolds.ts; the data public/canal-drive/ordinary-buildings-data/held.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import {validateHolds, type HeldFile, type OrdinaryHold} from '../../src/canalRecall/landmarks/ordinaryHolds.ts';

const HELP = `hold-installs: hold or release installed ordinary GLBs. A held install keeps its catalogue entry and GLB, the game stops
drawing it and (after build-covers) stops hiding its pand, so the pand draws through the generic mesher with its published spec.

  node --import tsx scripts/building-recipes/hold-installs.ts --from=<holds.json> [--only=<pand,...>] [--dry-run]
  node --import tsx scripts/building-recipes/hold-installs.ts --hold=<pand,...> --reason="<why>" [--gates=<id,...>] [--batch=<name>] [--by=<name>] [--dry-run]
  node --import tsx scripts/building-recipes/hold-installs.ts --release=<pand,...|all> [--dry-run]
  node --import tsx scripts/building-recipes/hold-installs.ts --from-audit=<install-audit.json> --batch=<name> --out=<holds.json>
  node --import tsx scripts/building-recipes/hold-installs.ts --list
  --help    this text

<pand>          a 16-digit BAG pand id, its last 6 digits (0363100012 prefix), or ordinary-<pand>
--from          a holds list {"<ordinary-id>": {"reason", "gates"?, "batch"?}} (scripts/building-recipes/holds/*.json), merged into held.json
--from-audit    write a holds list from install-audit.ts --out JSON: one entry per pand failing a hard gate, the reason naming gate and metres
--release       remove holds (all = every hold)
--dry-run       print what would change; write nothing

Writes public/canal-drive/ordinary-buildings-data/held.json (sorted), then prints the commands that make a hold real:
covers.json, the touched world cells, the signature-placement bundle and the checks.`;

const ROOT = path.resolve(import.meta.dirname, '../..');
const HELD = path.join(ROOT, 'public/canal-drive/ordinary-buildings-data/held.json');
const CATALOGUE = path.join(ROOT, 'public/canal-drive/ordinary-buildings-data/catalogue.json');
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const has = (k: string) => process.argv.includes(`--${k}`);
if (has('help') || process.argv.length <= 2) { console.log(HELP); process.exit(0); }

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const catalogueIds = new Set((readJson(CATALOGUE).models as {id: string}[]).map(m => m.id));
export function ordinaryId(token: string): string {
  const t = token.trim().replace(/^ordinary-/, '').replace(/^NL\.IMBAG\.Pand\./, '');
  const pand = /^\d{6}$/.test(t) ? `0363100012${t}` : t;
  if (!/^\d{16}$/.test(pand)) throw new Error(`not a pand id: ${token}`);
  return `ordinary-${pand}`;
}
const ids = (list: string) => list.split(/[,\s]+/).filter(Boolean).map(ordinaryId);
const today = new Date().toISOString().slice(0, 10);

// --from-audit: a holds list from the install audit (no change to held.json).
if (arg('from-audit')) {
  const audit = readJson(arg('from-audit')!), batch = arg('batch'), out: Record<string, Omit<OrdinaryHold, 'heldAt'>> = {};
  for (const r of audit.rows as {pand: string; address: string; fail: string[]; audit: {gates: {id: string; pass: boolean; valueM: number; unit: string; detail?: string}[]}; crown: {pass: boolean; why?: string}}[]) {
    if (!r.fail.length) continue;
    const parts = r.audit.gates.filter(g => !g.pass).map(g => `${g.id} ${g.valueM} ${g.unit}${g.detail ? ` (${g.detail})` : ''}`);
    if (!r.crown.pass) parts.push(`crown: ${r.crown.why}`);
    out[ordinaryId(r.pand)] = {reason: `${r.address}: install audit ${audit.generatedAt?.slice(0, 10) ?? today} failed ${parts.join('; ')}`, gates: r.fail, ...(batch ? {batch} : {})};
  }
  const file = arg('out') ?? path.join(ROOT, 'scripts/building-recipes/holds', `${batch ?? 'audit'}-gates.json`);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${Object.keys(out).length} holds to ${path.relative(ROOT, file)}`);
  process.exit(0);
}

const file: HeldFile = readJson(HELD);
const held = {...validateHolds(file)};
const before = JSON.stringify(held);
if (has('list')) {
  for (const [id, h] of Object.entries(held).sort()) console.log(`${id}  ${h.heldAt}  ${h.gates?.join(',') ?? ''}  ${h.reason}`);
  console.log(`${Object.keys(held).length} held`);
  process.exit(0);
}
const changed: string[] = [];
const add = (id: string, h: OrdinaryHold) => {
  if (!catalogueIds.has(id)) throw new Error(`${id} is not in the ordinary catalogue: nothing to hold`);
  if (!h.reason?.trim()) throw new Error(`${id}: a hold needs a reason`);
  held[id] = h; changed.push(`hold ${id}: ${h.reason}`);
};
if (arg('from')) {
  const list = readJson(arg('from')!) as Record<string, Omit<OrdinaryHold, 'heldAt'> & {heldAt?: string}>;
  const only = arg('only') ? new Set(ids(arg('only')!)) : null;
  for (const [key, h] of Object.entries(list)) {
    const id = ordinaryId(key);
    if (only && !only.has(id)) continue;
    add(id, {heldAt: h.heldAt ?? today, ...h, ...(arg('by') ? {by: arg('by')} : {})});
  }
}
if (arg('hold')) {
  const reason = arg('reason');
  if (!reason) throw new Error('--hold needs --reason="..."');
  for (const id of ids(arg('hold')!)) add(id, {reason, heldAt: today, ...(arg('gates') ? {gates: arg('gates')!.split(',')} : {}), ...(arg('batch') ? {batch: arg('batch')} : {}), ...(arg('by') ? {by: arg('by')} : {})});
}
if (arg('release')) {
  const list = arg('release') === 'all' ? Object.keys(held) : ids(arg('release')!);
  for (const id of list) { if (held[id]) { delete held[id]; changed.push(`release ${id}`); } else console.warn(`${id} was not held`); }
}
const sorted = Object.fromEntries(Object.entries(held).sort(([a], [b]) => a.localeCompare(b)));
validateHolds({held: sorted});
for (const c of changed) console.log(c);
if (JSON.stringify(sorted) === before) { console.log('held.json unchanged'); process.exit(0); }
if (has('dry-run')) { console.log(`dry run: ${Object.keys(sorted).length} would be held; nothing written`); process.exit(0); }
fs.writeFileSync(HELD, JSON.stringify({_doc: file._doc, held: sorted}, null, 2) + '\n');
console.log(`wrote ${path.relative(ROOT, HELD)}: ${Object.keys(sorted).length} held

Make it real (the integrator, in this order; nothing below is run by this script):
  node --max-old-space-size=8192 --import tsx scripts/build-covers.ts && cp artifacts/bag-tiles/covers.json public/canal-drive/models/covers.json
  npm run check:covers
  npm run world:compile -- --changed --shell        # into artifacts/world/staging; only the cells of the held pands' tiles rebuild
  for d in cells shells far; do rsync -a --delete artifacts/world/staging/$d/ public/data/extracts/amsterdam/world-v1/$d/; done; cp artifacts/world/staging/{index.json,tiles.json,strings.bin} public/data/extracts/amsterdam/world-v1/
  npm run world:verify && npm run test:world-format
  npm run build:canal-signature-landmarks           # the only bundle that embeds the catalogue (ordinaryModels.ts)
  npm run test:building-taxonomy && npm run test:canal-game-structure && npm run check:content-stats`);
