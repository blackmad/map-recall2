// The own world view, or null when the browser refuses WebGL (lane loading-lines, 2026-11-27).
// Sentry CANAL-RECALL-C: Chrome blocks WebGL for a page after repeated context losses. Under MapLibre the Map
// constructor threw and vector-map.js carried on without a basemap (webgl-refused.spec.ts). With the own engine as
// the default, `new OwnWorldView` threw from the Game constructor (three's WebGLRenderer finds no context) and the
// page never started. game.js takes null as "no world view" and builds the map-less VectorBasemap instead.
import { reportWebglUnavailable } from '../mapGuard';
import { OwnWorldView } from './ownWorldView';

export function ownWorldViewOrNull(
  container: HTMLElement | null,
  create: (container: HTMLElement | null) => OwnWorldView = c => new OwnWorldView(c as HTMLElement),
  report: (container: HTMLElement | null, error: unknown) => void = (c, e) => { reportWebglUnavailable(c, e); },
): OwnWorldView | null {
  try {
    return create(container);
  } catch (error) {
    console.error('Canal Recall: no WebGL for the own engine; riding without the 3D world.', error);
    try { report(container, error); } catch { /* the notice is best effort */ }
    return null;
  }
}
