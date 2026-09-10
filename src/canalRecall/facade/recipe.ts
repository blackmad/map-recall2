import { buildElevations, normaliseFootprintRing, signedRingArea } from './elevations.ts';
import { dependencyHash } from './registrationGold.ts';
import type { ProjectedPoint } from './sources.ts';
import { RECIPE_MATERIALS } from './recipeMaterials.ts';

export type EvidenceBasis = 'observed' | 'inferred' | 'authored' | 'unknown';
export type EvidenceState = 'proposed' | 'accepted' | 'rejected' | 'stale';
export interface RecipeField<T> {
  value: T;
  basis: EvidenceBasis;
  state: EvidenceState;
  evidence: string[];
  note: string;
}
export const authoredField = <T>(value: T, note: string): RecipeField<T> =>
  ({ value, basis: 'authored', state: 'proposed', evidence: [], note });

export interface RecipePolygon { outer: ProjectedPoint[]; holes: ProjectedPoint[][]; }
export interface RecipeOpening {
  id: string;
  kind: 'window' | 'door';
  /** Metres from the selected elevation's start and the building's ground. */
  leftM: number; bottomM: number; widthM: number; heightM: number;
  appearance?: RecipeField<{
    trimColour: string; glassColour: string;
    /** Fractions inside the opening, horizontal bars measured from its bottom. */
    verticalBars: number[]; horizontalBars: number[]; barWidthM: number;
    barColours?: { vertical: string[]; horizontal: string[] };
  }>;
}
export interface RecipeElevation {
  elevationId: string;
  polygonIndex: number;
  openings: RecipeField<RecipeOpening[]>;
  /** Explicit top outline [distance along wall, height above ground], left to right. */
  parapet: RecipeField<Array<[number, number]>>;
}
export interface RecipeDetailing {
  wallMaterial: 'flat' | 'procedural-brick' | 'ambientcg-Bricks057';
  windowStyle: 'plain' | 'sash-6' | 'sash-8' | 'cross';
  cornice: 'none' | 'simple' | 'moulded';
  gableTrim: boolean;
  brickAppearance?: { mortarColour: string; variation: number };
}
export interface BuildingRecipe {
  schemaVersion: 1;
  buildingId: string;
  label: string;
  aliases: string[];
  identity: { state: 'proposed' | 'matched' | 'ambiguous'; sourceHash: string; note: string };
  footprint: RecipeField<RecipePolygon[]>;
  groundNapM: RecipeField<number>;
  wallTopM: RecipeField<number>;
  elevations: RecipeElevation[];
  palette: RecipeField<{ wall: string; roof: string; trim: string; glass: string; door: string }>;
  detailing: RecipeField<RecipeDetailing>;
  simplifications: string[];
}

export type SurfaceClass = keyof BuildingRecipe['palette']['value'];
export interface CompiledRecipeMesh {
  meshId: string;
  buildingId: string;
  aliases: string[];
  surface: SurfaceClass;
  colour: string;
  positions: number[];
  /** Linear RGB per vertex, allowing distinct opening colours in merged draws. */
  colours: number[];
  /** UV coordinates in metres, independent of the chosen texture's pixel resolution. */
  uvMetres: number[];
  /** One attribution per triangle, retained through merging and picking. */
  triangles: Array<{ elevationId: string | null; openingId: string | null }>;
}
export interface CompiledRecipe {
  schemaVersion: 1;
  compilerVersion: string;
  recipeHash: string;
  meshHash: string;
  buildingId: string;
  aliases: string[];
  /** This compiler does not confer identity or image-registration acceptance. */
  disposition: 'diagnostic-only';
  detailing: RecipeDetailing;
  materialReference: typeof RECIPE_MATERIALS[keyof typeof RECIPE_MATERIALS] | null;
  origin: { x: number; y: number; groundNapM: number; crs: 'EPSG:28992'; verticalDatum: 'NAP' };
  meshes: CompiledRecipeMesh[];
  collision: RecipePolygon[];
  bounds: { min: number[]; max: number[] };
  triangleCount: number;
}

