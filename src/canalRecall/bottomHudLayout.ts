// The bottom band now comes from `hudLayout`, which places the whole HUD for
// both the desktop 16:9 space and a phone. This module stays as the desktop
// entry point so the regression suite that pins these rectangles keeps proving
// the desktop arrangement has not moved while the portrait layout was added.
export { bottomHudLayout, rectsIntersect, type Rect, type BottomHudLayout } from './hudLayout.ts';
