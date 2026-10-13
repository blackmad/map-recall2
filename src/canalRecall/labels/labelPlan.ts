// Which POI labels a rider sees, and how strongly. Pure: the browser overlay
// (labelOverlay.ts) projects candidates and asks this module what to draw.
//
// User report 2026-10-13 (Damrak, ~250 m): 132 white shop, hotel and cruise
// names over every roof, at full strength, above the buildings that hid
// them. The rules here: a density budget by camera height, the game's own
// list first (destination, landmarks, museums and churches), shops and cafés
// only near the rider, a fade with distance, no label whose anchor a building
// hides, none over the HUD, and never one that says the name being asked.

import { poiLabelVisible, type LabelContext } from '../ownMap/labelPolicy';
import { normaliseSpoilerName } from '../orientationPois';
import type { PoiCategory } from '../poiCatalog';

/** Size and emphasis, largest first. */
export type LabelClass = 'destination' | 'landmark' | 'culture' | 'civic' | 'venue';

export interface LabelCandidate {
  id: string;
  name: string;
  lng: number;
  lat: number;
  /** Anchor height above the ground, metres (the building's roofline band). */
  heightM: number;
  cls: LabelClass;
  /** Source score: landmark prominence, or the POI extract's rank. */
  rank: number;
}

/** A candidate as the camera sees it this frame. */
export interface ScreenCandidate extends LabelCandidate {
  /** Anchor in CSS pixels of the map canvas. */
  x: number;
  y: number;
  /** Measured label element (CSS px): name, stem and leader dot, the dot on the anchor. */
  width: number;
  height: number;
  /** Metres from the camera to the anchor. */
  distM: number;
  /** Metres from the rider (ground), for the venue radius. */
  riderDistM: number;
  /** A building is between the camera and the anchor. */
  occluded: boolean;
}

export interface Rect { x: number; y: number; width: number; height: number }

/** Shops, cafés, hotels: only this close to the rider (handoff 2026-10-13). */
export const VENUE_RADIUS_M = 80;
/** The budget at the user's viewpoint (≈250 m up, 1440×900): at most ~12. */
export const BUDGET_AT_250M = 12;
/** Gap kept between two labels and between a label and the HUD, CSS px. */
export const LABEL_GAP_PX = 6;

export function categoryClass(category: PoiCategory | string | undefined): LabelClass {
  switch (category) {
    case 'culture': case 'worship': return 'culture';
    case 'education': case 'health': case 'civic': case 'leisure': case 'market': return 'civic';
    default: return 'venue';
  }
}

/**
 * How many labels may be in view. Riding (≈2 m) six: a street's worth of
 * cues; from 250 m twelve. Scaled by screen area against the 1440×900
 * desktop, so a phone gets about half, never fewer than four.
 */
export function labelBudget(cameraHeightM: number, viewportArea = 1440 * 900): number {
  const h = Math.max(1, cameraHeightM);
  const t = Math.min(1, Math.log2(h / 2) / Math.log2(250 / 2));
  const base = 6 + (BUDGET_AT_250M - 6) * Math.max(0, t);
  const area = Math.min(1, Math.max(0.2, viewportArea / (1440 * 900)));
  return Math.max(4, Math.round(base * Math.sqrt(area)));
}

/**
 * Opacity from distance to the camera. Full strength out to a range that
 * grows with height (a rider reads the next blocks, a camera in the air
 * reads the district), gone at 2.5× that range.
 */
export function distanceFade(distM: number, cameraHeightM: number): number {
  const near = Math.max(160, 2.2 * cameraHeightM);
  const far = near * 2.5;
  if (distM <= near) return 1;
  if (distM >= far) return 0;
  return 1 - (distM - near) / (far - near);
}

const CLASS_WEIGHT: Record<LabelClass, number> = { destination: 10000, landmark: 3000, culture: 2000, civic: 1000, venue: 500 };

/** Higher wins a place. The game's own list first, then the source score, then nearness. */
export function labelPriority(c: Pick<LabelCandidate, 'cls' | 'rank'>, distM: number): number {
  return CLASS_WEIGHT[c.cls] + Math.min(999, Math.max(0, c.rank)) - distM / 10;
}

