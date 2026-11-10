/**
 * The stoop pass of the recipe compiler (K-stoep #360): every front whose fit report carries `stoops` (fit.ts, from
 * `FrontIntent.stoop`) gets its steps, landing, souterrain opening and iron balustrades in the elevation's frame. A
 * house without `stoop` is untouched (`addStoops` returns 0 without adding a mesh), so recipe GLBs and block-face chunks
 * stay byte-identical.
 *
 * Materials: the masonry in the front's stone (or wall brick, or trim paint: `material`), surface `stone`/`wall`/`trim`;
 * the iron and the souterrain opening as `door` surfaces in their own fixed colours (STOOP.ironHex, STOOP.underHex), the
 * way the timber balcony's iron grille is a `door` surface (oudWest.ts).
 */
import * as T from 'three';
import type {CanalHouseRecipe} from '../canalhouseRecipes.ts';
import type {FitReport} from './fit.ts';
import type {CanalHouseIntent} from './intent.ts';
import {emitStoop, placedSink, soupSink, stoopColours, type StoopPart} from './stoop.ts';

const SURFACE = {stone: 'stone', brick: 'wall', painted: 'trim'} as const;

export function addStoops(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  for (const f of fit.fronts) {
    const facade = group.getObjectByName(`elevation/${f.id}`);
    if (!f.stoops?.length || !facade) continue;
    const palette = recipe.elevations.find(e => e.id === f.id)?.palette?.value ?? recipe.palette.value;
    for (const [m, s] of f.stoops.entries()) {
      const soups: Record<StoopPart, number[]> = {body: [], iron: [], under: []};
      emitStoop(s.plan, {body: placedSink(soupSink(soups.body), s.scale, s.offset), iron: placedSink(soupSink(soups.iron), s.scale, s.offset), under: placedSink(soupSink(soups.under), s.scale, s.offset)});
      const colours = stoopColours(s.plan, palette);
      const surface: Record<StoopPart, string> = {body: SURFACE[s.plan.material], iron: 'door', under: 'door'};
      for (const part of ['body', 'under', 'iron'] as const) {
        if (!soups[part].length) continue;
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(soups[part], 3)); g.computeVertexNormals();
        const mesh = new T.Mesh(g, new T.MeshStandardMaterial({color: colours[part], roughness: part === 'iron' ? 0.7 : 1}));
        mesh.name = `stoop${f.stoops.length > 1 ? `-m${m}` : ''}/${part}`; mesh.userData = {component: 'entrance', surface: surface[part], pandId: intent.pandId};
        facade.add(mesh);
      }
      added++;
    }
  }
  return added;
}
