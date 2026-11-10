// The H11 design gate (#361): the generic route of a spec'd pand before (HOUSE_SPEC_DESIGN=0) and after (the H11 design
// fields on) against the recipe route and the photo, from house:preview outputs.
//
//   npx tsx scripts/house-specs/design-gate.ts --pairs <dir> --before <dir> --after <dir> [--json <file>]
//
// --pairs <dir>   one directory per pand: spec.json (a HouseSpec) or intent.json (a resolved intent), and
//                 recipe-measure.json (house:preview <pand> --recipe --photo's measure.json)
// --before <dir>  house:preview --spec/--intent --photo outputs per pand (<dir>/<pand>/measure.json), HOUSE_SPEC_DESIGN=0
// --after <dir>   the same with the H11 fields on
// Per pand and in total: drawn storeys and window columns (measure.json `layout`, the mesher's own grid) against the
// spec's; window shape and wall lightness against the recipe route; the preview verdict against the photo; and the own
// pand's chunk vertices (the triangle cost). docs/house-line.md §1 "Design fields on the generic path (H11)".
import fs from 'node:fs';
import path from 'node:path';

export const HELP = `design-gate --pairs <dir> --before <dir> --after <dir> [--json <file>]: generic route before/after the H11 design
fields against the spec, the recipe route and the photo (house:preview outputs; see the header of this file).`;
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
if (process.argv.includes('--help') || !arg('--pairs') || !arg('--before') || !arg('--after')) { console.log(HELP); process.exit(process.argv.includes('--help') ? 0 : 2); }
const pairs = path.resolve(arg('--pairs')!), phases = { before: path.resolve(arg('--before')!), after: path.resolve(arg('--after')!) };
const read = (f: string) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const luma = (h?: string) => { if (!h) return NaN; const n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };

type Row = Record<string, unknown>;
const rows: Row[] = [];
const tally: Record<string, Record<string, number>> = { before: {}, after: {} };
const bump = (ph: string, k: string, v = 1) => { tally[ph][k] = (tally[ph][k] ?? 0) + v; };
for (const pand of fs.readdirSync(pairs).filter(p => /^\d{16}$/.test(p)).sort()) {
  const d = path.join(pairs, pand), src = read(path.join(d, 'intent.json')) ?? read(path.join(d, 'spec.json'));
  const front = (src?.design ?? src)?.fronts?.[0] ?? {}, recipe = read(path.join(d, 'recipe-measure.json'));
  const specStoreys = Number(front.storeys) || null, specCols = Number(front.axisGrid ?? (Array.isArray(front.bays) ? Math.max(...front.bays.slice(1)) : front.bays)) || null;
  const row: Row = { pand, specStoreys, specCols, recipeWindow: recipe?.render?.window?.shape ?? null, recipeVerdict: recipe?.verdict?.verdict ?? null };
  for (const [ph, dir] of Object.entries(phases)) {
    const m = read(path.join(dir, pand, 'measure.json'));
    if (!m) { row[ph] = null; continue; }
    const lay = m.layout as { storeys: number; columns: number } | null;
    const shape = m.render?.window?.shape ?? null, verdict = m.verdict?.verdict ?? 'NO PHOTO';
    const wallDL = Math.abs(luma(m.render?.wall) - luma(recipe?.render?.wall));
    row[ph] = { storeys: lay?.storeys ?? null, columns: lay?.columns ?? null, window: shape, verdict, wallDLvsRecipe: +wallDL.toFixed(3), ownVertices: m.chunk?.ownVertices ?? null };
    bump(ph, 'pands');
    if (specStoreys && lay?.storeys === specStoreys) bump(ph, 'storeysEqualSpec');
    if (specCols && lay?.columns === specCols) bump(ph, 'columnsEqualSpec');
    if (shape && shape === row.recipeWindow) bump(ph, 'windowEqualRecipe');
    bump(ph, `verdict ${verdict}`);
    if (verdict === row.recipeVerdict) bump(ph, 'verdictEqualRecipe');
    if (Number.isFinite(wallDL)) bump(ph, 'wallDLvsRecipeSum', wallDL);
    bump(ph, 'ownVertices', Number(m.chunk?.ownVertices) || 0);
  }
  rows.push(row);
  const b = row.before as Row | null, a = row.after as Row | null;
  console.log(`${pand}  spec ${specStoreys}s/${specCols}c  before ${b?.storeys}s/${b?.columns}c ${b?.window} ${b?.verdict}  after ${a?.storeys}s/${a?.columns}c ${a?.window} ${a?.verdict}  recipe ${row.recipeWindow} ${row.recipeVerdict}  verts ${b?.ownVertices}->${a?.ownVertices}`);
}
for (const ph of Object.keys(tally)) {
  const t = tally[ph];
  t.wallDLvsRecipeMean = +((t.wallDLvsRecipeSum ?? 0) / (t.pands || 1)).toFixed(3); delete t.wallDLvsRecipeSum;
  console.log(ph, JSON.stringify(t));
}
const json = arg('--json');
if (json) fs.writeFileSync(json, JSON.stringify({ rows, tally }, null, 1) + '\n');
