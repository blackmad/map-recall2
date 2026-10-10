/** Which representation the game draws for each pand, and what superseded what. Pure; tested. */
import type { FaceStatus, LiveRepresentation, StreetPandRow, SurveyRecipeHouse } from './types';

export interface ChunkRef { id: string; pandIds: readonly string[] }
export interface RecipeRef { id: string; pandId: string }
export interface FaceRef { id: string; status: FaceStatus; pandIds: readonly string[] }
export interface StreetPand { pandId: string; label: string; buildYear: number | null }

const isFaceChunk = (id: string) => id.startsWith('chunk-face-');

/** Live representation for one pand. Precedence follows the runtime (ordinaryChunks.applyStreetChunks):
 * an installed chunk replaces the per-house spec; a face chunk is reported as `face`. */
export function liveFor(pandId: string, chunks: readonly ChunkRef[], recipes: readonly RecipeRef[]): { live: LiveRepresentation; drawnBy?: string } {
  const chunk = chunks.find(c => c.pandIds.includes(pandId));
  if (chunk) return { live: isFaceChunk(chunk.id) ? 'face' : 'chunk', drawnBy: chunk.id };
  const recipe = recipes.find(r => r.pandId === pandId);
  if (recipe) return { live: 'standalone', drawnBy: recipe.id };
  return { live: 'generic' };
}

export function pandRows(pands: readonly StreetPand[], chunks: readonly ChunkRef[], recipes: readonly RecipeRef[], faces: readonly FaceRef[], notes: Readonly<Record<string, string>> = {}): StreetPandRow[] {
  return pands.map(p => {
    const live = liveFor(p.pandId, chunks, recipes);
    const pending = faces.find(f => f.status !== 'installed' && f.pandIds.includes(p.pandId));
    return {
      pandId: p.pandId, label: p.label, buildYear: p.buildYear, ...live,
      ...(pending && live.live !== 'face' ? { pendingFace: pending.id } : {}),
      ...(notes[p.pandId] ? { note: notes[p.pandId] } : {}),
    };
  });
}

/** A per-house recipe is superseded when a FACE draws its pand; inside a post-hoc chunk it is still its own geometry. */
export function recipeStatus(recipe: RecipeRef, chunks: readonly ChunkRef[]): Pick<SurveyRecipeHouse, 'status' | 'drawnBy'> {
  const chunk = chunks.find(c => c.pandIds.includes(recipe.pandId));
  if (!chunk) return { status: 'standalone' };
  return isFaceChunk(chunk.id) ? { status: 'superseded', drawnBy: chunk.id } : { status: 'chunk', drawnBy: chunk.id };
}

/** "Bilderdijkstraat 122" … "Bilderdijkstraat 134" → "Bilderdijkstraat 122–134". */
export function addressRange(street: string, addresses: readonly string[]): string {
  const numbers = addresses.flatMap(a => [...a.matchAll(/(\d+)/g)].map(m => Number(m[1]))).filter(Number.isFinite);
  if (!numbers.length) return street;
  const lo = Math.min(...numbers), hi = Math.max(...numbers);
  return lo === hi ? `${street} ${lo}` : `${street} ${lo}–${hi}`;
}
