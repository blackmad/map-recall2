import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {edgeBox, edgesOf, edgeWindow, lodSurfaces, ringPoints, type LodSurface} from './civic-kit';
import source from './levend-paardenmuseum-footprints.json';

/**
 * Hollandsche Manege (1882), home of the Levend Paardenmuseum: BAG pand
 * 0363100012074454. Massing is the 3DBAG LoD2.2 solid (roof ridge ~17 m); the
 * Vondelstraat 140 gateway (white stucco portal: pilasters, lanterns, plaques, keystone, MANEGE frieze, arched timber doors, timber bay above) is
 * authored on the BAG edge nearest the Vondelstraat 140 address point.
 */
export const MANEGE_ADDRESS_POINT = [26.2, 33.7];
export function buildLevendPaardenmuseum(_w: number, _d: number, b: BuildingTools) {
  const pand = source.pands[0];
  const surfaces = pand.lod22 as LodSurface[];
  lodSurfaces(b, surfaces, ['WallSurface'], 'brick');
  lodSurfaces(b, surfaces, ['RoofSurface'], 'slate');
  const pts = ringPoints(pand.localRing);
  const es = edgesOf(pts);
  const ap = new T.Vector2(MANEGE_ADDRESS_POINT[0], MANEGE_ADDRESS_POINT[1]);
  // Front edge = ring edge closest to the address point.
  const dist = (e: ReturnType<typeof edgesOf>[number]) => {
    const t = Math.max(0, Math.min(e.len, ap.clone().sub(e.p).dot(e.u)));
    return e.p.clone().addScaledVector(e.u, t).distanceTo(ap);
  };
  const front = es.reduce((a, e) => (dist(e) < dist(a) ? e : a));
  const L = front.len, mid = L / 2;
  // White stucco portal block with rusticated plinth.
  edgeBox(b, front, mid, 0, L + .2, 6.3, .5, .15, 'white');
  edgeBox(b, front, mid, 0, L + .3, 1.0, .6, .2, 'stone');
  // Arched carriage opening: dark reveal, timber doors, fanlights.
  const aw = Math.min(L * .62, 4.2), ah = 3.6;
  edgeBox(b, front, mid, 0, aw, ah, .2, .42, 'dark');
  const arch = new T.Shape();
  arch.moveTo(-aw / 2, 0); arch.lineTo(aw / 2, 0); arch.lineTo(aw / 2, 0); arch.absarc(0, 0, aw / 2, 0, Math.PI, false); arch.lineTo(-aw / 2, 0);
  const archG = new T.ShapeGeometry(arch, 14);
  archG.rotateY(front.angle); archG.translate(front.p.x + front.u.x * mid + front.out.x * .43, ah, front.p.y + front.u.y * mid + front.out.y * .43);
  b.add(archG, 'dark');
  const doors = new T.BoxGeometry(aw - .3, ah - .2, .1); // timber doors
  doors.rotateY(front.angle); doors.translate(front.p.x + front.u.x * mid + front.out.x * .5, (ah - .2) / 2, front.p.y + front.u.y * mid + front.out.y * .5);
  b.add(doors, 'ochre');
  // Frieze band (the "MANEGE" frieze) and cornice above the arch.
  edgeBox(b, front, mid, 5.3, L + .5, .9, .6, .25, 'white');
  edgeBox(b, front, mid, 6.3, L + .7, .22, .8, .35, 'white');
  // Fluted pilasters with rusticated bases either side of the arch, panel plaques and the wall lanterns.
  for (const t of [.55, L - .55]) {
    edgeBox(b, front, t, 1.0, .75, 4.3, .2, .5, 'white');
    edgeBox(b, front, t, 5.0, .85, .3, .3, .55, 'white'); // capital
  }
  for (const t of [1.25, L - 1.25]) {
    edgeBox(b, front, t, 2.2, .55, 1.5, .08, .46, 'ochre'); // bronze plaque beside the arch
    edgeBox(b, front, t - .0, 3.5, .08, .08, .55, .45, 'dark'); // lantern bracket reaches into the plaque
    edgeBox(b, front, t, 3.55, .34, .6, .34, .95, 'glass'); // lantern
    edgeBox(b, front, t, 4.15, .4, .1, .4, .95, 'dark'); // lantern cap
  }
  // Keystone and archivolt band over the carriage opening.
  edgeBox(b, front, mid, ah + aw / 2 - .1, .4, .55, .25, .55, 'white');
  // Upper storeys: a three-window bay on each floor, timber sashes in white surrounds, segmental hoods on the first row.
  for (const t of [mid - 1.95, mid, mid + 1.95]) {
    edgeWindow(b, front, t, 6.9, 1.05, 2.15, {frame: 'ochre', mullions: 1});
    edgeWindow(b, front, t, 9.85, 1.05, 1.95, {frame: 'ochre', mullions: 1});
    edgeBox(b, front, t, 9.15, 1.5, .22, .3, .12, 'white'); // hood over the first-floor window
  }
  edgeBox(b, front, mid, 12.2, L + .5, .3, .5, .15, 'white'); // upper cornice
  // Roof lantern strip: simple skylight band is not modelled (hall roof only).
}
