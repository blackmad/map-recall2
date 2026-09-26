/**
 * Craft-contract checks for large-letter postcards.
 *
 * These encode the P0/P1 rules in LARGE_LETTER_CRAFT.md so an agentic loop
 * fails closed before vision critique. Paint quality still needs eyes; this
 * stops regressions like endless extrusion and off-card captions.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LARGE_LETTER_HEIGHT,
  fitLetterPaintScale,
  measureLargeLetterPostcard,
  measurePaintedFaceBounds,
  measurePaintedLetterBounds,
} from '../src/canalRecall/largeLetterPostcard.ts';
import {
  LINEN_ARCH,
  POSTCARD_STYLES,
} from '../src/canalRecall/largeLetterPostcardStyles.ts';

const stub = (text: string, font: string) => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 12);
  // Approx Barlow Condensed advance (was 0.5 — too wide, starved billboard size).
  return text.length * size * 0.38;
};

/** Craft caps — tighten as paint improves; never loosen without updating the doc. */
const MAX_EXTRUSION_FRAC = 0.22;
const MAX_PATH_AMOUNT = 0.42;
const MIN_PATH_AMOUNT_ARCH = 0.05;
const MIN_BOTTOM_MARGIN = 28;
const MAX_SKEW_ABS = 0.22; // |c| in transform(a,b,c,d,e,f) we allow in paint
const MIN_BILLBOARD_FONT_FRAC = 0.28;
const MIN_FACE_FILL_FRAC = 0.50;

