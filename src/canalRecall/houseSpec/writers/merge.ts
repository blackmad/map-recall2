/**
 * Merging the writers of one pand (house line H5). `resolveSpecs` (resolve.ts) picks every field's winner by the evidence ladder, then
 * confidence, then the newer date: a writer never overwrites a stronger source and a field no writer states stays absent. On top of that
 * this module records every field two or more writers state with different values: both values, their sources and confidences, and who
 * won, so the per-field disagreement counts of a buurt (printed by describe.ts) and the worst-disagreement sheets have their input.
 */
import { resolveSpecs, strongerProv } from '../resolve.ts';
import { provenanceOf, specFields, type HouseSpec, type Prov } from '../spec.ts';

export type WriterPart = { writer: string; spec: HouseSpec };
export type Disagreement = {
  path: string;
  values: { writer: string; value: unknown; source: Prov['source']; confidence: number }[];
  /** The writer whose value is in the merged spec. */
  picked: string;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function mergeWriters(parts: readonly WriterPart[]): { spec: HouseSpec; disagreements: Disagreement[] } | null {
  const live = parts.filter(p => specFields(p.spec).length > 0);
  if (!live.length) return null;
  const spec = resolveSpecs(live.map(p => p.spec));
  const byPath = new Map<string, { writer: string; value: unknown; prov: Prov }[]>();
  for (const p of live) for (const [path, value] of specFields(p.spec)) {
    const prov = provenanceOf(p.spec, path);
    if (!prov) continue;
    const list = byPath.get(path) ?? []; list.push({ writer: p.writer, value, prov }); byPath.set(path, list);
  }
  const disagreements: Disagreement[] = [];
  for (const [path, list] of byPath) {
    if (list.length < 2 || list.every(x => same(x.value, list[0].value))) continue;
    // the winner is whichever entry carries the merged field's value and receipt (resolveSpecs kept it)
    const win = provenanceOf(spec, path)!;
    let picked = list[0];
    for (const x of list) if (strongerProv(picked.prov, x.prov, path) !== picked.prov) picked = x;
    if (picked.prov.source !== win.source || picked.prov.confidence !== win.confidence) picked = list.find(x => x.prov.source === win.source && x.prov.confidence === win.confidence) ?? picked;
    disagreements.push({ path, values: list.map(x => ({ writer: x.writer, value: x.value, source: x.prov.source, confidence: x.prov.confidence })), picked: picked.writer });
  }
  disagreements.sort((a, b) => (a.path < b.path ? -1 : 1));
  if (disagreements.length) {
    spec.design.notes = [...(spec.design.notes ?? []), ...disagreements.map(d => `describe: ${d.path} disagrees: ${d.values.map(v => `${v.writer} ${JSON.stringify(v.value)} (${v.source} ${v.confidence})`).join(' vs ')}; ${d.picked} wins`)];
    spec.provenance['notes'] = { source: 'default', confidence: 0, ref: 'house:describe', at: null };
  }
  return { spec, disagreements };
}
