/**
 * Placement baked at compile time: the exact matrix the landmark loader builds at runtime
 * (`signature-landmarks-source.js` `_add`: surveyed or fitted placement, ground offset, uniform scale, mirror, the
 * Mercator transform), followed by Mercator → tile frame. A model drawn by the near tier therefore stands where the
 * landmark loader would have put it, to float precision (pure; tested against hand-computed cases).
 */
import {placementFor, type ModelBounds, type SignatureModelSpec} from '../landmarks/signaturePlacement.ts';
import {mercatorOf, metreUnitsAt, type TileFrame} from './tiles.ts';
import {mul, rotationX, rotationZ, scaling, translation, type Mat4} from './soup.ts';

/** `signature-landmarks-source.js rotationForBearing`: the scale's negated Y flips handedness, so the angle is the complement. */
export const rotationForBearing = (bearingDegrees: number): number => ((90 - bearingDegrees) * Math.PI) / 180;

/** Mercator → tile frame (x east, y up, z south, metres at the tile anchor). */
export function tileFromMercator(frame: TileFrame): Mat4 {
  const k = 1 / frame.units;
  return [k, 0, 0, 0, 0, 0, k, 0, 0, k, 0, 0, -frame.centre[0] * k, 0, -frame.centre[1] * k, 1];
}

/** Model frame (the GLB scene root: glTF +X, +Y up, +Z) → Mercator, as the landmark loader computes it. */
export function mercatorFromModel(spec: SignatureModelSpec, bounds: ModelBounds): Mat4 {
  const placement = placementFor(spec, bounds);
  const [minX, minY, minZ] = bounds.min, [maxX, , maxZ] = bounds.max;
  const offset = spec.surveyed ? translation(0, -minY, 0) : translation(-(minX + maxX) / 2, -minY, -(minZ + maxZ) / 2);
  const group = scaling(placement.mirror ? -placement.scale : placement.scale, placement.scale, placement.scale);
  const [mx, my] = mercatorOf(placement.anchor[0], placement.anchor[1]), u = metreUnitsAt(placement.anchor[1]), mz = placement.altitudeMetres * u;
  let transform: Mat4;
  if (placement.horizontalBasis) {
    const {x, y} = placement.horizontalBasis;
    transform = [u * x[0], u * x[1], 0, 0, 0, 0, u, 0, -u * y[0], -u * y[1], 0, 0, mx, my, mz, 1];
  } else {
    transform = mul(mul(mul(translation(mx, my, mz), scaling(u, -u, u)), rotationZ(rotationForBearing(placement.modelRotationDegrees))), rotationX(Math.PI / 2));
  }
  return mul(mul(transform, group), offset);
}

/** Model frame → tile frame. */
export const tileFromModel = (spec: SignatureModelSpec, bounds: ModelBounds, frame: TileFrame): Mat4 => mul(tileFromMercator(frame), mercatorFromModel(spec, bounds));

/** A surveyed spec for a model that is placed by anchor and north offset only (chunks, house recipes, large recipes). */
export function surveyedSpec(id: string, anchor: [number, number], northOffsetDegrees: number): SignatureModelSpec {
  return {id, surveyed: {anchor, northOffsetDegrees, source: 'recipe tile'}, groundAltitudeMetres: 0, facingOffsetDegrees: 0} as unknown as SignatureModelSpec;
}
