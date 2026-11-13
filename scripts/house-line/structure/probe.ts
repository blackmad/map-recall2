/**
 * Lane PR1 (structure priors): what the generic path draws for a pand, in Node, through the game's own chunk builder.
 *
 * The same chunk house:preview builds (the pand's tile within ROW_M of it, neighbours from the adjacent tiles as
 * context; scripts/house-preview/preview.ts renderGeneric), with threeBuildingMesh's layoutProbe on: the drawn storeys
 * (ground included), window columns of the longest ground-level street run, and that run's length and exposed height.
 * Also the inputs a structure prior conditions on (year, style, buurt) and the crown the roof planner draws.
 * No raster, no atlas: about 0.1-0.4 s a pand once its tiles are warm.
 */
import '../../world/useBrowserMath.ts';
import fs from 'node:fs';
import path from 'node:path';
import { PreviewSession, coverOf, ROW_M } from '../../house-preview/preview.ts';
import { EXTRACT, type Feature, type Row } from '../../world/pipeline.ts';
import { shellProfiles, shellStreets } from '../../world/shellBake.ts';
import { buildFeatureChunk, asPolygons } from '../../../src/canalRecall/threeBuildingFeatures.ts';
import { layoutProbe, type LayoutProbeRun } from '../../../src/canalRecall/threeBuildingMesh.ts';
import { BuildingContextIndex } from '../../../src/canalRecall/buildingContextIndex.ts';
import { KIT_HIDE_IDS } from '../../../src/canalRecall/landmarkKits.ts';
import { roofPlanForFeature } from '../../../src/canalRecall/roofMesh.ts';
import { REPO_ROOT } from '../../house-preview/nodeDom.ts';

export const bare = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
const full = (id: string) => `NL.IMBAG.Pand.${bare(id)}`;
const tileOfLngLat = (lng: number, lat: number) => {
  const n = 2 ** 14, rad = lat * Math.PI / 180;
  return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)] as const;
};
const boxOf = (f: Feature): [number, number, number, number] => {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of asPolygons(f.geometry).flat(2)) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  return b;
};

// --- Buurt (coverage-v1 buurten) -----------------------------------------------------------------------------------
type Ring = number[][];
let buurten: { code: string; gebied: string; rings: Ring[][]; box: number[] }[] | null = null;
const insideRing = (p: readonly number[], r: Ring) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
};
export function buurtAt(p: readonly [number, number]): { code: string; gebied: string } | null {
  if (!buurten) {
    const fc = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'coverage-v1/buurten.json'), 'utf8'));
    buurten = (fc.features as any[]).map(f => {
      const polys: Ring[][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      const pts = polys.flatMap(q => q[0]);
      return { code: String(f.properties.code ?? f.properties.naam), gebied: String(f.properties.gebied ?? ''), rings: polys, box: [Math.min(...pts.map(q => q[0])), Math.min(...pts.map(q => q[1])), Math.max(...pts.map(q => q[0])), Math.max(...pts.map(q => q[1]))] };
    });
  }
  for (const b of buurten) {
    if (p[0] < b.box[0] || p[0] > b.box[2] || p[1] < b.box[1] || p[1] > b.box[3]) continue;
    if (b.rings.some(poly => insideRing(p, poly[0]) && !poly.slice(1).some(h => insideRing(p, h)))) return { code: b.code, gebied: b.gebied };
  }
  return null;
}

// --- The crown the roof planner draws, in the benchmark's crown vocabulary (labels.md) -------------------------------
/** The benchmark crown classes (labels.md `crown`). */
export type CrownClass = 'step' | 'neck' | 'bell' | 'spout' | 'point' | 'cornice' | 'flat' | 'mansard' | 'pitched-eaves' | 'other';
/** Coarse families: a raised gable on the street, a horizontal top (cornice or parapet), a roof slope seen from the street. */
export type CrownFamily = 'gable' | 'horizontal' | 'roof';
export const crownFamily = (c: string | null | undefined): CrownFamily | null =>
  c === 'step' || c === 'neck' || c === 'bell' || c === 'spout' || c === 'point' ? 'gable'
    : c === 'cornice' || c === 'flat' ? 'horizontal' : c === 'mansard' || c === 'pitched-eaves' ? 'roof' : null;
/** A roof plan as the street sees it. A gable plan's shape names the crown; the planner turns a pre-1940 saddle's ridge
 *  across a street front (`streetRidge`) so its end gable faces the street; other pitched kinds show their slope. */
export function drawnCrown(plan: ReturnType<typeof roofPlanForFeature>): CrownClass {
  if (!plan || plan.kind === 'parapet') return plan?.kind === 'parapet' ? 'flat' : 'flat';
  if (plan.kind === 'gable') {
    const g = plan.gable;
    return g === 'step' || g === 'neck' || g === 'bell' || g === 'spout' ? g : g === 'raisedNeck' ? 'neck' : g === 'clock' ? 'bell' : g === 'cornice' ? 'cornice' : 'point';
  }
  if (plan.kind === 'mansard' || plan.kind === 'mansardHip') return 'mansard';
  if (plan.kind === 'pitched' && plan.streetRidge) return 'point';
  return 'pitched-eaves';
}

// --- The probe ------------------------------------------------------------------------------------------------------
export type ProbeRecord = {
  pandId: string; tile: string; route: 'generic' | 'installed' | 'not-drawn';
  year: number | null; heightM: number | null; style: string | null; archetype: string | null; buurt: string | null; gebied: string | null;
  at: [number, number] | null;
  /** Outer ring of the footprint (lng/lat), for the party-wall test. */
  ring?: number[][];
  /** The longest ground-level street run as laid out; null when the pand has none (back wall only, or a bare wall). */
  drawn: { storeys: number; columns: number; storeyM: number; groundM: number; runM: number; exposedM: number; axes: number; recipe: boolean; fit: string | null } | null;
  crown: CrownClass | null; roofKind: string | null; monumentGable: string | null;
  /** The decorated spec'd storeys/bays the generic path got from a HouseSpec (specRecipe), if any. */
  spec: { storeys?: number; bays?: number } | null;
};

