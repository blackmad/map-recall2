/**
 * The facts a recipe-route house on a block face compiles from (lane buurt-weesper, 2026-11-10).
 *
 * `blockFaceFactsFor` (publishPlan.ts) hands a new `spec-<pandId>` house the face's raw `pands/<pand>/facts.json`: BAG
 * footprint and 3DBAG LoD2.2 roofs. The face's chunk never compiles from those. `prepareFaceFacts` (blockFace/compile.ts)
 * first sets the shared street ground, the photo-measured eaves (`measuredEavesM`), the row clamps and the recipe roof
 * (`recipeRoof.ts`: the roof form read off the front photo, 3DBAG an upper bound only). Without it a staged face pand
 * came back with 3DBAG's rear volume over its cornice: Sarphatistraat 169 (0363100012170677), whose type says
 * `roof.form: flat` from the front, drew a 3 m slate slope and a side wall up to the 3DBAG ridge on the recipe route.
 *
 * `preparedFaceFacts(pand)` returns the prepared facts of the face whose intent lists the pand (the first, sorted), or
 * null when no committed face intent lists it; callers then fall back to `blockFaceFactsFor`. Deterministic: the same
 * planner roof-golden.ts hashes.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { BuildingFacts } from '../../src/canalRecall/buildingRecipe/facts.ts';
import { FACES } from '../block-face/intake.ts';
import { loadGoldenFace } from '../block-face/roof-golden.ts';

/** The face directories whose intent.json lists the pand as a house (sorted). */
export function facesListing(pandId: string, faces = FACES): string[] {
  const bare = pandId.replace('NL.IMBAG.Pand.', '');
  return fs.readdirSync(faces).sort().filter(d => {
    const f = path.join(faces, d, 'intent.json');
    if (!fs.existsSync(f) || !fs.existsSync(path.join(faces, d, 'pands', bare, 'facts.json'))) return false;
    const intent = JSON.parse(fs.readFileSync(f, 'utf8'));
    return (intent.houses ?? []).some((h: { pandId?: string }) => h.pandId === bare);
  });
}

/** The prepared (face-planned) facts of the pand, and the face they came from; null when no face intent lists it. */
export function preparedFaceFacts(pandId: string): { face: string; facts: BuildingFacts } | null {
  const bare = pandId.replace('NL.IMBAG.Pand.', '');
  for (const face of facesListing(bare)) {
    const { prepared } = loadGoldenFace(face);
    const facts = prepared.ground.facts.find(f => f.pandId === bare);
    if (facts) return { face, facts };
  }
  return null;
}

/** Write the pand's prepared face facts to `dest`; returns the face id, or null (nothing written). */
export function writePreparedFaceFacts(pandId: string, dest: string): string | null {
  const p = preparedFaceFacts(pandId);
  if (!p) return null;
  fs.writeFileSync(dest, JSON.stringify(p.facts, null, 1) + '\n');
  return p.face;
}