{
  // Place-true fixtures must be real JPEGs (not the old HTML error bodies).
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const name of [
    'amsterdam-canal.jpg',
    'amsterdam-houses.jpg',
    'amsterdam-bridge.jpg',
    'amsterdam-park.jpg',
    'amsterdam-anne.jpg',
    'amsterdam-westermarkt.jpg',
    'amsterdam-canalhouses.jpg',
  ]) {
    const bytes = readFileSync(path.join(root, 'stories/canal-drive/fixtures', name));
    assert.equal(bytes[0], 0xff, `${name} missing JPEG SOI`);
    assert.equal(bytes[1], 0xd8, `${name} missing JPEG SOI`);
    assert.ok(bytes.length > 20_000, `${name} too small to be a place photo`);
  }
}
{
  const card = measureLargeLetterPostcard({
    name: 'Jordaan',
    cityName: 'Amsterdam',
    provinceCaption: 'Noord-Holland',
    style: 'linen-arch',
    imageCount: 7,
  }, stub);

  const extrusionPx = card.extrusionSteps * Math.abs(card.extrusionDy);
  assert.ok(
    extrusionPx <= LARGE_LETTER_HEIGHT * MAX_EXTRUSION_FRAC,
    `extrusion ${extrusionPx.toFixed(1)}px exceeds ${MAX_EXTRUSION_FRAC * 100}% of card height — shorten dy/steps (P0)`,
  );

  assert.ok(
    card.style.pathAmount >= 0
      && card.style.pathAmount <= MAX_PATH_AMOUNT,
    `linen-arch pathAmount ${card.style.pathAmount} outside craft band [0, ${MAX_PATH_AMOUNT}]`,
  );

  const bottomMargin = card.height - card.captionY;
  assert.ok(
    bottomMargin >= MIN_BOTTOM_MARGIN,
    `caption too low (margin ${bottomMargin}px < ${MIN_BOTTOM_MARGIN})`,
  );

  assert.equal(card.glyphs.filter((g) => g.char !== ' ').length, 7);
  assert.ok(
    card.imageStripCount >= 7,
    'craft demo should request one image slot per letter (P1 contract)',
  );

  assert.ok(card.outlineWidth >= 2.2 && card.outlineWidth <= 6,
    `outlineWidth ${card.outlineWidth} should be a thin die-cut (not a tire)`);

  assert.ok(
    card.nameFontSize >= LARGE_LETTER_HEIGHT * MIN_BILLBOARD_FONT_FRAC,
    `JORDAAN font ${card.nameFontSize}px too small for billboard (want ≥${MIN_BILLBOARD_FONT_FRAC * 100}% of card height)`,
  );
  assert.ok(card.paintFit >= 0.55 && card.paintFit <= 1.05,
    `paintFit ${card.paintFit} should be a fit-to-frame fraction`);
  assert.ok(card.horizontalScale >= 0.68, 'billboard letters should not be needle-thin');
  assert.ok(card.facePullX === 1, 'facePullX must stay 1 — no fatten-past-advance overlap');
  assert.ok(card.borderInset <= 8,
    `borderInset ${card.borderInset} too thick (linen hairline ≤8)`);
  assert.ok(card.facePullY >= 1.15 && card.facePullY <= 3.0, `facePullY ${card.facePullY} out of range`);
  // Effective billboard mass after vertical pull.
  const faceH = card.nameFontSize * card.facePullY * card.paintScaleY;
  assert.ok(
    faceH >= LARGE_LETTER_HEIGHT * 0.52,
    `effective face height ${faceH.toFixed(0)}px too short (want ≥52% of card)`,
  );
  assert.ok(
    card.paintScaleY >= card.paintScaleX * 0.92,
    `paintScaleY ${card.paintScaleY.toFixed(2)} squashes vs sx ${card.paintScaleX.toFixed(2)} — lost vertical stretch`,
  );

  const painted = measurePaintedLetterBounds(card);
  // P0 blockers: nothing clipped by the paper clip edge.
  assert.ok(painted.minY >= card.borderInset + 12,
    `TOP CLIP: painted minY ${painted.minY.toFixed(1)} needs ≥12px inside border ${card.borderInset}`);
  assert.ok(painted.maxY <= card.height - card.borderInset + 8,
    `bottom spill: painted maxY ${painted.maxY.toFixed(1)} far outside paper`);
  assert.ok(painted.minX >= card.borderInset + 4,
    `left spill: painted minX ${painted.minX.toFixed(1)} needs ≥4px inside border`);
  assert.ok(painted.maxX <= card.width - card.borderInset + 4,
    `right spill: painted maxX ${painted.maxX.toFixed(1)} far outside paper`);
  const gSize = Number(/(\d+)px/.exec(card.greetingFont)?.[1] ?? 20);
  assert.ok(
    card.greetingY - gSize * 1.35 >= card.borderInset + 4,
    `GREETING CLIP: script top ~${(card.greetingY - gSize * 1.35).toFixed(0)} under border ${card.borderInset}`,
  );
  // Monterey: script ~15–25% of *painted* face AABB (not em×pull — that overstates).
  const wordFaceH = Math.max(48, (painted.maxY - painted.minY) * 0.82);
  const greetToFace = gSize / wordFaceH;
  assert.ok(
    greetToFace >= 0.10 && greetToFace <= 0.32,
    `greeting/face ratio ${greetToFace.toFixed(2)} outside Monterey band [0.10, 0.32] (g=${gSize} face≈${wordFaceH.toFixed(0)})`,
  );

  // Souvenir fill: letter faces must own the card — not float over a linen void.
  const faces = measurePaintedFaceBounds(card);
  const faceFill = (faces.maxY - faces.minY) / card.height;
  const voidBelow = card.height - faces.maxY;
  assert.ok(
    faceFill >= MIN_FACE_FILL_FRAC,
    `FACE FILL ${faceFill.toFixed(2)} < ${MIN_FACE_FILL_FRAC} (voidBelow=${voidBelow.toFixed(0)}px) — grow billboard`,
  );
  assert.ok(
    voidBelow <= card.height * 0.42,
    `BOTTOM VOID ${voidBelow.toFixed(0)}px too large under letter faces`,
  );
  assert.ok(
    faces.maxY >= card.height * 0.50,
    `letter faces end at y=${faces.maxY.toFixed(0)} — must reach ≥50% of card (no top-strip billboard)`,
  );
  assert.ok(
    faceFill <= 0.82,
    `FACE FILL ${faceFill.toFixed(2)} too large — short names were blowing past the frame`,
  );
  assert.ok(
    card.style.path === 'wave' || card.style.path === 'arch' || card.style.path === 'rise',
    `linen craft path should be wave/arch/rise, got ${card.style.path}`,
  );
}

{
  // OUD WEST two-line: crest clear + no mid-word shelf seam (draw-order contract).
  const card = measureLargeLetterPostcard({
    name: 'Oud-West',
    cityName: 'Amsterdam',
    style: 'desert-warm',
    imageCount: 7,
  }, stub);
  assert.ok(card.nameLines.length === 2, 'Oud-West should split to two lines');
  const painted = measurePaintedLetterBounds(card);
  const faces = measurePaintedFaceBounds(card);
  const gSize = Number(/(\d+)px/.exec(card.greetingFont)?.[1] ?? 20);
  assert.ok(
    painted.minY >= card.borderInset + 14,
    `OUD WEST TOP CLIP: painted minY ${painted.minY.toFixed(1)}`,
  );
  assert.ok(
    faces.minY >= card.borderInset + 18,
    `OUD WEST crest faces.minY ${faces.minY.toFixed(1)} too high`,
  );
  assert.ok(
    card.greetingY - gSize * 1.35 >= card.borderInset + 4,
    `OUD WEST GREETING CLIP: top ~${(card.greetingY - gSize * 1.35).toFixed(0)}`,
  );
  assert.ok(
    card.nameFontSize <= LARGE_LETTER_HEIGHT * 0.38,
    `OUD WEST font ${card.nameFontSize} too tall for two-line stack`,
  );
  const depth = card.extrusionSteps * Math.abs(card.extrusionDy);
  assert.ok(
    depth <= LARGE_LETTER_HEIGHT * 0.12,
    `OUD WEST extrusion ${depth.toFixed(1)}px too deep for two-line (invades lower line)`,
  );
}

