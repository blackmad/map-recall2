/**
 * The signature-inventory export gate, shared by build-manual-landmarks.ts (refuses the export), audit-glb-quality.ts
 * (prints the rows under the geometry gates) and check-landmark-inventory.ts (check:canal). Rules and schema:
 * src/canalRecall/landmarks/ornamentInventory.ts; process: docs/buildings-pipeline.md, "Bespoke landmark lane".
 *
 * "First exported" is the first commit that added `public/canal-drive/models/<id>.glb` (git history). model-dates.json
 * cannot answer it: it records the latest rebuild, which every re-export touches.
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {formatRows, inventoryRequired, inventoryRows, validateInventory, type InventoryIssue, type LandmarkInventory} from '../../src/canalRecall/landmarks/ornamentInventory';

const ROOT = path.resolve(import.meta.dirname, '../..');
export const inventoryPath = (id: string) => path.join(ROOT, 'scripts/landmarks', `${id}-inventory.json`);

let firstAdded: Map<string, string> | undefined;
/** id -> ISO date of the commit that first added its runtime GLB (lod1 files ignored). */
export function firstExportDates(): Map<string, string> {
  if (firstAdded) return firstAdded;
  firstAdded = new Map();
  const log = execFileSync('git', ['log', '--no-renames', '--diff-filter=A', '--reverse', '--name-only', '--format=@%aI', '--', 'public/canal-drive/models/*.glb'], {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28});
  let date = '';
  for (const line of log.split('\n')) {
    if (line.startsWith('@')) { date = line.slice(1); continue; }
    const m = line.match(/^public\/canal-drive\/models\/([^/]+)\.glb$/);
    if (m && !m[1].endsWith('.lod1') && !firstAdded.has(m[1])) firstAdded.set(m[1], date);
  }
  return firstAdded;
}

export interface GateResult {
  id: string;
  firstExported?: string;
  required: boolean;
  exists: boolean;
  inventory?: LandmarkInventory;
  issues: InventoryIssue[];
  /** Required and missing, or any schema error, or (when required) any gate issue. */
  pass: boolean;
}

export function inventoryGate(id: string): GateResult {
  const file = inventoryPath(id), exists = fs.existsSync(file);
  const firstExported = firstExportDates().get(id);
  const required = inventoryRequired(id, firstExported);
  let inventory: LandmarkInventory | undefined;
  let issues: InventoryIssue[] = [];
  if (exists) {
    try { inventory = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { issues.push({severity: 'error', path: '', message: `unreadable JSON: ${String(e).slice(0, 120)}`}); }
    // An inventory that exists is always schema-checked; the export rules (open items, signature) only bind when required.
    if (inventory) issues = validateInventory(inventory, {gate: true, id});
  } else if (required) issues.push({severity: 'gate', path: '', message: `no ${path.relative(ROOT, file)}: run scripts/landmarks/landmark-brief.ts --pand=<id> --id=${id} and fill it before geometry`});
  const pass = !issues.some(i => i.severity === 'error' || (required && i.severity === 'gate'));
  return {id, firstExported, required, exists, inventory, issues, pass};
}

export function describeGate(g: GateResult): string[] {
  const head = `${g.pass ? 'PASS' : 'FAIL'} inventory ${g.id}: ${g.required ? 'required' : 'not required'} (first exported ${g.firstExported?.slice(0, 10) ?? 'never'})${g.exists ? '' : ', no inventory'}`;
  const out = [head];
  for (const i of g.issues) out.push(`   ${i.severity === 'error' ? 'FAIL' : g.required ? 'FAIL' : 'would block'} ${i.path}: ${i.message}`);
  if (g.inventory?.walls) {
    const rows = inventoryRows(g.inventory), n = (p: string) => rows.filter(r => r.plan === p).length;
    out.push(`   items: ${rows.length} (${n('modelled')} modelled, ${n('simplified')} simplified, ${n('skipped')} skipped, ${n('open')} open); signature ${g.inventory.signature?.join(', ') || '-'}`);
    out.push(...formatRows(rows).map(r => `   ${r}`));
  }
  return out;
}

/** build-manual-landmarks.ts: refuse to export a gated landmark without a resolved inventory. LANDMARK_INVENTORY_GATE=warn downgrades (local experiments only; check:canal still fails). */
export function assertInventoryForExport(id: string): void {
  const g = inventoryGate(id);
  if (g.pass) return;
  const msg = describeGate(g).filter(l => !/^ {3}[* ] /.test(l)).join('\n');
  if (process.env.LANDMARK_INVENTORY_GATE === 'warn') { console.warn(`WARNING (LANDMARK_INVENTORY_GATE=warn) export of ${id} would be refused:\n${msg}`); return; }
  throw new Error(`Refusing to export ${id}: its signature inventory is missing or unresolved (docs/buildings-pipeline.md, "Bespoke landmark lane").\n${msg}`);
}
