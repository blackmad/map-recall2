// The POI label look: the HUD's face and ink (docs/LOOK.md §Labels).
//
//  - Type: the plaque face (Barlow Condensed, `hudSurface.fontPlaque`) for
//    names, the HUD UI face for venues; sizes by class, landmark > museum /
//    church > civic > hotel / shop. Small caps (uppercase, tracked) only for
//    landmarks and the destination, as the street plaque sets names.
//  - Ink: the plaque's warm dark on a thin paper halo (the `?labelTone=paper`
//    inverse was deleted 2026-10-16).
//  - A leader dot at the POI, a short stem up to the name.
//  - The destination reuses the destination card: a paper chip, copper
//    arrowhead, uppercase plaque face.

import { hudSurface } from '../hudTheme';
import { LABEL_INK, labelInk } from '../look/palette';
import type { LabelClass } from './labelPlan';

const PLAQUE = '"Barlow Condensed", "Arial Narrow", "Helvetica Neue Condensed", sans-serif';
const UI = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export interface ClassType { font: string; size: number; weight: number; caps: boolean; tracking: number }

export const LABEL_TYPE: Record<LabelClass, ClassType> = {
  destination: { font: PLAQUE, size: 15, weight: 700, caps: true, tracking: 0.04 },
  landmark: { font: PLAQUE, size: 15, weight: 700, caps: true, tracking: 0.06 },
  culture: { font: PLAQUE, size: 14, weight: 600, caps: false, tracking: 0.01 },
  civic: { font: PLAQUE, size: 13, weight: 600, caps: false, tracking: 0.01 },
  venue: { font: UI, size: 11, weight: 500, caps: false, tracking: 0 },
};

/** Canvas font string for measuring a label of this class. */
export function labelFont(cls: LabelClass): string {
  const t = LABEL_TYPE[cls];
  return `${t.weight} ${t.size}px ${t.font}`;
}

export const LABEL_ROOT_CLASS = 'cr-map-labels';

/** Fade in / out of an overlay label, ms (matches labels/labelFade.ts LABEL_FADE_MS). */
export const LABEL_FADE_CSS_MS = 300;

/**
 * Free Ride's place pill (freeRideRuntime.ts `_renderFreeRideMarkers`): a
 * paper plate with a coral dot, the stem and the anchor dot below. The overlay
 * wears it for a place Free Ride marks, so the place keeps one look whether
 * its marker or the overlay names it (#122, Klimmuur Centraal).
 */
export const PILL_CLASS = 'pill';
export const PILL_FONT = `700 12px ${hudSurface.fontUi}`;

/** The overlay's stylesheet. One rule per class; positions are set inline per frame. */
export function labelCss(): string {
  const ink = labelInk();
  const halo = `0 0 1px ${ink.halo}, 0 0 2px ${ink.halo}, 0 0 3px ${ink.halo}, 0 0 4px ${ink.halo}`;
  const root = `.${LABEL_ROOT_CLASS}`;
  const rules = [
    `${root}{position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;overflow:hidden;z-index:2}`,
    `${root} .l{position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;white-space:nowrap;`
      + `transition:opacity ${LABEL_FADE_CSS_MS}ms ease;will-change:transform,opacity;color:${ink.text};text-shadow:${halo}}`,
    `${root} .l .n{line-height:1.05;max-width:180px;overflow:hidden;text-overflow:ellipsis}`,
    `${root} .l .s{width:1px;height:5px;background:${ink.text};opacity:.55}`,
    `${root} .l .d{width:5px;height:5px;border-radius:50%;background:${ink.dot};box-shadow:0 0 0 1.5px ${ink.halo}}`,
    `${root} .l.venue{color:${ink.muted}}`,
    `${root} .l.venue .d{width:4px;height:4px;background:${ink.muted}}`,
    // The destination chip: the HUD's destination card in miniature.
    `${root} .l.destination .n{background:rgba(251,248,242,0.95);color:${LABEL_INK.ink};text-shadow:none;padding:3px 8px 2px 7px;`
      + `border-radius:6px;border:1px solid rgba(180,104,44,0.6);box-shadow:0 1px 4px rgba(31,28,23,0.22);display:flex;align-items:center;gap:5px}`,
    `${root} .l.destination .n::before{content:"";width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;`
      + `border-top:8px solid ${LABEL_INK.destination}}`,
    `${root} .l.destination .s{background:${LABEL_INK.destination};opacity:1;height:7px}`,
    `${root} .l.destination .d{background:${LABEL_INK.destination}}`,
  ];
  for (const [cls, t] of Object.entries(LABEL_TYPE)) {
    rules.push(`${root} .l.${cls} .n{font:${t.weight} ${t.size}px ${t.font};letter-spacing:${t.tracking}em;${t.caps ? 'text-transform:uppercase;' : ''}}`);
  }
  // After the class rules: the pill's face wins over the landmark plaque's.
  const pill = `${root} .l.${PILL_CLASS}`;
  rules.push(
    `${pill} .n{font:${PILL_FONT};letter-spacing:0;text-transform:none;color:${hudSurface.ink};text-shadow:none;background:${hudSurface.cardSolid};`
      + `border:1px solid ${hudSurface.border};border-radius:11px;height:22px;box-sizing:border-box;padding:0 9px 0 6px;display:flex;align-items:center;gap:5px;`
      + `box-shadow:0 1px 6px ${hudSurface.shadow}}`,
    `${pill} .n::before{content:"";flex:none;width:9px;height:9px;border-radius:50%;background:${hudSurface.arrow}}`,
    `${pill} .s{background:${hudSurface.ink};opacity:.55;width:1.5px;height:8px}`,
    `${pill} .d{width:7px;height:7px;background:${hudSurface.arrow};box-shadow:none}`,
  );
  return rules.join('\n');
}