/** The rules a label must pass before it is even placed. */
export interface LabelRules extends LabelContext {
  /** Labels toggled off (D) or the overlay not wanted. */
  labelsOff: boolean;
}

/**
 * Never reveal the question (CLAUDE.md; docs/gameplay/loop.md). The shared
 * POI rule (`poiLabelVisible`: no quiz-eligible name, nothing during a quiz),
 * plus Dutch compounds of the asked name: while the Keizersgracht is asked,
 * "Keizersgrachtkerk" says it as plainly as "Hotel Keizersgracht".
 * The destination is exempt from the quiet map and the all-names index (the
 * HUD card names it too) but not from the asked name; the game hands it in
 * already masked (`maskSpoiledName`), this is the second lock.
 */
export function labelAllowed(rules: LabelRules, cls: LabelClass, name: string): boolean {
  if (!name || rules.labelsOff) return false;
  if (rules.hiddenName && containsAskedName(name, rules.hiddenName)) return false;
  if (cls === 'destination') return true;
  return poiLabelVisible(rules, name);
}

/** True when any word of the label is, or starts with, the asked name (normalised, ≥ 4 letters). */
export function containsAskedName(label: string, asked: string): boolean {
  const a = normaliseSpoilerName(asked);
  if (a.length < 4) return normaliseSpoilerName(label) === a && a.length > 0;
  const words = normaliseSpoilerName(label);
  if (words === a || words.includes(` ${a}`) || words.startsWith(a)) return true;
  // A multi-word name joined into one compound ("Prins Hendrikkade" → "prinshendrikkade…").
  const joined = a.replace(/ /g, '');
  return words.split(' ').some(word => word.startsWith(joined));
}

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

/** The box a label occupies: its element (name, stem, leader dot) with the dot on the anchor. */
export const DOT_HALF_PX = 3;
export function labelBox(c: Pick<ScreenCandidate, 'x' | 'y' | 'width' | 'height'>): Rect {
  return { x: c.x - c.width / 2, y: c.y + DOT_HALF_PX - c.height, width: c.width, height: c.height };
}

export interface PlannedLabel { id: string; opacity: number }

export interface PlanInput {
  candidates: ScreenCandidate[];
  rules: LabelRules;
  cameraHeightM: number;
  viewport: { width: number; height: number };
  /** HUD plates in the same CSS pixels: plaque, destination card, prompt, minimap… */
  hud: Rect[];
  /** Ids drawn last time: they keep their place over a newcomer of equal rank (no flicker). */
  previous?: ReadonlySet<string>;
}

/**
 * The labels to draw, best first, within the budget. Greedy: a label takes
 * its box if it clears the screen edge, the HUD and every label already taken.
 */
export function planLabels(input: PlanInput): PlannedLabel[] {
  const { candidates, rules, cameraHeightM, viewport, hud, previous } = input;
  const budget = labelBudget(cameraHeightM, viewport.width * viewport.height);
  const scored = candidates
    .filter(c => !c.occluded)
    .filter(c => c.cls !== 'venue' || c.riderDistM <= VENUE_RADIUS_M)
    .map(c => ({ c, fade: c.cls === 'destination' ? Math.max(0.85, distanceFade(c.distM, cameraHeightM)) : distanceFade(c.distM, cameraHeightM) }))
    .filter(({ fade }) => fade > 0.05)
    .filter(({ c }) => labelAllowed(rules, c.cls, c.name))
    .map(({ c, fade }) => ({ c, fade, score: labelPriority(c, c.distM) + (previous?.has(c.id) ? 150 : 0) }))
    .sort((a, b) => b.score - a.score);
  const taken: Rect[] = [];
  const out: PlannedLabel[] = [];
  for (const { c, fade } of scored) {
    if (out.length >= budget) break;
    const box = labelBox(c);
    if (box.x < 0 || box.y < 0 || box.x + box.width > viewport.width || box.y + box.height > viewport.height) continue;
    if (hud.some(r => rectsOverlap(box, r, LABEL_GAP_PX))) continue;
    if (taken.some(r => rectsOverlap(box, r, LABEL_GAP_PX))) continue;
    taken.push(box);
    out.push({ id: c.id, opacity: fade });
  }
  return out;
}