{
  // IJBURG + rise-coastal was the clipped greeting / crest regression.
  const card = measureLargeLetterPostcard({
    name: 'IJburg',
    cityName: 'Amsterdam',
    provinceCaption: 'Noord-Holland',
    style: 'rise-coastal',
    imageCount: 6,
  }, stub);
  const painted = measurePaintedLetterBounds(card);
  const faces = measurePaintedFaceBounds(card);
  const gSize = Number(/(\d+)px/.exec(card.greetingFont)?.[1] ?? 20);
  assert.ok(
    painted.minY >= card.borderInset + 14,
    `IJBURG TOP CLIP: painted minY ${painted.minY.toFixed(1)}`,
  );
  assert.ok(
    painted.minX >= card.borderInset + 4,
    `IJBURG LEFT CLIP: painted minX ${painted.minX.toFixed(1)}`,
  );
  assert.ok(
    faces.minY >= card.borderInset + 16,
    `IJBURG crest faces.minY ${faces.minY.toFixed(1)} too high`,
  );
  assert.ok(
    card.greetingY - gSize * 1.35 >= card.borderInset + 4,
    `IJBURG GREETING CLIP: top ~${(card.greetingY - gSize * 1.35).toFixed(0)}`,
  );
}

{
  // fitLetterPaintScale unit: oversized desired bulk must shrink.
  const card = measureLargeLetterPostcard({
    name: 'Jordaan',
    cityName: 'Amsterdam',
    style: 'linen-arch',
    imageCount: 7,
  }, stub);
  const tight = fitLetterPaintScale({
    glyphs: card.glyphs,
    nameFontSize: card.nameFontSize,
    extrusionSteps: card.extrusionSteps,
    extrusionDx: card.extrusionDx,
    extrusionDy: card.extrusionDy,
    outlineWidth: card.outlineWidth,
    frame: { minX: 80, minY: 80, maxX: 560, maxY: 320 },
    pivotX: card.paintPivotX,
    pivotY: card.paintPivotY,
    desiredScaleX: 1.6,
    desiredScaleY: 1.6,
    facePullY: card.facePullY,
  });
  assert.ok(tight.fit < 1, 'fit-to-frame should shrink when content exceeds the paper');

  const span = card.glyphs[card.glyphs.length - 1].x
    + card.glyphs[card.glyphs.length - 1].width
    - card.glyphs[0].x;
  assert.ok(
    span >= card.letterBand.width * 0.9,
    `letter span ${span.toFixed(0)}px should fill ≥90% of band ${card.letterBand.width}px`,
  );
}

{
  // Document the skew cap so paint changes get reviewed against it.
  // drawPerspectiveLetterBlock must keep |c| ≤ MAX_SKEW_ABS.
  assert.ok(MAX_SKEW_ABS <= 0.22);
  assert.equal(typeof LINEN_ARCH.extrusionDx, 'number');
}

{
  for (const id of Object.keys(POSTCARD_STYLES) as Array<keyof typeof POSTCARD_STYLES>) {
    const style = POSTCARD_STYLES[id];
    const depth = style.extrusionSteps * Math.abs(style.extrusionDy);
    assert.ok(
      depth <= LARGE_LETTER_HEIGHT * MAX_EXTRUSION_FRAC + 8,
      `${id} extrusion depth ${depth.toFixed(1)}px over craft budget`,
    );
  }
}

process.stdout.write('Large-letter craft checks passed.\n');
process.stdout.write(`Craft caps: extrusion≤${MAX_EXTRUSION_FRAC * 100}%H path∈[${MIN_PATH_AMOUNT_ARCH},${MAX_PATH_AMOUNT}] skew≤${MAX_SKEW_ABS} bottomMargin≥${MIN_BOTTOM_MARGIN}\n`);
