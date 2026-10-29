import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { guardMapRender, type GuardableMap } from '../../src/canalRecall/mapGuard';

// The map-guard reload notice (src/canalRecall/mapGuard.ts). When the device's
// GPU process dies mid-shader, or a lost context never comes back, the guard
// mounts a dark plate over the map with one action: Reload. `mountNoticeIn` is
// private, so the story drives the guard itself — a stub map whose `_render`
// throws the empty-log shader error a dead GPU produces, and whose container is
// the box below. The notice is mounted by the guard's own code, in its own
// words; nothing is redrawn here, so what the screenshot shows is the real
// DOM, position and wrap.
//
// The two messages the guard can show are "The 3D map stopped responding after
// the device restarted its graphics. Reload to carry on." (this one) and the
// WebGL-refusal wording from `reportWebglUnavailable`; the plate is the same.

function GraphicsReloadFrame() {
  const mapBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = mapBox.current;
    if (!container) return;
    const map: GuardableMap = {
      // What a dead GPU answers on every compile: an empty info log.
      _render() { throw new Error('Could not compile fragment shader: '); },
      triggerRepaint() {},
      getContainer: () => container,
      getCanvas: () => null,
    };
    guardMapRender(map, {
      // The guard waits 8 s into a ride before admitting it; a story should not.
      noticeAfterMs: 0,
      // The guard's own timers, run at once, so the notice is up on the first
      // frame instead of after a visible pause.
      schedule: callback => window.setTimeout(callback, 0),
      cancel: handle => window.clearTimeout(handle as number),
      // There is no monitoring bundle in the workbench.
      report: () => {},
    });
    map._render?.();
    return () => {
      // Not `hideNotice`: the next story gets a fresh box, and the guard's
      // singleton id would otherwise make it skip the mount.
      container.querySelector('#canal-graphics-restarted')?.remove();
    };
  }, []);

  return (
    <div style={{
      position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden',
      background: '#dfe7dd',
    }}>
      {/* A stand-in map, the same one the HUD stories paint under their cards. */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(58deg, rgba(72,91,85,.22) 0 10px, transparent 10px 92px)',
      }} />
      {/* The map's container: the guard mounts the notice into this box. */}
      <div ref={mapBox} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}

const meta = {
  title: 'Canal Recall/Map guard',
  component: GraphicsReloadFrame,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof GraphicsReloadFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

const phone = { viewport: { value: 'mobile2', isRotated: false } };

/** A desktop GPU process died and drawing is held: the reload plate over the map. */
export const GraphicsReloadNotice: Story = {};
/** The same plate on a 414 px phone, where the message wraps beside Reload. */
export const GraphicsReloadNoticePhone: Story = { globals: phone };
