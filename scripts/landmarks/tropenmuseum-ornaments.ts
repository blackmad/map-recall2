import * as T from 'three';
import type {PanelCtx, Cell} from '../../src/canalRecall/blockBuilding/compose';
import {insidePoly, type Panel} from '../../src/canalRecall/blockBuilding/panels';
import {anchorIron, DARK, figure, geom, GLASS, KitStats, solid, STONE} from './tropenmuseum-kit';

/** Rule-based ornaments that need no per-wall registration: they stand on the 3DBAG wall's own top edge or in the kit's own cells. */

/** Height of the wall's top edge at panel coordinate u (highest point of any member polygon over u). */
export function topAt(p: Panel, u: number): number {
  for (let v = p.vMax; v > p.vMin; v -= 0.05) if (p.members!.some(m => insidePoly([u, v], m.poly))) return v;
  return p.vMin;
}

/**
 * Gable crown: ball-topped piers at both feet of the gable and a finial (a statue for a broad gable) on the apex, each seated on the wall top.
 * The Rijksmonument register: gables end in "in- en uitzwenkende geveltop" with free-standing statues on pedestals; the swung profile
 * itself is not in the 3DBAG wall (a plain triangle or stepped top), so the crown is a simplified set of the pieces that stand on it.
 */
export function gableCrown(c: PanelCtx, stats: KitStats, eaves: number, statue: boolean) {
  const p = c.p, w = p.uMax - p.uMin, part = c.part();
  let apexU = p.uMin + w / 2, apexV = -1;
  for (let u = p.uMin + 0.3; u < p.uMax - 0.3; u += 0.1) { const t = topAt(p, u); if (t > apexV) { apexV = t; apexU = u; } }
  const ball = (u: number, v: number, r: number) => geom(c, STONE, new T.SphereGeometry(r, 6, 4), u, v + r, 0.2, part);
  for (const u of [p.uMin + 0.45, p.uMax - 0.45]) {
    const t = topAt(p, u);
    if (t < eaves - 0.5) continue;
    solid(c, STONE, u - 0.25, u + 0.25, t - 0.35, t + 0.75, 0, 0.5, part);
    solid(c, STONE, u - 0.32, u + 0.32, t + 0.75, t + 0.9, 0, 0.58, part);
    ball(u, t + 0.9, 0.24);
  }
  if (statue) {
    solid(c, STONE, apexU - 0.35, apexU + 0.35, apexV - 0.3, apexV + 0.55, 0, 0.7, part);
    figure(c, STONE, apexU, apexV + 0.55, 0.35, 1.7, 1.05);
  } else {
    solid(c, STONE, apexU - 0.22, apexU + 0.22, apexV - 0.2, apexV + 0.4, 0, 0.44, part);
    ball(apexU, apexV + 0.4, 0.26);
    geom(c, DARK, new T.BoxGeometry(0.04, 1.0, 0.04), apexU, apexV + 1.4, 0.22, part);
  }
  stats.drawn.push(`gable crown u ${apexU.toFixed(1)} apex ${apexV.toFixed(1)}`);
}

/**
 * Corner pavilions of the museum (register: "gebeeldhouwde friezen onder de vensters voorstellende de vier voornaamste godsdiensten ... en
 * landbouwcultures"; "het tentdak ... heeft aan de straatzijden in een kapel een wijzerplaat en reliefs"): a stone relief frieze under the
 * centre window of the first two floors above the ground storey, iron anchors between the bays on every other floor, and a clock dial
 * on the wall top rising over the eaves.
 */
export function pavilionOrnaments(c: PanelCtx, stats: KitStats, cells: Cell[], eaves: number, dial: boolean) {
  const p = c.p, part = c.part();
  const centre = cells.filter(k => k.bay === Math.floor(k.bays / 2) && k.floor >= 1 && k.floor <= 2);
  for (const k of centre) {
    const uc = (k.u0 + k.u1) / 2, hw = Math.min(1.3, (k.u1 - k.u0) / 2 - 0.2), v0 = k.v0 + 0.12;
    solid(c, STONE, uc - hw, uc + hw, v0, v0 + 0.78, 0, 0.1, part);                       // frieze ground
    solid(c, STONE, uc - hw - 0.05, uc + hw + 0.05, v0 + 0.78, v0 + 0.86, 0, 0.14, part);   // moulded top
    for (let i = 0; i < 4; i++) {                                                          // four relief figures in the frieze
      const u = uc - hw * 0.75 + i * hw * 0.5;
      geom(c, STONE, new T.CylinderGeometry(0.1, 0.12, 0.5, 5), u, v0 + 0.4, 0.15, part);
      geom(c, STONE, new T.SphereGeometry(0.1, 5, 4), u, v0 + 0.7, 0.15, part);
    }
  }
  for (const k of cells.filter(k => k.floor >= 1 && k.floor % 2 === 1 && k.bay < k.bays - 1)) anchorIron(c, k.u1, k.v0 + 0.25, 0.9, part);
  // clock dial on the wall top where it rises over the eaves (the kapel): the highest spot where the whole dial fits inside the wall
  let bestU = 0, bestV = -1, bestR = 0;
  for (let u = p.uMin + 0.9; dial && u < p.uMax - 0.9; u += 0.1) {
    const t = topAt(p, u), rise = t - eaves;
    if (rise < 1.5) continue;
    const r = Math.min(0.8, rise * 0.3), v = eaves + rise * 0.5;
    if (topAt(p, u - r - 0.45) < v + r + 0.3 || topAt(p, u + r + 0.45) < v + r + 0.3) continue;
    if (t > bestV) { bestV = t; bestU = u; bestR = r; }
  }
  if (bestV > 0) {
    const r = bestR, v = eaves + (bestV - eaves) * 0.5;
    geom(c, 'frame', new T.CylinderGeometry(r, r, 0.14, 16).rotateX(Math.PI / 2), bestU, v, 0.07, part);
    geom(c, 'door', new T.TorusGeometry(r, 0.05, 4, 16), bestU, v, 0.16, part);
    for (const a of [0.4, 2.3]) geom(c, DARK, new T.BoxGeometry(0.06, r * 0.8, 0.04).translate(0, r * 0.35, 0).rotateZ(a), bestU, v, 0.16, part);
    stats.drawn.push(`clock dial u ${bestU.toFixed(1)} v ${v.toFixed(1)}`);
  }
  void GLASS;
}
