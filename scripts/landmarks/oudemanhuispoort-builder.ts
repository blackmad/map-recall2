import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {edgeBox, edgesOf, lodSurfaces, ringPoints, type Edge, type LodSurface} from './civic-kit';
import source from './oudemanhuispoort-footprints.json';

/**
 * Oudemanhuispoort gate-house on the Oudezijds Achterburgwal side (BAG pand
 * 0363100012180206, 1775 per BAG): a four-storey brick gate block (3DBAG LoD2.2
 * solid) with a grey sandstone portal on the canal-facing end. Only the gate
 * building is modelled; the university carre behind it keeps the generic city
 * rendering. Portal proportions are photo-guided (2025 panorama), not measured.
 */
export const OMHP_PORTAL_POINT = [-4.6, -1];
export function buildOudemanhuispoort(_w: number, _d: number, b: BuildingTools) {
  const pand = source.pands[0];
  const surfaces = pand.lod22 as LodSurface[];
  lodSurfaces(b, surfaces, ['WallSurface'], 'brick');
  lodSurfaces(b, surfaces, ['RoofSurface'], 'slate');
  const pts = ringPoints(pand.localRing);
  const es = edgesOf(pts).filter(e => e.len > 2);
  const ap = new T.Vector2(OMHP_PORTAL_POINT[0], OMHP_PORTAL_POINT[1]);
  const front: Edge = es.reduce((a, e) => (e.mid.distanceTo(ap) < a.mid.distanceTo(ap) ? e : a));
  const L = front.len, m = L / 2;
  // Sandstone piers and plinth framing the gateway.
  const pier = 1.3, open = Math.min(3.4, L - 2 * pier - .2);
  edgeBox(b, front, pier / 2 + .05, 0, pier, 6.4, .6, .3, 'stone');
  edgeBox(b, front, L - pier / 2 - .05, 0, pier, 6.4, .6, .3, 'stone');
  edgeBox(b, front, m, 5.2, L, 1.5, .6, .3, 'stone');
  // Dark passage opening (the through-passage), rusticated springers.
  edgeBox(b, front, m, 0, open, 5.2, .3, .4, 'dark');
  // Arched wooden transom panels above the opening, as in the 2025 photograph.
  for (const s of [-1, 1]) edgeBox(b, front, m + s * open * .25, 3.1, open * .42, 1.9, .12, .48, 'ochre');
  // Entablature and cornice over the portal.
  edgeBox(b, front, m, 6.7, L + .3, .35, .8, .42, 'stone');
  edgeBox(b, front, m, 7.05, L + .5, .18, .95, .5, 'stone');
  // Tall sash windows on the upper storeys of the front.
  for (const y of [8.4]) for (const s of [-1, 1]) {
    edgeBox(b, front, m + s * L * .25, y, 1.0, 2.0, .1, .06, 'white');
    edgeBox(b, front, m + s * L * .25, y + .08, .84, 1.84, .1, .1, 'glass');
  }
  void T;
}
