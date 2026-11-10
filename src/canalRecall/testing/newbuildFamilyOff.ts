/**
 * Side-effect import for unit tests that pin the pre-2026-11-10 bay presets: turns the contemporary family
 * (`?newbuildFamily`, on by default) off. Import it FIRST, before bayLook.js, since the family's presets join
 * BAY_STYLES when bayLook.js is evaluated.
 */
(globalThis as { __canalRecallNewbuildFamily?: boolean }).__canalRecallNewbuildFamily = false;
export {};