export class StructureProbe {
  readonly session = new PreviewSession('photo');
  private profiles = shellProfiles(REPO_ROOT);

  async rowsAround(pandId: string): Promise<{ raw: Row | undefined; rows: Row[]; all: Row[]; tile: string }> {
    const tile = this.session.tileOf(pandId);
    const rows = await this.session.rows(tile);
    const raw = rows.find(r => r.raw.properties.id === full(pandId));
    const all: Row[] = [];
    if (raw) {
      const box = boxOf(raw.raw), padLng = 60 / (111_320 * Math.cos(52.37 * Math.PI / 180)), padLat = 60 / 110_540;
      const tiles = new Set<string>([tile]);
      for (const [lng, lat] of [[box[0] - padLng, box[1] - padLat], [box[2] + padLng, box[1] - padLat], [box[0] - padLng, box[3] + padLat], [box[2] + padLng, box[3] + padLat]]) tiles.add(tileOfLngLat(lng, lat).join('/'));
      for (const tl of tiles) all.push(...await this.session.rows(tl));
    }
    return { raw, rows, all, tile };
  }

  /** Probe one pand. `decorate` replaces the styled feature of the own pand (e.g. a prior applied in Node). */
  async probe(pandId: string): Promise<ProbeRecord> {
    const id = bare(pandId);
    const cover = coverOf(id);
    let tile = '';
    try { tile = this.session.tileOf(id); } catch { /* not in a tile */ }
    const base: ProbeRecord = { pandId: id, tile, route: cover && cover.kind !== 'landmark' ? 'installed' : 'generic', year: null, heightM: null, style: null, archetype: null, buurt: null, gebied: null, at: null, drawn: null, crown: null, roofKind: null, monumentGable: null, spec: null };
    if (!tile) return { ...base, route: 'not-drawn' };
    const { raw, rows, all } = await this.rowsAround(id);
    if (!raw) return { ...base, route: 'not-drawn' };
    const own = raw.styled, p = own.properties as Record<string, unknown>;
    const ring = asPolygons(own.geometry)[0]?.[0] ?? [];
    const at: [number, number] | null = ring.length ? [ring.reduce((s, q) => s + q[0], 0) / ring.length, ring.reduce((s, q) => s + q[1], 0) / ring.length] : null;
    const b = at ? buurtAt(at) : null;
    const kitHide = new Set(KIT_HIDE_IDS);
    const styled = all.map(r => r.styled);
    const ctx = new BuildingContextIndex(styled, boxOf);
    const ownBox = boxOf(own), rowLng = ROW_M / (111_320 * Math.cos(52.37 * Math.PI / 180)), rowLat = ROW_M / 110_540;
    const nearOwn = (f: Feature) => { const q = boxOf(f); return q[0] <= ownBox[2] + rowLng && q[2] >= ownBox[0] - rowLng && q[1] <= ownBox[3] + rowLat && q[3] >= ownBox[1] - rowLat; };
    const features = rows.map(r => r.styled).filter(f => !kitHide.has(String(f.properties.id)) && nearOwn(f));
    const inChunk = new Set(features);
    const context = ctx.neighbors(features, f => inChunk.has(f) || kitHide.has(String(f.properties.id)));
    const streets = shellStreets(REPO_ROOT, features as never);
    const runs: LayoutProbeRun[] = [];
    layoutProbe.sink = (bid, r) => { if (bid === own.properties.id) runs.push(r); };
    try { buildFeatureChunk(features as never, 'photo', 'walls', streets, this.profiles, context as never, [], new Map(), {}); } finally { layoutProbe.sink = undefined; }
    const run = runs.filter(r => r.street && r.base < 0.5).sort((x, y) => y.lengthM - x.lengthM)[0];
    let plan: ReturnType<typeof roofPlanForFeature> = null;
    try { plan = roofPlanForFeature(own as never); } catch { plan = null; }
    const sr = p.specRecipe as { storeys?: number; bays?: number } | undefined;
    const year = p.constructionYear === null || p.constructionYear === undefined || !Number.isFinite(Number(p.constructionYear)) ? null : Number(p.constructionYear);
    return {
      ...base, year, heightM: Number(p.height) || null, style: run?.style ?? (typeof p.facadeStyle === 'string' ? p.facadeStyle : null), archetype: typeof p.facadeStyle === 'string' ? p.facadeStyle : null,
      buurt: b?.code ?? null, gebied: b?.gebied ?? null, at, ring: ring.map(q => [+q[0].toFixed(7), +q[1].toFixed(7)]),
      drawn: run ? { storeys: run.storeys + 1, columns: run.bays, storeyM: +run.storeyM.toFixed(2), groundM: +run.groundM.toFixed(2), runM: +run.lengthM.toFixed(2), exposedM: +(run.exposedM ?? run.groundM + run.storeys * run.storeyM).toFixed(2), axes: run.axes ?? 1, recipe: !!run.recipe, fit: run.fit ?? null } : null,
      crown: drawnCrown(plan), roofKind: plan?.kind ?? null, monumentGable: typeof p.monumentGable === 'string' ? p.monumentGable : null,
      spec: sr ? { ...(sr.storeys ? { storeys: sr.storeys } : {}), ...(sr.bays ? { bays: sr.bays } : {}) } : null,
    };
  }
}
