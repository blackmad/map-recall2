/**
 * Spec -> canal-house intent, for the recipe route (house line, docs/house-line.md §1).
 *
 * A spec is recipe-eligible when its design, wrapped in the spec's identity, is a complete canal-house intent that
 * `validateIntent` accepts. The intent's `sources` come from the spec's receipts: every distinct receipt whose source
 * maps to an intent source kind and that carries an evidence date. Anything less is the generic route.
 */
import { validateIntent, type CanalHouseIntent, type IntentSource, SOURCE_KINDS } from '../buildingRecipe/intent.ts';
import type { HouseSpec, Prov, SpecSource } from './spec.ts';

/** Spec source -> the intent's source kind (sources with no photo or record behind them map to none). */
export const INTENT_SOURCE_KIND: Partial<Record<SpecSource, typeof SOURCE_KINDS[number]>> = {
  'streetlevel-measured': 'street-panorama', 'vision-judge': 'street-panorama', 'monument-text': 'monument-record',
  reviewed: 'human-review', author: 'human-review', 'pdok-ortho': 'orthophoto',
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** The intent sources a spec's receipts stand for (deduplicated by ref + kind, in receipt order). */
export function intentSources(spec: HouseSpec): IntentSource[] {
  const out: IntentSource[] = [], seen = new Set<string>();
  for (const prov of Object.values(spec.provenance) as Prov[]) {
    const kind = INTENT_SOURCE_KIND[prov.source];
    if (!kind || !prov.at) continue;
    const key = `${kind}|${prov.ref}`, id = slug(prov.ref) || kind;
    // The slug keeps 60 characters, so receipts of one photo that differ only in their note collapse to one id: one
    // source (the compiler refuses duplicate observation ids; belt-nieuwmarkt #363, every author receipt per field).
    if (seen.has(key) || seen.has(`id|${id}`)) continue;
    seen.add(key); seen.add(`id|${id}`);
    out.push({ id, kind, capturedAt: prov.at, ...(/^https?:/.test(prov.ref) ? { url: prov.ref } : {}) });
  }
  return out;
}

/** The canal-house intent a complete spec describes, or null when the spec is incomplete or invalid as an intent. */
export function toRecipe(spec: HouseSpec): CanalHouseIntent | null {
  const d = spec.design;
  if (!d?.fronts?.length || !d.roof || !d.palette) return null;
  const candidate = {
    schemaVersion: 1, kind: 'canal-house', id: `spec-${spec.pandId}`, pandId: spec.pandId,
    address: spec.address ?? spec.pandId, sources: intentSources(spec), ...structuredClone(d),
  };
  try { return validateIntent(candidate); } catch { return null; }
}

/** The spec with its derived route (`recipe` iff toRecipe succeeds). */
export const withRoute = (spec: HouseSpec): HouseSpec => ({ ...spec, route: toRecipe(spec) ? 'recipe' : 'generic' });
