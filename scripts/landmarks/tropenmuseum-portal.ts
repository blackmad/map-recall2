import * as T from 'three';
import type {PanelCtx} from '../../src/canalRecall/blockBuilding/compose';
import {anchorIron, archHead, archRing, barQuad, DARK, deepRecess, extrude, figure, FRAME, geom, GLASS, KitStats, oculus, opening, reclining, shapeOf, solid, STONE} from './tropenmuseum-kit';

/**
 * The Instituutsgebouw's Mauritskade front with the main entrance (inventory wall w17-331; panel with 3DBAG surfaces 218/254/507/823, 9.4 m).
 * Measured on the rectified panorama crop (recording_2024-09-16_07-18-19_01094, 50 px/m) read on a 0.5 m grid with elevation-grid.ts;
 * crop x runs from the wall's left end, crop v from the street. U(x) maps the crop onto the panel (panel u starts at -0.44).
 * Register text (Rijksmonument 526987): tripartite sandstone entrance frame with pilasters and segmental pediments with reliefs, the keystone
 * bearing J.P. Coen, wrought-iron door grilles, stair with globe posts, gable with in-and-out swung top flanked by two six-storey corner towers.
 */
export const PORTAL_SURFACES = [218, 254, 507, 823];
const OFF = -0.44;
const U = (x: number) => x + OFF;

