import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {compileLargeBuilding, type CompiledLargeBuilding, type LargeCompileHooks} from '../../src/canalRecall/buildingRecipe/largeCompile';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent';
import type {PanelCtx} from '../../src/canalRecall/blockBuilding/compose';
import {fitsPanel, newell, rectPoly} from '../../src/canalRecall/blockBuilding/panels';
import {dot, norm, scale, sub} from '../../src/canalRecall/blockBuilding/mesh';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts';
import intentJson from './hoofdbureau-elandsgracht-intent.json';
import factsJson from './hoofdbureau-elandsgracht-facts.json';

/**
 * Hoofdbureau van Politie, Elandsgracht 117 (BAG 0363100012169550, 1941; city public works). A hybrid builder:
 *
 *  - massing: the 3DBAG LoD2.2 walls and roofs verbatim, through the large-tier fit and block-kit compose
 *    (`compileLargeBuilding`), one facade system per wall group of scripts/landmarks/hoofdbureau-elandsgracht-intent.json;
 *  - by hand, from the panoramas (research in hoofdbureau-elandsgracht-research.json): the projecting white stone window hoods
 *    of the 1941 wings, the entrance canopy with its post on the Marnixstraat end block, the blue POLITIE plate on its bracket.
 *
 * Local frame = the large tier's: x east, z south, y up from the 3DBAG ground, origin the BAG footprint centroid.
 */
const FACTS = factsJson as unknown as BuildingFacts;
/** 3DBAG wall surfaces (one per hooded wall group of the intent) of the 1941 south-east fronts with white stone window hoods. */
const HOOD_SURFACES = [41, 216, 53];

/** MeshBuilder slot materialSlot (recipe) -> landmark palette name. */
const PALETTE: Record<string, 'brick' | 'stone' | 'glass' | 'frame' | 'dark' | 'blue' | 'white' | 'slate'> = {
  brick: 'brick', stucco: 'white', stone: 'stone', glass: 'glass', frame: 'frame', door: 'dark', accent: 'blue', slate: 'slate', roofTile: 'slate', bitumen: 'slate',
};

export interface HoofdbureauStats {triangles: number; hoods: number; canopy: boolean; plate: boolean}

/** A closed box in the panel's frame: `PanelCtx.box` omits the back (it sits on the wall); a free-standing part needs it. */
function solid(c: PanelCtx, slot: string, u0: number, u1: number, v0: number, v1: number, d0: number, d1: number, part: number) {
  c.box(slot, u0, u1, v0, v1, d0, d1, part);
  c.mesh.quad(slot, c.P(u0, v0, d0), c.P(u1, v0, d0), c.P(u1, v1, d0), c.P(u0, v1, d0), part, scale(c.p.n, -1));
}

/** Hand-modelled parts, drawn in each panel's own frame so every one sits on the exact 3DBAG wall plane. */
export function hoofdbureauHooks(stats: HoofdbureauStats): LargeCompileHooks {
  return {
    budget: 40000,
    panelHook: (c, info, g) => {
      if (!g) return;
      const s = g.slots, p = c.p;
      if (HOOD_SURFACES.some(w => g.surfaces.includes(w))) {
        // Heavy white stone hood over every sash window, a little wider than the opening (panorama 2025, west wing).
        for (const [k, list] of c.holes) {
          // The hood sits on the member wall's own plane (3DBAG walls drift a few cm from the merged panel plane).
          const ring = p.members![k].rings[0], nm = norm(newell(ring)), den = dot(nm, p.n);
          for (const [u0, u1, v0, v1] of list) {
            // No hood where it would run past the wall's top or side edge (it would hang in the air at a corner or eaves).
            if (v1 + 0.34 > g.eavesM || !fitsPanel(p, rectPoly(u0 - 0.2, u1 + 0.2, v1 + 0.02, v1 + 0.32), 0.05)) continue;
            const at = c.P((u0 + u1) / 2, v1, 0), d = Math.abs(den) > 1e-6 ? dot(nm, sub(ring[0], at)) / den : 0;
            c.box(s.stone, u0 - 0.16, u1 + 0.16, v1 + 0.03, v1 + 0.3, d, d + 0.17, c.part());
            stats.hoods++;
          }
        }
      }
      if (g.entrance?.panel === p.index && info.levels.length > 1) {
        const e = g.entrance, cells = info.cells.filter(x => x.bay === e.bay && x.floor < e.storeys);
        if (cells.length) {
          const u0 = Math.min(...cells.map(x => x.u0)), u1 = Math.max(...cells.map(x => x.u1)), top = info.levels[1];
          // Flat canopy slab on a single round post at the street corner, as in the 2025 panorama; plate on a bracket beside it.
          const v0 = Math.min(top - 0.95, top - 0.6), part = c.part();
          c.box(s.stone, u0 - 0.4, u1 + 0.4, v0, v0 + 0.22, 0, 1.9, part);
          const post = c.part();
          solid(c, s.frame, u1 + 0.15, u1 + 0.4, p.vMin, v0, 1.5, 1.75, post);
          // The post must touch the slab (shares its underside plane) and the ground.
          stats.canopy = true;
          const plate = c.part();
          solid(c, s.frame, u0 - 1.35, u0 - 1.3, v0 + 0.1, v0 + 1.3, 0, 0.35, plate);
          solid(c, s.sign, u0 - 1.65, u0 - 1.35, v0 + 0.55, v0 + 1.25, 0.3, 0.36, plate);
          stats.plate = true;
        }
      }
    },
  };
}

export function compileHoofdbureau(): {built: CompiledLargeBuilding; stats: HoofdbureauStats} {
  const intent = validateLargeIntent(intentJson);
  const stats: HoofdbureauStats = {triangles: 0, hoods: 0, canopy: false, plate: false};
  const built = compileLargeBuilding(intent, FACTS, hoofdbureauHooks(stats));
  return {built, stats};
}

export function buildHoofdbureauElandsgracht(_w: number, _d: number, b: BuildingTools) {
  const {built} = compileHoofdbureau();
  built.group.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    const name = PALETTE[o.userData.materialSlot as string];
    if (!name) throw Error(`hoofdbureau: no palette colour for materialSlot ${o.userData.materialSlot}`);
    // Per-group palette variants (slot names with an @) keep their own colour through the spare palette names red (wall) and gold (frame).
    const variant = o.name.includes('@');
    const colour = variant && name === 'brick' ? 'red' : variant && name === 'frame' ? 'gold' : name;
    const src = o.geometry as T.BufferGeometry, g = src.index ? src.toNonIndexed() : src.clone(), a = g.getAttribute('position');
    // The 3DBAG shell has a sunken ramp below the street (lowest -4.4 m): the landmark ground is y = 0, so drop what lies fully below it and clamp the rest.
    const keep: number[] = [];
    for (let i = 0; i < a.count; i += 3) if (Math.max(a.getY(i), a.getY(i + 1), a.getY(i + 2)) > 0.01) for (let k = 0; k < 3; k++) keep.push(a.getX(i + k), Math.max(0, a.getY(i + k)), a.getZ(i + k));
    if (!keep.length) return;
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.Float32BufferAttribute(keep, 3)); out.computeVertexNormals();
    b.add(out, colour);
  });
}
