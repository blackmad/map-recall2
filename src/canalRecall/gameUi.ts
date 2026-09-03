// The browser adapter's single entry point for HUD geometry and theming.
//
// Bundled to `js/game-ui.bundle.js` as `CanalRecallUi`, so the legacy canvas
// runtime asks one global where a card goes and what colour it is, instead of
// carrying a second copy of those numbers.
export * from './viewport.ts';
export * from './touchControls.ts';
export * from './hudLayout.ts';
export * from './hudTheme.ts';
