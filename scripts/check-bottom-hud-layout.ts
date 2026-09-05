// The bottom band used to be placed by independent hand-tuned constants, and
// two of them were wrong: the postcard was drawn straight over the trip
// readout, and the trivia card was lifted by a stacking allowance
// (NEIGHBORHOOD_CARD_HEIGHT, 180) that was 76 px taller than the postcard
// actually is — all to clear a 10 px horizontal overlap.
//
// This check states the property those constants could not: across the
// scenario matrix, no two bottom-band rectangles intersect and none leaves the
// screen. The minimap is not placed by the layout module (it holds the
// bottom-left corner unconditionally), so it enters the check as the fixed
// rectangle the runtime draws.

import assert from 'node:assert/strict';
import { bottomHudLayout, rectsIntersect, type Rect } from '../src/canalRecall/bottomHudLayout.ts';

const CANVAS_W = 1280;
const CANVAS_H = 720;

// hud.js drawCityOverview: 260×200 at (15, CANVAS_H - 215).
const MINIMAP: Rect = { x: 15, y: CANVAS_H - 200 - 15, width: 260, height: 200 };

// Measured from the runtime: the trip readout is monospace text plus 22 px of
// padding, so it varies with speed and distance; the trivia card is 480 wide
// at three heights — name only, name plus two lines, and the taller card that
// carries a photo.
const TRIP_WIDTHS = [132, 152, 180];
const LANDMARK_HEIGHTS = [52, 85, 104, 136];

function onScreen(rect: Rect): boolean {
  return rect.x >= 0 && rect.y >= 0
    && rect.x + rect.width <= CANVAS_W
    && rect.y + rect.height <= CANVAS_H;
}

let scenarios = 0;
for (const tripWidth of TRIP_WIDTHS) {
  for (const postcardVisible of [false, true]) {
    for (const landmarkVisible of [false, true]) {
      for (const landmarkHeight of LANDMARK_HEIGHTS) {
        for (const minimapVisible of [false, true]) {
          for (const zoomVisible of [false, true]) {
            for (const controlsVisible of [false, true]) {
          const layout = bottomHudLayout({ tripWidth, postcardVisible, landmarkHeight, zoomVisible, controlsVisible });
          const band: Array<[string, Rect]> = [['trip', layout.trip]];
          if (minimapVisible) band.push(['minimap', MINIMAP]);
          if (postcardVisible) band.push(['postcard', layout.postcard]);
          if (landmarkVisible) band.push(['landmark', layout.landmark]);
          if (zoomVisible) band.push(['zoom', layout.zoomBadge]);
          if (controlsVisible) band.push(['controls', layout.controlsHint]);

          const name = `trip${tripWidth}`
            + (minimapVisible ? '+minimap' : '')
            + (postcardVisible ? '+postcard' : '')
            + (landmarkVisible ? `+card${landmarkHeight}` : '')
            + (zoomVisible ? '+zoom' : '')
            + (controlsVisible ? '+controls' : '');

          for (let i = 0; i < band.length; i++) {
            assert.ok(onScreen(band[i][1]), `${band[i][0]} is off screen in ${name}: ${JSON.stringify(band[i][1])}`);
            for (let j = i + 1; j < band.length; j++) {
              assert.equal(
                rectsIntersect(band[i][1], band[j][1]),
                false,
                `${band[i][0]} overlaps ${band[j][0]} in ${name}: `
                  + `${JSON.stringify(band[i][1])} vs ${JSON.stringify(band[j][1])}`,
              );
            }
          }
          scenarios++;
            }
          }
        }
      }
    }
  }
}

// --- Named regressions -------------------------------------------------------

// The postcard used to sit on top of the trip readout while keeping its
// right-hand anchor. It clears it by stacking now, and stays anchored right.
{
  const layout = bottomHudLayout({ tripWidth: 180, postcardVisible: true });
  assert.equal(layout.postcard.x, CANVAS_W - 390 - 20, 'the postcard keeps its right-edge anchor');
  assert.ok(
    layout.postcard.y + layout.postcard.height <= layout.trip.y,
    'the postcard sits above the trip readout instead of over it',
  );
}

// A 10 px horizontal overlap with the postcard used to throw the trivia card
// 194 px up the screen. It is a sideways shift now, and the card keeps its row.
{
  const withPostcard = bottomHudLayout({ tripWidth: 180, postcardVisible: true, landmarkHeight: 130 });
  const alone = bottomHudLayout({ tripWidth: 180, postcardVisible: false, landmarkHeight: 130 });
  assert.equal(withPostcard.landmark.y, alone.landmark.y, 'a postcard does not lift the trivia card');
  assert.ok(withPostcard.landmark.x < alone.landmark.x, 'the trivia card shifts sideways to clear the postcard');
  assert.ok(
    alone.landmark.x - withPostcard.landmark.x < 60,
    `the shift stays small: moved ${alone.landmark.x - withPostcard.landmark.x} px`,
  );
  assert.ok(
    withPostcard.landmark.x > MINIMAP.x + MINIMAP.width,
    'and never shifts into the minimap',
  );
}

process.stdout.write(`Bottom HUD layout checks passed (${scenarios} scenarios).\n`);
