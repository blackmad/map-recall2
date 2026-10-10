/**
 * Intent + facts → compiled Three group, through the canalhouse library.
 * Adds two roof passes the library does not do itself:
 *  - roof planes keep their exact 3DBAG geometry but are coloured by slope
 *    class (steep / low / flat) instead of one uniform mass;
 *  - roof-closure walls on a crowned frontage are split at the crown outline:
 *    below it stays masonry, above it becomes a dark roof verge, so a neck or
 *    bell gable keeps its silhouette in front of a side-sloped roof.
 */
import * as T from 'three';
import {compileCanalHouseRecipe, type CanalHouseRecipe} from '../canalhouseRecipes.ts';
import type {BuildingFacts} from './facts.ts';
import {fitIntent, ROOF_COLOURS, type FitReport} from './fit.ts';
import {addLettering} from './signage.ts';
import {swatch, validateIntent, type CanalHouseIntent} from './intent.ts';

/** `{sameAs, overrides}` recipes: deep-merge onto the named neighbour; fronts merge by index. */
export function resolveIntent(raw: any, load: (id: string) => any, depth = 0): CanalHouseIntent {
  if (!raw?.sameAs) return validateIntent(raw);
  if (depth > 4) throw Error(`sameAs chain too deep at ${raw.id}`);
  const base = resolveIntent(load(raw.sameAs), load, depth + 1);
  const merge = (a: any, b: any): any => {
    if (Array.isArray(a) && Array.isArray(b)) return b.length && typeof b[0] === 'object' && !Array.isArray(b[0]) ? a.map((x, i) => i < b.length ? merge(x, b[i]) : x).concat(b.slice(a.length)) : b;
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(b)) { const out = {...a}; for (const [k, v] of Object.entries(b)) out[k] = k in a ? merge(a[k], v) : v; return out; }
    return b === undefined ? a : b;
  };
  const {sameAs, overrides = {}, ...own} = raw;
  // Identity and sources always come from the house itself, never the neighbour.
  return validateIntent({...merge(base, overrides), ...own, sameAs: undefined, derivedFrom: undefined, notes: [...(own.notes ?? []), `sameAs ${sameAs}`]});
}

/** Canonical, identity-free intent key: equal keys mean the same component choices. */
export function canonicalIntentKey(intent: CanalHouseIntent): string {
  const {id, pandId, address, sources, notes, ...design} = intent as any;
  const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
    : v && typeof v === 'object' ? `{${Object.keys(v).filter(k => (v as any)[k] !== undefined && k !== 'id').sort().map(k => `${JSON.stringify(k)}:${canonical((v as any)[k])}`).join(',')}}`
    : typeof v === 'number' ? String(Math.round(v * 100) / 100) : JSON.stringify(v);
  return canonical(design);
}

function slopeClass(normal: T.Vector3): 'steep' | 'low' | 'flat' {
  const deg = Math.acos(Math.min(1, Math.abs(normal.y))) * 180 / Math.PI;
  return deg > 30 ? 'steep' : deg > 8 ? 'low' : 'flat';
}

/** Recolour every roof mesh by its slope class. */
export function dressRoofs(group: T.Group, material: CanalHouseIntent['roof']['material']) {
  const colours = ROOF_COLOURS[material], cache = new Map<string, T.MeshStandardMaterial>();
  const counts = {steep: 0, low: 0, flat: 0};
  group.traverse(o => {
    if (!(o instanceof T.Mesh) || o.userData.surface !== 'roof' || !o.name.startsWith('roof/') || o.name.startsWith('roof/step-wall')) return;
    const g = o.geometry as T.BufferGeometry, p = g.getAttribute('position'), idx = g.index;
    const at = (k: number) => new T.Vector3().fromBufferAttribute(p, idx ? idx.getX(k) : k);
    const normal = new T.Vector3().crossVectors(at(1).sub(at(0)), at(2).sub(at(0))).normalize();
    const cls = slopeClass(normal); counts[cls]++;
    const colour = colours[cls];
    if (!cache.has(colour)) cache.set(colour, new T.MeshStandardMaterial({color: colour, roughness: 1}));
    o.material = cache.get(colour)!;
  });
  return counts;
}

type P2 = [number, number];
/** Clip a convex polygon to the half-plane where f(p) >= 0, f linear. */
function clipHalf(poly: P2[], f: (p: P2) => number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
  }
  return out;
}

