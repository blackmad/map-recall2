/**
 * A re-fitted wall reference for the house preview (lane H9g, #345 follow-up).
 *
 * A block-face strip is stitched from several panoramas and can differ in exposure along the face (Kinkerstraat 31-49: the
 * right half of the 2024-12-11 strip is brighter, so `house:preview --photo` read 45's wall #9a7b64 against a render of
 * #5f4d43 and failed on dL -0.18 where the overcast street panorama is one uniform dark brown). When a face intent records
 * `wallRefit[pandId]` (the fitted hex, the source id and the crop it was fitted on), the preview measures the wall against
 * that reading instead of the strip's. Everything but the wall (glazing, columns, window shape) still comes from the photo.
 */
import type { FacadeMeasurement } from '../buildingRecipe/measureFacade.ts';

export interface WallRefit { hex: string; /** a stable id of the capture the wall was fitted on */ source: string; /** the pixels it was fitted on: file and box */ crop?: string }

const HEX = /^#[0-9a-f]{6}$/i;
const rgbOf = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** The refit a face intent records for a pand (bare 16-digit number or NL.IMBAG.Pand.<n>), or null. */
export function wallRefitOf(intent: { wallRefit?: Record<string, WallRefit> } | null | undefined, pandId: string): WallRefit | null {
  const r = intent?.wallRefit?.[pandId.replace(/^NL\.IMBAG\.Pand\./, '')];
  return r && HEX.test(r.hex) && r.source ? r : null;
}

/** The photo measurement with its wall replaced by the refit reading; same object back when there is no refit. */
export function withWallRefit(m: FacadeMeasurement, refit: WallRefit | null): FacadeMeasurement {
  if (!refit) return m;
  const hex = refit.hex.toLowerCase(), rgb = rgbOf(hex);
  return { ...m, wall: { ...m.wall, raw: rgb, normalised: rgb, hex, rawHex: hex } };
}
