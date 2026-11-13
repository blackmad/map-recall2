/**
 * Lane BK (route bake-off, 2026-11-13): route C for D1's staged parts. A vision-judge part states a few fields of a
 * front (storeys, bays, bands, windowHead, souterrain, cornice, gable) and the palette's wall; `toRecipe` needs a
 * complete canal-house intent (street, gable, basement, cornice, windows, hoist, doorBay, roof, frame and door paint),
 * so no AH07 part takes the recipe route on its own (D1 pixel-check: "the parts have no roof"). This completer fills
 * every field the part does not state with one fixed c19 default, records which ones it filled, and writes the scratch
 * house directory `scripts/building-recipes/houses/bk-<pand>/` that compile.ts and house:preview --recipe read.
 *
 *   node --import tsx scripts/house-line/bakeoff/complete-recipe.ts <part.json ...> --street Weteringschans
 *        [--defaults <probe.json>] [--out <summary.json>] [--clean]
 *
 * --defaults: D1's ah07-probe.json; an unstated storeys/bays count takes the generic path's drawn grid from it.
 * --clean removes the scratch directories (never commit them; the integrator's house:publish owns spec-<pand> dirs).
 * Nothing here publishes or installs.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { intentSources } from '../../../src/canalRecall/houseSpec/toRecipe.ts';
import { validateIntent } from '../../../src/canalRecall/buildingRecipe/intent.ts';
import type { HouseSpec } from '../../../src/canalRecall/houseSpec/spec.ts';

const argv = process.argv.slice(2);
const flag = (n: string) => { const i = argv.indexOf(n); return i < 0 ? undefined : argv[i + 1]; };
const files = argv.filter(a => a.endsWith('.json') && a !== flag('--defaults') && a !== flag('--out'));
const street = flag('--street') ?? 'Weteringschans';
const probe = flag('--defaults') ? JSON.parse(readFileSync(flag('--defaults')!, 'utf8')) as Record<string, { drawn?: { storeys: number; columns: number } }> : {};
const HOUSES = 'scripts/building-recipes/houses';

/** The c19 defaults for every field a part leaves unstated (one value each; the report lists what was filled). */
export const C19_DEFAULTS = {
  gable: 'cornice', cornice: 'simple', windows: 't-window', hoist: false, doorBay: 0,
  roof: { material: 'slate' }, frame: 'white-painted', door: '#26302a',
} as const;

export function completeSpec(spec: HouseSpec, opts: { street: string; storeys?: number; bays?: number }) {
  const f0 = { ...(spec.design.fronts?.[0] ?? {}) } as Record<string, any>;
  const filled: string[] = [];
  const fill = (k: string, v: unknown) => { if (f0[k] === undefined) { f0[k] = v; filled.push(`fronts/0/${k}`); } };
  fill('id', 'front0'); fill('street', opts.street);
  fill('gable', C19_DEFAULTS.gable); fill('cornice', C19_DEFAULTS.cornice); fill('windows', C19_DEFAULTS.windows);
  fill('hoist', C19_DEFAULTS.hoist); fill('doorBay', C19_DEFAULTS.doorBay);
  if (f0.storeys === undefined && opts.storeys) fill('storeys', opts.storeys);
  if (f0.bays === undefined && opts.bays) fill('bays', opts.bays);
  // A souterrain needs a basement other than none (intent.ts souterrain); a stoop reaches the bel-etage over it.
  fill('basement', f0.souterrain ? 'stoop-and-windows' : 'none');
  if (Number.isInteger(f0.bays) && f0.doorBay > f0.bays - 1) f0.doorBay = 0;
  const palette = { ...(spec.design.palette ?? {}) } as Record<string, any>;
  if (palette.frame === undefined) { palette.frame = C19_DEFAULTS.frame; filled.push('palette/frame'); }
  if (palette.door === undefined) { palette.door = C19_DEFAULTS.door; filled.push('palette/door'); }
  if (palette.brick === undefined) { palette.brick = 'red-brown'; filled.push('palette/brick'); }
  const roof = spec.design.roof ?? (filled.push('roof/material'), { ...C19_DEFAULTS.roof });
  const candidate = {
    schemaVersion: 1, kind: 'canal-house', id: `bk-${spec.pandId}`, pandId: spec.pandId, address: spec.address ?? spec.pandId,
    sources: intentSources(spec), fronts: [f0, ...(spec.design.fronts ?? []).slice(1)], roof, palette,
    ...(spec.design.notes ? { notes: spec.design.notes } : {}),
  };
  let intent = null, error = null;
  try { intent = validateIntent(candidate); } catch (e) { error = (e as Error).message.split('\n').slice(0, 4).join(' | '); }
  const stated = Object.keys(spec.provenance).filter(k => k.startsWith('fronts/0/') || k.startsWith('palette/') || k.startsWith('roof/'));
  const consumedFacts = Object.keys(spec.facts ?? {}).map(k => `facts/${k}`); // toRecipe wraps `design` only
  return { intent, error, filled, stated, ignoredFacts: consumedFacts, candidate };
}

const rows: Record<string, unknown>[] = [];
for (const file of files) {
  const spec = JSON.parse(readFileSync(file, 'utf8')) as HouseSpec;
  const dir = path.join(HOUSES, `bk-${spec.pandId}`);
  if (argv.includes('--clean')) { rmSync(dir, { recursive: true, force: true }); continue; }
  const drawn = probe[spec.pandId]?.drawn;
  const r = completeSpec(spec, { street, storeys: drawn?.storeys, bays: drawn?.columns });
  rows.push({ pandId: spec.pandId, ok: !!r.intent, error: r.error, stated: r.stated, filled: r.filled, ignoredFacts: r.ignoredFacts });
  if (!r.intent) { console.error(spec.pandId, 'not a valid intent:', r.error); continue; }
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'intent.json'), JSON.stringify(r.intent, null, 1) + '\n');
  console.log(`${spec.pandId}: stated ${r.stated.length}, filled ${r.filled.length} (${r.filled.join(', ')})`);
}
if (flag('--out')) writeFileSync(flag('--out')!, JSON.stringify(rows, null, 1) + '\n');
if (!existsSync(HOUSES)) console.error('run from the repo root');
