/**
 * Design units round 2 (#399): a plot's wall tone inside its family. The segment draws one family brick
 * (measuredWallPool segmentPoolDraw); each plot shifts it by a seeded OKLab L step of at most PLOT_TONE_DL, hue and chroma
 * kept, so neighbouring houses of one project read as one brick laid by different crews, not one slab.
 */
import { hexToOklab, oklabToHex } from '../houseSpec/wallColour.js';
import { PLOT_TONE_DL } from './drawProps.js';

const hash01 = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; };

/** The family brick shifted by the plot's seeded lightness step (-PLOT_TONE_DL .. +PLOT_TONE_DL). */
export function plotTone(familyHex: string, plotSeed: string): string {
  const [L, a, b] = hexToOklab(familyHex);
  // Five steps (-1, -0.5, 0, 0.5, 1) x DL: neighbours differ visibly, never past the family.
  const step = (Math.floor(hash01(`${plotSeed}:tone`) * 5) - 2) / 2;
  return oklabToHex([Math.min(1, Math.max(0, L + step * PLOT_TONE_DL)), a, b]);
}
