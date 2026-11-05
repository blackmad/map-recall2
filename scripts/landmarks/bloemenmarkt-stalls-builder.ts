import type {BuildingTools} from './cultural-builders';
import type {FaceName, KioskAwning, KioskPanel, KioskRole, KioskSpec} from '../../src/canalRecall/kiosks/kioskKit';
import {addKiosk} from './kiosk-kit-tools';
import footprints from './bloemenmarkt-stalls-footprints.json';

/**
 * Bloemenmarkt, Singel 600-630: the flower market's sixteen stalls, one per BAG ligplaats (water plot) on the south side
 * of the Singel between the Koningsplein and the Vijzelstraat, drawn as one landmark from the kiosk kit's flower-stall
 * variant with the greenhouse roof (#227).
 *
 * Each stall: a row of glass gables across its width, ridges running from the street to the canal (bays ~3.4 m, rise
 * 0.75 m on a 2.75 m wall, pale frames and glazing bars), standing on a dark pontoon over its ligplaats and reaching
 * 3.2 m onto the pavement; the canal side is a wall of glass panes (1.15 m) with the plants inside showing through; the
 * street front is open, with the retracted awning's steel roller tube along the head, a dark name/photo fascia under it,
 * steel posts, tiered displays and buckets of flowers, and on some stalls a blue awning let out. The street gables are
 * light-grey panels except on Singel 602, whose street gables are glazed.
 *
 * Measured from Gemeente Amsterdam panoramas (CC BY 4.0), see bloemenmarkt-stalls-inventory.json:
 * b_20241211_0954_Track19_Sphere_00022 (north bank, 25 m: canal side, bay width 3.1-3.8 m, wall 2.7 m, rise 0.7-0.9 m,
 * hull band 0.45 m), b_20250120_0926_Track02_Sphere_00235/_00236/_00239/_00243 and _00222 (street side, open: tube,
 * fascia, awnings, displays, Singel 602's glass street gables), recording_2025-06-19_03-28-47_01511 (street side shut:
 * grey gables, photo fascia "Tulipe & More 61"); plots and the 3.2 m land strip from BAG ligplaatsen (CC0) and the PDOK
 * 2025 orthophoto (CC BY 4.0).
 */
type Plot = (typeof footprints.plots)[number];

/** per-plot choices read from the photos; keyed by house number */
const OVERRIDES: Record<string, {trimLeft?: number; glassFront?: boolean; awning?: boolean; photoFascia?: boolean; endWall?: 'left' | 'right'}> = {
  'Singel 600': {endWall: 'left'},
  // the triangular plot round the tree at the Koningsplein end: the stall stands east of the trunk
  'Singel 602': {trimLeft: 2.5, glassFront: true, awning: true},
  'Singel 606': {awning: true},
  'Singel 610': {awning: true},
  'Singel 612': {photoFascia: true},
  'Singel 614': {photoFascia: true},
  'Singel 616': {photoFascia: true},
  'Singel 618': {endWall: 'right'},
  'Singel 620': {endWall: 'left', awning: true},
  'Singel 624': {awning: true},
  'Singel 628': {awning: true},
  'Singel 630': {endWall: 'right'},
};

const BAY = 3.4, PANE = 1.15, WALL = 2.75;
/** canal-side panes: clear glass, and glass with plants pressed against it (role void, a deep green glass tint) */
const CANAL_ROLES: KioskRole[] = ['void', 'glass', 'void', 'void', 'glass', 'glass', 'void', 'glass'];

type Rect = {c: [number, number]; a: [number, number]; n: [number, number]; w: number; d: number};
const DECK = 0.05, CLEAR = 0.04;
/** the deck rectangle of a plot trimmed by `left` / `right` metres (viewer's right on the front is +X local = (-cos b, -sin b) in east/south, kioskKit placement) */
function deckRect(p: Plot, left: number, right: number): Rect {
  const b = p.stall.frontBearing * Math.PI / 180, a: [number, number] = [-Math.cos(b), -Math.sin(b)], n: [number, number] = [Math.sin(b), -Math.cos(b)];
  const shift = (left - right) / 2;
  return {c: [p.stall.centre[0] + a[0] * shift, p.stall.centre[1] + a[1] * shift], a, n, w: (p.stall.widthM - left - right) / 2 + DECK, d: p.stall.depthM / 2 + DECK};
}
const corners = (r: Rect) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [r.c[0] + r.a[0] * u * r.w + r.n[0] * v * r.d, r.c[1] + r.a[1] * u * r.w + r.n[1] * v * r.d]);
const outside = (r: Rect, q: number[]) => {const dx = q[0] - r.c[0], dz = q[1] - r.c[1]; return Math.max(Math.abs(dx * r.a[0] + dz * r.a[1]) - r.w, Math.abs(dx * r.n[0] + dz * r.n[1]) - r.d);};
const clearance = (r: Rect, s: Rect) => Math.min(...corners(r).map(q => outside(s, q)), ...corners(s).map(q => outside(r, q)));
/**
 * The ligplaatsen are quadrilaterals following the canal's curve, so neighbouring minimum rectangles overlap by up to
 * 0.5 m at a corner: trim both stalls of each pair 5 cm at a time on their shared side until the decks stand >= 4 cm apart
 * (no two stalls' frames or decks share a plane). Deterministic; the trims are reported in the footprints notes.
 */