export function portalFront(c: PanelCtx, stats: KitStats) {
  const win = {frame: FRAME, glass: GLASS, frameW: 0.05, sillOnWall: true};
  // ---- window columns: left pair, centre triple, right pair, three floors (measured sash extents) ------------------------------
  const cols: [number, number][] = [[1.12, 1.95], [3.42, 4.22], [4.48, 5.28], [5.52, 6.32], [7.68, 8.5]];
  const floors: {lower: [number, number]; upper: [number, number]; sill: number; head: number}[] = [
    {lower: [8.85, 10.4], upper: [10.8, 11.8], sill: 8.6, head: 12.05},
    {lower: [13.55, 14.85], upper: [15.2, 16.3], sill: 13.3, head: 16.5},
  ];
  for (const f of floors) for (const [a, b] of cols) {
    opening(c, stats, 'portal-front window', U(a), U(b), f.lower[0], f.lower[1], {...win, mullAt: [0.5], rowsAt: [0.5]});
    opening(c, stats, 'portal-front window', U(a), U(b), f.upper[0], f.upper[1], {...win, mullAt: [0.5]});
  }
  for (const [a, b] of [[4.1, 4.7], [5.0, 5.6]] as [number, number][]) {
    opening(c, stats, 'portal-front gable window', U(a), U(b), 18.1, 18.85, {...win, mullAt: [0.5]});
    opening(c, stats, 'portal-front gable window', U(a), U(b), 19.3, 20.2, {...win, mullAt: [0.5]});
  }
  // ---- stone surrounds: jambs, piers between the lights, sill, transom and head (4 cm clear of the cut openings) -----------------
  const groups: [number, number][] = [[1.12, 1.95], [3.42, 6.32], [7.68, 8.5]];
  const piers = [[4.25, 4.45], [5.3, 5.5]];
  for (const f of floors) for (const [a, b] of groups) {
    const part = c.part(), lo = f.sill, hi = f.head, x0 = a - 0.16, x1 = b + 0.16;
    solid(c, STONE, U(x0), U(a - 0.03), lo, hi, 0, 0.1, part); solid(c, STONE, U(b + 0.03), U(x1), lo, hi, 0, 0.1, part);
    solid(c, STONE, U(a - 0.03), U(b + 0.03), lo, f.lower[0] - 0.03, 0, 0.1, part);
    solid(c, STONE, U(a - 0.03), U(b + 0.03), f.lower[1] + 0.03, f.upper[0] - 0.03, 0, 0.1, part);
    solid(c, STONE, U(a - 0.03), U(b + 0.03), f.upper[1] + 0.03, hi, 0, 0.1, part);
    if (a === 3.42) for (const [p0, p1] of piers) solid(c, STONE, U(p0), U(p1), f.lower[0] - 0.03, f.upper[1] + 0.03, 0, 0.1, part);
  }
  // ---- hoods: segmental arch rings over every group (three small arches over the centre), a keystone boss on each -------------------
  const hood = (a: number, b: number, spring: number) => {
    archRing(c, STONE, U(a), U(b), spring, 0.42, 0.1, 0.12, 0, 6);
    solid(c, STONE, U((a + b) / 2 - 0.07), U((a + b) / 2 + 0.07), spring + 0.42, spring + 0.62, 0, 0.18);
  };
  for (const spring of [12.2, 16.55]) {
    hood(0.98, 2.09, spring); hood(7.54, 8.64, spring);
    for (const [a, b] of [[3.28, 4.34], [4.34, 5.4], [5.4, 6.46]]) hood(a, b, spring);
  }
  // ---- string courses between the groups, the sill frieze and the parapet cornice --------------------------------------------------
  for (const [v0, v1, d] of [[8.4, 8.6, 0.12], [10.48, 10.72, 0.07], [12.0, 12.2, 0.07], [15.0, 15.2, 0.07], [16.35, 16.55, 0.07], [13.4, 13.5, 0.07]] as [number, number, number][]) {
    const part = c.part();
    const spans: [number, number][] = v0 === 8.4 ? [[0, 9.4]] : [[0, 0.95], [2.12, 3.26], [6.48, 7.52], [8.66, 9.4]];
    for (const [a, b] of spans) solid(c, STONE, Math.max(U(a), c.p.uMin + 0.03), Math.min(U(b), c.p.uMax - 0.03), v0, v1, 0, d, part);
  }
  solid(c, STONE, c.p.uMin + 0.03, c.p.uMax - 0.03, 17.55, 17.95, 0, 0.22);
  for (const x of [1.55, 8.15]) solid(c, STONE, U(x - 0.15), U(x + 0.15), 17.15, 17.55, 0, 0.26);          // carved head corbels
  // ---- parapet panels with shields ----------------------------------------------------------------------------------------------
  for (const [a, b] of [[0.2, 0.75], [0.83, 1.33], [1.8, 2.45], [7.27, 7.83], [8.37, 8.83], [9.0, 9.38]] as [number, number][]) {
    const part = c.part(), a2 = Math.max(U(a), c.p.uMin + 0.04), b2 = Math.min(U(b), c.p.uMax - 0.04);
    solid(c, STONE, a2, b2, 18.05, 18.75, 0, 0.1, part); solid(c, STONE, a2 - 0.05, b2 + 0.05, 18.75, 18.85, 0, 0.14, part);
  }
  // ---- the entrance: pilasters, spandrel, archivolt, arched door with iron fanlight, segmental pediment with reclining figures ------
  {
    const part = c.part();
    for (const [a, b] of [[2.85, 3.6], [6.1, 6.85]] as [number, number][]) {
      solid(c, STONE, U(a), U(b), 1.8, 6.15, 0, 0.3, part);
      solid(c, STONE, U(a - 0.06), U(b + 0.06), 5.88, 6.15, 0, 0.38, part);        // capital
      solid(c, STONE, U(a - 0.05), U(b + 0.05), 1.8, 2.15, 0, 0.36, part);         // plinth
    }
    const doorInner: [number, number][] = [[3.6, 4.3], ...archHead(3.6, 6.1, 4.3, 1.25, 10), [6.1, 4.3]];
    geom(c, STONE, extrude(shapeOf([[3.6, 4.3], [6.1, 4.3], [6.1, 6.15], [3.6, 6.15]].map(([x, v]) => [U(x), v] as [number, number]), [doorInner.map(([x, v]) => [U(x), v] as [number, number])]), 0.28), 0, 0, 0, part);
    archRing(c, STONE, U(3.6), U(6.1), 4.3, 1.25, 0.34, 0.34, 0, 10);
    // entablature and segmental pediment
    solid(c, STONE, U(2.72), U(7.0), 6.15, 6.47, 0, 0.36, part);
    geom(c, STONE, extrude(shapeOf([[2.85, 6.47], [6.9, 6.47], ...[...archHead(2.85, 6.9, 6.47, 1.55, 12)].reverse()].map(([x, v]) => [U(x), v] as [number, number])), 0.3), 0, 0, 0.0, part);
    reclining(c, STONE, U(3.85), 6.6, 0.36, 1.25, 1); reclining(c, STONE, U(5.85), 6.6, 0.36, 1.25, -1);
    geom(c, STONE, new T.CylinderGeometry(0.3, 0.3, 0.1, 8).rotateX(Math.PI / 2).scale(0.8, 1.2, 1), U(4.85), 6.85, 0.36, part); // shield between them
    geom(c, STONE, new T.CylinderGeometry(0.22, 0.22, 0.1, 10).rotateX(Math.PI / 2).scale(1, 1.25, 1), U(4.85), 5.95, 0.42, part); // keystone medallion (J.P. Coen)
    // glazed arched door with wrought-iron grille in the fanlight
    opening(c, stats, 'portal door', U(3.72), U(5.98), 1.85, 4.3, {frame: DARK, glass: GLASS, frameW: 0.08, mullAt: [0.5], rowsAt: [0.4]});
    // fanlight in the arch: a glass segment 6 cm into the stone opening with the wrought-iron grille (radial bars and two rings) in front of it
    geom(c, GLASS, extrude(shapeOf([[3.72, 4.3], [5.98, 4.3], ...archHead(3.72, 5.98, 4.3, 1.13, 10).reverse()].map(([x, v]) => [U(x), v] as [number, number])), 0.04), 0, 0, 0.08, part);
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.12 + 0.76 * i / 6);
      geom(c, DARK, new T.BoxGeometry(1.0, 0.035, 0.035).rotateZ(a), U(4.85) + Math.cos(a) * 0.5, 4.3 + Math.sin(a) * 0.5, 0.15, part);
    }
    geom(c, DARK, new T.TorusGeometry(0.62, 0.02, 4, 14, Math.PI), U(4.85), 4.3, 0.15, part);
    geom(c, DARK, new T.TorusGeometry(1.02, 0.02, 4, 16, Math.PI), U(4.85), 4.3, 0.15, part);
    // right: oculus and the side door with its own head
    oculus(c, U(8.15), 5.4, 0.9, 0.5, 8);
    solid(c, STONE, U(7.45), U(7.6), 1.8, 4.75, 0, 0.25, part); solid(c, STONE, U(8.5), U(8.65), 1.8, 4.75, 0, 0.25, part);
    archRing(c, STONE, U(7.6), U(8.5), 4.4, 0.32, 0.15, 0.25, 0, 6);
    opening(c, stats, 'side door', U(7.62), U(8.48), 1.85, 4.45, {frame: DARK, glass: DARK, frameW: 0.06, mullAt: [0.33, 0.66], rowsAt: [0.5]});
    // stair: ten treads, globe posts at the head
    for (let k = 0; k < 10; k++) solid(c, STONE, U(1.5), U(8.2), 0, 0.18 * (10 - k), k * 0.33, (k + 1) * 0.33, part);
    for (const x of [1.35, 8.35]) { solid(c, STONE, U(x - 0.22), U(x + 0.22), 0, 2.4, 0.3, 0.74, part); geom(c, STONE, new T.SphereGeometry(0.3, 8, 6), U(x), 2.7, 0.52, part); }
  }
  // ---- anchors (sieranker) between the windows ------------------------------------------------------------------------------------
  for (const [x, v, h] of [[2.64, 6.9, 1.0], [6.98, 7.0, 1.0], [2.67, 12.0, 1.2], [6.98, 12.0, 1.2]] as [number, number, number][]) anchorIron(c, U(x), v, h);
  stats.drawn.push('portal front: windows, hoods, entrance, oculus, side door, stair, anchors');
  return;
}

