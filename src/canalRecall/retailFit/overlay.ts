// The tenant overlay of one placed model (lane retail-fit-20261120): find the model's ground openings on its glass,
// give each its tenant (fits.ts), draw the tenant's layers inside it (geometry.ts). Adapters: three.ts (the game's
// landmark layer), nodeFrame/scene.ts (house:frames without a browser).
import { drawLayers, FitBuilder } from './geometry.js';
import { fitsForModel, modelsFor, STAGED_MODELS } from './fits.js';
import { glassOpenings, type GlassSoup } from './openings.js';
import type { FitMesh, HostOpening } from './types.js';

/** Hard cap per model (triangles): a tenant overlay is a few hundred per opening. */
export const FIT_MAX_TRIANGLES = 20000;

export type FitPlaced = { opening: string; tenant: string; source: string; triangles: number };
/** `pandRanges`: [pand, first triangle, count] for fits in a street chunk's pands (the chunk's own lift reads them). */
export type FitResult = { mesh: FitMesh; openings: HostOpening[]; placed: FitPlaced[]; pandRanges: [number, number, number][] };

/** Openings staged for `model` (stage-openings.ts); null = find them on its glass. */
export const storedOpenings = (model: string) => STAGED_MODELS[model]?.openings ?? null;

/** Does `model` draw a fit in the current mode (`?retailFit=`)? */
export const hasRetailFit = (model: string) => modelsFor().has(model);

/** Mean-radius Mercator metres east/south of `anchor` (a surveyed model's own frame: x east, z south). */
export function surveyedNative(anchor: readonly [number, number]): (lng: number, lat: number) => [number, number] {
  const R = 6371008.8, k = Math.PI / 180;
  return (lng, lat) => [(lng - anchor[0]) * k * R * Math.cos(anchor[1] * k), -(lat - anchor[1]) * k * R];
}

export function retailFitMesh(model: string, glass: readonly GlassSoup[] | null, centre: [number, number], toNative: (lng: number, lat: number) => [number, number]): FitResult | null {
  if (!hasRetailFit(model)) return null;
  const openings: HostOpening[] = storedOpenings(model) ?? (glass ? glassOpenings(glass, centre) : []);
  const fits = fitsForModel(model, openings, toNative);
  if (!fits.length) return null;
  const pos: number[] = [], nrm: number[] = [], col: number[] = [], placed: FitPlaced[] = [], pandRanges: [number, number, number][] = [];
  fits.forEach((f, i) => {
    const b = new FitBuilder(f.op);
    drawLayers(b, f.layers, i * 17);
    if ((pos.length + b.pos.length) / 9 > FIT_MAX_TRIANGLES) return;
    const pand = (f.op as { pand?: number }).pand;
    if (pand !== undefined && b.pos.length) pandRanges.push([pand, pos.length / 9, b.pos.length / 9]);
    for (let k = 0; k < b.pos.length; k++) { pos.push(b.pos[k]); nrm.push(b.nrm[k]); col.push(b.col[k]); }
    placed.push({ opening: f.op.id, tenant: f.tenant, source: f.source, triangles: b.pos.length / 9 });
  });
  return { mesh: { positions: Float32Array.from(pos), normals: Float32Array.from(nrm), colors: Float32Array.from(col), triangles: pos.length / 9 }, openings, placed, pandRanges };
}
