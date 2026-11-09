import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { OwnLabelFade } from '../../src/canalRecall/ownMap/labelFade';
import { drawPlacedLabels, type PlacedLabel } from '../../src/canalRecall/ownMap/labels';
import { LABEL_PAINT } from '../../src/canalRecall/engine/overlays/labelLayer';

// The own engine's label fade (#288, src/canalRecall/ownMap/labelFade.ts): a
// label eases in over 300 ms when it wins a place and eases out over 300 ms
// when it loses it, a name the landmark approach withholds included. The
// story drives the fade itself at 60 Hz with fixed timestamps and paints each
// frame with the engine's own painter and paint (drawPlacedLabels,
// LABEL_PAINT), so every column is the frame the engine draws at that time:
// a POI name and a street name, every 50 ms, fading in then out.

const STEP_MS = 50;
const COLUMNS = 7;

function strip(width: number, fadeOut: boolean): { alphas: number[]; frames: PlacedLabel[][] } {
  const fade = new OwnLabelFade();
  const colW = width / COLUMNS;
  const poi: PlacedLabel = { id: 'p', text: 'Westerkerk', kind: 'poi', size: 12, x: 0, y: 26 };
  const advance = 7.2;
  const street: PlacedLabel = { id: 's', text: 'Prinsengracht', kind: 'street', size: 12, glyphs: [...'Prinsengracht'].map((ch, i) => ({ ch, x: (i - 6) * advance, y: 58 + (i - 6) * 1.2, angle: 0.16 })) };
  const frames: PlacedLabel[][] = [], alphas: number[] = [];
  let t = 1000;
  const run = (placed: PlacedLabel[], ms: number) => { let out: ReturnType<OwnLabelFade['update']> = []; for (let k = 0; k < ms; k += 1000 / 60) { out = fade.update(placed, t, () => null, () => ({ x: 0, y: 0, depth: 1 })); t += 1000 / 60; } return out; };
  if (fadeOut) run([poi, street], 400);
  for (let c = 0; c < COLUMNS; c++) {
    const out = c === 0 ? (fadeOut ? fade.update([poi, street], t, () => null, () => ({ x: 0, y: 0, depth: 1 })) : []) : run(fadeOut ? [] : [poi, street], STEP_MS);
    alphas.push(out[0]?.alpha ?? 0);
    frames.push(out.map(l => (l.glyphs ? { ...l, glyphs: l.glyphs.map(g => ({ ...g, x: g.x + colW * (c + 0.5) })) } : { ...l, x: (l.x ?? 0) + colW * (c + 0.5) })));
  }
  return { alphas, frames };
}

function FadeStrip({ fadeOut }: { fadeOut: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const width = canvas.clientWidth, height = 96, dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#e9e4d8'; ctx.fillRect(0, 0, width, height);
    const { alphas, frames } = strip(width, fadeOut);
    frames.forEach((placed, c) => {
      drawPlacedLabels(ctx, placed, LABEL_PAINT);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#6b6457'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`${c * STEP_MS} ms · ${alphas[c].toFixed(2)}`, (width / COLUMNS) * c + 4, height - 6);
    });
  }, [fadeOut]);
  return <canvas ref={ref} data-testid="own-label-fade" style={{ width: '100%', height: 96, display: 'block' }} />;
}

const meta: Meta<typeof FadeStrip> = {
  title: 'Canal Drive/Own engine label fade',
  component: FadeStrip,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof FadeStrip>;

const phone = { viewport: { defaultViewport: 'mobile1' } };

export const FadeIn: Story = { args: { fadeOut: false } };
export const FadeOut: Story = { args: { fadeOut: true } };
export const FadeInPhone: Story = { args: { fadeOut: false }, parameters: phone };
export const FadeOutPhone: Story = { args: { fadeOut: true }, parameters: phone };