/** Split crowned-front roof closures at the crown profile. Returns triangles moved to the verge. */
export function crownVerges(group: T.Group, recipe: CanalHouseRecipe, material: CanalHouseIntent['roof']['material']): number {
  group.updateMatrixWorld(true);
  const verge = new T.MeshStandardMaterial({color: ROOF_COLOURS[material].low, roughness: 1});
  let moved = 0;
  for (const e of recipe.elevations) {
    const facade = group.getObjectByName(`elevation/${e.id}`); if (!facade) continue;
    // Cornice/flat fronts: everything above the cornice top is roof seen behind it.
    const bodyTop = (e.cornice?.value ? e.cornice.value.bottomM + e.cornice.value.heightM : (e.bodyEavesM?.value ?? recipe.house.eavesHeightM.value)) + 0.05;
    const length = (() => { const ring = recipe.footprint.value[e.polygonIndex].outer, a = ring[e.edgeIndex], b = ring[e.endEdgeIndex ?? (e.edgeIndex + 1) % ring.length]; return Math.hypot(b[0] - a[0], b[1] - a[1]); })();
    const crown = e.crown?.value ?? {profile: [[0, bodyTop], [length, bodyTop]] as [number, number][]};
    const m = facade.matrixWorld.elements, u = new T.Vector3(m[0], m[1], m[2]).normalize(), nrm = new T.Vector3(m[8], m[9], m[10]).normalize(), origin = new T.Vector3(m[12], m[13], m[14]);
    const profile = crown.profile;
    const crownAt = (x: number) => { // highest crown height at x (vertical steps take the upper value)
      let h = -Infinity;
      for (let i = 0; i + 1 < profile.length; i++) { const [x0, y0] = profile[i], [x1, y1] = profile[i + 1]; if (x < x0 - 1e-6 || x > x1 + 1e-6) continue; h = Math.max(h, x1 - x0 < 1e-9 ? Math.max(y0, y1) : y0 + (y1 - y0) * (x - x0) / (x1 - x0)); }
      return h;
    };
    const breaks = [...new Set(profile.map(p => p[0]))].sort((a, b) => a - b);
    const closures: T.Mesh[] = [];
    group.traverse(o => { if (o instanceof T.Mesh && o.name.startsWith('shell/roof-closure-')) closures.push(o); });
    for (const mesh of closures) {
      const g = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry) as T.BufferGeometry, p = g.getAttribute('position');
      const pts = Array.from({length: p.count}, (_, i) => new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld));
      // Only closures lying in this facade's plane.
      if (!pts.every(v => Math.abs(v.clone().sub(origin).dot(nrm)) < 0.25)) continue;
      const below: number[] = [], above: number[] = [];
      for (let t = 0; t < pts.length; t += 3) {
        const tri = pts.slice(t, t + 3);
        const local: P2[] = tri.map(v => [v.clone().sub(origin).dot(u), v.y]);
        const det = (local[1][0] - local[0][0]) * (local[2][1] - local[0][1]) - (local[2][0] - local[0][0]) * (local[1][1] - local[0][1]);
        // Jog closures seen edge-on stay masonry.
        if (Math.abs(det) < 1e-6) { for (const v of tri) below.push(v.x, v.y, v.z); continue; }
        // Barycentric map back onto the original triangle keeps jogged closures exact.
        const toWorld = ([x, y]: P2) => {
          const l1 = ((x - local[0][0]) * (local[2][1] - local[0][1]) - (local[2][0] - local[0][0]) * (y - local[0][1])) / det;
          const l2 = ((local[1][0] - local[0][0]) * (y - local[0][1]) - (x - local[0][0]) * (local[1][1] - local[0][1])) / det;
          return tri[0].clone().multiplyScalar(1 - l1 - l2).addScaledVector(tri[1], l1).addScaledVector(tri[2], l2);
        };
        const minX = Math.min(...local.map(q => q[0])), maxX = Math.max(...local.map(q => q[0]));
        const cuts = [minX, ...breaks.filter(b => b > minX && b < maxX), maxX];
        for (let k = 0; k + 1 < cuts.length; k++) {
          const x0 = cuts[k], x1 = cuts[k + 1]; if (x1 - x0 < 1e-6) continue;
          let slab = clipHalf(local, q => q[0] - x0); slab = clipHalf(slab, q => x1 - q[0]);
          if (slab.length < 3) continue;
          // Within a slab the crown is linear between its end heights.
          const xm0 = x0 + 1e-6, xm1 = x1 - 1e-6, y0 = crownAt(xm0), y1 = crownAt(xm1);
          // Outside this front's span the crown is unknown: keep masonry.
          const line = (q: P2) => (Number.isFinite(y0) && Number.isFinite(y1) ? y0 + (y1 - y0) * (q[0] - xm0) / (xm1 - xm0) : Infinity) - q[1];
          for (const [part, sink] of [[clipHalf(slab, line), below], [clipHalf(slab, q => -line(q)), above]] as const) {
            for (let i = 1; i + 1 < part.length; i++) for (const q of [part[0], part[i], part[i + 1]]) { const w = toWorld(q); sink.push(w.x, w.y, w.z); }
          }
        }
      }
      if (!above.length) continue;
      const make = (values: number[]) => { const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(values, 3)); geo.computeVertexNormals(); return geo; };
      // Re-parent into world coordinates (closures live directly under the root group).
      mesh.geometry = make(below); mesh.matrix.identity(); mesh.position.set(0, 0, 0);
      const v = new T.Mesh(make(above), verge); v.name = mesh.name.replace('shell/roof-closure', 'roof/verge'); v.userData = {...mesh.userData, component: 'roof', surface: 'roof'};
      group.add(v); moved += above.length / 9;
    }
  }
  return moved;
}

