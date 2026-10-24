/**
 * The ride's `window.CanalMapGuard` (js/map-guard.bundle.js): keep MapLibre alive
 * through a dead GPU (mapGuard) and step render cost down on slow machines
 * (renderGovernor). vector-map.js installs both on its map.
 */
export { guardMapRender, isDeadGpuShaderError, reportWebglUnavailable } from './mapGuard';
export { governMapRender, RenderGovernor } from './renderGovernor';
