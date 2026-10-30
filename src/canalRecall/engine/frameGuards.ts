// The frame host under the same guards the MapLibre map has (vector-map.js
// `_installMap`): mapGuard's dead-GPU hold and one-shot Sentry graphics
// reports (context lost / restored / shader), and the render governor's
// pixel-ratio and shadow ladder. Both take the host as their "map": it has the
// `_render`, `on`, `getPixelRatio`/`setPixelRatio`/`redraw` they use.

import { guardMapRender, type MapGuardOptions } from '../mapGuard';
import { governMapRender, type RenderGovernor } from '../renderGovernor';
import type { FrameHost } from './frameHost';

export interface FrameGuardOptions {
  /** Page state for graphics reports (renderer counts, camera). */
  probe?: () => Record<string, unknown>;
  /** After a restore: did the shared frame get its renderer back? */
  restoredOk?: () => boolean;
  /** Switches the sun shadows (the governor's second rung). */
  setShadows?: (on: boolean) => void;
  /** Judge frames only while riding. */
  active?: () => boolean;
  /** `?governor=0`. */
  governor?: boolean;
  /** An explicit `?dpr=`: keep the pixel ratio, only the shadow step. */
  fixedPixelRatio?: boolean;
  report?: MapGuardOptions['report'];
}

export function guardFrameHost(host: FrameHost, options: FrameGuardOptions = {}): { guarded: boolean; governor: RenderGovernor | null } {
  const guarded = guardMapRender(host as unknown as Parameters<typeof guardMapRender>[0], {
    probe: options.probe,
    restoredOk: options.restoredOk,
    report: options.report,
  });
  const governor = options.governor === false ? null : governMapRender(host, {
    fixedPixelRatio: options.fixedPixelRatio,
    active: options.active,
    setShadows: options.setShadows,
    onStep: step => console.info('[canal-recall] render budget step', step),
  });
  return { guarded, governor };
}
