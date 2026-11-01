/**
 * Ground uses of the installed auto-placed faces against what autoPlace.ts groundUse says today (#157 fix 4). A change
 * of the street-furniture set or the use patterns re-labels ground floors only when a face is re-placed; this lists the
 * installed houses whose ground use would change, so the change is reviewed before any re-install.
 *   node --import tsx scripts/block-face/ground-use-audit.ts [--all]   (--all: every face with an intent, not only installed)
 */
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {groundUse, osmCategory, type PandEvidence} from '../../src/canalRecall/blockFace/autoPlace.ts';

const FACES = 'scripts/block-face/faces';
const read = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const installed = new Set<string>(read('public/canal-drive/ordinary-buildings-data/chunks.json').chunks.map((c: {id: string}) => c.id.replace(/^chunk-face-/, '')));
const faces = process.argv.includes('--all') ? readdirSync(FACES) : [...installed];
let houses = 0;
const changes: string[] = [];
for (const face of faces.sort()) {
  const ij = path.join(FACES, face, 'intent.json'), uj = path.join(FACES, face, 'uses.json');
  if (!existsSync(ij) || !existsSync(uj)) continue;
  const intent = read(ij), uses = read(uj);
  if (!String(intent.authoring?.author ?? '').startsWith('auto-place')) continue;
  for (const h of intent.houses) {
    const g = h.groundFloor;
    if (!g?.use) continue;
    const u = uses.pands.find((p: any) => p.pandId === h.pandId);
    const ev = {pandId: h.pandId, address: h.address, groundUses: [...new Set<string>((u?.groundUnits ?? []).map((x: any) => x.use))],
      osm: (u?.osm ?? []).map((b: any) => ({type: b.type, id: b.id, name: b.tags.name, category: osmCategory(b.tags)}))} as unknown as PandEvidence;
    const now = groundUse(ev, g.photoDate);
    houses++;
    if (now.use !== g.use || (now.category ?? null) !== (g.category ?? null))
      changes.push(`${installed.has(face) ? 'INSTALLED ' : ''}${face} ${h.pandId.slice(-6)} ${h.address}: ${g.use}${g.category ? ` (${g.category})` : ''} -> ${now.use}${now.category ? ` (${now.category})` : ''}`);
  }
}
console.log(`${houses} auto-placed houses checked; ${changes.length} ground use(s) would change`);
for (const c of changes) console.log(`  ${c}`);