/** The gable over the portal front (v >= 19.5): piers with balls, scroll panels, cornice, window pediment, oculus, ears, statues, crown. */
export function portalGable(c: PanelCtx, stats: KitStats) {
  const part = c.part();
  for (const x of [1.6, 8.1]) {
    solid(c, STONE, U(x - 0.22), U(x + 0.22), 19.55, 20.95, 0, 0.3, part);
    solid(c, STONE, U(x - 0.28), U(x + 0.28), 20.95, 21.1, 0, 0.36, part);
    geom(c, STONE, new T.SphereGeometry(0.2, 8, 6), U(x), 21.3, 0.15, part);
  }
  for (const [a, b] of [[1.82, 2.5], [7.2, 7.88]] as [number, number][]) geom(c, STONE, extrude(shapeOf([[U(a), 19.95], [U(b), 19.95], ...archHead(U(a), U(b), 19.95, 0.55, 8).reverse()]), 0.2), 0, 0, 0, part);
  solid(c, STONE, U(2.35), U(7.35), 21.62, 22.0, 0, 0.22, part);
  // window pediment
  const tri = [[3.95, 20.45], [5.75, 20.45], [4.85, 21.15]].map(([x, v]) => [U(x), v] as [number, number]);
  geom(c, STONE, extrude(shapeOf(tri), 0.16), 0, 0, 0, part);
  oculus(c, U(4.87), 22.8, 0.57, 0.37, 6);
  for (const [a, b] of [[3.35, 4.05], [5.65, 6.35]] as [number, number][]) archRing(c, STONE, U(a), U(b), 23.45, 0.45, 0.08, 0.1, 0, 6);
  // statues on pedestals either side and on the crown
  for (const x of [2.75, 6.95]) { solid(c, STONE, U(x - 0.3), U(x + 0.3), 22.0, 22.55, 0, 0.6, part); figure(c, STONE, U(x), 22.55, 0.35, 1.7, 1.1); }
  solid(c, STONE, U(4.08), U(5.67), 24.3, 25.0, 0, 0.25, part);
  geom(c, STONE, extrude(shapeOf([[3.83, 25.0], [5.9, 25.0], [4.865, 25.5]].map(([x, v]) => [U(x), v] as [number, number])), 0.3), 0, 0, 0, part);
  figure(c, STONE, U(4.87), 25.5, 0.12, 1.8, 1.1);
  anchorIron(c, U(4.85), 23.55, 0.9);
  for (const [x, v] of [[2.1, 19.4], [7.5, 19.4], [3.1, 20.6], [6.6, 20.6]] as [number, number][]) anchorIron(c, U(x), v, 0.9);
  stats.drawn.push('portal gable: piers, scrolls, cornice, oculus, ears, three statues');
  void barQuad; void deepRecess;
}