/** Adapter to the existing Three.ShapeUtils triangulator; no second geometry library. */
export type Triangulate = (outer: number[][], holes: number[][][]) => number[][];
export const RECIPE_COMPILER_VERSION = 'facade-recipe/2';
const EPS = 1e-6;
const finitePoint = (p: ProjectedPoint) => Number.isFinite(p.x) && Number.isFinite(p.y);
const cross2 = (a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const onSegment = (a: ProjectedPoint, b: ProjectedPoint, p: ProjectedPoint) =>
  Math.abs(cross2(a, b, p)) < EPS && p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS
  && p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS;
function intersects(a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint, d: ProjectedPoint) {
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)
    || (cross2(a, b, c) * cross2(a, b, d) < 0 && cross2(c, d, a) * cross2(c, d, b) < 0);
}
export function pointInRecipeRing(p: ProjectedPoint, ring: ProjectedPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (onSegment(a, b, p)) return true;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export const recipeContainsPoint = (polygons: RecipePolygon[], point: ProjectedPoint) =>
  polygons.some(p => pointInRecipeRing(point, p.outer) && !p.holes.some(h => pointInRecipeRing(point, h)));

function checkedRing(input: ProjectedPoint[]): ProjectedPoint[] {
  if (!input.every(finitePoint)) throw new Error('Footprint contains a non-finite coordinate');
  const ring = normaliseFootprintRing(input).map(({ x, y }) => ({ x, y }));
  if (ring.length < 3) throw new Error('Footprint ring is degenerate');
  for (let i = 0; i < ring.length; i++) for (let j = i + 1; j < ring.length; j++) {
    if (j === i + 1 || (i === 0 && j === ring.length - 1)) continue;
    if (intersects(ring[i], ring[(i + 1) % ring.length], ring[j], ring[(j + 1) % ring.length]))
      throw new Error('Footprint ring intersects itself');
  }
  return ring;
}
function checkedPolygons(input: RecipePolygon[]): RecipePolygon[] {
  if (!input.length) throw new Error('A recipe needs a footprint');
  const result = input.map(p => ({ outer: checkedRing(p.outer), holes: p.holes.map(checkedRing) }));
  for (const polygon of result) {
    const rings = [polygon.outer, ...polygon.holes];
    for (let i = 1; i < rings.length; i++) {
      if (!pointInRecipeRing(rings[i][0], polygon.outer)) throw new Error('Courtyard lies outside the footprint');
      for (let j = 0; j < i; j++) {
        for (let a = 0; a < rings[i].length; a++) for (let b = 0; b < rings[j].length; b++)
          if (intersects(rings[i][a], rings[i][(a + 1) % rings[i].length], rings[j][b], rings[j][(b + 1) % rings[j].length]))
            throw new Error('Footprint rings intersect');
        if (j > 0 && (pointInRecipeRing(rings[i][0], rings[j]) || pointInRecipeRing(rings[j][0], rings[i])))
          throw new Error('Courtyard rings overlap');
      }
    }
  }
  for (let i = 0; i < result.length; i++) for (let j = 0; j < i; j++) {
    const a = result[i], b = result[j];
    if (a.outer.some(p => recipeContainsPoint([b], p)) || b.outer.some(p => recipeContainsPoint([a], p)))
      throw new Error('Solid footprint parts overlap');
    for (let p = 0; p < a.outer.length; p++) for (let q = 0; q < b.outer.length; q++)
      if (intersects(a.outer[p], a.outer[(p + 1) % a.outer.length], b.outer[q], b.outer[(q + 1) % b.outer.length]))
        throw new Error('Solid footprint parts intersect');
  }
  return result;
}
function usableField<T>(field: RecipeField<T>, name: string): T {
  if (!['observed', 'inferred', 'authored', 'unknown'].includes(field.basis)
    || !['proposed', 'accepted', 'rejected', 'stale'].includes(field.state)) throw new Error(`${name} has an invalid evidence state`);
  if (field.state === 'rejected' || field.state === 'stale' || field.basis === 'unknown')
    throw new Error(`${name} is ${field.basis === 'unknown' ? 'unknown' : field.state}`);
  if (!field.note.trim() || (field.basis === 'observed' && !field.evidence.length))
    throw new Error(`${name} lacks provenance`);
  return field.value;
}

/** Compile explicit fields only. Windows are shallow quads; collision stays the footprint. */
export async function compileRecipe(recipe: BuildingRecipe, triangulate: Triangulate): Promise<CompiledRecipe> {
  if (recipe.schemaVersion !== 1 || !/^(bag:\d{16}|osm:(way|relation):\d+|fixture:[\w-]+)$/.test(recipe.buildingId))
    throw new Error('Invalid recipe identity');
  if (!/^[a-f0-9]{64}$/.test(recipe.identity.sourceHash)) throw new Error('Missing source geometry hash');
  const polygons = checkedPolygons(usableField(recipe.footprint, 'Footprint'));
  const ground = usableField(recipe.groundNapM, 'Ground');
  const top = usableField(recipe.wallTopM, 'Wall top');
  const palette = usableField(recipe.palette, 'Palette');
  const detailing = usableField(recipe.detailing, 'Detailing');
  if (!['flat','procedural-brick','ambientcg-Bricks057'].includes(detailing.wallMaterial)
    || !['plain','sash-6','sash-8','cross'].includes(detailing.windowStyle)
    || !['none','simple','moulded'].includes(detailing.cornice) || typeof detailing.gableTrim !== 'boolean') throw new Error('Unsupported detailing option');
  if (!Number.isFinite(ground) || !Number.isFinite(top) || top <= 0 || top > 150) throw new Error('Invalid metric height');
  if (Object.values(palette).some(c => !/^#[a-f\d]{6}$/i.test(c))) throw new Error('Invalid palette colour');
  if (detailing.brickAppearance && (!/^#[a-f\d]{6}$/i.test(detailing.brickAppearance.mortarColour)
    || !Number.isFinite(detailing.brickAppearance.variation) || detailing.brickAppearance.variation < 0 || detailing.brickAppearance.variation > 0.2))
    throw new Error('Invalid brick appearance');
  const origin = { ...polygons[0].outer[0], groundNapM: ground, crs: 'EPSG:28992' as const, verticalDatum: 'NAP' as const };
  const aliases = [...new Set([recipe.buildingId, ...recipe.aliases])].sort();
  const meshes = new Map<SurfaceClass, CompiledRecipeMesh>();
  const local = (p: ProjectedPoint, z: number) => [p.x - origin.x, p.y - origin.y, z];
  const linearColour = (hex: string) => [1, 3, 5].map(i => {
    const srgb = parseInt(hex.slice(i, i + 2), 16) / 255;
    return srgb <= .04045 ? srgb / 12.92 : ((srgb + .055) / 1.055) ** 2.4;
  });
  const triangle = (surface: SurfaceClass, a: number[], b: number[], c: number[], elevationId: string | null = null, openingId: string | null = null, colour = palette[surface]) => {
    if (!meshes.has(surface)) meshes.set(surface, { meshId: `${recipe.buildingId}/${surface}`, buildingId: recipe.buildingId,
      aliases, surface, colour: palette[surface], positions: [], colours: [], uvMetres: [], triangles: [] });
    const mesh = meshes.get(surface)!;
    const ab = b.map((v, i) => v - a[i]), ac = c.map((v, i) => v - a[i]);
    if (Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]) < 1e-9) return;
    mesh.positions.push(...a, ...b, ...c); mesh.triangles.push({ elevationId, openingId });
    const rgb = linearColour(colour); mesh.colours.push(...rgb, ...rgb, ...rgb);
    const nx = ab[1] * ac[2] - ab[2] * ac[1], ny = ab[2] * ac[0] - ab[0] * ac[2], length = Math.hypot(nx, ny);
    for (const p of [a, b, c]) mesh.uvMetres.push(length > EPS ? (-ny * p[0] + nx * p[1]) / length : p[0], length > EPS ? p[2] : p[1]);
  };
  const quad = (s: SurfaceClass, a: number[], b: number[], c: number[], d: number[], e: string | null = null, o: string | null = null, colour = palette[s]) => {
    triangle(s, a, b, c, e, o, colour); triangle(s, a, c, d, e, o, colour);
  };
  for (const polygon of polygons) {
    for (const [index, ring] of [polygon.outer, ...polygon.holes].entries()) {
      const directed = index === 0 ? ring : [...ring].reverse();
      for (let i = 0; i < directed.length; i++) {
        const a = directed[i], b = directed[(i + 1) % directed.length];
        quad('wall', local(a, 0), local(b, 0), local(b, top), local(a, top));
      }
    }
    const outer = polygon.outer.map(p => [p.x - origin.x, p.y - origin.y]);
    const holes = polygon.holes.map(ring => ring.map(p => [p.x - origin.x, p.y - origin.y]));
    const vertices = [outer, ...holes].flat();
    let area = 0;
    for (const face of triangulate(outer, holes)) {
      if (face.length !== 3 || face.some(i => !Number.isInteger(i) || !vertices[i])) throw new Error('Invalid roof triangulation');
      let [a, b, c] = face.map(i => vertices[i]);
      let cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cross < 0) { [b, c] = [c, b]; cross = -cross; }
      area += cross / 2;
      triangle('roof', [...a, top], [...b, top], [...c, top]);
      triangle('wall', [...c, 0], [...b, 0], [...a, 0]);
    }
    const expected = Math.abs(signedRingArea(polygon.outer)) - polygon.holes.reduce((a, h) => a + Math.abs(signedRingArea(h)), 0);
    if (Math.abs(area - expected) > Math.max(0.001, expected * 1e-6)) throw new Error('Roof triangulation lost footprint area or filled a courtyard');
  }
  const ids = new Set<string>(), openingIds = new Set<string>();
  for (const elevation of recipe.elevations) {
    if (ids.has(elevation.elevationId)) throw new Error('Duplicate elevation');
    ids.add(elevation.elevationId);
    const polygon = polygons[elevation.polygonIndex];
    const wall = polygon && buildElevations(polygon.outer, { pandId: recipe.buildingId.replace(/^bag:/, '') })
      .find(e => e.elevationId === elevation.elevationId);
    if (!wall) throw new Error('Selected elevation does not exist in this footprint');
    const point = (x: number, z: number, depth = 0.025) => local({
      x: wall.start.x + (wall.end.x - wall.start.x) * x / wall.lengthM + wall.normal.x * depth,
      y: wall.start.y + (wall.end.y - wall.start.y) * x / wall.lengthM + wall.normal.y * depth,
    }, z);
    const rectangle = (s: SurfaceClass, x: number, z: number, width: number, height: number, depth: number, id: string, colour = palette[s]) =>
      quad(s, point(x, z, depth), point(x + width, z, depth), point(x + width, z + height, depth), point(x, z + height, depth), wall.elevationId, id, colour);
    const openings = usableField(elevation.openings, 'Openings');
    for (const [index, opening] of openings.entries()) {
      const { id, leftM: x, bottomM: z, widthM: w, heightM: h } = opening;
      if (opening.kind !== 'window' && opening.kind !== 'door') throw new Error('Unsupported opening kind');
      if (!id.trim() || openingIds.has(id)) throw new Error('Duplicate or empty opening ID');
      openingIds.add(id);
      if (![x, z, w, h].every(Number.isFinite) || w <= 0.16 || h <= 0.16 || x < 0 || z < 0 || x + w > wall.lengthM + EPS || z + h > top + EPS)
        throw new Error(`Opening ${id} escapes its wall or has invalid dimensions`);
      if (openings.slice(0, index).some(p => x < p.leftM + p.widthM && x + w > p.leftM && z < p.bottomM + p.heightM && z + h > p.bottomM))
        throw new Error(`Opening ${id} overlaps another opening`);
      const appearance = opening.appearance ? usableField(opening.appearance, `Opening ${id} appearance`) : null;
      if (appearance && (![appearance.trimColour, appearance.glassColour].every(c => /^#[a-f\d]{6}$/i.test(c))
        || ![appearance.verticalBars, appearance.horizontalBars].every(a => Array.isArray(a) && a.length <= 8 && a.every((v, i) => Number.isFinite(v) && v > 0.1 && v < 0.9 && (i === 0 || v - a[i - 1] > 0.05)))
        || !Number.isFinite(appearance.barWidthM) || appearance.barWidthM < .01 || appearance.barWidthM > .1))
        throw new Error(`Invalid opening ${id} appearance`);
      if (appearance?.barColours && (appearance.barColours.vertical.length !== appearance.verticalBars.length
        || appearance.barColours.horizontal.length !== appearance.horizontalBars.length
        || ![...appearance.barColours.vertical, ...appearance.barColours.horizontal].every(c => /^#[a-f\d]{6}$/i.test(c))))
        throw new Error(`Invalid opening ${id} bar colours`);
      const trim = appearance?.trimColour ?? palette.trim;
      rectangle('trim', x, z, w, h, 0.025, id, trim);
      rectangle(opening.kind === 'door' ? 'door' : 'glass', x + 0.07, z + 0.07, w - 0.14, h - 0.14, 0.04, id,
        appearance?.glassColour ?? palette[opening.kind === 'door' ? 'door' : 'glass']);
      if (appearance) {
        const bar = Math.min(appearance.barWidthM, w * .07, h * .07);
        for (const [i,f] of appearance.verticalBars.entries()) rectangle('trim', x + w * f - bar / 2, z + .07, bar, h - .14, .055, id, appearance.barColours?.vertical[i] ?? trim);
        for (const [i,f] of appearance.horizontalBars.entries()) rectangle('trim', x + .07, z + h * f - bar / 2, w - .14, bar, .055, id, appearance.barColours?.horizontal[i] ?? trim);
      } else if (opening.kind === 'window' && detailing.windowStyle !== 'plain') {
        const bar = detailing.windowStyle === 'cross' ? 0.08 : 0.045;
        const rails = detailing.windowStyle === 'cross' ? [0.64] : detailing.windowStyle === 'sash-6' ? [1/3, 2/3] : [0.25, 0.5, 0.75];
        rectangle('trim', x + w / 2 - bar / 2, z + 0.07, bar, h - 0.14, 0.055, id);
        for (const fraction of rails) rectangle('trim', x + 0.07, z + h * fraction - bar / 2, w - 0.14, bar, 0.055, id);
      }
    }
    if (detailing.cornice !== 'none') {
      const bands = detailing.cornice === 'moulded' ? [[top-0.42,0.12,0.10],[top-0.30,0.12,0.18],[top-0.18,0.18,0.30]] : [[top-0.2,0.2,0.18]];
      for (const [z,h,depth] of bands) {
        quad('trim',point(0,z,depth),point(wall.lengthM,z,depth),point(wall.lengthM,z+h,depth),point(0,z+h,depth),wall.elevationId);
        quad('trim',point(0,z+h,depth),point(wall.lengthM,z+h,depth),point(wall.lengthM,z+h,0),point(0,z+h,0),wall.elevationId);
        quad('trim',point(0,z,0),point(wall.lengthM,z,0),point(wall.lengthM,z,depth),point(0,z,depth),wall.elevationId);
        quad('trim',point(0,z,0),point(0,z,depth),point(0,z+h,depth),point(0,z+h,0),wall.elevationId);
        quad('trim',point(wall.lengthM,z,depth),point(wall.lengthM,z,0),point(wall.lengthM,z+h,0),point(wall.lengthM,z+h,depth),wall.elevationId);
      }
    }
    const profile = usableField(elevation.parapet, 'Parapet');
    if (profile.length) {
      if (profile.length < 3 || Math.abs(profile[0][0]) > EPS || Math.abs(profile.at(-1)![0] - wall.lengthM) > EPS
        || Math.abs(profile[0][1] - top) > EPS || Math.abs(profile.at(-1)![1] - top) > EPS
        || profile.some(([x, z], i) => !Number.isFinite(x) || !Number.isFinite(z) || z < top || z > top + 12 || (i > 0 && x < profile[i - 1][0])))
        throw new Error('Parapet profile must span the selected wall and remain above its wall top');
      const outline = [[0, top], [wall.lengthM, top], ...[...profile].reverse()];
      // Remove adjacent duplicates before triangulation, retaining original profile for cap edges.
      const shape = outline.filter((p, i) => i === 0 || p[0] !== outline[i - 1][0] || p[1] !== outline[i - 1][1]);
      if (shape.length > 1 && shape[0][0] === shape.at(-1)![0] && shape[0][1] === shape.at(-1)![1]) shape.pop();
      for (const face of triangulate(shape, [])) {
        const [a, b, c] = face.map(i => shape[i]);
        triangle('wall', point(...a as [number, number]), point(...b as [number, number]), point(...c as [number, number]), wall.elevationId);
        triangle('wall', point(c[0], c[1], -0.18), point(b[0], b[1], -0.18), point(a[0], a[1], -0.18), wall.elevationId);
      }
      for (let i = 0; i < profile.length - 1; i++) {
        const a = profile[i], b = profile[i + 1];
        quad(detailing.gableTrim ? 'trim' : 'wall', point(a[0], a[1]), point(b[0], b[1]), point(b[0], b[1], -0.18), point(a[0], a[1], -0.18), wall.elevationId);
        if (detailing.gableTrim && b[0] > a[0]) quad('trim',point(a[0],a[1],0.055),point(b[0],b[1],0.055),point(b[0],Math.max(top,b[1]-0.13),0.055),point(a[0],Math.max(top,a[1]-0.13),0.055),wall.elevationId);
      }
    }
  }
  const output = [...meshes.values()].sort((a, b) => a.meshId.localeCompare(b.meshId));
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const mesh of output) mesh.positions.forEach((v, i) => { bounds.min[i % 3] = Math.min(bounds.min[i % 3], v); bounds.max[i % 3] = Math.max(bounds.max[i % 3], v); });
  const content = { schemaVersion: 1 as const, compilerVersion: RECIPE_COMPILER_VERSION, recipeHash: await dependencyHash(recipe),
    buildingId: recipe.buildingId, aliases, disposition: 'diagnostic-only' as const, detailing,
    materialReference: detailing.wallMaterial === 'flat' ? null : RECIPE_MATERIALS[detailing.wallMaterial],
    origin, meshes: output, collision: polygons, bounds,
    triangleCount: output.reduce((n, mesh) => n + mesh.triangles.length, 0) };
  if (content.triangleCount > 1500) throw new Error('Ordinary recipe exceeds the 1,500 triangle budget');
  return { ...content, meshHash: await dependencyHash(content) };
}