export const TRIMS: {left: number; right: number}[] = (() => {
  const plots = footprints.plots, t = plots.map(p => ({left: OVERRIDES[p.address]?.trimLeft ?? 0, right: 0}));
  for (let i = 0; i + 1 < plots.length; i++) {
    for (let k = 0; k < 60 && clearance(deckRect(plots[i], t[i].left, t[i].right), deckRect(plots[i + 1], t[i + 1].left, t[i + 1].right)) < CLEAR; k++) {
      t[i].right += 0.05; t[i + 1].left += 0.05;
    }
  }
  return t.map(x => ({left: +x.left.toFixed(2), right: +x.right.toFixed(2)}));
})();

export function stallSpec(p: Plot, index: number): {spec: KioskSpec; centre: [number, number]; frontBearing: number} {
  const o = OVERRIDES[p.address] ?? {};
  const {left, right} = TRIMS[index], r = deckRect(p, left, right);
  const width = 2 * (r.w - DECK), depth = p.stall.depthM, centre = r.c;
  const canal: KioskPanel[] = Array.from({length: Math.max(2, Math.round(width / PANE))}, (_, k) => ({kind: 'glass', width: 1, role: CANAL_ROLES[(k + index * 3) % CANAL_ROLES.length]}));
  const side = (f: FaceName): KioskPanel[] => o.endWall === f ? Array.from({length: Math.max(2, Math.round(depth / PANE))}, (_, k) => ({kind: 'glass' as const, width: 1, role: k < Math.round(p.stall.landDepthM / PANE) ? 'glass' as const : CANAL_ROLES[(k + index) % CANAL_ROLES.length]})) : [];
  const bays = Math.max(1, Math.round(width / BAY));
  const awnings: KioskAwning[] = o.awning ? [{face: 'front', along: 0, width: width - 0.3, top: WALL - 0.12, depth: 1.1, drop: 0.35, valance: 0.12}] : [];
  const fascia: KioskRole[] = o.photoFascia ? ['screen', 'screen', 'fascia'] : ['fascia'];
  return {
    centre, frontBearing: p.stall.frontBearing,
    spec: {
      variant: 'flower-stall', width, depth, wallHeight: WALL, plinth: 0, post: 0.09, mullion: 0.05, frameDepth: 0.07,
      baseRail: 0.1, headRail: 0.14,
      faces: {front: {panels: []}, back: {panels: canal}, left: {panels: side('left')}, right: {panels: side('right')}},
      // glazed gables are drawn as flat panels in the roof-glass tint (role board) with their bars: glass is opaque flat colour
      // in this engine either way, and a panel is the gable wall the bars and the roof glass need under the GLB audit
      roof: {kind: 'greenhouse', bays, rise: 0.75, overhang: 0.20, barPitch: 1.4, frontEnd: o.glassFront ? 'board' : 'solid', backEnd: 'board',
        endBars: {front: !!o.glassFront, back: true}},
      stall: {hullDepth: 1.95, hullOverhang: 0.05, tiers: 1, tierDepth: 0.7, tierRise: 0.35, openFace: 'front', landDepth: p.stall.landDepthM,
        bloomPitch: 0.95, bucketPitch: 1.3,
        front: {tube: 0.09, fascia: {height: 0.42, roles: fascia}, posts: bays + 1}},
      awnings,
    },
  };
}

export function buildBloemenmarktStalls(_w: number, _d: number, b: BuildingTools) {
  footprints.plots.forEach((p, i) => {
    const {spec, centre, frontBearing} = stallSpec(p, i);
    addKiosk(b, spec, {centre, frontBearing}, {
      frame: 'white', glass: 'glass', roofGlass: 'canopyGlass', board: 'pink', void: 'dark', solid: 'stone', hull: 'greyBrick', deck: 'concrete', display: 'greyBrick', roofFrame: 'bronze', trim: 'frame',
      fascia: 'slate', screen: 'blue', awning: 'ochre', awningStripe: 'ochre', corner: 'white',
      bloomA: 'red', bloomB: 'gold', bloomC: 'red', bloomD: 'stone', foliage: 'green', lettering: 'white',
    });
  });
}