/**
 * Frontages with shallow native jogs: the library mounts facade details on the
 * outermost plane, which leaves them floating over recessed segments. Fill the
 * plan sliver between the native frontage polyline and that plane with masonry
 * up to the body eaves, so every detail is backed (the jog is flattened, ≤ 0.5 m).
 */
export function backJogs(group: T.Group, recipe: CanalHouseRecipe, fit: FitReport): number {
  let filled = 0;
  const shell = group.getObjectByName('shell/0') as T.Mesh | undefined;
  for (const f of fit.fronts) {
    if (f.frontageDeviationM <= 0.03) continue;
    const ring = recipe.footprint.value[f.polygonIndex].outer, n = ring.length, [i0, i1] = f.edge;
    const a = ring[i0], b = ring[i1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    const sign = ring.reduce((s, p, i) => { const q = ring[(i + 1) % n]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) > 0 ? 1 : -1, nx = sign * uz, nz = -sign * ux;
    const chain: [number, number][] = [];
    for (let i = i0; ; i = (i + 1) % n) { chain.push(ring[i]); if (i === i1) break; }
    const out = Math.max(0, f.frontageOutsetM) + 0.001;
    const plane = chain.map(p => { const along = (p[0] - a[0]) * ux + (p[1] - a[1]) * uz; return [a[0] + ux * along + nx * out, a[1] + uz * along + nz * out] as [number, number]; });
    const poly = [...chain, ...plane.reverse()].map(p => new T.Vector2(p[0], p[1]));
    const top = recipe.elevations.find(e => e.id === f.id)?.bodyEavesM?.value ?? f.eavesM;
    const values: number[] = [];
    const push = (...pts: number[][]) => pts.forEach(p => values.push(p[0], p[1], p[2]));
    for (const [x, y, z] of T.ShapeUtils.triangulateShape(poly, [])) push([poly[x].x, top, poly[x].y], [poly[y].x, top, poly[y].y], [poly[z].x, top, poly[z].y]);
    for (let k = 0; k < poly.length; k++) { const p = poly[k], q = poly[(k + 1) % poly.length]; push([p.x, 0, p.y], [q.x, 0, q.y], [q.x, top, q.y], [p.x, 0, p.y], [q.x, top, q.y], [p.x, top, p.y]); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(values, 3)); g.computeVertexNormals();
    const mesh = new T.Mesh(g, (shell?.material as T.Material) ?? new T.MeshStandardMaterial({color: recipe.palette.value.wall}));
    mesh.name = `shell/jog-backing-${f.id}`; mesh.userData = {component: 'shell', surface: 'wall', pandId: recipe.house.pandId};
    group.add(mesh); filled++;
  }
  return filled;
}

/** `facts` are the facts the fit used: the 3DBAG roof after roofCleanup.ts (gates compare against these). */
export interface CompiledBuilding { group: T.Group; recipe: CanalHouseRecipe; anchorRD: [number, number]; fit: FitReport; roofClasses: {steep: number; low: number; flat: number}; vergeTriangles: number; facts: BuildingFacts }

export function compileBuilding(intent: CanalHouseIntent, facts: BuildingFacts): CompiledBuilding {
  const {recipe, anchorRD, report, facts: fitted} = fitIntent(intent, facts);
  const built = compileCanalHouseRecipe(recipe);
  backJogs(built.group, recipe, report);
  const vergeTriangles = crownVerges(built.group, recipe, intent.roof.material);
  const roofClasses = dressRoofs(built.group, intent.roof.material);
  dressShopfronts(built.group, intent, report);
  return {group: built.group, recipe, anchorRD, fit: report, roofClasses, vergeTriangles, facts: fitted};
}

/**
 * Shop details the library has one paint for: the fascia takes the sign background, the stall riser its own
 * colour, and the business name becomes real lettering on the fascia.
 */
export function dressShopfronts(group: T.Group, intent: CanalHouseIntent, fit: FitReport): number {
  let lettering = 0;
  const paint = (name: RegExp, colour: string, under: T.Object3D) => under.traverse(o => {
    if (o instanceof T.Mesh && name.test(o.name)) { o.material = new T.MeshStandardMaterial({color: colour, roughness: 0.9}); }
  });
  for (const f of fit.fronts) {
    const front = intent.fronts.find(x => x.id === f.id), sf = front?.shopfront, elevation = group.getObjectByName(`elevation/${f.id}`);
    if (!sf || !elevation) continue;
    const fasciaPaint = sf.fasciaColour ?? sf.sign?.background;
    if (fasciaPaint) paint(/bands\/fascia\/piece-\d+$/, swatch(fasciaPaint), elevation);
    if (sf.residentialDoor?.colour) paint(/opening\/(\S*-)?door\/pane$/, swatch(sf.residentialDoor.colour), elevation);
    if (sf.stallriserColour) paint(/bands\/shop-riser\/piece-\d+$/, swatch(sf.stallriserColour), elevation);
    if (f.fascia && sf.sign) lettering += addLettering(elevation, f.fascia, swatch(sf.sign.textColour), intent.pandId);
  }
  return lettering;
}
